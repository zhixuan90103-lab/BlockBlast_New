# 投影（Ghost）系统设计

> **SSOT**：行为以 `src/game/feel/ghost-policy.js` + `drag-session.js` 抬升为准。  
> 常量真源：`src/game/defaults.js`（`FEEL_GHOST_*` · `FEEL_AXIS_*` · 抬升相关）。  
> 本文把真机迭代中的「现象修补」固化为**可预期产品规则**，不再当零散 BUG 列表。  
> 关联：[FEEL-DESIGN.md](./FEEL-DESIGN.md) · [PROJECT-HISTORY.md](./PROJECT-HISTORY.md) §13.6–§13.7

---

## 1. 设计目标（玩家可感知）

| 目标 | 含义 |
|------|------|
| **跟手** | 影子落在「块想去的位置」附近，跟手指移动方向一致 |
| **稳定** | 停在格子中间时影子不左右连闪 |
| **不甩影** | 影子不能离块太远（像影飞到另一边） |
| **只合法** | 非法格不画影；松手只在 `fits` 时落子 |
| **横竖意图** | 横拖时优先左右换格，不因抬升/噪声误跳到上下格 |

历史问题（已并入规则，不再单独当「未修 bug」）：

| 旧现象 | 现规则 |
|--------|--------|
| 横拖投影上跳 | 抬升**仅**计手指上移；横意图 free 吸附优先同排 |
| 居中左右连闪 | 半格**死区 + 滞回**；sticky 量化不用裸 `Math.round` |
| 影飞太远 | 切比雪夫 lag ≤ `FEEL_GHOST_MAX_LAG` 否则灭影 |

---

## 2. 概念

```
手指位移 ──► drag-session（积分 + 抬升）──► 块视觉 origin (frameX/Y)
                                              │
                                              ▼
                              free (浮点格坐标 freeColF/freeRowF)
                              = 形状底排中心映射到盘面的「想落点」
                                              │
                                              ▼
                              sticky (整数 originRow/Col) ──► 合法投影格
```

| 名词 | 定义 |
|------|------|
| **free** | 由视觉 origin + 形状底排算出的**浮点**目标原点（可在两格之间） |
| **sticky** | 当前钉住的**整数**投影原点；换格带滞回 |
| **lag** | free 与 sticky 的切比雪夫距离（格）`max(∣Δcol∣,∣Δrow∣)` |
| **engage** | 形状**最底一排**与棋盘矩形有重叠才显示投影 |
| **open / edge** | 邻格可放 → 开阔换格阈值；邻格不可放 → 边缘粘滞阈值（更难挤过去） |

---

## 3. 与抬升的边界（drag-session）

投影 free 来自**视觉块位置**，故抬升会改变 free 的行。

**产品规则：抬升行程只统计「相对拿起点的上移」。**

- 横移、斜移的水平分量**不**计入抬升 travel。  
- 否则横拖会把块抬高 → free 上移 → 投影像「往上跳」（已否定的旧行为）。

相关：`FEEL_DRAG_OFFSET_Y_MIN/MAX` · `FEEL_DRAG_LIFT_TRAVEL_CELLS` · `FEEL_DRAG_LIFT_POWER`。

---

## 4. 决策流水线（resolve）

每帧顺序（实现与文档对齐）：

```
1. 未 engage → 无影，清 sticky
2. 算 free
3. 有 sticky 且 lag > MAX_LAG → free 邻域吸附（或 null）
4. 快速模式 或 lag 很大 → free 邻域吸附
5. 无 sticky → free 邻域吸附，建立 sticky
6. sticky 当前格不 fits → 清 sticky，free 吸附
7. 【死区】|free−sticky| 横竖均 < 0.5+HYST → 强制钉 sticky（居中稳定）
8. lag 较大且已离开死区 → free 重吸
9. 否则 sticky 步进：轴锁 + open/edge + HYST
10. 步进失败且朝向挡住 → 贴边粘滞（仍 ≤ MAX_LAG）
11. 否则 free 吸附兜底
12. 全程 gate：lag > MAX_LAG → 灭影
```

### 4.1 死区 + 滞回（稳定核心）

| 参数 | 作用 |
|------|------|
| `FEEL_GHOST_OPEN_SNAP` | 开阔方向「走出多远才想换格」（约半格） |
| `FEEL_GHOST_EDGE_HOLD` | 不可放方向更难挤过去 |
| `FEEL_GHOST_SNAP_HYST` | **滞回**：在 open/edge 上再加一段，避免半格处来回踩线 |

**死区**：`|freeCol−sticky.col| < 0.5+HYST` 且行同理 → 本帧不换格。  
**量化**：有 sticky 时 `quantizeWithHyst`，禁止在 `n.5` 用 `Math.round` 抖  n↔n+1。

玩家感受：停在格子中间，影子**钉住**；明显再往左/右，才换邻格。

### 4.2 轴向意图

| 场景 | 规则 |
|------|------|
| sticky 步进 | `FEEL_AXIS_DOMINANCE`：横差明显锁横轴，竖差锁竖轴 |
| free 邻域吸附 | 横意图：优先同排左右，斜向次之，纯竖最后；可钉 sticky 行只找列 |
| free 相对 sticky | `preferredSnapAxis`：只比 Δcol/Δrow，不因 lag 大就放弃轴偏好 |

### 4.3 快 / 慢 + 自适应灵敏度（2026-07-31）

| 模式 | 条件 | 行为 |
|------|------|------|
| 快精 | 指速 ≥ `SPEED_REF × FAST_SPEED_RATIO`（退出有滞回） | 直接 free 邻域吸附，少贴边 |
| 慢贴 | 否则且靠近 sticky | 自适应 open/edge + 死区 + 轴锁步进 |

**自适应因子**（`adaptiveThresholds`，叠在基础 open/edge/hyst 上）：

| 因子 | 规则 |
|------|------|
| **速度 T∈[0,1]** | 指速 / 快精进入速；慢→阈值略升、滞回略升；快→阈值降、滞回降（≥`HYST_MIN`） |
| **盘面邻格** | 意图方向 `fits` → open×`OPEN_CORRIDOR_MUL`（更灵）；不可放 → edge（≥`EDGE_MIN`，快时略松） |
| **死区缩放** | 快扫 `deadzoneScale` 略 &lt;1，避免快拖仍被钉死 |

验收：快扫及时跟；空旷慢拖也贴手；贴边/缝不乱跳、不肉。

### 4.4 Max lag（不甩影）

`chebyshev(free, ghostOrigin) > FEEL_GHOST_MAX_LAG` → 投影 null。  
**禁止**把 free 钳回盘边「救命」（会把影吸到远处格）。

---

## 5. 出厂参数（摘要，以 defaults 为准）

| 常量 | 典型默认 | 产品含义 |
|------|----------|----------|
| `FEEL_GHOST_OPEN_SNAP` | **0.28** | 开阔基础 |
| `FEEL_GHOST_OPEN_CORRIDOR_MUL` | **0.82** | 可放方向再灵敏 |
| `FEEL_GHOST_SNAP_HYST` / `MIN` | **0.14** / **0.06** | 滞回基础 / 下限 |
| `FEEL_GHOST_EDGE_HOLD` / `MIN` | **1.15** / **0.55** | 堵住粘滞 / 不卡死 |
| `FEEL_GHOST_MAX_LAG` | **1.3** | 影离块最远 |
| `FEEL_GHOST_FAST_*` | **0.36** / 0.55 | 快精与速度顶满 |
| `FEEL_AXIS_DOMINANCE` | 0.05 | 横竖轴判定 |
| 抬升 | 仅上移 travel | 横拖不抬块 |

调参面板分组「投影」：开阔换格阈值 · **换格滞回(防抖)** · 边缘粘滞 · 影-块最大距离 · 快精 · 轴向主导。

---

## 6. 模块边界

| 文件 | 职责 |
|------|------|
| `feel/ghost-policy.js` | engage · free · sticky · 死区/滞回 · 轴 · maxLag · preclear 数据 |
| `feel/drag-session.js` | 拿起、指速增益、积分、**抬升（仅上移）**、视觉平滑 |
| `feel/haptics-ghost.js` | 换格震 / 将消 / 消除 3 波（不读格子几何） |
| `view.js` | 画合法 ghost；不决定格坐标 |
| `game.js` | 每帧 `ghostPolicy.resolve`；松手 `fits` commit |

---

## 7. 验收清单（设计回归）

1. **横拖**：投影主要左右移动，不因横移整体上跳。  
2. **居中停住**：影子不连续左右闪（可微抖块，影应钉住）。  
3. **明显横移**：过死区后投影换到邻列。  
4. **甩太远**：块快速拉开，影灭而非飞到远处合法格。  
5. **贴边慢拖**：朝不可放方向不易误挤；可放方向仍跟手。  
6. **快滑**：能跟上；停稳后回到慢速粘滞，不无故抖。

---

## 8. 演进约定

- 改投影行为：先改本文 §1–§4 与 `defaults` 注释，再改 `ghost-policy` / `drag-session`。  
- 真机新现象：优先判断是「参数」还是「违反 §1 目标」；违反则改规则表，勿只堆 if。  
- 禁止恢复：横移计入抬升、`Math.round` 半格无滞回、free 钳盘边救命。  
