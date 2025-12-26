// Supervisor Dashboard JS

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

  document.getElementById('refreshJobsBtn').addEventListener('click', loadJobs);
  document.getElementById('logoutBtn').addEventListener('click', () => { Auth.logout(); location.href = 'login.html'; });
  document.getElementById('createJobForm').addEventListener('submit', createJob);

  loadAssignableUsers();
  loadJobs();
});

let assignableUsers = [];

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
      const assignedUsers = (part.assignments || []).map(a => `${a.employeeId} (${a.status})`).join(', ') || 'Unassigned';
      tr.innerHTML = `
        <td>${part.order_position}</td>
        <td>${part.name}</td>
        <td>${part.material}</td>
        <td>${part.quantity}</td>
        <td>${part.target_time}</td>
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
