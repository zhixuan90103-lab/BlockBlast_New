/**
 * 通用震动桥（无业务曲线）。原生真源：plugins/native-haptics/。
 * 仅 iOS App 生效；浏览器 → not_native_ios。
 * @see plugins/native-haptics/README.md · docs/ENGINEERING.md §6
 */
import { Capacitor, registerPlugin } from '@capacitor/core';

/**
 * Low-level bridge to the custom iOS Core Haptics plugin.
 * Game-specific haptic rhythms belong in product code, not this shell.
 *
 * Plugin methods (iOS):
 * - prepare()
 * - playTransient({ intensity, sharpness })
 * - startContinuous({ intensity, sharpness })
 * - updateContinuous({ intensity, sharpness })
 * - stopContinuous()
 */
const NativeHapticsPlugin = registerPlugin('NativeHaptics');

function clamp01(v) {
  return Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
}

export function createNativeHaptics({ enabled = true } = {}) {
  const onIosApp = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
  let lastError = '';

  async function call(method, payload = {}) {
    if (!enabled) {
      lastError = 'disabled';
      return { ok: false, reason: lastError };
    }
    if (!onIosApp) {
      lastError = 'not_native_ios';
      return { ok: false, reason: lastError };
    }
    try {
      const result = await NativeHapticsPlugin[method](payload);
      lastError = '';
      return { ok: true, result };
    } catch (err) {
      lastError = err?.message || String(err);
      console.warn('[NativeHaptics]', method, lastError);
      return { ok: false, reason: lastError, error: err };
    }
  }

  return {
    isNativeIos: () => onIosApp,
    getLastError: () => lastError,
    prepare: () => call('prepare'),
    playTransient: ({ intensity = 0.35, sharpness = 0.45 } = {}) =>
      call('playTransient', {
        intensity: clamp01(intensity),
        sharpness: clamp01(sharpness),
      }),
    startContinuous: ({ intensity = 0.12, sharpness = 0.2 } = {}) =>
      call('startContinuous', {
        intensity: clamp01(intensity),
        sharpness: clamp01(sharpness),
      }),
    updateContinuous: ({ intensity = 0.2, sharpness = 0.25 } = {}) =>
      call('updateContinuous', {
        intensity: clamp01(intensity),
        sharpness: clamp01(sharpness),
      }),
    stopContinuous: () => call('stopContinuous'),
  };
}
