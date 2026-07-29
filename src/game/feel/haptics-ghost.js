/**
 * 投影换格震动（P9）：仅合法 hover 的 (row,col) 变化时瞬态一次。
 * 强度/锐度/冷却来自 getTune()；原生层应单脉冲直通。
 */

/**
 * @param {{
 *   isNativeIos: () => boolean,
 *   playTransient: (p: { intensity: number, sharpness: number }) => unknown,
 * }} haptics
 * @param {() => import('../tune.js').TuneState} getTune
 */
export function createGhostHaptics(haptics, getTune) {
  /**
   * @param {null | { hapticKey?: string|null, lastHapticAt?: number|null }} session
   * @param {null | { valid?: boolean, originRow: number, originCol: number }} next
   */
  function onHover(session, next) {
    if (!session) return;
    if (!next?.valid) {
      session.hapticKey = null;
      return;
    }
    const key = `${next.originRow},${next.originCol}`;
    if (session.hapticKey === key) return;
    const tune = getTune();
    const cooldown = Math.max(0, tune.FEEL_HAPTIC_GHOST_COOLDOWN_MS ?? 48);
    const now = performance.now();
    if (session.lastHapticAt != null && now - session.lastHapticAt < cooldown) return;
    session.hapticKey = key;
    session.lastHapticAt = now;
    if (haptics.isNativeIos()) {
      void haptics.playTransient({
        intensity: tune.FEEL_HAPTIC_GHOST_INTENSITY ?? 0.6,
        sharpness: tune.FEEL_HAPTIC_GHOST_SHARPNESS ?? 0.5,
      });
    }
  }

  return { onHover };
}
