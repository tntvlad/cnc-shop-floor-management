// Create user page functionality
document.addEventListener('DOMContentLoaded', () => {
  // Require admin authentication
  if (!Auth.isAuthenticated()) {
    window.location.href = 'login.html';
    return;
  }

  const user = Auth.getUser();
  if (user.role !== 'admin') {
    alert('Only administrators can create new users');
    window.location.href = 'index.html';
    return;
  }

  const createUserForm = document.getElementById('createUserForm');
  const errorMessage = document.getElementById('errorMessage');
  const successMessage = document.getElementById('successMessage');
  const createBtn = document.getElementById('createBtn');

  createUserForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const employeeId = document.getElementById('employeeId').value.trim();
    const fullName = document.getElementById('fullName').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const role = document.getElementById('role').value;

    // Validation
    if (!employeeId || !fullName || !password || !role) {
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

    errorMessage.style.display = 'none';
    successMessage.style.display = 'none';
    createBtn.disabled = true;
    createBtn.textContent = 'Creating...';

    try {
      const response = await API.users.create({
        employeeId,
        name: fullName,
        password,
        role
      });

      successMessage.textContent = `User ${employeeId} created successfully!`;
      successMessage.style.display = 'block';

      createUserForm.reset();

      // Redirect after 2 seconds
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 2000);
    } catch (error) {
      errorMessage.textContent = error.message || 'Failed to create user';
      errorMessage.style.display = 'block';
      createBtn.disabled = false;
      createBtn.textContent = 'Create User';
    }
  });
});
