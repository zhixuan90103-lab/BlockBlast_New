# 运行时 defaults 摘要

> ⚠️ **完整真源只有** `src/game/defaults.js`。  
> 本文只保留**易查摘要**；任何冲突以代码为准。  
> 同步日：**2026-07-31** · 手感说明 [FEEL-DESIGN.md](./FEEL-DESIGN.md) · 笔记 [PROJECT-HISTORY.md](./PROJECT-HISTORY.md) §13

## 规则

| 常量 | 值 |
|------|-----|
| `GRID` / `TRAY_SIZE` | 8 / 3 |
| `ROTATE` / `GRAVITY` | false |
| `COMBO_MODE` | `slide3` |
| `FIT_GUARANTEE` | true |

## 操作手感1（出厂 ≡ defaults）

| 常量 | 值 |
|------|-----|
| `FEEL_DRAG_OFFSET_Y_MIN` / `MAX` | −2.5 / −4.0 |
| `FEEL_DRAG_LIFT_TRAVEL_CELLS` / `POWER` | 4.5 / 1.75 |
| `FEEL_POINTER_GAIN_MODE` | 0（速度） |
| `FEEL_POINTER_GAIN_MIN` / `MAX` | 1.0 / **1.4** |
| `FEEL_POINTER_SPEED_REF` | 6 |
| `FEEL_SMOOTH_TIME` / `GAIN_SMOOTH_TIME` | 0.012 / 0.018 |

手感2：`MODE=1`，`GAIN_K=1.6`，抬升 −2.0 固定（见 `feel-presets.js`）。

## 震动（投影/将消/消除 · 真机面板 2026-07-31）

| 常量 | 值 |
|------|-----|
| `FEEL_HAPTIC_GHOST_INTENSITY` / `SHARPNESS` | **0.5** / **0.25** |
| `FEEL_HAPTIC_CLEAR_PREVIEW_*` | 0.7 / 0.3 |
| `FEEL_HAPTIC_CLEAR_FX_GAP_MS` | 30 |
| `FEEL_HAPTIC_CLEAR_FX_T1_INTENSITY` | 1.0 |
| `FEEL_HAPTIC_GHOST_COOLDOWN_MS` | **48** |
| 波3 连续 | 40ms · 0.25→0.1 · 锐 0.06→0 |

## 投影（设计见 [GHOST-DESIGN.md](./GHOST-DESIGN.md)）

| 常量 | 值 |
|------|-----|
| `FEEL_GHOST_MAX_LAG` | **1.3** |
| `FEEL_GHOST_OPEN_SNAP` | **0.30** |
| `FEEL_GHOST_SNAP_HYST` | **0.14**（居中防抖） |
| `FEEL_GHOST_FAST_SPEED_RATIO` | **0.38** |
| `FEEL_GHOST_EDGE_HOLD` | 1.3 |
| `FEEL_GHOST_ALPHA` | 0.15 |

## 布局 / tray

| 常量 | 值 | 备注 |
|------|-----|------|
| `FEEL_TRAY_SCALE` | 0.5 | 块格相对盘格 |
| `LAYOUT_TRAY_BAND_CELLS` | **7** | 区高；调参中心固定，见 `layout.js` |
| `LAYOUT_TRAY_SHIFT_Y` | **−0.01** | 区整体上下 |
| `LAYOUT_GAP_GRID_TRAY_CELLS` | 1.0 | 盘底→tray |
| `LAYOUT_BOARD_SHIFT_Y` | 0.035 | 棋盘下移 |
| `LAYOUT_GRID_MARGIN_X` | 0.05 | 左右边距 |
| `SHOW_TRAY_ZONES` | **false** | 三等分区外框 |

## 消行 / 屏震 / debris / 死亡

以 `defaults.js` 中 `FEEL_CLEAR_*` · `FEEL_HAPTIC_*` · `FEEL_DEATH_*` 为准；行为见 FEEL-DESIGN §3–§8。

## 改默认后

1. 改 `src/game/defaults.js`（及必要时 `feel-presets.js` 操作集）。  
2. 若预设存档污染：升 `feel-presets.js` 的 `PRESET_VER`。  
3. 更新 [PROJECT-HISTORY](./PROJECT-HISTORY.md) 对应节 + 本摘要关键行。  
4. **不要**再维护整文件 defaults 粘贴副本。  
