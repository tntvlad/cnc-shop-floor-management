// Create user page functionality
document.addEventListener('DOMContentLoaded', () => {
  // Require admin authentication
  if (!Auth.isAuthenticated()) {
    window.location.href = 'login.html';
    return;
  }

  const user = Auth.getUser();
  if (user.level < 400) {
    alert('Only Supervisor level (400+) users can create new users');
    window.location.href = 'index.html';
    return;
  }

  const createUserForm = document.getElementById('createUserForm');
  const errorMessage = document.getElementById('errorMessage');
  const successMessage = document.getElementById('successMessage');
  const createBtn = document.getElementById('createBtn');
  const levelSelect = document.getElementById('level');
  const levelHint = document.getElementById('levelHint');

  const levelDescriptions = {
    100: 'Can view assigned jobs, start/complete work, track time',
    200: 'Can view all jobs, perform cutting operations',
    300: 'Can review and approve/reject completed jobs',
    400: 'Can create jobs, assign work, create users up to level 400',
    500: 'Full system access (Admin only)'
  };

  // Update level hint
  levelSelect.addEventListener('change', (e) => {
    const selectedLevel = parseInt(e.target.value);
    if (selectedLevel && levelDescriptions[selectedLevel]) {
      levelHint.textContent = `📋 ${levelDescriptions[selectedLevel]}`;
    } else {
      levelHint.textContent = '';
    }
  });

  createUserForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const employeeId = document.getElementById('employeeId').value.trim();
    const fullName = document.getElementById('fullName').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const level = parseInt(document.getElementById('level').value);

    // Validation
    if (!employeeId || !fullName || !password || !level) {
      errorMessage.textContent = 'All fields are required';
      errorMessage.style.display = 'block';
      return;
    }

    if (password.length < 8) {
      errorMessage.textContent = 'Password must be at least 8 characters';
      errorMessage.style.display = 'block';
      return;
    }

    if (password !== confirmPassword) {
      errorMessage.textContent = 'Passwords do not match';
      errorMessage.style.display = 'block';
      return;
    }

    if (level < 50 || level > 500 || ![50, 100, 200, 300, 400, 500].includes(level)) {
      errorMessage.textContent = 'Invalid permission level';
      errorMessage.style.display = 'block';
      return;
    }

    errorMessage.style.display = 'none';
    successMessage.style.display = 'none';
    createBtn.disabled = true;
    createBtn.textContent = 'Creating...';

    try {
      const resp = await fetch(`${config.API_BASE_URL}/auth/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(Auth.getAuthHeader() || {})
        },
        body: JSON.stringify({
          employeeId,
          name: fullName,
          password,
          level
        })
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data.error || 'Failed to create user');
      }

      successMessage.textContent = `✓ User ${employeeId} (Level ${level}) created successfully!`;
      successMessage.style.display = 'block';
      createUserForm.reset();
      levelHint.textContent = '';

      setTimeout(() => {
        successMessage.style.display = 'none';
      }, 3000);
    } catch (error) {
      errorMessage.textContent = error.message || 'Failed to create user';
      errorMessage.style.display = 'block';
      createBtn.disabled = false;
      createBtn.textContent = 'Create User';
    }
  });
});
