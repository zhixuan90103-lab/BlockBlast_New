# 发块推送 · 短摘要（非完整规格）

> **完整规格 SSOT：** [DEAL-PUSH-COMPLETE.md](./DEAL-PUSH-COMPLETE.md)  
> **行为摘要：** [DEAL-SPEC.md](./DEAL-SPEC.md) · [DEAL-RHYTHM.md](./DEAL-RHYTHM.md)  
> **重构与需求 ID 史：** [DEAL-REFACTOR-DESIGN.md](./DEAL-REFACTOR-DESIGN.md)  
> **常量：** `src/game/defaults.js` · 调参：面板「发块节奏」  
> **代码入口：** `src/game/deal/pipeline.js` → `generateTray`

改发块 / 调阶段策略时：**先读 DEAL-PUSH-COMPLETE**，不要只改本摘要。

## 目标体感（一句话）

按 **当前 8×8 盘面** 推送 3 块：early 宽松可放 → mid 压力与释放 → late 贴合破局；整 tray 默认 **顺序可解**；GO 与发块保证正交（剩余块当前盘 instant 全死）。

| 阶段 | 盘面 | instantFit 倾向 | 形状偏置 |
|------|------|-----------------|----------|
| **early** | 填充低 | **3 / 3** | 大/中块；概率/强制助清 |
| **mid** | 中等 | **≥2** | 中大混；少碎块 |
| **late** | 高 | **约 1** | 压力；贴合破局；偶微块 clutch |
| **呼吸** | late/mid | — | 概率回跳 early/mid |

## 流程（极简）

```
fill → phase → [周期助清] → [概率全清] → Intent/局面门控采样 → fallback
```

现行能力还包括：局面分类、默认 G2、payoff/cavity intent 等——细节与验收见 **DEAL-PUSH-COMPLETE**。

## 计分

未改发块时计分；见 `score.js`。

## 调试

`lastDealMeta`：fill / phase / mode / instant / traysSinceAssist 等。
