/* ─────────────────────────────────────────────────────────────
 *  hr.js  –  HR Attendance & Leave frontend logic
 * ─────────────────────────────────────────────────────────────*/

const BASE_URL = `http://${location.hostname}:5000/api/hr`;

// ── State ──────────────────────────────────────────────────────
let currentYear  = new Date().getFullYear();
let currentMonth = new Date().getMonth() + 1; // 1-based
let currentUser  = null;   // {id, name, level, ...}
let allUsers     = [];
let leaveTypesCache  = [];
let leavesCache      = [];   // my leaves for current month
let hoursCache       = [];   // my hours for current month
let balancesCache    = [];   // all balances (supervisor)
let holidaysCache    = [];   // public holidays
let allLeavesCache   = [];   // all employee leaves (supervisor)
let allHoursCache    = [];   // all employee hours (supervisor)
let summaryCache     = null;
let _reviewAction    = null; // {action:'approve'|'reject', leaveId}
let _activeDayTab    = 'hours';
let _selectedDate    = null;
let _editHolidayId   = null;

// ── Date helper (local timezone, avoids UTC-shift bug) ──────────
function toLocalISO(d) {
    if (!d) return '';
    // JS Date objects: use local time components (avoids UTC-shift)
    if (d instanceof Date) {
        if (isNaN(d)) return '';
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }
    // DB date strings ("2026-06-01" or "2026-06-01T00:00:00.000Z"):
    // never parse as Date — just take the first 10 chars
    return String(d).substring(0, 10);
}

// ── Bootstrap ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    ensureAuthed();
    currentUser = getUser();
    if (!currentUser) return;

    document.getElementById('user-btn').textContent = currentUser.name || currentUser.username;

    // Show supervisor tabs
    if (currentUser.level >= 400) {
        document.getElementById('tab-btn-team').style.display   = '';
        document.getElementById('tab-btn-leaves').style.display = '';
        document.getElementById('export-btn').style.display     = '';
    }
    if (currentUser.level >= 400) {
        document.getElementById('tab-btn-settings').style.display = '';
    }
    if (currentUser.level >= 400) {
        document.getElementById('dh-user-group').style.display = '';
        document.getElementById('hm-user-group').style.display = '';
    }

    // Init month filter in team tab
    const teamMonth = document.getElementById('team-month');
    teamMonth.value = `${currentYear}-${String(currentMonth).padStart(2,'0')}`;

    // Populate year selects
    populateYearSelects();

    // Initial data load
    await loadAll();
    updateMonthLabel();
    renderCalendar();
});

// ── Auth header ───────────────────────────────────────────────
function authHeader() {
    const token = localStorage.getItem('cnc_auth_token');
    return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function apiFetch(path, opts = {}) {
    opts.headers = { ...authHeader(), ...(opts.headers || {}) };
    const res = await fetch(BASE_URL + path, opts);
    if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body.error || res.statusText);
    }
    return res.json();
}

// ── Load all data ─────────────────────────────────────────────
async function loadAll() {
    const monthStr = `${currentYear}-${String(currentMonth).padStart(2,'0')}`;

    try {
        const [ltRes, myHoursRes, myLeavesRes, myBalRes, holidaysRes] = await Promise.all([
            apiFetch('/leave-types'),
            apiFetch(`/hours/me?month=${monthStr}`),
            apiFetch(`/leaves/me?year=${currentYear}`),
            apiFetch('/balances/me'),
            apiFetch(`/public-holidays?year=${currentYear}`),
        ]);
        leaveTypesCache = ltRes.leaveTypes || [];
        hoursCache      = myHoursRes.hours || [];
        leavesCache     = myLeavesRes.leaves || [];
        holidaysCache   = holidaysRes.holidays || [];
        const bal = myBalRes.balance;
        // Update summary cards
        const totalH  = hoursCache.reduce((s, r) => s + parseFloat(r.hours_worked || 0), 0);
        const totalOT = hoursCache.reduce((s, r) => s + parseFloat(r.overtime_hours || 0), 0);
        document.getElementById('sum-hours').textContent      = totalH.toFixed(1);
        document.getElementById('sum-ot').textContent         = totalOT.toFixed(1);
        document.getElementById('sum-days-logged').textContent = hoursCache.length;
        if (bal) {
            const used      = parseFloat(bal.used_days || 0);
            const total     = parseFloat(bal.total_days || 20) + parseFloat(bal.carried_over || 0);
            const remaining = Math.max(0, total - used);
            document.getElementById('sum-leave-used').textContent      = used.toFixed(1);
            document.getElementById('sum-leave-remaining').textContent = remaining.toFixed(1);
        }
    } catch (e) {
        console.error('loadAll', e);
    }

    // Supervisor: load team data if needed
    if (currentUser.level >= 400) {
        try {
            const monthStr = document.getElementById('team-month').value || `${currentYear}-${String(currentMonth).padStart(2,'0')}`;
            const [summRes, usersRes, balRes, allLeavesRes, allHoursRes] = await Promise.all([
                apiFetch(`/summary?month=${monthStr}`),
                fetch(`http://${location.hostname}:5000/api/auth/users`, { headers: authHeader() }).then(r => r.json()),
                apiFetch(`/balances?year=${currentYear}`),
                apiFetch(`/leaves?year=${currentYear}`),
                apiFetch(`/hours?month=${monthStr}`),
            ]);
            summaryCache   = summRes.summary || [];
            allUsers       = (usersRes.users || []).filter(u => u.level >= 100);
            balancesCache  = balRes.balances || [];
            allLeavesCache = allLeavesRes.leaves || [];
            allHoursCache  = allHoursRes.hours || [];

            // Populate employee selects
            populateUserSelects();
        } catch (e) {
            console.error('loadSupervisorData', e);
        }
    }

    // Populate leave type selects
    populateLeaveTypeSelects();
}

// ── UI Helpers ─────────────────────────────────────────────────
function updateMonthLabel() {
    const d = new Date(currentYear, currentMonth - 1, 1);
    document.getElementById('month-label').textContent =
        d.toLocaleString('default', { month: 'long', year: 'numeric' });
}

function populateYearSelects() {
    const yr = new Date().getFullYear();
    const years = [yr - 1, yr, yr + 1];
    ['leave-filter-year', 'holiday-year-filter'].forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        sel.innerHTML = years.map(y => `<option value="${y}"${y === yr ? ' selected' : ''}>${y}</option>`).join('');
    });
}

function populateLeaveTypeSelects() {
    const opts = leaveTypesCache.map(lt =>
        `<option value="${lt.id}">${lt.name}</option>`
    ).join('');
    ['dl-type', 'lm-type'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = opts;
    });
}

function populateUserSelects() {
    const opts = `<option value="">— Me —</option>` +
        allUsers.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
    ['dh-user', 'hm-user'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = opts;
    });
    const filterOpts = `<option value="">All Employees</option>` +
        allUsers.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
    const filterSel = document.getElementById('leave-filter-user');
    if (filterSel) filterSel.innerHTML = filterOpts;
}

function prevMonth() {
    currentMonth--;
    if (currentMonth < 1) { currentMonth = 12; currentYear--; }
    updateMonthLabel();
    loadAll().then(() => renderCalendar());
}
function nextMonth() {
    currentMonth++;
    if (currentMonth > 12) { currentMonth = 1; currentYear++; }
    updateMonthLabel();
    loadAll().then(() => renderCalendar());
}

function switchHrTab(name) {
    document.querySelectorAll('.hr-tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.hr-tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-' + name).classList.add('active');
    document.getElementById('tab-btn-' + name).classList.add('active');

    if (name === 'team')     renderTeamOverview();
    if (name === 'leaves')   renderLeaveRequests();
    if (name === 'settings') { renderSettingsBalances(); renderHolidays(); }
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}
function openLeaveModal() {
    const today = toLocalISO(new Date());
    document.getElementById('lm-from').value = today;
    document.getElementById('lm-to').value   = today;
    document.getElementById('lm-notes').value = '';
    document.getElementById('leave-modal').classList.add('active');
}
function openHoursModal() {
    const today = toLocalISO(new Date());
    document.getElementById('hm-date').value     = today;
    document.getElementById('hm-hours').value    = 8;
    document.getElementById('hm-ot').value       = 0;
    document.getElementById('hm-checkin').value  = '';
    document.getElementById('hm-checkout').value = '';
    document.getElementById('hm-notes').value    = '';
    document.getElementById('hours-modal').classList.add('active');
}
function openHolidayModal() {
    _editHolidayId = null;
    document.getElementById('ph-modal-title').textContent = 'Add Public Holiday';
    document.getElementById('ph-save-btn').textContent = 'Add';
    document.getElementById('ph-date').value = '';
    document.getElementById('ph-name').value = '';
    document.getElementById('holiday-modal').classList.add('active');
}

function openHolidayEdit(id, date, name) {
    _editHolidayId = id;
    document.getElementById('ph-modal-title').textContent = 'Edit Public Holiday';
    document.getElementById('ph-save-btn').textContent = 'Save';
    document.getElementById('ph-date').value = toLocalISO(date);
    document.getElementById('ph-name').value = name;
    document.getElementById('holiday-modal').classList.add('active');
}

// ── Calendar rendering ─────────────────────────────────────────
function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    // Remove day cells (keep 7 header cells)
    while (grid.children.length > 7) grid.removeChild(grid.lastChild);

    const firstDay = new Date(currentYear, currentMonth - 1, 1);
    const lastDay  = new Date(currentYear, currentMonth, 0);
    const today    = toLocalISO(new Date());

    // Build lookup maps
    const hoursMap    = {};
    hoursCache.forEach(h => { hoursMap[toLocalISO(h.work_date)] = h; });

    // For supervisors: total team hours per day
    const teamHoursMap = {};
    if (currentUser.level >= 400 && allHoursCache.length > 0) {
        allHoursCache.forEach(h => {
            const iso = toLocalISO(h.work_date);
            teamHoursMap[iso] = (teamHoursMap[iso] || 0) + parseFloat(h.hours_worked || 0);
        });
    }

    const leavesMap   = {};
    leavesCache.filter(l => l.status === 'approved').forEach(l => {
        const from = new Date(toLocalISO(l.date_from) + 'T00:00:00');
        const to   = new Date(toLocalISO(l.date_to)   + 'T00:00:00');
        const cur  = new Date(from);
        while (cur <= to) {
            leavesMap[toLocalISO(cur)] = l;
            cur.setDate(cur.getDate() + 1);
        }
    });

    const holidayMap  = {};
    holidaysCache.forEach(h => { holidayMap[toLocalISO(h.holiday_date)] = h.name; });

    // Find Monday before first day (ISO week starts Monday)
    let dow = firstDay.getDay(); // 0=Sun
    dow = dow === 0 ? 6 : dow - 1; // Convert to Mon=0
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - dow);

    // Render 6 weeks
    for (let i = 0; i < 42; i++) {
        const cur  = new Date(startDate);
        cur.setDate(startDate.getDate() + i);
        const iso  = toLocalISO(cur);
        const isCurrentMonth = cur.getMonth() + 1 === currentMonth;
        const isToday   = iso === today;
        const isWeekend = cur.getDay() === 0 || cur.getDay() === 6;
        const isHoliday = !!holidayMap[iso];
        const hoursRec  = hoursMap[iso];
        const leaveRec  = leavesMap[iso];

        const cell = document.createElement('div');
        cell.className = 'cal-day' +
            (isToday ? ' today' : '') +
            (!isCurrentMonth ? ' other-month' : '') +
            (isWeekend ? ' weekend' : '') +
            (isHoliday ? ' holiday' : '');

        let inner = `<div class="cal-day-num">${cur.getDate()}</div>`;
        if (isHoliday) inner += `<div class="cal-chip chip-holiday" title="${holidayMap[iso]}">🏛 Holiday</div>`;
        if (hoursRec)  inner += `<div class="cal-chip chip-hours">⏱ ${parseFloat(hoursRec.hours_worked).toFixed(1)}h</div>`;
        // Supervisor: show total team hours for the day
        if (currentUser.level >= 400 && teamHoursMap[iso] > 0) {
            inner += `<div class="cal-chip" style="background:#dbeafe;color:#1d4ed8;font-size:0.7rem;" title="Total team hours">👥 ${teamHoursMap[iso].toFixed(1)}h</div>`;
        }
        if (leaveRec) {
            const lt = leaveTypesCache.find(t => t.id === leaveRec.leave_type_id);
            const color = lt ? lt.color : '#667eea';
            inner += `<div class="cal-chip chip-leave" style="background:${color}80;color:${color};" title="${lt ? lt.name : 'Leave'}">🏖 ${lt ? lt.name.split(' ')[0] : 'Leave'}</div>`;
        }

        cell.innerHTML = inner;
        if (isCurrentMonth && !isWeekend) {
            cell.addEventListener('click', () => openDayModal(iso, hoursRec, leaveRec));
        }
        grid.appendChild(cell);
    }
}

// ── Day modal ─────────────────────────────────────────────────
function openDayModal(dateStr, hoursRec, leaveRec) {
    _selectedDate = dateStr;
    _activeDayTab = 'hours';
    const d = new Date(dateStr + 'T00:00:00');
    document.getElementById('day-modal-title').textContent =
        d.toLocaleDateString('default', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // Pre-fill hours (own record)
    document.getElementById('dh-hours').value    = hoursRec ? parseFloat(hoursRec.hours_worked) : 8;
    document.getElementById('dh-ot').value       = hoursRec ? parseFloat(hoursRec.overtime_hours) : 0;
    document.getElementById('dh-checkin').value  = hoursRec?.check_in  || '';
    document.getElementById('dh-checkout').value = hoursRec?.check_out || '';
    document.getElementById('dh-notes').value    = hoursRec?.notes || '';

    // Pre-fill leave date range
    document.getElementById('dl-from').value = dateStr;
    document.getElementById('dl-to').value   = dateStr;
    document.getElementById('dl-notes').value = '';

    // Supervisor: show team table, hide simple form's Save button
    if (currentUser.level >= 400 && allUsers.length > 0) {
        document.getElementById('day-team-table-wrap').style.display = '';
        document.getElementById('day-simple-form').style.display = 'none';
        document.getElementById('day-modal-save').style.display = 'none';
        renderDayTeamTable(dateStr);
    } else {
        document.getElementById('day-team-table-wrap').style.display = 'none';
        document.getElementById('day-simple-form').style.display = '';
        document.getElementById('day-modal-save').style.display = '';
    }

    switchDayTab('hours');
    document.getElementById('day-modal').classList.add('active');
}

function renderDayTeamTable(dateStr) {
    const tbody = document.getElementById('day-team-tbody');
    // Build lookup from allHoursCache for this date
    const dayMap = {};
    allHoursCache.forEach(h => { if (toLocalISO(h.work_date) === dateStr) dayMap[h.user_id] = h; });

    tbody.innerHTML = allUsers
        .filter(u => {
            const bal = balancesCache.find(b => b.user_id === u.id);
            return bal ? bal.include_in_attendance !== false : true;
        })
        .map(u => {
            const rec = dayMap[u.id] || {};
            const hasRecord = !!dayMap[u.id];
            return `<tr id="day-row-${u.id}">
                <td style="padding:4px 8px;white-space:nowrap;">${escapeHtml(u.name)}</td>
                <td style="padding:4px 6px;"><input type="text" class="day-ci" data-uid="${u.id}" value="${rec.check_in || ''}" placeholder="HH:MM" maxlength="5" oninput="formatTimeInput(this);autoFillHours(${u.id})" style="width:62px;font-size:0.8rem;padding:2px 4px;border:1px solid #cbd5e1;border-radius:4px;text-align:center;"></td>
                <td style="padding:4px 6px;"><input type="text" class="day-co" data-uid="${u.id}" value="${rec.check_out || ''}" placeholder="HH:MM" maxlength="5" oninput="formatTimeInput(this);autoFillHours(${u.id})" style="width:62px;font-size:0.8rem;padding:2px 4px;border:1px solid #cbd5e1;border-radius:4px;text-align:center;"></td>
                <td style="padding:4px 6px;"><input type="number" class="day-hw" data-uid="${u.id}" value="${rec.hours_worked != null && rec.hours_worked !== '' ? rec.hours_worked : ''}" min="0" max="24" step="0.5" placeholder="8" style="width:52px;font-size:0.8rem;padding:2px 4px;border:1px solid #cbd5e1;border-radius:4px;"></td>
                <td style="padding:4px 6px;"><input type="number" class="day-ot" data-uid="${u.id}" value="${rec.overtime_hours || ''}" min="0" max="24" step="0.5" placeholder="0" style="width:52px;font-size:0.8rem;padding:2px 4px;border:1px solid #cbd5e1;border-radius:4px;"></td>
                <td style="padding:4px 6px;text-align:center;">
                  <button onclick="saveTeamRow(${u.id},'${dateStr}',${hasRecord ? `'${rec.id}'` : 'null'})"
                    style="padding:3px 10px;font-size:0.78rem;background:#2563eb;color:#fff;border:none;border-radius:4px;cursor:pointer;">
                    ${hasRecord ? 'Update' : 'Save'}
                  </button>
                </td>
            </tr>`;
        }).join('');
}

// Format text input to HH:MM as user types (24h)
function formatTimeInput(el) {
    let v = el.value.replace(/[^0-9]/g, '');
    if (v.length > 4) v = v.slice(0, 4);
    if (v.length >= 3) v = v.slice(0, 2) + ':' + v.slice(2);
    el.value = v;
}

// Auto-fill hours from check-in/out minus 30-min lunch break; cap at 8h, rest goes to OT
function autoFillHours(uid) {
    const ci = document.querySelector(`.day-ci[data-uid="${uid}"]`)?.value;
    const co = document.querySelector(`.day-co[data-uid="${uid}"]`)?.value;
    const hwInput = document.querySelector(`.day-hw[data-uid="${uid}"]`);
    const otInput = document.querySelector(`.day-ot[data-uid="${uid}"]`);
    if (!ci || !co || !hwInput) return;
    const [ch, cm] = ci.split(':').map(Number);
    const [oh, om] = co.split(':').map(Number);
    const mins = (oh * 60 + om) - (ch * 60 + cm) - 30; // subtract 30 min lunch
    const total = mins > 0 ? Math.round(mins / 6) / 10 : 0;
    const regular = Math.min(total, 8);
    const ot = Math.max(0, Math.round((total - regular) * 10) / 10);
    hwInput.value = regular;
    if (otInput) otInput.value = ot || '';
}

async function saveTeamRow(userId, dateStr, existingId) {
    const ci = document.querySelector(`.day-ci[data-uid="${userId}"]`).value;
    const co = document.querySelector(`.day-co[data-uid="${userId}"]`).value;
    const hwRaw = document.querySelector(`.day-hw[data-uid="${userId}"]`).value;
    let ot = parseFloat(document.querySelector(`.day-ot[data-uid="${userId}"]`).value) || 0;

    // Auto-calculate hours from check-in/out (minus 30-min lunch, cap 8h, rest = OT) when hours field is empty
    let hw = parseFloat(hwRaw);
    if ((isNaN(hw) || hwRaw === '') && ci && co) {
        const [ch, cm] = ci.split(':').map(Number);
        const [oh, om] = co.split(':').map(Number);
        const mins = (oh * 60 + om) - (ch * 60 + cm) - 30;
        const total = mins > 0 ? Math.round(mins / 6) / 10 : 0;
        hw = Math.min(total, 8);
        if (!ot) ot = Math.max(0, Math.round((total - hw) * 10) / 10);
    }
    if (isNaN(hw)) hw = 0;

    try {
        const res = await apiFetch('/hours', {
            method: 'POST',
            body: JSON.stringify({
                work_date: dateStr, hours_worked: hw, overtime_hours: ot,
                check_in: ci || null, check_out: co || null,
                user_id: userId,
            })
        });
        // Update allHoursCache directly from the response — avoids team-month mismatch
        if (res.record) {
            const idx = allHoursCache.findIndex(
                h => parseInt(h.user_id) === parseInt(userId) && toLocalISO(h.work_date) === dateStr
            );
            if (idx >= 0) allHoursCache[idx] = res.record;
            else allHoursCache.push(res.record);
        }
        renderDayTeamTable(dateStr);
        renderCalendar();
    } catch (e) {
        alert('Error: ' + e.message);
    }
}

function switchDayTab(tab) {
    _activeDayTab = tab;
    document.getElementById('day-hours-form').style.display = tab === 'hours' ? '' : 'none';
    document.getElementById('day-leave-form').style.display = tab === 'leave' ? '' : 'none';
    document.getElementById('day-tab-hours').classList.toggle('active', tab === 'hours');
    document.getElementById('day-tab-leave').classList.toggle('active', tab === 'leave');
}

async function saveDayModal() {
    if (_activeDayTab === 'hours') {
        const userId = document.getElementById('dh-user').value || null;
        try {
            await apiFetch('/hours', {
                method: 'POST',
                body: JSON.stringify({
                    work_date:      _selectedDate,
                    hours_worked:   parseFloat(document.getElementById('dh-hours').value) || 0,
                    overtime_hours: parseFloat(document.getElementById('dh-ot').value) || 0,
                    check_in:  document.getElementById('dh-checkin').value  || null,
                    check_out: document.getElementById('dh-checkout').value || null,
                    notes:     document.getElementById('dh-notes').value    || null,
                    user_id:   userId ? parseInt(userId) : undefined,
                })
            });
            closeModal('day-modal');
            await loadAll();
            renderCalendar();
        } catch (e) {
            alert('Error: ' + e.message);
        }
    } else {
        await submitLeaveFromForm(
            document.getElementById('dl-type').value,
            document.getElementById('dl-from').value,
            document.getElementById('dl-to').value,
            document.getElementById('dl-notes').value,
            'day-modal'
        );
    }
}

// ── Leave submit helpers ───────────────────────────────────────
async function submitLeaveFromForm(typeId, from, to, notes, modalId) {
    try {
        await apiFetch('/leaves', {
            method: 'POST',
            body: JSON.stringify({ leave_type_id: parseInt(typeId), date_from: from, date_to: to, notes: notes || null })
        });
        closeModal(modalId);
        await loadAll();
        renderCalendar();
    } catch (e) {
        alert('Error: ' + e.message);
    }
}

async function submitLeaveModal() {
    await submitLeaveFromForm(
        document.getElementById('lm-type').value,
        document.getElementById('lm-from').value,
        document.getElementById('lm-to').value,
        document.getElementById('lm-notes').value,
        'leave-modal'
    );
}

async function submitHoursModal() {
    const userId = document.getElementById('hm-user').value || null;
    try {
        await apiFetch('/hours', {
            method: 'POST',
            body: JSON.stringify({
                work_date:      document.getElementById('hm-date').value,
                hours_worked:   parseFloat(document.getElementById('hm-hours').value) || 0,
                overtime_hours: parseFloat(document.getElementById('hm-ot').value) || 0,
                check_in:  document.getElementById('hm-checkin').value  || null,
                check_out: document.getElementById('hm-checkout').value || null,
                notes:     document.getElementById('hm-notes').value    || null,
                user_id:   userId ? parseInt(userId) : undefined,
            })
        });
        closeModal('hours-modal');
        await loadAll();
        renderCalendar();
    } catch (e) {
        alert('Error: ' + e.message);
    }
}

// ── Team Overview ─────────────────────────────────────────────
async function renderTeamOverview() {
    const monthStr = document.getElementById('team-month').value;
    try {
        const res = await apiFetch(`/summary?month=${monthStr}`);
        const tbody = document.getElementById('team-tbody');
        const rows  = res.summary || [];
        if (!rows.length) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:2rem;color:#94a3b8;">No data</td></tr>`;
            return;
        }
        tbody.innerHTML = rows.map(u => {
            const annual  = balancesCache.find(b => b.user_id === u.id) || {};
            const total   = parseFloat(annual.total_days || 20) + parseFloat(annual.carried_over || 0);
            const used    = parseFloat(annual.used_days || 0);
            const remaining = Math.max(0, total - used);
            const sick    = parseFloat((u.leave || {}).sick || 0);
            const otherLeave = Object.entries(u.leave || {})
                .filter(([k]) => k !== 'sick')
                .reduce((s, [, v]) => s + v, 0);
            return `<tr>
                <td><strong>${escapeHtml(u.name)}</strong><br><small style="color:#94a3b8;">${u.employee_id || ''}</small></td>
                <td>${u.days_logged}</td>
                <td>${u.total_hours.toFixed(1)}</td>
                <td>${u.total_overtime.toFixed(1)}</td>
                <td>${used.toFixed(1)} / ${total.toFixed(1)}</td>
                <td>${remaining.toFixed(1)}</td>
                <td>${sick.toFixed(1)}</td>
                <td>${otherLeave.toFixed(1)}</td>
            </tr>`;
        }).join('');
    } catch (e) {
        console.error('renderTeamOverview', e);
    }
}

// ── Leave Requests ─────────────────────────────────────────────
async function renderLeaveRequests() {
    const userId = document.getElementById('leave-filter-user').value;
    const year   = document.getElementById('leave-filter-year').value;

    let qs = `?year=${year}`;
    if (userId) qs += `&user_id=${userId}`;

    try {
        const res = await apiFetch('/leaves' + qs);
        const all = res.leaves || [];
        const pending  = all.filter(l => l.status === 'pending');
        const history  = all.filter(l => l.status !== 'pending');

        const pendingHtml = pending.length === 0
            ? `<tr><td colspan="8" style="text-align:center;padding:2rem;color:#94a3b8;">No pending requests</td></tr>`
            : pending.map(l => `<tr>
                <td>${escapeHtml(l.employee_name)}</td>
                <td><span class="leave-badge" style="background:${l.color}20;color:${l.color};">${escapeHtml(l.leave_type_name)}</span></td>
                <td>${fmtDate(l.date_from)}</td>
                <td>${fmtDate(l.date_to)}</td>
                <td>${parseFloat(l.days_count).toFixed(1)}</td>
                <td>${escapeHtml(l.notes || '—')}</td>
                <td>${fmtDate(l.created_at)}</td>
                <td>
                  <button class="btn-success btn-sm" onclick="openReview(${l.id},'approve')">✓ Approve</button>
                  <button class="btn-danger btn-sm" style="margin-left:4px;" onclick="openReview(${l.id},'reject')">✗ Reject</button>
                </td>
            </tr>`).join('');

        const historyHtml = history.length === 0
            ? `<tr><td colspan="8" style="text-align:center;padding:2rem;color:#94a3b8;">No history</td></tr>`
            : history.map(l => `<tr>
                <td>${escapeHtml(l.employee_name)}</td>
                <td><span class="leave-badge" style="background:${l.color}20;color:${l.color};">${escapeHtml(l.leave_type_name)}</span></td>
                <td>${fmtDate(l.date_from)}</td>
                <td>${fmtDate(l.date_to)}</td>
                <td>${parseFloat(l.days_count).toFixed(1)}</td>
                <td><span class="leave-badge status-${l.status}">${l.status}</span></td>
                <td>${escapeHtml(l.reviewed_by_name || '—')}</td>
                <td>${escapeHtml(l.review_notes || '—')}</td>
            </tr>`).join('');

        document.getElementById('leave-pending-tbody').innerHTML  = pendingHtml;
        document.getElementById('leave-history-tbody').innerHTML  = historyHtml;
    } catch (e) {
        console.error('renderLeaveRequests', e);
    }
}

function openReview(leaveId, action) {
    _reviewAction = { leaveId, action };
    document.getElementById('review-modal-title').textContent = action === 'approve' ? 'Approve Leave' : 'Reject Leave';
    const btn = document.getElementById('rm-confirm-btn');
    btn.className = action === 'approve' ? 'btn-success' : 'btn-danger';
    btn.textContent = action === 'approve' ? 'Approve' : 'Reject';
    document.getElementById('rm-notes').value = '';
    document.getElementById('review-modal').classList.add('active');
}

async function confirmReview() {
    if (!_reviewAction) return;
    const { leaveId, action } = _reviewAction;
    const notes = document.getElementById('rm-notes').value;
    try {
        await apiFetch(`/leaves/${leaveId}/${action}`, {
            method: 'PUT',
            body: JSON.stringify({ review_notes: notes || null })
        });
        closeModal('review-modal');
        await loadAll();
        renderLeaveRequests();
    } catch (e) {
        alert('Error: ' + e.message);
    }
}

// ── Settings: Balances ─────────────────────────────────────────
async function renderSettingsBalances() {
    try {
        const yr = document.getElementById('leave-filter-year')?.value || currentYear;
        const res = await apiFetch(`/balances?year=${yr}`);
        balancesCache = res.balances || [];
        const tbody = document.getElementById('settings-balance-tbody');
        if (!balancesCache.length) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:2rem;color:#94a3b8;">No data</td></tr>`;
            return;
        }
        tbody.innerHTML = balancesCache.map(b => {
            const total = parseFloat(b.total_days) + parseFloat(b.carried_over || 0);
            const remaining = Math.max(0, total - parseFloat(b.used_days));
            const pct = total > 0 ? (parseFloat(b.used_days) / total) * 100 : 0;
            const cls = pct < 50 ? 'bal-ok' : pct < 80 ? 'bal-low' : 'bal-over';
            const inAtt = b.include_in_attendance !== false;
            return `<tr>
                <td>${escapeHtml(b.employee_name)}</td>
                <td>${b.year}</td>
                <td>${parseFloat(b.total_days).toFixed(1)}</td>
                <td>
                  <div class="balance-bar-wrap">
                    <div class="balance-bar"><div class="balance-bar-fill ${cls}" style="width:${Math.min(100, pct).toFixed(0)}%"></div></div>
                    ${parseFloat(b.used_days).toFixed(1)}
                  </div>
                </td>
                <td>${parseFloat(b.carried_over || 0).toFixed(1)}</td>
                <td>${remaining.toFixed(1)}</td>
                <td style="text-align:center;">
                  <button class="btn-icon" title="${inAtt ? 'Included — click to exclude' : 'Excluded — click to include'}"
                    onclick="toggleAttendance(${b.user_id}, ${inAtt})"
                    style="font-size:1.1rem;">${inAtt ? '✅' : '🚫'}</button>
                </td>
                <td>
                  <button class="btn-icon" title="Edit" onclick="openBalanceEdit(${b.user_id},${b.year},'${escapeHtml(b.employee_name)}',${b.total_days},${b.carried_over || 0})">✏️</button>
                </td>
            </tr>`;
        }).join('');
    } catch (e) {
        console.error('renderSettingsBalances', e);
    }
}

function openBalanceEdit(userId, year, name, total, carried) {
    document.getElementById('bm-user-id').value = userId;
    document.getElementById('bm-year').value    = year;
    document.getElementById('bm-employee-label').textContent = `Employee: ${name} (${year})`;
    document.getElementById('bm-total').value   = total;
    document.getElementById('bm-carried').value = carried;
    document.getElementById('balance-modal').classList.add('active');
}

async function saveBalance() {
    const userId  = document.getElementById('bm-user-id').value;
    const year    = document.getElementById('bm-year').value;
    const total   = parseFloat(document.getElementById('bm-total').value);
    const carried = parseFloat(document.getElementById('bm-carried').value);
    try {
        await apiFetch(`/balances/${userId}`, {
            method: 'PUT',
            body: JSON.stringify({ year: parseInt(year), total_days: total, carried_over: carried })
        });
        closeModal('balance-modal');
        renderSettingsBalances();
    } catch (e) {
        alert('Error: ' + e.message);
    }
}

async function toggleAttendance(userId, currentValue) {
    try {
        await apiFetch(`/employees/${userId}`, {
            method: 'PUT',
            body: JSON.stringify({ include_in_attendance: !currentValue })
        });
        renderSettingsBalances();
    } catch (e) {
        alert('Error: ' + e.message);
    }
}

// ── Settings: Holidays ─────────────────────────────────────────
async function renderHolidays() {
    const yr = document.getElementById('holiday-year-filter').value || currentYear;
    try {
        const res = await apiFetch(`/public-holidays?year=${yr}`);
        holidaysCache = res.holidays || [];
        const tbody = document.getElementById('holidays-tbody');
        if (!holidaysCache.length) {
            tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:2rem;color:#94a3b8;">No holidays</td></tr>`;
            return;
        }
        tbody.innerHTML = holidaysCache.map(h => `<tr>
            <td>${fmtDate(h.holiday_date)}</td>
            <td>${escapeHtml(h.name)}</td>
            <td style="white-space:nowrap;">
              <button class="btn-icon" onclick="openHolidayEdit(${h.id},'${h.holiday_date}','${escapeHtml(h.name).replace(/'/g, '&#39;')}')" title="Edit">✏️</button>
              <button class="btn-icon" onclick="deleteHoliday(${h.id})" title="Delete" style="color:#dc2626;">🗑</button>
            </td>
        </tr>`).join('');
    } catch (e) {
        console.error('renderHolidays', e);
    }
}

async function saveHoliday() {
    const date = document.getElementById('ph-date').value;
    const name = document.getElementById('ph-name').value.trim();
    if (!date || !name) { alert('Date and name are required'); return; }
    try {
        if (_editHolidayId) {
            await apiFetch(`/public-holidays/${_editHolidayId}`, {
                method: 'PUT',
                body: JSON.stringify({ holiday_date: date, name })
            });
        } else {
            await apiFetch('/public-holidays', {
                method: 'POST',
                body: JSON.stringify({ holiday_date: date, name })
            });
        }
        closeModal('holiday-modal');
        renderHolidays();
    } catch (e) {
        alert('Error: ' + e.message);
    }
}

async function deleteHoliday(id) {
    if (!confirm('Delete this holiday?')) return;
    try {
        await apiFetch(`/public-holidays/${id}`, { method: 'DELETE' });
        renderHolidays();
    } catch (e) {
        alert('Error: ' + e.message);
    }
}

// ── Utility ───────────────────────────────────────────────────
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function fmtDate(val) {
    if (!val) return '—';
    const d = new Date(val);
    if (isNaN(d)) return val;
    return d.toLocaleDateString('default', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ── Export attendance sheet ────────────────────────────────────
async function exportAttendanceSheet() {
    const monthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    const token = localStorage.getItem('cnc_auth_token');
    try {
        const res = await fetch(`${BASE_URL}/export?month=${monthStr}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            alert('Export failed: ' + (err.error || res.statusText));
            return;
        }
        const blob = await res.blob();
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `EVIDENTA-${monthStr}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
    } catch (e) {
        alert('Export error: ' + e.message);
    }
}
