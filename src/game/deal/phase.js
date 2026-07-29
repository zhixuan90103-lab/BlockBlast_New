/**
 * 阶段：early / mid / late
 * - 由填充率定 base
 * - 再按概率「呼吸」回跳
 * - 各族权重倍率
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
    mul[1] = neat * 1.4;
    mul[2] = neat * 1.3;
    mul[0] = neat * 1.15;
    mul[3] = neat * 1.0;
    mul[10] = neat * 0.95;
    mul[11] = neat * 0.7;
    mul[8] = neat * 0.45;
    mul[6] = 0.35;
    mul[5] = 0.25;
    mul[4] = 0.2;
    mul[9] = 0.18;
    mul[7] = 0.1;
  } else if (phase === 'mid') {
    mul[4] = scrap * 1.15;
    mul[9] = scrap * 1.2;
    mul[5] = scrap * 1.1;
    mul[6] = scrap * 0.95;
    mul[8] = scrap * 0.75;
    mul[7] = scrap * 0.7;
    mul[0] = 0.95;
    mul[3] = 0.9;
    mul[1] = 0.75;
    mul[10] = 0.7;
    mul[2] = bigDamp;
    mul[11] = 0.55;
  } else {
    for (const i of [3, 5, 6, 10, 11]) mul[i] = awkward;
    mul[4] = awkward * 0.9;
    mul[9] = awkward * 0.85;
    mul[0] = 0.55;
    mul[1] = 0.6;
    mul[2] = 0.4;
    mul[7] = 0.9;
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
