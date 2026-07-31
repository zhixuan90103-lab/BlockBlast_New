/**
 * DealPolicy：阶段手感 + 局面门控 + defaults/tune 合并
 *
 * 共识：
 *  early — 大摆放、大范围消除、偶尔清屏
 *  mid   — 少量大消、少量清屏（加压）
 *  late  — 更稀的释放
 */
import {
  DEAL_ASSIST_MIN_GAP,
  DEAL_ASSIST_USE_INTERVAL,
  DEAL_BOARD_STATE_GATE,
  DEAL_CAVITY_GUIDE_CHANCE,
  DEAL_CAVITY_GUIDE_CHANCE_EARLY,
  DEAL_CAVITY_GUIDE_CHANCE_MID,
  DEAL_CLEAR_ASSIST_EVERY,
  DEAL_CLEAR_ASSIST_EVERY_EARLY,
  DEAL_CLEAR_ASSIST_EVERY_LATE,
  DEAL_CLEAR_ASSIST_EVERY_MID,
  DEAL_CLEAR_ASSIST_STREAK,
  DEAL_CLEAR_CANCEL_ON_HEALTHY,
  DEAL_CLEAR_FINISHER_FILL_MAX,
  DEAL_CLEAR_OFFER_RETRY_MAX,
  DEAL_EARLY_CLEAR_CHANCE,
  DEAL_EARLY_CLEAR_FILL_MAX,
  DEAL_EARLY_FORCE_FULL_CLEAR,
  DEAL_FINISHER_CHANCE,
  DEAL_LATE_CLEAR_CHANCE,
  DEAL_MID_CLEAR_CHANCE,
  DEAL_ORDER_GUARANTEE,
  DEAL_PAYOFF_CHANCE,
  DEAL_PAYOFF_CHANCE_EARLY,
  DEAL_PAYOFF_CHANCE_LATE,
  DEAL_PAYOFF_CHANCE_MID,
  DEAL_PAYOFF_MIN_LINES,
  DEAL_PAYOFF_NEAR_D1_FORCE,
  DEAL_PAYOFF_NEAR_FORCE_CHANCE,
  DEAL_PRESSURE_ASSIST_CHANCE_CHOKE,
  DEAL_PRESSURE_ASSIST_CHANCE_FRAG,
} from '../defaults.js';
import { getTune } from '../tune.js';
import {
  allowsFullClearSearch,
  allowsPayoffIntent,
  prefersCavity,
} from './board-state.js';

function num(v, fb) {
  return Number.isFinite(v) ? Number(v) : fb;
}

function flag(v, fb) {
  if (typeof v === 'number') return v >= 0.5;
  if (typeof v === 'boolean') return v;
  return !!fb;
}

/**
 * 局面 → 概率乘子 / 开关
 * @param {import('./board-state.js').BoardClass | string} [cls]
 */
function stateMul(cls) {
  switch (cls) {
    case 'empty':
      // 空盘：全清彩蛋略抬，payoff 几乎不需要
      return { clear: 1.2, payoff: 0.12, cavity: 0.05, allowFull: true };
    case 'healthy':
      return { clear: 0.85, payoff: 0.7, cavity: 0.28, allowFull: true };
    case 'setup':
      // 铺局中：钥匙块优先，全清压低（别抢 payoff）
      return { clear: 0.28, payoff: 1.75, cavity: 0.35, allowFull: true };
    case 'fragmented':
      return { clear: 0, payoff: 0.4, cavity: 1.65, allowFull: false };
    case 'choke':
      return { clear: 0, payoff: 0.22, cavity: 1.3, allowFull: false };
    default:
      return { clear: 1, payoff: 1, cavity: 1, allowFull: true };
  }
}

/**
 * @param {import('./phase.js').DealPhase} [phase]
 * @param {ReturnType<import('./board-state.js').classifyBoardState> | null} [boardState]
 */
export function getDealPolicy(phase = 'mid', boardState = null, t = getTune()) {
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

  const everyGlobal = num(t.DEAL_CLEAR_ASSIST_EVERY, DEAL_CLEAR_ASSIST_EVERY);
  const usePhaseEvery = everyGlobal === DEAL_CLEAR_ASSIST_EVERY;

  const payoffGlobal = num(t.DEAL_PAYOFF_CHANCE, DEAL_PAYOFF_CHANCE);
  const usePhasePayoff = payoffGlobal === DEAL_PAYOFF_CHANCE;

  const cavityGlobal = num(t.DEAL_CAVITY_GUIDE_CHANCE, DEAL_CAVITY_GUIDE_CHANCE);
  const usePhaseCavity = cavityGlobal === DEAL_CAVITY_GUIDE_CHANCE;

  const gateOn = flag(t.DEAL_BOARD_STATE_GATE, DEAL_BOARD_STATE_GATE);
  const useInterval = flag(t.DEAL_ASSIST_USE_INTERVAL, DEAL_ASSIST_USE_INTERVAL);
  const cls = boardState?.class || 'healthy';
  const mul = gateOn ? stateMul(cls) : { clear: 1, payoff: 1, cavity: 1, allowFull: true };

  let payoffChance = (usePhasePayoff ? payoffDefault : payoffGlobal) * mul.payoff;
  let cavityChance = (usePhaseCavity ? cavityDefault : cavityGlobal) * mul.cavity;

  // 无 setup/近满时 payoff 直接关（门控开）
  const payoffOk = !gateOn || allowsPayoffIntent(boardState);
  if (gateOn && !payoffOk) payoffChance = 0;

  // healthy 时再压 cavity；frag/choke 抬升已在 mul
  if (gateOn && !prefersCavity(cls) && cls !== 'setup') {
    cavityChance *= 0.85;
  }

  const allowFull =
    !gateOn ||
    (mul.allowFull && allowsFullClearSearch(cls));

  const earlyClearChance =
    num(t.DEAL_EARLY_CLEAR_CHANCE, DEAL_EARLY_CLEAR_CHANCE) * mul.clear;
  const midClearChance =
    num(t.DEAL_MID_CLEAR_CHANCE, DEAL_MID_CLEAR_CHANCE) * mul.clear;
  const lateClearChance =
    num(t.DEAL_LATE_CLEAR_CHANCE, DEAL_LATE_CLEAR_CHANCE) * mul.clear;

  const pressureAssistChance =
    cls === 'choke'
      ? num(t.DEAL_PRESSURE_ASSIST_CHANCE_CHOKE, DEAL_PRESSURE_ASSIST_CHANCE_CHOKE)
      : cls === 'fragmented'
        ? num(t.DEAL_PRESSURE_ASSIST_CHANCE_FRAG, DEAL_PRESSURE_ASSIST_CHANCE_FRAG)
        : 0;

  return {
    /** @deprecated 仅 useInterval 时使用 */
    every: Math.max(
      1,
      Math.round(usePhaseEvery ? everyDefault : everyGlobal),
    ),
    useInterval,
    assistMinGap: Math.max(
      0,
      Math.round(num(t.DEAL_ASSIST_MIN_GAP, DEAL_ASSIST_MIN_GAP)),
    ),
    pressureAssistChance: Math.min(1, Math.max(0, pressureAssistChance)),
    finisherChance: Math.min(
      1,
      Math.max(0, num(t.DEAL_FINISHER_CHANCE, DEAL_FINISHER_CHANCE) * mul.clear),
    ),
    payoffNearD1Force: Math.max(
      1,
      Math.round(num(t.DEAL_PAYOFF_NEAR_D1_FORCE, DEAL_PAYOFF_NEAR_D1_FORCE)),
    ),
    payoffNearForceChance: Math.min(
      1,
      Math.max(0, num(t.DEAL_PAYOFF_NEAR_FORCE_CHANCE, DEAL_PAYOFF_NEAR_FORCE_CHANCE)),
    ),
    streakMax: Math.max(
      0,
      Math.round(num(t.DEAL_CLEAR_ASSIST_STREAK, DEAL_CLEAR_ASSIST_STREAK)),
    ),
    finisherFillMax: num(t.DEAL_CLEAR_FINISHER_FILL_MAX, DEAL_CLEAR_FINISHER_FILL_MAX),
    earlyClearFillMax: num(t.DEAL_EARLY_CLEAR_FILL_MAX, DEAL_EARLY_CLEAR_FILL_MAX),
    earlyForceFull: flag(t.DEAL_EARLY_FORCE_FULL_CLEAR, DEAL_EARLY_FORCE_FULL_CLEAR),
    cavityChance: Math.min(1, Math.max(0, cavityChance)),
    payoffChance: Math.min(1, Math.max(0, payoffChance)),
    payoffMinLines: Math.max(
      2,
      Math.round(num(t.DEAL_PAYOFF_MIN_LINES, DEAL_PAYOFF_MIN_LINES)),
    ),
    clearRetryMax: Math.max(
      1,
      Math.round(num(t.DEAL_CLEAR_OFFER_RETRY_MAX, DEAL_CLEAR_OFFER_RETRY_MAX)),
    ),
    earlyClearChance: Math.min(1, Math.max(0, earlyClearChance)),
    midClearChance: Math.min(1, Math.max(0, midClearChance)),
    lateClearChance: Math.min(1, Math.max(0, lateClearChance)),
    allowFullClearSearch: allowFull,
    boardGateOn: gateOn,
    cancelClearOnHealthy: flag(
      t.DEAL_CLEAR_CANCEL_ON_HEALTHY,
      DEAL_CLEAR_CANCEL_ON_HEALTHY,
    ),
    orderGuarantee: flag(t.DEAL_ORDER_GUARANTEE, DEAL_ORDER_GUARANTEE),
    boardClass: cls,
    intentLabel: useInterval
      ? 'legacy-interval-assist'
      : 'state-assist-payoff-first',
  };
}
