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
                loc.code AS location_code,
                loc.name AS location_name,
                cab.code AS cabinet_code,
                cab.name AS cabinet_name,
                sh.code  AS shelf_code,
                sh.name  AS shelf_name,
                bx.code  AS box_code,
                bx.name  AS box_name,
                at.name AS application_type_name,
                at.color AS application_type_color
            FROM tools t
            LEFT JOIN tool_categories tc ON t.category_id = tc.id
            LEFT JOIN tool_brands tb ON t.brand_id = tb.id
            LEFT JOIN suppliers s ON t.supplier_id = s.id
            LEFT JOIN tool_cabinets cab ON t.cabinet_id = cab.id
            LEFT JOIN tool_locations loc ON cab.location_id = loc.id
            LEFT JOIN tool_shelves sh ON t.shelf_id = sh.id
            LEFT JOIN tool_boxes bx ON t.box_id = bx.id
            LEFT JOIN tool_application_types at ON t.application_type_id = at.id
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
                loc.code AS location_code,
                loc.name AS location_name,
                cab.code AS cabinet_code,
                cab.name AS cabinet_name,
                cab.location_description AS cabinet_location,
                sh.code  AS shelf_code,
                sh.name  AS shelf_name,
                bx.code  AS box_code,
                bx.name  AS box_name,
                at.name AS application_type_name,
                at.color AS application_type_color
            FROM tools t
            LEFT JOIN tool_categories tc ON t.category_id = tc.id
            LEFT JOIN tool_brands tb ON t.brand_id = tb.id
            LEFT JOIN suppliers s ON t.supplier_id = s.id
            LEFT JOIN tool_cabinets cab ON t.cabinet_id = cab.id
            LEFT JOIN tool_locations loc ON cab.location_id = loc.id
            LEFT JOIN tool_shelves sh ON t.shelf_id = sh.id
            LEFT JOIN tool_boxes bx ON t.box_id = bx.id
            LEFT JOIN tool_application_types at ON t.application_type_id = at.id
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
            cabinet_id, shelf_id, box_id, drawer_slot, internal_code,
            diameter, length, shank_diameter, cutting_length, overall_length,
            flute_count, tool_material, coating, material,
            quantity_available = 0, minimum_quantity = 1,
            is_resharpable = false, expected_tool_life,
            current_cost, cost_per_tool,
            location, notes, application_type_id
        } = data;

        const result = await db.query(`
            INSERT INTO tools (
                tool_number, tool_type, category_id, brand_id, supplier_id,
                cabinet_id, shelf_id, box_id, drawer_slot, internal_code,
                diameter, length, shank_diameter, cutting_length, overall_length,
                flute_count, tool_material, coating, material,
                quantity_available, minimum_quantity,
                is_resharpable, expected_tool_life,
                current_cost, cost_per_tool,
                location, notes, application_type_id, status,
                created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, $9, $10,
                $11, $12, $13, $14, $15,
                $16, $17, $18, $19, $20,
                $21, $22,
                $23, $24,
                $25, $26,
                $27, $28, $29, 'available',
                NOW(), NOW()
            )
            RETURNING *
        `, [
            tool_number, tool_type, category_id, brand_id, supplier_id,
            cabinet_id || null, shelf_id || null, box_id || null, drawer_slot, internal_code,
            diameter, length, shank_diameter, cutting_length, overall_length,
            flute_count, tool_material, coating, material,
            quantity_available, minimum_quantity,
            is_resharpable, expected_tool_life,
            current_cost, cost_per_tool,
            location, notes, application_type_id || null
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
            'cabinet_id', 'shelf_id', 'box_id', 'drawer_slot', 'internal_code',
            'diameter', 'length', 'shank_diameter', 'cutting_length', 'overall_length',
            'flute_count', 'tool_material', 'coating', 'material',
            'minimum_quantity', 'is_resharpable', 'expected_tool_life',
            'current_cost', 'cost_per_tool', 'location', 'notes', 'status', 'image_path',
            'application_type_id'
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
                   recipient.name AS given_to_name,
                   at.name AS application_type_name,
                   at.color AS application_type_color
            FROM tool_transactions tt
            JOIN tools t ON tt.tool_id = t.id
            LEFT JOIN users performer ON tt.performed_by = performer.id
            LEFT JOIN users recipient ON tt.given_to = recipient.id
            LEFT JOIN tool_application_types at ON t.application_type_id = at.id
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
                s.phone AS supplier_phone,
                at.name AS application_type_name,
                at.color AS application_type_color
            FROM tools t
            LEFT JOIN tool_categories tc ON t.category_id = tc.id
            LEFT JOIN tool_brands tb ON t.brand_id = tb.id
            LEFT JOIN suppliers s ON t.supplier_id = s.id
            LEFT JOIN tool_application_types at ON t.application_type_id = at.id
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
    static async getCabinets(locationId) {
        const values = [];
        let where = 'WHERE cab.is_active = true';
        if (locationId) { where += ' AND cab.location_id = $1'; values.push(locationId); }
        const result = await db.query(`
            SELECT cab.*,
                loc.code AS location_code,
                loc.name AS location_name,
                COUNT(t.id) FILTER (WHERE t.status != 'retired') AS tool_count
            FROM tool_cabinets cab
            LEFT JOIN tool_locations loc ON cab.location_id = loc.id
            LEFT JOIN tools t ON t.cabinet_id = cab.id
            ${where}
            GROUP BY cab.id, loc.code, loc.name
            ORDER BY cab.code ASC
        `, values);
        return result.rows;
    }

    static async createCabinet(data) {
        const { code, name, location_id, location_description, total_drawers = 1, notes } = data;
        const result = await db.query(`
            INSERT INTO tool_cabinets (code, name, location_id, location_description, total_drawers, notes)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [code, name, location_id || null, location_description, total_drawers, notes]);
        return result.rows[0];
    }

    static async updateCabinet(id, data) {
        const { code, name, location_id, location_description, total_drawers, notes, is_active } = data;
        const result = await db.query(`
            UPDATE tool_cabinets
            SET code = COALESCE($1, code),
                name = COALESCE($2, name),
                location_id = $3,
                location_description = $4,
                total_drawers = COALESCE($5, total_drawers),
                notes = $6,
                is_active = COALESCE($7, is_active)
            WHERE id = $8
            RETURNING *
        `, [code, name, location_id || null, location_description, total_drawers, notes, is_active, id]);
        return result.rows[0];
    }

    static async deleteCabinet(id) {
        await db.query('UPDATE tools SET cabinet_id = NULL, shelf_id = NULL, box_id = NULL WHERE cabinet_id = $1', [id]);
        await db.query('DELETE FROM tool_cabinets WHERE id = $1', [id]);
    }

    // ── Locations ─────────────────────────────────────────────

    static async getLocations() {
        const result = await db.query(`
            SELECT loc.*,
                COUNT(cab.id) FILTER (WHERE cab.is_active = true) AS cabinet_count
            FROM tool_locations loc
            LEFT JOIN tool_cabinets cab ON cab.location_id = loc.id
            WHERE loc.is_active = true
            GROUP BY loc.id
            ORDER BY loc.code ASC
        `);
        return result.rows;
    }

    static async createLocation(data) {
        const { code, name, description } = data;
        const result = await db.query(`
            INSERT INTO tool_locations (code, name, description)
            VALUES ($1, $2, $3)
            RETURNING *
        `, [code, name, description || null]);
        return result.rows[0];
    }

    static async updateLocation(id, data) {
        const { code, name, description, is_active } = data;
        const result = await db.query(`
            UPDATE tool_locations
            SET code = COALESCE($1, code),
                name = COALESCE($2, name),
                description = $3,
                is_active = COALESCE($4, is_active)
            WHERE id = $5
            RETURNING *
        `, [code, name, description, is_active, id]);
        return result.rows[0];
    }

    static async deleteLocation(id) {
        await db.query('UPDATE tool_cabinets SET location_id = NULL WHERE location_id = $1', [id]);
        await db.query('DELETE FROM tool_locations WHERE id = $1', [id]);
    }

    // ── Shelves ───────────────────────────────────────────────

    static async getShelves(cabinetId) {
        const values = [];
        let where = 'WHERE sh.is_active = true';
        if (cabinetId) { where += ' AND sh.cabinet_id = $1'; values.push(cabinetId); }
        const result = await db.query(`
            SELECT sh.*,
                cab.code AS cabinet_code,
                cab.name AS cabinet_name,
                COUNT(bx.id) FILTER (WHERE bx.is_active = true) AS box_count,
                COUNT(t.id) FILTER (WHERE t.status != 'retired') AS tool_count
            FROM tool_shelves sh
            JOIN tool_cabinets cab ON sh.cabinet_id = cab.id
            LEFT JOIN tool_boxes bx ON bx.shelf_id = sh.id
            LEFT JOIN tools t ON t.shelf_id = sh.id
            ${where}
            GROUP BY sh.id, cab.code, cab.name
            ORDER BY cab.code ASC, sh.code ASC
        `, values);
        return result.rows;
    }

    static async createShelf(data) {
        const { cabinet_id, code, name } = data;
        const result = await db.query(`
            INSERT INTO tool_shelves (cabinet_id, code, name)
            VALUES ($1, $2, $3)
            RETURNING *
        `, [cabinet_id, code, name || null]);
        return result.rows[0];
    }

    static async updateShelf(id, data) {
        const { code, name, cabinet_id, is_active } = data;
        const result = await db.query(`
            UPDATE tool_shelves
            SET code = COALESCE($1, code),
                name = $2,
                cabinet_id = COALESCE($3, cabinet_id),
                is_active = COALESCE($4, is_active)
            WHERE id = $5
            RETURNING *
        `, [code, name, cabinet_id, is_active, id]);
        return result.rows[0];
    }

    static async deleteShelf(id) {
        await db.query('UPDATE tools SET shelf_id = NULL, box_id = NULL WHERE shelf_id = $1', [id]);
        await db.query('DELETE FROM tool_shelves WHERE id = $1', [id]);
    }

    // ── Boxes ─────────────────────────────────────────────────

    static async getBoxes(shelfId) {
        const values = [];
        let where = 'WHERE bx.is_active = true';
        if (shelfId) { where += ' AND bx.shelf_id = $1'; values.push(shelfId); }
        const result = await db.query(`
            SELECT bx.*,
                sh.code AS shelf_code,
                sh.name AS shelf_name,
                cab.code AS cabinet_code,
                COUNT(t.id) FILTER (WHERE t.status != 'retired') AS tool_count
            FROM tool_boxes bx
            JOIN tool_shelves sh ON bx.shelf_id = sh.id
            JOIN tool_cabinets cab ON sh.cabinet_id = cab.id
            LEFT JOIN tools t ON t.box_id = bx.id
            ${where}
            GROUP BY bx.id, sh.code, sh.name, cab.code
            ORDER BY cab.code ASC, sh.code ASC, bx.code ASC
        `, values);
        return result.rows;
    }

    static async createBox(data) {
        const { shelf_id, code, name } = data;
        const result = await db.query(`
            INSERT INTO tool_boxes (shelf_id, code, name)
            VALUES ($1, $2, $3)
            RETURNING *
        `, [shelf_id, code, name || null]);
        return result.rows[0];
    }

    static async updateBox(id, data) {
        const { code, name, shelf_id, is_active } = data;
        const result = await db.query(`
            UPDATE tool_boxes
            SET code = COALESCE($1, code),
                name = $2,
                shelf_id = COALESCE($3, shelf_id),
                is_active = COALESCE($4, is_active)
            WHERE id = $5
            RETURNING *
        `, [code, name, shelf_id, is_active, id]);
        return result.rows[0];
    }

    static async deleteBox(id) {
        await db.query('UPDATE tools SET box_id = NULL WHERE box_id = $1', [id]);
        await db.query('DELETE FROM tool_boxes WHERE id = $1', [id]);
    }
}

module.exports = Tool;
