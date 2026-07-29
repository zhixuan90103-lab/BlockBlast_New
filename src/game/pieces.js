/**
 * Tray 发块：Kefrov 权重 + 避免相同矩阵 + 可放置保证（DEFAULTS.FIT_GUARANTEE）。
 */
import { FIT_GUARANTEE, GRID, TRAY_SIZE } from './defaults.js';
import {
  FORM_1X1,
  FORM_FAMILIES,
  makePiece,
  matrixKey,
  matrixSize,
  pickWeightedForm,
} from './forms.js';

/**
 * @param {import('./grid.js').createGrid extends (...a:any)=>infer R ? R : never} grid
 * @param {number[][]} matrix
 */
function canPlaceOnCells(cells, matrix) {
  const { rows, cols } = matrixSize(matrix);
  for (let r = 0; r <= GRID - rows; r++) {
    for (let c = 0; c <= GRID - cols; c++) {
      if (fitsOn(cells, matrix, r, c)) return true;
    }
  }
  return false;
}

function fitsOn(cells, matrix, originRow, originCol) {
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
 * 模拟放置+清线（仅用于发块保证）
 */
function simulatePlace(cells, matrix, originRow, originCol) {
  const next = cells.map((row) => row.slice());
  const { rows, cols } = matrixSize(matrix);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (matrix[r][c]) next[originRow + r][originCol + c] = 1;
    }
  }
  // clear full rows/cols
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

function findAnyPlacement(cells, matrix) {
  const { rows, cols } = matrixSize(matrix);
  for (let r = 0; r <= GRID - rows; r++) {
    for (let c = 0; c <= GRID - cols; c++) {
      if (fitsOn(cells, matrix, r, c)) return { r, c };
    }
  }
  return null;
}

/**
 * 是否存在一种顺序，使 3 块均可依次放置（可中间消线）
 * @param {(number|null)[][]} cells
 * @param {import('./forms.js').PieceDef[]} pieces
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
 * 生成 tray 三块
 * @param {{ snapshot: () => (number|null)[][], canPlaceAnywhere: (m:number[][])=>boolean }} grid
 * @param {{ maxAttempts?: number }} [opts]
 * @returns {(import('./forms.js').PieceDef|null)[]}
 */
export function generateTray(grid, opts = {}) {
  const maxAttempts = opts.maxAttempts ?? 80;
  const board = grid.snapshot();

  if (!FIT_GUARANTEE) {
    return generateTraySimple(board);
  }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const pieces = tryBuildGuaranteed(board);
    if (pieces && existsPlacementOrder(board, pieces)) {
      return pieces;
    }
  }

  // 放宽：至少每块当前可放（不保证顺序）
  const relaxed = [];
  const usedKeys = new Set();
  for (let i = 0; i < TRAY_SIZE; i++) {
    let form = null;
    for (let t = 0; t < 40; t++) {
      const f = pickWeightedForm();
      const key = matrixKey(f.matrix);
      if (usedKeys.has(key)) continue;
      if (canPlaceOnCells(board, f.matrix)) {
        form = f;
        usedKeys.add(key);
        break;
      }
    }
    if (!form) form = FORM_1X1;
    relaxed.push(makePiece(form));
  }
  // 若仍全不可放，塞 1×1
  if (!relaxed.some((p) => grid.canPlaceAnywhere(p.matrix))) {
    return [makePiece(FORM_1X1), makePiece(FORM_1X1), makePiece(FORM_1X1)];
  }
  return relaxed;
}

function generateTraySimple(board) {
  const usedKeys = new Set();
  const out = [];
  for (let i = 0; i < TRAY_SIZE; i++) {
    let form = pickWeightedForm();
    let key = matrixKey(form.matrix);
    let guard = 0;
    while (usedKeys.has(key) && guard++ < 30) {
      form = pickWeightedForm();
      key = matrixKey(form.matrix);
    }
    usedKeys.add(key);
    out.push(makePiece(form));
  }
  return out;
}

/**
 * 贪心：依次抽能在「当前模拟盘」上放置的块，并模拟落一处
 */
function tryBuildGuaranteed(startBoard) {
  let board = startBoard.map((r) => r.slice());
  const usedKeys = new Set();
  /** @type {import('./forms.js').PieceDef[]} */
  const pieces = [];

  for (let i = 0; i < TRAY_SIZE; i++) {
    let placed = false;
    for (let tryN = 0; tryN < 50; tryN++) {
      const form = pickWeightedForm();
      const key = matrixKey(form.matrix);
      if (usedKeys.has(key) && tryN < 40) continue;
      const pos = findAnyPlacement(board, form.matrix);
      if (!pos) continue;
      const piece = makePiece(form);
      pieces.push(piece);
      usedKeys.add(key);
      board = simulatePlace(board, form.matrix, pos.r, pos.c);
      placed = true;
      break;
    }
    if (!placed) {
      // 1×1 兜底
      const pos = findAnyPlacement(board, FORM_1X1.matrix);
      if (!pos) return null;
      pieces.push(makePiece(FORM_1X1));
      board = simulatePlace(board, FORM_1X1.matrix, pos.r, pos.c);
    }
  }
  return pieces;
}

/**
 * 当前 tray 是否还有任意剩余块可放
 * @param {{ canPlaceAnywhere: (m:number[][])=>boolean }} grid
 * @param {(import('./forms.js').PieceDef|null)[]} tray
 */
export function anyTrayPieceFits(grid, tray) {
  for (const p of tray) {
    if (p && grid.canPlaceAnywhere(p.matrix)) return true;
  }
  // 若 tray 全 null（刚清空瞬间）不算死
  if (tray.every((p) => p == null)) return true;
  return false;
}
