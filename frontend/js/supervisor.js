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
  tbody.innerHTML = '<tr><td colspan="7" class="text-muted" style="padding:10px;">Loading...</td></tr>';

  try {
    const parts = await API.parts.getAll();
    tbody.innerHTML = '';
    parts.forEach(part => {
      const tr = document.createElement('tr');
      const assigned = part.assigned_user;
      tr.innerHTML = `
        <td>${part.order_position}</td>
        <td>${part.name}</td>
        <td>${part.material}</td>
        <td>${part.quantity}</td>
        <td>${part.target_time}</td>
        <td>
          <select data-part="${part.id}" class="assign-select">
            <option value="">Unassigned</option>
          </select>
        </td>
        <td>
          <button class="btn btn-primary" data-action="assign" data-id="${part.id}">Save Assignment</button>
        </td>`;
      tbody.appendChild(tr);
    });

    // Populate dropdowns
    document.querySelectorAll('.assign-select').forEach(sel => {
      const partId = parseInt(sel.getAttribute('data-part'), 10);
      assignableUsers.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.id;
        opt.textContent = `${u.employee_id} - ${u.name}`;
        sel.appendChild(opt);
      });
      const part = parts.find(p => p.id === partId);
      if (part && part.assigned_user && part.assigned_user.id) {
        sel.value = part.assigned_user.id;
      }
    });

    // Wire assign buttons
    tbody.querySelectorAll('button[data-action="assign"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = parseInt(btn.getAttribute('data-id'), 10);
        const sel = tbody.querySelector(`select[data-part="${id}"]`);
        const userId = sel.value ? parseInt(sel.value, 10) : null;
        try {
          if (userId) {
            await API.parts.assign(id, userId);
          } else {
            // Unassign by setting to null via update
            await API.parts.update(id, { assignedTo: null });
          }
          btn.textContent = '✓ Saved';
          setTimeout(() => btn.textContent = 'Save Assignment', 1500);
        } catch (e) {
          btn.textContent = '✗ Error';
          setTimeout(() => btn.textContent = 'Save Assignment', 2000);
        }
      });
    });

  } catch (error) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-danger" style="padding:10px;">Failed to load jobs</td></tr>';
  }
}
