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
});

async function checkStatus() {
  try {
    const response = await fetch(`${config.API_BASE_URL}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${Auth.getToken()}`
      }
    });

    if (response.ok) {
      document.getElementById('apiStatus').textContent = 'Healthy';
      document.getElementById('apiStatus').className = 'status-value healthy';
      document.getElementById('dbStatus').textContent = 'Connected';
      document.getElementById('dbStatus').className = 'status-value healthy';

      const user = await response.json();
      document.getElementById('currentUser').textContent = user.name || user.employee_id;
    } else {
      throw new Error('API not responding');
    }
  } catch (error) {
    document.getElementById('apiStatus').textContent = 'Error';
    document.getElementById('apiStatus').className = 'status-value error';
    document.getElementById('dbStatus').textContent = 'Error';
    document.getElementById('dbStatus').className = 'status-value error';
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
