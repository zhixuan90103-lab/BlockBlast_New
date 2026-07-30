#!/usr/bin/env node
/**
 * 发块回归：空盘 / 半盘 / 残盘 各采样 N tray，输出直方图与验收门槛。
 *
 * 用法（在 three-webgpu-cap-shell 下）：
 *   node scripts/deal-histogram.mjs
 *   node scripts/deal-histogram.mjs --n 40
 *
 * 退出码：门槛失败 → 1
 */
import {
  generateTray,
  lastDealMeta,
  resetDealState,
} from '../src/game/deal/generate.js';
import { countCells } from '../src/game/forms.js';
import { shapeClassOf } from '../src/game/deal/shape-class.js';
import { roleOfFamily } from '../src/game/deal/bag.js';
import { countInstantFits } from '../src/game/deal/board-ops.js';

const args = process.argv.slice(2);
const nIdx = args.indexOf('--n');
const N = nIdx >= 0 ? Math.max(5, Number(args[nIdx + 1]) || 30) : 30;

function makeGrid(cells) {
  return {
    snapshot: () => cells.map((row) => row.slice()),
    canPlaceAnywhere() {
      return true;
    },
  };
}

/** 空盘 */
function boardEmpty() {
  return Array.from({ length: 8 }, () => Array(8).fill(null));
}

/** 左半满 ~50% */
function boardHalf() {
  const c = boardEmpty();
  for (let r = 0; r < 8; r++) {
    for (let col = 0; col < 4; col++) c[r][col] = 1;
  }
  return c;
}

/** 残盘 ~65%：右下空洞 + 零散空 */
function boardLate() {
  const c = Array.from({ length: 8 }, () => Array(8).fill(1));
  // 挖一些可塞缝的洞
  for (let r = 5; r < 8; r++) {
    for (let col = 5; col < 8; col++) c[r][col] = null;
  }
  c[0][7] = null;
  c[1][7] = null;
  c[2][6] = null;
  c[3][5] = null;
  c[4][4] = null;
  c[7][0] = null;
  c[7][1] = null;
  c[6][0] = null;
  return c;
}

/** 稀疏占格（助清友好） */
function boardSparseClearable() {
  const c = boardEmpty();
  for (let col = 0; col < 6; col++) c[0][col] = 1;
  for (let col = 0; col < 5; col++) c[1][col] = 1;
  c[2][0] = 1;
  c[2][1] = 1;
  c[3][0] = 1;
  return c;
}

/** 场景默认分数：阶段按分数划分后，与盘面场景对齐体感 */
const SCORE_BY_SCENARIO = {
  empty: 0,
  half: 1500,
  late: 5000,
  sparse: 200,
};

function runScenario(name, boardFactory, score = 0) {
  resetDealState();
  const modes = {};
  const phases = {};
  const boardClasses = {};
  let micro = 0;
  let tiny3 = 0; // cells <= 3
  let totalPieces = 0;
  let sumAvgCells = 0;
  let sumInstant = 0;
  const cellHist = {};
  const roleHist = {};
  const classHist = {};
  const families = {};

  for (let i = 0; i < N; i++) {
    const cells = boardFactory();
    const grid = makeGrid(cells);
    const tray = generateTray(grid, { score });
    const meta = lastDealMeta;

    modes[meta.mode] = (modes[meta.mode] || 0) + 1;
    phases[meta.phase] = (phases[meta.phase] || 0) + 1;
    const bc = meta.boardClass || '?';
    boardClasses[bc] = (boardClasses[bc] || 0) + 1;
    sumInstant += meta.instant ?? countInstantFits(cells, tray);

    const av =
      tray.reduce((s, p) => s + countCells(p.matrix), 0) / Math.max(1, tray.length);
    sumAvgCells += av;

    for (const p of tray) {
      totalPieces += 1;
      const n = countCells(p.matrix);
      cellHist[n] = (cellHist[n] || 0) + 1;
      if (n <= 2) micro += 1;
      if (n <= 3) tiny3 += 1;
      const role = roleOfFamily(p.family ?? -1);
      roleHist[role] = (roleHist[role] || 0) + 1;
      const sc = shapeClassOf(p);
      classHist[sc] = (classHist[sc] || 0) + 1;
      const fam = p.family ?? -1;
      families[fam] = (families[fam] || 0) + 1;
    }
  }

  const microRate = micro / totalPieces;
  const tiny3Rate = tiny3 / totalPieces;
  const avgCells = sumAvgCells / N;
  const avgInstant = sumInstant / N;
  const assistRate =
    Object.entries(modes)
      .filter(([k]) => k.includes('clear') || k.includes('assist'))
      .reduce((s, [, v]) => s + v, 0) / N;

  return {
    name,
    N,
    modes,
    phases,
    boardClasses,
    microRate,
    tiny3Rate,
    avgCells,
    avgInstant,
    assistRate,
    cellHist,
    roleHist,
    classHist,
    families,
  };
}

/** 门槛（与 DEAL-SPEC 验收对齐，宽松一点做 CI） */
function checkGates(r) {
  /** @type {string[]} */
  const fails = [];
  if (r.name === 'empty') {
    if (r.microRate > 0.02) fails.push(`empty microRate ${r.microRate.toFixed(3)} > 0.02`);
    if (r.avgCells < 4.2) fails.push(`empty avgCells ${r.avgCells.toFixed(2)} < 4.2`);
    if (r.tiny3Rate > 0.35) fails.push(`empty tiny3Rate ${r.tiny3Rate.toFixed(3)} > 0.35`);
  }
  if (r.name === 'half') {
    if (r.microRate > 0.05) fails.push(`half microRate ${r.microRate.toFixed(3)} > 0.05`);
    if (r.avgCells < 3.6) fails.push(`half avgCells ${r.avgCells.toFixed(2)} < 3.6`);
  }
  if (r.name === 'late') {
    if (r.microRate > 0.12) fails.push(`late microRate ${r.microRate.toFixed(3)} > 0.12`);
    // late instant 允许 1–2 均值大致在此
    // late 主路径 instant≤2；含 assist 时均值可略高
    if (r.avgInstant < 0.8 || r.avgInstant > 2.85) {
      fails.push(`late avgInstant ${r.avgInstant.toFixed(2)} not in [0.8,2.85]`);
    }
  }
  return fails;
}

function printReport(r) {
  console.log(`\n=== ${r.name} (n=${r.N}) score=${SCORE_BY_SCENARIO[r.name] ?? 0} ===`);
  console.log(
    `avgCells=${r.avgCells.toFixed(2)}  micro≤2=${(r.microRate * 100).toFixed(1)}%  ≤3=${(r.tiny3Rate * 100).toFixed(1)}%  avgInstant=${r.avgInstant.toFixed(2)}  clear/assist=${(r.assistRate * 100).toFixed(0)}%`,
  );
  console.log('modes:', fmtHist(r.modes));
  console.log('phases:', fmtHist(r.phases));
  console.log('boardClass:', fmtHist(r.boardClasses));
  console.log('cells:', fmtHist(r.cellHist));
  console.log('roles:', fmtHist(r.roleHist));
  console.log('class:', fmtHist(r.classHist));
}

function fmtHist(h) {
  return Object.entries(h)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k}:${v}`)
    .join(' ');
}

const scenarios = [
  { name: 'empty', fn: boardEmpty },
  { name: 'half', fn: boardHalf },
  { name: 'late', fn: boardLate },
  { name: 'sparse', fn: boardSparseClearable },
];

console.log(`deal-histogram · N=${N} per scenario`);
/** @type {string[]} */
let allFails = [];
for (const s of scenarios) {
  const r = runScenario(s.name, s.fn, SCORE_BY_SCENARIO[s.name] ?? 0);
  printReport(r);
  const fails = checkGates(r);
  if (fails.length) {
    console.log('FAIL:', fails.join('; '));
    allFails = allFails.concat(fails);
  } else if (s.name !== 'sparse') {
    console.log('PASS gates');
  } else {
    console.log('(sparse: no hard gates, assist observation)');
  }
}

console.log('');
if (allFails.length) {
  console.error(`deal-histogram: ${allFails.length} gate failure(s)`);
  process.exit(1);
}
console.log('deal-histogram: all gates passed');
process.exit(0);
