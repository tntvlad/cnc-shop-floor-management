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
                <button onclick="setMeasureMode('diameter')" class="step-menu-item" title="Click on edge of circular feature to measure diameter">
                  ⌀ Diameter
                </button>
                <button onclick="setMeasureMode('radius')" class="step-menu-item" title="Click on edge of circular feature to measure radius">
                  R Radius
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
                <button onclick="toggleMeasurementPanel()" class="step-menu-item" id="measurePanelBtn">
                  📋 Measurement List
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
        <div id="stepMeasurementPanel" class="step-measurement-panel">
          <div class="step-measurement-panel-header">
            <h4>📋 Measurements</h4>
            <button onclick="toggleMeasurementPanel()" class="step-panel-close">✕</button>
          </div>
          <div id="stepMeasurementList" class="step-measurement-list"></div>
          <div class="step-measurement-summary">
            <span>Total: <strong id="measurementCount">0</strong></span>
            <button onclick="exportMeasurements()" class="step-btn-small" title="Export to CSV">💾 Export</button>
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
    
    // Load occt-import-js for STEP/IGES parsing
    if (!window.occtimportjs) {
      updateStatus('Loading 3D parser (first load may take a moment)...');
      await loadScript('https://cdn.jsdelivr.net/npm/occt-import-js@0.0.12/dist/occt-import-js.js');
    }
    
    // Wait for WASM to initialize
    updateStatus('Initializing 3D parser...');
    const occt = await window.occtimportjs();
    
    // Read file
    updateStatus('Reading file...');
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = new Uint8Array(arrayBuffer);
    
    // Determine file type
    const fileName = file.name.toLowerCase();
    const isIges = fileName.endsWith('.igs') || fileName.endsWith('.iges');
    
    // Parse file based on type
    updateStatus(isIges ? 'Parsing IGES file...' : 'Parsing STEP file...');
    const result = isIges ? occt.ReadIgesFile(fileBuffer) : occt.ReadStepFile(fileBuffer);
    
    if (!result.success) {
      throw new Error(`Failed to parse ${isIges ? 'IGES' : 'STEP'} file - file may be corrupted or unsupported format`);
    }
    
    if (!result.meshes || result.meshes.length === 0) {
      throw new Error(`No geometry found in ${isIges ? 'IGES' : 'STEP'} file`);
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
    measureMode: null, // 'distance', 'axis', 'surface', 'diameter', 'radius'
    snapMode: false,
    measurePoints: [],
    measureLines: [],
    measureLabels: [],
    measureObjects: [], // All measurement visualization objects
    raycaster: new THREE.Raycaster(),
    mouse: new THREE.Vector2(),
    snapIndicator: null,
    vertexPositions: [], // For snap-to-vertex
    edgeSegments: [], // For edge detection
    highlightedEdge: null, // Currently highlighted edge
    highlightCircle: null, // Preview circle for diameter/radius
    detectedCircle: null // Stored detected circle data
  };
  
  // Extract all vertices for snap functionality
  extractVertices(group);
  
  // Extract edges for edge detection
  extractEdges(group);
  
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
  
  // Mousemove handler for edge highlighting
  renderer.domElement.addEventListener('mousemove', onViewerMouseMove);
  
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

// Extract edges from geometry for edge detection/highlighting
function extractEdges(group) {
  stepViewerInstance.edgeSegments = [];
  
  group.traverse((child) => {
    if (child.isLineSegments && child.geometry) {
      // This is an edge geometry
      const posAttr = child.geometry.getAttribute('position');
      if (posAttr) {
        for (let i = 0; i < posAttr.count; i += 2) {
          const p1 = new THREE.Vector3(
            posAttr.getX(i),
            posAttr.getY(i),
            posAttr.getZ(i)
          );
          const p2 = new THREE.Vector3(
            posAttr.getX(i + 1),
            posAttr.getY(i + 1),
            posAttr.getZ(i + 1)
          );
          // Transform to world coordinates
          p1.applyMatrix4(child.matrixWorld);
          p2.applyMatrix4(child.matrixWorld);
          
          stepViewerInstance.edgeSegments.push({ p1, p2, mesh: child });
        }
      }
    }
  });
}

// Handle mouse move for edge highlighting
function onViewerMouseMove(event) {
  if (!stepViewerInstance) return;
  
  // Only highlight for diameter/radius modes
  const mode = stepViewerInstance.measureMode;
  if (mode !== 'diameter' && mode !== 'radius') {
    clearEdgeHighlight();
    return;
  }
  
  const rect = stepViewerInstance.renderer.domElement.getBoundingClientRect();
  stepViewerInstance.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  stepViewerInstance.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  
  stepViewerInstance.raycaster.setFromCamera(stepViewerInstance.mouse, stepViewerInstance.camera);
  
  // First, find intersection with model
  const meshChildren = stepViewerInstance.group.children.filter(c => c.type === 'Mesh');
  const intersects = stepViewerInstance.raycaster.intersectObjects(meshChildren, true);
  
  if (intersects.length > 0) {
    const intersection = intersects[0];
    const point = intersection.point.clone();
    
    // Try to detect circle at this point
    const circleData = detectCircularFeature(point, intersection);
    
    if (circleData) {
      // Show preview highlight
      showCirclePreview(circleData);
      stepViewerInstance.detectedCircle = { data: circleData, intersection: intersection };
    } else {
      clearEdgeHighlight();
      stepViewerInstance.detectedCircle = null;
    }
  } else {
    clearEdgeHighlight();
    stepViewerInstance.detectedCircle = null;
  }
}

// Show circle preview highlight
function showCirclePreview(circleData) {
  // Remove previous highlight
  clearEdgeHighlight();
  
  const { center, radius, axis } = circleData;
  const scene = stepViewerInstance.scene;
  
  // Create preview group
  const previewGroup = new THREE.Group();
  previewGroup.name = 'circlePreview';
  
  // Draw circle outline in green
  const circleGeom = new THREE.BufferGeometry();
  const circlePoints = [];
  const segments = 64;
  
  const perp1 = getPerpendicular(axis);
  const perp2 = new THREE.Vector3().crossVectors(axis, perp1).normalize();
  
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const p = center.clone();
    p.add(perp1.clone().multiplyScalar(Math.cos(angle) * radius));
    p.add(perp2.clone().multiplyScalar(Math.sin(angle) * radius));
    circlePoints.push(p);
  }
  
  circleGeom.setFromPoints(circlePoints);
  const circleMat = new THREE.LineBasicMaterial({ 
    color: 0x00ff00, 
    linewidth: 3,
    depthTest: false,
    transparent: true,
    opacity: 0.9
  });
  const circle = new THREE.Line(circleGeom, circleMat);
  circle.renderOrder = 999;
  previewGroup.add(circle);
  
  // Add center point marker
  const modelSize = stepViewerInstance.modelSize;
  const maxDim = Math.max(modelSize.x, modelSize.y, modelSize.z);
  const sphereRadius = maxDim * 0.012;
  
  const centerGeom = new THREE.SphereGeometry(sphereRadius, 16, 16);
  const centerMat = new THREE.MeshBasicMaterial({ 
    color: 0x00ff00,
    depthTest: false,
    transparent: true,
    opacity: 0.9
  });
  const centerMarker = new THREE.Mesh(centerGeom, centerMat);
  centerMarker.position.copy(center);
  centerMarker.renderOrder = 999;
  previewGroup.add(centerMarker);
  
  // Add diameter line preview
  const startPoint = center.clone().add(perp1.clone().multiplyScalar(radius));
  const endPoint = center.clone().add(perp1.clone().multiplyScalar(-radius));
  
  const lineGeom = new THREE.BufferGeometry().setFromPoints([startPoint, endPoint]);
  const lineMat = new THREE.LineBasicMaterial({ 
    color: 0x00ff00, 
    linewidth: 2,
    depthTest: false,
    transparent: true,
    opacity: 0.7
  });
  const diameterLine = new THREE.Line(lineGeom, lineMat);
  diameterLine.renderOrder = 999;
  previewGroup.add(diameterLine);
  
  // Add dimension text preview
  const diameter = radius * 2;
  const textSprite = createTextSprite(`⌀${diameter.toFixed(2)}`, 0x00cc00);
  const textOffset = axis.clone().multiplyScalar(radius * 0.6);
  textSprite.position.copy(center).add(textOffset);
  textSprite.scale.set(radius * 0.7, radius * 0.28, 1);
  textSprite.renderOrder = 1000;
  previewGroup.add(textSprite);
  
  scene.add(previewGroup);
  stepViewerInstance.highlightCircle = previewGroup;
}

// Clear edge highlight
function clearEdgeHighlight() {
  if (stepViewerInstance && stepViewerInstance.highlightCircle) {
    stepViewerInstance.scene.remove(stepViewerInstance.highlightCircle);
    // Dispose geometry and materials
    stepViewerInstance.highlightCircle.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
    stepViewerInstance.highlightCircle = null;
  }
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
    case 'diameter':
      measureDiameterAtPoint(point, intersection);
      break;
    case 'radius':
      measureRadiusAtPoint(point, intersection);
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

// Measure diameter at clicked point by detecting circular features
function measureDiameterAtPoint(point, intersection) {
  // Use pre-detected circle from hover if available
  let circleData = null;
  if (stepViewerInstance.detectedCircle && stepViewerInstance.detectedCircle.data) {
    circleData = stepViewerInstance.detectedCircle.data;
  } else {
    circleData = detectCircularFeature(point, intersection);
  }
  
  // Clear the preview
  clearEdgeHighlight();
  
  if (!circleData) {
    updateMeasureInfo('<div class="measure-error">❌ No circular feature detected. Hover over a hole or cylinder edge until it highlights green, then click.</div>');
    return;
  }
  
  const { center, radius, axis, diameter } = circleData;
  
  // Create visualization
  const group = createDiameterVisualization(center, radius, axis, diameter);
  stepViewerInstance.scene.add(group);
  stepViewerInstance.measureObjects.push(group);
  
  // Add to measurement list
  addMeasurementToList({
    id: Date.now(),
    type: 'diameter',
    value: diameter,
    symbol: '⌀',
    center: center.clone(),
    objects: [group]
  });
  
  updateMeasureInfo(`
    <div class="measure-results">
      <div class="measure-total">⌀ <strong>Diameter: ${diameter.toFixed(3)} mm</strong></div>
      <div class="measure-detail">Radius: ${radius.toFixed(3)} mm</div>
      <div class="measure-coords">Center: (${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)})</div>
    </div>
  `);
}

// Measure radius at clicked point
function measureRadiusAtPoint(point, intersection) {
  // Use pre-detected circle from hover if available
  let circleData = null;
  if (stepViewerInstance.detectedCircle && stepViewerInstance.detectedCircle.data) {
    circleData = stepViewerInstance.detectedCircle.data;
  } else {
    circleData = detectCircularFeature(point, intersection);
  }
  
  // Clear the preview
  clearEdgeHighlight();
  
  if (!circleData) {
    updateMeasureInfo('<div class="measure-error">❌ No circular feature detected. Hover over a hole or cylinder edge until it highlights green, then click.</div>');
    return;
  }
  
  const { center, radius, axis, diameter } = circleData;
  
  // Create visualization
  const group = createRadiusVisualization(center, radius, axis, point);
  stepViewerInstance.scene.add(group);
  stepViewerInstance.measureObjects.push(group);
  
  // Add to measurement list
  addMeasurementToList({
    id: Date.now(),
    type: 'radius',
    value: radius,
    symbol: 'R',
    center: center.clone(),
    objects: [group]
  });
  
  updateMeasureInfo(`
    <div class="measure-results">
      <div class="measure-total">R <strong>Radius: ${radius.toFixed(3)} mm</strong></div>
      <div class="measure-detail">Diameter: ${diameter.toFixed(3)} mm</div>
      <div class="measure-coords">Center: (${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)})</div>
    </div>
  `);
}

// Detect circular feature from clicked point
function detectCircularFeature(clickPoint, intersection) {
  const mesh = intersection.object;
  const geometry = mesh.geometry;
  const positionAttr = geometry.getAttribute('position');
  const normalAttr = geometry.getAttribute('normal');
  const face = intersection.face;
  
  if (!positionAttr) return null;
  
  // Get the face normal at click point - this tells us the surface orientation
  const faceNormal = face ? face.normal.clone().transformDirection(mesh.matrixWorld) : null;
  
  // Get model scale for adaptive search
  const box = new THREE.Box3().setFromObject(stepViewerInstance.group);
  const modelSize = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(modelSize.x, modelSize.y, modelSize.z);
  
  // Try multiple detection methods
  let result = null;
  
  // Method 1: Use face normal to detect cylindrical surface
  if (faceNormal) {
    result = detectCylinderFromNormal(clickPoint, mesh, faceNormal, maxDim);
    if (result) return result;
  }
  
  // Method 2: Sample points in rings around click point
  result = detectCircleByRingSampling(clickPoint, mesh, maxDim);
  if (result) return result;
  
  // Method 3: Fallback - collect nearby vertices and try circle fit
  result = detectCircleFromNearbyVertices(clickPoint, mesh, maxDim);
  
  return result;
}

// Detect cylinder by analyzing points along the face normal direction
function detectCylinderFromNormal(clickPoint, mesh, faceNormal, maxDim) {
  const geometry = mesh.geometry;
  const positionAttr = geometry.getAttribute('position');
  
  // For a cylindrical surface, the face normal points radially outward
  // The cylinder axis is perpendicular to the radial direction
  // Sample points on the surface near the click point
  
  const searchRadius = maxDim * 0.3;
  const inverseMatrix = new THREE.Matrix4().copy(mesh.matrixWorld).invert();
  const localClickPoint = clickPoint.clone().applyMatrix4(inverseMatrix);
  
  // Collect nearby vertices
  const nearbyVertices = [];
  for (let i = 0; i < positionAttr.count; i++) {
    const vertex = new THREE.Vector3(
      positionAttr.getX(i),
      positionAttr.getY(i),
      positionAttr.getZ(i)
    );
    
    const dist = vertex.distanceTo(localClickPoint);
    if (dist < searchRadius) {
      const worldVertex = vertex.clone().applyMatrix4(mesh.matrixWorld);
      nearbyVertices.push(worldVertex);
    }
  }
  
  if (nearbyVertices.length < 10) return null;
  
  // Try each major axis as potential cylinder axis
  const axes = [
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 0, 1)
  ];
  
  let bestResult = null;
  let bestScore = Infinity;
  
  for (const axis of axes) {
    // Skip if axis is too parallel to face normal (would be end cap, not cylinder wall)
    const axisDotNormal = Math.abs(axis.dot(faceNormal));
    if (axisDotNormal > 0.8) continue;
    
    const result = fitCircleOnAxis(nearbyVertices, axis, clickPoint);
    if (result && result.variance < bestScore) {
      bestScore = result.variance;
      bestResult = result;
    }
  }
  
  // Accept if variance is reasonable
  if (bestResult && bestResult.variance < bestResult.radius * 0.15) {
    return bestResult;
  }
  
  return null;
}

// Fit a circle to vertices projected onto a plane perpendicular to given axis
function fitCircleOnAxis(vertices, axis, clickPoint) {
  if (vertices.length < 8) return null;
  
  // Project all vertices onto the plane perpendicular to axis
  const projected2D = vertices.map(v => {
    const d = v.clone();
    // Remove the component along axis
    const alongAxis = axis.clone().multiplyScalar(v.dot(axis));
    return d.sub(alongAxis);
  });
  
  // Find centroid of projected points
  const centroid = new THREE.Vector3();
  projected2D.forEach(p => centroid.add(p));
  centroid.divideScalar(projected2D.length);
  
  // Calculate distances from centroid (radii)
  const radii = projected2D.map(p => p.distanceTo(centroid));
  
  // Group radii into clusters to find the dominant radius
  radii.sort((a, b) => a - b);
  
  // Use median radius (more robust than mean)
  const medianRadius = radii[Math.floor(radii.length / 2)];
  
  // Filter points that are close to the median radius (within 20%)
  const tolerance = medianRadius * 0.25;
  const filteredIndices = [];
  radii.forEach((r, i) => {
    if (Math.abs(r - medianRadius) < tolerance) {
      filteredIndices.push(i);
    }
  });
  
  if (filteredIndices.length < 6) return null;
  
  // Recalculate with filtered points
  const filteredVertices = filteredIndices.map(i => vertices[i]);
  const filteredProjected = filteredIndices.map(i => projected2D[i]);
  
  // Recalculate centroid
  const newCentroid = new THREE.Vector3();
  filteredProjected.forEach(p => newCentroid.add(p));
  newCentroid.divideScalar(filteredProjected.length);
  
  // Get the axis-aligned component of the center (average z along axis)
  let axisComponent = 0;
  filteredVertices.forEach(v => {
    axisComponent += v.dot(axis);
  });
  axisComponent /= filteredVertices.length;
  
  // Full 3D center
  const center = newCentroid.clone().add(axis.clone().multiplyScalar(axisComponent));
  
  // Calculate final radius and variance
  const finalRadii = filteredProjected.map(p => p.distanceTo(newCentroid));
  const avgRadius = finalRadii.reduce((a, b) => a + b, 0) / finalRadii.length;
  
  let variance = 0;
  finalRadii.forEach(r => {
    variance += Math.pow(r - avgRadius, 2);
  });
  variance = Math.sqrt(variance / finalRadii.length);
  
  return {
    center: center,
    radius: avgRadius,
    diameter: avgRadius * 2,
    axis: axis.clone(),
    variance: variance,
    confidence: 1 - (variance / avgRadius)
  };
}

// Detect circle by sampling points in rings around click point
function detectCircleByRingSampling(clickPoint, mesh, maxDim) {
  // Cast rays in a circle pattern around the click point to find edge
  const raycaster = new THREE.Raycaster();
  const camera = stepViewerInstance.camera;
  
  // Get view direction
  const viewDir = new THREE.Vector3();
  camera.getWorldDirection(viewDir);
  
  // Create perpendicular directions in screen space
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  
  // Sample points in rings
  const samples = [];
  const numRays = 24;
  
  for (let ring = 1; ring <= 5; ring++) {
    const ringRadius = maxDim * 0.02 * ring;
    
    for (let i = 0; i < numRays; i++) {
      const angle = (i / numRays) * Math.PI * 2;
      const offset = right.clone().multiplyScalar(Math.cos(angle) * ringRadius)
        .add(up.clone().multiplyScalar(Math.sin(angle) * ringRadius));
      
      const rayOrigin = clickPoint.clone().add(offset).sub(viewDir.clone().multiplyScalar(maxDim));
      raycaster.set(rayOrigin, viewDir);
      
      const intersects = raycaster.intersectObject(mesh, false);
      if (intersects.length > 0) {
        samples.push(intersects[0].point.clone());
      }
    }
  }
  
  if (samples.length < 20) return null;
  
  // Try to fit circle to samples
  return detectCircleFromVerticesImproved(samples, maxDim);
}

// Improved circle detection from vertices
function detectCircleFromVerticesImproved(vertices, maxDim) {
  if (vertices.length < 8) return null;
  
  // Try each major axis
  const axes = [
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 0, 1)
  ];
  
  let bestResult = null;
  let bestVariance = Infinity;
  
  for (const axis of axes) {
    const result = fitCircleOnAxis(vertices, axis, vertices[0]);
    if (result && result.variance < bestVariance) {
      bestVariance = result.variance;
      bestResult = result;
    }
  }
  
  // Accept if variance is reasonable (within 20% of radius)
  if (bestResult && bestResult.variance < bestResult.radius * 0.2) {
    return bestResult;
  }
  
  return null;
}

// Fallback: collect nearby vertices and try circle fit
function detectCircleFromNearbyVertices(clickPoint, mesh, maxDim) {
  const geometry = mesh.geometry;
  const positionAttr = geometry.getAttribute('position');
  
  const searchRadius = maxDim * 0.25;
  const inverseMatrix = new THREE.Matrix4().copy(mesh.matrixWorld).invert();
  const localClickPoint = clickPoint.clone().applyMatrix4(inverseMatrix);
  
  const nearbyVertices = [];
  for (let i = 0; i < positionAttr.count; i++) {
    const vertex = new THREE.Vector3(
      positionAttr.getX(i),
      positionAttr.getY(i),
      positionAttr.getZ(i)
    );
    
    if (vertex.distanceTo(localClickPoint) < searchRadius) {
      const worldVertex = vertex.clone().applyMatrix4(mesh.matrixWorld);
      nearbyVertices.push(worldVertex);
    }
  }
  
  if (nearbyVertices.length < 10) return null;
  
  return detectCircleFromVerticesImproved(nearbyVertices, maxDim);
}

// Detect circle from a set of vertices (legacy - kept for compatibility)
function detectCircleFromVertices(clickPoint, vertices, searchRadius) {
  if (vertices.length < 6) return null;
  
  // Calculate centroid
  const centroid = new THREE.Vector3();
  vertices.forEach(v => centroid.add(v));
  centroid.divideScalar(vertices.length);
  
  // Estimate the plane normal using PCA-like approach
  // Calculate covariance matrix and find principal axis
  let cov = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0]
  ];
  
  vertices.forEach(v => {
    const d = v.clone().sub(centroid);
    cov[0][0] += d.x * d.x;
    cov[0][1] += d.x * d.y;
    cov[0][2] += d.x * d.z;
    cov[1][0] += d.y * d.x;
    cov[1][1] += d.y * d.y;
    cov[1][2] += d.y * d.z;
    cov[2][0] += d.z * d.x;
    cov[2][1] += d.z * d.y;
    cov[2][2] += d.z * d.z;
  });
  
  // Find axis with minimum variance (normal to the plane)
  const varX = cov[0][0];
  const varY = cov[1][1];
  const varZ = cov[2][2];
  
  let axis;
  if (varX <= varY && varX <= varZ) {
    axis = new THREE.Vector3(1, 0, 0);
  } else if (varY <= varX && varY <= varZ) {
    axis = new THREE.Vector3(0, 1, 0);
  } else {
    axis = new THREE.Vector3(0, 0, 1);
  }
  
  // Project vertices onto the plane perpendicular to axis
  // and fit a circle
  const projectedVertices = vertices.map(v => {
    const d = v.clone().sub(centroid);
    const proj = d.clone().sub(axis.clone().multiplyScalar(d.dot(axis)));
    return proj.add(centroid);
  });
  
  // Calculate center by averaging projected vertices
  const center = new THREE.Vector3();
  projectedVertices.forEach(v => center.add(v));
  center.divideScalar(projectedVertices.length);
  
  // Calculate average radius
  let totalRadius = 0;
  let radiusVariance = 0;
  const radii = projectedVertices.map(v => {
    const r = v.distanceTo(center);
    totalRadius += r;
    return r;
  });
  const avgRadius = totalRadius / projectedVertices.length;
  
  // Check variance to validate circle fit
  radii.forEach(r => {
    radiusVariance += Math.pow(r - avgRadius, 2);
  });
  radiusVariance = Math.sqrt(radiusVariance / radii.length);
  
  // If variance is too high, this isn't a circle
  const varianceThreshold = avgRadius * 0.3;
  if (radiusVariance > varianceThreshold || avgRadius < 0.1) {
    return null;
  }
  
  return {
    center: center,
    radius: avgRadius,
    diameter: avgRadius * 2,
    axis: axis,
    confidence: 1 - (radiusVariance / avgRadius)
  };
}

// Create diameter visualization
function createDiameterVisualization(center, radius, axis, diameter) {
  const group = new THREE.Group();
  
  // Get perpendicular direction
  const perpendicular = getPerpendicular(axis);
  
  // Calculate line endpoints
  const startPoint = center.clone().add(perpendicular.clone().multiplyScalar(radius));
  const endPoint = center.clone().add(perpendicular.clone().multiplyScalar(-radius));
  
  // Main diameter line
  const lineGeom = new THREE.BufferGeometry().setFromPoints([startPoint, endPoint]);
  const lineMat = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 2 });
  const line = new THREE.Line(lineGeom, lineMat);
  group.add(line);
  
  // Center point marker
  const modelSize = stepViewerInstance.modelSize;
  const maxDim = Math.max(modelSize.x, modelSize.y, modelSize.z);
  const sphereRadius = maxDim * 0.008;
  
  const centerGeom = new THREE.SphereGeometry(sphereRadius, 16, 16);
  const centerMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  const centerMarker = new THREE.Mesh(centerGeom, centerMat);
  centerMarker.position.copy(center);
  group.add(centerMarker);
  
  // Endpoint markers
  const endGeom = new THREE.SphereGeometry(sphereRadius * 0.7, 12, 12);
  const startMarker = new THREE.Mesh(endGeom, centerMat);
  startMarker.position.copy(startPoint);
  group.add(startMarker);
  
  const endMarker = new THREE.Mesh(endGeom.clone(), centerMat);
  endMarker.position.copy(endPoint);
  group.add(endMarker);
  
  // Add dimension text sprite
  const textSprite = createTextSprite(`⌀${diameter.toFixed(2)}`, 0xff0000);
  const textOffset = axis.clone().multiplyScalar(radius * 0.5);
  textSprite.position.copy(center).add(textOffset);
  textSprite.scale.set(radius * 0.8, radius * 0.3, 1);
  group.add(textSprite);
  
  // Draw circle outline for visibility
  const circleGeom = new THREE.BufferGeometry();
  const circlePoints = [];
  const segments = 48;
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const p = center.clone();
    const perp1 = getPerpendicular(axis);
    const perp2 = new THREE.Vector3().crossVectors(axis, perp1).normalize();
    p.add(perp1.clone().multiplyScalar(Math.cos(angle) * radius));
    p.add(perp2.clone().multiplyScalar(Math.sin(angle) * radius));
    circlePoints.push(p);
  }
  circleGeom.setFromPoints(circlePoints);
  const circleMat = new THREE.LineBasicMaterial({ color: 0xff4444, linewidth: 1, transparent: true, opacity: 0.7 });
  const circle = new THREE.Line(circleGeom, circleMat);
  group.add(circle);
  
  return group;
}

// Create radius visualization
function createRadiusVisualization(center, radius, axis, clickPoint) {
  const group = new THREE.Group();
  
  // Direction from center to click point
  const direction = clickPoint.clone().sub(center);
  direction.sub(axis.clone().multiplyScalar(direction.dot(axis))); // Project onto plane
  direction.normalize();
  
  // Calculate endpoint
  const endPoint = center.clone().add(direction.clone().multiplyScalar(radius));
  
  // Main radius line
  const lineGeom = new THREE.BufferGeometry().setFromPoints([center, endPoint]);
  const lineMat = new THREE.LineBasicMaterial({ color: 0x00cc00, linewidth: 2 });
  const line = new THREE.Line(lineGeom, lineMat);
  group.add(line);
  
  // Center point marker
  const modelSize = stepViewerInstance.modelSize;
  const maxDim = Math.max(modelSize.x, modelSize.y, modelSize.z);
  const sphereRadius = maxDim * 0.008;
  
  const centerGeom = new THREE.SphereGeometry(sphereRadius, 16, 16);
  const centerMat = new THREE.MeshBasicMaterial({ color: 0x00cc00 });
  const centerMarker = new THREE.Mesh(centerGeom, centerMat);
  centerMarker.position.copy(center);
  group.add(centerMarker);
  
  // Endpoint marker
  const endGeom = new THREE.SphereGeometry(sphereRadius * 0.7, 12, 12);
  const endMarker = new THREE.Mesh(endGeom, centerMat);
  endMarker.position.copy(endPoint);
  group.add(endMarker);
  
  // Add dimension text sprite
  const textSprite = createTextSprite(`R${radius.toFixed(2)}`, 0x00cc00);
  const midPoint = center.clone().add(endPoint).divideScalar(2);
  const textOffset = axis.clone().multiplyScalar(radius * 0.3);
  textSprite.position.copy(midPoint).add(textOffset);
  textSprite.scale.set(radius * 0.6, radius * 0.25, 1);
  group.add(textSprite);
  
  return group;
}

// Get a vector perpendicular to the input
function getPerpendicular(vector) {
  if (Math.abs(vector.x) < 0.9) {
    return new THREE.Vector3(1, 0, 0).cross(vector).normalize();
  } else {
    return new THREE.Vector3(0, 1, 0).cross(vector).normalize();
  }
}

// Create text sprite for dimension labels
function createTextSprite(text, color) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = 256;
  canvas.height = 96;
  
  // Background
  context.fillStyle = 'rgba(255, 255, 255, 0.9)';
  context.fillRect(0, 0, canvas.width, canvas.height);
  
  // Border
  context.strokeStyle = '#' + color.toString(16).padStart(6, '0');
  context.lineWidth = 4;
  context.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
  
  // Text
  context.fillStyle = '#' + color.toString(16).padStart(6, '0');
  context.font = 'bold 36px Arial';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, canvas.width / 2, canvas.height / 2);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  
  const spriteMaterial = new THREE.SpriteMaterial({ 
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false
  });
  
  return new THREE.Sprite(spriteMaterial);
}

// Measurement list management
let measurementList = [];

function addMeasurementToList(measurement) {
  measurementList.push(measurement);
  updateMeasurementListUI();
}

function removeMeasurementFromList(id) {
  const index = measurementList.findIndex(m => m.id === id);
  if (index >= 0) {
    const measurement = measurementList[index];
    // Remove 3D objects
    measurement.objects.forEach(obj => {
      stepViewerInstance.scene.remove(obj);
      if (obj.traverse) {
        obj.traverse(child => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
      }
    });
    measurementList.splice(index, 1);
    updateMeasurementListUI();
  }
}

function updateMeasurementListUI() {
  const listEl = document.getElementById('stepMeasurementList');
  const countEl = document.getElementById('measurementCount');
  
  if (!listEl) return;
  
  countEl.textContent = measurementList.length;
  
  if (measurementList.length === 0) {
    listEl.innerHTML = '<div class="step-measurement-empty">No measurements yet</div>';
    return;
  }
  
  listEl.innerHTML = measurementList.map(m => `
    <div class="step-measurement-item" data-id="${m.id}">
      <div class="step-measurement-value">
        <span class="step-measurement-symbol">${m.symbol}</span>
        <span class="step-measurement-num">${m.value.toFixed(3)} mm</span>
      </div>
      <div class="step-measurement-type">${m.type}</div>
      <button onclick="removeMeasurementFromList(${m.id})" class="step-measurement-delete" title="Delete">🗑</button>
    </div>
  `).join('');
}

function toggleMeasurementPanel() {
  const panel = document.getElementById('stepMeasurementPanel');
  panel.classList.toggle('active');
  document.getElementById('stepMeasureMenu').classList.remove('active');
}

function exportMeasurements() {
  if (measurementList.length === 0) {
    alert('No measurements to export');
    return;
  }
  
  const headers = ['Type', 'Symbol', 'Value (mm)', 'Timestamp'];
  const rows = measurementList.map(m => [
    m.type,
    m.symbol,
    m.value.toFixed(4),
    new Date(m.id).toISOString()
  ]);
  
  const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'measurements.csv';
  link.click();
  URL.revokeObjectURL(url);
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
    'surface': '🎯 Surface Mode',
    'diameter': '⌀ Diameter Mode',
    'radius': 'R Radius Mode'
  };
  
  modeDisplay.textContent = modeLabels[mode] || '';
  
  const hints = {
    'distance': 'Click two points to measure distance with X/Y/Z breakdown',
    'axis': 'Click two points to see axis-aligned dimensions only',
    'surface': 'Click a surface to see point coordinates and normal',
    'diameter': 'Click on the edge of a circular feature (hole, cylinder) to measure diameter',
    'radius': 'Click on the edge of a circular feature to measure radius'
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
  
  // Clear edge highlight
  clearEdgeHighlight();
  stepViewerInstance.detectedCircle = null;
  
  // Remove all measurement objects
  stepViewerInstance.measureObjects.forEach(obj => {
    stepViewerInstance.scene.remove(obj);
    if (obj.traverse) {
      obj.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    } else {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    }
  });
  stepViewerInstance.measureObjects = [];
  stepViewerInstance.measurePoints = [];
  stepViewerInstance.measureLines = [];
  
  // Clear measurement list
  measurementList = [];
  updateMeasurementListUI();
  
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
window.toggleMeasurementPanel = toggleMeasurementPanel;
window.removeMeasurementFromList = removeMeasurementFromList;
window.exportMeasurements = exportMeasurements;
