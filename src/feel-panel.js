/**
 * 手感调参面板：右上角「设置」入口；
 * 面板内含手感1/2 预设 + 滑条（长按预设可保存到该槽）。
 */
import {
  applyFeelPreset,
  getActiveFeelPresetId,
  saveFeelPreset,
  setActiveFeelPresetId,
} from './game/feel-presets.js';
import {
  getTune,
  needsLayoutRelayout,
  onTuneChange,
  setTune,
  TUNE_FIELDS,
} from './game/tune.js';

/**
 * @param {{
 *   mount?: HTMLElement,
 *   onChange?: (info: { key?: string, value?: number, needsLayout: boolean, reset?: boolean, preset?: string }) => void,
 * }} opts
 */
export function createFeelPanel(opts = {}) {
  const mount = opts.mount || document.getElementById('phone-frame') || document.body;
  const onChange = opts.onChange || (() => {});

  const root = document.createElement('div');
  root.id = 'feel-panel';
  root.className = 'feel-panel is-collapsed';
  root.setAttribute('aria-label', '手感调参');

  /** 右上角设置入口 */
  const fab = document.createElement('button');
  fab.type = 'button';
  fab.className = 'feel-panel-fab';
  fab.setAttribute('aria-label', '设置');
  fab.setAttribute('aria-expanded', 'false');
  fab.title = '设置';
  fab.innerHTML = `
    <svg class="feel-panel-fab-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path fill="currentColor" d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.03 7.03 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 13.9 2h-3.8a.5.5 0 0 0-.49.42l-.36 2.54c-.59.24-1.13.55-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 8.48a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.83 14.52a.5.5 0 0 0-.12.64l1.92 3.32c.13.23.4.32.64.22l2.39-.96c.5.39 1.04.7 1.63.94l.36 2.54c.05.24.25.42.49.42h3.8c.24 0 .44-.18.49-.42l.36-2.54c.59-.24 1.13-.55 1.63-.94l2.39.96c.24.1.51 0 .64-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"/>
    </svg>
  `;

  /** 半透明遮罩：点空白收起 */
  const scrim = document.createElement('button');
  scrim.type = 'button';
  scrim.className = 'feel-panel-scrim';
  scrim.setAttribute('aria-label', '关闭设置');
  scrim.hidden = true;
  scrim.tabIndex = -1;

  const sheet = document.createElement('div');
  sheet.className = 'feel-panel-sheet';
  sheet.hidden = true;

  const head = document.createElement('div');
  head.className = 'feel-panel-head';
  head.innerHTML = `
    <span class="feel-panel-title">设置</span>
    <div class="feel-panel-head-actions">
      <button type="button" class="feel-panel-btn" data-feel-reset>重置</button>
      <button type="button" class="feel-panel-btn feel-panel-btn-primary" data-feel-close>收起</button>
    </div>
  `;

  /** 面板内：手感预设 */
  const presetBar = document.createElement('div');
  presetBar.className = 'feel-preset-bar';
  presetBar.setAttribute('aria-label', '手感预设');

  const presetLabel = document.createElement('div');
  presetLabel.className = 'feel-preset-label';
  presetLabel.textContent = '操作手感';
  presetBar.appendChild(presetLabel);

  const presetRow = document.createElement('div');
  presetRow.className = 'feel-preset-row';

  /** @type {Map<'1'|'2', HTMLButtonElement>} */
  const presetBtns = new Map();
  for (const id of /** @type {const} */ (['1', '2'])) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'feel-preset-btn';
    btn.dataset.preset = id;
    btn.textContent = `手感${id}`;
    btn.title = '点击切换 · 长按保存当前参数到此槽';
    btn.setAttribute('aria-pressed', 'false');
    presetBtns.set(id, btn);
    presetRow.appendChild(btn);
  }
  const presetHint = document.createElement('p');
  presetHint.className = 'feel-preset-hint';
  presetHint.textContent = '长按「手感」可保存当前参数到该槽';
  presetBar.append(presetRow, presetHint);

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

  sheet.append(head, presetBar, body);
  root.append(fab, scrim, sheet);
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

  /**
   * @param {'1' | '2' | null} id
   */
  function highlightPreset(id) {
    for (const [pid, btn] of presetBtns) {
      const on = pid === id;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }

  /**
   * @param {'1' | '2'} id
   */
  function switchPreset(id) {
    suppressSync = true;
    applyFeelPreset(id);
    suppressSync = false;
    highlightPreset(id);
    syncFromTune();
    onChange({ needsLayout: true, preset: id });
  }

  /**
   * @param {'1' | '2'} id
   * @param {HTMLButtonElement} btn
   */
  function flashSaved(btn, id) {
    const prev = btn.textContent;
    btn.textContent = '已存';
    btn.classList.add('is-saved');
    setTimeout(() => {
      btn.textContent = prev;
      btn.classList.remove('is-saved');
    }, 700);
    setActiveFeelPresetId(id);
    highlightPreset(id);
  }

  for (const [id, btn] of presetBtns) {
    let longPressTimer = /** @type {ReturnType<typeof setTimeout> | null} */ (null);
    let longPressed = false;

    const clearLong = () => {
      if (longPressTimer != null) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    };

    btn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      longPressed = false;
      clearLong();
      longPressTimer = setTimeout(() => {
        longPressed = true;
        saveFeelPreset(id);
        flashSaved(btn, id);
        if (navigator.vibrate) {
          try {
            navigator.vibrate(12);
          } catch {
            /* ignore */
          }
        }
      }, 520);
    });
    btn.addEventListener('pointerup', (e) => {
      e.preventDefault();
      e.stopPropagation();
      clearLong();
      if (!longPressed) switchPreset(id);
    });
    btn.addEventListener('pointercancel', () => {
      clearLong();
      longPressed = false;
    });
    btn.addEventListener('pointerleave', () => {
      if (!longPressed) clearLong();
    });
    for (const ev of ['touchstart', 'touchend', 'click']) {
      btn.addEventListener(ev, (e) => e.stopPropagation(), { passive: false });
    }
  }

  function setOpen(open) {
    root.classList.toggle('is-collapsed', !open);
    root.classList.toggle('is-open', open);
    sheet.hidden = !open;
    scrim.hidden = !open;
    fab.setAttribute('aria-expanded', open ? 'true' : 'false');
    fab.classList.toggle('is-open', open);
    if (open) syncFromTune();
  }

  fab.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(!root.classList.contains('is-open'));
  });

  scrim.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(false);
  });

  head.querySelector('[data-feel-close]')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(false);
  });

  head.querySelector('[data-feel-reset]')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    switchPreset('1');
  });

  sheet.addEventListener('pointerdown', (e) => e.stopPropagation());
  sheet.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
  presetBar.addEventListener('pointerdown', (e) => e.stopPropagation());
  presetBar.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
  fab.addEventListener('pointerdown', (e) => e.stopPropagation());
  fab.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });

  const unsub = onTuneChange(() => {
    if (!suppressSync) syncFromTune();
  });
  syncFromTune();
  setOpen(false);

  // 启动：默认手感1；若上次选过手感2则恢复
  switchPreset(getActiveFeelPresetId());

  return {
    root,
    open: () => setOpen(true),
    close: () => setOpen(false),
    sync: syncFromTune,
    switchPreset,
    dispose() {
      unsub();
      root.remove();
    },
  };
}
