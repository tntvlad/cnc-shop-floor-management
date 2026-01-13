const db = require('../config/database');

class MaterialType {
    /**
     * Get all material types with equivalents count
     */
    static async getAll() {
        const query = `
            SELECT 
                mt.*,
                eq.name AS equivalent_to_name,
                (SELECT COUNT(*) FROM material_equivalents me WHERE me.material_type_id_primary = mt.id) AS equivalents_count
            FROM material_types mt
            LEFT JOIN material_types eq ON mt.equivalent_to_id = eq.id
            WHERE mt.is_active = true
            ORDER BY mt.category, mt.name
        `;
        const result = await db.query(query);
        return result.rows;
    }

    /**
     * Get material type by ID with full details
     */
    static async getById(id) {
        const query = `
            SELECT 
                mt.*,
                eq.name AS equivalent_to_name,
                eq.specification_code AS equivalent_spec_code
            FROM material_types mt
            LEFT JOIN material_types eq ON mt.equivalent_to_id = eq.id
            WHERE mt.id = $1
        `;
        const result = await db.query(query, [id]);
        return result.rows[0] || null;
    }

    /**
     * Find material types by name, alias, or specification code
     */
    static async findByNameOrSpec(searchTerm) {
        const query = `
            SELECT mt.*
            FROM material_types mt
            WHERE mt.is_active = true
              AND (
                  LOWER(mt.name) LIKE LOWER($1)
                  OR LOWER(mt.specification_code) LIKE LOWER($1)
                  OR LOWER(mt.specification_name) LIKE LOWER($1)
                  OR EXISTS (
                      SELECT 1 FROM unnest(mt.aliases) AS alias 
                      WHERE LOWER(alias) LIKE LOWER($1)
                  )
              )
            ORDER BY 
                CASE WHEN LOWER(mt.name) = LOWER($2) THEN 0
                     WHEN LOWER(mt.specification_code) = LOWER($2) THEN 1
                     ELSE 2 END,
                mt.name
            LIMIT 20
        `;
        const searchPattern = `%${searchTerm}%`;
        const result = await db.query(query, [searchPattern, searchTerm]);
        return result.rows;
    }

    /**
     * Get all equivalent materials for a material type
     */
    static async getEquivalents(materialTypeId) {
        const query = `
            SELECT 
                mt.*,
                me.equivalent_rank,
                me.notes AS equivalence_notes
            FROM material_equivalents me
            JOIN material_types mt ON me.material_type_id_equivalent = mt.id
            WHERE me.material_type_id_primary = $1
              AND mt.is_active = true
            ORDER BY me.equivalent_rank, mt.name
        `;
        const result = await db.query(query, [materialTypeId]);
        return result.rows;
    }

    /**
     * Get all material type IDs that are equivalent (including self)
     */
    static async getAllEquivalentIds(materialTypeId) {
        const query = `
            WITH RECURSIVE equivalent_tree AS (
                -- Start with the material itself
                SELECT id FROM material_types WHERE id = $1
                UNION
                -- Add direct equivalents from material_equivalents table
                SELECT me.material_type_id_equivalent
                FROM material_equivalents me
                WHERE me.material_type_id_primary = $1
                UNION
                -- Add materials that have this as their equivalent_to_id
                SELECT mt.id
                FROM material_types mt
                WHERE mt.equivalent_to_id = $1
                UNION
                -- Add the parent equivalent_to if exists
                SELECT mt.equivalent_to_id
                FROM material_types mt
                WHERE mt.id = $1 AND mt.equivalent_to_id IS NOT NULL
            )
            SELECT DISTINCT id FROM equivalent_tree WHERE id IS NOT NULL
        `;
        const result = await db.query(query, [materialTypeId]);
        return result.rows.map(r => r.id);
    }

    /**
     * Find material type ID by name or alias
     */
    static async findIdByNameOrAlias(name) {
        const query = `
            SELECT id FROM material_types
            WHERE is_active = true
              AND (
                  LOWER(name) = LOWER($1)
                  OR LOWER(specification_code) = LOWER($1)
                  OR $1 = ANY(SELECT LOWER(unnest(aliases)))
              )
            LIMIT 1
        `;
        const result = await db.query(query, [name]);
        return result.rows[0]?.id || null;
    }

    /**
     * Create new material type
     */
    static async create(data) {
        const {
            name, category, density, aliases, description,
            specification_code, specification_standard, specification_name,
            material_grade, equivalent_to_id, is_preferred, notes
        } = data;

        const query = `
            INSERT INTO material_types (
                name, category, density, aliases, description,
                specification_code, specification_standard, specification_name,
                material_grade, equivalent_to_id, is_preferred, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *
        `;
        const values = [
            name, category, density || null,
            aliases ? (Array.isArray(aliases) ? aliases : aliases.split(',').map(a => a.trim())) : [],
            description || null,
            specification_code || null, specification_standard || null, specification_name || null,
            material_grade || null, equivalent_to_id || null, is_preferred || false, notes || null
        ];
        const result = await db.query(query, values);
        return result.rows[0];
    }

    /**
     * Update material type
     */
    static async update(id, data) {
        const fields = [];
        const values = [];
        let paramCount = 1;

        const allowedFields = [
            'name', 'category', 'density', 'aliases', 'description', 'is_active',
            'specification_code', 'specification_standard', 'specification_name',
            'material_grade', 'equivalent_to_id', 'is_preferred', 'notes'
        ];

        for (const field of allowedFields) {
            if (data[field] !== undefined) {
                fields.push(`${field} = $${paramCount}`);
                if (field === 'aliases' && typeof data[field] === 'string') {
                    values.push(data[field].split(',').map(a => a.trim()));
                } else {
                    values.push(data[field]);
                }
                paramCount++;
            }
        }

        if (fields.length === 0) return null;

        values.push(id);
        const query = `
            UPDATE material_types 
            SET ${fields.join(', ')}
            WHERE id = $${paramCount}
            RETURNING *
        `;
        const result = await db.query(query, values);
        return result.rows[0];
    }

    /**
     * Add material equivalence
     */
    static async addEquivalent(primaryId, equivalentId, rank = 1, notes = null) {
        const query = `
            INSERT INTO material_equivalents (material_type_id_primary, material_type_id_equivalent, equivalent_rank, notes)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (material_type_id_primary, material_type_id_equivalent) 
            DO UPDATE SET equivalent_rank = $3, notes = $4
            RETURNING *
        `;
        const result = await db.query(query, [primaryId, equivalentId, rank, notes]);
        return result.rows[0];
    }

    /**
     * Remove material equivalence
     */
    static async removeEquivalent(primaryId, equivalentId) {
        const query = `
            DELETE FROM material_equivalents 
            WHERE material_type_id_primary = $1 AND material_type_id_equivalent = $2
            RETURNING *
        `;
        const result = await db.query(query, [primaryId, equivalentId]);
        return result.rows[0];
    }

    /**
     * Delete material type (soft delete)
     */
    static async delete(id) {
        const query = `
            UPDATE material_types SET is_active = false WHERE id = $1 RETURNING *
        `;
        const result = await db.query(query, [id]);
        return result.rows[0];
    }
}

module.exports = MaterialType;
