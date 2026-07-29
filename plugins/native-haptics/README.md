# NativeHaptics（iOS Core Haptics）

本底座内置的 Capacitor 本地震动插件。

**工程总览：** [../../AGENTS.md](../../AGENTS.md) · [../../docs/ENGINEERING.md](../../docs/ENGINEERING.md)

## 真源

| 文件 | 作用 |
|------|------|
| `NativeHapticsPlugin.swift` | Core Haptics + UIKit fallback |
| `BridgeViewController.swift` | `registerPluginInstance(NativeHapticsPlugin())` |

运行时副本在 `ios/App/App/`。**改插件请改本目录**，再执行：

```bash
npm run ios:bootstrap
```

## JS API

```js
import { createNativeHaptics } from '../../src/native-haptics.js';

const haptics = createNativeHaptics({ enabled: true });
await haptics.prepare();
await haptics.playTransient({ intensity: 0.5, sharpness: 0.4 });
await haptics.startContinuous({ intensity: 0.15, sharpness: 0.2 });
await haptics.updateContinuous({ intensity: 0.4, sharpness: 0.3 });
await haptics.stopContinuous();
```

`intensity` / `sharpness` 仅 **clamp 到 [0,1]** 后直通 Core Haptics（单次 transient，无 boost、无双脉冲合成）。

| 环境 | 行为 |
|------|------|
| iOS App | Core Haptics / Impact 回退 |
| 桌面 / 浏览器 | `{ ok: false, reason: 'not_native_ios' }` |

## 注册链

`Main.storyboard` → `BridgeViewController` → `capacitorDidLoad` → 插件实例。

Storyboard 必须是 `customClass="BridgeViewController" customModule="App"`（bootstrap 会写）。
