# Block Blast 项目实现与问题纪要

> 整理日期：**2026-07-31**（续 **§16**）  
> 范围：… → 投影 → **Bug/补丁→设计重构总结**  


> 工程根目录：`three-webgpu-cap-shell/`（Git：`zhixuan90103-lab/BlockBlast_New`）  
> 研究材料：仓库上级 `../research/`（多数不在 shell 的 git 内）

本文是**产品实现与踩坑全景（项目笔记）**，与下列文档配合阅读：

| 文档 | 用途 |
|------|------|
| [README.md](./README.md) | **文档索引与规范** |
| [FEEL-DESIGN.md](./FEEL-DESIGN.md) | 手感问题 → 不变量（P1–P24，含消行/震动/死亡/布局区） |
| [GHOST-DESIGN.md](./GHOST-DESIGN.md) | **投影 SSOT**（跟本体 · 卡边 · 斜向） |
| [DEAL-PUSH-COMPLETE.md](./DEAL-PUSH-COMPLETE.md) | **发块完整规格 SSOT** |
| [DEAL-DESIGN.md](./DEAL-DESIGN.md) | 发块短摘要（指针） |
| [ENGINEERING.md](./ENGINEERING.md) | 底座、Capacitor、WebGPU、安全区 |
| [ENTRYPOINTS.md](./ENTRYPOINTS.md) | 命令与启动链 · DOM |
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
  feel-panel.js           # 调参滑条 + 手感1/2 快捷切换
  game/
    game.js               # 编排：指针、commit、clearFx
    defaults.js           # 常量真源
    tune.js               # 运行时覆盖 + TUNE_FIELDS
    feel-presets.js       # 手感1/2 工厂与 localStorage
    feel/
      drag-session.js     # 拿起、指速增益、位移积分、短平滑
      ghost-policy.js     # engage、free±1、快/慢模、轴锁、preclear
      haptics-ghost.js    # 换格 + 消除 3 波 T–C
    deal/                 # Intent 管线、局面、阶段节奏（见 DEAL-PUSH-COMPLETE）
    grid.js · forms.js · pieces.js · score.js
    layout.js · view.js · block-mesh.js
plugins/native-haptics/   # Swift 真源；bootstrap 注入 iOS
assets/icon-1024.png      # 扁平 App Icon 源图
docs/                     # 见 docs/README.md 索引
```

**职责边界：**

- `game.js`：状态与事件编排（含 clearFx / deathFx），不堆投影公式。
- `feel/*`：可单测的手感策略，不碰 mesh 创建。
- `view.js`：空槽常驻 + 填充层 + 消行缩转 + debris + 屏震；`block-mesh` 圆角 **共享 BufferGeometry** + **filled/ghost/debris 对象池**（见 §14）。
- `defaults.js` ↔ `tune.js` ↔ `feel-panel` / `feel-presets`：一处默认、运行时覆盖、预设槽。

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
3. **反馈层**：消行 SFX、更丰富粒子等（视觉缩转 + 震动配方已落地）。  
4. **文档同步**：`RUNTIME-DEFAULTS.md` 易滞后；以 `defaults.js` 为准。  
5. **research/**：上级研究材料不在 shell git 内，结论以代码与本 HISTORY 为准。

---

## 9. 消行反馈 · 震动 · 预设（2026-07-29 迭代）

对应 commit 主题：`feat: clear cascade feel, haptics recipe, and feel presets`（`0a98709` 及后续微调）。  
设计细则：[FEEL-DESIGN.md](./FEEL-DESIGN.md) §3–§5。

### 9.1 问题 → 修改

| 现象 | 原因 | 修改 |
|------|------|------|
| 消行压暗 | opacity 随 t 淡出 | 去掉压暗，只缩+转 |
| 消行时空格消失 | filled 替换 empty，无底层空槽 | `boardCells` 常驻空槽 + `boardFills` 上层填充 |
| 缩时像整格隐藏 | 同上 + 曾叠 burst | 去掉 burst；缩填充露空槽 |
| 缩放无顺序 | 全体同 t 缩 | 按落子质心决定**一边→另一边** delay |
| 缺旋转感 | 仅 wobble | 与扫过同向 spin，峰值约 ±42° |
| 曾加扫光 | 产品不要 | 已移除扫光 |
| 消除震过多/过单 | 阶梯脉冲 / 仅瞬态 / 仅 continuous | 当时定为 **1 瞬态 + GAP + 连续**；后扩展为 **3 波**（见 §12） |
| 将消 vs 普通换格无差 | 同强度 | PREVIEW 与 GHOST 分参（面板可调） |
| 要两套操作幅度 | 单 defaults | **手感1/2** 左下角切换；默认手感1 |
| 落子改色变扁 | 整块 recolor | 不碰 bevel 层 color |

### 9.2 架构补充

```
view.js
  boardCells  → 8×8 空槽（rebuild 后常驻）
  boardFills  → 有子时叠在空槽上；clear 只动 fill

game.js
  clearFx → collectLineCells(delay01, spin) + sweep 方向元数据
  finishClearFx → clearLines + 计分

haptics-ghost.js
  onHover(换格/将消) · onClearFxStart(消除配方) · onClearFxEnd

feel-presets.js
  手感1 = defaults · 手感2 = 同底 + 截图操作幅度
```

### 9.3 震动默认（§9 当时为 1T+1C；**现行 3 波见 §12**）

| 项 | §9 约值（历史） |
|----|------|
| 普通挪格 I/S | 0.70 / 0.20 → 后改为 **0.45 / 0.25** |
| 将消格 I/S | 0.80 / 0.30 → 后改为 **0.70 / 0.30** |
| 消除 | 当时 **1 瞬态 + GAP + 1 连续**；后扩展为 **3×(T+C)**（§12） |

### 9.4 手感2 操作差异（其余 = 手感1）

| 键 | 手感2 |
|----|--------|
| OFFSET_Y_MIN/MAX | -2.5 / -2.5 |
| LIFT_TRAVEL / POWER | 1.0 / 1.0 |
| GAIN_MIN/MAX | 0.9 / 1.6 |
| SPEED_REF | 6.0 |

### 9.5 决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 空槽 | 常驻底层 | 消行可读、无「格子没了」 |
| 消行方向 | 单轴一边到另一边 | 对齐「扫过」体感，非径向爆炸 |
| 消除震 | 瞬态+连续配方（后→3 波） | 既有确认点又有长度；参数全进面板 |
| 预设 | 手感1 默认 | 标定真源在 defaults；手感2 对比幅度 |

---

## 10. NotebookLM 使用说明

**统一笔记：** [Block Blast](https://notebooklm.google.com/notebook/8ca93db7-f307-46f2-8949-a4fce2447e38)（ID `8ca93db7-f307-46f2-8949-a4fce2447e38`）  
**去噪目录：** `research/NLM-SOURCE-CATALOG.md`（标题前缀 A/B/C 表示权重）

### 冲突裁决

| 问题类型 | 优先资料 |
|----------|----------|
| 手感 / 消行 / 震动 / 死亡 / 预设（当前行为） | **带日期的新版** FEEL-DESIGN · PROJECT-HISTORY **§12** · Note「迭代纪要」 |
| 发块 / 局面 / Intent | **DEAL-PUSH-COMPLETE** + 代码 `deal/*` |
| 常量数值 | 代码 `defaults.js`（RUNTIME-DEFAULTS 可能滞后） |
| 规则证据 / 开源对照 | A · rules / scoring / SOURCES-EFFECTIVE + 开源 raw |
| 文档从哪读 | docs 索引 README |

旧版无日期后缀的 FEEL / HISTORY 仅作历史；与现行冲突时 **以最新日期章节 + 代码为准**。

### 问答提示

- 「为什么投影不能远吸？」→ P5  
- 「拖累改哪个参数？」→ 增益与平滑 / 操作幅度  
- 「震动为什么两下？」→ P9 换格去重  
- 「消行为什么还有空格？」→ P17 空槽常驻  
- 「缩放从哪边开始？」→ P18 落子近边  
- 「消除震几波？」→ P19 · §12 三波 T–C  
- 「手感1/2 差在哪？默认哪个？」→ P20 · 默认手感1  
- 「屏震怎么随行数变？」→ P21 · §12  
- 「死亡闪红多久？」→ P23 · `FEEL_DEATH_FLASH_MS`  
- 「发块 SSOT 在哪？」→ DEAL-PUSH-COMPLETE  
- 「模块怎么分的？」→ 架构 §2.1 / §9.2 / §12.2  

### 同步约定

仓库 `docs/*` 大改后：`notebooklm source add` 新版 A 源 + 可选 `note create` 迭代纪要；不必删旧源（用标题日期区分）。

---

## 11. 相关路径速查

| 路径 | 说明 |
|------|------|
| `docs/README.md` | 文档索引与规范 |
| `docs/DEAL-PUSH-COMPLETE.md` | 发块完整规格 |
| `src/game/defaults.js` | 规则 + FEEL + LAYOUT + COLOR + DEATH |
| `src/game/tune.js` | 运行时覆盖与 LAYOUT 键列表 |
| `src/game/feel-presets.js` | 手感1/2 |
| `src/feel-panel.js` | 调参 UI + 预设按钮 |
| `src/game/feel/*` | 手感策略 |
| `src/game/game.js` | 编排 · clearFx · deathFx |
| `src/game/view.js` | 空槽/填充 · 消行 · debris · 屏震 |
| `src/game/deal/*` | 发块管线 |
| `src/viewport.js` | 稳定布局 / safe |
| `plugins/native-haptics/` | iOS 震动真源 |
| `assets/icon-1024.png` | App Icon 源 |
| `../research/` | 立项研究文档集（多数不在 shell git） |

---

## 12. 消行增强 · 死亡 · 发块 · Icon（2026-07-29 → 07-30）

对应 commits（由旧到新）：

| Commit | 主题 |
|--------|------|
| `a9056e1` | clear debris、3 波 haptics、screen shake、docs |
| `74af50e` | 屏震更柔但更强 |
| `981be5d` | deal Intent / payoff / cavity / phase policy |
| `e0b477a` | death 盘面擦除动画 + 全屏 game-over |
| `17b7ec2` | 扁平 icon + deal 微调 |

设计细则：[FEEL-DESIGN.md](./FEEL-DESIGN.md) §4–§8 · 发块 [DEAL-PUSH-COMPLETE.md](./DEAL-PUSH-COMPLETE.md)。

### 12.1 问题 → 修改

| 现象 | 原因 / 旧行为 | 修改 |
|------|---------------|------|
| 消除震只有 1T+1C 偏短 | §9 配方 | **3 波 T→C→T→C→T→C**，段间共用 GAP；波 2/3 递减 |
| 将消/普通挪格偏重 | 默认 I 过高 | ghost 0.45/0.25 · preview 0.7/0.3（真机标定） |
| 屏震无/过硬 | 无或方波 | 软起振+衰减；**峰值 = AMP_MIN+(L−1)×STEP**，单消=AMP_MIN |
| 消行无碎块 | 仅缩转 | 方形 debris：重力/寿命/初速/每格数量可调 |
| 死亡直接弹窗 | 无演出 | flash×2 → 自下填 → pause → 自上揭 → 全屏 GO |
| GO 在 HUD 内布局挤 | overlay 挂 hud | death-flash / game-over 挂 **`#phone-frame`** |
| 按钮跟着文案飘 | 整层 translate | 文案层与按钮布局分离 |
| 发块阶段偏粗 | 仅 fill 阈值 | 局面分类 + Intent + G2 等（见 DEAL SSOT） |
| 系统图标非扁平原画 | — | `assets/icon-1024.png` 同步 iOS AppIcon |

### 12.2 架构补充

```
haptics-ghost.js
  onClearFxStart → 序列 T1 C1 T2 C2 T3 C3（gap 串联）

view.js
  debrisRoot + 重力积分
  boardView 位移 = 软包络 × amp(L)

game.js
  deathFx phases: flash | fill | pause | reveal
  buildDeathDisplay / cellOpacity
  finishDeathFx → setGameOver(true)

index.html / style.css
  [data-death-flash] · [data-game-over] 全屏半透
```

### 12.3 关键默认摘要（以 defaults 为准）

| 域 | 常量 | 约值 |
|----|------|------|
| 视觉 clear | `FEEL_CLEAR_MS` / STAGGER / SHRINK | 280 / 0.42 / 0.4 |
| 屏震 | AMP_MIN / STEP / MAX / HZ | 11 / 4 / 28 / 18 |
| debris | COUNT / LIFE / GRAVITY / SPEED | 2 / 720 / 2200 / 2.8 |
| 死亡 | FLASH / ROW / PAUSE | 600 / 72 / 420 |
| 消除震 | GAP + 波1–3 | 见 FEEL §4.2 |

### 12.4 决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 消除震 | 固定 3 波而非按消行数变长 | 可预期、参数面板可控；视觉时长仍由 CLEAR_MS 管 |
| 屏震 min | = 单消满幅度 | 避免 L=1 无感；多消再步进 |
| 死亡 | 先演出再 GO | 对齐「完蛋了」节奏，非硬切 UI |
| 发块文档 | DEAL-PUSH-COMPLETE 为 SSOT | 避免 DEAL-DESIGN 短文与完整需求分叉 |
| Icon | 扁平 1024 | 商店/桌面一致、无复杂透视 |

---

## 13. 设置 UI · 触控清理 · 摆放区 · 出厂标定（2026-07-30 → 07-31）

> **本节为当前阶段项目笔记。** 设计细节见 [FEEL-DESIGN.md](./FEEL-DESIGN.md) §5 / §11 · 入口 [ENTRYPOINTS.md](./ENTRYPOINTS.md)。

### 13.1 问题 → 修改

| 现象 | 原因 / 旧行为 | 修改 |
|------|---------------|------|
| 左下手感 + 右下调参挡盘 | FAB 常驻底栏 | **右上角设置齿轮**；手感1/2 与滑条进底部 sheet；遮罩可关 |
| 双指/双击放大、长按放大镜 | WebKit 默认手势 | `touch-hygiene.js` + `BridgeViewController.hardenWebViewTouches`；拖块仅 **isPrimary** |
| 调「摆放区高度」几乎无变化 | 槽写死为正方形 `宽/3` | 高度 = `trayCell × LAYOUT_TRAY_BAND_CELLS`（1.5–15） |
| 调高度整盘上下跳 | band 参与棋盘竖向占位 | **棋盘占位用出厂 band**；滑条只改区 h，**中心锚点固定** |
| 调试三等分区常显 | 默认开 | `SHOW_TRAY_ZONES = false`（面板调试项可开） |
| 快速跟手偏肉 | MAX 1.25 | 手感1 **GAIN_MAX = 1.35**（预设 v16） |
| 影甩太远 / 贴得太死 | lag 1.0 | **`FEEL_GHOST_MAX_LAG = 1.3`** |
| tray 略偏下 | shift 0 | **`LAYOUT_TRAY_SHIFT_Y = -0.01`** |
| 区默认偏矮 | band 3.2 | **`LAYOUT_TRAY_BAND_CELLS = 7`**（亦作布局锚点出厂） |

### 13.2 架构补充

```
main.js
  installTouchHygiene()          # 多指 / 双击 / contextmenu / 非主指针
  createFeelPanel()              # 右上角 fab + scrim + sheet

feel-panel.js
  设置齿轮 ⇄ sheet
  sheet: 手感1/2 | 滑条 | 重置/收起

layout.js
  packBand = DEFAULT_TRAY_BAND_CELLS   # 仅占位与锚点
  zoneH    = tune.LAYOUT_TRAY_BAND_CELLS × trayCell
  trayAnchorCy = 盘底 + gap + packBandH/2 + trayShift
  slot.cy = trayAnchorCy               # 高度变，中心不动

BridgeViewController
  hardenWebViewTouches: pinch/双击/长按/bounce off
```

### 13.3 出厂默认摘要（以 defaults.js 为准，2026-07-31）

| 域 | 常量 | 值 |
|----|------|-----|
| 手感1 快速增益 | `FEEL_POINTER_GAIN_MAX` | **1.35** |
| 影-块最大距离 | `FEEL_GHOST_MAX_LAG` | **1.3** |
| 摆放区高度 | `LAYOUT_TRAY_BAND_CELLS` | **7** |
| 摆放物高度(下移) | `LAYOUT_TRAY_SHIFT_Y` | **-0.01** |
| 显示三等分区 | `SHOW_TRAY_ZONES` | **false** |
| 预设存档键 | `bb_feel_preset_v16_*` | 升版清旧槽污染 |

### 13.4 决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 调参入口 | 单设置按钮右上 | 盘面干净；开发期仍可达全参数 |
| 区高锚点 | 中心固定 + 占位解耦 | 调参时不抖动棋盘/块 |
| 区样式默认 | 关 | 正版无大槽框；需要时调试打开 |
| Web/iOS | 同 `src/` | 避免双端分叉；仅原生层补 WKWebView |
| 打包 | cap:sync → 真机 install | 口语「打包」= 上真机可玩包，非模拟器 |

### 13.5 文档同步（本轮）

| 文档 | 动作 |
|------|------|
| `docs/README.md` | 索引日期 07-31 · 真源表补 layout/touch · 近期主题 |
| `AGENTS.md` / 根 README / shell README | DOM 与设置 UI · 打包说明 |
| `ENTRYPOINTS.md` | 启动链 · feel-panel · Bridge harden |
| `FEEL-DESIGN.md` §5/§11 | 设置 UI · 区高规则 · GAIN/lag |
| 本节 **§13** | 项目笔记正文 |

### 13.6 投影横拖上跳（P6 修复，2026-07-31）

| 现象 | 原因 | 修改 |
|------|------|------|
| 手指横移，投影往上跳 | 横移行程 `×0.25` 计入抬升 → free 上移 | `drag-session`：抬升 **只计上移** |
| 左格不合法时影跳到上格 | free 邻域按距离取最近，含纯竖 | `ghost-policy`：横意图优先同排；钉 sticky 行再找列 |
| 块居中时投影左右连闪 | open=0.5 时 free≈n.5 会 n↔n+1 来回踩阈值 | `FEEL_GHOST_SNAP_HYST` 滞回；quantize 钉 sticky |

### 13.7 投影：从 BUG 修补 → 系统设计（2026-07-31）

将 §13.6 的修补**提升为正式设计**，避免再当零散 hotfix：

| 动作 | 说明 |
|------|------|
| 新 SSOT | **[GHOST-DESIGN.md](./GHOST-DESIGN.md)**：目标、free/sticky、死区滞回、轴意图、流水线、验收 |
| 代码重构 | `ghost-policy.js` 按流水线分节：engage → free → 死区 → sticky 步进 → free 吸附 → maxLag；抽出 `resolveStickyStep` / `freeSnapGated` |
| 抬升边界 | `drag-session` 明确「仅上移计 travel」为设计，非临时补丁 |
| FEEL-DESIGN | §10 改为摘要 + 指向 GHOST-DESIGN；P6 指向设计文 |
| 禁止回退 | 横移抬升、`Math.round` 半格无滞回、free 钳盘边救命 |

之后改投影：**先改 GHOST-DESIGN，再改代码**。

### 13.8 自适应换格：指速 × 邻格可放（2026-07-31）

产品目标：快扫及时跟、空旷慢拖贴手、贴边/缝不乱跳不肉。

| 机制 | 实现 |
|------|------|
| 速度因子 | `pointerSpeedT` → 调制 open/hyst/死区 |
| 盘面因子 | 邻格 `fits` → corridor 更灵；否则 edge≥EDGE_MIN |
| 滞回下限 | `SNAP_HYST_MIN` 防快扫再闪 |
| 代码 | `ghost-policy.adaptiveThresholds` |

---

## 14. 渲染对象池 · 投影跟本体 / 卡边 / 斜向（2026-07-31）

> 提交：`2f4f04e`（池化 + 影透明 + 跟本体/卡边）· `4e907b9`（斜向方向过滤）  
> 设计 SSOT：投影 → [GHOST-DESIGN.md](./GHOST-DESIGN.md)；手感摘要 → FEEL-DESIGN §10

### 14.1 问题 → 修改

| 现象 | 原因 | 修改 |
|------|------|------|
| 拖动时卡顿 / 频繁 new dispose | 每帧重建 tray/ghost/debris mesh | `block-mesh`：`acquire/releaseFilledCell`；共享圆角几何；debris 单位平面 + scale；dynamic 回收分池 |
| 盘面/tray 重影、游离紫块 | 阴影 BufferGeometry 脏复用、bounding 不刷新 | tray 扁影：**每帧新建 geo+material**（数量 ≤3）；`clearList` 兜底清 `dynamicRoot` 孤儿 |
| 阴影/投影看起来不透明 | 池化材质 `transparent` 切换后 WebGPU 仍走不透明通道 | 扁影不池化材质；ghost 独立池 + `needsUpdate` / `forceSinglePass` |
| 影「提前到格」，块还在半路 | sticky open≈0.28 提前步进 | **本体 free 驱动**；开阔 **OPEN=0.5** 半格切换 |
| 卡边一点就挤影 | edge 阈值过低或被速度压低 | **EDGE_HOLD=EDGE_MIN=1.3**；`MAX_LAG=1.45`（> edge） |
| 斜拖先横影再斜影 | 单轴先跨阈 → 候选先纯横/竖 | `intentDx/Dy` + `DIAG_RATIO/MINOR`；斜移对角优先、压单轴中间步 |

### 14.2 架构补充

```
block-mesh.js
  geoCache（sharedTemplate）· filledPool
  acquireFilledCell / releaseFilledCell / recolorFilledCell / applyFilledCellScale

view.js
  ghostCellPool（与盘面 filled 隔离）
  tray 扁影：acquireShadowMesh 每次新 geo+mat，release 全 dispose
  debris：单位 Plane 池 + scale
  clearList → 回收 + 清空 dynamicRoot 残留子节点

drag-session.js
  intentDx / intentDy（指移 EMA）→ 投影方向过滤

ghost-policy.js
  open 半格 · edge 1.3 · moveIntentClass(h/v/diag)
  斜移：对角候选优先；againstMoveIntent 滤逆行
```

### 14.3 出厂默认摘要（投影相关，以 defaults.js 为准）

| 常量 | 值 |
|------|-----|
| `FEEL_GHOST_OPEN_SNAP` / `CORRIDOR_MUL` | 0.5 / 1.0 |
| `FEEL_GHOST_SNAP_HYST` / `MIN` | 0.06 / 0.04 |
| `FEEL_GHOST_EDGE_HOLD` / `MIN` | 1.3 / 1.3 |
| `FEEL_GHOST_MAX_LAG` | 1.45 |
| `FEEL_GHOST_DIAG_RATIO` / `MINOR` | 0.42 / 0.22 |
| `FEEL_GHOST_ALPHA` | 0.15 |

### 14.4 决策

| 决策 | 原因 |
|------|------|
| 投影跟 **本体 free**，不「预瞄」前方格 | 玩家反馈：影应随块到位再切 |
| 卡边硬阈值 1.3，且不被速度乘低 | 贴边/堵住要明显粘，避免误挤 |
| 斜向单独意图类 | 消除「先横后斜」中间态 |
| tray 扁影不池化材质 | 数量极少；透明在 WebGPU 上最稳 |
| ghost 与 board fill **分池** | 半透明不污染实心块 |

### 14.5 文档同步（本轮）

| 文档 | 动作 |
|------|------|
| [GHOST-DESIGN.md](./GHOST-DESIGN.md) | 重写：跟本体 · 卡边 1.3 · 斜向过滤 · 参数表 · 验收 |
| [FEEL-DESIGN.md](./FEEL-DESIGN.md) §10/§11 | 摘要对齐；调参表补斜向 |
| [RUNTIME-DEFAULTS.md](./RUNTIME-DEFAULTS.md) | 投影表与 defaults 对齐 |
| [docs/README.md](./README.md) | 近期主题 §14 |
| [AGENTS.md](../AGENTS.md) | 几何共享 + 池约定；笔记指向 §14 |
| 本节 **§14** | 项目笔记正文 |

### 14.6 验收（真机）

1. 开阔拖：影跟块，过中线才换格，无明显「影先到」。  
2. 卡边/贴占格：需拖约 1.3 格量级才换影。  
3. 左上/右上等斜拖：无稳定「先横一格再斜」中间影。  
4. tray 扁影半透明、贴块、无游离紫块。  
5. 长时间拖动无明显分配卡顿（池化）。  

改投影：**先改 GHOST-DESIGN，再改 `ghost-policy` / `drag-session` / defaults**。

---

## 15. 投影方法栈反查与 8 向收敛（2026-07-31）

> 设计 SSOT 终稿：[GHOST-DESIGN.md](./GHOST-DESIGN.md)（含检索依据、反查表、验收）

### 15.1 检索结论（采用什么 / 不采用什么）

| 采用 | 来源/类比 |
|------|-----------|
| 离散 sticky + fits | 编辑器/RTS snap、block puzzle ghost |
| 施密特滞回 H | 建造吸附防 snap jitter（公开 mod changelog） |
| 合法/非法分 L | 磁吸目标不同离开成本 |
| 8 向一步 | 摇杆 8-way 离散化 |
| 失败钉住、MAX_LAG 灭影 | 反 nearest 甩影 |

不采用：全盘 nearest、换格时间锁、失败 8 邻乱吸、无 H 纯 round。

### 15.2 产品拍板

- 卡边 **1.3**（非 1.5）  
- 斜向双轴都过阈才对角  
- **防闪优先**（H_open=0.12）  
- 假斜向（未达 DIAG_RATIO）走主轴，避免双轴门闩拖死  

### 15.3 反查补漏

| 漏点 | 处理 |
|------|------|
| 未达斜向比例仍强制对角 | 已删；只跟更强轴 |
| 文档仍写 intent 双路径 / settle | GHOST-DESIGN 重写为 8 向单流水线 |
| 补丁史与方法混写 | §0 方法栈 + §6 反查表分离 |

### 15.4 已知取舍

贴障碍**斜绕**空地时，堵轴 leave 仍按 1.3 → 影更粘；若要「斜绕更松」需改设计为「按目标格 fits 选 L」，见 GHOST-DESIGN。

---

## 16. 投影：Bug / 补丁 → 设计 重构总结（2026-07-31）

> 完整条文：[GHOST-DESIGN.md](./GHOST-DESIGN.md) **§一**  
> 代码：`ghost-policy.js`（`stepCardinal` / `stepDiagonal` 对齐流水线）

### 16.1 重构路径

```
现象打补丁 → 补丁互殴 → 需求表 + 优先级
  → 检索方法栈（滞回 / 8 向 / 分 L）
  → 单一流水线 SSOT
  → 产品拍板（1.3 / 斜向中间态 / 不闪）
  → 实现收敛 + 验收表
```

### 16.2 Bug → 终态设计

| Bug | 终态设计 |
|-----|----------|
| 影提前 | L_open=0.5，跟本体 free |
| 格缝闪 | H_open 施密特；禁时间锁；失败钉住 |
| 横拖钝 | 无 settle；H 有角色 |
| 卡边松 | L_edge=1.3 |
| 先横后斜 vs 影落后 | 8 向 + 斜向可先单轴一格（方案 1） |
| 甩影 | MAX_LAG 灭影 |

### 16.3 文档职责

| 文档 | 职责 |
|------|------|
| **GHOST-DESIGN** | 唯一行为 SSOT（演进 + 流水线 + 参数 + 验收） |
| FEEL-DESIGN §10 | 摘要指针 |
| HISTORY §13–16 | 迭代史；§16 为本总结 |

### 16.4 约定

改投影：**先改 GHOST-DESIGN，再改 ghost-policy**；新现象归 G-*，不平行加状态机。
