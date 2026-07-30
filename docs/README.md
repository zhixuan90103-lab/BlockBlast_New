# 项目文档索引

> **规范**：以代码为准；文档描述行为与决策，常量数值以 `src/game/defaults.js` 为真源。  
> 工程根：`three-webgpu-cap-shell/` · 远程：`zhixuan90103-lab/BlockBlast_New`

## 阅读顺序（建议）

| 角色 | 路径 |
|------|------|
| **AI / 新窗口** | [../AGENTS.md](../AGENTS.md) → 本索引 → 按需下钻 |
| **人类上手** | [../README.md](../README.md) → ENTRYPOINTS |
| **改手感 / 消行 / 震动** | [FEEL-DESIGN.md](./FEEL-DESIGN.md) |
| **改发块** | **[DEAL-REFACTOR-DESIGN.md](./DEAL-REFACTOR-DESIGN.md)**（需求SSOT+重构）· [DEAL-SPEC.md](./DEAL-SPEC.md) |
| **踩坑与迭代史** | [PROJECT-HISTORY.md](./PROJECT-HISTORY.md) |
| **底座 / Capacitor** | [ENGINEERING.md](./ENGINEERING.md) |
| **常量快照（可能滞后）** | [RUNTIME-DEFAULTS.md](./RUNTIME-DEFAULTS.md) → **以 defaults.js 为准** |

## 文档地图

| 文档 | 内容 | 何时更新 |
|------|------|----------|
| [ENTRYPOINTS.md](./ENTRYPOINTS.md) | 命令、DOM、Web/iOS 启动链 | 入口或脚本变更时 |
| [ENGINEERING.md](./ENGINEERING.md) | WebGPU、Capacitor、Safe Area、插件 | 底座约定变更时 |
| [FEEL-DESIGN.md](./FEEL-DESIGN.md) | 拖拽/投影/消行视觉/震动/预设；问题→规则 | **手感迭代后必更新** |
| [DEAL-REFACTOR-DESIGN.md](./DEAL-REFACTOR-DESIGN.md) | **全量需求 + 发块重构设计 + PR 计划** | **需求/架构变更时必更** |
| [DEAL-SPEC.md](./DEAL-SPEC.md) | 现行行为摘要 | 行为变更时同步 |
| [DEAL-DESIGN.md](./DEAL-DESIGN.md) | 短摘要 | 可选 |
| [DEAL-RHYTHM.md](./DEAL-RHYTHM.md) | 模块/阶段速查 | 节奏表变更时 |
| [PROJECT-HISTORY.md](./PROJECT-HISTORY.md) | 里程碑、问题全表、决策日志 | 大迭代后追加章节 |
| [RUNTIME-DEFAULTS.md](./RUNTIME-DEFAULTS.md) | defaults 摘录（可能过期） | 可选；改 defaults 后择机同步 |
| [../plugins/native-haptics/README.md](../plugins/native-haptics/README.md) | 原生震动 API | 插件 API 变更时 |

## 代码真源（文档不重复抄全表）

| 领域 | 真源路径 |
|------|----------|
| 规则/手感/发块/颜色常量 | `src/game/defaults.js` |
| 运行时覆盖 + 调参面板字段 | `src/game/tune.js` · `src/feel-panel.js` |
| 手感预设 1/2 | `src/game/feel-presets.js` |
| 消行视觉 | `src/game/view.js` · `game.js` clearFx |
| 震动曲线 | `src/game/feel/haptics-ghost.js` |
| 发块 | `src/game/deal/*` |
| 原生震动桥 | `src/native-haptics.js` · `plugins/native-haptics/` |

## 文档约定

1. **现象 → 原因 → 调整** 写入 `PROJECT-HISTORY` 或 `FEEL-DESIGN` 问题表，避免只写「改了某某」。  
2. **禁止**在多处复制大段默认数值表；摘要可写，完整以 `defaults.js` 为准。  
3. **口语「打包」** = `npm run cap:sync`（build + 同步 iOS）。  
4. AGENTS / README 保持短；细节下沉到 `docs/*`。  
5. 日期与 commit 可在 HISTORY 章节标注，便于回溯。  
