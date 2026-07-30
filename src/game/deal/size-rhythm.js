/**
 * 空位推送时的「大块 / 小块」节奏。
 * 能放是前提；尽量推中大块，≤2 格仅破局偶发。
 */
import {
  DEAL_BAN_MICRO,
  DEAL_MICRO_CLUTCH_CHANCE,
  DEAL_MICRO_CLUTCH_FILL,
} from '../defaults.js';
import { FORM_FAMILIES, countCells, familyBaseWeights } from '../forms.js';
import { getTune } from '../tune.js';

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
 * 各阶段 tray 尺寸配方；优先 L/M，少 S。
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
    // 空格多：大块为主，几乎不要 S
    table = [
      { plan: ['L', 'L', 'M'], w: 32 },
      { plan: ['L', 'M', 'M'], w: 28 },
      { plan: ['L', 'L', 'L'], w: 18 },
      { plan: ['M', 'L', 'M'], w: 14 },
      { plan: ['L', 'M', 'S'], w: 6 },
      { plan: ['L', 'S', 'M'], w: 2 },
    ];
  } else if (phase === 'early') {
    // 前期：偏大，利于大范围摆放
    table = [
      { plan: ['L', 'L', 'M'], w: 36 },
      { plan: ['L', 'M', 'M'], w: 28 },
      { plan: ['L', 'L', 'L'], w: 20 },
      { plan: ['M', 'L', 'M'], w: 12 },
      { plan: ['L', 'M', 'S'], w: 4 },
    ];
  } else if (phase === 'mid') {
    // 中期：中块为主，大块减少（少「大范围」）
    table = [
      { plan: ['M', 'M', 'L'], w: 24 },
      { plan: ['M', 'L', 'M'], w: 20 },
      { plan: ['M', 'M', 'M'], w: 18 },
      { plan: ['L', 'M', 'M'], w: 14 },
      { plan: ['M', 'M', 'S'], w: 12 },
      { plan: ['M', 'S', 'M'], w: 8 },
      { plan: ['L', 'M', 'S'], w: 4 },
    ];
  } else {
    // late：仍偏 M，S 偶发破局；禁止双 S 为主
    table = [
      { plan: ['M', 'M', 'L'], w: 22 },
      { plan: ['M', 'L', 'M'], w: 20 },
      { plan: ['M', 'M', 'S'], w: 16 },
      { plan: ['L', 'M', 'S'], w: 14 },
      { plan: ['M', 'S', 'M'], w: 12 },
      { plan: ['S', 'M', 'L'], w: 10 },
      { plan: ['M', 'S', 'S'], w: 4 },
      { plan: ['S', 'S', 'M'], w: 2 },
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
 * 是否允许本 tray 出现 ≤2 格「微块」
 * @param {number} fill
 * @param {import('./phase.js').DealPhase} phase
 * @param {() => number} [rng]
 */
export function allowMicroClutch(fill, phase, rng = Math.random, t = getTune()) {
  const ban = flag(t.DEAL_BAN_MICRO, DEAL_BAN_MICRO);
  if (!ban) return true;
  const fillMin = num(t.DEAL_MICRO_CLUTCH_FILL, DEAL_MICRO_CLUTCH_FILL);
  const chance = num(t.DEAL_MICRO_CLUTCH_CHANCE, DEAL_MICRO_CLUTCH_CHANCE);
  if (fill < fillMin) return false;
  if (phase !== 'late' && phase !== 'mid') return false;
  return rng() < chance;
}

/**
 * 硬约束：能推大块时少小块；≤2 格默认禁
 * @param {import('../forms.js').PieceDef[]} pieces
 * @param {number} fill
 * @param {import('./phase.js').DealPhase} phase
 * @param {{ allowMicro?: boolean }} [opts]
 */
export function acceptSizeMix(pieces, fill, phase, opts = {}) {
  if (!pieces?.length) return false;
  const cells = pieces.map((p) => countCells(p.matrix));
  const maxC = Math.max(...cells);
  const minC = Math.min(...cells);
  const microCount = cells.filter((c) => c <= 2).length;
  const smallCount = cells.filter((c) => c <= 3).length;
  const largeCount = cells.filter((c) => c >= 6).length;
  const medCount = cells.filter((c) => c >= 4 && c <= 5).length;
  const allowMicro = opts.allowMicro === true;

  // ≤2 格：默认最多 0；clutch 时最多 1
  if (microCount > (allowMicro ? 1 : 0)) return false;

  // 三块全 ≤3 格：拒绝
  if (smallCount === 3) return false;

  if (isOpenBoard(fill)) {
    if (largeCount < 1) return false;
    // 开阔：最多 0 个 2–3 格小块（S），除非 max 很大且仅 1 个 S
    if (smallCount > 1) return false;
    if (smallCount === 1 && largeCount < 1) return false;
    if (maxC - minC < 2 && largeCount < 2) return false;
    return true;
  }

  if (phase === 'early') {
    if (maxC < 4) return false;
    if (smallCount >= 1 && largeCount < 1) return false;
    if (smallCount >= 2) return false;
    // early 平均要够大
    const avg = cells.reduce((a, b) => a + b, 0) / cells.length;
    if (avg < 4.5) return false;
    return true;
  }

  if (phase === 'mid') {
    if (maxC < 4) return false;
    // 中期最多 1 个 ≤3 格
    if (smallCount > 1) return false;
    return true;
  }

  // late：最多 1 个 ≤3；仍要有 ≥4
  if (smallCount > 1) return false;
  if (medCount + largeCount < 1) return false;
  return true;
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
  // 偏好更大平均面积
  const avg = cells.reduce((a, b) => a + b, 0) / cells.length;
  score += avg * 0.35;
  // 惩罚微块
  score -= cells.filter((c) => c <= 2).length * 4;
  score -= cells.filter((c) => c <= 3).length * 1.2;
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
      if (countCells(form.matrix) <= 2) continue;
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
    return /** @type {SizeTier[]} */ (['M', 'L']);
  }
  // 非开阔：S 需要时可落到 M/L，L/M 优先不落到 S
  if (tier === 'L') return /** @type {SizeTier[]} */ (['L', 'M', 'S']);
  if (tier === 'M') return /** @type {SizeTier[]} */ (['M', 'L', 'S']);
  if (tier === 'S') return /** @type {SizeTier[]} */ (['M', 'S', 'L']);
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

function flag(v, fb) {
  if (typeof v === 'number') return v >= 0.5;
  if (typeof v === 'boolean') return v;
  return !!fb;
}

function num(v, fb) {
  return Number.isFinite(v) ? Number(v) : fb;
}
