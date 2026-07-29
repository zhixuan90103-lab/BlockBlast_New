/**
 * Block Blast M2：完整规则 + 权重发块 + game over / 重开。
 */
import * as THREE from 'three';
import { Capacitor } from '@capacitor/core';
import { resizeToFrame } from '../create-renderer.js';
import {
  DESIGN_HEIGHT,
  DESIGN_WIDTH,
  applySafeAreaCssVars,
  getFrameSize,
  isNativeApp,
  readSafeAreaInsets,
} from '../viewport.js';
import {
  COLOR,
  FEEL_CLEAR_MS,
  FEEL_COMMIT_MS,
  FEEL_DRAG_OFFSET_X,
  FEEL_HIT_SLOP,
  FEEL_INPUT_LOCK_MS,
  FEEL_PRECLEAR_HIGHLIGHT,
  FEEL_REJECT_MS,
  GRID,
  SHOW_DEBUG_STATUS,
} from './defaults.js';
import { countCells, matrixSize } from './forms.js';
import { createGrid } from './grid.js';
import { computeLayout } from './layout.js';
import { anyTrayPieceFits, generateTray } from './pieces.js';
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

  /** @type {null | {
   *   trayIndex: number,
   *   piece: import('./forms.js').PieceDef,
   *   pointerId: number,
   *   frameX: number,
   *   frameY: number,
   *   scale: number,
   *   sticky: null | { row: number, col: number },
   *   axisLock: null | 'h' | 'v',
   *   startFx: number,
   *   startFy: number,
   *   baseCenterX: number,
   *   baseCenterY: number,
   * }} */
  let drag = null;

  /** @type {null | { originRow: number, originCol: number, valid: boolean, preclear: any }} */
  let hover = null;

  let inputLockedUntil = 0;
  let gameOver = false;
  let layout = computeLayout(frame0, readSafeAreaInsets());
  boardView.rebuild(layout);

  const scoreEl = hud.querySelector('[data-game-score]');
  const comboEl = hud.querySelector('[data-game-combo]');
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

  /**
   * 仅合法投影落格 / 换到**新**格子时震动一次。
   * 参数来自 tune：强度 / 锐度 / 冷却。
   */
  function hapticGhostCellChange(next) {
    if (!drag) return;
    if (!next?.valid) {
      drag.hapticKey = null;
      return;
    }
    const key = `${next.originRow},${next.originCol}`;
    if (drag.hapticKey === key) return;
    const tune = getTune();
    const cooldown = Math.max(0, tune.FEEL_HAPTIC_GHOST_COOLDOWN_MS ?? 48);
    const now = performance.now();
    if (drag.lastHapticAt != null && now - drag.lastHapticAt < cooldown) return;
    drag.hapticKey = key;
    drag.lastHapticAt = now;
    if (haptics.isNativeIos()) {
      void haptics.playTransient({
        intensity: tune.FEEL_HAPTIC_GHOST_INTENSITY ?? 0.6,
        sharpness: tune.FEEL_HAPTIC_GHOST_SHARPNESS ?? 0.5,
      });
    }
  }

  function restart() {
    drag = null;
    hover = null;
    grid.reset();
    scoreState.reset();
    fillTray();
    setGameOver(false);
    paint();
    updateStatus();
  }

  function syncHud() {
    if (scoreEl) scoreEl.textContent = String(scoreState.score);
    if (bestEl) bestEl.textContent = String(Math.max(bestScore, scoreState.score));
    if (comboEl) {
      comboEl.textContent = scoreState.combo > 0 ? String(scoreState.combo) : '';
      const wrap = comboEl.closest?.('.combo-heart');
      if (wrap) wrap.classList.toggle('is-active', scoreState.combo > 0);
    }
    if (statusEl) statusEl.hidden = !SHOW_DEBUG_STATUS;
    if (phaseEl) phaseEl.hidden = !SHOW_DEBUG_STATUS;
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

  /**
   * 正版：底栏三等分区，区内任意点选中该槽块。
   * 区外再回退块包围盒（带 slop）。
   */
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

  /**
   * 拿起固定姿态：块中心 = 槽中心 + 固定抬升（与点击落点无关）。
   * 尺寸恒为 board cell（scale 1）。
   */
  function fixedPickupPose(trayIndex, matrix) {
    const cell = layout.cell;
    const slot = layout.tray.slots[trayIndex];
    const { rows, cols } = matrixSize(matrix);
    const tune = getTune();
    const centerX = slot.cx + FEEL_DRAG_OFFSET_X * cell;
    const centerY = slot.cy + tune.FEEL_DRAG_OFFSET_Y_MIN * cell;
    return {
      baseCenterX: centerX,
      baseCenterY: centerY,
      originX: centerX - (cols * cell) / 2,
      originY: centerY - (rows * cell) / 2,
    };
  }

  /**
   * 拖动：从固定拿起中心 + 指针位移跟手；上移可再加大抬升。
   */
  function dragOriginFromPointer(fx, fy, matrix, dragState) {
    const cell = layout.cell;
    const { rows, cols } = matrixSize(matrix);
    const tune = getTune();

    const upCells = Math.max(0, (dragState.startFy - fy) / cell);
    const horizCells = Math.abs((fx - dragState.startFx) / cell);
    const travel = upCells + horizCells * 0.25;
    const range = tune.FEEL_DRAG_LIFT_TRAVEL_CELLS;
    const tRaw = range > 0 ? travel / range : 1;
    const t = Math.min(1, Math.max(0, tRaw));
    const power = tune.FEEL_DRAG_LIFT_POWER;
    const eased = t === 0 ? 0 : t === 1 ? 1 : t ** power;

    // 在拿起 MIN 抬升之上，再叠 (MAX-MIN)*eased
    const extraLiftCells =
      (tune.FEEL_DRAG_OFFSET_Y_MAX - tune.FEEL_DRAG_OFFSET_Y_MIN) * eased;

    const gain = 1 + (tune.FEEL_DRAG_FOLLOW_GAIN_MAX - 1) * eased;
    const centerX =
      dragState.baseCenterX + (fx - dragState.startFx) * gain;
    const centerY =
      dragState.baseCenterY +
      (fy - dragState.startFy) * gain +
      extraLiftCells * cell;

    return {
      originX: centerX - (cols * cell) / 2,
      originY: centerY - (rows * cell) / 2,
    };
  }

  /** 形状最底一排（有占格）的 matrix 行下标 */
  function shapeBottomRow(matrix) {
    const { rows, cols } = matrixSize(matrix);
    for (let r = rows - 1; r >= 0; r--) {
      for (let c = 0; c < cols; c++) {
        if (matrix[r][c]) return r;
      }
    }
    return Math.max(0, rows - 1);
  }

  /**
   * 底排占格是否已进入棋盘（按形状）。
   * 默认 need=0：最底一排与盘有任意重叠立刻出投影。
   */
  function isBoardEngaged(originX, originY, matrix) {
    const cell = layout.cell;
    const g = layout.grid;
    const need = cell * Math.max(0, getTune().FEEL_BOARD_ENGAGE_OVERLAP ?? 0);
    const bottomR = shapeBottomRow(matrix);
    const { cols } = matrixSize(matrix);
    const eps = 1e-4;

    for (let c = 0; c < cols; c++) {
      if (!matrix[bottomR][c]) continue;
      const left = originX + c * cell;
      const right = left + cell;
      const top = originY + bottomR * cell;
      const bottom = top + cell;
      const ox = Math.min(right, g.x + g.w) - Math.max(left, g.x);
      const oy = Math.min(bottom, g.y + g.h) - Math.max(top, g.y);
      if (ox > eps && oy > need + eps) return true;
    }
    return false;
  }

  /**
   * 以形状底排/底边为锚的连续格坐标（origin 左上角对应 freeColF/freeRowF）。
   * 竖向：底排格心 → 目标行；横向：底排占格几何中心。
   */
  function freeSnapFromShapeBottom(originX, originY, matrix) {
    const cell = layout.cell;
    const gx = layout.grid.x;
    const gy = layout.grid.y;
    const { cols } = matrixSize(matrix);
    const bottomR = shapeBottomRow(matrix);

    let minC = cols;
    let maxC = -1;
    for (let c = 0; c < cols; c++) {
      if (!matrix[bottomR][c]) continue;
      if (c < minC) minC = c;
      if (c > maxC) maxC = c;
    }
    if (maxC < 0) {
      minC = 0;
      maxC = Math.max(0, cols - 1);
    }

    // 底排占格水平中心
    const bottomCenterX = originX + ((minC + maxC + 1) / 2) * cell;
    const midC = (minC + maxC) / 2;
    const freeMidColF = (bottomCenterX - gx) / cell - 0.5;
    const freeColF = freeMidColF - midC;

    // 底排格心 → 对应盘上行，再换算 origin 行
    const bottomCenterY = originY + bottomR * cell + cell / 2;
    const freeBottomRowF = (bottomCenterY - gy - cell / 2) / cell;
    const freeRowF = freeBottomRowF - bottomR;

    return { freeColF, freeRowF, bottomR };
  }

  /** 合法 hover 结果 */
  function makeValidHover(row, col, matrix) {
    let preclear = { rows: [], cols: [], count: 0 };
    if (FEEL_PRECLEAR_HIGHLIGHT) {
      preclear = grid.previewClearLines(matrix, row, col);
    }
    return { originRow: row, originCol: col, valid: true, preclear };
  }

  /**
   * 该方向一步是否仍可放。不可放 =「边缘」
   * （棋盘边界 / 已有块顶住 / 夹缝宽度刚好只够当前块）
   */
  function canStep(matrix, row, col, dRow, dCol) {
    return grid.fits(matrix, row + dRow, col + dCol);
  }

  /**
   * 当前粘滞格上，四向换格阈值：
   * - 开阔（该向一步可放）→ OPEN_SNAP 0.5
   * - 边缘（该向一步不可放）→ EDGE_HOLD 1.5
   */
  function thresholdsAt(matrix, row, col) {
    const { FEEL_GHOST_OPEN_SNAP: open, FEEL_GHOST_EDGE_HOLD: edge } = getTune();
    return {
      left: canStep(matrix, row, col, 0, -1) ? open : edge,
      right: canStep(matrix, row, col, 0, 1) ? open : edge,
      up: canStep(matrix, row, col, -1, 0) ? open : edge,
      down: canStep(matrix, row, col, 1, 0) ? open : edge,
    };
  }

  /**
   * 相对粘滞格的位移主轴：横 > 竖 → 只改列；竖 > 横 → 只改行。
   * 带滞回，避免边界附近轴来回翻。
   * @returns {'h' | 'v' | 'both'}
   */
  function resolveDominantAxis(freeColF, freeRowF, s) {
    const dCol = Math.abs(freeColF - s.col);
    const dRow = Math.abs(freeRowF - s.row);
    const bias = getTune().FEEL_AXIS_DOMINANCE;
    const prev = drag?.axisLock;

    if (dCol > dRow + bias) {
      if (drag) drag.axisLock = 'h';
      return 'h';
    }
    if (dRow > dCol + bias) {
      if (drag) drag.axisLock = 'v';
      return 'v';
    }
    // 接近相等：保持上一主轴；都没有则允许双轴（斜向）
    if (prev === 'h' || prev === 'v') return prev;
    return 'both';
  }

  /**
   * 锚点 → 投影原点（底排锚 + 双阈值粘滞 + 轴向主导）
   * 0) 形状底排未进盘 → 无投影
   * 1) free 坐标按底排/底边算，不是左上角中心
   * 2) 开阔 0.5 / 边缘 1.5；横向主导防乱跳
   */
  function hoverFromDragOrigin(originX, originY, matrix) {
    if (!drag) return null;

    if (!isBoardEngaged(originX, originY, matrix)) {
      drag.sticky = null;
      drag.axisLock = null;
      return null;
    }

    const { freeColF, freeRowF } = freeSnapFromShapeBottom(
      originX,
      originY,
      matrix,
    );

    // —— 尚无粘滞：首次吸附到合法格 ——
    if (!drag.sticky) {
      const col = Math.round(freeColF);
      const row = Math.round(freeRowF);
      if (grid.fits(matrix, row, col)) {
        drag.sticky = { row, col };
        drag.axisLock = null;
        return makeValidHover(row, col, matrix);
      }
      const { rows, cols } = matrixSize(matrix);
      const minCol = 0;
      const maxCol = GRID - cols;
      const minRow = 0;
      const maxRow = GRID - rows;
      let overCol = 0;
      if (freeColF < minCol) overCol = minCol - freeColF;
      else if (freeColF > maxCol) overCol = freeColF - maxCol;
      let overRow = 0;
      if (freeRowF < minRow) overRow = minRow - freeRowF;
      else if (freeRowF > maxRow) overRow = freeRowF - maxRow;
      if (Math.max(overCol, overRow) <= getTune().FEEL_GHOST_EDGE_HOLD) {
        const cCol = Math.max(minCol, Math.min(maxCol, col));
        const cRow = Math.max(minRow, Math.min(maxRow, row));
        if (grid.fits(matrix, cRow, cCol)) {
          drag.sticky = { row: cRow, col: cCol };
          drag.axisLock = null;
          return makeValidHover(cRow, cCol, matrix);
        }
      }
      return null;
    }

    const s = drag.sticky;
    if (!grid.fits(matrix, s.row, s.col)) {
      drag.sticky = null;
      drag.axisLock = null;
      return hoverFromDragOrigin(originX, originY, matrix);
    }

    const axis = resolveDominantAxis(freeColF, freeRowF, s);
    const th = thresholdsAt(matrix, s.row, s.col);
    let targetCol = s.col;
    let targetRow = s.row;

    // 每次最多 ±1 格（勿 Math.round 连跳；减边界来回抖）
    if (axis === 'h' || axis === 'both') {
      if (freeColF >= s.col + th.right) targetCol = s.col + 1;
      else if (freeColF <= s.col - th.left) targetCol = s.col - 1;
    }
    if (axis === 'v' || axis === 'both') {
      if (freeRowF >= s.row + th.down) targetRow = s.row + 1;
      else if (freeRowF <= s.row - th.up) targetRow = s.row - 1;
    }

    if (targetCol === s.col && targetRow === s.row) {
      return makeValidHover(s.row, s.col, matrix);
    }

    // 优先完整目标；否则主轴单步；都非法则取消投影
    const candidates = [
      [targetRow, targetCol],
      [s.row, targetCol],
      [targetRow, s.col],
    ];
    for (const [r, c] of candidates) {
      if (r === s.row && c === s.col) continue;
      if (grid.fits(matrix, r, c)) {
        drag.sticky = { row: r, col: c };
        return makeValidHover(r, c, matrix);
      }
    }

    drag.sticky = null;
    drag.axisLock = null;
    return null;
  }

  function updateDragVisual(fx, fy) {
    if (!drag) return;
    const { originX, originY } = dragOriginFromPointer(
      fx,
      fy,
      drag.piece.matrix,
      drag,
    );
    drag.frameX = originX;
    drag.frameY = originY;
    drag.scale = 1;
    hover = hoverFromDragOrigin(originX, originY, drag.piece.matrix);
    hapticGhostCellChange(hover);
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
    const pose = fixedPickupPose(idx, piece.matrix);
    drag = {
      trayIndex: idx,
      piece,
      pointerId: e.pointerId,
      frameX: pose.originX,
      frameY: pose.originY,
      scale: 1,
      sticky: null,
      axisLock: null,
      startFx: fx,
      startFy: fy,
      baseCenterX: pose.baseCenterX,
      baseCenterY: pose.baseCenterY,
      hapticKey: null,
      lastHapticAt: null,
    };
    // 固定拿起姿态；区内任意点相同。无投影直至拖入盘面；拿起无震动
    hover = null;
    paint();
  }

  function onPointerMove(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    e.preventDefault();
    const { x: fx, y: fy } = framePointFromClient(e.clientX, e.clientY);
    updateDragVisual(fx, fy);
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
      // 回 tray：无震动
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
        `frame: ${Math.round(size.width)}×${Math.round(size.height)} · cell ${layout.cell.toFixed(1)}` +
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

    // 始终按当前 frame + safe + tune 重算（调参依赖此路径）
    layout = computeLayout(frame, safe);
    boardView.rebuild(layout);
    drag = null;
    hover = null;
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
    renderer.render(scene, camera);
  });

  return {
    scene,
    camera,
    getLayout: () => layout,
    relayout,
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
