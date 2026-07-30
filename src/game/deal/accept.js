/**
 * 发块验收档案（AcceptProfile）
 * 主路径 / 全清 / 助清 / payoff / fallback 分档，互不误套。
 */
import {
  DEAL_CLEAR_FINISHER_FILL_MAX,
  DEAL_EARLY_MIN_AVG_CELLS,
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
  if (!existsPlacementOrder(board, pieces)) return false;
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
  if (!existsPlacementOrder(board, pieces)) return false;
  if (countInstantFits(board, pieces) < 1) return false;
  if (pieces.some((p) => countCells(p.matrix) <= 2)) return false;
  return true;
}
