/**
 * 运行时可调手感/布局参数（默认来自 defaults.js）。
 * 调参面板读写本模块；layout / game / view 通过 getTune() 读取。
 */
import * as D from './defaults.js';

/** @typedef {ReturnType<typeof createDefaultTune>} TuneState */

export function createDefaultTune() {
  return {
    // —— 布局 / 尺寸 ——
    /** tray 块单格 / 盘格 */
    FEEL_TRAY_SCALE: D.FEEL_TRAY_SCALE,
    /** 棋盘整体缩放（相对算出来的最大正方形） */
    LAYOUT_BOARD_SCALE: 1,
    /** 棋盘垂直偏移 / frame 高（+ 下移） */
    LAYOUT_BOARD_SHIFT_Y: D.LAYOUT_BOARD_SHIFT_Y,
    /** tray 垂直偏移 / frame 高（+ 下移） */
    LAYOUT_TRAY_SHIFT_Y: D.LAYOUT_TRAY_SHIFT_Y,
    /** 左右边距 / frame 宽 */
    LAYOUT_GRID_MARGIN_X: D.LAYOUT_GRID_MARGIN_X,
    /** 分数区占位 / frame 高 */
    LAYOUT_HUD_SCORE_H: D.LAYOUT_HUD_SCORE_H,
    /** 分数文字字号 px */
    UI_SCORE_FONT_PX: D.UI_SCORE_FONT_PX,
    /** 分数垂直偏移 / frame 高（+ 下移） */
    UI_SCORE_OFFSET_Y: D.UI_SCORE_OFFSET_Y,
    /** 分数下到盘顶 / frame 高 */
    LAYOUT_GRID_TOP_GAP: D.LAYOUT_GRID_TOP_GAP,
    /** 盘底 → tray 顶（board cell） */
    LAYOUT_GAP_GRID_TRAY_CELLS: D.LAYOUT_GAP_GRID_TRAY_CELLS,
    /** tray 带高度 × trayCell */
    LAYOUT_TRAY_BAND_CELLS: D.LAYOUT_TRAY_BAND_CELLS,
    /** 底边额外 / frame 高 */
    LAYOUT_PAD_BOTTOM_EXTRA: D.LAYOUT_PAD_BOTTOM_EXTRA,
    /** 盘格内容内缩 */
    BOARD_CELL_INSET: D.BOARD_CELL_INSET,
    /** tray 块内缝 */
    TRAY_CELL_INSET: D.TRAY_CELL_INSET,

    // —— 拖拽操作 ——
    FEEL_DRAG_OFFSET_Y_MIN: D.FEEL_DRAG_OFFSET_Y_MIN,
    FEEL_DRAG_OFFSET_Y_MAX: D.FEEL_DRAG_OFFSET_Y_MAX,
    FEEL_DRAG_LIFT_TRAVEL_CELLS: D.FEEL_DRAG_LIFT_TRAVEL_CELLS,
    FEEL_DRAG_LIFT_POWER: D.FEEL_DRAG_LIFT_POWER,
    FEEL_POINTER_GAIN_MIN: D.FEEL_POINTER_GAIN_MIN,
    FEEL_POINTER_GAIN_MAX: D.FEEL_POINTER_GAIN_MAX,
    FEEL_POINTER_SPEED_REF: D.FEEL_POINTER_SPEED_REF,
    FEEL_SMOOTH_TIME: D.FEEL_SMOOTH_TIME,
    FEEL_GAIN_SMOOTH_TIME: D.FEEL_GAIN_SMOOTH_TIME,
    FEEL_DRAG_FOLLOW_GAIN_MAX: D.FEEL_DRAG_FOLLOW_GAIN_MAX,
    FEEL_BOARD_ENGAGE_OVERLAP: D.FEEL_BOARD_ENGAGE_OVERLAP,
    FEEL_HAPTIC_GHOST_INTENSITY: D.FEEL_HAPTIC_GHOST_INTENSITY,
    FEEL_HAPTIC_GHOST_SHARPNESS: D.FEEL_HAPTIC_GHOST_SHARPNESS,
    FEEL_HAPTIC_CLEAR_PREVIEW_INTENSITY: D.FEEL_HAPTIC_CLEAR_PREVIEW_INTENSITY,
    FEEL_HAPTIC_CLEAR_PREVIEW_SHARPNESS: D.FEEL_HAPTIC_CLEAR_PREVIEW_SHARPNESS,
    FEEL_HAPTIC_CLEAR_FX_TRANSIENT_INTENSITY: D.FEEL_HAPTIC_CLEAR_FX_TRANSIENT_INTENSITY,
    FEEL_HAPTIC_CLEAR_FX_TRANSIENT_SHARPNESS: D.FEEL_HAPTIC_CLEAR_FX_TRANSIENT_SHARPNESS,
    FEEL_HAPTIC_CLEAR_FX_GAP_MS: D.FEEL_HAPTIC_CLEAR_FX_GAP_MS,
    FEEL_HAPTIC_CLEAR_FX_DURATION_MS: D.FEEL_HAPTIC_CLEAR_FX_DURATION_MS,
    FEEL_HAPTIC_CLEAR_FX_START_INTENSITY: D.FEEL_HAPTIC_CLEAR_FX_START_INTENSITY,
    FEEL_HAPTIC_CLEAR_FX_START_SHARPNESS: D.FEEL_HAPTIC_CLEAR_FX_START_SHARPNESS,
    FEEL_HAPTIC_CLEAR_FX_END_INTENSITY: D.FEEL_HAPTIC_CLEAR_FX_END_INTENSITY,
    FEEL_HAPTIC_CLEAR_FX_END_SHARPNESS: D.FEEL_HAPTIC_CLEAR_FX_END_SHARPNESS,
    FEEL_HAPTIC_GHOST_COOLDOWN_MS: D.FEEL_HAPTIC_GHOST_COOLDOWN_MS,
    FEEL_GHOST_ALPHA: D.FEEL_GHOST_ALPHA,
    FEEL_GHOST_OPEN_SNAP: D.FEEL_GHOST_OPEN_SNAP,
    FEEL_GHOST_EDGE_HOLD: D.FEEL_GHOST_EDGE_HOLD,
    FEEL_GHOST_MAX_LAG: D.FEEL_GHOST_MAX_LAG,
    FEEL_GHOST_FAST_SPEED_RATIO: D.FEEL_GHOST_FAST_SPEED_RATIO,
    FEEL_GHOST_FAST_EXIT_RATIO: D.FEEL_GHOST_FAST_EXIT_RATIO,
    FEEL_AXIS_DOMINANCE: D.FEEL_AXIS_DOMINANCE,
    /** 显示 tray 三等分区 */
    SHOW_TRAY_ZONES: D.SHOW_TRAY_ZONES,

    // —— 发块阶段 ——
    DEAL_PHASE_ENABLED: D.DEAL_PHASE_ENABLED ? 1 : 0,
    DEAL_FILL_EARLY_MAX: D.DEAL_FILL_EARLY_MAX,
    DEAL_FILL_MID_MAX: D.DEAL_FILL_MID_MAX,
    DEAL_LATE_RELAX_EARLY: D.DEAL_LATE_RELAX_EARLY,
    DEAL_LATE_RELAX_MID: D.DEAL_LATE_RELAX_MID,
    DEAL_MID_RELAX_EARLY: D.DEAL_MID_RELAX_EARLY,
    DEAL_MAX_ATTEMPTS: D.DEAL_MAX_ATTEMPTS,
    DEAL_EARLY_NEAT_MUL: D.DEAL_EARLY_NEAT_MUL,
    DEAL_EARLY_MIN_AVG_CELLS: D.DEAL_EARLY_MIN_AVG_CELLS,
    DEAL_LATE_AWKWARD_MUL: D.DEAL_LATE_AWKWARD_MUL,
    DEAL_MID_BIG_DAMP: D.DEAL_MID_BIG_DAMP,
    DEAL_MID_SCRAP_MUL: D.DEAL_MID_SCRAP_MUL,
    DEAL_MID_CLEAR_CHANCE: D.DEAL_MID_CLEAR_CHANCE,
    DEAL_EARLY_INSTANT_MIN: D.DEAL_EARLY_INSTANT_MIN,
    DEAL_EARLY_INSTANT_MAX: D.DEAL_EARLY_INSTANT_MAX,
    DEAL_MID_INSTANT_MIN: D.DEAL_MID_INSTANT_MIN,
    DEAL_MID_INSTANT_MAX: D.DEAL_MID_INSTANT_MAX,
    DEAL_LATE_INSTANT_MIN: D.DEAL_LATE_INSTANT_MIN,
    DEAL_LATE_INSTANT_MAX: D.DEAL_LATE_INSTANT_MAX,
    DEAL_EARLY_CLEAR_ENABLED: D.DEAL_EARLY_CLEAR_ENABLED ? 1 : 0,
    DEAL_EARLY_CLEAR_MIN: D.DEAL_EARLY_CLEAR_MIN,
    DEAL_EARLY_CLEAR_MAX: D.DEAL_EARLY_CLEAR_MAX,
    DEAL_EARLY_CLEAR_FILL_MAX: D.DEAL_EARLY_CLEAR_FILL_MAX,
    DEAL_BAG_ENABLED: D.DEAL_BAG_ENABLED ? 1 : 0,
    DEAL_EARLY_BAN_TINY: D.DEAL_EARLY_BAN_TINY ? 1 : 0,
    DEAL_ROLE_EARLY_STAPLE: D.DEAL_ROLE_EARLY_STAPLE,
    DEAL_ROLE_EARLY_SOLVER: D.DEAL_ROLE_EARLY_SOLVER,
    DEAL_ROLE_EARLY_KEY: D.DEAL_ROLE_EARLY_KEY,
    DEAL_ROLE_EARLY_RARE: D.DEAL_ROLE_EARLY_RARE,
    DEAL_ROLE_MID_STAPLE: D.DEAL_ROLE_MID_STAPLE,
    DEAL_ROLE_MID_SOLVER: D.DEAL_ROLE_MID_SOLVER,
    DEAL_ROLE_MID_KEY: D.DEAL_ROLE_MID_KEY,
    DEAL_ROLE_MID_RARE: D.DEAL_ROLE_MID_RARE,
    DEAL_ROLE_LATE_STAPLE: D.DEAL_ROLE_LATE_STAPLE,
    DEAL_ROLE_LATE_SOLVER: D.DEAL_ROLE_LATE_SOLVER,
    DEAL_ROLE_LATE_KEY: D.DEAL_ROLE_LATE_KEY,
    DEAL_ROLE_LATE_RARE: D.DEAL_ROLE_LATE_RARE,
  };
}

/** @type {TuneState} */
export const tune = createDefaultTune();

/** @type {Set<(t: TuneState) => void>} */
const listeners = new Set();

export function getTune() {
  return tune;
}

export function getTuneDefaults() {
  return createDefaultTune();
}

/**
 * 改这些 key 需要 relayout（几何/布局）
 * 其余手感/震动改 getTune() 即时生效，只需 repaint
 */
export const LAYOUT_TUNE_KEYS = new Set([
  'FEEL_TRAY_SCALE',
  'LAYOUT_BOARD_SCALE',
  'LAYOUT_GAP_GRID_TRAY_CELLS',
  'LAYOUT_BOARD_SHIFT_Y',
  'LAYOUT_TRAY_SHIFT_Y',
  'LAYOUT_TRAY_BAND_CELLS',
  'LAYOUT_GRID_MARGIN_X',
  'LAYOUT_HUD_SCORE_H',
  'LAYOUT_GRID_TOP_GAP',
  'LAYOUT_PAD_BOTTOM_EXTRA',
  'BOARD_CELL_INSET',
  'TRAY_CELL_INSET',
  'SHOW_TRAY_ZONES',
]);

export function needsLayoutRelayout(key) {
  return LAYOUT_TUNE_KEYS.has(key);
}

/**
 * @param {Partial<TuneState>} partial
 */
export function setTune(partial) {
  Object.assign(tune, partial);
  // 兼容旧字段
  if (Object.prototype.hasOwnProperty.call(partial, 'FEEL_POINTER_GAIN_MAX')) {
    tune.FEEL_DRAG_FOLLOW_GAIN_MAX = tune.FEEL_POINTER_GAIN_MAX;
  }
  for (const fn of listeners) fn(tune);
}

export function resetTune() {
  Object.assign(tune, createDefaultTune());
  for (const fn of listeners) fn(tune);
}

/**
 * @param {(t: TuneState) => void} fn
 * @returns {() => void}
 */
export function onTuneChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** 调参面板字段定义（手机友好分组） */
export const TUNE_FIELDS = [
  {
    group: '尺寸与间距',
    items: [
      { key: 'FEEL_TRAY_SCALE', label: '摆放物大小', min: 0.3, max: 0.75, step: 0.01, format: (v) => v.toFixed(2) },
      { key: 'LAYOUT_BOARD_SCALE', label: '棋盘格大小', min: 0.7, max: 1.05, step: 0.01, format: (v) => v.toFixed(2) },
      {
        key: 'LAYOUT_GAP_GRID_TRAY_CELLS',
        label: '盘↔摆放物间距',
        min: 0,
        max: 2.5,
        step: 0.05,
        format: (v) => `${v.toFixed(2)}格`,
      },
      {
        key: 'LAYOUT_BOARD_SHIFT_Y',
        label: '棋盘高度(下移)',
        min: -0.12,
        max: 0.2,
        step: 0.005,
        format: (v) => v.toFixed(3),
      },
      {
        key: 'LAYOUT_TRAY_SHIFT_Y',
        label: '摆放物高度(下移)',
        min: -0.1,
        max: 0.15,
        step: 0.005,
        format: (v) => v.toFixed(3),
      },
      {
        key: 'LAYOUT_TRAY_BAND_CELLS',
        label: '摆放区带高度',
        min: 2.2,
        max: 4.5,
        step: 0.1,
        format: (v) => v.toFixed(1),
      },
      {
        key: 'LAYOUT_GRID_MARGIN_X',
        label: '棋盘左右边距',
        min: 0.02,
        max: 0.12,
        step: 0.005,
        format: (v) => v.toFixed(3),
      },
      {
        key: 'LAYOUT_HUD_SCORE_H',
        label: '顶部分数区',
        min: 0.06,
        max: 0.18,
        step: 0.005,
        format: (v) => v.toFixed(3),
      },
      {
        key: 'UI_SCORE_FONT_PX',
        label: '分数大小',
        min: 24,
        max: 72,
        step: 1,
        format: (v) => `${Math.round(v)}px`,
      },
      {
        key: 'UI_SCORE_OFFSET_Y',
        label: '分数高度(下移)',
        min: -0.1,
        max: 0.18,
        step: 0.005,
        format: (v) => v.toFixed(3),
      },
      {
        key: 'LAYOUT_GRID_TOP_GAP',
        label: '分数→盘顶缝',
        min: 0,
        max: 0.05,
        step: 0.002,
        format: (v) => v.toFixed(3),
      },
      {
        key: 'LAYOUT_PAD_BOTTOM_EXTRA',
        label: '底部留白',
        min: 0.01,
        max: 0.12,
        step: 0.005,
        format: (v) => v.toFixed(3),
      },
    ],
  },
  {
    group: '操作手感',
    items: [
      {
        key: 'FEEL_DRAG_OFFSET_Y_MIN',
        label: '抬升(拿起幅度)',
        min: -4,
        max: -1,
        step: 0.05,
        format: (v) => `${v.toFixed(2)}格`,
      },
      {
        key: 'FEEL_DRAG_OFFSET_Y_MAX',
        label: '抬升(远距上限)',
        min: -4.5,
        max: -1.5,
        step: 0.05,
        format: (v) => `${v.toFixed(2)}格`,
      },
      {
        key: 'FEEL_DRAG_LIFT_TRAVEL_CELLS',
        label: '上移满抬升格数',
        min: 1,
        max: 8,
        step: 0.1,
        format: (v) => v.toFixed(1),
      },
      {
        key: 'FEEL_DRAG_LIFT_POWER',
        label: '抬升曲线幂',
        min: 0.5,
        max: 2.5,
        step: 0.05,
        format: (v) => v.toFixed(2),
      },
      {
        key: 'FEEL_POINTER_GAIN_MIN',
        label: '慢速跟手增益',
        min: 0.7,
        max: 1.1,
        step: 0.01,
        format: (v) => v.toFixed(2),
      },
      {
        key: 'FEEL_POINTER_GAIN_MAX',
        label: '快速跟手增益',
        min: 1,
        max: 1.8,
        step: 0.01,
        format: (v) => v.toFixed(2),
      },
      {
        key: 'FEEL_POINTER_SPEED_REF',
        label: '加速参考指速(格/秒)',
        min: 3,
        max: 20,
        step: 0.5,
        format: (v) => v.toFixed(1),
      },
      {
        key: 'FEEL_SMOOTH_TIME',
        label: '拖拽平滑(秒)',
        min: 0,
        max: 0.12,
        step: 0.005,
        format: (v) => (v <= 0 ? '关' : v.toFixed(3)),
      },
      {
        key: 'FEEL_GAIN_SMOOTH_TIME',
        label: '增益平滑(秒)',
        min: 0,
        max: 0.12,
        step: 0.005,
        format: (v) => (v <= 0 ? '关' : v.toFixed(3)),
      },
      {
        key: 'FEEL_BOARD_ENGAGE_OVERLAP',
        label: '底排进入深度(0=立刻)',
        min: 0,
        max: 1.0,
        step: 0.05,
        format: (v) => (v <= 0 ? '立刻' : `${v.toFixed(2)}格`),
      },
    ],
  },
  {
    group: '震动(投影/将消/消除)',
    items: [
      {
        key: 'FEEL_HAPTIC_GHOST_INTENSITY',
        label: '普通挪格·强度',
        min: 0,
        max: 1,
        step: 0.05,
        format: (v) => v.toFixed(2),
      },
      {
        key: 'FEEL_HAPTIC_GHOST_SHARPNESS',
        label: '普通挪格·锐度',
        min: 0,
        max: 1,
        step: 0.05,
        format: (v) => v.toFixed(2),
      },
      {
        key: 'FEEL_HAPTIC_CLEAR_PREVIEW_INTENSITY',
        label: '将消格·强度',
        min: 0,
        max: 1,
        step: 0.05,
        format: (v) => v.toFixed(2),
      },
      {
        key: 'FEEL_HAPTIC_CLEAR_PREVIEW_SHARPNESS',
        label: '将消格·锐度',
        min: 0,
        max: 1,
        step: 0.05,
        format: (v) => v.toFixed(2),
      },
      {
        key: 'FEEL_HAPTIC_CLEAR_FX_TRANSIENT_INTENSITY',
        label: '消除·瞬态强度(0关)',
        min: 0,
        max: 1,
        step: 0.05,
        format: (v) => (v <= 0.001 ? '关' : v.toFixed(2)),
      },
      {
        key: 'FEEL_HAPTIC_CLEAR_FX_TRANSIENT_SHARPNESS',
        label: '消除·瞬态锐度',
        min: 0,
        max: 1,
        step: 0.05,
        format: (v) => v.toFixed(2),
      },
      {
        key: 'FEEL_HAPTIC_CLEAR_FX_GAP_MS',
        label: '消除·瞬态→连续间隔ms',
        min: 0,
        max: 200,
        step: 5,
        format: (v) => `${Math.round(v)}ms`,
      },
      {
        key: 'FEEL_HAPTIC_CLEAR_FX_DURATION_MS',
        label: '消除·连续时长ms(0关)',
        min: 0,
        max: 500,
        step: 10,
        format: (v) => (v <= 0 ? '关' : `${Math.round(v)}ms`),
      },
      {
        key: 'FEEL_HAPTIC_CLEAR_FX_START_INTENSITY',
        label: '消除·连续起强度',
        min: 0,
        max: 1,
        step: 0.05,
        format: (v) => v.toFixed(2),
      },
      {
        key: 'FEEL_HAPTIC_CLEAR_FX_START_SHARPNESS',
        label: '消除·连续起锐度',
        min: 0,
        max: 1,
        step: 0.05,
        format: (v) => v.toFixed(2),
      },
      {
        key: 'FEEL_HAPTIC_CLEAR_FX_END_INTENSITY',
        label: '消除·连续末强度',
        min: 0,
        max: 1,
        step: 0.05,
        format: (v) => v.toFixed(2),
      },
      {
        key: 'FEEL_HAPTIC_CLEAR_FX_END_SHARPNESS',
        label: '消除·连续末锐度',
        min: 0,
        max: 1,
        step: 0.05,
        format: (v) => v.toFixed(2),
      },
      {
        key: 'FEEL_HAPTIC_GHOST_COOLDOWN_MS',
        label: '换格去重冷却ms',
        min: 0,
        max: 120,
        step: 4,
        format: (v) => `${Math.round(v)}ms`,
      },
    ],
  },
  {
    group: '操作手感·投影',
    items: [
      {
        key: 'FEEL_GHOST_ALPHA',
        label: '合法投影透明度',
        min: 0.05,
        max: 0.55,
        step: 0.01,
        format: (v) => v.toFixed(2),
      },
      {
        key: 'FEEL_GHOST_OPEN_SNAP',
        label: '开阔换格阈值',
        min: 0.25,
        max: 1,
        step: 0.05,
        format: (v) => v.toFixed(2),
      },
      {
        key: 'FEEL_GHOST_EDGE_HOLD',
        label: '边缘粘滞(慢速)',
        min: 0.5,
        max: 2.5,
        step: 0.05,
        format: (v) => v.toFixed(2),
      },
      {
        key: 'FEEL_GHOST_MAX_LAG',
        label: '影-块最大距离',
        min: 0.5,
        max: 2,
        step: 0.05,
        format: (v) => v.toFixed(2),
      },
      {
        key: 'FEEL_GHOST_FAST_SPEED_RATIO',
        label: '快精模式指速比',
        min: 0.2,
        max: 1,
        step: 0.05,
        format: (v) => v.toFixed(2),
      },
      {
        key: 'FEEL_AXIS_DOMINANCE',
        label: '轴向主导滞回',
        min: 0,
        max: 0.25,
        step: 0.01,
        format: (v) => v.toFixed(2),
      },
    ],
  },
  {
    group: '发块节奏',
    items: [
      {
        key: 'DEAL_PHASE_ENABLED',
        label: '阶段推送',
        min: 0,
        max: 1,
        step: 1,
        format: (v) => (v >= 0.5 ? '开' : '关'),
      },
      {
        key: 'DEAL_BAG_ENABLED',
        label: '角色袋(staple/key)',
        min: 0,
        max: 1,
        step: 1,
        format: (v) => (v >= 0.5 ? '开' : '关'),
      },
      {
        key: 'DEAL_EARLY_BAN_TINY',
        label: '前期禁碎条/缺角',
        min: 0,
        max: 1,
        step: 1,
        format: (v) => (v >= 0.5 ? '开' : '关'),
      },
      {
        key: 'DEAL_FILL_EARLY_MAX',
        label: '前期填充上限',
        min: 0.15,
        max: 0.45,
        step: 0.01,
        format: (v) => v.toFixed(2),
      },
      {
        key: 'DEAL_FILL_MID_MAX',
        label: '中期填充上限',
        min: 0.35,
        max: 0.75,
        step: 0.01,
        format: (v) => v.toFixed(2),
      },
      {
        key: 'DEAL_LATE_RELAX_EARLY',
        label: '后期→前期回跳',
        min: 0,
        max: 0.4,
        step: 0.01,
        format: (v) => v.toFixed(2),
      },
      {
        key: 'DEAL_LATE_RELAX_MID',
        label: '后期→中期回跳',
        min: 0,
        max: 0.5,
        step: 0.01,
        format: (v) => v.toFixed(2),
      },
      {
        key: 'DEAL_MID_RELAX_EARLY',
        label: '中期→前期回跳',
        min: 0,
        max: 0.3,
        step: 0.01,
        format: (v) => v.toFixed(2),
      },
      {
        key: 'DEAL_EARLY_NEAT_MUL',
        label: '前期大块权重',
        min: 1.2,
        max: 3.5,
        step: 0.05,
        format: (v) => v.toFixed(2),
      },
      {
        key: 'DEAL_EARLY_MIN_AVG_CELLS',
        label: '前期平均格数≥',
        min: 3,
        max: 7,
        step: 0.1,
        format: (v) => v.toFixed(1),
      },
      {
        key: 'DEAL_EARLY_CLEAR_ENABLED',
        label: '前期清屏规划',
        min: 0,
        max: 1,
        step: 1,
        format: (v) => (v >= 0.5 ? '开' : '关'),
      },
      {
        key: 'DEAL_EARLY_CLEAR_MIN',
        label: '清屏最少步数',
        min: 3,
        max: 5,
        step: 1,
        format: (v) => String(Math.round(v)),
      },
      {
        key: 'DEAL_EARLY_CLEAR_MAX',
        label: '清屏最多步数',
        min: 3,
        max: 6,
        step: 1,
        format: (v) => String(Math.round(v)),
      },
      {
        key: 'DEAL_EARLY_CLEAR_FILL_MAX',
        label: '清屏规划填充上限',
        min: 0.1,
        max: 0.4,
        step: 0.01,
        format: (v) => v.toFixed(2),
      },
      {
        key: 'DEAL_LATE_AWKWARD_MUL',
        label: '后期别扭块权重',
        min: 1,
        max: 2.5,
        step: 0.05,
        format: (v) => v.toFixed(2),
      },
      {
        key: 'DEAL_MID_BIG_DAMP',
        label: '中期3×3抑制',
        min: 0.3,
        max: 1.2,
        step: 0.05,
        format: (v) => v.toFixed(2),
      },
      {
        key: 'DEAL_MID_SCRAP_MUL',
        label: '中期碎块权重',
        min: 1,
        max: 3,
        step: 0.05,
        format: (v) => v.toFixed(2),
      },
      {
        key: 'DEAL_MID_CLEAR_CHANCE',
        label: '中期清屏感概率',
        min: 0,
        max: 0.4,
        step: 0.01,
        format: (v) => v.toFixed(2),
      },
      {
        key: 'DEAL_LATE_INSTANT_MAX',
        label: '后期立刻可放数上限',
        min: 1,
        max: 2,
        step: 1,
        format: (v) => String(Math.round(v)),
      },
    ],
  },
  {
    group: '调试',
    items: [
      {
        key: 'SHOW_TRAY_ZONES',
        label: '显示三等分区',
        min: 0,
        max: 1,
        step: 1,
        format: (v) => (v >= 0.5 ? '开' : '关'),
      },
    ],
  },
  {
    group: '格缝',
    items: [
      {
        key: 'BOARD_CELL_INSET',
        label: '盘格内缩',
        min: 0.004,
        max: 0.04,
        step: 0.001,
        format: (v) => v.toFixed(3),
      },
      {
        key: 'TRAY_CELL_INSET',
        label: '摆放物内缩',
        min: 0.002,
        max: 0.03,
        step: 0.001,
        format: (v) => v.toFixed(3),
      },
    ],
  },
];
