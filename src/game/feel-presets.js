/**
 * 手感预设槽 1 / 2：
 * - 手感1 = 当前 defaults 标定（出厂 / 游戏默认）
 * - 手感2 = 同底 + 截图操作幅度参数（其余相同）
 * localStorage 长按可覆盖；键带版本避免旧存档污染出厂定义。
 */
import {
  createDefaultTune,
  getTune,
  setTune,
} from './tune.js';

const PRESET_VER = 'v3';
const STORAGE_PRESET = (id) => `bb_feel_preset_${PRESET_VER}_${id}`;
const STORAGE_ACTIVE = `bb_feel_preset_${PRESET_VER}_active`;

/** @typedef {import('./tune.js').TuneState} TuneState */

/**
 * 手感1：完整 defaults（当前调好的参数）
 * @returns {TuneState}
 */
function createPreset1Factory() {
  return createDefaultTune();
}

/**
 * 手感2：与手感1相同，仅操作抬升/跟手用截图值
 * @returns {TuneState}
 */
function createPreset2Factory() {
  const t = createDefaultTune();
  // 截图「操作手感」
  t.FEEL_DRAG_OFFSET_Y_MIN = -2.5;
  t.FEEL_DRAG_OFFSET_Y_MAX = -2.5;
  t.FEEL_DRAG_LIFT_TRAVEL_CELLS = 1.0;
  t.FEEL_DRAG_LIFT_POWER = 1.0;
  t.FEEL_POINTER_GAIN_MIN = 0.9;
  t.FEEL_POINTER_GAIN_MAX = 1.6;
  t.FEEL_POINTER_SPEED_REF = 6.0;
  t.FEEL_DRAG_FOLLOW_GAIN_MAX = t.FEEL_POINTER_GAIN_MAX;
  return t;
}

/**
 * @param {'1' | '2'} id
 * @returns {TuneState}
 */
export function getFactoryPreset(id) {
  if (id === '2') return createPreset2Factory();
  return createPreset1Factory();
}

/**
 * @param {unknown} raw
 * @param {TuneState} base
 * @returns {TuneState}
 */
function mergePreset(raw, base) {
  const out = { ...base };
  if (!raw || typeof raw !== 'object') return out;
  for (const k of Object.keys(base)) {
    const v = /** @type {Record<string, unknown>} */ (raw)[k];
    if (typeof v === 'number' && Number.isFinite(v)) {
      out[/** @type {keyof TuneState} */ (k)] = v;
    }
  }
  return out;
}

/**
 * @param {'1' | '2'} id
 * @returns {TuneState}
 */
export function loadFeelPreset(id) {
  const base = getFactoryPreset(id);
  try {
    const s = localStorage.getItem(STORAGE_PRESET(id));
    if (!s) return base;
    return mergePreset(JSON.parse(s), base);
  } catch {
    return base;
  }
}

/**
 * 把当前（或指定）tune 写入槽位
 * @param {'1' | '2'} id
 * @param {Partial<TuneState>} [state]
 */
export function saveFeelPreset(id, state) {
  const snap = { ...createDefaultTune(), ...(state || getTune()) };
  try {
    localStorage.setItem(STORAGE_PRESET(id), JSON.stringify(snap));
  } catch {
    /* ignore quota */
  }
  return snap;
}

/**
 * @returns {'1' | '2'}
 */
export function getActiveFeelPresetId() {
  try {
    const v = localStorage.getItem(STORAGE_ACTIVE);
    if (v === '1' || v === '2') return v;
  } catch {
    /* ignore */
  }
  // 游戏默认：手感1
  return '1';
}

/**
 * @param {'1' | '2'} id
 */
export function setActiveFeelPresetId(id) {
  try {
    localStorage.setItem(STORAGE_ACTIVE, id);
  } catch {
    /* ignore */
  }
}

/**
 * 应用预设到全局 tune
 * @param {'1' | '2'} id
 * @returns {TuneState}
 */
export function applyFeelPreset(id) {
  const preset = loadFeelPreset(id);
  setTune(preset);
  setActiveFeelPresetId(id);
  return preset;
}
