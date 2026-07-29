/**
 * 发块总控：只根据当前盘面生成一轮 tray。
 *
 * 流程：
 *   snapshot → fill → phase → 策略采样 → 约束校验 → 随机选取
 * 禁止跨 tray 预定序列。
 */
import {
  DEAL_EARLY_MIN_AVG_CELLS,
  DEAL_MAX_ATTEMPTS,
  DEAL_PHASE_ENABLED,
  FIT_GUARANTEE,
  TRAY_SIZE,
} from '../defaults.js';
import { countCells } from '../forms.js';
import { getTune } from '../tune.js';
import {
  countInstantFits,
  existsPlacementOrder,
  fillRatio,
} from './board-ops.js';
import { tryClearTrayForBoard } from './clear-tray.js';
import {
  basePhaseFromFill,
  familyMulForPhase,
  instantRangeForPhase,
  rollDealPhase,
} from './phase.js';
import {
  collectAndPickTray,
  fallbackGuaranteedTray,
  sampleWeightedTray,
  trayStats,
} from './sample.js';
import { acceptShapeDiversity } from './shape-class.js';
import { acceptSizeMix } from './size-rhythm.js';

/** @typedef {import('./phase.js').DealPhase} DealPhase */

/** @type {{
 *   fill: number,
 *   basePhase: DealPhase,
 *   phase: DealPhase,
 *   instant: number,
 *   attempts: number,
 *   mode: string,
 *   clearPlanLen: number | null,
 * }} */
export let lastDealMeta = {
  fill: 0,
  basePhase: 'early',
  phase: 'early',
  instant: 0,
  attempts: 0,
  mode: 'init',
  clearPlanLen: null,
};

let lastTraySig = '';

export function resetDealState() {
  lastTraySig = '';
}

/** @deprecated 兼容旧名 */
export function clearPendingDealPlan() {
  resetDealState();
}

/**
 * @param {import('../forms.js').PieceDef[]} pieces
 */
function signature(pieces) {
  return pieces
    .map((p) =>
      p.matrix.map((row) => row.join('')).join('/'),
    )
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
 * @param {import('../forms.js').PieceDef[]} pieces
 * @param {DealPhase} phase
 */
/**
 * @param {(number|null)[][]} board
 * @param {import('../forms.js').PieceDef[]} pieces
 * @param {DealPhase} phase
 * @param {number} fill
 */
function acceptTray(board, pieces, phase, fill = 0) {
  const t = getTune();
  const { min, max } = instantRangeForPhase(phase, t);
  const instant = countInstantFits(board, pieces);
  if (instant < min || instant > max) return false;
  if (!existsPlacementOrder(board, pieces)) return false;
  if (!acceptSizeMix(pieces, fill, phase)) return false;
  if (!acceptShapeDiversity(pieces)) return false;

  if (phase === 'early') {
    const minAvg = Number.isFinite(t.DEAL_EARLY_MIN_AVG_CELLS)
      ? t.DEAL_EARLY_MIN_AVG_CELLS
      : DEAL_EARLY_MIN_AVG_CELLS;
    if (avgCells(pieces) + 1e-6 < minAvg) return false;
    if (pieces.some((p) => countCells(p.matrix) < 4)) return false;
  }
  return true;
}

/**
 * @param {(number|null)[][]} board
 * @param {DealPhase} phase
 * @param {number} fill
 * @param {number} maxAttempts
 */
function generateForPhase(board, phase, fill, maxAttempts) {
  const mul = familyMulForPhase(phase);

  // 通用：按尺寸节奏 + 空位采样（传入 fill，开阔盘强制大/小混）
  const sizedPick = (label, extra = {}) =>
    collectAndPickTray(board, phase, {
      attempts: Math.min(maxAttempts, extra.attempts ?? 56),
      avoidSig: lastTraySig,
      signatureOf: signature,
      preferExactSize: true,
      fill,
      simulate: extra.simulate !== false,
      requireScrap: !!extra.requireScrap,
      accept: (p) =>
        extra.accept
          ? extra.accept(p) && acceptSizeMix(p, fill, phase)
          : acceptTray(board, p, phase, fill),
    });

  // —— early：大块节奏为主 + 可选本 tray 清屏 ——
  if (phase === 'early') {
    const clear = tryClearTrayForBoard(board, phase, fill);
    if (
      clear &&
      acceptTray(board, clear, phase, fill) &&
      signature(clear) !== lastTraySig
    ) {
      return finish(board, clear, 'early-clear', null);
    }

    let picked = sizedPick('early-size', { attempts: 60, simulate: true });
    if (picked) return finish(board, picked, 'early-size', null);

    picked = sizedPick('early-instant', {
      attempts: 40,
      simulate: false,
      accept: (p) => {
        const inst = countInstantFits(board, p);
        return (
          inst >= 2 &&
          existsPlacementOrder(board, p) &&
          avgCells(p) >= 4 &&
          acceptSizeMix(p, fill, phase)
        );
      },
    });
    if (picked) return finish(board, picked, 'early-loose', null);
  }

  // —— mid：尺寸混搭 + 碎块 ——
  if (phase === 'mid') {
    const clear = tryClearTrayForBoard(board, phase, fill);
    if (
      clear &&
      acceptTray(board, clear, 'mid', fill) &&
      signature(clear) !== lastTraySig
    ) {
      return finish(board, clear, 'mid-clear', null);
    }

    // 开阔盘优先「有大有小」，不强制碎块盖过大块
    let picked = sizedPick('mid-size', {
      attempts: 55,
      requireScrap: fill >= 0.48,
      simulate: false,
    });
    if (picked) return finish(board, picked, 'mid-size-mix', null);

    picked = sizedPick('mid-size-sim', { attempts: 45, simulate: true });
    if (picked) return finish(board, picked, 'mid-size', null);

    picked = sizedPick('mid-any', {
      attempts: 35,
      simulate: true,
      accept: (p) =>
        existsPlacementOrder(board, p) &&
        countInstantFits(board, p) >= 1 &&
        acceptSizeMix(p, fill, phase),
    });
    if (picked) return finish(board, picked, 'mid-loose', null);
  }

  // —— late：小/中为主、偶大，instant≈1 ——
  if (phase === 'late') {
    const picked = sizedPick('late-size', { attempts: 60, simulate: true });
    if (picked) return finish(board, picked, 'late-size', null);
  }

  const fb = fallbackGuaranteedTray(board, 40, mul);
  return finish(board, fb, 'fallback', null);
}

/**
 * @param {(number|null)[][]} board
 * @param {import('../forms.js').PieceDef[]} pieces
 * @param {string} mode
 * @param {number | null} clearLen
 */
function finish(board, pieces, mode, clearLen) {
  const tray = pieces.slice(0, TRAY_SIZE);
  lastTraySig = signature(tray);
  const stats = trayStats(board, tray);
  lastDealMeta.instant = stats.instant;
  lastDealMeta.mode = mode;
  lastDealMeta.clearPlanLen = clearLen;
  lastDealMeta.attempts = (lastDealMeta.attempts || 0) + 1;
  return tray;
}

/**
 * @param {{ snapshot: () => (number|null)[][] }} grid
 * @param {{ maxAttempts?: number, rng?: () => number }} [opts]
 */
export function generateTray(grid, opts = {}) {
  const t = getTune();
  const maxAttempts = opts.maxAttempts ?? t.DEAL_MAX_ATTEMPTS ?? DEAL_MAX_ATTEMPTS;
  const board = grid.snapshot();
  const fill = fillRatio(board);
  const basePhase = basePhaseFromFill(fill, t);
  const phaseFlag = t.DEAL_PHASE_ENABLED ?? DEAL_PHASE_ENABLED;
  const phaseOn = typeof phaseFlag === 'number' ? phaseFlag >= 0.5 : !!phaseFlag;

  lastDealMeta = {
    fill,
    basePhase,
    phase: basePhase,
    instant: 0,
    attempts: 0,
    mode: 'init',
    clearPlanLen: null,
  };

  if (!FIT_GUARANTEE) {
    const tray = sampleWeightedTray(opts.rng);
    return finish(board, tray, 'simple', null);
  }

  if (!phaseOn) {
    const tray = fallbackGuaranteedTray(board, maxAttempts);
    lastDealMeta.phase = basePhase;
    return finish(board, tray, 'legacy', null);
  }

  const phase = rollDealPhase(basePhase, opts.rng || Math.random, t);
  lastDealMeta.phase = phase;
  return generateForPhase(board, phase, fill, maxAttempts);
}

export { existsPlacementOrder, countInstantFits } from './board-ops.js';
export { basePhaseFromFill, rollDealPhase, familyMulForPhase } from './phase.js';

/**
 * tray 是否还有任意剩余块可放
 * @param {{ canPlaceAnywhere: (m: number[][]) => boolean }} grid
 * @param {(import('../forms.js').PieceDef|null)[]} tray
 */
export function anyTrayPieceFits(grid, tray) {
  for (const p of tray) {
    if (p && grid.canPlaceAnywhere(p.matrix)) return true;
  }
  if (tray.every((p) => p == null)) return true;
  return false;
}
