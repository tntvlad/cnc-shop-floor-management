const db = require('../config/database');

class MaterialStock {
    /**
     * Get all material stock with filters
     */
    static async getAll(filters = {}) {
        let query = `
            SELECT 
                ms.*,
                mt.name AS material_type_name,
                mt.specification_code AS type_spec_code,
                mt.category AS material_category,
                sl.code AS location_code,
                sl.zone AS location_zone,
                sl.shelf AS location_shelf,
                s.name AS supplier_name,
                (ms.current_stock - ms.reserved_stock) AS available_qty
            FROM material_stock ms
            LEFT JOIN material_types mt ON ms.material_type_id = mt.id
            LEFT JOIN storage_locations sl ON ms.location_id = sl.id
            LEFT JOIN suppliers s ON ms.supplier_id = s.id
            WHERE 1=1
        `;
        const values = [];
        let paramCount = 1;

        // Apply filters
        if (filters.material_type_id) {
            query += ` AND ms.material_type_id = $${paramCount}`;
            values.push(filters.material_type_id);
            paramCount++;
        }

        if (filters.shape_type) {
            query += ` AND ms.shape_type = $${paramCount}`;
            values.push(filters.shape_type);
            paramCount++;
        }

        if (filters.size_category) {
            query += ` AND ms.size_category = $${paramCount}`;
            values.push(filters.size_category);
            paramCount++;
        }

        if (filters.status) {
            query += ` AND ms.status = $${paramCount}`;
            values.push(filters.status);
            paramCount++;
        }

        if (filters.quality_status) {
            query += ` AND ms.quality_status = $${paramCount}`;
            values.push(filters.quality_status);
            paramCount++;
        }

        if (filters.min_available) {
            query += ` AND (ms.current_stock - ms.reserved_stock) >= $${paramCount}`;
            values.push(filters.min_available);
            paramCount++;
        }

        if (filters.material_type_ids && filters.material_type_ids.length > 0) {
            query += ` AND ms.material_type_id = ANY($${paramCount})`;
            values.push(filters.material_type_ids);
            paramCount++;
        }

        query += ` ORDER BY ms.size_index ASC, ms.created_at DESC`;

        if (filters.limit) {
            query += ` LIMIT $${paramCount}`;
            values.push(filters.limit);
        }

        const result = await db.query(query, values);
        return result.rows;
    }

    /**
     * Get material stock by ID
     */
    static async getById(id) {
        const query = `
            SELECT 
                ms.*,
                mt.name AS material_type_name,
                mt.specification_code AS type_spec_code,
                mt.category AS material_category,
                sl.code AS location_code,
                sl.zone AS location_zone,
                s.name AS supplier_name,
                (ms.current_stock - ms.reserved_stock) AS available_qty
            FROM material_stock ms
            LEFT JOIN material_types mt ON ms.material_type_id = mt.id
            LEFT JOIN storage_locations sl ON ms.location_id = sl.id
            LEFT JOIN suppliers s ON ms.supplier_id = s.id
            WHERE ms.id = $1
        `;
        const result = await db.query(query, [id]);
        return result.rows[0] || null;
    }

    /**
     * Find available stock by material type and dimensions
     * Also searches by material_name if type IDs not provided
     */
    static async findAvailable(materialTypeIds, shapeType, minDimensions, requiredQty, materialName = null) {
        const { width, height, thickness, diameter } = minDimensions;
        
        console.log('[findAvailable] Input:', { materialTypeIds, shapeType, minDimensions, requiredQty, materialName });
        
        let query = `
            SELECT 
                ms.*,
                mt.name AS material_type_name,
                mt.specification_code AS type_spec_code,
                sl.code AS location_code,
                (ms.current_stock - ms.reserved_stock) AS available_qty
            FROM material_stock ms
            LEFT JOIN material_types mt ON ms.material_type_id = mt.id
            LEFT JOIN storage_locations sl ON ms.location_id = sl.id
            WHERE ms.status = 'available'
              AND (ms.current_stock - ms.reserved_stock) >= $1
        `;
        const values = [requiredQty];
        let paramCount = 2;

        // Filter by material type IDs or material_name
        if (materialTypeIds && materialTypeIds.length > 0) {
            query += ` AND (ms.material_type_id = ANY($${paramCount}) OR LOWER(ms.material_name) = LOWER($${paramCount + 1}))`;
            values.push(materialTypeIds);
            values.push(materialName || '');
            paramCount += 2;
        } else if (materialName) {
            // Fallback: search by material_name if no type IDs
            query += ` AND (LOWER(ms.material_name) LIKE LOWER($${paramCount}) OR LOWER(mt.name) LIKE LOWER($${paramCount}))`;
            values.push(`%${materialName}%`);
            paramCount++;
        }

        // Filter by shape type if provided
        if (shapeType) {
            query += ` AND ms.shape_type = $${paramCount}`;
            values.push(shapeType);
            paramCount++;
        }

        // Dimension filters depend on shape type
        if (shapeType === 'plate' || shapeType === 'sheet') {
            // For plates: width/height are interchangeable (can rotate the part)
            // Only thickness must be >= required
            if (thickness) {
                query += ` AND (ms.thickness IS NULL OR ms.thickness >= $${paramCount})`;
                values.push(thickness);
                paramCount++;
            }
            
            // For width/height: check if stock can fit in any orientation
            // Stock's larger dimension >= required larger dimension
            // Stock's smaller dimension >= required smaller dimension
            if (width && height) {
                const largerReq = Math.max(width, height);
                const smallerReq = Math.min(width, height);
                // GREATEST/LEAST handle the rotation check
                query += ` AND (
                    (ms.width IS NULL AND ms.height IS NULL) OR
                    (GREATEST(COALESCE(ms.width, 0), COALESCE(ms.height, 0), COALESCE(ms.length, 0)) >= $${paramCount}
                     AND LEAST(
                         CASE WHEN ms.width > 0 THEN ms.width ELSE 99999 END,
                         CASE WHEN ms.height > 0 THEN ms.height ELSE 99999 END,
                         CASE WHEN ms.length > 0 THEN ms.length ELSE 99999 END
                     ) >= $${paramCount + 1})
                )`;
                values.push(largerReq, smallerReq);
                paramCount += 2;
            } else if (width) {
                // Only width specified - any planar dimension must be >= width
                query += ` AND (ms.width IS NULL OR ms.width >= $${paramCount} OR ms.height >= $${paramCount} OR ms.length >= $${paramCount})`;
                values.push(width);
                paramCount++;
            } else if (height) {
                // Only height specified - any planar dimension must be >= height
                query += ` AND (ms.height IS NULL OR ms.height >= $${paramCount} OR ms.width >= $${paramCount} OR ms.length >= $${paramCount})`;
                values.push(height);
                paramCount++;
            }
        } else {
            // For bars and other shapes: standard dimension matching
            if (width) {
                query += ` AND (ms.width IS NULL OR ms.width >= $${paramCount})`;
                values.push(width);
                paramCount++;
            }
            if (height) {
                query += ` AND (ms.height IS NULL OR ms.height >= $${paramCount})`;
                values.push(height);
                paramCount++;
            }
            if (thickness) {
                query += ` AND (ms.thickness IS NULL OR ms.thickness >= $${paramCount})`;
                values.push(thickness);
                paramCount++;
            }
            if (diameter) {
                query += ` AND (ms.diameter IS NULL OR ms.diameter >= $${paramCount})`;
                values.push(diameter);
                paramCount++;
            }
        }

        query += ` ORDER BY ms.size_index ASC LIMIT 20`;

        console.log('[findAvailable] Query:', query);
        console.log('[findAvailable] Values:', values);

        const result = await db.query(query, values);
        console.log('[findAvailable] Results:', result.rows.length);
        return result.rows;
    }

    /**
     * Calculate size index based on shape and dimensions
     */
    static calculateSizeIndex(shapeType, dimensions) {
        const { diameter, width, height, thickness } = dimensions;
        
        switch (shapeType) {
            case 'bar_round':
                return diameter || 0;
            case 'bar_square':
                return (width || 0) * (width || 0);
            case 'bar_hex':
                return width || 0;
            case 'plate':
            case 'sheet':
                return (width || 0) * (height || 0) * (thickness || 1);
            case 'tube':
                return (diameter || 0) * (thickness || 1);
            default:
                return (width || 0) * (height || 1);
        }
    }

    /**
     * Determine size category
     */
    static determineSizeCategory(sizeIndex) {
        if (sizeIndex < 10) return 'small';
        if (sizeIndex < 50) return 'medium';
        if (sizeIndex < 200) return 'large';
        return 'extra_large';
    }

    /**
     * Create new material stock
     */
    static async create(data) {
        const {
            material_name, material_type, material_type_id, specification_code,
            shape_type, diameter, width, height, thickness, length,
            current_stock, reserved_stock, reorder_level, unit,
            supplier_id, location_id, cost_per_unit, unit_weight,
            quality_status, supplier_batch_number, notes
        } = data;

        // Calculate size index
        const sizeIndex = this.calculateSizeIndex(shape_type, { diameter, width, height, thickness });
        const sizeCategory = this.determineSizeCategory(sizeIndex);

        const query = `
            INSERT INTO material_stock (
                material_name, material_type, material_type_id, specification_code,
                shape_type, diameter, width, height, thickness, length,
                current_stock, reserved_stock, reorder_level, unit,
                supplier_id, location_id, cost_per_unit, unit_weight,
                size_index, size_category, quality_status, supplier_batch_number, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
            RETURNING *
        `;
        const values = [
            material_name, material_type, material_type_id || null, specification_code || null,
            shape_type || null, diameter || null, width || null, height || null, thickness || null, length || null,
            current_stock || 0, reserved_stock || 0, reorder_level || 0, unit || 'pieces',
            supplier_id || null, location_id || null, cost_per_unit || null, unit_weight || null,
            sizeIndex, sizeCategory, quality_status || 'new', supplier_batch_number || null, notes || null
        ];
        const result = await db.query(query, values);
        return result.rows[0];
    }

    /**
     * Update material stock
     */
    static async update(id, data) {
        const fields = [];
        const values = [];
        let paramCount = 1;

        const allowedFields = [
            'material_name', 'material_type', 'material_type_id', 'specification_code',
            'shape_type', 'diameter', 'width', 'height', 'thickness', 'length',
            'current_stock', 'reserved_stock', 'reorder_level', 'unit',
            'supplier_id', 'location_id', 'cost_per_unit', 'unit_weight', 'total_value',
            'quality_status', 'supplier_batch_number', 'status', 'notes', 'last_used_date'
        ];

        for (const field of allowedFields) {
            if (data[field] !== undefined) {
                fields.push(`${field} = $${paramCount}`);
                values.push(data[field]);
                paramCount++;
            }
        }

        // Always update updated_at
        fields.push(`updated_at = CURRENT_TIMESTAMP`);

        if (fields.length === 1) return null; // Only updated_at

        values.push(id);
        const query = `
            UPDATE material_stock 
            SET ${fields.join(', ')}
            WHERE id = $${paramCount}
            RETURNING *
        `;
        const result = await db.query(query, values);
        return result.rows[0];
    }

    /**
     * Reserve material (add to reserved_stock)
     */
    static async reserve(id, quantity, partId = null) {
        const query = `
            UPDATE material_stock
            SET reserved_stock = reserved_stock + $2,
                last_used_date = CURRENT_TIMESTAMP,
                status = CASE 
                    WHEN (current_stock - reserved_stock - $2) <= 0 THEN 'reserved'
                    WHEN (current_stock - reserved_stock - $2) <= reorder_level THEN 'low_stock'
                    ELSE status
                END
            WHERE id = $1
              AND (current_stock - reserved_stock) >= $2
            RETURNING *
        `;
        const result = await db.query(query, [id, quantity]);
        return result.rows[0];
    }

    /**
     * Release reserved material
     */
    static async releaseReserve(id, quantity) {
        const query = `
            UPDATE material_stock
            SET reserved_stock = GREATEST(0, reserved_stock - $2),
                status = CASE 
                    WHEN (current_stock - GREATEST(0, reserved_stock - $2)) > reorder_level THEN 'available'
                    ELSE status
                END
            WHERE id = $1
            RETURNING *
        `;
        const result = await db.query(query, [id, quantity]);
        return result.rows[0];
    }

    /**
     * Consume from stock (reduce current_stock and reserved_stock)
     */
    static async consume(id, quantity) {
        const query = `
            UPDATE material_stock
            SET current_stock = current_stock - $2,
                reserved_stock = GREATEST(0, reserved_stock - $2),
                last_used_date = CURRENT_TIMESTAMP,
                status = CASE 
                    WHEN (current_stock - $2) <= 0 THEN 'out_of_stock'
                    WHEN (current_stock - $2 - reserved_stock) <= reorder_level THEN 'low_stock'
                    ELSE status
                END
            WHERE id = $1
              AND current_stock >= $2
            RETURNING *
        `;
        const result = await db.query(query, [id, quantity]);
        return result.rows[0];
    }

    /**
     * Add stock (increase current_stock)
     */
    static async addStock(id, quantity) {
        const query = `
            UPDATE material_stock
            SET current_stock = current_stock + $2,
                status = CASE 
                    WHEN (current_stock + $2 - reserved_stock) > reorder_level THEN 'available'
                    ELSE status
                END
            WHERE id = $1
            RETURNING *
        `;
        const result = await db.query(query, [id, quantity]);
        return result.rows[0];
    }

    /**
     * Delete material stock
     */
    static async delete(id) {
        const query = `DELETE FROM material_stock WHERE id = $1 RETURNING *`;
        const result = await db.query(query, [id]);
        return result.rows[0];
    }
}

module.exports = MaterialStock;
