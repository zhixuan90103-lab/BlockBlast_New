/**
 * 盘面纯函数：放置 / 消线模拟 / 可放检测。
 * 无阶段、无随机策略。
 */
import { GRID } from '../defaults.js';
import { matrixSize } from '../forms.js';

/**
 * @param {(number|null)[][]} cells
 * @param {number[][]} matrix
 * @param {number} originRow
 * @param {number} originCol
 */
export function fitsOn(cells, matrix, originRow, originCol) {
  const { rows, cols } = matrixSize(matrix);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!matrix[r][c]) continue;
      const gr = originRow + r;
      const gc = originCol + c;
      if (gr < 0 || gr >= GRID || gc < 0 || gc >= GRID) return false;
      if (cells[gr][gc] != null) return false;
    }
  }
  return true;
}

/**
 * @param {(number|null)[][]} cells
 * @param {number[][]} matrix
 * @returns {{ r: number, c: number } | null}
 */
export function findAnyPlacement(cells, matrix) {
  const { rows, cols } = matrixSize(matrix);
  for (let r = 0; r <= GRID - rows; r++) {
    for (let c = 0; c <= GRID - cols; c++) {
      if (fitsOn(cells, matrix, r, c)) return { r, c };
    }
  }
  return null;
}

/**
 * @param {(number|null)[][]} cells
 * @param {number[][]} matrix
 * @param {number} [limit]
 */
export function findPlacements(cells, matrix, limit = 12) {
  const { rows, cols } = matrixSize(matrix);
  /** @type {{ r: number, c: number }[]} */
  const out = [];
  for (let r = 0; r <= GRID - rows; r++) {
    for (let c = 0; c <= GRID - cols; c++) {
      if (!fitsOn(cells, matrix, r, c)) continue;
      out.push({ r, c });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

export function canPlaceOnCells(cells, matrix) {
  return findAnyPlacement(cells, matrix) != null;
}

/**
 * 放置并清除满行/满列（发块模拟用，颜色用 1 占位即可）
 * @param {(number|null)[][]} cells
 * @param {number[][]} matrix
 * @param {number} originRow
 * @param {number} originCol
 */
export function simulatePlace(cells, matrix, originRow, originCol) {
  const next = cells.map((row) => row.slice());
  const { rows, cols } = matrixSize(matrix);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (matrix[r][c]) next[originRow + r][originCol + c] = 1;
    }
  }
  const fullR = [];
  const fullC = [];
  for (let r = 0; r < GRID; r++) {
    if (next[r].every((v) => v != null)) fullR.push(r);
  }
  for (let c = 0; c < GRID; c++) {
    if (next.every((row) => row[c] != null)) fullC.push(c);
  }
  for (const r of fullR) for (let c = 0; c < GRID; c++) next[r][c] = null;
  for (const c of fullC) for (let r = 0; r < GRID; r++) next[r][c] = null;
  return next;
}

/**
 * @param {(number|null)[][]} cells
 */
export function countFilled(cells) {
  let n = 0;
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      if (cells[r][c] != null) n += 1;
    }
  }
  return n;
}

/**
 * @param {(number|null)[][]} cells
 */
export function isBoardEmpty(cells) {
  return countFilled(cells) === 0;
}

/**
 * @param {(number|null)[][]} cells
 */
export function fillRatio(cells) {
  return countFilled(cells) / (GRID * GRID);
}

/**
 * 是否存在一种顺序使 pieces 均可依次放置（可中间消线）
 * @param {(number|null)[][]} cells
 * @param {{ matrix: number[][] }[]} pieces
 */
export function existsPlacementOrder(cells, pieces) {
  const live = pieces.filter(Boolean);
  if (live.length === 0) return true;

  function dfs(board, remaining) {
    if (remaining.length === 0) return true;
    for (let i = 0; i < remaining.length; i++) {
      const p = remaining[i];
      const pos = findAnyPlacement(board, p.matrix);
      if (!pos) continue;
      const nextBoard = simulatePlace(board, p.matrix, pos.r, pos.c);
      const nextRem = remaining.slice(0, i).concat(remaining.slice(i + 1));
      if (dfs(nextBoard, nextRem)) return true;
    }
    return false;
  }

  return dfs(cells, live);
}

/**
 * @param {(number|null)[][]} cells
 * @param {{ matrix: number[][] }[]} pieces
 */
export function countInstantFits(cells, pieces) {
  let n = 0;
  for (const p of pieces) {
    if (p && canPlaceOnCells(cells, p.matrix)) n += 1;
  }
  return n;
}
