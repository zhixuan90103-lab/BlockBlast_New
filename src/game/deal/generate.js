/**
 * 发块入口（薄封装）— 实现见 pipeline.js
 *
 * 管线意图：续推清屏 → beat全清/助清 → payoff大消 → 空腔 → 主采样 → fallback
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
