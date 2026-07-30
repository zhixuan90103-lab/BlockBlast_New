# 入口与调用链

打开本文件可快速定位「从哪里启动、谁调用谁」。

---

## 1. 命令入口

| 命令 | 脚本 | 结果 |
|------|------|------|
| `npm run dev` | `vite` | 本地 Web，默认 **http://127.0.0.1:5190/** |
| `npm run build` | `vite build` | 产出 `dist/`（相对路径资源） |
| `npm run preview` | `vite preview` | 预览 dist |
| `npm run cap:sync` | `build` + `cap sync ios` | Web → iOS `App/public`（口语「打包」） |
| `npm run cap:open` | `cap open ios` | 打开 Xcode |
| `npm run ios` | sync + open | 日常上机 |
| `npm run ios:bootstrap` | `scripts/bootstrap-ios.mjs` | 首次/修复 iOS + 插件 |

---

## 2. Web 启动链

```
index.html
  ├─ src/style.css
  └─ src/main.js
        ├─ applyNativeClass() / applyShellLayout()     ← viewport.js
        ├─ createRenderer({ container: #stage })       ← create-renderer.js
        │     └─ three/webgpu WebGPURenderer
        ├─ createNativeHaptics()                       ← native-haptics.js
        ├─ createGame({ stage, hud, renderer, haptics })  ← game/game.js
        │     ├─ grid / deal / score / view
        │     ├─ feel/drag-session · ghost-policy · haptics-ghost
        │     ├─ clearFx 消行编排（缩转 + 触发震动）
        │     └─ deathFx 死亡演出 → game-over overlay
        ├─ createFeelPanel({ onChange → game.applyTune })
        │     └─ 手感1/2 ← feel-presets.js（默认手感1）
        └─ bindShellResize / scheduleStableLayout
```

**改玩法：** `src/game/*`。  
**保留：** `create-renderer.js` / `viewport.js` / `native-haptics.js` 契约。

---

## 3. DOM 入口

```html
#letterbox
  #phone-frame          ← getFrameSize() 量这里
    #stage              ← canvas 父节点
    #hud                ← 分数等安全区 UI（不含全屏结算）
    .death-flash[data-death-flash]   ← 死亡开场闪红（盖 stage+hud）
    .game-over[data-game-over]       ← 全屏半透结算 + Play Again
    #feel-panel         ← 左下手感预设 + 右下调参（动态挂载）
```

| 选择器 / data | 谁写入 | 谁读取 |
|---------------|--------|--------|
| `#stage` | `createRenderer` append canvas | 无 |
| `#phone-frame` | CSS / `applyShellLayout` | `getFrameSize` · feel-panel mount · overlay 根 |
| `#hud` | game HUD 分数 | CSS safe padding |
| `[data-game-score]` | `game.js` syncHud | 展示 |
| `[data-death-flash]` | `game.js` setDeathFlash | CSS 动画 `.is-active` |
| `[data-game-over]` | `game.js` setGameOver | 可见性 / 锁输入 |
| `[data-final-score]` | `game.js` startDeathFx | 展示本局分 |
| `[data-restart]` | 用户点击 | `game.js` restart |
| `#feel-panel` | `createFeelPanel` | 指针 stopPropagation |
| `body.native-app` | `applyNativeClass` | CSS 真机规则 |

**注意：** death-flash / game-over **不要**塞回 `#hud`，否则安全区内边距与「全屏盖住盘面」会冲突。

---

## 4. iOS 原生入口

```
Xcode Run
  → AppDelegate
  → Main.storyboard → BridgeViewController (CAPBridgeViewController)
       → capacitorDidLoad
            → registerPluginInstance(NativeHapticsPlugin)
       → 加载 App/public/index.html（= dist 同步结果）
            → 同上 Web 启动链
```

插件方法名（JS ↔ Swift）：

| JS | Swift `@objc` |
|----|----------------|
| `prepare` | `prepare` |
| `playTransient` | `playTransient` |
| `startContinuous` | `startContinuous` |
| `updateContinuous` | `updateContinuous` |
| `stopContinuous` | `stopContinuous` |

---

## 5. 配置入口

| 要改… | 改这个文件 |
|--------|------------|
| 端口 / base / 构建目标 | `vite.config.js` |
| Bundle ID / 应用名 / contentInset | `capacitor.config.json` |
| 设计分辨率 / 桌面 safe 模拟 | `src/viewport.js` **且** `src/style.css` |
| 启动页文案 / HUD / 死亡与结算结构 | `index.html` + `style.css` |
| 震动原生实现 | `plugins/native-haptics/NativeHapticsPlugin.swift` 后 bootstrap |
| App Icon | `assets/icon-1024.png` → 同步 iOS `AppIcon` 资源 |
| 忽略规则 | `.gitignore` |

---

## 6. 文档入口（给「每个新窗口」）

| 读者 | 先读 |
|------|------|
| AI Agent / 新 Cursor·Grok 会话 | **[AGENTS.md](../AGENTS.md)** |
| 人类第一次 clone | **[README.md](../README.md)** |
| 文档地图 | **[README.md](./README.md)**（docs 索引） |
| 深挖设计/坑 | **[ENGINEERING.md](./ENGINEERING.md)** |
| 实现与问题纪要 | **[PROJECT-HISTORY.md](./PROJECT-HISTORY.md)** |
| 手感问题→不变量 | **[FEEL-DESIGN.md](./FEEL-DESIGN.md)** |
| 发块完整规格 | **[DEAL-PUSH-COMPLETE.md](./DEAL-PUSH-COMPLETE.md)** |
| 只查入口链 | **本文件** |
| 震动插件 alone | [plugins/native-haptics/README.md](../plugins/native-haptics/README.md) |
