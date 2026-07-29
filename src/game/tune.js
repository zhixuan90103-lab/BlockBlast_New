/**
 * 运行时可调手感/布局参数（默认来自 defaults.js）。
 * 调参面板读写本模块；layout / game / view 通过 getTune() 读取。
 */
import * as D from './defaults.js';

/** @typedef {ReturnType<typeof createDefaultTune>} TuneState */

function createDefaultTune() {
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
    FEEL_DRAG_FOLLOW_GAIN_MAX: D.FEEL_DRAG_FOLLOW_GAIN_MAX,
    FEEL_BOARD_ENGAGE_OVERLAP: D.FEEL_BOARD_ENGAGE_OVERLAP,
    FEEL_HAPTIC_GHOST_INTENSITY: D.FEEL_HAPTIC_GHOST_INTENSITY,
    FEEL_HAPTIC_GHOST_SHARPNESS: D.FEEL_HAPTIC_GHOST_SHARPNESS,
    FEEL_HAPTIC_GHOST_COOLDOWN_MS: D.FEEL_HAPTIC_GHOST_COOLDOWN_MS,
    FEEL_GHOST_ALPHA: D.FEEL_GHOST_ALPHA,
    FEEL_GHOST_OPEN_SNAP: D.FEEL_GHOST_OPEN_SNAP,
    FEEL_GHOST_EDGE_HOLD: D.FEEL_GHOST_EDGE_HOLD,
    FEEL_AXIS_DOMINANCE: D.FEEL_AXIS_DOMINANCE,
    /** 显示 tray 三等分区 */
    SHOW_TRAY_ZONES: D.SHOW_TRAY_ZONES,
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
 * @param {Partial<TuneState>} partial
 */
export function setTune(partial) {
  Object.assign(tune, partial);
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
        key: 'FEEL_DRAG_FOLLOW_GAIN_MAX',
        label: '远距跟手增益',
        min: 1,
        max: 1.3,
        step: 0.01,
        format: (v) => v.toFixed(2),
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
    group: '震动(投影换格)',
    items: [
      {
        key: 'FEEL_HAPTIC_GHOST_INTENSITY',
        label: '瞬态强度',
        min: 0,
        max: 1,
        step: 0.05,
        format: (v) => v.toFixed(2),
      },
      {
        key: 'FEEL_HAPTIC_GHOST_SHARPNESS',
        label: '瞬态锐度',
        min: 0,
        max: 1,
        step: 0.05,
        format: (v) => v.toFixed(2),
      },
      {
        key: 'FEEL_HAPTIC_GHOST_COOLDOWN_MS',
        label: '去重冷却ms',
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
        label: '边缘粘滞阈值',
        min: 0.5,
        max: 2.5,
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
