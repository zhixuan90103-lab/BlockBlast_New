/**
 * 乐趣核实验开关 E2 / E3（research FUN-CORE）
 * - E2：tray 同时可见 1 vs 3（DEBUG_TRAY_SIZE）
 * - E3：权重袋真随机发块（非 bit 均匀），跳过 phase/payoff/助清/可放保证
 *
 * URL 快捷：`?e2=1`（tray1）`?e3=1`（真随机）可组合 `?e2=1&e3=1`
 * 注意：query 优先于调参面板显示值。
 * 调参面板「调试」组可运行时切换；改 tray 后请重开一局或等下一 tray。
 * 默认局必须保持关闭（见 research/FUN-CORE-SELF-CONSISTENCY.md）。
 */
import { TRAY_SIZE } from './defaults.js';
import { getTune } from './tune.js';

function queryFlag(name) {
  if (typeof location === 'undefined') return false;
  try {
    const q = new URLSearchParams(location.search || '');
    const v = q.get(name);
    return v === '1' || v === 'true' || v === 'yes';
  } catch {
    return false;
  }
}

/** @returns {1 | 3} */
export function getActiveTraySize() {
  if (queryFlag('e2') || queryFlag('tray1')) return 1;
  try {
    const n = Number(getTune().DEBUG_TRAY_SIZE);
    if (Number.isFinite(n) && n < 1.5) return 1;
    if (Number.isFinite(n) && n >= 2.5) return 3;
  } catch {
    /* tune 未就绪 */
  }
  return /** @type {1|3} */ (TRAY_SIZE === 1 ? 1 : 3);
}

export function isDealTrueRandom() {
  if (queryFlag('e3') || queryFlag('random')) return true;
  try {
    const v = getTune().DEBUG_DEAL_TRUE_RANDOM;
    return typeof v === 'number' ? v >= 0.5 : !!v;
  } catch {
    return false;
  }
}
