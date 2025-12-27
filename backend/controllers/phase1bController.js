const pool = require('../config/database');

// ============================================================================
// BATCH SPLITTING
// ============================================================================

/**
 * Split a part into multiple batches
 * Example: Part 1 (100 qty) → Batch 1 (50 qty), Batch 2 (50 qty)
 */
exports.splitPartIntoBatches = async (req, res) => {
  try {
    const { partId } = req.params;
    const { batches } = req.body; // Array of { quantity, batch_number, notes }

    if (!Array.isArray(batches) || batches.length < 2) {
      return res.status(400).json({ 
        success: false, 
        message: 'Must provide at least 2 batches' 
      });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get original part
      const originalPart = await client.query(
        'SELECT * FROM parts WHERE id = $1',
        [partId]
      );

      if (originalPart.rows.length === 0) {
        throw new Error('Part not found');
      }

      const original = originalPart.rows[0];
      const totalQuantity = batches.reduce((sum, b) => sum + b.quantity, 0);

      if (totalQuantity !== original.quantity) {
        throw new Error(`Batch quantities (${totalQuantity}) must match original quantity (${original.quantity})`);
      }

      // Create batch parts
      const batchIds = [];
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        
        const result = await client.query(
          `INSERT INTO parts (
            order_id, part_name, part_number, description, quantity, 
            quantity_completed, quantity_scrapped, material_id, status,
            batch_number, quantity_in_batch, parent_part_id, is_batch_split,
            material_type, material_dimensions, material_status,
            drawing_revision, drawing_revision_date, revision_notes,
            stage, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9,
            $10, $11, $12, $13,
            $14, $15, $16,
            $17, $18, $19,
            $20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          ) RETURNING id`,
          [
            original.order_id, original.part_name, original.part_number, original.description, batch.quantity,
            0, 0, original.material_id, original.status,
            batch.batch_number || `Batch ${i + 1} of ${batches.length}`, batch.quantity, partId, true,
            original.material_type, original.material_dimensions, original.material_status,
            original.drawing_revision, original.drawing_revision_date, batch.notes || original.revision_notes,
            original.stage
          ]
        );

        batchIds.push(result.rows[0].id);
      }

      // Mark original as split
      await client.query(
        'UPDATE parts SET is_batch_split = true WHERE id = $1',
        [partId]
      );

      await client.query('COMMIT');

      res.status(201).json({
        success: true,
        message: 'Part split into batches successfully',
        originalPartId: partId,
        batchIds: batchIds,
        batches: batches.map((b, i) => ({
          batchId: batchIds[i],
          batchNumber: b.batch_number || `Batch ${i + 1}`,
          quantity: b.quantity
        }))
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error splitting part:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

/**
 * Merge batch parts back together
 */
exports.mergeBatches = async (req, res) => {
  try {
    const { parentPartId } = req.params;
    const { batchIds } = req.body; // Array of batch IDs to merge

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Verify all batches belong to parent
      const batches = await client.query(
        'SELECT SUM(quantity) as total FROM parts WHERE parent_part_id = $1 AND id = ANY($2)',
        [parentPartId, batchIds]
      );

      if (batches.rows[0].total === null) {
        throw new Error('No valid batches found');
      }

      // Delete batch parts
      await client.query(
        'DELETE FROM parts WHERE parent_part_id = $1 AND id = ANY($2)',
        [parentPartId, batchIds]
      );

      // Update parent to not split
      await client.query(
        'UPDATE parts SET is_batch_split = false WHERE id = $1',
        [parentPartId]
      );

      await client.query('COMMIT');

      res.json({
        success: true,
        message: 'Batches merged successfully',
        parentPartId: parentPartId,
        mergedQuantity: batches.rows[0].total
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error merging batches:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// ============================================================================
// DRAWING REVISION CONTROL
// ============================================================================

/**
 * Update drawing revision for a part
 */
exports.updateDrawingRevision = async (req, res) => {
  try {
    const { partId } = req.params;
    const { revision, notes } = req.body;

    if (!revision) {
      return res.status(400).json({ 
        success: false, 
        message: 'Revision is required' 
      });
    }

    const result = await pool.query(
      `UPDATE parts 
       SET drawing_revision = $1, 
           drawing_revision_date = CURRENT_TIMESTAMP,
           revision_notes = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING id, drawing_revision, drawing_revision_date, revision_notes`,
      [revision, notes || null, partId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Part not found' 
      });
    }

    res.json({
      success: true,
      message: `Drawing revision updated to ${revision}`,
      part: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating drawing revision:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

/**
 * Get revision history for a part
 */
exports.getRevisionHistory = async (req, res) => {
  try {
    const { partId } = req.params;

    const result = await pool.query(
      `SELECT 
        id, part_name, drawing_revision, drawing_revision_date, 
        revision_notes, stage, updated_at
       FROM parts 
       WHERE id = $1 OR parent_part_id = $1
       ORDER BY drawing_revision_date DESC`,
      [partId]
    );

    res.json({
      success: true,
      revisions: result.rows
    });
  } catch (error) {
    console.error('Error getting revision history:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// ============================================================================
// SETUP & RUNTIME TRACKING
// ============================================================================

/**
 * Set time estimates for a part (setup time + runtime per piece)
 */
exports.setTimeEstimates = async (req, res) => {
  try {
    const { partId } = req.params;
    const { setupTime, runTimePerPiece, setupInstructions } = req.body;

    if (!setupTime || !runTimePerPiece) {
      return res.status(400).json({ 
        success: false, 
        message: 'Setup time and runtime per piece are required' 
      });
    }

    // Get part to calculate total time
    const partRes = await pool.query(
      'SELECT quantity FROM parts WHERE id = $1',
      [partId]
    );

    if (partRes.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Part not found' 
      });
    }

    const quantity = partRes.rows[0].quantity;
    const estimatedTime = setupTime + (runTimePerPiece * quantity);

    const result = await pool.query(
      `UPDATE parts 
       SET estimated_setup_time = $1,
           estimated_run_time_per_piece = $2,
           estimated_time = $3,
           setup_instructions = $4,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING estimated_setup_time, estimated_run_time_per_piece, estimated_time, setup_instructions`,
      [setupTime, runTimePerPiece, estimatedTime, setupInstructions || null, partId]
    );

    res.json({
      success: true,
      message: 'Time estimates set successfully',
      estimates: {
        ...result.rows[0],
        totalQuantity: quantity,
        breakdown: {
          setupTime: setupTime,
          runtimePerPiece: runTimePerPiece,
          totalRuntime: runTimePerPiece * quantity,
          total: estimatedTime
        }
      }
    });
  } catch (error) {
    console.error('Error setting time estimates:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

/**
 * Record actual times when job completes
 */
exports.recordActualTimes = async (req, res) => {
  try {
    const { partId } = req.params;
    const { actualSetupTime, actualRunTime } = req.body;

    if (actualSetupTime === undefined || actualRunTime === undefined) {
      return res.status(400).json({ 
        success: false, 
        message: 'Both actual times are required' 
      });
    }

    const actualTotal = actualSetupTime + actualRunTime;

    const result = await pool.query(
      `UPDATE parts 
       SET actual_setup_time = $1,
           actual_run_time = $2,
           actual_time = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING estimated_time, actual_time, estimated_setup_time, actual_setup_time, 
                 estimated_run_time_per_piece, actual_run_time`,
      [actualSetupTime, actualRunTime, actualTotal, partId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Part not found' 
      });
    }

    const times = result.rows[0];
    const efficiency = times.estimated_time > 0 
      ? Math.round((times.estimated_time / times.actual_time) * 100)
      : null;

    res.json({
      success: true,
      message: 'Actual times recorded',
      times: {
        estimated: {
          setup: times.estimated_setup_time,
          perPiece: times.estimated_run_time_per_piece,
          total: times.estimated_time
        },
        actual: {
          setup: actualSetupTime,
          runtime: actualRunTime,
          total: actualTotal
        },
        efficiency: efficiency ? `${efficiency}%` : null
      }
    });
  } catch (error) {
    console.error('Error recording actual times:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

/**
 * Get time analysis for a part (estimated vs actual)
 */
exports.getTimeAnalysis = async (req, res) => {
  try {
    const { partId } = req.params;

    const result = await pool.query(
      `SELECT 
        id, part_name, quantity,
        estimated_setup_time, actual_setup_time,
        estimated_run_time_per_piece, actual_run_time,
        estimated_time, actual_time,
        created_at, updated_at
       FROM parts 
       WHERE id = $1`,
      [partId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Part not found' 
      });
    }

    const part = result.rows[0];

    res.json({
      success: true,
      analysis: {
        part: {
          id: part.id,
          name: part.part_name,
          quantity: part.quantity
        },
        setup: {
          estimated: part.estimated_setup_time,
          actual: part.actual_setup_time,
          variance: part.actual_setup_time 
            ? part.actual_setup_time - part.estimated_setup_time 
            : null
        },
        runtime: {
          estimatedPerPiece: part.estimated_run_time_per_piece,
          estimatedTotal: part.estimated_run_time_per_piece * part.quantity,
          actualTotal: part.actual_run_time,
          variance: part.actual_run_time 
            ? part.actual_run_time - (part.estimated_run_time_per_piece * part.quantity)
            : null
        },
        total: {
          estimated: part.estimated_time,
          actual: part.actual_time,
          efficiency: part.actual_time 
            ? `${Math.round((part.estimated_time / part.actual_time) * 100)}%`
            : null
        }
      }
    });
  } catch (error) {
    console.error('Error analyzing times:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// ============================================================================
// PRIORITY CALCULATION
// ============================================================================

/**
 * Calculate priority score for a part
 * Factors: Days until due, material ready, setup time, quantity
 */
function calculatePriorityScore(part, orderDueDate) {
  let score = 0;
  const factors = {};

  // Days until due (0-400 points)
  if (orderDueDate) {
    const today = new Date();
    const dueDate = new Date(orderDueDate);
    const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

    factors.daysUntilDue = daysUntilDue;

    if (daysUntilDue <= 0) score += 400; // URGENT
    else if (daysUntilDue <= 3) score += 350;
    else if (daysUntilDue <= 7) score += 300;
    else if (daysUntilDue <= 14) score += 200;
    else if (daysUntilDue <= 30) score += 100;
    else score += 50;

    factors.dueDateScore = score;
  }

  // Material ready (0-200 points)
  if (part.material_status === 'ready_for_cutting') {
    score += 200;
    factors.materialReadyScore = 200;
  } else if (part.material_status === 'in_stock') {
    score += 150;
    factors.materialReadyScore = 150;
  } else if (part.material_status === 'arrived') {
    score += 100;
    factors.materialReadyScore = 100;
  }

  // Stage progression (0-150 points)
  const stageScores = {
    'material_planning': 0,
    'cutting': 50,
    'programming': 100,
    'assigned': 125,
    'in_progress': 150
  };
  score += stageScores[part.stage] || 0;
  factors.stageScore = stageScores[part.stage] || 0;

  // Setup time (0-100 points) - shorter setup = higher priority (can start sooner)
  if (part.estimated_setup_time) {
    if (part.estimated_setup_time <= 15) score += 100;
    else if (part.estimated_setup_time <= 30) score += 75;
    else if (part.estimated_setup_time <= 60) score += 50;
    else score += 25;
    factors.setupTimeScore = Math.min(100, 100 - (part.estimated_setup_time / 2));
  }

  // Priority override
  if (part.priority) {
    const priorityBonus = {
      'urgent': 150,
      'high': 100,
      'normal': 0,
      'low': -50
    };
    score += priorityBonus[part.priority] || 0;
    factors.priorityBonus = priorityBonus[part.priority] || 0;
  }

  // Cap score at 1000
  score = Math.min(1000, Math.max(0, score));

  return { score, factors };
}

/**
 * Calculate and save priority for a part
 */
exports.calculatePriority = async (req, res) => {
  try {
    const { partId } = req.params;

    // Get part with order info
    const result = await pool.query(
      `SELECT p.*, o.due_date, o.priority as order_priority
       FROM parts p
       JOIN orders o ON p.order_id = o.id
       WHERE p.id = $1`,
      [partId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Part not found' 
      });
    }

    const part = result.rows[0];
    const { score, factors } = calculatePriorityScore(part, part.due_date);

    // Save priority
    await pool.query(
      `UPDATE parts 
       SET priority_score = $1,
           priority_factors = $2::jsonb,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [score, JSON.stringify(factors), partId]
    );

    res.json({
      success: true,
      message: 'Priority calculated and saved',
      priority: {
        score: score,
        factors: factors
      }
    });
  } catch (error) {
    console.error('Error calculating priority:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

/**
 * Get priority queue (highest priority parts first)
 */
exports.getPriorityQueue = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        p.id, p.part_name, p.quantity, p.order_id, 
        p.priority_score, p.priority_factors,
        p.stage, p.material_status, p.estimated_time,
        o.customer_name, o.due_date
       FROM parts p
       JOIN orders o ON p.order_id = o.id
       WHERE p.stage != 'completed' AND p.is_on_hold = false
       ORDER BY p.priority_score DESC, o.due_date ASC
       LIMIT 50`,
      []
    );

    res.json({
      success: true,
      queue: result.rows
    });
  } catch (error) {
    console.error('Error getting priority queue:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

module.exports = exports;
