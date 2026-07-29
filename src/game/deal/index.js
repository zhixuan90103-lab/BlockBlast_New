/**
 * 发块子系统公开 API
 *
 * 模块：
 *   board-ops  — 盘面纯函数
 *   phase      — 阶段 / 权重
 *   bag        — 角色袋 staple/solver/key/rare
 *   sample     — 响应式采样
 *   clear-tray — 可选：本 tray 三步清屏
 *   generate   — 总控
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
} from './generate.js';
export { ROLE_FAMILIES, roleMixForPhase, roleOfFamily, rollRole } from './bag.js';
