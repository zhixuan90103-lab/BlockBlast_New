/**
 * 清屏 / 助清：针对当前盘搜索「本 tray 能清空或大幅减占」的 3 块。
 * 不跨轮预定；周期强制助清在 generate.js 触发。
 *
 * 收官：填充较低时降低块尺寸门槛、优先搜全清，提高「见过清屏」概率。
 */
import {
  DEAL_CLEAR_ASSIST_FILL_MAX,
  DEAL_CLEAR_ASSIST_MIN_DROP,
  DEAL_CLEAR_FINISHER_FILL_MAX,
  DEAL_EARLY_CLEAR_CHANCE,
  DEAL_EARLY_CLEAR_ENABLED,
  DEAL_EARLY_CLEAR_FILL_MAX,
  DEAL_EARLY_CLEAR_MAX_NODES,
  DEAL_EARLY_MIN_AVG_CELLS,
  DEAL_LATE_CLEAR_CHANCE,
  DEAL_MID_CLEAR_CHANCE,
  TRAY_SIZE,
} from '../defaults.js';
import {
  FORM_FAMILIES,
  countCells,
  makePiece,
  matrixKey,
  pickWeightedForm,
} from '../forms.js';
import { getTune } from '../tune.js';
import {
  countFilled,
  findPlacements,
  isBoardEmpty,
  simulatePlace,
} from './board-ops.js';
import { familyMulForPhase } from './phase.js';

/**
 * 概率触发：三步全清
 * @param {(number|null)[][]} board
 * @param {import('./phase.js').DealPhase} phase
 * @param {number} fill
 * @param {() => number} [rng]
 * @param {{ chance?: number }} [opts] chance 由 policy 局面门控后传入
 * @returns {import('../forms.js').PieceDef[] | null}
 */
export function tryClearTrayForBoard(board, phase, fill, rng = Math.random, opts = {}) {
  const t = getTune();
  const enabled = flag(t.DEAL_EARLY_CLEAR_ENABLED, DEAL_EARLY_CLEAR_ENABLED);
  if (!enabled) return null;

  const fillMax = num(t.DEAL_EARLY_CLEAR_FILL_MAX, DEAL_EARLY_CLEAR_FILL_MAX);
  if (fill > fillMax) return null;

  const finisherMax = num(
    t.DEAL_CLEAR_FINISHER_FILL_MAX,
    DEAL_CLEAR_FINISHER_FILL_MAX,
  );
  // 概率全清（默认偏低=偶尔）；收官略抬一点；policy 可覆盖
  let chance =
    fill <= finisherMax
      ? Math.min(
          0.45,
          num(t.DEAL_EARLY_CLEAR_CHANCE, DEAL_EARLY_CLEAR_CHANCE) + 0.12,
        )
      : phase === 'early'
        ? num(t.DEAL_EARLY_CLEAR_CHANCE, DEAL_EARLY_CLEAR_CHANCE)
        : phase === 'mid'
          ? num(t.DEAL_MID_CLEAR_CHANCE, DEAL_MID_CLEAR_CHANCE)
          : num(t.DEAL_LATE_CLEAR_CHANCE, DEAL_LATE_CLEAR_CHANCE);
  if (Number.isFinite(opts.chance)) {
    chance =
      fill <= finisherMax
        ? Math.min(0.5, Math.max(opts.chance, opts.chance + 0.08))
        : opts.chance;
  }
  if (rng() >= chance) return null;

  const nodes = num(t.DEAL_EARLY_CLEAR_MAX_NODES, DEAL_EARLY_CLEAR_MAX_NODES);
  // early 全清多给搜索预算
  const budget =
    phase === 'early' || fill <= finisherMax
      ? nodes
      : Math.floor(nodes * 0.85);
  return searchClearOrAssist(board, phase, fill, {
    mode: 'full',
    rng,
    maxNodes: budget,
  });
}

/**
 * 强制助清：全清优先，否则三步减占。
 * @returns {{ pieces: import('../forms.js').PieceDef[], kind: 'full'|'assist' } | null}
 */
export function tryAssistClearTray(board, phase, fill, rng = Math.random) {
  const t = getTune();
  const enabled = flag(t.DEAL_EARLY_CLEAR_ENABLED, DEAL_EARLY_CLEAR_ENABLED);
  if (!enabled) return null;

  // 全阶段都可尝试（不限 early）；盘过满则跳过全清搜，仍可减占
  const fillMax = num(t.DEAL_CLEAR_ASSIST_FILL_MAX, DEAL_CLEAR_ASSIST_FILL_MAX);
  if (fill > fillMax || fill < 0.02) return null;

  const maxNodes = num(t.DEAL_EARLY_CLEAR_MAX_NODES, DEAL_EARLY_CLEAR_MAX_NODES);
  const finisherMax = num(
    t.DEAL_CLEAR_FINISHER_FILL_MAX,
    DEAL_CLEAR_FINISHER_FILL_MAX,
  );
  // 中盘也给足预算搜全清（不只收官）
  const fullBudget =
    fill <= finisherMax
      ? maxNodes
      : Math.floor(maxNodes * (fill < 0.55 ? 0.95 : 0.75));

  const full = searchClearOrAssist(board, phase, fill, {
    mode: 'full',
    rng,
    maxNodes: fullBudget,
    force: true,
  });
  if (full?.length) return { pieces: full, kind: 'full' };

  const assist = searchClearOrAssist(board, phase, fill, {
    mode: 'assist',
    rng,
    maxNodes,
    force: true,
  });
  if (assist?.length) return { pieces: assist, kind: 'assist' };
  return null;
}

/**
 * @param {(number|null)[][]} board
 * @param {import('./phase.js').DealPhase} phase
 * @param {number} fill
 * @param {{ mode: 'full'|'assist', rng: () => number, maxNodes: number, force?: boolean }} opts
 */
function searchClearOrAssist(board, phase, fill, opts) {
  const t = getTune();
  const startFilled = countFilled(board);
  const finisher = fill <= num(t.DEAL_CLEAR_FINISHER_FILL_MAX, DEAL_CLEAR_FINISHER_FILL_MAX)
    || startFilled <= 18;

  // 收官/残子少：允许 3 格块进搜索（仍默认禁止 2 格，除极残盘）
  let minCell = 3;
  if (opts.mode === 'full' && !finisher && phase === 'early') minCell = 4;
  if (finisher) minCell = 3;
  // 极残盘（≤8 格）：允许 2 格进全清搜索，否则凑不出清空
  const allowMicroInSearch = opts.mode === 'full' && startFilled <= 8;

  const minAvg =
    opts.mode === 'full' && finisher
      ? 3.0
      : opts.mode === 'full' && phase === 'early'
        ? Math.min(4.2, num(t.DEAL_EARLY_MIN_AVG_CELLS, DEAL_EARLY_MIN_AVG_CELLS))
        : opts.mode === 'assist'
          ? finisher
            ? 3.0
            : 3.3
          : 0;

  const minDrop = num(t.DEAL_CLEAR_ASSIST_MIN_DROP, DEAL_CLEAR_ASSIST_MIN_DROP);

  const found = searchThreeStep(board, {
    maxNodes: opts.maxNodes,
    minCell,
    allowMicroInSearch,
    familyMul: familyMulForPhase(phase === 'late' ? 'mid' : phase),
    rng: opts.rng,
    mode: opts.mode,
    startFilled,
    minDrop,
    preferSmall: finisher || startFilled <= 22,
    // early 全清只用整齐族，避免推异形把盘撕烂
    neatOnly: phase === 'early' || finisher,
  });
  if (!found?.pieces?.length) return null;

  const avg =
    found.pieces.reduce((s, p) => s + countCells(p.matrix), 0) /
    found.pieces.length;
  if (minAvg > 0 && avg + 1e-6 < minAvg) return null;

  if (opts.mode === 'assist') {
    if (found.endFilled > startFilled - minDrop && found.endFilled > 0) {
      return null;
    }
  }
  return found.pieces;
}

/**
 * @param {(number|null)[][]} start
 * @param {object} opts
 */
function searchThreeStep(start, opts) {
  const {
    maxNodes,
    minCell,
    allowMicroInSearch,
    familyMul,
    rng,
    mode,
    startFilled,
    minDrop,
    preferSmall,
    neatOnly,
  } = opts;
  let nodes = 0;
  /** @type {{ pieces: import('../forms.js').PieceDef[], endFilled: number } | null} */
  let bestFull = null;
  /** @type {{ pieces: import('../forms.js').PieceDef[], endFilled: number, drop: number } | null} */
  let bestAssist = null;

  const pool = buildFormPool(familyMul, rng, preferSmall, neatOnly);

  /**
   * @param {(number|null)[][]} board
   * @param {number} depth
   * @param {import('../forms.js').PieceDef[]} path
   * @param {Set<string>} used
   */
  function padToTray(path, board) {
    /** @type {import('../forms.js').PieceDef[]} */
    const out = path.map((p) =>
      makePiece({ id: p.id, family: p.family, matrix: p.matrix }),
    );
    const usedKeys = new Set(out.map((p) => matrixKey(p.matrix)));
    // 盘已空：只用整齐矩形/短条垫满（勿垫异形）
    const fillers = [0, 1, 8, 2, 10];
    for (const fi of fillers) {
      if (out.length >= TRAY_SIZE) break;
      const vars = FORM_FAMILIES[fi];
      if (!vars) continue;
      for (const f of vars) {
        if (out.length >= TRAY_SIZE) break;
        const key = matrixKey(f.matrix);
        if (usedKeys.has(key)) continue;
        if (countCells(f.matrix) < 3) continue;
        if (!findPlacements(board, f.matrix, 1).length) continue;
        usedKeys.add(key);
        out.push(makePiece(f));
      }
    }
    return out.length === TRAY_SIZE ? out : null;
  }

  function dfs(board, depth, path, used) {
    if (nodes++ > maxNodes) return false;

    // 提前清空：用垫块凑满 tray，显著提高「残局清屏」成功率
    if (isBoardEmpty(board) && depth > 0 && depth < TRAY_SIZE) {
      const padded = padToTray(path, board);
      if (padded) {
        bestFull = { pieces: padded, endFilled: 0 };
        return true;
      }
    }

    if (depth === TRAY_SIZE) {
      const endFilled = countFilled(board);
      if (isBoardEmpty(board)) {
        bestFull = {
          pieces: path.map((p) =>
            makePiece({ id: p.id, family: p.family, matrix: p.matrix }),
          ),
          endFilled: 0,
        };
        return true;
      }
      if (mode === 'assist') {
        const drop = startFilled - endFilled;
        if (drop >= minDrop) {
          if (!bestAssist || drop > bestAssist.drop) {
            bestAssist = {
              pieces: path.map((p) =>
                makePiece({ id: p.id, family: p.family, matrix: p.matrix }),
              ),
              endFilled,
              drop,
            };
          }
        }
      }
      return false;
    }

    /** @type {{ form: import('../forms.js').FormDef, positions: {r:number,c:number}[], cells: number }[]} */
    const branch = [];
    const seen = new Set();
    const filledNow = countFilled(board);

    const consider = (form) => {
      const key = matrixKey(form.matrix);
      if (used.has(key) || seen.has(key)) return;
      const cells = countCells(form.matrix);
      if (cells < minCell) return;
      if (cells <= 2 && !allowMicroInSearch) return;
      // 块比当前剩余还大且无法只靠消线时仍可能合法，但优先跳过明显过大
      if (preferSmall && cells > filledNow + 2 && cells >= 6 && branch.length > 4) {
        return;
      }
      const positions = findPlacements(board, form.matrix, preferSmall ? 8 : 5);
      if (!positions.length) return;
      seen.add(key);
      branch.push({ form, positions, cells });
    };

    for (const f of pool) {
      consider(f);
      if (branch.length >= (preferSmall ? 22 : 16)) break;
    }
    for (let i = 0; i < 10 && branch.length < 24; i++) {
      consider(pickWeightedForm(rng, familyMul));
    }

    // 收官：小块优先（对齐剩余格）；否则大块优先
    if (preferSmall) {
      branch.sort(
        (a, b) =>
          a.cells - b.cells + (rng() - 0.5) * 0.3 ||
          b.positions.length - a.positions.length,
      );
    } else {
      branch.sort((a, b) => b.cells - a.cells + (rng() - 0.5));
    }

    for (const b of branch) {
      const key = matrixKey(b.form.matrix);
      const posList =
        b.positions.length <= 4
          ? b.positions
          : [
              b.positions[0],
              b.positions[1],
              b.positions[Math.floor(b.positions.length / 2)],
              b.positions[b.positions.length - 1],
            ];
      for (const pos of posList) {
        const next = simulatePlace(board, b.form.matrix, pos.r, pos.c);
        path.push(makePiece(b.form));
        used.add(key);
        if (dfs(next, depth + 1, path, used)) {
          if (bestFull) return true;
        }
        path.pop();
        used.delete(key);
        if (nodes > maxNodes) return false;
      }
    }
    return false;
  }

  dfs(start, 0, [], new Set());

  if (bestFull) return bestFull;
  if (mode === 'assist' && bestAssist) return bestAssist;
  return null;
}

/**
 * @param {number[]} familyMul
 * @param {() => number} rng
 * @param {boolean} preferSmall
 */
function buildFormPool(familyMul, rng, preferSmall, neatOnly = false) {
  // neatOnly 仍含短 L/缺角/T：清屏常靠补缺角，不能只给大方块
  const order = neatOnly
    ? preferSmall
      ? [9, 4, 0, 8, 1, 6, 2, 10]
      : [0, 1, 8, 9, 4, 2, 6, 10]
    : preferSmall
      ? [9, 4, 0, 8, 1, 6, 2, 10, 3]
      : [0, 1, 8, 2, 10, 9, 4, 3, 6];
  /** @type {import('../forms.js').FormDef[]} */
  const pool = [];
  for (const fi of order) {
    const vars = FORM_FAMILIES[fi];
    if (!vars) continue;
    for (const f of vars) {
      if (countCells(f.matrix) <= 2 && !preferSmall) continue;
      // neat：不要 5 直
      if (f.family === 11) continue;
      pool.push(f);
    }
  }
  for (let i = pool.length - 1; i > 0; i--) {
    if (rng() > 0.5) continue;
    const j = Math.floor(rng() * (i + 1));
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }
  pool.sort((a, b) => {
    if (preferSmall) {
      return countCells(a.matrix) - countCells(b.matrix);
    }
    return (familyMul[b.family] || 1) - (familyMul[a.family] || 1);
  });
  return pool;
}

function flag(v, fb) {
  if (typeof v === 'number') return v >= 0.5;
  if (typeof v === 'boolean') return v;
  return !!fb;
}

function num(v, fb) {
  return Number.isFinite(v) ? Number(v) : fb;
}
