# 运行时 defaults.js 快照

> ⚠️ **摘录可能滞后。** 任何冲突以 `src/game/defaults.js` 为准。  
> 手感/消行/震动说明见 [FEEL-DESIGN.md](./FEEL-DESIGN.md)；文档索引 [README.md](./README.md)。  
> 生成日 2026-07-29（后续改 defaults 后请择机同步本节，或只保留本警告）。

```js
/**
 * 实现真源常量 — research/DEFAULTS.md + 视觉对齐正版（木纹 / 立体块）。
 */

// —— 规则 ——
export const GRID = 8;
export const TRAY_SIZE = 3;
export const ROTATE = false;
export const GRAVITY = false;

/** @typedef {'slide3' | 'tray'} ComboMode */
export const COMBO_MODE = /** @type {ComboMode} */ ('slide3');
export const MAX_WITHOUT_CLEAR = 3;
export const COMBO_INCREMENT = /** @type {1 | 'lines'} */ (1);

export const SCORE_PER_CELL = 1;
export const SCORE_LINE_BASE = 10;
export const SCORE_ALL_CLEAR = 300;

export const FIT_GUARANTEE = true;

// —— 手感 FEEL_* ——
/**
 * 正版 tray 手感：
 * - 底栏 **三等分区**，区内任意点点中该区块
 * - 拿起：固定 **board 格尺寸** + 相对 **槽中心** 的固定抬升位置（与点击落点无关）
 * - 再拖：相对拿起时的指针位移跟手；上移可再加大抬升
 * - 与盘重叠够才出投影
 * 单位：board cell；Y 向下为正时 offset 为负。
 */
/** 拿起时块中心相对槽中心的上抬（固定姿态，不跟指尖） */
export const FEEL_DRAG_OFFSET_Y_MIN = -2.5;
/** 大幅上移后再略抬（相对拿起姿态额外上抬量叠到 MAX） */
export const FEEL_DRAG_OFFSET_Y_MAX = -3.1;
/** 兼容旧名 */
export const FEEL_DRAG_OFFSET_Y = FEEL_DRAG_OFFSET_Y_MAX;
export const FEEL_DRAG_OFFSET_Y_ALT = -2.5;
export const FEEL_DRAG_OFFSET_X = 0;
/**
 * 自拿起点「向上」移动达到该格数时抬升到 MAX。
 */
export const FEEL_DRAG_LIFT_TRAVEL_CELLS = 2.2;
/** 抬升曲线幂（真机调参） */
export const FEEL_DRAG_LIFT_POWER = 1.5;
/**
 * 触控跟手增益（借鉴 macOS 指针加速思想：慢精、快远）
 * 按「指速 cells/s」映射，积分位移，减轻大范围拖动手指行程。
 */
/** 慢速时增益（真机调参） */
export const FEEL_POINTER_GAIN_MIN = 1.0;
/** 快速时增益（真机调参） */
export const FEEL_POINTER_GAIN_MAX = 1.75;
/**
 * 指速参考（格/秒）：达到此速度附近增益接近 MAX。
 */
export const FEEL_POINTER_SPEED_REF = 7;
/** @deprecated 兼容旧名：等同快速增益 */
export const FEEL_DRAG_FOLLOW_GAIN_MAX = FEEL_POINTER_GAIN_MAX;
/**
 * 投影介入：形状最底一排占格与棋盘有重叠即显示 ghost。
 * 保留该常量供调参；默认 0 = 只要进入立刻显示。
 */
export const FEEL_BOARD_ENGAGE_OVERLAP = 0;

/** 投影换格瞬态震动（iOS Core Haptics playTransient）— 真机调参 */
export const FEEL_HAPTIC_GHOST_INTENSITY = 0.6;
export const FEEL_HAPTIC_GHOST_SHARPNESS = 0.2;
/** 同一/连发去重冷却（ms） */
export const FEEL_HAPTIC_GHOST_COOLDOWN_MS = 108;
/**
 * tray 内单格边长 / 棋盘单格边长。
 * 正版底栏 ≈ 0.50；拖起后 1.0。
 */
export const FEEL_TRAY_SCALE = 0.5;
export const FEEL_BOARD_SCALE = 1.0;
/** 拖起额外放大；正版与盘格 1:1，不额外 pop */
export const FEEL_DRAG_SCALE_POP = 1.0;
export const FEEL_FOLLOW = 1;
/**
 * 拖拽视觉平滑时间常数（秒）。指数趋近目标位置。
 * 0 = 无延迟直跟；略 >0 减抖。过大 → 拖影延迟感。
 */
export const FEEL_SMOOTH_TIME = 0.012;
/** 指速增益自身再平滑（秒）；过大会让加速「慢半拍」 */
export const FEEL_GAIN_SMOOTH_TIME = 0.018;
// 上两项与真机面板一致：短平滑、跟手优先
/** 合法投影：本色半透；非法不显示投影 */
export const FEEL_GHOST_ALPHA = 0.15;
/**
 * 开阔区投影换格阈值（格）。相邻方向仍可放置 → 约 0.5 即跟手。
 */
export const FEEL_GHOST_OPEN_SNAP = 0.5;
/**
 * 边缘区慢速粘滞阈值（格）。
 * 仅「慢速 + 朝不可放方向」时使用，防贴边误滑；快速时不生效。
 */
export const FEEL_GHOST_EDGE_HOLD = 1.3;
/**
 * 指速 ≥ 参考指速 × 该系数 → 投影进入「快速精准」模式（free 吸附，不贴边 1.5）。
 * 慢下来后回到边缘粘滞。
 */
export const FEEL_GHOST_FAST_SPEED_RATIO = 0.45;
/**
 * 快速模式退出滞回：指速 < 进入阈值 × 该系数才回慢速贴边。
 */
export const FEEL_GHOST_FAST_EXIT_RATIO = 0.55;
/**
 * 轴向主导：|Δ横| 与 |Δ竖| 差超过该值（格）才锁定主轴，
 * 避免横向拖时竖直噪声让投影上下跳。
 */
export const FEEL_AXIS_DOMINANCE = 0.05;
export const FEEL_DRAG_ALPHA = 0.95;
export const FEEL_PRECLEAR_HIGHLIGHT = true;
/** true：仅合法可 commit；非法不显示投影；换格用 open/edge 双阈值 */
export const FEEL_SNAP_ONLY_VALID = true;
export const FEEL_COMMIT_MS = 90;
export const FEEL_REJECT_MS = 180;
export const FEEL_CLEAR_MS = 160;
export const FEEL_INPUT_LOCK_MS = 150;
export const FEEL_HIT_SLOP = 0.2;
export const FEEL_PICKUP_SCALE_MS = 100;
export const FEEL_REFILL_STAGGER_MS = 40;

// —— 布局 / 格子几何（对齐正版重点）——
/**
 * 棋盘格「内容」相对 pitch 的单侧内缩。
 * 缝宽 = 2 * inset * cell。正版细槽 ≈ 1.2%–2% 单侧。
 * 只影响棋盘；tray 另议。
 */
/**
 * 盘面格缝（单侧 / pitch）。与 tray 对齐，避免空格缝看起来比摆放物粗。
 * 缝宽 ≈ 2 * inset * cell。
 */
export const BOARD_CELL_INSET = 0.004;
/**
 * tray 摆放物内部格缝（单侧 / pitch）。
 */
export const TRAY_CELL_INSET = 0.004;

/**
 * 布局比例（对齐正版竖屏截图，相对 frame / 盘格）：
 * - 棋盘左右约 5% 边距，水平居中
 * - 顶：分数/combo 区 + 小间隙
 * - 盘底 → tray 块顶：约 1.0 board cell
 * - tray 块带高度约 3.2×trayCell，底部留 home/广告呼吸
 */
/** 棋盘左右边距 / frame 宽（不含 safe）。正版约 5% 侧 */
export const LAYOUT_GRID_MARGIN_X = 0.05;
/** 分数区下沿到棋盘顶 / frame 高 */
export const LAYOUT_GRID_TOP_GAP = 0.018;
/** 顶部分数占位 / frame 高（几何空间，非 UI 样式） */
export const LAYOUT_HUD_SCORE_H = 0.11;
/**
 * 棋盘垂直偏移 / frame 高（+ 下移）。
 * 真机调参：0.035。
 */
export const LAYOUT_BOARD_SHIFT_Y = 0.035;
/**
 * tray 相对「盘底+间距」再偏移 / frame 高（+ 下移）。
 * 真机调参：0。
 */
export const LAYOUT_TRAY_SHIFT_Y = 0;
/**
 * 棋盘底边 → tray 摆放物「顶」的间距，单位：board cell。
 * 正版约 0.8–1.2，取 1.0。
 */
export const LAYOUT_GAP_GRID_TRAY_CELLS = 1.0;
/** tray 内容带高度系数 × trayCell（需容纳约 3 格高形状 + 少量气口） */
export const LAYOUT_TRAY_BAND_CELLS = 3.2;
/** 底边额外呼吸 / frame 高（safe.bottom 另加） */
export const LAYOUT_PAD_BOTTOM_EXTRA = 0.04;
/** tray 单槽可容纳的最大形状边长（格数），I5=5 */
export const TRAY_SLOT_CELLS = 5;

// —— 视觉：对齐正版紫底糖果（参考官方截图）——
export const COLOR = {
  /** 桌面紫渐变偏中 */
  bg: 0x6b5bdb,
  bgDeep: 0x4a3bb5,
  /** 棋盘深蓝紫 */
  boardFill: 0x241f52,
  boardFrame: 0x8b7cf0,
  boardFrameDark: 0x5a4fc4,
  /**
   * 空格：与盘底对比更强（深描边 + 中亮槽 + 内凹）
   */
  cellEmpty: 0x4a4499,
  cellEmptyStroke: 0x15122e,
  cellEmptyInner: 0x3a3480,
  /** tray 区（与桌面融合，几乎无框） */
  traySlot: 0x5c4ecf,
  traySlotStroke: 0x4a3bb5,
  /** 预亮 */
  preclear: 0xffe566,
  /** UI */
  accent: 0xff6bcb,
  text: 0xffffff,
};

/** 正版糖果色（高饱和、偏亮） */
export const PIECE_PALETTE = [
  0x4da3ff, // blue
  0xffd54a, // yellow / gold
  0xa78bfa, // soft purple
  0xff9f43, // orange
  0xff5c5c, // red
  0x4ade80, // green
  0x3dceff, // cyan / sky（截图拖中块）
  0x60a5fa, // light blue
  0xfbbf24, // amber
  0xf472b6, // pink
];

/** 调试状态默认隐藏（?debug=1 显示） */
export const SHOW_DEBUG_STATUS =
  typeof location !== 'undefined' &&
  /(?:\?|&)debug=1(?:&|$)/.test(location.search || '');

/** 显示底栏三等分点击区（调试用，默认关） */
export const SHOW_TRAY_ZONES = false;
```
