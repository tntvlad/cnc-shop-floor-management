// Create Order JS with Customer Management
let allCustomers = [];
let selectedCustomer = null;
let csvData = [];
let csvSelectedRows = [];

let allMaterials = [];

document.addEventListener('DOMContentLoaded', function() {
  ensureAuthed();
  setTodayDate();
  loadMaterials();
  addPartField();
  loadCustomers();
  setupCustomerSearch();
});

async function loadMaterials() {
  try {
    const response = await fetch(`${API_URL}/materials`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const data = await response.json();
    if (data.success && data.materials) {
      allMaterials = data.materials;
    } else if (data.materials) {
      allMaterials = data.materials;
    }
  } catch (error) {
    console.error('Error loading materials:', error);
  }
}

function setTodayDate() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('order-date').value = today;
}

async function loadCustomers() {
  try {
    const response = await fetch(`${API_URL}/customers`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const data = await response.json();
    if (data.success) {
      allCustomers = data.customers || [];
    }
  } catch (error) {
    console.error('Error loading customers:', error);
  }
}

function setupCustomerSearch() {
  const searchInput = document.getElementById('customer-search');
  const dropdown = document.getElementById('customer-dropdown');

  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    if (!query) {
      dropdown.classList.remove('active');
      return;
    }

    const filtered = allCustomers.filter(c =>
      (c.company_name && c.company_name.toLowerCase().includes(query)) ||
      (c.email && c.email.toLowerCase().includes(query)) ||
      (c.phone && c.phone.includes(query)) ||
      (c.contact_person && c.contact_person.toLowerCase().includes(query))
    );

    renderDropdown(filtered);
    dropdown.classList.add('active');
  });

  searchInput.addEventListener('focus', () => {
    if (searchInput.value) {
      dropdown.classList.add('active');
    }
  });

  document.addEventListener('click', (e) => {
    if (e.target !== searchInput && !e.target.closest('.customer-search-wrapper')) {
      dropdown.classList.remove('active');
    }
  });
}

function renderDropdown(customers) {
  const dropdown = document.getElementById('customer-dropdown');
  if (customers.length === 0) {
    dropdown.innerHTML = '<div class="customer-option" style="color: #999;">No customers found. Create one to add.</div>';
    return;
  }

  dropdown.innerHTML = customers.map(c => `
    <div class="customer-option" onclick="selectCustomer(${c.id}, '${escapeHtml(c.company_name)}', '${c.email}', '${c.phone || ''}')">
      <div class="customer-option-name">${escapeHtml(c.company_name)}</div>
      <div class="customer-option-email">${c.email}${c.phone ? ' • ' + c.phone : ''}</div>
    </div>
  `).join('');
}

function selectCustomer(id, name, email, phone) {
  selectedCustomer = allCustomers.find(c => c.id === id);
  document.getElementById('customer-id').value = id;
  document.getElementById('customer-search').value = name;
  document.getElementById('customer-dropdown').classList.remove('active');
  document.getElementById('manual-customer-fields').style.display = 'none';

  if (selectedCustomer) {
    showCustomerInfo(selectedCustomer);
    loadCustomerContacts(id);
  }
}

function showCustomerInfo(customer) {
  const grid = document.getElementById('customer-details-grid');
  const info = document.getElementById('selected-customer-info');

  const items = [
    { label: 'Company', value: customer.company_name },
    { label: 'Customer ID', value: customer.customer_id || '—' },
    { label: 'Email', value: customer.email },
    { label: 'Phone', value: customer.phone || '—' },
    { label: 'CIF', value: customer.cif || '—' },
    { label: 'Trade Register', value: customer.trade_register_number || '—' },
    { label: 'Headquarters', value: customer.headquarters_address || '—' }
  ];

  grid.innerHTML = items.map(item => `
    <div class="info-item">
      <div class="info-label">${item.label}</div>
      <div class="info-value">${escapeHtml(item.value)}</div>
    </div>
  `).join('');

  // Show customer warning banner if needed
  showCustomerWarningBanner(customer);
  
  // Show customer parameters summary
  showCustomerParametersSummary(customer);

  info.style.display = 'block';
}

function showCustomerWarningBanner(customer) {
  const banner = document.getElementById('customer-warning-banner');
  if (!banner) return;
  
  const warnings = [];
  let isDanger = false;
  
  // Status warnings
  if (customer.status === 'inactive') {
    warnings.push('⏸️ This customer is marked as <strong>inactive</strong>');
  } else if (customer.status === 'bankrupt') {
    warnings.push('⚠️ This customer is in <strong>bankruptcy</strong> - order may require approval');
    isDanger = true;
  } else if (customer.status === 'closed') {
    warnings.push('❌ This company is <strong>closed/dead</strong> - consider blocking this order');
    isDanger = true;
  }
  
  // Payment history warnings
  if (customer.payment_history === 'bad') {
    warnings.push('❌ This customer has a <strong>bad payment history</strong> - order may require approval');
    isDanger = true;
  } else if (customer.payment_history === 'delayed') {
    warnings.push('⚠️ This customer has a history of <strong>delayed payments</strong>');
  }
  
  // Payment terms warnings
  if (customer.payment_terms === 'prepayment_required') {
    warnings.push('💰 <strong>Prepayment required</strong> before processing this order');
  }
  
  // Approval threshold warning
  if (customer.approval_threshold) {
    warnings.push(`📋 Orders above €${parseFloat(customer.approval_threshold).toLocaleString()} require admin approval`);
  }
  
  if (warnings.length === 0) {
    banner.style.display = 'none';
    return;
  }
  
  banner.className = 'customer-warning' + (isDanger ? ' danger' : '');
  banner.innerHTML = `
    <h4>${isDanger ? '⚠️ Important Warnings' : '📋 Customer Notices'}</h4>
    <ul>${warnings.map(w => `<li>${w}</li>`).join('')}</ul>
  `;
  banner.style.display = 'block';
}

function showCustomerParametersSummary(customer) {
  const container = document.getElementById('customer-parameters-summary');
  const content = document.getElementById('customer-params-content');
  if (!container || !content) return;
  
  const statusLabels = {
    'active': '✅ Active',
    'inactive': '⏸️ Inactive',
    'bankrupt': '⚠️ Bankrupt',
    'closed': '❌ Closed'
  };
  
  const paymentHistoryLabels = {
    'good': '💰 Good',
    'new_customer': '🆕 New Customer',
    'delayed': '⚠️ Delayed',
    'bad': '❌ Bad'
  };
  
  const paymentTermsLabels = {
    'standard_credit': '💳 Standard Credit',
    'prepayment_required': '💰 Prepayment Required',
    'cod': '📦 Cash on Delivery',
    'custom': '📝 Custom Terms'
  };
  
  const status = customer.status || 'active';
  const paymentHistory = customer.payment_history || 'new_customer';
  const paymentTerms = customer.payment_terms || 'standard_credit';
  const discount = parseFloat(customer.discount_percentage) || 0;
  
  let html = `
    <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center;">
      <span class="param-badge status-${status}">${statusLabels[status]}</span>
      <span class="param-badge payment-${paymentHistory}">${paymentHistoryLabels[paymentHistory]}</span>
      <span style="color: #666; font-size: 0.85rem;">${paymentTermsLabels[paymentTerms]}</span>
  `;
  
  if (discount !== 0) {
    const discountClass = discount > 0 ? 'discount' : 'fee';
    const discountLabel = discount > 0 ? `${discount}% Discount` : `${Math.abs(discount)}% Extra Fee`;
    html += `<span class="param-badge ${discountClass}">${discountLabel}</span>`;
  }
  
  if (customer.credit_limit) {
    html += `<span style="color: #666; font-size: 0.85rem;">Credit Limit: €${parseFloat(customer.credit_limit).toLocaleString()}</span>`;
  }
  
  html += '</div>';
  
  if (customer.custom_terms_notes) {
    html += `<div style="margin-top: 0.5rem; font-size: 0.85rem; color: #666;"><strong>Notes:</strong> ${escapeHtml(customer.custom_terms_notes)}</div>`;
  }
  
  content.innerHTML = html;
  container.style.display = 'block';
}

async function loadCustomerContacts(customerId) {
  try {
    const response = await fetch(`${API_URL}/customers/${customerId}/contacts`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const data = await response.json();

    if (!data.success) {
      console.error('Error loading contacts:', data.message);
      return;
    }

    const contacts = data.contacts || [];
    
    // Show contact sections if contacts exist
    const contactsSection = document.getElementById('contacts-section');
    const deliverySection = document.getElementById('delivery-section');
    
    if (contacts.length > 0) {
      contactsSection.style.display = 'block';
      deliverySection.style.display = 'block';
      
      // Populate contact selects by type
      populateContactSelect('invoice-contact', contacts, 'invoice');
      populateContactSelect('order-contact', contacts, 'order');
      populateContactSelect('technical-contact', contacts, 'technical');
    } else {
      contactsSection.style.display = 'none';
      deliverySection.style.display = 'none';
    }
  } catch (error) {
    console.error('Error loading contacts:', error);
  }
}

function populateContactSelect(selectId, contacts, type) {
  const select = document.getElementById(selectId);
  if (!select) return;

  select.innerHTML = '<option value="">None</option>';
  
  const typeContacts = contacts.filter(c => c.contact_type === type);
  typeContacts.forEach(contact => {
    const option = document.createElement('option');
    option.value = contact.id;
    option.textContent = `${contact.name}${contact.phone ? ' • ' + contact.phone : ''}`;
    select.appendChild(option);
  });
}

// Add Customer Modal
function openAddCustomerModal() {
  document.getElementById('add-customer-modal').classList.add('active');
}

function closeAddCustomerModal() {
  document.getElementById('add-customer-modal').classList.remove('active');
  document.getElementById('add-customer-form').reset();
}

async function handleAddCustomer(event) {
  event.preventDefault();

  const customer = {
    company_name: document.getElementById('ac-company-name').value.trim(),
    customer_id: document.getElementById('ac-customer-id').value.trim() || null,
    email: document.getElementById('ac-email').value.trim(),
    phone: document.getElementById('ac-phone').value.trim() || null,
    cif: document.getElementById('ac-cif').value.trim() || null,
    trade_register_number: document.getElementById('ac-trade-register').value.trim() || null,
    headquarters_address: document.getElementById('ac-headquarters').value.trim() || null,
    delivery_address: document.getElementById('ac-delivery-address').value.trim() || null,
    notes: document.getElementById('ac-notes').value.trim() || null,
    // Customer parameters
    status: document.getElementById('ac-status').value,
    payment_terms: document.getElementById('ac-payment-terms').value,
    payment_history: document.getElementById('ac-payment-history').value,
    discount_percentage: parseFloat(document.getElementById('ac-discount-percentage').value) || 0,
    credit_limit: parseFloat(document.getElementById('ac-credit-limit').value) || null,
    approval_threshold: parseFloat(document.getElementById('ac-approval-threshold').value) || null,
    custom_terms_notes: document.getElementById('ac-custom-terms-notes').value.trim() || null
  };

  try {
    const response = await fetch(`${API_URL}/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify(customer)
    });

    const data = await response.json();

    if (!response.ok) {
      showError(data.message || 'Failed to add customer');
      return;
    }

    allCustomers.push(data.customer);
    selectCustomer(data.customer.id, data.customer.company_name, data.customer.email, data.customer.phone);
    closeAddCustomerModal();
    showSuccess('Customer added successfully!');
  } catch (error) {
    showError('Error: ' + error.message);
  }
}

// Edit Customer Modal
function populateCustomerSelect(selectId, preselectId) {
  const select = document.getElementById(selectId);
  if (!select) return;
  select.innerHTML = '<option value="">Select customer</option>';
  allCustomers.forEach(c => {
    const option = document.createElement('option');
    option.value = c.id;
    option.textContent = `${c.company_name}${c.email ? ' (' + c.email + ')' : ''}`;
    select.appendChild(option);
  });
  if (preselectId) {
    select.value = preselectId;
  }
}

function openEditCustomerModal() {
  populateCustomerSelect('edit-customer-select', selectedCustomer?.id);
  if (selectedCustomer) {
    prefillEditCustomerFields(selectedCustomer.id);
  } else {
    prefillEditCustomerFields('');
  }
  document.getElementById('edit-customer-modal').classList.add('active');
}

function closeEditCustomerModal() {
  document.getElementById('edit-customer-modal').classList.remove('active');
  document.getElementById('edit-customer-form').reset();
}

function prefillEditCustomerFields(customerId) {
  const customer = allCustomers.find(c => String(c.id) === String(customerId));
  const fields = {
    'ec-company-name': customer?.company_name || '',
    'ec-customer-id': customer?.customer_id || '',
    'ec-email': customer?.email || '',
    'ec-phone': customer?.phone || '',
    'ec-cif': customer?.cif || '',
    'ec-trade-register': customer?.trade_register_number || '',
    'ec-headquarters': customer?.headquarters_address || '',
    'ec-delivery-address': customer?.delivery_address || '',
    'ec-notes': customer?.notes || '',
    // Customer parameters
    'ec-status': customer?.status || 'active',
    'ec-payment-terms': customer?.payment_terms || 'standard_credit',
    'ec-payment-history': customer?.payment_history || 'new_customer',
    'ec-discount-percentage': customer?.discount_percentage || 0,
    'ec-credit-limit': customer?.credit_limit || '',
    'ec-approval-threshold': customer?.approval_threshold || '',
    'ec-custom-terms-notes': customer?.custom_terms_notes || ''
  };

  Object.entries(fields).forEach(([id, value]) => {
    const input = document.getElementById(id);
    if (input) input.value = value;
  });
}

async function handleEditCustomer(event) {
  event.preventDefault();
  const customerId = document.getElementById('edit-customer-select').value;

  if (!customerId) {
    showError('Select a customer to edit');
    return;
  }

  const payload = {
    company_name: document.getElementById('ec-company-name').value.trim() || null,
    customer_id: document.getElementById('ec-customer-id').value.trim() || null,
    email: document.getElementById('ec-email').value.trim() || null,
    phone: document.getElementById('ec-phone').value.trim() || null,
    cif: document.getElementById('ec-cif').value.trim() || null,
    trade_register_number: document.getElementById('ec-trade-register').value.trim() || null,
    headquarters_address: document.getElementById('ec-headquarters').value.trim() || null,
    delivery_address: document.getElementById('ec-delivery-address').value.trim() || null,
    notes: document.getElementById('ec-notes').value.trim() || null,
    // Customer parameters
    status: document.getElementById('ec-status').value,
    payment_terms: document.getElementById('ec-payment-terms').value,
    payment_history: document.getElementById('ec-payment-history').value,
    discount_percentage: parseFloat(document.getElementById('ec-discount-percentage').value) || 0,
    credit_limit: parseFloat(document.getElementById('ec-credit-limit').value) || null,
    approval_threshold: parseFloat(document.getElementById('ec-approval-threshold').value) || null,
    custom_terms_notes: document.getElementById('ec-custom-terms-notes').value.trim() || null
  };

  try {
    const response = await fetch(`${API_URL}/customers/${customerId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      showError(data.message || 'Failed to update customer');
      return;
    }

    const idx = allCustomers.findIndex(c => String(c.id) === String(customerId));
    if (idx !== -1) {
      allCustomers[idx] = data.customer;
    }

    if (selectedCustomer && String(selectedCustomer.id) === String(customerId)) {
      selectedCustomer = data.customer;
      showCustomerInfo(selectedCustomer);
    }

    populateCustomerSelect('edit-customer-select', customerId);
    populateCustomerSelect('delete-customer-select');

    closeEditCustomerModal();
    showSuccess('Customer updated successfully');
  } catch (error) {
    showError('Error: ' + error.message);
  }
}

// Delete Customer Modal
function openDeleteCustomerModal() {
  populateCustomerSelect('delete-customer-select', selectedCustomer?.id);
  document.getElementById('delete-customer-modal').classList.add('active');
}

function closeDeleteCustomerModal() {
  document.getElementById('delete-customer-modal').classList.remove('active');
  document.getElementById('delete-customer-form').reset();
}

async function handleDeleteCustomer(event) {
  event.preventDefault();
  const customerId = document.getElementById('delete-customer-select').value;

  if (!customerId) {
    showError('Select a customer to delete');
    return;
  }

  const confirmDelete = window.confirm('Delete this customer? This cannot be undone.');
  if (!confirmDelete) return;

  try {
    const response = await fetch(`${API_URL}/customers/${customerId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${getToken()}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      showError(data.message || 'Failed to delete customer');
      return;
    }

    allCustomers = allCustomers.filter(c => String(c.id) !== String(customerId));

    if (selectedCustomer && String(selectedCustomer.id) === String(customerId)) {
      selectedCustomer = null;
      document.getElementById('customer-id').value = '';
      document.getElementById('customer-search').value = '';
      document.getElementById('selected-customer-info').style.display = 'none';
      document.getElementById('customer-details-grid').innerHTML = '';
    }

    populateCustomerSelect('edit-customer-select');
    populateCustomerSelect('delete-customer-select');
    closeDeleteCustomerModal();
    showSuccess('Customer deleted');
  } catch (error) {
    showError('Error: ' + error.message);
  }
}

// CSV Import Modal
function openImportCsvModal() {
  document.getElementById('import-csv-modal').classList.add('active');
}

function closeImportCsvModal() {
  document.getElementById('import-csv-modal').classList.remove('active');
  document.getElementById('csv-file').value = '';
  document.getElementById('csv-preview').innerHTML = '';
  const importBtn = document.getElementById('csv-import-btn');
  if (importBtn) {
    importBtn.style.display = 'none';
    importBtn.disabled = true;
  }
  csvData = [];
  csvSelectedRows = [];
}

function handleCsvFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    parseCsv(text);
  };
  reader.readAsText(file);
}

function parseCsv(text) {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length === 0) return;

  const headers = lines[0].split(',').map(h => h.trim());
  csvData = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const row = {};
    headers.forEach((header, idx) => {
      row[normalizeHeaderName(header)] = values[idx] || '';
    });
    if (row.company_name || row.email) {
      csvData.push(row);
    }
  }

  renderCsvPreview();
}

function normalizeHeaderName(header) {
  // Map CSV column names to our field names
  const map = {
    'Nume Firma': 'company_name',
    'Email': 'email',
    'Tel': 'phone',
    'C.I.F': 'cif',
    'CIF': 'cif',
    'Nr.RegCom': 'reg_com',
    'Sediu': 'address',
    'Tel Persoanda de contact': 'contact_phone',
    'Email Persoanda de contact': 'contact_email'
  };

  const lower = header.toLowerCase();
  for (const [key, value] of Object.entries(map)) {
    if (lower.includes(key.toLowerCase())) {
      return value;
    }
  }
  return header.toLowerCase().replace(/\s+/g, '_');
}

function renderCsvPreview() {
  const preview = document.getElementById('csv-preview');
  const importBtn = document.getElementById('csv-import-btn');
  if (csvData.length === 0) {
    preview.innerHTML = '<p style="color: #999;">No valid rows found</p>';
    if (importBtn) {
      importBtn.style.display = 'none';
      importBtn.disabled = true;
    }
    return;
  }

  csvSelectedRows = csvData.map((_, i) => i);

  const table = document.createElement('table');
  table.className = 'csv-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th><input type="checkbox" id="select-all-csv" onchange="toggleAllCsvRows(this.checked)"></th>
        <th>Company</th>
        <th>Email</th>
        <th>Phone</th>
        <th>City</th>
      </tr>
    </thead>
    <tbody>
      ${csvData.map((row, idx) => `
        <tr class="selected" data-row-idx="${idx}" onclick="toggleCsvRow(${idx}, event)">
          <td><input type="checkbox" checked onchange="event.stopPropagation()"></td>
          <td>${escapeHtml(row.company_name || '')}</td>
          <td>${escapeHtml(row.email || '')}</td>
          <td>${escapeHtml(row.phone || '')}</td>
          <td>${escapeHtml(row.city || '')}</td>
        </tr>
      `).join('')}
    </tbody>
  `;

  preview.innerHTML = `<p><strong>${csvData.length} rows found</strong> - Select rows to import:</p>`;
  preview.appendChild(table);

  if (importBtn) {
    importBtn.style.display = 'inline-block';
    importBtn.disabled = false;
    importBtn.textContent = `Import ${csvSelectedRows.length} Selected Rows`;
  }
}

function toggleCsvRow(idx, event) {
  const isSelected = csvSelectedRows.includes(idx);
  if (event.target.type === 'checkbox') {
    event.preventDefault();
  }

  const row = event.currentTarget;
  const checkbox = row.querySelector('input[type="checkbox"]');

  if (isSelected) {
    csvSelectedRows = csvSelectedRows.filter(i => i !== idx);
    row.classList.remove('selected');
    checkbox.checked = false;
  } else {
    csvSelectedRows.push(idx);
    row.classList.add('selected');
    checkbox.checked = true;
  }

  updateSelectAllCheckbox();
  updateImportButton();
}

function toggleAllCsvRows(checked) {
  const rows = document.querySelectorAll('.csv-table tbody tr');
  csvSelectedRows = [];

  rows.forEach((row, idx) => {
    const checkbox = row.querySelector('input[type="checkbox"]');
    if (checked) {
      csvSelectedRows.push(idx);
      row.classList.add('selected');
      checkbox.checked = true;
    } else {
      row.classList.remove('selected');
      checkbox.checked = false;
    }
  });

  updateImportButton();
}

function updateSelectAllCheckbox() {
  const allCheckboxes = document.querySelectorAll('.csv-table tbody input[type="checkbox"]');
  const selectAll = document.getElementById('select-all-csv');
  if (selectAll) {
    selectAll.checked = allCheckboxes.length > 0 && Array.from(allCheckboxes).every(cb => cb.checked);
  }
}

function updateImportButton() {
  const importBtn = document.getElementById('csv-import-btn');
  if (!importBtn) return;
  importBtn.disabled = csvSelectedRows.length === 0;
  importBtn.textContent = csvSelectedRows.length > 0
    ? `Import ${csvSelectedRows.length} Selected Rows`
    : 'Import Selected Rows';
}

async function handleImportCsv() {
  if (csvSelectedRows.length === 0) {
    showError('Please select rows to import');
    return;
  }

  const customersToImport = csvSelectedRows.map(idx => csvData[idx]);

  try {
    const response = await fetch(`${API_URL}/customers/import/csv`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({ customers: customersToImport })
    });

    const data = await response.json();

    if (!response.ok) {
      showError(data.message || 'Import failed');
      return;
    }

    allCustomers.push(...(data.customers || []));
    showSuccess(`Imported ${data.imported} customers!`);
    closeImportCsvModal();
  } catch (error) {
    showError('Error: ' + error.message);
  }
}

function addPartField() {
  const partsList = document.getElementById('parts-list');
  const partIndex = partsList.children.length;

  const partItem = document.createElement('div');
  partItem.className = 'part-item';
  partItem.innerHTML = `
    <div class="part-row">
      <input type="text" placeholder="Part name *" name="parts[${partIndex}][part_name]" required>
      <input type="number" placeholder="Qty" name="parts[${partIndex}][quantity]" min="1" value="1" style="width: 80px;">
      <input type="number" placeholder="Time (min)" name="parts[${partIndex}][estimated_time]" min="0" title="Estimated time in minutes">
      <button type="button" class="btn-remove-part" onclick="this.closest('.part-item').remove()">✕</button>
    </div>
    <div class="part-row-2">
      <!-- Step 1: Material Type Search -->
      <div class="material-search-wrapper">
        <input type="text" placeholder="1. Search material type..." class="material-search" data-index="${partIndex}" autocomplete="off">
        <input type="hidden" name="parts[${partIndex}][material_id]">
        <input type="hidden" name="parts[${partIndex}][material_type_name]">
        <div class="material-dropdown"></div>
        <button type="button" class="btn-smart-suggest" onclick="openSmartSuggestions(${partIndex})" title="Smart Material Suggestions">🔍 Smart</button>
      </div>
      <!-- Step 2: Shape Selection -->
      <select name="parts[${partIndex}][shape_type]" class="shape-select" data-index="${partIndex}" title="2. Select shape" disabled>
        <option value="">2. Shape...</option>
        <option value="plate">Plate/Sheet</option>
        <option value="bar_round">Round Bar</option>
        <option value="bar_square">Square Bar</option>
        <option value="bar_hex">Hex Bar</option>
        <option value="tube">Tube</option>
      </select>
      <!-- Step 3: Dimensions (show based on shape) -->
      <div class="dimension-group rect-dims" title="Width x Height x Length" style="display: none;">
        <input type="number" placeholder="W" name="parts[${partIndex}][dim_w]" min="0" step="0.1" style="width: 60px;">
        <span>×</span>
        <input type="number" placeholder="H" name="parts[${partIndex}][dim_h]" min="0" step="0.1" style="width: 60px;">
        <span>×</span>
        <input type="number" placeholder="L" name="parts[${partIndex}][dim_l]" min="0" step="0.1" style="width: 70px;">
      </div>
      <div class="dimension-group round-dims" title="Diameter x Length" style="display: none;">
        <span>⌀</span>
        <input type="number" placeholder="D" name="parts[${partIndex}][dim_d]" min="0" step="0.1" style="width: 60px;">
        <span>×</span>
        <input type="number" placeholder="L" name="parts[${partIndex}][dim_dl]" min="0" step="0.1" style="width: 70px;">
      </div>
      <div class="dimension-group tube-dims" title="Outer ⌀ x Wall x Length" style="display: none;">
        <span>⌀</span>
        <input type="number" placeholder="OD" name="parts[${partIndex}][dim_od]" min="0" step="0.1" style="width: 55px;" title="Outer Diameter">
        <span>t</span>
        <input type="number" placeholder="Wall" name="parts[${partIndex}][dim_wall]" min="0" step="0.1" style="width: 50px;" title="Wall thickness">
        <span>×</span>
        <input type="number" placeholder="L" name="parts[${partIndex}][dim_tl]" min="0" step="0.1" style="width: 60px;">
      </div>
      <select name="parts[${partIndex}][priority]" title="Priority">
        <option value="normal" selected>🟢 Normal</option>
        <option value="urgent">🔴 Urgent</option>
        <option value="high">🟠 High</option>
        <option value="low">🔵 Low</option>
      </select>
    </div>
    <div class="part-row-3">
      <div style="display: flex; gap: 0.5rem; align-items: center;">
        <button type="button" class="folder-select-btn" onclick="selectFolder(${partIndex})">📁 Select Folder</button>
        <span class="folder-display" id="folder-display-${partIndex}">No folder selected</span>
        <input type="hidden" name="parts[${partIndex}][file_folder]">
      </div>
      <textarea placeholder="Description / Notes" name="parts[${partIndex}][description]" style="resize: none; min-height: 40px;"></textarea>
    </div>
  `;

  partsList.appendChild(partItem);
  setupMaterialSearch(partItem, partIndex);
  setupShapeSelect(partItem, partIndex);
}

function setupMaterialSearch(partItem, index) {
  const searchInput = partItem.querySelector('.material-search');
  const dropdown = partItem.querySelector('.material-dropdown');
  const hiddenInput = partItem.querySelector(`input[name="parts[${index}][material_id]"]`);
  const hiddenTypeName = partItem.querySelector(`input[name="parts[${index}][material_type_name]"]`);
  const shapeSelect = partItem.querySelector('.shape-select');

  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    if (!query || query.length < 2) {
      dropdown.classList.remove('active');
      return;
    }

    // Search material types (not stock)
    searchMaterialTypesForPart(query, dropdown, searchInput, hiddenInput, hiddenTypeName, shapeSelect);
  });

  searchInput.addEventListener('focus', () => {
    if (searchInput.value.length >= 2) {
      const query = searchInput.value.toLowerCase();
      searchMaterialTypesForPart(query, dropdown, searchInput, hiddenInput, hiddenTypeName, shapeSelect);
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.material-search-wrapper')) {
      dropdown.classList.remove('active');
    }
  });
}

async function searchMaterialTypesForPart(query, dropdown, searchInput, hiddenInput, hiddenTypeName, shapeSelect) {
  try {
    const response = await api.request(`/materials/types/search/${encodeURIComponent(query)}`);
    if (response.success && response.materialTypes) {
      renderMaterialTypeDropdown(dropdown, response.materialTypes, searchInput, hiddenInput, hiddenTypeName, shapeSelect);
      dropdown.classList.add('active');
    }
  } catch (error) {
    console.error('Error searching material types:', error);
    // Fallback to local materials search
    const filtered = allMaterials.filter(m =>
      (m.material_name && m.material_name.toLowerCase().includes(query)) ||
      (m.material_type && m.material_type.toLowerCase().includes(query))
    );
    renderMaterialDropdownFallback(dropdown, filtered, searchInput, hiddenInput, shapeSelect);
    dropdown.classList.add('active');
  }
}

function renderMaterialTypeDropdown(dropdown, types, searchInput, hiddenInput, hiddenTypeName, shapeSelect) {
  if (types.length === 0) {
    dropdown.innerHTML = '<div class="material-option" style="color: #999;">No material types found</div>';
    return;
  }

  dropdown.innerHTML = types.map(t => `
    <div class="material-option" data-id="${t.id}" data-name="${escapeHtml(t.name)}" data-spec="${t.specification_code || ''}">
      <strong>${escapeHtml(t.name)}</strong>
      ${t.specification_code ? `<span style="color: #666; margin-left: 8px;">(${t.specification_code})</span>` : ''}
      <div style="font-size: 0.85rem; color: #666;">${t.category || ''}</div>
    </div>
  `).join('');

  dropdown.querySelectorAll('.material-option').forEach(opt => {
    opt.addEventListener('click', () => {
      const name = opt.dataset.name;
      const spec = opt.dataset.spec;
      searchInput.value = spec ? `${name} (${spec})` : name;
      hiddenInput.value = opt.dataset.id;
      if (hiddenTypeName) hiddenTypeName.value = name;
      dropdown.classList.remove('active');
      
      // Enable shape select after material type is chosen
      shapeSelect.disabled = false;
      shapeSelect.focus();
    });
  });
}

function renderMaterialDropdownFallback(dropdown, materials, searchInput, hiddenInput, shapeSelect) {
  if (materials.length === 0) {
    dropdown.innerHTML = '<div class="material-option" style="color: #999;">No materials found</div>';
    return;
  }

  dropdown.innerHTML = materials.map(m => `
    <div class="material-option" data-id="${m.id}" data-name="${escapeHtml(m.material_name)}">
      <strong>${escapeHtml(m.material_name)}</strong>
      <div style="font-size: 0.85rem; color: #666;">${m.material_type || ''} • Stock: ${m.current_stock} ${m.unit || ''}</div>
    </div>
  `).join('');

  dropdown.querySelectorAll('.material-option').forEach(opt => {
    opt.addEventListener('click', () => {
      searchInput.value = opt.dataset.name;
      hiddenInput.value = opt.dataset.id;
      dropdown.classList.remove('active');
      shapeSelect.disabled = false;
      shapeSelect.focus();
    });
  });
}

function setupShapeSelect(partItem, partIndex) {
  const shapeSelect = partItem.querySelector('.shape-select');
  const rectDims = partItem.querySelector('.rect-dims');
  const roundDims = partItem.querySelector('.round-dims');
  const tubeDims = partItem.querySelector('.tube-dims');

  shapeSelect.addEventListener('change', (e) => {
    const shape = e.target.value;
    
    // Hide all dimension groups first
    rectDims.style.display = 'none';
    roundDims.style.display = 'none';
    tubeDims.style.display = 'none';

    // Show appropriate dimension fields based on shape
    switch (shape) {
      case 'plate':
      case 'bar_square':
        rectDims.style.display = 'flex';
        break;
      case 'bar_round':
      case 'bar_hex':
        roundDims.style.display = 'flex';
        break;
      case 'tube':
        tubeDims.style.display = 'flex';
        break;
    }

    // Focus first dimension input
    if (shape) {
      const firstInput = partItem.querySelector('.dimension-group:not([style*="display: none"]) input');
      if (firstInput) firstInput.focus();
    }
  });
}

// Smart Material Suggestions Modal
let currentSuggestionPartIndex = null;
let materialSelectorInstance = null;

function openSmartSuggestions(partIndex) {
  currentSuggestionPartIndex = partIndex;
  
  // Get current part data to pre-fill the modal
  const partItem = document.querySelector(`#parts-list .part-item:nth-child(${partIndex + 1})`);
  const materialType = partItem?.querySelector('.material-search')?.value || '';
  const shapeType = partItem?.querySelector('.shape-select')?.value || '';
  
  // Get dimensions based on shape
  let dimensions = {};
  if (shapeType === 'plate' || shapeType === 'bar_square') {
    dimensions.width = partItem?.querySelector(`input[name="parts[${partIndex}][dim_w]"]`)?.value || '';
    dimensions.height = partItem?.querySelector(`input[name="parts[${partIndex}][dim_h]"]`)?.value || '';
    dimensions.length = partItem?.querySelector(`input[name="parts[${partIndex}][dim_l]"]`)?.value || '';
  } else if (shapeType === 'bar_round' || shapeType === 'bar_hex') {
    dimensions.diameter = partItem?.querySelector(`input[name="parts[${partIndex}][dim_d]"]`)?.value || '';
    dimensions.length = partItem?.querySelector(`input[name="parts[${partIndex}][dim_dl]"]`)?.value || '';
  } else if (shapeType === 'tube') {
    dimensions.diameter = partItem?.querySelector(`input[name="parts[${partIndex}][dim_od]"]`)?.value || '';
    dimensions.wall = partItem?.querySelector(`input[name="parts[${partIndex}][dim_wall]"]`)?.value || '';
    dimensions.length = partItem?.querySelector(`input[name="parts[${partIndex}][dim_tl]"]`)?.value || '';
  }
  
  // Create modal if not exists
  let modal = document.getElementById('material-suggestion-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'material-suggestion-modal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 900px; max-height: 90vh; overflow-y: auto;">
        <div class="modal-header">
          <h3>🔍 Find Available Materials</h3>
          <button class="modal-close" onclick="closeSmartSuggestions()">&times;</button>
        </div>
        <div class="modal-body">
          <div id="material-selector-container"></div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  
  modal.style.display = 'flex';
  
  // Initialize MaterialSelector with pre-filled data
  if (typeof MaterialSelector !== 'undefined') {
    materialSelectorInstance = new MaterialSelector('material-selector-container', {
      onMaterialSelected: (material) => {
        applySelectedMaterial(currentSuggestionPartIndex, material);
        closeSmartSuggestions();
      },
      showQuantity: false,
      prefill: {
        materialType: materialType,
        shapeType: shapeType,
        dimensions: dimensions
      }
    });
  } else {
    document.getElementById('material-selector-container').innerHTML = 
      '<p class="text-center text-muted">MaterialSelector component not loaded.</p>';
  }
}

function closeSmartSuggestions() {
  const modal = document.getElementById('material-suggestion-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

function applySelectedMaterial(partIndex, material) {
  const partItem = document.querySelector(`#parts-list .part-item:nth-child(${partIndex + 1})`);
  if (!partItem) return;
  
  // Set material search input
  const searchInput = partItem.querySelector('.material-search');
  const hiddenInput = partItem.querySelector(`input[name="parts[${partIndex}][material_id]"]`);
  
  if (searchInput && material.material_name) {
    searchInput.value = material.material_name;
  }
  
  // Handle "needs order" case
  if (material.needs_order) {
    hiddenInput.value = 'NEEDS_ORDER';
    searchInput.value = `⚠️ ${material.material_name} (NEEDS ORDER)`;
    searchInput.style.borderColor = '#f59e0b';
    searchInput.style.backgroundColor = '#fef3c7';
    
    // Store needs_order flag
    let needsOrderInput = partItem.querySelector(`input[name="parts[${partIndex}][needs_order]"]`);
    if (!needsOrderInput) {
      needsOrderInput = document.createElement('input');
      needsOrderInput.type = 'hidden';
      needsOrderInput.name = `parts[${partIndex}][needs_order]`;
      partItem.appendChild(needsOrderInput);
    }
    needsOrderInput.value = 'true';
    return;
  }
  
  if (hiddenInput && material.stock_id) {
    hiddenInput.value = material.stock_id;
  }
  
  // Set dimensions if available
  if (material.dimensions) {
    const dims = material.dimensions;
    if (dims.height) {
      const hInput = partItem.querySelector(`input[name="parts[${partIndex}][dim_h]"]`);
      if (hInput) hInput.value = dims.height;
    }
    if (dims.width) {
      const wInput = partItem.querySelector(`input[name="parts[${partIndex}][dim_w]"]`);
      if (wInput) wInput.value = dims.width;
    }
    if (dims.length) {
      const lInput = partItem.querySelector(`input[name="parts[${partIndex}][dim_l]"]`);
      if (lInput) lInput.value = dims.length;
    }
    if (dims.diameter) {
      const dInput = partItem.querySelector(`input[name="parts[${partIndex}][dim_d]"]`);
      if (dInput) dInput.value = dims.diameter;
    }
  }
  
  // Visual feedback - green for success
  searchInput.style.borderColor = '#22c55e';
  searchInput.style.backgroundColor = '#dcfce7';
  setTimeout(() => {
    searchInput.style.borderColor = '';
    searchInput.style.backgroundColor = '';
  }, 2000);
}

function selectFolder(partIndex) {
  // For now, prompt for folder path - in production this could be a file browser
  const folder = prompt('Enter folder path for drawings/files:', '');
  if (folder !== null) {
    document.querySelector(`input[name="parts[${partIndex}][file_folder]"]`).value = folder;
    document.getElementById(`folder-display-${partIndex}`).textContent = folder || 'No folder selected';
  }
}

async function loadMaterialsForSelect(selectElement) {
  try {
    const response = await fetch(`${API_URL}/materials`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });

    const data = await response.json();

    selectElement.innerHTML = '<option value="">Select Material</option>';

    if (data.success && data.materials && Array.isArray(data.materials)) {
      data.materials.forEach(material => {
        const option = document.createElement('option');
        option.value = material.id;
        option.textContent = `${material.material_name} (${material.current_stock} ${material.unit})`;
        selectElement.appendChild(option);
      });
    } else if (data.materials && Array.isArray(data.materials)) {
      data.materials.forEach(material => {
        const option = document.createElement('option');
        option.value = material.id;
        option.textContent = `${material.material_name} (${material.current_stock} ${material.unit})`;
        selectElement.appendChild(option);
      });
    }
  } catch (error) {
    console.error('Error loading materials:', error);
    selectElement.innerHTML = '<option value="">Error loading materials</option>';
  }
}

async function handleCreateOrder(event) {
  event.preventDefault();

  document.getElementById('error-message').style.display = 'none';
  document.getElementById('success-message').style.display = 'none';

  const customerId = document.getElementById('customer-id').value;
  const manualName = document.getElementById('manual-customer-name').value.trim();
  const manualEmail = document.getElementById('manual-customer-email').value.trim();
  const manualPhone = document.getElementById('manual-customer-phone').value.trim();

  if (!customerId && (!manualName || !manualEmail)) {
    showError('Please select a customer or enter name and email');
    return;
  }

  // Check if customer is closed/dead - block order creation
  if (selectedCustomer && selectedCustomer.status === 'closed') {
    if (!confirm('⚠️ Warning: This company is marked as CLOSED/DEAD.\n\nAre you sure you want to create an order for this customer?')) {
      return;
    }
  }

  // Check if customer is bankrupt - warn
  if (selectedCustomer && selectedCustomer.status === 'bankrupt') {
    if (!confirm('⚠️ Warning: This customer is in BANKRUPTCY.\n\nThis order may require admin approval. Continue?')) {
      return;
    }
  }

  // Check for bad payment history
  if (selectedCustomer && selectedCustomer.payment_history === 'bad') {
    if (!confirm('⚠️ Warning: This customer has a BAD PAYMENT HISTORY.\n\nThis order may require admin approval. Continue?')) {
      return;
    }
  }

  // Determine if order requires approval
  const requiresApproval = selectedCustomer && checkIfRequiresApproval(selectedCustomer);
  
  // Get discount percentage from customer
  const discountApplied = selectedCustomer ? (parseFloat(selectedCustomer.discount_percentage) || 0) : 0;

  const order = {
    customer_id: customerId || null,
    customer_name: selectedCustomer?.company_name || manualName,
    customer_email: selectedCustomer?.email || manualEmail,
    customer_phone: selectedCustomer?.phone || manualPhone,
    invoice_contact_id: document.getElementById('invoice-contact').value || null,
    order_contact_id: document.getElementById('order-contact').value || null,
    technical_contact_id: document.getElementById('technical-contact').value || null,
    delivery_address: document.getElementById('delivery-address').value.trim() || null,
    order_date: document.getElementById('order-date').value,
    due_date: document.getElementById('due-date').value,
    priority: document.getElementById('priority').value,
    notes: document.getElementById('notes').value.trim(),
    // Order approval fields (Phase 2 ready)
    discount_applied: discountApplied,
    requires_approval: requiresApproval,
    approval_status: requiresApproval ? 'pending_approval' : 'approved',
    parts: []
  };

  if (!order.order_date || !order.due_date) {
    showError('Please fill in order date and due date');
    return;
  }

  const partsList = document.getElementById('parts-list');
  partsList.querySelectorAll('.part-item').forEach((item) => {
    const partName = item.querySelector('input[name*="part_name"]').value.trim();
    if (partName) {
      // Build dimensions string from inputs
      const dimH = item.querySelector('input[name*="dim_h"]')?.value;
      const dimW = item.querySelector('input[name*="dim_w"]')?.value;
      const dimL = item.querySelector('input[name*="dim_l"]')?.value;
      const dimD = item.querySelector('input[name*="dim_d"]')?.value;
      const dimDL = item.querySelector('input[name*="dim_dl"]')?.value;

      let dimensions = '';
      if (dimH && dimW && dimL) {
        dimensions = `${dimH}×${dimW}×${dimL}`;
      } else if (dimD && dimDL) {
        dimensions = `⌀${dimD}×${dimDL}`;
      }

      order.parts.push({
        part_name: partName,
        description: item.querySelector('textarea[name*="description"]')?.value.trim() || '',
        quantity: parseInt(item.querySelector('input[name*="quantity"]')?.value) || 1,
        material_id: item.querySelector('input[name*="material_id"][type="hidden"]')?.value || null,
        material_dimensions: dimensions || null,
        estimated_time: parseInt(item.querySelector('input[name*="estimated_time"]')?.value) || null,
        file_folder: item.querySelector('input[name*="file_folder"]')?.value || null,
        priority: item.querySelector('select[name*="priority"]')?.value || 'normal'
      });
    }
  });

  if (order.parts.length === 0) {
    showError('Please add at least one part');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify(order)
    });

    const data = await response.json();

    if (!response.ok) {
      showError(data.message || 'Failed to create order');
      return;
    }

    let successMsg = 'Order created!';
    if (requiresApproval) {
      successMsg += ' (Requires approval)';
    }
    if (discountApplied !== 0) {
      successMsg += discountApplied > 0 ? ` (${discountApplied}% discount applied)` : ` (${Math.abs(discountApplied)}% fee applied)`;
    }
    successMsg += ' Redirecting...';
    
    showSuccess(successMsg);
    setTimeout(() => navigateTo('order-dashboard.html'), 1500);
  } catch (error) {
    showError('Error: ' + error.message);
  }
}

// Check if customer requires approval for orders
function checkIfRequiresApproval(customer) {
  // Status-based rules
  if (['inactive', 'bankrupt', 'closed'].includes(customer.status)) {
    return true;
  }
  
  // Payment history rules
  if (['bad', 'delayed'].includes(customer.payment_history)) {
    return true;
  }
  
  // Prepayment required
  if (customer.payment_terms === 'prepayment_required') {
    return true;
  }
  
  return false;
}

function showError(message) {
  const el = document.getElementById('error-message');
  el.textContent = message;
  el.style.display = 'block';
}

function showSuccess(message) {
  const el = document.getElementById('success-message');
  el.textContent = message;
  el.style.display = 'block';
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return (text || '').replace(/[&<>"']/g, m => map[m]);
}
