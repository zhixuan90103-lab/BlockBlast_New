# AGENTS.md — 给 AI / 新窗口的工程说明

> **本文件是打开本仓库时的第一入口。**  
> 文档索引：[docs/README.md](./docs/README.md) · 人类上手：[README.md](./README.md)

## 一句话

**Block Blast! Classic 手感向复刻**，技术底座为 **Three.js WebGPU + Vite + Capacitor iOS + NativeHaptics**。  
目标是操作/布局/发块体感，而非商店化完整产品。

## 文档从哪读

| 优先 | 文档 |
|------|------|
| 1 | 本文件 + [docs/README.md](./docs/README.md) |
| 2 手感/消行/震动/死亡 | [docs/FEEL-DESIGN.md](./docs/FEEL-DESIGN.md) |
| 3 发块 | **[docs/DEAL-PUSH-COMPLETE.md](./docs/DEAL-PUSH-COMPLETE.md)**（SSOT；[DEAL-DESIGN](./docs/DEAL-DESIGN.md) 仅摘要） |
| 4 踩坑史 | [docs/PROJECT-HISTORY.md](./docs/PROJECT-HISTORY.md)（最新 §12） |
| 5 底座 | [docs/ENGINEERING.md](./docs/ENGINEERING.md) |

**常量真源**：`src/game/defaults.js`（不要只信 RUNTIME-DEFAULTS 摘录）。

## 入口地图

| 职责 | 文件 |
|------|------|
| Web 启动 | `index.html` → `src/main.js` → `createGame` |
| 规则编排 | `src/game/game.js`（clearFx · deathFx · game-over） |
| 手感 | `src/game/feel/*` · `feel-presets.js` · `feel-panel.js` |
| 渲染 / FX | `src/game/view.js`（空槽/填充 · debris · 屏震） · `block-mesh.js` · `layout.js` |
| 发块 | `src/game/deal/*`（`pipeline.js`） |
| 常量 / 调参 | `defaults.js` · `tune.js` |
| WebGPU | `src/create-renderer.js` |
| 视口 | `src/viewport.js` · `style.css` |
| 震动 JS | `src/native-haptics.js` · 业务曲线 `feel/haptics-ghost.js`（**3 波 T–C**） |
| 震动 iOS | `plugins/native-haptics/*.swift` |
| App Icon | `assets/icon-1024.png` → iOS AppIcon |

## 常用命令

```bash
npm install
npm run dev          # http://127.0.0.1:5190/
npm run build
npm run cap:sync     # 口语「打包」：build + cap sync ios
npm run cap:open
npm run ios:bootstrap
```

## 硬性约定

1. Vite **`base: './'`**（Capacitor 相对路径）。  
2. **`webDir: "dist"`** 与 Vite outDir 一致。  
3. **`ios.contentInset: "never"`**，Safe Area 只走 CSS `env(...)`。  
4. 交互 UI 在 `#hud`；3D 在 `#stage`；**死亡闪红 / 全屏结算** 在 `#phone-frame` 内、`#hud` 外（`[data-death-flash]` / `[data-game-over]`）。  
5. **业务震动曲线**写在 `feel/haptics-ghost.js`，原生层只提供 transient/continuous API。  
6. 改布局尺寸：同步 `viewport.js` DESIGN_* 与 CSS 393/852（若仍用设计框）。  
7. 圆角几何：BufferGeometry + clone；共享模板勿 dispose。  
8. 文档：改手感/消行/死亡/震动 → 更新 **FEEL-DESIGN** + **PROJECT-HISTORY** 相关节；改发块 → **DEAL-PUSH-COMPLETE**；入口 DOM → **ENTRYPOINTS**。

## DOM

```
#letterbox > #phone-frame
              ├ #stage
              ├ #hud                 ← 分数等
              ├ [data-death-flash]   ← 死亡闪红
              ├ [data-game-over]     ← 全屏结算
              └ #feel-panel          ← 动态挂载
```

左下角：**手感1 / 手感2**；右下角：**调参**（含震动 3 波、屏震、debris、发块）。

## 新会话建议

1. 读本文件 + `docs/README.md`  
2. 动手感读 `FEEL-DESIGN.md`；动发块读 **`DEAL-PUSH-COMPLETE.md`**  
3. `npm run dev` 或 `cap:sync` 真机  
4. 默认手感槽 = **手感1**（= defaults）

## 刻意边界

- 不商业化（商店/广告/账号）  
- 无旋转、无重力（Classic）  
- 无 Android 优先  
- 无 WebGL 静默回退  
