# 发块推送逻辑（重构版）

**代码：** `src/game/deal/`  
**入口：** `src/game/pieces.js`（re-export）  
**常量：** `defaults.js` 的 `DEAL_*`

---

## 原则

1. **每轮只根据当前盘面**生成 3 块（`grid.snapshot()`）。  
2. **禁止**跨 tray 预定 / 续谱。  
3. 玩家摆完 → 盘变了 → 下一轮重新 roll。  
4. 可放保证：存在放置顺序（可中间消线）。

---

## 模块

| 文件 | 职责 |
|------|------|
| `board-ops.js` | fits / 模拟放置消线 / 顺序可解 / instant 计数 |
| `phase.js` | early·mid·late、回跳、族权重 |
| `sample.js` | 按当前空位 + 尺寸节奏采样 tray |
| `size-rhythm.js` | 大/中/小块配方（S/M/L）与阶段节奏 |
| `shape-class.js` | 形状类：方块 / 横条 / 竖条 / 转角 / Z / T |
| `clear-tray.js` | 可选：本 tray 三步清屏（仅当前盘） |
| `generate.js` | 总控 + `lastDealMeta` |

---

## 阶段

| 阶段 | 填充率 | 立刻可放 | 策略 |
|------|--------|----------|------|
| **early** | 低 | 3 | 能放 + 尺寸节奏偏 **L/M**（如 L+L+M）；有时本 tray 三步清屏 |
| **mid** | 中 | ≥2 | 能放 + **S/M/L 混搭** + 至少一块碎块；低概率清屏 |
| **late** | 高 | 1 | 能放 + 偏 **S/M**，偶夹 L；可回跳松气 |

### 尺寸档

| 档 | 格数 | 例子 |
|----|------|------|
| **S** | 2–3 | 2 直、短 L、缺角 |
| **M** | 4–5 | 2×2、T、Z、4 直、长 L |
| **L** | 6–9 | 3×2、3×3 |

### 形状类（与尺寸交叉）

| 类 | 含义 |
|----|------|
| **rect** | 实心矩形（2×2 / 3×2 / 3×3） |
| **bar_h** | 横向长条 |
| **bar_v** | 竖向长条 |
| **corner** | 转角 L / 缺角 |
| **skew** | Z/S 斜连 |
| **tee** | T 形 |

tray 要求至少 **2 种不同形状类**；禁止三横条、三竖条、三转角等同质推送。

---

## 单轮流程

```
fill = occupied/64
basePhase = f(fill)
phase = breathe(basePhase)     // 概率回跳

if early:
  maybe clearTray(current board)  // 恰好 3 步全空
  else fitTray(greedy large)

if mid:
  maybe clearTray
  else instantTray(prefer scrap)

if late:
  fitTray(instant ≈ 1)

fallback: guaranteed order-solvable
```

---

## 调参

面板「发块节奏」：阶段开关、填充阈值、回跳、大块/碎块权重、清屏填充上限与中期清屏概率。

调试：`lastDealMeta`（phase / mode / instant / fill）。
