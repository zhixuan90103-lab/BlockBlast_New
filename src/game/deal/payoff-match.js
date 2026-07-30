/**
 * T6 Setup 大消：玩家自建近满线 / 结构后，推「钥匙块」打出多线消除。
 * 按当前盘快照计算，非全清。
 */
import { GRID } from '../defaults.js';
import {
  FORM_FAMILIES,
  countCells,
  makePiece,
  matrixKey,
  matrixSize,
} from '../forms.js';
import {
  canPlaceOnCells,
  countFilled,
  existsPlacementOrder,
  findPlacements,
  fitsOn,
  simulatePlace,
} from './board-ops.js';

/**
 * 落下后消除的行+列数（模拟放置）
 * @param {(number|null)[][]} cells
 * @param {number[][]} matrix
 * @param {number} originRow
 * @param {number} originCol
 */
export function countLinesClearedByPlace(cells, matrix, originRow, originCol) {
  if (!fitsOn(cells, matrix, originRow, originCol)) return 0;
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
 * 近满线数量（差 1 / 差 2）
 * @param {(number|null)[][]} board
 */
export function countNearFullLines(board) {
  let d1 = 0;
  let d2 = 0;
  for (let r = 0; r < GRID; r++) {
    let f = 0;
    for (let c = 0; c < GRID; c++) if (board[r][c] != null) f += 1;
    if (f === GRID - 1) d1 += 1;
    else if (f === GRID - 2) d2 += 1;
  }
  for (let c = 0; c < GRID; c++) {
    let f = 0;
    for (let r = 0; r < GRID; r++) if (board[r][c] != null) f += 1;
    if (f === GRID - 1) d1 += 1;
    else if (f === GRID - 2) d2 += 1;
  }
  return { d1, d2, score: d1 * 2 + d2 };
}

/**
 * 形状在盘上的最佳多线消
 * @returns {{ form, lines, r, c } | null}
 */
export function bestPayoffForForm(board, form) {
  const spots = findPlacements(board, form.matrix, 20);
  let best = null;
  for (const { r, c } of spots) {
    const lines = countLinesClearedByPlace(board, form.matrix, r, c);
    if (lines <= 0) continue;
    if (!best || lines > best.lines) best = { form, lines, r, c };
  }
  return best;
}

/**
 * 枚举可造成多线消的钥匙块
 * @param {(number|null)[][]} board
 * @param {number} [minLines]
 */
export function rankPayoffForms(board, minLines = 2) {
  // 优先条 / 短L / T / 缺角 / 长L / 矩形
  const order = [8, 10, 4, 6, 9, 3, 0, 1, 11, 2];
  /** @type {{ form: import('../forms.js').FormDef, lines: number, r: number, c: number }[]} */
  const out = [];
  const seen = new Set();

  for (const fi of order) {
    for (const form of FORM_FAMILIES[fi] || []) {
      if (countCells(form.matrix) <= 2) continue;
      const best = bestPayoffForForm(board, form);
      if (!best || best.lines < minLines) continue;
      const key = matrixKey(form.matrix);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(best);
    }
  }
  out.sort((a, b) => b.lines - a.lines);
  return out;
}

/**
 * 是否值得尝试 payoff tray（盘上有 setup）
 * @param {(number|null)[][]} board
 */
export function boardHasPayoffSetup(board) {
  const near = countNearFullLines(board);
  if (near.score >= 2) return true;
  const top = rankPayoffForms(board, 2);
  return top.length > 0 && top[0].lines >= 2;
}

/**
 * 组 3 块：1～2 个钥匙 + 垫块，存在可放序
 * @param {(number|null)[][]} board
 * @param {() => number} [rng]
 */
export function tryPayoffTray(board, rng = Math.random) {
  if (countFilled(board) < 8) return null;
  if (!boardHasPayoffSetup(board)) return null;

  const ranked = rankPayoffForms(board, 2);
  if (!ranked.length) return null;

  /** @type {import('../forms.js').FormDef[]} */
  const picked = [];
  const used = new Set();
  let sim = board.map((row) => row.slice());

  // 第一块：最高 lines，前 3 名随机
  const topN = ranked.slice(0, Math.min(3, ranked.length));
  const first = topN[Math.floor(rng() * topN.length)];
  picked.push(first.form);
  used.add(matrixKey(first.form.matrix));
  if (fitsOn(sim, first.form.matrix, first.r, first.c)) {
    sim = simulatePlace(sim, first.form.matrix, first.r, first.c);
  } else {
    const spots = findPlacements(sim, first.form.matrix, 4);
    if (spots[0]) sim = simulatePlace(sim, first.form.matrix, spots[0].r, spots[0].c);
  }

  // 第二块：若仍有 payoff 再取；否则垫整齐
  const ranked2 = rankPayoffForms(sim, 2);
  for (const m of ranked2) {
    const key = matrixKey(m.form.matrix);
    if (used.has(key)) continue;
    if (!canPlaceOnCells(sim, m.form.matrix)) continue;
    picked.push(m.form);
    used.add(key);
    if (fitsOn(sim, m.form.matrix, m.r, m.c)) {
      sim = simulatePlace(sim, m.form.matrix, m.r, m.c);
    }
    break;
  }

  // 垫满 3：矩形/短条/短 L
  const padOrder = [0, 1, 8, 4, 6, 9, 2];
  for (const fi of padOrder) {
    if (picked.length >= 3) break;
    for (const f of FORM_FAMILIES[fi] || []) {
      if (picked.length >= 3) break;
      const key = matrixKey(f.matrix);
      if (used.has(key)) continue;
      if (countCells(f.matrix) <= 2) continue;
      if (countFilled(sim) > 0 && !canPlaceOnCells(sim, f.matrix)) continue;
      used.add(key);
      picked.push(f);
      if (countFilled(sim) > 0) {
        const spots = findPlacements(sim, f.matrix, 1);
        if (spots[0]) {
          sim = simulatePlace(sim, f.matrix, spots[0].r, spots[0].c);
        }
      }
    }
  }

  if (picked.length < 3) return null;
  const pieces = picked.slice(0, 3).map((f) => makePiece(f));
  if (!existsPlacementOrder(board, pieces)) return null;

  // 至少一块在原盘上能打出 ≥2 线
  const keys = new Set(pieces.map((p) => matrixKey(p.matrix)));
  const ok = ranked.some((m) => keys.has(matrixKey(m.form.matrix)));
  if (!ok) return null;

  return pieces;
}
