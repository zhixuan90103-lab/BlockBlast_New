/**
 * 发块会话状态（跨 tray，非跨剧本形状队列）
 * R-09 / R-11 / A 续推清屏
 */

/** @typedef {{
 *   lastTraySig: string,
 *   traysSinceAssist: number,
 *   assistStreakLeft: number,
 *   clearOfferPending: boolean,
 *   clearOfferRounds: number,
 * }} DealSession */

/** @type {DealSession} */
export const dealSession = {
  lastTraySig: '',
  traysSinceAssist: 0,
  assistStreakLeft: 0,
  clearOfferPending: false,
  clearOfferRounds: 0,
};

export function resetDealSession() {
  dealSession.lastTraySig = '';
  dealSession.traysSinceAssist = 0;
  dealSession.assistStreakLeft = 0;
  dealSession.clearOfferPending = false;
  dealSession.clearOfferRounds = 0;
}

/** @param {string} mode */
export function isFullClearOfferMode(mode) {
  return (
    mode === 'early-full-clear' ||
    mode === 'finisher-clear' ||
    mode === 'assist-full-clear' ||
    mode === 'early-clear' ||
    mode === 'mid-clear' ||
    mode === 'clear-retry' ||
    mode === 'clear-retry-cavity'
  );
}

/**
 * 发出 tray 后更新会话
 * @param {string} mode
 * @param {boolean} wasAssistBeat
 * @param {number} streakMax
 */
export function sessionOnEmit(mode, wasAssistBeat, streakMax) {
  if (isFullClearOfferMode(mode)) {
    dealSession.clearOfferPending = true;
    dealSession.clearOfferRounds += 1;
  } else if (dealSession.clearOfferPending) {
    dealSession.clearOfferRounds += 1;
  }

  if (wasAssistBeat || (mode && String(mode).includes('clear'))) {
    dealSession.traysSinceAssist = 0;
    if (!isFullClearOfferMode(mode)) {
      if (dealSession.assistStreakLeft > 0) {
        dealSession.assistStreakLeft -= 1;
      } else if (streakMax > 0) {
        dealSession.assistStreakLeft = Math.max(0, streakMax - 1);
      }
    }
  } else {
    dealSession.traysSinceAssist += 1;
  }
}

/**
 * 生成前：盘空清续推；超限放弃；可选 healthy 取消 pending
 * @param {number} fill
 * @param {number} clearRetryMax
 * @param {{ cancelOnHealthy?: boolean, boardClass?: string }} [opts]
 */
export function sessionBeforeDeal(fill, clearRetryMax, opts = {}) {
  if (fill < 0.005) {
    dealSession.clearOfferPending = false;
    dealSession.clearOfferRounds = 0;
    return;
  }
  if (
    dealSession.clearOfferPending &&
    dealSession.clearOfferRounds >= clearRetryMax
  ) {
    dealSession.clearOfferPending = false;
    dealSession.clearOfferRounds = 0;
    return;
  }
  // 盘已回到健康压盘且不太满：停止无限清屏续推
  if (
    opts.cancelOnHealthy &&
    dealSession.clearOfferPending &&
    opts.boardClass === 'healthy' &&
    fill > 0.08 &&
    fill < 0.42 &&
    dealSession.clearOfferRounds >= 2
  ) {
    dealSession.clearOfferPending = false;
    dealSession.clearOfferRounds = 0;
  }
}
