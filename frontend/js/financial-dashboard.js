// Financial Dashboard JavaScript

let currentFilter = 'all';
let allOrders = [];

// Check authentication and admin level on page load
document.addEventListener('DOMContentLoaded', async () => {
  // Check authentication
  if (!Auth.isAuthenticated()) {
    window.location.href = 'login.html';
    return;
  }

  // Display user name from local storage immediately
  const localUser = Auth.getUser();
  const userNameEl = document.getElementById('userName');
  if (userNameEl && localUser && localUser.name) {
    userNameEl.textContent = localUser.name;
  }

  // Check admin level (500)
  try {
    const user = await API.auth.getCurrentUser();
    if (!user || user.level < 500) {
      alert('Access denied. This page is only available for Admin users (level 500).');
      window.location.href = 'index.html';
      return;
    }

    // Update user name from API response if available
    if (userNameEl && user.name) {
      userNameEl.textContent = user.name;
    }

    // Set up logout button
    document.getElementById('logoutBtn').addEventListener('click', () => {
      Auth.logout();
      window.location.href = 'login.html';
    });

    // Set up filter tabs
    const filterButtons = document.querySelectorAll('.filter-tabs button');
    filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const stage = btn.getAttribute('data-stage');
        filterByStage(stage);
      });
    });

    // Set up file input change handlers
    document.getElementById('deliveryFile').addEventListener('change', (e) => {
      const fileName = e.target.files[0]?.name || '';
      document.getElementById('deliveryFileName').textContent = fileName ? `Selected: ${fileName}` : '';
    });

    document.getElementById('invoiceFile').addEventListener('change', (e) => {
      const fileName = e.target.files[0]?.name || '';
      document.getElementById('invoiceFileName').textContent = fileName ? `Selected: ${fileName}` : '';
      
      // Auto-fill invoice number from filename (without extension)
      if (fileName) {
        const invoiceNumberField = document.getElementById('invoiceNumber');
        // Remove file extension and use as invoice number
        const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
        invoiceNumberField.value = nameWithoutExt;
      }
    });

    // Load orders
    await loadFinancialOrders();
  } catch (error) {
    console.error('Error loading user:', error);
    alert('Error loading user information. Please log in again.');
    window.location.href = 'login.html';
  }
});

// Load financial orders from API
async function loadFinancialOrders() {
  try {
    const endpoint = currentFilter === 'all' 
      ? '/orders/financial' 
      : `/orders/financial?financial_stage=${currentFilter}`;
    
    const response = await API.request(endpoint);
    
    if (response.success) {
      allOrders = response.orders || [];
      renderOrders(allOrders);
      updateStats(allOrders);
    } else {
      console.error('Failed to load orders:', response.message);
      showEmptyState();
    }
  } catch (error) {
    console.error('Error loading financial orders:', error);
    alert('Error loading orders: ' + error.message);
    showEmptyState();
  }
}

// Render orders in table
function renderOrders(orders) {
  const tbody = document.getElementById('financialTableBody');
  const emptyState = document.getElementById('emptyState');
  
  if (!orders || orders.length === 0) {
    tbody.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';
  
  tbody.innerHTML = orders.map(order => {
    const stage = order.financial_stage || 'pending';
    const customerName = order.customer_company_name || order.customer_name || 'N/A';
    const completionDate = order.updated_at ? new Date(order.updated_at).toLocaleDateString() : 'N/A';
    
    return `
      <tr>
        <td><strong>${order.internal_order_id || order.order_number || `#${order.id}`}</strong></td>
        <td>${customerName}</td>
        <td>${completionDate}</td>
        <td><span class="stage-badge stage-${stage}">${formatStage(stage)}</span></td>
        <td>${renderDeliveryStatus(order)}</td>
        <td>${renderInvoiceStatus(order)}</td>
        <td>${renderPaymentStatus(order)}</td>
        <td>${renderActions(order)}</td>
      </tr>
    `;
  }).join('');
}

// Format stage name for display
function formatStage(stage) {
  const stageNames = {
    'pending': 'Pending',
    'delivered': 'Delivered',
    'invoiced': 'Invoiced',
    'cashed_in': 'Cashed In',
    'completed': 'Completed'
  };
  return stageNames[stage] || stage;
}

// Render delivery status
function renderDeliveryStatus(order) {
  if (order.delivery_date) {
    const date = new Date(order.delivery_date).toLocaleDateString();
    const docIcon = order.delivery_document_path ? '📄' : '';
    return `<div class="status-info"><span class="status-date">${date}</span> ${docIcon}</div>`;
  }
  return '<span style="color: #999;">—</span>';
}

// Render invoice status
function renderInvoiceStatus(order) {
  if (order.no_invoice_needed) {
    return '<span style="color: #FF9800; font-weight: 500;">No Invoice Needed</span>';
  }
  if (order.invoice_date) {
    const date = new Date(order.invoice_date).toLocaleDateString();
    const invoiceNum = order.invoice_number || '';
    const docIcon = order.invoice_document_path ? '📄' : '';
    return `<div class="status-info">
      <span class="status-date">${date}</span><br>
      <small>${invoiceNum}</small> ${docIcon}
    </div>`;
  }
  return '<span style="color: #999;">—</span>';
}

// Render payment status
function renderPaymentStatus(order) {
  if (order.cashed_in_date) {
    const date = new Date(order.cashed_in_date).toLocaleDateString();
    const amount = order.payment_amount ? `${parseFloat(order.payment_amount).toFixed(2)} RON` : '';
    return `<div class="status-info">
      <span class="status-date">${date}</span><br>
      <small>${amount}</small>
    </div>`;
  }
  return '<span style="color: #999;">—</span>';
}

// Render action buttons based on order state
function renderActions(order) {
  const stage = order.financial_stage || 'pending';
  const buttons = [];

  if (stage === 'pending') {
    buttons.push(`<button class="btn-action btn-delivery" onclick="openDeliveryModal(${order.id})">Mark Delivered</button>`);
  }

  if (stage === 'delivered' && !order.no_invoice_needed) {
    // TEMP: Reset button for testing
    buttons.push(`<button class="btn-action" style="background:#f44336;" onclick="resetToPending(${order.id})">↩ Reset</button>`);
    buttons.push(`<button class="btn-action btn-no-invoice" onclick="toggleNoInvoiceNeeded(${order.id})">No Invoice Needed</button>`);
    buttons.push(`<button class="btn-action btn-invoice" onclick="openInvoiceModal(${order.id})">Upload Invoice</button>`);
  }

  if (stage === 'invoiced') {
    buttons.push(`<button class="btn-action btn-payment" onclick="openPaymentModal(${order.id})">Mark Cashed In</button>`);
  }

  // Always show view documents if any exist
  if (order.delivery_document_path || order.invoice_document_path) {
    buttons.push(`<button class="btn-action btn-view" onclick="viewDocuments(${order.id})">View Docs</button>`);
  }

  return `<div class="action-buttons">${buttons.join('')}</div>`;
}

// Update statistics cards
function updateStats(orders) {
  const stats = {
    pending: 0,
    delivered: 0,
    invoiced: 0,
    cashed_in: 0,
    completed: 0
  };

  orders.forEach(order => {
    const stage = order.financial_stage || 'pending';
    if (stats.hasOwnProperty(stage)) {
      stats[stage]++;
    }
  });

  const statsCards = document.getElementById('statsCards');
  statsCards.innerHTML = `
    <div class="stat-card pending">
      <div class="stat-value">${stats.pending}</div>
      <div class="stat-label">Pending</div>
    </div>
    <div class="stat-card delivered">
      <div class="stat-value">${stats.delivered}</div>
      <div class="stat-label">Delivered</div>
    </div>
    <div class="stat-card invoiced">
      <div class="stat-value">${stats.invoiced}</div>
      <div class="stat-label">Invoiced</div>
    </div>
    <div class="stat-card cashed">
      <div class="stat-value">${stats.cashed_in + stats.completed}</div>
      <div class="stat-label">Cashed In</div>
    </div>
  `;
}

// Filter orders by stage
function filterByStage(stage) {
  currentFilter = stage;
  
  if (stage === 'all') {
    renderOrders(allOrders);
  } else {
    const filtered = allOrders.filter(order => order.financial_stage === stage);
    renderOrders(filtered);
  }
}

// Show empty state
function showEmptyState() {
  document.getElementById('financialTableBody').innerHTML = '';
  document.getElementById('emptyState').style.display = 'block';
}

// Modal Functions
function openModal(modalId) {
  document.getElementById(modalId).classList.add('show');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('show');
  // Reset form
  const form = document.getElementById(modalId.replace('Modal', 'Form'));
  if (form) form.reset();
  // Reset file name displays
  if (modalId === 'deliveryModal') {
    document.getElementById('deliveryFileName').textContent = '';
  } else if (modalId === 'invoiceModal') {
    document.getElementById('invoiceFileName').textContent = '';
  }
}

// Open delivery modal
function openDeliveryModal(orderId) {
  document.getElementById('deliveryOrderId').value = orderId;
  // Reset form
  document.getElementById('deliveryDocNumber').value = '';
  document.getElementById('deliveryFile').value = '';
  document.getElementById('deliveryFileName').textContent = '';
  // Set default option to manual
  document.querySelector('input[name="deliveryOption"][value="manual"]').checked = true;
  toggleDeliveryOption('manual');
  openModal('deliveryModal');
}

// Toggle delivery option sections
function toggleDeliveryOption(option) {
  const manualSection = document.getElementById('manualDocSection');
  const uploadSection = document.getElementById('uploadDocSection');
  const noDocSection = document.getElementById('noDocSection');
  const avizSection = document.getElementById('avizSection');
  
  manualSection.style.display = option === 'manual' ? 'block' : 'none';
  uploadSection.style.display = option === 'upload' ? 'block' : 'none';
  noDocSection.style.display = option === 'none' ? 'block' : 'none';
  avizSection.style.display = option === 'aviz' ? 'block' : 'none';
  
  // If aviz option selected, load order items and next number
  if (option === 'aviz') {
    loadAvizData();
  }
  
  // Update radio button styling
  document.querySelectorAll('.delivery-options .radio-option').forEach(label => {
    const input = label.querySelector('input');
    if (input.checked) {
      label.style.borderColor = '#4CAF50';
      label.style.background = '#E8F5E9';
    } else {
      label.style.borderColor = '#e0e0e0';
      label.style.background = 'transparent';
    }
  });
}

// Update file name display when file is selected
function updateDeliveryFileName() {
  const fileInput = document.getElementById('deliveryFile');
  const fileNameDiv = document.getElementById('deliveryFileName');
  if (fileInput.files && fileInput.files.length > 0) {
    fileNameDiv.textContent = '✓ ' + fileInput.files[0].name;
    fileNameDiv.style.color = '#4CAF50';
  } else {
    fileNameDiv.textContent = '';
  }
}

// Invoice API base URL
const INVOICE_API_URL = 'http://192.168.2.121:3001';

// Load aviz data (order items, next number, and matching partner from IceFact)
async function loadAvizData() {
  const orderId = document.getElementById('deliveryOrderId').value;
  const serie = document.getElementById('avizSerie').value || 'AFE';
  
  try {
    // Get next aviz number from invoice-api
    const nextNumResponse = await fetch(`${INVOICE_API_URL}/api/delivery-notes/next-number/${serie}`);
    const nextNumData = await nextNumResponse.json();
    document.getElementById('avizNumber').value = nextNumData.next_number || '';
    
    // Get order details with parts
    const orderResponse = await API.request(`/orders/${orderId}`);
    if (orderResponse.success && orderResponse.order) {
      const order = orderResponse.order;
      const itemsDiv = document.getElementById('avizItems');
      
      if (order.parts && order.parts.length > 0) {
        itemsDiv.innerHTML = order.parts.map((part, idx) => `
          <div style="display: flex; justify-content: space-between; padding: 0.5rem; background: white; margin-bottom: 0.5rem; border-radius: 4px; border: 1px solid #e0e0e0;">
            <span><strong>${idx + 1}.</strong> ${part.part_name || part.name || 'Part'}</span>
            <span style="color: #667eea; font-weight: bold;">${part.quantity || 1} buc</span>
          </div>
        `).join('');
        
        // Store order data for aviz creation
        window.currentAvizOrder = order;
      } else {
        itemsDiv.innerHTML = '<p style="color: #999;">No parts found for this order.</p>';
      }
      
      // Search for matching partner in IceFact database
      const customerName = order.customer_company_name || order.customer_name || '';
      if (customerName) {
        try {
          const partnerResponse = await fetch(`${INVOICE_API_URL}/api/partners/search/${encodeURIComponent(customerName)}`);
          const partnerData = await partnerResponse.json();
          
          if (partnerData.data && partnerData.data.length > 0) {
            const partner = partnerData.data[0]; // Use first match
            
            // Store partner data for aviz creation
            window.currentAvizPartner = partner;
            
            // Show matched partner info
            const partnerInfoDiv = document.getElementById('avizPartnerInfo');
            if (partnerInfoDiv) {
              partnerInfoDiv.innerHTML = `
                <div style="background: #E8F5E9; padding: 0.75rem; border-radius: 6px; margin-bottom: 0.5rem;">
                  <strong style="color: #2E7D32;">✓ Matched in IceFact:</strong> ${partner.den}
                  <br><small style="color: #666;">CIF: ${partner.cui || '-'} | ${partner.localitate || ''}, ${partner.judet || ''}</small>
                </div>
              `;
            }
            
            // Auto-fill delegate info if available
            if (partner.delegat_nume) {
              document.getElementById('avizDelegat').value = partner.delegat_nume;
              document.getElementById('avizCISeria').value = partner.delegat_ci_seria || '';
              document.getElementById('avizCINr').value = partner.delegat_ci_nr || '';
              document.getElementById('avizCIPol').value = partner.delegat_ci_pol || '';
              document.getElementById('avizTransport').value = partner.delegat_mij_trans || 'auto';
              document.getElementById('avizNrAuto').value = partner.delegat_mij_trans_nr || '';
            }
          } else {
            // No match found
            window.currentAvizPartner = null;
            const partnerInfoDiv = document.getElementById('avizPartnerInfo');
            if (partnerInfoDiv) {
              partnerInfoDiv.innerHTML = `
                <div style="background: #FFF3E0; padding: 0.75rem; border-radius: 6px; margin-bottom: 0.5rem;">
                  <strong style="color: #E65100;">⚠ Not found in IceFact:</strong> ${customerName}
                  <br><small style="color: #666;">Customer data from CNC order will be used.</small>
                </div>
              `;
            }
          }
        } catch (partnerError) {
          console.error('Error searching partner:', partnerError);
          window.currentAvizPartner = null;
        }
      }
    }
  } catch (error) {
    console.error('Error loading aviz data:', error);
    document.getElementById('avizItems').innerHTML = '<p style="color: #f44336;">Error loading order items.</p>';
  }
}

// Create aviz via invoice-api
async function createAviz() {
  const orderId = document.getElementById('deliveryOrderId').value;
  const serie = document.getElementById('avizSerie').value;
  const numar = document.getElementById('avizNumber').value;
  const delegat = document.getElementById('avizDelegat').value;
  const transport = document.getElementById('avizTransport').value;
  const nrAuto = document.getElementById('avizNrAuto').value;
  
  if (!serie || !numar) {
    throw new Error('Series and number are required');
  }
  
  const order = window.currentAvizOrder;
  if (!order) {
    throw new Error('Order data not loaded');
  }
  
  // Use IceFact partner data if matched, otherwise use CNC order data
  const partner = window.currentAvizPartner;
  
  // Build aviz data with correct IceFact schema
  const avizData = {
    serie: serie,
    numar: parseInt(numar),
    data: new Date().toISOString().split('T')[0],
    // Customer (beneficiar) info - prefer IceFact data
    benef_den: partner?.den || order.customer_company_name || order.customer_name || '',
    benef_cui: partner?.cui || order.customer_cif || '',
    benef_sediu: partner?.sediu || order.customer_address || '',
    benef_atrf: partner?.atrf || (order.customer_cif ? 'RO' : ''),
    benef_regcom: partner?.regcom || order.customer_reg_com || '',
    benef_localitate: partner?.localitate || order.customer_city || '',
    benef_judet: partner?.judet || order.customer_county || '',
    benef_tara: partner?.tara || 'România',
    benef_cont: partner?.cont || order.customer_bank_account || '',
    benef_banca: partner?.banca || order.customer_bank || '',
    // Delegate info - from form fields (pre-filled from IceFact if matched)
    deleg_nume: delegat,
    deleg_ci_seria: document.getElementById('avizCISeria')?.value || '',
    deleg_ci_nr: document.getElementById('avizCINr')?.value || '',
    deleg_ci_pol: document.getElementById('avizCIPol')?.value || '',
    deleg_mij_trans: transport,
    deleg_mij_trans_nr: nrAuto,
    // Emitter
    emis_de: Auth.getUser()?.name || '',
    // Items - with proper format
    articole: (order.parts || []).map(part => ({
      denumire: part.part_name || part.name || 'Part',
      um: 'BUC',
      cantitate: part.quantity || 1,
      pret: 0,
      valoare: 0
    })),
    obs: ''
  };
  
  // Create aviz in invoice-api
  const response = await fetch(`${INVOICE_API_URL}/api/delivery-notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(avizData)
  });
  
  const result = await response.json();
  
  if (!response.ok) {
    throw new Error(result.error || 'Failed to create delivery note');
  }
  
  return { avizId: result.id, avizRef: `${serie}-${numar}` };
}

// Submit delivery document
async function submitDelivery(event) {
  const orderId = document.getElementById('deliveryOrderId').value;
  const selectedOption = document.querySelector('input[name="deliveryOption"]:checked').value;
  
  // Handle aviz creation separately
  if (selectedOption === 'aviz') {
    try {
      const btn = event.target;
      btn.disabled = true;
      btn.textContent = 'Creating Aviz...';
      
      // Create aviz in invoice-api
      const avizResult = await createAviz();
      
      // Now mark as delivered with the aviz reference
      let formData = new FormData();
      formData.append('deliveryOption', 'manual');
      formData.append('documentNumber', `Aviz: ${avizResult.avizRef}`);
      
      const response = await fetch(`${config.API_BASE_URL}/orders/${orderId}/delivery-document`, {
        method: 'POST',
        headers: { ...Auth.getAuthHeader() },
        body: formData
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert(`Delivery note created successfully!\nAviz: ${avizResult.avizRef}`);
        closeModal('deliveryModal');
        await loadFinancialOrders();
      } else {
        alert('Error: ' + (data.message || 'Failed to mark as delivered'));
      }
    } catch (error) {
      console.error('Error creating aviz:', error);
      alert('Error: ' + error.message);
    } finally {
      const btn = document.querySelector('#deliveryModal .btn-primary');
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Confirm Delivery';
      }
    }
    return;
  }
  
  let formData = new FormData();
  formData.append('deliveryOption', selectedOption);
  
  if (selectedOption === 'manual') {
    const docNumber = document.getElementById('deliveryDocNumber').value.trim();
    if (!docNumber) {
      alert('Please enter a document number');
      return;
    }
    formData.append('documentNumber', docNumber);
  } else if (selectedOption === 'upload') {
    const fileInput = document.getElementById('deliveryFile');
    if (!fileInput.files || fileInput.files.length === 0) {
      alert('Please select a file to upload');
      return;
    }
    formData.append('document', fileInput.files[0]);
  }
  // For 'none' option, we don't need to append anything extra

  try {
    // Show loading state
    const btn = event.target;
    btn.disabled = true;
    btn.textContent = 'Processing...';

    const response = await fetch(`${config.API_BASE_URL}/orders/${orderId}/delivery-document`, {
      method: 'POST',
      headers: {
        ...Auth.getAuthHeader()
      },
      body: formData
    });

    const data = await response.json();

    if (data.success) {
      alert('Order marked as delivered successfully!');
      closeModal('deliveryModal');
      await loadFinancialOrders();
    } else {
      alert('Error: ' + (data.message || 'Failed to mark as delivered'));
    }
  } catch (error) {
    console.error('Error marking delivery:', error);
    alert('Error: ' + error.message);
  } finally {
    const btn = document.querySelector('#deliveryModal .btn-primary');
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Confirm Delivery';
    }
  }
}

// Open invoice modal
function openInvoiceModal(orderId) {
  document.getElementById('invoiceOrderId').value = orderId;
  openModal('invoiceModal');
}

// Submit invoice document
async function submitInvoice(event) {
  const orderId = document.getElementById('invoiceOrderId').value;
  const invoiceNumber = document.getElementById('invoiceNumber').value;
  const fileInput = document.getElementById('invoiceFile');
  
  if (!invoiceNumber) {
    alert('Please enter an invoice number');
    return;
  }

  if (!fileInput.files || fileInput.files.length === 0) {
    alert('Please select a file to upload');
    return;
  }

  const formData = new FormData();
  formData.append('document', fileInput.files[0]);
  formData.append('invoice_number', invoiceNumber);

  try {
    // Show loading state
    const btn = event.target;
    btn.disabled = true;
    btn.textContent = 'Uploading...';

    const response = await fetch(`${config.API_BASE_URL}/orders/${orderId}/invoice-document`, {
      method: 'POST',
      headers: {
        ...Auth.getAuthHeader()
      },
      body: formData
    });

    const data = await response.json();

    if (data.success) {
      alert('Invoice uploaded successfully!');
      closeModal('invoiceModal');
      await loadFinancialOrders();
    } else {
      alert('Error: ' + (data.message || 'Failed to upload invoice'));
    }
  } catch (error) {
    console.error('Error uploading invoice:', error);
    alert('Error uploading invoice: ' + error.message);
  } finally {
    const btn = document.querySelector('#invoiceModal .btn-primary');
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Upload Invoice';
    }
  }
}

// Open payment modal
function openPaymentModal(orderId) {
  document.getElementById('paymentOrderId').value = orderId;
  openModal('paymentModal');
}

// Submit payment (mark as cashed in)
async function submitPayment(event) {
  const orderId = document.getElementById('paymentOrderId').value;
  const paymentAmount = document.getElementById('paymentAmount').value;
  const paymentNotes = document.getElementById('paymentNotes').value;

  try {
    // Show loading state
    const btn = event.target;
    btn.disabled = true;
    btn.textContent = 'Saving...';

    const response = await API.request(`/orders/${orderId}/cashed-in`, {
      method: 'POST',
      body: JSON.stringify({
        payment_amount: paymentAmount ? parseFloat(paymentAmount) : null,
        payment_notes: paymentNotes || null
      })
    });

    if (response.success) {
      alert('Order marked as cashed in successfully!');
      closeModal('paymentModal');
      await loadFinancialOrders();
    } else {
      alert('Error: ' + (response.message || 'Failed to mark as cashed in'));
    }
  } catch (error) {
    console.error('Error marking as cashed in:', error);
    alert('Error: ' + error.message);
  } finally {
    const btn = document.querySelector('#paymentModal .btn-primary');
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Mark Cashed In';
    }
  }
}

// Toggle no invoice needed
async function toggleNoInvoiceNeeded(orderId) {
  if (!confirm('Mark this order as "No Invoice Needed"? This will complete the financial tracking without requiring invoice or payment.')) {
    return;
  }

  try {
    const response = await API.request(`/orders/${orderId}/financial-stage`, {
      method: 'PUT',
      body: JSON.stringify({
        financial_stage: 'completed',
        no_invoice_needed: true
      })
    });

    if (response.success) {
      alert('Order marked as "No Invoice Needed" and completed');
      await loadFinancialOrders();
    } else {
      alert('Error: ' + (response.message || 'Failed to update order'));
    }
  } catch (error) {
    console.error('Error updating order:', error);
    alert('Error: ' + error.message);
  }
}

// View documents for an order
function viewDocuments(orderId) {
  const order = allOrders.find(o => o.id === orderId);
  if (!order) {
    alert('Order not found');
    return;
  }

  let docsHtml = '<h3>Documents for Order ' + (order.internal_order_id || order.order_number || '#' + order.id) + '</h3>';
  docsHtml += '<div style="margin-top: 1rem;">';

  if (order.delivery_document_path) {
    docsHtml += '<p><strong>📦 Delivery Document:</strong><br>';
    if (order.delivery_document_path === 'none') {
      docsHtml += '<span style="color: #666; font-style: italic;">No document (marked delivered without document)</span>';
    } else if (order.delivery_document_path.startsWith('manual:')) {
      const docNumber = order.delivery_document_path.replace('manual:', '');
      docsHtml += `<span>Document #: ${docNumber}</span>`;
    } else {
      const fileName = order.delivery_document_path.split('/').pop();
      docsHtml += `<a href="#" onclick="downloadFinancialDocument('${encodeURIComponent(order.delivery_document_path)}', '${fileName}'); return false;" style="cursor: pointer; color: #2196F3;">
        ${fileName}
      </a>`;
    }
    docsHtml += '</p>';
  }

  if (order.invoice_document_path) {
    const invoiceFileName = order.invoice_document_path.split('/').pop();
    docsHtml += `<p><strong>📄 Invoice Document:</strong><br>
      Invoice #: ${order.invoice_number || 'N/A'}<br>
      <a href="#" onclick="downloadFinancialDocument('${encodeURIComponent(order.invoice_document_path)}', '${invoiceFileName}'); return false;" style="cursor: pointer; color: #2196F3;">
        ${invoiceFileName}
      </a></p>`;
  }

  docsHtml += '</div>';

  // Create a simple modal dialog
  const modal = document.createElement('div');
  modal.className = 'modal show';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>📁 Order Documents</h2>
        <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
      </div>
      <div class="modal-body">
        ${docsHtml}
      </div>
      <div class="modal-footer">
        <button class="btn-modal btn-secondary" onclick="this.closest('.modal').remove()">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

// Download financial document with authentication
async function downloadFinancialDocument(encodedPath, fileName) {
  try {
    const path = decodeURIComponent(encodedPath);
    const response = await fetch(`${config.API_BASE_URL}/files/download?path=${encodeURIComponent(path)}`, {
      method: 'GET',
      headers: {
        ...Auth.getAuthHeader()
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Download failed');
    }

    // Get the blob and create download link
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  } catch (error) {
    console.error('Download error:', error);
    alert('Error downloading file: ' + error.message);
  }
}

// TEMP: Reset order to pending status (for testing)
async function resetToPending(orderId) {
  if (!confirm('Reset this order back to Pending status?')) {
    return;
  }
  
  try {
    const response = await API.request(`/orders/${orderId}/reset-financial`, {
      method: 'POST'
    });
    
    if (response.success) {
      alert('Order reset to Pending');
      await loadFinancialOrders();
    } else {
      alert('Error: ' + (response.message || 'Failed to reset'));
    }
  } catch (error) {
    console.error('Error resetting order:', error);
    alert('Error: ' + error.message);
  }
}

// Close modal when clicking outside
window.addEventListener('click', (event) => {
  if (event.target.classList.contains('modal')) {
    event.target.classList.remove('show');
  }
});
