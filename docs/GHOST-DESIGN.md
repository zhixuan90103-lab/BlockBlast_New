# 投影（Ghost）系统设计

> **SSOT**：行为以 `src/game/feel/ghost-policy.js` + `drag-session.js` 为准。  
> 常量真源：`src/game/defaults.js`（`FEEL_GHOST_*` · `FEEL_AXIS_*` · 抬升相关）。  
> 渲染：`view.js` 只画合法 ghost / tray 阴影，**不决定格坐标**。  
> 关联：[FEEL-DESIGN.md](./FEEL-DESIGN.md) · [PROJECT-HISTORY.md](./PROJECT-HISTORY.md) §13–§14

---

## 1. 设计目标（玩家可感知）

| 目标 | 含义 |
|------|------|
| **跟本体** | 影子由**块的视觉位置**驱动；本体过格中线才换格，不「影先到格」 |
| **跟方向** | 斜拖优先对角格；抑制「先横再斜」的中间投影 |
| **稳定** | 停在格子中间时影子不左右连闪 |
| **卡边粘** | 邻格不可放时，需拖够 **1.3 格** 才尝试换影 |
| **不甩影** | 影相对 free 切比雪夫距离 ≤ `FEEL_GHOST_MAX_LAG`，否则灭影 |
| **只合法** | 非法格不画影；松手只在 `fits` 时落子 |
| **横竖意图** | 横拖优先左右；竖拖优先上下；抬升不因横移误抬 |

历史问题（已并入规则）：

| 旧现象 | 现规则 |
|--------|--------|
| 横拖投影上跳 | 抬升**仅**计手指上移 |
| 居中左右连闪 | 半格量化 + 小滞回；禁止裸 `Math.round` 踩线 |
| 影飞太远 | lag > `MAX_LAG` → 灭影（不钳盘边救命） |
| 影提前钉格 / open=0.28 | 开阔 **0.5 半格** 跟本体 |
| 斜拖先出横影再斜影 | 操作方向过滤 + 对角优先（§4.5） |
| 卡边一点就挤过去 | `EDGE_HOLD = 1.3`（§4.1） |

---

## 2. 概念

```
手指位移 ──► drag-session（积分 + 抬升 + intentDx/Dy）──► 块视觉 origin
                                              │
                                              ▼
                              free (浮点格) = 形状底排 → 想落点
                                              │
                     ┌────────────────────────┼────────────────────────┐
                     ▼                        ▼                        ▼
              开阔：半格换格           卡边：≥1.3 格换格           斜向：对角优先
                     └────────────────────────┼────────────────────────┘
                                              ▼
                              sticky (整数 origin) ──► view 画合法投影
```

| 名词 | 定义 |
|------|------|
| **free** | 视觉 origin + 形状**最底一排**中心 → 浮点目标原点 |
| **sticky** | 当前钉住的整数投影原点 |
| **lag** | `max(∣freeCol−col∣, ∣freeRow−row∣)` |
| **engage** | 底排与棋盘矩形重叠才显示投影（`FEEL_BOARD_ENGAGE_OVERLAP`，默认 0） |
| **open** | 该方向邻格 `fits` → 换格阈值约 **半格** |
| **edge / 卡边** | 该方向邻格不可放 → 阈值 **1.3 格** |
| **intent** | `intentDx/Dy`（指移 EMA）+ free 相对 sticky → `h` / `v` / `diag` |

两种「阴影」勿混：

| 名称 | 代码 | 含义 |
|------|------|------|
| **落点投影** | `addBoardGhost` / ghost-policy | 拖到盘上的合法预览格（半透明块） |
| **Tray 扁影** | `addTrayPieceShadow` | 摆放区块脚下轮廓影（深色半透明 mesh） |

---

## 3. 与抬升的边界（drag-session）

投影 free 来自**视觉块位置**，抬升会改变 free 的行。

**产品规则：抬升 travel 只统计「相对拿起点的上移」。**

- 横移、斜移的水平分量**不**计入抬升。  
- 相关：`FEEL_DRAG_OFFSET_Y_MIN/MAX` · `FEEL_DRAG_LIFT_TRAVEL_CELLS` · `FEEL_DRAG_LIFT_POWER`。

**操作方向**：每帧 `samplePointer` 更新

```text
intentDx/Dy ← EMA(本帧指移 / cell)
```

供 ghost-policy 做斜向过滤（§4.5）。

---

## 4. 决策流水线（resolve）

```
1. 未 engage → 无影，清 sticky
2. 算 free（本体底排）
3. 无 sticky → free 邻域吸附建立 sticky
4. lag > MAX_LAG 或 sticky 非法 → free 重吸
5. 快精且 lag 偏大 → free 重吸
6. 各向「钉住」判定：
     开阔方向：|Δ| < 0.5+hyst → 保持
     卡边方向：|Δ| < EDGE(1.3) → 保持
7. 已超方向阈值 → sticky 步进（open/edge + 方向过滤）
8. 步进失败 → free 吸附兜底（仍带方向惩罚）
9. 全程 gate：lag > MAX_LAG → 灭影
```

### 4.1 开阔 vs 卡边阈值

| 方向邻格 | 阈值（相对 sticky，格） | 玩家感受 |
|----------|-------------------------|----------|
| **可放 (open)** | ≈ `OPEN_SNAP`(0.5) + 小 hyst | 本体过中线，影马上切 |
| **不可放 (edge)** | `EDGE_HOLD` = **1.3**（= EDGE_MIN，不被速度压低） | 卡边要拖够才换影 |

`MAX_LAG` 须 **> EDGE_HOLD**（出厂 1.45），否则未拖满 1.3 就灭影。

### 4.2 半格量化 + 滞回

| 参数 | 作用 |
|------|------|
| `FEEL_GHOST_OPEN_SNAP` | 开阔基础（出厂 **0.5**） |
| `FEEL_GHOST_SNAP_HYST` / `MIN` | 防抖；宜小以保证「到格即切」 |
| `quantizeWithHyst` | sticky 存在时：跨 `±(0.5+h)` 才 ±1 格 |

禁止：在半格处用裸 `Math.round` 导致 n↔n+1 连闪。

### 4.3 轴向意图

| 场景 | 规则 |
|------|------|
| sticky 步进 | `FEEL_AXIS_DOMINANCE`；横/竖差明显锁主轴 |
| free 邻域 | 横意图优先同排；竖意图优先同列 |
| 斜意图 | 见 §4.5，**不**锁死成纯 h/v |

### 4.4 快 / 慢

| 模式 | 条件 | 行为 |
|------|------|------|
| 快精 | 指速 ≥ `SPEED_REF × FAST_SPEED_RATIO` | 更易 free 重吸 |
| 慢贴 | 否则 | open/edge 钉住 + sticky 步进 |

开阔 open 有下限（~0.48），**禁止**再被乘到 0.1 导致影提前跳。

### 4.5 操作方向过滤（斜拖）

| 规则 | 说明 |
|------|------|
| 意图类 | `moveIntentClass`：`h` / `v` / `diag` / `both`（指移 EMA + free 位移） |
| `FEEL_GHOST_DIAG_RATIO` | min/max 轴分量比 ≥ 该值 → **diag**（出厂 0.42） |
| `FEEL_GHOST_DIAG_MINOR` | 斜移时次轴至少该分量才强制对角（出厂 0.22） |
| 斜移步进 | 仅一轴跨阈且次轴仍小 → **保持 sticky**（不出横/竖中间影） |
| 斜移候选 | **先对角**；对角不可放 → 保持或 free 重吸；强罚纯横/竖邻格 |
| 逆行过滤 | 与 intent/free 方向点积为负的候选丢弃 |

验收：左上/右上等斜拖时，影应贴近斜向目标，不应先横移一格再斜切。

### 4.6 Max lag

`chebyshev(free, sticky) > FEEL_GHOST_MAX_LAG` → 投影 null。  
**禁止** free 钳盘边「救命」。

---

## 5. 出厂参数（摘要，以 defaults.js 为准）

| 常量 | 出厂 | 产品含义 |
|------|------|----------|
| `FEEL_GHOST_ALPHA` | 0.15 | 合法投影透明度 |
| `FEEL_GHOST_OPEN_SNAP` | **0.5** | 开阔半格跟本体 |
| `FEEL_GHOST_OPEN_CORRIDOR_MUL` | **1.0** | 不再压低 open |
| `FEEL_GHOST_SNAP_HYST` / `MIN` | **0.06** / **0.04** | 小滞回 |
| `FEEL_GHOST_EDGE_HOLD` / `MIN` | **1.3** / **1.3** | 卡边 1.3 格 |
| `FEEL_GHOST_MAX_LAG` | **1.45** | 须 > EDGE |
| `FEEL_GHOST_DIAG_RATIO` | **0.42** | 斜向判定 |
| `FEEL_GHOST_DIAG_MINOR` | **0.22** | 斜向次轴门槛 |
| `FEEL_GHOST_FAST_*` | 0.36 / 0.55 | 快精 |
| `FEEL_AXIS_DOMINANCE` | 0.05 | 横竖主导 |
| 抬升 | 仅上移 travel | 横拖不抬块 |

调参面板「操作手感·投影」：开阔阈值 · 滞回 · 边缘粘滞 · 影-块距离 · 快精 · 轴向 · **斜向比例 / 次轴门槛**。

---

## 6. 模块边界

| 文件 | 职责 |
|------|------|
| `feel/ghost-policy.js` | engage · free · sticky · open/edge · 方向过滤 · maxLag · preclear |
| `feel/drag-session.js` | 拿起、增益、积分、**抬升（仅上移）**、`intentDx/Dy`、视觉平滑 |
| `feel/haptics-ghost.js` | 换格震 / 将消 / 消除 3 波 |
| `view.js` | 画 ghost 与 tray 扁影；对象池见 HISTORY §14 |
| `game.js` | 每帧 `resolve`；松手 `fits` commit |

---

## 7. 验收清单

1. **横拖**：影主要左右；不因横移整体上跳。  
2. **居中停住**：影不左右连闪。  
3. **本体过中线（开阔）**：影及时切邻格。  
4. **卡边**：未拖满约 1.3 格影不轻易挤走。  
5. **斜拖**（左上/右上等）：无「先横后斜」中间影；对角优先。  
6. **甩太远**：影灭，不飞到远处合法格。  
7. **快滑**：能跟上；停稳后回粘滞。

---

## 8. 演进约定

- 改投影行为：先改本文 §1–§5 与 `defaults` 注释，再改 `ghost-policy` / `drag-session`。  
- 真机新现象：优先判断「参数」还是「违反 §1」；违反则改规则表。  
- **禁止恢复**：横移计入抬升、半格无滞回、free 钳盘边、open≪0.5 提前钉格、斜拖优先纯轴中间格。  
