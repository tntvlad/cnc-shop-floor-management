// Login page functionality
document.addEventListener('DOMContentLoaded', () => {
  // Redirect if already logged in
  if (Auth.isAuthenticated()) {
    window.location.href = 'index.html';
    return;
  }

  const loginForm = document.getElementById('loginForm');
  const errorMessage = document.getElementById('errorMessage');
  const loginBtn = document.getElementById('loginBtn');

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const employeeId = document.getElementById('employeeId').value.trim();
    const password = document.getElementById('password').value;

    // Hide previous errors
    errorMessage.style.display = 'none';
    loginBtn.disabled = true;
    loginBtn.textContent = 'Logging in...';

    try {
      const response = await API.auth.login(employeeId, password);
      
      // Store authentication data
      Auth.login(response.token, response.user);
      
      // Redirect to dashboard
      window.location.href = 'index.html';
    } catch (error) {
      errorMessage.textContent = error.message || 'Login failed. Please check your credentials.';
      errorMessage.style.display = 'block';
      loginBtn.disabled = false;
      loginBtn.textContent = 'Login';
    }
  });
});
