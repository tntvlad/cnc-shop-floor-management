// Create Order JS with Customer Management
let allCustomers = [];
let selectedCustomer = null;
let csvData = [];
let csvSelectedRows = [];

document.addEventListener('DOMContentLoaded', function() {
  ensureAuthed();
  setTodayDate();
  addPartField();
  loadCustomers();
  setupCustomerSearch();
});

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
  }
}

function showCustomerInfo(customer) {
  const grid = document.getElementById('customer-details-grid');
  const info = document.getElementById('selected-customer-info');

  const items = [
    { label: 'Company', value: customer.company_name },
    { label: 'Email', value: customer.email },
    { label: 'Phone', value: customer.phone || '—' },
    { label: 'Contact', value: customer.contact_person || '—' },
    { label: 'CIF', value: customer.cif || '—' },
    { label: 'Address', value: customer.address || '—' },
    { label: 'Tech Contact', value: customer.technical_contact_person || '—' },
    { label: 'Tech Email', value: customer.technical_email || '—' }
  ];

  grid.innerHTML = items.map(item => `
    <div class="info-item">
      <div class="info-label">${item.label}</div>
      <div class="info-value">${escapeHtml(item.value)}</div>
    </div>
  `).join('');

  info.style.display = 'block';
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
    email: document.getElementById('ac-email').value.trim(),
    phone: document.getElementById('ac-phone').value.trim(),
    cif: document.getElementById('ac-cif').value.trim(),
    address: document.getElementById('ac-address').value.trim(),
    city: document.getElementById('ac-city').value.trim(),
    contact_person: document.getElementById('ac-contact-person').value.trim(),
    contact_phone: document.getElementById('ac-contact-phone').value.trim(),
    contact_email: document.getElementById('ac-contact-email').value.trim(),
    technical_contact_person: document.getElementById('ac-technical-contact').value.trim(),
    technical_phone: document.getElementById('ac-technical-phone').value.trim(),
    technical_email: document.getElementById('ac-technical-email').value.trim(),
    processing_notes: document.getElementById('ac-processing-notes').value.trim(),
    delivery_notes: document.getElementById('ac-delivery-notes').value.trim(),
    billing_notes: document.getElementById('ac-billing-notes').value.trim()
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
    'ec-email': customer?.email || '',
    'ec-phone': customer?.phone || '',
    'ec-cif': customer?.cif || '',
    'ec-address': customer?.address || '',
    'ec-city': customer?.city || '',
    'ec-contact-person': customer?.contact_person || '',
    'ec-contact-phone': customer?.contact_phone || '',
    'ec-contact-email': customer?.contact_email || ''
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
    email: document.getElementById('ec-email').value.trim() || null,
    phone: document.getElementById('ec-phone').value.trim() || null,
    cif: document.getElementById('ec-cif').value.trim() || null,
    address: document.getElementById('ec-address').value.trim() || null,
    city: document.getElementById('ec-city').value.trim() || null,
    contact_person: document.getElementById('ec-contact-person').value.trim() || null,
    contact_phone: document.getElementById('ec-contact-phone').value.trim() || null,
    contact_email: document.getElementById('ec-contact-email').value.trim() || null
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
    <input type="text" placeholder="Part name" name="parts[${partIndex}][part_name]">
    <textarea placeholder="Description" name="parts[${partIndex}][description]" style="resize: none; min-height: auto;"></textarea>
    <input type="number" placeholder="Qty" name="parts[${partIndex}][quantity]" min="1" value="1">
    <select name="parts[${partIndex}][material_id]">
      <option value="">Select Material</option>
    </select>
    <button type="button" class="btn-remove-part" onclick="this.parentElement.remove()">Remove</button>
  `;

  partsList.appendChild(partItem);
  loadMaterialsForSelect(partItem.querySelector('select'));
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

  const order = {
    customer_id: customerId || null,
    customer_name: selectedCustomer?.company_name || manualName,
    customer_email: selectedCustomer?.email || manualEmail,
    customer_phone: selectedCustomer?.phone || manualPhone,
    order_date: document.getElementById('order-date').value,
    due_date: document.getElementById('due-date').value,
    priority: document.getElementById('priority').value,
    notes: document.getElementById('notes').value.trim(),
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
      order.parts.push({
        part_name: partName,
        description: item.querySelector('textarea[name*="description"]').value.trim() || '',
        quantity: parseInt(item.querySelector('input[name*="quantity"]').value) || 1,
        material_id: item.querySelector('select[name*="material_id"]').value || null
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

    showSuccess('Order created! Redirecting...');
    setTimeout(() => navigateTo('order-dashboard.html'), 1500);
  } catch (error) {
    showError('Error: ' + error.message);
  }
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
