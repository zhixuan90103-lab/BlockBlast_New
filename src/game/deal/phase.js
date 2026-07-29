/**
 * 阶段：early / mid / late
 * - 由填充率定 base
 * - 再按概率「呼吸」回跳
 * - 各族权重倍率（α：对齐角色目标，压 early 3×3、降 mid 碎块过重）
 */
import {
  DEAL_EARLY_INSTANT_MAX,
  DEAL_EARLY_INSTANT_MIN,
  DEAL_EARLY_NEAT_MUL,
  DEAL_FILL_EARLY_MAX,
  DEAL_FILL_MID_MAX,
  DEAL_LATE_AWKWARD_MUL,
  DEAL_LATE_INSTANT_MAX,
  DEAL_LATE_INSTANT_MIN,
  DEAL_LATE_RELAX_EARLY,
  DEAL_LATE_RELAX_MID,
  DEAL_MID_BIG_DAMP,
  DEAL_MID_INSTANT_MAX,
  DEAL_MID_INSTANT_MIN,
  DEAL_MID_RELAX_EARLY,
  DEAL_MID_SCRAP_MUL,
} from '../defaults.js';
import { getTune } from '../tune.js';

/** @typedef {'early' | 'mid' | 'late'} DealPhase */

/**
 * @param {number} fill 0..1
 * @returns {DealPhase}
 */
export function basePhaseFromFill(fill, t = getTune()) {
  const earlyMax = num(t.DEAL_FILL_EARLY_MAX, DEAL_FILL_EARLY_MAX);
  const midMax = num(t.DEAL_FILL_MID_MAX, DEAL_FILL_MID_MAX);
  if (fill < earlyMax) return 'early';
  if (fill < midMax) return 'mid';
  return 'late';
}

/**
 * @param {DealPhase} base
 * @param {() => number} [rng]
 * @returns {DealPhase}
 */
export function rollDealPhase(base, rng = Math.random, t = getTune()) {
  if (base === 'late') {
    const pE = num(t.DEAL_LATE_RELAX_EARLY, DEAL_LATE_RELAX_EARLY);
    const pM = num(t.DEAL_LATE_RELAX_MID, DEAL_LATE_RELAX_MID);
    const r = rng();
    if (r < pE) return 'early';
    if (r < pE + pM) return 'mid';
    return 'late';
  }
  if (base === 'mid') {
    if (rng() < num(t.DEAL_MID_RELAX_EARLY, DEAL_MID_RELAX_EARLY)) return 'early';
    return 'mid';
  }
  return 'early';
}

/**
 * @param {DealPhase} phase
 * @returns {{ min: number, max: number }}
 */
export function instantRangeForPhase(phase, t = getTune()) {
  if (phase === 'early') {
    return {
      min: ri(t.DEAL_EARLY_INSTANT_MIN, DEAL_EARLY_INSTANT_MIN),
      max: ri(t.DEAL_EARLY_INSTANT_MAX, DEAL_EARLY_INSTANT_MAX),
    };
  }
  if (phase === 'mid') {
    return {
      min: ri(t.DEAL_MID_INSTANT_MIN, DEAL_MID_INSTANT_MIN),
      max: ri(t.DEAL_MID_INSTANT_MAX, DEAL_MID_INSTANT_MAX),
    };
  }
  return {
    min: ri(t.DEAL_LATE_INSTANT_MIN, DEAL_LATE_INSTANT_MIN),
    max: ri(t.DEAL_LATE_INSTANT_MAX, DEAL_LATE_INSTANT_MAX),
  };
}

/**
 * 各族权重倍率 length 12
 * 0 2×2, 1 3×2, 2 3×3, 3 长L, 4 短L, 5 Z, 6 T, 7 2直, 8 3直, 9 缺角, 10 4直, 11 5直
 *
 * α 调整（检索 GAP）：
 * - early：3×3 单独压 rare；碎块保持低
 * - mid：降 scrap 过热，抬 staple 矩形/长条
 * - late：抬 key（Z/长L/5直），略压短L/缺角
 * @param {DealPhase} phase
 * @returns {number[]}
 */
export function familyMulForPhase(phase, t = getTune()) {
  const neat = num(t.DEAL_EARLY_NEAT_MUL, DEAL_EARLY_NEAT_MUL);
  const awkward = num(t.DEAL_LATE_AWKWARD_MUL, DEAL_LATE_AWKWARD_MUL);
  const bigDamp = num(t.DEAL_MID_BIG_DAMP, DEAL_MID_BIG_DAMP);
  const scrap = num(t.DEAL_MID_SCRAP_MUL, DEAL_MID_SCRAP_MUL);
  /** @type {number[]} */
  const mul = Array(12).fill(1);

  if (phase === 'early') {
    mul[0] = neat * 1.15; // 2×2 staple
    mul[1] = neat * 1.4; // 3×2 staple
    mul[2] = neat * 0.4; // 3×3 rare — 压过热（原 1.3）
    mul[3] = neat * 0.95; // 长 L key
    mul[10] = neat * 1.0; // 4 直 staple
    mul[11] = neat * 0.55; // 5 直 rare
    mul[8] = neat * 0.55; // 3 直
    mul[6] = 0.32; // T
    mul[5] = 0.28; // Z
    mul[4] = 0.18; // 短 L
    mul[9] = 0.12; // 缺角
    mul[7] = 0.08; // 2 直
  } else if (phase === 'mid') {
    // staple 抬起，solver 略降（原 scrap 过重）
    mul[0] = 1.15;
    mul[1] = 1.05;
    mul[8] = 1.1;
    mul[10] = 1.05;
    mul[4] = scrap * 0.85;
    mul[9] = scrap * 0.8;
    mul[5] = scrap * 0.95; // Z 仍作 key 向
    mul[6] = scrap * 0.8;
    mul[7] = scrap * 0.55;
    mul[3] = 1.05;
    mul[2] = bigDamp * 0.85;
    mul[11] = 0.65;
  } else {
    mul[5] = awkward * 1.2; // Z
    mul[3] = awkward * 1.15; // 长 L
    mul[11] = awkward * 1.15; // 5 直
    mul[10] = awkward * 1.05;
    mul[6] = awkward * 1.05;
    mul[4] = awkward * 0.75;
    mul[9] = awkward * 0.7;
    mul[8] = 1.05;
    mul[7] = 0.85;
    mul[0] = 0.5;
    mul[1] = 0.55;
    mul[2] = 0.35;
  }
  return mul;
}

/** 中期「碎块」族 */
export function isScrapFamily(family) {
  return family === 4 || family === 5 || family === 6 || family === 7 || family === 9;
}

function num(v, fb) {
  return Number.isFinite(v) ? Number(v) : fb;
}

function ri(v, fb) {
  return Math.round(num(v, fb));
}
