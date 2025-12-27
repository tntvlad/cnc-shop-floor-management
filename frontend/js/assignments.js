/* Assign parts to operators/machines */
import { apiRequest, handleApiError } from './api.js';
import { requireAuth, logout } from './auth.js';

const logoutBtn = document.querySelector('#logoutBtn');
const loadPartsBtn = document.querySelector('#loadParts');
const partsTable = document.querySelector('#partsTable tbody');
const partIdInput = document.querySelector('#partId');
const assignForm = document.querySelector('#assignForm');
const assignMessage = document.querySelector('#assignMessage');
const machineSelect = document.querySelector('#machine_id');
const clearSelectionBtn = document.querySelector('#clearSelection');

requireAuth();
logoutBtn?.addEventListener('click', logout);

let machines = [];
let parts = [];

async function loadMachines() {
  try {
    machines = await apiRequest('/api/machines', { method: 'GET' });
    machineSelect.innerHTML = '<option value="">Unassigned</option>';
    machines.forEach((m) => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = `${m.machine_number || m.id} - ${m.name || m.machine_type || ''}`;
      machineSelect.appendChild(opt);
    });
  } catch (err) {
    handleApiError(err);
  }
}

async function loadParts() {
  const orderId = document.querySelector('#orderId').value.trim();
  const status = document.querySelector('#partStatus').value;
  const params = new URLSearchParams();
  if (orderId) params.append('order_id', orderId);
  if (status) params.append('status', status);
  try {
    parts = await apiRequest(`/api/parts?${params.toString()}`, { method: 'GET' });
    renderParts();
  } catch (err) {
    handleApiError(err);
  }
}

function renderParts() {
  partsTable.innerHTML = '';
  parts.forEach((p) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${p.part_number || p.id}</td>
      <td>${p.order_id || ''}</td>
      <td>${p.status || ''}</td>
      <td>${p.assigned_to_operator || ''}</td>
      <td>${p.machine_id || ''}</td>
      <td><button class="btn btn-small" data-id="${p.id}">Select</button></td>`;
    partsTable.appendChild(tr);
  });
}

partsTable.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const { id } = btn.dataset;
  partIdInput.value = id;
  assignMessage.textContent = `Selected part ${id}`;
  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
});

assignForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const partId = partIdInput.value;
  if (!partId) {
    assignMessage.textContent = 'Select a part first.';
    assignMessage.className = 'text-error';
    return;
  }
  const payload = {
    assigned_to_operator: document.querySelector('#assigned_to_operator').value.trim(),
    machine_id: machineSelect.value || null,
    due_date: document.querySelector('#due_date').value || null,
  };
  try {
    await apiRequest(`/api/parts/${partId}/assign`, { method: 'POST', body: payload });
    assignMessage.textContent = 'Assignment saved.';
    assignMessage.className = 'text-success';
    await loadParts();
  } catch (err) {
    assignMessage.textContent = 'Assign failed.';
    assignMessage.className = 'text-error';
    handleApiError(err);
  }
});

clearSelectionBtn.addEventListener('click', () => {
  partIdInput.value = '';
  assignForm.reset();
  assignMessage.textContent = '';
});

loadPartsBtn.addEventListener('click', loadParts);

loadMachines();
loadParts();
