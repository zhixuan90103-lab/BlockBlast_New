# Block Blast（three-webgpu-cap-shell）

**Block Blast! Classic 手感向复刻**：Three.js + **WebGPU** + Vite + **Capacitor iOS** + 自研 **NativeHaptics**。  
在可复用壳之上实现 8×8 盘、tray、拖放投影、消行反馈、阶段发块与真机调参。

桌面预览使用 **手机比例框（393×852）**；真机 App 全屏 + 系统 Safe Area。

---

## 文档入口（请按角色阅读）

| 文档 | 给谁 | 内容 |
|------|------|------|
| **[AGENTS.md](./AGENTS.md)** | AI / 新窗口 | 一页纸：入口、约定 |
| **[docs/README.md](./docs/README.md)** | 所有人 | **文档索引与规范** |
| **[docs/FEEL-DESIGN.md](./docs/FEEL-DESIGN.md)** | 改手感/消行/震动 | 问题→规则、预设 |
| **[docs/PROJECT-HISTORY.md](./docs/PROJECT-HISTORY.md)** | 查踩坑 | 里程碑与问题全表 |
| **[docs/DEAL-DESIGN.md](./docs/DEAL-DESIGN.md)** | 改发块 | 阶段难度 |
| **[docs/ENTRYPOINTS.md](./docs/ENTRYPOINTS.md)** | 查启动链 | 命令 / DOM / iOS |
| **[docs/ENGINEERING.md](./docs/ENGINEERING.md)** | 维护底座 | Capacitor / WebGPU |
| **本 README** | 人类上手 | 安装、dev、真机 |

> 新会话：**AGENTS.md → docs/README.md**，再按任务下钻。

---

## 本机路径

```text
/Users/wangzhixuan/Documents/Threejs_Work/BlockBlast/three-webgpu-cap-shell
```

---

## 30 秒上手

```bash
cd three-webgpu-cap-shell
npm install
npm run dev
# → http://127.0.0.1:5190/
```

应看到：竖屏框内的 Block Blast 盘面、分数 HUD、左下角 **手感1/2**、右下角 **调参**。

---

## 代码入口（最短）

```text
index.html
  └─ src/main.js
       ├─ createGame()           ← src/game/game.js
       ├─ createFeelPanel()      ← 调参 + 手感预设
       ├─ viewport / renderer / haptics
```

DOM 约定（勿拆）：

```text
#letterbox > #phone-frame > (#stage | #hud)
```

- `#stage`：3D canvas  
- `#hud`：分数与安全区 UI

---

## iOS 真机

```bash
# 首次（或插件/工程损坏时）
npm run ios:bootstrap
npm run cap:open

# 日常
npm run cap:sync    # build + sync
# Xcode：Team → 真机 → Run
```

| 配置点 | 位置 |
|--------|------|
| Bundle ID / 名 | `capacitor.config.json` → `appId` / `appName` |
| 相对资源路径 | `vite.config.js` → `base: './'` |
| 无双重 Safe Area | `ios.contentInset: "never"` |
| 震动原生真源 | `plugins/native-haptics/*.swift` |

占位 ID：`com.example.webgpushell` —— 长期开发请改成自己的。

---

## npm scripts

| 脚本 | 作用 |
|------|------|
| `dev` | Vite 开发服务器（5190） |
| `build` | 产出 `dist/` |
| `cap:sync` | build + 同步到 ios |
| `cap:open` | 打开 Xcode |
| `ios` | sync + open |
| `ios:bootstrap` | 添加/修复 iOS 工程并注入 NativeHaptics |

---

## 复用到新游戏

1. 复制整个 `three-webgpu-cap-shell` 目录  
2. 改 `appId` / `appName`，必要时重 init git  
3. 在 `src/main.js`（或 `src/game/*`）写玩法  
4. **保留** renderer / viewport / haptics / plugins / `base: './'`  

业务侧震动节奏（连击、反馈强弱等）写在游戏层，用 `createNativeHaptics()` 组合调用。

---

## 硬性约定（摘要）

1. Capacitor 必须用相对路径：`base: './'`  
2. UI 进 `#hud`，安全区用 `--safe-*`  
3. 渲染尺寸跟 `#phone-frame`，不要裸用整窗 `innerWidth`  
4. 无 WebGPU 则明确失败，不静默 WebGL  
5. 改 Swift 插件改真源后跑 `ios:bootstrap`  

细节与踩坑见 [docs/ENGINEERING.md](./docs/ENGINEERING.md)。

---

## License / 归属

私有脚手架；Three.js 与 Capacitor 遵循其各自许可证。
