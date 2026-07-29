# 手感与投影设计（问题 → 约束）

迭代踩坑沉淀。实现见 `src/game/feel/*`；常量真源 `defaults.js`，运行时覆盖 `tune.js`。  
全景纪要（含布局/渲染/震动/里程碑）：[PROJECT-HISTORY.md](./PROJECT-HISTORY.md)。

## 1. 状态机

```
IDLE → PICKUP(固定槽姿态, 无投影, 无震动)
     → DRAGGING(指速积分 + 短平滑)
          ├ ghost null | valid hover
          └ pointerup → COMMIT(fits) | REJECT
```

## 2. 问题 → 不变量

| ID | 现象 | 不变量 / 规则 |
|----|------|----------------|
| P1 | 一点击假合法 | 禁止为「整块入盘」硬钳 free 原点；commit 仅 `grid.fits` |
| P2 | 非法红影/过实 | 合法才画 ghost；alpha 走 tune |
| P3 | 快滑不准 | 快：free 吸附；慢：edge hold |
| P4 | 块右影左 | free 远离 sticky → 强制 free；禁止退回远 sticky |
| P5 | 影飞远处 | free 邻域吸附；**影-free 切比雪夫 > `FEEL_GHOST_MAX_LAG`(≈1) → null**；禁止钳盘边救命 |
| P6 | 横拖上下跳 | 近距轴锁；lag>1.25 双轴 |
| P7 | 拿起点乱跳 | 三区命中 + 槽中心固定抬升 |
| P8 | 介入时机 | 形状**最底一排**占格进盘才 engage |
| P9 | 震动乱/双下 | 仅换格瞬态；key+冷却；原生单脉冲直通 |
| P10 | 首启高度错 | stable layout + safe 探针 |
| P11 | 调参不生效 | 布局 rebuild / 手感 paint |
| P12 | WebGPU index | BufferGeometry + mesh clone；模板勿 dispose |
| P13 | 外框圆角过大 | 盘圆角 = 格圆角平行外扩 |
| P14 | 空格缝过大 | BOARD_CELL_INSET ≈ tray |
| P15 | 拖累/延迟 | 指速增益 + 短平滑 |
| P16 | Vite 500 | JSDoc 禁止嵌套 `/**` |

## 3. 模块

| 模块 | 职责 |
|------|------|
| `feel/drag-session.js` | 拿起、指速增益、积分、平滑目标/视觉 |
| `feel/ghost-policy.js` | engage、free/sticky、快慢模、轴锁 |
| `feel/haptics-ghost.js` | 合法投影换格震动 |
| `game.js` | 规则循环、指针、commit、编排 |

## 4. Ghost 策略摘要

1. `!isBoardEngaged(bottomRow)` → null  
2. **硬约束**：`chebyshev(free, ghost) > FEEL_GHOST_MAX_LAG`（默认 1）→ null（影不许甩块）  
3. `fast || stickyLag>1.15` → `hoverFreeSnap`（round + 邻格，且须 ≤ maxLag）  
4. 慢近距 → open 0.5 / edge hold 步进（候选也须 ≤ maxLag）  
5. free 不可放或超 lag → null（**不**钳回盘边救命）  


## 5. 调参

- 布局 key：`LAYOUT_TUNE_KEYS` → `relayout`  
- 其余：`setTune` + `paint`  
- 默认值以 `defaults.js` 为准；面板「重置」读同一真源  
