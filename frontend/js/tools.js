// tools.js — CNC Tool Storage Manager frontend logic

const BASE = () => `${API_BASE_URL || `http://${location.hostname}:5000/api`}/tools`;
const SUPPLIERS_URL = () => `http://${location.hostname}:5000/api/suppliers`;

// ── State ────────────────────────────────────────────────────
let currentToolId   = null;  // tool open in detail modal
let editingToolId   = null;  // null = add, number = edit
let stockDirection  = 'in';  // 'in' or 'out'
let suppliersCache  = [];
let categoriesCache = [];
let brandsCache     = [];
let cabinetsCache   = [];
let appTypesCache   = [];
let usersCache      = [];
let searchDebounce  = null;

// ── Init ─────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
    ensureAuthed();
    const user = getUser();
    if (user) document.getElementById('user-btn').textContent = user.name || user.employeeId;

    // Hide add/edit controls for operators below supervisor
    if (user && user.level < 400) {
        const btn = document.getElementById('btn-add-tool');
        if (btn) btn.style.display = 'none';
    }

    loadStats();
    loadInventory();
    loadCategories();
    loadBrands();
    loadCabinets();
    loadSuppliers();
    loadAppTypes();
    initPriceDate();
});

// ── Tab switching ─────────────────────────────────────────────
function switchTab(name) {
    document.querySelectorAll('.tool-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tool-tab-content').forEach(c => c.classList.remove('active'));
    event.currentTarget.classList.add('active');
    document.getElementById(`tab-${name}`).classList.add('active');

    if (name === 'low-stock') loadLowStock();
    if (name === 'brands')    renderBrandsTable();
    if (name === 'cabinets')  renderCabinetsTable();
    if (name === 'checkouts') loadCheckouts();
    if (name === 'application-types') renderAppTypesTable();
}

// ── Stats ────────────────────────────────────────────────────
async function loadStats() {
    try {
        const res = await apiGet(`${BASE()}/stats`);
        if (!res.success) return;
        const s = res.stats;
        document.getElementById('stat-total').textContent     = s.total_active || 0;
        document.getElementById('stat-available').textContent = s.available || 0;
        document.getElementById('stat-in-use').textContent    = s.in_use || 0;
        document.getElementById('stat-low').textContent       = s.low_stock || 0;
        document.getElementById('stat-out').textContent       = s.out_of_stock || 0;
        const val = parseFloat(s.total_value || 0).toLocaleString('ro-RO', { minimumFractionDigits: 2 });
        document.getElementById('stat-value').textContent     = val + ' RON';
    } catch (e) { console.error('loadStats', e); }
}

// ── Inventory ────────────────────────────────────────────────
async function loadInventory() {
    const search  = document.getElementById('search-input')?.value.trim();
    const cat     = document.getElementById('filter-category')?.value;
    const brand   = document.getElementById('filter-brand')?.value;
    const status  = document.getElementById('filter-status')?.value;

    const params = new URLSearchParams({ limit: 200 });
    if (search)  params.set('search', search);
    if (cat)     params.set('category_id', cat);
    if (brand)   params.set('brand_id', brand);
    if (status)  params.set('status', status);

    const tbody = document.getElementById('tools-tbody');
    tbody.innerHTML = `<tr><td colspan="13" style="text-align:center;padding:2rem;color:#94a3b8;">Loading…</td></tr>`;

    try {
        const res = await apiGet(`${BASE()}?${params}`);
        if (!res.success) throw new Error(res.error);
        renderInventoryTable(res.tools, res.total);
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="13" style="text-align:center;color:#dc2626;">Error: ${e.message}</td></tr>`;
    }
}

function debounceLoad() {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(loadInventory, 320);
}

function renderInventoryTable(tools, total) {
    const tbody = document.getElementById('tools-tbody');
    document.getElementById('inventory-pagination').textContent =
        total ? `Showing ${tools.length} of ${total} tools` : '';

    if (!tools.length) {
        tbody.innerHTML = `<tr><td colspan="13" class="empty-state">
            <div class="empty-icon">🔧</div>No tools found.</td></tr>`;
        return;
    }

    tbody.innerHTML = tools.map(t => {
        const availQty = t.quantity_available ?? 0;
        const minQty   = t.minimum_quantity ?? 1;
        const stockPct = minQty > 0 ? Math.min(100, Math.round((availQty / (minQty * 2)) * 100)) : 100;
        const stockCls = availQty === 0 ? 'stock-out' : (availQty <= minQty ? 'stock-low' : 'stock-ok');
        const cost = t.current_cost || t.cost_per_tool;

        return `<tr onclick="openToolDetail(${t.id})">
            <td><strong>${esc(t.tool_number)}</strong>${t.internal_code ? `<br><small style="color:#94a3b8">${esc(t.internal_code)}</small>` : ''}</td>
            <td>${t.category_name ? `<span style="font-size:0.8rem">${esc(t.category_name)}</span>` : '—'}</td>
            <td>${esc(t.tool_type)}</td>
            <td>${esc(t.brand_name || '—')}</td>
            <td>${t.diameter ? parseFloat(t.diameter).toFixed(3) : '—'}</td>
            <td>${t.shank_diameter ? parseFloat(t.shank_diameter).toFixed(2) : '—'}</td>
            <td>${t.coating ? `<span style="font-size:0.8rem;padding:0.15rem 0.4rem;background:#e0e7ff;color:#3730a3;border-radius:4px">${esc(t.coating)}</span>` : '—'}</td>
            <td>${t.application_type_name ? `<span style="font-size:0.78rem;padding:0.15rem 0.5rem;border-radius:12px;font-weight:600;color:#fff;background:${esc(t.application_type_color || '#6b7280')}">${esc(t.application_type_name)}</span>` : '—'}</td>
            <td>
              <div class="stock-level ${stockCls}">
                <span>${availQty}/${minQty}</span>
                <div class="stock-bar"><div class="stock-bar-fill" style="width:${stockPct}%"></div></div>
              </div>
            </td>
            <td>${t.cabinet_code ? `${esc(t.cabinet_code)}${t.drawer_slot ? ` · ${esc(t.drawer_slot)}` : ''}` : (esc(t.location || '—'))}</td>
            <td><span class="tool-status ts-${t.status || 'available'}">${(t.status || 'available').replace('_', ' ')}</span></td>
            <td>${cost ? parseFloat(cost).toFixed(2) + ' RON' : '—'}</td>
            <td onclick="event.stopPropagation()">
              <button class="btn-success btn-sm" onclick="currentToolId=${t.id};openStockModal('in')">+</button>
              <button class="btn-warning btn-sm" onclick="currentToolId=${t.id};openStockModal('out')">−</button>
            </td>
        </tr>`;
    }).join('');
}

// ── Tool Detail ───────────────────────────────────────────────
async function openToolDetail(id) {
    currentToolId = id;
    const modal = document.getElementById('tool-detail-modal');
    const body  = document.getElementById('tool-detail-body');
    body.innerHTML = '<p style="text-align:center;padding:2rem;color:#94a3b8;">Loading…</p>';
    modal.classList.add('active');

    try {
        const [toolRes, priceRes, txRes] = await Promise.all([
            apiGet(`${BASE()}/${id}`),
            apiGet(`${BASE()}/${id}/prices`),
            apiGet(`${BASE()}/${id}/transactions`)
        ]);

        if (!toolRes.success) throw new Error(toolRes.error);
        const t   = toolRes.tool;
        const ph  = priceRes.history  || [];
        const txs = txRes.transactions || [];

        document.getElementById('detail-modal-title').textContent =
            `${t.tool_number} — ${t.tool_type}`;

        const cost = t.current_cost || t.cost_per_tool;

        // Price trend: find min/max for bar scaling
        const prices = ph.map(r => parseFloat(r.price));
        const maxPrice = prices.length ? Math.max(...prices) : 1;

        body.innerHTML = `
        <div class="detail-grid">
          <div class="detail-item"><span class="detail-label">Tool Number</span><span class="detail-value">${esc(t.tool_number)}</span></div>
          <div class="detail-item"><span class="detail-label">Internal Code</span><span class="detail-value">${esc(t.internal_code || '—')}</span></div>
          <div class="detail-item"><span class="detail-label">Category</span><span class="detail-value">${esc(t.category_name || '—')}</span></div>
          <div class="detail-item"><span class="detail-label">Brand</span><span class="detail-value">${esc(t.brand_name || '—')}${t.brand_country ? ` <small>(${esc(t.brand_country)})</small>` : ''}</span></div>
          <div class="detail-item"><span class="detail-label">Supplier</span><span class="detail-value">${esc(t.supplier_name || '—')}</span></div>
          <div class="detail-item"><span class="detail-label">Status</span><span class="detail-value"><span class="tool-status ts-${t.status || 'available'}">${(t.status || 'available').replace('_',' ')}</span></span></div>
        </div>

        <div class="detail-section-title">Specifications</div>
        <div class="detail-grid">
          <div class="detail-item"><span class="detail-label">Diameter</span><span class="detail-value">${t.diameter ? parseFloat(t.diameter).toFixed(3) + ' mm' : '—'}</span></div>
          <div class="detail-item"><span class="detail-label">Overall Length</span><span class="detail-value">${t.overall_length ? parseFloat(t.overall_length).toFixed(2) + ' mm' : (t.length ? parseFloat(t.length).toFixed(2) + ' mm' : '—')}</span></div>
          <div class="detail-item"><span class="detail-label">Cutting Length</span><span class="detail-value">${t.cutting_length ? parseFloat(t.cutting_length).toFixed(2) + ' mm' : '—'}</span></div>
          <div class="detail-item"><span class="detail-label">Shank Diameter</span><span class="detail-value">${t.shank_diameter ? parseFloat(t.shank_diameter).toFixed(2) + ' mm' : '—'}</span></div>
          <div class="detail-item"><span class="detail-label">Flute Count</span><span class="detail-value">${t.flute_count || '—'}</span></div>
          <div class="detail-item"><span class="detail-label">Tool Material</span><span class="detail-value">${esc(t.tool_material || t.material || '—')}</span></div>
          <div class="detail-item"><span class="detail-label">Coating</span><span class="detail-value">${esc(t.coating || '—')}</span></div>
          <div class="detail-item"><span class="detail-label">Resharpenable</span><span class="detail-value">${t.is_resharpable ? 'Yes' : 'No'}</span></div>
        </div>

        <div class="detail-section-title">Stock &amp; Location</div>
        <div class="detail-grid">
          <div class="detail-item"><span class="detail-label">Available</span><span class="detail-value" style="font-size:1.3rem;font-weight:700">${t.quantity_available}</span></div>
          <div class="detail-item"><span class="detail-label">Minimum</span><span class="detail-value">${t.minimum_quantity}</span></div>
          <div class="detail-item"><span class="detail-label">Cabinet</span><span class="detail-value">${t.cabinet_code ? `${esc(t.cabinet_code)} — ${esc(t.cabinet_name)}` : '—'}</span></div>
          <div class="detail-item"><span class="detail-label">Drawer / Slot</span><span class="detail-value">${esc(t.drawer_slot || '—')}</span></div>
          <div class="detail-item"><span class="detail-label">Current Cost</span><span class="detail-value">${cost ? parseFloat(cost).toFixed(2) + ' RON' : '—'}</span></div>
          <div class="detail-item"><span class="detail-label">Parts Produced (total)</span><span class="detail-value">${t.parts_produced_total || 0}</span></div>
          <div class="detail-item"><span class="detail-label">Parts Since Sharpen</span><span class="detail-value">${t.parts_since_sharpen || 0}</span></div>
          <div class="detail-item"><span class="detail-label">Expected Life</span><span class="detail-value">${t.expected_tool_life ? t.expected_tool_life + ' parts' : '—'}</span></div>
        </div>

        ${t.notes ? `<div class="detail-section-title">Notes</div><p style="margin:0;font-size:0.9rem;color:#475569">${esc(t.notes)}</p>` : ''}

        <div class="detail-section-title">Price History (${ph.length} records)</div>
        ${ph.length ? `
        <table class="price-history-table">
          <thead><tr><th>Date</th><th>Price</th><th>Supplier</th><th>Qty</th><th>Invoice</th><th>Trend</th></tr></thead>
          <tbody>
          ${ph.map(r => {
            const barW = maxPrice > 0 ? Math.round((parseFloat(r.price) / maxPrice) * 120) : 10;
            return `<tr>
              <td>${formatDate(r.purchase_date)}</td>
              <td><strong>${parseFloat(r.price).toFixed(2)} ${r.currency}</strong></td>
              <td>${esc(r.supplier_name || '—')}</td>
              <td>${r.quantity_purchased || 1}</td>
              <td>${esc(r.invoice_number || '—')}</td>
              <td><div class="price-bar-wrap"><div class="price-bar" style="width:${barW}px"></div><small>${parseFloat(r.price).toFixed(0)}</small></div></td>
            </tr>`;
          }).join('')}
          </tbody>
        </table>` : '<p style="color:#94a3b8;font-size:0.85rem">No price records yet.</p>'}

        <div class="detail-section-title">Transaction Log (last ${Math.min(txs.length,20)})</div>
        ${txs.length ? `
        <table class="price-history-table">
          <thead><tr><th>Date</th><th>Type</th><th>Qty</th><th>After</th><th>By</th><th>Notes</th></tr></thead>
          <tbody>
          ${txs.slice(0,20).map(tx => `<tr>
            <td>${formatDate(tx.created_at)}</td>
            <td><span style="font-size:0.75rem;padding:0.15rem 0.4rem;background:#e2e8f0;border-radius:4px">${tx.transaction_type.replace('_',' ')}</span></td>
            <td>${tx.quantity}</td>
            <td>${tx.quantity_after ?? '—'}</td>
            <td>${esc(tx.performed_by_name || '—')}</td>
            <td style="color:#64748b;font-size:0.82rem">${esc(tx.notes || '')}</td>
          </tr>`).join('')}
          </tbody>
        </table>` : '<p style="color:#94a3b8;font-size:0.85rem">No transactions yet.</p>'}
        `;

    } catch (e) {
        body.innerHTML = `<p style="color:#dc2626">Error: ${e.message}</p>`;
    }
}

// ── Stock In/Out ──────────────────────────────────────────────
function openStockModal(direction) {
    stockDirection = direction;
    document.getElementById('stock-modal-title').textContent = direction === 'in' ? 'Stock In — Add Tools' : 'Stock Out — Remove Tools';
    document.getElementById('stock-submit-btn').textContent  = direction === 'in' ? 'Add to Stock' : 'Remove from Stock';
    document.getElementById('stock-out-extra').style.display = direction === 'out' ? '' : 'none';
    document.getElementById('stock-qty').value = 1;
    document.getElementById('stock-notes').value = '';
    if (direction === 'out') populateUsersSelect('stock-given-to');
    document.getElementById('stock-modal').classList.add('active');
}

async function populateUsersSelect(selectId) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    try {
        if (!usersCache.length) {
            const data = await API.users.list();
            usersCache = data.users || [];
        }
        const current = sel.value;
        sel.innerHTML = '<option value="">— Select user (optional) —</option>' +
            usersCache.map(u => `<option value="${u.id}">${esc(u.name || u.employee_id)}</option>`).join('');
        sel.value = current;
    } catch (e) { /* silently ignore */ }
}

async function submitStock(e) {
    e.preventDefault();
    const qty     = parseInt(document.getElementById('stock-qty').value);
    const notes   = document.getElementById('stock-notes').value;
    const cond    = document.getElementById('stock-condition').value;
    const givenTo = document.getElementById('stock-given-to')?.value || null;
    const url     = `${BASE()}/${currentToolId}/stock-${stockDirection}`;

    try {
        const payload = { quantity: qty, notes, condition: cond };
        if (stockDirection === 'out' && givenTo) payload.given_to = parseInt(givenTo);
        const res = await apiPost(url, payload);
        if (!res.success) throw new Error(res.error);
        closeModal('stock-modal');
        loadStats();
        loadInventory();
        if (document.getElementById('tool-detail-modal').classList.contains('active')) {
            openToolDetail(currentToolId);
        }
    } catch (e) {
        alert('Error: ' + e.message);
    }
}

// ── Checkouts ─────────────────────────────────────────────────
async function loadCheckouts() {
    const tbody = document.getElementById('checkouts-tbody');
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:2rem;color:#94a3b8;">Loading…</td></tr>`;
    try {
        const data = await apiGet(`${BASE()}/checkouts`);
        const rows = data.checkouts || [];
        if (!rows.length) {
            tbody.innerHTML = `<tr><td colspan="8" class="empty-state"><div class="empty-icon">🧰</div>No checkouts yet.</td></tr>`;
            return;
        }
        tbody.innerHTML = rows.map(r => {
            const d = new Date(r.created_at);
            const dateStr = d.toLocaleDateString('ro-RO');
            const timeStr = d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
            const matBadge = r.application_type_name
                ? `<span style="font-size:0.75rem;padding:0.2rem 0.5rem;border-radius:4px;background:${esc(r.application_type_color)}22;color:${esc(r.application_type_color)};border:1px solid ${esc(r.application_type_color)}66;font-weight:600">${esc(r.application_type_name)}</span>`
                : '<span style="color:#94a3b8">—</span>';
            return `<tr onclick="openToolDetail(${r.tool_id})" style="cursor:pointer">
                <td>${dateStr}<br><small style="color:#94a3b8">${timeStr}</small></td>
                <td><strong>${esc(r.tool_number)}</strong><br><small style="color:#94a3b8">${esc(r.tool_type)}</small></td>
                <td>${matBadge}</td>
                <td>${r.quantity}</td>
                <td>${r.given_to_name ? `<strong>${esc(r.given_to_name)}</strong>` : '<span style="color:#94a3b8">—</span>'}</td>
                <td>${esc(r.performed_by_name || '—')}</td>
                <td><span style="font-size:0.75rem;padding:0.15rem 0.4rem;background:#e2e8f0;border-radius:4px">${esc(r.condition || 'good')}</span></td>
                <td>${esc(r.notes || '—')}</td>
            </tr>`;
        }).join('');
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:#dc2626;">Error: ${e.message}</td></tr>`;
    }
}

// ── Price record ──────────────────────────────────────────────
function openAddPriceModal() {
    document.getElementById('pr-price').value   = '';
    document.getElementById('pr-qty').value     = 1;
    document.getElementById('pr-po').value      = '';
    document.getElementById('pr-invoice').value = '';
    document.getElementById('pr-notes').value   = '';
    populateSupplierSelect('pr-supplier');
    document.getElementById('price-modal').classList.add('active');
}

async function submitPriceRecord(e) {
    e.preventDefault();
    const data = {
        price:                 document.getElementById('pr-price').value,
        purchase_date:         document.getElementById('pr-date').value,
        supplier_id:           document.getElementById('pr-supplier').value || null,
        quantity_purchased:    parseInt(document.getElementById('pr-qty').value) || 1,
        purchase_order_number: document.getElementById('pr-po').value,
        invoice_number:        document.getElementById('pr-invoice').value,
        notes:                 document.getElementById('pr-notes').value
    };
    try {
        const res = await apiPost(`${BASE()}/${currentToolId}/prices`, data);
        if (!res.success) throw new Error(res.error);
        closeModal('price-modal');
        loadStats();
        openToolDetail(currentToolId);
    } catch (e) {
        alert('Error: ' + e.message);
    }
}

// ── Add/Edit Tool Form ────────────────────────────────────────
function openAddToolModal() {
    editingToolId = null;
    document.getElementById('tool-form-title').textContent = 'Add New Tool';
    document.getElementById('tool-form-submit-btn').textContent = 'Add Tool';
    document.getElementById('tool-form').reset();
    populateCategorySelect('f-category');
    populateBrandSelect('f-brand');
    populateCabinetSelect('f-cabinet');
    populateSupplierSelect('f-supplier');
    populateAppTypeSelect('f-application-type');
    document.getElementById('tool-form-modal').classList.add('active');
}

async function openEditToolModal() {
    editingToolId = currentToolId;
    document.getElementById('tool-form-title').textContent = 'Edit Tool';
    document.getElementById('tool-form-submit-btn').textContent = 'Save Changes';
    populateCategorySelect('f-category');
    populateBrandSelect('f-brand');
    populateCabinetSelect('f-cabinet');
    populateSupplierSelect('f-supplier');
    populateAppTypeSelect('f-application-type');

    try {
        const res = await apiGet(`${BASE()}/${currentToolId}`);
        if (!res.success) return;
        const t = res.tool;
        document.getElementById('f-tool-number').value    = t.tool_number || '';
        document.getElementById('f-tool-type').value      = t.tool_type || '';
        document.getElementById('f-category').value       = t.category_id || '';
        document.getElementById('f-brand').value          = t.brand_id || '';
        document.getElementById('f-supplier').value       = t.supplier_id || '';
        document.getElementById('f-internal-code').value  = t.internal_code || '';
        document.getElementById('f-diameter').value       = t.diameter || '';
        document.getElementById('f-overall-length').value = t.overall_length || t.length || '';
        document.getElementById('f-cutting-length').value = t.cutting_length || '';
        document.getElementById('f-shank-diameter').value = t.shank_diameter || '';
        document.getElementById('f-flute-count').value    = t.flute_count || '';
        document.getElementById('f-tool-material').value  = t.tool_material || t.material || '';
        document.getElementById('f-coating').value        = t.coating || '';
        document.getElementById('f-resharpable').value    = t.is_resharpable ? 'true' : 'false';
        document.getElementById('f-tool-life').value      = t.expected_tool_life || '';
        document.getElementById('f-qty').value            = t.quantity_available || 0;
        document.getElementById('f-min-qty').value        = t.minimum_quantity || 1;
        document.getElementById('f-cost').value           = t.current_cost || t.cost_per_tool || '';
        document.getElementById('f-cabinet').value        = t.cabinet_id || '';
        document.getElementById('f-drawer-slot').value    = t.drawer_slot || '';
        document.getElementById('f-notes').value          = t.notes || '';
        document.getElementById('f-application-type').value = t.application_type_id || '';
    } catch (e) { console.error(e); }

    document.getElementById('tool-detail-modal').classList.remove('active');
    document.getElementById('tool-form-modal').classList.add('active');
}

async function saveToolForm(e) {
    e.preventDefault();
    const data = {
        tool_number:       document.getElementById('f-tool-number').value.trim(),
        tool_type:         document.getElementById('f-tool-type').value.trim(),
        category_id:       document.getElementById('f-category').value || null,
        brand_id:          document.getElementById('f-brand').value || null,
        supplier_id:       document.getElementById('f-supplier').value || null,
        internal_code:     document.getElementById('f-internal-code').value || null,
        diameter:          document.getElementById('f-diameter').value || null,
        overall_length:    document.getElementById('f-overall-length').value || null,
        cutting_length:    document.getElementById('f-cutting-length').value || null,
        shank_diameter:    document.getElementById('f-shank-diameter').value || null,
        flute_count:       document.getElementById('f-flute-count').value || null,
        tool_material:     document.getElementById('f-tool-material').value || null,
        coating:           document.getElementById('f-coating').value || null,
        is_resharpable:    document.getElementById('f-resharpable').value === 'true',
        expected_tool_life:document.getElementById('f-tool-life').value || null,
        quantity_available:parseInt(document.getElementById('f-qty').value) || 0,
        minimum_quantity:  parseInt(document.getElementById('f-min-qty').value) || 1,
        current_cost:      document.getElementById('f-cost').value || null,
        cost_per_tool:     document.getElementById('f-cost').value || null,
        cabinet_id:        document.getElementById('f-cabinet').value || null,
        drawer_slot:       document.getElementById('f-drawer-slot').value || null,
        notes:             document.getElementById('f-notes').value || null,
        application_type_id: document.getElementById('f-application-type').value || null
    };

    try {
        let res;
        if (editingToolId) {
            res = await apiPut(`${BASE()}/${editingToolId}`, data);
        } else {
            res = await apiPost(BASE(), data);
        }
        if (!res.success) throw new Error(res.error);
        closeModal('tool-form-modal');
        loadStats();
        loadInventory();
    } catch (e) {
        alert('Error: ' + e.message);
    }
}

// ── Retire ────────────────────────────────────────────────────
async function retireTool() {
    if (!confirm('Retire this tool? It will be marked as retired and hidden from active inventory.')) return;
    try {
        const res = await apiDelete(`${BASE()}/${currentToolId}`);
        if (!res.success) throw new Error(res.error);
        closeModal('tool-detail-modal');
        loadStats();
        loadInventory();
    } catch (e) {
        alert('Error: ' + e.message);
    }
}

// ── Low Stock Tab ─────────────────────────────────────────────
async function loadLowStock() {
    const tbody = document.getElementById('low-stock-tbody');
    try {
        const res = await apiGet(`${BASE()}/low-stock`);
        if (!res.success) throw new Error(res.error);
        const tools = res.tools;
        if (!tools.length) {
            tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:2rem;color:#16a34a;">✓ All tools have sufficient stock</td></tr>`;
            return;
        }
        tbody.innerHTML = tools.map(t => {
            const cost = t.current_cost || t.cost_per_tool;
            const shortage = (t.minimum_quantity || 0) - (t.quantity_available || 0);
            const matBadge = t.application_type_name
                ? `<span style="font-size:0.75rem;padding:0.2rem 0.5rem;border-radius:4px;background:${esc(t.application_type_color)}22;color:${esc(t.application_type_color)};border:1px solid ${esc(t.application_type_color)}66;font-weight:600">${esc(t.application_type_name)}</span>`
                : '<span style="color:#94a3b8">—</span>';
            return `<tr onclick="openToolDetail(${t.id})" style="cursor:pointer">
                <td><strong>${esc(t.tool_number)}</strong></td>
                <td>${esc(t.tool_type)}</td>
                <td>${esc(t.brand_name || '—')}</td>
                <td>${matBadge}</td>
                <td style="color:${t.quantity_available === 0 ? '#dc2626' : '#d97706'};font-weight:700">${t.quantity_available}</td>
                <td>${t.minimum_quantity}</td>
                <td style="color:#dc2626;font-weight:700">−${shortage}</td>
                <td>${esc(t.supplier_name || '—')}</td>
                <td>${cost ? parseFloat(cost).toFixed(2) + ' RON' : '—'}</td>
                <td onclick="event.stopPropagation()">
                  <button class="btn-success btn-sm" onclick="currentToolId=${t.id};openStockModal('in')">Stock In</button>
                </td>
            </tr>`;
        }).join('');
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="10" style="color:#dc2626;text-align:center">${e.message}</td></tr>`;
    }
}

// ── Application Types Tab ─────────────────────────────────────
let editingAppTypeId = null;

async function loadAppTypes() {
    try {
        const res = await apiGet(`${BASE()}/application-types`);
        if (res.success) { appTypesCache = res.appTypes; }
    } catch (e) { console.error('loadAppTypes', e); }
}

function renderAppTypesTable() {
    const tbody = document.getElementById('apptypes-tbody');
    if (!appTypesCache.length) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:2rem;color:#94a3b8">No types yet</td></tr>`;
        return;
    }
    tbody.innerHTML = appTypesCache.map(a => `<tr>
        <td><span style="display:inline-block;width:28px;height:28px;border-radius:50%;background:${esc(a.color)};border:2px solid rgba(0,0,0,0.1)"></span></td>
        <td><strong style="color:${esc(a.color)}">${esc(a.name)}</strong></td>
        <td style="color:#64748b;font-size:0.85rem">${esc(a.description || '—')}</td>
        <td>${a.tool_count || 0}</td>
        <td><button class="btn-secondary btn-sm" onclick="openEditAppTypeModal(${a.id})">Edit</button></td>
    </tr>`).join('');
}

function openAddAppTypeModal() {
    editingAppTypeId = null;
    document.getElementById('apptype-modal-title').textContent = 'Add Tool Type';
    document.getElementById('at-name').value        = '';
    document.getElementById('at-color').value       = '#3b82f6';
    document.getElementById('at-description').value = '';
    document.getElementById('at-delete-btn').style.display = 'none';
    document.getElementById('apptype-modal').classList.add('active');
}

function openEditAppTypeModal(id) {
    const t = appTypesCache.find(a => a.id === id);
    if (!t) return;
    editingAppTypeId = id;
    document.getElementById('apptype-modal-title').textContent = 'Edit Tool Type';
    document.getElementById('at-name').value        = t.name;
    document.getElementById('at-color').value       = t.color || '#6b7280';
    document.getElementById('at-description').value = t.description || '';
    document.getElementById('at-delete-btn').style.display = '';
    document.getElementById('apptype-modal').classList.add('active');
}

async function saveAppTypeForm(e) {
    e.preventDefault();
    const data = {
        name:        document.getElementById('at-name').value.trim(),
        color:       document.getElementById('at-color').value,
        description: document.getElementById('at-description').value.trim() || null
    };
    try {
        let res;
        if (editingAppTypeId) {
            res = await apiPut(`${BASE()}/application-types/${editingAppTypeId}`, data);
        } else {
            res = await apiPost(`${BASE()}/application-types`, data);
        }
        if (!res.success) throw new Error(res.error);
        closeModal('apptype-modal');
        await loadAppTypes();
        renderAppTypesTable();
        // Refresh inventory so color badges update
        populateAppTypeSelect('f-application-type');
        loadInventory();
    } catch (e) {
        alert('Error: ' + e.message);
    }
}

async function deleteAppType() {
    if (!editingAppTypeId) return;
    if (!confirm('Delete this application type? Tools assigned to it will be unlinked.')) return;
    try {
        const res = await apiDelete(`${BASE()}/application-types/${editingAppTypeId}`);
        if (!res.success) throw new Error(res.error);
        closeModal('apptype-modal');
        await loadAppTypes();
        renderAppTypesTable();
        loadInventory();
    } catch (e) {
        alert('Error: ' + e.message);
    }
}

function populateAppTypeSelect(id) {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = '<option value="">— None —</option>' + appTypesCache.map(a =>
        `<option value="${a.id}" style="color:${esc(a.color)}">${esc(a.name)}</option>`
    ).join('');
}

// ── Brands Tab ────────────────────────────────────────────────
let editingBrandId = null;
async function loadBrands() {
    try {
        const res = await apiGet(`${BASE()}/brands`);
        if (res.success) { brandsCache = res.brands; renderBrandsTable(); }
    } catch (e) { console.error('loadBrands', e); }
}

function renderBrandsTable() {
    const tbody = document.getElementById('brands-tbody');
    if (!brandsCache.length) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:2rem;color:#94a3b8">No brands yet</td></tr>`;
        return;
    }
    tbody.innerHTML = brandsCache.map(b => `<tr>
        <td><strong>${esc(b.name)}</strong></td>
        <td>${esc(b.country || '—')}</td>
        <td>${b.website ? `<a href="${esc(b.website)}" target="_blank" style="color:#667eea">${esc(b.website)}</a>` : '—'}</td>
        <td>${b.tool_count || 0}</td>
        <td><button class="btn-secondary btn-sm" onclick="openEditBrandModal(${b.id})">Edit</button></td>
    </tr>`).join('');
}

function openAddBrandModal() {
    editingBrandId = null;
    document.getElementById('brand-modal-title').textContent = 'Add Brand';
    document.getElementById('brand-name').value    = '';
    document.getElementById('brand-country').value = '';
    document.getElementById('brand-website').value = '';
    document.getElementById('brand-notes').value   = '';
    document.getElementById('brand-modal').classList.add('active');
}

function openEditBrandModal(id) {
    const brand = brandsCache.find(b => b.id === id);
    if (!brand) return;
    editingBrandId = id;
    document.getElementById('brand-modal-title').textContent = 'Edit Brand';
    document.getElementById('brand-name').value    = brand.name;
    document.getElementById('brand-country').value = brand.country || '';
    document.getElementById('brand-website').value = brand.website || '';
    document.getElementById('brand-notes').value   = brand.notes || '';
    document.getElementById('brand-modal').classList.add('active');
}

async function saveBrandForm(e) {
    e.preventDefault();
    const data = {
        name:    document.getElementById('brand-name').value.trim(),
        country: document.getElementById('brand-country').value.trim() || null,
        website: document.getElementById('brand-website').value.trim() || null,
        notes:   document.getElementById('brand-notes').value.trim() || null
    };
    try {
        let res;
        if (editingBrandId) {
            res = await apiPut(`${BASE()}/brands/${editingBrandId}`, data);
        } else {
            res = await apiPost(`${BASE()}/brands`, data);
        }
        if (!res.success) throw new Error(res.error);
        closeModal('brand-modal');
        await loadBrands();
    } catch (e) {
        alert('Error: ' + e.message);
    }
}

// ── Cabinets Tab ──────────────────────────────────────────────
async function loadCabinets() {
    try {
        const res = await apiGet(`${BASE()}/cabinets`);
        if (res.success) { cabinetsCache = res.cabinets; renderCabinetsTable(); }
    } catch (e) { console.error('loadCabinets', e); }
}

function renderCabinetsTable() {
    const tbody = document.getElementById('cabinets-tbody');
    if (!cabinetsCache.length) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:#94a3b8">No cabinets yet</td></tr>`;
        return;
    }
    tbody.innerHTML = cabinetsCache.map(c => `<tr>
        <td><strong>${esc(c.code)}</strong></td>
        <td>${esc(c.name)}</td>
        <td>${esc(c.location_description || '—')}</td>
        <td>${c.total_drawers || '—'}</td>
        <td>${c.tool_count || 0}</td>
        <td style="color:#64748b;font-size:0.85rem">${esc(c.notes || '')}</td>
    </tr>`).join('');
}

function openAddCabinetModal() {
    document.getElementById('cab-code').value     = '';
    document.getElementById('cab-name').value     = '';
    document.getElementById('cab-location').value = '';
    document.getElementById('cab-drawers').value  = 10;
    document.getElementById('cab-notes').value    = '';
    document.getElementById('cabinet-modal').classList.add('active');
}

async function saveCabinetForm(e) {
    e.preventDefault();
    const data = {
        code:                 document.getElementById('cab-code').value.trim(),
        name:                 document.getElementById('cab-name').value.trim(),
        location_description: document.getElementById('cab-location').value.trim() || null,
        total_drawers:        parseInt(document.getElementById('cab-drawers').value) || 1,
        notes:                document.getElementById('cab-notes').value.trim() || null
    };
    try {
        const res = await apiPost(`${BASE()}/cabinets`, data);
        if (!res.success) throw new Error(res.error);
        closeModal('cabinet-modal');
        await loadCabinets();
    } catch (e) {
        alert('Error: ' + e.message);
    }
}

// ── Reference data helpers ────────────────────────────────────
async function loadCategories() {
    try {
        const res = await apiGet(`${BASE()}/categories`);
        if (res.success) {
            categoriesCache = res.categories;
            populateCategorySelect('filter-category');
        }
    } catch (e) { console.error('loadCategories', e); }
}

async function loadSuppliers() {
    try {
        const res = await apiGet(SUPPLIERS_URL());
        if (res.success || res.suppliers) {
            suppliersCache = res.suppliers || [];
        }
    } catch (e) { console.error('loadSuppliers', e); }
}

function populateCategorySelect(id) {
    const sel = document.getElementById(id);
    if (!sel) return;
    const firstOpt = id === 'filter-category' ? '<option value="">All Categories</option>' : '<option value="">— Select —</option>';
    sel.innerHTML = firstOpt + categoriesCache.map(c =>
        `<option value="${c.id}">${esc(c.name)}</option>`
    ).join('');
}

function populateBrandSelect(id) {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = '<option value="">— Select —</option>' + brandsCache.map(b =>
        `<option value="${b.id}">${esc(b.name)}</option>`
    ).join('');
}

function populateCabinetSelect(id) {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = '<option value="">— None —</option>' + cabinetsCache.map(c =>
        `<option value="${c.id}">${esc(c.code)} — ${esc(c.name)}</option>`
    ).join('');
}

function populateSupplierSelect(id) {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = '<option value="">— Select —</option>' + suppliersCache.map(s =>
        `<option value="${s.id}">${esc(s.name)}</option>`
    ).join('');
}

function initPriceDate() {
    const el = document.getElementById('pr-date');
    if (el) el.value = new Date().toISOString().split('T')[0];
}

// ── Utilities ─────────────────────────────────────────────────
function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

function esc(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ── Thin API wrappers (use existing auth token) ───────────────
function authHeader() {
    const token = localStorage.getItem('cnc_auth_token');
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
}

async function apiGet(url) {
    const r = await fetch(url, { headers: authHeader() });
    return r.json();
}

async function apiPost(url, body) {
    const r = await fetch(url, { method: 'POST', headers: authHeader(), body: JSON.stringify(body) });
    return r.json();
}

async function apiPut(url, body) {
    const r = await fetch(url, { method: 'PUT', headers: authHeader(), body: JSON.stringify(body) });
    return r.json();
}

async function apiDelete(url) {
    const r = await fetch(url, { method: 'DELETE', headers: authHeader() });
    return r.json();
}

