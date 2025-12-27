/* Machine management page */
import { apiRequest, handleApiError } from './api.js';
import { requireAuth, logout } from './auth.js';

const machinesTable = document.querySelector('#machinesTable tbody');
const machineForm = document.querySelector('#machineForm');
const refreshBtn = document.querySelector('#refreshMachines');
const resetFormBtn = document.querySelector('#resetForm');
const formMessage = document.querySelector('#formMessage');
const logoutBtn = document.querySelector('#logoutBtn');

let machines = [];

requireAuth();
logoutBtn?.addEventListener('click', logout);

async function loadMachines() {
  try {
    const data = await apiRequest('/api/machines', { method: 'GET' });
    machines = data || [];
    renderTable();
  } catch (err) {
    handleApiError(err);
  }
}

function renderTable() {
  machinesTable.innerHTML = '';
  machines.forEach((m) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${m.machine_type || ''}</td>
      <td>${m.machine_number || ''}</td>
      <td>${m.name || ''}</td>
      <td>${m.model || ''}</td>
      <td>${m.status || ''}</td>
      <td>${m.is_available ? 'Yes' : 'No'}</td>
      <td><button class="btn btn-small" data-id="${m.id}" data-action="edit">Edit</button></td>`;
    machinesTable.appendChild(tr);
  });
}

function fillForm(machine) {
  document.querySelector('#machineId').value = machine?.id || '';
  document.querySelector('#machine_type').value = machine?.machine_type || '';
  document.querySelector('#machine_number').value = machine?.machine_number || '';
  document.querySelector('#name').value = machine?.name || '';
  document.querySelector('#model').value = machine?.model || '';
  document.querySelector('#status').value = machine?.status || 'active';
  document.querySelector('#is_available').value = machine?.is_available ? 'true' : 'false';
  document.querySelector('#notes').value = machine?.notes || '';
}

machinesTable.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const { id, action } = btn.dataset;
  if (action === 'edit') {
    const machine = machines.find((m) => String(m.id) === String(id));
    if (machine) fillForm(machine);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
});

machineForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    machine_type: document.querySelector('#machine_type').value.trim(),
    machine_number: document.querySelector('#machine_number').value.trim(),
    name: document.querySelector('#name').value.trim(),
    model: document.querySelector('#model').value.trim(),
    status: document.querySelector('#status').value,
    is_available: document.querySelector('#is_available').value === 'true',
    notes: document.querySelector('#notes').value.trim(),
  };
  const machineId = document.querySelector('#machineId').value;
  try {
    if (machineId) {
      await apiRequest(`/api/machines/${machineId}`, { method: 'PUT', body: payload });
      formMessage.textContent = 'Machine updated.';
    } else {
      await apiRequest('/api/machines', { method: 'POST', body: payload });
      formMessage.textContent = 'Machine created.';
    }
    formMessage.className = 'text-success';
    await loadMachines();
    machineForm.reset();
    document.querySelector('#machineId').value = '';
  } catch (err) {
    formMessage.textContent = 'Save failed.';
    formMessage.className = 'text-error';
    handleApiError(err);
  }
});

resetFormBtn.addEventListener('click', () => {
  machineForm.reset();
  document.querySelector('#machineId').value = '';
  formMessage.textContent = '';
});

refreshBtn.addEventListener('click', loadMachines);

loadMachines();
