let currentOrderId = null;
let currentParts = {};
let draggedPartId = null;

document.addEventListener('DOMContentLoaded', function() {
  ensureAuthed();
  
  const params = new URLSearchParams(window.location.search);
  currentOrderId = params.get('id') || getLastOrderId();

  if (currentOrderId) {
    loadWorkflow();
    setupDragAndDrop();
    
    // Refresh every 10 seconds
    setInterval(() => {
      loadWorkflow();
    }, 10000);
  } else {
    showError('Order not found');
  }
});

function setupDragAndDrop() {
  const stages = ['pending', 'cutting', 'programming', 'machining', 'qc', 'completed'];
  
  stages.forEach(stage => {
    const stageCard = document.getElementById(`${stage}-card`);
    if (!stageCard) return;
    
    // Remove existing listeners by cloning and replacing
    const newStageCard = stageCard.cloneNode(true);
    stageCard.parentNode.replaceChild(newStageCard, stageCard);
    
    newStageCard.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      newStageCard.classList.add('drag-over');
    });
    
    newStageCard.addEventListener('dragleave', (e) => {
      e.preventDefault();
      // Only remove if we're leaving the stage card, not entering a child
      if (!newStageCard.contains(e.relatedTarget)) {
        newStageCard.classList.remove('drag-over');
      }
    });
    
    newStageCard.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      newStageCard.classList.remove('drag-over');
      
      if (draggedPartId) {
        await movePartToStage(draggedPartId, stage);
        draggedPartId = null;
      }
    });
  });
}

function getLastOrderId() {
  // Could fetch from localStorage or session
  return localStorage.getItem('lastOrderId');
}

async function loadWorkflow() {
  try {
    const response = await fetch(`${API_URL}/orders/${currentOrderId}`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      showError('Failed to load order');
      return;
    }

    const order = data.order;
    currentParts = {};
    
    order.parts.forEach(part => {
      currentParts[part.id] = part;
    });

    renderWorkflow(order);
  } catch (error) {
    console.error('Error loading workflow:', error);
    showError('Error loading workflow: ' + error.message);
  }
}

function renderWorkflow(order) {
  // Update order summary
  document.getElementById('order-num').textContent = `#${order.id}`;
  document.getElementById('customer-name').textContent = order.customer_name;
  document.getElementById('total-parts').textContent = order.parts.length;

  const completedCount = order.parts.filter(p => p.workflow_stage === 'completed').length;
  document.getElementById('completed-parts').textContent = completedCount;

  // Update stage stats
  const stages = {};
  stages['pending'] = 0;
  stages['cutting'] = 0;
  stages['programming'] = 0;
  stages['machining'] = 0;
  stages['qc'] = 0;
  stages['completed'] = 0;

  order.parts.forEach(part => {
    const stage = part.workflow_stage || 'pending';
    stages[stage]++;
  });

  document.getElementById('stat-pending').textContent = stages['pending'];
  document.getElementById('stat-cutting').textContent = stages['cutting'];
  document.getElementById('stat-programming').textContent = stages['programming'];
  document.getElementById('stat-machining').textContent = stages['machining'];
  document.getElementById('stat-qc').textContent = stages['qc'];
  document.getElementById('stat-completed').textContent = stages['completed'];

  // Render workflow stages
  const stageOrder = ['pending', 'cutting', 'programming', 'machining', 'qc', 'completed'];
  
  stageOrder.forEach(stage => {
    const stageParts = order.parts.filter(p => (p.workflow_stage || 'pending') === stage);
    renderStage(stage, stageParts);
  });
}

function renderStage(stage, parts) {
  const stageContainer = document.getElementById(`${stage}-stage`);
  document.getElementById(`${stage}-count`).textContent = parts.length;

  if (!parts || parts.length === 0) {
    stageContainer.innerHTML = `
      <div class="empty-stage">
        <div class="empty-stage-icon">—</div>
        <p>No parts in this stage</p>
      </div>
    `;
    return;
  }

  stageContainer.innerHTML = parts.map(part => renderPartCard(part, stage)).join('');
}

function renderPartCard(part, stage) {
  let batchInfo = '';
  if (part.batch_number) {
    batchInfo = `<div class="batch-info">Batch: ${part.batch_number}</div>`;
  }

  const nextStage = getNextStage(stage);
  const isCompleted = stage === 'completed';

  return `
    <div class="part-card" draggable="true" ondragstart="handleDragStart(event, ${part.id})" ondragend="handleDragEnd(event)">
      <div class="part-name">
        ${part.part_name}
        <span style="font-size: 0.8rem; color: #999;"> (Qty: ${part.quantity})</span>
      </div>
      ${batchInfo}
      <div class="part-info">
        <span>${part.material_name || 'No material'}</span>
        <span>${part.status.toUpperCase()}</span>
      </div>
      <div class="part-actions">
        ${!isCompleted ? `
          <button class="btn-action btn-complete" onclick="completeStage(${part.id}, '${stage}')">
            ✓ Complete
          </button>
        ` : ''}
        <button class="btn-action btn-hold" onclick="holdPart(${part.id})">
          ⏸ Hold
        </button>
        <button class="btn-action btn-detail" onclick="viewPartDetail(${part.id})">
          📋 Details
        </button>
      </div>
    </div>
  `;
}

function handleDragStart(event, partId) {
  draggedPartId = partId;
  event.target.classList.add('dragging');
}

function handleDragEnd(event) {
  event.target.classList.remove('dragging');
}

async function movePartToStage(partId, newStage) {
  const part = currentParts[partId];
  if (!part) return;

  try {
    const response = await fetch(`${API_URL}/parts/${partId}/workflow/stage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({
        stage: newStage,
        notes: `Manually moved to ${newStage}`
      })
    });

    const data = await response.json();

    if (!response.ok) {
      showError(data.message || 'Failed to move part');
      return;
    }

    showSuccess(`${part.part_name} moved to ${newStage}`);
    loadWorkflow();
  } catch (error) {
    console.error('Error moving part:', error);
    showError('Error moving part: ' + error.message);
  }
}

function getNextStage(current) {
  const order = ['cutting', 'programming', 'machining', 'qc', 'completed'];
  const idx = order.indexOf(current);
  return idx >= 0 && idx < order.length - 1 ? order[idx + 1] : null;
}

async function completeStage(partId, stage) {
  const part = currentParts[partId];
  if (!part) return;

  try {
    const response = await fetch(`${API_URL}/parts/${partId}/workflow/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({
        notes: `Completed ${stage} stage`
      })
    });

    const data = await response.json();

    if (!response.ok) {
      showError(data.message || 'Failed to complete stage');
      return;
    }

    showSuccess(`${part.part_name} moved to next stage`);
    loadWorkflow();
  } catch (error) {
    console.error('Error completing stage:', error);
    showError('Error completing stage: ' + error.message);
  }
}

function holdPart(partId) {
  const part = currentParts[partId];
  if (!part) return;

  // Set current action
  window.currentPartAction = {
    partId,
    action: 'hold',
    partName: part.part_name
  };

  document.getElementById('action-modal-title').textContent = `Hold Part: ${part.part_name}`;
  document.getElementById('action-notes').value = '';
  document.getElementById('action-notes').placeholder = 'Reason for holding...';
  document.getElementById('action-submit-btn').textContent = 'Hold Part';
  
  document.getElementById('action-modal').classList.add('active');
}

async function submitAction() {
  if (!window.currentPartAction) return;

  const { partId, action } = window.currentPartAction;
  const notes = document.getElementById('action-notes').value;

  try {
    const endpoint = action === 'hold' ? 'hold' : 'resume';
    const response = await fetch(`${API_URL}/parts/${partId}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({ reason: notes })
    });

    const data = await response.json();

    if (!response.ok) {
      showError(data.message || `Failed to ${action} part`);
      return;
    }

    showSuccess(`Part ${action}ed successfully`);
    closeModal('action-modal');
    loadWorkflow();
  } catch (error) {
    console.error('Error:', error);
    showError('Error: ' + error.message);
  }
}

function viewPartDetail(partId) {
  const part = currentParts[partId];
  if (!part) return;

  // Could navigate to a detailed part view or show modal
  console.log('Part details:', part);
  alert(`Part: ${part.part_name}\nStatus: ${part.status}\nWorkflow: ${part.workflow_stage}\nQty: ${part.quantity}`);
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
  window.currentPartAction = null;
}

function showError(message) {
  const errorEl = document.createElement('div');
  errorEl.textContent = message;
  errorEl.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #f8d7da; color: #842029; padding: 1rem; border-radius: 4px; z-index: 2000; max-width: 300px;';
  document.body.appendChild(errorEl);
  setTimeout(() => errorEl.remove(), 5000);
}

function showSuccess(message) {
  const successEl = document.createElement('div');
  successEl.textContent = message;
  successEl.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #d1e7dd; color: #0f5132; padding: 1rem; border-radius: 4px; z-index: 2000; max-width: 300px;';
  document.body.appendChild(successEl);
  setTimeout(() => successEl.remove(), 5000);
}
