// Supervisor Dashboard JS

let assignableUsers = [];
let machines = [];
let allParts = [];
let draggedPartId = null;

document.addEventListener('DOMContentLoaded', () => {
  if (!Auth.requireAuth()) return;
  const user = Auth.getUser();
  document.getElementById('userName').textContent = user.name;

  // Only supervisors/admins
  const isSupervisor = (typeof user.level === 'number' && user.level >= 400) || (user.role === 'supervisor' || user.role === 'admin');
  if (!isSupervisor) {
    alert('Supervisor access required');
    location.href = 'index.html';
    return;
  }

  // Setup tab navigation
  setupTabs();

  // Setup event listeners
  document.getElementById('refreshJobsBtn').addEventListener('click', loadJobs);
  document.getElementById('refreshMachinesBtn').addEventListener('click', loadMachineBoard);
  document.getElementById('logoutBtn').addEventListener('click', () => { Auth.logout(); location.href = 'login.html'; });
  document.getElementById('createJobForm').addEventListener('submit', createJob);

  // Load initial data
  loadAssignableUsers();
  loadMachineBoard();
  loadJobs();

  // Auto-refresh machine board every 15 seconds
  setInterval(loadMachineBoard, 15000);
});

function setupTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      
      // Update active button
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Show correct content
      document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
      });
      document.getElementById(tabId).classList.add('active');
    });
  });
}

// =====================================
// MACHINE KANBAN BOARD
// =====================================

async function loadMachineBoard() {
  const board = document.getElementById('machineBoard');
  
  try {
    // Load machines and parts in parallel
    const [machinesRes, partsRes] = await Promise.all([
      fetch(`${API_URL}/machines`, {
        headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
      }),
      fetch(`${API_URL}/parts`, {
        headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
      })
    ]);

    const machinesData = await machinesRes.json();
    const partsData = await partsRes.json();

    machines = machinesData.machines || [];
    allParts = partsData.parts || partsData || [];

    renderMachineBoard();
    setupMachineDragDrop();
  } catch (error) {
    console.error('Failed to load machine board:', error);
    board.innerHTML = `<div class="error-message" style="padding: 2rem; color: #dc3545;">Failed to load machines: ${error.message}</div>`;
  }
}

function renderMachineBoard() {
  const board = document.getElementById('machineBoard');
  
  // Group parts by machine assignment
  const unassignedParts = allParts.filter(p => !p.machine_type && p.workflow_stage !== 'completed');
  
  // Create unassigned lane first
  let html = `
    <div class="machine-lane" id="machine-unassigned" data-machine-id="unassigned">
      <div class="machine-header unassigned">
        <h4>📥 Unassigned Parts</h4>
        <div class="machine-status">${unassignedParts.length} parts</div>
      </div>
      <div class="machine-body">
        ${renderPartsForMachine(unassignedParts)}
      </div>
    </div>
  `;

  // Create lanes for each machine
  machines.forEach(machine => {
    const machineParts = allParts.filter(p => 
      p.machine_type === machine.machine_type && 
      p.machine_number === machine.machine_number &&
      p.workflow_stage !== 'completed'
    );
    
    const headerClass = machine.machine_type === 'lathe' ? 'lathe' : 'mill';
    const statusClass = machine.status === 'available' ? 'available' : 
                        machine.status === 'maintenance' ? 'maintenance' : 'busy';
    const statusIcon = machine.status === 'available' ? '🟢' : 
                       machine.status === 'maintenance' ? '🔧' : '🟡';

    html += `
      <div class="machine-lane" id="machine-${machine.id}" data-machine-id="${machine.id}" data-machine-type="${machine.machine_type}" data-machine-number="${machine.machine_number}">
        <div class="machine-header ${headerClass}">
          <h4>${machine.machine_name || `${machine.machine_type} #${machine.machine_number}`}</h4>
          <div class="machine-status ${statusClass}">
            ${statusIcon} ${machine.status || 'available'} • ${machineParts.length} parts
          </div>
        </div>
        <div class="machine-body">
          ${renderPartsForMachine(machineParts)}
        </div>
      </div>
    `;
  });

  board.innerHTML = html;
}

function renderPartsForMachine(parts) {
  if (!parts || parts.length === 0) {
    return '<div class="empty-lane">Drop parts here</div>';
  }

  return parts.map(part => {
    const stage = part.workflow_stage || 'pending';
    return `
      <div class="part-chip" draggable="true" data-part-id="${part.id}">
        <div class="part-chip-name">${part.part_name || part.name}</div>
        <div class="part-chip-info">
          <span>Qty: ${part.quantity}</span>
          <span class="part-chip-stage ${stage}">${stage}</span>
        </div>
        <div class="part-chip-info" style="margin-top: 4px;">
          <span style="color: #999; font-size: 0.75rem;">Order #${part.order_id || '-'}</span>
        </div>
      </div>
    `;
  }).join('');
}

function setupMachineDragDrop() {
  // Setup drag start for all part chips
  document.querySelectorAll('.part-chip').forEach(chip => {
    chip.addEventListener('dragstart', (e) => {
      draggedPartId = parseInt(chip.getAttribute('data-part-id'));
      chip.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    chip.addEventListener('dragend', (e) => {
      chip.classList.remove('dragging');
      draggedPartId = null;
    });
  });

  // Setup drop zones for all machine lanes
  document.querySelectorAll('.machine-lane').forEach(lane => {
    lane.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      lane.classList.add('drag-over');
    });

    lane.addEventListener('dragleave', (e) => {
      if (!lane.contains(e.relatedTarget)) {
        lane.classList.remove('drag-over');
      }
    });

    lane.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      lane.classList.remove('drag-over');

      if (!draggedPartId) return;

      const machineId = lane.getAttribute('data-machine-id');
      const machineType = lane.getAttribute('data-machine-type');
      const machineNumber = lane.getAttribute('data-machine-number');

      await assignPartToMachine(draggedPartId, machineId, machineType, machineNumber);
      draggedPartId = null;
    });
  });
}

async function assignPartToMachine(partId, machineId, machineType, machineNumber) {
  try {
    let body = {};
    
    if (machineId === 'unassigned') {
      // Unassign from machine
      body = {
        machine_type: null,
        machine_number: null
      };
    } else {
      body = {
        machine_type: machineType,
        machine_number: parseInt(machineNumber)
      };
    }

    const response = await fetch(`${API_URL}/parts/${partId}/assign-machine`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Auth.getToken()}`
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
      showToast(data.message || 'Failed to assign part', 'error');
      return;
    }

    // Reload the board
    loadMachineBoard();
    showToast(`Part assigned to ${machineId === 'unassigned' ? 'unassigned' : `${machineType} #${machineNumber}`}`, 'success');
  } catch (error) {
    console.error('Error assigning part:', error);
    showToast('Error assigning part: ' + error.message, 'error');
  }
}

function showToast(message, type = 'info') {
  // Remove existing toasts
  document.querySelectorAll('.toast-notification').forEach(t => t.remove());

  const toast = document.createElement('div');
  toast.className = `toast-notification toast-${type}`;
  toast.innerHTML = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 12px 20px;
    border-radius: 6px;
    color: white;
    font-weight: 500;
    z-index: 10000;
    animation: slideIn 0.3s ease;
    background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#667eea'};
  `;

  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// =====================================
// JOBS MANAGEMENT (existing functionality)
// =====================================

async function loadAssignableUsers() {
  try {
    const data = await API.users.list();
    const current = Auth.getUser();
    const currentLevel = typeof current.level === 'number' ? current.level : 400;
    assignableUsers = (data.users || []).filter(u => (u.level || 100) <= 300);
  } catch (e) {
    console.error('Failed to load users', e);
  }
}

async function createJob(event) {
  event.preventDefault();
  const msg = document.getElementById('createJobMsg');
  msg.textContent = 'Creating job...';

  const payload = {
    name: document.getElementById('jobName').value.trim(),
    material: document.getElementById('jobMaterial').value.trim(),
    quantity: parseInt(document.getElementById('jobQuantity').value, 10),
    treatment: document.getElementById('jobTreatment').value.trim() || null,
    targetTime: parseInt(document.getElementById('jobTarget').value, 10),
    orderPosition: parseInt(document.getElementById('jobOrder').value, 10)
  };

  try {
    await API.parts.create(payload);
    msg.textContent = '✓ Job created';
    event.target.reset();
    loadJobs();
  } catch (error) {
    msg.textContent = `✗ ${error.message}`;
  }
}

async function loadJobs() {
  const tbody = document.getElementById('jobsTableBody');
  tbody.innerHTML = '<tr><td colspan="8" class="text-muted" style="padding:10px;">Loading...</td></tr>';

  try {
    const parts = await API.parts.getAll();
    tbody.innerHTML = '';
    parts.forEach(part => {
      const tr = document.createElement('tr');
      const assignedUsers = (part.assignments || []).filter(a => a.employeeId).map(a => `${a.employeeId} (${a.status})`).join(', ') || 'Unassigned';
      tr.innerHTML = `
        <td>${part.order_position || part.order_id || '-'}</td>
        <td>${part.name || part.part_name || '-'}</td>
        <td>${part.material || part.material_type || 'N/A'}</td>
        <td>${part.quantity || 1}</td>
        <td>${part.target_time || part.estimated_time || '-'}</td>
        <td style="font-size: 0.9em; color: #666;">${assignedUsers}</td>
        <td>
          <button class="btn btn-primary" data-action="assign" data-id="${part.id}">Assign to Users</button>
        </td>`;
      tbody.appendChild(tr);
    });

    // Wire assign buttons
    tbody.querySelectorAll('button[data-action="assign"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const partId = parseInt(btn.getAttribute('data-id'), 10);
        const part = parts.find(p => p.id === partId);
        openAssignmentModal(partId, part);
      });
    });

  } catch (error) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-danger" style="padding:10px;">Failed to load jobs</td></tr>';
  }
}

function openAssignmentModal(partId, part) {
  // Create modal HTML
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 500px;">
      <div class="modal-header">
        <h3>Assign Job: ${part.name}</h3>
        <button class="modal-close" type="button">&times;</button>
      </div>
      <div class="modal-body" style="max-height: 400px; overflow-y: auto;">
        <p style="margin-bottom: 15px;">Select operators to assign this job:</p>
        <div id="assignmentCheckboxes"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" type="button">Cancel</button>
        <button class="btn btn-primary" type="button">Assign Selected</button>
      </div>
    </div>
  `;

  const checkboxContainer = modal.querySelector('#assignmentCheckboxes');
  
  // Build checkboxes for each operator
  assignableUsers.forEach(user => {
    const isAssigned = (part.assignments || []).some(a => a.userId === user.id);
    const div = document.createElement('div');
    div.style.marginBottom = '10px';
    div.innerHTML = `
      <label style="display: flex; align-items: center; cursor: pointer;">
        <input type="checkbox" value="${user.id}" ${isAssigned ? 'checked' : ''} style="margin-right: 10px;">
        <span>${user.employee_id} - ${user.name} (${user.level === 100 ? 'CNC Operator' : user.level === 200 ? 'Cutting Operator' : 'QC'})</span>
      </label>
    `;
    checkboxContainer.appendChild(div);
  });

  // Handle events
  const cancelBtn = modal.querySelector('.modal-footer .btn-secondary');
  const assignBtn = modal.querySelector('.modal-footer .btn-primary');
  const closeBtn = modal.querySelector('.modal-close');

  const cleanup = () => modal.remove();

  cancelBtn.addEventListener('click', cleanup);
  closeBtn.addEventListener('click', cleanup);

  assignBtn.addEventListener('click', async () => {
    const selectedCheckboxes = modal.querySelectorAll('input[type="checkbox"]:checked');
    const userIds = Array.from(selectedCheckboxes).map(cb => parseInt(cb.value, 10));

    if (userIds.length === 0) {
      alert('Please select at least one operator');
      return;
    }

    try {
      assignBtn.disabled = true;
      assignBtn.textContent = 'Assigning...';
      
      await API.parts.assignMultiple(partId, userIds);
      
      alert('Job assigned successfully!');
      cleanup();
      loadJobs();
    } catch (error) {
      alert(`Error: ${error.message}`);
      assignBtn.disabled = false;
      assignBtn.textContent = 'Assign Selected';
    }
  });

  // Add modal styles if not present
  if (!document.getElementById('modalStyles')) {
    const style = document.createElement('style');
    style.id = 'modalStyles';
    style.textContent = `
      .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
      }
      .modal-content {
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        overflow: hidden;
      }
      .modal-header {
        background: #f5f5f5;
        padding: 20px;
        border-bottom: 1px solid #ddd;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .modal-header h3 {
        margin: 0;
        font-size: 18px;
      }
      .modal-close {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #999;
      }
      .modal-body {
        padding: 20px;
      }
      .modal-footer {
        background: #f5f5f5;
        padding: 15px 20px;
        border-top: 1px solid #ddd;
        text-align: right;
      }
      .modal-footer button {
        margin-left: 10px;
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(modal);
}
