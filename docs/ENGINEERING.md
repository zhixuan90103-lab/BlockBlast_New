# 工程说明（Engineering）

面向维护者与 AI：本底座的设计决策、模块职责与踩坑点。

配套入口：[AGENTS.md](../AGENTS.md) · [README.md](../README.md) · [ENTRYPOINTS.md](./ENTRYPOINTS.md) · [FEEL-DESIGN.md](./FEEL-DESIGN.md) · [PROJECT-HISTORY.md](./PROJECT-HISTORY.md)（实现与问题全景）

---

## 1. 产品定位

| 是 | 否 |
|----|----|
| 新 Three.js WebGPU 项目的 **可复制空壳** | 任何具体游戏玩法 |
| Vite 开发 + Capacitor iOS 真机 | 仅浏览器玩具 demo |
| 自研 Core Haptics 插件 | 官方 `@capacitor/haptics` 封装（API 不同） |
| 桌面预览 ≈ 手机比例 + 模拟安全区 | 宽屏全屏 Web 体验优先 |

技术栈：官方 npm `three`（含 `three/webgpu`）+ Vite + Capacitor 8 iOS。

---

## 2. 目录树（有意义的部分）

```
three-webgpu-cap-shell/
├── AGENTS.md                 # AI / 新窗口第一入口
├── README.md                 # 人类快速上手
├── docs/
│   ├── ENGINEERING.md        # 本文件
│   ├── ENTRYPOINTS.md        # 入口与调用链
│   └── FEEL-DESIGN.md        # 手感/投影：问题→约束→模块
├── index.html                # DOM 壳：letterbox / phone-frame / stage / hud
├── package.json
├── vite.config.js            # base: './' · port 5190 · es2022
├── capacitor.config.json     # appId · webDir · ios.contentInset never
├── src/
│   ├── main.js               # boot：viewport + createGame + feel-panel
│   ├── create-renderer.js    # WebGPU 创建 / resizeToFrame
│   ├── viewport.js           # 设计尺寸 · safe 探针 · scheduleStableLayout
│   ├── native-haptics.js     # 通用震动桥（无业务曲线）
│   ├── feel-panel.js         # 调参面板（布局 rebuild / 手感 paint）
│   ├── style.css             # letterbox · safe-area · HUD · panel
│   └── game/
│       ├── game.js           # 编排（规则 + 指针 + feel）
│       ├── defaults.js / tune.js
│       ├── feel/             # drag-session · ghost-policy · haptics-ghost
│       ├── grid.js · forms.js · pieces.js · score.js
│       ├── layout.js · view.js · block-mesh.js
├── plugins/native-haptics/   # Swift 源码「真源」；bootstrap 复制进 ios/
│   ├── NativeHapticsPlugin.swift
│   ├── BridgeViewController.swift
│   └── README.md
├── scripts/
│   └── bootstrap-ios.mjs     # cap add + 注入 Swift + 改 storyboard/pbxproj
└── ios/                      # Capacitor 生成；真机工程
    └── App/App/
        ├── NativeHapticsPlugin.swift   # 由 bootstrap 同步，勿只改这里丢真源
        ├── BridgeViewController.swift
        ├── public/                     # cap sync 生成，gitignore 可忽略
        └── Base.lproj/Main.storyboard  # customClass=BridgeViewController
```

---

## 3. 关键配置一览

### 3.1 Vite (`vite.config.js`)

| 项 | 值 | 原因 |
|----|-----|------|
| `base` | `'./'` | Capacitor 本地加载相对路径 |
| `build.outDir` | `dist` | 对齐 `webDir` |
| `build.target` | `es2022` | WebGPU / 现代语法 |
| `server.port` | `5190` | 避开常见 5173 占用 |

### 3.2 Capacitor (`capacitor.config.json`)

| 项 | 值 | 原因 |
|----|-----|------|
| `appId` | `com.example.webgpushell` | **占位**，上架/真机长期开发请改 |
| `appName` | `WebGPU Shell` | 显示名 |
| `webDir` | `dist` | sync 源目录 |
| `ios.contentInset` | `never` | 全屏；Safe Area 只走 CSS |
| `ios.scrollEnabled` | `false` | 避免 WebView 橡皮筋抢手势 |
| `ios.backgroundColor` | `#0b1020` | 与 frame 背景一致 |

### 3.3 设计尺寸 (`viewport.js` + CSS)

| 常量 | 值 | 含义 |
|------|-----|------|
| `DESIGN_WIDTH` | 393 | 逻辑宽（约 iPhone 15 Pro） |
| `DESIGN_HEIGHT` | 852 | 逻辑高 |
| `DESIGN_SAFE.top` | 59 | 桌面模拟灵动岛+状态栏 |
| `DESIGN_SAFE.bottom` | 34 | 桌面模拟 Home 指示条 |

**改尺寸必须两边一起改**，否则 letterbox 与 safe 模拟不一致。

---

## 4. 布局与 Safe Area

### 4.1 两套模式

| 模式 | 触发 | 行为 |
|------|------|------|
| 桌面 Web | 非 Capacitor native | CSS contain 393:852；`--safe-*` 用模拟值 |
| iOS App | `body.native-app` | 全屏去圆角；`--safe-*` = `env(safe-area-inset-*)` |

### 4.2 职责划分

- **`#stage`**：3D 全出血（可以画到岛后面，允许）。  
- **`#hud`**：所有可点/可读 UI；padding = safe + 额外 `ui-pad`。  
- **禁止**：把按钮 `position: fixed; top: 0` 贴浏览器顶（会穿过 letterbox 和岛）。

### 4.3 调试

```js
document.body.classList.add('debug-safe-area')
```

虚线框 = 安全内容区。

---

## 5. WebGPU

- 入口：`createRenderer()` → `three/webgpu` 的 `WebGPURenderer`。  
- **无** `navigator.gpu` → `showFatal`，不静默回退 WebGL（底座策略：问题暴露要早）。  
- 尺寸：**不要**用 `window.innerWidth/Height` 作为主分辨率；用 `getFrameSize()` / `resizeToFrame()`。  
- 像素比：默认 `min(devicePixelRatio, 2)`。

---

## 6. NativeHaptics

### 6.1 JS API（`native-haptics.js`）

```js
const h = createNativeHaptics({ enabled: true });
await h.prepare();
await h.playTransient({ intensity: 0~1, sharpness: 0~1 });
await h.startContinuous({ intensity, sharpness });
await h.updateContinuous({ intensity, sharpness });
await h.stopContinuous();
```

非 iOS App：`{ ok: false, reason: 'not_native_ios' }`。

### 6.2 iOS（`NativeHapticsPlugin.swift`）

- Core Haptics 优先；失败则 UIKit `UIImpactFeedbackGenerator`。  
- 注册方式：`BridgeViewController.capacitorDidLoad` → `registerPluginInstance`。  
- Storyboard：`customClass="BridgeViewController" customModule="App"`。

### 6.3 真源 vs 生成物

| 真源（改这里） | 运行时副本 |
|----------------|------------|
| `plugins/native-haptics/*.swift` | `ios/App/App/*.swift` |

改插件后执行 `npm run ios:bootstrap`（或至少复制 + `cap sync`）。

业务层应在 **各自游戏代码** 里组合上述 API，不要改插件除非要新增原生方法。

---

## 7. iOS 工作流

### 首次

```bash
npm install
npm run ios:bootstrap
npm run cap:open
```

### 日常 Web 改动上真机

```bash
npm run cap:sync   # = build + cap sync ios
# Xcode ⌘R
```

### Xcode 检查

1. Signing → Team  
2. Bundle ID 与 `appId` 一致  
3. 真机设备  
4. 震动按钮自测  

`bootstrap-ios.mjs` 会：缺 `ios/` 时 `cap add ios`、复制 Swift、改 Main.storyboard、修补 pbxproj、`cap sync`。

---

## 8. 依赖版本（锁定意图）

| 包 | 意图 |
|----|------|
| `three` ^0.173 | WebGPU / TSL 可用的稳定世代 |
| `@capacitor/*` ^8.1 | SPM 模板 iOS 15+ |
| `vite` ^5.4 | 开发与构建 |

升级 Three 大版本时：回归 WebGPU init、GLTF/NodeMaterial（若业务已加）、真机。

---

## 9. 从本底座开新项目

```bash
cp -R three-webgpu-cap-shell ../MyGame
cd ../MyGame
rm -rf .git && git init
# 编辑 capacitor.config.json → appId / appName
npm install
npm run dev
# 玩法写在 src/main.js 或 src/game/*
# 保留 create-renderer / viewport / native-haptics / plugins
```

---

## 10. 已知限制与坑

1. **WebGPU iOS**：系统/WebView 支持因版本而异；无 GPU 时 shell 直接报错。  
2. **绝对路径**：任何时候不要改回 `base: '/'` 除非放弃 Capacitor 离线包。  
3. **contentInset automatic**：会与 CSS safe-area 叠出黑边/高度错误。  
4. **pbxproj**：手工乱改易坏；优先 bootstrap 脚本。  
5. **dist / ios/.../public**：构建产物；以源码为准。  
6. **appId com.example.***：仅脚手架；真机签名请换成自己的 ID。

---

## 11. 变更日志（底座级）

| 日期 | 变更 |
|------|------|
| 2026-07-28 | 初版：WebGPU shell + Capacitor iOS + NativeHaptics + letterbox + Dynamic Island safe-area + 文档入口 |

（产品功能变更请写在各自游戏仓库，不堆在本文件。）
