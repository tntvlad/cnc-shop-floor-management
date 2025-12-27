let currentFilter = 'all';
const PRIORITY_WEIGHT = {
  urgent: 3,
  high: 3,
  normal: 2,
  medium: 2,
  low: 1
};

document.addEventListener('DOMContentLoaded', function() {
  ensureAuthed();
  loadOrders();
  loadStats();
  setupEventListeners();

  // Refresh every 30 seconds
  setInterval(() => {
    loadOrders();
    loadStats();
  }, 30000);
});

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
    const dueLabel = formatDueLabel(order.due_date);
    const progress = order.part_count > 0 ? Math.round((order.completed_parts / order.part_count) * 100) : 0;
    const priority = getPriorityMeta(order);

    return `
      <tr class="priority-row ${priority.rowClass}" onclick="openOrderDetails(${order.id})">
        <td><strong>#${order.id}</strong></td>
        <td>
          <span class="priority-badge ${priority.badgeClass}">${priority.label}</span>
          ${priority.weight ? `<div class="priority-score">Score ${priority.weight}</div>` : ''}
        </td>
        <td>
          <div style="font-weight: 600;">${order.customer_name}</div>
          <div style="font-size: 0.85rem; color: #999;">${order.customer_email}</div>
        </td>
        <td>
          <strong>${order.part_count}</strong> parts
          <br>
          <span style="color: #666;">${order.completed_parts} completed</span>
        </td>
        <td>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${progress}%;"></div>
          </div>
          <div style="font-size: 0.85rem; text-align: center; margin-top: 0.5rem;">${progress}%</div>
        </td>
        <td>
          <div>${dueDate}</div>
          <div class="due-chip">${dueLabel}</div>
        </td>
        <td>
          <span class="status-badge status-${order.status}">
            ${order.status.toUpperCase()}
          </span>
        </td>
        <td>
          <div class="action-buttons">
            <button class="btn-view" onclick="openOrderDetails(${order.id}); event.stopPropagation();">View</button>
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
  const key = (item.priority || '').toLowerCase();
  const label = key ? key.replace(/_/g, ' ') : 'normal';
  const weight = typeof item.priority_score === 'number'
    ? item.priority_score
    : (PRIORITY_WEIGHT[key] || 0);
  const badgeClass = priorityClass(key);
  const rowClass = priorityClass(key);
  return {
    label: label.toUpperCase(),
    weight,
    badgeClass,
    rowClass
  };
}

function priorityClass(key) {
  if (key === 'urgent' || key === 'high') return 'priority-urgent';
  if (key === 'normal' || key === 'medium') return 'priority-normal';
  if (key === 'low') return 'priority-low';
  return 'priority-normal';
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
