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
  FEEL_CLEAR_STAGGER,
  FEEL_COMMIT_MS,
  FEEL_DEATH_FLASH_MS,
  FEEL_DEATH_PAUSE_MS,
  FEEL_DEATH_ROW_MS,
  FEEL_HIT_SLOP,
  FEEL_INPUT_LOCK_MS,
  FEEL_REJECT_MS,
  GRID,
  PIECE_PALETTE,
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

  /**
   * 落子消行动画：先播特效再真正 clearLines
   * @type {null | {
   *   lines: { rows: number[], cols: number[], count: number },
   *   cells: { row: number, col: number, color: number, delay01: number, spin: number }[],
   *   sweep: { fromLeft: boolean, fromTop: boolean, epicRow: number, epicCol: number },
   *   start: number,
   *   duration: number,
   *   cellsPlaced: number,
   * }}
   */
  let clearFx = null;

  /**
   * 死亡演出：闪红×2 → 自下而上填满 → 停顿 → 自上而下露出死亡盘面 → 结算
   * @type {null | {
   *   phase: 'flash' | 'fill' | 'pause' | 'reveal',
   *   start: number,
   *   rowMs: number,
   *   pauseMs: number,
   *   flashMs: number,
   *   snapshot: (number|null)[][],
   *   fillers: (number|null)[][],
   *   displayCells: (number|null)[][],
   *   displayOpacity: number[][],
   * }}
   */
  let deathFx = null;

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
  // 结算/闪红层在 phone-frame 下，不在 #hud 内
  const overlayRoot = frameEl || hud;
  const overlayEl = overlayRoot.querySelector('[data-game-over]');
  const deathFlashEl = overlayRoot.querySelector('[data-death-flash]');
  const finalScoreEl = overlayRoot.querySelector('[data-final-score]');
  const restartBtn = overlayRoot.querySelector('[data-restart]');

  let bestScore = 0;
  try {
    bestScore = Number(localStorage.getItem('bb_best') || 0) || 0;
  } catch {
    bestScore = 0;
  }

  function fillTray() {
    const next = generateTray(grid, { score: scoreState.score });
    // 槽位布局仍为 3 列；E2 tray1 时仅填前 n 槽，其余 null
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
      if (on) {
        overlayEl.classList.add('is-visible');
      } else {
        overlayEl.classList.remove('is-visible');
      }
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

  /** @returns {(number|null)[][]} */
  function cloneBoard(src) {
    return src.map((row) => row.slice());
  }

  /** 为空槽预生成填充色（死亡波用） */
  function buildDeathFillers(snapshot) {
    /** @type {(number|null)[][]} */
    const fillers = [];
    for (let r = 0; r < GRID; r++) {
      fillers[r] = [];
      for (let c = 0; c < GRID; c++) {
        if (snapshot[r][c] != null) {
          fillers[r][c] = null;
        } else {
          const idx = Math.floor(Math.random() * PIECE_PALETTE.length);
          fillers[r][c] = PIECE_PALETTE[idx] ?? 0x4da3ff;
        }
      }
    }
    return fillers;
  }

  function easeSmooth(t) {
    const x = Math.min(1, Math.max(0, t));
    return x * x * (3 - 2 * x);
  }

  /**
   * @param {'fill' | 'reveal' | 'pause'} phase
   * @param {number} progress 连续进度 0..GRID（整数部分=已完成排，小数=当前排淡入/淡出）
   * @param {(number|null)[][]} snapshot
   * @param {(number|null)[][]} fillers
   * @returns {{ cells: (number|null)[][], opacity: number[][] }}
   */
  function buildDeathDisplay(phase, progress, snapshot, fillers) {
    const p = Math.max(0, Math.min(GRID, progress));
    const done = Math.floor(p);
    const frac = easeSmooth(p - done);

    /** @type {(number|null)[][]} */
    const cells = [];
    /** @type {number[][]} */
    const opacity = [];

    for (let r = 0; r < GRID; r++) {
      cells[r] = [];
      opacity[r] = [];
      for (let c = 0; c < GRID; c++) {
        const snap = snapshot[r][c];
        if (phase === 'fill') {
          // 自下而上：底部 done 行满；第 done 行正在淡入
          const d = GRID - 1 - r; // 0=底排
          if (snap != null) {
            cells[r][c] = snap;
            opacity[r][c] = 1;
          } else if (d < done) {
            cells[r][c] = fillers[r][c];
            opacity[r][c] = 1;
          } else if (d === done && done < GRID && frac > 0.001) {
            cells[r][c] = fillers[r][c];
            opacity[r][c] = frac;
          } else {
            cells[r][c] = null;
            opacity[r][c] = 1;
          }
        } else if (phase === 'pause') {
          if (snap != null) {
            cells[r][c] = snap;
            opacity[r][c] = 1;
          } else {
            cells[r][c] = fillers[r][c];
            opacity[r][c] = 1;
          }
        } else {
          // 自上而下揭开：顶部 done 行已是死亡盘；第 done 行 filler 淡出
          if (snap != null) {
            cells[r][c] = snap;
            opacity[r][c] = 1;
          } else if (r < done) {
            cells[r][c] = null;
            opacity[r][c] = 1;
          } else if (r === done && done < GRID) {
            // 淡出 filler
            const op = 1 - frac;
            if (op < 0.02) {
              cells[r][c] = null;
              opacity[r][c] = 1;
            } else {
              cells[r][c] = fillers[r][c];
              opacity[r][c] = op;
            }
          } else {
            cells[r][c] = fillers[r][c];
            opacity[r][c] = 1;
          }
        }
      }
    }
    return { cells, opacity };
  }

  function setDeathFlash(on) {
    if (!deathFlashEl) return;
    deathFlashEl.classList.toggle('is-active', !!on);
    deathFlashEl.setAttribute('aria-hidden', on ? 'false' : 'true');
    if (on) {
      // 重触发 CSS 动画
      deathFlashEl.classList.remove('is-active');
      // force reflow
      void deathFlashEl.offsetWidth;
      deathFlashEl.classList.add('is-active');
    }
  }

  function startDeathFx() {
    if (deathFx || gameOver) return;
    drag = null;
    hover = null;
    const snapshot = cloneBoard(grid.cells);
    const fillers = buildDeathFillers(snapshot);
    const rowMs = FEEL_DEATH_ROW_MS;
    const pauseMs = FEEL_DEATH_PAUSE_MS;
    const flashMs = FEEL_DEATH_FLASH_MS;
    const disp = buildDeathDisplay('fill', 0, snapshot, fillers);
    deathFx = {
      phase: 'flash',
      start: performance.now(),
      rowMs,
      pauseMs,
      flashMs,
      snapshot,
      fillers,
      displayCells: disp.cells,
      displayOpacity: disp.opacity,
    };
    setDeathFlash(true);
    // 结算数据先写好，动画结束后再亮 overlay
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
    paint();
  }

  function finishDeathFx() {
    deathFx = null;
    setDeathFlash(false);
    setGameOver(true);
    paint();
  }

  function tickDeathFx() {
    if (!deathFx) return;
    const now = performance.now();
    const { phase, start, rowMs, pauseMs, flashMs, snapshot, fillers } = deathFx;
    const fillDur = GRID * rowMs;

    // 开场全屏闪红两次，再开始上升填块
    if (phase === 'flash') {
      const elapsed = now - start;
      // 闪红期间保持死亡盘面
      const hold = buildDeathDisplay('fill', 0, snapshot, fillers);
      deathFx.displayCells = hold.cells;
      deathFx.displayOpacity = hold.opacity;
      if (elapsed >= (flashMs ?? FEEL_DEATH_FLASH_MS)) {
        setDeathFlash(false);
        deathFx.phase = 'fill';
        deathFx.start = now;
      }
      paint();
      return;
    }

    if (phase === 'fill') {
      const elapsed = now - start;
      // 连续进度 0..GRID（含排内淡入）
      const progress = Math.min(GRID, elapsed / rowMs);
      const disp = buildDeathDisplay('fill', progress, snapshot, fillers);
      deathFx.displayCells = disp.cells;
      deathFx.displayOpacity = disp.opacity;
      if (elapsed >= fillDur) {
        const full = buildDeathDisplay('pause', GRID, snapshot, fillers);
        deathFx.displayCells = full.cells;
        deathFx.displayOpacity = full.opacity;
        deathFx.phase = 'pause';
        deathFx.start = now;
      }
      paint();
      return;
    }

    if (phase === 'pause') {
      const full = buildDeathDisplay('pause', GRID, snapshot, fillers);
      deathFx.displayCells = full.cells;
      deathFx.displayOpacity = full.opacity;
      if (now - start >= pauseMs) {
        deathFx.phase = 'reveal';
        deathFx.start = now;
      }
      paint();
      return;
    }

    // reveal：自上而下淡出填充，露出死亡盘
    {
      const elapsed = now - start;
      const progress = Math.min(GRID, elapsed / rowMs);
      const disp = buildDeathDisplay('reveal', progress, snapshot, fillers);
      deathFx.displayCells = disp.cells;
      deathFx.displayOpacity = disp.opacity;
      if (elapsed >= fillDur) {
        const final = buildDeathDisplay('reveal', GRID, snapshot, fillers);
        deathFx.displayCells = final.cells;
        deathFx.displayOpacity = final.opacity;
        paint();
        finishDeathFx();
        return;
      }
      paint();
    }
  }

  function checkGameOver() {
    if (trayEmpty() || deathFx || gameOver) return;
    if (!anyTrayPieceFits(grid, tray)) {
      startDeathFx();
    }
  }

  function restart() {
    drag = null;
    hover = null;
    clearFx = null;
    deathFx = null;
    setDeathFlash(false);
    ghostHaptics.onClearFxEnd?.();
    boardView.clearAllDebris?.();
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
      cells: deathFx?.displayCells ?? grid.cells,
      cellOpacity: deathFx?.displayOpacity ?? null,
      tray: deathFx ? [null, null, null] : tray,
      drag:
        deathFx || !drag
          ? null
          : {
              piece: drag.piece,
              frameX: drag.frameX,
              frameY: drag.frameY,
              scale: drag.scale,
              trayIndex: drag.trayIndex,
            },
      hover: deathFx ? null : hover,
      clearFx: deathFx ? null : clearFx,
      nowMs: performance.now(),
    });
    syncHud();
  }

  /**
   * 收集将消格；缩放/扫光沿行或列「一边→另一边」。
   * 从哪一边起：看本次落子质心更靠近哪条边（左/右、上/下）。
   * @param {{ rows: number[], cols: number[] }} lines
   * @param {number[][]} matrix 刚落下的 polyomino
   * @param {number} originRow
   * @param {number} originCol
   * @returns {{
   *   cells: { row: number, col: number, color: number, delay01: number, spin: number }[],
   *   sweep: { fromLeft: boolean, fromTop: boolean, epicRow: number, epicCol: number },
   * }}
   */
  function collectLineCells(lines, matrix, originRow, originCol) {
    /** @type {{ row: number, col: number, color: number, delay01: number, spin: number }[]} */
    const out = [];
    const seen = new Set();
    const add = (r, c) => {
      const k = `${r},${c}`;
      if (seen.has(k)) return;
      seen.add(k);
      const color = grid.cells[r][c];
      if (color == null) return;
      out.push({ row: r, col: c, color, delay01: 0, spin: 0 });
    };
    for (const r of lines.rows) for (let c = 0; c < 8; c++) add(r, c);
    for (const c of lines.cols) for (let r = 0; r < 8; r++) add(r, c);

    /** @type {{ r: number, c: number }[]} */
    const anchors = [];
    if (matrix?.length) {
      for (let r = 0; r < matrix.length; r++) {
        for (let c = 0; c < matrix[r].length; c++) {
          if (matrix[r][c]) anchors.push({ r: originRow + r, c: originCol + c });
        }
      }
    }
    if (!anchors.length) anchors.push({ r: originRow, c: originCol });

    let epicRow = 0;
    let epicCol = 0;
    for (const a of anchors) {
      epicRow += a.r;
      epicCol += a.c;
    }
    epicRow /= anchors.length;
    epicCol /= anchors.length;

    const mid = (GRID - 1) / 2;
    // 更靠近哪一边，就从那一边扫向对边
    const fromLeft = epicCol <= mid;
    const fromTop = epicRow <= mid;
    // 旋转与扫过方向一致：左→右/上→下 为负 Z（顺时针感），对边为正
    const spinRow = fromLeft ? -1 : 1;
    const spinCol = fromTop ? -1 : 1;

    const rowSet = new Set(lines.rows);
    const colSet = new Set(lines.cols);
    const last = GRID - 1;
    const stagger = Math.min(0.85, Math.max(0, FEEL_CLEAR_STAGGER));

    for (const cell of out) {
      /** @type {{ t: number, spin: number }[]} */
      const axis = [];
      // 行：左→右 或 右→左
      if (rowSet.has(cell.row)) {
        axis.push({
          t: fromLeft ? cell.col / last : (last - cell.col) / last,
          spin: spinRow,
        });
      }
      // 列：上→下 或 下→上
      if (colSet.has(cell.col)) {
        axis.push({
          t: fromTop ? cell.row / last : (last - cell.row) / last,
          spin: spinCol,
        });
      }
      // 行列交叉格取较早一侧，旋转跟该侧方向
      if (!axis.length) {
        cell.delay01 = 0;
        cell.spin = 0;
      } else {
        let best = axis[0];
        for (let i = 1; i < axis.length; i++) {
          if (axis[i].t < best.t) best = axis[i];
        }
        cell.delay01 = best.t * stagger;
        cell.spin = best.spin;
      }
    }
    out.sort((a, b) => a.delay01 - b.delay01 || a.row - b.row || a.col - b.col);
    return {
      cells: out,
      sweep: { fromLeft, fromTop, epicRow, epicCol },
    };
  }

  function finishClearFx() {
    if (!clearFx) return;
    const { lines, cellsPlaced } = clearFx;
    const linesCleared = grid.clearLines(lines);
    clearFx = null;
    // 不强制掐断连续震：时长由 FEEL_HAPTIC_CLEAR_FX_DURATION_MS 自管；
    // 仅 restart 时 onClearFxEnd 强制 stop。
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
    paint();
    updateStatus();
  }

  function tickClearFx() {
    if (!clearFx) return;
    const now = performance.now();
    if (now - clearFx.start >= clearFx.duration) {
      finishClearFx();
      return;
    }
    paint();
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
    return (
      performance.now() < inputLockedUntil ||
      clearFx != null ||
      deathFx != null
    );
  }

  function onPointerDown(e) {
    // 只响应主指针：忽略第二指 / 多指，避免双点触控搅局
    if (e.isPrimary === false) return;
    if (gameOver || deathFx || isLocked() || drag) return;
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
      if (lines.count > 0) {
        // 消行动画 + 消除震动（1 瞬态 + 间隔 + 连续震）；结束后再清格/计分/刷 tray
        {
          const collected = collectLineCells(
            lines,
            active.piece.matrix,
            h.originRow,
            h.originCol,
          );
          clearFx = {
            lines,
            cells: collected.cells,
            sweep: collected.sweep,
            start: performance.now(),
            duration: FEEL_CLEAR_MS,
            cellsPlaced,
          };
          ghostHaptics.onClearFxStart?.();
        }
        lockInput(Math.max(FEEL_INPUT_LOCK_MS, FEEL_CLEAR_MS + 40));
      } else {
        lockInput(FEEL_COMMIT_MS);
        scoreState.onPlace({
          cellsPlaced,
          linesCleared: 0,
          boardEmpty: grid.isEmpty(),
        });
        if (trayEmpty()) {
          scoreState.onTrayRefill();
          fillTray();
        }
        checkGameOver();
      }
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
        `score ${lastDealMeta.score ?? 0} fill ${(lastDealMeta.fill * 100).toFixed(0)}% ` +
        `instant ${lastDealMeta.instant} ` +
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
    if (deathFx) tickDeathFx();
    else if (drag) tickDragFrame();
    else if (clearFx) tickClearFx();
    // 碎裂粒子可活过 clearFx，需继续 paint 做重力
    else if (boardView.hasActiveDebris?.()) paint();
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
