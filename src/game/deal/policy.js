/**
 * DealPolicy：阶段手感 + defaults/tune 合并
 *
 * 共识：
 *  early — 大摆放、大范围消除、偶尔清屏
 *  mid   — 少量大消、少量清屏（加压）
 *  late  — 更稀的释放
 */
import {
  DEAL_CAVITY_GUIDE_CHANCE,
  DEAL_CAVITY_GUIDE_CHANCE_EARLY,
  DEAL_CAVITY_GUIDE_CHANCE_MID,
  DEAL_CLEAR_ASSIST_EVERY,
  DEAL_CLEAR_ASSIST_EVERY_EARLY,
  DEAL_CLEAR_ASSIST_EVERY_LATE,
  DEAL_CLEAR_ASSIST_EVERY_MID,
  DEAL_CLEAR_ASSIST_STREAK,
  DEAL_CLEAR_FINISHER_FILL_MAX,
  DEAL_CLEAR_OFFER_RETRY_MAX,
  DEAL_EARLY_CLEAR_CHANCE,
  DEAL_EARLY_CLEAR_FILL_MAX,
  DEAL_EARLY_FORCE_FULL_CLEAR,
  DEAL_LATE_CLEAR_CHANCE,
  DEAL_MID_CLEAR_CHANCE,
  DEAL_PAYOFF_CHANCE,
  DEAL_PAYOFF_CHANCE_EARLY,
  DEAL_PAYOFF_CHANCE_LATE,
  DEAL_PAYOFF_CHANCE_MID,
  DEAL_PAYOFF_MIN_LINES,
} from '../defaults.js';
import { getTune } from '../tune.js';

function num(v, fb) {
  return Number.isFinite(v) ? Number(v) : fb;
}

function flag(v, fb) {
  if (typeof v === 'number') return v >= 0.5;
  if (typeof v === 'boolean') return v;
  return !!fb;
}

/**
 * @param {import('./phase.js').DealPhase} [phase]
 */
export function getDealPolicy(phase = 'mid', t = getTune()) {
  const everyDefault =
    phase === 'early'
      ? DEAL_CLEAR_ASSIST_EVERY_EARLY
      : phase === 'late'
        ? DEAL_CLEAR_ASSIST_EVERY_LATE
        : DEAL_CLEAR_ASSIST_EVERY_MID;

  const payoffDefault =
    phase === 'early'
      ? DEAL_PAYOFF_CHANCE_EARLY
      : phase === 'late'
        ? DEAL_PAYOFF_CHANCE_LATE
        : DEAL_PAYOFF_CHANCE_MID;

  const cavityDefault =
    phase === 'early'
      ? DEAL_CAVITY_GUIDE_CHANCE_EARLY
      : phase === 'mid'
        ? DEAL_CAVITY_GUIDE_CHANCE_MID
        : DEAL_CAVITY_GUIDE_CHANCE * 0.5;

  // 面板若改了全局 every/payoff，仍尊重；阶段默认用分档
  const everyGlobal = num(t.DEAL_CLEAR_ASSIST_EVERY, DEAL_CLEAR_ASSIST_EVERY);
  const usePhaseEvery = everyGlobal === DEAL_CLEAR_ASSIST_EVERY;

  const payoffGlobal = num(t.DEAL_PAYOFF_CHANCE, DEAL_PAYOFF_CHANCE);
  const usePhasePayoff = payoffGlobal === DEAL_PAYOFF_CHANCE;

  const cavityGlobal = num(t.DEAL_CAVITY_GUIDE_CHANCE, DEAL_CAVITY_GUIDE_CHANCE);
  const usePhaseCavity = cavityGlobal === DEAL_CAVITY_GUIDE_CHANCE;

  return {
    every: Math.max(
      1,
      Math.round(usePhaseEvery ? everyDefault : everyGlobal),
    ),
    streakMax: Math.max(
      0,
      Math.round(num(t.DEAL_CLEAR_ASSIST_STREAK, DEAL_CLEAR_ASSIST_STREAK)),
    ),
    finisherFillMax: num(t.DEAL_CLEAR_FINISHER_FILL_MAX, DEAL_CLEAR_FINISHER_FILL_MAX),
    earlyClearFillMax: num(t.DEAL_EARLY_CLEAR_FILL_MAX, DEAL_EARLY_CLEAR_FILL_MAX),
    earlyForceFull: flag(t.DEAL_EARLY_FORCE_FULL_CLEAR, DEAL_EARLY_FORCE_FULL_CLEAR),
    cavityChance: usePhaseCavity
      ? cavityDefault
      : cavityGlobal,
    payoffChance: usePhasePayoff ? payoffDefault : payoffGlobal,
    payoffMinLines: Math.max(
      2,
      Math.round(num(t.DEAL_PAYOFF_MIN_LINES, DEAL_PAYOFF_MIN_LINES)),
    ),
    clearRetryMax: Math.max(
      1,
      Math.round(num(t.DEAL_CLEAR_OFFER_RETRY_MAX, DEAL_CLEAR_OFFER_RETRY_MAX)),
    ),
    earlyClearChance: num(t.DEAL_EARLY_CLEAR_CHANCE, DEAL_EARLY_CLEAR_CHANCE),
    midClearChance: num(t.DEAL_MID_CLEAR_CHANCE, DEAL_MID_CLEAR_CHANCE),
    lateClearChance: num(t.DEAL_LATE_CLEAR_CHANCE, DEAL_LATE_CLEAR_CHANCE),
    /** 阶段叙事标签 */
    intentLabel:
      phase === 'early'
        ? 'big-place-big-clear-rare-allclear'
        : phase === 'mid'
          ? 'scarce-big-clear-scarce-allclear'
          : 'pressure',
  };
}
