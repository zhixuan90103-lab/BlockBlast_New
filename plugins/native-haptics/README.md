# NativeHaptics（iOS Core Haptics）

从拼豆 Studio 抽离的可复用 Capacitor 本地插件。

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

## 原生侧

- `NativeHapticsPlugin.swift` — Core Haptics + UIKit fallback
- `BridgeViewController.swift` — 手动 `registerPluginInstance`

接入：

```bash
npm run ios:bootstrap
```
