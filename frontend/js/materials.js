/* Materials management page */
import { apiRequest, handleApiError } from './api.js';
import { requireAuth, logout } from './auth.js';

const materialsTable = document.querySelector('#materialsTable tbody');
const materialForm = document.querySelector('#materialForm');
const formMessage = document.querySelector('#formMessage');
const refreshBtn = document.querySelector('#refreshMaterials');
const resetFormBtn = document.querySelector('#resetForm');
const logoutBtn = document.querySelector('#logoutBtn');

let materials = [];

requireAuth();
logoutBtn?.addEventListener('click', logout);

async function loadMaterials() {
  try {
    const data = await apiRequest('/api/materials', { method: 'GET' });
    materials = data || [];
    renderTable();
  } catch (err) {
    handleApiError(err);
  }
}

function renderTable() {
  materialsTable.innerHTML = '';
  materials.forEach((m) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${m.material_name || ''}</td>
      <td>${m.material_type || ''}</td>
      <td>${m.unit || ''}</td>
      <td>${Number(m.current_stock || 0)}</td>
      <td>${Number(m.reorder_level || 0)}</td>
      <td>${Number(m.cost_per_unit || 0).toFixed(2)}</td>
      <td>
        <button class="btn btn-small" data-id="${m.id}" data-action="edit">Edit</button>
      </td>`;
    materialsTable.appendChild(tr);
  });
}

function fillForm(material) {
  document.querySelector('#materialId').value = material?.id || '';
  document.querySelector('#material_name').value = material?.material_name || '';
  document.querySelector('#material_type').value = material?.material_type || '';
  document.querySelector('#unit').value = material?.unit || 'pieces';
  document.querySelector('#current_stock').value = material?.current_stock ?? 0;
  document.querySelector('#reorder_level').value = material?.reorder_level ?? 0;
  document.querySelector('#cost_per_unit').value = material?.cost_per_unit ?? 0;
  document.querySelector('#notes').value = material?.notes || '';
}

materialsTable.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const { id, action } = btn.dataset;
  if (action === 'edit') {
    const material = materials.find((m) => String(m.id) === String(id));
    if (material) fillForm(material);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
});

materialForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    material_name: document.querySelector('#material_name').value.trim(),
    material_type: document.querySelector('#material_type').value.trim(),
    unit: document.querySelector('#unit').value.trim(),
    current_stock: Number(document.querySelector('#current_stock').value || 0),
    reorder_level: Number(document.querySelector('#reorder_level').value || 0),
    cost_per_unit: Number(document.querySelector('#cost_per_unit').value || 0),
    notes: document.querySelector('#notes').value.trim(),
  };
  const materialId = document.querySelector('#materialId').value;
  try {
    if (materialId) {
      await apiRequest(`/api/materials/${materialId}`, {
        method: 'PUT',
        body: payload,
      });
      formMessage.textContent = 'Material updated.';
    } else {
      await apiRequest('/api/materials', { method: 'POST', body: payload });
      formMessage.textContent = 'Material created.';
    }
    formMessage.className = 'text-success';
    await loadMaterials();
    materialForm.reset();
    document.querySelector('#materialId').value = '';
  } catch (err) {
    formMessage.textContent = 'Save failed.';
    formMessage.className = 'text-error';
    handleApiError(err);
  }
});

resetFormBtn.addEventListener('click', () => {
  materialForm.reset();
  document.querySelector('#materialId').value = '';
  formMessage.textContent = '';
});

refreshBtn.addEventListener('click', loadMaterials);

loadMaterials();
