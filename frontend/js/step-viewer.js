// STEP File Viewer with Measurement Tools
// Uses Online3DViewer Engine (O3DV)

let stepViewerInstance = null;
let stepViewerModal = null;

// Initialize STEP viewer when script loads
function initStepViewer() {
  // Create modal for full STEP viewer
  if (!document.getElementById('stepViewerModal')) {
    const modal = document.createElement('div');
    modal.id = 'stepViewerModal';
    modal.className = 'step-viewer-modal';
    modal.innerHTML = `
      <div class="step-viewer-container">
        <div class="step-viewer-header">
          <h3 id="stepViewerTitle">3D STEP Viewer</h3>
          <div class="step-viewer-controls">
            <button id="stepMeasureBtn" class="step-btn" title="Measure Distance">
              📏 Measure
            </button>
            <button id="stepResetViewBtn" class="step-btn" title="Reset View">
              🔄 Reset
            </button>
            <button id="stepFullscreenBtn" class="step-btn" title="Fullscreen">
              ⛶ Fullscreen
            </button>
            <button id="stepCloseBtn" class="step-btn step-btn-close" title="Close">
              ✕
            </button>
          </div>
        </div>
        <div id="stepViewerContent" class="step-viewer-content">
          <div class="step-loading">
            <div class="step-spinner"></div>
            <p>Loading 3D Model...</p>
          </div>
        </div>
        <div class="step-viewer-footer">
          <div id="stepMeasureInfo" class="step-measure-info"></div>
          <div class="step-controls-hint">
            🖱️ Left: Rotate | Right: Pan | Scroll: Zoom
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    
    // Event listeners
    document.getElementById('stepCloseBtn').addEventListener('click', closeStepViewer);
    document.getElementById('stepResetViewBtn').addEventListener('click', resetStepView);
    document.getElementById('stepFullscreenBtn').addEventListener('click', toggleStepFullscreen);
    document.getElementById('stepMeasureBtn').addEventListener('click', toggleMeasureMode);
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeStepViewer();
    });
  }
}

// Load and display STEP file
async function openStepViewer(fileId, filename) {
  initStepViewer();
  
  const modal = document.getElementById('stepViewerModal');
  const content = document.getElementById('stepViewerContent');
  const title = document.getElementById('stepViewerTitle');
  
  title.textContent = filename || '3D STEP Viewer';
  modal.classList.add('active');
  
  content.innerHTML = `
    <div class="step-loading">
      <div class="step-spinner"></div>
      <p>Loading 3D Model...</p>
      <p class="step-loading-hint">First load may take a moment...</p>
    </div>
  `;
  
  try {
    // Fetch the file
    const url = API.files.getDownloadUrl(fileId);
    const token = Auth.getToken();
    
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) throw new Error('Failed to load file');
    
    const blob = await response.blob();
    const file = new File([blob], filename || 'model.step', { type: 'application/step' });
    
    // Initialize Three.js viewer
    await initThreeJsViewer(content, file);
    
  } catch (error) {
    console.error('STEP viewer error:', error);
    content.innerHTML = `
      <div class="step-error">
        <p>❌ Failed to load 3D model</p>
        <p class="step-error-detail">${error.message}</p>
      </div>
    `;
  }
}

// Three.js based STEP viewer with occt-import-js
async function initThreeJsViewer(container, file) {
  try {
    // Show loading progress
    container.innerHTML = `
      <div class="step-loading">
        <div class="step-spinner"></div>
        <p id="stepLoadingStatus">Initializing...</p>
      </div>
    `;
    const updateStatus = (msg) => {
      const el = document.getElementById('stepLoadingStatus');
      if (el) el.textContent = msg;
    };
    
    // Three.js and OrbitControls are loaded in HTML head
    if (!window.THREE) {
      throw new Error('Three.js library not loaded');
    }
    
    if (!window.THREE.OrbitControls) {
      throw new Error('OrbitControls not loaded');
    }
    
    // Load occt-import-js for STEP parsing
    if (!window.occtimportjs) {
      updateStatus('Loading STEP parser (first load may take a moment)...');
      await loadScript('https://cdn.jsdelivr.net/npm/occt-import-js@0.0.12/dist/occt-import-js.js');
    }
    
    // Wait for WASM to initialize
    updateStatus('Initializing STEP parser...');
    const occt = await window.occtimportjs();
    
    // Read file
    updateStatus('Reading file...');
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = new Uint8Array(arrayBuffer);
    
    // Parse STEP file
    updateStatus('Parsing STEP file...');
    const result = occt.ReadStepFile(fileBuffer, null);
    
    if (!result.success) {
      throw new Error('Failed to parse STEP file - file may be corrupted or unsupported format');
    }
    
    if (!result.meshes || result.meshes.length === 0) {
      throw new Error('No geometry found in STEP file');
    }
    
    updateStatus('Building 3D scene...');
  container.innerHTML = '';
  
  const width = container.clientWidth;
  const height = container.clientHeight;
  
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf0f4f8);
  
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 10000);
  
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);
  
  // Controls
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  
  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(1, 1, 1);
  scene.add(directionalLight);
  
  const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
  directionalLight2.position.set(-1, -1, -1);
  scene.add(directionalLight2);
  
  // Create mesh from STEP data
  const group = new THREE.Group();
  
  for (const mesh of result.meshes) {
    const geometry = new THREE.BufferGeometry();
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(mesh.attributes.position.array, 3));
    if (mesh.attributes.normal) {
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(mesh.attributes.normal.array, 3));
    }
    geometry.setIndex(new THREE.Uint32BufferAttribute(mesh.index.array, 1));
    
    let color = 0x4a90d9;
    if (mesh.color) {
      color = new THREE.Color(mesh.color[0], mesh.color[1], mesh.color[2]);
    }
    
    const material = new THREE.MeshPhongMaterial({
      color: color,
      side: THREE.DoubleSide,
      flatShading: false
    });
    
    const threeMesh = new THREE.Mesh(geometry, material);
    group.add(threeMesh);
  }
  
  scene.add(group);
  
  // Center and fit model
  const box = new THREE.Box3().setFromObject(group);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  
  group.position.sub(center);
  
  const maxDim = Math.max(size.x, size.y, size.z);
  camera.position.set(maxDim * 1.5, maxDim * 1.5, maxDim * 1.5);
  camera.lookAt(0, 0, 0);
  controls.target.set(0, 0, 0);
  
  // Store for measurement
  stepViewerInstance = {
    scene,
    camera,
    renderer,
    controls,
    group,
    container,
    measureMode: false,
    measurePoints: [],
    measureLines: [],
    raycaster: new THREE.Raycaster(),
    mouse: new THREE.Vector2()
  };
  
  // Add grid
  const gridHelper = new THREE.GridHelper(maxDim * 2, 20, 0xcccccc, 0xeeeeee);
  gridHelper.position.y = -size.y / 2;
  scene.add(gridHelper);
  
  // Add axes helper
  const axesHelper = new THREE.AxesHelper(maxDim * 0.5);
  scene.add(axesHelper);
  
  // Animation loop
  function animate() {
    if (!stepViewerInstance) return;
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();
  
  // Handle resize
  const resizeObserver = new ResizeObserver(() => {
    if (!stepViewerInstance) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
  resizeObserver.observe(container);
  
  // Click handler for measurement
  renderer.domElement.addEventListener('click', onViewerClick);
  
  } catch (initError) {
    console.error('STEP viewer initialization error:', initError);
    throw initError;
  }
}

function onViewerClick(event) {
  if (!stepViewerInstance || !stepViewerInstance.measureMode) return;
  
  const rect = stepViewerInstance.renderer.domElement.getBoundingClientRect();
  stepViewerInstance.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  stepViewerInstance.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  
  stepViewerInstance.raycaster.setFromCamera(stepViewerInstance.mouse, stepViewerInstance.camera);
  
  const intersects = stepViewerInstance.raycaster.intersectObjects(stepViewerInstance.group.children, true);
  
  if (intersects.length > 0) {
    const point = intersects[0].point.clone();
    addMeasurePoint(point);
  }
}

function addMeasurePoint(point) {
  const scene = stepViewerInstance.scene;
  
  // Create sphere at point
  const sphereGeom = new THREE.SphereGeometry(0.5, 16, 16);
  const sphereMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  const sphere = new THREE.Mesh(sphereGeom, sphereMat);
  sphere.position.copy(point);
  scene.add(sphere);
  
  stepViewerInstance.measurePoints.push({ point, mesh: sphere });
  
  // If we have 2 points, draw line and show distance
  if (stepViewerInstance.measurePoints.length === 2) {
    const p1 = stepViewerInstance.measurePoints[0].point;
    const p2 = stepViewerInstance.measurePoints[1].point;
    
    // Draw line
    const lineGeom = new THREE.BufferGeometry().setFromPoints([p1, p2]);
    const lineMat = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 2 });
    const line = new THREE.Line(lineGeom, lineMat);
    scene.add(line);
    stepViewerInstance.measureLines.push(line);
    
    // Calculate distance
    const distance = p1.distanceTo(p2);
    
    // Show measurement
    const measureInfo = document.getElementById('stepMeasureInfo');
    measureInfo.innerHTML = `
      <span class="measure-result">📏 Distance: <strong>${distance.toFixed(2)} mm</strong></span>
      <button onclick="clearMeasurements()" class="step-btn-small">Clear</button>
    `;
  }
}

function clearMeasurements() {
  if (!stepViewerInstance) return;
  
  // Remove point spheres
  stepViewerInstance.measurePoints.forEach(p => {
    stepViewerInstance.scene.remove(p.mesh);
  });
  stepViewerInstance.measurePoints = [];
  
  // Remove lines
  stepViewerInstance.measureLines.forEach(l => {
    stepViewerInstance.scene.remove(l);
  });
  stepViewerInstance.measureLines = [];
  
  document.getElementById('stepMeasureInfo').innerHTML = '';
}

function toggleMeasureMode() {
  if (!stepViewerInstance) return;
  
  stepViewerInstance.measureMode = !stepViewerInstance.measureMode;
  const btn = document.getElementById('stepMeasureBtn');
  
  if (stepViewerInstance.measureMode) {
    btn.classList.add('active');
    stepViewerInstance.renderer.domElement.style.cursor = 'crosshair';
    document.getElementById('stepMeasureInfo').innerHTML = '<span>Click two points on the model to measure distance</span>';
    clearMeasurements();
  } else {
    btn.classList.remove('active');
    stepViewerInstance.renderer.domElement.style.cursor = 'grab';
    document.getElementById('stepMeasureInfo').innerHTML = '';
  }
}

function resetStepView() {
  if (!stepViewerInstance) return;
  
  const box = new THREE.Box3().setFromObject(stepViewerInstance.group);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  
  stepViewerInstance.camera.position.set(maxDim * 1.5, maxDim * 1.5, maxDim * 1.5);
  stepViewerInstance.camera.lookAt(0, 0, 0);
  stepViewerInstance.controls.target.set(0, 0, 0);
  stepViewerInstance.controls.update();
  
  clearMeasurements();
}

function toggleStepFullscreen() {
  const modal = document.getElementById('stepViewerModal');
  const container = modal.querySelector('.step-viewer-container');
  
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    container.requestFullscreen();
  }
}

function closeStepViewer() {
  const modal = document.getElementById('stepViewerModal');
  modal.classList.remove('active');
  
  if (stepViewerInstance) {
    stepViewerInstance.renderer.dispose();
    stepViewerInstance = null;
  }
}

// Helper to load scripts dynamically
function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// Check if file is a STEP file
function isStepFile(filename) {
  if (!filename) return false;
  const ext = filename.toLowerCase();
  return ext.endsWith('.step') || ext.endsWith('.stp');
}

// Make functions globally available
window.openStepViewer = openStepViewer;
window.closeStepViewer = closeStepViewer;
window.isStepFile = isStepFile;
window.clearMeasurements = clearMeasurements;
