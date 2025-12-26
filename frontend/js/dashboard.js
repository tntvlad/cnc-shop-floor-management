// Dashboard functionality
let currentPart = null;
let sessionStartTime = Date.now();
let sessionTimerInterval = null;
let jobTimerInterval = null;
let jobStartTime = null;

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
  // Check authentication
  if (!Auth.requireAuth()) return;

  // Load user info
  loadUserInfo();

  // Start session timer
  startSessionTimer();

  // Load statistics and parts
  loadStatistics();
  loadParts();

  // Setup event listeners
  setupEventListeners();

  // Check for active timer
  checkActiveTimer();
});

// Load user information
function loadUserInfo() {
  const user = Auth.getUser();
  document.getElementById('userName').textContent = user.name;
  
  // Show admin link if user is Supervisor+ (level 400+) or legacy role admin/supervisor
  const adminLink = document.getElementById('adminLink');
  const supervisorLink = document.getElementById('supervisorLink');
  const isSupervisorPlus = (typeof user.level === 'number' && user.level >= 400)
    || (user.role && (user.role === 'admin' || user.role === 'supervisor'));
  if (isSupervisorPlus) {
    adminLink.style.display = 'inline-block';
    if (supervisorLink) supervisorLink.style.display = 'inline-block';
  }
}

// Session timer
function startSessionTimer() {
  updateSessionTimer();
  sessionTimerInterval = setInterval(updateSessionTimer, 1000);
}

function updateSessionTimer() {
  const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
  document.getElementById('sessionTimer').textContent = formatTime(elapsed);
}

// Job timer
function startJobTimer(startTime) {
  jobStartTime = new Date(startTime).getTime();
  updateJobTimer();
  jobTimerInterval = setInterval(updateJobTimer, 1000);
}

function stopJobTimer() {
  if (jobTimerInterval) {
    clearInterval(jobTimerInterval);
    jobTimerInterval = null;
  }
  jobStartTime = null;
}

function updateJobTimer() {
  if (!jobStartTime) return;
  const elapsed = Math.floor((Date.now() - jobStartTime) / 1000);
  const timerElement = document.getElementById('modalJobTimer');
  if (timerElement) {
    timerElement.textContent = formatTime(elapsed);
  }
}

// Format time (seconds to HH:MM:SS)
function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Format duration for display
function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

// Load statistics
async function loadStatistics() {
  try {
    const stats = await API.parts.getStatistics();
    document.getElementById('completedParts').textContent = stats.completed_parts || 0;
    document.getElementById('totalTime').textContent = formatDuration(stats.total_time || 0);
    document.getElementById('currentPart').textContent = stats.current_part || 'None';
  } catch (error) {
    console.error('Failed to load statistics:', error);
  }
}

// Load parts - for operators, show only their assigned jobs
async function loadParts() {
  const partsGrid = document.getElementById('partsGrid');
  partsGrid.innerHTML = '<div class="loading">Loading jobs...</div>';

  try {
    const user = Auth.getUser();
    const isOperator = (typeof user.level === 'number' && user.level < 400) || 
                       (user.role && (user.role === 'operator' || user.role === 'cutting_operator'));
    
    let parts;
    
    // Load operator's assigned jobs or all parts for supervisors
    if (isOperator) {
      parts = await API.parts.getOperatorJobs();
    } else {
      parts = await API.parts.getAll();
    }
    
    if (parts.length === 0) {
      partsGrid.innerHTML = '<div class="loading">No jobs assigned</div>';
      return;
    }

    partsGrid.innerHTML = '';
    parts.forEach(part => {
      const card = createPartCard(part, isOperator);
      partsGrid.appendChild(card);
    });
  } catch (error) {
    console.error('Failed to load parts:', error);
    partsGrid.innerHTML = '<div class="loading">Failed to load jobs</div>';
  }
}

// Create part card
function createPartCard(part, isOperator = false) {
  const card = document.createElement('div');
  card.className = 'part-card';
  
  // Determine status from assignment if operator
  let statusText = 'Available';
  let statusBadge = 'badge-unlocked';
  
  if (isOperator && part.assignment) {
    const status = part.assignment.status;
    if (status === 'completed') {
      statusText = 'Completed';
      statusBadge = 'badge-completed';
    } else if (status === 'in_progress') {
      statusText = 'In Progress';
      statusBadge = 'badge-unlocked';
    } else if (status === 'ready') {
      statusText = 'Ready';
      statusBadge = 'badge-unlocked';
    } else if (status === 'pending') {
      statusText = 'Pending';
      statusBadge = 'badge-locked';
    } else if (status === 'locked') {
      statusText = 'Locked';
      statusBadge = 'badge-locked';
    }
  } else if (part.locked) {
    card.classList.add('locked');
    statusBadge = 'badge-locked';
    statusText = 'Locked';
  }
  
  if (part.completed) {
    card.classList.add('completed');
    statusBadge = 'badge-completed';
    statusText = 'Completed';
  }

  card.innerHTML = `
    <div class="part-card-header">
      <div class="part-name">${escapeHtml(part.name)}</div>
      <span class="part-badge ${statusBadge}">${statusText}</span>
    </div>
    <div class="part-info">
      <div class="info-row">
        <span class="info-label">Material:</span>
        <span class="info-value">${escapeHtml(part.material)}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Quantity:</span>
        <span class="info-value">${part.quantity}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Treatment:</span>
        <span class="info-value">${escapeHtml(part.treatment || 'None')}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Target Time:</span>
        <span class="info-value">${part.target_time} min</span>
      </div>
    </div>
  `;

  // Allow clicking if operator has ready/in_progress assignment or if not completed/locked
  const canClick = isOperator 
    ? (part.assignment && ['ready', 'in_progress'].includes(part.assignment.status)) 
    : (!part.locked && !part.completed);
  if (canClick) {
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => openPartModal(part.id));
  }

  return card;
}

// Open part modal
async function openPartModal(partId) {
  try {
    const part = await API.parts.getOne(partId);
    currentPart = part;

    // Update modal content
    document.getElementById('modalPartName').textContent = part.name;
    document.getElementById('modalMaterial').textContent = part.material;
    document.getElementById('modalQuantity').textContent = part.quantity;
    document.getElementById('modalTreatment').textContent = part.treatment || 'None';
    document.getElementById('modalTargetTime').textContent = `${part.target_time} minutes`;

    // Load files
    loadPartFiles(part);

    // Load feedback
    loadPartFeedback(part);

    // Show/hide file upload for supervisors/admins
    const user = Auth.getUser();
    const canUpload = (typeof user.level === 'number' && user.level >= 400);
    const uploadSection = document.getElementById('fileUploadSection');
    if (uploadSection) {
      uploadSection.style.display = canUpload ? 'block' : 'none';
    }

    // Show modal
    document.getElementById('partModal').style.display = 'flex';

    // Check if timer is running for this part
    await checkPartTimer(partId);
  } catch (error) {
    console.error('Failed to load part:', error);
    alert('Failed to load part details');
  }
}

// Load part files
function loadPartFiles(part) {
  const filesContainer = document.getElementById('modalFiles');
  
  if (!part.files || part.files.length === 0) {
    filesContainer.innerHTML = '<p class="text-muted">No files available</p>';
    return;
  }

  filesContainer.innerHTML = '';
  part.files.forEach(file => {
    const btn = document.createElement('button');
    const fileType = (file.fileType || file.filetype || 'FILE').toUpperCase();
    btn.className = `file-btn file-${fileType.toLowerCase()}`;
    btn.textContent = `${fileType} - ${file.filename}`;
    btn.addEventListener('click', () => downloadFile(file.id, file.filename));
    filesContainer.appendChild(btn);
  });
}

// Download file
function downloadFile(fileId, filename) {
  const url = API.files.getDownloadUrl(fileId);
  const token = Auth.getToken();
  
  // Create a temporary link with auth header
  fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
    .then(response => response.blob())
    .then(blob => {
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      a.remove();
    })
    .catch(error => {
      console.error('Download failed:', error);
      alert('Failed to download file');
    });
}

// Load part feedback
function loadPartFeedback(part) {
  const feedbackContainer = document.getElementById('modalFeedback');
  
  if (!part.feedback || part.feedback.length === 0) {
    feedbackContainer.innerHTML = '<p class="text-muted">No feedback yet</p>';
    return;
  }

  feedbackContainer.innerHTML = '';
  part.feedback.forEach(fb => {
    const item = document.createElement('div');
    item.className = 'feedback-item';
    
    const date = new Date(fb.createdat).toLocaleString();
    
    item.innerHTML = `
      <div class="feedback-header">
        <span class="feedback-author">${escapeHtml(fb.username)}</span>
        <span class="feedback-date">${date}</span>
      </div>
      <div class="feedback-text">${escapeHtml(fb.text)}</div>
    `;
    
    feedbackContainer.appendChild(item);
  });
}

// Check part timer status
async function checkPartTimer(partId) {
  try {
    const activeTimer = await API.time.getActiveTimer();
    
    if (activeTimer && activeTimer.part_id === partId) {
      // Timer is running for this part
      document.getElementById('startTimerBtn').style.display = 'none';
      document.getElementById('stopTimerBtn').style.display = 'inline-block';
      startJobTimer(activeTimer.start_time);
    } else {
      // No timer running
      document.getElementById('startTimerBtn').style.display = 'inline-block';
      document.getElementById('stopTimerBtn').style.display = 'none';
      stopJobTimer();
      document.getElementById('modalJobTimer').textContent = '00:00:00';
    }
  } catch (error) {
    console.error('Failed to check timer:', error);
  }
}

// Check for active timer on load
async function checkActiveTimer() {
  try {
    const activeTimer = await API.time.getActiveTimer();
    if (activeTimer) {
      // Update current part in stats
      loadStatistics();
    }
  } catch (error) {
    console.error('Failed to check active timer:', error);
  }
}

// Close modal
function closePartModal() {
  document.getElementById('partModal').style.display = 'none';
  stopJobTimer();
  currentPart = null;
}

// Setup event listeners
function setupEventListeners() {
  // Logout
  document.getElementById('logoutBtn').addEventListener('click', () => {
    if (confirm('Are you sure you want to logout?')) {
      Auth.logout();
    }
  });

  // Refresh parts
  document.getElementById('refreshBtn').addEventListener('click', () => {
    loadStatistics();
    loadParts();
  });

  // Modal close
  document.getElementById('modalClose').addEventListener('click', closePartModal);
  
  // Click outside modal to close
  document.getElementById('partModal').addEventListener('click', (e) => {
    if (e.target.id === 'partModal') {
      closePartModal();
    }
  });

  // Start timer
  document.getElementById('startTimerBtn').addEventListener('click', async () => {
    if (!currentPart) return;
    
    try {
      await API.time.startTimer(currentPart.id);
      document.getElementById('startTimerBtn').style.display = 'none';
      document.getElementById('stopTimerBtn').style.display = 'inline-block';
      startJobTimer(new Date().toISOString());
      loadStatistics();
    } catch (error) {
      alert(error.message || 'Failed to start timer');
    }
  });

  // Stop timer
  document.getElementById('stopTimerBtn').addEventListener('click', async () => {
    if (!currentPart) return;
    
    try {
      await API.time.stopTimer(currentPart.id);
      document.getElementById('startTimerBtn').style.display = 'inline-block';
      document.getElementById('stopTimerBtn').style.display = 'none';
      stopJobTimer();
      loadStatistics();
    } catch (error) {
      alert(error.message || 'Failed to stop timer');
    }
  });

  // Feedback form
  document.getElementById('feedbackForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentPart) return;

    const text = document.getElementById('feedbackText').value.trim();
    if (!text) return;

    try {
      await API.feedback.add(currentPart.id, text);
      document.getElementById('feedbackText').value = '';
      
      // Reload part data
      const part = await API.parts.getOne(currentPart.id);
      currentPart = part;
      loadPartFeedback(part);
    } catch (error) {
      alert(error.message || 'Failed to add feedback');
    }
  });

  // Complete part button
  document.getElementById('completePartBtn').addEventListener('click', () => {
    if (!currentPart) return;
    openCompleteModal();
  });

  // Complete modal close
  document.getElementById('completeModalClose').addEventListener('click', closeCompleteModal);
  document.getElementById('completeCancelBtn').addEventListener('click', closeCompleteModal);

  // Complete form submit
  document.getElementById('completeSubmitBtn').addEventListener('click', async () => {
    if (!currentPart) return;

    const actualTime = parseInt(document.getElementById('actualTime').value);
    if (!actualTime || actualTime < 1) {
      alert('Please enter a valid time');
      return;
    }

    try {
      await API.parts.complete(currentPart.id, actualTime);
      closeCompleteModal();
      closePartModal();
      loadStatistics();
      loadParts();
      alert('Part marked as complete!');
    } catch (error) {
      alert(error.message || 'Failed to complete part');
    }
  });

  // File upload form
  const fileUploadForm = document.getElementById('fileUploadForm');
  if (fileUploadForm) {
    fileUploadForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentPart) return;

      const fileInput = document.getElementById('fileInput');
      const file = fileInput.files[0];
      
      if (!file) {
        alert('Please select a file');
        return;
      }

      // Validate file type
      const ext = file.name.split('.').pop().toLowerCase();
      if (!['pdf', 'dxf', 'nc', 'txt'].includes(ext)) {
        alert('Only PDF, DXF, NC, and TXT files are allowed');
        return;
      }

      // Validate file size (10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB');
        return;
      }

      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${config.API_BASE_URL}/parts/${currentPart.id}/files`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Auth.getToken()}`
          },
          body: formData
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Upload failed');
        }

        // Reset form and reload files
        fileInput.value = '';
        const part = await API.parts.getOne(currentPart.id);
        currentPart = part;
        loadPartFiles(part);
        alert('File uploaded successfully!');
      } catch (error) {
        alert(error.message || 'Failed to upload file');
      }
    });
  }
}

// Open complete modal
function openCompleteModal() {
  if (!currentPart) return;
  
  document.getElementById('completeTargetTime').textContent = currentPart.target_time;
  document.getElementById('actualTime').value = currentPart.target_time;
  document.getElementById('completeModal').style.display = 'flex';
}

// Close complete modal
function closeCompleteModal() {
  document.getElementById('completeModal').style.display = 'none';
  document.getElementById('completeForm').reset();
}

// Utility: Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (sessionTimerInterval) clearInterval(sessionTimerInterval);
  if (jobTimerInterval) clearInterval(jobTimerInterval);
});
