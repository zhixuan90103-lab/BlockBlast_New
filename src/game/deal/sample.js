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
 * 按 尺寸配方 × 形状配方 × 当前可放 生成 tray
 * @param {(number|null)[][]} board
 * @param {import('./phase.js').DealPhase} phase
 * @param {{
 *   rng?: () => number,
 *   requireScrap?: boolean,
 *   plan?: import('./size-rhythm.js').SizeTier[],
 *   shapePlan?: import('./shape-class.js').ShapeClass[],
 *   simulate?: boolean,
 *   fill?: number,
 * }} [opts]
 */
export function buildSizedFitTray(board, phase, opts = {}) {
  const rng = opts.rng || Math.random;
  const simulate = opts.simulate !== false;
  const fill = opts.fill ?? 0;
  const open = isOpenBoard(fill);
  const sizePlan = opts.plan || pickSizePlan(phase, rng, fill);
  const shapePlan = opts.shapePlan || pickShapePlan(phase, rng, fill);
  const mul = familyMulForPhase(phase);
  if (open) {
    for (const i of [0, 1, 2, 3, 10, 11]) mul[i] = (mul[i] || 1) * 1.35;
    for (const i of [4, 5, 7, 9]) mul[i] = (mul[i] || 1) * 0.45;
  }
  const used = new Set();
  /** @type {import('../forms.js').PieceDef[]} */
  const pieces = [];
  let sim = board.map((r) => r.slice());

  for (let i = 0; i < TRAY_SIZE; i++) {
    const wantSize = sizePlan[i] || 'M';
    const wantShape = shapePlan[i] || null;
    const tiers = tierFallbacks(wantSize, open, open ? 1 : 2);
    let form = null;
    const boardNow = simulate ? sim : board;

    // 1) 尺寸 ∩ 形状
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

    // 2) 仅形状（尺寸放宽）
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

    // 3) 仅尺寸
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

    // 4) 任意可放（仍避开开阔盘豆丁）
    if (!form) {
      for (let t = 0; t < 50; t++) {
        const f = pickWeightedForm(rng, mul);
        const key = matrixKey(f.matrix);
        if (used.has(key)) continue;
        if (!canPlaceOnCells(boardNow, f.matrix)) continue;
        if (open && wantSize !== 'S' && countCells(f.matrix) <= 3) continue;
        // 尽量不与已有形状类重复
        if (pieces.some((p) => shapeClassOf(p) === shapeClassOf(f)) && t < 25) continue;
        form = f;
        break;
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
      const pos = findAnyPlacement(sim, form.matrix);
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

  if (!existsPlacementOrder(board, pieces)) return null;
  if (!acceptSizeMix(pieces, fill, phase)) return null;
  if (!acceptShapeDiversity(pieces)) return null;
  return { pieces, plan: sizePlan, shapePlan };
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
 * }} opts
 */
export function collectAndPickTray(board, phase, opts) {
  const rng = opts.rng || Math.random;
  const attempts = opts.attempts ?? 48;
  const fill = opts.fill ?? 0;
  /** @type {{ pieces: import('../forms.js').PieceDef[], score: number }[]} */
  const pool = [];

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
    });
    if (!built) continue;
    const { pieces } = built;
    if (!acceptSizeMix(pieces, fill, phase)) continue;
    if (!acceptShapeDiversity(pieces)) continue;
    if (!opts.accept(pieces)) continue;
    if (opts.avoidSig && opts.signatureOf && opts.signatureOf(pieces) === opts.avoidSig) {
      continue;
    }

    let score = sizePlanScore(pieces, plan) + shapePlanScore(pieces, shapePlan);
    if (opts.preferExactSize !== false && matchesSizePlan(pieces, plan)) score += 5;
    const cells = pieces.map((p) => countCells(p.matrix));
    const spread = Math.max(...cells) - Math.min(...cells);
    if (spread >= 2) score += 2;
    if (isOpenBoard(fill) && Math.max(...cells) >= 6) score += 3;
    // 横条+竖条同时出现加分
    const classes = pieces.map((p) => shapeClassOf(p));
    if (classes.includes('bar_h') && classes.includes('bar_v')) score += 2;
    if (classes.includes('corner') || classes.includes('tee')) score += 1;

    pool.push({ pieces, score });
    if (pool.length >= 14) break;
  }

  if (!pool.length) return null;
  pool.sort((a, b) => b.score - a.score);
  const top = pool.slice(0, Math.min(5, pool.length));
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
    if (pieces && existsPlacementOrder(board, pieces)) return pieces;
  }
  const used = new Set();
  const relaxed = [];
  for (let i = 0; i < TRAY_SIZE; i++) {
    let form = null;
    for (let t = 0; t < 40; t++) {
      const f = pickWeightedForm(Math.random, familyMul);
      const key = matrixKey(f.matrix);
      if (used.has(key)) continue;
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
