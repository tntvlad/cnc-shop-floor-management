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
      // Create new admin user
      const response = await API.users.create({
        employeeId,
        name: fullName,
        password,
        role: 'admin'
      });

      // Get current user ID to delete (ADMIN001)
      const currentUser = Auth.getUser();

      // Delete the default ADMIN001 user
      if (currentUser.id) {
        try {
          await API.users.delete(currentUser.id);
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
