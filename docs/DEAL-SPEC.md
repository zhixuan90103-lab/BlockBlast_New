# 发块推送 · 现行行为（重构后）

**状态：** v3.1 · 2026-07-30（**局面助清** + **payoff 优先**；默认关闭按轮数打卡）  
**入口：** `deal/pipeline.js` → `generateTray`  
**数值：** `defaults.js`  
**完整规格 SSOT：** [DEAL-PUSH-COMPLETE.md](./DEAL-PUSH-COMPLETE.md)  
**重构设计：** [DEAL-REFACTOR-DESIGN.md](./DEAL-REFACTOR-DESIGN.md) · 调研 [research/CLEAR-PLAYER-RESEARCH.md](../../research/CLEAR-PLAYER-RESEARCH.md)

---

## 0. 共识

| 术语 | 定义 |
|------|------|
| **清屏** | 结算后整盘全空（All Clear） |
| **大消 payoff** | 一块落下多线同消（不必全空） |
| **空腔补缺** | 按缺口推 L/T 等嵌洞 |
| **G2** | 三块各自当前可放（主路径默认） |
| **G3** | 存在放置顺序全可放（`DEAL_ORDER_GUARANTEE`，默认关） |

### 0.1 阶段推送手感（产品总结 · 冻结）

| 阶段 | 推送方式 | 清屏 | 大范围消除 |
|------|----------|------|------------|
| **前期 early** | 尽量 **大范围摆放**（偏大块）+ 形状多样（方/条/T/L） | **偶尔** | **多**（payoff 更勤） |
| **中期 mid** | 中块为主，加压 | **少量** | **少量** |
| **后期 late** | 压力、可放收紧 | **更稀** | **更稀** |

节奏目标：**前期好摆好消、偶发清空释放 → 中期收紧大消/清屏形成压力 → 后期高压**。  
**按当前分数切阶段**（默认 `score < 1000` early / `< 4000` mid / else late + 呼吸回跳）。  
盘面 fill / boardClass 仍用于助清、门控等，与阶段正交。

### 0.2 局面 class（`board-state.js`）

`empty | healthy | setup | fragmented | choke` → 门控全清/payoff/cavity；见 `lastDealMeta.boardClass`。

---

## 1. 管线意图顺序

```
snapshot 当前盘 → classifyBoardState
  → 1 payoff-multi（铺局/近满线优先；续推清屏时让路）
  → 2 续推清屏 / 压力助清(choke·碎片+概率) / 收官全清(低fill彩蛋)
       ※ 默认不再「每 N 轮必福利」；DEAL_ASSIST_USE_INTERVAL 可开回旧行为
  → 3 cavity-guide（碎片/窒息）
  → 4 稀有阶段全清 × 局面系数
  → 5 主采样（默认 G2）
  → 6 fallback
```

助清/全清/钥匙 **看盘面**；阶段 early/mid/late 仍可按 **分数** 切块型压力（与助清正交）。

---

## 2. 模块

| 文件 | 职责 |
|------|------|
| `pipeline.js` | 意图编排 + `generateTray` |
| `session.js` | 签名、beat、清屏续推 |
| `accept.js` | 主路径 / 特殊 / payoff 验收 |
| `policy.js` | tune+defaults 政策 |
| `payoff-match.js` | 多线钥匙块 |
| `cavity-match.js` | 空腔补缺 |
| `clear-tray.js` | 全清/减占搜索 |
| `sample.js` | 主采样 |
| `bag / phase / size / shape / fit / board-neat` | 内容层 |

---

## 3. 关键 mode

| mode | 含义 |
|------|------|
| `payoff-multi` | Setup 大消钥匙 |
| `cavity-guide` | 补缺口 |
| `assist-full-clear` / `early-clear` / `clear-retry` | 清屏向（有全空解） |
| `assist-clear` | 仅减占 |
| `early-size` / `mid-*` / `late-size` | 普通 |
| `fallback` / `fallback-dot` | 兜底 |

---

## 4. 回归

```bash
npm run deal:hist
npm run deal:hist:quick
```

---

**维护：** 改意图顺序只动 `pipeline.js`；改数值动 `defaults.js`。
