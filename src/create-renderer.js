/**
 * WebGPU 渲染器：挂到 #stage，尺寸跟 #phone-frame（getFrameSize），禁止裸用整窗。
 * @see docs/ENGINEERING.md §5
 */
import * as THREE from 'three';
import * as THREE_WEBGPU from 'three/webgpu';
import { getFrameSize } from './viewport.js';

const { WebGPURenderer } = THREE_WEBGPU;

export function showFatal(title, message) {
  document.body.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#0f172a;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,sans-serif;">
      <div style="max-width:640px;border:1px solid rgba(148,163,184,.28);border-radius:16px;padding:20px;background:rgba(15,23,42,.8);line-height:1.6;">
        <div style="font-size:20px;font-weight:700;margin-bottom:10px;">${title}</div>
        <div style="white-space:pre-wrap;opacity:.95;">${message}</div>
        <div style="margin-top:12px;font-size:12px;opacity:.7;white-space:pre-wrap;">isSecureContext: ${window.isSecureContext}\nnavigator.gpu: ${!!navigator.gpu}</div>
      </div>
    </div>
  `;
}

/**
 * Create a WebGPU renderer sized to #phone-frame (not the full desktop window).
 */
export async function createRenderer({ antialias = true, container } = {}) {
  if (!navigator.gpu) {
    showFatal(
      'WebGPU 不可用',
      '当前环境没有 navigator.gpu。\n请用支持 WebGPU 的桌面 Chrome / Safari，或较新的 iOS Safari / 真机 App。',
    );
    throw new Error('WebGPU unavailable');
  }

  const host = container || document.getElementById('stage') || document.body;
  const renderer = new WebGPURenderer({ antialias });
  try {
    await renderer.init();
  } catch (err) {
    showFatal('WebGPU 初始化失败', err?.message || String(err));
    throw err;
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);

  const { width, height } = getFrameSize();
  renderer.setSize(width, height, false);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.1;

  const canvas = renderer.domElement;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  host.appendChild(canvas);

  return renderer;
}

/** Resize renderer + camera to the current phone-frame CSS size. */
export function resizeToFrame(renderer, camera) {
  const { width, height } = getFrameSize();
  if (width < 2 || height < 2) return { width, height };

  if (camera) {
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  renderer.setSize(width, height, false);
  return { width, height };
}
