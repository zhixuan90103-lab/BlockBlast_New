/**
 * 可选：针对**当前盘**搜索「本 tray 三块合理摆完可清屏」。
 * 只返回长度 = TRAY_SIZE 的 tray，不跨轮预定。
 */
import {
  DEAL_EARLY_CLEAR_ENABLED,
  DEAL_EARLY_CLEAR_FILL_MAX,
  DEAL_EARLY_CLEAR_MAX_NODES,
  DEAL_EARLY_MIN_AVG_CELLS,
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
  findPlacements,
  isBoardEmpty,
  simulatePlace,
} from './board-ops.js';
import { familyMulForPhase } from './phase.js';

/**
 * @param {(number|null)[][]} board
 * @param {import('./phase.js').DealPhase} phase
 * @param {number} fill
 * @param {() => number} [rng]
 * @returns {import('../forms.js').PieceDef[] | null}
 */
export function tryClearTrayForBoard(board, phase, fill, rng = Math.random) {
  const t = getTune();
  const enabled = flag(t.DEAL_EARLY_CLEAR_ENABLED, DEAL_EARLY_CLEAR_ENABLED);
  if (!enabled) return null;

  const fillMax = num(t.DEAL_EARLY_CLEAR_FILL_MAX, DEAL_EARLY_CLEAR_FILL_MAX);
  if (fill > fillMax) return null;

  const chance =
    phase === 'mid'
      ? num(t.DEAL_MID_CLEAR_CHANCE, DEAL_MID_CLEAR_CHANCE)
      : phase === 'early'
        ? 0.4
        : 0;
  if (rng() >= chance) return null;

  const maxNodes = num(t.DEAL_EARLY_CLEAR_MAX_NODES, DEAL_EARLY_CLEAR_MAX_NODES);
  const minCell = phase === 'early' ? 4 : 3;
  const minAvg = phase === 'early' ? num(t.DEAL_EARLY_MIN_AVG_CELLS, DEAL_EARLY_MIN_AVG_CELLS) : 0;

  const found = searchThreeStepClear(board, {
    maxNodes,
    minCell,
    familyMul: familyMulForPhase(phase === 'late' ? 'mid' : phase),
    rng,
  });
  if (!found) return null;

  const avg = found.reduce((s, p) => s + countCells(p.matrix), 0) / found.length;
  if (avg + 1e-6 < minAvg) return null;
  return found;
}

/**
 * DFS：恰好 TRAY_SIZE 步后 board empty
 * @param {(number|null)[][]} start
 * @param {{ maxNodes: number, minCell: number, familyMul: number[], rng: () => number }} opts
 */
function searchThreeStepClear(start, opts) {
  const { maxNodes, minCell, familyMul, rng } = opts;
  let nodes = 0;
  /** @type {import('../forms.js').PieceDef[] | null} */
  let best = null;

  const pool = buildFormPool(familyMul, rng);

  /**
   * @param {(number|null)[][]} board
   * @param {number} depth
   * @param {import('../forms.js').PieceDef[]} path
   * @param {Set<string>} used
   */
  function dfs(board, depth, path, used) {
    if (best) return true;
    if (nodes++ > maxNodes) return false;

    if (depth === TRAY_SIZE) {
      if (isBoardEmpty(board)) {
        best = path.map((p) =>
          makePiece({ id: p.id, family: p.family, matrix: p.matrix }),
        );
        return true;
      }
      return false;
    }

    /** @type {{ form: import('../forms.js').FormDef, positions: {r:number,c:number}[], cells: number }[]} */
    const branch = [];
    const seen = new Set();

    const consider = (form) => {
      const key = matrixKey(form.matrix);
      if (used.has(key) || seen.has(key)) return;
      const cells = countCells(form.matrix);
      if (cells < minCell) return;
      const positions = findPlacements(board, form.matrix, 4);
      if (!positions.length) return;
      seen.add(key);
      branch.push({ form, positions, cells });
    };

    for (const f of pool) {
      consider(f);
      if (branch.length >= 14) break;
    }
    for (let i = 0; i < 6 && branch.length < 16; i++) {
      consider(pickWeightedForm(rng, familyMul));
    }
    branch.sort((a, b) => b.cells - a.cells);

    for (const b of branch) {
      const key = matrixKey(b.form.matrix);
      const posList =
        b.positions.length <= 2
          ? b.positions
          : [b.positions[0], b.positions[b.positions.length - 1]];
      for (const pos of posList) {
        const next = simulatePlace(board, b.form.matrix, pos.r, pos.c);
        const piece = makePiece(b.form);
        path.push(piece);
        used.add(key);
        if (dfs(next, depth + 1, path, used)) return true;
        path.pop();
        used.delete(key);
        if (nodes > maxNodes) return false;
      }
    }
    return false;
  }

  dfs(start, 0, [], new Set());
  return best;
}

/**
 * 大块优先 form 表
 * @param {number[]} familyMul
 * @param {() => number} rng
 */
function buildFormPool(familyMul, rng) {
  const order = [1, 2, 0, 3, 10, 11, 6, 8];
  /** @type {import('../forms.js').FormDef[]} */
  const pool = [];
  for (const fi of order) {
    const vars = FORM_FAMILIES[fi];
    if (!vars) continue;
    for (const f of vars) pool.push(f);
  }
  for (let i = pool.length - 1; i > 0; i--) {
    if (rng() > 0.4) continue;
    const j = Math.floor(rng() * (i + 1));
    const t = pool[i];
    pool[i] = pool[j];
    pool[j] = t;
  }
  // 略按倍率排序：高倍率族靠前
  pool.sort((a, b) => (familyMul[b.family] || 1) - (familyMul[a.family] || 1));
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
