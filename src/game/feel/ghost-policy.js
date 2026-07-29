/**
 * 投影策略（P1–P6,P8 + max-lag）：
 * 底排 engage、free±1、快精/慢贴边、轴锁、
 * **影相对 free 切比雪夫距离 ≤ FEEL_GHOST_MAX_LAG**（默认 ~1，影不许甩块）。
 * 不处理渲染与震动。
 */
import { FEEL_PRECLEAR_HIGHLIGHT, GRID } from '../defaults.js';
import { matrixSize } from '../forms.js';

/**
 * @param {object} deps
 * @param {ReturnType<import('../grid.js').createGrid>} deps.grid
 * @param {() => ReturnType<import('../layout.js').computeLayout>} deps.getLayout
 * @param {() => import('../tune.js').TuneState} deps.getTune
 */
export function createGhostPolicy(deps) {
  const { grid, getLayout, getTune } = deps;

  function shapeBottomRow(matrix) {
    const { rows, cols } = matrixSize(matrix);
    for (let r = rows - 1; r >= 0; r--) {
      for (let c = 0; c < cols; c++) {
        if (matrix[r][c]) return r;
      }
    }
    return Math.max(0, rows - 1);
  }

  function isBoardEngaged(originX, originY, matrix) {
    const layout = getLayout();
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

  function freeSnapFromShapeBottom(originX, originY, matrix) {
    const layout = getLayout();
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

    const bottomCenterX = originX + ((minC + maxC + 1) / 2) * cell;
    const midC = (minC + maxC) / 2;
    const freeMidColF = (bottomCenterX - gx) / cell - 0.5;
    const freeColF = freeMidColF - midC;

    const bottomCenterY = originY + bottomR * cell + cell / 2;
    const freeBottomRowF = (bottomCenterY - gy - cell / 2) / cell;
    const freeRowF = freeBottomRowF - bottomR;

    return { freeColF, freeRowF, bottomR };
  }

  function maxLagCells() {
    const v = getTune().FEEL_GHOST_MAX_LAG;
    return Number.isFinite(v) ? Math.max(0.05, v) : 1;
  }

  /** 影格相对 free 的切比雪夫距离（格） */
  function lagToCell(freeColF, freeRowF, row, col) {
    return Math.max(Math.abs(freeColF - col), Math.abs(freeRowF - row));
  }

  function makeValidHover(row, col, matrix) {
    let preclear = { rows: [], cols: [], count: 0 };
    if (FEEL_PRECLEAR_HIGHLIGHT) {
      preclear = grid.previewClearLines(matrix, row, col);
    }
    return { originRow: row, originCol: col, valid: true, preclear };
  }

  function canStep(matrix, row, col, dRow, dCol) {
    return grid.fits(matrix, row + dRow, col + dCol);
  }

  /**
   * @param {object} session drag session
   */
  function isGhostFastMode(session) {
    const tune = getTune();
    const speed = session.lastPointerSpeed || 0;
    const vref = Math.max(1, tune.FEEL_POINTER_SPEED_REF ?? 8);
    const enter = vref * (tune.FEEL_GHOST_FAST_SPEED_RATIO ?? 0.45);
    const exit = enter * (tune.FEEL_GHOST_FAST_EXIT_RATIO ?? 0.55);
    if (session.ghostFastMode) {
      if (speed < exit) session.ghostFastMode = false;
    } else if (speed >= enter) {
      session.ghostFastMode = true;
    }
    return !!session.ghostFastMode;
  }

  function thresholdsAt(matrix, row, col) {
    const { FEEL_GHOST_OPEN_SNAP: open, FEEL_GHOST_EDGE_HOLD: edge } =
      getTune();
    return {
      left: canStep(matrix, row, col, 0, -1) ? open : edge,
      right: canStep(matrix, row, col, 0, 1) ? open : edge,
      up: canStep(matrix, row, col, -1, 0) ? open : edge,
      down: canStep(matrix, row, col, 1, 0) ? open : edge,
    };
  }

  /**
   * free 附近合法格；仅接受 lag ≤ MAX_LAG 的候选。
   * 不再「钳回盘边」救命（会把出盘的 free 吸到远处格）。
   * @param {object} session
   */
  function hoverFreeSnap(session, freeColF, freeRowF, matrix) {
    const { rows, cols } = matrixSize(matrix);
    const maxCol = GRID - cols;
    const maxRow = GRID - rows;
    const maxLag = maxLagCells();
    let col = Math.round(freeColF);
    let row = Math.round(freeRowF);

    const tryAt = (r, c) => {
      if (r < 0 || c < 0 || r > maxRow || c > maxCol) return null;
      if (lagToCell(freeColF, freeRowF, r, c) > maxLag) return null;
      if (!grid.fits(matrix, r, c)) return null;
      session.sticky = { row: r, col: c };
      return makeValidHover(r, c, matrix);
    };

    let hit = tryAt(row, col);
    if (hit) return hit;

    /** @type {[number, number, number][]} dr, dc, dist for nearest-first */
    const candidates = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const r = row + dr;
        const c = col + dc;
        const lag = lagToCell(freeColF, freeRowF, r, c);
        if (lag > maxLag) continue;
        candidates.push([r, c, lag]);
      }
    }
    candidates.sort((a, b) => a[2] - b[2]);
    for (const [r, c] of candidates) {
      hit = tryAt(r, c);
      if (hit) return hit;
    }

    return null;
  }

  function stickyLagCells(freeColF, freeRowF, s) {
    return lagToCell(freeColF, freeRowF, s.row, s.col);
  }

  function clearSticky(session) {
    session.sticky = null;
    session.axisLock = null;
  }

  /**
   * 最终闸门：影不得离 free 超过 MAX_LAG。
   * @returns {null | object}
   */
  function gateByMaxLag(session, freeColF, freeRowF, hover) {
    if (!hover) {
      clearSticky(session);
      return null;
    }
    const lag = lagToCell(
      freeColF,
      freeRowF,
      hover.originRow,
      hover.originCol,
    );
    if (lag > maxLagCells()) {
      clearSticky(session);
      return null;
    }
    return hover;
  }

  function resolveDominantAxis(session, freeColF, freeRowF, s) {
    const dCol = Math.abs(freeColF - s.col);
    const dRow = Math.abs(freeRowF - s.row);
    if (dCol > 1.25 || dRow > 1.25) {
      session.axisLock = null;
      return 'both';
    }
    const bias = getTune().FEEL_AXIS_DOMINANCE;
    const prev = session.axisLock;

    if (dCol > dRow + bias) {
      session.axisLock = 'h';
      return 'h';
    }
    if (dRow > dCol + bias) {
      session.axisLock = 'v';
      return 'v';
    }
    if (prev === 'h' || prev === 'v') return prev;
    return 'both';
  }

  /**
   * @param {object} session
   * @param {number} originX visual origin
   * @param {number} originY
   * @param {number[][]} matrix
   * @returns {null | { originRow: number, originCol: number, valid: boolean, preclear: any }}
   */
  function resolve(session, originX, originY, matrix) {
    if (!isBoardEngaged(originX, originY, matrix)) {
      clearSticky(session);
      return null;
    }

    const { freeColF, freeRowF } = freeSnapFromShapeBottom(
      originX,
      originY,
      matrix,
    );
    const maxLag = maxLagCells();

    const lag =
      session.sticky != null
        ? stickyLagCells(freeColF, freeRowF, session.sticky)
        : 999;

    // sticky 已甩开超过 maxLag → 不许继续钉影，走 free 或 null
    if (session.sticky != null && lag > maxLag) {
      const snapped = hoverFreeSnap(session, freeColF, freeRowF, matrix);
      return gateByMaxLag(session, freeColF, freeRowF, snapped);
    }

    if (isGhostFastMode(session) || lag > 1.15) {
      const snapped = hoverFreeSnap(session, freeColF, freeRowF, matrix);
      return gateByMaxLag(session, freeColF, freeRowF, snapped);
    }

    if (!session.sticky) {
      const snapped = hoverFreeSnap(session, freeColF, freeRowF, matrix);
      return gateByMaxLag(session, freeColF, freeRowF, snapped);
    }

    const s = session.sticky;
    if (!grid.fits(matrix, s.row, s.col)) {
      clearSticky(session);
      const snapped = hoverFreeSnap(session, freeColF, freeRowF, matrix);
      return gateByMaxLag(session, freeColF, freeRowF, snapped);
    }

    if (lag > 0.95) {
      const snapped = hoverFreeSnap(session, freeColF, freeRowF, matrix);
      return gateByMaxLag(session, freeColF, freeRowF, snapped);
    }

    const axis = resolveDominantAxis(session, freeColF, freeRowF, s);
    const th = thresholdsAt(matrix, s.row, s.col);
    let targetCol = s.col;
    let targetRow = s.row;

    if (axis === 'h' || axis === 'both') {
      if (freeColF >= s.col + th.right) targetCol = s.col + 1;
      else if (freeColF <= s.col - th.left) targetCol = s.col - 1;
    }
    if (axis === 'v' || axis === 'both') {
      if (freeRowF >= s.row + th.down) targetRow = s.row + 1;
      else if (freeRowF <= s.row - th.up) targetRow = s.row - 1;
    }

    if (targetCol === s.col && targetRow === s.row) {
      return gateByMaxLag(
        session,
        freeColF,
        freeRowF,
        makeValidHover(s.row, s.col, matrix),
      );
    }

    const candidates = [
      [targetRow, targetCol],
      [s.row, targetCol],
      [targetRow, s.col],
    ];
    for (const [r, c] of candidates) {
      if (r === s.row && c === s.col) continue;
      if (!grid.fits(matrix, r, c)) continue;
      if (lagToCell(freeColF, freeRowF, r, c) > maxLag) continue;
      session.sticky = { row: r, col: c };
      return gateByMaxLag(
        session,
        freeColF,
        freeRowF,
        makeValidHover(r, c, matrix),
      );
    }

    const towardBlocked =
      (targetCol > s.col && !canStep(matrix, s.row, s.col, 0, 1)) ||
      (targetCol < s.col && !canStep(matrix, s.row, s.col, 0, -1)) ||
      (targetRow > s.row && !canStep(matrix, s.row, s.col, 1, 0)) ||
      (targetRow < s.row && !canStep(matrix, s.row, s.col, -1, 0));
    // 贴边粘滞也不得超过 maxLag（不再用硬编码 1.0）
    if (towardBlocked && lag <= maxLag) {
      return gateByMaxLag(
        session,
        freeColF,
        freeRowF,
        makeValidHover(s.row, s.col, matrix),
      );
    }

    const snapped = hoverFreeSnap(session, freeColF, freeRowF, matrix);
    return gateByMaxLag(session, freeColF, freeRowF, snapped);
  }

  return {
    resolve,
    isBoardEngaged,
    freeSnapFromShapeBottom,
    shapeBottomRow,
    lagToCell,
    maxLagCells,
  };
}
