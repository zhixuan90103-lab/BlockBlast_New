/**
 * 关掉 Web/WKWebView 干扰手感的默认行为：
 * - 双指捏合缩放 / 多指手势
 * - 双击放大
 * - 长按放大镜 / 文本选择 / 系统菜单
 * - Ctrl+滚轮缩放
 *
 * 调参面板单指滚动仍可用（只拦截多指与双击缩放）。
 */
export function installTouchHygiene() {
  const root = document.documentElement;
  root.style.touchAction = 'none';

  /** @param {TouchEvent} e */
  const blockMulti = (e) => {
    if (e.touches && e.touches.length > 1) {
      e.preventDefault();
    }
  };

  document.addEventListener('touchstart', blockMulti, { passive: false, capture: true });
  document.addEventListener('touchmove', blockMulti, { passive: false, capture: true });

  // Safari 旧 pinch 事件
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(type, (e) => e.preventDefault(), { passive: false, capture: true });
  }

  // 双击放大：短时间内第二次 touchend 交给系统会触发 zoom
  let lastTouchEnd = 0;
  document.addEventListener(
    'touchend',
    (e) => {
      const now = performance.now();
      if (now - lastTouchEnd < 350) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    },
    { passive: false, capture: true },
  );

  document.addEventListener('dblclick', (e) => e.preventDefault(), { capture: true });
  document.addEventListener('contextmenu', (e) => e.preventDefault(), { capture: true });

  document.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault();
    },
    { passive: false, capture: true },
  );

  // 非主指针（第二指等）一律吞掉，避免双指并发
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (e.isPrimary === false) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    { capture: true },
  );
}
