/**
 * 从当前盘采样 tray：
 * - 能放 = 硬前提
 * - 尺寸节奏 S/M/L
 * - 形状多元 rect / bar_h / bar_v / corner / skew / tee
 */
import { FORM_1X1, countCells, makePiece, matrixKey, pickWeightedForm } from '../forms.js';
import { TRAY_SIZE } from '../defaults.js';
import {
  canPlaceOnCells,
  countInstantFits,
  existsPlacementOrder,
  findAnyPlacement,
  simulatePlace,
} from './board-ops.js';
import { findBestPlacement, traySnugScore } from './fit-score.js';
import {
  trayClearFriendlyScore,
  trayMessDelta,
} from './board-neat.js';
import { rankCavityMatches } from './cavity-match.js';
import {
  DEAL_EARLY_CLEAR_GUIDE_MUL,
  DEAL_EARLY_NEAT_SHAPES,
  DEAL_FIT_TRAY_SCORE_MUL,
  DEAL_NEAT_GUIDE_ALL_PHASES,
  DEAL_NEAT_GUIDE_MUL_LATE,
  DEAL_NEAT_GUIDE_MUL_MID,
  DEAL_NEAT_MAX_MESS_RISE,
  DEAL_NEAT_SIM_BEST_PLACE,
  DEAL_ORDER_GUARANTEE,
} from '../defaults.js';
import { getTune } from '../tune.js';
import {
  isBagEnabled,
  pickFormAnyAllowed,
  pickFormFromRole,
  rollRole,
} from './bag.js';
import { familyMulForPhase, isScrapFamily } from './phase.js';
import {
  acceptShapeDiversity,
  pickFittingForm,
  pickShapePlan,
  shapeClassOf,
  shapePlanScore,
} from './shape-class.js';
import {
  acceptSizeMix,
  isOpenBoard,
  matchesSizePlan,
  pickSizePlan,
  sizePlanScore,
  tierFallbacks,
  tierOfForm,
} from './size-rhythm.js';

/**
 * 按 角色袋 × 尺寸 × 形状 × 当前可放 生成 tray
 * @param {(number|null)[][]} board
 * @param {import('./phase.js').DealPhase} phase
 * @param {{
 *   rng?: () => number,
 *   requireScrap?: boolean,
 *   plan?: import('./size-rhythm.js').SizeTier[],
 *   shapePlan?: import('./shape-class.js').ShapeClass[],
 *   simulate?: boolean,
 *   fill?: number,
 *   allowMicro?: boolean,
 * }} [opts]
 */
export function buildSizedFitTray(board, phase, opts = {}) {
  const rng = opts.rng || Math.random;
  const simulate = opts.simulate !== false;
  const fill = opts.fill ?? 0;
  const allowMicro = !!opts.allowMicro;
  const open = isOpenBoard(fill);
  const sizePlan = opts.plan || pickSizePlan(phase, rng, fill);
  const shapePlan = opts.shapePlan || pickShapePlan(phase, rng, fill);
  const mul = familyMulForPhase(phase);
  if (open) {
    for (const i of [0, 1, 2, 3, 10, 11]) mul[i] = (mul[i] || 1) * 1.45;
    for (const i of [4, 5, 7, 9]) mul[i] = (mul[i] || 1) * 0.28;
  }
  // 全局压 2 直
  mul[7] = (mul[7] || 1) * (allowMicro ? 0.45 : 0.05);
  const useBag = isBagEnabled();
  const used = new Set();
  /** @type {import('../forms.js').PieceDef[]} */
  const pieces = [];
  let sim = board.map((r) => r.slice());

  for (let i = 0; i < TRAY_SIZE; i++) {
    const wantSize = sizePlan[i] || 'M';
    const wantShape = shapePlan[i] || null;
    const role = useBag ? rollRole(phase, rng) : null;
    const tiers = tierFallbacks(wantSize, open, open ? 1 : 2);
    let form = null;
    const boardNow = simulate ? sim : board;

    const tryRole = (tier, shape, allowBanned = false) => {
      if (!useBag || !role) return null;
      return pickFormFromRole({
        role,
        board: boardNow,
        phase,
        tier,
        shapeClass: shape,
        usedKeys: used,
        canPlace: canPlaceOnCells,
        rng,
        allowBanned,
        allowMicro,
      });
    };

    // 1) 角色 ∩ 尺寸 ∩ 形状
    if (useBag) {
      for (const tier of tiers) {
        form = tryRole(tier, wantShape);
        if (form) break;
      }
      if (!form && wantShape) form = tryRole(null, wantShape);
      if (!form) {
        for (const tier of tiers) {
          form = tryRole(tier, null);
          if (form) break;
        }
      }
      if (!form) form = tryRole(null, null);
    }

    // 2) 无袋或角色抽空：尺寸 ∩ 形状（旧路径）
    if (!form) {
      for (const tier of tiers) {
        form = pickFittingForm(
          boardNow,
          tier,
          wantShape,
          mul,
          used,
          canPlaceOnCells,
          rng,
          tierOfForm,
        );
        if (form) break;
      }
    }
    if (!form && wantShape) {
      form = pickFittingForm(
        boardNow,
        null,
        wantShape,
        mul,
        used,
        canPlaceOnCells,
        rng,
        tierOfForm,
      );
    }
    if (!form) {
      for (const tier of tiers) {
        form = pickFittingForm(
          boardNow,
          tier,
          null,
          mul,
          used,
          canPlaceOnCells,
          rng,
          tierOfForm,
        );
        if (form) break;
      }
    }

    // 3) 任意可放（early 仍尽量禁碎）
    if (!form) {
      form = pickFormAnyAllowed(boardNow, phase, used, canPlaceOnCells, rng, mul);
    }
    if (!form) {
      for (let t = 0; t < 40; t++) {
        const f = pickWeightedForm(rng, mul);
        const key = matrixKey(f.matrix);
        if (used.has(key)) continue;
        if (!canPlaceOnCells(boardNow, f.matrix)) continue;
        const n = countCells(f.matrix);
        if (!allowMicro && n <= 2) continue;
        if (open && wantSize !== 'S' && n <= 3) continue;
        if (wantSize !== 'S' && n <= 2) continue;
        if (pieces.some((p) => shapeClassOf(p) === shapeClassOf(f)) && t < 25) continue;
        form = f;
        break;
      }
    }

    if (!form) {
      // 最后放宽 early 禁族
      if (useBag && role) {
        form = tryRole(null, null, true);
      }
    }

    if (!form) {
      if (!canPlaceOnCells(boardNow, FORM_1X1.matrix)) return null;
      if (open) return null;
      form = FORM_1X1;
    }

    used.add(matrixKey(form.matrix));
    pieces.push(makePiece(form));

    if (simulate) {
      // 整齐模拟：用贴合最佳落点推进（比任意点更接近玩家优放）
      const useBest = flagNeatSim();
      const pos = useBest
        ? findBestPlacement(sim, form.matrix) || findAnyPlacement(sim, form.matrix)
        : findAnyPlacement(sim, form.matrix);
      if (!pos) return null;
      sim = simulatePlace(sim, form.matrix, pos.r, pos.c);
    }
  }

  if (opts.requireScrap && !open) {
    if (!pieces.some((p) => isScrapFamily(p.family))) {
      const scrapMul = familyMulForPhase('mid');
      for (const i of [4, 5, 6, 9, 7]) scrapMul[i] *= 1.4;
      for (let slot = 0; slot < TRAY_SIZE; slot++) {
        if (countCells(pieces[slot].matrix) >= 6) continue;
        for (let t = 0; t < 30; t++) {
          const f = pickWeightedForm(rng, scrapMul);
          if (!isScrapFamily(f.family)) continue;
          if (!canPlaceOnCells(board, f.matrix)) continue;
          const key = matrixKey(f.matrix);
          if (pieces.some((p, j) => j !== slot && matrixKey(p.matrix) === key)) continue;
          // 替换后仍尽量保持形状多元
          const trial = pieces.slice();
          trial[slot] = makePiece(f);
          if (!acceptShapeDiversity(trial) && t < 20) continue;
          pieces[slot] = trial[slot];
          break;
        }
        if (pieces.some((p) => isScrapFamily(p.family))) break;
      }
    }
  }

  // 默认 G2：不强制全序；ORDER 开时才 G3
  if (orderGuaranteeOn()) {
    if (!existsPlacementOrder(board, pieces)) return null;
  } else if (countInstantFits(board, pieces) < 1) {
    return null;
  }
  if (!acceptSizeMix(pieces, fill, phase, { allowMicro })) return null;
  if (!acceptShapeDiversity(pieces)) return null;
  return { pieces, plan: sizePlan, shapePlan };
}

function flagNeatSim(t = getTune()) {
  const v = t.DEAL_NEAT_SIM_BEST_PLACE;
  if (typeof v === 'number') return v >= 0.5;
  if (typeof v === 'boolean') return v;
  return DEAL_NEAT_SIM_BEST_PLACE;
}

function orderGuaranteeOn(t = getTune()) {
  const v = t.DEAL_ORDER_GUARANTEE;
  if (typeof v === 'number') return v >= 0.5;
  if (typeof v === 'boolean') return v;
  return DEAL_ORDER_GUARANTEE;
}

function neatGuideMul(phase, t = getTune()) {
  const all =
    typeof t.DEAL_NEAT_GUIDE_ALL_PHASES === 'number'
      ? t.DEAL_NEAT_GUIDE_ALL_PHASES >= 0.5
      : t.DEAL_NEAT_GUIDE_ALL_PHASES !== false && DEAL_NEAT_GUIDE_ALL_PHASES;
  if (!all && phase !== 'early') return 0;
  const earlyG = Number.isFinite(t.DEAL_EARLY_CLEAR_GUIDE_MUL)
    ? Number(t.DEAL_EARLY_CLEAR_GUIDE_MUL)
    : DEAL_EARLY_CLEAR_GUIDE_MUL;
  if (phase === 'early') return Math.max(0.35, earlyG);
  if (phase === 'mid') {
    const m = Number.isFinite(t.DEAL_NEAT_GUIDE_MUL_MID)
      ? Number(t.DEAL_NEAT_GUIDE_MUL_MID)
      : DEAL_NEAT_GUIDE_MUL_MID;
    return earlyG * m;
  }
  const l = Number.isFinite(t.DEAL_NEAT_GUIDE_MUL_LATE)
    ? Number(t.DEAL_NEAT_GUIDE_MUL_LATE)
    : DEAL_NEAT_GUIDE_MUL_LATE;
  return earlyG * l;
}

/**
 * 兼容旧名：贪心可放（无尺寸配方）
 */
export function buildFitTrayGreedy(board, familyMul = null, rng = Math.random) {
  let sim = board.map((r) => r.slice());
  const used = new Set();
  /** @type {import('../forms.js').PieceDef[]} */
  const pieces = [];

  for (let i = 0; i < TRAY_SIZE; i++) {
    let placed = false;
    for (let tryN = 0; tryN < 48; tryN++) {
      const form = pickWeightedForm(rng, familyMul);
      const key = matrixKey(form.matrix);
      if (used.has(key) && tryN < 36) continue;
      const pos = findAnyPlacement(sim, form.matrix);
      if (!pos) continue;
      pieces.push(makePiece(form));
      used.add(key);
      sim = simulatePlace(sim, form.matrix, pos.r, pos.c);
      placed = true;
      break;
    }
    if (!placed) {
      const pos = findAnyPlacement(sim, FORM_1X1.matrix);
      if (!pos) return null;
      pieces.push(makePiece(FORM_1X1));
      sim = simulatePlace(sim, FORM_1X1.matrix, pos.r, pos.c);
    }
  }
  return pieces;
}

export function sampleWeightedTray(rng = Math.random) {
  const used = new Set();
  const out = [];
  for (let i = 0; i < TRAY_SIZE; i++) {
    let form = pickWeightedForm(rng);
    let key = matrixKey(form.matrix);
    let g = 0;
    while (used.has(key) && g++ < 30) {
      form = pickWeightedForm(rng);
      key = matrixKey(form.matrix);
    }
    used.add(key);
    out.push(makePiece(form));
  }
  return out;
}

/**
 * 按尺寸节奏收集候选，优先匹配配方的 tray
 * @param {(number|null)[][]} board
 * @param {import('./phase.js').DealPhase} phase
 * @param {{
 *   attempts?: number,
 *   requireScrap?: boolean,
 *   simulate?: boolean,
 *   accept: (pieces: import('../forms.js').PieceDef[]) => boolean,
 *   avoidSig?: string,
 *   signatureOf?: (p: import('../forms.js').PieceDef[]) => string,
 *   rng?: () => number,
 *   preferExactSize?: boolean,
 *   fill?: number,
 *   allowMicro?: boolean,
 * }} opts
 */
export function collectAndPickTray(board, phase, opts) {
  const rng = opts.rng || Math.random;
  // 降 attempts：配合快权重，避免 tray 刷新卡顿
  const attempts = opts.attempts ?? 28;
  const fill = opts.fill ?? 0;
  const allowMicro = !!opts.allowMicro;
  /** @type {{ pieces: import('../forms.js').PieceDef[], score: number }[]} */
  const pool = [];

  const t = getTune();
  const neatEarly =
    phase === 'early' &&
    (typeof t.DEAL_EARLY_NEAT_SHAPES === 'number'
      ? t.DEAL_EARLY_NEAT_SHAPES >= 0.5
      : t.DEAL_EARLY_NEAT_SHAPES !== false) &&
    DEAL_EARLY_NEAT_SHAPES;
  const guideMul = neatGuideMul(phase, t);
  const neatOn = guideMul > 0.01 && fill > 0.04;

  // 空腔表只算一次（旧逻辑在循环内反复扫盘 → 明显延迟）
  let cavKeys = null;
  if ((neatEarly || neatOn) && fill > 0.05) {
    const cav = rankCavityMatches(board, { minScore: 18, limit: 10 });
    cavKeys = new Set(
      cav.map((m) => m.form.matrix.map((row) => row.join('')).join('/')),
    );
  }

  for (let i = 0; i < attempts; i++) {
    const plan = pickSizePlan(phase, rng, fill);
    const shapePlan = pickShapePlan(phase, rng, fill);
    const built = buildSizedFitTray(board, phase, {
      rng,
      plan,
      shapePlan,
      fill,
      requireScrap: opts.requireScrap,
      simulate: opts.simulate,
      allowMicro,
    });
    if (!built) continue;
    const { pieces } = built;
    if (!acceptSizeMix(pieces, fill, phase, { allowMicro })) continue;
    if (!acceptShapeDiversity(pieces)) continue;
    if (!opts.accept(pieces)) continue;
    if (opts.avoidSig && opts.signatureOf && opts.signatureOf(pieces) === opts.avoidSig) {
      continue;
    }

    // 轻量打分（不在此做全盘 snug/clear 模拟，避免卡顿）
    let score = sizePlanScore(pieces, plan) + shapePlanScore(pieces, shapePlan);
    if (opts.preferExactSize !== false && matchesSizePlan(pieces, plan)) score += 5;
    const cells = pieces.map((p) => countCells(p.matrix));
    const spread = Math.max(...cells) - Math.min(...cells);
    if (spread >= 2) score += 2;
    if (isOpenBoard(fill) && Math.max(...cells) >= 6) score += 3;
    const classes = pieces.map((p) => shapeClassOf(p));
    if (classes.includes('bar_h') && classes.includes('bar_v')) score += 2;
    // 整齐堆叠友好：矩形/条优先于纯异形
    const hasRectOrBar = classes.some(
      (c) => c === 'rect' || c === 'bar_h' || c === 'bar_v',
    );
    const hasCornerOrTee = classes.some(
      (c) => c === 'corner' || c === 'tee',
    );
    if (hasRectOrBar) score += neatOn ? 3.5 : 1.5;
    if (hasRectOrBar && hasCornerOrTee) score += neatOn ? 2.5 : 1;
    if (!hasRectOrBar && hasCornerOrTee) score -= neatOn ? 1.5 : 0;
    for (const p of pieces) {
      const fam = p.family ?? -1;
      if (fam === 11 || fam === 5) score -= neatOn ? 10 : 4;
      if (fam === 10 && fill < 0.45) score -= 1.5;
    }
    if (cavKeys) {
      for (const p of pieces) {
        const k = p.matrix.map((row) => row.join('')).join('/');
        if (cavKeys.has(k)) score += 9;
      }
    }

    pool.push({ pieces, score });
    if (pool.length >= 12) break;
  }

  if (!pool.length) return null;

  // 入围 tray 做 snug + 整齐度精修
  const snugMul = Number.isFinite(t.DEAL_FIT_TRAY_SCORE_MUL)
    ? Number(t.DEAL_FIT_TRAY_SCORE_MUL)
    : DEAL_FIT_TRAY_SCORE_MUL;
  const maxMessRise = Number.isFinite(t.DEAL_NEAT_MAX_MESS_RISE)
    ? Number(t.DEAL_NEAT_MAX_MESS_RISE)
    : DEAL_NEAT_MAX_MESS_RISE;

  pool.sort((a, b) => b.score - a.score);
  const refine = pool.slice(0, Math.min(6, pool.length));
  /** @type {{ pieces: import('../forms.js').PieceDef[], score: number }[]} */
  const kept = [];
  for (const item of refine) {
    item.score += traySnugScore(board, item.pieces) * snugMul * 0.85;
    if (neatOn) {
      const neatS = trayClearFriendlyScore(board, item.pieces);
      item.score += neatS * guideMul * 0.85;
      if (maxMessRise > 0 && fill > 0.08) {
        const dMess = trayMessDelta(board, item.pieces);
        if (dMess > maxMessRise) {
          // 优放后明显变乱 → 丢弃（原版少给「越堆越碎」的块组）
          continue;
        }
        item.score -= Math.max(0, dMess) * 4;
      }
    }
    kept.push(item);
  }
  const finalPool = kept.length ? kept : refine;
  finalPool.sort((a, b) => b.score - a.score);
  const top = finalPool.slice(0, Math.min(3, finalPool.length));
  return top[Math.floor(rng() * top.length)].pieces;
}

/**
 * @param {(number|null)[][]} board
 * @param {number} maxAttempts
 * @param {number[] | null} [familyMul]
 */
export function fallbackGuaranteedTray(board, maxAttempts, familyMul = null) {
  for (let i = 0; i < maxAttempts; i++) {
    const pieces = buildFitTrayGreedy(board, familyMul);
    if (
      pieces &&
      existsPlacementOrder(board, pieces) &&
      !pieces.some((p) => countCells(p.matrix) <= 2)
    ) {
      return pieces;
    }
    if (pieces && existsPlacementOrder(board, pieces) && i > maxAttempts * 0.6) {
      return pieces;
    }
  }
  const used = new Set();
  const relaxed = [];
  for (let i = 0; i < TRAY_SIZE; i++) {
    let form = null;
    for (let t = 0; t < 40; t++) {
      const f = pickWeightedForm(Math.random, familyMul);
      const key = matrixKey(f.matrix);
      if (used.has(key)) continue;
      if (countCells(f.matrix) <= 2 && t < 28) continue;
      if (canPlaceOnCells(board, f.matrix)) {
        form = f;
        used.add(key);
        break;
      }
    }
    relaxed.push(makePiece(form || FORM_1X1));
  }
  return relaxed;
}

export function trayStats(board, pieces) {
  return {
    instant: countInstantFits(board, pieces),
    orderOk: existsPlacementOrder(board, pieces),
  };
}
