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
    // 主粮矩形/短条 + 基础 T/L（多样）；仍压 Z / 5 直 / 过长条
    mul[0] = neat * 1.55; // 2×2
    mul[1] = neat * 1.6; // 3×2
    mul[8] = neat * 1.25; // 3 直
    mul[10] = neat * 0.35; // 4 直略压
    mul[2] = neat * 0.4; // 3×3
    mul[4] = neat * 0.95; // 短 L 基础
    mul[6] = neat * 0.9; // T 基础
    mul[9] = neat * 0.85; // 缺角小 L
    mul[3] = neat * 0.45; // 长 L 可出、略少
    mul[11] = 0.05; // 5 直
    mul[5] = 0.06; // Z
    mul[7] = 0.05; // 2 直
  } else if (phase === 'mid') {
    // 中大块主粮；碎块/2直压低（偶发破局靠 clutch 放开）
    mul[0] = 1.35;
    mul[1] = 1.3;
    mul[8] = 1.25;
    mul[10] = 1.2;
    mul[3] = 1.15;
    mul[4] = scrap * 0.7;
    mul[9] = scrap * 0.55;
    mul[5] = scrap * 0.85;
    mul[6] = scrap * 0.75;
    mul[7] = 0.12; // 2 直：常规几乎不来
    mul[2] = bigDamp * 1.05;
    mul[11] = 0.85;
  } else {
    mul[5] = awkward * 1.2; // Z
    mul[3] = awkward * 1.15; // 长 L
    mul[11] = awkward * 1.15; // 5 直
    mul[10] = awkward * 1.1;
    mul[6] = awkward * 1.05;
    mul[8] = 1.15;
    mul[4] = awkward * 0.65;
    mul[9] = awkward * 0.5;
    mul[7] = 0.18; // 2 直仅残盘 clutch
    mul[0] = 0.65;
    mul[1] = 0.7;
    mul[2] = 0.4;
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
