/**
 * 盘面空腔匹配：根据当前已摆造型，找出「正好能嵌进缺口」的形状变体。
 * 例：右侧缺 L 形角 → 推对应朝向的小 L / 长 L，便于清线与清屏。
 */
import { GRID } from '../defaults.js';
import { FORM_FAMILIES, countCells, makePiece, matrixKey, matrixSize } from '../forms.js';
import {
  canPlaceOnCells,
  countFilled,
  existsPlacementOrder,
  findPlacements,
  fitsOn,
  simulatePlace,
} from './board-ops.js';

/**
 * 空格是否贴着已填格（前沿空洞）
 * @param {(number|null)[][]} cells
 * @param {number} r
 * @param {number} c
 */
function isFrontierEmpty(cells, r, c) {
  if (r < 0 || r >= GRID || c < 0 || c >= GRID) return false;
  if (cells[r][c] != null) return false;
  const dirs = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  for (const [dr, dc] of dirs) {
    const nr = r + dr;
    const nc = c + dc;
    if (nr < 0 || nr >= GRID || nc < 0 || nc >= GRID) continue;
    if (cells[nr][nc] != null) return true;
  }
  return false;
}

/**
 * 单次落点：空腔嵌合分（越高越「正好补缺」）
 * @param {(number|null)[][]} cells
 * @param {number[][]} matrix
 * @param {number} originRow
 * @param {number} originCol
 */
export function scoreCavityPlacement(cells, matrix, originRow, originCol) {
  if (!fitsOn(cells, matrix, originRow, originCol)) return -Infinity;

  const { rows, cols } = matrixSize(matrix);
  let pieceCells = 0;
  let nest = 0; // 贴实心边
  let frontierCover = 0; // 盖住前沿空
  let wall = 0;

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
      pieceCells += 1;
      const gr = originRow + r;
      const gc = originCol + c;
      addR[gr] += 1;
      addC[gc] += 1;

      if (isFrontierEmpty(cells, gr, gc)) frontierCover += 1;

      const dirs = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ];
      for (const [dr, dc] of dirs) {
        const nr = gr + dr;
        const nc = gc + dc;
        if (nr < 0 || nr >= GRID || nc < 0 || nc >= GRID) {
          wall += 1;
          continue;
        }
        if (cells[nr][nc] != null) nest += 1;
      }
    }
  }

  let lines = 0;
  let almost = 0;
  for (let r = 0; r < GRID; r++) {
    if (!addR[r]) continue;
    const a = rowFill[r] + addR[r];
    if (a >= GRID) lines += 1;
    else if (a === GRID - 1) almost += 1;
  }
  for (let c = 0; c < GRID; c++) {
    if (!addC[c]) continue;
    const a = colFill[c] + addC[c];
    if (a >= GRID) lines += 1;
    else if (a === GRID - 1) almost += 1;
  }

  const next = simulatePlace(cells, matrix, originRow, originCol);
  const filledAfter = countFilled(next);
  const filledBefore = countFilled(cells);
  const cleared =
    filledBefore + pieceCells - filledAfter;

  // 深嵌空腔：nest 高 + 盖前沿
  const nestRatio = nest / Math.max(1, pieceCells * 4);
  let score =
    nest * 2.8 +
    frontierCover * 5.5 +
    wall * 0.35 +
    lines * 35 +
    almost * 9 +
    cleared * 4 +
    nestRatio * 12;

  // 整块几乎全在前沿空上 → 典型「缺角补块」
  if (frontierCover >= pieceCells * 0.85 && nest >= pieceCells) {
    score += 40;
  }
  // 全清
  if (filledAfter === 0) score += 120;

  return score;
}

/**
 * 枚举所有形状变体在盘上的最佳空腔匹配
 * @param {(number|null)[][]} board
 * @param {{ families?: number[], minScore?: number, limit?: number }} [opts]
 * @returns {{ form: import('../forms.js').FormDef, score: number, r: number, c: number }[]}
 */
export function rankCavityMatches(board, opts = {}) {
  const minScore = opts.minScore ?? 18;
  const limit = opts.limit ?? 16;
  const families =
    opts.families ??
    // 补缺优先：缺角 L / 短 L / T / 短条 / 矩形
    [9, 4, 6, 8, 0, 1, 3];

  /** @type {{ form: import('../forms.js').FormDef, score: number, r: number, c: number }[]} */
  const out = [];
  const seen = new Set();

  for (const fi of families) {
    const vars = FORM_FAMILIES[fi];
    if (!vars) continue;
    for (const form of vars) {
      // 限落点数量，控制耗时
      const spots = findPlacements(board, form.matrix, 16);
      let best = null;
      for (const { r, c } of spots) {
        const score = scoreCavityPlacement(board, form.matrix, r, c);
        if (!best || score > best.score) best = { score, r, c };
      }
      if (!best || best.score < minScore) continue;
      const key = matrixKey(form.matrix);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ form, score: best.score, r: best.r, c: best.c });
    }
  }

  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit);
}

/**
 * 抽样权重：空腔匹配强力抬升
 * @param {(number|null)[][]} board
 * @param {{ matrix: number[][], family?: number }} form
 * @param {number} baseW
 */
export function weightWithCavity(board, form, baseW) {
  if (baseW <= 0) return 0;
  const spots = findPlacements(board, form.matrix, 32);
  if (!spots.length) return 0;
  let best = -Infinity;
  for (const { r, c } of spots) {
    const s = scoreCavityPlacement(board, form.matrix, r, c);
    if (s > best) best = s;
  }
  if (!Number.isFinite(best) || best < 8) {
    return baseW * 0.35;
  }
  // 高空腔分 → 大幅抬权
  return baseW * (1 + best / 12);
}

/**
 * 根据空腔贪心组 3 块 tray（尽量顺序可解、优先补缺）
 * @param {(number|null)[][]} board
 * @param {() => number} [rng]
 * @returns {import('../forms.js').PieceDef[] | null}
 */
export function tryCavityGuideTray(board, rng = Math.random) {
  const filled = countFilled(board);
  if (filled < 3) return null; // 太空无需补缺

  const matches = rankCavityMatches(board, {
    minScore: 16,
    limit: 36,
  });
  if (matches.length < 1) return null;

  /** @type {import('../forms.js').FormDef[]} */
  const picked = [];
  const used = new Set();
  let sim = board.map((row) => row.slice());

  // 逐步：在当前模拟盘上重排空腔分，取最高且可放
  for (let slot = 0; slot < 3; slot++) {
    const ranked = rankCavityMatches(sim, { minScore: 12, limit: 40 });
    let chosen = null;
    for (const m of ranked) {
      const key = matrixKey(m.form.matrix);
      if (used.has(key)) continue;
      if (!canPlaceOnCells(sim, m.form.matrix)) continue;
      // 略随机：前 3 名里抽，避免死板
      chosen = m;
      if (rng() < 0.55 || ranked.indexOf(m) >= 2) break;
    }
    // 回退：用初始 matches
    if (!chosen) {
      for (const m of matches) {
        const key = matrixKey(m.form.matrix);
        if (used.has(key)) continue;
        if (!canPlaceOnCells(sim, m.form.matrix)) continue;
        chosen = m;
        break;
      }
    }
    if (!chosen) break;

    used.add(matrixKey(chosen.form.matrix));
    picked.push(chosen.form);
    // 用最佳空腔落点推进（若失效则任意可放）
    let pos = { r: chosen.r, c: chosen.c };
    if (!fitsOn(sim, chosen.form.matrix, pos.r, pos.c)) {
      const spots = findPlacements(sim, chosen.form.matrix, 8);
      if (!spots.length) {
        picked.pop();
        break;
      }
      // 选空腔分最高落点
      let bestP = spots[0];
      let bestS = -Infinity;
      for (const s of spots) {
        const sc = scoreCavityPlacement(sim, chosen.form.matrix, s.r, s.c);
        if (sc > bestS) {
          bestS = sc;
          bestP = s;
        }
      }
      pos = bestP;
    }
    sim = simulatePlace(sim, chosen.form.matrix, pos.r, pos.c);
  }

  if (picked.length < 3) {
    // 垫整齐块到 3
    const padFams = [0, 1, 8, 2];
    for (const fi of padFams) {
      if (picked.length >= 3) break;
      for (const f of FORM_FAMILIES[fi] || []) {
        if (picked.length >= 3) break;
        const key = matrixKey(f.matrix);
        if (used.has(key)) continue;
        if (!canPlaceOnCells(sim, f.matrix) && countFilled(sim) > 0) {
          // 若盘已空可任意；若未空须可放
          if (countFilled(sim) > 0) continue;
        }
        if (countFilled(sim) > 0 && !canPlaceOnCells(sim, f.matrix)) continue;
        // 空盘
        if (countFilled(sim) === 0 || canPlaceOnCells(sim, f.matrix)) {
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
    }
  }

  if (picked.length < 3) return null;
  const pieces = picked.slice(0, 3).map((f) => makePiece(f));
  if (!existsPlacementOrder(board, pieces)) return null;

  // 至少一块是「真空腔补缺」（高分），否则不算 guide 成功
  const top = rankCavityMatches(board, { minScore: 22, limit: 8 });
  const keys = new Set(pieces.map((p) => matrixKey(p.matrix)));
  const hasRealCavity = top.some((m) => keys.has(matrixKey(m.form.matrix)));
  if (!hasRealCavity && filled < 12) {
    // 中等盘也要求有一定空腔感
    const mid = rankCavityMatches(board, { minScore: 18, limit: 12 });
    if (!mid.some((m) => keys.has(matrixKey(m.form.matrix)))) return null;
  }

  return pieces;
}
