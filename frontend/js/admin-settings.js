// Admin Settings Page
document.addEventListener('DOMContentLoaded', () => {
  // Check authentication
  if (!Auth.isAuthenticated()) {
    window.location.href = 'login.html';
    return;
  }

  const user = Auth.getUser();
  if (user.level < 400) {
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
