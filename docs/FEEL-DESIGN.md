# 手感与反馈设计（问题 → 约束）

迭代踩坑沉淀。实现：`src/game/feel/*` · `view.js` · `feel-presets.js`。  
常量真源：`defaults.js`；运行时覆盖：`tune.js` + 调参面板。  
全景纪要：[PROJECT-HISTORY.md](./PROJECT-HISTORY.md) · 文档索引：[README.md](./README.md)。

---

## 1. 状态机（指针）

```
IDLE → PICKUP(固定槽姿态, 无投影, 无震动)
     → DRAGGING(指速积分 + 短平滑)
          ├ ghost null | valid hover（可 preclear 预警）
          └ pointerup → COMMIT(fits)
                ├ 无消线 → 计分 / 可能刷 tray
                └ 有消线 → clearFx 动画 + 消除震动 → clearLines → 计分
```

---

## 2. 问题 → 不变量（P1–P16 及续）

| ID | 现象 | 不变量 / 规则 |
|----|------|----------------|
| P1 | 一点击假合法 | 禁止为「整块入盘」硬钳 free；commit 仅 `grid.fits` |
| P2 | 非法红影/过实 | 合法才画 ghost；alpha 走 tune |
| P3 | 快滑不准 | 快：free 吸附；慢：edge hold |
| P4 | 块右影左 | free 远离 sticky → 强制 free |
| P5 | 影飞远处 | free 邻域；**影-free 切比雪夫 > `FEEL_GHOST_MAX_LAG`** → null |
| P6 | 横拖上下跳 | 近距轴锁；lag 大时双轴 |
| P7 | 拿起点乱跳 | 三区命中 + 槽中心固定抬升 |
| P8 | 介入时机 | 形状**最底一排**占格进盘才 engage |
| P9 | 震动乱/双下 | 换格瞬态 key+冷却；原生单脉冲直通 |
| P10 | 首启高度错 | stable layout + safe 探针 |
| P11 | 调参不生效 | 布局 rebuild / 手感 paint |
| P12 | WebGPU index | BufferGeometry + mesh clone；模板勿 dispose |
| P13 | 外框圆角过大 | 盘圆角 = 格圆角平行外扩 |
| P14 | 空格缝过大 | BOARD_CELL_INSET ≈ tray |
| P15 | 拖累/延迟 | 指速增益 + 短平滑 |
| P16 | Vite 500 | JSDoc 禁止嵌套 `/**` |
| **P17** | 消行整格消失/压暗 | 见 §3 盘面分层与消行视觉 |
| **P18** | 消行缩放无方向感 | 见 §3 单向扫序 + 同向旋转 |
| **P19** | 消除震动过碎/过单 | 见 §4 消除配方：1 瞬态 + 间隔 + 连续震 |
| **P20** | 真机要两套操作幅度 | 见 §5 手感1 / 手感2 预设 |

---

## 3. 盘面分层与消行视觉

### 3.1 问题（P17）

| 现象 | 原因 | 调整 |
|------|------|------|
| 消行时格子像「被藏掉」 | 空槽与填充互相 **replace**；缩填充时底下没有空格 | **空槽常驻**（`boardCells`），填充叠在上层（`boardFills`） |
| 消行压暗 | 动画里改 `opacity` 淡出 | **去掉压暗**；只缩 + 转 |
| 落子后盘面「变扁」 | `paintBoard` 整块改色抹掉 bevel 层 | 只动 transform / 不 recolor 多层材质 |
| 将消预警改全体样式 | 误给空槽/无关块上预警 | **仅已落子且在将消行/列** 的填充：小幅旋转 + scale 1.01 |

### 3.2 消行时序

1. `place` → `findFullLines`  
2. `clearFx = { lines, cells(delay01, spin), sweep, start, duration }`  
3. 每帧 `paintBoard` 按 delay 缩填充；空槽始终可见  
4. 动画结束 → `clearLines` → 计分 / tray  

视觉时长：`FEEL_CLEAR_MS`（与震动连续时长独立）。

### 3.3 缩放方向（P18）

- **一边 → 另一边**（非从落点双向扩散）。  
- 起点：本次落子质心更靠近哪条边  
  - 行：偏左 → 左→右；偏右 → 右→左  
  - 列：偏上 → 上→下；偏下 → 下→上  
- `delay01` 沿轴归一化 × `FEEL_CLEAR_STAGGER`  
- 单格收缩窗口：`FEEL_CLEAR_SHRINK`（固定短 span + ease-in）  
- **旋转**与扫过同向：`spin ±1` × ease × `clearSpinMax`（约 ±42°）  
- 行列交叉格：取 **较早一侧** 的 delay 与 spin  

实现：`game.js` `collectLineCells` · `view.js` `paintBoard`。

### 3.4 已移除

- 消行 opacity 压暗  
- 消行 burst 叠层（会盖住空槽）  
- 消行扫光条（曾实现，产品要求去掉）

---

## 4. 震动

### 4.1 分层

| 时机 | 类型 | 参数前缀 | 模块 |
|------|------|----------|------|
| 合法投影换格（无将消） | 瞬态 | `FEEL_HAPTIC_GHOST_*` | `onHover` |
| 投影到将消格 | 瞬态（更强） | `FEEL_HAPTIC_CLEAR_PREVIEW_*` | `onHover` |
| 确认消除（动画段） | **1 瞬态 + gap + 1 连续** | `FEEL_HAPTIC_CLEAR_FX_*` | `onClearFxStart` |

仅 **iOS 原生**；浏览器 `not_native_ios`。

### 4.2 消除配方（P19）

```
瞬态(TRANSIENT_I/S)
  → 等待 GAP_MS
  → startContinuous(START_I/S)
  → 时长 DURATION_MS 内线性插值到 END_I/S
  → stopContinuous
```

| 参数 | 含义 |
|------|------|
| `…_TRANSIENT_INTENSITY/SHARPNESS` | 第一记；强度 0 可关 |
| `…_GAP_MS` | 瞬态 → 连续的间隔 |
| `…_DURATION_MS` | 连续震长度；0 可关 |
| `…_START_*` / `…_END_*` | 连续起/末强度与锐度 |

- 连续时长 **独立于** `FEEL_CLEAR_MS` 视觉。  
- 重开 `onClearFxEnd` 强制 stop + 清定时器。  
- 历史弯路：多阶 delay 脉冲 → 仅 1 瞬态 → 仅 continuous → **现配方**。

### 4.3 换格去重

- key = `origin + willClear`  
- 冷却：`FEEL_HAPTIC_GHOST_COOLDOWN_MS`

实现：`feel/haptics-ghost.js` · 面板组「震动(投影/将消/消除)」。

---

## 5. 手感预设（P20）

| 槽 | 含义 | 出厂 |
|----|------|------|
| **手感1** | 游戏默认 / 当前标定 | `createDefaultTune()` ≡ `defaults.js` |
| **手感2** | 同底 + **更弱操作幅度**（截图标定） | 仅改抬升/跟手等 FEEL_DRAG_* / POINTER_* |

UI：左下角按钮（`feel-panel.js` + `.feel-preset-bar`）。

| 操作 | 行为 |
|------|------|
| 点击 | `applyFeelPreset(id)` + 高亮 |
| 长按 ≈0.5s | 把当前 tune 存入该槽（localStorage） |
| 面板「重置」 | 切回手感1 出厂 |

存储键版本：`bb_feel_preset_v3_*`（升版避免旧存档污染）。  
启动：`getActiveFeelPresetId()` 默认 **`'1'`**。

手感2 操作差异摘要（其余同手感1）：

| 键 | 手感2 |
|----|--------|
| OFFSET_Y_MIN/MAX | -2.5 / -2.5 |
| LIFT_TRAVEL | 1.0 |
| LIFT_POWER | 1.0 |
| GAIN_MIN/MAX | 0.9 / 1.6 |
| SPEED_REF | 6.0 |

实现：`src/game/feel-presets.js`。

---

## 6. 模块职责

| 模块 | 职责 |
|------|------|
| `feel/drag-session.js` | 拿起、指速增益、积分、平滑 |
| `feel/ghost-policy.js` | engage、free/sticky、快慢、轴锁、preclear |
| `feel/haptics-ghost.js` | 换格 + 消除震动曲线 |
| `feel-presets.js` | 手感1/2 工厂、存取、应用 |
| `feel-panel.js` | 滑条 + 预设按钮 + 重置 |
| `view.js` | 空槽/填充分层、将消预警、clear 缩转 |
| `game.js` | clearFx 编排、collectLineCells、指针 |

---

## 7. Ghost 策略摘要

1. `!isBoardEngaged(bottomRow)` → null  
2. `chebyshev(free, ghost) > FEEL_GHOST_MAX_LAG` → null  
3. `fast \|\| stickyLag 大` → free±1 吸附  
4. 慢近距 → open / edge hold（候选也须 ≤ maxLag）  
5. free 不可放或超 lag → null（**不**钳盘边救命）  

---

## 8. 调参

- 布局 key：`LAYOUT_TUNE_KEYS` → `relayout`  
- 其余：`setTune` + `paint`  
- 默认：`defaults.js`；手感1 出厂同步 defaults  
- 真机改满意后：**长按手感1** 可固化到本机槽（可选）

### 加大「操作幅度」优先项

| 滑条 | 方向 |
|------|------|
| 抬升拿起 / 远距上限 | 更负 |
| 上移满抬升格数 | 略减 → 更快满抬升 |
| 慢/快速跟手增益 | 加大 |
| 加速参考指速 | 略减 → 更容易进高速增益 |
| 拖拽平滑 | 略减 → 更跟手 |

---

## 9. 相关文件速查

```
src/game/defaults.js          # 常量真源
src/game/tune.js              # 运行时 + TUNE_FIELDS
src/game/feel-presets.js      # 手感1/2
src/game/feel/haptics-ghost.js
src/game/feel/ghost-policy.js
src/game/feel/drag-session.js
src/game/view.js              # boardCells + boardFills + clear 动画
src/game/game.js              # clearFx · collectLineCells
src/feel-panel.js
src/style.css                 # .feel-preset-bar
```
