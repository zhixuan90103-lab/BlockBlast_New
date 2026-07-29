/**
 * 空位推送时的「大块 / 小块」节奏。
 * 能放是前提；尺寸组合由阶段 + 盘面开阔度共同决定。
 */
import { FORM_FAMILIES, countCells, familyBaseWeights } from '../forms.js';

/** @typedef {'S' | 'M' | 'L'} SizeTier */

/**
 * 格数 → 档
 * S: 2–3  M: 4–5  L: 6–9
 * @param {number} cells
 * @returns {SizeTier}
 */
export function tierOfCells(cells) {
  if (cells <= 3) return 'S';
  if (cells <= 5) return 'M';
  return 'L';
}

/**
 * @param {import('../forms.js').FormDef} form
 * @returns {SizeTier}
 */
export function tierOfForm(form) {
  return tierOfCells(countCells(form.matrix));
}

/**
 * 盘面是否「空很多」——此时禁止全小块
 * @param {number} fill 0..1
 */
export function isOpenBoard(fill) {
  return fill < 0.48;
}

/**
 * 各阶段 tray 尺寸配方；开阔盘强制带大块。
 * @param {import('./phase.js').DealPhase} phase
 * @param {() => number} rng
 * @param {number} [fill]
 * @returns {SizeTier[]}
 */
export function pickSizePlan(phase, rng = Math.random, fill = 0) {
  const open = isOpenBoard(fill);

  /** @type {{ plan: SizeTier[], w: number }[]} */
  let table;

  if (open) {
    // 空格多：必须混大块，禁止 S+S+S / 仅小中
    table = [
      { plan: ['L', 'M', 'S'], w: 26 },
      { plan: ['L', 'L', 'M'], w: 22 },
      { plan: ['L', 'M', 'M'], w: 20 },
      { plan: ['M', 'L', 'S'], w: 14 },
      { plan: ['L', 'S', 'M'], w: 12 },
      { plan: ['L', 'L', 'S'], w: 6 },
    ];
  } else if (phase === 'early') {
    table = [
      { plan: ['L', 'L', 'M'], w: 28 },
      { plan: ['L', 'M', 'M'], w: 24 },
      { plan: ['L', 'L', 'L'], w: 16 },
      { plan: ['L', 'M', 'S'], w: 14 },
      { plan: ['M', 'L', 'M'], w: 12 },
      { plan: ['L', 'S', 'M'], w: 6 },
    ];
  } else if (phase === 'mid') {
    table = [
      { plan: ['L', 'S', 'M'], w: 22 },
      { plan: ['M', 'L', 'S'], w: 18 },
      { plan: ['M', 'M', 'S'], w: 16 },
      { plan: ['L', 'M', 'S'], w: 16 },
      { plan: ['M', 'S', 'S'], w: 14 }, // 仍允许，但开阔时上面已排除
      { plan: ['S', 'M', 'L'], w: 14 },
    ];
  } else {
    table = [
      { plan: ['S', 'M', 'S'], w: 20 },
      { plan: ['M', 'S', 'S'], w: 18 },
      { plan: ['S', 'M', 'M'], w: 16 },
      { plan: ['M', 'S', 'L'], w: 16 },
      { plan: ['S', 'S', 'M'], w: 14 },
      { plan: ['S', 'S', 'L'], w: 10 },
      { plan: ['L', 'S', 'M'], w: 6 },
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
 * 硬约束：开阔盘必须有大/中混搭，禁止「全是小面积」
 * @param {import('../forms.js').PieceDef[]} pieces
 * @param {number} fill
 * @param {import('./phase.js').DealPhase} phase
 */
export function acceptSizeMix(pieces, fill, phase) {
  if (!pieces?.length) return false;
  const cells = pieces.map((p) => countCells(p.matrix));
  const maxC = Math.max(...cells);
  const minC = Math.min(...cells);
  const smallCount = cells.filter((c) => c <= 3).length;
  const largeCount = cells.filter((c) => c >= 6).length;
  const medCount = cells.filter((c) => c >= 4 && c <= 5).length;

  // 三块全 ≤3 格：任何阶段在「还有空位可放更大」时都拒绝（开阔必拒）
  if (smallCount === 3) return false;

  if (isOpenBoard(fill)) {
    // 空很多：至少 1 块 ≥6（大），且至少 1 块不是小（或平均够大）
    if (largeCount < 1) return false;
    // 最多 1 个纯小块（2–3 格），避免 1 大 + 2 豆丁
    if (smallCount > 1) return false;
    // 最大与最小差至少 2 格，形成「有大有小」
    if (maxC - minC < 2 && largeCount < 2) return false;
    return true;
  }

  if (phase === 'early') {
    if (maxC < 4) return false;
    if (smallCount >= 2) return false;
    return true;
  }

  if (phase === 'mid') {
    // 中期允许 2 小，但必须有一块 ≥4
    if (maxC < 4) return false;
    return true;
  }

  // late：允许更碎，但仍拒绝三豆丁
  if (smallCount === 3) return false;
  return medCount + largeCount >= 1;
}

/**
 * @param {import('../forms.js').PieceDef[]} pieces
 * @param {SizeTier[]} plan
 */
export function matchesSizePlan(pieces, plan) {
  if (pieces.length !== plan.length) return false;
  for (let i = 0; i < plan.length; i++) {
    if (tierOfCells(countCells(pieces[i].matrix)) !== plan[i]) return false;
  }
  return true;
}

/**
 * @param {import('../forms.js').PieceDef[]} pieces
 * @param {SizeTier[]} plan
 */
export function sizePlanScore(pieces, plan) {
  const rank = { S: 0, M: 1, L: 2 };
  let score = 0;
  for (let i = 0; i < Math.min(pieces.length, plan.length); i++) {
    const a = rank[tierOfCells(countCells(pieces[i].matrix))];
    const b = rank[plan[i]];
    score += 2 - Math.abs(a - b);
  }
  const cells = pieces.map((p) => countCells(p.matrix));
  score += Math.min(3, Math.max(...cells) - Math.min(...cells));
  return score;
}

/**
 * @param {(number|null)[][]} board
 * @param {SizeTier} tier
 * @param {number[]} familyMul
 * @param {Set<string>} usedKeys
 * @param {(cells: any, matrix: number[][]) => boolean} canPlace
 * @param {() => number} rng
 */
export function pickFittingFormForTier(board, tier, familyMul, usedKeys, canPlace, rng) {
  /** @type {{ form: import('../forms.js').FormDef, w: number }[]} */
  const candidates = [];
  const base = familyBaseWeights();

  for (let fi = 0; fi < FORM_FAMILIES.length; fi++) {
    const vars = FORM_FAMILIES[fi];
    if (!vars?.length) continue;
    const famW = Math.max(0, (base[fi] || 1) * (familyMul[fi] ?? 1));
    for (const form of vars) {
      if (tierOfForm(form) !== tier) continue;
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

/**
 * 开阔盘：L 只允许落到 M，禁止直接掉到 S
 * @param {SizeTier} tier
 * @param {boolean} openBoard
 * @param {number} [step]
 * @returns {SizeTier[]}
 */
export function tierFallbacks(tier, openBoard = false, step = 2) {
  if (openBoard && tier === 'L') {
    return /** @type {SizeTier[]} */ (['L', 'M']);
  }
  if (openBoard && tier === 'M') {
    return /** @type {SizeTier[]} */ (['M', 'L', 'S']);
  }
  const order = /** @type {SizeTier[]} */ (['S', 'M', 'L']);
  const i = order.indexOf(tier);
  /** @type {SizeTier[]} */
  const out = [tier];
  for (let d = 1; d <= step; d++) {
    if (i - d >= 0) out.push(order[i - d]);
    if (i + d < order.length) out.push(order[i + d]);
  }
  return out;
}
