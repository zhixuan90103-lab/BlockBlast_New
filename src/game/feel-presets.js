/**
 * 手感预设槽 1 / 2（两套独立操作参数；震动/消行/发块出厂同源）：
 * - 手感1 = 速度映射跟手（GAIN_MIN/MAX + SPEED_REF）+ 默认抬升
 * - 手感2 = 固定倍率跟手（GAIN_K，k=1 为 1:1）+ 另一套抬升
 * localStorage 长按可覆盖；键带版本避免旧存档污染出厂定义。
 */
import {
  createDefaultTune,
  getTune,
  setTune,
} from './tune.js';

/** 升版本：手感1 快速跟手增益 MAX=1.35 */
const PRESET_VER = 'v16';
const STORAGE_PRESET = (id) => `bb_feel_preset_${PRESET_VER}_${id}`;
const STORAGE_ACTIVE = `bb_feel_preset_${PRESET_VER}_active`;

/** @typedef {import('./tune.js').TuneState} TuneState */

/**
 * 手感1 操作参数集：速度映射 + 抬升（≡ defaults；真机截图标定）
 * @param {TuneState} t
 */
function applyFeel1OpParams(t) {
  t.FEEL_DRAG_OFFSET_Y_MIN = -2.5;
  t.FEEL_DRAG_OFFSET_Y_MAX = -4.0;
  t.FEEL_DRAG_LIFT_TRAVEL_CELLS = 4.5;
  t.FEEL_DRAG_LIFT_POWER = 1.75;
  t.FEEL_POINTER_GAIN_MODE = 0;
  t.FEEL_POINTER_GAIN_MIN = 1.0;
  t.FEEL_POINTER_GAIN_MAX = 1.35;
  t.FEEL_POINTER_SPEED_REF = 6.0;
  t.FEEL_POINTER_GAIN_K = 1.0;
  t.FEEL_SMOOTH_TIME = 0.012;
  t.FEEL_GAIN_SMOOTH_TIME = 0.018;
  t.FEEL_BOARD_ENGAGE_OVERLAP = 0;
  t.FEEL_DRAG_FOLLOW_GAIN_MAX = t.FEEL_POINTER_GAIN_MAX;
  return t;
}

/**
 * 手感2 操作参数集：固定倍率 k + 抬升 -2（真机截图标定）
 * @param {TuneState} t
 */
function applyFeel2OpParams(t) {
  t.FEEL_DRAG_OFFSET_Y_MIN = -2.0;
  t.FEEL_DRAG_OFFSET_Y_MAX = -2.0;
  t.FEEL_DRAG_LIFT_TRAVEL_CELLS = 1.0;
  t.FEEL_DRAG_LIFT_POWER = 1.0;
  t.FEEL_POINTER_GAIN_MODE = 1;
  // 速度曲线字段不参与 MODE=1，保留占位
  t.FEEL_POINTER_GAIN_MIN = 1.0;
  t.FEEL_POINTER_GAIN_MAX = 1.0;
  t.FEEL_POINTER_SPEED_REF = 7.0;
  /** 跟手倍率：1.6 = 小手大块（真机标定） */
  t.FEEL_POINTER_GAIN_K = 1.6;
  t.FEEL_SMOOTH_TIME = 0.012;
  t.FEEL_GAIN_SMOOTH_TIME = 0;
  t.FEEL_BOARD_ENGAGE_OVERLAP = 0;
  t.FEEL_DRAG_FOLLOW_GAIN_MAX = t.FEEL_POINTER_GAIN_K;
  return t;
}

/**
 * 手感1：defaults 底 + 明确操作参数集
 * @returns {TuneState}
 */
function createPreset1Factory() {
  return applyFeel1OpParams(createDefaultTune());
}

/**
 * 手感2：同底震动/消行；独立操作参数集（固定倍率）
 * @returns {TuneState}
 */
function createPreset2Factory() {
  return applyFeel2OpParams(createDefaultTune());
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
