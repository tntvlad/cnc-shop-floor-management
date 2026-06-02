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

// ── Export: EVIDENTA ORELOR DE MUNCA (ExcelJS – full formatting) ──────────

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
const FILL_WEEKEND  = 'FFFFFF00'; // yellow
const FILL_HOLIDAY  = 'FFFFFF00'; // yellow
const FILL_CO       = 'FF00B0F0'; // blue
const FILL_BO       = 'FF92D050'; // green
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

        // ── DB queries ────────────────────────────────────────────────────────────
        const empRes = await db.query(`SELECT id, name FROM users WHERE level >= 100 ORDER BY name`);
        const employees = empRes.rows;

        const hoursRes = await db.query(
            `SELECT user_id, work_date, check_in, check_out, hours_worked, overtime_hours
             FROM work_hours
             WHERE work_date >= $1::date AND work_date < $1::date + INTERVAL '1 month'`,
            [`${year}-${String(month).padStart(2,'0')}-01`]
        );
        const hoursMap = {};
        hoursRes.rows.forEach(r => {
            const day = new Date(r.work_date).getUTCDate();
            if (!hoursMap[r.user_id]) hoursMap[r.user_id] = {};
            hoursMap[r.user_id][day] = r;
        });

        const leavesRes = await db.query(
            `SELECT lr.user_id, lr.date_from, lr.date_to, lt.code AS leave_code
             FROM leave_requests lr
             JOIN leave_types lt ON lt.id = lr.leave_type_id
             WHERE lr.status = 'approved' AND EXTRACT(YEAR FROM lr.date_from) = $1`,
            [year]
        );
        const leaveMap = {};
        leavesRes.rows.forEach(r => {
            const from = new Date(String(r.date_from).substring(0,10) + 'T00:00:00');
            const to   = new Date(String(r.date_to).substring(0,10)   + 'T00:00:00');
            const cur  = new Date(from);
            while (cur <= to) {
                if (cur.getFullYear() === year && cur.getMonth() + 1 === month) {
                    const day = cur.getDate();
                    if (!leaveMap[r.user_id]) leaveMap[r.user_id] = {};
                    leaveMap[r.user_id][day] = LEAVE_CODE_MAP[r.leave_code] || r.leave_code;
                }
                cur.setDate(cur.getDate() + 1);
            }
        });

        const holRes = await db.query(
            `SELECT holiday_date FROM public_holidays WHERE year=$1 AND EXTRACT(MONTH FROM holiday_date)=$2`,
            [year, month]
        );
        const holidayDays = new Set(holRes.rows.map(r => new Date(r.holiday_date).getUTCDate()));

        // ── Workbook setup ────────────────────────────────────────────────────────
        const wb = new ExcelJS.Workbook();
        wb.creator = 'CNC Shop Floor';
        const ws = wb.addWorksheet('FERO', { pageSetup: { orientation: 'landscape' } });

        // Column layout: A=Nr, B=Nume, C=Data/Ora, D..AH=days1-31+subtotal16, AI..AQ=totals+leave
        // Col index (1-based): 1=Nr, 2=Nume, 3=Ora, 4=day1 … 18=day15, 19=subtotal1-15, 20=day16 … 35=day31, 36=total_ore, 37=ore_sup, 38=ore_noapte, 39=total_neluc, 40=OI, 41=Co-Zlp, 42=Bo, 43=Am, 44=ST, 45=Cfp, 46=O, 47=N, 48=Ef

        // Map day d (1-31) → column index
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

        // Set column widths
        ws.getColumn(1).width  = 5;   // Nr
        ws.getColumn(2).width  = 18;  // Nume
        ws.getColumn(3).width  = 7;   // Data/Ora
        for (let c = 4; c <= 35; c++) ws.getColumn(c).width = 5.5; // days
        ws.getColumn(SUBTOTAL_COL).width = 8;
        for (let c = TOT_COL; c <= LAST_COL; c++) ws.getColumn(c).width = 7;

        // ── Helpers ───────────────────────────────────────────────────────────────
        const fill = (hex) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: hex } });
        const border = (style = 'thin') => ({
            top: { style }, bottom: { style }, left: { style }, right: { style }
        });
        const font = (opts = {}) => ({ name: 'Times New Roman', size: 8, ...opts });
        const align = (h = 'center', v = 'middle', wrap = false) => ({ horizontal: h, vertical: v, wrapText: wrap });

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

        // ── Row 1: blank ──────────────────────────────────────────────────────────
        ws.addRow([]);
        ws.getRow(1).height = 10;

        // ── Row 2: Company name ───────────────────────────────────────────────────
        ws.addRow([]);
        ws.getRow(2).height = 14;
        const compCell = ws.getCell('B2');
        compCell.value = 'SC FERO - PACT SRL';
        compCell.font  = font({ size: 11, bold: true });

        // ── Rows 2-7: Legend (right side) ────────────────────────────────────────
        // Legend starts at col AH (34) roughly, mimic original: cols ~34..48
        const LEG_START = 34; // column index for legend
        LEGEND.forEach((entry, i) => {
            const rowNum = i + 2;
            const [code, bg, desc, rCode, rBg, rDesc] = entry;
            const row = ws.getRow(rowNum);
            row.height = 12;

            const cCode = row.getCell(LEG_START);
            cCode.value = code; styleCell(cCode, { fill: bg, font: { bold: true, size: 8 } });

            const cDesc = row.getCell(LEG_START + 1);
            cDesc.value = desc; styleCell(cDesc, { fill: bg, h: 'left', font: { size: 8 } });

            const cRCode = row.getCell(LEG_START + 3);
            cRCode.value = rCode; styleCell(cRCode, { fill: rBg, font: { bold: true, size: 8 } });

            const cRDesc = row.getCell(LEG_START + 4);
            cRDesc.value = rDesc; styleCell(cRDesc, { fill: rBg, h: 'left', font: { size: 8 } });
        });

        // ── Row 8: Main title ─────────────────────────────────────────────────────
        ws.addRow([]); ws.addRow([]); ws.addRow([]); ws.addRow([]); ws.addRow([]); ws.addRow([]);
        // rows 3-7 blank (already pushed via legend height)
        const titleRowNum = 8;
        ws.getRow(titleRowNum).height = 16;
        const titleCell = ws.getCell(titleRowNum, 16);
        titleCell.value = 'EVIDENTA ORELOR de MUNCA';
        titleCell.font  = font({ size: 14, bold: true, color: { argb: 'FF800000' } });
        titleCell.alignment = align('center', 'middle');
        ws.mergeCells(titleRowNum, 16, titleRowNum, 28);

        // ── Row 9: Subtitle ───────────────────────────────────────────────────────
        ws.getRow(9).height = 14;
        const subCell = ws.getCell(9, 16);
        subCell.value = `pentru luna ${monthName} ${year}`;
        subCell.font  = font({ size: 11, italic: true });
        subCell.alignment = align('center', 'middle');
        ws.mergeCells(9, 16, 9, 28);

        // ── Row 10: blank ─────────────────────────────────────────────────────────
        ws.getRow(10).height = 6;

        // ── Rows 11-12: Header ────────────────────────────────────────────────────
        const HDR_ROW  = 11;
        const DOW_ROW  = 12;
        ws.getRow(HDR_ROW).height = 40;
        ws.getRow(DOW_ROW).height = 12;

        // Merge Nr, Nume, Ora across 2 rows
        ws.mergeCells(HDR_ROW, 1, DOW_ROW, 1);
        ws.mergeCells(HDR_ROW, 2, DOW_ROW, 2);
        ws.mergeCells(HDR_ROW, 3, DOW_ROW, 3);

        const hdrStyle = { fill: 'FFD9D9D9', font: { bold: true, size: 8 }, h: 'center', v: 'middle', wrap: true, border: 'thin' };

        const setHdr = (row, col, val) => {
            const c = ws.getCell(row, col);
            c.value = val;
            styleCell(c, hdrStyle);
        };

        setHdr(HDR_ROW, 1, 'Nr.\ncrt.');
        setHdr(HDR_ROW, 2, 'Numele si prenumele');
        setHdr(HDR_ROW, 3, 'Data /\nOra');

        for (let d = 1; d <= 31; d++) {
            const col = dayCol(d);
            if (d <= daysInMonth) {
                setHdr(HDR_ROW, col, String(d));
                const dow = new Date(year, month - 1, d).getDay();
                const dowCell = ws.getCell(DOW_ROW, col);
                dowCell.value = RO_DOW[dow];
                styleCell(dowCell, { ...hdrStyle, fill: (dow === 0 || dow === 6) ? FILL_WEEKEND : 'FFD9D9D9' });
            }
        }
        setHdr(HDR_ROW, SUBTOTAL_COL, 'total\nore\n1-15');
        ws.mergeCells(HDR_ROW, SUBTOTAL_COL, DOW_ROW, SUBTOTAL_COL);

        setHdr(HDR_ROW, TOT_COL,   'total ore\nlucrate');
        setHdr(HDR_ROW, SUPP_COL,  'ore\nsupli-\nment.');
        setHdr(HDR_ROW, NIGHT_COL, 'ore de\nnoapte');
        setHdr(HDR_ROW, NELUC_COL, 'total ore\nnelucrate');
        setHdr(HDR_ROW, OI_COL,    'OI');
        setHdr(HDR_ROW, CO_COL,    'Co -\nZlp');
        setHdr(HDR_ROW, BO_COL,    'Bo');
        setHdr(HDR_ROW, AM_COL,    'Am');
        setHdr(HDR_ROW, ST_COL,    'ST');
        setHdr(HDR_ROW, CFP_COL,   'Cfp');
        setHdr(HDR_ROW, O_COL,     'O');
        setHdr(HDR_ROW, N_COL,     'N');
        setHdr(HDR_ROW, EF_COL,    'Ef');
        for (let c = TOT_COL; c <= LAST_COL; c++) ws.mergeCells(HDR_ROW, c, DOW_ROW, c);

        // ── Employee rows ─────────────────────────────────────────────────────────
        let currentRow = DOW_ROW + 1;

        employees.forEach((emp, idx) => {
            const uh = hoursMap[emp.id] || {};
            const ul = leaveMap[emp.id] || {};
            const R1 = currentRow;
            const R2 = currentRow + 1;

            ws.getRow(R1).height = 12;
            ws.getRow(R2).height = 12;

            // Nr + Nume merged over 2 rows
            ws.mergeCells(R1, 1, R2, 1);
            const nrCell = ws.getCell(R1, 1);
            nrCell.value = idx + 1;
            styleCell(nrCell, { font: { bold: true, size: 8 }, border: 'thin' });

            ws.mergeCells(R1, 2, R2, 2);
            const nameCell = ws.getCell(R1, 2);
            nameCell.value = emp.name;
            styleCell(nameCell, { font: { bold: true, size: 8 }, h: 'center', v: 'middle', wrap: true, border: 'thin' });

            const c1 = ws.getCell(R1, 3); c1.value = 'incep.';
            styleCell(c1, { font: { size: 7 }, border: 'thin' });
            const c2 = ws.getCell(R2, 3); c2.value = 'term.';
            styleCell(c2, { font: { size: 7 }, border: 'thin' });

            let total1_15 = 0, totalWorked = 0, totalOT = 0;
            const leaveCounts = { Co: 0, Bo: 0, Am: 0, ST: 0, Cfp: 0, N: 0, Ef: 0 };

            for (let d = 1; d <= 31; d++) {
                const col = dayCol(d);
                const r1c = ws.getCell(R1, col);
                const r2c = ws.getCell(R2, col);

                if (d > daysInMonth) {
                    styleCell(r1c, { fill: 'FFE0E0E0', border: 'thin', font: { size: 7 } });
                    styleCell(r2c, { fill: 'FFE0E0E0', border: 'thin', font: { size: 7 } });
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
                    styleCell(cell, { fill: cellFill, font: { size: 7 }, border: 'thin' });
                };

                if (isWeekend) {
                    applyDay(r1c, '');
                    applyDay(r2c, '');
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

            // Subtotal 1-15
            ws.mergeCells(R1, SUBTOTAL_COL, R2, SUBTOTAL_COL);
            const stCell = ws.getCell(R1, SUBTOTAL_COL);
            stCell.value = total1_15 > 0 ? total1_15 : '';
            styleCell(stCell, { fill: 'FFDDEBF7', font: { bold: true, size: 8 }, border: 'thin' });

            // Totals merged over 2 rows
            const addTot = (col, val) => {
                ws.mergeCells(R1, col, R2, col);
                const tc = ws.getCell(R1, col);
                tc.value = val !== '' ? val : '';
                styleCell(tc, { fill: 'FFDDEBF7', font: { bold: true, size: 8 }, border: 'thin' });
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

        // ── Blank row ─────────────────────────────────────────────────────────────
        currentRow++;

        // ── ADMINISTRATOR ─────────────────────────────────────────────────────────
        ws.getRow(currentRow).height = 14;
        ws.mergeCells(currentRow, 18, currentRow, 28);
        const adCell = ws.getCell(currentRow, 18);
        adCell.value = 'ADMINISTRATOR';
        adCell.font  = font({ size: 10, bold: true });
        adCell.alignment = align('center', 'middle');
        currentRow += 3;

        // ── Legal text ────────────────────────────────────────────────────────────
        ws.getRow(currentRow).height = 28;
        ws.mergeCells(currentRow, 1, currentRow, LAST_COL);
        const legalCell = ws.getCell(currentRow, 1);
        legalCell.value = 'Extras din CM-art.119(1) Angajatorul are obligatia de a tine la locul de munca evidenta orelor de munca prestate zilnic de fiecare salariat, cu evidentierea orelor de incepere si de sfarsit ale programului de lucru.';
        legalCell.font  = font({ size: 7, italic: true });
        legalCell.alignment = align('left', 'middle', true);

        // ── Send response ─────────────────────────────────────────────────────────
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="EVIDENTA-${monthName}-${year}.xlsx"`);
        await wb.xlsx.write(res);
        res.end();

    } catch (e) {
        console.error('exportAttendance', e);
        res.status(500).json({ success: false, error: e.message });
    }
};

module.exports = {
    getLeaveTypes,
    getPublicHolidays, createPublicHoliday, updatePublicHoliday, deletePublicHoliday,
    getBalances, getMyBalance, updateBalance,
    getLeaves, getMyLeaves, createLeave, approveLeave, rejectLeave, cancelLeave,
    getHours, getMyHours, logHours, updateHours, deleteHours,
    getSummary, exportAttendance,
};

    try {
        if (req.user.level < 400) return res.status(403).json({ success: false, error: 'Supervisor required' });

        const XLSX = require('xlsx');

        // Parse month param (YYYY-MM), default current month
        const monthStr = req.query.month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
        const [year, month] = monthStr.split('-').map(Number);
        const daysInMonth = new Date(year, month, 0).getDate();

        // Romanian month names
        const RO_MONTHS = ['IANUARIE','FEBRUARIE','MARTIE','APRILIE','MAI','IUNIE',
                           'IULIE','AUGUST','SEPTEMBRIE','OCTOMBRIE','NOIEMBRIE','DECEMBRIE'];
        const monthName = RO_MONTHS[month - 1];

        // Romanian day-of-week abbreviations (0=Sun)
        const RO_DOW = ['Du','Lu','Ma','Mi','Jo','Vi','Sâ'];

        // 1. Get all active employees
        const empRes = await db.query(
            `SELECT id, name, employee_id FROM users WHERE level >= 100 ORDER BY name`,
            []
        );
        const employees = empRes.rows;

        // 2. Get all work hours for the month
        const hoursRes = await db.query(
            `SELECT user_id, work_date, check_in, check_out, hours_worked, overtime_hours
             FROM work_hours
             WHERE work_date >= $1::date AND work_date < $1::date + INTERVAL '1 month'`,
            [`${year}-${String(month).padStart(2, '0')}-01`]
        );
        // hoursMap[userId][dayNum] = record
        const hoursMap = {};
        hoursRes.rows.forEach(r => {
            const day = new Date(r.work_date).getUTCDate();
            if (!hoursMap[r.user_id]) hoursMap[r.user_id] = {};
            hoursMap[r.user_id][day] = r;
        });

        // 3. Get approved leaves for the year
        const leavesRes = await db.query(
            `SELECT lr.user_id, lr.date_from, lr.date_to, lt.code AS leave_code
             FROM leave_requests lr
             JOIN leave_types lt ON lt.id = lr.leave_type_id
             WHERE lr.status = 'approved'
               AND EXTRACT(YEAR FROM lr.date_from) = $1`,
            [year]
        );
        // leaveMap[userId][dayNum] = 'Co'|'Bo'|...
        const leaveMap = {};
        leavesRes.rows.forEach(r => {
            const from = new Date(String(r.date_from).substring(0, 10) + 'T00:00:00');
            const to   = new Date(String(r.date_to).substring(0, 10)   + 'T00:00:00');
            const cur  = new Date(from);
            while (cur <= to) {
                if (cur.getFullYear() === year && cur.getMonth() + 1 === month) {
                    const day = cur.getDate();
                    if (!leaveMap[r.user_id]) leaveMap[r.user_id] = {};
                    leaveMap[r.user_id][day] = LEAVE_CODE_MAP[r.leave_code] || r.leave_code;
                }
                cur.setDate(cur.getDate() + 1);
            }
        });

        // 4. Get public holidays this month
        const holRes = await db.query(
            `SELECT holiday_date FROM public_holidays
             WHERE year = $1 AND EXTRACT(MONTH FROM holiday_date) = $2`,
            [year, month]
        );
        const holidayDays = new Set(holRes.rows.map(r => new Date(r.holiday_date).getUTCDate()));

        // ── Build worksheet data ──────────────────────────────────────────────────
        const rows = [];

        // Row 1: blank
        rows.push([]);

        // Row 2: company + legend
        rows.push(['SC FERO - PACT SRL', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'Co', '', 'conc.odihna', '', 'OI', '', 'ore intrerupere']);
        rows.push(['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'Bo', '', 'conc.boala', '', 'Cfp', '', 'Concediu fara plata']);
        rows.push(['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'Am', '', 'accid.munca', '', 'W', '', 'weekend']);
        rows.push(['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'M', '', 'maternitate', '', 'N', '', 'abs.nemotivate']);
        rows.push(['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'S', '', 'sarbatori, zile libere', '', 'Ef', '', 'evenim.fam.']);
        rows.push(['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'ST', '', 'somaj tehnic', '', 'Zlp', '', 'zile libere platite']);

        // Row 8-9: title
        const titleRow = new Array(47).fill('');
        titleRow[15] = 'EVIDENTA ORELOR de MUNCA';
        rows.push(titleRow);
        const subtitleRow = new Array(47).fill('');
        subtitleRow[15] = `pentru luna ${monthName} ${year}`;
        rows.push(subtitleRow);

        // Row 10: blank
        rows.push([]);

        // Row 11: column headers
        const headerRow = ['Nr. crt.', 'Numele si prenumele', 'Data / Ora'];
        for (let d = 1; d <= 31; d++) {
            if (d === 16) headerRow.push('total ore  1-15');
            headerRow.push(d <= daysInMonth ? String(d) : '');
        }
        headerRow.push('total ore lucrate', 'ore supliment.', 'ore de noapte', 'total ore nelucrate',
                        'OI', 'Co - Zlp', 'Bo', 'Am', 'ST', 'Cfp', 'O', 'N', 'Ef');
        rows.push(headerRow);

        // Row 12: day-of-week names
        const dowRow = ['', '', ''];
        for (let d = 1; d <= 31; d++) {
            if (d === 16) dowRow.push('');
            if (d <= daysInMonth) {
                const dow = new Date(year, month - 1, d).getDay();
                dowRow.push(RO_DOW[dow]);
            } else {
                dowRow.push('');
            }
        }
        rows.push(dowRow);

        // Helper: format TIME value as "HH.MM"
        const fmtTime = (t) => {
            if (!t) return '';
            const s = String(t);
            const parts = s.split(':');
            return `${parts[0]}.${parts[1] || '00'}`;
        };

        // Employee rows (2 per employee)
        employees.forEach((emp, idx) => {
            const uh = hoursMap[emp.id] || {};
            const ul = leaveMap[emp.id] || {};

            const incepRow = [idx + 1, emp.name, 'incep.'];
            const termRow  = ['', '', 'term.'];

            let totalHours1_15 = 0;
            let totalHoursWorked = 0;
            let totalOvertime = 0;
            // Leave type counters
            const leaveCounts = { Co: 0, Bo: 0, Am: 0, ST: 0, Cfp: 0, N: 0, Ef: 0 };

            for (let d = 1; d <= 31; d++) {
                if (d === 16) {
                    incepRow.push(totalHours1_15 > 0 ? totalHours1_15.toFixed(2) : '');
                    termRow.push('');
                }
                if (d > daysInMonth) {
                    incepRow.push('');
                    termRow.push('');
                    continue;
                }

                const dow = new Date(year, month - 1, d).getDay();
                const isWeekend = dow === 0 || dow === 6;
                const isHoliday = holidayDays.has(d);
                const leaveCode = ul[d];
                const hoursRec  = uh[d];

                if (isWeekend) {
                    incepRow.push('');
                    termRow.push('');
                } else if (isHoliday && !leaveCode) {
                    incepRow.push('S');
                    termRow.push('S');
                } else if (leaveCode) {
                    incepRow.push(leaveCode);
                    termRow.push(leaveCode);
                    // Count leave days
                    if (leaveCounts.hasOwnProperty(leaveCode)) leaveCounts[leaveCode]++;
                    if (d <= 15) totalHours1_15 += 0;
                } else if (hoursRec) {
                    const ci = fmtTime(hoursRec.check_in);
                    const co = fmtTime(hoursRec.check_out);
                    incepRow.push(ci);
                    termRow.push(co);
                    const h = parseFloat(hoursRec.hours_worked) || 0;
                    const ot = parseFloat(hoursRec.overtime_hours) || 0;
                    if (d <= 15) totalHours1_15 += h;
                    totalHoursWorked += h;
                    totalOvertime    += ot;
                } else {
                    // Workday with no data logged — leave blank
                    incepRow.push('');
                    termRow.push('');
                }
            }

            // Totals
            incepRow.push(
                totalHoursWorked > 0 ? totalHoursWorked.toFixed(2) : '',
                totalOvertime > 0    ? totalOvertime.toFixed(2)    : '',
                '', // ore de noapte — not tracked
                '', // total ore nelucrate
                '', // OI
                leaveCounts.Co  > 0 ? leaveCounts.Co  : '',
                leaveCounts.Bo  > 0 ? leaveCounts.Bo  : '',
                leaveCounts.Am  > 0 ? leaveCounts.Am  : '',
                leaveCounts.ST  > 0 ? leaveCounts.ST  : '',
                leaveCounts.Cfp > 0 ? leaveCounts.Cfp : '',
                '', // O
                leaveCounts.N   > 0 ? leaveCounts.N   : '',
                leaveCounts.Ef  > 0 ? leaveCounts.Ef  : ''
            );
            termRow.push(...new Array(13).fill(''));

            rows.push(incepRow);
            rows.push(termRow);
        });

        // Blank row
        rows.push([]);

        // ADMINISTRATOR row
        const adminRow = new Array(47).fill('');
        adminRow[18] = 'ADMINISTRATOR';
        rows.push(adminRow);

        rows.push([]);
        rows.push([]);

        // Legal text
        rows.push([`Extras din CM-art.119(1) Angajatorul are obligatia de a tine la locul de munca evidenta orelor de munca prestate zilnic de fiecare salariat, cu evidertierea orelor de incepere si de sfarsit ale programului de lucru.`]);

        // ── Create workbook ───────────────────────────────────────────────────────
        const ws = XLSX.utils.aoa_to_sheet(rows);

        // Set column widths
        ws['!cols'] = [
            { wch: 5 },  // Nr.crt
            { wch: 22 }, // Nume
            { wch: 7 },  // Data/Ora
            ...Array(32).fill({ wch: 6 }),  // days + subtotal
            { wch: 13 }, // total ore lucrate
            { wch: 10 }, // ore supliment
            { wch: 10 }, // ore de noapte
            { wch: 12 }, // total nelucrate
            ...Array(9).fill({ wch: 5 }),   // leave counters
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'FERO');

        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="EVIDENTA-${monthName}-${year}.xlsx"`);
        res.send(buf);

    } catch (e) {
        console.error('exportAttendance', e);
        res.status(500).json({ success: false, error: e.message });
    }
};

module.exports = {
    getLeaveTypes,
    getPublicHolidays, createPublicHoliday, updatePublicHoliday, deletePublicHoliday,
    getBalances, getMyBalance, updateBalance,
    getLeaves, getMyLeaves, createLeave, approveLeave, rejectLeave, cancelLeave,
    getHours, getMyHours, logHours, updateHours, deleteHours,
    getSummary, exportAttendance,
};
