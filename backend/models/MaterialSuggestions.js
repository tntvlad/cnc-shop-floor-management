const db = require('../config/database');
const MaterialType = require('./MaterialType');
const MaterialStock = require('./MaterialStock');

class MaterialSuggestions {
    /**
     * Calculate size match score based on shape type
     * For plates: all 3 dimensions can be rotated - smallest goes to thickness
     */
    static calculateSizeMatch(shapeType, candidateDims, requiredDims) {
        const { width: cW, height: cH, thickness: cT, diameter: cD, length: cL } = candidateDims;
        const { width: rW, height: rH, thickness: rT, diameter: rD } = requiredDims;
        const TOLERANCE = 0.02; // ±2%

        if (shapeType === 'plate' || shapeType === 'sheet') {
            // Stock dimensions: thickness is fixed, surface is width × length
            const stockThickness = cT || 0;
            const stockSurface = [cW || 0, cL || 0].sort((a, b) => b - a); // [larger, smaller]
            
            // Required dimensions: can be oriented any way
            // Sort all 3 required dims - smallest can go to thickness
            const reqAll = [rW || 0, rH || 0, rT || 0].filter(d => d > 0).sort((a, b) => a - b);
            
            if (reqAll.length === 0) return 50; // No dimensions specified
            
            // The smallest required dimension must fit the stock thickness
            const reqThickness = reqAll[0];
            // The two larger dimensions must fit on the stock surface
            const reqSurface = reqAll.length >= 3 
                ? [reqAll[2], reqAll[1]] // [largest, middle]
                : reqAll.length >= 2 
                    ? [reqAll[1], reqAll[0]]
                    : [reqAll[0], 0];
            
            // Check if part fits
            if (stockThickness > 0 && stockThickness < reqThickness) {
                return 0; // Stock too thin
            }
            if (reqSurface[0] > 0 && stockSurface[0] < reqSurface[0]) {
                return 0; // Stock surface too small (largest dim)
            }
            if (reqSurface[1] > 0 && stockSurface[1] < reqSurface[1]) {
                return 0; // Stock surface too small (middle dim)
            }

            // Check for exact match within tolerance
            const thicknessMatch = !reqThickness || (stockThickness > 0 && Math.abs(stockThickness - reqThickness) / reqThickness <= TOLERANCE);
            const dim1Match = !reqSurface[0] || (stockSurface[0] > 0 && Math.abs(stockSurface[0] - reqSurface[0]) / reqSurface[0] <= TOLERANCE);
            const dim2Match = !reqSurface[1] || (stockSurface[1] > 0 && Math.abs(stockSurface[1] - reqSurface[1]) / reqSurface[1] <= TOLERANCE);

            if (dim1Match && dim2Match && thicknessMatch) {
                return 100; // Exact match
            }

            // Calculate waste percentage based on volume
            const requiredVolume = (reqSurface[0] || 1) * (reqSurface[1] || 1) * (reqThickness || 1);
            const candidateVolume = (stockSurface[0] || 1) * (stockSurface[1] || 1) * (stockThickness || 1);
            const wastePercentage = ((candidateVolume - requiredVolume) / requiredVolume) * 100;

            // Score based on waste
            return Math.max(0, 100 - Math.min(wastePercentage, 100));
        }

        if (shapeType === 'bar_round') {
            if (!rD || !cD) return 50;
            if (cD < rD) return 0; // Too small

            // Exact match check
            if (Math.abs(cD - rD) / rD <= TOLERANCE) {
                return 100;
            }

            const wastePercentage = ((cD - rD) / rD) * 100;
            return Math.max(0, 100 - wastePercentage);
        }

        if (shapeType === 'bar_square' || shapeType === 'bar_hex') {
            if (!rW || !cW) return 50;
            if (cW < rW) return 0; // Too small

            // Exact match check
            if (Math.abs(cW - rW) / rW <= TOLERANCE) {
                return 100;
            }

            const wastePercentage = ((cW - rW) / rW) * 100;
            return Math.max(0, 100 - wastePercentage);
        }

        return 50; // Unknown shape, neutral score
    }

    /**
     * Calculate availability score
     */
    static calculateAvailabilityScore(currentStock, reserved, required) {
        const available = currentStock - reserved;

        if (available < required) {
            return 0; // Insufficient stock
        }

        const ratio = available / required;

        if (ratio >= 2) return 20;      // 2x or more = great
        if (ratio >= 1.5) return 15;    // 1.5x = good
        if (ratio >= 1.2) return 10;    // 1.2x = ok
        if (ratio >= 1.0) return 5;     // Just enough

        return 0;
    }

    /**
     * Calculate freshness score based on last used date
     */
    static calculateFreshnessScore(lastUsedDate, createdDate) {
        const now = new Date();
        const lastUsed = lastUsedDate ? new Date(lastUsedDate) : (createdDate ? new Date(createdDate) : now);
        const daysSinceUsed = (now - lastUsed) / (24 * 60 * 60 * 1000);

        if (daysSinceUsed <= 7) return 15;      // Used recently
        if (daysSinceUsed <= 30) return 12;     // Used this month
        if (daysSinceUsed <= 90) return 8;      // Used this quarter
        if (daysSinceUsed <= 180) return 3;     // Used in last 6 months

        return 0; // Very old stock
    }

    /**
     * Calculate cost score
     */
    static calculateCostScore(costPerUnit, allCosts) {
        if (!costPerUnit || !allCosts || allCosts.length === 0) return 5;

        const validCosts = allCosts.filter(c => c > 0);
        if (validCosts.length === 0) return 5;

        const lowestCost = Math.min(...validCosts);
        const highestCost = Math.max(...validCosts);

        if (lowestCost === highestCost) {
            return 10; // All same price
        }

        // Normalize between 0 and 1
        const normalizedCost = (costPerUnit - lowestCost) / (highestCost - lowestCost);

        // Return score (lower cost = higher score)
        return Math.max(0, (1 - normalizedCost) * 10);
    }

    /**
     * Get quality bonus
     */
    static getQualityBonus(qualityStatus) {
        switch (qualityStatus) {
            case 'new': return 10;
            case 'tested': return 10;
            case 'used': return 5;
            case 'restricted': return 0;
            default: return 5;
        }
    }

    /**
     * Categorize score into category
     */
    static categorizeScore(score) {
        if (score >= 95) return 'exact_match';
        if (score >= 75) return 'close_fit';
        if (score >= 50) return 'acceptable';
        return 'last_resort';
    }

    /**
     * Get material suggestions based on requirements
     */
    static async getSuggestions(materialType, dimensions, requiredQty, maxSuggestions = 5) {
        try {
            const { width, height, thickness, diameter, shape_type } = dimensions;

            // Step 1: Find matching material types (including equivalents)
            let materialTypeIds = [];
            const materialTypeId = await MaterialType.findIdByNameOrAlias(materialType);
            
            if (materialTypeId) {
                materialTypeIds = await MaterialType.getAllEquivalentIds(materialTypeId);
            }

            // Step 2: Get available stock (pass materialType name as fallback)
            const candidates = await MaterialStock.findAvailable(
                materialTypeIds.length > 0 ? materialTypeIds : null,
                shape_type,
                { width, height, thickness, diameter },
                requiredQty,
                materialType // Pass material name as fallback search
            );

            if (candidates.length === 0) {
                return {
                    suggestions: [],
                    message: 'No matching stock available',
                    requested: { materialType, dimensions, requiredQty }
                };
            }

            // Step 3: Collect all costs for cost scoring
            const allCosts = candidates.map(c => c.cost_per_unit).filter(c => c > 0);

            // Step 4: Score each candidate
            const scoredCandidates = candidates.map((candidate, index) => {
                const candidateDims = {
                    width: parseFloat(candidate.width) || 0,
                    height: parseFloat(candidate.height) || 0,
                    thickness: parseFloat(candidate.thickness) || 0,
                    diameter: parseFloat(candidate.diameter) || 0,
                    length: parseFloat(candidate.length) || 0
                };

                const requiredDims = {
                    width: parseFloat(width) || 0,
                    height: parseFloat(height) || 0,
                    thickness: parseFloat(thickness) || 0,
                    diameter: parseFloat(diameter) || 0
                };

                const sizeScore = this.calculateSizeMatch(
                    candidate.shape_type || shape_type,
                    candidateDims,
                    requiredDims
                );

                // Skip if size is too small
                if (sizeScore === 0) return null;

                const availabilityScore = this.calculateAvailabilityScore(
                    parseFloat(candidate.current_stock) || 0,
                    parseFloat(candidate.reserved_stock) || 0,
                    requiredQty
                );

                const freshnessScore = this.calculateFreshnessScore(
                    candidate.last_used_date,
                    candidate.created_at
                );

                const costScore = this.calculateCostScore(
                    parseFloat(candidate.cost_per_unit) || 0,
                    allCosts
                );

                const qualityBonus = this.getQualityBonus(candidate.quality_status);

                // Calculate final score with weights
                const finalScore = (
                    sizeScore * 0.50 +
                    availabilityScore * 0.15 +
                    freshnessScore * 0.15 +
                    costScore * 0.10 +
                    qualityBonus * 0.10
                );

                const category = this.categorizeScore(finalScore);

                return {
                    stock_id: candidate.id,
                    material_name: candidate.material_name,
                    material_type: candidate.material_type_name || candidate.material_type,
                    specification_code: candidate.type_spec_code || candidate.specification_code,
                    shape_type: candidate.shape_type,
                    dimensions: {
                        width: candidate.width,
                        height: candidate.height,
                        thickness: candidate.thickness,
                        diameter: candidate.diameter,
                        length: candidate.length
                    },
                    available_qty: parseFloat(candidate.available_qty) || 0,
                    location: candidate.location_code,
                    cost_per_unit: candidate.cost_per_unit,
                    quality_status: candidate.quality_status,
                    scores: {
                        size: Math.round(sizeScore * 100) / 100,
                        availability: Math.round(availabilityScore * 100) / 100,
                        freshness: Math.round(freshnessScore * 100) / 100,
                        cost: Math.round(costScore * 100) / 100,
                        quality: Math.round(qualityBonus * 100) / 100,
                        total: Math.round(finalScore * 100) / 100
                    },
                    category,
                    match_reason: this.generateMatchReason(sizeScore, category)
                };
            }).filter(c => c !== null);

            // Step 5: Sort by score descending
            scoredCandidates.sort((a, b) => b.scores.total - a.scores.total);

            // Step 6: Assign ranks and limit
            const suggestions = scoredCandidates.slice(0, maxSuggestions).map((candidate, index) => ({
                ...candidate,
                rank: index + 1
            }));

            return {
                suggestions,
                total_candidates: scoredCandidates.length,
                requested: { materialType, dimensions, requiredQty }
            };
        } catch (error) {
            console.error('Error getting material suggestions:', error);
            throw error;
        }
    }

    /**
     * Generate human-readable match reason
     */
    static generateMatchReason(sizeScore, category) {
        if (sizeScore >= 98) return 'Exact size match';
        if (sizeScore >= 90) return 'Very close size match (minimal waste)';
        if (sizeScore >= 75) return 'Good size match (some waste expected)';
        if (sizeScore >= 50) return 'Acceptable size (moderate waste)';
        return 'Usable but significant oversizing';
    }

    /**
     * Save suggestion to database
     */
    static async saveSuggestion(data) {
        const {
            part_id, requested_material_type_id, requested_material_name,
            requested_width, requested_height, requested_thickness, requested_diameter,
            requested_quantity, suggested_stock_id, suggestion_rank,
            match_score, match_reason, category,
            size_score, availability_score, freshness_score, cost_score, quality_bonus
        } = data;

        const query = `
            INSERT INTO material_suggestions (
                part_id, requested_material_type_id, requested_material_name,
                requested_width, requested_height, requested_thickness, requested_diameter,
                requested_quantity, suggested_stock_id, suggestion_rank,
                match_score, match_reason, category,
                size_score, availability_score, freshness_score, cost_score, quality_bonus
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
            RETURNING *
        `;
        const values = [
            part_id || null, requested_material_type_id || null, requested_material_name || null,
            requested_width || null, requested_height || null, requested_thickness || null, requested_diameter || null,
            requested_quantity || null, suggested_stock_id, suggestion_rank,
            match_score, match_reason, category,
            size_score || null, availability_score || null, freshness_score || null, cost_score || null, quality_bonus || null
        ];
        const result = await db.query(query, values);
        return result.rows[0];
    }

    /**
     * Accept suggestion
     */
    static async acceptSuggestion(suggestionId, userId) {
        const query = `
            UPDATE material_suggestions
            SET is_accepted = true, accepted_at = CURRENT_TIMESTAMP, accepted_by = $2
            WHERE id = $1
            RETURNING *
        `;
        const result = await db.query(query, [suggestionId, userId]);
        return result.rows[0];
    }

    /**
     * Reject suggestion
     */
    static async rejectSuggestion(suggestionId, userId) {
        const query = `
            UPDATE material_suggestions
            SET is_rejected = true, rejected_at = CURRENT_TIMESTAMP, rejected_by = $2
            WHERE id = $1
            RETURNING *
        `;
        const result = await db.query(query, [suggestionId, userId]);
        return result.rows[0];
    }

    /**
     * Get suggestions for a part
     */
    static async getByPartId(partId) {
        const query = `
            SELECT ms.*, 
                   mst.material_name AS stock_material_name,
                   mst.shape_type AS stock_shape_type,
                   mst.width AS stock_width,
                   mst.height AS stock_height,
                   mst.thickness AS stock_thickness
            FROM material_suggestions ms
            LEFT JOIN material_stock mst ON ms.suggested_stock_id = mst.id
            WHERE ms.part_id = $1
            ORDER BY ms.suggestion_rank ASC
        `;
        const result = await db.query(query, [partId]);
        return result.rows;
    }
}

module.exports = MaterialSuggestions;
