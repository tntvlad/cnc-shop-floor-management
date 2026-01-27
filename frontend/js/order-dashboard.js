let currentFilter = 'all';
let currentUser = null;
const PRIORITY_WEIGHT = {
  urgent: 3,
  high: 3,
  normal: 2,
  medium: 2,
  low: 1
};

document.addEventListener('DOMContentLoaded', function() {
  ensureAuthed();
  checkPageAccess();
  loadCurrentUser();
  loadOrders();
  loadStats();
  setupEventListeners();

  // Refresh every 30 seconds
  setInterval(() => {
    loadOrders();
    loadStats();
  }, 30000);
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
  currentUser = Auth.getUser();
  if (currentUser && currentUser.name) {
    const userNameEl = document.getElementById('userName');
    if (userNameEl) {
      userNameEl.textContent = currentUser.name;
    }
  }
  
  // Show navigation links for supervisors+
  const isSupervisorPlus = (typeof currentUser.level === 'number' && currentUser.level >= 400)
    || (currentUser.role && (currentUser.role === 'admin' || currentUser.role === 'supervisor'));
  
  if (isSupervisorPlus) {
    const supervisorLink = document.getElementById('supervisorLink');
    const adminLink = document.getElementById('adminLink');
    if (supervisorLink) supervisorLink.style.display = 'inline-flex';
    if (adminLink) adminLink.style.display = 'inline-flex';
  }
}

function canEditOrders() {
  // Supervisor (level 400) and Admin (level 500) can edit orders
  return currentUser && currentUser.level >= 400;
}

function setupEventListeners() {
  // Search
  document.getElementById('search-input').addEventListener('keyup', (e) => {
    const query = e.target.value;
    loadOrders(currentFilter, query);
  });

  // Filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentFilter = e.target.dataset.status;
      const query = document.getElementById('search-input').value;
      loadOrders(currentFilter, query);
    });
  });
}

async function loadOrders(status = 'all', customer = '') {
  try {
    let url = `${API_URL}/orders`;
    const params = new URLSearchParams();

    if (status && status !== 'all') {
      params.append('status', status);
    }
    if (customer) {
      params.append('customer', customer);
    }

    if (params.toString()) {
      url += '?' + params.toString();
    }

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });

    const data = await response.json();

    if (!response.ok) {
      showError('Failed to load orders');
      return;
    }

    renderOrders(data.orders || []);
  } catch (error) {
    console.error('Error loading orders:', error);
    showError('Error loading orders: ' + error.message);
  }
}

function renderOrders(orders) {
  const tbody = document.getElementById('orders-tbody');
  const emptyState = document.getElementById('empty-state');

  if (!orders || orders.length === 0) {
    tbody.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  const sorted = [...orders].sort((a, b) => {
    const pa = getPriorityMeta(a).weight;
    const pb = getPriorityMeta(b).weight;
    if (pb !== pa) return pb - pa;
    const da = new Date(a.due_date || 0).getTime();
    const db = new Date(b.due_date || 0).getTime();
    return da - db;
  });

  emptyState.style.display = 'none';
  tbody.innerHTML = sorted.map(order => {
    const dueDate = order.due_date ? new Date(order.due_date).toLocaleDateString() : '—';
    // For completed orders, calculate late based on completed_at, not today
    const dueInfo = getDueInfo(order.due_date, order.status === 'completed' ? order.completed_at : null);
    const progress = order.part_count > 0 ? Math.round((order.completed_parts / order.part_count) * 100) : 0;
    const priority = getPriorityMeta(order);
    const isOverdue = dueInfo.isOverdue;
    const overdueClass = isOverdue ? 'order-overdue' : '';
    const dueDateClass = isOverdue ? 'due-date-overdue' : '';
    const showEditBtn = canEditOrders();

    return `
      <tr class="${priority.rowClass} ${overdueClass}" onclick="openOrderDetails(${order.id})">
        <td style="color: #1F2937;"><strong>${order.internal_order_id || '#' + order.id}</strong></td>
        <td>
          <span class="priority-badge ${priority.badgeClass}">${escapeHtml(priority.label)}</span>
        </td>
        <td>
          <div style="font-weight: 600; color: #374151;">${escapeHtml(order.customer_name || 'Unknown')}</div>
          <div style="font-size: 0.85rem; color: #6B7280;">${escapeHtml(order.customer_email || '')}</div>
        </td>
        <td style="color: #374151;">
          <strong>${order.part_count || 0}</strong> parts
          <br>
          <span style="color: #6B7280;">${order.completed_parts || 0} completed</span>
        </td>
        <td>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${progress}%;"></div>
          </div>
          <div style="font-size: 0.85rem; text-align: center; margin-top: 0.5rem; color: #374151;">${progress}%</div>
        </td>
        <td>
          <div class="${dueDateClass}">${isOverdue ? '⚠️ ' : ''}${dueDate}</div>
          <span class="due-chip ${dueInfo.chipClass}">${escapeHtml(dueInfo.label)}</span>
        </td>
        <td>
          <span class="status-badge status-${order.status || 'pending'}">
            ${(order.status || 'pending').toUpperCase().replace('-', ' ')}
          </span>
        </td>
        <td>
          <div class="action-buttons">
            <button class="btn-view" onclick="openOrderDetails(${order.id}); event.stopPropagation();">View</button>
            ${showEditBtn ? `<button class="btn-edit" onclick="openEditOrderModal(${order.id}); event.stopPropagation();">Edit</button>` : ''}
            <button class="btn-delete" onclick="deleteOrder(${order.id}); event.stopPropagation();">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function loadStats() {
  try {
    const response = await fetch(`${API_URL}/orders/stats/summary`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      return;
    }

    const stats = data.stats;
    document.getElementById('total-orders').textContent = stats.total_orders || 0;
    document.getElementById('pending-orders').textContent = stats.pending_orders || 0;
    document.getElementById('in-progress-orders').textContent = stats.in_progress_orders || 0;
    document.getElementById('completed-orders').textContent = stats.completed_orders || 0;
  } catch (error) {
    console.error('Error loading stats:', error);
  }
}

function openOrderDetails(orderId) {
  navigateTo(`order-details.html?id=${orderId}`);
}

async function deleteOrder(orderId) {
  if (!confirm('Are you sure you want to delete this order? This cannot be undone.')) {
    return;
  }

  try {
    const response = await fetch(`${API_URL}/orders/${orderId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });

    const data = await response.json();

    if (!response.ok) {
      showError(data.message || 'Failed to delete order');
      return;
    }

    showSuccess('Order deleted successfully');
    setTimeout(() => {
      loadOrders(currentFilter);
    }, 1000);
  } catch (error) {
    console.error('Error deleting order:', error);
    showError('Error deleting order: ' + error.message);
  }
}

function closeOrderModal() {
  document.getElementById('order-modal').classList.remove('active');
}

function showError(message) {
  const errorEl = document.createElement('div');
  errorEl.className = 'alert alert-danger';
  errorEl.textContent = message;
  errorEl.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #f8d7da; color: #842029; padding: 1rem; border-radius: 4px; z-index: 2000;';
  document.body.appendChild(errorEl);
  setTimeout(() => errorEl.remove(), 5000);
}

function showSuccess(message) {
  const successEl = document.createElement('div');
  successEl.className = 'alert alert-success';
  successEl.textContent = message;
  successEl.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #d1e7dd; color: #0f5132; padding: 1rem; border-radius: 4px; z-index: 2000;';
  document.body.appendChild(successEl);
  setTimeout(() => successEl.remove(), 5000);
}

function getPriorityMeta(item) {
  // Handle both integer and string priority values
  let key = '';
  if (typeof item.priority === 'number') {
    // Map integer to string: 3=urgent, 2=high, 1=normal, 0=low
    const intMap = { 3: 'urgent', 2: 'high', 1: 'normal', 0: 'low' };
    key = intMap[item.priority] || 'normal';
  } else {
    key = (item.priority || 'normal').toLowerCase();
  }
  const label = key.replace(/_/g, ' ');
  const weight = typeof item.priority_score === 'number'
    ? item.priority_score
    : (PRIORITY_WEIGHT[key] || 0);
  const badgeClass = priorityBadgeClass(key);
  const rowClass = priorityRowClass(key);
  return {
    label: label.toUpperCase(),
    weight,
    badgeClass,
    rowClass
  };
}

function priorityBadgeClass(key) {
  if (key === 'urgent') return 'urgent';
  if (key === 'high') return 'high';
  if (key === 'normal' || key === 'medium') return 'normal';
  if (key === 'low') return 'low';
  return 'normal';
}

function priorityRowClass(key) {
  if (key === 'urgent') return 'priority-urgent';
  if (key === 'high') return 'priority-high';
  if (key === 'normal' || key === 'medium') return 'priority-normal';
  if (key === 'low') return 'priority-low';
  return 'priority-normal';
}

function getDueInfo(dueDate, completedAt = null) {
  if (!dueDate) return { label: 'No due date', chipClass: '', isOverdue: false };
  
  // Use completed_at date if order is completed, otherwise use today
  const compareDate = completedAt ? new Date(completedAt) : new Date();
  const target = new Date(dueDate);
  const diffMs = target.getTime() - compareDate.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    // Order was late - show how late it was (frozen for completed orders)
    const label = completedAt ? `Was late ${Math.abs(diffDays)}d` : `Late ${Math.abs(diffDays)}d`;
    return { label, chipClass: 'late', isOverdue: true };
  }
  if (diffDays === 0) {
    return { label: completedAt ? 'Completed on time' : 'Due today', chipClass: 'soon', isOverdue: false };
  }
  if (diffDays === 1) {
    return { label: 'Due in 1 day', chipClass: 'soon', isOverdue: false };
  }
  if (diffDays <= 3) {
    return { label: `Due in ${diffDays} days`, chipClass: 'soon', isOverdue: false };
  }
  return { label: completedAt ? 'Completed early' : `${diffDays} days left`, chipClass: 'ok', isOverdue: false };
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDueLabel(dueDate) {
  if (!dueDate) return 'No due date';
  const now = new Date();
  const target = new Date(dueDate);
  const diffMs = target.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return `Late ${Math.abs(diffDays)}d`;
  if (diffDays === 0) return 'Due today';
  if (diffDays === 1) return 'Due in 1 day';
  if (diffDays <= 3) return `Due in ${diffDays} days`;
  return target.toLocaleDateString();
}

// ========== Edit Order Functions ==========
let editingOrderId = null;
let editingOrderParts = [];
let allCustomers = [];

async function openEditOrderModal(orderId) {
  editingOrderId = orderId;
  
  try {
    // Load order details
    const orderRes = await fetch(`${API_URL}/orders/${orderId}`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const orderData = await orderRes.json();
    
    if (!orderRes.ok) {
      showError('Failed to load order details');
      return;
    }
    
    const order = orderData.order || orderData;
    
    // Load customers for dropdown
    await loadCustomersForEdit();
    
    // Populate form
    document.getElementById('edit-order-id').textContent = orderId;
    document.getElementById('edit-priority').value = (order.priority || 'normal').toLowerCase();
    document.getElementById('edit-status').value = order.status || 'pending';
    document.getElementById('edit-customer').value = order.customer_id || '';
    
    // Format date for input
    if (order.due_date) {
      const date = new Date(order.due_date);
      document.getElementById('edit-due-date').value = date.toISOString().split('T')[0];
    } else {
      document.getElementById('edit-due-date').value = '';
    }
    
    // Load parts
    editingOrderParts = order.parts || [];
    renderEditParts();
    
    // Show modal
    document.getElementById('edit-order-modal').classList.add('active');
  } catch (error) {
    console.error('Error opening edit modal:', error);
    showError('Error loading order for editing');
  }
}

async function loadCustomersForEdit() {
  try {
    const res = await fetch(`${API_URL}/customers`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const data = await res.json();
    allCustomers = data.customers || data || [];
    
    const select = document.getElementById('edit-customer');
    select.innerHTML = '<option value="">Select Customer</option>' +
      allCustomers.map(c => `<option value="${c.id}">${escapeHtml(c.company_name || c.name)}</option>`).join('');
  } catch (error) {
    console.error('Error loading customers:', error);
  }
}

function renderEditParts() {
  const container = document.getElementById('edit-parts-list');
  
  if (!editingOrderParts || editingOrderParts.length === 0) {
    container.innerHTML = '<p style="color: #6B7280; font-style: italic;">No parts in this order</p>';
    return;
  }
  
  container.innerHTML = editingOrderParts.map((part, index) => `
    <div class="edit-part-item" data-part-id="${part.id}">
      <div class="edit-part-info">
        <div class="edit-part-name">${escapeHtml(part.part_name || part.name || 'Unnamed Part')}</div>
        <div class="edit-part-details">
          Material: ${escapeHtml(part.material_type || part.material || 'N/A')} | 
          Qty: ${part.quantity || 1} |
          Status: ${part.status || 'pending'}
        </div>
      </div>
      <select class="edit-part-priority" data-part-id="${part.id}" onchange="updatePartPriority(${part.id}, this.value)">
        <option value="urgent" ${part.priority === 'urgent' ? 'selected' : ''}>🔴 Urgent</option>
        <option value="high" ${part.priority === 'high' ? 'selected' : ''}>🟠 High</option>
        <option value="normal" ${(part.priority === 'normal' || !part.priority) ? 'selected' : ''}>🟢 Normal</option>
        <option value="low" ${part.priority === 'low' ? 'selected' : ''}>🔵 Low</option>
      </select>
      <button type="button" class="btn-remove-part" onclick="removePartFromOrder(${part.id}, ${index})">Remove</button>
    </div>
  `).join('');
}

async function updatePartPriority(partId, priority) {
  try {
    const res = await fetch(`${API_URL}/parts/${partId}/priority`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${getToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ priority })
    });
    
    if (!res.ok) {
      const data = await res.json();
      showError(data.message || 'Failed to update part priority');
      return;
    }
    
    // Update local data
    const partIndex = editingOrderParts.findIndex(p => p.id === partId);
    if (partIndex >= 0) {
      editingOrderParts[partIndex].priority = priority;
    }
    
    showSuccess('Part priority updated');
  } catch (error) {
    console.error('Error updating part priority:', error);
    showError('Error updating part priority');
  }
}

async function removePartFromOrder(partId, index) {
  if (!confirm('Are you sure you want to remove this part from the order?')) {
    return;
  }
  
  try {
    const res = await fetch(`${API_URL}/parts/${partId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    
    if (!res.ok) {
      showError('Failed to remove part');
      return;
    }
    
    editingOrderParts.splice(index, 1);
    renderEditParts();
    showSuccess('Part removed');
  } catch (error) {
    console.error('Error removing part:', error);
    showError('Error removing part');
  }
}

function closeEditOrderModal() {
  document.getElementById('edit-order-modal').classList.remove('active');
  editingOrderId = null;
  editingOrderParts = [];
}

async function saveOrderChanges(event) {
  event.preventDefault();
  
  if (!editingOrderId) return;
  
  const updates = {
    priority: document.getElementById('edit-priority').value,
    status: document.getElementById('edit-status').value,
    customer_id: document.getElementById('edit-customer').value || null,
    due_date: document.getElementById('edit-due-date').value || null
  };
  
  try {
    const res = await fetch(`${API_URL}/orders/${editingOrderId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${getToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updates)
    });
    
    if (!res.ok) {
      const data = await res.json();
      showError(data.message || 'Failed to update order');
      return;
    }
    
    showSuccess('Order updated successfully');
    closeEditOrderModal();
    loadOrders(currentFilter);
  } catch (error) {
    console.error('Error saving order:', error);
    showError('Error saving order changes');
  }
}

// Add Part Modal Functions
function openAddPartModal() {
  document.getElementById('add-part-form').reset();
  document.getElementById('add-part-modal').classList.add('active');
}

function closeAddPartModal() {
  document.getElementById('add-part-modal').classList.remove('active');
}

async function addPartToOrder(event) {
  event.preventDefault();
  
  if (!editingOrderId) return;
  
  const partData = {
    part_name: document.getElementById('new-part-name').value,
    material_type: document.getElementById('new-part-material').value || null,
    quantity: parseInt(document.getElementById('new-part-quantity').value) || 1,
    description: document.getElementById('new-part-description').value || null,
    priority: document.getElementById('new-part-priority').value || null
  };
  
  try {
    // Use new endpoint that adds part to specific order
    const res = await fetch(`${API_URL}/orders/${editingOrderId}/parts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(partData)
    });
    
    if (!res.ok) {
      const data = await res.json();
      showError(data.message || 'Failed to add part');
      return;
    }
    
    const response = await res.json();
    editingOrderParts.push(response.part);
    renderEditParts();
    closeAddPartModal();
    showSuccess('Part added successfully');
  } catch (error) {
    console.error('Error adding part:', error);
    showError('Error adding part');
  }
}
