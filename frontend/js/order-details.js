let currentOrder = null;

document.addEventListener('DOMContentLoaded', function() {
  ensureAuthed();
  loadOrderDetails();
  
  // Refresh every 20 seconds
  setInterval(() => {
    loadOrderDetails();
  }, 20000);

  // Expose workflow navigation once order loads
  window.openWorkflowMonitor = function() {
    if (!currentOrder || !currentOrder.id) {
      alert('Order not loaded yet');
      return;
    }
    navigateTo(`workflow-monitor.html?id=${currentOrder.id}`);
  };
});

async function loadOrderDetails() {
  try {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('id');

    if (!orderId) {
      showError('Order ID not found');
      return;
    }

    const response = await fetch(`${API_URL}/orders/${orderId}`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      showError(data.message || 'Failed to load order');
      return;
    }

    currentOrder = data.order;
    renderOrderDetails();
    renderParts();
    loadMaterialRequirements();
  } catch (error) {
    console.error('Error loading order:', error);
    showError('Error loading order: ' + error.message);
  }
}

function renderOrderDetails() {
  if (!currentOrder) return;

  document.getElementById('order-id').textContent = currentOrder.id;
  document.getElementById('customer-name').textContent = currentOrder.customer_name;
  document.getElementById('customer-email').textContent = currentOrder.customer_email;
  document.getElementById('customer-phone').textContent = currentOrder.customer_phone || '---';
  document.getElementById('order-date').textContent = new Date(currentOrder.order_date).toLocaleDateString();
  document.getElementById('due-date').textContent = new Date(currentOrder.due_date).toLocaleDateString();

  const priority = getPriorityMeta(currentOrder);
  const priorityEl = document.getElementById('order-priority');
  priorityEl.className = `priority-badge ${priority.badgeClass}`;
  priorityEl.textContent = priority.label;
  const priorityScoreEl = document.getElementById('order-priority-score');
  priorityScoreEl.textContent = priority.weight ? `(Score ${priority.weight})` : '';
  document.getElementById('order-due-countdown').textContent = formatDueLabel(currentOrder.due_date);

  const statusBadge = `<span class="status-badge status-${currentOrder.status}">${currentOrder.status.toUpperCase()}</span>`;
  document.getElementById('order-status').innerHTML = statusBadge;

  // Notes
  if (currentOrder.notes) {
    document.getElementById('notes-section').style.display = 'block';
    document.getElementById('order-notes').textContent = currentOrder.notes;
  } else {
    document.getElementById('notes-section').style.display = 'none';
  }
}

function renderParts() {
  if (!currentOrder || !currentOrder.parts) {
    return;
  }

  const tbody = document.getElementById('parts-tbody');
  const sortedParts = [...currentOrder.parts].sort((a, b) => {
    const pa = getPriorityMeta(a).weight;
    const pb = getPriorityMeta(b).weight;
    if (pb !== pa) return pb - pa;
    return (a.order_position || 0) - (b.order_position || 0);
  });

  tbody.innerHTML = sortedParts.map(part => {
    const workflowStage = part.workflow_stage || 'pending';
    const workflowEmoji = {
      'cutting': '✂️',
      'programming': '💻',
      'machining': '⚙️',
      'qc': '✅',
      'completed': '🎉'
    }[workflowStage] || '📋';

    let batchInfo = '';
    if (part.batch_number) {
      batchInfo = `<br><div class="batch-info">Batch: ${part.batch_number}</div>`;
    }

    return `
      <tr class="part-row" onclick="viewPartDetails(${part.id})">
        <td>
          <strong>${part.part_name}</strong>
          ${batchInfo}
        </td>
        <td>${part.quantity}${part.quantity_scrapped ? ` (-${part.quantity_scrapped})` : ''}</td>
        <td>${part.material_name || '---'}</td>
        <td>
          <span class="workflow-badge">${workflowEmoji} ${workflowStage.toUpperCase()}</span>
        </td>
        <td>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${getStageProgress(workflowStage)}%;"></div>
          </div>
        </td>
        <td>
          <span class="status-badge status-${part.status}">${part.status.toUpperCase()}</span>
        </td>
      </tr>
    `;
  }).join('');
}

function getStageProgress(stage) {
  const stageMap = {
    'pending': 0,
    'cutting': 20,
    'programming': 40,
    'machining': 60,
    'qc': 80,
    'completed': 100
  };
  return stageMap[stage] || 0;
}

async function loadMaterialRequirements() {
  if (!currentOrder) return;

  try {
    const response = await fetch(`${API_URL}/orders/${currentOrder.id}/material-requirements`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      return;
    }

    renderMaterials(data.requirements || []);
  } catch (error) {
    console.error('Error loading materials:', error);
  }
}

function renderMaterials(materials) {
  const container = document.getElementById('materials-list');

  if (!materials || materials.length === 0) {
    container.innerHTML = '<p style="color: #999;">No materials assigned to parts</p>';
    return;
  }

  container.innerHTML = materials.map(material => {
    const needsOrder = material.fulfillment_status === 'need-to-order';
    const shortage = material.total_quantity_needed - material.current_stock;
    const alertClass = needsOrder ? 'alert-low' : 'alert-in-stock';

    return `
      <div class="material-item ${alertClass}">
        <div class="material-info">
          <div class="material-name">${material.material_name}</div>
          <div class="material-type">${material.material_type} - ${material.parts_using} part(s)</div>
        </div>
        <div style="text-align: right;">
          <strong>${material.total_quantity_needed}</strong> ${material.unit} needed
        </div>
        <div style="text-align: right;">
          <strong>${material.current_stock}</strong> ${material.unit} in stock
        </div>
        <div style="text-align: right;">
          ${needsOrder ? `<span style="color: red; font-weight: 600;">-${shortage} ${material.unit}</span>` : `<span style="color: green;">✓</span>`}
        </div>
      </div>
    `;
  }).join('');
}

function openStatusModal() {
  if (currentOrder.status) {
    document.getElementById('status-select').value = currentOrder.status;
  }
  document.getElementById('status-modal').classList.add('active');
}

async function updateOrderStatus() {
  if (!currentOrder) return;

  const newStatus = document.getElementById('status-select').value;

  try {
    const response = await fetch(`${API_URL}/orders/${currentOrder.id}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({ status: newStatus })
    });

    const data = await response.json();

    if (!response.ok) {
      showError(data.message || 'Failed to update status');
      return;
    }

    showSuccess('Status updated successfully');
    closeModal('status-modal');
    loadOrderDetails();
  } catch (error) {
    console.error('Error updating status:', error);
    showError('Error updating status: ' + error.message);
  }
}

function openMaterialsModal() {
  const modalContent = document.getElementById('materials-modal-content');
  
  if (!currentOrder || !currentOrder.parts) {
    modalContent.innerHTML = '<p>No materials found</p>';
    document.getElementById('materials-modal').classList.add('active');
    return;
  }

  const materials = currentOrder.parts.reduce((acc, part) => {
    if (part.material_name && !acc.find(m => m.id === part.material_id)) {
      acc.push(part);
    }
    return acc;
  }, []);

  modalContent.innerHTML = materials.map(part => `
    <div style="background: #f8f9fa; padding: 1rem; border-radius: 4px; margin-bottom: 1rem;">
      <div style="font-weight: 600; margin-bottom: 0.5rem;">${part.material_name}</div>
      <div style="font-size: 0.9rem; color: #666;">
        Required: <strong>${part.quantity}</strong> units
        <br>
        For: <strong>${part.part_name}</strong>
      </div>
    </div>
  `).join('');

  document.getElementById('materials-modal').classList.add('active');
}

function viewPartDetails(partId) {
  // Navigate to part details or show modal
  navigateTo(`order-details.html?id=${currentOrder.id}&part=${partId}`);
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
}

function showError(message) {
  const errorEl = document.createElement('div');
  errorEl.textContent = message;
  errorEl.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #f8d7da; color: #842029; padding: 1rem; border-radius: 4px; z-index: 2000;';
  document.body.appendChild(errorEl);
  setTimeout(() => errorEl.remove(), 5000);
}

function getPriorityMeta(item) {
  const key = (item.priority || '').toLowerCase();
  const label = key ? key.replace(/_/g, ' ') : 'normal';
  const weight = typeof item.priority_score === 'number'
    ? item.priority_score
    : priorityWeight(key);
  const badgeClass = priorityClass(key);
  return {
    label: label.toUpperCase(),
    weight,
    badgeClass
  };
}

function priorityClass(key) {
  if (key === 'urgent' || key === 'high') return 'priority-urgent';
  if (key === 'normal' || key === 'medium') return 'priority-normal';
  if (key === 'low') return 'priority-low';
  return 'priority-normal';
}

function priorityWeight(key) {
  if (key === 'urgent' || key === 'high') return 3;
  if (key === 'normal' || key === 'medium') return 2;
  if (key === 'low') return 1;
  return 0;
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

function showSuccess(message) {
  const successEl = document.createElement('div');
  successEl.textContent = message;
  successEl.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #d1e7dd; color: #0f5132; padding: 1rem; border-radius: 4px; z-index: 2000;';
  document.body.appendChild(successEl);
  setTimeout(() => successEl.remove(), 5000);
}
