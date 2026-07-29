/**
 * 角色袋：staple / solver / key / rare
 * 与阶段配比、Kefrov 基础权重、phase mul 组合抽样。
 */
import {
  DEAL_BAG_ENABLED,
  DEAL_EARLY_BAN_TINY,
  DEAL_ROLE_EARLY_KEY,
  DEAL_ROLE_EARLY_RARE,
  DEAL_ROLE_EARLY_SOLVER,
  DEAL_ROLE_EARLY_STAPLE,
  DEAL_ROLE_LATE_KEY,
  DEAL_ROLE_LATE_RARE,
  DEAL_ROLE_LATE_SOLVER,
  DEAL_ROLE_LATE_STAPLE,
  DEAL_ROLE_MID_KEY,
  DEAL_ROLE_MID_RARE,
  DEAL_ROLE_MID_SOLVER,
  DEAL_ROLE_MID_STAPLE,
} from '../defaults.js';
import {
  FORM_FAMILIES,
  familyBaseWeights,
  matrixKey,
  pickWeightedForm,
} from '../forms.js';
import { getTune } from '../tune.js';
import { familyMulForPhase } from './phase.js';
import { shapeClassOf } from './shape-class.js';
import { tierOfForm } from './size-rhythm.js';

/** @typedef {'staple' | 'solver' | 'key' | 'rare'} PieceRole */

/** @type {Record<PieceRole, number[]>} */
export const ROLE_FAMILIES = {
  staple: [0, 1, 8, 10], // 2×2, 3×2, 3直, 4直
  solver: [4, 6, 9, 7], // 短L, T, 缺角, 2直
  key: [5, 3], // Z/S, 长L
  rare: [2, 11], // 3×3, 5直
};

/** early 默认禁族（γ）：过碎补丁 */
export const EARLY_BAN_FAMILIES = new Set([7, 9]);

/**
 * @param {number} family
 * @returns {PieceRole}
 */
export function roleOfFamily(family) {
  for (const [role, ids] of Object.entries(ROLE_FAMILIES)) {
    if (ids.includes(family)) return /** @type {PieceRole} */ (role);
  }
  return 'solver';
}

/**
 * 阶段角色配比（归一化后使用）
 * @param {import('./phase.js').DealPhase} phase
 * @returns {Record<PieceRole, number>}
 */
export function roleMixForPhase(phase, t = getTune()) {
  if (phase === 'early') {
    return {
      staple: num(t.DEAL_ROLE_EARLY_STAPLE, DEAL_ROLE_EARLY_STAPLE),
      solver: num(t.DEAL_ROLE_EARLY_SOLVER, DEAL_ROLE_EARLY_SOLVER),
      key: num(t.DEAL_ROLE_EARLY_KEY, DEAL_ROLE_EARLY_KEY),
      rare: num(t.DEAL_ROLE_EARLY_RARE, DEAL_ROLE_EARLY_RARE),
    };
  }
  if (phase === 'mid') {
    return {
      staple: num(t.DEAL_ROLE_MID_STAPLE, DEAL_ROLE_MID_STAPLE),
      solver: num(t.DEAL_ROLE_MID_SOLVER, DEAL_ROLE_MID_SOLVER),
      key: num(t.DEAL_ROLE_MID_KEY, DEAL_ROLE_MID_KEY),
      rare: num(t.DEAL_ROLE_MID_RARE, DEAL_ROLE_MID_RARE),
    };
  }
  return {
    staple: num(t.DEAL_ROLE_LATE_STAPLE, DEAL_ROLE_LATE_STAPLE),
    solver: num(t.DEAL_ROLE_LATE_SOLVER, DEAL_ROLE_LATE_SOLVER),
    key: num(t.DEAL_ROLE_LATE_KEY, DEAL_ROLE_LATE_KEY),
    rare: num(t.DEAL_ROLE_LATE_RARE, DEAL_ROLE_LATE_RARE),
  };
}

/**
 * @param {import('./phase.js').DealPhase} phase
 * @param {() => number} rng
 * @returns {PieceRole}
 */
export function rollRole(phase, rng = Math.random, t = getTune()) {
  const mix = roleMixForPhase(phase, t);
  const entries = /** @type {[PieceRole, number][]} */ ([
    ['staple', mix.staple],
    ['solver', mix.solver],
    ['key', mix.key],
    ['rare', mix.rare],
  ]);
  let total = 0;
  for (const [, w] of entries) total += Math.max(0, w);
  if (total <= 0) return 'staple';
  let r = rng() * total;
  for (const [role, w] of entries) {
    r -= Math.max(0, w);
    if (r <= 0) return role;
  }
  return 'staple';
}

/**
 * 在角色袋内按 base×mul 抽 form；可选尺寸档 / 形状类
 * @param {object} opts
 * @param {PieceRole} opts.role
 * @param {(number|null)[][]} opts.board
 * @param {import('./phase.js').DealPhase} opts.phase
 * @param {import('./size-rhythm.js').SizeTier | null} [opts.tier]
 * @param {import('./shape-class.js').ShapeClass | null} [opts.shapeClass]
 * @param {Set<string>} opts.usedKeys
 * @param {(b:any,m:number[][])=>boolean} opts.canPlace
 * @param {() => number} [opts.rng]
 * @param {boolean} [opts.allowBanned] early 禁族
 */
export function pickFormFromRole(opts) {
  const {
    role,
    board,
    phase,
    tier = null,
    shapeClass = null,
    usedKeys,
    canPlace,
    rng = Math.random,
    allowBanned = false,
  } = opts;

  const ban =
    phase === 'early' &&
    !allowBanned &&
    flag(getTune().DEAL_EARLY_BAN_TINY, DEAL_EARLY_BAN_TINY);

  const mul = familyMulForPhase(phase);
  const base = familyBaseWeights();
  const families = ROLE_FAMILIES[role] || ROLE_FAMILIES.staple;

  /** @type {{ form: import('../forms.js').FormDef, w: number }[]} */
  const candidates = [];

  for (const fi of families) {
    if (ban && EARLY_BAN_FAMILIES.has(fi)) continue;
    const vars = FORM_FAMILIES[fi];
    if (!vars?.length) continue;
    const famW = Math.max(0, (base[fi] || 1) * (mul[fi] ?? 1));
    for (const form of vars) {
      if (tier && tierOfForm(form) !== tier) continue;
      if (shapeClass && shapeClassOf(form) !== shapeClass) continue;
      const key = matrixKey(form.matrix);
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
 * 角色袋是否启用
 */
export function isBagEnabled(t = getTune()) {
  return flag(t.DEAL_BAG_ENABLED, DEAL_BAG_ENABLED);
}

/**
 * 回退：不限角色，但仍尊重 early 禁族
 */
export function pickFormAnyAllowed(board, phase, usedKeys, canPlace, rng, familyMul = null) {
  const ban =
    phase === 'early' && flag(getTune().DEAL_EARLY_BAN_TINY, DEAL_EARLY_BAN_TINY);
  const mul = familyMul || familyMulForPhase(phase);
  for (let t = 0; t < 48; t++) {
    const form = pickWeightedForm(rng, mul);
    if (ban && EARLY_BAN_FAMILIES.has(form.family)) continue;
    const key = matrixKey(form.matrix);
    if (usedKeys.has(key)) continue;
    if (!canPlace(board, form.matrix)) continue;
    return form;
  }
  return null;
}

function num(v, fb) {
  return Number.isFinite(v) ? Number(v) : fb;
}

function flag(v, fb) {
  if (typeof v === 'number') return v >= 0.5;
  if (typeof v === 'boolean') return v;
  return !!fb;
}
