/**
 * 发块验收档案（AcceptProfile）
 * 主路径 / 全清 / 助清 / payoff / fallback 分档，互不误套。
 */
import {
  DEAL_CLEAR_FINISHER_FILL_MAX,
  DEAL_EARLY_MIN_AVG_CELLS,
  DEAL_ORDER_GUARANTEE,
  TRAY_SIZE,
} from '../defaults.js';
import { countCells } from '../forms.js';
import { getTune } from '../tune.js';
import {
  countInstantFits,
  existsPlacementOrder,
} from './board-ops.js';
import { instantRangeForPhase } from './phase.js';
import { acceptShapeDiversity, shapeClassOf } from './shape-class.js';
import { acceptSizeMix } from './size-rhythm.js';

function num(v, fb) {
  return Number.isFinite(v) ? Number(v) : fb;
}

function flag(v, fb) {
  if (typeof v === 'number') return v >= 0.5;
  if (typeof v === 'boolean') return v;
  return !!fb;
}

/** 是否强制 G3 全序可解 */
export function orderGuaranteeOn(t = getTune()) {
  return flag(t.DEAL_ORDER_GUARANTEE, DEAL_ORDER_GUARANTEE);
}

/** 主路径：G3 仅开关开启时要求；特殊 tray 仍可要求有序解 */
export function requireOrderIfNeeded(board, pieces, force = false) {
  if (force || orderGuaranteeOn()) {
    return existsPlacementOrder(board, pieces);
  }
  return true;
}

function avgCells(pieces) {
  if (!pieces?.length) return 0;
  let s = 0;
  for (const p of pieces) s += countCells(p.matrix);
  return s / pieces.length;
}

/**
 * 主路径验收
 * @param {(number|null)[][]} board
 * @param {import('../forms.js').PieceDef[]} pieces
 * @param {import('./phase.js').DealPhase} phase
 * @param {number} fill
 * @param {boolean} [allowMicro]
 */
export function acceptMainTray(board, pieces, phase, fill = 0, allowMicro = false) {
  const t = getTune();
  const { min, max } = instantRangeForPhase(phase, t);
  const instant = countInstantFits(board, pieces);
  if (instant < min || instant > max) return false;
  // 默认 G2：instant 窗已约束「各自可放」数量；G3 仅 DEAL_ORDER_GUARANTEE
  if (!requireOrderIfNeeded(board, pieces, false)) return false;
  if (!acceptSizeMix(pieces, fill, phase, { allowMicro })) return false;
  if (!acceptShapeDiversity(pieces)) return false;

  if (phase === 'early') {
    const minAvg = num(t.DEAL_EARLY_MIN_AVG_CELLS, DEAL_EARLY_MIN_AVG_CELLS);
    if (avgCells(pieces) + 1e-6 < minAvg) return false;
    if (pieces.some((p) => countCells(p.matrix) < 3)) return false;
  }
  if (!allowMicro && pieces.some((p) => countCells(p.matrix) <= 2)) return false;
  return true;
}

/**
 * 全清 / 助清独立验收
 * @param {'full'|'assist'} kind
 */
export function acceptSpecialTray(board, pieces, fill = 0, kind = 'assist') {
  if (!pieces?.length || pieces.length < TRAY_SIZE) return false;
  // 全清/助清必须有序可解，否则「有解」承诺不成立
  if (!existsPlacementOrder(board, pieces)) return false;

  const cells = pieces.map((p) => countCells(p.matrix));
  const micro = cells.filter((c) => c <= 2).length;
  const small = cells.filter((c) => c <= 3).length;
  const finisher =
    fill <= num(getTune().DEAL_CLEAR_FINISHER_FILL_MAX, DEAL_CLEAR_FINISHER_FILL_MAX);

  if (kind === 'full' && finisher) {
    if (micro > 1) return false;
  } else if (micro > 0) {
    return false;
  }
  if (small >= 3 && !(kind === 'full' && finisher)) return false;

  const avg = cells.reduce((a, b) => a + b, 0) / cells.length;
  if (kind === 'full' && !finisher && avg < 3.0) return false;
  if (kind === 'full' && finisher && avg < 2.2) return false;
  if (kind === 'assist' && avg < 2.8) return false;

  if (countInstantFits(board, pieces) < 1) return false;

  if (!acceptShapeDiversity(pieces)) {
    const classSet = new Set(pieces.map((p) => shapeClassOf(p)));
    if (classSet.size < 2) return false;
  }

  if (fill < 0.48 && kind === 'assist' && Math.max(...cells) < 4) return false;
  return true;
}

/**
 * Setup 大消 payoff tray：至少 1 可放 + G3；允许含角块
 */
export function acceptPayoffTray(board, pieces) {
  if (!pieces?.length || pieces.length < TRAY_SIZE) return false;
  // 钥匙块至少各自可放够用；有序解在开关开时强制
  if (countInstantFits(board, pieces) < 2) return false;
  if (!requireOrderIfNeeded(board, pieces, false)) return false;
  if (pieces.some((p) => countCells(p.matrix) <= 2)) return false;
  return true;
}
