# 发块推送（阶段难度）· 摘要

> **需求与重构：** [DEAL-REFACTOR-DESIGN.md](./DEAL-REFACTOR-DESIGN.md)  
> **行为摘要：** [DEAL-SPEC.md](./DEAL-SPEC.md) · [DEAL-RHYTHM.md](./DEAL-RHYTHM.md)  
> **常量：** `src/game/defaults.js` · 调参：面板「发块节奏」

## 目标体感

| 阶段 | 盘面 | instantFit | 形状偏置 |
|------|------|-----------|----------|
| **early** | 填充低 | **3 / 3** | 大/中块；概率/强制助清 |
| **mid** | 中等 | **≥2** | 中大混；少碎块 |
| **late** | 高 | **约 1** | 压力；贴合破局；偶微块 clutch |
| **呼吸** | late/mid | — | 概率回跳 early/mid |

整 tray 默认 **顺序可解**（`existsPlacementOrder`）。  
GO：**剩余块当前盘 instant 全死**（与发块保证正交）。

## 流程（极简）

```
fill → phase → [周期助清] → [概率全清] → 贴合采样验收 → fallback
```

## 计分

未改发块时计分；见 `score.js`。

## 调试

`lastDealMeta`：fill / phase / mode / instant / traysSinceAssist。
