-- Migration 007: HR Attendance & Leave Tracking
-- Creates leave_types, employee_leave_balance, leave_requests, work_hours

-- 1. Leave type reference table
CREATE TABLE IF NOT EXISTS leave_types (
    id               SERIAL PRIMARY KEY,
    code             VARCHAR(20) NOT NULL UNIQUE,
    name             VARCHAR(100) NOT NULL,
    color            VARCHAR(7)  NOT NULL DEFAULT '#6B7280',
    deducts_balance  BOOLEAN NOT NULL DEFAULT false,
    requires_approval BOOLEAN NOT NULL DEFAULT true
);

-- Seed leave types
INSERT INTO leave_types (code, name, color, deducts_balance, requires_approval) VALUES
    ('annual',   'Annual Leave',      '#10B981', true,  true),
    ('sick',     'Sick Leave',        '#F59E0B', false, false),
    ('personal', 'Personal Day',      '#8B5CF6', true,  true),
    ('unpaid',   'Unpaid Leave',      '#6B7280', false, true),
    ('holiday',  'Public Holiday',    '#3B82F6', false, false),
    ('training', 'Training / Course', '#06B6D4', false, true)
ON CONFLICT (code) DO NOTHING;

-- 2. Annual leave balance per employee per year
CREATE TABLE IF NOT EXISTS employee_leave_balance (
    id            SERIAL PRIMARY KEY,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    year          SMALLINT NOT NULL,
    total_days    DECIMAL(4,1) NOT NULL DEFAULT 20,
    used_days     DECIMAL(4,1) NOT NULL DEFAULT 0,
    carried_over  DECIMAL(4,1) NOT NULL DEFAULT 0,
    UNIQUE(user_id, year)
);

CREATE INDEX IF NOT EXISTS idx_leave_balance_user_year ON employee_leave_balance(user_id, year);

-- 3. Leave requests
CREATE TABLE IF NOT EXISTS leave_requests (
    id            SERIAL PRIMARY KEY,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    leave_type_id INTEGER NOT NULL REFERENCES leave_types(id),
    date_from     DATE NOT NULL,
    date_to       DATE NOT NULL,
    days_count    DECIMAL(4,1) NOT NULL DEFAULT 1,
    status        VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','rejected','cancelled')),
    notes         TEXT,
    reviewed_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at   TIMESTAMP,
    review_notes  TEXT,
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_user    ON leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status  ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_dates   ON leave_requests(date_from, date_to);

-- 4. Daily work hours log
CREATE TABLE IF NOT EXISTS work_hours (
    id             SERIAL PRIMARY KEY,
    user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    work_date      DATE NOT NULL,
    hours_worked   DECIMAL(4,2) NOT NULL DEFAULT 0,
    overtime_hours DECIMAL(4,2) NOT NULL DEFAULT 0,
    check_in       TIME,
    check_out      TIME,
    notes          TEXT,
    entered_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, work_date)
);

CREATE INDEX IF NOT EXISTS idx_work_hours_user_date ON work_hours(user_id, work_date);

-- 5. Seed 2026 public holidays for Romania into leave_requests as approved entries
-- (these will be created per-user at runtime when initializing leave balances)
-- We store them in a separate holidays table for reference
CREATE TABLE IF NOT EXISTS public_holidays (
    id       SERIAL PRIMARY KEY,
    year     SMALLINT NOT NULL,
    holiday_date DATE NOT NULL UNIQUE,
    name     VARCHAR(100) NOT NULL
);

INSERT INTO public_holidays (year, holiday_date, name) VALUES
    (2026, '2026-01-01', 'New Year''s Day'),
    (2026, '2026-01-02', 'New Year''s Day (day 2)'),
    (2026, '2026-01-24', 'Unification Day'),
    (2026, '2026-04-10', 'Good Friday'),
    (2026, '2026-04-13', 'Easter Monday'),
    (2026, '2026-05-01', 'Labour Day'),
    (2026, '2026-06-01', 'Children''s Day'),
    (2026, '2026-06-02', 'Whit Monday'),
    (2026, '2026-08-15', 'Assumption of Mary'),
    (2026, '2026-11-30', 'Saint Andrew''s Day'),
    (2026, '2026-12-01', 'National Day'),
    (2026, '2026-12-25', 'Christmas'),
    (2026, '2026-12-26', 'Christmas (day 2)')
ON CONFLICT (holiday_date) DO NOTHING;
