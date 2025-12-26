// API client
const API = {
  // Generic fetch wrapper
  async request(endpoint, options = {}) {
    const url = `${config.API_BASE_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...Auth.getAuthHeader(),
      ...options.headers
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      if (response.status === 401) {
        Auth.logout();
        throw new Error('Unauthorized');
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Request failed');
      }

      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  },

  // Auth endpoints
  auth: {
    async login(employeeId, password) {
      return API.request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ employeeId, password })
      });
    },

    async getCurrentUser() {
      return API.request('/auth/me');
    }
  },

  // User management endpoints
  users: {
    async list() {
      return API.request('/auth/users');
    },
    async create(data) {
      return API.request('/auth/users', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },

    async delete(userId) {
      return API.request(`/auth/users/${userId}`, {
        method: 'DELETE'
      });
    }
  },

  // Parts endpoints
  parts: {
    async getAll() {
      return API.request('/parts');
    },

    async getOne(id) {
      return API.request(`/parts/${id}`);
    },

    async create(data) {
      return API.request('/parts', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },

    async update(id, data) {
      return API.request(`/parts/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    },

    async setFolder(id, folderPath) {
      return API.request(`/parts/${id}/folder`, {
        method: 'PUT',
        body: JSON.stringify({ folderPath })
      });
    },

    async delete(id) {
      return API.request(`/parts/${id}`, {
        method: 'DELETE'
      });
    },

    async complete(id, actualTime) {
      return API.request(`/parts/${id}/complete`, {
        method: 'POST',
        body: JSON.stringify({ actualTime })
      });
    },

    async assign(id, userId) {
      return API.request(`/parts/${id}/assign`, {
        method: 'POST',
        body: JSON.stringify({ userId })
      });
    },

    async assignMultiple(id, userIds) {
      return API.request(`/parts/${id}/assign`, {
        method: 'POST',
        body: JSON.stringify({ userIds })
      });
    },

    async getStatistics() {
      return API.request('/parts/statistics');
    },

    async getOperatorJobs() {
      return API.request('/parts/my-jobs');
    },

    async startJob(id) {
      return API.request(`/parts/${id}/start`, {
        method: 'POST'
      });
    }
  },

  // Feedback endpoints
  feedback: {
    async getForPart(partId) {
      return API.request(`/parts/${partId}/feedback`);
    },

    async add(partId, text) {
      return API.request(`/parts/${partId}/feedback`, {
        method: 'POST',
        body: JSON.stringify({ text })
      });
    }
  },

  // Time tracking endpoints
  time: {
    async getActiveTimer() {
      return API.request('/time/active');
    },

    async startTimer(partId) {
      return API.request(`/parts/${partId}/timer/start`, {
        method: 'POST'
      });
    },

    async stopTimer(partId) {
      return API.request(`/parts/${partId}/timer/stop`, {
        method: 'POST'
      });
    },

    async getPartTimeLogs(partId) {
      return API.request(`/parts/${partId}/timelogs`);
    }
  },

  // Files endpoints
  files: {
    async getForPart(partId) {
      return API.request(`/parts/${partId}/files`);
    },

    async upload(partId, file) {
      const formData = new FormData();
      formData.append('file', file);

      const url = `${config.API_BASE_URL}/parts/${partId}/files`;
      const response = await fetch(url, {
        method: 'POST',
        headers: Auth.getAuthHeader(),
        body: formData
      });

      if (response.status === 401) {
        Auth.logout();
        throw new Error('Unauthorized');
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      return data;
    },

    getDownloadUrl(fileId) {
      return `${config.API_BASE_URL}/files/${fileId}/download`;
    },

    async delete(fileId) {
      return API.request(`/files/${fileId}`, {
        method: 'DELETE'
      });
    }
  }
};
