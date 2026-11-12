import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

// Optional pivots are measured in the GLB's original X/Z coordinates.
// Keep the default pose in place while turning around that measured axis.
export function getTurntablePresentation(model, product, camera) {
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  let scale = Math.min(2.85 / Math.max(size.y, .000001), 3.5 / Math.max(Math.hypot(size.x, size.z), .000001));
  const pivot = product.rotationPivot;
  if (!Array.isArray(pivot) || pivot.length !== 2 || !pivot.every(Number.isFinite)) {
    return { scale, offset: new THREE.Vector3(-center.x, -bounds.min.y, -center.z), position: new THREE.Vector3() };
  }
  let radius = 0;
  const point = new THREE.Vector3();
  model.traverse(object => {
    if (!object.isMesh) return;
    const positions = object.geometry.getAttribute('position');
    for (let index = 0; index < positions.count; index++) {
      point.fromBufferAttribute(positions, index).applyMatrix4(object.matrixWorld);
      radius = Math.max(radius, Math.hypot(point.x - pivot[0], point.z - pivot[1]));
    }
  });
  const shift = new THREE.Vector3(pivot[0] - center.x, 0, pivot[1] - center.z);
  scale = Math.min(scale, 3.5 / Math.max(2 * radius, .000001));
  // Fit the complete cylinder swept around the true axis. This continuous
  // bound covers every angle, including intermediate pointer positions.
  camera.updateMatrixWorld(true);
  const projection = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  const frustum = new THREE.Frustum().setFromProjectionMatrix(projection);
  for (const plane of frustum.planes) {
    const n = plane.normal;
    const extent = n.x * shift.x + n.z * shift.z + Math.min(0, n.y * size.y) - radius * Math.hypot(n.x, n.z);
    if (extent < 0) scale = Math.min(scale, plane.constant / -extent * .97);
  }
  return {
    scale,
    offset: new THREE.Vector3(-pivot[0], -bounds.min.y, -pivot[1]),
    position: shift.multiplyScalar(scale),
    sweptRadius: radius,
  };
}

// One WebGL renderer serves every card. Each card receives a 2D copy of its
// rendered scene, so the gallery never creates eighteen WebGL contexts.
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
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
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
    view.stage.setAttribute('aria-valuemin', '-90');
    view.stage.setAttribute('aria-valuemax', '90');
    view.stage.setAttribute('aria-orientation', 'horizontal');
    view.stage.setAttribute('aria-describedby', `viewer-help viewer-keyboard-help ${view.status.id}`);
    view.stage.tabIndex = 0;
    updateSliderValue(view);
  }

  function updateSliderValue(view) {
    const degrees = Math.round(THREE.MathUtils.radToDeg(view.angle));
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
    root.add(model);
    scene.add(root);
    model.traverse(object => {
      if (!object.isMesh) return;
      object.castShadow = true;
      object.receiveShadow = false;
    });
    // Match the common toy-world plate. The camera remains fixed while only
    // the object is fitted and rotated by pointer movement.
    const target = new THREE.Vector3(0, 1.1706807, 0);
    const camera = new THREE.PerspectiveCamera(24.19997, 1, .01, 100);
    camera.position.set(0, 5.4706807, 8.4);
    camera.lookAt(target);
    const presentation = getTurntablePresentation(model, view.product, camera);
    const scale = presentation.scale;
    model.position.add(presentation.offset);
    root.position.copy(presentation.position);
    root.scale.setScalar(scale);
    const key = new THREE.DirectionalLight(0xfff8ef, 1.6);
    key.position.set(-3, 10, 4.5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = key.shadow.camera.bottom = -4;
    key.shadow.camera.right = key.shadow.camera.top = 4;
    key.shadow.camera.near = .1;
    key.shadow.camera.far = 20;
    key.shadow.bias = -.0005;
    key.shadow.normalBias = .02;
    key.shadow.radius = 5;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xedf4ff, .55);
    fill.position.set(4, 2.5, 4);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, .7);
    rim.position.set(2, 6, -5);
    scene.add(rim, new THREE.HemisphereLight(0xfff9f0, 0xe0d5c4, .45));
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial({ opacity: .16, depthWrite: false }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -.012;
    floor.receiveShadow = true;
    scene.add(floor);
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
      retry: card.querySelector('.retry-3d'), angle: 0, targetAngle: 0,
      near: false, ready: false, loading: false, dirty: true, queued: false,
      lastUsed: 0, pointer: null
    };
    views.add(view);
    if (!renderer || !view.ctx) {
      fallback(view);
      stage.tabIndex = -1;
      stage.setAttribute('aria-label', `${product.title}, image preview`);
    }
    function turn(angle) {
      interact(view);
      view.targetAngle = THREE.MathUtils.clamp(angle, -Math.PI / 2, Math.PI / 2);
    }
    function reset() {
      interact(view);
      view.targetAngle = 0;
    }
    view.retry.addEventListener('click', () => {
      view.failed = false;
      view.retry.hidden = true;
      view.near = true;
      requestLoad(view);
    });
    stage.addEventListener('keydown', event => {
      if (event.key === 'ArrowLeft') turn(view.targetAngle - Math.PI / 12);
      else if (event.key === 'ArrowRight') turn(view.targetAngle + Math.PI / 12);
      else if (event.key === 'Home') turn(-Math.PI / 2);
      else if (event.key === 'End') turn(Math.PI / 2);
      else if (event.key === '0') reset();
      else return;
      event.preventDefault();
    });
    stage.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse' || event.button !== 0 || !event.isPrimary) return;
      interact(view);
      view.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, angle: view.targetAngle, dragging: false };
    });
    stage.addEventListener('pointermove', event => {
      if (event.pointerType === 'mouse') {
        const bounds = stage.getBoundingClientRect();
        turn(((event.clientX - bounds.left) / bounds.width - .5) * Math.PI);
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
      turn(pointer.angle + dx / stage.clientWidth * Math.PI);
    });
    stage.addEventListener('pointerleave', event => {
      if (event.pointerType === 'mouse') view.targetAngle = view.angle;
    });
    function release(event) {
      if (view.pointer?.id !== event.pointerId) return;
      view.pointer = null;
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
      if (Math.abs(view.targetAngle - view.angle) > .0001) {
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
