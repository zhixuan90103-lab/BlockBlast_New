/**
 * 盘面局面分类（A–E 简化）：供发牌 Intent 门控与 meta 观测。
 * 纯函数，无随机、不改盘。
 *
 * empty     ≈ C2 后 / 开局
 * healthy   ≈ A 健康压盘
 * setup     ≈ B 近满线 / 可大消结构
 * fragmented≈ D 碎片麻子
 * choke     ≈ E 高占用窒息
 */
import { GRID } from '../defaults.js';
import { countFilled, fillRatio } from './board-ops.js';
import { countNearFullLines } from './payoff-match.js';

/** @typedef {'empty' | 'healthy' | 'setup' | 'fragmented' | 'choke'} BoardClass */

/**
 * 最大空矩形（轴对齐），用于口袋估计
 * @param {(number|null)[][]} board
 */
export function maxEmptyRect(board) {
  let best = 0;
  const height = new Array(GRID).fill(0);
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      height[c] = board[r][c] == null ? height[c] + 1 : 0;
    }
    for (let c = 0; c < GRID; c++) {
      if (!height[c]) continue;
      let minH = height[c];
      for (let k = c; k >= 0 && height[k] > 0; k--) {
        minH = Math.min(minH, height[k]);
        best = Math.max(best, minH * (c - k + 1));
      }
    }
  }
  return best;
}

/**
 * 空格 4-连通分量统计 + 单格洞数
 * @param {(number|null)[][]} board
 */
export function emptyComponentStats(board) {
  const seen = Array.from({ length: GRID }, () => Array(GRID).fill(false));
  let components = 0;
  let singles = 0;
  let small = 0; // size 1–3
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      if (board[r][c] != null || seen[r][c]) continue;
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
          if (seen[nr][nc] || board[nr][nc] != null) continue;
          seen[nr][nc] = true;
          q.push([nr, nc]);
        }
      }
      if (size === 1) singles += 1;
      if (size <= 3) small += 1;
    }
  }
  return { components, singles, small };
}

/**
 * @param {(number|null)[][]} board
 * @returns {{
 *   class: BoardClass,
 *   fill: number,
 *   filled: number,
 *   nearFull: { d1: number, d2: number, score: number },
 *   maxEmpty: number,
 *   fragScore: number,
 *   setupScore: number,
 *   components: number,
 *   singles: number,
 * }}
 */
export function classifyBoardState(board) {
  const filled = countFilled(board);
  const fill = fillRatio(board);
  const nearFull = countNearFullLines(board);
  const maxEmpty = maxEmptyRect(board);
  const { components, singles, small } = emptyComponentStats(board);

  // 碎片分：多小连通 + 单格洞
  const emptyCells = GRID * GRID - filled;
  const fragScore =
    emptyCells <= 0
      ? 0
      : singles * 2.2 + small * 0.9 + Math.max(0, components - 2) * 1.1;

  // setup：近满线 + 仍有一定占用
  const setupScore =
    fill < 0.08
      ? 0
      : nearFull.score + (nearFull.d1 >= 2 ? 2 : 0) + (nearFull.d1 + nearFull.d2 >= 3 ? 1.5 : 0);

  /** @type {BoardClass} */
  let cls = 'healthy';

  if (filled === 0 || fill < 0.02) {
    cls = 'empty';
  } else if (fill >= 0.62 && (maxEmpty < 9 || fragScore >= 5)) {
    cls = 'choke';
  } else if (
    fill >= 0.18 &&
    (fragScore >= 4.5 || singles >= 2 || (components >= 5 && singles >= 1))
  ) {
    cls = 'fragmented';
  } else if (setupScore >= 3 && fill >= 0.12 && fill <= 0.78) {
    cls = 'setup';
  } else {
    cls = 'healthy';
  }

  return {
    class: cls,
    fill,
    filled,
    nearFull,
    maxEmpty,
    fragScore,
    setupScore,
    components,
    singles,
  };
}

/** 是否允许硬搜「真全清」三件套 */
export function allowsFullClearSearch(boardClass) {
  return (
    boardClass === 'empty' ||
    boardClass === 'healthy' ||
    boardClass === 'setup'
  );
}

/** cavity 更该出现的盘 */
export function prefersCavity(boardClass) {
  return boardClass === 'fragmented' || boardClass === 'choke';
}

/** payoff 门控：setup 或足够 setupScore */
export function allowsPayoffIntent(state) {
  if (!state) return false;
  if (state.class === 'setup') return true;
  return state.setupScore >= 3 && state.fill >= 0.12 && state.fill < 0.85;
}
