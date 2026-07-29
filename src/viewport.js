/**
 * 手机框 letterbox + native 全屏 + Safe Area CSS 变量。
 * 设计尺寸 DESIGN_* 与 style.css 中 393/852、--safe-* 必须同步。
 * @see docs/ENGINEERING.md §4 · AGENTS.md
 */
import { Capacitor } from '@capacitor/core';

/**
 * Design size aligned with modern iPhone logical points (e.g. 15 Pro ~393×852).
 * Desktop letterbox always contains this aspect so layout matches iOS.
 */
export const DESIGN_WIDTH = 393;
export const DESIGN_HEIGHT = 852;
export const DESIGN_ASPECT = DESIGN_WIDTH / DESIGN_HEIGHT;

/**
 * Desktop-simulated safe areas (iPhone 14/15 Pro-ish).
 * Real device uses env(safe-area-inset-*) via CSS on .native-app.
 * Top ~59pt clears Dynamic Island + status bar.
 */
export const DESIGN_SAFE = {
  top: 59,
  right: 0,
  bottom: 34,
  left: 0,
};

/**
 * Mark native so CSS can go full-bleed on device.
 * Call once at boot before first layout.
 */
export function applyNativeClass() {
  const native = Capacitor.isNativePlatform();
  document.documentElement.classList.toggle('native-app', native);
  document.body.classList.toggle('native-app', native);
  // Expose safe insets as CSS vars for any JS-driven UI (and desktop fallback).
  applySafeAreaCssVars(native);
  return native;
}

/**
 * Write --safe-* on :root.
 * Native: prefer env() already in CSS; still set pixel floors from getComputedStyle probe if needed.
 * Desktop: simulated island / home indicator so web preview matches phone UI.
 */
export function applySafeAreaCssVars(native = isNativeApp()) {
  const root = document.documentElement;
  if (!native) {
    root.style.setProperty('--safe-top', `${DESIGN_SAFE.top}px`);
    root.style.setProperty('--safe-right', `${DESIGN_SAFE.right}px`);
    root.style.setProperty('--safe-bottom', `${DESIGN_SAFE.bottom}px`);
    root.style.setProperty('--safe-left', `${DESIGN_SAFE.left}px`);
    return { ...DESIGN_SAFE };
  }

  // On native, clear inline overrides so CSS env()/constant() rules win.
  root.style.removeProperty('--safe-top');
  root.style.removeProperty('--safe-right');
  root.style.removeProperty('--safe-bottom');
  root.style.removeProperty('--safe-left');
  return readSafeAreaInsets();
}

/**
 * Read resolved safe-area (px).
 * 真机首帧 env() 可能尚未进 CSS 变量 → 用探针测 env()，避免 padT=0 导致棋盘高度错位。
 */
export function readSafeAreaInsets() {
  const cs = getComputedStyle(document.documentElement);
  const parseVar = (name, fallback) => {
    const raw = cs.getPropertyValue(name).trim();
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : fallback;
  };

  let top = parseVar('--safe-top', NaN);
  let right = parseVar('--safe-right', NaN);
  let bottom = parseVar('--safe-bottom', NaN);
  let left = parseVar('--safe-left', NaN);

  // 原生首帧：--safe-* 常为 0 或未解析，直接量 env()
  const needProbe =
    isNativeApp() &&
    (!Number.isFinite(top) ||
      !Number.isFinite(bottom) ||
      (top === 0 && bottom === 0));

  if (needProbe && typeof document !== 'undefined' && document.body) {
    const probe = document.createElement('div');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = [
      'position:fixed',
      'left:0',
      'top:0',
      'width:0',
      'height:0',
      'visibility:hidden',
      'pointer-events:none',
      'padding-top:env(safe-area-inset-top, 0px)',
      'padding-right:env(safe-area-inset-right, 0px)',
      'padding-bottom:env(safe-area-inset-bottom, 0px)',
      'padding-left:env(safe-area-inset-left, 0px)',
    ].join(';');
    document.body.appendChild(probe);
    const pcs = getComputedStyle(probe);
    const pt = parseFloat(pcs.paddingTop);
    const pr = parseFloat(pcs.paddingRight);
    const pb = parseFloat(pcs.paddingBottom);
    const pl = parseFloat(pcs.paddingLeft);
    probe.remove();
    if (Number.isFinite(pt) && (pt > 0 || !Number.isFinite(top))) top = pt;
    if (Number.isFinite(pr)) right = pr;
    if (Number.isFinite(pb) && (pb > 0 || !Number.isFinite(bottom))) bottom = pb;
    if (Number.isFinite(pl)) left = pl;
  }

  // 桌面 / 仍失败：用设计安全区，避免整盘顶满屏
  if (!Number.isFinite(top) || (isNativeApp() && top === 0 && bottom === 0)) {
    // 仅当探测也是 0 时，native 可能真是 0（少见）；桌面用 DESIGN_SAFE
    if (!isNativeApp()) {
      return { ...DESIGN_SAFE };
    }
  }

  return {
    top: Number.isFinite(top) ? top : DESIGN_SAFE.top,
    right: Number.isFinite(right) ? right : DESIGN_SAFE.right,
    bottom: Number.isFinite(bottom) ? bottom : DESIGN_SAFE.bottom,
    left: Number.isFinite(left) ? left : DESIGN_SAFE.left,
  };
}

/**
 * 启动后多次布局，等 WKWebView 尺寸与 safe-area 稳定。
 * 仅在 frame/safe 指纹变化时回调（避免无意义 rebuild）。
 * @param {() => void} fn
 */
export function scheduleStableLayout(fn) {
  let lastKey = '';
  let first = true;
  const run = () => {
    applyShellLayout();
    applySafeAreaCssVars();
    const size = getFrameSize();
    const safe = readSafeAreaInsets();
    if (size.width < 2 || size.height < 2) return;
    const key = [
      Math.round(size.width),
      Math.round(size.height),
      Math.round(safe.top),
      Math.round(safe.bottom),
      Math.round(safe.left),
      Math.round(safe.right),
    ].join('x');
    if (!first && key === lastKey) return;
    first = false;
    lastKey = key;
    fn();
  };

  run();
  requestAnimationFrame(() => {
    run();
    requestAnimationFrame(run);
  });
  for (const ms of [32, 80, 160, 320, 600]) {
    setTimeout(run, ms);
  }
}

export function isNativeApp() {
  return document.body.classList.contains('native-app') || Capacitor.isNativePlatform();
}

function readViewportSize() {
  const vv = window.visualViewport;
  if (vv && vv.width > 2 && vv.height > 2) {
    return { w: vv.width, h: vv.height };
  }
  return {
    w: window.innerWidth || document.documentElement.clientWidth || DESIGN_WIDTH,
    h: window.innerHeight || document.documentElement.clientHeight || DESIGN_HEIGHT,
  };
}

/**
 * Desktop: CSS handles contain (393:852).
 * Native: JS uniform contain into visualViewport (handles notches / split).
 */
export function applyShellLayout() {
  const letterbox = document.getElementById('letterbox');
  const frame = document.getElementById('phone-frame');
  if (!letterbox || !frame) {
    return getFrameSize();
  }

  if (!isNativeApp()) {
    letterbox.style.width = '';
    letterbox.style.height = '';
    frame.style.width = '';
    frame.style.height = '';
    return getFrameSize();
  }

  const { w, h } = readViewportSize();
  letterbox.style.width = `${w}px`;
  letterbox.style.height = `${h}px`;

  // Full-bleed on real phone: use the actual device size (already phone aspect).
  // Still clamp if somehow landscape so content doesn't stretch oddly.
  const deviceAspect = w / h;
  let frameW = w;
  let frameH = h;
  if (Math.abs(deviceAspect - DESIGN_ASPECT) > 0.02) {
    if (deviceAspect > DESIGN_ASPECT) {
      frameH = h;
      frameW = h * DESIGN_ASPECT;
    } else {
      frameW = w;
      frameH = w / DESIGN_ASPECT;
    }
  }
  frame.style.width = `${frameW}px`;
  frame.style.height = `${frameH}px`;
  frame.style.maxWidth = 'none';
  frame.style.maxHeight = 'none';

  return getFrameSize();
}

/** CSS pixel size of #phone-frame (the playable area). */
export function getFrameSize() {
  const frame = document.getElementById('phone-frame');
  if (frame) {
    const r = frame.getBoundingClientRect();
    if (r.width > 2 && r.height > 2) {
      return {
        width: r.width,
        height: r.height,
        cssWidth: r.width,
        cssHeight: r.height,
        scale: r.width / DESIGN_WIDTH,
      };
    }
  }
  return {
    width: DESIGN_WIDTH,
    height: DESIGN_HEIGHT,
    cssWidth: DESIGN_WIDTH,
    cssHeight: DESIGN_HEIGHT,
    scale: 1,
  };
}

/**
 * Bind resize / visualViewport listeners. Returns unsubscribe.
 */
export function bindShellResize(onResize) {
  const handler = () => {
    applyShellLayout();
    onResize?.(getFrameSize());
  };
  window.addEventListener('resize', handler);
  window.visualViewport?.addEventListener('resize', handler);
  window.visualViewport?.addEventListener('scroll', handler);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) handler();
  });
  handler();
  return () => {
    window.removeEventListener('resize', handler);
    window.visualViewport?.removeEventListener('resize', handler);
    window.visualViewport?.removeEventListener('scroll', handler);
  };
}
