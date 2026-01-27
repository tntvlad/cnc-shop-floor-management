// STEP File Viewer with Measurement Tools
// Uses Three.js and occt-import-js

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
            <div class="step-measure-dropdown">
              <button id="stepMeasureBtn" class="step-btn" title="Measurement Tools">
                📏 Measure ▼
              </button>
              <div id="stepMeasureMenu" class="step-measure-menu">
                <button onclick="setMeasureMode('distance')" class="step-menu-item" title="Measure distance between two points">
                  📏 Point Distance
                </button>
                <button onclick="setMeasureMode('axis')" class="step-menu-item" title="Show X/Y/Z axis dimensions">
                  📐 Axis Dimensions
                </button>
                <button onclick="setMeasureMode('surface')" class="step-menu-item" title="Measure point on surface">
                  🎯 Surface Point
                </button>
                <button onclick="showBoundingBox()" class="step-menu-item" title="Show model bounding box dimensions">
                  📦 Bounding Box
                </button>
                <hr>
                <button onclick="toggleSnapMode()" class="step-menu-item" id="snapModeBtn">
                  🧲 Snap: OFF
                </button>
                <button onclick="clearMeasurements()" class="step-menu-item text-danger">
                  🗑️ Clear All
                </button>
              </div>
            </div>
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
          <div id="stepMeasureMode" class="step-measure-mode"></div>
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
    document.getElementById('stepMeasureBtn').addEventListener('click', toggleMeasureMenu);
    
    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      const menu = document.getElementById('stepMeasureMenu');
      const btn = document.getElementById('stepMeasureBtn');
      if (menu && !menu.contains(e.target) && !btn.contains(e.target)) {
        menu.classList.remove('active');
      }
    });
    
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
    const isIges = filename && (filename.toLowerCase().endsWith('.igs') || filename.toLowerCase().endsWith('.iges'));
    const mimeType = isIges ? 'application/iges' : 'application/step';
    const defaultName = isIges ? 'model.igs' : 'model.step';
    const file = new File([blob], filename || defaultName, { type: mimeType });
    
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
    
    // Parse STEP file (v0.0.12 API takes only 1 argument)
    updateStatus('Parsing STEP file...');
    const result = occt.ReadStepFile(fileBuffer);
    
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
    
    // Add edges for shaded with edges look
    const edgesGeometry = new THREE.EdgesGeometry(geometry, 30); // 30 degree threshold
    const edgesMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1 });
    const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
    group.add(edges);
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
    box: box.clone(),
    modelSize: size.clone(),
    modelCenter: center.clone(),
    measureMode: null, // 'distance', 'axis', 'surface'
    snapMode: false,
    measurePoints: [],
    measureLines: [],
    measureLabels: [],
    measureObjects: [], // All measurement visualization objects
    raycaster: new THREE.Raycaster(),
    mouse: new THREE.Vector2(),
    snapIndicator: null,
    vertexPositions: [] // For snap-to-vertex
  };
  
  // Extract all vertices for snap functionality
  extractVertices(group);
  
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
  
  // Only intersect with mesh objects, not edges
  const meshChildren = stepViewerInstance.group.children.filter(c => c.type === 'Mesh');
  const intersects = stepViewerInstance.raycaster.intersectObjects(meshChildren, true);
  
  if (intersects.length > 0) {
    let point = intersects[0].point.clone();
    const face = intersects[0].face;
    const normal = face ? face.normal.clone() : null;
    
    // Apply snap if enabled
    if (stepViewerInstance.snapMode) {
      point = findNearestVertex(point);
    }
    
    handleMeasureClick(point, normal, intersects[0]);
  }
}

// Extract vertices from geometry for snapping
function extractVertices(group) {
  stepViewerInstance.vertexPositions = [];
  
  group.traverse((child) => {
    if (child.isMesh && child.geometry) {
      const posAttr = child.geometry.getAttribute('position');
      if (posAttr) {
        for (let i = 0; i < posAttr.count; i++) {
          const vertex = new THREE.Vector3(
            posAttr.getX(i),
            posAttr.getY(i),
            posAttr.getZ(i)
          );
          // Transform to world coordinates
          vertex.applyMatrix4(child.matrixWorld);
          stepViewerInstance.vertexPositions.push(vertex);
        }
      }
    }
  });
}

// Find nearest vertex for snapping
function findNearestVertex(point) {
  if (!stepViewerInstance.vertexPositions.length) return point;
  
  let nearestDist = Infinity;
  let nearestVertex = point;
  
  const box = new THREE.Box3().setFromObject(stepViewerInstance.group);
  const size = box.getSize(new THREE.Vector3());
  const snapThreshold = Math.max(size.x, size.y, size.z) * 0.02; // 2% of model size
  
  for (const vertex of stepViewerInstance.vertexPositions) {
    const dist = point.distanceTo(vertex);
    if (dist < nearestDist && dist < snapThreshold) {
      nearestDist = dist;
      nearestVertex = vertex.clone();
    }
  }
  
  return nearestVertex;
}

// Handle measurement click based on current mode
function handleMeasureClick(point, normal, intersection) {
  const mode = stepViewerInstance.measureMode;
  
  switch (mode) {
    case 'distance':
      addDistanceMeasurePoint(point);
      break;
    case 'axis':
      addAxisMeasurePoint(point);
      break;
    case 'surface':
      showSurfacePoint(point, normal);
      break;
  }
}

// Distance measurement (point to point)
function addDistanceMeasurePoint(point) {
  const scene = stepViewerInstance.scene;
  const box = new THREE.Box3().setFromObject(stepViewerInstance.group);
  const size = box.getSize(new THREE.Vector3());
  const sphereRadius = Math.max(size.x, size.y, size.z) * 0.01;
  
  // Create sphere at point
  const sphereGeom = new THREE.SphereGeometry(sphereRadius, 16, 16);
  const sphereMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  const sphere = new THREE.Mesh(sphereGeom, sphereMat);
  sphere.position.copy(point);
  scene.add(sphere);
  stepViewerInstance.measureObjects.push(sphere);
  
  stepViewerInstance.measurePoints.push({ point, mesh: sphere });
  
  updateMeasureInfo(`Point ${stepViewerInstance.measurePoints.length} selected. ${stepViewerInstance.measurePoints.length < 2 ? 'Click another point.' : ''}`);
  
  // If we have 2 points, draw line and show distance
  if (stepViewerInstance.measurePoints.length >= 2) {
    const p1 = stepViewerInstance.measurePoints[stepViewerInstance.measurePoints.length - 2].point;
    const p2 = stepViewerInstance.measurePoints[stepViewerInstance.measurePoints.length - 1].point;
    
    // Draw main measurement line
    const lineGeom = new THREE.BufferGeometry().setFromPoints([p1, p2]);
    const lineMat = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 2 });
    const line = new THREE.Line(lineGeom, lineMat);
    scene.add(line);
    stepViewerInstance.measureObjects.push(line);
    
    // Calculate distances
    const totalDist = p1.distanceTo(p2);
    const dx = Math.abs(p2.x - p1.x);
    const dy = Math.abs(p2.y - p1.y);
    const dz = Math.abs(p2.z - p1.z);
    
    // Draw axis dimension lines
    drawAxisDimensionLines(p1, p2);
    
    // Show measurement with axis breakdown
    updateMeasureInfo(`
      <div class="measure-results">
        <div class="measure-total">📏 <strong>Total: ${totalDist.toFixed(2)} mm</strong></div>
        <div class="measure-axes">
          <span class="axis-x">X: ${dx.toFixed(2)}</span>
          <span class="axis-y">Y: ${dy.toFixed(2)}</span>
          <span class="axis-z">Z: ${dz.toFixed(2)}</span>
        </div>
      </div>
    `);
  }
}

// Draw axis-aligned dimension lines between two points
function drawAxisDimensionLines(p1, p2) {
  const scene = stepViewerInstance.scene;
  
  // X dimension line (red)
  if (Math.abs(p2.x - p1.x) > 0.01) {
    const xLine = createDimensionLine(
      new THREE.Vector3(p1.x, p1.y, p1.z),
      new THREE.Vector3(p2.x, p1.y, p1.z),
      0xff4444
    );
    scene.add(xLine);
    stepViewerInstance.measureObjects.push(xLine);
  }
  
  // Y dimension line (green)
  if (Math.abs(p2.y - p1.y) > 0.01) {
    const yLine = createDimensionLine(
      new THREE.Vector3(p2.x, p1.y, p1.z),
      new THREE.Vector3(p2.x, p2.y, p1.z),
      0x44ff44
    );
    scene.add(yLine);
    stepViewerInstance.measureObjects.push(yLine);
  }
  
  // Z dimension line (blue)
  if (Math.abs(p2.z - p1.z) > 0.01) {
    const zLine = createDimensionLine(
      new THREE.Vector3(p2.x, p2.y, p1.z),
      new THREE.Vector3(p2.x, p2.y, p2.z),
      0x4444ff
    );
    scene.add(zLine);
    stepViewerInstance.measureObjects.push(zLine);
  }
}

// Create a dashed dimension line
function createDimensionLine(start, end, color) {
  const lineGeom = new THREE.BufferGeometry().setFromPoints([start, end]);
  const lineMat = new THREE.LineDashedMaterial({ 
    color: color, 
    linewidth: 1,
    dashSize: 2,
    gapSize: 1
  });
  const line = new THREE.Line(lineGeom, lineMat);
  line.computeLineDistances();
  return line;
}

// Axis-only measurement mode
function addAxisMeasurePoint(point) {
  const scene = stepViewerInstance.scene;
  const box = new THREE.Box3().setFromObject(stepViewerInstance.group);
  const size = box.getSize(new THREE.Vector3());
  const sphereRadius = Math.max(size.x, size.y, size.z) * 0.01;
  
  const sphereGeom = new THREE.SphereGeometry(sphereRadius, 16, 16);
  const sphereMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
  const sphere = new THREE.Mesh(sphereGeom, sphereMat);
  sphere.position.copy(point);
  scene.add(sphere);
  stepViewerInstance.measureObjects.push(sphere);
  
  stepViewerInstance.measurePoints.push({ point, mesh: sphere });
  
  if (stepViewerInstance.measurePoints.length >= 2) {
    const p1 = stepViewerInstance.measurePoints[stepViewerInstance.measurePoints.length - 2].point;
    const p2 = stepViewerInstance.measurePoints[stepViewerInstance.measurePoints.length - 1].point;
    
    const dx = Math.abs(p2.x - p1.x);
    const dy = Math.abs(p2.y - p1.y);
    const dz = Math.abs(p2.z - p1.z);
    
    // Draw only axis-aligned lines
    drawAxisDimensionLines(p1, p2);
    
    updateMeasureInfo(`
      <div class="measure-results axis-only">
        <div class="measure-axes-large">
          <div class="axis-item axis-x">📐 X: <strong>${dx.toFixed(2)} mm</strong></div>
          <div class="axis-item axis-y">📐 Y: <strong>${dy.toFixed(2)} mm</strong></div>
          <div class="axis-item axis-z">📐 Z: <strong>${dz.toFixed(2)} mm</strong></div>
        </div>
      </div>
    `);
  } else {
    updateMeasureInfo('Click second point to see axis dimensions');
  }
}

// Surface point measurement
function showSurfacePoint(point, normal) {
  const scene = stepViewerInstance.scene;
  const box = new THREE.Box3().setFromObject(stepViewerInstance.group);
  const size = box.getSize(new THREE.Vector3());
  const sphereRadius = Math.max(size.x, size.y, size.z) * 0.01;
  
  // Create marker at point
  const sphereGeom = new THREE.SphereGeometry(sphereRadius, 16, 16);
  const sphereMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
  const sphere = new THREE.Mesh(sphereGeom, sphereMat);
  sphere.position.copy(point);
  scene.add(sphere);
  stepViewerInstance.measureObjects.push(sphere);
  
  // Draw normal arrow if available
  if (normal) {
    const arrowLength = Math.max(size.x, size.y, size.z) * 0.1;
    const arrowHelper = new THREE.ArrowHelper(
      normal.normalize(),
      point,
      arrowLength,
      0xffff00
    );
    scene.add(arrowHelper);
    stepViewerInstance.measureObjects.push(arrowHelper);
  }
  
  stepViewerInstance.measurePoints.push({ point, mesh: sphere });
  
  // Get coordinates relative to model center
  const relPoint = point.clone();
  
  updateMeasureInfo(`
    <div class="measure-results surface-point">
      <div class="measure-title">🎯 Surface Point</div>
      <div class="measure-coords">
        <span class="axis-x">X: ${relPoint.x.toFixed(3)}</span>
        <span class="axis-y">Y: ${relPoint.y.toFixed(3)}</span>
        <span class="axis-z">Z: ${relPoint.z.toFixed(3)}</span>
      </div>
      ${normal ? `<div class="measure-normal">Normal: (${normal.x.toFixed(2)}, ${normal.y.toFixed(2)}, ${normal.z.toFixed(2)})</div>` : ''}
    </div>
  `);
}

// Show bounding box dimensions
function showBoundingBox() {
  if (!stepViewerInstance) return;
  
  const scene = stepViewerInstance.scene;
  const box = new THREE.Box3().setFromObject(stepViewerInstance.group);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  
  // Create bounding box helper
  const boxHelper = new THREE.Box3Helper(box, 0xffff00);
  scene.add(boxHelper);
  stepViewerInstance.measureObjects.push(boxHelper);
  
  // Close menu
  document.getElementById('stepMeasureMenu').classList.remove('active');
  
  updateMeasureInfo(`
    <div class="measure-results bounding-box">
      <div class="measure-title">📦 Bounding Box</div>
      <div class="measure-axes-large">
        <div class="axis-item axis-x">Width (X): <strong>${size.x.toFixed(2)} mm</strong></div>
        <div class="axis-item axis-y">Height (Y): <strong>${size.y.toFixed(2)} mm</strong></div>
        <div class="axis-item axis-z">Depth (Z): <strong>${size.z.toFixed(2)} mm</strong></div>
      </div>
    </div>
  `);
}

// Toggle snap mode
function toggleSnapMode() {
  if (!stepViewerInstance) return;
  
  stepViewerInstance.snapMode = !stepViewerInstance.snapMode;
  const btn = document.getElementById('snapModeBtn');
  btn.textContent = `🧲 Snap: ${stepViewerInstance.snapMode ? 'ON' : 'OFF'}`;
  btn.classList.toggle('active', stepViewerInstance.snapMode);
}

// Toggle measure menu dropdown
function toggleMeasureMenu() {
  const menu = document.getElementById('stepMeasureMenu');
  menu.classList.toggle('active');
}

// Set measurement mode
function setMeasureMode(mode) {
  if (!stepViewerInstance) return;
  
  stepViewerInstance.measureMode = mode;
  stepViewerInstance.measurePoints = [];
  
  const btn = document.getElementById('stepMeasureBtn');
  const menu = document.getElementById('stepMeasureMenu');
  const modeDisplay = document.getElementById('stepMeasureMode');
  
  btn.classList.add('active');
  menu.classList.remove('active');
  stepViewerInstance.renderer.domElement.style.cursor = 'crosshair';
  
  const modeLabels = {
    'distance': '📏 Distance Mode',
    'axis': '📐 Axis Mode',
    'surface': '🎯 Surface Mode'
  };
  
  modeDisplay.textContent = modeLabels[mode] || '';
  
  const hints = {
    'distance': 'Click two points to measure distance with X/Y/Z breakdown',
    'axis': 'Click two points to see axis-aligned dimensions only',
    'surface': 'Click a surface to see point coordinates and normal'
  };
  
  updateMeasureInfo(hints[mode] || '');
}

// Update measure info display
function updateMeasureInfo(html) {
  const el = document.getElementById('stepMeasureInfo');
  if (el) el.innerHTML = html;
}

function clearMeasurements() {
  if (!stepViewerInstance) return;
  
  // Remove all measurement objects
  stepViewerInstance.measureObjects.forEach(obj => {
    stepViewerInstance.scene.remove(obj);
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) obj.material.dispose();
  });
  stepViewerInstance.measureObjects = [];
  stepViewerInstance.measurePoints = [];
  stepViewerInstance.measureLines = [];
  
  document.getElementById('stepMeasureInfo').innerHTML = '';
  document.getElementById('stepMeasureMode').textContent = '';
  document.getElementById('stepMeasureMenu').classList.remove('active');
  
  // Reset mode
  stepViewerInstance.measureMode = null;
  document.getElementById('stepMeasureBtn').classList.remove('active');
  stepViewerInstance.renderer.domElement.style.cursor = 'grab';
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

// Check if file is a STEP or IGES file (supported CAD formats)
function isStepFile(filename) {
  if (!filename) return false;
  const ext = filename.toLowerCase();
  return ext.endsWith('.step') || ext.endsWith('.stp') || ext.endsWith('.igs') || ext.endsWith('.iges');
}

// Make functions globally available
window.openStepViewer = openStepViewer;
window.closeStepViewer = closeStepViewer;
window.isStepFile = isStepFile;
window.clearMeasurements = clearMeasurements;
window.setMeasureMode = setMeasureMode;
window.toggleSnapMode = toggleSnapMode;
window.showBoundingBox = showBoundingBox;
