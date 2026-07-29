/**
 * 手机友好调参面板：滑条写入 tune，并通知游戏 relayout / repaint。
 */
import {
  getTune,
  needsLayoutRelayout,
  onTuneChange,
  resetTune,
  setTune,
  TUNE_FIELDS,
} from './game/tune.js';

/**
 * @param {{
 *   mount?: HTMLElement,
 *   onChange?: (info: { key?: string, value?: number, needsLayout: boolean, reset?: boolean }) => void,
 * }} opts
 */
export function createFeelPanel(opts = {}) {
  const mount = opts.mount || document.getElementById('phone-frame') || document.body;
  const onChange = opts.onChange || (() => {});

  const root = document.createElement('div');
  root.id = 'feel-panel';
  root.className = 'feel-panel is-collapsed';
  root.setAttribute('aria-label', '手感调参');

  const fab = document.createElement('button');
  fab.type = 'button';
  fab.className = 'feel-panel-fab';
  fab.textContent = '调参';
  fab.setAttribute('aria-expanded', 'false');

  const sheet = document.createElement('div');
  sheet.className = 'feel-panel-sheet';
  sheet.hidden = true;

  const head = document.createElement('div');
  head.className = 'feel-panel-head';
  head.innerHTML = `
    <span class="feel-panel-title">手感 / 布局</span>
    <div class="feel-panel-head-actions">
      <button type="button" class="feel-panel-btn" data-feel-reset>重置</button>
      <button type="button" class="feel-panel-btn feel-panel-btn-primary" data-feel-close>收起</button>
    </div>
  `;

  const body = document.createElement('div');
  body.className = 'feel-panel-body';

  /** @type {Map<string, { range: HTMLInputElement, val: HTMLElement, item: any, applyLocal: (v: number) => void }>} */
  const controls = new Map();

  /** 滑条正在写入时，跳过 onTuneChange 回写，避免抢焦点/数值闪烁 */
  let suppressSync = false;

  /**
   * @param {string} key
   * @param {number} v
   */
  function commitValue(key, v) {
    if (!Number.isFinite(v)) return;
    suppressSync = true;
    setTune({ [key]: v });
    const ctl = controls.get(key);
    ctl?.applyLocal(v);
    suppressSync = false;
    onChange({
      key,
      value: v,
      needsLayout: needsLayoutRelayout(key),
    });
  }

  for (const group of TUNE_FIELDS) {
    const sec = document.createElement('section');
    sec.className = 'feel-panel-group';
    const h = document.createElement('h3');
    h.className = 'feel-panel-group-title';
    h.textContent = group.group;
    sec.appendChild(h);

    for (const item of group.items) {
      const row = document.createElement('label');
      row.className = 'feel-panel-row';
      row.dataset.key = item.key;

      const top = document.createElement('div');
      top.className = 'feel-panel-row-top';
      const name = document.createElement('span');
      name.className = 'feel-panel-label';
      name.textContent = item.label;
      const val = document.createElement('span');
      val.className = 'feel-panel-value';
      top.append(name, val);

      const range = document.createElement('input');
      range.type = 'range';
      range.min = String(item.min);
      range.max = String(item.max);
      range.step = String(item.step);
      range.className = 'feel-panel-range';
      range.setAttribute('aria-label', item.label);

      const fmt = item.format || ((v) => String(v));
      const applyLocal = (v) => {
        val.textContent = fmt(v);
        // 仅当与当前滑条不一致时写回，减少 iOS 上 input 被打断
        if (Number(range.value) !== v) {
          range.value = String(v);
        }
      };

      const onSlide = (e) => {
        e.stopPropagation();
        commitValue(item.key, Number(range.value));
      };
      range.addEventListener('input', onSlide);
      range.addEventListener('change', onSlide);

      for (const ev of ['pointerdown', 'pointermove', 'pointerup', 'touchstart', 'touchmove']) {
        range.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
      }

      row.append(top, range);
      sec.appendChild(row);
      controls.set(item.key, { range, val, item, applyLocal });
    }
    body.appendChild(sec);
  }

  sheet.append(head, body);
  root.append(fab, sheet);
  mount.appendChild(root);

  function syncFromTune() {
    if (suppressSync) return;
    const t = getTune();
    for (const [key, ctl] of controls) {
      const v = t[key];
      if (typeof v === 'number' && Number.isFinite(v)) {
        ctl.applyLocal(v);
      }
    }
  }

  function setOpen(open) {
    root.classList.toggle('is-collapsed', !open);
    root.classList.toggle('is-open', open);
    sheet.hidden = !open;
    fab.setAttribute('aria-expanded', open ? 'true' : 'false');
    fab.hidden = open;
    if (open) syncFromTune();
  }

  fab.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  });

  head.querySelector('[data-feel-close]')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(false);
  });

  head.querySelector('[data-feel-reset]')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    suppressSync = true;
    resetTune();
    suppressSync = false;
    syncFromTune();
    onChange({ needsLayout: true, reset: true });
  });

  sheet.addEventListener('pointerdown', (e) => e.stopPropagation());
  sheet.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });

  const unsub = onTuneChange(() => {
    if (!suppressSync) syncFromTune();
  });
  syncFromTune();
  setOpen(false);

  return {
    root,
    open: () => setOpen(true),
    close: () => setOpen(false),
    sync: syncFromTune,
    dispose() {
      unsub();
      root.remove();
    },
  };
}
