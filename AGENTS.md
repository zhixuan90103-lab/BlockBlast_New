# AGENTS.md — 给 AI / 新窗口的工程说明

> **本文件是打开本仓库时的第一入口。**  
> 文档索引：[docs/README.md](./docs/README.md) · 人类上手：[README.md](./README.md) · **项目笔记**：[docs/PROJECT-HISTORY.md](./docs/PROJECT-HISTORY.md)（最新 §13）

## 一句话

**Block Blast! Classic 手感向复刻**，技术底座为 **Three.js WebGPU + Vite + Capacitor iOS + NativeHaptics**。  
目标是操作/布局/发块体感，而非商店化完整产品。**Web 与真机共用同一套 `src/`。**

## 文档从哪读

| 优先 | 文档 |
|------|------|
| 1 | 本文件 + [docs/README.md](./docs/README.md) |
| 2 手感/消行/震动/死亡/布局 | [docs/FEEL-DESIGN.md](./docs/FEEL-DESIGN.md) |
| 2b **投影** | **[docs/GHOST-DESIGN.md](./docs/GHOST-DESIGN.md)**（稳定/轴意图/死区） |
| 3 发块 | **[docs/DEAL-PUSH-COMPLETE.md](./docs/DEAL-PUSH-COMPLETE.md)**（SSOT；[DEAL-DESIGN](./docs/DEAL-DESIGN.md) 仅摘要） |
| 4 踩坑 / 项目笔记 | [docs/PROJECT-HISTORY.md](./docs/PROJECT-HISTORY.md)（**§13** 设置 UI·触控·摆放区） |
| 5 底座 | [docs/ENGINEERING.md](./docs/ENGINEERING.md) · [docs/ENTRYPOINTS.md](./docs/ENTRYPOINTS.md) |

**常量真源**：`src/game/defaults.js`（不要只信 RUNTIME-DEFAULTS 摘录）。

## 入口地图

| 职责 | 文件 |
|------|------|
| Web 启动 | `index.html` → `src/main.js` → `installTouchHygiene` → `createGame` |
| 规则编排 | `src/game/game.js`（clearFx · deathFx · game-over） |
| 手感 | `src/game/feel/*` · `feel-presets.js` · `feel-panel.js` |
| 渲染 / FX | `src/game/view.js` · `block-mesh.js` · `layout.js` |
| 发块 | `src/game/deal/*`（`pipeline.js`） |
| 常量 / 调参 | `defaults.js` · `tune.js` |
| 触控卫生 | `src/touch-hygiene.js`（Web）· `plugins/native-haptics/BridgeViewController.swift`（WKWebView） |
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
npm run cap:sync     # 口语「打包」第一步：build + cap sync ios
npm run cap:open
npm run ios:bootstrap
# 真机安装（本机已配签名时）：xcodebuild 真机 + devicectl install/launch
```

## 硬性约定

1. Vite **`base: './'`**（Capacitor 相对路径）。  
2. **`webDir: "dist"`** 与 Vite outDir 一致。  
3. **`ios.contentInset: "never"`**，Safe Area 只走 CSS `env(...)`。  
4. 交互 UI 在 `#hud`；3D 在 `#stage`；**死亡闪红 / 全屏结算 / 设置面板** 在 `#phone-frame` 内。  
5. **业务震动曲线**写在 `feel/haptics-ghost.js`，原生层只提供 transient/continuous API。  
6. 改布局尺寸：同步 `viewport.js` DESIGN_* 与 CSS 393/852（若仍用设计框）。  
7. 圆角几何：BufferGeometry + clone；共享模板勿 dispose。  
8. **仅主指针拖块**（`isPrimary`）；禁系统双指缩放 / 双击放大 / 长按菜单。  
9. 文档：改手感/消行/死亡/震动/布局 UI → 更新 **FEEL-DESIGN** + **PROJECT-HISTORY**；改发块 → **DEAL-PUSH-COMPLETE**；入口 DOM → **ENTRYPOINTS**。

## DOM

```
#letterbox > #phone-frame
              ├ #stage
              ├ #hud                 ← 分数等
              ├ [data-death-flash]   ← 死亡闪红
              ├ [data-game-over]     ← 全屏结算
              └ #feel-panel          ← 动态挂载：右上角设置 → 面板内手感1/2 + 滑条
```

- **右上角**：设置齿轮（展开/收起）  
- **面板内**：手感1 / 手感2（点击切换 · 长按存槽）+ 调参滑条 + 重置/收起  
- 关闭后棋盘上**不**再常驻左下/右下 FAB  

## 新会话建议

1. 读本文件 + `docs/README.md` + **PROJECT-HISTORY §13**  
2. 动手感/布局读 `FEEL-DESIGN.md`；动发块读 **`DEAL-PUSH-COMPLETE.md`**  
3. `npm run dev` 或 `cap:sync` 真机  
4. 默认手感槽 = **手感1**（= defaults）  

## 刻意边界

- 不商业化（商店/广告/账号）  
- 无旋转、无重力（Classic）  
- 无 Android 优先  
- 无 WebGL 静默回退  
