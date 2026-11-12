import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

// Approved flat pieces were modeled lying on their broad faces. The
// explicit rotations stand their handles/long axes upright without changing
// any GLB geometry. All other pieces retain their approved orientation.
const FLOATING_POSES = {
  "SAW": [["y", -55], ["z", 90], ["y", 105]],
  "PP-01": [],
  "PP-02": [],
  "PP-04": [],
  "PP-05": [],
  "PP-06": [],
  "PP-07": [],
  "PP-11": [["y", -55], ["x", 90], ["y", 15]],
  "PP-14": [["y", -55], ["x", 90], ["y", 15]],
  "PP-16": [["y", -55], ["x", 90], ["y", 15]],
  "PP-23": [["y", -55], ["z", 90], ["y", 105]],
  "PP-24": [["y", -55], ["z", 90], ["y", 105]],
  "PP-25": [["y", -55], ["x", 90], ["y", 15]],
  "PP-27": [["y", -55], ["x", 90], ["y", 15]],
  "PP-28": [["y", -55], ["z", 90], ["y", 105]],
  "PP-29": [],
  "PP-32": [["y", -55], ["z", 90], ["y", 105]],
  "PP-33": [["y", -55], ["x", 90], ["y", 15]],
  "EAR-20A": [],
  "EAR-20C": [],
  "EAR-20E": [],
  "EAR-20G": [],
  "EAR-20H": [],
  "EAR-20I": [],
  "EAR-20J": [],
  "PP-07XL": [["y", -55], ["x", 90], ["y", 15]],
  "LEGACY-COLLAR": [],
  "LEGACY-POSTURE-SPIKE": [],
  "LEGACY-POSTURE-FLAME": [],
  "LEGACY-TENDERIZER": [["y", -55], ["x", 90], ["y", 15]],
  "LEGACY-PALM-STAR": [],
  "LEGACY-PALM-HEART": [],
  "REVIEW-ROLLING-PIN": [["y", -55], ["z", 90], ["y", 105]],
  "REVIEW-RAM-HORNS": [],
  "REVIEW-CLAMP-ONE": [],
  "REVIEW-ROLLER-PRESS": [],
  "REVIEW-CAP-BOTTOM": [["y", -55], ["x", 90], ["y", 15]],
  "REVIEW-CAP-BOTH": [["y", -55], ["x", 90], ["y", 15]],
  "REVIEW-HAMMER": [["y", -55], ["x", 90], ["y", 15]],
};

const DESIGN_IDS = {
  "rope-saw": "SAW",
  "talon": "PP-01",
  "orbit": "PP-02",
  "trio": "PP-04",
  "scallop": "PP-05",
  "bramble": "PP-06",
  "little-c": "PP-07",
  "twist-grip-cups": "PP-11",
  "spiked-heel-discs": "PP-14",
  "spiked-foot-soles": "PP-16",
  "raised-grain-tile": "PP-23",
  "spiked-scalp-dome": "PP-24",
  "crank": "PP-25",
  "block-party": "PP-27",
  "double-ended-spike-fork": "PP-28",
  "palm-mounted-spike-roller": "PP-29",
  "alligator": "PP-32",
  "crescent": "PP-33",
  "tall-sweep": "EAR-20A",
  "short-spike-headband": "EAR-20C",
  "five-spike-crown-headband": "EAR-20E",
  "bunny-sweep": "EAR-20G",
  "tall-spike-headband": "EAR-20H",
  "puppy-fold": "EAR-20I",
  "lop-ear-headband": "EAR-20J",
  "large-spiked-screw-clamp": "PP-07XL",
  "flame-collar": "LEGACY-COLLAR",
  "spike-posture-collar": "LEGACY-POSTURE-SPIKE",
  "flame-posture-collar": "LEGACY-POSTURE-FLAME",
  "tenderizer": "LEGACY-TENDERIZER",
  "palm-star": "LEGACY-PALM-STAR",
  "palm-heart": "LEGACY-PALM-HEART",
  "two-handed-spike-roller": "REVIEW-ROLLING-PIN",
  "ram-horn-headband": "REVIEW-RAM-HORNS",
  "single-spike-screw-clamp": "REVIEW-CLAMP-ONE",
  "spring-loaded-roller-press": "REVIEW-ROLLER-PRESS",
  "single-sided-spike-cap": "REVIEW-CAP-BOTTOM",
  "double-sided-spike-cap": "REVIEW-CAP-BOTH",
  "claw-hammer": "REVIEW-HAMMER"
};

export function getDesignId(product) {
  return product.designId || product.sourceId || DESIGN_IDS[product.id] || product.id;
}

// Percentages align one shared shadow with both the poster and live model.
const SHADOW_LAYOUTS = {
  "SAW": [26, 94, 4.5],
  "PP-01": [58, 86.2, 7.5],
  "PP-02": [58, 89.3, 7.5],
  "PP-04": [58, 84, 7.5],
  "PP-05": [50.5, 92.5, 6.6],
  "PP-06": [47.5, 89.7, 6.2],
  "PP-07": [29.7, 94, 4.5],
  "PP-11": [58, 83, 7.5],
  "PP-14": [58, 83, 7.5],
  "PP-16": [48.9, 87, 6.4],
  "PP-23": [37.7, 90.9, 4.9],
  "PP-24": [42.3, 84.8, 5.5],
  "PP-25": [27.2, 91.8, 4.5],
  "PP-27": [31.7, 91.7, 4.5],
  "PP-28": [26, 93.8, 4.5],
  "PP-29": [58, 92.3, 7.5],
  "PP-32": [28.8, 92, 4.5],
  "PP-33": [44.1, 87.6, 5.7],
  "EAR-20A": [50.2, 94, 6.5],
  "EAR-20C": [58, 94, 7.5],
  "EAR-20E": [52.1, 94, 6.8],
  "EAR-20G": [42, 94, 5.5],
  "EAR-20H": [58, 91, 7.5],
  "EAR-20I": [58, 84.5, 7.5],
  "EAR-20J": [47.9, 90, 6.2],
  "PP-07XL": [29.8, 93, 4.5],
  "LEGACY-COLLAR": [58, 86.9, 7.5],
  "LEGACY-POSTURE-SPIKE": [26, 94, 4.5],
  "LEGACY-POSTURE-FLAME": [26, 94, 4.5],
  "LEGACY-TENDERIZER": [26, 94, 4.5],
  "LEGACY-PALM-STAR": [56.1, 91.3, 7.3],
  "LEGACY-PALM-HEART": [56.5, 91.2, 7.3],
  "REVIEW-ROLLING-PIN": [26, 94, 4.5],
  "REVIEW-RAM-HORNS": [57.2, 94, 7.4],
  "REVIEW-CLAMP-ONE": [29.7, 94, 4.5],
  "REVIEW-ROLLER-PRESS": [47.6, 94, 6.2],
  "REVIEW-CAP-BOTTOM": [47.9, 89.4, 6.2],
  "REVIEW-CAP-BOTH": [45.4, 87.9, 5.9],
  "REVIEW-HAMMER": [32, 91.5, 4.5],
};

export function createGalleryCamera() {
  const camera = new THREE.OrthographicCamera(-2.05, 2.05, 2.05, -2.05, .01, 100);
  camera.position.set(0, 3.5, 8);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  return camera;
}

// This pure presentation contract is also used to generate matching posters.
// Coordinates and measured Palm axes refer to the untouched GLB, in Y-up units.
export function getTurntablePresentation(model, product, camera) {
  model.updateMatrixWorld(true);
  const orientation = new THREE.Matrix4();
  for (const [axis, degrees] of FLOATING_POSES[getDesignId(product)] || []) {
    const vector = new THREE.Vector3(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0);
    orientation.premultiply(new THREE.Matrix4().makeRotationAxis(vector, THREE.MathUtils.degToRad(degrees)));
  }
  const bounds = new THREE.Box3();
  const point = new THREE.Vector3();
  const matrices = [];
  model.traverse(object => {
    if (!object.isMesh) return;
    const positions = object.geometry.getAttribute('position');
    const matrix = new THREE.Matrix4().multiplyMatrices(orientation, object.matrixWorld);
    matrices.push({ positions, matrix });
    for (let index = 0; index < positions.count; index++) {
      point.fromBufferAttribute(positions, index).applyMatrix4(matrix);
      bounds.expandByPoint(point);
    }
  });
  const center = bounds.getCenter(new THREE.Vector3());
  const height = bounds.max.y - bounds.min.y;
  const axis = center.clone();
  const measured = product.rotationPivot;
  if (Array.isArray(measured) && measured.length === 2 && measured.every(Number.isFinite)) {
    const stem = new THREE.Vector3(measured[0], 0, measured[1]).applyMatrix4(orientation);
    axis.x = stem.x;
    axis.z = stem.z;
  }
  let radius = 0;
  for (const { positions, matrix } of matrices) {
    for (let index = 0; index < positions.count; index++) {
      point.fromBufferAttribute(positions, index).applyMatrix4(matrix);
      radius = Math.max(radius, Math.hypot(point.x - axis.x, point.z - axis.z));
    }
  }
  let scale = Math.min(3.3 / Math.max(height, .000001), 3.4 / Math.max(2 * radius, .000001));
  // Fit the entire continuously swept cylinder, rather than a few sample
  // angles. The fixed camera leaves clearance throughout pointer movement.
  camera.updateMatrixWorld(true);
  const projection = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  const frustum = new THREE.Frustum().setFromProjectionMatrix(projection);
  for (const plane of frustum.planes) {
    const n = plane.normal;
    const extent = Math.abs(n.y) * height / 2 + radius * Math.hypot(n.x, n.z);
    if (extent > 0) scale = Math.min(scale, plane.constant * .85 / extent);
  }
  return {
    scale,
    offset: axis.clone().negate(),
    position: new THREE.Vector3(),
    orientation: new THREE.Quaternion().setFromRotationMatrix(orientation),
    orientationMatrix: orientation,
    sweptRadius: radius,
    axis,
    height,
  };
}

// One WebGL renderer serves every card. Each card receives a 2D copy of its
// rendered scene, so the gallery never creates a WebGL context for every card.
export function createGallery3D({ reduceMotion }) {
  const views = new Set();
  const queue = [];
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  let renderer;
  let environment;
  let contextLost = false;
  let activeLoads = 0;
  let previousTime = 0;
  let lastFrame = 0;

  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = .95;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    environment = pmrem.fromScene(room, .04).texture;
    room.dispose();
    pmrem.dispose();
    renderer.domElement.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      contextLost = true;
      views.forEach(view => fallback(view, 'Image preview. Restoring 3D…'));
    });
    renderer.domElement.addEventListener('webglcontextrestored', () => {
      contextLost = false;
      views.forEach(view => { view.dirty = true; });
    });
  } catch {
    renderer = null;
  }

  function fallback(view, message = 'Image preview. 3D is unavailable.') {
    view.stage.classList.remove('is-live');
    view.status.textContent = message;
    view.stage.setAttribute('role', 'img');
    view.stage.setAttribute('aria-label', `${view.product.title}, image preview`);
    view.stage.setAttribute('aria-describedby', view.status.id);
    view.stage.tabIndex = -1;
    ['aria-valuemin', 'aria-valuemax', 'aria-valuenow', 'aria-valuetext', 'aria-orientation'].forEach(attribute => view.stage.removeAttribute(attribute));
  }

  function exposeSlider(view) {
    view.stage.setAttribute('role', 'slider');
    view.stage.setAttribute('aria-label', `Turn ${view.product.title}`);
    view.stage.setAttribute('aria-valuemin', '-180');
    view.stage.setAttribute('aria-valuemax', '180');
    view.stage.setAttribute('aria-orientation', 'horizontal');
    view.stage.setAttribute('aria-describedby', `viewer-help viewer-keyboard-help ${view.status.id}`);
    view.stage.tabIndex = 0;
    updateSliderValue(view);
  }

  function updateSliderValue(view) {
    let degrees = Math.round(THREE.MathUtils.radToDeg(view.angle)) % 360;
    if (degrees > 180) degrees -= 360;
    if (degrees < -180) degrees += 360;
    view.stage.setAttribute('aria-valuenow', String(degrees));
    view.stage.setAttribute('aria-valuetext', `${degrees} degrees`);
  }

  function disposeScene(scene) {
    const resources = new Set();
    scene?.traverse(object => {
      if (object.geometry) resources.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (!material) continue;
        resources.add(material);
        for (const value of Object.values(material)) if (value?.isTexture && value !== environment) resources.add(value);
      }
      object.shadow?.dispose();
    });
    resources.forEach(resource => {
      if (resource.isTexture) resource.image?.close?.();
      resource.dispose();
    });
  }

  function unload(view) {
    disposeScene(view.scene);
    view.scene = null;
    view.root = null;
    view.ready = false;
    fallback(view, 'Interactive 3D');
  }

  function prune() {
    const resident = [...views].filter(view => view.ready);
    const candidates = resident.filter(view => !view.near).sort((a, b) => a.lastUsed - b.lastUsed);
    while (resident.length > 6 && candidates.length) {
      const view = candidates.shift();
      unload(view);
      resident.splice(resident.indexOf(view), 1);
    }
  }

  function buildScene(view, model) {
    const scene = new THREE.Scene();
    scene.environment = environment;
    scene.environmentIntensity = .45;
    const root = new THREE.Group();
    scene.add(root);
    model.traverse(object => {
      if (!object.isMesh) return;
      object.castShadow = false;
      object.receiveShadow = false;
    });
    const camera = createGalleryCamera();
    const presentation = getTurntablePresentation(model, view.product, camera);
    const scale = presentation.scale;
    const posed = new THREE.Group();
    posed.quaternion.copy(presentation.orientation);
    posed.position.copy(presentation.offset);
    posed.add(model);
    root.add(posed);
    root.position.copy(presentation.position);
    root.scale.setScalar(scale);
    const key = new THREE.DirectionalLight(0xfff8ef, 1.6);
    key.position.set(-3, 10, 4.5);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xedf4ff, .55);
    fill.position.set(4, 2.5, 4);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, .7);
    rim.position.set(2, 6, -5);
    scene.add(rim, new THREE.HemisphereLight(0xfff9f0, 0xe0d5c4, .45));
    Object.assign(view, { scene, root, camera, baseScale: scale, ready: true, dirty: true });
    view.lastUsed = performance.now();
    applyPose(view);
  }

  async function pump() {
    while (renderer && !contextLost && activeLoads < 2 && queue.length) {
      const view = queue.shift();
      view.queued = false;
      if (view.disposed || !view.near || view.ready || view.loading) continue;
      activeLoads++;
      view.loading = true;
      view.status.textContent = 'Loading 3D…';
      loader.loadAsync(view.product.model).then(gltf => {
        if (view.disposed) { disposeScene(gltf.scene); return; }
        buildScene(view, gltf.scene);
        view.failed = false;
        prune();
      }).catch(() => {
        if (!view.disposed) {
          view.failed = true;
          fallback(view, 'Image preview. Select Retry 3D.');
          view.retry.hidden = false;
        }
      }).finally(() => {
        view.loading = false;
        activeLoads--;
        pump();
      });
    }
  }

  function requestLoad(view) {
    if (!renderer || contextLost || view.ready || view.loading || view.queued || view.disposed) return;
    if (!view.platePromise) {
      view.plate.loading = 'eager';
      view.platePromise = view.plate.decode().then(() => { view.plateReady = true; view.dirty = true; }).catch(() => {
        view.plateReady = false;
        fallback(view, 'Image preview. Scene background unavailable.');
      });
    }
    view.queued = true;
    queue.push(view);
    pump();
  }

  function applyPose(view) {
    if (!view.root) return;
    view.root.rotation.y = view.angle;
    view.root.scale.setScalar(view.baseScale);
    view.dirty = true;
    view.stage.dataset.rotation = String(Math.round(THREE.MathUtils.radToDeg(view.angle)));
    if (view.stage.getAttribute('role') === 'slider') updateSliderValue(view);
  }

  function interact(view) {
    if (!view.ready && !view.failed) { view.near = true; requestLoad(view); }
  }

  function add(card, product) {
    const stage = card.querySelector('.object-stage');
    const canvas = document.createElement('canvas');
    canvas.className = 'scene-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.dataset.renderer = 'three-shared-webgl';
    stage.append(canvas);
    const view = {
      card, product, stage, canvas, ctx: canvas.getContext('2d'),
      plate: stage.querySelector('.viewer-background'), plateReady: false,
      status: card.querySelector('.viewer-state'),
      retry: card.querySelector('.retry-3d'), angle: 0, targetAngle: 0, hovered: false, keyboardActive: false,
      near: false, ready: false, loading: false, dirty: true, queued: false,
      lastUsed: 0, pointer: null, pointerAnchor: null, interactionUntil: 0
    };
    views.add(view);
    if (!renderer || !view.ctx) {
      fallback(view);
      stage.tabIndex = -1;
      stage.setAttribute('aria-label', `${product.title}, image preview`);
    }
    const [shadowWidth, shadowY, shadowHeight] = SHADOW_LAYOUTS[getDesignId(product)] || [50, 88, 7];
    stage.style.setProperty('--shadow-width', `${shadowWidth}%`);
    stage.style.setProperty('--shadow-y', `${shadowY}%`);
    stage.style.setProperty('--shadow-height', `${shadowHeight}%`);
    function turn(angle) {
      interact(view);
      view.targetAngle = angle;
    }
    function prepareKeyboard() {
      view.pointerAnchor = null;
      if (view.keyboardActive) return;
      view.keyboardActive = true;
      view.angle = Math.atan2(Math.sin(view.angle), Math.cos(view.angle));
      view.targetAngle = view.angle;
    }
    view.retry.addEventListener('click', () => {
      view.failed = false;
      view.retry.hidden = true;
      view.near = true;
      requestLoad(view);
    });
    stage.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End', '0'].includes(event.key)) return;
      prepareKeyboard();
      if (event.key === 'ArrowLeft') turn(Math.max(-Math.PI, view.targetAngle - Math.PI / 12));
      else if (event.key === 'ArrowRight') turn(Math.min(Math.PI, view.targetAngle + Math.PI / 12));
      else if (event.key === 'Home') turn(-Math.PI);
      else if (event.key === 'End') turn(Math.PI);
      else turn(0);
      event.preventDefault();
    });
    stage.addEventListener('blur', () => { view.keyboardActive = false; });
    stage.addEventListener('pointerenter', event => {
      if (event.pointerType !== 'mouse') return;
      view.hovered = true;
      view.keyboardActive = false;
      view.targetAngle = view.angle;
      view.pointerAnchor = { x: event.clientX, angle: view.angle };
    });
    stage.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse' || event.button !== 0 || !event.isPrimary) return;
      interact(view);
      view.keyboardActive = false;
      view.targetAngle = view.angle;
      view.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, angle: view.angle, dragging: false };
    });
    stage.addEventListener('pointermove', event => {
      if (event.pointerType === 'mouse') {
        view.keyboardActive = false;
        const bounds = stage.getBoundingClientRect();
        if (!view.pointerAnchor) view.pointerAnchor = { x: event.clientX, angle: view.angle };
        turn(view.pointerAnchor.angle + (event.clientX - view.pointerAnchor.x) / bounds.width * Math.PI * 2);
        return;
      }
      const pointer = view.pointer;
      if (!pointer || pointer.id !== event.pointerId) return;
      const dx = event.clientX - pointer.x;
      const dy = event.clientY - pointer.y;
      if (!pointer.dragging && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        pointer.dragging = true;
        stage.setPointerCapture(event.pointerId);
      }
      if (!pointer.dragging) return;
      stage.classList.add('is-dragging');
      turn(pointer.angle + dx / stage.clientWidth * Math.PI * 2);
    });
    stage.addEventListener('pointerleave', event => {
      if (event.pointerType !== 'mouse') return;
      view.hovered = false;
      view.pointerAnchor = null;
      view.targetAngle = view.angle;
    });
    function release(event) {
      if (view.pointer?.id !== event.pointerId) return;
      view.pointer = null;
      view.interactionUntil = performance.now() + 1200;
      stage.classList.remove('is-dragging');
      if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
    }
    stage.addEventListener('pointerup', release);
    stage.addEventListener('pointercancel', release);
    return {
      card,
      setVisible(value) {
        view.near = value;
        if (value && !view.failed) requestLoad(view);
        else prune();
      },
      refresh() { view.dirty = true; },
      dispose() {
        view.disposed = true;
        views.delete(view);
        disposeScene(view.scene);
      }
    };
  }

  function frame(time) {
    requestAnimationFrame(frame);
    if (time - lastFrame < 32 || document.hidden || !renderer || contextLost) return;
    const delta = Math.min((time - previousTime) / 1000, .05);
    previousTime = time;
    lastFrame = time;
    for (const view of views) {
      if (!view.ready || !view.plateReady || view.card.hidden) continue;
      const rect = view.stage.getBoundingClientRect();
      if (rect.bottom <= 0 || rect.top >= window.innerHeight || rect.right <= 0 || rect.left >= window.innerWidth || rect.width <= 0) continue;
      view.lastUsed = time;
      const autoRotate = !reduceMotion.matches && !view.hovered && !view.pointer && !view.keyboardActive && !view.card.querySelector(':focus-visible') && time > view.interactionUntil;
      if (autoRotate) {
        view.angle += delta * .12;
        view.targetAngle = view.angle;
        applyPose(view);
      } else if (Math.abs(view.targetAngle - view.angle) > .0001) {
        view.angle = reduceMotion.matches ? view.targetAngle : THREE.MathUtils.lerp(view.angle, view.targetAngle, 1 - Math.exp(-delta * 16));
        if (Math.abs(view.targetAngle - view.angle) < .0001) view.angle = view.targetAngle;
        applyPose(view);
      }
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const size = Math.max(1, Math.min(800, Math.round(rect.width * dpr)));
      if (view.canvas.width !== size || view.canvas.height !== size) {
        view.canvas.width = view.canvas.height = size;
        view.dirty = true;
      }
      if (!view.dirty) continue;
      try {
        if (renderer.domElement.width !== size || renderer.domElement.height !== size) renderer.setSize(size, size, false);
        renderer.setViewport(0, 0, size, size);
        renderer.render(view.scene, view.camera);
        view.ctx.globalCompositeOperation = 'copy';
        view.ctx.drawImage(renderer.domElement, 0, 0);
        view.stage.classList.add('is-live');
        view.status.textContent = 'Live 3D';
        exposeSlider(view);
        view.dirty = false;
      } catch {
        fallback(view);
      }
    }
  }
  requestAnimationFrame(frame);
  return { add };
}
