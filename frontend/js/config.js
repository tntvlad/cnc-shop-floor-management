// API Configuration
// Use the current host so the browser hits the correct backend
// Example: http://192.168.x.x:5000 when frontend is served at :3000
const API_BASE_URL = `http://${window.location.hostname}:5000/api`;
const API_URL = API_BASE_URL; // Alias for compatibility

const config = {
  API_BASE_URL,
  API_URL
};

// Global helper functions
function navigateTo(page) {
  window.location.href = page;
}

function logout() {
  Auth.logout();
}

function ensureAuthed() {
  return Auth.requireAuth();
}

function getToken() {
  return Auth.getToken();
}

function getUser() {
  return Auth.getUser();
}
