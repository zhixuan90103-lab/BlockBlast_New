# three-webgpu-cap-shell

可复用的 **Three.js + WebGPU + Vite + Capacitor iOS** 基础外壳，内置自研 **NativeHaptics**（Core Haptics）插件。

从拼豆 Studio / craftlinks 技术栈沉淀：只保留「能 dev、能打包、能真机、能震动」的骨架，不带具体玩法。

---

## 目录

```
three-webgpu-cap-shell/
├── src/
│   ├── main.js              # 最小 WebGPU 场景 + 震动测试 UI
│   ├── create-renderer.js   # WebGPURenderer 初始化
│   └── native-haptics.js    # JS 侧通用震动 API
├── plugins/native-haptics/  # iOS Swift 插件源文件
├── scripts/bootstrap-ios.mjs
├── capacitor.config.json
├── vite.config.js           # base: './' 适配 Capacitor
└── package.json
```

---

## 1. Web 开发

```bash
cd three-webgpu-cap-shell
npm install
npm run dev
# 默认 http://127.0.0.1:5190/
```

改 `src/main.js` 即可换成你的游戏逻辑；保留 `create-renderer.js` 与 `native-haptics.js`。

---

## 2. 变成你自己的项目

```bash
# 若从本仓库复制出去
rm -rf .git
git init
git add .
git commit -m "init from three-webgpu-cap-shell"

# 改 App 标识
# capacitor.config.json → appId / appName
```

---

## 3. Capacitor iOS（含震动插件 + 真机）

### 首次（推荐一条命令）

```bash
npm install
npm run ios:bootstrap   # build + cap add ios（如需）+ 注入 NativeHaptics + cap sync
npm run cap:open        # 打开 Xcode
```

### 日常迭代

```bash
npm run cap:sync        # build dist → sync 到 ios
# 或
npm run ios             # sync + open Xcode
```

### Xcode 真机打包检查清单

1. **Signing & Capabilities**
   - Team 选你的 Apple 开发者账号  
   - Bundle Identifier 不要用别人的（改 `capacitor.config.json` 的 `appId` 后重新 `cap sync`，并在 Xcode 确认 `PRODUCT_BUNDLE_IDENTIFIER`）
2. 顶部设备选 **真机**（非仅 Generic iOS Device）
3. Run（⌘R）
4. 首次真机：信任开发者证书（设置 → 通用 → VPN 与设备管理）
5. 点 HUD 上的震动按钮验证 Core Haptics

### 等价手动流程（与你笔记一致）

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios
npx cap init          # 本仓库已写好 capacitor.config.json，可跳过
npx cap add ios
npm run build
# 再执行 npm run ios:bootstrap 注入插件，或手动复制 plugins/native-haptics/*.swift
npx cap sync
npx cap open ios
```

---

## 4. 复用到其他项目

| 要带走的 | 路径 |
|----------|------|
| WebGPU 渲染入口 | `src/create-renderer.js` |
| 震动 JS API | `src/native-haptics.js` |
| 震动原生实现 | `plugins/native-haptics/*.swift` |
| Capacitor 路径配置 | `vite.config.js` 的 `base: './'` + `webDir: "dist"` |
| iOS 接入脚本 | `scripts/bootstrap-ios.mjs` |

建议：每个新游戏 **复制整个 shell 目录** 后改 `appId`，再在 `src/main.js` 写玩法。  
拼豆专属的吸豆/放豆/熨烫震动曲线应写在业务层，不要塞回 shell。

---

## 5. 重要限制

| 点 | 说明 |
|----|------|
| WebGPU | 无 `navigator.gpu` 会直接提示失败（不做静默 WebGL 回退） |
| 震动 | 仅 **iOS 原生 App** 生效；Safari/Chrome 桌面预览返回 `not_native_ios` |
| 路径 | 必须 `base: './'`，否则 Capacitor 加载 `/assets` 失败 |
| Team | 真机签名必须在 Xcode 绑定你的 Development Team |

---

## 6. 与拼豆工程的关系

- **拼豆** `Threejs_Work/ThreeJS`：完整产品  
- **本 shell**：可复制的最小底座（渲染 + 打包 + 震动插件）  
- **Bead/three-tsl-webgpu**：早期模板实验，不作为正式底座

本地预览：`npm run dev` → http://127.0.0.1:5190/
