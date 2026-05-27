const db = require('../config/database');

class Tool {
    /**
     * Get all tools with filters and pagination
     */
    static async getAll(filters = {}) {
        let query = `
            SELECT
                t.*,
                tc.name AS category_name,
                tc.code AS category_code,
                tb.name AS brand_name,
                tb.country AS brand_country,
                s.name AS supplier_name,
                cab.code AS cabinet_code,
                cab.name AS cabinet_name
            FROM tools t
            LEFT JOIN tool_categories tc ON t.category_id = tc.id
            LEFT JOIN tool_brands tb ON t.brand_id = tb.id
            LEFT JOIN suppliers s ON t.supplier_id = s.id
            LEFT JOIN tool_cabinets cab ON t.cabinet_id = cab.id
            WHERE 1=1
        `;
        const values = [];
        let p = 1;

        if (filters.status) {
            query += ` AND t.status = $${p++}`;
            values.push(filters.status);
        }
        if (filters.category_id) {
            query += ` AND t.category_id = $${p++}`;
            values.push(filters.category_id);
        }
        if (filters.brand_id) {
            query += ` AND t.brand_id = $${p++}`;
            values.push(filters.brand_id);
        }
        if (filters.cabinet_id) {
            query += ` AND t.cabinet_id = $${p++}`;
            values.push(filters.cabinet_id);
        }
        if (filters.low_stock_only) {
            query += ` AND t.quantity_available <= t.minimum_quantity AND t.status != 'retired'`;
        }
        if (filters.search) {
            query += ` AND (
                t.tool_number ILIKE $${p} OR
                t.tool_type ILIKE $${p} OR
                t.internal_code ILIKE $${p} OR
                tc.name ILIKE $${p} OR
                tb.name ILIKE $${p}
            )`;
            values.push(`%${filters.search}%`);
            p++;
        }

        // Count query for pagination
        const countQuery = query.replace(
            /SELECT[\s\S]*?FROM tools t/,
            'SELECT COUNT(*) AS total FROM tools t'
        );

        query += ` ORDER BY tc.name ASC, t.tool_number ASC`;

        if (filters.limit) {
            query += ` LIMIT $${p++}`;
            values.push(parseInt(filters.limit));
        }
        if (filters.offset) {
            query += ` OFFSET $${p++}`;
            values.push(parseInt(filters.offset));
        }

        const [result, countResult] = await Promise.all([
            db.query(query, values),
            db.query(countQuery, values.slice(0, p - 1 - (filters.limit ? 1 : 0) - (filters.offset ? 1 : 0)))
        ]);

        return {
            tools: result.rows,
            total: parseInt(countResult.rows[0]?.total || 0)
        };
    }

    /**
     * Get single tool by ID with full details
     */
    static async getById(id) {
        const result = await db.query(`
            SELECT
                t.*,
                tc.name AS category_name,
                tc.code AS category_code,
                tb.name AS brand_name,
                tb.country AS brand_country,
                tb.website AS brand_website,
                s.name AS supplier_name,
                s.contact_person AS supplier_contact,
                s.phone AS supplier_phone,
                s.email AS supplier_email,
                cab.code AS cabinet_code,
                cab.name AS cabinet_name,
                cab.location_description AS cabinet_location
            FROM tools t
            LEFT JOIN tool_categories tc ON t.category_id = tc.id
            LEFT JOIN tool_brands tb ON t.brand_id = tb.id
            LEFT JOIN suppliers s ON t.supplier_id = s.id
            LEFT JOIN tool_cabinets cab ON t.cabinet_id = cab.id
            WHERE t.id = $1
        `, [id]);
        return result.rows[0] || null;
    }

    /**
     * Create a new tool
     */
    static async create(data) {
        const {
            tool_number, tool_type, category_id, brand_id, supplier_id,
            cabinet_id, drawer_slot, internal_code,
            diameter, length, shank_diameter, cutting_length, overall_length,
            flute_count, tool_material, coating, material,
            quantity_available = 0, minimum_quantity = 1,
            is_resharpable = false, expected_tool_life,
            current_cost, cost_per_tool,
            location, notes
        } = data;

        const result = await db.query(`
            INSERT INTO tools (
                tool_number, tool_type, category_id, brand_id, supplier_id,
                cabinet_id, drawer_slot, internal_code,
                diameter, length, shank_diameter, cutting_length, overall_length,
                flute_count, tool_material, coating, material,
                quantity_available, minimum_quantity,
                is_resharpable, expected_tool_life,
                current_cost, cost_per_tool,
                location, notes, status,
                created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8,
                $9, $10, $11, $12, $13,
                $14, $15, $16, $17,
                $18, $19,
                $20, $21,
                $22, $23,
                $24, $25, 'available',
                NOW(), NOW()
            )
            RETURNING *
        `, [
            tool_number, tool_type, category_id, brand_id, supplier_id,
            cabinet_id, drawer_slot, internal_code,
            diameter, length, shank_diameter, cutting_length, overall_length,
            flute_count, tool_material, coating, material,
            quantity_available, minimum_quantity,
            is_resharpable, expected_tool_life,
            current_cost, cost_per_tool,
            location, notes
        ]);
        return result.rows[0];
    }

    /**
     * Update a tool
     */
    static async update(id, data) {
        const fields = [];
        const values = [];
        let p = 1;

        const allowed = [
            'tool_number', 'tool_type', 'category_id', 'brand_id', 'supplier_id',
            'cabinet_id', 'drawer_slot', 'internal_code',
            'diameter', 'length', 'shank_diameter', 'cutting_length', 'overall_length',
            'flute_count', 'tool_material', 'coating', 'material',
            'minimum_quantity', 'is_resharpable', 'expected_tool_life',
            'current_cost', 'cost_per_tool', 'location', 'notes', 'status', 'image_path'
        ];

        for (const key of allowed) {
            if (data[key] !== undefined) {
                fields.push(`${key} = $${p++}`);
                values.push(data[key]);
            }
        }

        if (fields.length === 0) return await Tool.getById(id);

        fields.push(`updated_at = NOW()`);
        values.push(id);

        const result = await db.query(
            `UPDATE tools SET ${fields.join(', ')} WHERE id = $${p} RETURNING *`,
            values
        );
        return result.rows[0];
    }

    /**
     * Soft-delete (retire) a tool
     */
    static async retire(id, userId) {
        const result = await db.query(`
            UPDATE tools
            SET status = 'retired', updated_at = NOW()
            WHERE id = $1
            RETURNING *
        `, [id]);

        if (result.rows[0]) {
            await db.query(`
                INSERT INTO tool_transactions (tool_id, transaction_type, quantity, quantity_after, performed_by, notes)
                VALUES ($1, 'retired', 0, 0, $2, 'Tool retired from service')
            `, [id, userId]);
        }

        return result.rows[0];
    }

    /**
     * Add a price history record (and update current_cost on tool)
     */
    static async addPriceRecord(toolId, data) {
        const { price, currency = 'RON', supplier_id, purchase_order_number,
            invoice_number, quantity_purchased = 1, purchase_date, recorded_by, notes } = data;

        const result = await db.query(`
            INSERT INTO tool_price_history
                (tool_id, price, currency, supplier_id, purchase_order_number,
                 invoice_number, quantity_purchased, purchase_date, recorded_by, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
        `, [toolId, price, currency, supplier_id, purchase_order_number,
            invoice_number, quantity_purchased, purchase_date || new Date(), recorded_by, notes]);

        // Update denormalized current_cost on tools row
        await db.query(
            `UPDATE tools SET current_cost = $1, cost_per_tool = $1, updated_at = NOW() WHERE id = $2`,
            [price, toolId]
        );

        return result.rows[0];
    }

    /**
     * Get price history for a tool
     */
    static async getPriceHistory(toolId) {
        const result = await db.query(`
            SELECT ph.*, s.name AS supplier_name, u.name AS recorded_by_name
            FROM tool_price_history ph
            LEFT JOIN suppliers s ON ph.supplier_id = s.id
            LEFT JOIN users u ON ph.recorded_by = u.id
            WHERE ph.tool_id = $1
            ORDER BY ph.purchase_date DESC, ph.created_at DESC
        `, [toolId]);
        return result.rows;
    }

    /**
     * Stock in — receive tools into inventory
     */
    static async stockIn(toolId, quantity, userId, notes) {
        const result = await db.query(`
            UPDATE tools
            SET quantity_available = quantity_available + $1,
                status = CASE WHEN status = 'in_use' THEN 'available' ELSE status END,
                updated_at = NOW()
            WHERE id = $2
            RETURNING quantity_available
        `, [quantity, toolId]);

        const newQty = result.rows[0]?.quantity_available;

        await db.query(`
            INSERT INTO tool_transactions
                (tool_id, transaction_type, quantity, quantity_after, performed_by, notes)
            VALUES ($1, 'stock_in', $2, $3, $4, $5)
        `, [toolId, quantity, newQty, userId, notes]);

        return newQty;
    }

    /**
     * Stock out — remove tools from inventory
     */
    static async stockOut(toolId, quantity, userId, data = {}) {
        // Check availability first
        const check = await db.query(
            `SELECT quantity_available FROM tools WHERE id = $1`, [toolId]
        );
        const current = check.rows[0]?.quantity_available || 0;
        if (current < quantity) {
            throw new Error(`Insufficient stock. Available: ${current}, Requested: ${quantity}`);
        }

        const result = await db.query(`
            UPDATE tools
            SET
                quantity_available = quantity_available - $1,
                parts_produced_total = parts_produced_total + $2,
                parts_since_sharpen = parts_since_sharpen + $2,
                status = CASE WHEN $3 IS NOT NULL THEN 'in_use' ELSE status END,
                updated_at = NOW()
            WHERE id = $4
            RETURNING quantity_available
        `, [quantity, data.parts_produced || 0, data.given_to || null, toolId]);

        const newQty = result.rows[0]?.quantity_available;

        await db.query(`
            INSERT INTO tool_transactions
                (tool_id, transaction_type, quantity, quantity_after,
                 part_id, order_id, machine_id, performed_by, given_to, condition, notes)
            VALUES ($1, 'stock_out', $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [toolId, quantity, newQty,
            data.part_id || null, data.order_id || null, data.machine_id || null,
            userId, data.given_to || null, data.condition || 'good', data.notes || null]);

        return newQty;
    }

    /**
     * Get transaction log for a tool
     */
    static async getTransactions(toolId) {
        const result = await db.query(`
            SELECT tt.*, u.name AS performed_by_name,
                g.name AS given_to_name,
                p.part_name, p.part_number,
                m.machine_name
            FROM tool_transactions tt
            LEFT JOIN users u ON tt.performed_by = u.id
            LEFT JOIN users g ON tt.given_to = g.id
            LEFT JOIN parts p ON tt.part_id = p.id
            LEFT JOIN machines m ON tt.machine_id = m.id
            WHERE tt.tool_id = $1
            ORDER BY tt.created_at DESC
            LIMIT 100
        `, [toolId]);
        return result.rows;
    }

    /**
     * All stock_out checkouts across all tools
     */
    static async getCheckouts(limit = 100, offset = 0) {
        const result = await db.query(`
            SELECT tt.id, tt.created_at, tt.quantity, tt.notes, tt.condition,
                   t.id AS tool_id, t.tool_number, t.tool_type,
                   performer.name AS performed_by_name,
                   recipient.name AS given_to_name
            FROM tool_transactions tt
            JOIN tools t ON tt.tool_id = t.id
            LEFT JOIN users performer ON tt.performed_by = performer.id
            LEFT JOIN users recipient ON tt.given_to = recipient.id
            WHERE tt.transaction_type = 'stock_out'
            ORDER BY tt.created_at DESC
            LIMIT $1 OFFSET $2
        `, [limit, offset]);
        return result.rows;
    }

    /**
     * Dashboard stats
     */
    static async getStats() {
        const result = await db.query(`
            SELECT
                COUNT(*) FILTER (WHERE status != 'retired') AS total_active,
                COUNT(*) FILTER (WHERE status = 'available') AS available,
                COUNT(*) FILTER (WHERE status = 'in_use') AS in_use,
                COUNT(*) FILTER (WHERE status = 'worn') AS worn,
                COUNT(*) FILTER (WHERE status = 'sharpening') AS sharpening,
                COUNT(*) FILTER (WHERE status = 'retired') AS retired,
                COUNT(*) FILTER (WHERE quantity_available <= minimum_quantity AND status != 'retired') AS low_stock,
                COUNT(*) FILTER (WHERE quantity_available = 0 AND status != 'retired') AS out_of_stock,
                SUM(quantity_available * COALESCE(current_cost, cost_per_tool, 0)) AS total_value,
                COUNT(DISTINCT category_id) FILTER (WHERE status != 'retired') AS category_count,
                COUNT(DISTINCT brand_id) FILTER (WHERE status != 'retired') AS brand_count
            FROM tools
        `);
        return result.rows[0];
    }

    /**
     * Get tools below minimum quantity
     */
    static async getLowStock() {
        const result = await db.query(`
            SELECT
                t.*,
                tc.name AS category_name,
                tb.name AS brand_name,
                s.name AS supplier_name,
                s.phone AS supplier_phone
            FROM tools t
            LEFT JOIN tool_categories tc ON t.category_id = tc.id
            LEFT JOIN tool_brands tb ON t.brand_id = tb.id
            LEFT JOIN suppliers s ON t.supplier_id = s.id
            WHERE t.quantity_available <= t.minimum_quantity
              AND t.status != 'retired'
            ORDER BY (t.minimum_quantity - t.quantity_available) DESC, t.tool_number ASC
        `);
        return result.rows;
    }

    /**
     * Get all categories
     */
    static async getCategories() {
        const result = await db.query(`
            SELECT tc.*, COUNT(t.id) AS tool_count
            FROM tool_categories tc
            LEFT JOIN tools t ON t.category_id = tc.id AND t.status != 'retired'
            WHERE tc.is_active = true
            GROUP BY tc.id
            ORDER BY tc.name ASC
        `);
        return result.rows;
    }

    /**
     * Get all brands
     */
    static async getBrands() {
        const result = await db.query(`
            SELECT tb.*, COUNT(t.id) AS tool_count
            FROM tool_brands tb
            LEFT JOIN tools t ON t.brand_id = tb.id AND t.status != 'retired'
            WHERE tb.is_active = true
            GROUP BY tb.id
            ORDER BY tb.name ASC
        `);
        return result.rows;
    }

    /**
     * Create a brand
     */
    static async createBrand(data) {
        const { name, country, website, notes } = data;
        const result = await db.query(`
            INSERT INTO tool_brands (name, country, website, notes)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [name, country, website, notes]);
        return result.rows[0];
    }

    /**
     * Update a brand
     */
    static async updateBrand(id, data) {
        const { name, country, website, notes, is_active } = data;
        const result = await db.query(`
            UPDATE tool_brands
            SET name = COALESCE($1, name),
                country = $2,
                website = $3,
                notes = $4,
                is_active = COALESCE($5, is_active)
            WHERE id = $6
            RETURNING *
        `, [name, country, website, notes, is_active, id]);
        return result.rows[0];
    }

    /**
     * Get all cabinets
     */
    static async getCabinets() {
        const result = await db.query(`
            SELECT cab.*,
                COUNT(t.id) FILTER (WHERE t.status != 'retired') AS tool_count
            FROM tool_cabinets cab
            LEFT JOIN tools t ON t.cabinet_id = cab.id
            WHERE cab.is_active = true
            GROUP BY cab.id
            ORDER BY cab.code ASC
        `);
        return result.rows;
    }

    /**
     * Create a cabinet
     */
    static async createCabinet(data) {
        const { code, name, location_description, total_drawers = 1, notes } = data;
        const result = await db.query(`
            INSERT INTO tool_cabinets (code, name, location_description, total_drawers, notes)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [code, name, location_description, total_drawers, notes]);
        return result.rows[0];
    }
}

module.exports = Tool;
