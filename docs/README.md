# 项目文档索引

> **规范**：以代码为准；文档描述行为与决策，常量数值以 `src/game/defaults.js` 为真源。  
> 工程根：`three-webgpu-cap-shell/` · 远程：`zhixuan90103-lab/BlockBlast_New`  
> 文档整理：**2026-07-31**（设置 UI · 触控清理 · 摆放区几何 · 出厂标定 · 笔记 §13）

## 阅读顺序（建议）

| 角色 | 路径 |
|------|------|
| **AI / 新窗口** | [../AGENTS.md](../AGENTS.md) → 本索引 → 按需下钻 |
| **人类上手** | [../README.md](../README.md) → ENTRYPOINTS |
| **改手感 / 消行 / 震动 / 死亡** | [FEEL-DESIGN.md](./FEEL-DESIGN.md) |
| **改发块** | **[DEAL-PUSH-COMPLETE.md](./DEAL-PUSH-COMPLETE.md)**（完整规格 SSOT）· [DEAL-SPEC.md](./DEAL-SPEC.md) · [DEAL-REFACTOR-DESIGN.md](./DEAL-REFACTOR-DESIGN.md) |
| **踩坑与迭代史（项目笔记）** | [PROJECT-HISTORY.md](./PROJECT-HISTORY.md)（最新 **§13**） |
| **底座 / Capacitor** | [ENGINEERING.md](./ENGINEERING.md) |
| **常量快照（可能滞后）** | [RUNTIME-DEFAULTS.md](./RUNTIME-DEFAULTS.md) → **以 defaults.js 为准** |

## 文档地图

| 文档 | 内容 | 何时更新 |
|------|------|----------|
| [ENTRYPOINTS.md](./ENTRYPOINTS.md) | 命令、DOM、Web/iOS 启动链 | 入口、UI 壳、脚本变更时 |
| [ENGINEERING.md](./ENGINEERING.md) | WebGPU、Capacitor、Safe Area、插件、触控硬化 | 底座约定变更时 |
| [FEEL-DESIGN.md](./FEEL-DESIGN.md) | 拖拽/投影摘要/消行/屏震/debris/震动/死亡/预设/布局区；P1–P24 | **手感·布局迭代后必更新** |
| [GHOST-DESIGN.md](./GHOST-DESIGN.md) | **投影完整规格 SSOT**（稳定/轴意图/死区滞回） | **改投影行为时必更** |
| [DEAL-PUSH-COMPLETE.md](./DEAL-PUSH-COMPLETE.md) | **发块完整规格** | **需求/发块变更时必更** |
| [DEAL-REFACTOR-DESIGN.md](./DEAL-REFACTOR-DESIGN.md) | 重构设计 + 历史需求表 | 架构大改时同步 |
| [DEAL-SPEC.md](./DEAL-SPEC.md) | 现行行为短摘要 | 行为变更时同步 |
| [DEAL-DESIGN.md](./DEAL-DESIGN.md) | **短摘要 + 指向 SSOT** | 可选；大改时补指针 |
| [DEAL-RHYTHM.md](./DEAL-RHYTHM.md) | 模块/阶段速查 | 节奏表变更时 |
| [PROJECT-HISTORY.md](./PROJECT-HISTORY.md) | **项目笔记**：里程碑、问题表、决策 | 大迭代后**追加**章节 |
| [RUNTIME-DEFAULTS.md](./RUNTIME-DEFAULTS.md) | defaults 摘录（易过期） | 可选；改 defaults 后择机同步 |
| [../plugins/native-haptics/README.md](../plugins/native-haptics/README.md) | 原生震动 API | 插件 API 变更时 |

## 代码真源（文档不重复抄全表）

| 领域 | 真源路径 |
|------|----------|
| 规则/手感/发块/布局/颜色常量 | `src/game/defaults.js` |
| 运行时覆盖 + 调参面板字段 | `src/game/tune.js` · `src/feel-panel.js` |
| 手感预设 1/2 | `src/game/feel-presets.js` |
| 棋盘 / tray 几何 | `src/game/layout.js` |
| 消行视觉 / 屏震 / debris / 摆放区可视化 | `src/game/view.js` · `game.js` clearFx |
| 死亡演出 / 结算 overlay | `src/game/game.js` deathFx · `style.css` · `index.html` |
| 震动曲线（含 3 波） | `src/game/feel/haptics-ghost.js` |
| 触控卫生（禁双指/双击缩放/长按菜单） | `src/touch-hygiene.js` · iOS `BridgeViewController` |
| 投影策略 | `src/game/feel/ghost-policy.js` · 设计 [GHOST-DESIGN.md](./GHOST-DESIGN.md) |
| 发块 | `src/game/deal/*`（入口 `pipeline.js`） |
| 原生震动桥 | `src/native-haptics.js` · `plugins/native-haptics/` |

## 文档约定

1. **现象 → 原因 → 调整** 写入 `PROJECT-HISTORY` 或 `FEEL-DESIGN` 问题表，避免只写「改了某某」。  
2. **禁止**在多处复制大段默认数值表；摘要可写，完整以 `defaults.js` 为准。  
3. **口语「打包」** = 真机安装流程：`npm run cap:sync` → `xcodebuild`（真机）→ `devicectl install/launch`；最少也可 `cap:sync` + Xcode ⌘R。  
4. AGENTS / README 保持短；细节下沉到 `docs/*`。  
5. 日期与变更可在 HISTORY 章节标注，便于回溯。  
6. **发块 SSOT** 唯一完整正文是 `DEAL-PUSH-COMPLETE.md`；`DEAL-DESIGN` / `DEAL-SPEC` 只做摘要与指针。  
7. 改手感/消行/死亡/震动/布局 UI 后：更新 **FEEL-DESIGN** + **PROJECT-HISTORY 追加节**；入口 DOM 变则更新 **ENTRYPOINTS**。  
8. 上级 `../research/` 多数不在 shell git 内；运行时结论以代码与本目录为准。  
9. **Web 与 iOS 同构**：玩法/调参在 `src/`，不维护第二套业务；仅原生震动与 WKWebView 硬化在 iOS。  

## 近期主题速查（2026-07-29 → 07-31）

| 主题 | 文档位置 | 代码 |
|------|----------|------|
| 空槽常驻 + 消行缩转 | FEEL §3 · HISTORY §9 | `view.js` boardCells/Fills |
| 3 波消除震动 T–C | FEEL §4 · HISTORY §12 | `haptics-ghost.js` |
| 屏震按消行数 | FEEL §6 · HISTORY §12 | `view.js` |
| 碎裂粒子 | FEEL §7 · HISTORY §12 | `view.js` debris |
| 死亡闪红/填/揭 + GO | FEEL §8 · HISTORY §12 | `game.js` deathFx |
| 发块 Intent / 局面 | DEAL-PUSH-COMPLETE | `deal/*` |
| **右上角设置入口**（手感1/2 + 滑条） | FEEL §5/§11 · HISTORY **§13** | `feel-panel.js` · `style.css` |
| **触控清理**（双指/双击/放大镜） | ENTRYPOINTS · HISTORY §13 | `touch-hygiene.js` · BridgeViewController |
| **摆放区高度**中心固定 · 默认 7 | FEEL §11 · HISTORY §13 | `layout.js` · `LAYOUT_TRAY_BAND_CELLS` |
| 出厂标定（增益 1.35 · 影 lag 1.3 · tray Y） | HISTORY §13 · defaults.js | 见 §13 表 |
| **投影系统设计**（居中稳、横拖不跳） | **[GHOST-DESIGN.md](./GHOST-DESIGN.md)** · HISTORY §13.7 | `ghost-policy` · `drag-session` |
