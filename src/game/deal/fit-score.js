/**
 * 盘面贴合度：为「严丝合缝」发块打分。
 * 同一族多变体（L/T 朝向）里，优先选邻接高、能消线、嵌进凹口的姿态。
 */
import { GRID } from '../defaults.js';
import { DEAL_FIT_SCORE_ENABLED, DEAL_FIT_WEIGHT } from '../defaults.js';
import { matrixSize } from '../forms.js';
import { getTune } from '../tune.js';
import { fitsOn, findPlacements, simulatePlace } from './board-ops.js';

const DIRS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

/**
 * 单次落点贴合分（越高越「卡槽」）
 * @param {(number|null)[][]} cells
 * @param {number[][]} matrix
 * @param {number} originRow
 * @param {number} originCol
 */
export function scorePlacement(cells, matrix, originRow, originCol) {
  if (!fitsOn(cells, matrix, originRow, originCol)) return -Infinity;

  const { rows, cols } = matrixSize(matrix);
  let contact = 0;
  let perimeter = 0;
  let pieceCells = 0;

  // 行/列已有填充（放置前），用于「差一格就消」
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

  const addOnRow = new Array(GRID).fill(0);
  const addOnCol = new Array(GRID).fill(0);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!matrix[r][c]) continue;
      pieceCells += 1;
      const gr = originRow + r;
      const gc = originCol + c;
      addOnRow[gr] += 1;
      addOnCol[gc] += 1;

      for (const [dr, dc] of DIRS) {
        perimeter += 1;
        const nr = gr + dr;
        const nc = gc + dc;
        if (nr < 0 || nr >= GRID || nc < 0 || nc >= GRID) {
          contact += 1; // 贴边
          continue;
        }
        // 邻格是盘面已有块，或本块其它格（自贴合）
        if (cells[nr][nc] != null) {
          contact += 1;
          continue;
        }
        const lr = nr - originRow;
        const lc = nc - originCol;
        if (
          lr >= 0 &&
          lr < rows &&
          lc >= 0 &&
          lc < cols &&
          matrix[lr][lc]
        ) {
          contact += 0.35;
        }
      }
    }
  }

  let lines = 0;
  let almost = 0;
  for (let r = 0; r < GRID; r++) {
    if (!addOnRow[r]) continue;
    const after = rowFill[r] + addOnRow[r];
    if (after >= GRID) lines += 1;
    else if (after === GRID - 1) almost += 1;
  }
  for (let c = 0; c < GRID; c++) {
    if (!addOnCol[c]) continue;
    const after = colFill[c] + addOnCol[c];
    if (after >= GRID) lines += 1;
    else if (after === GRID - 1) almost += 1;
  }

  // 凹口：块放完后，用模拟看是否挤进封闭空腔（消线前）
  // 简化：高接触比 + 消线已经足够
  const contactRatio = perimeter > 0 ? contact / perimeter : 0;

  // 贴合主项：邻接 + 消线奖励 + 差一格 + 接触比
  let score =
    contact * 1.15 +
    lines * 28 +
    almost * 7 +
    contactRatio * 10 +
    Math.min(pieceCells, 6) * 0.15;

  // 空旷盘：略奖励伸展（别全贴边挤）；残盘：略奖励更贴
  const filled = rowFill.reduce((a, b) => a + b, 0);
  const fill = filled / (GRID * GRID);
  if (fill < 0.35) {
    score += lines * 4;
  } else if (fill > 0.5) {
    score += contact * 0.35 + lines * 6;
  }

  return score;
}

/**
 * 矩阵在盘上的最佳落点
 * @param {(number|null)[][]} cells
 * @param {number[][]} matrix
 * @param {number} [limit]
 * @returns {{ score: number, r: number, c: number, lines: number } | null}
 */
export function bestFitForMatrix(cells, matrix, limit = 48) {
  const spots = findPlacements(cells, matrix, limit);
  if (!spots.length) return null;

  let best = { score: -Infinity, r: spots[0].r, c: spots[0].c, lines: 0 };
  for (const { r, c } of spots) {
    const score = scorePlacement(cells, matrix, r, c);
    if (score > best.score) {
      const lines = estimateLinesCleared(cells, matrix, r, c);
      best = { score, r, c, lines };
    }
  }
  if (!Number.isFinite(best.score) || best.score < 0) {
    // 仍可放但分数极低
    if (spots.length) {
      return { score: 0, r: spots[0].r, c: spots[0].c, lines: 0 };
    }
    return null;
  }
  return best;
}

/**
 * @param {(number|null)[][]} cells
 * @param {number[][]} matrix
 * @param {number} originRow
 * @param {number} originCol
 */
function estimateLinesCleared(cells, matrix, originRow, originCol) {
  const { rows, cols } = matrixSize(matrix);
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
  const addR = new Array(GRID).fill(0);
  const addC = new Array(GRID).fill(0);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!matrix[r][c]) continue;
      addR[originRow + r] += 1;
      addC[originCol + c] += 1;
    }
  }
  let lines = 0;
  for (let r = 0; r < GRID; r++) {
    if (addR[r] && rowFill[r] + addR[r] >= GRID) lines += 1;
  }
  for (let c = 0; c < GRID; c++) {
    if (addC[c] && colFill[c] + addC[c] >= GRID) lines += 1;
  }
  return lines;
}

/**
 * 是否启用贴合加权
 */
export function isFitScoreEnabled(t = getTune()) {
  const v = t.DEAL_FIT_SCORE_ENABLED;
  if (typeof v === 'number') return v >= 0.5;
  if (typeof v === 'boolean') return v;
  return DEAL_FIT_SCORE_ENABLED;
}

export function fitWeightScale(t = getTune()) {
  const v = t.DEAL_FIT_WEIGHT;
  return Number.isFinite(v) ? Number(v) : DEAL_FIT_WEIGHT;
}

/**
 * 基础权重 × 贴合增益 → 抽样权重
 * @param {(number|null)[][]} board
 * @param {{ matrix: number[][] }} form
 * @param {number} baseW
 */
export function weightWithFit(board, form, baseW, t = getTune()) {
  if (!isFitScoreEnabled(t) || baseW <= 0) return Math.max(0, baseW);
  const best = bestFitForMatrix(board, form.matrix);
  if (!best) return 0;
  const w = fitWeightScale(t);
  // score 常见约 4～40；抬高贴合好的变体
  const boost = 1 + w * (best.score / 12);
  // 能消线的姿态再乘一截
  const lineBoost = best.lines > 0 ? 1 + 0.55 * best.lines : 1;
  return Math.max(0, baseW * boost * lineBoost);
}

/**
 * 整 tray 顺序贴合分：每步选当前剩余块里贴合最高的一块放置
 * @param {(number|null)[][]} board
 * @param {{ matrix: number[][] }[]} pieces
 */
export function traySnugScore(board, pieces, t = getTune()) {
  if (!isFitScoreEnabled(t) || !pieces?.length) return 0;
  let sim = board.map((row) => row.slice());
  /** @type {{ matrix: number[][] }[]} */
  let rem = pieces.filter(Boolean).map((p) => p);
  let total = 0;
  let lineTotal = 0;

  while (rem.length) {
    let bestI = -1;
    /** @type {{ score: number, r: number, c: number, lines: number } | null} */
    let bestFit = null;
    for (let i = 0; i < rem.length; i++) {
      const fit = bestFitForMatrix(sim, rem[i].matrix);
      if (!fit) continue;
      if (!bestFit || fit.score > bestFit.score) {
        bestFit = fit;
        bestI = i;
      }
    }
    if (bestI < 0 || !bestFit) return total * 0.25;
    total += bestFit.score;
    lineTotal += bestFit.lines;
    sim = simulatePlace(sim, rem[bestI].matrix, bestFit.r, bestFit.c);
    rem = rem.slice(0, bestI).concat(rem.slice(bestI + 1));
  }

  return total + lineTotal * 8;
}

/**
 * 找最佳落点（供模拟推进）
 * @param {(number|null)[][]} cells
 * @param {number[][]} matrix
 */
export function findBestPlacement(cells, matrix) {
  const best = bestFitForMatrix(cells, matrix);
  if (!best) return null;
  return { r: best.r, c: best.c };
}
