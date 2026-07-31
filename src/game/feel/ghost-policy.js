/**
 * 投影策略 — 设计 SSOT：docs/GHOST-DESIGN.md
 *
 * 统一规则（产品拍板）：
 * - 不卡边（目标邻格能放）：沿该向约 0.5 格 + 滞回 → 换影
 * - 卡边（该向邻格不能放）：约 1.3 格才尝试离开（仍不落到非法格）
 * - 方向看 8 邻：E/W/N/S + 四对角
 * - 斜向：双轴都够 → 优先对角；仅一轴够 → 允许先横或先竖挪一格（中间态，跟手）
 * - 防抖优先：格缝不闪（H_open 足够）；失败只保持 sticky，不邻域乱吸
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

  // —— 参数：L_open / H_open / L_edge / MAX_LAG ——

  function maxLagCells() {
    const v = getTune().FEEL_GHOST_MAX_LAG;
    return Number.isFinite(v) ? Math.max(0.05, v) : 1.45;
  }

  /** 空地离开距离（半格） */
  function L_open() {
    const v = getTune().FEEL_GHOST_OPEN_SNAP;
    return Number.isFinite(v) ? Math.max(0.4, v) : 0.5;
  }

  /**
   * 空地防抖半宽（施密特）。
   * 产品：宁可略粘也绝不格缝连闪。
   */
  function H_open() {
    const tune = getTune();
    const base = Number.isFinite(tune.FEEL_GHOST_SNAP_HYST)
      ? tune.FEEL_GHOST_SNAP_HYST
      : 0.12;
    const hMin = Number.isFinite(tune.FEEL_GHOST_SNAP_HYST_MIN)
      ? tune.FEEL_GHOST_SNAP_HYST_MIN
      : 0.1;
    return Math.max(hMin, base);
  }

  /** 卡边离开距离 1.3 */
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

  function H_edge() {
    return 0.04;
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

  function sign(v) {
    if (v > 0) return 1;
    if (v < 0) return -1;
    return 0;
  }

  // —— 8 向：从 free 相对 sticky 选出主方向 (dc, dr) ——

  /**
   * @returns {{ dc: number, dr: number } | null}
   * dc/dr ∈ {-1,0,1}，不全为 0；null = 仍在中心附近
   */
  function primary8Dir(dx, dy, hOpen) {
    const tune = getTune();
    const diagRatio = Number.isFinite(tune.FEEL_GHOST_DIAG_RATIO)
      ? tune.FEEL_GHOST_DIAG_RATIO
      : 0.45;
    const bias = tune.FEEL_AXIS_DOMINANCE ?? 0.05;

    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    // 中心死区：未明显离开 sticky 中心 → 不换格
    const dead = Math.min(0.22, L_open() * 0.4 + hOpen * 0.5);
    if (ax < dead && ay < dead) return null;

    const sc = sign(dx);
    const sr = sign(dy);
    if (sc === 0 && sr === 0) return null;

    // 斜向：两分量比例够大才进四对角（未达则走主轴，避免「假斜向」卡双轴门闩）
    const maxA = Math.max(ax, ay, 1e-6);
    const minA = Math.min(ax, ay);
    if (sc !== 0 && sr !== 0 && minA / maxA >= diagRatio) {
      return { dc: sc, dr: sr };
    }

    // 主轴：横或竖（bias 防噪声在 E/SE 扇区边界抖）
    if (ax > ay + bias) return { dc: sc, dr: 0 };
    if (ay > ax + bias) return { dc: 0, dr: sr };
    // 接近均分但未达 diagRatio：只跟更强轴，不提前对角
    if (ax >= ay) return { dc: sc || 0, dr: 0 };
    return { dc: 0, dr: sr || 0 };
  }

  /**
   * 单轴是否已拖够离开距离（open 0.5+H / edge 1.3+H）。
   * @param {boolean} isCol true=列轴(dc)，false=行轴(dr)
   */
  function canLeaveAxis(freeF, sAxis, d, matrix, sRow, sCol, isCol, hOpen) {
    if (d === 0) return false;
    const open = isCol
      ? canStep(matrix, sRow, sCol, 0, d)
      : canStep(matrix, sRow, sCol, d, 0);
    const L = open ? L_open() : L_edge();
    const H = open ? hOpen : H_edge();
    if (d > 0 && freeF < sAxis + L + H) return false;
    if (d < 0 && freeF > sAxis - L - H) return false;
    return true;
  }

  /**
   * 沿 (dc,dr) 是否整向都够（斜向要求双轴都过阈）。
   */
  function canLeaveToward(freeColF, freeRowF, s, dc, dr, matrix, hOpen) {
    if (dc === 0 && dr === 0) return false;
    if (dc !== 0 && !canLeaveAxis(freeColF, s.col, dc, matrix, s.row, s.col, true, hOpen)) {
      return false;
    }
    if (dr !== 0 && !canLeaveAxis(freeRowF, s.row, dr, matrix, s.row, s.col, false, hOpen)) {
      return false;
    }
    return true;
  }

  /**
   * 尝试钉到目标；非法则 null（不乱吸）。
   */
  function tryCommit(
    session,
    freeColF,
    freeRowF,
    matrix,
    targetRow,
    targetCol,
    maxLag,
  ) {
    const { rows, cols } = matrixSize(matrix);
    const maxCol = GRID - cols;
    const maxRow = GRID - rows;
    if (
      targetRow < 0 ||
      targetCol < 0 ||
      targetRow > maxRow ||
      targetCol > maxCol
    ) {
      return null;
    }
    if (!grid.fits(matrix, targetRow, targetCol)) return null;
    if (lagToCell(freeColF, freeRowF, targetRow, targetCol) > maxLag) {
      return null;
    }
    commitSticky(session, targetRow, targetCol);
    return makeValidHover(targetRow, targetCol, matrix);
  }

  // —— 首次钉格 ——

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
   * @param {number} originX
   * @param {number} originY
   * @param {number[][]} matrix
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
    const hOpen = H_open();

    if (!session.sticky) {
      return firstPin(session, freeColF, freeRowF, matrix);
    }

    const s = session.sticky;
    const lag = lagToCell(freeColF, freeRowF, s.row, s.col);

    if (!grid.fits(matrix, s.row, s.col)) {
      clearSticky(session);
      return firstPin(session, freeColF, freeRowF, matrix);
    }

    if (lag > maxLag) {
      clearSticky(session);
      return null;
    }

    const dx = freeColF - s.col;
    const dy = freeRowF - s.row;
    const dir = primary8Dir(dx, dy, hOpen);

    // 仍在中心附近 → 钉住（防闪）
    if (!dir) {
      return makeValidHover(s.row, s.col, matrix);
    }

    const { dc, dr } = dir;
    const isDiag = dc !== 0 && dr !== 0;

    // —— 纯横/竖：整向够才切一格 ——
    if (!isDiag) {
      if (!canLeaveToward(freeColF, freeRowF, s, dc, dr, matrix, hOpen)) {
        return makeValidHover(s.row, s.col, matrix);
      }
      const hit = tryCommit(
        session,
        freeColF,
        freeRowF,
        matrix,
        s.row + dr,
        s.col + dc,
        maxLag,
      );
      return hit || makeValidHover(s.row, s.col, matrix);
    }

    // —— 斜向（产品方案 1）：允许中间态 ——
    // 双轴都够 → 优先对角；仅一轴够 → 可先横或先竖挪一格（更跟手）
    const leaveC = canLeaveAxis(
      freeColF,
      s.col,
      dc,
      matrix,
      s.row,
      s.col,
      true,
      hOpen,
    );
    const leaveR = canLeaveAxis(
      freeRowF,
      s.row,
      dr,
      matrix,
      s.row,
      s.col,
      false,
      hOpen,
    );

    if (!leaveC && !leaveR) {
      return makeValidHover(s.row, s.col, matrix);
    }

    /** @type {[number, number][]} 按优先级尝试的目标 */
    const targets = [];
    if (leaveC && leaveR) {
      // 1) 对角
      targets.push([s.row + dr, s.col + dc]);
      // 2) 对角失败时：较强轴先单步（仍属中间态兜底）
      if (Math.abs(dx) >= Math.abs(dy)) {
        targets.push([s.row, s.col + dc]);
        targets.push([s.row + dr, s.col]);
      } else {
        targets.push([s.row + dr, s.col]);
        targets.push([s.row, s.col + dc]);
      }
    } else if (leaveC) {
      // 仅横够：先横移一格
      targets.push([s.row, s.col + dc]);
    } else {
      // 仅竖够：先竖移一格
      targets.push([s.row + dr, s.col]);
    }

    for (const [tr, tc] of targets) {
      const hit = tryCommit(session, freeColF, freeRowF, matrix, tr, tc, maxLag);
      if (hit) return hit;
    }
    return makeValidHover(s.row, s.col, matrix);
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
