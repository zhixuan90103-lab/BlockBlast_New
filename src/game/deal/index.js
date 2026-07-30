/**
 * 发块子系统公开 API（重构后）
 *
 * pipeline  — 意图编排
 * session   — 跨 tray 会话（非剧本）
 * accept    — 验收档案
 * payoff    — T6 大消钥匙
 * cavity    — 空腔补缺
 * clear     — 全清/助清搜索
 * sample    — 主采样
 * board-ops — 盘面纯函数
 */
export {
  anyTrayPieceFits,
  basePhaseFromFill,
  basePhaseFromScore,
  classifyBoardState,
  clearPendingDealPlan,
  countInstantFits,
  existsPlacementOrder,
  familyMulForPhase,
  generateTray,
  lastDealMeta,
  resetDealState,
  rollDealPhase,
} from './pipeline.js';
export { ROLE_FAMILIES, roleMixForPhase, roleOfFamily, rollRole } from './bag.js';
export { boardHasPayoffSetup, rankPayoffForms } from './payoff-match.js';
export { getDealPolicy } from './policy.js';
export {
  allowsFullClearSearch,
  allowsPayoffIntent,
  maxEmptyRect,
} from './board-state.js';
