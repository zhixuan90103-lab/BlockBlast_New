/**
 * 发块管线：Intent 有序尝试（重构入口）
 *
 * 顺序：
 *  1) 续推清屏 keepClearPush
 *  2) beat：真全清（局面允许）→ 助清减盘
 *  3) 偶发 payoff 大消（T6，需 setup）
 *  4) 偶发空腔补缺（碎片优先）
 *  5) 阶段概率全清 × 局面系数
 *  6) 主采样 main（默认 G2）
 *  7) fallback
 */
import {
  DEAL_MAX_ATTEMPTS,
  DEAL_PHASE_ENABLED,
  FIT_GUARANTEE,
  TRAY_SIZE,
} from '../defaults.js';
import { getActiveTraySize, isDealTrueRandom } from '../debug-exp.js';
import { countCells, makePiece, pickWeightedForm } from '../forms.js';
import { getTune } from '../tune.js';
import {
  acceptMainTray,
  acceptPayoffTray,
  acceptSpecialTray,
  requireOrderIfNeeded,
} from './accept.js';
import {
  canPlaceOnCells,
  countInstantFits,
  existsPlacementOrder,
  fillRatio,
} from './board-ops.js';
import { classifyBoardState } from './board-state.js';
import { tryCavityGuideTray } from './cavity-match.js';
import { tryAssistClearTray, tryClearTrayForBoard } from './clear-tray.js';
import {

  basePhaseFromScore,
  familyMulForPhase,
  rollDealPhase,
} from './phase.js';
import { getDealPolicy } from './policy.js';
import {
  boardHasPayoffSetup,
  tryPayoffTray,
} from './payoff-match.js';
import {
  collectAndPickTray,
  fallbackGuaranteedTray,
  sampleWeightedTray,
  trayStats,
} from './sample.js';
import { allowMicroClutch } from './size-rhythm.js';
import {
  dealSession,
  resetDealSession,
  sessionBeforeDeal,
  sessionOnEmit,
} from './session.js';

/** @typedef {import('./phase.js').DealPhase} DealPhase */

export let lastDealMeta = {
  fill: 0,
  score: 0,
  basePhase: /** @type {DealPhase} */ ('early'),
  phase: /** @type {DealPhase} */ ('early'),
  instant: 0,
  attempts: 0,
  mode: 'init',
  clearPlanLen: /** @type {number|null} */ (null),
  traysSinceAssist: 0,
  assistStreakLeft: 0,
  clearOfferPending: false,
  clearOfferRounds: 0,
  boardClass: /** @type {string} */ ('empty'),
  setupScore: 0,
  fragScore: 0,
  maxEmpty: 0,
  orderGuarantee: false,
};

export function resetDealState() {
  resetDealSession();
}

/** @deprecated */
export function clearPendingDealPlan() {
  resetDealState();
}

function signature(pieces) {
  return pieces
    .map((p) => p.matrix.map((row) => row.join('')).join('/'))
    .sort()
    .join('|');
}

function avgCells(pieces) {
  if (!pieces.length) return 0;
  let s = 0;
  for (const p of pieces) s += countCells(p.matrix);
  return s / pieces.length;
}

/**
 * @param {(number|null)[][]} board
 * @param {import('../forms.js').PieceDef[]} pieces
 * @param {string} mode
 * @param {number | null} clearLen
 * @param {boolean} [wasAssistBeat]
 * @param {ReturnType<typeof getDealPolicy>} [policy]
 */
function emit(board, pieces, mode, clearLen, wasAssistBeat = false, policy) {
  const n = getActiveTraySize();
  const tray = pieces.slice(0, n);
  dealSession.lastTraySig = signature(tray);
  const stats = trayStats(board, tray);
  const pol =
    policy ||
    getDealPolicy(lastDealMeta.phase || 'mid', {
      class: lastDealMeta.boardClass,
      fill: lastDealMeta.fill,
      setupScore: lastDealMeta.setupScore,
      fragScore: lastDealMeta.fragScore,
    });

  sessionOnEmit(mode, wasAssistBeat, pol.streakMax);

  lastDealMeta.instant = stats.instant;
  lastDealMeta.mode = mode;
  lastDealMeta.clearPlanLen = clearLen;
  lastDealMeta.attempts = (lastDealMeta.attempts || 0) + 1;
  lastDealMeta.traysSinceAssist = dealSession.traysSinceAssist;
  lastDealMeta.assistStreakLeft = dealSession.assistStreakLeft;
  lastDealMeta.clearOfferPending = dealSession.clearOfferPending;
  lastDealMeta.clearOfferRounds = dealSession.clearOfferRounds;
  lastDealMeta.orderGuarantee = !!pol.orderGuarantee;

  return tray;
}

/**
 * @param {(number|null)[][]} board
 * @param {DealPhase} phase
 * @param {number} fill
 * @param {number} maxAttempts
 * @param {() => number} rng
 * @param {ReturnType<typeof classifyBoardState>} boardState
 */
/**
 * T6 尝试概率：近满线多时抬高，成全「就差那一块」
 * @param {ReturnType<typeof getDealPolicy>} policy
 * @param {ReturnType<typeof classifyBoardState>} boardState
 */
function payoffRollChance(policy, boardState) {
  let p = policy.payoffChance || 0;
  if (p <= 0) return 0;
  const nf = boardState.nearFull || { d1: 0, d2: 0, score: 0 };
  const d1Need = policy.payoffNearD1Force ?? 2;
  if (nf.d1 >= d1Need) {
    p = Math.max(p, policy.payoffNearForceChance ?? 0.88);
  } else if (nf.d1 >= 1 && nf.d2 >= 1) {
    p = Math.max(p, 0.62);
  } else if (boardState.class === 'setup') {
    p = Math.min(1, p * 1.15);
  }
  return Math.min(1, Math.max(0, p));
}

/**
 * 是否应尝试压力助清（局面触发，非每 N 轮打卡）
 * @param {ReturnType<typeof getDealPolicy>} policy
 * @param {ReturnType<typeof classifyBoardState>} boardState
 * @param {() => number} rng
 */
function shouldPressureAssist(policy, boardState, rng) {
  if (dealSession.assistStreakLeft > 0) return true;

  const cls = boardState.class;
  if (cls !== 'choke' && cls !== 'fragmented') return false;

  const gap = policy.assistMinGap ?? 2;
  if (dealSession.traysSinceAssist < gap) return false;

  // 旧日历模式：仍支持 every
  if (policy.useInterval) {
    return dealSession.traysSinceAssist + 1 >= (policy.every || 99);
  }

  const chance = policy.pressureAssistChance || 0;
  return chance > 0 && rng() < chance;
}

/**
 * 收官全清彩蛋：盘较空、非铺局高压
 * @param {ReturnType<typeof getDealPolicy>} policy
 * @param {number} fill
 * @param {ReturnType<typeof classifyBoardState>} boardState
 * @param {() => number} rng
 */
function shouldFinisherClear(policy, fill, boardState, rng) {
  if (!policy.allowFullClearSearch) return false;
  if (fill <= 0.02 || fill > (policy.finisherFillMax ?? 0.22)) return false;
  if (boardState.class === 'choke' || boardState.class === 'fragmented') return false;
  // 强 setup 时不要用全清抢钥匙块体验
  if (boardState.class === 'setup' && (boardState.nearFull?.d1 || 0) >= 1) return false;
  const chance = policy.finisherChance ?? 0.26;
  return chance > 0 && rng() < chance;
}

function runPipeline(board, phase, fill, maxAttempts, rng, boardState) {
  const policy = getDealPolicy(phase, boardState);
  const allowMicro = allowMicroClutch(fill, phase, rng);
  const mul = familyMulForPhase(phase);

  sessionBeforeDeal(fill, policy.clearRetryMax, {
    cancelOnHealthy: policy.cancelClearOnHealthy,
    boardClass: boardState.class,
  });

  const forceEarlyFullClear =
    policy.earlyForceFull &&
    policy.allowFullClearSearch &&
    phase === 'early' &&
    fill > 0.02 &&
    fill <= policy.earlyClearFillMax;

  const keepClearPush =
    dealSession.clearOfferPending &&
    fill >= 0.005 &&
    dealSession.clearOfferRounds < policy.clearRetryMax;

  const pressureAssist = shouldPressureAssist(policy, boardState, rng);
  const finisherBeat = shouldFinisherClear(policy, fill, boardState, rng);

  // 碎片/窒息：只助清减占，不硬搜全清（除非续推）
  const preferAssistOnly =
    policy.boardGateOn &&
    !policy.allowFullClearSearch &&
    !keepClearPush;

  // —— 1) Setup 大消 payoff（优先于打卡式救济；续推清屏时让路）——
  if (
    !keepClearPush &&
    fill > 0.1 &&
    fill < 0.88 &&
    boardHasPayoffSetup(board)
  ) {
    const roll = payoffRollChance(policy, boardState);
    if (roll > 0 && rng() < roll) {
      const payoff = tryPayoffTray(board, rng);
      if (
        payoff &&
        signature(payoff) !== dealSession.lastTraySig &&
        acceptPayoffTray(board, payoff)
      ) {
        return emit(board, payoff, 'payoff-multi', null, false, policy);
      }
    }
  }

  // —— 2) 续推清屏 / 压力助清 / 收官全清 / early 强制（均非「每 4 轮必发」）——
  const forceSpecial =
    forceEarlyFullClear || pressureAssist || finisherBeat || keepClearPush;

  if (forceSpecial) {
    const offer = tryAssistClearTray(board, phase, fill, rng);
    if (offer?.pieces && signature(offer.pieces) !== dealSession.lastTraySig) {
      const canFull =
        offer.kind === 'full' &&
        !preferAssistOnly &&
        (policy.allowFullClearSearch || keepClearPush) &&
        acceptSpecialTray(board, offer.pieces, fill, 'full');

      if (canFull) {
        const mode = keepClearPush
          ? 'clear-retry'
          : forceEarlyFullClear
            ? 'early-full-clear'
            : finisherBeat
              ? 'finisher-clear'
              : 'assist-full-clear';
        return emit(board, offer.pieces, mode, TRAY_SIZE, true, policy);
      }
      if (keepClearPush) {
        const guided = tryCavityGuideTray(board, rng);
        if (
          guided &&
          signature(guided) !== dealSession.lastTraySig &&
          countInstantFits(board, guided) >= 1 &&
          requireOrderIfNeeded(board, guided, true)
        ) {
          return emit(
            board,
            guided,
            'clear-retry-cavity',
            TRAY_SIZE,
            false,
            policy,
          );
        }
      }
      if (
        offer.kind === 'assist' &&
        acceptSpecialTray(board, offer.pieces, fill, 'assist')
      ) {
        if (!keepClearPush || preferAssistOnly || !canFull) {
          return emit(board, offer.pieces, 'assist-clear', TRAY_SIZE, true, policy);
        }
      }
      if (
        keepClearPush &&
        offer.kind === 'assist' &&
        acceptSpecialTray(board, offer.pieces, fill, 'assist')
      ) {
        return emit(board, offer.pieces, 'assist-clear', TRAY_SIZE, true, policy);
      }
    }
  }

  // —— 3) 空腔补缺（盘碎时）——
  const cavityPhaseOk =
    phase === 'early' ||
    phase === 'mid' ||
    boardState.class === 'fragmented' ||
    boardState.class === 'choke';
  if (
    !keepClearPush &&
    cavityPhaseOk &&
    fill > 0.06 &&
    policy.cavityChance > 0 &&
    rng() < policy.cavityChance
  ) {
    const guided = tryCavityGuideTray(board, rng);
    if (
      guided &&
      signature(guided) !== dealSession.lastTraySig &&
      countInstantFits(board, guided) >= 1 &&
      requireOrderIfNeeded(board, guided, false) &&
      !guided.some((p) => countCells(p.matrix) <= 2)
    ) {
      return emit(board, guided, 'cavity-guide', TRAY_SIZE, false, policy);
    }
  }

  const sizedPick = (extra = {}) =>
    collectAndPickTray(board, phase, {
      attempts: Math.min(maxAttempts, extra.attempts ?? 32),
      avoidSig: dealSession.lastTraySig,
      signatureOf: signature,
      preferExactSize: true,
      fill,
      simulate: extra.simulate !== false,
      requireScrap: !!extra.requireScrap,
      allowMicro: extra.allowMicro ?? allowMicro,
      accept: (p) =>
        extra.accept
          ? extra.accept(p)
          : acceptMainTray(
              board,
              p,
              phase,
              fill,
              extra.allowMicro ?? allowMicro,
            ),
    });

  // 4) 阶段稀有全清（局面允许；chance 由 policy 乘局面系数后传入）
  if (!keepClearPush && policy.allowFullClearSearch && phase === 'early') {
    const clear = tryClearTrayForBoard(board, phase, fill, rng, {
      chance: policy.earlyClearChance,
    });
    if (
      clear &&
      signature(clear) !== dealSession.lastTraySig &&
      acceptSpecialTray(board, clear, fill, 'full')
    ) {
      return emit(board, clear, 'early-clear', TRAY_SIZE, true, policy);
    }
  }

  // 5) 主采样
  if (phase === 'early') {
    let picked = sizedPick({ attempts: 36, simulate: true });
    if (picked) return emit(board, picked, 'early-size', null, false, policy);

    picked = sizedPick({
      attempts: 28,
      simulate: false,
      accept: (p) => {
        const inst = countInstantFits(board, p);
        return (
          inst >= 2 &&
          requireOrderIfNeeded(board, p, false) &&
          avgCells(p) >= 3.5 &&
          acceptMainTray(board, p, phase, fill, false)
        );
      },
    });
    if (picked) return emit(board, picked, 'early-loose', null, false, policy);
  }

  if (phase === 'mid') {
    if (policy.allowFullClearSearch && policy.midClearChance > 0) {
      const clear = tryClearTrayForBoard(board, phase, fill, rng, {
        chance: policy.midClearChance,
      });
      if (
        clear &&
        signature(clear) !== dealSession.lastTraySig &&
        acceptSpecialTray(board, clear, fill, 'full')
      ) {
        return emit(board, clear, 'mid-clear', TRAY_SIZE, true, policy);
      }
    }

    let picked = sizedPick({
      attempts: 36,
      requireScrap: fill >= 0.65 && rng() < 0.15,
      simulate: true,
    });
    if (picked) return emit(board, picked, 'mid-size-mix', null, false, policy);

    picked = sizedPick({ attempts: 28, simulate: true });
    if (picked) return emit(board, picked, 'mid-size', null, false, policy);

    picked = sizedPick({
      attempts: 24,
      simulate: true,
      accept: (p) =>
        requireOrderIfNeeded(board, p, false) &&
        countInstantFits(board, p) >= 1 &&
        acceptMainTray(board, p, phase, fill, allowMicro),
    });
    if (picked) return emit(board, picked, 'mid-loose', null, false, policy);
  }

  if (phase === 'late') {
    if (policy.allowFullClearSearch && policy.lateClearChance > 0) {
      const clear = tryClearTrayForBoard(board, phase, fill, rng, {
        chance: policy.lateClearChance,
      });
      if (
        clear &&
        signature(clear) !== dealSession.lastTraySig &&
        acceptSpecialTray(board, clear, fill, 'full')
      ) {
        return emit(board, clear, 'late-clear', TRAY_SIZE, true, policy);
      }
    }

    const picked = sizedPick({
      attempts: 40,
      simulate: true,
      allowMicro,
    });
    if (picked) return emit(board, picked, 'late-size', null, false, policy);
  }

  // 6) 兜底
  const fb = fallbackGuaranteedTray(board, 40, mul);
  const hasMicro = fb.some((p) => countCells(p.matrix) <= 2);
  return emit(
    board,
    fb,
    hasMicro ? 'fallback-dot' : 'fallback',
    null,
    false,
    policy,
  );
}

/**
 * @param {{ snapshot: () => (number|null)[][] }} grid
 * @param {{ maxAttempts?: number, rng?: () => number, score?: number }} [opts]
 */
export function generateTray(grid, opts = {}) {
  const t = getTune();
  const maxAttempts = opts.maxAttempts ?? t.DEAL_MAX_ATTEMPTS ?? DEAL_MAX_ATTEMPTS;
  const board = grid.snapshot();
  const fill = fillRatio(board);
  const score = Number.isFinite(opts.score) ? Math.max(0, Number(opts.score)) : 0;
  const basePhase = basePhaseFromScore(score, t);
  const boardState = classifyBoardState(board);
  const trayN = getActiveTraySize();
  const trueRandom = isDealTrueRandom();

  const phaseFlag = t.DEAL_PHASE_ENABLED ?? DEAL_PHASE_ENABLED;
  const phaseOn =
    typeof phaseFlag === 'number' ? phaseFlag >= 0.5 : !!phaseFlag;

  lastDealMeta = {
    fill,
    score,
    basePhase,
    phase: basePhase,
    instant: 0,
    attempts: 0,
    mode: 'init',
    clearPlanLen: null,
    traysSinceAssist: dealSession.traysSinceAssist,
    assistStreakLeft: dealSession.assistStreakLeft,
    clearOfferPending: dealSession.clearOfferPending,
    clearOfferRounds: dealSession.clearOfferRounds,
    boardClass: boardState.class,
    setupScore: boardState.setupScore,
    fragScore: boardState.fragScore,
    maxEmpty: boardState.maxEmpty,
    orderGuarantee: false,
  };

  const rng = opts.rng || Math.random;

  // —— E3 真随机 / E2 tray1 短路径（乐趣核实验）——
  if (trueRandom || trayN === 1) {
    const pieces = [];
    for (let i = 0; i < trayN; i++) {
      pieces.push(makePiece(pickWeightedForm(rng)));
    }
    const mode = trueRandom
      ? trayN === 1
        ? 'debug-e2e3-random1'
        : 'debug-e3-random'
      : 'debug-e2-tray1';
    // tray1 非真随机：仍尽量可放（否则实验过虐）
    if (!trueRandom && trayN === 1) {
      let form = null;
      for (let a = 0; a < 80; a++) {
        const f = pickWeightedForm(rng);
        if (canPlaceOnCells(board, f.matrix)) {
          form = f;
          break;
        }
      }
      pieces[0] = makePiece(form || pickWeightedForm(rng));
    }
    lastDealMeta.mode = mode;
    lastDealMeta.orderGuarantee = false;
    return emit(board, pieces, mode, null, false);
  }

  if (!FIT_GUARANTEE) {
    const tray = sampleWeightedTray(rng);
    return emit(board, tray, 'simple', null, false);
  }

  if (!phaseOn) {
    const tray = fallbackGuaranteedTray(board, maxAttempts);
    lastDealMeta.phase = basePhase;
    return emit(board, tray, 'legacy', null, false);
  }

  const phase = rollDealPhase(basePhase, rng, t);
  lastDealMeta.phase = phase;
  return runPipeline(board, phase, fill, maxAttempts, rng, boardState);
}

export function anyTrayPieceFits(grid, tray) {
  for (const p of tray) {
    if (p && grid.canPlaceAnywhere(p.matrix)) return true;
  }
  if (tray.every((p) => p == null)) return true;
  return false;
}

export { existsPlacementOrder, countInstantFits } from './board-ops.js';
export {
  basePhaseFromFill,
  basePhaseFromScore,
  rollDealPhase,
  familyMulForPhase,
} from './phase.js';
export { classifyBoardState } from './board-state.js';
