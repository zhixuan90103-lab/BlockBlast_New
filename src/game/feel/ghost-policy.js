/**
 * 投影策略 — 设计 SSOT：docs/GHOST-DESIGN.md
 *
 * 单一流水线：
 *   engage → free(本体) → intent
 *   → 各向 leave（open L+H / edge L）
 *   → intent 合成唯一目标 → fits？更新 sticky : 保持
 *   → lag > MAX_LAG → 灭影
 *
 * 禁止：失败后 8 邻域乱吸、换格时间锁代替滞回、edge 被速度压成 open。
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

  // —— 几何：底排 / engage / free ——

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

  /** 形状底排中心 → free 浮点原点（格） */
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

  // —— 设计参数（L_open / H_open / L_edge / MAX_LAG）——

  function maxLagCells() {
    const v = getTune().FEEL_GHOST_MAX_LAG;
    return Number.isFinite(v) ? Math.max(0.05, v) : 1.45;
  }

  /** L_open：开阔离开距离（半格中线） */
  function L_open() {
    const v = getTune().FEEL_GHOST_OPEN_SNAP;
    return Number.isFinite(v) ? Math.max(0.35, v) : 0.5;
  }

  /**
   * H_open：开阔施密特半宽（防抖）。
   * 快扫时略减，禁止压到 0。
   */
  function H_open(session) {
    const tune = getTune();
    const base = Number.isFinite(tune.FEEL_GHOST_SNAP_HYST)
      ? tune.FEEL_GHOST_SNAP_HYST
      : 0.09;
    const hMin = Number.isFinite(tune.FEEL_GHOST_SNAP_HYST_MIN)
      ? tune.FEEL_GHOST_SNAP_HYST_MIN
      : 0.07;
    const speed = Math.max(0, session?.lastPointerSpeed || 0);
    const vref = Math.max(1, tune.FEEL_POINTER_SPEED_REF ?? 6);
    const enter = vref * (tune.FEEL_GHOST_FAST_SPEED_RATIO ?? 0.36);
    const t = Math.min(1, speed / Math.max(0.35, enter));
    // 快扫：滞回略收（及时），下限 hMin
    return Math.max(hMin, base * (1 - t * 0.25));
  }

  /** L_edge：卡边离开距离（不被速度压低） */
  function L_edge() {
    const tune = getTune();
    const edge = Number.isFinite(tune.FEEL_GHOST_EDGE_HOLD)
      ? tune.FEEL_GHOST_EDGE_HOLD
      : 1.3;
    const edgeMin = Number.isFinite(tune.FEEL_GHOST_EDGE_MIN)
      ? tune.FEEL_GHOST_EDGE_MIN
      : 1.3;
    return Math.max(edgeMin, edge);
  }

  /** 卡边滞回：设计近 0 */
  function H_edge() {
    return 0.03;
  }

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

  function clearSticky(session) {
    session.sticky = null;
    session.axisLock = null;
  }

  function commitSticky(session, row, col) {
    session.sticky = { row, col };
  }

  // —— intent：h / v / diag / idle ——

  /**
   * @returns {'h' | 'v' | 'diag' | 'idle'}
   */
  function moveIntentClass(session, freeColF, freeRowF) {
    const tune = getTune();
    const diagRatio = Number.isFinite(tune.FEEL_GHOST_DIAG_RATIO)
      ? tune.FEEL_GHOST_DIAG_RATIO
      : 0.45;
    const bias = tune.FEEL_AXIS_DOMINANCE ?? 0.05;
    const eps = 0.05;

    let ix = session.intentDx ?? 0;
    let iy = session.intentDy ?? 0;
    if (session.sticky && Number.isFinite(freeColF) && Number.isFinite(freeRowF)) {
      const fx = freeColF - session.sticky.col;
      const fy = freeRowF - session.sticky.row;
      ix = ix * 0.35 + fx * 0.65;
      iy = iy * 0.35 + fy * 0.65;
    }
    const ax = Math.abs(ix);
    const ay = Math.abs(iy);
    if (Math.max(ax, ay) < eps) return 'idle';
    const ratio = Math.min(ax, ay) / Math.max(ax, ay, 1e-6);
    if (ratio >= diagRatio) return 'diag';
    if (ax > ay + bias) return 'h';
    if (ay > ax + bias) return 'v';
    return 'idle';
  }

  // —— 各向 leave：L + H 施密特 ——

  /**
   * 一轴相对 sticky 的离开请求：-1 / 0 / +1
   * @param {number} freeF
   * @param {number} s
   * @param {boolean} openPos  + 方向邻格可放
   * @param {boolean} openNeg  - 方向邻格可放
   * @param {number} hOpen
   */
  function axisLeave(freeF, s, openPos, openNeg, hOpen) {
    const Lpos = openPos ? L_open() : L_edge();
    const Lneg = openNeg ? L_open() : L_edge();
    const Hpos = openPos ? hOpen : H_edge();
    const Hneg = openNeg ? hOpen : H_edge();
    if (freeF >= s + Lpos + Hpos) return 1;
    if (freeF <= s - Lneg - Hneg) return -1;
    return 0;
  }

  // —— 首次钉格（仅 sticky 空/失效）——

  /**
   * ±1 邻域内 lag 最小且 fits；不做 edge 1.3。
   */
  function firstPin(session, freeColF, freeRowF, matrix) {
    const { rows, cols } = matrixSize(matrix);
    const maxCol = GRID - cols;
    const maxRow = GRID - rows;
    const maxLag = maxLagCells();

    let col0 = Math.round(freeColF);
    let row0 = Math.round(freeRowF);
    col0 = Math.max(0, Math.min(maxCol, col0));
    row0 = Math.max(0, Math.min(maxRow, row0));

    /** @type {{ r: number, c: number, lag: number }[]} */
    const cands = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const r = row0 + dr;
        const c = col0 + dc;
        if (r < 0 || c < 0 || r > maxRow || c > maxCol) continue;
        const lag = lagToCell(freeColF, freeRowF, r, c);
        if (lag > maxLag) continue;
        if (!grid.fits(matrix, r, c)) continue;
        cands.push({ r, c, lag });
      }
    }
    if (!cands.length) {
      clearSticky(session);
      return null;
    }
    cands.sort((a, b) => a.lag - b.lag);
    const best = cands[0];
    commitSticky(session, best.r, best.c);
    return makeValidHover(best.r, best.c, matrix);
  }

  // —— 主入口 ——

  /**
   * @param {object} session
   * @param {number} originX visual origin
   * @param {number} originY
   * @param {number[][]} matrix
   * @returns {null | { originRow: number, originCol: number, valid: boolean, preclear: any }}
   */
  function resolve(session, originX, originY, matrix) {
    // 1. engage
    if (!isBoardEngaged(originX, originY, matrix)) {
      clearSticky(session);
      return null;
    }

    // 2. free + intent
    const { freeColF, freeRowF } = freeSnapFromShapeBottom(
      originX,
      originY,
      matrix,
    );
    const maxLag = maxLagCells();
    const intent = moveIntentClass(session, freeColF, freeRowF);
    const hOpen = H_open(session);

    // 3. sticky 空 → 首次钉格
    if (!session.sticky) {
      return firstPin(session, freeColF, freeRowF, matrix);
    }

    const s = session.sticky;
    const lag = lagToCell(freeColF, freeRowF, s.row, s.col);

    // 4. sticky 非法 → 重钉
    if (!grid.fits(matrix, s.row, s.col)) {
      clearSticky(session);
      return firstPin(session, freeColF, freeRowF, matrix);
    }

    // 5. 甩太远 → 灭影
    if (lag > maxLag) {
      clearSticky(session);
      return null;
    }

    // 6. 各向 leave 请求
    const openR = canStep(matrix, s.row, s.col, 0, 1);
    const openL = canStep(matrix, s.row, s.col, 0, -1);
    const openD = canStep(matrix, s.row, s.col, 1, 0);
    const openU = canStep(matrix, s.row, s.col, -1, 0);

    let dc = axisLeave(freeColF, s.col, openR, openL, hOpen);
    let dr = axisLeave(freeRowF, s.row, openD, openU, hOpen);

    // 7. intent 合成唯一目标（设计 §5.4）
    let targetRow = s.row;
    let targetCol = s.col;

    if (intent === 'h') {
      // 横意图：只改列
      targetCol = s.col + dc;
      dr = 0;
    } else if (intent === 'v') {
      targetRow = s.row + dr;
      dc = 0;
    } else if (intent === 'diag') {
      if (dc !== 0 && dr !== 0) {
        targetRow = s.row + dr;
        targetCol = s.col + dc;
      } else {
        // 仅一轴 leave：保持 sticky（不产出纯轴中间态）
        return makeValidHover(s.row, s.col, matrix);
      }
    } else {
      // idle：允许双轴合成（含对角）
      targetRow = s.row + dr;
      targetCol = s.col + dc;
    }

    // 无离开请求
    if (targetRow === s.row && targetCol === s.col) {
      return makeValidHover(s.row, s.col, matrix);
    }

    // 8. 目标 fits 且 lag 合法 → 更新；否则保持（禁止邻域乱吸）
    const { rows, cols } = matrixSize(matrix);
    const maxCol = GRID - cols;
    const maxRow = GRID - rows;
    if (
      targetRow < 0 ||
      targetCol < 0 ||
      targetRow > maxRow ||
      targetCol > maxCol
    ) {
      return makeValidHover(s.row, s.col, matrix);
    }
    if (!grid.fits(matrix, targetRow, targetCol)) {
      return makeValidHover(s.row, s.col, matrix);
    }
    if (lagToCell(freeColF, freeRowF, targetRow, targetCol) > maxLag) {
      return makeValidHover(s.row, s.col, matrix);
    }

    commitSticky(session, targetRow, targetCol);
    return makeValidHover(targetRow, targetCol, matrix);
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
