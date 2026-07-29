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
| 2 手感/消行/震动 | [docs/FEEL-DESIGN.md](./docs/FEEL-DESIGN.md) |
| 3 发块 | [docs/DEAL-DESIGN.md](./docs/DEAL-DESIGN.md) |
| 4 踩坑史 | [docs/PROJECT-HISTORY.md](./docs/PROJECT-HISTORY.md) |
| 5 底座 | [docs/ENGINEERING.md](./docs/ENGINEERING.md) |

**常量真源**：`src/game/defaults.js`（不要只信 RUNTIME-DEFAULTS 摘录）。

## 入口地图

| 职责 | 文件 |
|------|------|
| Web 启动 | `index.html` → `src/main.js` → `createGame` |
| 规则编排 | `src/game/game.js` |
| 手感 | `src/game/feel/*` · `feel-presets.js` · `feel-panel.js` |
| 渲染 | `src/game/view.js` · `block-mesh.js` · `layout.js` |
| 发块 | `src/game/deal/*` |
| 常量 / 调参 | `defaults.js` · `tune.js` |
| WebGPU | `src/create-renderer.js` |
| 视口 | `src/viewport.js` · `style.css` |
| 震动 JS | `src/native-haptics.js` |
| 震动 iOS | `plugins/native-haptics/*.swift` |

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
4. 交互 UI 在 `#hud`；3D 在 `#stage`。  
5. **业务震动曲线**写在 `feel/haptics-ghost.js`，原生层只提供 transient/continuous API。  
6. 改布局尺寸：同步 `viewport.js` DESIGN_* 与 CSS 393/852（若仍用设计框）。  
7. 圆角几何：BufferGeometry + clone；共享模板勿 dispose。  
8. 文档：改手感/消行后更新 **FEEL-DESIGN** 与 **PROJECT-HISTORY** 相关节。

## DOM

```
#letterbox > #phone-frame > (#stage | #hud | #feel-panel)
```

左下角：**手感1 / 手感2**；右下角：**调参**。

## 新会话建议

1. 读本文件 + `docs/README.md`  
2. 动手感读 `FEEL-DESIGN.md`；动发块读 `DEAL-DESIGN.md`  
3. `npm run dev` 或 `cap:sync` 真机  
4. 默认手感槽 = **手感1**（= defaults）

## 刻意边界

- 不商业化（商店/广告/账号）  
- 无旋转、无重力（Classic）  
- 无 Android 优先  
- 无 WebGL 静默回退  
