/**
 * 投影换格 + 消行震动：
 * - 普通合法挪格 / 将消：瞬态
 * - 消除：T→C→T→C→T→C（3 组「瞬态 + 连续」）
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
  /** 序列代次：重开/打断时递增，丢弃过期回调 */
  let seqGen = 0;

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
        intensity: tune.FEEL_HAPTIC_CLEAR_PREVIEW_INTENSITY ?? 0.7,
        sharpness: tune.FEEL_HAPTIC_CLEAR_PREVIEW_SHARPNESS ?? 0.3,
      });
    } else {
      void haptics.playTransient({
        intensity: tune.FEEL_HAPTIC_GHOST_INTENSITY ?? 0.45,
        sharpness: tune.FEEL_HAPTIC_GHOST_SHARPNESS ?? 0.25,
      });
    }
  }

  /**
   * 读第 n 波（1..3）瞬态/连续参数；兼容旧单波字段名作为第 1 波。
   * @param {import('../tune.js').TuneState} tune
   * @param {1|2|3} n
   */
  function readWave(tune, n) {
    if (n === 1) {
      return {
        tI: tune.FEEL_HAPTIC_CLEAR_FX_T1_INTENSITY ?? tune.FEEL_HAPTIC_CLEAR_FX_TRANSIENT_INTENSITY ?? 1,
        tS: tune.FEEL_HAPTIC_CLEAR_FX_T1_SHARPNESS ?? tune.FEEL_HAPTIC_CLEAR_FX_TRANSIENT_SHARPNESS ?? 0.45,
        dur: tune.FEEL_HAPTIC_CLEAR_FX_C1_DURATION_MS ?? tune.FEEL_HAPTIC_CLEAR_FX_DURATION_MS ?? 50,
        sI: tune.FEEL_HAPTIC_CLEAR_FX_C1_START_INTENSITY ?? tune.FEEL_HAPTIC_CLEAR_FX_START_INTENSITY ?? 0.4,
        sS: tune.FEEL_HAPTIC_CLEAR_FX_C1_START_SHARPNESS ?? tune.FEEL_HAPTIC_CLEAR_FX_START_SHARPNESS ?? 0.1,
        eI: tune.FEEL_HAPTIC_CLEAR_FX_C1_END_INTENSITY ?? tune.FEEL_HAPTIC_CLEAR_FX_END_INTENSITY ?? 0.2,
        eS: tune.FEEL_HAPTIC_CLEAR_FX_C1_END_SHARPNESS ?? tune.FEEL_HAPTIC_CLEAR_FX_END_SHARPNESS ?? 0,
      };
    }
    if (n === 2) {
      return {
        tI: tune.FEEL_HAPTIC_CLEAR_FX_T2_INTENSITY ?? 0.75,
        tS: tune.FEEL_HAPTIC_CLEAR_FX_T2_SHARPNESS ?? 0.45,
        dur: tune.FEEL_HAPTIC_CLEAR_FX_C2_DURATION_MS ?? 45,
        sI: tune.FEEL_HAPTIC_CLEAR_FX_C2_START_INTENSITY ?? 0.32,
        sS: tune.FEEL_HAPTIC_CLEAR_FX_C2_START_SHARPNESS ?? 0.08,
        eI: tune.FEEL_HAPTIC_CLEAR_FX_C2_END_INTENSITY ?? 0.15,
        eS: tune.FEEL_HAPTIC_CLEAR_FX_C2_END_SHARPNESS ?? 0,
      };
    }
    return {
      tI: tune.FEEL_HAPTIC_CLEAR_FX_T3_INTENSITY ?? 0.55,
      tS: tune.FEEL_HAPTIC_CLEAR_FX_T3_SHARPNESS ?? 0.4,
      dur: tune.FEEL_HAPTIC_CLEAR_FX_C3_DURATION_MS ?? 40,
      sI: tune.FEEL_HAPTIC_CLEAR_FX_C3_START_INTENSITY ?? 0.25,
      sS: tune.FEEL_HAPTIC_CLEAR_FX_C3_START_SHARPNESS ?? 0.06,
      eI: tune.FEEL_HAPTIC_CLEAR_FX_C3_END_INTENSITY ?? 0.1,
      eS: tune.FEEL_HAPTIC_CLEAR_FX_C3_END_SHARPNESS ?? 0,
    };
  }

  /**
   * 消除：T→C→T→C→T→C（段间 gap）
   */
  function onClearFxStart() {
    clearClearFxTimers();
    stopContinuousIfNeeded();
    seqGen += 1;
    const gen = seqGen;

    if (!haptics.isNativeIos()) return;
    const tune = getTune();
    const gapMs = Math.max(0, tune.FEEL_HAPTIC_CLEAR_FX_GAP_MS ?? 30);

    /** @type {{ kind: 't' | 'c', n: 1|2|3 }[]} */
    const steps = [
      { kind: 't', n: 1 },
      { kind: 'c', n: 1 },
      { kind: 't', n: 2 },
      { kind: 'c', n: 2 },
      { kind: 't', n: 3 },
      { kind: 'c', n: 3 },
    ];

    /**
     * @param {number} idx
     */
    function afterGap(idx) {
      if (gen !== seqGen) return;
      if (gapMs <= 0) {
        runStep(idx);
        return;
      }
      gapTimer = setTimeout(() => {
        gapTimer = null;
        if (gen !== seqGen) return;
        runStep(idx);
      }, gapMs);
    }

    /**
     * @param {number} idx
     */
    function runStep(idx) {
      if (gen !== seqGen) return;
      if (idx >= steps.length) return;
      if (!haptics.isNativeIos()) return;

      const step = steps[idx];
      const w = readWave(tune, step.n);
      const next = idx + 1;

      if (step.kind === 't') {
        if (w.tI > 0.001) {
          void haptics.playTransient({ intensity: w.tI, sharpness: w.tS });
        }
        if (next < steps.length) afterGap(next);
        return;
      }

      // continuous
      const durMs = Math.max(0, w.dur);
      if (durMs <= 0 || (w.sI <= 0.001 && w.eI <= 0.001)) {
        if (next < steps.length) afterGap(next);
        return;
      }

      stopContinuousIfNeeded();
      void haptics.startContinuous({ intensity: w.sI, sharpness: w.sS });
      continuousOn = true;
      const t0 = performance.now();

      contTimer = setInterval(() => {
        if (gen !== seqGen || !continuousOn) {
          clearClearFxTimers();
          return;
        }
        const u = Math.min(1, (performance.now() - t0) / durMs);
        const intensity = w.sI + (w.eI - w.sI) * u;
        const sharpness = w.sS + (w.eS - w.sS) * u;
        if (u >= 1) {
          void haptics.updateContinuous({ intensity: w.eI, sharpness: w.eS });
          stopContinuousIfNeeded();
          if (contTimer != null) {
            clearInterval(contTimer);
            contTimer = null;
          }
          if (next < steps.length) afterGap(next);
          return;
        }
        void haptics.updateContinuous({ intensity, sharpness });
      }, 16);
    }

    runStep(0);
  }

  function onClearFxEnd() {
    seqGen += 1;
    clearClearFxTimers();
    stopContinuousIfNeeded();
  }

  function onClearCommit() {
    // 已并入 onClearFxStart
  }

  return {
    onHover,
    onClearCommit,
    onClearFxStart,
    onClearFxEnd,
  };
}
