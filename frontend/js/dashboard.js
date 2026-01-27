// Dashboard functionality
let currentPart = null;
let sessionStartTime = Date.now();
let sessionTimerInterval = null;
let jobTimerInterval = null;
let jobStartTime = null;
let activePdfId = null;
let folderBrowserState = { root: null, relativePath: '', fullPath: '' };
const PRIORITY_WEIGHT = { urgent: 3, high: 3, normal: 2, medium: 2, low: 1 };

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
  const ordersLink = document.getElementById('ordersLink');
  const customersLink = document.getElementById('customersLink');
  const isSupervisorPlus = (typeof user.level === 'number' && user.level >= 400)
    || (user.role && (user.role === 'admin' || user.role === 'supervisor'));
  if (isSupervisorPlus) {
    adminLink.style.display = 'inline-block';
    if (supervisorLink) supervisorLink.style.display = 'inline-block';
    if (ordersLink) ordersLink.style.display = 'inline-block';
    if (customersLink) customersLink.style.display = 'inline-block';
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

function getPriorityMeta(item) {
  // Handle both integer and string priority values
  // Use part priority if available, otherwise fall back to order priority
  let priorityValue = item.priority;
  if (priorityValue === null || priorityValue === undefined) {
    priorityValue = item.order_priority;
  }
  
  let key = '';
  if (typeof priorityValue === 'number') {
    // Map integer to string: 3=urgent, 2=high, 1=normal, 0=low
    const intMap = { 3: 'urgent', 2: 'high', 1: 'normal', 0: 'low' };
    key = intMap[priorityValue] || 'normal';
  } else {
    key = (priorityValue || 'normal').toLowerCase();
  }
  const label = key.replace(/_/g, ' ');
  const weight = typeof item.priority_score === 'number'
    ? item.priority_score
    : (PRIORITY_WEIGHT[key] || 0);
  const badgeClass = priorityClass(key);
  return {
    label: label.toUpperCase(),
    weight,
    badgeClass
  };
}

function priorityClass(key) {
  if (key === 'urgent' || key === 'high') return 'priority-urgent';
  if (key === 'normal' || key === 'medium') return 'priority-normal';
  if (key === 'low') return 'priority-low';
  return 'priority-normal';
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

    // Filter out completed parts - they should not appear on dashboard
    parts = parts.filter(part => {
      // Check part's own status
      if (part.status === 'completed') return false;
      
      // Check assignment status for operators
      if (isOperator && part.assignment && part.assignment.status === 'completed') return false;
      
      // Check workflow current_phase
      if (part.current_phase === 'completed' || part.current_phase === 'done') return false;
      
      return true;
    });

    parts = [...parts].sort((a, b) => {
      const pa = getPriorityMeta(a).weight;
      const pb = getPriorityMeta(b).weight;
      if (pb !== pa) return pb - pa;
      const da = new Date(a.due_date || 0).getTime();
      const db = new Date(b.due_date || 0).getTime();
      return da - db;
    });
    
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
  const user = Auth.getUser();
  const isSupervisorPlus = (typeof user.level === 'number' && user.level >= 400)
    || (user.role && (user.role === 'admin' || user.role === 'supervisor'));
  
  const card = document.createElement('div');
  card.className = 'part-card';
  const priority = getPriorityMeta(part);
  
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

  // Find first PDF file for thumbnail preview
  const pdfFile = part.files && part.files.find(f => f.fileType === 'PDF' || (f.filename && f.filename.toLowerCase().endsWith('.pdf')));

  card.innerHTML = `
    <div class="part-card-header">
      <div class="part-name">${escapeHtml(part.name)}</div>
      <span class="part-badge ${statusBadge}">${statusText}</span>
    </div>
    <div style="margin: 4px 0 8px 0; display: flex; align-items: center; gap: 8px;">
      <span class="priority-badge ${priority.badgeClass}">${priority.label}</span>
      ${priority.weight ? `<span class="priority-note">Score ${priority.weight}</span>` : ''}
    </div>
    <div class="part-card-body">
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
        ${isSupervisorPlus ? `
        <div class="info-row">
          <span class="info-label">Target Time:</span>
          <span class="info-value">${part.target_time} min</span>
        </div>
        ` : ''}
      </div>
      ${pdfFile ? `
      <div class="part-pdf-preview" data-file-id="${pdfFile.id}">
        <div class="pdf-loading">Loading PDF...</div>
      </div>
      ` : ''}
    </div>
  `;

  // Load PDF thumbnail if available
  if (pdfFile) {
    loadPdfThumbnail(card.querySelector('.part-pdf-preview'), pdfFile.id);
  }

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

    // Check user level for hiding target time
    const user = Auth.getUser();
    const isSupervisorPlus = (typeof user.level === 'number' && user.level >= 400)
      || (user.role && (user.role === 'admin' || user.role === 'supervisor'));

    // Update modal content
    document.getElementById('modalPartName').textContent = part.name;
    document.getElementById('modalMaterial').textContent = part.material;
    document.getElementById('modalQuantity').textContent = part.quantity;
    document.getElementById('modalTreatment').textContent = part.treatment || 'None';
    document.getElementById('modalTargetTime').textContent = `${part.target_time} minutes`;
    
    // Hide target time for operators (level < 400)
    const targetTimeRow = document.getElementById('targetTimeRow');
    if (targetTimeRow) {
      targetTimeRow.style.display = isSupervisorPlus ? '' : 'none';
    }

    renderFileFolder(part);

    // Load files
    activePdfId = null;
    loadPartFiles(part);

    // Load feedback
    loadPartFeedback(part);

    // Show/hide file upload for supervisors/admins
    const canUpload = isSupervisorPlus;
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

// Render server folder info and edit controls
function renderFileFolder(part) {
  const display = document.getElementById('fileFolderDisplay');
  const form = document.getElementById('fileFolderForm');
  const input = document.getElementById('fileFolderInput');
  const status = document.getElementById('fileFolderStatus');
  const user = Auth.getUser();
  const canEdit = user && typeof user.level === 'number' && user.level >= 400;

  if (display) {
    const folderText = part.file_folder || 'Not set';
    display.textContent = `Server folder: ${folderText}`;
  }

  if (form) {
    form.style.display = canEdit ? 'block' : 'none';
  }

  if (input) {
    input.value = part.file_folder || '';
  }

  if (status) {
    status.textContent = 'Folder must already exist on the server.';
    status.style.color = '#64748b';
  }
}

async function saveFolderPath(folderPath) {
  const status = document.getElementById('fileFolderStatus');
  if (status) {
    status.textContent = 'Saving folder...';
    status.style.color = '#64748b';
  }

  try {
    const result = await API.parts.setFolder(currentPart.id, folderPath);
    currentPart.file_folder = result.fileFolder || null;
    renderFileFolder(currentPart);
    if (status) {
      status.textContent = 'Saved';
      status.style.color = '#16a34a';
    }
  } catch (error) {
    if (status) {
      status.textContent = error.message || 'Failed to save folder';
      status.style.color = '#c53030';
    }
  }
}

// Load part files
function loadPartFiles(part) {
  const filesContainer = document.getElementById('modalFiles');
  const user = Auth.getUser();
  const canDelete = (typeof user.level === 'number' && user.level >= 400);
  
  if (!part.files || part.files.length === 0) {
    filesContainer.innerHTML = '<p class="text-muted">No files available</p>';
    hidePdfPreview();
    return;
  }

  filesContainer.innerHTML = '';
  let firstPdf = null;
  
  part.files.forEach(file => {
    const fileType = (file.fileType || file.filetype || 'FILE').toUpperCase();
    const isPdf = fileType === 'PDF';
    const isStep = isStepFile && isStepFile(file.filename);
    const isActivePdf = isPdf && activePdfId === file.id;
    const fileDiv = document.createElement('div');
    fileDiv.style.display = 'flex';
    fileDiv.style.alignItems = 'center';
    fileDiv.style.gap = '10px';
    fileDiv.style.marginBottom = '8px';
    
    const btn = document.createElement('button');
    btn.className = 'file-chip';
    btn.style.flex = '1';
    btn.style.borderRadius = '8px';
    btn.style.border = isPdf ? '1px solid #c53030' : '1px solid #c53030';
    if (isPdf) {
      btn.style.background = isActivePdf ? '#c53030' : '#ffffff';
      btn.style.color = isActivePdf ? '#ffffff' : '#111827';
    } else {
      btn.style.background = '#c53030';
      btn.style.color = '#ffffff';
    }
    btn.textContent = `${fileType} - ${file.filename}`;
    
    if (isPdf) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        activePdfId = file.id;
        showPdfPreview(file.id);
        // re-render to update chip highlighting
        loadPartFiles(currentPart);
      });
    } else {
      btn.addEventListener('click', () => downloadFile(file.id, file.filename));
    }
    
    fileDiv.appendChild(btn);
    
    // Add "View 3D" button for STEP files
    if (isStep && window.openStepViewer) {
      const view3dBtn = document.createElement('button');
      view3dBtn.className = 'btn btn-sm';
      view3dBtn.style.background = '#2563eb';
      view3dBtn.style.color = 'white';
      view3dBtn.style.padding = '5px 10px';
      view3dBtn.style.border = 'none';
      view3dBtn.style.borderRadius = '4px';
      view3dBtn.style.cursor = 'pointer';
      view3dBtn.innerHTML = '🔍 3D';
      view3dBtn.title = 'View 3D Model with Measurement';
      view3dBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openStepViewer(file.id, file.filename);
      });
      fileDiv.appendChild(view3dBtn);
    }
    
    // Add delete button for admins/supervisors
    if (canDelete) {
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn-sm btn-danger';
      deleteBtn.textContent = '🗑';
      deleteBtn.title = 'Delete file';
      deleteBtn.style.padding = '5px 10px';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteFile(file.id, file.filename);
      });
      fileDiv.appendChild(deleteBtn);
    }
    
    filesContainer.appendChild(fileDiv);
    
    // Find first PDF for preview
    if (!firstPdf && fileType === 'PDF') {
      firstPdf = file;
    }
  });
  
  // Show PDF preview if we found a PDF
  if (firstPdf) {
    if (!activePdfId) {
      activePdfId = firstPdf.id;
    }
    showPdfPreview(activePdfId);
  } else {
    hidePdfPreview();
  }
}

// Folder browser helpers
async function openFolderBrowser(initialPath) {
  try {
    const data = await API.files.browseFolders(initialPath || currentPart?.file_folder || '');
    folderBrowserState = {
      root: data.root,
      relativePath: data.relativePath || '',
      fullPath: data.path
    };
    renderFolderBrowser(data);
    const modal = document.getElementById('folderBrowserModal');
    if (modal) modal.style.display = 'flex';
  } catch (error) {
    alert(error.message || 'Failed to browse folders');
  }
}

function renderFolderBrowser(data) {
  const list = document.getElementById('folderBrowserList');
  const pathLabel = document.getElementById('folderBrowserPath');
  folderBrowserState.fullPath = data.path;
  folderBrowserState.relativePath = data.relativePath || '';
  folderBrowserState.root = data.root;

  if (pathLabel) {
    const rel = data.relativePath || '';
    pathLabel.textContent = rel ? `${data.root}/${rel}` : data.root;
  }

  if (list) {
    list.innerHTML = '';
    if (!data.entries || data.entries.length === 0) {
      list.innerHTML = '<p class="text-muted" style="margin:0;">No subfolders</p>';
    } else {
      data.entries.forEach((entry) => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.justifyContent = 'space-between';
        row.style.padding = '6px 8px';
        row.style.borderBottom = '1px solid #e2e8f0';

        const name = document.createElement('span');
        name.textContent = `📁 ${entry.name}`;
        name.style.cursor = 'pointer';
        name.addEventListener('click', () => openFolderBrowser(entry.path));

        row.appendChild(name);
        list.appendChild(row);
      });
    }
  }
}

function closeFolderBrowser() {
  const modal = document.getElementById('folderBrowserModal');
  if (modal) modal.style.display = 'none';
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

// Delete file
async function deleteFile(fileId, filename) {
  if (!confirm(`Delete file "${filename}"?`)) {
    return;
  }
  
  try {
    const response = await fetch(`${config.API_BASE_URL}/files/${fileId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${Auth.getToken()}`
      }
    });
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Delete failed');
    }
    
    // Reload part files
    const part = await API.parts.getOne(currentPart.id);
    currentPart = part;
    loadPartFiles(part);
    alert('File deleted successfully');
  } catch (error) {
    alert(error.message || 'Failed to delete file');
  }
}

// Show PDF preview
function showPdfPreview(fileId) {
  const previewSection = document.getElementById('pdfPreviewSection');
  const previewFrame = document.getElementById('pdfPreviewFrame');
  const url = API.files.getDownloadUrl(fileId);
  const token = Auth.getToken();
  
  // Use blob URL with auth
  fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
    .then(response => response.blob())
    .then(blob => {
      const blobUrl = window.URL.createObjectURL(blob);
      // Add PDF.js viewer parameters: pagemode=none (no sidebar), zoom=page-width (fit to width)
      previewFrame.src = blobUrl + '#pagemode=none&zoom=page-width';
      previewSection.style.display = 'block';
      updatePdfFullscreenState();
    })
    .catch(error => {
      console.error('PDF preview failed:', error);
      hidePdfPreview();
    });
}

// Load PDF thumbnail for card preview
async function loadPdfThumbnail(container, fileId) {
  if (!container) return;
  
  try {
    const url = API.files.getDownloadUrl(fileId);
    const token = Auth.getToken();
    
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) {
      container.innerHTML = '<div class="pdf-error">PDF unavailable</div>';
      return;
    }
    
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    
    // Create an iframe for the PDF preview with minimal controls
    container.innerHTML = `
      <iframe 
        src="${blobUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH" 
        class="pdf-thumbnail-frame"
        loading="lazy"
      ></iframe>
    `;
  } catch (error) {
    console.error('PDF thumbnail load failed:', error);
    container.innerHTML = '<div class="pdf-error">PDF unavailable</div>';
  }
}

// Hide PDF preview
function hidePdfPreview() {
  const previewSection = document.getElementById('pdfPreviewSection');
  const previewFrame = document.getElementById('pdfPreviewFrame');
  if (document.fullscreenElement === previewSection && document.exitFullscreen) {
    document.exitFullscreen();
  }
  if (previewFrame.src) {
    window.URL.revokeObjectURL(previewFrame.src);
    previewFrame.src = '';
  }
  previewSection.style.display = 'none';
  updatePdfFullscreenState();
}

// Toggle fullscreen for PDF preview
function togglePdfFullscreen() {
  const previewSection = document.getElementById('pdfPreviewSection');
  if (!previewSection) return;

  if (document.fullscreenElement === previewSection) {
    if (document.exitFullscreen) document.exitFullscreen();
  } else if (previewSection.requestFullscreen) {
    previewSection.requestFullscreen();
  }
}

// Sync fullscreen button label and iframe height
function updatePdfFullscreenState() {
  const previewSection = document.getElementById('pdfPreviewSection');
  const previewFrame = document.getElementById('pdfPreviewFrame');
  const fullscreenBtn = document.getElementById('pdfFullscreenBtn');
  const isFullscreen = document.fullscreenElement === previewSection;

  if (fullscreenBtn) {
    fullscreenBtn.textContent = isFullscreen ? 'Exit Full Screen' : 'Full Screen';
  }

  if (previewFrame) {
    previewFrame.style.height = isFullscreen ? 'calc(100vh - 80px)' : '500px';
  }
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

  // Save server folder
  const folderSaveBtn = document.getElementById('fileFolderSaveBtn');
  if (folderSaveBtn) {
    folderSaveBtn.addEventListener('click', async () => {
      if (!currentPart) return;

      const input = document.getElementById('fileFolderInput');
      const folderPath = input ? input.value.trim() : '';
      saveFolderPath(folderPath);
    });
  }

  // Browse server folder
  const folderBrowseBtn = document.getElementById('fileFolderBrowseBtn');
  if (folderBrowseBtn) {
    folderBrowseBtn.addEventListener('click', () => {
      if (!currentPart) return;
      openFolderBrowser(currentPart.file_folder || '');
    });
  }

  const folderSyncBtn = document.getElementById('fileFolderSyncBtn');
  if (folderSyncBtn) {
    folderSyncBtn.addEventListener('click', async () => {
      if (!currentPart) return;
      const status = document.getElementById('fileFolderStatus');
      if (status) {
        status.textContent = 'Syncing files...';
        status.style.color = '#64748b';
      }
      try {
        const result = await API.files.syncFromFolder(currentPart.id);
        const part = await API.parts.getOne(currentPart.id);
        currentPart = part;
        loadPartFiles(part);
        if (status) {
          status.textContent = `Synced ${result.added} files`;
          status.style.color = '#16a34a';
        }
      } catch (error) {
        if (status) {
          status.textContent = error.message || 'Sync failed';
          status.style.color = '#c53030';
        }
      }
    });
  }

  // Folder browser controls
  const folderBrowserUpBtn = document.getElementById('folderBrowserUpBtn');
  if (folderBrowserUpBtn) {
    folderBrowserUpBtn.addEventListener('click', () => {
      const parent = folderBrowserState.relativePath ? folderBrowserState.relativePath.split('/').slice(0, -1).join('/') : '';
      openFolderBrowser(parent);
    });
  }

  const folderBrowserUseBtn = document.getElementById('folderBrowserUseBtn');
  if (folderBrowserUseBtn) {
    folderBrowserUseBtn.addEventListener('click', () => {
      if (!currentPart) return;
      const pathToUse = folderBrowserState.fullPath || currentPart.file_folder || '';
      const input = document.getElementById('fileFolderInput');
      if (input) input.value = pathToUse;
      saveFolderPath(pathToUse);
      // After saving folder, trigger an automatic sync
      const status = document.getElementById('fileFolderStatus');
      if (status) {
        status.textContent = 'Syncing files...';
        status.style.color = '#64748b';
      }
      API.files.syncFromFolder(currentPart.id)
        .then(async (result) => {
          const part = await API.parts.getOne(currentPart.id);
          currentPart = part;
          loadPartFiles(part);
          if (status) {
            status.textContent = `Synced ${result.added} files`;
            status.style.color = '#16a34a';
          }
        })
        .catch((error) => {
          if (status) {
            status.textContent = error.message || 'Sync failed';
            status.style.color = '#c53030';
          }
        });
      closeFolderBrowser();
    });
  }

  const folderBrowserClose = document.getElementById('folderBrowserClose');
  if (folderBrowserClose) {
    folderBrowserClose.addEventListener('click', closeFolderBrowser);
  }

  // PDF fullscreen
  const fullscreenBtn = document.getElementById('pdfFullscreenBtn');
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', (e) => {
      e.preventDefault();
      togglePdfFullscreen();
    });
  }

  document.addEventListener('fullscreenchange', updatePdfFullscreenState);

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

    const actualTimePerPart = parseInt(document.getElementById('actualTime').value);
    if (!actualTimePerPart || actualTimePerPart < 1) {
      alert('Please enter a valid time');
      return;
    }

    // Multiply time per part by quantity to get total actual time
    const quantity = currentPart.quantity || 1;
    const totalActualTime = actualTimePerPart * quantity;

    try {
      await API.parts.complete(currentPart.id, totalActualTime);
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
      const files = fileInput.files;
      
      if (!files || files.length === 0) {
        alert('Please select at least one file');
        return;
      }

      // Validate all files first
      const validFiles = [];
      const errors = [];
      
      for (const file of files) {
        const ext = file.name.split('.').pop().toLowerCase();
        if (!['pdf', 'dxf', 'nc', 'txt'].includes(ext)) {
          errors.push(`${file.name}: Invalid file type (only PDF, DXF, NC, TXT allowed)`);
          continue;
        }
        if (file.size > 10 * 1024 * 1024) {
          errors.push(`${file.name}: File too large (max 10MB)`);
          continue;
        }
        validFiles.push(file);
      }

      if (validFiles.length === 0) {
        alert('No valid files to upload:\n' + errors.join('\n'));
        return;
      }

      try {
        let successCount = 0;
        const uploadErrors = [];

        // Upload files one by one
        for (const file of validFiles) {
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
            uploadErrors.push(`${file.name}: ${data.error || 'Upload failed'}`);
          } else {
            successCount++;
          }
        }

        // Reset form and reload files
        fileInput.value = '';
        const part = await API.parts.getOne(currentPart.id);
        currentPart = part;
        loadPartFiles(part);

        // Show result message
        let message = `${successCount} file(s) uploaded successfully!`;
        if (errors.length > 0 || uploadErrors.length > 0) {
          message += '\n\nSkipped/Failed:\n' + [...errors, ...uploadErrors].join('\n');
        }
        alert(message);
      } catch (error) {
        alert(error.message || 'Failed to upload files');
      }
    });
  }
}

// Open complete modal
function openCompleteModal() {
  if (!currentPart) return;
  
  // Check user level for hiding target time
  const user = Auth.getUser();
  const isSupervisorPlus = (typeof user.level === 'number' && user.level >= 400)
    || (user.role && (user.role === 'admin' || user.role === 'supervisor'));
  
  document.getElementById('completeTargetTime').textContent = currentPart.target_time;
  document.getElementById('actualTime').value = currentPart.target_time;
  
  // Hide target time for operators (level < 400)
  const completeTargetTimeRow = document.getElementById('completeTargetTimeRow');
  if (completeTargetTimeRow) {
    completeTargetTimeRow.style.display = isSupervisorPlus ? '' : 'none';
  }
  
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
