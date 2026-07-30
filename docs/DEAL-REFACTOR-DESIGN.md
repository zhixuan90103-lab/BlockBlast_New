# 发块推送重构设计

**状态：** Design v1 · **实现落地 v2**（2026-07-30 pipeline + payoff）  
**范围：** Classic 8×8 · tray=3 · `src/game/deal/*`  
**替代关系：** 将「散落补丁清单」收敛为可分期实现的重构；**行为真源**仍为 `defaults.js` + 代码。  
**配套：** 现行行为说明 [DEAL-SPEC.md](./DEAL-SPEC.md) · 检索 [research/DEAL-PUSH-RESEARCH-PLAN.md](../../research/DEAL-PUSH-RESEARCH-PLAN.md)

---

## 0. 产品共识（冻结）

| 术语 | 定义 |
|------|------|
| **清屏 / All Clear** | 放置结算后 **整盘 8×8 无任何占格**（`occupied === 0`）。计分 `SCORE_ALL_CLEAR`。 |
| **非清屏** | 仅消线、仅减占、发块 mode 名含 clear/assist **均不算**清屏。 |
| **清屏向发块** | 系统可提高「本 tray 存在全空解」的概率；**是否清屏以玩家实际盘空为准**。 |

---

## 1. 背景与问题

### 1.1 现状

发块已具备可用管线：阶段 × 角色袋 × 尺寸/形状 × 贴合 × 助清 × G3 可放，并有 `deal:hist` 回归。功能叠代快，结构上仍是 **generate 过程式串联 + 多处隐式政策**。

### 1.2 要解决什么

| 类 | 问题 |
|----|------|
| **需求散** | 规则/体验/非目标/验收分散在 SPEC、会话、defaults 注释 |
| **政策散** | 禁微块、助清、instant、scrap 分散在 generate/sample/size/bag |
| **补丁债** | L4–L7、U1–U10 若继续「点状改」会继续缠绕 |
| **可测性** | 直方图有了，但策略层难单测、难替换 |

### 1.3 非目标（本设计不做）

- 抄 Hungry 正版权重（未知）
- combo 驱动仇恨发块
- 跨 tray 多步剧本
- 玩家旋转 / 10×10 Classic
- 重写计分、手感拖拽

---

## 2. 全量需求目录（SSOT）

> **ID 稳定**：实现与 PR 用 ID 引用；改行为先改本表再改代码。  
> **优先级：** P0 必须 · P1 体验默认开 · P2 增强/工程 · P3 可选锦上添花  

### 2.1 规则与生命周期（R）

| ID | 需求 | P | 现状 |
|----|------|---|------|
| **R-01** | 棋盘 8×8；托盘 3 块；不可旋转；无重力 | P0 | ✅ |
| **R-02** | 满行 ∪ 满列同时消 | P0 | ✅ 规则层 |
| **R-03** | 仅 **三槽全空**（或开局）整组补 3 块；不中途补单块 | P0 | ✅ |
| **R-04** | 托盘块 **任意顺序** 选用 | P0 | ✅ |
| **R-05** | GO：剩余非空槽在 **当前盘** 均无 instant 落点 | P0 | ✅ |
| **R-06** | 默认发块 **G3**：存在放置顺序使 3 块均可放（可中间消线） | P0 | ✅ |
| **R-07** | 可关 G3，退回纯权重 G0（`FIT_GUARANTEE`） | P1 | ✅ |
| **R-08** | 形状表默认 Kefrov **12 族** + 变体；非 Hungry 官方表 | P0 | ✅ |
| **R-09** | **禁止**跨 tray 预定形状序列；仅允许：防连刷签名、助清计数、阶段呼吸 | P0 | ✅ |
| **R-10** | 补 tray 后立即 GO 检测（防即死漏检） | P0 | ✅ |
| **R-11** | restart 重置发块会话状态（签名、助清计数） | P0 | ✅ |
| **R-12** | 颜色与形状抽样独立 | P1 | ✅ |

### 2.2 内容与难度政策（C）

| ID | 需求 | P | 现状 |
|----|------|---|------|
| **C-01** | fill → early / mid / late；阈值可配 | P0 | ✅ |
| **C-02** | 阶段 **呼吸回跳**（late/mid 松气） | P1 | ✅ |
| **C-03** | 角色袋 staple / solver / key / rare，阶段配比可配 | P1 | ✅ |
| **C-04** | 尺寸 S/M/L 配方：能推大时偏 L/M | P0 | ✅ |
| **C-05** | **常规禁 ≤2 格**；仅残盘 clutch 小概率 ≤1 个 | P0 | ✅ |
| **C-06** | early 禁过碎族（2 直/缺角倾向） | P1 | ✅ |
| **C-07** | mid **不**默认强制碎块刷屏 | P1 | ✅ |
| **C-08** | 形状类多元：≥2 类；禁三同类条/角/方等 | P1 | ✅ |
| **C-09** | 同族多变体按 **盘面贴合** 加权（L/T 朝向） | P0 | ✅ |
| **C-10** | 整 tray 候选按 snug 优选 | P1 | ✅ |
| **C-11** | instant 目标：early=3；mid∈[2,3]；**late∈[1,2]** | P0 | ✅ |
| **C-12** | rare（3×3/5 直）低频；开阔不刷 rare | P1 | 部分（倍率） |
| **C-13** | scrap/解题块仅 **clutch 语义**（≥3 格短 L/T），非 mid 主粮 | P1 | ⚠ 待重构收紧 |

### 2.3 清屏与助清（A）

| ID | 需求 | P | 现状 |
|----|------|---|------|
| **A-01** | 仅针对 **当前盘** 搜索本 tray 全清/助清，不跨轮预定 | P0 | ✅ |
| **A-02** | 周期强制助清（EVERY） | P0 | ✅ |
| **A-03** | 助清成功可 STREAK 连助 | P1 | ✅ |
| **A-04** | 全清：3 步后空盘 | P1 | ✅ |
| **A-05** | 助清：3 步减占 ≥ MIN_DROP（或清空） | P0 | ✅ |
| **A-06** | 助清/全清 **独立验收**（不套 late instant 主验收） | P0 | ✅ |
| **A-07** | 助清失败 **冷却**，避免连搜卡顿 | P1 | ✅ |
| **A-08** | 阶段概率全清（early/mid/late chance） | P1 | ✅ |
| **A-09** | 助清勤度可调，避免过奶/过抠 | P1 | 调参 |
| **A-10** | 助清搜索有时间/节点预算，不堵主线程过久 | P2 | ⚠ 待重构 |
| **A-11** | mode 区分 full / assist / near（差一格） | P3 | 待做 |

### 2.4 兜底与可观测（O）

| ID | 需求 | P | 现状 |
|----|------|---|------|
| **O-01** | 主路径失败 → fallback 顺序可解 | P0 | ✅ |
| **O-02** | fallback 优先无微块；1×1 仅卡死且 meta 标明 | P1 | ⚠ 部分 |
| **O-03** | `lastDealMeta`：fill/phase/mode/instant/助清计数 | P1 | ✅ |
| **O-04** | 直方图脚本回归空/半/残盘 | P1 | ✅ `deal:hist` |
| **O-05** | 关键开关上面板 | P2 | 大部分 |
| **O-06** | 策略层可单测（无 DOM/Three） | P2 | 待重构 |

### 2.5 体验增强（X，非阻塞发块正确性）

| ID | 需求 | P | 现状 |
|----|------|---|------|
| **X-01** | 可选：推荐落点弱提示 | P3 | 未做 |
| **X-02** | 助清 refill 音效区分 | P3 | 未做 |
| **X-03** | 文案：有解≠乱放不死 | P3 | 未做 |
| **X-04** | 按分数段调助清勤度 | P3 | 未做 |

### 2.6 明确非需求（N）

| ID | 项 |
|----|-----|
| **N-01** | Hungry 精确权重 |
| **N-02** | combo/分数仇恨发块 |
| **N-03** | 跨 tray 剧本消格 |
| **N-04** | 玩家旋转 |
| **N-05** | Chaos 5 块 / 10×10 当默认 Classic |

### 2.7 验收门槛（与 `deal:hist` 对齐）

| 场景 | 门槛（默认） |
|------|----------------|
| empty | micro≤2% · avgCells≥4.2 · tiny3 受限 |
| half | micro≤5% · avgCells≥3.6 |
| late | micro≤12% · avgInstant ∈ [0.8, 2.6] |
| 任意 | GO 定义不随 G3 改变 |

---

## 3. 设计目标（重构要达成什么）

| 目标 | 度量 |
|------|------|
| **G1 政策一处配置** | 禁微、instant、助清、角色配比进入 `DealPolicy` 对象，不再散落 if |
| **G2 管线阶段清晰** | Context → Intent → Candidates → Score → Accept → Emit |
| **G3 补丁变策略** | 下文「原补丁映射」全部变成命名策略插件或 policy 字段 |
| **G4 行为可回归** | `deal:hist` + 可选单测；改 policy 不改生成器骨架 |
| **G5 兼容** | 默认手感 ≈ 现网；开关语义保留 |

---

## 4. 目标架构

### 4.1 分层

```
┌─────────────────────────────────────────┐
│  game.js          refill / GO 调用方     │
└──────────────────┬──────────────────────┘
                   │ generateTray(grid, opts?)
┌──────────────────▼──────────────────────┐
│  DealSession      会话：签名/助清计数     │
│  DealPipeline     单轮编排编排（无政策）   │
└──────┬───────────┬───────────┬──────────┘
       │           │           │
┌──────▼────┐ ┌────▼─────┐ ┌──▼──────────┐
│ DealPolicy│ │ Strategies│ │ BoardOps    │
│ 只读配置  │ │ Intent 插件│ │ 纯函数      │
└───────────┘ └───────────┘ └─────────────┘
       │
┌──────▼──────────────────────────────────┐
│ Sampler：候选生成 + Scorer 排序 + Accept │
└─────────────────────────────────────────┘
```

### 4.2 核心类型（概念）

```ts
// 概念 API，实现可用 JSDoc / plain objects

/** 单轮只读输入 */
DealContext {
  board: Cell[][]
  fill: number
  basePhase: 'early'|'mid'|'late'
  phase: DealPhase          // 呼吸后
  rng: () => number
  policy: DealPolicy
  session: DealSessionState
}

/** 本轮意图：主采样 | 强制助清 | 概率全清 | 兜底 */
DealIntent {
  kind: 'assist' | 'clear' | 'main' | 'fallback'
  reason: string            // 写入 meta.mode 前缀
  relax: AcceptProfile      // 用哪套验收
}

/** 验收配置档 */
AcceptProfile {
  instantMin, instantMax    // null = 不限
  requireOrderSolvable: boolean
  allowMicro: boolean
  maxSmallSlots: number     // ≤3 格最多几个
  minAvgCells: number
  requireShapeDiversity: 'strict' | 'soft' | 'off'
  openBoardRules: boolean
}

/** 政策：defaults + tune 合并结果 */
DealPolicy {
  phases, roles, size, micro, fit, assist, clearChances, flags...
}

DealResult {
  pieces: PieceDef[3]
  meta: DealMeta
}
```

### 4.3 单轮流水线（规范）

```
1. buildContext(grid, session, policy)
2. intents = IntentPlanner.plan(context)
   // 有序列表：如 [assist?, clear?, main, fallback]
3. for intent in intents:
     candidates = Strategy[intent.kind].propose(context, intent)
     scored = scoreAll(candidates, context, intent)
     picked = first that Accept[intent.relax](context, tray)
     if picked: break
4. session.onEmit(picked, intent)
5. return DealResult
```

**原则：** Pipeline **不**写「if phase mid && fill>0.62 scrap」；这些只在 Policy 或 Strategy 内。

### 4.4 策略插件（把补丁变成命名能力）

| Strategy | 对应原补丁/能力 | 输入 | 输出 |
|----------|-----------------|------|------|
| `AssistClearStrategy` | A-02..A-07, L2/L3 | board, budget | tray? |
| `ProbClearStrategy` | A-08 | phase chance | tray? |
| `MainSampleStrategy` | C-01..C-11, fit | plans + bag + fit | tray[] |
| `ClutchMicroStrategy` | C-05 | 仅 allowMicro 时掺 1 微块 | 修饰 main |
| `ScrapClutchStrategy` | C-13 / L4 | 高 fill 可选 ≥3 solver | 修饰 main |
| `FallbackStrategy` | O-01/O-02, L7 | 放宽 accept | tray |
| `FitBias`（横切） | C-09/C-10 | 权重/落点 | form 权重 |

### 4.5 验收档案（AcceptProfile）

| Profile | 用途 | 要点 |
|---------|------|------|
| `mainEarly` | early 主路径 | instant=3；无 &lt;4；禁微 |
| `mainMid` | mid 主路径 | instant 2–3；maxSmall≤1 |
| `mainLate` | late 主路径 | **instant 1–2**；clutch 可选微 |
| `assist` | 助清/全清 | 不限 instant 上界；禁微；非三 S；G3 |
| `loose` | 阶段放宽 | instant 下限降 |
| `fallback` | 兜底 | G3 优先；dot 仅 last resort + meta |

主路径 **不得** 误用 `assist` 档案；助清 **不得** 误用 `mainLate`（已修问题产品化）。

### 4.6 DealSession（会话状态）

```
lastTraySig
traysSinceAssist
assistStreakLeft
// 可选扩展：
traysTotal
lastAssistOutcome: 'ok'|'fail'|'skip'
searchBudgetMs 累计
```

`resetDealState()` = 新 Session。  
**禁止** 在 Session 存「下一 tray 形状队列」（R-09）。

### 4.7 文件落位（目标）

| 路径 | 职责 |
|------|------|
| `deal/policy.js` | 从 defaults+tune 构建 DealPolicy |
| `deal/session.js` | 会话状态 |
| `deal/context.js` | fill/phase/呼吸 |
| `deal/pipeline.js` | 编排 intents |
| `deal/accept.js` | AcceptProfile 实现 |
| `deal/score.js` | tray/form 打分（含 fit） |
| `deal/strategies/*.js` | assist / clear / main / fallback |
| `deal/board-ops.js` | 保留纯函数 |
| `deal/generate.js` | **薄入口** `generateTray` + 兼容 `lastDealMeta` |
| `deal/index.js` | 公共 export |

可渐进：先抽 `policy`+`accept`，再抽 strategies，最后瘦 generate。

---

## 5. 原「后续补丁」→ 设计映射

| 原项 | 需求 ID | 重构落点 | 说明 |
|------|---------|----------|------|
| late instant [1,2] | C-11 | `mainLate` profile | **已做**，政策字段化 |
| acceptAssistTray | A-06 | `assist` profile | **已做** |
| 助清失败冷却 | A-07 | Session + AssistStrategy | **已做** |
| requireScrap 收紧 | C-13 | `ScrapClutchStrategy` | 仅 fill≥阈值且 ≥3 格 solver |
| fallback-dot meta | O-02 | FallbackStrategy + meta.mode | `fallback-dot` |
| 助清节点预算 | A-10 | AssistStrategy `budget` | maxNodes + 可选 time |
| EVERY/STREAK 调参 | A-09 | DealPolicy.assist | 默认可改为 4/1 作为 balance preset |
| 开阔限 1 rare | C-12 | MainSample scorer 惩罚 | score 项 |
| late 抬短 L/T | C-13 | role mul in policy | 非 2 直 |
| assist-near mode | A-11 | AssistStrategy 分级 | P3 |
| 直方图/CI | O-04 | 已有脚本；CI 可选 | |
| 推荐落点 UI | X-01 | **发块外** feel | 不进 deal 核心 |
| 助清音效 | X-02 | feel | 不进 deal 核心 |
| 理想序 vs 玩家序 | L6 | 文档取舍；可选 MainSample 开关 `simPlacement: 'best'\|'any'` | Policy 字段 |

**规则：新行为只能加 Policy 字段或 Strategy，禁止在 pipeline 再堆匿名 if。**

---

## 6. Key Decisions

| # | 决策 | 理由 |
|---|------|------|
| D1 | **保留 G3 默认**，G0 可关 | 可玩性产品默认；与检索一致 |
| D2 | **GO 与发块验收分离** | 品类标准；避免「保证=不死」误读 |
| D3 | **无跨 tray 剧本** | 公平与可推理；助清只看当前盘 |
| D4 | **政策对象 + 策略插件** 而非大 generate 重写一次到位 | 可渐进、可回归 |
| D5 | **贴合作为 Scorer/权重**，不作为硬唯一解 | 保留随机性与多元 |
| D6 | **助清独立 AcceptProfile** | 已验证：主路径 instant 与清屏意图冲突 |
| D7 | **1×1 仅 fallback last resort** | 与禁微叙事一致 |
| D8 | **Kefrov 12 族不扩池**（本阶段） | 与 DEFAULTS 锁表一致 |
| D9 | **重构默认行为≈现网** | hist 门槛不回退 |
| D10 | 体验锦上添花（推荐落点/音效）**不阻塞** 重构合并 | 边界清晰 |

---

## 7. 风险与缓解

| 风险 | 缓解 |
|------|------|
| 重构手感漂移 | 每 PR 跑 `deal:hist`；对比 mode 分布 |
| 过度抽象 | 策略 ≤6 个；不引入 DI 框架 |
| 助清性能 | budget 默认降节点；失败冷却已有 |
| 双轨文档 | SPEC 改「行为摘要」+ 链本文；数值只在 defaults |

---

## 8. 迁移策略

1. **行为冻结**：以当前 hist 门槛为 baseline。  
2. **抽出 Policy/Accept**（行为不变，只搬家）。  
3. **抽出 Assist/Fallback Strategy**。  
4. **MainSample 收拢 size/bag/fit**。  
5. **删 generate 内联政策**；补单测 + hist。  
6. **可选 balance preset**（奶/标准/硬）。

每步可独立合并；任一步可停。

---

## 9. 测试计划

| 层 | 内容 |
|----|------|
| 单元 | `accept(profile, tray)` · `allowMicro` · `phaseFromFill` · `weightWithFit` 朝向 |
| 集成 | `generateTray` 空/半/残 固定 rng 种子快照（可选） |
| 回归 | `npm run deal:hist` 必过 |
| 手测 | restart 助清计数；关 FIT；关 PHASE；助清 mode 可读 |

---

## 10. Open Questions（需产品点头再写死默认）

| # | 问题 | 选项 | 建议默认 |
|---|------|------|----------|
| Q1 | 助清默认勤度？ | EVERY 3+STREAK 2（现） / 4+1（略难） | **4+1** 作 refactor 后 balance |
| Q2 | late 是否允许 instant=3？ | 否 / 仅 assist | **否**（保持 1–2） |
| Q3 | sim 落点策略默认？ | 始终 best / 仅第一块 best | **始终 best**（现状） |
| Q4 | hist 是否进 CI？ | 是 / 否 | **本地必跑**；CI 可选 |

未回答前实现以「建议默认」为设计假定，可用 policy 覆盖。

---

## 11. PR Plan

### PR1 — 需求冻结与文档
- **内容：** 本设计定稿；DEAL-SPEC 改为「行为摘要 + 链需求 ID」；defaults 注释贴 ID  
- **文件：** `docs/DEAL-REFACTOR-DESIGN.md`（本文件）、`DEAL-SPEC.md`、`docs/README.md`  
- **依赖：** 无  
- **验收：** 需求表无冲突 ID  

### PR2 — DealPolicy + AcceptProfile 抽出
- **内容：** `policy.js` / `accept.js`；generate 改为调 profile；**行为不变**  
- **文件：** `deal/policy.js`, `deal/accept.js`, `generate.js`, `defaults.js`（仅注释）  
- **依赖：** PR1  
- **验收：** `deal:hist` 全过  

### PR3 — Session + Assist/Clear Strategy
- **内容：** 会话独立；助清/概率清屏策略化；预算参数  
- **文件：** `deal/session.js`, `deal/strategies/assist.js`, `clear-tray.js`, `generate.js`→`pipeline` 雏形  
- **依赖：** PR2  
- **验收：** hist；强制助清失败不连搜  

### PR4 — MainSample + Fit/Size/Bag 收拢 + ScrapClutch
- **内容：** 主采样策略；C-13 scrap 收紧；C-12 rare 惩罚  
- **文件：** `strategies/main.js`, `sample.js` 瘦身, `bag.js`, `size-rhythm.js`, `fit-score.js`  
- **依赖：** PR2  
- **验收：** empty micro≈0；mid 碎块占比下降（hist roles）  

### PR5 — Fallback 语义 + meta 完善
- **内容：** O-02 fallback-dot；meta 统一  
- **文件：** `strategies/fallback.js`, `generate.js`  
- **依赖：** PR2  
- **验收：** 非卡死不出现 1×1  

### PR6 — Pipeline 瘦入口 + 可选单测
- **内容：** `pipeline.js` 编排；`generateTray` 10～30 行；单测 accept/policy  
- **文件：** `pipeline.js`, `generate.js`, `index.js`, `scripts/` 或 `deal/*.test`  
- **依赖：** PR3–5  
- **验收：** hist + 单测绿  

### PR7（可选）— Balance preset 与 CI
- **内容：** standard/soft/hard policy 预设；可选 CI job `deal:hist`  
- **依赖：** PR6  

---

## 12. 成功标准

- [ ] §2 需求 ID 可被代码注释/测试引用  
- [ ] generate 主文件 &lt; ~120 行编排逻辑  
- [ ] 新政策只改 Policy/Strategy  
- [ ] `npm run deal:hist` 通过且不劣于 baseline  
- [ ] R/C/A/O 中 P0–P1 状态均为 ✅ 或显式 P3  
- [ ] 无跨 tray 队列、无 Hungry 伪权重  

---

## 13. 与现文档关系

| 文档 | 角色 |
|------|------|
| **本文 DEAL-REFACTOR-DESIGN** | 需求 SSOT + 重构设计 + PR 计划 |
| DEAL-SPEC | 现行行为说明（随 PR 改链到 ID） |
| DEAL-RHYTHM / DEAL-DESIGN | 短摘要 |
| research/DEAL-PUSH* | 机制检索归档（FREEZE） |
| defaults.js | 数值真源 |

---

**维护：** 新需求先占 ID 写入 §2，再进 PR；禁止无 ID 补丁。  
**版本：** Design v1 · 将 L4–L7 / U* / 队列补丁结构化为重构。
