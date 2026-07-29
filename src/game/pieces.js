/**
 * Tray 发块 — 兼容入口。
 * 实现见 `./deal/`（响应式、分阶段、无跨轮剧本）。
 */
export {
  anyTrayPieceFits,
  basePhaseFromFill,
  clearPendingDealPlan,
  countInstantFits,
  existsPlacementOrder,
  familyMulForPhase,
  generateTray,
  lastDealMeta,
  resetDealState,
  rollDealPhase,
} from './deal/index.js';
