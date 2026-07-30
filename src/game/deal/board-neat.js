/**
 * 前期「整齐盘 / 利于清屏」打分：
 * - 优先消行消列
 * - 优先填满接近满的行/列
 * - 放置后减少「镂空/锯齿」，避免异形残局
 */
import { GRID } from '../defaults.js';
import { matrixSize } from '../forms.js';
import { fitsOn, findPlacements, simulatePlace } from './board-ops.js';
import { countFilled } from './board-ops.js';

/**
 * 盘面「乱」的程度：越高越碎、越难整洁堆叠（不要求能清屏）
 * @param {(number|null)[][]} cells
 */
export function boardMessScore(cells) {
  let holes = 0;
  let edgeJags = 0;
  let partialLines = 0;
  let singleGaps = 0;

  for (let r = 0; r < GRID; r++) {
    let filled = 0;
    let runEmpty = 0;
    let maxEmptyRun = 0;
    let emptyRuns = 0;
    let inEmpty = false;
    for (let c = 0; c < GRID; c++) {
      if (cells[r][c] != null) {
        filled += 1;
        maxEmptyRun = Math.max(maxEmptyRun, runEmpty);
        if (inEmpty) {
          emptyRuns += 1;
          inEmpty = false;
        }
        runEmpty = 0;
      } else {
        runEmpty += 1;
        if (!inEmpty) inEmpty = true;
      }
    }
    maxEmptyRun = Math.max(maxEmptyRun, runEmpty);
    if (inEmpty) emptyRuns += 1;
    if (filled > 0 && filled < GRID) {
      partialLines += 1;
      // 一行里多段空洞 = 锯齿
      if (emptyRuns >= 2 || maxEmptyRun < GRID - filled) edgeJags += 1.8;
      else edgeJags += 0.35;
      if (GRID - filled === 1) singleGaps += 0.4;
    }
  }
  for (let c = 0; c < GRID; c++) {
    let filled = 0;
    let runEmpty = 0;
    let maxEmptyRun = 0;
    let emptyRuns = 0;
    let inEmpty = false;
    for (let r = 0; r < GRID; r++) {
      if (cells[r][c] != null) {
        filled += 1;
        maxEmptyRun = Math.max(maxEmptyRun, runEmpty);
        if (inEmpty) {
          emptyRuns += 1;
          inEmpty = false;
        }
        runEmpty = 0;
      } else {
        runEmpty += 1;
        if (!inEmpty) inEmpty = true;
      }
    }
    maxEmptyRun = Math.max(maxEmptyRun, runEmpty);
    if (inEmpty) emptyRuns += 1;
    if (filled > 0 && filled < GRID) {
      partialLines += 1;
      if (emptyRuns >= 2 || maxEmptyRun < GRID - filled) edgeJags += 1.8;
      else edgeJags += 0.35;
      if (GRID - filled === 1) singleGaps += 0.4;
    }
  }

  // 包围空洞：空格四邻多为实
  for (let r = 1; r < GRID - 1; r++) {
    for (let c = 1; c < GRID - 1; c++) {
      if (cells[r][c] != null) continue;
      let n = 0;
      if (cells[r - 1][c] != null) n += 1;
      if (cells[r + 1][c] != null) n += 1;
      if (cells[r][c - 1] != null) n += 1;
      if (cells[r][c + 1] != null) n += 1;
      if (n >= 3) holes += 1;
      if (n === 4) holes += 0.5;
    }
  }

  // 空区碎片：连通分量多 = 麻子盘
  const { components, singles } = emptyFragmentStats(cells);
  const frag =
    singles * 2.4 + Math.max(0, components - 2) * 1.35 + Math.max(0, components - 4) * 0.8;

  return (
    holes * 3.6 +
    edgeJags * 1.25 +
    partialLines * 0.28 +
    singleGaps * 0.5 +
    frag
  );
}

/**
 * 空格 4-连通：分量数 + 单格洞
 * @param {(number|null)[][]} cells
 */
function emptyFragmentStats(cells) {
  const seen = Array.from({ length: GRID }, () => Array(GRID).fill(false));
  let components = 0;
  let singles = 0;
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      if (cells[r][c] != null || seen[r][c]) continue;
      components += 1;
      let size = 0;
      const q = [[r, c]];
      seen[r][c] = true;
      while (q.length) {
        const [cr, cc] = q.pop();
        size += 1;
        for (const [dr, dc] of dirs) {
          const nr = cr + dr;
          const nc = cc + dc;
          if (nr < 0 || nr >= GRID || nc < 0 || nc >= GRID) continue;
          if (seen[nr][nc] || cells[nr][nc] != null) continue;
          seen[nr][nc] = true;
          q.push([nr, nc]);
        }
      }
      if (size === 1) singles += 1;
    }
  }
  return { components, singles };
}

/**
 * 放置后「清屏友好」分：消线 + 变整齐 + 贴现有块
 * @param {(number|null)[][]} cells
 * @param {number[][]} matrix
 * @param {number} originRow
 * @param {number} originCol
 */
export function scoreClearFriendlyPlacement(cells, matrix, originRow, originCol) {
  if (!fitsOn(cells, matrix, originRow, originCol)) return -Infinity;

  const messBefore = boardMessScore(cells);
  const filledBefore = countFilled(cells);
  const next = simulatePlace(cells, matrix, originRow, originCol);
  const messAfter = boardMessScore(next);
  const filledAfter = countFilled(next);

  // 消了多少格（含消线）
  const cleared = filledBefore + countCellsMatrix(matrix) - filledAfter;

  let nearFull = 0;
  const rowFill = new Array(GRID).fill(0);
  const colFill = new Array(GRID).fill(0);
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      if (cells[r][c] != null) {
        rowFill[r] += 1;
        colFill[c] += 1;
      }
    }
  }
  const { rows, cols } = matrixSize(matrix);
  const addR = new Array(GRID).fill(0);
  const addC = new Array(GRID).fill(0);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!matrix[r][c]) continue;
      addR[originRow + r] += 1;
      addC[originCol + c] += 1;
    }
  }
  for (let r = 0; r < GRID; r++) {
    if (!addR[r]) continue;
    const after = rowFill[r] + addR[r];
    if (after >= GRID) nearFull += 12;
    else if (after >= GRID - 1) nearFull += 5;
    else if (after >= GRID - 2) nearFull += 2;
  }
  for (let c = 0; c < GRID; c++) {
    if (!addC[c]) continue;
    const after = colFill[c] + addC[c];
    if (after >= GRID) nearFull += 12;
    else if (after >= GRID - 1) nearFull += 5;
    else if (after >= GRID - 2) nearFull += 2;
  }

  // 全空：极高
  if (filledAfter === 0) return 200 + cleared;

  const tidy = messBefore - messAfter;
  // 原版体感：即使不消线，也要「贴整齐、不挖碎洞」
  // 无消线时抬高 tidy 权重；造 mess 重罚
  const tidyWeight = cleared > 0 ? 5.2 : 8.5;
  const messPenalty = messAfter * (cleared > 0 ? 0.4 : 0.75);
  // 填实后占用上升但 mess 下降 = 健康堆叠
  const solidPack =
    filledAfter > filledBefore && tidy > 0
      ? tidy * 2.2 + Math.min(6, filledAfter - filledBefore) * 0.35
      : 0;

  return cleared * 5.5 + nearFull + tidy * tidyWeight + solidPack - messPenalty;
}

/**
 * @param {number[][]} matrix
 */
function countCellsMatrix(matrix) {
  let n = 0;
  for (const row of matrix) for (const v of row) if (v) n += 1;
  return n;
}

/**
 * 矩阵在盘上的最佳「清屏友好」落点分
 * @param {(number|null)[][]} cells
 * @param {number[][]} matrix
 */
export function bestClearFriendlyScore(cells, matrix, limit = 40) {
  const spots = findPlacements(cells, matrix, limit);
  if (!spots.length) return null;
  let best = -Infinity;
  let bestPos = spots[0];
  for (const { r, c } of spots) {
    const s = scoreClearFriendlyPlacement(cells, matrix, r, c);
    if (s > best) {
      best = s;
      bestPos = { r, c };
    }
  }
  return { score: best, r: bestPos.r, c: bestPos.c };
}

/**
 * 族是否「前期易造异形」
 * 3 长L 4 短L 5 Z 6 T 7 2直 9 缺角 11 5直
 */
/** 前期仍应压：Z / 5直 / 2直 */
export const EARLY_AWKWARD_FAMILIES = new Set([5, 7, 11]);

/**
 * 前期基础族：矩形 + 短条 + 短L / T / 缺角 / 长L
 */
export const EARLY_NEAT_FAMILIES = new Set([0, 1, 2, 8, 4, 6, 9, 3, 10]);

/**
 * 在基础权重上叠「清屏友好」增益（early 用）
 * @param {(number|null)[][]} board
 * @param {{ matrix: number[][], family?: number }} form
 * @param {number} baseW
 */
export function weightWithClearFriendly(board, form, baseW) {
  if (baseW <= 0) return 0;
  const fam = form.family ?? -1;
  let w = baseW;
  if (EARLY_AWKWARD_FAMILIES.has(fam)) w *= 0.06;
  if (EARLY_NEAT_FAMILIES.has(fam)) w *= 1.25;
  if (fam === 11) w *= 0.1;
  if (fam === 3) w *= 0.35; // 长 L 弱底权，空腔可抬
  if (fam === 5) w *= 0.15;

  const best = bestClearFriendlyScore(board, form.matrix);
  if (!best || !Number.isFinite(best.score)) return 0;
  // score 常见 -20～80
  const boost = 1 + Math.max(0, best.score) / 18;
  return w * boost;
}

/**
 * 整 tray：逐步用清屏友好落点模拟，累计分
 * @param {(number|null)[][]} board
 * @param {{ matrix: number[][] }[]} pieces
 */
export function trayClearFriendlyScore(board, pieces) {
  if (!pieces?.length) return 0;
  const mess0 = boardMessScore(board);
  let sim = board.map((row) => row.slice());
  let rem = pieces.filter(Boolean);
  let total = 0;
  while (rem.length) {
    let bestI = -1;
    let bestS = -Infinity;
    let bestPos = null;
    for (let i = 0; i < rem.length; i++) {
      const b = bestClearFriendlyScore(sim, rem[i].matrix);
      if (!b) continue;
      if (b.score > bestS) {
        bestS = b.score;
        bestI = i;
        bestPos = b;
      }
    }
    if (bestI < 0 || !bestPos) return total * 0.2;
    total += bestS;
    sim = simulatePlace(sim, rem[bestI].matrix, bestPos.r, bestPos.c);
    rem = rem.slice(0, bestI).concat(rem.slice(bestI + 1));
  }
  const mess1 = boardMessScore(sim);
  // 整 tray 后 mess 变化：整齐堆叠核心指标
  total += (mess0 - mess1) * 6.5;
  total -= mess1 * 1.8;
  if (countFilled(sim) === 0) total += 80;
  return total;
}

/**
 * 优序放置后 mess 增量（>0 变乱）
 * @param {(number|null)[][]} board
 * @param {{ matrix: number[][] }[]} pieces
 */
export function trayMessDelta(board, pieces) {
  if (!pieces?.length) return 0;
  const mess0 = boardMessScore(board);
  let sim = board.map((row) => row.slice());
  let rem = pieces.filter(Boolean);
  while (rem.length) {
    let bestI = -1;
    let bestS = -Infinity;
    let bestPos = null;
    for (let i = 0; i < rem.length; i++) {
      const b = bestClearFriendlyScore(sim, rem[i].matrix, 28);
      if (!b) continue;
      if (b.score > bestS) {
        bestS = b.score;
        bestI = i;
        bestPos = b;
      }
    }
    if (bestI < 0 || !bestPos) return 99;
    sim = simulatePlace(sim, rem[bestI].matrix, bestPos.r, bestPos.c);
    rem = rem.slice(0, bestI).concat(rem.slice(bestI + 1));
  }
  return boardMessScore(sim) - mess0;
}
