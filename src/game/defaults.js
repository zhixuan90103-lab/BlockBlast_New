/**
 * 实现真源常量 — research/DEFAULTS.md + 视觉对齐正版（木纹 / 立体块）。
 */

// —— 规则 ——
export const GRID = 8;
export const TRAY_SIZE = 3;
export const ROTATE = false;
export const GRAVITY = false;

/** @typedef {'slide3' | 'tray'} ComboMode */
export const COMBO_MODE = /** @type {ComboMode} */ ('slide3');
export const MAX_WITHOUT_CLEAR = 3;
export const COMBO_INCREMENT = /** @type {1 | 'lines'} */ (1);

export const SCORE_PER_CELL = 1;
export const SCORE_LINE_BASE = 10;
export const SCORE_ALL_CLEAR = 300;

/**
 * 启用可放相关验收（instant 窗 + 可选 G3）。
 * 关闭则退回纯权重抽样（simple）。
 */
export const FIT_GUARANTEE = true;
/**
 * G3：存在放置顺序使三块均可放下（中间可消线）。
 * 默认 false → 主路径以 G2（各自 instant）为主，对齐截图推断；
 * true 时 acceptMain 额外要求 existsPlacementOrder。
 */
export const DEAL_ORDER_GUARANTEE = false;
/**
 * 按局面 class（healthy/setup/fragmented/choke）门控全清/payoff/cavity。
 */
export const DEAL_BOARD_STATE_GATE = true;
/**
 * 续推清屏中若盘已 healthy 且 fill 不高，取消 pending（防无限奶）。
 */
export const DEAL_CLEAR_CANCEL_ON_HEALTHY = true;

// —— 发块推送 DEAL_*（阶段难度 + 呼吸）——
/**
 * 启用后：按 **当前分数** 切 early/mid/late，
 * 约束 instantFit 个数，权重偏置，后期可回跳前/中期放松。
 * 关闭则退回「权重 + 可放保证」旧逻辑。
 * 局面门控 / 助清 fill 上限等仍看盘面，与阶段正交。
 */
export const DEAL_PHASE_ENABLED = true;
/**
 * 阶段划分（分数，左闭右开语义）：
 *   score < DEAL_SCORE_EARLY_MAX  → early
 *   score < DEAL_SCORE_MID_MAX    → mid
 *   否则                          → late
 */
export const DEAL_SCORE_EARLY_MAX = 1000;
export const DEAL_SCORE_MID_MAX = 4000;
/**
 * 兼容旧键：填充率阈值不再驱动 phase（保留供 tune 面板/文档对照）。
 * @deprecated phase 已改分数；勿再当作阶段依据
 */
export const DEAL_FILL_EARLY_MAX = 0.34;
/** @deprecated 见 DEAL_SCORE_* */
export const DEAL_FILL_MID_MAX = 0.58;
/**
 * 后期呼吸：先 roll early，否则 mid，否则 late。
 * 体感：有压也要能松口气。
 */
export const DEAL_LATE_RELAX_EARLY = 0.1;
export const DEAL_LATE_RELAX_MID = 0.28;
/** 中期偶发「回前期清屏感」 */
export const DEAL_MID_RELAX_EARLY = 0.06;
/** 单次 tray 拒绝采样最大次数 */
export const DEAL_MAX_ATTEMPTS = 140;
/** early 大块权重尺度 */
export const DEAL_EARLY_NEAT_MUL = 2.35;
/** early 三块平均格数下限（非清屏兜底时） */
export const DEAL_EARLY_MIN_AVG_CELLS = 4.8;
/** late 别扭/细长倍率 */
export const DEAL_LATE_AWKWARD_MUL = 1.55;
/** mid 压 3×3 */
export const DEAL_MID_BIG_DAMP = 0.55;
/**
 * mid 碎块/解题块倍率尺度（短 L、缺角、Z、T）。
 * 中期以中大块为主；碎块仅偶发破局（见 clutch）。
 */
export const DEAL_MID_SCRAP_MUL = 0.95;
/**
 * 立刻可放目标：
 * early 3；mid ≥2；late 优先 1，允许 2（避免贴合好的 tray 被 instant=1 误杀）。
 */
export const DEAL_EARLY_INSTANT_MIN = 3;
export const DEAL_EARLY_INSTANT_MAX = 3;
export const DEAL_MID_INSTANT_MIN = 2;
export const DEAL_MID_INSTANT_MAX = 3;
export const DEAL_LATE_INSTANT_MIN = 1;
export const DEAL_LATE_INSTANT_MAX = 2;
/**
 * 本 tray 清屏（仅当前盘、恰好 3 块摆完可全空；不跨轮预定）
 */
export const DEAL_EARLY_CLEAR_ENABLED = true;
/** 兼容旧面板键（重构后固定 3 步 tray） */
export const DEAL_EARLY_CLEAR_MIN = 3;
export const DEAL_EARLY_CLEAR_MAX = 3;
/**
 * 超过此填充率不再尝试「三步全清」。
 * 清屏/助清改为「偶尔」触发，不要每 tray 都清屏包。
 */
export const DEAL_EARLY_CLEAR_FILL_MAX = 0.55;
export const DEAL_EARLY_CLEAR_MAX_NODES = 1200;
/**
 * 阶段手感共识：
 * - early：大摆放 + 大范围消除，偶尔清屏
 * - mid：少量大消 + 少量清屏（加压）
 * - late：压力为主，清屏更稀
 */
/** early 概率全清 — 偶尔（局面门控后再乘系数） */
export const DEAL_EARLY_CLEAR_CHANCE = 0.14;
/** mid 清屏更稀 */
export const DEAL_MID_CLEAR_CHANCE = 0.04;
/** late 清屏最稀 */
export const DEAL_LATE_CLEAR_CHANCE = 0.03;
/**
 * 【已弃用日历助清】旧「每 N tray 打卡救济」。
 * `DEAL_ASSIST_USE_INTERVAL=false` 时 pipeline **忽略** every，改看盘面。
 * 调参若仍滑动 every，仅在重新打开间隔模式时生效。
 */
export const DEAL_ASSIST_USE_INTERVAL = false;
export const DEAL_CLEAR_ASSIST_EVERY = 99;
export const DEAL_CLEAR_ASSIST_EVERY_EARLY = 99;
export const DEAL_CLEAR_ASSIST_EVERY_MID = 99;
export const DEAL_CLEAR_ASSIST_EVERY_LATE = 99;
/** 偶发助清成功后最多再连 1 次，不连刷 */
export const DEAL_CLEAR_ASSIST_STREAK = 1;
/**
 * 局面助清（窒息/碎片）：看盘 roll，非固定轮数。
 * choke 更高、fragmented 略低；两次助清间至少隔 DEAL_ASSIST_MIN_GAP 盘（streak 续推除外）。
 */
export const DEAL_PRESSURE_ASSIST_CHANCE_CHOKE = 0.52;
export const DEAL_PRESSURE_ASSIST_CHANCE_FRAG = 0.36;
/** 两次压力助清之间最少间隔的「未助清 tray」数 */
export const DEAL_ASSIST_MIN_GAP = 2;
/** 助清/全清搜索允许的最高填充率 */
export const DEAL_CLEAR_ASSIST_FILL_MAX = 0.82;
/** 助清：三步后至少减少的占格数（或清空） */
export const DEAL_CLEAR_ASSIST_MIN_DROP = 5;
/**
 * fill 很低时收官强搜全清的上限 + 概率（彩蛋，非主循环）。
 */
export const DEAL_CLEAR_FINISHER_FILL_MAX = 0.22;
export const DEAL_FINISHER_CHANCE = 0.26;
/**
 * early 是否「每 tray 强制全清」——关闭，改为偶发。
 */
export const DEAL_EARLY_FORCE_FULL_CLEAR = false;
/**
 * 空腔补缺：early 略勤（大消可读），mid 更少。
 */
export const DEAL_CAVITY_GUIDE_CHANCE = 0.12;
export const DEAL_CAVITY_GUIDE_CHANCE_EARLY = 0.16;
export const DEAL_CAVITY_GUIDE_CHANCE_MID = 0.08;
/**
 * Setup 大消 payoff（T6「就差那一块」）：默认高于旧值；
 * 近满线多时 pipeline 还会再抬概率。
 */
export const DEAL_PAYOFF_CHANCE = 0.32;
export const DEAL_PAYOFF_CHANCE_EARLY = 0.4;
export const DEAL_PAYOFF_CHANCE_MID = 0.34;
export const DEAL_PAYOFF_CHANCE_LATE = 0.24;
/** payoff 至少造成几条线（行+列合计）才算钥匙 */
export const DEAL_PAYOFF_MIN_LINES = 2;
/** 近满差 1 的线 ≥ 此数时，强制高概率尝试钥匙块 */
export const DEAL_PAYOFF_NEAR_D1_FORCE = 2;
export const DEAL_PAYOFF_NEAR_FORCE_CHANCE = 0.88;
/**
 * 已推送「清屏向」tray 但玩家未盘空时，连续再推清屏向的最多次数（含首次）。
 * 超过后恢复普通发块，避免无限奶。
 */
export const DEAL_CLEAR_OFFER_RETRY_MAX = 6;
/**
 * early：压异形/过长条；采样时仍可用盘面引导加权（非整 tray 清屏包）。
 */
export const DEAL_EARLY_NEAT_SHAPES = true;
/** early 清屏友好分在 tray 优选中的权重（普通采样内） */
export const DEAL_EARLY_CLEAR_GUIDE_MUL = 0.35;
/**
 * 全阶段「整齐盘」引导：优选取优落点后 mess 不升、空洞减少的 tray。
 * 对齐原版「盘可满但结构整齐」。
 */
export const DEAL_NEAT_GUIDE_ALL_PHASES = true;
/** mid / late 整齐分倍率（相对 early guide） */
export const DEAL_NEAT_GUIDE_MUL_MID = 0.55;
export const DEAL_NEAT_GUIDE_MUL_LATE = 0.42;
/**
 * 入围 tray 若「优序放置后 mess 明显变差」则丢弃（0=关闭）。
 * 正数：允许 mess 增加的上限（boardMess 单位）。
 */
export const DEAL_NEAT_MAX_MESS_RISE = 2.8;
/** 采样模拟推进时用贴合最佳落点（而非任意点），略贵但更整齐 */
export const DEAL_NEAT_SIM_BEST_PLACE = true;
/**
 * 禁止常规推送 ≤2 格块（2 直 / 1×1）；仅高填充 clutch 小概率放开。
 */
export const DEAL_BAN_MICRO = true;
/** late 且 fill≥此值时，小概率允许 1 个 ≤2 格破局块 */
export const DEAL_MICRO_CLUTCH_FILL = 0.62;
export const DEAL_MICRO_CLUTCH_CHANCE = 0.14;

/**
 * 角色袋（β）：按阶段配比抽 staple/solver/key/rare，再在袋内加权。
 * 见 research/DEAL-SHAPE-ROLES.md
 */
export const DEAL_BAG_ENABLED = true;
/** early 禁 2直/缺角（γ），fallback 时可放宽 */
export const DEAL_EARLY_BAN_TINY = true;
/** 阶段 × 角色目标占比（相对权重，会归一化） */
/** early：主粮为主，solver（短L/T/缺角）明显可出，避免单调 */
export const DEAL_ROLE_EARLY_STAPLE = 0.58;
export const DEAL_ROLE_EARLY_SOLVER = 0.28;
export const DEAL_ROLE_EARLY_KEY = 0.1;
export const DEAL_ROLE_EARLY_RARE = 0.04;
export const DEAL_ROLE_MID_STAPLE = 0.42;
export const DEAL_ROLE_MID_SOLVER = 0.28;
export const DEAL_ROLE_MID_KEY = 0.22;
export const DEAL_ROLE_MID_RARE = 0.08;
export const DEAL_ROLE_LATE_STAPLE = 0.25;
export const DEAL_ROLE_LATE_SOLVER = 0.4;
export const DEAL_ROLE_LATE_KEY = 0.28;
export const DEAL_ROLE_LATE_RARE = 0.07;

/**
 * 盘面贴合加权：L/T 等多变体按「邻接/消线/凹口」优先，而非只保证能放。
 * 关闭则退回纯权重可放抽样。
 */
export const DEAL_FIT_SCORE_ENABLED = true;
/** 贴合分对抽样权重的增益尺度（越大越偏严丝合缝） */
export const DEAL_FIT_WEIGHT = 3.4;
/** tray 候选池里 snug 分的权重 */
export const DEAL_FIT_TRAY_SCORE_MUL = 0.72;

// —— 手感 FEEL_* ——
/**
 * 正版 tray 手感：
 * - 底栏 **三等分区**，区内任意点点中该区块
 * - 拿起：固定 **board 格尺寸** + 相对 **槽中心** 的固定抬升位置（与点击落点无关）
 * - 再拖：相对拿起时的指针位移跟手；上移可再加大抬升
 * - 与盘重叠够才出投影
 * 单位：board cell；Y 向下为正时 offset 为负。
 */
/** 拿起时块中心相对槽中心的上抬（固定姿态，不跟指尖）— 手感1 真机标定 */
export const FEEL_DRAG_OFFSET_Y_MIN = -2.5;
/** 大幅上移后再略抬（相对拿起姿态额外上抬量叠到 MAX）— 手感1 真机标定 */
export const FEEL_DRAG_OFFSET_Y_MAX = -4.0;
/** 兼容旧名 */
export const FEEL_DRAG_OFFSET_Y = FEEL_DRAG_OFFSET_Y_MAX;
export const FEEL_DRAG_OFFSET_Y_ALT = -2.5;
export const FEEL_DRAG_OFFSET_X = 0;
/**
 * 自拿起点「向上」移动达到该格数时抬升到 MAX。— 手感1 真机标定
 */
export const FEEL_DRAG_LIFT_TRAVEL_CELLS = 4.5;
/** 抬升曲线幂（真机调参）— 手感1 */
export const FEEL_DRAG_LIFT_POWER = 1.75;
/**
 * 触控跟手增益：积分位移 = 指尖位移 × gain。
 * - MODE 0（手感1）：按「指速 cells/s」映射 GAIN_MIN→MAX（慢精、快远）
 * - MODE 1（手感2）：固定倍率 GAIN_K（k=1 → 滑动距离与块位移 1:1；k>1 → 小手大块）
 */
/** 0=速度映射（手感1）· 1=固定倍率（手感2） */
export const FEEL_POINTER_GAIN_MODE = 0;
/** 速度模式：慢速增益下限 — 手感1 */
export const FEEL_POINTER_GAIN_MIN = 1.0;
/** 速度模式：快速增益上限 — 手感1 真机标定（截图 1.35） */
export const FEEL_POINTER_GAIN_MAX = 1.35;
/**
 * 指速参考（格/秒，仅 MODE=0）：达到此速度附近增益接近 MAX。— 手感1 真机标定
 */
export const FEEL_POINTER_SPEED_REF = 6;
/**
 * 固定跟手倍率（仅 MODE=1）：块位移 = 指尖位移 × K。
 * 1 = 1:1；>1 小幅滑动块大范围移动。
 */
export const FEEL_POINTER_GAIN_K = 1.0;
/**
 * @deprecated 旧「距离插值增益」参考；MODE=1 已改为固定 K，保留键避免旧存档炸字段
 */
export const FEEL_POINTER_DIST_REF = 5;
/** @deprecated 兼容旧名：等同快速增益 */
export const FEEL_DRAG_FOLLOW_GAIN_MAX = FEEL_POINTER_GAIN_MAX;
/**
 * 投影介入：形状最底一排占格与棋盘有重叠即显示 ghost。
 * 保留该常量供调参；默认 0 = 只要进入立刻显示。
 */
export const FEEL_BOARD_ENGAGE_OVERLAP = 0;

/** 投影换格瞬态震动（普通挪格，无消）— 真机面板标定 */
export const FEEL_HAPTIC_GHOST_INTENSITY = 0.45;
export const FEEL_HAPTIC_GHOST_SHARPNESS = 0.25;
/** 投影到「将消」格 — 真机面板标定 */
export const FEEL_HAPTIC_CLEAR_PREVIEW_INTENSITY = 0.7;
export const FEEL_HAPTIC_CLEAR_PREVIEW_SHARPNESS = 0.3;
/**
 * 消除手感 = T→C→T→C→T→C（3 波）；手感1/2 出厂共用。
 */
/** 段间间隔（ms）：T↔C、C↔T 共用 */
export const FEEL_HAPTIC_CLEAR_FX_GAP_MS = 30;

// —— 波1 ——
export const FEEL_HAPTIC_CLEAR_FX_T1_INTENSITY = 1.0;
export const FEEL_HAPTIC_CLEAR_FX_T1_SHARPNESS = 0.45;
export const FEEL_HAPTIC_CLEAR_FX_C1_DURATION_MS = 50;
export const FEEL_HAPTIC_CLEAR_FX_C1_START_INTENSITY = 0.4;
export const FEEL_HAPTIC_CLEAR_FX_C1_START_SHARPNESS = 0.1;
export const FEEL_HAPTIC_CLEAR_FX_C1_END_INTENSITY = 0.2;
export const FEEL_HAPTIC_CLEAR_FX_C1_END_SHARPNESS = 0.0;
/** @deprecated 兼容旧名 → 波1 */
export const FEEL_HAPTIC_CLEAR_FX_TRANSIENT_INTENSITY = FEEL_HAPTIC_CLEAR_FX_T1_INTENSITY;
export const FEEL_HAPTIC_CLEAR_FX_TRANSIENT_SHARPNESS = FEEL_HAPTIC_CLEAR_FX_T1_SHARPNESS;
export const FEEL_HAPTIC_CLEAR_FX_DURATION_MS = FEEL_HAPTIC_CLEAR_FX_C1_DURATION_MS;
export const FEEL_HAPTIC_CLEAR_FX_START_INTENSITY = FEEL_HAPTIC_CLEAR_FX_C1_START_INTENSITY;
export const FEEL_HAPTIC_CLEAR_FX_START_SHARPNESS = FEEL_HAPTIC_CLEAR_FX_C1_START_SHARPNESS;
export const FEEL_HAPTIC_CLEAR_FX_END_INTENSITY = FEEL_HAPTIC_CLEAR_FX_C1_END_INTENSITY;
export const FEEL_HAPTIC_CLEAR_FX_END_SHARPNESS = FEEL_HAPTIC_CLEAR_FX_C1_END_SHARPNESS;

// —— 波2 ——
export const FEEL_HAPTIC_CLEAR_FX_T2_INTENSITY = 0.75;
export const FEEL_HAPTIC_CLEAR_FX_T2_SHARPNESS = 0.45;
export const FEEL_HAPTIC_CLEAR_FX_C2_DURATION_MS = 45;
export const FEEL_HAPTIC_CLEAR_FX_C2_START_INTENSITY = 0.32;
export const FEEL_HAPTIC_CLEAR_FX_C2_START_SHARPNESS = 0.08;
export const FEEL_HAPTIC_CLEAR_FX_C2_END_INTENSITY = 0.15;
export const FEEL_HAPTIC_CLEAR_FX_C2_END_SHARPNESS = 0.0;

// —— 波3 ——
export const FEEL_HAPTIC_CLEAR_FX_T3_INTENSITY = 0.55;
export const FEEL_HAPTIC_CLEAR_FX_T3_SHARPNESS = 0.4;
export const FEEL_HAPTIC_CLEAR_FX_C3_DURATION_MS = 40;
export const FEEL_HAPTIC_CLEAR_FX_C3_START_INTENSITY = 0.25;
export const FEEL_HAPTIC_CLEAR_FX_C3_START_SHARPNESS = 0.06;
export const FEEL_HAPTIC_CLEAR_FX_C3_END_INTENSITY = 0.1;
export const FEEL_HAPTIC_CLEAR_FX_C3_END_SHARPNESS = 0.0;

/** 同一/连发去重冷却（ms） */
export const FEEL_HAPTIC_GHOST_COOLDOWN_MS = 108;
/**
 * tray 内单格边长 / 棋盘单格边长。
 * 正版底栏 ≈ 0.50；拖起后 1.0。
 */
export const FEEL_TRAY_SCALE = 0.5;
export const FEEL_BOARD_SCALE = 1.0;
/** 拖起额外放大；正版与盘格 1:1，不额外 pop */
export const FEEL_DRAG_SCALE_POP = 1.0;
export const FEEL_FOLLOW = 1;
/**
 * 拖拽视觉平滑时间常数（秒）。指数趋近目标位置。
 * 0 = 无延迟直跟；略 >0 减抖。过大 → 拖影延迟感。
 */
export const FEEL_SMOOTH_TIME = 0.012;
/** 指速增益自身再平滑（秒）；过大会让加速「慢半拍」 */
export const FEEL_GAIN_SMOOTH_TIME = 0.018;
// 上两项与真机面板一致：短平滑、跟手优先
/** 合法投影：本色半透；非法不显示投影 */
export const FEEL_GHOST_ALPHA = 0.15;
/**
 * 开阔区投影换格阈值（格）。相邻方向仍可放置 → 约 0.5 即跟手。
 */
export const FEEL_GHOST_OPEN_SNAP = 0.5;
/**
 * 边缘区慢速粘滞阈值（格）。
 * 仅「慢速 + 朝不可放方向」时使用，防贴边误滑；快速时不生效。
 */
export const FEEL_GHOST_EDGE_HOLD = 1.3;
/**
 * 影相对块 free 原点的最大切比雪夫距离（格）。
 * 超过则取消投影（影不许甩块）；与 EDGE_HOLD 无关。
 * 默认 ~1：邻格内可跟，再远灭影。
 */
export const FEEL_GHOST_MAX_LAG = 1.3;
/**
 * 指速 ≥ 参考指速 × 该系数 → 投影进入「快速精准」模式（free 吸附，不贴边 1.5）。
 * 慢下来后回到边缘粘滞。
 */
export const FEEL_GHOST_FAST_SPEED_RATIO = 0.45;
/**
 * 快速模式退出滞回：指速 < 进入阈值 × 该系数才回慢速贴边。
 */
export const FEEL_GHOST_FAST_EXIT_RATIO = 0.55;
/**
 * 轴向主导：|Δ横| 与 |Δ竖| 差超过该值（格）才锁定主轴，
 * 避免横向拖时竖直噪声让投影上下跳。
 */
export const FEEL_AXIS_DOMINANCE = 0.05;
export const FEEL_DRAG_ALPHA = 0.95;
export const FEEL_PRECLEAR_HIGHLIGHT = true;
/** true：仅合法可 commit；非法不显示投影；换格用 open/edge 双阈值 */
export const FEEL_SNAP_ONLY_VALID = true;
export const FEEL_COMMIT_MS = 90;
export const FEEL_REJECT_MS = 180;
/** 落子消行动画时长（ms）：自落子处向外依次收缩 → 清格 */
export const FEEL_CLEAR_MS = 280;
/** 消行错峰：时间轴前段用于按距离排序启动（0–1） */
export const FEEL_CLEAR_STAGGER = 0.42;
/** 单格收缩占用时间轴比例（越大单格缩/转越慢） */
export const FEEL_CLEAR_SHRINK = 0.4;
/** 每格碎裂粒子数（0 关） */
export const FEEL_CLEAR_DEBRIS_COUNT = 2;
/** 粒子存活时长（ms，从弹出起算，可长于消行动画） */
export const FEEL_CLEAR_DEBRIS_LIFE_MS = 720;
/** 重力加速度（世界单位/s²，Y 向上为正时向下为负） */
export const FEEL_CLEAR_DEBRIS_GRAVITY = 2200;
/** 弹出初速系数（× 格边长） */
export const FEEL_CLEAR_DEBRIS_SPEED = 2.8;
/**
 * 消行屏幕震动（boardView 位移，单位≈像素）。
 * 时长与 FEEL_CLEAR_MS 同步；软起振 + 平滑衰减（偏柔和）。
 * **峰值最小 = AMP_MIN**（单消）；每多 1 条 +STEP，封顶 MAX。
 */
export const FEEL_CLEAR_SHAKE_AMP_MIN = 11;
/** @deprecated 兼容旧名 */
export const FEEL_CLEAR_SHAKE_AMP_DEFAULT = FEEL_CLEAR_SHAKE_AMP_MIN;
export const FEEL_CLEAR_SHAKE_AMP_1 = FEEL_CLEAR_SHAKE_AMP_MIN;
export const FEEL_CLEAR_SHAKE_AMP_STEP = 4.0;
export const FEEL_CLEAR_SHAKE_AMP_MAX = 28;
/** 震动振荡频率（Hz，偏低更柔） */
export const FEEL_CLEAR_SHAKE_HZ = 18;
export const FEEL_INPUT_LOCK_MS = 150;
export const FEEL_HIT_SLOP = 0.2;
export const FEEL_PICKUP_SCALE_MS = 100;
export const FEEL_REFILL_STAGGER_MS = 40;
/** 死亡演出：开场全屏闪红总时长（ms，内含两次柔和淡入淡出） */
export const FEEL_DEATH_FLASH_MS = 600;
/** 死亡演出：每一横排填满/揭开时长（ms，含淡入淡出） */
export const FEEL_DEATH_ROW_MS = 72;
/** 填满后 → 揭开前的停留（ms） */
export const FEEL_DEATH_PAUSE_MS = 420;

// —— 布局 / 格子几何（对齐正版重点）——
/**
 * 棋盘格「内容」相对 pitch 的单侧内缩。
 * 缝宽 = 2 * inset * cell。正版细槽 ≈ 1.2%–2% 单侧。
 * 只影响棋盘；tray 另议。
 */
/**
 * 盘面格缝（单侧 / pitch）。与 tray 对齐，避免空格缝看起来比摆放物粗。
 * 缝宽 ≈ 2 * inset * cell。
 */
export const BOARD_CELL_INSET = 0.004;
/**
 * tray 摆放物内部格缝（单侧 / pitch）。
 */
export const TRAY_CELL_INSET = 0.004;

/**
 * 布局比例（对齐正版竖屏截图，相对 frame / 盘格）：
 * - 棋盘左右约 5% 边距，水平居中
 * - 顶：分数/combo 区 + 小间隙
 * - 盘底 → tray 块顶：约 1.0 board cell
 * - tray 块带高度约 3.2×trayCell，底部留 home/广告呼吸
 */
/** 棋盘左右边距 / frame 宽（不含 safe）。正版约 5% 侧 */
export const LAYOUT_GRID_MARGIN_X = 0.05;
/** 分数区下沿到棋盘顶 / frame 高 */
export const LAYOUT_GRID_TOP_GAP = 0.018;
/** 顶部分数占位 / frame 高（几何空间，非 UI 样式） */
export const LAYOUT_HUD_SCORE_H = 0.11;
/** 分数文字字号（CSS px）— 真机调参默认 */
export const UI_SCORE_FONT_PX = 65;
/**
 * 分数垂直偏移 / frame 高（+ 下移）。
 * 只动 HUD 文字，不改变棋盘 pad（棋盘顶仍由 LAYOUT_HUD_SCORE_H 等决定）。
 * 真机调参默认 0.060。
 */
export const UI_SCORE_OFFSET_Y = 0.06;
/**
 * 棋盘垂直偏移 / frame 高（+ 下移）。
 * 真机调参：0.035。
 */
export const LAYOUT_BOARD_SHIFT_Y = 0.035;
/**
 * tray 相对「盘底+间距」再偏移 / frame 高（+ 下移）。
 * 真机调参：0。
 */
export const LAYOUT_TRAY_SHIFT_Y = -0.01;
/**
 * 棋盘底边 → tray 摆放物「顶」的间距，单位：board cell。
 * 正版约 0.8–1.2，取 1.0。
 */
export const LAYOUT_GAP_GRID_TRAY_CELLS = 1.0;
/** tray 内容带高度系数 × trayCell（需容纳约 3 格高形状 + 少量气口） */
/**
 * 底栏每个摆放区高度（× trayCell）。
 * 调参时只改外框/点击高度，区中心与棋盘尺寸不动（见 layout.js）。
 * 同时作为棋盘竖向占位的出厂参考高度。
 */
export const LAYOUT_TRAY_BAND_CELLS = 7;
/** 底边额外呼吸 / frame 高（safe.bottom 另加） */
export const LAYOUT_PAD_BOTTOM_EXTRA = 0.04;
/** tray 单槽可容纳的最大形状边长（格数），I5=5 */
export const TRAY_SLOT_CELLS = 5;

// —— 视觉：对齐正版紫底糖果（参考官方截图）——
export const COLOR = {
  /** 桌面紫渐变偏中 */
  bg: 0x6b5bdb,
  bgDeep: 0x4a3bb5,
  /** 棋盘深蓝紫 */
  boardFill: 0x241f52,
  boardFrame: 0x8b7cf0,
  boardFrameDark: 0x5a4fc4,
  /**
   * 空格：与盘底对比更强（深描边 + 中亮槽 + 内凹）
   */
  cellEmpty: 0x4a4499,
  cellEmptyStroke: 0x15122e,
  cellEmptyInner: 0x3a3480,
  /** tray 区（与桌面融合，几乎无框） */
  traySlot: 0x5c4ecf,
  traySlotStroke: 0x4a3bb5,
  /** 预亮 */
  preclear: 0xffe566,
  /** UI */
  accent: 0xff6bcb,
  text: 0xffffff,
};

/** 正版糖果色（高饱和、偏亮） */
export const PIECE_PALETTE = [
  0x4da3ff, // blue
  0xffd54a, // yellow / gold
  0xa78bfa, // soft purple
  0xff9f43, // orange
  0xff5c5c, // red
  0x4ade80, // green
  0x3dceff, // cyan / sky（截图拖中块）
  0x60a5fa, // light blue
  0xfbbf24, // amber
  0xf472b6, // pink
];

/** 调试状态默认隐藏（?debug=1 显示） */
export const SHOW_DEBUG_STATUS =
  typeof location !== 'undefined' &&
  /(?:\?|&)debug=1(?:&|$)/.test(location.search || '');

/** 显示底栏三等分摆放区（默认关） */
export const SHOW_TRAY_ZONES = false;

/**
 * 乐趣核实验 E2：tray 同时块数（1 或 3）。默认 3=Classic。
 * 运行时见 tune / `?e2=1`。实现读 `getActiveTraySize()`。
 */
export const DEBUG_TRAY_SIZE = 3;
/**
 * 乐趣核实验 E3：真随机发块（无 phase/助清/payoff/可放保证）。
 * 运行时见 tune / `?e3=1`。
 */
export const DEBUG_DEAL_TRUE_RANDOM = false;
