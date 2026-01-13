// Customer Management JS
let allCustomers = [];
let currentCustomer = null;
let currentContacts = [];

document.addEventListener('DOMContentLoaded', function() {
  // Only run auto-init on standalone customers.html page
  // On admin-settings.html, switchAdminTab calls loadCustomers() and setupSearch() directly
  if (window.location.pathname.includes('customers.html')) {
    ensureAuthed();
    checkPageAccess();
    loadCurrentUser();
    loadCustomers();
    setupSearch();
  }
});

// Check if user has access to this page (Supervisor+ level 400+)
function checkPageAccess() {
  const user = Auth.getUser();
  const isSupervisorPlus = (typeof user.level === 'number' && user.level >= 400)
    || (user.role && (user.role === 'admin' || user.role === 'supervisor'));
  
  if (!isSupervisorPlus) {
    // Redirect operators to dashboard
    window.location.href = 'index.html';
    return;
  }
}

function loadCurrentUser() {
  const user = Auth.getUser();
  if (user && user.name) {
    const userNameEl = document.getElementById('userName');
    if (userNameEl) {
      userNameEl.textContent = user.name;
    }
  }
  
  // Show navigation links for supervisors+
  const isSupervisorPlus = (typeof user.level === 'number' && user.level >= 400)
    || (user.role && (user.role === 'admin' || user.role === 'supervisor'));
  
  if (isSupervisorPlus) {
    const supervisorLink = document.getElementById('supervisorLink');
    const adminLink = document.getElementById('adminLink');
    if (supervisorLink) supervisorLink.style.display = 'inline-flex';
    if (adminLink) adminLink.style.display = 'inline-flex';
  }
}

function setupSearch() {
  const searchInput = document.getElementById('search-input');
  if (!searchInput) return; // Guard for pages where search doesn't exist
  
  let debounceTimer;
  
  searchInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      loadCustomers(e.target.value);
    }, 300);
  });
}

async function loadCustomers(search = '') {
  try {
    let url = `${API_URL}/customers`;
    if (search) {
      url += `?search=${encodeURIComponent(search)}`;
    }

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });

    const data = await response.json();

    if (!response.ok) {
      showAlert('Failed to load customers', 'danger');
      return;
    }

    allCustomers = data.customers || [];
    renderCustomers();
  } catch (error) {
    console.error('Error loading customers:', error);
    showAlert('Error loading customers: ' + error.message, 'danger');
  }
}

function renderCustomers() {
  const grid = document.getElementById('customers-grid');

  if (allCustomers.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: #666;">
        <div style="font-size: 3rem; margin-bottom: 1rem;">👥</div>
        <h3>No customers found</h3>
        <p>Add your first customer to get started</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = allCustomers.map(customer => {
    const statusBadge = getStatusBadge(customer.status);
    const paymentBadge = getPaymentHistoryBadge(customer.payment_history);
    const discountBadge = getDiscountBadge(customer.discount_percentage);
    const warningBanner = getCustomerWarningBanner(customer);
    
    return `
    <div class="customer-card">
      <div class="customer-card-header">
        <h3>${escapeHtml(customer.company_name)}</h3>
        ${customer.customer_id ? `<span class="customer-id-badge">${escapeHtml(customer.customer_id)}</span>` : ''}
        <div class="customer-badges">
          ${statusBadge}
          ${paymentBadge}
          ${discountBadge}
        </div>
      </div>
      <div class="customer-card-body">
        ${warningBanner}
        <div class="info-row">
          <span class="info-label">Email</span>
          <span class="info-value">${escapeHtml(customer.email)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Phone</span>
          <span class="info-value">${escapeHtml(customer.phone || '—')}</span>
        </div>
        <div class="info-row">
          <span class="info-label">CIF</span>
          <span class="info-value">${escapeHtml(customer.cif || '—')}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Trade Register</span>
          <span class="info-value">${escapeHtml(customer.trade_register_number || customer.reg_com || '—')}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Payment Terms</span>
          <span class="info-value">${formatPaymentTerms(customer.payment_terms)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Contacts</span>
          <span class="info-value">${customer.contact_count || 0} contact(s)</span>
        </div>
        <div class="info-row">
          <span class="info-label">📁 Folder</span>
          <span class="info-value">${customer.folder_path ? escapeHtml(customer.folder_path) : '<em style="color: #999;">Not assigned</em>'}</span>
        </div>
      </div>
      <div class="customer-card-actions">
        <button class="btn-edit" onclick="openEditCustomerModal(${customer.id})">✏️ Edit</button>
        <button class="btn-contacts" onclick="openContactsModal(${customer.id})">👤 Contacts</button>
        <button class="btn-delete" onclick="deleteCustomer(${customer.id})">🗑️</button>
      </div>
    </div>
  `;}).join('');
}

// Customer Modal Functions
async function openAddCustomerModal() {
  document.getElementById('customer-modal-title').textContent = 'Add Customer';
  document.getElementById('customer-form').reset();
  document.getElementById('customer-id').value = '';
  await loadClientFolders();
  document.getElementById('customer-modal').classList.add('active');
}

async function openEditCustomerModal(customerId) {
  const customer = allCustomers.find(c => c.id === customerId);
  if (!customer) return;

  document.getElementById('customer-modal-title').textContent = 'Edit Customer';
  document.getElementById('customer-id').value = customer.id;
  document.getElementById('company-name').value = customer.company_name || '';
  document.getElementById('customer-code').value = customer.customer_id || '';
  document.getElementById('email').value = customer.email || '';
  document.getElementById('phone').value = customer.phone || '';
  document.getElementById('cif').value = customer.cif || '';
  document.getElementById('trade-register').value = customer.trade_register_number || customer.reg_com || '';
  document.getElementById('headquarters').value = customer.headquarters_address || customer.address || '';
  document.getElementById('delivery-address').value = customer.delivery_address || '';
  document.getElementById('notes').value = customer.notes || '';
  
  // Customer parameters
  document.getElementById('status').value = customer.status || 'active';
  document.getElementById('payment-terms').value = customer.payment_terms || 'standard_credit';
  document.getElementById('payment-history').value = customer.payment_history || 'new_customer';
  document.getElementById('discount-percentage').value = customer.discount_percentage || 0;
  document.getElementById('credit-limit').value = customer.credit_limit || '';
  document.getElementById('approval-threshold').value = customer.approval_threshold || '';
  document.getElementById('custom-terms-notes').value = customer.custom_terms_notes || '';

  // Load folders and set current value
  await loadClientFolders(customer.folder_path);

  document.getElementById('customer-modal').classList.add('active');
}

function closeCustomerModal() {
  document.getElementById('customer-modal').classList.remove('active');
}

async function handleSaveCustomer(event) {
  event.preventDefault();

  const customerId = document.getElementById('customer-id').value;
  const isEdit = !!customerId;

  const payload = {
    company_name: document.getElementById('company-name').value.trim(),
    customer_id: document.getElementById('customer-code').value.trim() || null,
    email: document.getElementById('email').value.trim(),
    phone: document.getElementById('phone').value.trim() || null,
    cif: document.getElementById('cif').value.trim() || null,
    trade_register_number: document.getElementById('trade-register').value.trim() || null,
    headquarters_address: document.getElementById('headquarters').value.trim() || null,
    delivery_address: document.getElementById('delivery-address').value.trim() || null,
    notes: document.getElementById('notes').value.trim() || null,
    // Customer parameters
    status: document.getElementById('status').value,
    payment_terms: document.getElementById('payment-terms').value,
    payment_history: document.getElementById('payment-history').value,
    discount_percentage: parseFloat(document.getElementById('discount-percentage').value) || 0,
    credit_limit: parseFloat(document.getElementById('credit-limit').value) || null,
    approval_threshold: parseFloat(document.getElementById('approval-threshold').value) || null,
    custom_terms_notes: document.getElementById('custom-terms-notes').value.trim() || null,
    // Client folder
    folder_path: document.getElementById('folder-path').value || null
  };

  try {
    const url = isEdit ? `${API_URL}/customers/${customerId}` : `${API_URL}/customers`;
    const method = isEdit ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      showAlert(data.message || 'Failed to save customer', 'danger');
      return;
    }

    showAlert(isEdit ? 'Customer updated successfully' : 'Customer created successfully', 'success');
    closeCustomerModal();
    loadCustomers(document.getElementById('search-input').value);
  } catch (error) {
    showAlert('Error: ' + error.message, 'danger');
  }
}

async function deleteCustomer(customerId) {
  const customer = allCustomers.find(c => c.id === customerId);
  if (!customer) return;

  if (!confirm(`Delete "${customer.company_name}"? This cannot be undone.`)) {
    return;
  }

  try {
    const response = await fetch(`${API_URL}/customers/${customerId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });

    const data = await response.json();

    if (!response.ok) {
      showAlert(data.message || 'Failed to delete customer', 'danger');
      return;
    }

    showAlert('Customer deleted', 'success');
    loadCustomers(document.getElementById('search-input').value);
  } catch (error) {
    showAlert('Error: ' + error.message, 'danger');
  }
}

// Contacts Modal Functions
async function openContactsModal(customerId) {
  const customer = allCustomers.find(c => c.id === customerId);
  if (!customer) return;

  currentCustomer = customer;
  document.getElementById('contacts-customer-name').textContent = customer.company_name;

  try {
    const response = await fetch(`${API_URL}/customers/${customerId}/contacts`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });

    const data = await response.json();

    if (!response.ok) {
      showAlert('Failed to load contacts', 'danger');
      return;
    }

    currentContacts = data.contacts || [];
    renderContacts(data.grouped || {});
    document.getElementById('contacts-modal').classList.add('active');
  } catch (error) {
    showAlert('Error: ' + error.message, 'danger');
  }
}

function renderContacts(grouped) {
  renderContactList('invoice-contacts-list', grouped.invoice || []);
  renderContactList('order-contacts-list', grouped.order || []);
  renderContactList('technical-contacts-list', grouped.technical || []);
}

function renderContactList(containerId, contacts) {
  const container = document.getElementById(containerId);

  if (contacts.length === 0) {
    container.innerHTML = '<div class="empty-contacts">No contacts added yet</div>';
    return;
  }

  container.innerHTML = contacts.map(contact => `
    <div class="contact-item">
      <div class="contact-info">
        <div class="contact-name">
          ${escapeHtml(contact.name)}
          ${contact.is_primary ? '<span style="color: #28a745; font-size: 0.8rem;"> ★ Primary</span>' : ''}
        </div>
        <div class="contact-details">
          ${contact.phone ? `📞 ${escapeHtml(contact.phone)}` : ''}
          ${contact.phone && contact.email ? ' • ' : ''}
          ${contact.email ? `✉️ ${escapeHtml(contact.email)}` : ''}
        </div>
      </div>
      <div class="contact-actions">
        <button class="btn-icon" onclick="openEditContactModal(${contact.id})" title="Edit">✏️</button>
        <button class="btn-icon" onclick="deleteContact(${contact.id})" title="Delete">🗑️</button>
      </div>
    </div>
  `).join('');
}

function closeContactsModal() {
  document.getElementById('contacts-modal').classList.remove('active');
  currentCustomer = null;
  currentContacts = [];
}

// Contact Modal Functions
function openAddContactModal(type) {
  document.getElementById('contact-modal-title').textContent = 'Add Contact';
  document.getElementById('contact-form').reset();
  document.getElementById('contact-id').value = '';
  document.getElementById('contact-customer-id').value = currentCustomer.id;
  document.getElementById('contact-type').value = type;
  document.getElementById('contact-modal').classList.add('active');
}

function openEditContactModal(contactId) {
  const contact = currentContacts.find(c => c.id === contactId);
  if (!contact) return;

  document.getElementById('contact-modal-title').textContent = 'Edit Contact';
  document.getElementById('contact-id').value = contact.id;
  document.getElementById('contact-customer-id').value = currentCustomer.id;
  document.getElementById('contact-type').value = contact.contact_type;
  document.getElementById('contact-name').value = contact.name || '';
  document.getElementById('contact-phone').value = contact.phone || '';
  document.getElementById('contact-email').value = contact.email || '';
  document.getElementById('contact-primary').checked = contact.is_primary || false;
  document.getElementById('contact-notes').value = contact.notes || '';

  document.getElementById('contact-modal').classList.add('active');
}

function closeContactModal() {
  document.getElementById('contact-modal').classList.remove('active');
}

async function handleSaveContact(event) {
  event.preventDefault();

  const contactId = document.getElementById('contact-id').value;
  const customerId = document.getElementById('contact-customer-id').value;
  const isEdit = !!contactId;

  const payload = {
    contact_type: document.getElementById('contact-type').value,
    name: document.getElementById('contact-name').value.trim(),
    phone: document.getElementById('contact-phone').value.trim() || null,
    email: document.getElementById('contact-email').value.trim() || null,
    is_primary: document.getElementById('contact-primary').checked,
    notes: document.getElementById('contact-notes').value.trim() || null
  };

  try {
    const url = isEdit
      ? `${API_URL}/customers/${customerId}/contacts/${contactId}`
      : `${API_URL}/customers/${customerId}/contacts`;
    const method = isEdit ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      showAlert(data.message || 'Failed to save contact', 'danger');
      return;
    }

    showAlert(isEdit ? 'Contact updated' : 'Contact added', 'success');
    closeContactModal();
    
    // Refresh contacts list
    await openContactsModal(customerId);
  } catch (error) {
    showAlert('Error: ' + error.message, 'danger');
  }
}

async function deleteContact(contactId) {
  if (!confirm('Delete this contact?')) return;

  try {
    const response = await fetch(`${API_URL}/customers/${currentCustomer.id}/contacts/${contactId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });

    const data = await response.json();

    if (!response.ok) {
      showAlert(data.message || 'Failed to delete contact', 'danger');
      return;
    }

    showAlert('Contact deleted', 'success');
    await openContactsModal(currentCustomer.id);
  } catch (error) {
    showAlert('Error: ' + error.message, 'danger');
  }
}

// Utility Functions
function showAlert(message, type) {
  const container = document.getElementById('alert-container');
  const alert = document.createElement('div');
  alert.className = `alert alert-${type}`;
  alert.textContent = message;
  container.appendChild(alert);

  setTimeout(() => alert.remove(), 5000);
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

// Customer Parameter Helper Functions
function getStatusBadge(status) {
  const statusMap = {
    'active': { label: '✅ Active', class: 'status-active' },
    'inactive': { label: '⏸️ Inactive', class: 'status-inactive' },
    'bankrupt': { label: '⚠️ Bankrupt', class: 'status-bankrupt' },
    'closed': { label: '❌ Closed', class: 'status-closed' }
  };
  const s = statusMap[status] || statusMap['active'];
  return `<span class="status-badge ${s.class}">${s.label}</span>`;
}

function getPaymentHistoryBadge(history) {
  const historyMap = {
    'good': { label: '💰 Good', class: 'payment-good' },
    'new_customer': { label: '🆕 New', class: 'payment-new_customer' },
    'delayed': { label: '⚠️ Delayed', class: 'payment-delayed' },
    'bad': { label: '❌ Bad', class: 'payment-bad' }
  };
  const h = historyMap[history] || historyMap['new_customer'];
  return `<span class="payment-badge ${h.class}">${h.label}</span>`;
}

function getDiscountBadge(percentage) {
  if (!percentage || percentage === 0) return '';
  const isDiscount = percentage > 0;
  const className = isDiscount ? 'discount-positive' : 'discount-negative';
  const label = isDiscount ? `${percentage}% discount` : `${Math.abs(percentage)}% extra fee`;
  return `<span class="discount-badge ${className}">${label}</span>`;
}

function formatPaymentTerms(terms) {
  const termsMap = {
    'standard_credit': '💳 Standard Credit',
    'prepayment_required': '💰 Prepayment Required',
    'cod': '📦 Cash on Delivery',
    'custom': '📝 Custom Terms'
  };
  return termsMap[terms] || termsMap['standard_credit'];
}

function getCustomerWarningBanner(customer) {
  const warnings = [];
  
  if (customer.status === 'inactive') {
    warnings.push('⏸️ This customer is marked as <strong>inactive</strong>');
  } else if (customer.status === 'bankrupt') {
    warnings.push('⚠️ This customer is in <strong>bankruptcy</strong> - orders may require approval');
  } else if (customer.status === 'closed') {
    warnings.push('❌ This company is <strong>closed/dead</strong> - new orders should be blocked');
  }
  
  if (customer.payment_history === 'bad') {
    warnings.push('❌ This customer has a <strong>bad payment history</strong> - orders may require approval');
  } else if (customer.payment_history === 'delayed') {
    warnings.push('⚠️ This customer has a history of <strong>delayed payments</strong>');
  }
  
  if (customer.payment_terms === 'prepayment_required') {
    warnings.push('💰 <strong>Prepayment required</strong> before processing orders');
  }
  
  if (warnings.length === 0) return '';
  
  const isDanger = customer.status === 'closed' || customer.status === 'bankrupt' || customer.payment_history === 'bad';
  
  return `<div class="warning-banner ${isDanger ? 'danger' : ''}">${warnings.join('<br>')}</div>`;
}

// Check if customer requires special handling for orders
function customerRequiresApproval(customer) {
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

// ============================================================================
// CLIENT FOLDER MANAGEMENT
// ============================================================================

// Load available client folders into the dropdown
async function loadClientFolders(selectedFolder = null) {
  const select = document.getElementById('folder-path');
  if (!select) return;

  try {
    const response = await fetch(`${API_URL}/client-folders`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Failed to load folders:', data.message);
      return;
    }

    // Clear and rebuild options
    select.innerHTML = '<option value="">-- Select existing folder or create new --</option>';
    
    const folders = data.folders || [];
    folders.forEach(folder => {
      const option = document.createElement('option');
      option.value = folder;
      option.textContent = `📁 ${folder}`;
      select.appendChild(option);
    });

    // Set selected value if provided
    if (selectedFolder) {
      select.value = selectedFolder;
    }
  } catch (error) {
    console.error('Error loading client folders:', error);
  }
}

// Open the create folder modal
function openCreateFolderModal() {
  document.getElementById('new-folder-name').value = '';
  document.getElementById('folder-modal').classList.add('active');
  
  // Auto-generate suggestion if company name is filled
  generateSuggestedFolderName();
}

// Close the create folder modal
function closeFolderModal() {
  document.getElementById('folder-modal').classList.remove('active');
}

// Generate a suggested folder name based on customer data
async function generateSuggestedFolderName() {
  const companyName = document.getElementById('company-name').value.trim();
  const customerId = document.getElementById('customer-code').value.trim();

  if (!companyName) {
    showAlert('Please enter a company name first', 'warning');
    return;
  }

  try {
    const params = new URLSearchParams({ companyName });
    if (customerId) {
      params.append('customerId', customerId);
    }

    const response = await fetch(`${API_URL}/client-folders/suggest?${params}`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });

    const data = await response.json();

    if (response.ok && data.suggestion) {
      document.getElementById('new-folder-name').value = data.suggestion;
      
      if (data.exists) {
        showAlert('Note: A folder with this name already exists', 'warning');
      }
    }
  } catch (error) {
    console.error('Error generating folder suggestion:', error);
  }
}

// Handle create folder form submission
async function handleCreateFolder(event) {
  event.preventDefault();

  const folderName = document.getElementById('new-folder-name').value.trim();
  
  if (!folderName) {
    showAlert('Please enter a folder name', 'danger');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/client-folders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({ folderName })
    });

    const data = await response.json();

    if (!response.ok) {
      showAlert(data.message || 'Failed to create folder', 'danger');
      return;
    }

    showAlert('Folder created successfully', 'success');
    closeFolderModal();

    // Refresh folder list and select the new folder
    await loadClientFolders(data.folderName);
  } catch (error) {
    showAlert('Error: ' + error.message, 'danger');
  }
}
