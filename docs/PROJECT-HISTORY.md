# Block Blast 项目实现与问题纪要

> 整理日期：2026-07-29  
> 范围：研究冻结 → DEFAULTS → M0–M2 实现 → 视觉/手感迭代 → feel 模块拆分  
> 工程根目录：`three-webgpu-cap-shell/`（Git：`zhixuan90103-lab/BlockBlast_New`）  
> 研究材料：仓库上级 `../research/`（多数不在 shell 的 git 内）

本文是**产品实现与踩坑全景**，与下列文档配合阅读：

| 文档 | 用途 |
|------|------|
| [FEEL-DESIGN.md](./FEEL-DESIGN.md) | 手感问题 → 不变量（P1–P16）速查 |
| [ENGINEERING.md](./ENGINEERING.md) | 底座、Capacitor、WebGPU、安全区 |
| [ENTRYPOINTS.md](./ENTRYPOINTS.md) | 命令与启动链 |
| `../research/DEFAULTS.md` 等 | 规则/手感冻结前的检索结论 |
| `src/game/defaults.js` | **运行时常量真源** |

---

## 1. 项目目标与边界

### 1.1 要做什么

- 复刻 **Hungry Studio《Block Blast!》Classic 模式** 的**操作手感与几何布局**，而非商业化完整产品。
- 技术路径：Three.js WebGPU + Vite + Capacitor iOS + 自研 Core Haptics。
- 流程：研究 → `DEFAULTS` → `IMPLEMENTATION-TODO` → 在 shell 内实现 M0–M2 → 对照正版截图/真机持续调手感。

### 1.2 明确不做 / 弱化

| 项 | 说明 |
|----|------|
| 商业化内容 | 商店、广告、账号、关卡运营 |
| 单独设备测量表 | 不维护「每台机一套表」；用 tune 面板真机调 |
| UI 装饰对齐 | 分数字号/图标等 chrome **忽略**；优先棋盘格缝、tray 比例、投影、拖拽 |
| 旋转 / 重力 | Classic：无旋转、无重力下落 |
| 远程测量 | 手感靠主观 + 正版对照，不靠自动录制 |

### 1.3 规则快照（已实现）

| 规则 | 值 |
|------|-----|
| 棋盘 | 8×8 |
| Tray | 3 槽，用尽再刷 |
| 形状 | Kefrov 系矩阵族 + 概率 |
| 旋转 | 否 |
| 重力 | 否 |
| Combo | slide3（连续消线递进） |
| 可放置保证 | `FIT_GUARANTEE = true`（刷新保证至少有一块可放） |
| 计分 | 每格 + 消线 + 全清 +300 |

---

## 2. 里程碑与实现现状

| 阶段 | 内容 | 状态 |
|------|------|------|
| 研究 | 开源对照（Kefrov/Blast 等）、规则/手感/计分文档 | 冻结 |
| M0 | `src/game/*` 骨架、layout、空盘+tray 渲染 | ✅ |
| M1 | 拾取/拖放/ghost/preclear/commit/reject/消行/刷 tray | ✅ |
| M2 | 完整 grid/score/pieces、game over | ✅ |
| 视觉对齐 | 紫底糖果色、圆角块、格缝、盘框外扩圆角 | ✅ 迭代中 |
| 手感对齐 | 槽固定拿起、指速增益、双模 ghost、底排 engage、haptics | ✅ 迭代中 |
| Feel 拆分 | `feel/drag-session` · `ghost-policy` · `haptics-ghost` | ✅ |
| 收尾项 | 魔法数命名常量、单测、refactor 提交推送 | 部分未做 |

### 2.1 代码架构（当前）

```
src/
  main.js                 # boot：viewport + createGame + feel-panel
  create-renderer.js      # WebGPURenderer
  viewport.js             # 设计尺寸、safe 探针、scheduleStableLayout
  native-haptics.js       # 震动桥（无业务曲线）
  feel-panel.js           # 真机调参：布局 rebuild / 手感 paint
  game/
    game.js               # 编排：规则循环、指针、commit（~460 行级）
    defaults.js           # 常量真源
    tune.js               # 运行时覆盖
    feel/
      drag-session.js     # 拿起、指速增益、位移积分、短平滑
      ghost-policy.js     # engage、free±1、快/慢模、轴锁
      haptics-ghost.js    # 合法投影换格震动
    grid.js · forms.js · pieces.js · score.js
    layout.js · view.js · block-mesh.js
plugins/native-haptics/   # Swift 真源；bootstrap 注入 iOS
```

**职责边界：**

- `game.js`：状态与事件编排，不堆投影公式。
- `feel/*`：可单测的手感策略，不碰 mesh 创建。
- `view.js` / `block-mesh.js`：几何与材质；圆角用 **BufferGeometry + mesh clone**，不用 ShapeGeometry 当 WebGPU 索引源。
- `defaults.js` ↔ `tune.js` ↔ `feel-panel.js`：一处默认、运行时覆盖、面板重置回真源。

---

## 3. 问题全表（现象 → 原因 → 调整）

下列与 `FEEL-DESIGN.md` 的 P1–P16 对齐，并补充工程类问题。

### 3.1 放置与投影合法性

| ID | 现象 | 原因 / 错误方向 | 调整 |
|----|------|-----------------|------|
| P1 | 一点击就出现「假合法」落点 | 为让整块入盘硬钳 free 原点；commit 与显示不一致 | **禁止**为入盘硬钳 free；commit **仅** `grid.fits`；非法不显示 ghost |
| P2 | 非法红影或半透过实 | 曾显示非法 ghost；alpha 0.35 太重 | 合法才画；`FEEL_GHOST_ALPHA = 0.15` |
| P5 | 投影「飞」到远处格子 | 远距 sticky / 螺旋搜索找最近可放格 | free 搜索半径 **≤1 格**；不可放 → `null`，不远距吸格 |
| P4 | 块在右边、影还在左边 | free 已远离仍粘旧 sticky | free 远离 sticky → **强制 free**；禁止退回远 sticky |
| P8 | 块刚离 tray 就出投影 | 介入过早 | **形状最底一排**占格与棋盘重叠才 engage；`FEEL_BOARD_ENGAGE_OVERLAP` 默认 0（一进即显） |

### 3.2 快慢双模与贴边

| ID | 现象 | 原因 | 调整 |
|----|------|------|------|
| P3 | 快滑不准 / 慢滑乱跳 | 单一阈值无法兼顾 | **快**：free 吸附；**慢**：edge hold |
| — | 贴边误滑 | 开阔区与边缘同阈值 | `FEEL_GHOST_OPEN_SNAP = 0.5`；`FEEL_GHOST_EDGE_HOLD`：1.5 → **1.3**（更跟手） |
| — | 快/慢切换抖 | 阈值无滞回 | `FEEL_GHOST_FAST_SPEED_RATIO` / `EXIT_RATIO`（0.45 / 0.55） |
| P6 | 横拖时投影上下跳 | 竖直噪声进换格 | `FEEL_AXIS_DOMINANCE` 近距轴锁；lag 大时双轴 |

**仍偏魔法的内部阈值（ghost-policy）：** lag≈1.15 走 free、0.95 粘滞区、1.25 双轴等——拆模块后尚未全部提升为命名导出常量。

### 3.3 拿起与拖拽跟手

| ID | 现象 | 原因 | 调整 |
|----|------|------|------|
| P7 | 点 tray 不同位置，块跳到不同处 | 跟指尖抬升 | **三等分区**命中槽；拿起姿态固定在**槽中心 + 固定上抬**（board 格尺寸） |
| — | 曾调试显示 hit 区/方块 | 临时可视化 | 调完后关闭 |
| P15 | 大范围拖手指累、跟手延迟 | 1:1 跟手 + 过长平滑 | **指速增益**（smoothstep：min 1.0 → max 1.75，`SPEED_REF=7`）；`FEEL_SMOOTH_TIME=0.012`，`GAIN_SMOOTH=0.018` |
| — | 抬升曲线 | 线性不够「弹」 | `FEEL_DRAG_LIFT_POWER=1.5`，travel 2.2 cell 到 max offset |

### 3.4 震动

| ID | 现象 | 原因 | 调整 |
|----|------|------|------|
| P9 | 乱震 / 一下两下 | 多处触发；强度曲线二次脉冲 | **仅合法 ghost 换格**瞬态；`key + cooldown(108ms)`；原生 **单脉冲**；JS 只做 clamp01 直通 intensity/sharpness |
| — | 面板 boost 想加强却变双脉冲 | 插件侧二次映射 | 去掉 boost 双脉冲逻辑，面板只调强度参数 |

默认：`FEEL_HAPTIC_GHOST_INTENSITY=0.6`，`SHARPNESS=0.2`。

### 3.5 布局与首帧

| ID | 现象 | 原因 | 调整 |
|----|------|------|------|
| P10 | 首启棋盘高度/位置错 | safe-area 未稳定就 layout | `viewport`：**safe 探针** + `scheduleStableLayout` |
| P11 | 面板改布局参数不生效 | 只 paint 不重建 | `LAYOUT_TUNE_KEYS` → **relayout**；手感参数 → setTune + paint |
| P14 | 空格缝比摆放物粗 | 盘 inset 与 tray 不一致 | `BOARD_CELL_INSET = TRAY_CELL_INSET = 0.004` |
| P13 | 外框圆角相对格过大 | 框与格独立圆角 | 盘圆角 = 格圆角**平行外扩** |
| — | 盘/tray 垂直位置 | 截图对齐 | `LAYOUT_BOARD_SHIFT_Y=0.035` 等；tray gap 1.0 cell |

### 3.6 渲染与工程

| ID | 现象 | 原因 | 调整 |
|----|------|------|------|
| P12 | WebGPU `setIndexBuffer` 报错 | ShapeGeometry / 错误索引路径 | **圆角 BufferGeometry**；拖影/落子用 **mesh.clone**；模板几何勿 dispose |
| P16 | Vite dev 500 | JSDoc 嵌套 `/**` | 禁止嵌套块注释 |
| — | Capacitor 资源路径 | `base: '/'` | Vite `base: './'` |
| — | 双安全区黑边 | `contentInset: automatic` | `ios.contentInset: never`，safe 只走 CSS |
| — | 插件改完真机无更新 | 只改了 ios 副本 | 改 `plugins/native-haptics/*` 后 `ios:bootstrap` / `cap:sync` |

### 3.7 视觉主题

| 现象 | 调整 |
|------|------|
| 早期木纹/中性色不够像正版 | 紫底糖果：`COLOR.bg/boardFill/cellEmpty` + 高饱和块色 |
| 块直角 | `block-mesh` 圆角克隆 |

---

## 4. 关键手感默认值摘要

真源：`src/game/defaults.js`（面板「重置」读同一处）。

### 4.1 拖拽

| 常量 | 值 | 含义 |
|------|-----|------|
| `FEEL_DRAG_OFFSET_Y_MIN/MAX` | -2.5 / -3.1 | 槽中心固定上抬（cell） |
| `FEEL_DRAG_LIFT_TRAVEL_CELLS` | 2.2 | 上移多少格叠到 max 抬升 |
| `FEEL_DRAG_LIFT_POWER` | 1.5 | 抬升曲线幂 |
| `FEEL_POINTER_GAIN_MIN/MAX` | 1.0 / 1.75 | 慢精 / 快远 |
| `FEEL_POINTER_SPEED_REF` | 7 | 格/秒，近 max 增益 |
| `FEEL_SMOOTH_TIME` | 0.012 | 位置平滑（秒） |
| `FEEL_GAIN_SMOOTH_TIME` | 0.018 | 增益平滑（秒） |
| `FEEL_TRAY_SCALE` | 0.5 | tray 相对盘格 |
| `FEEL_GHOST_ALPHA` | 0.15 | 合法投影透明度 |

### 4.2 投影

| 常量 | 值 |
|------|-----|
| `FEEL_GHOST_OPEN_SNAP` | 0.5 |
| `FEEL_GHOST_EDGE_HOLD` | 1.3 |
| `FEEL_GHOST_FAST_SPEED_RATIO` | 0.45 |
| `FEEL_GHOST_FAST_EXIT_RATIO` | 0.55 |
| `FEEL_AXIS_DOMINANCE` | 0.05 |
| `FEEL_SNAP_ONLY_VALID` | true |
| `FEEL_BOARD_ENGAGE_OVERLAP` | 0 |

### 4.3 Ghost 决策序（实现语义）

1. 未底排 engage → 无 ghost  
2. `fast || lag > ~1.15` → `hoverFreeSnap`（仅 free±1 合法格）  
3. 慢且近 → open 0.5 / edge 1.3 步进粘滞  
4. free 不可放 → null（不远距搜）  
5. 换合法格 → haptics 一次（冷却内去重）

### 4.4 布局

| 常量 | 值 |
|------|-----|
| `LAYOUT_GRID_MARGIN_X` | 0.05 |
| `LAYOUT_BOARD_SHIFT_Y` | 0.035 |
| `LAYOUT_TRAY_SHIFT_Y` | 0 |
| `LAYOUT_GAP_GRID_TRAY_CELLS` | 1.0 |
| `BOARD_CELL_INSET` / `TRAY_CELL_INSET` | 0.004 |

---

## 5. 状态机（指针）

```
IDLE
  → PICKUP（固定槽姿态；无投影；无震动）
  → DRAGGING（指速积分位移 + 短平滑）
       ├ ghost = null | valid hover（可 preclear）
       └ pointerup → COMMIT(fits) | REJECT（回 tray）
```

非法路径：**永不**把无效格画成可放；commit 与 ghost 同源合法条件。

---

## 6. 日常命令

```bash
cd three-webgpu-cap-shell
npm install
npm run dev              # http://127.0.0.1:5190/
npm run cap:sync         # build + 同步 iOS（口语「打包」常指这个）
npm run ios:bootstrap    # 首次/修复 iOS + 注入 NativeHaptics
npm run cap:open         # Xcode
```

Git 远程（历史会话约定）：`zhixuan90103-lab/BlockBlast_New`。

---

## 7. 决策日志（按主题）

| 决策 | 选择 | 理由 |
|------|------|------|
| 工程位置 | 在 cap-shell 内写 `src/game` | 复用 renderer/viewport/haptics |
| 渲染 | 正交 2D 网格 + Mesh | 手感优先，不依赖 3D 玩法 |
| 常量 | `defaults.js` 单真源 | 面板重置、文档、代码一致 |
| Ghost | 仅合法 + free±1 + 双模 | 对齐正版「不准假落、快跟慢粘」 |
| 拿起 | 槽固定姿态 | 对齐正版 tray，避免点击点偏移 |
| 震动 | 仅 ghost 换格 | 避免落子/拖动噪音 |
| UI | 忽略 chrome | 先几何与操作 |
| Feel 拆分 | 三文件 + 瘦 game.js | 可维护、可测；用户曾误触「洁癖大重构」计划后改走实用拆分 |

---

## 8. 已知未完成 / 后续

1. **魔法数导出**：ghost 内部 lag 阈值等 → 命名常量 + 可选进 tune 面板。  
2. **单测**：`ghost-policy` / `drag-session` 纯函数测例。  
3. **Git**：feel 拆分 + EDGE_HOLD 1.3 + 最新 defaults 若有未推送提交需整理。  
4. **反馈层**：消行飞散、SFX 等 M3 类体验（清行逻辑已有，特效可加强）。  
5. **文档同步**：research 与 shell 的 DEFAULTS 若有漂移，以 `defaults.js` 为准回写 research。

---

## 9. NotebookLM 使用说明

**统一笔记：** [Block Blast](https://notebooklm.google.com/)（ID `8ca93db7-f307-46f2-8949-a4fce2447e38`）  
**去噪目录：** `research/NLM-SOURCE-CATALOG.md`（标题前缀 A/B/C 表示权重）

冲突裁决：手感/当前行为 → PROJECT-HISTORY + FEEL-DESIGN + RUNTIME-DEFAULTS；规则证据 → SOURCES-EFFECTIVE + 开源 raw；研究 vs runtime → **runtime**。

问答提示：

- 「为什么投影不能远吸？」→ P5 / 第 3.1 节  
- 「拖累改哪个参数？」→ 第 4.1 增益与平滑  
- 「震动为什么两下？」→ P9  
- 「模块怎么分的？」→ 第 2.1 节  

---

## 10. 相关路径速查

| 路径 | 说明 |
|------|------|
| `src/game/defaults.js` | 规则 + FEEL + LAYOUT + COLOR |
| `src/game/tune.js` | 运行时覆盖与 LAYOUT 键列表 |
| `src/feel-panel.js` | 移动端调参 UI |
| `src/game/feel/*` | 手感策略 |
| `src/game/game.js` | 编排 |
| `src/viewport.js` | 稳定布局 / safe |
| `plugins/native-haptics/` | iOS 震动真源 |
| `../research/` | 立项研究文档集 |
