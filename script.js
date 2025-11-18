import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const container = document.getElementById('scene-container');
const overlay = document.getElementById('overlay');
const enterBtn = document.getElementById('enter-btn');
const statusEl = document.getElementById('status');
const pressCounterEl = document.getElementById('press-counter');
const greetingEl = document.getElementById('greeting');
const audioPlayerEl = document.getElementById('audio-player');
const audioToggleBtn = document.getElementById('audio-toggle');
const audioEl = document.getElementById('bg-audio');
const audioProgressEl = document.getElementById('audio-progress');
//this should have been applied
const REQUIRED_PRESSES = 10;
let remainingPresses = REQUIRED_PRESSES;
const MODEL_LIFT = 0.6;
const textureLoader = new THREE.TextureLoader();
const cubeTextureLoader = new THREE.CubeTextureLoader();
const CUBEMAP_PATH = 'assets/sky_05_cubemap_2k/';
const CUBEMAP_FILES = ['px.png', 'nx.png', 'py.png', 'ny.png', 'pz.png', 'nz.png'];
let backdrop;
let reflectionMap;
let pmremGenerator;
let pmremTarget;
let materialEnvMap;
let envMapPromise;
let isAudioPlaying = false;

function showGreeting() {
  if (greetingEl) {
    greetingEl.classList.add('visible');
  }
}

function hideGreeting() {
  if (greetingEl) {
    greetingEl.classList.remove('visible');
  }
}

function showAudioPlayer() {
  if (audioPlayerEl) {
    audioPlayerEl.classList.add('visible');
  }
  if (audioEl) {
    audioEl.volume = 0.03;
  }
}

function hideAudioPlayer() {
  if (audioPlayerEl) {
    audioPlayerEl.classList.remove('visible');
  }
  if (audioEl) {
    audioEl.pause();
    audioEl.currentTime = 0;
    isAudioPlaying = false;
    updateAudioToggle();
    updateAudioProgress(0);
  }
}

function updateAudioToggle() {
  if (!audioToggleBtn) return;
  const icon = audioToggleBtn.querySelector('.icon');
  if (!icon) return;
  icon.classList.toggle('icon-pause', isAudioPlaying);
  icon.classList.toggle('icon-play', !isAudioPlaying);
  const srText = audioToggleBtn.querySelector('.sr-only');
  if (srText) {
    srText.textContent = isAudioPlaying ? 'Pause' : 'Play';
  }
}

function updateAudioProgress(percent) {
  if (!audioProgressEl) return;
  audioProgressEl.value = String(percent);
}

function attachAudioEvents() {
  if (!audioEl) return;
  audioEl.addEventListener('timeupdate', () => {
    if (!audioEl.duration) return;
    const percent = (audioEl.currentTime / audioEl.duration) * 100;
    updateAudioProgress(percent);
  });
  if (audioProgressEl) {
    audioProgressEl.addEventListener('input', (event) => {
      if (!audioEl.duration) return;
      const inputEl = event.target;
      const percent = Number(inputEl.value);
      const newTime = (percent / 100) * audioEl.duration;
      audioEl.currentTime = newTime;
    });
  }
}

function updatePressCounter() {
  if (!pressCounterEl) return;
  if (remainingPresses > 0) {
    const plural = remainingPresses === 1 ? 'time' : 'times';
    pressCounterEl.textContent = `You have to press ${remainingPresses} more ${plural} to enter the site`;
  } else {
    pressCounterEl.textContent = 'You can enter now!';
  }
}

updatePressCounter();
updateAudioToggle();
attachAudioEvents();

function setStatus(message, isError = false) {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.classList.toggle('error', isError);
}

let scene, camera, renderer, controls, mixer;
let clock;
let started = false;

function loadEnvironmentMap() {
  if (envMapPromise) return envMapPromise;
  envMapPromise = new Promise((resolve, reject) => {
    cubeTextureLoader.setPath(CUBEMAP_PATH).load(
      CUBEMAP_FILES,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.mapping = THREE.CubeReflectionMapping;
        reflectionMap = texture;
        resolve(texture);
      },
      undefined,
      (error) => {
        console.error('Failed to load cubemap environment.', error);
        reject(error);
      },
    );
  });
  return envMapPromise;
}

function createRenderer() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x2a2f35, 1);
  container.appendChild(renderer.domElement);
  return renderer;
}

function applyEnvironmentToScene(texture) {
  if (!scene || !renderer || !texture) return;
  if (!pmremGenerator) {
    pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileCubemapShader();
  }
  if (pmremTarget) {
    pmremTarget.dispose();
  }
  pmremTarget = pmremGenerator.fromCubemap(texture);
  materialEnvMap = pmremTarget.texture;
  scene.environment = materialEnvMap;
  scene.background = texture;
}

function createLights() {
  const ambient = new THREE.AmbientLight(0xffffff, 0.75);
  const hemisphere = new THREE.HemisphereLight(0xfff6e6, 0x1f2431, 0.4);

  const key = new THREE.DirectionalLight(0xfff0dd, 1.4);
  key.position.set(2.8, 4.5, 2.6);
  key.target.position.set(0.4, MODEL_LIFT + 0.2, 0.3);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0003;

  const fill = new THREE.DirectionalLight(0xf6dff2, 0.85);
  fill.position.set(-3.4, 3.5, -0.5);

  const topFill = new THREE.PointLight(0xfdfbff, 1.2, 8, 1.3);
  topFill.position.set(-0.2, MODEL_LIFT + 2.3, 0.1);

  const rim = new THREE.DirectionalLight(0x9ed0ff, 0.7);
  rim.position.set(-4, 3, -4);

  scene.add(ambient, hemisphere, key, key.target, fill, topFill, rim);
}

function ensureBackdrop() {
  if (!scene) return;
  if (backdrop) {
    if (!backdrop.parent) {
      scene.add(backdrop);
    }
    return;
  }

  const planeWidth = 5.5;
  const planeHeight = 3.4;
  const radius = 6.5;
  const midY = MODEL_LIFT + planeHeight / 2 - 0.35;
  const definitions = [
    { file: 'assets/AmaliaMinecraft2.png', angle: THREE.MathUtils.degToRad(45) },
    { file: 'assets/AmaliaMinecraft.png', angle: 0 },
    { file: 'assets/AmaliaMinecraft3.png', angle: THREE.MathUtils.degToRad(-45) },
  ];

  const lookTarget = new THREE.Vector3(0, midY, 0);
  const group = new THREE.Group();

  definitions.forEach(({ file, angle }) => {
    const texture = textureLoader.load(file);
    texture.colorSpace = THREE.SRGBColorSpace;
    const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    const x = Math.sin(angle) * radius;
    const z = -Math.cos(angle) * radius;
    mesh.position.set(x, midY, z);
    mesh.lookAt(lookTarget);
    group.add(mesh);
  });

  backdrop = group;
  scene.add(backdrop);
}

function adjustGlossiness(object3D) {
  if (!object3D) return;
  object3D.traverse((child) => {
    if (!child.isMesh) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((mat) => {
      if (!mat || !('roughness' in mat)) return;
      mat.roughness = Math.min(1, (typeof mat.roughness === 'number' ? mat.roughness : 0.5) + 0.35);
      mat.metalness = Math.max(0, Math.min(1, (typeof mat.metalness === 'number' ? mat.metalness : 0.2) * 0.25));
      if ('envMapIntensity' in mat) {
        mat.envMapIntensity = 0.75;
      }
      mat.needsUpdate = true;
    });
  });
}

function centerModel(object) {
  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  object.position.sub(center);
  object.position.y += MODEL_LIFT;
  const maxDim = Math.max(size.x, size.y, size.z);
  const fitHeightDistance = maxDim / (2 * Math.atan((Math.PI * camera.fov) / 360));
  const fitWidthDistance = fitHeightDistance / camera.aspect;
  const distance = Math.max(fitHeightDistance, fitWidthDistance);
  const direction = new THREE.Vector3(0, 0.2, 1.2).normalize();
  const newPosition = direction.multiplyScalar(distance * 1.4);
  camera.position.copy(newPosition);
  controls.target.set(0, size.y * 0.2 + MODEL_LIFT, 0);
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
    const loader = new GLTFLoader();

    if (DRACOLoader) {
      const dracoLoader = new DRACOLoader();
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
        adjustGlossiness(model);
        scene.add(model);
        centerModel(model);
        setStatus('');
        resolve(true);
      },
      undefined,
      (err) => {
        console.warn('Could not load cake model, falling back to placeholder.', err);
        const placeholder = createPlaceholderCake();
        adjustGlossiness(placeholder);
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
  scene.background = new THREE.Color(0x2a2f35);
  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  renderer = createRenderer();
  loadEnvironmentMap()
    .then((texture) => {
      applyEnvironmentToScene(texture);
    })
    .catch(() => {
      console.warn('Running without HDR environment.');
    });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 2;
  controls.maxDistance = 10;

  createLights();
  ensureBackdrop();
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
  hideGreeting();
  setStatus('Loading cake...');

  clock = new THREE.Clock();

  overlay.classList.add('hidden');
  try {
    const loadPromise = initScene();
    animate();
    await loadPromise;
    setStatus('');
    showGreeting();
    showAudioPlayer();
    if (audioEl) {
      audioEl
        .play()
        .then(() => {
          isAudioPlaying = true;
          updateAudioToggle();
        })
        .catch((error) => {
          console.warn('Unable to autoplay music.', error);
        });
    }
  } catch (error) {
    console.error('Unable to start the 3D experience.', error);
    setStatus('Something went wrong loading the cake. Please refresh.', true);
    overlay.classList.remove('hidden');
    started = false;
    hideGreeting();
    hideAudioPlayer();
  }
}

function handleEnterClick() {
  if (remainingPresses > 0) {
    remainingPresses -= 1;
    updatePressCounter();
    if (remainingPresses > 0) {
      return;
    }
  }
  if (!started) {
    startExperience();
  }
}

enterBtn.addEventListener('click', handleEnterClick);

if (audioToggleBtn && audioEl) {
  audioToggleBtn.addEventListener('click', () => {
    if (audioEl.paused) {
      audioEl
        .play()
        .then(() => {
          isAudioPlaying = true;
          updateAudioToggle();
        })
        .catch((error) => {
          console.warn('Unable to start audio playback.', error);
        });
    } else {
      audioEl.pause();
      isAudioPlaying = false;
      updateAudioToggle();
    }
  });
}

attachAudioEvents();
