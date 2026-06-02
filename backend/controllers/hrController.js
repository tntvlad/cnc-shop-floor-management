const db = require('../config/database');

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Count working days (Mon–Fri) between two dates inclusive,
 * excluding public holidays.
 */
async function countWorkingDays(dateFrom, dateTo) {
    const start = new Date(dateFrom);
    const end   = new Date(dateTo);
    const holidays = await db.query(
        `SELECT holiday_date FROM public_holidays
         WHERE holiday_date BETWEEN $1 AND $2`,
        [dateFrom, dateTo]
    );
    const holidaySet = new Set(holidays.rows.map(r => r.holiday_date.toISOString().split('T')[0]));

    let count = 0;
    const cur = new Date(start);
    while (cur <= end) {
        const dow = cur.getDay();
        const iso = cur.toISOString().split('T')[0];
        if (dow !== 0 && dow !== 6 && !holidaySet.has(iso)) count++;
        cur.setDate(cur.getDate() + 1);
    }
    return count;
}

/**
 * Ensure employee_leave_balance row exists for user+year.
 * Creates with default 20 days if missing.
 */
async function ensureBalance(userId, year) {
    await db.query(
        `INSERT INTO employee_leave_balance (user_id, year, total_days, used_days, carried_over)
         VALUES ($1, $2, 20, 0, 0)
         ON CONFLICT (user_id, year) DO NOTHING`,
        [userId, year]
    );
}

// ── Leave Types ────────────────────────────────────────────────────────────

// GET /api/hr/leave-types
const getLeaveTypes = async (req, res) => {
    try {
        const result = await db.query(`SELECT * FROM leave_types ORDER BY id`);
        res.json({ success: true, leaveTypes: result.rows });
    } catch (e) {
        console.error('getLeaveTypes', e);
        res.status(500).json({ success: false, error: e.message });
    }
};

// ── Public Holidays ────────────────────────────────────────────────────────

// GET /api/hr/public-holidays?year=2026
const getPublicHolidays = async (req, res) => {
    try {
        const year = parseInt(req.query.year) || new Date().getFullYear();
        const result = await db.query(
            `SELECT * FROM public_holidays WHERE year = $1 ORDER BY holiday_date`,
            [year]
        );
        res.json({ success: true, holidays: result.rows });
    } catch (e) {
        console.error('getPublicHolidays', e);
        res.status(500).json({ success: false, error: e.message });
    }
};

// POST /api/hr/public-holidays  (admin only)
const createPublicHoliday = async (req, res) => {
    try {
        if (req.user.level < 500) return res.status(403).json({ success: false, error: 'Admin required' });
        const { holiday_date, name } = req.body;
        if (!holiday_date || !name) return res.status(400).json({ success: false, error: 'holiday_date and name required' });
        const year = new Date(holiday_date).getFullYear();
        const result = await db.query(
            `INSERT INTO public_holidays (year, holiday_date, name) VALUES ($1, $2, $3) RETURNING *`,
            [year, holiday_date, name]
        );
        res.status(201).json({ success: true, holiday: result.rows[0] });
    } catch (e) {
        console.error('createPublicHoliday', e);
        res.status(500).json({ success: false, error: e.message });
    }
};

// PUT /api/hr/public-holidays/:id  (admin only)
const updatePublicHoliday = async (req, res) => {
    try {
        if (req.user.level < 500) return res.status(403).json({ success: false, error: 'Admin required' });
        const { holiday_date, name } = req.body;
        if (!holiday_date && !name) return res.status(400).json({ success: false, error: 'holiday_date or name required' });
        const fields = [];
        const params = [];
        if (holiday_date) {
            params.push(holiday_date);
            fields.push(`holiday_date = $${params.length}`);
            params.push(new Date(holiday_date).getFullYear());
            fields.push(`year = $${params.length}`);
        }
        if (name) {
            params.push(name);
            fields.push(`name = $${params.length}`);
        }
        params.push(req.params.id);
        const result = await db.query(
            `UPDATE public_holidays SET ${fields.join(', ')} WHERE id = $${params.length} RETURNING *`,
            params
        );
        if (!result.rows.length) return res.status(404).json({ success: false, error: 'Not found' });
        res.json({ success: true, holiday: result.rows[0] });
    } catch (e) {
        console.error('updatePublicHoliday', e);
        res.status(500).json({ success: false, error: e.message });
    }
};

// DELETE /api/hr/public-holidays/:id  (admin only)
const deletePublicHoliday = async (req, res) => {
    try {
        if (req.user.level < 500) return res.status(403).json({ success: false, error: 'Admin required' });
        await db.query(`DELETE FROM public_holidays WHERE id = $1`, [req.params.id]);
        res.json({ success: true });
    } catch (e) {
        console.error('deletePublicHoliday', e);
        res.status(500).json({ success: false, error: e.message });
    }
};

// ── Leave Balances ─────────────────────────────────────────────────────────

// GET /api/hr/balances?year=2026  (supervisor+)
const getBalances = async (req, res) => {
    try {
        if (req.user.level < 400) return res.status(403).json({ success: false, error: 'Supervisor required' });
        const year = parseInt(req.query.year) || new Date().getFullYear();

        // Auto-init balances for all active employees
        const users = await db.query(`SELECT id FROM users WHERE is_active = true`);
        for (const u of users.rows) await ensureBalance(u.id, year);

        const result = await db.query(
            `SELECT b.*, u.name AS employee_name, u.employee_id, u.level
             FROM employee_leave_balance b
             JOIN users u ON b.user_id = u.id
             WHERE b.year = $1 AND u.is_active = true
             ORDER BY u.name`,
            [year]
        );
        res.json({ success: true, balances: result.rows });
    } catch (e) {
        console.error('getBalances', e);
        res.status(500).json({ success: false, error: e.message });
    }
};

// GET /api/hr/balances/me
const getMyBalance = async (req, res) => {
    try {
        const year = new Date().getFullYear();
        await ensureBalance(req.user.id, year);
        const result = await db.query(
            `SELECT b.*, lt_annual.total_days AS default_annual
             FROM employee_leave_balance b
             LEFT JOIN leave_types lt_annual ON lt_annual.code = 'annual'
             WHERE b.user_id = $1 AND b.year = $2`,
            [req.user.id, year]
        );
        res.json({ success: true, balance: result.rows[0] });
    } catch (e) {
        console.error('getMyBalance', e);
        res.status(500).json({ success: false, error: e.message });
    }
};

// PUT /api/hr/balances/:userId  (supervisor+)
const updateBalance = async (req, res) => {
    try {
        if (req.user.level < 400) return res.status(403).json({ success: false, error: 'Supervisor required' });
        const year = parseInt(req.body.year) || new Date().getFullYear();
        await ensureBalance(req.params.userId, year);
        const { total_days, carried_over } = req.body;
        const result = await db.query(
            `UPDATE employee_leave_balance
             SET total_days = COALESCE($1, total_days),
                 carried_over = COALESCE($2, carried_over)
             WHERE user_id = $3 AND year = $4
             RETURNING *`,
            [total_days ?? null, carried_over ?? null, req.params.userId, year]
        );
        res.json({ success: true, balance: result.rows[0] });
    } catch (e) {
        console.error('updateBalance', e);
        res.status(500).json({ success: false, error: e.message });
    }
};

// ── Leave Requests ─────────────────────────────────────────────────────────

// GET /api/hr/leaves?year=&user_id=&status=  (supervisor+)
const getLeaves = async (req, res) => {
    try {
        if (req.user.level < 400) return res.status(403).json({ success: false, error: 'Supervisor required' });
        const conditions = [];
        const params = [];

        if (req.query.year) {
            params.push(req.query.year);
            conditions.push(`EXTRACT(YEAR FROM lr.date_from) = $${params.length}`);
        }
        if (req.query.user_id) {
            params.push(parseInt(req.query.user_id));
            conditions.push(`lr.user_id = $${params.length}`);
        }
        if (req.query.status) {
            params.push(req.query.status);
            conditions.push(`lr.status = $${params.length}`);
        }

        const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
        const result = await db.query(
            `SELECT lr.*, lt.name AS leave_type_name, lt.color,
                    u.name AS employee_name, u.employee_id,
                    r.name AS reviewed_by_name
             FROM leave_requests lr
             JOIN leave_types lt ON lr.leave_type_id = lt.id
             JOIN users u ON lr.user_id = u.id
             LEFT JOIN users r ON lr.reviewed_by = r.id
             ${where}
             ORDER BY lr.created_at DESC`,
            params
        );
        res.json({ success: true, leaves: result.rows });
    } catch (e) {
        console.error('getLeaves', e);
        res.status(500).json({ success: false, error: e.message });
    }
};

// GET /api/hr/leaves/me
const getMyLeaves = async (req, res) => {
    try {
        const year = req.query.year || new Date().getFullYear();
        const result = await db.query(
            `SELECT lr.*, lt.name AS leave_type_name, lt.color,
                    r.name AS reviewed_by_name
             FROM leave_requests lr
             JOIN leave_types lt ON lr.leave_type_id = lt.id
             LEFT JOIN users r ON lr.reviewed_by = r.id
             WHERE lr.user_id = $1 AND EXTRACT(YEAR FROM lr.date_from) = $2
             ORDER BY lr.date_from DESC`,
            [req.user.id, year]
        );
        res.json({ success: true, leaves: result.rows });
    } catch (e) {
        console.error('getMyLeaves', e);
        res.status(500).json({ success: false, error: e.message });
    }
};

// POST /api/hr/leaves
const createLeave = async (req, res) => {
    try {
        const { leave_type_id, date_from, date_to, notes } = req.body;
        if (!leave_type_id || !date_from || !date_to) {
            return res.status(400).json({ success: false, error: 'leave_type_id, date_from, date_to required' });
        }

        // Check overlap
        const overlap = await db.query(
            `SELECT id FROM leave_requests
             WHERE user_id = $1 AND status = 'approved'
               AND date_from <= $3 AND date_to >= $2`,
            [req.user.id, date_from, date_to]
        );
        if (overlap.rows.length > 0) {
            return res.status(400).json({ success: false, error: 'Overlap with existing approved leave' });
        }

        const days_count = await countWorkingDays(date_from, date_to);

        // Get leave type
        const ltRes = await db.query(`SELECT * FROM leave_types WHERE id = $1`, [leave_type_id]);
        if (!ltRes.rows.length) return res.status(400).json({ success: false, error: 'Invalid leave type' });
        const lt = ltRes.rows[0];

        // Sick leave auto-approves
        const status = (!lt.requires_approval) ? 'approved' : 'pending';
        const reviewed_by = (!lt.requires_approval) ? req.user.id : null;
        const reviewed_at = (!lt.requires_approval) ? new Date() : null;

        const result = await db.query(
            `INSERT INTO leave_requests
                (user_id, leave_type_id, date_from, date_to, days_count, status, notes, reviewed_by, reviewed_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
             RETURNING *`,
            [req.user.id, leave_type_id, date_from, date_to, days_count, status, notes || null, reviewed_by, reviewed_at]
        );

        // Deduct balance immediately if auto-approved and deducts_balance
        if (status === 'approved' && lt.deducts_balance) {
            const year = new Date(date_from).getFullYear();
            await ensureBalance(req.user.id, year);
            await db.query(
                `UPDATE employee_leave_balance
                 SET used_days = used_days + $1
                 WHERE user_id = $2 AND year = $3`,
                [days_count, req.user.id, year]
            );
        }

        res.status(201).json({ success: true, leave: result.rows[0] });
    } catch (e) {
        console.error('createLeave', e);
        res.status(500).json({ success: false, error: e.message });
    }
};

// PUT /api/hr/leaves/:id/approve  (supervisor+)
const approveLeave = async (req, res) => {
    try {
        if (req.user.level < 400) return res.status(403).json({ success: false, error: 'Supervisor required' });
        const leaveRes = await db.query(
            `SELECT lr.*, lt.deducts_balance FROM leave_requests lr
             JOIN leave_types lt ON lr.leave_type_id = lt.id
             WHERE lr.id = $1`,
            [req.params.id]
        );
        if (!leaveRes.rows.length) return res.status(404).json({ success: false, error: 'Leave not found' });
        const leave = leaveRes.rows[0];
        if (leave.status !== 'pending') return res.status(400).json({ success: false, error: 'Leave is not pending' });

        await db.query(
            `UPDATE leave_requests SET status='approved', reviewed_by=$1, reviewed_at=NOW(), review_notes=$2
             WHERE id=$3`,
            [req.user.id, req.body.review_notes || null, req.params.id]
        );

        if (leave.deducts_balance) {
            const year = new Date(leave.date_from).getFullYear();
            await ensureBalance(leave.user_id, year);
            await db.query(
                `UPDATE employee_leave_balance SET used_days = used_days + $1
                 WHERE user_id = $2 AND year = $3`,
                [leave.days_count, leave.user_id, year]
            );
        }

        res.json({ success: true, message: 'Leave approved' });
    } catch (e) {
        console.error('approveLeave', e);
        res.status(500).json({ success: false, error: e.message });
    }
};

// PUT /api/hr/leaves/:id/reject  (supervisor+)
const rejectLeave = async (req, res) => {
    try {
        if (req.user.level < 400) return res.status(403).json({ success: false, error: 'Supervisor required' });
        const leaveRes = await db.query(
            `SELECT lr.*, lt.deducts_balance FROM leave_requests lr
             JOIN leave_types lt ON lr.leave_type_id = lt.id
             WHERE lr.id = $1`,
            [req.params.id]
        );
        if (!leaveRes.rows.length) return res.status(404).json({ success: false, error: 'Leave not found' });
        const leave = leaveRes.rows[0];
        if (leave.status !== 'pending') return res.status(400).json({ success: false, error: 'Leave is not pending' });

        await db.query(
            `UPDATE leave_requests SET status='rejected', reviewed_by=$1, reviewed_at=NOW(), review_notes=$2
             WHERE id=$3`,
            [req.user.id, req.body.review_notes || null, req.params.id]
        );

        res.json({ success: true, message: 'Leave rejected' });
    } catch (e) {
        console.error('rejectLeave', e);
        res.status(500).json({ success: false, error: e.message });
    }
};

// DELETE /api/hr/leaves/:id  (own pending only, or supervisor cancels any)
const cancelLeave = async (req, res) => {
    try {
        const leaveRes = await db.query(
            `SELECT lr.*, lt.deducts_balance FROM leave_requests lr
             JOIN leave_types lt ON lr.leave_type_id = lt.id
             WHERE lr.id = $1`,
            [req.params.id]
        );
        if (!leaveRes.rows.length) return res.status(404).json({ success: false, error: 'Leave not found' });
        const leave = leaveRes.rows[0];

        if (leave.user_id !== req.user.id && req.user.level < 400) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }
        if (leave.status === 'cancelled') {
            return res.status(400).json({ success: false, error: 'Already cancelled' });
        }

        const wasApproved = leave.status === 'approved';
        await db.query(`UPDATE leave_requests SET status='cancelled' WHERE id=$1`, [req.params.id]);

        // Return balance if was approved and deducts_balance
        if (wasApproved && leave.deducts_balance) {
            const year = new Date(leave.date_from).getFullYear();
            await db.query(
                `UPDATE employee_leave_balance SET used_days = GREATEST(0, used_days - $1)
                 WHERE user_id = $2 AND year = $3`,
                [leave.days_count, leave.user_id, year]
            );
        }

        res.json({ success: true, message: 'Leave cancelled' });
    } catch (e) {
        console.error('cancelLeave', e);
        res.status(500).json({ success: false, error: e.message });
    }
};

// ── Work Hours ─────────────────────────────────────────────────────────────

// GET /api/hr/hours?user_id=&month=YYYY-MM  (supervisor+)
const getHours = async (req, res) => {
    try {
        if (req.user.level < 400) return res.status(403).json({ success: false, error: 'Supervisor required' });
        const conditions = [];
        const params = [];

        if (req.query.user_id) {
            params.push(parseInt(req.query.user_id));
            conditions.push(`wh.user_id = $${params.length}`);
        }
        if (req.query.month) {
            params.push(req.query.month + '-01');
            params.push(req.query.month + '-31');
            conditions.push(`wh.work_date BETWEEN $${params.length - 1} AND $${params.length}`);
        }

        const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
        const result = await db.query(
            `SELECT wh.*, u.name AS employee_name, e.name AS entered_by_name
             FROM work_hours wh
             JOIN users u ON wh.user_id = u.id
             LEFT JOIN users e ON wh.entered_by = e.id
             ${where}
             ORDER BY wh.work_date DESC`,
            params
        );
        res.json({ success: true, hours: result.rows });
    } catch (e) {
        console.error('getHours', e);
        res.status(500).json({ success: false, error: e.message });
    }
};

// GET /api/hr/hours/me?month=YYYY-MM
const getMyHours = async (req, res) => {
    try {
        const conditions = [`wh.user_id = $1`];
        const params = [req.user.id];

        if (req.query.month) {
            params.push(req.query.month + '-01');
            params.push(req.query.month + '-31');
            conditions.push(`wh.work_date BETWEEN $${params.length - 1} AND $${params.length}`);
        }

        const result = await db.query(
            `SELECT wh.*, e.name AS entered_by_name
             FROM work_hours wh
             LEFT JOIN users e ON wh.entered_by = e.id
             WHERE ${conditions.join(' AND ')}
             ORDER BY wh.work_date DESC`,
            params
        );
        res.json({ success: true, hours: result.rows });
    } catch (e) {
        console.error('getMyHours', e);
        res.status(500).json({ success: false, error: e.message });
    }
};

// POST /api/hr/hours
const logHours = async (req, res) => {
    try {
        const { work_date, hours_worked, overtime_hours, check_in, check_out, notes, user_id } = req.body;
        if (!work_date || hours_worked === undefined) {
            return res.status(400).json({ success: false, error: 'work_date and hours_worked required' });
        }

        // Supervisors can log for others; operators only for themselves
        const targetUserId = (req.user.level >= 400 && user_id) ? parseInt(user_id) : req.user.id;

        const result = await db.query(
            `INSERT INTO work_hours
                (user_id, work_date, hours_worked, overtime_hours, check_in, check_out, notes, entered_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
             ON CONFLICT (user_id, work_date) DO UPDATE SET
                hours_worked   = EXCLUDED.hours_worked,
                overtime_hours = EXCLUDED.overtime_hours,
                check_in       = EXCLUDED.check_in,
                check_out      = EXCLUDED.check_out,
                notes          = EXCLUDED.notes,
                entered_by     = EXCLUDED.entered_by
             RETURNING *`,
            [targetUserId, work_date, hours_worked, overtime_hours || 0,
             check_in || null, check_out || null, notes || null, req.user.id]
        );
        res.json({ success: true, record: result.rows[0] });
    } catch (e) {
        console.error('logHours', e);
        res.status(500).json({ success: false, error: e.message });
    }
};

// PUT /api/hr/hours/:id
const updateHours = async (req, res) => {
    try {
        const rec = await db.query(`SELECT * FROM work_hours WHERE id = $1`, [req.params.id]);
        if (!rec.rows.length) return res.status(404).json({ success: false, error: 'Record not found' });
        if (rec.rows[0].user_id !== req.user.id && req.user.level < 400) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }

        const { hours_worked, overtime_hours, check_in, check_out, notes } = req.body;
        const result = await db.query(
            `UPDATE work_hours SET
                hours_worked   = COALESCE($1, hours_worked),
                overtime_hours = COALESCE($2, overtime_hours),
                check_in       = $3,
                check_out      = $4,
                notes          = COALESCE($5, notes),
                entered_by     = $6
             WHERE id = $7
             RETURNING *`,
            [hours_worked ?? null, overtime_hours ?? null,
             check_in || null, check_out || null,
             notes ?? null, req.user.id, req.params.id]
        );
        res.json({ success: true, record: result.rows[0] });
    } catch (e) {
        console.error('updateHours', e);
        res.status(500).json({ success: false, error: e.message });
    }
};

// DELETE /api/hr/hours/:id  (supervisor+)
const deleteHours = async (req, res) => {
    try {
        if (req.user.level < 400) return res.status(403).json({ success: false, error: 'Supervisor required' });
        await db.query(`DELETE FROM work_hours WHERE id = $1`, [req.params.id]);
        res.json({ success: true });
    } catch (e) {
        console.error('deleteHours', e);
        res.status(500).json({ success: false, error: e.message });
    }
};

// ── Summary ────────────────────────────────────────────────────────────────

// GET /api/hr/summary?month=YYYY-MM  (supervisor+)
const getSummary = async (req, res) => {
    try {
        if (req.user.level < 400) return res.status(403).json({ success: false, error: 'Supervisor required' });
        const month = req.query.month || new Date().toISOString().slice(0, 7);
        const [year, mon] = month.split('-').map(Number);

        const hoursRes = await db.query(
            `SELECT u.id, u.name, u.employee_id, u.level,
                    COALESCE(SUM(wh.hours_worked), 0)   AS total_hours,
                    COALESCE(SUM(wh.overtime_hours), 0) AS total_overtime,
                    COUNT(wh.id) AS days_logged
             FROM users u
             LEFT JOIN work_hours wh
                ON wh.user_id = u.id
                AND EXTRACT(YEAR FROM wh.work_date) = $1
                AND EXTRACT(MONTH FROM wh.work_date) = $2
             WHERE u.is_active = true AND u.level >= 100
             GROUP BY u.id, u.name, u.employee_id, u.level
             ORDER BY u.name`,
            [year, mon]
        );

        const leaveRes = await db.query(
            `SELECT lr.user_id,
                    lt.code AS leave_code,
                    COALESCE(SUM(lr.days_count), 0) AS days
             FROM leave_requests lr
             JOIN leave_types lt ON lr.leave_type_id = lt.id
             WHERE lr.status = 'approved'
               AND EXTRACT(YEAR FROM lr.date_from) = $1
               AND EXTRACT(MONTH FROM lr.date_from) = $2
             GROUP BY lr.user_id, lt.code`,
            [year, mon]
        );

        const leaveMap = {};
        for (const row of leaveRes.rows) {
            if (!leaveMap[row.user_id]) leaveMap[row.user_id] = {};
            leaveMap[row.user_id][row.leave_code] = parseFloat(row.days);
        }

        const summary = hoursRes.rows.map(u => ({
            ...u,
            leave: leaveMap[u.id] || {},
            total_hours: parseFloat(u.total_hours),
            total_overtime: parseFloat(u.total_overtime),
            days_logged: parseInt(u.days_logged),
        }));

        res.json({ success: true, summary, month });
    } catch (e) {
        console.error('getSummary', e);
        res.status(500).json({ success: false, error: e.message });
    }
};

module.exports = {
    getLeaveTypes,
    getPublicHolidays, createPublicHoliday, updatePublicHoliday, deletePublicHoliday,
    getBalances, getMyBalance, updateBalance,
    getLeaves, getMyLeaves, createLeave, approveLeave, rejectLeave, cancelLeave,
    getHours, getMyHours, logHours, updateHours, deleteHours,
    getSummary,
};
