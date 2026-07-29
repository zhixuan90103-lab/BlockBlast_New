/**
 * Block Blast 编排层：规则循环 + 指针 + 调用 feel 子系统。
 * 手感细节见 docs/FEEL-DESIGN.md 与 src/game/feel/*
 */
import * as THREE from 'three';
import { Capacitor } from '@capacitor/core';
import { resizeToFrame } from '../create-renderer.js';
import {
  applySafeAreaCssVars,
  getFrameSize,
  isNativeApp,
  readSafeAreaInsets,
} from '../viewport.js';
import {
  COLOR,
  FEEL_CLEAR_MS,
  FEEL_COMMIT_MS,
  FEEL_HIT_SLOP,
  FEEL_INPUT_LOCK_MS,
  FEEL_REJECT_MS,
  SHOW_DEBUG_STATUS,
} from './defaults.js';
import {
  chaseTargetOnPointer,
  createDragSession,
  samplePointer,
  tickSmooth,
} from './feel/drag-session.js';
import { createGhostPolicy } from './feel/ghost-policy.js';
import { createGhostHaptics } from './feel/haptics-ghost.js';
import { countCells, matrixSize } from './forms.js';
import { createGrid } from './grid.js';
import { computeLayout } from './layout.js';
import {
  anyTrayPieceFits,
  clearPendingDealPlan,
  generateTray,
  lastDealMeta,
} from './pieces.js';
import { createScoreState } from './score.js';
import { getTune } from './tune.js';
import { createBoardView } from './view.js';

/**
 * @param {{
 *   stage: HTMLElement,
 *   hud: HTMLElement,
 *   renderer: any,
 *   haptics: ReturnType<import('../native-haptics.js').createNativeHaptics>,
 *   setStatus?: (t: string) => void,
 * }} opts
 */
export function createGame(opts) {
  const { stage, hud, renderer, haptics, setStatus } = opts;
  const frameEl = document.getElementById('phone-frame');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLOR.bg);

  const frame0 = getFrameSize();
  const camera = new THREE.OrthographicCamera(
    -frame0.width / 2,
    frame0.width / 2,
    frame0.height / 2,
    -frame0.height / 2,
    0.1,
    100,
  );
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);

  const boardView = createBoardView(scene);
  const grid = createGrid();
  const scoreState = createScoreState();

  /** @type {(import('./forms.js').PieceDef|null)[]} */
  let tray = [null, null, null];

  /** @type {null | ReturnType<typeof createDragSession>} */
  let drag = null;

  /** @type {null | { originRow: number, originCol: number, valid: boolean, preclear: any }} */
  let hover = null;

  let inputLockedUntil = 0;
  let gameOver = false;
  let layout = computeLayout(frame0, readSafeAreaInsets());
  boardView.rebuild(layout);

  const ghostPolicy = createGhostPolicy({
    grid,
    getLayout: () => layout,
    getTune,
  });
  const ghostHaptics = createGhostHaptics(haptics, getTune);

  const scoreEl = hud.querySelector('[data-game-score]');
  const bestEl = hud.querySelector('[data-best-score]');
  const phaseEl = hud.querySelector('[data-game-phase]');
  const statusEl = hud.querySelector('#status');
  const overlayEl = hud.querySelector('[data-game-over]');
  const finalScoreEl = hud.querySelector('[data-final-score]');
  const restartBtn = hud.querySelector('[data-restart]');

  let bestScore = 0;
  try {
    bestScore = Number(localStorage.getItem('bb_best') || 0) || 0;
  } catch {
    bestScore = 0;
  }

  function fillTray() {
    const next = generateTray(grid);
    tray = next.slice(0, 3);
    while (tray.length < 3) tray.push(null);
  }

  function trayEmpty() {
    return tray.every((p) => p == null);
  }

  function setGameOver(on) {
    gameOver = on;
    if (overlayEl) {
      overlayEl.hidden = !on;
      overlayEl.setAttribute('aria-hidden', on ? 'false' : 'true');
    }
    if (on) {
      if (finalScoreEl) finalScoreEl.textContent = String(scoreState.score);
      if (scoreState.score > bestScore) {
        bestScore = scoreState.score;
        try {
          localStorage.setItem('bb_best', String(bestScore));
        } catch {
          /* ignore */
        }
      }
      syncHud();
    }
  }

  function checkGameOver() {
    if (trayEmpty()) return;
    if (!anyTrayPieceFits(grid, tray)) {
      setGameOver(true);
    }
  }

  function restart() {
    drag = null;
    hover = null;
    grid.reset();
    scoreState.reset();
    clearPendingDealPlan();
    fillTray();
    setGameOver(false);
    paint();
    updateStatus();
  }

  function syncHud() {
    if (scoreEl) scoreEl.textContent = String(scoreState.score);
    if (bestEl) bestEl.textContent = String(Math.max(bestScore, scoreState.score));
    if (statusEl) statusEl.hidden = !SHOW_DEBUG_STATUS;
    if (phaseEl) phaseEl.hidden = !SHOW_DEBUG_STATUS;
    applyScoreUi();
  }

  /** 分数字号 / 垂直位置（CSS 变量，真机调参即时生效） */
  function applyScoreUi() {
    const t = getTune();
    const frame = getFrameSize();
    const fontPx = Math.max(12, Number(t.UI_SCORE_FONT_PX) || 65);
    const shiftFrac = Number(t.UI_SCORE_OFFSET_Y) || 0;
    const shiftPx = shiftFrac * (frame.height || 0);
    const root = hud || document.documentElement;
    root.style.setProperty('--ui-score-font', `${fontPx}px`);
    root.style.setProperty('--ui-score-shift', `${shiftPx}px`);
  }

  function paint() {
    boardView.render({
      layout,
      cells: grid.cells,
      tray,
      drag: drag
        ? {
            piece: drag.piece,
            frameX: drag.frameX,
            frameY: drag.frameY,
            scale: drag.scale,
            trayIndex: drag.trayIndex,
          }
        : null,
      hover,
    });
    syncHud();
  }

  function framePointFromClient(clientX, clientY) {
    const rect = frameEl.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  /** 正版：底栏三等分区优先，再回退块包围盒 */
  function hitTrayIndex(fx, fy) {
    for (const slot of layout.tray.slots) {
      if (
        fx >= slot.x &&
        fx <= slot.x + slot.w &&
        fy >= slot.y &&
        fy <= slot.y + slot.h &&
        tray[slot.index]
      ) {
        return slot.index;
      }
    }
    const tc = layout.tray.cell;
    const slop = Math.max(layout.cell * FEEL_HIT_SLOP, tc * 0.4);
    let best = -1;
    let bestDist = Infinity;
    for (let i = 0; i < tray.length; i++) {
      const piece = tray[i];
      const slot = layout.tray.slots[i];
      if (!piece || !slot) continue;
      const { rows, cols } = matrixSize(piece.matrix);
      const tw = cols * tc;
      const th = rows * tc;
      const left = slot.cx - tw / 2 - slop;
      const right = slot.cx + tw / 2 + slop;
      const top = slot.cy - th / 2 - slop;
      const bottom = slot.cy + th / 2 + slop;
      if (fx >= left && fx <= right && fy >= top && fy <= bottom) {
        const d = (fx - slot.cx) ** 2 + (fy - slot.cy) ** 2;
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
    }
    return best;
  }

  function resolveHover() {
    if (!drag) {
      hover = null;
      return;
    }
    hover = ghostPolicy.resolve(
      drag,
      drag.frameX,
      drag.frameY,
      drag.piece.matrix,
    );
    ghostHaptics.onHover(drag, hover);
  }

  function updateDragFromPointer(fx, fy) {
    if (!drag) return;
    samplePointer(drag, fx, fy, layout, getTune);
    chaseTargetOnPointer(drag, getTune);
    resolveHover();
    paint();
  }

  function tickDragFrame() {
    if (!drag) return;
    tickSmooth(drag, getTune);
    resolveHover();
    paint();
  }

  function lockInput(ms) {
    inputLockedUntil = performance.now() + ms;
  }

  function isLocked() {
    return performance.now() < inputLockedUntil;
  }

  function onPointerDown(e) {
    if (gameOver || isLocked() || drag) return;
    if (e.button != null && e.button !== 0) return;

    const { x: fx, y: fy } = framePointFromClient(e.clientX, e.clientY);
    const idx = hitTrayIndex(fx, fy);
    if (idx < 0 || !tray[idx]) return;

    e.preventDefault();
    stage.setPointerCapture?.(e.pointerId);

    const piece = tray[idx];
    drag = createDragSession({
      layout,
      piece,
      trayIndex: idx,
      pointerId: e.pointerId,
      fx,
      fy,
      getTune,
    });
    // P7/P9：固定拿起、无投影、无震动
    hover = null;
    paint();
  }

  function onPointerMove(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    e.preventDefault();
    const { x: fx, y: fy } = framePointFromClient(e.clientX, e.clientY);
    updateDragFromPointer(fx, fy);
  }

  function onPointerUp(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    e.preventDefault();
    try {
      stage.releasePointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }

    const active = drag;
    if (active) {
      hover = ghostPolicy.resolve(
        active,
        active.frameX,
        active.frameY,
        active.piece.matrix,
      );
    }
    const h = hover;
    drag = null;

    if (h?.valid) {
      const cellsPlaced = countCells(active.piece.matrix);
      grid.place(
        active.piece.matrix,
        h.originRow,
        h.originCol,
        active.piece.cellColors || active.piece.color,
      );
      tray[active.trayIndex] = null;

      const lines = grid.findFullLines();
      let linesCleared = 0;
      if (lines.count > 0) {
        linesCleared = grid.clearLines(lines);
        lockInput(Math.max(FEEL_INPUT_LOCK_MS, FEEL_CLEAR_MS));
      } else {
        lockInput(FEEL_COMMIT_MS);
      }

      scoreState.onPlace({
        cellsPlaced,
        linesCleared,
        boardEmpty: grid.isEmpty(),
      });

      if (trayEmpty()) {
        scoreState.onTrayRefill();
        fillTray();
      }
      checkGameOver();
    } else {
      lockInput(FEEL_REJECT_MS);
    }

    hover = null;
    paint();
    updateStatus();
  }

  function onPointerCancel(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    drag = null;
    hover = null;
    paint();
  }

  function updateStatus() {
    if (!SHOW_DEBUG_STATUS) {
      setStatus?.('');
      if (statusEl) statusEl.hidden = true;
      return;
    }
    if (statusEl) statusEl.hidden = false;
    const size = getFrameSize();
    setStatus?.(
      `debug\n` +
        `platform: ${Capacitor.getPlatform()} | haptics: ${haptics.isNativeIos() ? 'ios' : 'off'}\n` +
        `frame: ${Math.round(size.width)}×${Math.round(size.height)} · cell ${layout.cell.toFixed(1)}\n` +
        `deal: ${lastDealMeta.phase} (base ${lastDealMeta.basePhase}) ` +
        `fill ${(lastDealMeta.fill * 100).toFixed(0)}% instant ${lastDealMeta.instant} ` +
        `${lastDealMeta.mode} #${lastDealMeta.attempts}` +
        (lastDealMeta.clearPlanLen != null
          ? ` clear≤${lastDealMeta.clearPlanLen}`
          : '') +
        (gameOver ? '\nGAME OVER' : ''),
    );
  }

  function relayout() {
    applySafeAreaCssVars(isNativeApp());
    const frame = getFrameSize();
    const safe = readSafeAreaInsets();
    const size = resizeToFrame(renderer, null);
    const w = size.width;
    const h = size.height;
    if (w < 2 || h < 2) return;

    camera.left = -w / 2;
    camera.right = w / 2;
    camera.top = h / 2;
    camera.bottom = -h / 2;
    camera.updateProjectionMatrix();

    layout = computeLayout(frame, safe);
    boardView.rebuild(layout);
    drag = null;
    hover = null;
    applyScoreUi();
    paint();
    updateStatus();
  }

  function applyTune(opts = {}) {
    applyScoreUi();
    if (opts.layout !== false) {
      relayout();
      return;
    }
    paint();
    updateStatus();
  }

  // init
  fillTray();
  boardView.rebuild(layout);
  setGameOver(false);
  paint();
  relayout();

  const pointerTarget = frameEl || stage;
  pointerTarget.style.touchAction = 'none';
  pointerTarget.addEventListener('pointerdown', onPointerDown);
  pointerTarget.addEventListener('pointermove', onPointerMove);
  pointerTarget.addEventListener('pointerup', onPointerUp);
  pointerTarget.addEventListener('pointercancel', onPointerCancel);

  if (restartBtn) {
    restartBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      restart();
    });
  }

  let running = true;
  renderer.setAnimationLoop(() => {
    if (!running) return;
    if (drag) tickDragFrame();
    renderer.render(scene, camera);
  });

  return {
    scene,
    camera,
    getLayout: () => layout,
    relayout,
    applyTune,
    restart,
    dispose() {
      running = false;
      renderer.setAnimationLoop(null);
      pointerTarget.removeEventListener('pointerdown', onPointerDown);
      pointerTarget.removeEventListener('pointermove', onPointerMove);
      pointerTarget.removeEventListener('pointerup', onPointerUp);
      pointerTarget.removeEventListener('pointercancel', onPointerCancel);
      boardView.dispose();
    },
  };
}
