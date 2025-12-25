// First setup page functionality
document.addEventListener('DOMContentLoaded', () => {
  // Require admin authentication
  if (!Auth.isAuthenticated()) {
    window.location.href = 'login.html';
    return;
  }

  const user = Auth.getUser();
  if (user.employeeId !== 'ADMIN001') {
    // Not the default admin, redirect to dashboard
    window.location.href = 'index.html';
    return;
  }

  const setupForm = document.getElementById('setupForm');
  const errorMessage = document.getElementById('errorMessage');
  const successMessage = document.getElementById('successMessage');
  const setupBtn = document.getElementById('setupBtn');
  const logoutBtn = document.getElementById('logoutBtn');

  logoutBtn.addEventListener('click', () => {
    Auth.logout();
    window.location.href = 'login.html';
  });

  setupForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const employeeId = document.getElementById('employeeId').value.trim();
    const fullName = document.getElementById('fullName').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    // Validation
    if (!employeeId || !fullName || !password) {
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

    if (employeeId === 'ADMIN001') {
      errorMessage.textContent = 'Cannot use ADMIN001 as employee ID. Please choose another.';
      errorMessage.style.display = 'block';
      return;
    }

    errorMessage.style.display = 'none';
    successMessage.style.display = 'none';
    setupBtn.disabled = true;
    setupBtn.textContent = 'Creating Admin & Deleting Default...';

    try {
      // Create new admin user via direct fetch to avoid wrapper issues
      const createResp = await fetch(`${config.API_BASE_URL}/auth/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(Auth.getAuthHeader() || {})
        },
        body: JSON.stringify({
          employeeId,
          name: fullName,
          password,
          level: 500  // Level 500 = Admin
        })
      });

      const createData = await createResp.json().catch(() => ({}));
      if (!createResp.ok) {
        throw new Error(createData.error || 'Failed to create admin user');
      }

      // Get current user ID to delete (ADMIN001)
      const currentUser = Auth.getUser();

      // Delete the default ADMIN001 user
      if (currentUser.id) {
        try {
          const delResp = await fetch(`${config.API_BASE_URL}/auth/users/${currentUser.id}`, {
            method: 'DELETE',
            headers: {
              ...(Auth.getAuthHeader() || {})
            }
          });
          // ignore body; proceed even if deletion fails
        } catch (deleteError) {
          console.warn('Could not delete default user:', deleteError);
          // Continue anyway - new admin is created
        }
      }

      successMessage.textContent = `Admin user ${employeeId} created successfully! Redirecting to login...`;
      successMessage.style.display = 'block';

      // Logout and redirect to login
      setTimeout(() => {
        Auth.logout();
        window.location.href = 'login.html';
      }, 2000);
    } catch (error) {
      errorMessage.textContent = error.message || 'Failed to complete setup';
      errorMessage.style.display = 'block';
      setupBtn.disabled = false;
      setupBtn.textContent = 'Create Admin & Continue';
    }
  });
});
