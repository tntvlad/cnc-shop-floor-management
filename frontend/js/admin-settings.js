// Admin Settings Page
document.addEventListener('DOMContentLoaded', () => {
  // Check authentication
  if (!Auth.isAuthenticated()) {
    window.location.href = 'login.html';
    return;
  }

  const user = Auth.getUser();
  const isSupervisorPlus = (user && typeof user.level === 'number' && user.level >= 400)
    || (user && user.role && (user.role === 'admin' || user.role === 'supervisor'));
  if (!isSupervisorPlus) {
    alert('Access denied. Supervisor level (400+) required.');
    window.location.href = 'index.html';
    return;
  }

  // Display user info
  document.getElementById('userName').textContent = user.name || user.employeeId;

  // Logout button
  document.getElementById('logoutBtn').addEventListener('click', () => {
    Auth.logout();
    window.location.href = 'login.html';
  });

  // Git settings button (may not exist on all pages)
  const gitBtn = document.getElementById('gitSettingsBtn');
  if (gitBtn) {
    gitBtn.addEventListener('click', openGitSettings);
  }

  // Update level hints when selecting a level
  const levelSelect = document.getElementById('newLevel');
  const levelHint = document.getElementById('levelHint');
  
  const levelDescriptions = {
    100: 'Can view assigned jobs, start/complete work, track time',
    200: 'Can view all jobs, perform cutting operations, track time',
    300: 'Can review and approve/reject completed jobs, add quality notes',
    400: 'Can create jobs, assign work, create users up to level 400',
    500: 'Full system access, manage all data and configurations'
  };

  levelSelect.addEventListener('change', (e) => {
    const selectedLevel = parseInt(e.target.value);
    if (selectedLevel && levelDescriptions[selectedLevel]) {
      levelHint.textContent = `📋 ${levelDescriptions[selectedLevel]}`;
    } else {
      levelHint.textContent = '';
    }
  });

  // Create user form
  document.getElementById('createUserForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const employeeId = document.getElementById('newEmployeeId').value.trim();
    const fullName = document.getElementById('newFullName').value.trim();
    const password = document.getElementById('newPassword').value;
    const level = parseInt(document.getElementById('newLevel').value);

    const errorEl = document.getElementById('createUserError');
    const successEl = document.getElementById('createUserSuccess');

    errorEl.style.display = 'none';
    successEl.style.display = 'none';

    // Validation
    if (password.length < 8) {
      errorEl.textContent = 'Password must be at least 8 characters';
      errorEl.style.display = 'block';
      return;
    }

    if (!level || level < 50 || level > 500) {
      errorEl.textContent = 'Invalid permission level selected';
      errorEl.style.display = 'block';
      return;
    }

    try {
      const response = await fetch(`${config.API_BASE_URL}/auth/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Auth.getToken()}`
        },
        body: JSON.stringify({
          employeeId,
          name: fullName,
          password,
          level
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create user');
      }

      successEl.textContent = `✓ User ${employeeId} (Level ${level}) created successfully!`;
      successEl.style.display = 'block';
      document.getElementById('createUserForm').reset();
      document.getElementById('levelHint').textContent = '';

      setTimeout(() => {
        successEl.style.display = 'none';
      }, 3000);
    } catch (error) {
      errorEl.textContent = error.message;
      errorEl.style.display = 'block';
    }
  });

  // Initial status check
  checkStatus();

  // Load users list
  document.getElementById('refreshUsersBtn').addEventListener('click', loadUsers);
  loadUsers();
  
  // Release checkbox toggle
  const useReleaseCheckbox = document.getElementById('useReleaseCheckbox');
  if (useReleaseCheckbox) {
    useReleaseCheckbox.addEventListener('change', function() {
      const container = document.getElementById('releasesDropdownContainer');
      const branchRadios = document.querySelectorAll('input[name="branch"]');
      if (this.checked) {
        container.style.display = 'block';
        branchRadios.forEach(r => { r.disabled = true; r.parentElement.style.opacity = '0.5'; });
      } else {
        container.style.display = 'none';
        branchRadios.forEach(r => { r.disabled = false; r.parentElement.style.opacity = '1'; });
      }
    });
  }
});

// Git Settings modal handlers
function openGitSettings() {
  document.getElementById('git-settings-modal').classList.add('active');
  
  // Show status tab by default and load status
  switchVCTab('status');
  
  // Reset UI
  document.getElementById('local-version').textContent = 'Loading...';
  document.getElementById('remote-version').textContent = 'Loading...';
  const statusEl = document.getElementById('update-status');
  statusEl.style.display = 'none';
  statusEl.className = 'update-status';
  document.getElementById('installUpdateBtn').style.display = 'none';
  
  // Reset releases
  const useReleaseCheckbox = document.getElementById('useReleaseCheckbox');
  if (useReleaseCheckbox) {
    useReleaseCheckbox.checked = false;
    document.getElementById('releasesDropdownContainer').style.display = 'none';
    const branchRadios = document.querySelectorAll('input[name="branch"]');
    branchRadios.forEach(r => { r.disabled = false; r.parentElement.style.opacity = '1'; });
  }
  
  // Load current branch
  fetch(`${config.API_BASE_URL}/admin/git-branch`, {
    headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
  })
    .then(r => r.json())
    .then(data => {
      document.getElementById('currentBranch').textContent = data.branch || 'unknown';
      const radios = document.querySelectorAll('input[name="branch"]');
      radios.forEach(r => { r.checked = (r.value === data.branch); });
    })
    .catch(() => {
      document.getElementById('currentBranch').textContent = 'error';
    });
  
  // Load releases
  loadReleases();
  
  // Check for updates
  checkForUpdates();
}

async function loadReleases() {
  const select = document.getElementById('releaseSelect');
  if (!select) return;
  
  select.innerHTML = '<option value="">Loading releases...</option>';
  
  try {
    const resp = await fetch(`${config.API_BASE_URL}/admin/git-releases`, {
      headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
    });
    
    const data = await resp.json();
    
    if (!resp.ok) throw new Error(data.error || 'Failed to load releases');
    
    if (data.releases && data.releases.length > 0) {
      select.innerHTML = '<option value="">-- Select a release --</option>';
      data.releases.forEach(rel => {
        const date = new Date(rel.date).toLocaleDateString();
        const option = document.createElement('option');
        option.value = rel.tag;
        option.textContent = `${rel.tag} (${rel.commit} - ${date})`;
        if (data.currentTag === rel.tag) {
          option.textContent += ' ✓ current';
          option.selected = true;
        }
        select.appendChild(option);
      });
    } else {
      select.innerHTML = '<option value="">No releases found</option>';
    }
  } catch (err) {
    select.innerHTML = '<option value="">Error loading releases</option>';
  }
}

async function checkForUpdates() {
  const localEl = document.getElementById('local-version');
  const remoteEl = document.getElementById('remote-version');
  const statusEl = document.getElementById('update-status');
  const updateBtn = document.getElementById('installUpdateBtn');
  
  try {
    const resp = await fetch(`${config.API_BASE_URL}/admin/check-updates`, {
      headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
    });
    
    const data = await resp.json();
    
    if (!resp.ok) throw new Error(data.error || 'Failed to check updates');
    
    localEl.textContent = `${data.local.commit} (${new Date(data.local.date).toLocaleDateString()})`;
    remoteEl.textContent = `${data.remote.commit} (${new Date(data.remote.date).toLocaleDateString()})`;
    
    if (data.updateAvailable) {
      statusEl.style.display = 'block';
      statusEl.style.background = '#fef3c7';
      statusEl.style.color = '#92400e';
      statusEl.innerHTML = `⚠️ Update available! ${data.commitsBehind} commit(s) behind.`;
      updateBtn.style.display = 'inline-block';
    } else {
      statusEl.style.display = 'block';
      statusEl.style.background = '#d1fae5';
      statusEl.style.color = '#065f46';
      statusEl.innerHTML = '✓ You are up to date!';
      updateBtn.style.display = 'none';
    }
  } catch (err) {
    localEl.textContent = 'Error';
    remoteEl.textContent = 'Error';
    statusEl.style.display = 'block';
    statusEl.style.background = '#fee2e2';
    statusEl.style.color = '#991b1b';
    statusEl.textContent = `Error: ${err.message}`;
  }
}

async function installUpdate() {
  const logEl = document.getElementById('gitLog');
  const updateBtn = document.getElementById('installUpdateBtn');
  
  logEl.style.display = 'block';
  logEl.textContent = '⏳ Installing update...\n';
  updateBtn.disabled = true;
  
  try {
    const resp = await fetch(`${config.API_BASE_URL}/admin/git-pull`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
    });
    
    const data = await resp.json();
    
    if (!resp.ok) throw new Error(data.error || 'Update failed');
    
    logEl.textContent += `✓ ${data.message}\n`;
    closeGitSettings();
    logEl.textContent += '\n⏳ Restarting services...\n';
    setTimeout(() => restartServices(), 1500);
  } catch (err) {
    logEl.textContent += `✗ Error: ${err.message}\n`;
    updateBtn.disabled = false;
  }
}

function closeGitSettings() {
  document.getElementById('git-settings-modal').classList.remove('active');
}

async function applySourceControl() {
  const useRelease = document.getElementById('useReleaseCheckbox')?.checked;
  const logEl = document.getElementById('gitLog');
  
  if (useRelease) {
    // Apply release
    const releaseSelect = document.getElementById('releaseSelect');
    const tag = releaseSelect?.value;
    
    if (!tag) {
      alert('Please select a release version');
      return;
    }
    
    closeGitSettings();
    logEl.style.display = 'block';
    logEl.textContent = `⏳ Checking out release ${tag}...\n`;
    
    try {
      const resp = await fetch(`${config.API_BASE_URL}/admin/git-checkout-release`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Auth.getToken()}`
        },
        body: JSON.stringify({ tag })
      });
      
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Checkout failed');
      
      logEl.textContent += `✓ ${data.message}\n`;
      logEl.textContent += '\n⏳ Restarting services...\n';
      setTimeout(() => restartServices(), 1500);
    } catch (err) {
      logEl.textContent += `✗ Error: ${err.message}\n`;
    }
  } else {
    // Apply branch (existing logic)
    await applyGitBranch();
  }
}

async function applyGitBranch() {
  const selected = document.querySelector('input[name="branch"]:checked');
  if (!selected) { alert('Select a branch'); return; }

  const branch = selected.value;
  const logEl = document.getElementById('gitLog');
  
  // Close modal immediately
  closeGitSettings();
  
  logEl.style.display = 'block';
  logEl.textContent = `⏳ Switching to ${branch} ...\n`;

  try {
    const resp = await fetch(`${config.API_BASE_URL}/admin/git-switch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Auth.getToken()}`
      },
      body: JSON.stringify({ branch })
    });

    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Switch failed');

    logEl.textContent += `✓ ${data.message}\n`;
    logEl.textContent += '\n⏳ Restarting services...\n';
    setTimeout(() => restartServices(), 1500);
  } catch (err) {
    logEl.textContent += `✗ Error: ${err.message}\n`;
  }
}

async function checkStatus() {
  try {
    const apiStatusEl = document.getElementById('apiStatus');
    const dbStatusEl = document.getElementById('dbStatus');
    const currentUserEl = document.getElementById('currentUser');
    
    // Only proceed if elements exist (they may not on all tabs)
    if (!apiStatusEl || !dbStatusEl) return;
    
    const response = await fetch(`${config.API_BASE_URL}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${Auth.getToken()}`
      }
    });

    if (response.ok) {
      apiStatusEl.textContent = 'Healthy';
      apiStatusEl.className = 'status-value healthy';
      dbStatusEl.textContent = 'Connected';
      dbStatusEl.className = 'status-value healthy';

      const user = await response.json();
      if (currentUserEl) currentUserEl.textContent = user.name || user.employee_id;
    } else {
      throw new Error('API not responding');
    }
  } catch (error) {
    const apiStatusEl = document.getElementById('apiStatus');
    const dbStatusEl = document.getElementById('dbStatus');
    if (apiStatusEl) {
      apiStatusEl.textContent = 'Error';
      apiStatusEl.className = 'status-value error';
    }
    if (dbStatusEl) {
      dbStatusEl.textContent = 'Error';
      dbStatusEl.className = 'status-value error';
    }
  }
}

async function gitPull(event) {
  const logEl = document.getElementById('gitLog');
  const btn = event?.target;
  
  logEl.style.display = 'block';
  logEl.textContent = '⏳ Pulling from Git...\n';
  btn.disabled = true;

  try {
    const response = await fetch(`${config.API_BASE_URL}/admin/git-pull`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Auth.getToken()}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Git pull failed');
    }

    logEl.textContent += '✓ Git pull completed\n';
    logEl.textContent += data.message || '';
    logEl.textContent += '\n\n⏳ Restarting services...\n';

    // Wait a moment then restart
    setTimeout(() => {
      restartServices();
    }, 2000);
  } catch (error) {
    logEl.textContent += `✗ Error: ${error.message}\n`;
    btn.disabled = false;
  }
}

async function restartServices(event) {
  const logEl = document.getElementById('restartLog');
  const btn = event?.target;
  
  logEl.style.display = 'block';
  logEl.textContent = '⏳ Restarting services...\n';
  if (btn) btn.disabled = true;

  try {
    const response = await fetch(`${config.API_BASE_URL}/admin/restart`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Auth.getToken()}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Restart failed');
    }

    logEl.textContent += '✓ Services restarting\n';
    logEl.textContent += data.message || '';
    logEl.textContent += '\n\n⏳ Waiting for services to be ready...\n';

    // Wait for services to come back up
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds

    const apiRoot = config.API_BASE_URL.replace(/\/api$/, '');
    const checkReady = setInterval(async () => {
      attempts++;
      try {
        const healthCheck = await fetch(`${apiRoot}/health`);

        if (healthCheck.ok) {
          logEl.textContent += '✓ Services are ready!\n';
          clearInterval(checkReady);
          setTimeout(() => {
            logEl.textContent += '\n✓ Update complete! Refreshing page...\n';
            setTimeout(() => location.reload(), 2000);
          }, 1000);
        }
      } catch (e) {
        logEl.textContent += '.';
      }

      if (attempts >= maxAttempts) {
        clearInterval(checkReady);
        logEl.textContent += '\n✗ Services took too long to restart. Please check manually.\n';
        if (btn) btn.disabled = false;
      }
    }, 1000);
  } catch (error) {
    logEl.textContent += `✗ Error: ${error.message}\n`;
    if (btn) btn.disabled = false;
  }
}

// Helper: map legacy role to level
function mapRoleToLevel(role) {
  if (!role) return undefined;
  if (role === 'admin') return 500;
  if (role === 'supervisor') return 400;
  return 100;
}

// Load and render users
async function loadUsers() {
  const tbody = document.getElementById('usersTableBody');
  const logEl = document.getElementById('usersLog');
  logEl.style.display = 'none';
  tbody.innerHTML = '<tr><td colspan="5" style="padding:10px; color:#64748b;">Loading users...</td></tr>';

  try {
    const data = await API.users.list();
    const users = data.users || [];

    const current = Auth.getUser();
    const currentLevel = typeof current.level === 'number' ? current.level : mapRoleToLevel(current.role) || 100;

    if (users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="padding:10px; color:#64748b;">No users found.</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    users.forEach(user => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="padding:8px; border-bottom:1px solid #e2e8f0;">${user.employee_id}</td>
        <td style="padding:8px; border-bottom:1px solid #e2e8f0;">${user.name || ''}</td>
        <td style="padding:8px; border-bottom:1px solid #e2e8f0;">${user.level} ${user.levelName ? '('+user.levelName+')' : ''}</td>
        <td style="padding:8px; border-bottom:1px solid #e2e8f0;">${new Date(user.created_at).toLocaleString()}</td>
        <td style="padding:8px; border-bottom:1px solid #e2e8f0;">
          <button class="btn btn-danger" data-action="delete" data-id="${user.id}">Delete</button>
        </td>
      `;

      // Disable delete button for self or higher-level users
      const delBtn = tr.querySelector('button[data-action="delete"]');
      if (user.id === current.id || user.level > currentLevel) {
        delBtn.disabled = true;
        delBtn.textContent = user.id === current.id ? 'Cannot delete self' : 'Insufficient level';
      } else {
        delBtn.addEventListener('click', () => deleteUser(user.id, user.employee_id));
      }

      tbody.appendChild(tr);
    });
  } catch (error) {
    tbody.innerHTML = '<tr><td colspan="5" style="padding:10px; color:#ef4444;">Failed to load users</td></tr>';
    logEl.style.display = 'block';
    logEl.textContent = `✗ Error: ${error.message}`;
  }
}

// Delete user
async function deleteUser(userId, employeeId) {
  if (!confirm(`Delete user ${employeeId}? This cannot be undone.`)) return;

  const logEl = document.getElementById('usersLog');
  logEl.style.display = 'block';
  logEl.textContent = `⏳ Deleting user ${employeeId}...\n`;

  try {
    const resp = await fetch(`${config.API_BASE_URL}/auth/users/${userId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${Auth.getToken()}`
      }
    });

    const data = await resp.json();
    if (!resp.ok) {
      throw new Error(data.error || 'Delete failed');
    }

    logEl.textContent += '✓ User deleted\n';
    loadUsers();
  } catch (error) {
    logEl.textContent += `✗ Error: ${error.message}\n`;
  }
}

// Backup database
async function backupDatabase(event) {
  const btn = event?.target;
  const logEl = document.getElementById('dbLog');
  
  logEl.style.display = 'block';
  logEl.textContent = '⏳ Creating database backup...\n';
  if (btn) btn.disabled = true;

  try {
    const response = await fetch(`${config.API_BASE_URL}/admin/database/backup`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${Auth.getToken()}`
      }
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Backup failed');
    }

    // Download the SQL file
    const blob = await response.blob();
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const filename = `cnc_backup_${timestamp}.sql`;
    
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();

    logEl.textContent += `✓ Backup downloaded: ${filename}\n`;
    if (btn) btn.disabled = false;
  } catch (error) {
    logEl.textContent += `✗ Error: ${error.message}\n`;
    if (btn) btn.disabled = false;
  }
}

// Restore database
async function restoreDatabase(event) {
  const fileInput = event.target;
  const logEl = document.getElementById('dbLog');
  
  if (!fileInput.files || fileInput.files.length === 0) {
    return;
  }

  const file = fileInput.files[0];
  
  if (!confirm(`⚠️ WARNING: This will restore the database from ${file.name}. All current data will be replaced. Continue?`)) {
    fileInput.value = '';
    return;
  }

  logEl.style.display = 'block';
  logEl.textContent = `⏳ Restoring database from ${file.name}...\n`;

  try {
    const sqlContent = await file.text();
    
    const response = await fetch(`${config.API_BASE_URL}/admin/database/restore`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Auth.getToken()}`
      },
      body: JSON.stringify({ sqlContent })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Restore failed');
    }

    logEl.textContent += '✓ Database restored successfully\n';
    logEl.textContent += data.message || '';
    logEl.textContent += '\n\n⚠️ Please log out and log back in.\n';
    
    // Clear file input
    fileInput.value = '';
    
    // Optional: auto-logout after 3 seconds
    setTimeout(() => {
      if (confirm('Database restored. Log out now?')) {
        Auth.logout();
      }
    }, 3000);
  } catch (error) {
    logEl.textContent += `✗ Error: ${error.message}\n`;
    fileInput.value = '';
  }
}

// Tab switching for Version Control modal
function switchVCTab(tabName) {
  // Remove active from all tabs
  document.querySelectorAll('.vc-tab').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.vc-tab-content').forEach(content => {
    content.classList.remove('active');
    content.style.display = 'none';
  });
  
  // Add active to selected tab
  document.querySelector(`.vc-tab[onclick="switchVCTab('${tabName}')"]`).classList.add('active');
  const tabContent = document.getElementById(`vc-tab-${tabName}`);
  if (tabContent) {
    tabContent.classList.add('active');
    tabContent.style.display = 'block';
  }
  
  // Load data for the tab if needed
  if (tabName === 'status') {
    checkModalStatus();
  }
}

// Check status for the modal
async function checkModalStatus() {
  try {
    const response = await fetch(`${config.API_BASE_URL}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${Auth.getToken()}`
      }
    });

    const modalApiStatus = document.getElementById('modalApiStatus');
    const modalDbStatus = document.getElementById('modalDbStatus');
    const modalCurrentUser = document.getElementById('modalCurrentUser');

    if (response.ok) {
      if (modalApiStatus) {
        modalApiStatus.textContent = 'Healthy';
        modalApiStatus.className = 'status-value healthy';
      }
      if (modalDbStatus) {
        modalDbStatus.textContent = 'Connected';
        modalDbStatus.className = 'status-value healthy';
      }

      const user = await response.json();
      if (modalCurrentUser) {
        modalCurrentUser.textContent = user.name || user.employee_id;
      }
    } else {
      throw new Error('API not responding');
    }
  } catch (error) {
    const modalApiStatus = document.getElementById('modalApiStatus');
    const modalDbStatus = document.getElementById('modalDbStatus');
    
    if (modalApiStatus) {
      modalApiStatus.textContent = 'Error';
      modalApiStatus.className = 'status-value error';
    }
    if (modalDbStatus) {
      modalDbStatus.textContent = 'Error';
      modalDbStatus.className = 'status-value error';
    }
  }
}

// =============================================
// ADMIN TABS FUNCTIONALITY
// =============================================

// Note: materialsData is defined in materials-admin.js
let machinesData = [];

// Tab switching for Admin Settings
function switchAdminTab(tabName) {
  // Remove active from all tabs
  document.querySelectorAll('.admin-tab').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.admin-tab-content').forEach(content => {
    content.classList.remove('active');
  });
  
  // Add active to selected tab
  const tabBtn = document.querySelector(`.admin-tab[onclick="switchAdminTab('${tabName}')"]`);
  if (tabBtn) tabBtn.classList.add('active');
  
  const tabContent = document.getElementById(`admin-tab-${tabName}`);
  if (tabContent) {
    tabContent.classList.add('active');
  }
  
  // Load data for the tab
  if (tabName === 'customers') {
    // Use customers.js functions (already loaded)
    if (typeof loadCustomers === 'function') {
      loadCustomers();
      setupSearch();
    }
  } else if (tabName === 'materials') {
    // Use materials-admin.js functions
    if (typeof initMaterialsTab === 'function') {
      initMaterialsTab();
    }
  } else if (tabName === 'machines') {
    loadAdminMachines();
  }
}

// =============================================
// MATERIALS MANAGEMENT (Customers handled by customers.js)
// =============================================

async function loadAdminMaterials() {
  try {
    const response = await fetch(`${config.API_BASE_URL}/materials`, {
      headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
    });
    const data = await response.json();
    
    if (data.success) {
      materialsData = data.materials || [];
      renderAdminMaterials();
    }
  } catch (error) {
    console.error('Error loading materials:', error);
  }
}

function renderAdminMaterials(filter = '') {
  const tbody = document.getElementById('materialsTableBody');
  if (!tbody) return;
  
  let filtered = materialsData;
  if (filter) {
    const lowerFilter = filter.toLowerCase();
    filtered = materialsData.filter(m => 
      (m.name || '').toLowerCase().includes(lowerFilter) ||
      (m.type || '').toLowerCase().includes(lowerFilter)
    );
  }
  
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="padding: 20px; text-align: center; color: #64748b;">No materials found</td></tr>';
    return;
  }
  
  tbody.innerHTML = filtered.map(m => `
    <tr>
      <td><strong>${escapeHtml(m.name || '')}</strong></td>
      <td>${escapeHtml(m.type || '-')}</td>
      <td>${escapeHtml(m.description || '-')}</td>
      <td><span class="status-badge ${m.in_stock ? 'status-active' : 'status-inactive'}">${m.in_stock ? 'In Stock' : 'Out of Stock'}</span></td>
      <td class="table-actions">
        <button class="btn btn-sm btn-edit" onclick="editMaterial(${m.id})">Edit</button>
        <button class="btn btn-sm btn-delete" onclick="deleteMaterial(${m.id})">Delete</button>
      </td>
    </tr>
  `).join('');
}

function searchMaterials(value) {
  renderAdminMaterials(value);
}

// Material modal functions are in materials-admin.js

async function deleteMaterial(id) {
  if (!confirm('Are you sure you want to delete this material?')) return;
  
  try {
    const response = await fetch(`${config.API_BASE_URL}/materials/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
    });
    
    if (!response.ok) throw new Error('Failed to delete material');
    
    loadAdminMaterials();
    showToast('Material deleted', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function editMaterial(id) {
  window.location.href = `materials.html?edit=${id}`;
}

// =============================================
// MACHINES MANAGEMENT
// =============================================

async function loadAdminMachines() {
  try {
    const response = await fetch(`${config.API_BASE_URL}/machines`, {
      headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
    });
    const data = await response.json();
    
    if (data.success) {
      machinesData = data.machines || [];
      renderAdminMachines();
    }
  } catch (error) {
    console.error('Error loading machines:', error);
  }
}

function renderAdminMachines(filter = '') {
  const tbody = document.getElementById('machinesTableBody');
  if (!tbody) return;
  
  let filtered = machinesData;
  if (filter) {
    const lowerFilter = filter.toLowerCase();
    filtered = machinesData.filter(m => 
      (m.name || '').toLowerCase().includes(lowerFilter) ||
      (m.type || '').toLowerCase().includes(lowerFilter)
    );
  }
  
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="padding: 20px; text-align: center; color: #64748b;">No machines found</td></tr>';
    return;
  }
  
  const statusColors = {
    available: 'status-active',
    in_use: 'status-pending',
    maintenance: 'status-paused',
    offline: 'status-inactive'
  };
  
  tbody.innerHTML = filtered.map(m => `
    <tr>
      <td><strong>${escapeHtml(m.name || '')}</strong></td>
      <td>${escapeHtml((m.type || '-').replace(/_/g, ' '))}</td>
      <td><span class="status-badge ${statusColors[m.status] || ''}">${(m.status || 'unknown').replace(/_/g, ' ').toUpperCase()}</span></td>
      <td>${escapeHtml(m.location || '-')}</td>
      <td class="table-actions">
        <button class="btn btn-sm btn-edit" onclick="editMachine(${m.id})">Edit</button>
        <button class="btn btn-sm btn-delete" onclick="deleteMachine(${m.id})">Delete</button>
      </td>
    </tr>
  `).join('');
}

function searchMachines(value) {
  renderAdminMachines(value);
}

function openAddMachineModal() {
  document.getElementById('addMachineForm').reset();
  document.getElementById('add-machine-modal').classList.add('active');
}

function closeAddMachineModal() {
  document.getElementById('add-machine-modal').classList.remove('active');
}

async function saveNewMachine(event) {
  event.preventDefault();
  
  const machineData = {
    name: document.getElementById('new-machine-name').value,
    type: document.getElementById('new-machine-type').value || null,
    status: document.getElementById('new-machine-status').value || 'available',
    location: document.getElementById('new-machine-location').value || null
  };
  
  try {
    const response = await fetch(`${config.API_BASE_URL}/machines`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Auth.getToken()}`
      },
      body: JSON.stringify(machineData)
    });
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || 'Failed to create machine');
    }
    
    closeAddMachineModal();
    loadAdminMachines();
    showToast('Machine created successfully', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function deleteMachine(id) {
  if (!confirm('Are you sure you want to delete this machine?')) return;
  
  try {
    const response = await fetch(`${config.API_BASE_URL}/machines/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
    });
    
    if (!response.ok) throw new Error('Failed to delete machine');
    
    loadAdminMachines();
    showToast('Machine deleted', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function editMachine(id) {
  window.location.href = `machines.html?edit=${id}`;
}

// =============================================
// HELPER FUNCTIONS
// =============================================

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 24px;
    border-radius: 6px;
    color: white;
    font-weight: 500;
    z-index: 9999;
    animation: slideIn 0.3s ease;
    ${type === 'success' ? 'background: #22c55e;' : ''}
    ${type === 'error' ? 'background: #ef4444;' : ''}
    ${type === 'info' ? 'background: #3b82f6;' : ''}
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
