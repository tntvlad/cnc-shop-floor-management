// Authentication utilities
const Auth = {
  TOKEN_KEY: 'cnc_auth_token',
  USER_KEY: 'cnc_user',

  // Store token and user data
  login(token, user) {
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  },

  // Get stored token
  getToken() {
    return localStorage.getItem(this.TOKEN_KEY);
  },

  // Get stored user
  getUser() {
    const user = localStorage.getItem(this.USER_KEY);
    return user ? JSON.parse(user) : null;
  },

  // Check if user is authenticated
  isAuthenticated() {
    return !!this.getToken();
  },

  // Clear authentication data
  logout() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    window.location.href = 'login.html';
  },

  // Redirect to login if not authenticated
  requireAuth() {
    if (!this.isAuthenticated()) {
      window.location.href = 'login.html';
      return false;
    }
    return true;
  },

  // Get authorization header
  getAuthHeader() {
    const token = this.getToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }
};
