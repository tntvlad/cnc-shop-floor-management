const db = require('../config/database');

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Count working days (Monâ€“Fri) between two dates inclusive,
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

// â”€â”€ Leave Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€ Public Holidays â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€ Leave Balances â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// GET /api/hr/balances?year=2026  (supervisor+)
const getBalances = async (req, res) => {
    try {
        if (req.user.level < 400) return res.status(403).json({ success: false, error: 'Supervisor required' });
        const year = parseInt(req.query.year) || new Date().getFullYear();

        // Auto-init balances for all active employees
        const users = await db.query(`SELECT id FROM users WHERE is_active = true`);
        for (const u of users.rows) await ensureBalance(u.id, year);

        const result = await db.query(
            `SELECT b.*, u.name AS employee_name, u.employee_id, u.level, u.include_in_attendance,
                    u.schedule_checkin, u.schedule_checkout, u.lunch_break_minutes
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
            `SELECT b.*
             FROM employee_leave_balance b
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

// â”€â”€ Leave Requests â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
        const { leave_type_id, date_from, date_to, notes, user_id } = req.body;
        if (!leave_type_id || !date_from || !date_to) {
            return res.status(400).json({ success: false, error: 'leave_type_id, date_from, date_to required' });
        }

        // Supervisors can submit leave on behalf of another user
        const targetUserId = (req.user.level >= 400 && user_id) ? parseInt(user_id) : req.user.id;

        // Check overlap
        const overlap = await db.query(
            `SELECT id FROM leave_requests
             WHERE user_id = $1 AND status = 'approved'
               AND date_from <= $3 AND date_to >= $2`,
            [targetUserId, date_from, date_to]
        );
        if (overlap.rows.length > 0) {
            return res.status(400).json({ success: false, error: 'Overlap with existing approved leave' });
        }

        const days_count = await countWorkingDays(date_from, date_to);

        // Get leave type
        const ltRes = await db.query(`SELECT * FROM leave_types WHERE id = $1`, [leave_type_id]);
        if (!ltRes.rows.length) return res.status(400).json({ success: false, error: 'Invalid leave type' });
        const lt = ltRes.rows[0];

        // Supervisor-submitted leaves auto-approve; otherwise follow leave type rules
        const autoApprove = req.user.level >= 400 || !lt.requires_approval;
        const status = autoApprove ? 'approved' : 'pending';
        const reviewed_by = autoApprove ? req.user.id : null;
        const reviewed_at = autoApprove ? new Date() : null;

        const result = await db.query(
            `INSERT INTO leave_requests
                (user_id, leave_type_id, date_from, date_to, days_count, status, notes, reviewed_by, reviewed_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
             RETURNING *`,
            [targetUserId, leave_type_id, date_from, date_to, days_count, status, notes || null, reviewed_by, reviewed_at]
        );

        // Deduct balance immediately if auto-approved and deducts_balance
        if (status === 'approved' && lt.deducts_balance) {
            const year = new Date(date_from).getFullYear();
            await ensureBalance(targetUserId, year);
            await db.query(
                `UPDATE employee_leave_balance
                 SET used_days = used_days + $1
                 WHERE user_id = $2 AND year = $3`,
                [days_count, targetUserId, year]
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

// â”€â”€ Work Hours â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
            conditions.push(`wh.work_date >= $${params.length}::date AND wh.work_date < $${params.length}::date + INTERVAL '1 month'`);
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
            conditions.push(`wh.work_date >= $${params.length}::date AND wh.work_date < $${params.length}::date + INTERVAL '1 month'`);
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

// â”€â”€ Summary â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€ Export: EVIDENTA ORELOR DE MUNCA (ExcelJS â€“ full formatting) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const LEAVE_CODE_MAP = {
    annual:   'Co',
    sick:     'Bo',
    unpaid:   'Cfp',
    personal: 'Ef',
    holiday:  'S',
    training: 'ST',
};

// Legend colour pairs: [code, bg, description, right-col code, right-bg, right-desc]
const LEGEND = [
    ['Co', 'FF00B0F0', 'conc.odihna',          'OI',  'FFFFFFFF', 'ore intrerupere'],
    ['Bo', 'FF92D050', 'conc.boala',            'Cfp', 'FFFFFFFF', 'Concediu fara plata'],
    ['Am', 'FFFFC000', 'accid.munca',           'W',   'FFFFFFFF', 'weekend'],
    ['M',  'FFFFC000', 'maternitate',           'N',   'FFFF0000', 'abs.nemotivate'],
    ['S',  'FFFFFF00', 'sarbatori, zile libere','Ef',  'FF00B050', 'evenim.fam.'],
    ['ST', 'FFFFFFFF', 'somaj tehnic',          'Zlp', 'FFFFFFFF', 'zile libere platite'],
];

// Day-cell fill colours
const FILL_WEEKEND  = 'FFFFFFCC'; // light yellow (matches original XLS)
const FILL_HOLIDAY  = 'FFFFFF00'; // yellow
const FILL_CO       = 'FFD4EA6B'; // green (matches original XLS legend)
const FILL_BO       = 'FFB4C7DC'; // blue  (matches original XLS legend)
const FILL_EF       = 'FF00B050';
const FILL_S        = 'FFFFFF00';
const FILL_ST       = 'FFD9D9D9';
const FILL_CFP      = 'FFD9D9D9';
const FILL_WORK     = 'FFFFFFFF';

const LEAVE_FILL = { Co: FILL_CO, Bo: FILL_BO, Ef: FILL_EF, S: FILL_S, ST: FILL_ST, Cfp: FILL_CFP };

const exportAttendance = async (req, res) => {
    try {
        if (req.user.level < 400) return res.status(403).json({ success: false, error: 'Supervisor required' });

        const ExcelJS = require('exceljs');

        const monthStr = req.query.month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
        const [year, month] = monthStr.split('-').map(Number);
        const daysInMonth = new Date(year, month, 0).getDate();

        const RO_MONTHS = ['IANUARIE','FEBRUARIE','MARTIE','APRILIE','MAI','IUNIE',
                           'IULIE','AUGUST','SEPTEMBRIE','OCTOMBRIE','NOIEMBRIE','DECEMBRIE'];
        const monthName = RO_MONTHS[month - 1];
        const RO_DOW    = ['Du','Lu','Ma','Mi','Jo','Vi','Sâ'];

        // â”€â”€ DB queries â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        const empRes = await db.query(`SELECT id, name FROM users WHERE level >= 100 AND is_active = true AND include_in_attendance = true ORDER BY name`);
        const employees = empRes.rows;

        const hoursRes = await db.query(
            `SELECT user_id, TO_CHAR(work_date,'YYYY-MM-DD') AS work_date, check_in, check_out, hours_worked, overtime_hours
             FROM work_hours
             WHERE work_date >= $1::date AND work_date < $1::date + INTERVAL '1 month'`,
            [`${year}-${String(month).padStart(2,'0')}-01`]
        );
        const hoursMap = {};
        hoursRes.rows.forEach(r => {
            const day = parseInt(r.work_date.substring(8, 10), 10);
            if (!hoursMap[r.user_id]) hoursMap[r.user_id] = {};
            hoursMap[r.user_id][day] = r;
        });

        const leavesRes = await db.query(
            `SELECT lr.user_id,
                    TO_CHAR(lr.date_from, 'YYYY-MM-DD') AS date_from,
                    TO_CHAR(lr.date_to,   'YYYY-MM-DD') AS date_to,
                    lt.code AS leave_code
             FROM leave_requests lr
             JOIN leave_types lt ON lt.id = lr.leave_type_id
             WHERE lr.status = 'approved' AND EXTRACT(YEAR FROM lr.date_from) = $1`,
            [year]
        );
        const leaveMap = {};
        leavesRes.rows.forEach(r => {
            const fromISO = String(r.date_from).substring(0, 10);
            const toISO   = String(r.date_to).substring(0, 10);
            // Walk day by day using pure string/numeric comparison — no timezone issues
            let [fy, fm, fd] = fromISO.split('-').map(Number);
            const [ty, tm, td] = toISO.split('-').map(Number);
            while (fy < ty || (fy === ty && fm < tm) || (fy === ty && fm === tm && fd <= td)) {
                if (fy === year && fm === month) {
                    if (!leaveMap[r.user_id]) leaveMap[r.user_id] = {};
                    leaveMap[r.user_id][fd] = LEAVE_CODE_MAP[r.leave_code] || r.leave_code;
                }
                // advance one day
                fd++;
                const daysInCurMonth = new Date(fy, fm, 0).getDate();
                if (fd > daysInCurMonth) { fd = 1; fm++; }
                if (fm > 12) { fm = 1; fy++; }
            }
        });

        const holRes = await db.query(
            `SELECT holiday_date FROM public_holidays WHERE year=$1 AND EXTRACT(MONTH FROM holiday_date)=$2`,
            [year, month]
        );
        const holidayDays = new Set(holRes.rows.map(r => new Date(r.holiday_date).getUTCDate()));

        // â”€â”€ Workbook setup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        const wb = new ExcelJS.Workbook();
        wb.creator = 'CNC Shop Floor';
        const ws = wb.addWorksheet('FERO', { pageSetup: { orientation: 'landscape' } });

        // Column layout: A=Nr, B=Nume, C=Data/Ora, D..AH=days1-31+subtotal16, AI..AQ=totals+leave
        // Col index (1-based): 1=Nr, 2=Nume, 3=Ora, 4=day1 â€¦ 18=day15, 19=subtotal1-15, 20=day16 â€¦ 35=day31, 36=total_ore, 37=ore_sup, 38=ore_noapte, 39=total_neluc, 40=OI, 41=Co-Zlp, 42=Bo, 43=Am, 44=ST, 45=Cfp, 46=O, 47=N, 48=Ef

        // Map day d (1-31) â†’ column index
        const dayCol = (d) => d <= 15 ? d + 3 : d + 4; // +4 because subtotal col sits after day15
        const SUBTOTAL_COL = 19;
        const TOT_COL      = 36;
        const SUPP_COL     = 37;
        const NIGHT_COL    = 38;
        const NELUC_COL    = 39;
        const OI_COL       = 40;
        const CO_COL       = 41;
        const BO_COL       = 42;
        const AM_COL       = 43;
        const ST_COL       = 44;
        const CFP_COL      = 45;
        const O_COL        = 46;
        const N_COL        = 47;
        const EF_COL       = 48;
        const LAST_COL     = 48;

        // Set column widths — exact from original XLS measurement
        ws.getColumn(1).width  = 2.5;   // Nr
        ws.getColumn(2).width  = 10.68; // Nume
        ws.getColumn(3).width  = 5.5;   // Data/Ora
        for (let c = 4; c <= 35; c++) ws.getColumn(c).width = 2.5; // all day cols
        ws.getColumn(SUBTOTAL_COL).width = 3.5;
        ws.getColumn(TOT_COL).width   = 3.5;
        ws.getColumn(SUPP_COL).width  = 1.82;
        ws.getColumn(NIGHT_COL).width = 1.82;
        ws.getColumn(NELUC_COL).width = 3.5;
        for (let c = OI_COL; c <= LAST_COL; c++) ws.getColumn(c).width = 1.96;

        // â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        const fill = (hex) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: hex } });
        const border = (style = 'thin') => ({
            top: { style }, bottom: { style }, left: { style }, right: { style }
        });
        const font = (opts = {}) => ({ name: 'Times New Roman', size: 6, ...opts });
        const align = (h = 'center', v = 'middle', wrap = false, rotate = 0) => ({ horizontal: h, vertical: v, wrapText: wrap, textRotation: rotate });

        const applyBorder = (cell, style = 'thin') => { cell.border = border(style); };
        const applyFill   = (cell, hex) => { cell.fill = fill(hex); };

        const styleCell = (cell, opts = {}) => {
            cell.font      = font(opts.font || {});
            cell.alignment = align(opts.h || 'center', opts.v || 'middle', opts.wrap || false);
            if (opts.fill)   applyFill(cell, opts.fill);
            if (opts.border !== false) applyBorder(cell, opts.border || 'thin');
        };

        const fmtTime = (t) => {
            if (!t) return '';
            const p = String(t).split(':');
            return `${p[0]}.${p[1] || '00'}`;
        };

        // â”€â”€ Row 1: blank â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        ws.addRow([]);
        ws.getRow(1).height = 21;

        // â”€â”€ Row 2: Company name â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        ws.addRow([]);
        ws.getRow(2).height = 15;
        const compCell = ws.getCell(2, 1); // col A, not B (matches original)
        compCell.value = 'SC FERO - PACT SRL';
        compCell.font  = font({ size: 12 }); // 12pt, not bold
        ws.mergeCells(2, 1, 2, 5);

        // â”€â”€ Rows 2-7: Legend (right side) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        // Legend starts at col AH (34) roughly, mimic original: cols ~34..48
        const LEG_START = 34; // column index for legend
        LEGEND.forEach((entry, i) => {
            const rowNum = i + 2;
            const [code, bg, desc, rCode, rBg, rDesc] = entry;
            const row = ws.getRow(rowNum);
            row.height = 15; // exact from original

            // Code cell: merged over 2 cols (34-35), exact fills from original
            const ORIG_FILLS = [
                ['FFD4EA6B','FFFFFFFF'], ['FFB4C7DC','FFFFFFFF'],
                ['FFFFFFFF','FFFFFFCC'], ['FFFFFFFF','FFFF0000'],
                ['FFFFFF00','FFFFFFFF'], ['FFFFFFFF','FFFFFFFF'],
            ];
            const [bgOrig, rBgOrig] = ORIG_FILLS[i] || [bg, rBg];
            const cCode = row.getCell(LEG_START);
            cCode.value = code;
            cCode.font = font({ size: 8 }); cCode.alignment = align('center', 'middle');
            if (bgOrig !== 'FFFFFFFF') cCode.fill = fill(bgOrig);
            ws.mergeCells(rowNum, LEG_START, rowNum, LEG_START + 1);

            const cDesc = row.getCell(LEG_START + 2); // col 36
            cDesc.value = desc; cDesc.font = font({ size: 8 }); cDesc.alignment = align('left', 'middle');

            // Right code: merged over 2 cols (40-41)
            const cRCode = row.getCell(LEG_START + 6); // col 40
            cRCode.value = rCode;
            cRCode.font = font({ size: 8 }); cRCode.alignment = align('center', 'middle');
            if (rBgOrig !== 'FFFFFFFF') cRCode.fill = fill(rBgOrig);
            ws.mergeCells(rowNum, LEG_START + 6, rowNum, LEG_START + 7);

            const cRDesc = row.getCell(LEG_START + 8); // col 42
            cRDesc.value = rDesc; cRDesc.font = font({ size: 8 }); cRDesc.alignment = align('left', 'middle');
        });

        // â”€â”€ Row 8: Main title â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        ws.addRow([]); ws.addRow([]); ws.addRow([]); ws.addRow([]); ws.addRow([]); ws.addRow([]);
        // rows 3-7 blank (already pushed via legend height)
        const titleRowNum = 8;
        ws.getRow(titleRowNum).height = 15.75;
        const titleCell = ws.getCell(titleRowNum, 17); // col 17 (matches original)
        titleCell.value = 'EVIDENTA ORELOR de MUNCA';
        titleCell.font  = font({ size: 12 }); // 12pt, not bold, no dark red (matches original)
        titleCell.alignment = align('center', 'middle');
        ws.mergeCells(titleRowNum, 17, titleRowNum, 28);

        // â”€â”€ Row 9: Subtitle â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        ws.getRow(9).height = 18.75;
        const subCell = ws.getCell(9, 17); // col 17 (matches original)
        subCell.value = `pentru luna ${monthName} ${year}`;
        subCell.font  = font({ size: 10 }); // 10pt (matches original)
        subCell.alignment = align('center', 'middle');
        ws.mergeCells(9, 17, 9, 28);

        // â”€â”€ Row 10: blank â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        ws.getRow(10).height = 7.5;

        // â”€â”€ Rows 11-12: Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        const HDR_ROW  = 11;
        const DOW_ROW  = 12; // merged into HDR_ROW for all day columns
        ws.getRow(HDR_ROW).height = 20.1;
        ws.getRow(DOW_ROW).height = 20.1;

        // Helper: set a header cell, merge over rows 11-12, apply style
        const setHdr = (col, val, fntSize, rotate, bgHex) => {
            const c = ws.getCell(HDR_ROW, col);
            c.value = val;
            c.font      = font({ size: fntSize || 8 });
            c.alignment = align('center', 'middle', rotate ? false : true, rotate || 0);
            c.fill      = fill(bgHex || 'FFFFFFFF');
            applyBorder(c);
            ws.mergeCells(HDR_ROW, col, DOW_ROW, col);
        };

        setHdr(1, 'Nr. crt.',             9,  90);            // rotated 90°
        setHdr(2, 'Numele si prenumele',   10, 0);             // wrap
        setHdr(3, 'Data / Ora',            9,  0);             // wrap

        // Day numbers: NOT rotated, white bg; 1-9 → 10pt, 10-31 → 8pt (original)
        for (let d = 1; d <= 31; d++) {
            const col = dayCol(d);
            const sz  = d <= 9 ? 10 : 8;
            if (d <= daysInMonth) setHdr(col, d, sz, 0, 'FFFFFFFF');
        }

        // Subtotal 1-15: rotated, white bg
        setHdr(SUBTOTAL_COL, 'total ore  1-15', 8, 90, 'FFFFFFFF');

        // Summary columns: exact sizes and fills from original
        setHdr(TOT_COL,   'total ore lucrate',  8, 90);
        setHdr(SUPP_COL,  'ore supliment.',      6, 90);
        setHdr(NIGHT_COL, 'ore de noapte',       6, 90);
        setHdr(NELUC_COL, 'total ore nelucrate', 8, 90);
        setHdr(OI_COL,    'OI',                  6, 90);
        setHdr(CO_COL,    'Co - Zlp',            6, 90, 'FFD4EA6B'); // original fill
        setHdr(BO_COL,    'Bo',                  6, 90, 'FF729FCF'); // original fill
        setHdr(AM_COL,    'Am',                  6, 90);
        setHdr(ST_COL,    'ST',                  6, 90);
        setHdr(CFP_COL,   'Cfp',                 6, 90);
        setHdr(O_COL,     'O',                   6, 90);
        setHdr(N_COL,     'N',                   6, 90);
        setHdr(EF_COL,    'Ef',                  6, 90);

        // â”€â”€ Employee rows â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        let currentRow = DOW_ROW + 1;

        employees.forEach((emp, idx) => {
            const uh = hoursMap[emp.id] || {};
            const ul = leaveMap[emp.id] || {};
            const R1 = currentRow;
            const R2 = currentRow + 1;

            ws.getRow(R1).height = 15;
            ws.getRow(R2).height = 15;

            // Nr — merged over both rows, value in R1 (original has merge)
            ws.mergeCells(R1, 1, R2, 1);
            const nrCell = ws.getCell(R1, 1);
            nrCell.value = idx + 1;
            nrCell.font = font({ size: 8 }); nrCell.alignment = align('center', 'middle');
            applyBorder(nrCell);

            // Nume — merged over both rows, value in R1 (original has merge)
            ws.mergeCells(R1, 2, R2, 2);
            const nameCell = ws.getCell(R1, 2);
            nameCell.value = emp.name;
            nameCell.font = font({ size: 10 }); nameCell.alignment = align('center', 'middle', true);
            applyBorder(nameCell);

            const c1 = ws.getCell(R1, 3); c1.value = 'incep.';
            styleCell(c1, { font: { size: 6 }, border: 'thin' });
            const c2 = ws.getCell(R2, 3); c2.value = 'term.';
            styleCell(c2, { font: { size: 6 }, border: 'thin' });

            let total1_15 = 0, totalWorked = 0, totalOT = 0;
            const leaveCounts = { Co: 0, Bo: 0, Am: 0, ST: 0, Cfp: 0, N: 0, Ef: 0 };

            for (let d = 1; d <= 31; d++) {
                const col = dayCol(d);
                const r1c = ws.getCell(R1, col);
                const r2c = ws.getCell(R2, col);

                if (d > daysInMonth) {
                    r1c.font = font({ size: 6 }); r1c.alignment = align('center','middle',false,90);
                    r1c.fill = fill('FFE0E0E0'); applyBorder(r1c);
                    r2c.font = font({ size: 6 }); r2c.alignment = align('center','middle',false,90);
                    r2c.fill = fill('FFE0E0E0'); applyBorder(r2c);
                    continue;
                }

                const dow       = new Date(year, month - 1, d).getDay();
                const isWeekend = dow === 0 || dow === 6;
                const isHoliday = holidayDays.has(d);
                const leaveCode = ul[d];
                const hoursRec  = uh[d];

                const cellFill = isWeekend ? FILL_WEEKEND
                    : isHoliday && !leaveCode ? FILL_HOLIDAY
                    : leaveCode ? (LEAVE_FILL[leaveCode] || 'FFD9D9D9')
                    : FILL_WORK;

                const applyDay = (cell, val) => {
                    cell.value = val || '';
                    cell.font      = font({ size: 6 });
                    cell.alignment = align('center', 'middle', false, 90); // rotated 90° (matches original)
                    cell.fill      = fill(cellFill);
                    applyBorder(cell);
                };

                if (isWeekend) {
                    applyDay(r1c, 'W');
                    applyDay(r2c, 'W');
                } else if (isHoliday && !leaveCode) {
                    applyDay(r1c, 'S');
                    applyDay(r2c, 'S');
                } else if (leaveCode) {
                    applyDay(r1c, leaveCode);
                    applyDay(r2c, leaveCode);
                    if (leaveCounts.hasOwnProperty(leaveCode)) leaveCounts[leaveCode]++;
                } else if (hoursRec) {
                    applyDay(r1c, fmtTime(hoursRec.check_in));
                    applyDay(r2c, fmtTime(hoursRec.check_out));
                    const h  = parseFloat(hoursRec.hours_worked)  || 0;
                    const ot = parseFloat(hoursRec.overtime_hours) || 0;
                    if (d <= 15) total1_15 += h;
                    totalWorked += h;
                    totalOT     += ot;
                } else {
                    applyDay(r1c, '');
                    applyDay(r2c, '');
                }
            }

            // Subtotal 1-15 — value in R1, blank+border in R2, rotated, white fill (matches original)
            const stCell = ws.getCell(R1, SUBTOTAL_COL);
            stCell.value = total1_15 > 0 ? total1_15 : '';
            stCell.font = font({ size: 6 }); stCell.alignment = align('center','middle',false,90);
            stCell.fill = fill('FFFFFFFF'); applyBorder(stCell);
            const stCell2 = ws.getCell(R2, SUBTOTAL_COL);
            stCell2.font = font({ size: 6 }); stCell2.alignment = align('center','middle',false,90);
            stCell2.fill = fill('FFFFFFFF'); applyBorder(stCell2);

            // Totals — value in R1, blank+border in R2, no merge (matches original)
            const addTot = (col, val) => {
                const tc = ws.getCell(R1, col);
                tc.value = val !== '' ? val : '';
                tc.font = font({ size: 6 }); tc.alignment = align('center','middle',false,90);
                tc.fill = fill('FFFFFFFF'); applyBorder(tc);
                const tc2 = ws.getCell(R2, col);
                tc2.font = font({ size: 6 }); tc2.alignment = align('center','middle',false,90);
                tc2.fill = fill('FFFFFFFF'); applyBorder(tc2);
            };
            addTot(TOT_COL,   totalWorked > 0 ? totalWorked : '');
            addTot(SUPP_COL,  totalOT > 0     ? totalOT     : '');
            addTot(NIGHT_COL, '');
            addTot(NELUC_COL, '');
            addTot(OI_COL,    '');
            addTot(CO_COL,    leaveCounts.Co  || '');
            addTot(BO_COL,    leaveCounts.Bo  || '');
            addTot(AM_COL,    leaveCounts.Am  || '');
            addTot(ST_COL,    leaveCounts.ST  || '');
            addTot(CFP_COL,   leaveCounts.Cfp || '');
            addTot(O_COL,     '');
            addTot(N_COL,     leaveCounts.N   || '');
            addTot(EF_COL,    leaveCounts.Ef  || '');

            currentRow += 2;
        });

        // â”€â”€ Blank row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        currentRow++;

        // â”€â”€ ADMINISTRATOR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        ws.getRow(currentRow).height = 14;
        ws.mergeCells(currentRow, 18, currentRow, 28);
        const adCell = ws.getCell(currentRow, 18);
        adCell.value = 'ADMINISTRATOR';
        adCell.font  = font({ size: 10, bold: true });
        adCell.alignment = align('center', 'middle');
        currentRow += 3;

        // â”€â”€ Legal text â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        ws.getRow(currentRow).height = 28;
        ws.mergeCells(currentRow, 1, currentRow, LAST_COL);
        const legalCell = ws.getCell(currentRow, 1);
        legalCell.value = 'Extras din CM-art.119(1) Angajatorul are obligatia de a tine la locul de munca evidenta orelor de munca prestate zilnic de fiecare salariat, cu evidentierea orelor de incepere si de sfarsit ale programului de lucru.';
        legalCell.font  = font({ size: 7, italic: true });
        legalCell.alignment = align('left', 'middle', true);

        // â”€â”€ Send response â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="EVIDENTA-${monthName}-${year}.xlsx"`);
        await wb.xlsx.write(res);
        res.end();

    } catch (e) {
        console.error('exportAttendance', e);
        res.status(500).json({ success: false, error: e.message });
    }
};

// PUT /api/hr/employees/:id  — toggle include_in_attendance (supervisor+)
const updateEmployee = async (req, res) => {
    try {
        if (req.user.level < 400) return res.status(403).json({ success: false, error: 'Supervisor required' });
        const { include_in_attendance, schedule_checkin, schedule_checkout, lunch_break_minutes } = req.body;

        const fields = [];
        const vals   = [];
        if (typeof include_in_attendance === 'boolean') { vals.push(include_in_attendance); fields.push(`include_in_attendance = $${vals.length}`); }
        if (schedule_checkin  !== undefined) { vals.push(schedule_checkin  || null); fields.push(`schedule_checkin  = $${vals.length}`); }
        if (schedule_checkout !== undefined) { vals.push(schedule_checkout || null); fields.push(`schedule_checkout = $${vals.length}`); }
        if (lunch_break_minutes !== undefined) { vals.push(lunch_break_minutes !== null ? parseInt(lunch_break_minutes) : 0); fields.push(`lunch_break_minutes = $${vals.length}`); }
        if (!fields.length) return res.status(400).json({ success: false, error: 'Nothing to update' });

        vals.push(req.params.id);
        const result = await db.query(
            `UPDATE users SET ${fields.join(', ')} WHERE id = $${vals.length} RETURNING id, name, include_in_attendance, schedule_checkin, schedule_checkout, lunch_break_minutes`,
            vals
        );
        if (!result.rows.length) return res.status(404).json({ success: false, error: 'User not found' });
        res.json({ success: true, user: result.rows[0] });
    } catch (e) {
        console.error('updateEmployee', e);
        res.status(500).json({ success: false, error: e.message });
    }
};

// POST /api/hr/autofill?month=YYYY-MM  — fill missing work days from each user's schedule
const autoFill = async (req, res) => {
    try {
        if (req.user.level < 400) return res.status(403).json({ success: false, error: 'Supervisor required' });
        const monthStr = req.query.month || `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
        const [year, month] = monthStr.split('-').map(Number);
        const daysInMonth = new Date(year, month, 0).getDate();

        // Get employees with a schedule
        const empRes = await db.query(
            `SELECT id, schedule_checkin, schedule_checkout, COALESCE(lunch_break_minutes, 30) AS lunch_break_minutes FROM users
             WHERE include_in_attendance = true AND is_active = true AND level >= 100
               AND schedule_checkin IS NOT NULL AND schedule_checkout IS NOT NULL`
        );
        if (!empRes.rows.length) return res.json({ success: true, filled: 0 });

        // Get existing hours for the month
        const existingRes = await db.query(
            `SELECT user_id, TO_CHAR(work_date,'YYYY-MM-DD') AS work_date FROM work_hours
             WHERE work_date >= $1::date AND work_date < $1::date + INTERVAL '1 month'`,
            [`${year}-${String(month).padStart(2,'0')}-01`]
        );
        const existingSet = new Set(existingRes.rows.map(r => `${r.user_id}_${r.work_date}`));

        // Get approved leaves for the month
        const leavesRes = await db.query(
            `SELECT user_id, TO_CHAR(date_from,'YYYY-MM-DD') AS date_from, TO_CHAR(date_to,'YYYY-MM-DD') AS date_to
             FROM leave_requests WHERE status='approved' AND EXTRACT(YEAR FROM date_from)=$1`, [year]
        );
        const leaveSet = new Set();
        leavesRes.rows.forEach(r => {
            let [fy,fm,fd] = r.date_from.split('-').map(Number);
            const [ty,tm,td] = r.date_to.split('-').map(Number);
            while (fy < ty || (fy===ty && fm < tm) || (fy===ty && fm===tm && fd<=td)) {
                if (fy===year && fm===month) leaveSet.add(`${r.user_id}_${year}-${String(month).padStart(2,'0')}-${String(fd).padStart(2,'0')}`);
                fd++;
                const dim = new Date(fy,fm,0).getDate();
                if (fd>dim){fd=1;fm++;} if(fm>12){fm=1;fy++;}
            }
        });

        let filled = 0;
        for (const emp of empRes.rows) {
            const ci = emp.schedule_checkin;
            const co = emp.schedule_checkout;
            // Calc hours: deduct lunch only if >= 30 min, cap 8h, rest OT
            const lunchDeduct = emp.lunch_break_minutes >= 30 ? emp.lunch_break_minutes : 0;
            const [ch,cm] = ci.split(':').map(Number);
            const [oh,om] = co.split(':').map(Number);
            const mins = (oh*60+om) - (ch*60+cm) - lunchDeduct;
            const total = mins > 0 ? Math.round(mins/6)/10 : 0;
            const hw = Math.min(total, 8);
            const ot = Math.max(0, Math.round((total-hw)*10)/10);

            for (let d = 1; d <= daysInMonth; d++) {
                const iso = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                const dow = new Date(iso+'T00:00:00').getDay();
                if (dow === 0 || dow === 6) continue; // skip weekends
                const key = `${emp.id}_${iso}`;
                if (existingSet.has(key) || leaveSet.has(key)) continue; // already has data
                await db.query(
                    `INSERT INTO work_hours (user_id, work_date, check_in, check_out, hours_worked, overtime_hours, entered_by)
                     VALUES ($1,$2,$3,$4,$5,$6,$7)
                     ON CONFLICT (user_id, work_date) DO NOTHING`,
                    [emp.id, iso, ci, co, hw, ot, req.user.id]
                );
                filled++;
            }
        }
        res.json({ success: true, filled });
    } catch (e) {
        console.error('autoFill', e);
        res.status(500).json({ success: false, error: e.message });
    }
};

// Standalone daily auto-fill — called by the scheduler for a specific ISO date
const runDailyAutoFill = async (isoDate) => {
    const [year, month, day] = isoDate.split('-').map(Number);
    const dow = new Date(isoDate + 'T00:00:00').getDay();
    if (dow === 0 || dow === 6) { console.log(`[AutoFill] ${isoDate} is weekend, skipping.`); return; }

    console.log(`[AutoFill] Running daily auto-fill for ${isoDate}`);

    const empRes = await db.query(
        `SELECT id, schedule_checkin, schedule_checkout, COALESCE(lunch_break_minutes, 30) AS lunch_break_minutes
         FROM users
         WHERE include_in_attendance = true AND is_active = true AND level >= 100
           AND schedule_checkin IS NOT NULL AND schedule_checkout IS NOT NULL`
    );
    if (!empRes.rows.length) { console.log('[AutoFill] No employees with schedule.'); return; }

    const existingRes = await db.query(
        `SELECT user_id FROM work_hours WHERE TO_CHAR(work_date,'YYYY-MM-DD') = $1`, [isoDate]
    );
    const existingSet = new Set(existingRes.rows.map(r => `${r.user_id}`));

    const leavesRes = await db.query(
        `SELECT user_id FROM leave_requests
         WHERE status = 'approved' AND $1::date BETWEEN date_from AND date_to`, [isoDate]
    );
    const leaveSet = new Set(leavesRes.rows.map(r => `${r.user_id}`));

    let filled = 0;
    for (const emp of empRes.rows) {
        if (existingSet.has(`${emp.id}`) || leaveSet.has(`${emp.id}`)) continue;
        const lunchDeduct = emp.lunch_break_minutes >= 30 ? emp.lunch_break_minutes : 0;
        const [ch, cm] = emp.schedule_checkin.split(':').map(Number);
        const [oh, om] = emp.schedule_checkout.split(':').map(Number);
        const mins = (oh * 60 + om) - (ch * 60 + cm) - lunchDeduct;
        const total = mins > 0 ? Math.round(mins / 6) / 10 : 0;
        const hw = Math.min(total, 8);
        const ot = Math.max(0, Math.round((total - hw) * 10) / 10);
        await db.query(
            `INSERT INTO work_hours (user_id, work_date, check_in, check_out, hours_worked, overtime_hours, entered_by)
             VALUES ($1, $2, $3, $4, $5, $6, $1)
             ON CONFLICT (user_id, work_date) DO NOTHING`,
            [emp.id, isoDate, emp.schedule_checkin, emp.schedule_checkout, hw, ot]
        );
        filled++;
    }
    console.log(`[AutoFill] ${isoDate}: filled ${filled} employee-day records.`);
};

module.exports = {
    getLeaveTypes,
    getPublicHolidays, createPublicHoliday, updatePublicHoliday, deletePublicHoliday,
    getBalances, getMyBalance, updateBalance,
    getLeaves, getMyLeaves, createLeave, approveLeave, rejectLeave, cancelLeave,
    getHours, getMyHours, logHours, updateHours, deleteHours,
    getSummary, exportAttendance, updateEmployee, autoFill,
    runDailyAutoFill,
};

