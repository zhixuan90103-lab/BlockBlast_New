/**
 * 投影策略（设计 SSOT：docs/GHOST-DESIGN.md）
 *
 * 本体 free 驱动：
 *   engage → free(本体底排) → quantize 半格边界切换 → 合法邻域 → maxLag
 * 影子跟块位置走：本体跨过格中线才换格，禁止 open 阈值「提前钉格」。
 * 不处理渲染与震动。
 */
import { FEEL_PRECLEAR_HIGHLIGHT, GRID } from '../defaults.js';
import { matrixSize } from '../forms.js';

/** lag 超过此值倾向 free 重吸（仍受死区约束） */
const LAG_STICKY_SOFT = 0.95;
/** lag 超过此值（或快速模式）走 free 吸附 */
const LAG_STICKY_HARD = 1.15;
/** sticky 轴锁：单轴偏差超过此值放开为双轴 */
const AXIS_BOTH_LAG = 1.25;

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

  // —— 参数读取 ——

  function maxLagCells() {
    const v = getTune().FEEL_GHOST_MAX_LAG;
    return Number.isFinite(v) ? Math.max(0.05, v) : 1;
  }

  /** 基础滞回（未乘速度） */
  function snapHystBase() {
    const v = getTune().FEEL_GHOST_SNAP_HYST;
    return Number.isFinite(v) ? Math.max(0, v) : 0.14;
  }

  function lagToCell(freeColF, freeRowF, row, col) {
    return Math.max(Math.abs(freeColF - col), Math.abs(freeRowF - row));
  }

  /**
   * 指速归一化 0=静止 → 1=达到快精进入指速。
   * @param {object} session
   */
  function pointerSpeedT(session) {
    const tune = getTune();
    const speed = Math.max(0, session?.lastPointerSpeed || 0);
    const vref = Math.max(1, tune.FEEL_POINTER_SPEED_REF ?? 6);
    const enter = vref * (tune.FEEL_GHOST_FAST_SPEED_RATIO ?? 0.36);
    return Math.min(1, speed / Math.max(0.35, enter));
  }

  /**
   * 盘面（邻格可放）+ 指速 → 每方向步进阈值与有效滞回/死区缩放。
   * 设计：快扫灵、空旷可放灵、堵住粘但不卡死。
   * @returns {{ left: number, right: number, up: number, down: number, hyst: number, deadzoneScale: number, speedT: number }}
   */
  function adaptiveThresholds(session, matrix, row, col) {
    const tune = getTune();
    // 开阔：半格跟本体；卡边：≥1.3 格才换影
    const open = Number.isFinite(tune.FEEL_GHOST_OPEN_SNAP)
      ? tune.FEEL_GHOST_OPEN_SNAP
      : 0.5;
    const edge = Number.isFinite(tune.FEEL_GHOST_EDGE_HOLD)
      ? tune.FEEL_GHOST_EDGE_HOLD
      : 1.3;
    const baseH = snapHystBase();
    const hystMin = Number.isFinite(tune.FEEL_GHOST_SNAP_HYST_MIN)
      ? tune.FEEL_GHOST_SNAP_HYST_MIN
      : 0.05;
    const corridor =
      Number.isFinite(tune.FEEL_GHOST_OPEN_CORRIDOR_MUL)
        ? tune.FEEL_GHOST_OPEN_CORRIDOR_MUL
        : 1;
    const edgeMin = Number.isFinite(tune.FEEL_GHOST_EDGE_MIN)
      ? tune.FEEL_GHOST_EDGE_MIN
      : 1.3;

    const t = pointerSpeedT(session);
    const hystSpeedMul = 1.1 - t * 0.45;
    const hyst = Math.max(hystMin, baseH * hystSpeedMul);
    // 开阔死区约半格；卡边不靠缩小死区提前放行
    const deadzoneScale = 1.0 - t * 0.15;

    const openFloor = 0.48;
    const dir = (canOpen) => {
      if (canOpen) {
        // 邻格可放：半格中线跟本体（不低于 ~0.48）
        return Math.max(openFloor, open * corridor);
      }
      // 卡边/堵住：固定 ≥ edgeMin（默认 1.3），不因指速压低
      return Math.max(edgeMin, edge);
    };

    return {
      left: dir(canStep(matrix, row, col, 0, -1)),
      right: dir(canStep(matrix, row, col, 0, 1)),
      up: dir(canStep(matrix, row, col, -1, 0)),
      down: dir(canStep(matrix, row, col, 1, 0)),
      hyst,
      deadzoneScale: Math.max(0.85, deadzoneScale),
      speedT: t,
    };
  }

  // —— sticky 死区 / 滞回量化 ——

  /**
   * free 浮点 → 整数格（本体驱动）。
   * 有 sticky：跨过半格 ± 小滞回才换，防抖；不在 0.28 格就提前切。
   * @param {number} freeF
   * @param {number | null | undefined} stickyI
   * @param {number} [h]
   */
  function quantizeWithHyst(freeF, stickyI, h) {
    const hh = Number.isFinite(h) ? Math.max(0, h) : snapHystBase();
    if (stickyI == null || !Number.isFinite(stickyI)) {
      return Math.round(freeF);
    }
    // 半格中线：本体过中线才跟到邻格
    if (freeF >= stickyI + 0.5 + hh) return stickyI + 1;
    if (freeF <= stickyI - 0.5 - hh) return stickyI - 1;
    return stickyI;
  }

  /** free 是否落在 sticky 的半格死区内（单轴）；deadzoneScale&lt;1 时快扫更易出区 */
  function inHalfCellDeadzone(freeF, stickyI, h, deadzoneScale = 1) {
    const scale = Number.isFinite(deadzoneScale) ? deadzoneScale : 1;
    return Math.abs(freeF - stickyI) < (0.5 + h) * scale;
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

  // —— 快精模式 ——

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

  // —— 轴向意图 ——

  /**
   * free 吸附用的轴偏好（只比 Δcol/Δrow）。
   * @returns {'h' | 'v' | 'both'}
   */
  function preferredSnapAxis(session, freeColF, freeRowF) {
    if (session.sticky) {
      const s = session.sticky;
      const dCol = Math.abs(freeColF - s.col);
      const dRow = Math.abs(freeRowF - s.row);
      const bias = getTune().FEEL_AXIS_DOMINANCE ?? 0.05;
      if (dCol > dRow + bias) return 'h';
      if (dRow > dCol + bias) return 'v';
      if (session.axisLock === 'h' || session.axisLock === 'v') {
        return session.axisLock;
      }
    }
    return 'both';
  }

  /**
   * sticky 步进轴锁（近距；过大则双轴）。
   * @returns {'h' | 'v' | 'both'}
   */
  function resolveDominantAxis(session, freeColF, freeRowF, s) {
    const dCol = Math.abs(freeColF - s.col);
    const dRow = Math.abs(freeRowF - s.row);
    if (dCol > AXIS_BOTH_LAG || dRow > AXIS_BOTH_LAG) {
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

  /** 邻格相对轴向意图的惩罚（越大越不优先） */
  function axisNeighborPenalty(dr, dc, axis) {
    if (axis === 'h') {
      if (dr === 0 && dc !== 0) return 0;
      if (dr !== 0 && dc !== 0) return 1;
      if (dr !== 0 && dc === 0) return 4;
    }
    if (axis === 'v') {
      if (dc === 0 && dr !== 0) return 0;
      if (dr !== 0 && dc !== 0) return 1;
      if (dc !== 0 && dr === 0) return 4;
    }
    return 0;
  }

  // —— free 邻域吸附 ——

  /**
   * free 附近合法格；lag ≤ MAX_LAG；轴意图优先同轴邻格。
   * @param {'h' | 'v' | 'both'} [preferredAxis]
   */
  function hoverFreeSnap(
    session,
    freeColF,
    freeRowF,
    matrix,
    preferredAxis = 'both',
  ) {
    const { rows, cols } = matrixSize(matrix);
    const maxCol = GRID - cols;
    const maxRow = GRID - rows;
    const maxLag = maxLagCells();
    const sticky = session.sticky;
    const ad = sticky
      ? adaptiveThresholds(session, matrix, sticky.row, sticky.col)
      : { hyst: snapHystBase(), deadzoneScale: 1 };
    const h = ad.hyst;
    let col = quantizeWithHyst(freeColF, sticky?.col, h);
    let row = quantizeWithHyst(freeRowF, sticky?.row, h);

    if (preferredAxis === 'h' && sticky) {
      row = sticky.row;
      col = quantizeWithHyst(freeColF, sticky.col, h);
    } else if (preferredAxis === 'v' && sticky) {
      col = sticky.col;
      row = quantizeWithHyst(freeRowF, sticky.row, h);
    }

    const tryAt = (r, c) => {
      if (r < 0 || c < 0 || r > maxRow || c > maxCol) return null;
      if (lagToCell(freeColF, freeRowF, r, c) > maxLag) return null;
      if (!grid.fits(matrix, r, c)) return null;
      session.sticky = { row: r, col: c };
      return makeValidHover(r, c, matrix);
    };

    let hit = tryAt(row, col);
    if (hit) return hit;

    /** @type {[number, number, number, number][]} r, c, lag, axisPenalty */
    const candidates = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const r = row + dr;
        const c = col + dc;
        const lag = lagToCell(freeColF, freeRowF, r, c);
        if (lag > maxLag) continue;
        candidates.push([r, c, lag, axisNeighborPenalty(dr, dc, preferredAxis)]);
      }
    }
    candidates.sort((a, b) => a[3] - b[3] || a[2] - b[2]);
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

  /** 影不得离 free 超过 MAX_LAG */
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

  function freeSnapGated(session, freeColF, freeRowF, matrix, snapAxis) {
    const snapped = hoverFreeSnap(
      session,
      freeColF,
      freeRowF,
      matrix,
      snapAxis,
    );
    return gateByMaxLag(session, freeColF, freeRowF, snapped);
  }

  // —— sticky 步进 ——

  /**
   * 近距 sticky：自适应 open/edge + 滞回换邻格；失败则贴边或 free。
   */
  function resolveStickyStep(
    session,
    freeColF,
    freeRowF,
    matrix,
    s,
    snapAxis,
    maxLag,
  ) {
    const axis = resolveDominantAxis(session, freeColF, freeRowF, s);
    const th = adaptiveThresholds(session, matrix, s.row, s.col);
    const h = th.hyst;
    let targetCol = s.col;
    let targetRow = s.row;

    // open 方向阈值已含半格语义；卡边方向 th=1.3 不再叠加 hyst，避免实际 >1.3 才动
    const colStepR = th.right >= 1.0 ? th.right : th.right + h;
    const colStepL = th.left >= 1.0 ? th.left : th.left + h;
    const rowStepD = th.down >= 1.0 ? th.down : th.down + h;
    const rowStepU = th.up >= 1.0 ? th.up : th.up + h;

    if (axis === 'h' || axis === 'both') {
      if (freeColF >= s.col + colStepR) targetCol = s.col + 1;
      else if (freeColF <= s.col - colStepL) targetCol = s.col - 1;
    }
    if (axis === 'v' || axis === 'both') {
      if (freeRowF >= s.row + rowStepD) targetRow = s.row + 1;
      else if (freeRowF <= s.row - rowStepU) targetRow = s.row - 1;
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

    const lag = stickyLagCells(freeColF, freeRowF, s);
    const towardBlocked =
      (targetCol > s.col && !canStep(matrix, s.row, s.col, 0, 1)) ||
      (targetCol < s.col && !canStep(matrix, s.row, s.col, 0, -1)) ||
      (targetRow > s.row && !canStep(matrix, s.row, s.col, 1, 0)) ||
      (targetRow < s.row && !canStep(matrix, s.row, s.col, -1, 0));
    if (towardBlocked && lag <= maxLag) {
      return gateByMaxLag(
        session,
        freeColF,
        freeRowF,
        makeValidHover(s.row, s.col, matrix),
      );
    }

    return freeSnapGated(session, freeColF, freeRowF, matrix, snapAxis);
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
    // 1. engage：底排碰到盘才出影
    if (!isBoardEngaged(originX, originY, matrix)) {
      clearSticky(session);
      return null;
    }

    // 2. free = 本体视觉位置映射的浮点原点
    const { freeColF, freeRowF } = freeSnapFromShapeBottom(
      originX,
      originY,
      matrix,
    );
    const maxLag = maxLagCells();
    const snapAxis = preferredSnapAxis(session, freeColF, freeRowF);

    // 3. 尚无 sticky：按本体 free 建立（半格量化）
    if (!session.sticky) {
      return freeSnapGated(session, freeColF, freeRowF, matrix, snapAxis);
    }

    const s = session.sticky;
    const lag = stickyLagCells(freeColF, freeRowF, s);

    // 4. 影甩太远：按 free 重吸
    if (lag > maxLag) {
      return freeSnapGated(session, freeColF, freeRowF, matrix, snapAxis);
    }

    // 5. sticky 格已不可放
    if (!grid.fits(matrix, s.row, s.col)) {
      clearSticky(session);
      return freeSnapGated(session, freeColF, freeRowF, matrix, snapAxis);
    }

    // 6. 快精：仍 free 跟手（卡边阈值在 sticky 步进里体现；快扫允许更快跟 free）
    if (isGhostFastMode(session) && lag > LAG_STICKY_SOFT) {
      return freeSnapGated(session, freeColF, freeRowF, matrix, snapAxis);
    }

    const ad = adaptiveThresholds(session, matrix, s.row, s.col);
    const h = ad.hyst;

    // 7. 各向钉住：未超过该方向换格阈值则保持 sticky
    //    开阔 ≈ 0.5+h（跟本体）；卡边 = edge+h（默认 1.3，拖够才换影）
    let holdCol = true;
    if (freeColF >= s.col) {
      const need = canStep(matrix, s.row, s.col, 0, 1) ? 0.5 + h : ad.right;
      holdCol = freeColF < s.col + need;
    } else {
      const need = canStep(matrix, s.row, s.col, 0, -1) ? 0.5 + h : ad.left;
      holdCol = freeColF > s.col - need;
    }
    let holdRow = true;
    if (freeRowF >= s.row) {
      const need = canStep(matrix, s.row, s.col, 1, 0) ? 0.5 + h : ad.down;
      holdRow = freeRowF < s.row + need;
    } else {
      const need = canStep(matrix, s.row, s.col, -1, 0) ? 0.5 + h : ad.up;
      holdRow = freeRowF > s.row - need;
    }

    if (holdCol && holdRow) {
      return gateByMaxLag(
        session,
        freeColF,
        freeRowF,
        makeValidHover(s.row, s.col, matrix),
      );
    }

    // 8. 已超过方向阈值 → sticky 步进（卡边需 ≥1.3，开阔半格）
    return resolveStickyStep(
      session,
      freeColF,
      freeRowF,
      matrix,
      s,
      snapAxis,
      maxLag,
    );
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
