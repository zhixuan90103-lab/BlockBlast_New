import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Capacitor } from '@capacitor/core';
import { createRenderer } from './create-renderer.js';
import { createNativeHaptics } from './native-haptics.js';

const statusEl = document.getElementById('status');
const logEl = document.getElementById('haptic-log');
const haptics = createNativeHaptics({ enabled: true });

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

function setLog(text) {
  if (logEl) logEl.textContent = text;
}

async function boot() {
  const platform = Capacitor.getPlatform();
  const native = Capacitor.isNativePlatform();
  setStatus(`platform: ${platform} | native: ${native}\ncreating WebGPU renderer…`);

  const renderer = await createRenderer();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1020);

  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(2.2, 1.6, 2.8);

  const hemi = new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 1.2);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(3, 5, 2);
  scene.add(key);

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({
      color: 0x7c3aed,
      metalness: 0.15,
      roughness: 0.35,
    }),
  );
  scene.add(mesh);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(3.2, 64),
    new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.05, roughness: 0.9 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.75;
  scene.add(floor);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.set(0, 0, 0);

  const onResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  };
  window.addEventListener('resize', onResize);

  renderer.setAnimationLoop(() => {
    mesh.rotation.y += 0.01;
    mesh.rotation.x += 0.004;
    controls.update();
    renderer.render(scene, camera);
  });

  setStatus(
    `WebGPU OK\nplatform: ${platform} | native: ${native}\n` +
      `haptics native-ios: ${haptics.isNativeIos()}`,
  );

  if (haptics.isNativeIos()) {
    const prep = await haptics.prepare();
    setLog(`prepare → ${JSON.stringify(prep)}`);
  } else {
    setLog('当前不是 iOS App：震动按钮会返回 not_native_ios（桌面/浏览器正常）');
  }

  document.querySelectorAll('[data-haptic]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const action = btn.getAttribute('data-haptic');
      let result;
      switch (action) {
        case 'prepare':
          result = await haptics.prepare();
          break;
        case 'tap':
          result = await haptics.playTransient({ intensity: 0.55, sharpness: 0.5 });
          break;
        case 'start':
          result = await haptics.startContinuous({ intensity: 0.18, sharpness: 0.22 });
          break;
        case 'update':
          result = await haptics.updateContinuous({ intensity: 0.4, sharpness: 0.35 });
          break;
        case 'stop':
          result = await haptics.stopContinuous();
          break;
        default:
          result = { ok: false, reason: 'unknown' };
      }
      setLog(`${action} → ${JSON.stringify(result)}`);
    });
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && haptics.isNativeIos()) {
      void haptics.prepare();
    }
  });
}

boot().catch((err) => {
  console.error(err);
  setStatus(`boot failed: ${err?.message || err}`);
});
