/**
 * 形状类（比「面积档」更细）：方块 / 横条 / 竖条 / 转角 / 斜 Z / T
 * 推送时与 size-rhythm 交叉约束，保证多元。
 */
import {
  FORM_FAMILIES,
  countCells,
  familyBaseWeights,
  matrixSize,
} from '../forms.js';

/**
 * @typedef {'rect' | 'bar_h' | 'bar_v' | 'corner' | 'skew' | 'tee' | 'dot'} ShapeClass
 */

/**
 * 由矩阵几何判定形状类（不单看 family）
 * @param {number[][]} matrix
 * @param {number} [family]
 * @returns {ShapeClass}
 */
export function shapeClassOfMatrix(matrix, family = -1) {
  const cells = countCells(matrix);
  if (cells <= 1) return 'dot';

  const { rows, cols } = matrixSize(matrix);
  const occupied = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (matrix[r][c]) occupied.push([r, c]);
    }
  }

  const rs = occupied.map(([r]) => r);
  const cs = occupied.map(([, c]) => c);
  const rMin = Math.min(...rs);
  const rMax = Math.max(...rs);
  const cMin = Math.min(...cs);
  const cMax = Math.max(...cs);
  const h = rMax - rMin + 1;
  const w = cMax - cMin + 1;

  // 单行 = 横条
  if (h === 1 && w === cells) return 'bar_h';
  // 单列 = 竖条
  if (w === 1 && h === cells) return 'bar_v';

  // 填满矩形 = 方块/矩形块
  if (h * w === cells) return 'rect';

  // 族兜底
  if (family === 5) return 'skew';
  if (family === 6) return 'tee';
  if (family === 3 || family === 4 || family === 9) return 'corner';

  // 几何：缺角 / 钩
  if (cells === h * w - 1) return 'corner';
  // T 特征：有一行或一列占 3 且中心有突出
  if (cells === 4) {
    const rowCounts = Array(h).fill(0);
    const colCounts = Array(w).fill(0);
    for (const [r, c] of occupied) {
      rowCounts[r - rMin] += 1;
      colCounts[c - cMin] += 1;
    }
    if (rowCounts.some((n) => n === 3) || colCounts.some((n) => n === 3)) return 'tee';
  }

  // Z 特征：两行各 2 且错位
  if (h === 2 && cells === 4) {
    const top = occupied.filter(([r]) => r === rMin).map(([, c]) => c);
    const bot = occupied.filter(([r]) => r === rMax).map(([, c]) => c);
    if (top.length === 2 && bot.length === 2) {
      const t0 = Math.min(...top);
      const b0 = Math.min(...bot);
      if (t0 !== b0) return 'skew';
    }
  }

  if (family >= 0) {
    if (family <= 2) return 'rect';
    if (family === 7 || family === 8 || family === 10 || family === 11) {
      return w >= h ? 'bar_h' : 'bar_v';
    }
  }
  return 'corner';
}

/**
 * @param {{ matrix: number[][], family?: number }} pieceOrForm
 */
export function shapeClassOf(pieceOrForm) {
  return shapeClassOfMatrix(pieceOrForm.matrix, pieceOrForm.family ?? -1);
}

/**
 * 阶段 + 开阔度 → 形状配方（3 槽尽量不同类）
 * @param {import('./phase.js').DealPhase} phase
 * @param {() => number} rng
 * @param {number} [fill]
 * @returns {ShapeClass[]}
 */
export function pickShapePlan(phase, rng = Math.random, fill = 0) {
  const open = fill < 0.48;

  /** @type {{ plan: ShapeClass[], w: number }[]} */
  let table;

  if (open || phase === 'early') {
    table = [
      { plan: ['rect', 'bar_h', 'corner'], w: 18 },
      { plan: ['rect', 'bar_v', 'tee'], w: 16 },
      { plan: ['bar_h', 'bar_v', 'rect'], w: 16 },
      { plan: ['rect', 'corner', 'bar_h'], w: 14 },
      { plan: ['bar_v', 'corner', 'rect'], w: 12 },
      { plan: ['tee', 'rect', 'bar_h'], w: 10 },
      { plan: ['skew', 'rect', 'bar_v'], w: 8 },
      { plan: ['corner', 'bar_h', 'tee'], w: 6 },
    ];
  } else if (phase === 'mid') {
    table = [
      { plan: ['corner', 'bar_h', 'rect'], w: 16 },
      { plan: ['skew', 'bar_v', 'corner'], w: 14 },
      { plan: ['tee', 'corner', 'bar_h'], w: 14 },
      { plan: ['bar_v', 'rect', 'corner'], w: 12 },
      { plan: ['corner', 'skew', 'bar_h'], w: 12 },
      { plan: ['bar_h', 'tee', 'corner'], w: 12 },
      { plan: ['rect', 'corner', 'bar_v'], w: 10 },
      { plan: ['skew', 'tee', 'bar_v'], w: 10 },
    ];
  } else {
    table = [
      { plan: ['corner', 'bar_h', 'skew'], w: 16 },
      { plan: ['bar_v', 'corner', 'tee'], w: 14 },
      { plan: ['tee', 'bar_h', 'corner'], w: 14 },
      { plan: ['skew', 'bar_v', 'corner'], w: 12 },
      { plan: ['corner', 'corner', 'bar_h'], w: 10 }, // 允许两个转角，方向不同靠变体
      { plan: ['bar_h', 'bar_v', 'corner'], w: 12 },
      { plan: ['rect', 'corner', 'bar_v'], w: 10 },
      { plan: ['tee', 'skew', 'bar_h'], w: 12 },
    ];
  }

  let total = 0;
  for (const row of table) total += row.w;
  let r = rng() * total;
  for (const row of table) {
    r -= row.w;
    if (r <= 0) return row.plan.slice();
  }
  return table[0].plan.slice();
}

/**
 * 形状多元验收：至少 2 种不同类；禁止三同类/三同向条
 * @param {{ matrix: number[][], family?: number }[]} pieces
 */
export function acceptShapeDiversity(pieces) {
  if (!pieces?.length) return false;
  const classes = pieces.map((p) => shapeClassOf(p));
  const uniq = new Set(classes);
  if (uniq.size < 2) return false;

  const count = (c) => classes.filter((x) => x === c).length;
  if (count('bar_h') >= 3) return false;
  if (count('bar_v') >= 3) return false;
  if (count('corner') >= 3) return false;
  if (count('rect') >= 3) return false;
  if (count('tee') >= 3) return false;
  if (count('skew') >= 3) return false;

  // 两条同向 + 再一个同类条 → 太单调
  if (count('bar_h') + count('bar_v') === 3 && uniq.size === 2) {
    // bar_h + bar_v + bar_* 其实 uniq 至少 2；三全是条可以
    if (count('bar_h') === 2 || count('bar_v') === 2) {
      // 2 横 + 1 竖 其实还行；2 横 + 1 横 已在 count>=3 排除
    }
  }
  return true;
}

/**
 * 与形状配方的匹配分
 * @param {{ matrix: number[][], family?: number }[]} pieces
 * @param {ShapeClass[]} plan
 */
export function shapePlanScore(pieces, plan) {
  let score = 0;
  for (let i = 0; i < Math.min(pieces.length, plan.length); i++) {
    if (shapeClassOf(pieces[i]) === plan[i]) score += 3;
  }
  score += new Set(pieces.map((p) => shapeClassOf(p))).size;
  return score;
}

/**
 * 在尺寸档 ∩ 形状类 ∩ 可放 中加权抽 form
 * @param {(number|null)[][]} board
 * @param {import('./size-rhythm.js').SizeTier | null} tier  null = 不限档
 * @param {ShapeClass | null} shapeClass
 * @param {number[]} familyMul
 * @param {Set<string>} usedKeys
 * @param {(b: any, m: number[][]) => boolean} canPlace
 * @param {() => number} rng
 * @param {(form: import('../forms.js').FormDef) => import('./size-rhythm.js').SizeTier} tierOfFormFn
 */
/**
 * 在 尺寸档 ∩ 形状类 ∩ 可放 中加权抽 form
 * @param {(number|null)[][]} board
 * @param {import('./size-rhythm.js').SizeTier | null} tier
 * @param {ShapeClass | null} shapeClass
 * @param {number[]} familyMul
 * @param {Set<string>} usedKeys
 * @param {(b: any, m: number[][]) => boolean} canPlace
 * @param {() => number} rng
 * @param {(form: import('../forms.js').FormDef) => import('./size-rhythm.js').SizeTier} tierOfFormFn
 */
export function pickFittingForm(
  board,
  tier,
  shapeClass,
  familyMul,
  usedKeys,
  canPlace,
  rng,
  tierOfFormFn,
) {
  /** @type {{ form: import('../forms.js').FormDef, w: number }[]} */
  const candidates = [];
  const base = familyBaseWeights();

  for (let fi = 0; fi < FORM_FAMILIES.length; fi++) {
    const vars = FORM_FAMILIES[fi];
    if (!vars?.length) continue;
    const famW = Math.max(0, (base[fi] || 1) * (familyMul[fi] ?? 1));
    for (const form of vars) {
      if (tier && tierOfFormFn(form) !== tier) continue;
      if (shapeClass && shapeClassOf(form) !== shapeClass) continue;
      const key = form.matrix.map((row) => row.join('')).join('/');
      if (usedKeys.has(key)) continue;
      if (!canPlace(board, form.matrix)) continue;
      candidates.push({ form, w: famW });
    }
  }

  if (!candidates.length) return null;
  let total = 0;
  for (const c of candidates) total += c.w;
  let r = rng() * total;
  for (const c of candidates) {
    r -= c.w;
    if (r <= 0) return c.form;
  }
  return candidates[candidates.length - 1].form;
}
