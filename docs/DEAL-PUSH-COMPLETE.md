# Block Blast 克隆 · 块推送完整规格

**文档角色：** 发块（Deal / Tray Push）**完整需求 + 产品共识 + 调研结论 + 架构 + 现行行为 + 演进计划** 的单一入口。  
**状态：** v1.1 · 2026-07-30（已落地：局面分类 + 默认 G2 + Intent 局面门控）  
**数值真源：** `src/game/defaults.js`（本文不抄全表；改行为先改需求表再改代码）  
**代码入口：** `src/game/deal/pipeline.js` → `generateTray`  
**关联文档：**

| 文档 | 关系 |
|------|------|
| [DEAL-SPEC.md](./DEAL-SPEC.md) | 现行行为短摘要 |
| [DEAL-REFACTOR-DESIGN.md](./DEAL-REFACTOR-DESIGN.md) | 重构设计与需求 ID 历史 |
| [DEAL-RHYTHM.md](./DEAL-RHYTHM.md) | 阶段/模块速查 |
| [../../research/CLEAR-PLAYER-RESEARCH.md](../../research/CLEAR-PLAYER-RESEARCH.md) | 清屏/大消玩家调研 |
| [../../research/HUNGRY-DEAL-FROM-SCREENSHOTS.md](../../research/HUNGRY-DEAL-FROM-SCREENSHOTS.md) | 正版截图发牌推断 |
| [../../research/HUNGRY-POST-PLACE-BOARD-STATES.md](../../research/HUNGRY-POST-PLACE-BOARD-STATES.md) | 落盘局面分类 |
| [../../research/DEAL-ALIGN-MOD-PLAN.md](../../research/DEAL-ALIGN-MOD-PLAN.md) | 对齐修改计划（PR 切分） |

---

## 1. 产品一句话

> 每次托盘空时，根据 **当前 8×8 盘面**（不是分数）推送 **恰好 3 块、固定朝向** 的多连方块，使玩家能在 **压力（大块/收紧可放）与释放（大消/偶发清屏/钥匙块）** 之间循环；主循环停在「健康半盘 + 近满线 + 偶发 setup 兑现」，而不是每手清空或每手毒死。

---

## 2. 术语表（冻结）

| 术语 | 定义 |
|------|------|
| **Tray / 托盘** | 底部 3 个待放块槽；用尽后整组刷新 |
| **Deal / 推送** | 生成并展示新的 3 块 |
| **Form / 形状** | 固定矩阵多连方块（玩家 **不可旋转**） |
| **Instant fit** | 某块在 **当前盘** 上至少有一个合法落点（未考虑与其它托盘块的顺序消线） |
| **G2** | 三块 **各自** 当前均可 instant fit |
| **G3** | 存在一种 **使用顺序**，使三块均能放下（中间可消线） |
| **清屏 / All Clear** | 一次放置结算后 **整盘 0 占格**；计分 `SCORE_ALL_CLEAR` |
| **清屏向 tray** | 系统保证（或高概率保证）存在「按某顺序放完后盘空」的解；**是否清屏看玩家是否照做** |
| **助清 assist** | 三步后显著 **减占**，不要求盘空 |
| **大消 / payoff（T6）** | 一块落下触发 **多线同消**（L≥2），盘 **不必** 全空 |
| **空腔补缺 cavity** | 按盘上缺口形状推 L/T 等嵌洞块 |
| **续推 keepClear** | 已给过清屏向且玩家未盘空 → 继续推清屏向，最多 N 次 |
| **Phase** | `early` / `mid` / `late`，由 **当前分数** + 呼吸回跳决定（`DEAL_SCORE_EARLY_MAX` / `MID_MAX`） |
| **局面 class** | 落盘后/发牌前盘面类型：A 健康压盘 · B setup · C1 大扫 · C2 全空 · D 碎片 · E 窒息（见 §6） |

---

## 3. 规则边界（与发块无关但约束发块）

| ID | 规则 | 优先级 |
|----|------|--------|
| R-01 | 棋盘 **8×8**；托盘 **3**；不可旋转；无重力 | P0 |
| R-02 | 满 **行 ∪ 列** 同时消除 | P0 |
| R-03 | **仅托盘全空**（或开局）才整组补 3 块；不中途补单块 | P0 |
| R-04 | 托盘内块 **任意顺序** 选用 | P0 |
| R-05 | Game Over：剩余槽位在 **当前盘** 均无 instant 落点 | P0 |
| R-08 | 形状来自项目默认字典（Kefrov 系 12 族+变体），非宣称 Hungry 官方表 | P0 |
| R-09 | **禁止**跨 tray 预定固定形状剧本；仅允许会话态：防连刷签名、助清计数、清屏续推、阶段呼吸 | P0 |
| R-10 | 补 tray 后立即 GO 检测 | P0 |
| R-11 | restart 重置发块会话 | P0 |
| R-12 | 颜色与形状抽样独立 | P1 |

---

## 4. 产品手感共识（冻结）

### 4.1 阶段叙事

| 阶段 | 摆放 | 大范围消除（多线） | 清屏 | 压力感 |
|------|------|-------------------|------|--------|
| **early** | **大范围摆放**（偏大块、均格高） | **多**（payoff 更勤） | **偶尔** | 低，建立爽感 |
| **mid** | 中块为主，形状仍含 T/L | **少量** | **少量** | 加压 |
| **late** | 可放收紧、杀手块更多 | **更稀** | **更稀** | 高压 |

节奏：

```text
前期好摆好消、偶发清空释放
  → 中期收紧大消/清屏形成压力
  → 后期高压 + 偶发释放
```

### 4.2 触发哲学（调研冻结）

| 做 | 不做 |
|----|------|
| 用 **当前盘面状态** 决定特殊 tray | **按分数**（500/2000…）切清屏包 |
| 主循环服务 **combo 可续的半结构盘** | 每 tray 必清屏 / 必全空解 |
| Setup 在时 **偶发钥匙块（T6）** | 每 tray 必给钥匙 |
| 给了清屏向 **续推直到盘空或达上限** | 给一次就算、不管玩家是否听懂 |
| 盘乱时 **补缺/助清减乱** | 盘很满仍硬搜离谱全清三件套 |
| early 大消多、清屏偶 | early 每手清屏或永远不给释放 |

### 4.3 玩家需求时刻 → 发块响应

| 时刻 | 玩家状态 | 推送响应 |
|------|----------|----------|
| T1 快窒息 | 选项极少 | 可放保证 + 可选助清/clutch 小块 |
| T2 盘碎 | 异形洞多 | **cavity** 补缺 |
| T3 高压后 | 想松一口气 | **大消或稀有清屏** |
| T4 盘已干净 | 剩一小团 | **收官全清** |
| T5 刷分 | 追 combo | **少全清**，多近满线材料 |
| T6 自建 setup | 差某形就多线爆 | **payoff 钥匙块**（优先于全清） |

**调研一句话：** 玩家很少「需要全清来赢」；更常需要 **对的那一块打出多线大消**；全清是情绪彩蛋/收官，高分向甚至回避全清。

### 4.4 形状与尺寸政策（体验）

| 政策 | 说明 |
|------|------|
| T/L 是 **基础形状** | early 不禁 T/L；单调条/方会闷 |
| 常规 **禁 ≤2 格微块** | 仅 choke 高 fill 小概率 clutch |
| 能推大时偏 **中大块** | early 均格目标高 |
| L/T **朝向贴合盘面** | snug / fit-score，非随机朝向 |
| 杀手块（3×3、1×5、大 L） | late/mid 加压；应在仍可能放下时出现 |
| 形状多元 | 避免三槽同类刷屏 |

---

## 5. Hungry / 截图调研结论（C/B 级，指导对齐不抄权重）

### 5.1 UI 硬事实

- tray 恒为 3；无旋转；双轴消线；无重力  
- 形状 ∈ 经典 polyomino（直条、方、L/J/T、矩形、3×3 等）  
- Solver 输入 = 整盘 + 三块 → 状态核心是 `(board, tray)`  

### 5.2 发牌推断

| 推断 | 证据级 | 对我们的含义 |
|------|--------|--------------|
| 生成时 **各块单独可放（G2）** | B | 默认应对齐 G2；G3 作可选加强 |
| **不保证** 每 tray 可全序放完或可全清 | B | 清屏包必须稀、可关 |
| 「越大越往后」偏 **局深/密度** 非分数表 | C | 用 phase/fill，不用 score |
| 偶发空洞/钥匙感，非每手神装 | B | payoff/cavity 门控 + 概率 |

### 5.3 落盘局面（发牌应服务的分布）

| Class | 名称 | 特征 | 发牌态度 |
|-------|------|------|----------|
| **A** | 健康压盘 | 半满成片、有口袋/通道、近满线 | **主循环目标** |
| **B** | Setup | T/L 槽、多条近满线 | **偶发 payoff** |
| **C1** | 大扫 | 多线同消后骤松 | 释放，回 A |
| **C2** | 全空 | All Clear | **稀有**；空盘后第一 tray 易断 combo |
| **D** | 碎片 | 多 1 格洞、不可读 | cavity/assist，**禁硬全清** |
| **E** | 窒息 | 高占用碎空 | 可放优先，防即死 |

理想循环：`A ↔ B → C1 → A`；失败链：`D → E → GO`；`C2` 为支路。

---

## 6. 需求总表（SSOT · 实现用 ID）

> 改行为：先改本表状态，再改代码与 `defaults.js`。

### 6.1 规则与生命周期（R）

| ID | 需求 | P | 实现 |
|----|------|---|------|
| R-01～R-05, R-08～R-12 | 见 §3 | P0/P1 | ✅ |
| **R-06a** | 默认 **G2**：instant 窗约束各自可放（early=3 等） | P0 | ✅ `DEAL_ORDER_GUARANTEE=false` |
| **R-06b** | 可选 **G3** 顺序可解（`DEAL_ORDER_GUARANTEE`） | P1 | ✅ 默认关；特殊全清/助清仍要求有序解 |
| R-07 | 可关闭严格可放，退回权重采样 | P1 | ✅ `FIT_GUARANTEE` |

### 6.2 内容与难度（C）

| ID | 需求 | P | 实现 |
|----|------|---|------|
| C-01 | **score** → early/mid/late（默认 &lt;1000 / &lt;4000） | P0 | ✅ `basePhaseFromScore` |
| C-02 | 阶段呼吸回跳 | P1 | ✅ |
| C-03 | 角色袋 staple/solver/key/rare | P1 | ✅ `bag.js` |
| C-04 | 尺寸 S/M/L，能大则大 | P0 | ✅ `size-rhythm.js` |
| C-05 | 常规禁微块；clutch 例外 | P0 | ✅ |
| C-06 | early 禁过碎族（保留 T/L 基础） | P1 | ✅ 已放开 T/L |
| C-07 | mid 不强制碎块刷屏 | P1 | ✅ |
| C-08 | 形状类多元 | P1 | ✅ `shape-class.js` |
| C-09 | L/T 变体盘面贴合 | P0 | ✅ `fit-score` |
| C-10 | tray 级 snug 优选 | P1 | ✅ |
| C-11 | instant 目标 early=3；mid∈[2,3]；late∈[1,2] | P0 | ✅ `accept.js` |
| C-12 | rare 低频；开阔少刷 | P1 | 部分 |
| C-13 | scrap 仅 clutch 语义 | P1 | ⚠ |
| **C-14** | 发牌前 **局面分类** 供门控 | P1 | ✅ `board-state.js` |
| **C-15** | 杀手块与口袋/通道联动 | P1 | 📋 计划 PR-4 |

### 6.3 清屏 / 助清 / 大消 / 补缺（A / P / V）

| ID | 需求 | P | 实现 |
|----|------|---|------|
| A-01 | 仅针对 **当前盘** 搜全清/助清 | P0 | ✅ |
| A-02 | 周期 beat（EVERY，分阶段 3/6/7） | P0 | ✅ |
| A-03 | STREAK 连助 | P1 | ✅ |
| A-04 | 全清 = 3 步后空盘 | P1 | ✅ |
| A-05 | 助清减占 ≥ MIN_DROP | P0 | ✅ |
| A-06 | 特殊 tray **独立验收** | P0 | ✅ `acceptSpecialTray` |
| A-07 | 助清失败冷却 | P1 | ✅ |
| A-08 | 阶段概率全清 early>mid>late | P1 | ✅ |
| A-09 | 勤度可调 | P1 | ✅ tune |
| A-10 | 搜索节点/时间预算 | P2 | ⚠ |
| **A-12** | **续推清屏** 最多 N 次（`CLEAR_OFFER_RETRY_MAX`） | P0 | ✅ |
| **A-13** | 收官全清：低 fill + finisher | P1 | ✅ |
| **A-14** | fragmented/choke **禁止硬搜全清**，改 assist | P1 | ✅ policy.allowFullClearSearch |
| **A-15** | 不按分数触发 | P0 | ✅ |
| **P-01** | Setup 存在时概率 **payoff-multi**（L≥PAYOFF_MIN_LINES） | P0 | ✅ `payoff-match.js` |
| **P-02** | payoff 频率 early>mid>late | P0 | ✅ policy |
| **P-03** | payoff **必须** setup 特征（防乱推） | P1 | ✅ allowsPayoffIntent + boardHasPayoffSetup |
| **V-01** | 概率 **cavity-guide** | P1 | ✅ |
| **V-02** | cavity 主打碎片盘；healthy 降权 | P1 | ✅ stateMul.cavity |

### 6.4 会话 / 观测 / 工程（O）

| ID | 需求 | P | 实现 |
|----|------|---|------|
| O-01 | fallback 保证有解路径 | P0 | ✅ |
| O-02 | fallback 少微块；1×1 仅卡死 | P1 | ⚠ |
| O-03 | `lastDealMeta` 可观测 | P1 | ✅ |
| O-04 | `npm run deal:hist` | P1 | ✅ |
| O-05 | 关键开关上面板 | P2 | 大部分 |
| O-06 | 策略可单测 | P2 | 📋 |
| **O-07** | meta 含 boardClass × mode | P1 | ✅ lastDealMeta + deal:hist |

### 6.5 非目标

- 抄 Hungry 未知权重  
- combo 驱动「仇恨发块」  
- 跨 tray 多步固定剧本  
- 玩家旋转 / 非 8×8 Classic  
- 用发块代替计分/手感系统  

---

## 7. 架构

### 7.1 模块

| 模块 | 路径 | 职责 |
|------|------|------|
| 管线入口 | `deal/pipeline.js` | Intent 顺序、`generateTray`、`lastDealMeta` |
| 会话 | `deal/session.js` | 签名、beat、续推、streak |
| 政策 | `deal/policy.js` | phase×defaults×tune → every/chance/… |
| 验收 | `deal/accept.js` | main / special / payoff |
| 阶段 | `deal/phase.js` | fill→phase、呼吸、族倍率 |
| 袋 | `deal/bag.js` | 角色权重 |
| 尺寸 | `deal/size-rhythm.js` | S/M/L、微块 clutch |
| 形状类 | `deal/shape-class.js` | 多元约束 |
| 贴合 | `deal/fit-score.js` | 变体/朝向分 |
| 整齐 | `deal/board-neat.js` | early neat |
| 采样 | `deal/sample.js` | 主路径候选 |
| 全清/助清 | `deal/clear-tray.js` | DFS/搜索 |
| 大消 | `deal/payoff-match.js` | 钥匙块 |
| 空腔 | `deal/cavity-match.js` | 补缺 |
| 棋盘算子 | `deal/board-ops.js` | fill、instant、order |
| 局面（计划） | `deal/board-state.js` | A–E 分类 |
| 对外 | `deal/generate.js` / `index.js` | re-export |

### 7.2 现行 Intent 顺序

```text
当前盘 snapshot
  → sessionBeforeDeal（续推计数）
  → 1) forceSpecial：
        keepClear | assist beat | finisher | earlyForceFull
        → tryAssistClearTray
           · full + accept → clear-retry / assist-full-clear / finisher / early-full
           · keepClear 失败 → cavity 续推
           · assist + accept → assist-clear
  → 2) payoff：boardHasPayoffSetup && chance → tryPayoffTray
  → 3) cavity：early/mid && chance → tryCavityGuideTray
  → 4) early 稀有 tryClearTrayForBoard
  → 5) main：early / mid（可再 mid-clear）/ late 分策采样
  → 6) fallbackGuaranteedTray
```

### 7.3 目标 Intent 顺序（演进后，与计划一致）

```text
classifyBoardState(board)     // PR-1
  → policy(phase, boardState)
  → keepClear（pending，可选 healthy 取消）
  → full-clear（仅 empty/healthy/setup；禁 frag/choke）
  → assist（优先 D/E）
  → payoff（强 setup）
  → cavity（优先 D）
  → phase clear chance × 局面系数
  → main（G2 + bag + 杀手联动）
  → fallback
```

### 7.4 数据流

```text
board
  → fill, phase, boardClass
  → policy knobs
  → strategy try* → pieces[3]
  → accept*
  → sessionOnEmit + lastDealMeta
  → UI tray
```

**输入：** 仅当前盘（+ rng + session）。**禁止**把当前分数写入 deal 分支条件（A-15）。

---

## 8. 关键 mode 一览

| mode | 含义 | 对应需求 |
|------|------|----------|
| `clear-retry` | 续推清屏向 | A-12 |
| `clear-retry-cavity` | 续推时退到空腔 | A-12, V |
| `early-full-clear` / `early-clear` | 前期全清 | A-08, 4.1 |
| `finisher-clear` | 低 fill 收官 | A-13 |
| `assist-full-clear` | beat 真全清 | A-02, A-04 |
| `assist-clear` | 仅减占 | A-05 |
| `mid-clear` | 中期稀有全清 | A-08 |
| `payoff-multi` | Setup 多线钥匙 | P-01 |
| `cavity-guide` | 空腔补缺 | V-01 |
| `early-size` / `early-loose` | 前期主采样 | C-04 |
| `mid-size-mix` / `mid-size` / `mid-loose` | 中期主采样 | C |
| `late-size` / … | 后期主采样 | C-11 |
| `fallback` / `fallback-dot` | 兜底 | O-01 |

---

## 9. 旋钮地图（类别 · 真源 defaults.js）

| 类别 | 代表常量 | 作用 |
|------|----------|------|
| 相位边界 | `DEAL_SCORE_EARLY_MAX` / `MID_MAX` | early/mid/late（按分数） |
| 呼吸 | `DEAL_*_RELAX_*` | 高压回跳 |
| Instant 窗 | `DEAL_*_INSTANT_MIN/MAX` | 可放松紧 |
| 清屏概率 | `DEAL_*_CLEAR_CHANCE` | 阶段稀有全清 |
| 助清节奏 | `DEAL_CLEAR_ASSIST_EVERY_*` | 3 / 6 / 7 |
| 助清约束 | `FILL_MAX` / `MIN_DROP` / `STREAK` | 减占与连助 |
| 收官 | `DEAL_CLEAR_FINISHER_FILL_MAX` | 低 fill 全清 |
| 续推 | `DEAL_CLEAR_OFFER_RETRY_MAX` | 默认 6 |
| Payoff | `DEAL_PAYOFF_CHANCE_*` / `MIN_LINES` | T6 |
| Cavity | `DEAL_CAVITY_GUIDE_CHANCE_*` | 补缺 |
| 尺寸/整齐 | `EARLY_MIN_AVG_CELLS` / `NEAT_MUL` | 大块与 neat |
| 微块 | `BAN_MICRO` / `MICRO_CLUTCH_*` | 禁小与急救 |
| 角色袋 | `DEAL_ROLE_*` | staple/solver/key/rare |
| 贴合 | `DEAL_FIT_*` | 朝向与 tray 分 |
| 全局可放 | `FIT_GUARANTEE` | 现 G3 倾向 |

面板覆盖：`tune.js` / feel-panel。直方图：`npm run deal:hist`。

---

## 10. 验收

### 10.1 自动化

```bash
npm run deal:hist
npm run deal:hist:quick
```

关注：instant 分布、mode 占比、avgCells、全清/助清率；（演进后）boardClass 分布。

### 10.2 手感清单（实机）

| 检查 | 通过标准 |
|------|----------|
| early 10 tray | 大块好摆；≥1 次明显多线；全清 ≤2 |
| mid fill~0.45 | 仍可玩；连续 10 tray 全清 ≤1；有加压感 |
| 自建近满线 | 数 tray 内能感到钥匙块，**非每手** |
| 麻子盘 | 更常补缺/减占，而非离谱清屏包 |
| 续推 | 给清屏向后未清完会继续帮，不超过 N |
| GO | 无「三块生成时全 0 fit」的即死（fallback 后） |
| restart | 会话态清零 |

### 10.3 阶段产品句（总验收）

- [ ] early：大摆放 + 大消多 + 清屏偶发  
- [ ] mid：大消少 + 清屏少  
- [ ] late：压力主、释放稀  
- [ ] 全程不按分数切包  

---

## 11. 演进计划（摘要）

详见 [research/DEAL-ALIGN-MOD-PLAN.md](../../research/DEAL-ALIGN-MOD-PLAN.md)。

| 顺序 | PR | 内容 |
|------|-----|------|
| 1 | PR-1 | `board-state` 分类 + meta（先观测） |
| 2 | PR-2 | 默认 G2；G3 可选 |
| 3 | PR-5 | hist class×mode、文档同步 |
| 4 | PR-3 | Intent 局面门控 + 参数微拧 |
| 5 | PR-4 | main 杀手×口袋、mid neat |
| 6 | PR-6 | 可选 setup forcing 软反馈 |

**推荐默认：** G2 开、G3 开关；清屏续推保留；healthy 是否取消 pending 待产品拍板。

---

## 12. 决策日志（摘要）

| 决策 | 结论 |
|------|------|
| 阶段依据 | **当前分数**（`DEAL_SCORE_*`）；fill 仅服务局面/助清 |
| 清屏定义 | 仅结算后 **全盘空** |
| 清屏包频率 | 偶发 + 续推；非每 tray |
| T/L | early **基础形状**，不禁 |
| 微块 | 常规禁，clutch 例外 |
| 大消 vs 清屏 | **payoff 优先服务 combo**；清屏是彩蛋/收官 |
| 对齐 Hungry | G2 + 局面循环 A/B；不抄权重 |
| 可放 | 现实现 G3 偏强；计划默认改 G2 |

---

## 13. 维护约定

1. **数值**只以 `defaults.js` 为准；本文写语义与 ID。  
2. 改 Intent 顺序 → 改 `pipeline.js` + 更新本文 §7 与 DEAL-SPEC。  
3. 改产品手感句 → 改 §4 并同步 CLEAR-PLAYER-RESEARCH / 阶段表。  
4. 改需求 ID 状态（✅⚠📋）→ 同步 DEAL-REFACTOR 若仍维护。  
5. 大迭代后在 PROJECT-HISTORY 追加一节，链到本文版本。

---

## 14. 快速对照：需求 → 代码

| 你想改… | 先看 | 再改 |
|---------|------|------|
| 清屏多不多 | §4.1 A-08、§9 chance/every | `defaults` + `policy` |
| 钥匙块准不准 | §4.3 T6、P-01 | `payoff-match` + chance |
| 盘太碎 | §5.3 D、V-01 | cavity + assist 门控 |
| 块太小 | C-05、C-04 | size-rhythm / ban micro |
| L 朝向别扭 | C-09 | fit-score / forms 变体 |
| 后期太毒/太奶 | C-11、late role | instant 窗 + bag |
| 即死 | R-05、O-01 | accept + fallback |
| 像不像官网 | §5 + 演进 PR | board-state 门控 |

---

**文档结束。** 实现以代码为准；争议时以 §4 产品共识与 §6 需求表优先于散落会话记录。
