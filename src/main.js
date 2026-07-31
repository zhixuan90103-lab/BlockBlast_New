/**
 * Web 入口：viewport → WebGPU → createGame (Block Blast M2)。
 * @see AGENTS.md · research/IMPLEMENTATION-TODO.md
 */
import { Capacitor } from '@capacitor/core';
import { createRenderer } from './create-renderer.js';
import { createFeelPanel } from './feel-panel.js';
import { createGame } from './game/game.js';
import { createNativeHaptics } from './native-haptics.js';
import { installTouchHygiene } from './touch-hygiene.js';
import {
  applyNativeClass,
  applySafeAreaCssVars,
  applyShellLayout,
  bindShellResize,
  scheduleStableLayout,
} from './viewport.js';

const statusEl = document.getElementById('status');
const haptics = createNativeHaptics({ enabled: true });

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

async function boot() {
  installTouchHygiene();
  applyNativeClass();
  applyShellLayout();
  applySafeAreaCssVars();

  setStatus(
    `platform: ${Capacitor.getPlatform()} | native: ${Capacitor.isNativePlatform()}\n` +
      `creating WebGPU…`,
  );

  const stage = document.getElementById('stage');
  const hud = document.getElementById('hud');
  if (!stage || !hud) throw new Error('#stage / #hud missing');

  const renderer = await createRenderer({ container: stage });

  // 先套壳尺寸，再创建游戏（避免首帧 frame/safe 为 0）
  applyShellLayout();
  applySafeAreaCssVars();

  const game = createGame({
    stage,
    hud,
    renderer,
    haptics,
    setStatus,
  });

  bindShellResize(() => {
    game.relayout();
  });

  // 真机首启：env(safe-area) / frame 常晚一拍；调参会 relayout「碰巧修好」
  scheduleStableLayout(() => {
    game.relayout();
  });

  const frameEl = document.getElementById('phone-frame') || stage;
  const feelPanel = createFeelPanel({
    mount: frameEl,
    onChange: (info) => {
      // setTune 已写入数据；布局类 rebuild，手感类只 repaint
      game.applyTune({ layout: info?.needsLayout !== false });
    },
  });

  if (haptics.isNativeIos()) {
    await haptics.prepare();
  }

  // 开发期：暴露到 window 便于控制台检查
  if (import.meta.env?.DEV !== false) {
    window.__bb = { game, haptics, renderer, feelPanel };
  }
}

boot().catch((err) => {
  console.error(err);
  setStatus(`boot failed: ${err?.message || err}`);
});
