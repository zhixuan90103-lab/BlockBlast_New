/**
 * 投影换格 + 消行震动：
 * - 普通合法挪格：较弱瞬态
 * - 投影可形成消除（preclear）：更强/更脆
 * - 消除：1 次瞬态 + 间隔 + 1 段连续震（起→末 插值强度/锐度）
 * 参数来自 getTune()。
 */

/**
 * @param {{
 *   isNativeIos: () => boolean,
 *   playTransient: (p: { intensity: number, sharpness: number }) => unknown,
 *   startContinuous: (p: { intensity: number, sharpness: number }) => unknown,
 *   updateContinuous: (p: { intensity: number, sharpness: number }) => unknown,
 *   stopContinuous: () => unknown,
 * }} haptics
 * @param {() => import('../tune.js').TuneState} getTune
 */
export function createGhostHaptics(haptics, getTune) {
  /** @type {ReturnType<typeof setTimeout> | null} */
  let gapTimer = null;
  /** @type {ReturnType<typeof setInterval> | null} */
  let contTimer = null;
  let continuousOn = false;

  function clearClearFxTimers() {
    if (gapTimer != null) {
      clearTimeout(gapTimer);
      gapTimer = null;
    }
    if (contTimer != null) {
      clearInterval(contTimer);
      contTimer = null;
    }
  }

  function stopContinuousIfNeeded() {
    if (!continuousOn) return;
    continuousOn = false;
    if (haptics.isNativeIos()) void haptics.stopContinuous();
  }

  /**
   * @param {null | { hapticKey?: string|null, lastHapticAt?: number|null }} session
   * @param {null | { valid?: boolean, originRow: number, originCol: number, preclear?: { count?: number } }} next
   */
  function onHover(session, next) {
    if (!session) return;
    if (!next?.valid) {
      session.hapticKey = null;
      return;
    }
    const willClear = (next.preclear?.count ?? 0) > 0;
    const key = `${next.originRow},${next.originCol}:${willClear ? 1 : 0}`;
    if (session.hapticKey === key) return;
    const tune = getTune();
    const cooldown = Math.max(0, tune.FEEL_HAPTIC_GHOST_COOLDOWN_MS ?? 48);
    const now = performance.now();
    if (session.lastHapticAt != null && now - session.lastHapticAt < cooldown) return;
    session.hapticKey = key;
    session.lastHapticAt = now;
    if (!haptics.isNativeIos()) return;

    if (willClear) {
      void haptics.playTransient({
        intensity: tune.FEEL_HAPTIC_CLEAR_PREVIEW_INTENSITY ?? 0.65,
        sharpness: tune.FEEL_HAPTIC_CLEAR_PREVIEW_SHARPNESS ?? 0.25,
      });
    } else {
      void haptics.playTransient({
        intensity: tune.FEEL_HAPTIC_GHOST_INTENSITY ?? 0.55,
        sharpness: tune.FEEL_HAPTIC_GHOST_SHARPNESS ?? 0.18,
      });
    }
  }

  /**
   * 消除手感：1 瞬态 → gap → 连续震（时长内从起强度/锐度插值到末）
   * 不再单独需要 onClearCommit。
   */
  function onClearFxStart() {
    clearClearFxTimers();
    stopContinuousIfNeeded();

    if (!haptics.isNativeIos()) return;
    const tune = getTune();

    const tI = tune.FEEL_HAPTIC_CLEAR_FX_TRANSIENT_INTENSITY ?? 0.9;
    const tS = tune.FEEL_HAPTIC_CLEAR_FX_TRANSIENT_SHARPNESS ?? 0.35;
    if (tI > 0.001) {
      void haptics.playTransient({ intensity: tI, sharpness: tS });
    }

    const gapMs = Math.max(0, tune.FEEL_HAPTIC_CLEAR_FX_GAP_MS ?? 80);
    const durMs = Math.max(0, tune.FEEL_HAPTIC_CLEAR_FX_DURATION_MS ?? 100);
    const sI = tune.FEEL_HAPTIC_CLEAR_FX_START_INTENSITY ?? 0.5;
    const sS = tune.FEEL_HAPTIC_CLEAR_FX_START_SHARPNESS ?? 0;
    const eI = tune.FEEL_HAPTIC_CLEAR_FX_END_INTENSITY ?? 0.1;
    const eS = tune.FEEL_HAPTIC_CLEAR_FX_END_SHARPNESS ?? 0;

    // 连续震关：起强度为 0 或时长 0
    if (sI <= 0.001 && eI <= 0.001) return;
    if (durMs <= 0) return;

    const beginContinuous = () => {
      gapTimer = null;
      if (!haptics.isNativeIos()) return;
      void haptics.startContinuous({ intensity: sI, sharpness: sS });
      continuousOn = true;
      const t0 = performance.now();

      contTimer = setInterval(() => {
        if (!continuousOn) {
          clearClearFxTimers();
          return;
        }
        const u = Math.min(1, (performance.now() - t0) / durMs);
        const intensity = sI + (eI - sI) * u;
        const sharpness = sS + (eS - sS) * u;
        if (u >= 1) {
          void haptics.updateContinuous({ intensity: eI, sharpness: eS });
          stopContinuousIfNeeded();
          clearClearFxTimers();
          return;
        }
        void haptics.updateContinuous({ intensity, sharpness });
      }, 16);
    };

    if (gapMs <= 0) beginContinuous();
    else gapTimer = setTimeout(beginContinuous, gapMs);
  }

  /** 消行视觉结束 / 重开：强制停连续震与定时器 */
  function onClearFxEnd() {
    clearClearFxTimers();
    stopContinuousIfNeeded();
  }

  /** @deprecated 消除已并入 onClearFxStart（瞬态+连续） */
  function onClearCommit() {
    // 保留空实现，避免旧调用重复震
  }

  return {
    onHover,
    onClearCommit,
    onClearFxStart,
    onClearFxEnd,
  };
}
