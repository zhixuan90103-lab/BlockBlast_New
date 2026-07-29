# AGENTS.md — 给 AI / 新窗口的工程说明

> **本文件是打开本仓库时的第一入口。**  
> 人类可读说明见 [README.md](./README.md)，完整技术细节见 [docs/ENGINEERING.md](./docs/ENGINEERING.md)。

## 一句话

本仓库是 **空的可复用技术底座**：**Three.js + WebGPU + Vite + Capacitor iOS + 自研 NativeHaptics**。  
只提供「能 dev / 能打包 / 能真机 / 能震动 / 桌面≈手机布局」。**不含任何具体游戏玩法。**

## 绝对路径（本机）

```
/Users/wangzhixuan/Documents/Threejs_Work/Project_基础/three-webgpu-cap-shell
```

## 入口地图（改代码从这里找）

| 职责 | 文件 | 说明 |
|------|------|------|
| **Web 启动** | `index.html` → `src/main.js` | HTML 壳 + 最小 demo 场景（可整段替换） |
| **WebGPU** | `src/create-renderer.js` | `WebGPURenderer`，按手机框尺寸 |
| **视口 / 手机框** | `src/viewport.js` + `src/style.css` | 393×852 letterbox；native 全屏 |
| **Safe Area** | `src/style.css` `#hud` + `viewport.js` `DESIGN_SAFE` | 灵动岛 / Home 条 |
| **震动 JS** | `src/native-haptics.js` | Capacitor `registerPlugin('NativeHaptics')` |
| **震动 iOS** | `plugins/native-haptics/*.swift` → 同步进 `ios/App/App/` | Core Haptics |
| **插件注册** | `BridgeViewController.swift` | `registerPluginInstance(NativeHapticsPlugin())` |
| **Capacitor** | `capacitor.config.json` | `webDir: dist`，`contentInset: never` |
| **构建** | `vite.config.js` | **必须** `base: './'` |
| **iOS 注入脚本** | `scripts/bootstrap-ios.mjs` | 首次/重装 iOS 时注入 Swift |

## 常用命令

```bash
npm install
npm run dev          # http://127.0.0.1:5190/ （vite.config port 5190）
npm run build        # → dist/
npm run cap:sync     # build + cap sync ios
npm run cap:open     # Xcode
npm run ios          # sync + open
npm run ios:bootstrap  # 无 ios 时 add + 注入插件 + sync
```

## 硬性约定（违反会坏）

1. **`vite` `base: './'`** — Capacitor 不能用 `/assets/...` 绝对路径。  
2. **`capacitor` `webDir: "dist"`** 与 Vite `outDir` 一致。  
3. **`ios.contentInset: "never"`** — Safe Area 只走 CSS `env(safe-area-inset-*)`，禁止系统双重 inset。  
4. **交互 UI 只放在 `#hud`** — 使用 `--safe-*`；3D 可全屏铺在 `#stage`。  
5. **业务震动曲线不要写进 shell** — shell 只提供 `prepare / playTransient / start|update|stopContinuous`。  
6. **改设计尺寸** — 同步改 `viewport.js` 的 `DESIGN_*` 与 `style.css` 的 `393 / 852`。  
7. **改 appId** — `capacitor.config.json` → `npm run cap:sync` → Xcode Signing 确认 Bundle ID / Team。

## DOM 结构（勿拆）

```
#letterbox          ← 桌面黑边；native 全屏底
  #phone-frame      ← 唯一「屏幕」：393:852 或真机全屏
    #stage          ← WebGPU canvas 挂载点
    #hud            ← 安全区内 UI（pointer-events 分层）
```

## 新会话建议动作

1. 读本文件 + `docs/ENGINEERING.md`  
2. `npm run dev` 验证 WebGPU + 手机框  
3. 业务只改 `src/main.js`（或新增 `src/game/*`），**保留** renderer / viewport / haptics  
4. 上真机：`npm run cap:sync` → Xcode Team → Run  

## 刻意不做的事

- 具体游戏玩法（本仓库保持空壳 + 最小 demo）  
- TypeScript（当前纯 JS，可后加）  
- Android  
- WebGL 静默回退（无 WebGPU 则明确报错）  
- 业务向震动曲线（只保留底层 API）  
