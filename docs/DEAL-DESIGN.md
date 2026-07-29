# 发块推送（阶段难度）

实现：`src/game/pieces.js` · 常量：`defaults.js` `DEAL_*` · 调参：面板「发块节奏」。

## 目标体感

| 阶段 | 盘面 | instantFit（当前盘立刻可放） | 形状偏置 |
|------|------|------------------------------|----------|
| **early** | 填充率低 | **3 / 3** | 偏大块 + **清屏规划**：填充 &lt; `DEAL_EARLY_CLEAR_FILL_MAX` 时搜索 3～6 步可 board-empty 的序列，本 tray 发前 3 块；否则平均格数门槛 |
| **mid** | 中等 | **≥2**（最多 3） | 中性；略压 3×3 |
| **late** | 高 | **恰好 1** | Z/T/长条等；压大方块 |
| **呼吸** | late/mid | — | 概率回跳 early/mid，避免恒压 |

整 tray 仍要求 **顺序可解**（可中间消线）——`existsPlacementOrder`。

## 流程

```
fill = occupied / 64
basePhase = early | mid | late   // DEAL_FILL_* 阈值
phase = rollDealPhase(base)      // 回跳概率
拒绝采样：
  抽 3 块（相位权重 + 去重）
  或 贪心可放构建
  校验 instant ∈ [min,max] 且 orderSolvable
失败 → 放宽 instant → 旧版可放保证兜底
```

## 计分（未改）

见 `score.js`：落格分 + 消线×10×(combo+1) + 全清 300；combo = slide3。

## 调参入口

- 关阶段：`DEAL_PHASE_ENABLED = 0` → 仅旧可放保证  
- 填充切档：`DEAL_FILL_EARLY_MAX` / `MID_MAX`  
- 回跳：`DEAL_LATE_RELAX_*` / `DEAL_MID_RELAX_EARLY`  
- 权重：`DEAL_EARLY_NEAT_MUL` / `DEAL_LATE_AWKWARD_MUL`  

调试：`lastDealMeta`（game debug 状态行会打印）。
