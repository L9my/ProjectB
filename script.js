const container = document.getElementById('scene-container');
const overlay = document.getElementById('overlay');
const enterBtn = document.getElementById('enter-btn');
const statusEl = document.getElementById('status');

function setStatus(message, isError = false) {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.classList.toggle('error', isError);
}

let scene, camera, renderer, controls, mixer;
let clock;
let started = false;

function createRenderer() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 1);
  container.appendChild(renderer.domElement);
  return renderer;
}

function createLights() {
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  const spot = new THREE.SpotLight(0xfff0cf, 1.3, 0, Math.PI / 4, 0.2, 1.5);
  spot.position.set(4, 6, 4);
  spot.castShadow = true;
  spot.shadow.mapSize.width = 1024;
  spot.shadow.mapSize.height = 1024;

  const rim = new THREE.DirectionalLight(0x7ac7ff, 0.5);
  rim.position.set(-5, 4, -5);

  scene.add(ambient, spot, rim);
}

function centerModel(object) {
  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  object.position.sub(center);
  const maxDim = Math.max(size.x, size.y, size.z);
  const fitHeightDistance = maxDim / (2 * Math.atan((Math.PI * camera.fov) / 360));
  const fitWidthDistance = fitHeightDistance / camera.aspect;
  const distance = Math.max(fitHeightDistance, fitWidthDistance);
  const direction = new THREE.Vector3(0, 0.2, 1.2).normalize();
  const newPosition = direction.multiplyScalar(distance * 1.4);
  camera.position.copy(newPosition);
  controls.target.set(0, size.y * 0.2, 0);
  controls.update();
}

function createPlaceholderCake() {
  const group = new THREE.Group();
  const layers = [
    { radius: 1.6, height: 0.7, color: 0xfad6d6 },
    { radius: 1.2, height: 0.55, color: 0xf8b4d9 },
    { radius: 0.8, height: 0.5, color: 0xffffff },
  ];

  let y = 0;
  layers.forEach((layer) => {
    const geo = new THREE.CylinderGeometry(layer.radius, layer.radius, layer.height, 64, 1, false);
    const mat = new THREE.MeshStandardMaterial({ color: layer.color, roughness: 0.35, metalness: 0.1 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.y = y + layer.height / 2;
    group.add(mesh);
    // frosting
    const frostingGeo = new THREE.TorusGeometry(layer.radius * 0.95, 0.05, 16, 64);
    const frostingMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x111111, roughness: 0.2 });
    const frosting = new THREE.Mesh(frostingGeo, frostingMat);
    frosting.rotation.x = Math.PI / 2;
    frosting.position.y = mesh.position.y + layer.height / 2 - 0.05;
    group.add(frosting);
    y += layer.height;
  });

  // candles
  const candleGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.5, 16);
  const candleMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const flameGeo = new THREE.SphereGeometry(0.08, 16, 16);
  const flameMat = new THREE.MeshStandardMaterial({ color: 0xffe28a, emissive: 0xffa200, emissiveIntensity: 0.8 });

  const positions = [
    new THREE.Vector3(0.25, layers[2].height + layers[1].height + 0.1, 0.15),
    new THREE.Vector3(-0.2, layers[2].height + layers[1].height + 0.1, -0.1),
    new THREE.Vector3(0.05, layers[2].height + layers[1].height + 0.1, -0.3),
  ];

  positions.forEach((pos) => {
    const candle = new THREE.Mesh(candleGeo, candleMat);
    candle.position.copy(pos);
    group.add(candle);

    const flame = new THREE.Mesh(flameGeo, flameMat);
    flame.position.copy(pos).add(new THREE.Vector3(0, 0.3, 0));
    group.add(flame);
  });

  // plate
  const plateGeo = new THREE.CylinderGeometry(2.2, 2.2, 0.15, 64);
  const plateMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, metalness: 0.2, roughness: 0.25 });
  const plate = new THREE.Mesh(plateGeo, plateMat);
  plate.receiveShadow = true;
  plate.position.y = 0.05;
  group.add(plate);

  group.position.y = 0.1;
  group.castShadow = true;
  group.receiveShadow = true;
  return group;
}

function loadCakeModel() {
  return new Promise((resolve) => {
    const loader = new THREE.GLTFLoader();

    if (THREE.DRACOLoader) {
      const dracoLoader = new THREE.DRACOLoader();
      dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
      dracoLoader.setDecoderConfig({ type: 'js' });
      loader.setDRACOLoader(dracoLoader);
    }

    loader.load(
      'assets/cake.glb',
      (gltf) => {
        const model = gltf.scene;
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        scene.add(model);
        centerModel(model);
        setStatus('');
        resolve(true);
      },
      undefined,
      (err) => {
        console.warn('Could not load cake model, falling back to placeholder.', err);
        const placeholder = createPlaceholderCake();
        scene.add(placeholder);
        centerModel(placeholder);
        setStatus('Using placeholder cake (model missing or invalid).', true);
        resolve(false);
      },
    );
  });
}

function initScene() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  renderer = createRenderer();
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 2;
  controls.maxDistance = 10;

  const floorGeo = new THREE.PlaneGeometry(40, 40);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x0d0d0d, metalness: 0.1, roughness: 0.9 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  createLights();
  window.addEventListener('resize', onWindowResize);

  return loadCakeModel();
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  if (controls) controls.update();
  if (mixer) mixer.update(delta);
  renderer.render(scene, camera);
}

async function startExperience() {
  if (started) return;
  started = true;
  setStatus('Loading cake...');

  clock = new THREE.Clock();

  overlay.classList.add('hidden');
  const loadPromise = initScene();
  animate();

  await loadPromise;
}

enterBtn.addEventListener('click', startExperience);
