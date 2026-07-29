/**
 * 形状表 — Kefrov/Blast 12 族 + 权重（research/pieces-default.md）。
 * matrix[row][col] = 1；原点左上。
 */
import { PIECE_PALETTE } from './defaults.js';

/** @typedef {{ id: string, family: number, matrix: number[][] }} FormDef */
/** @typedef {{ id: string, color: number, matrix: number[][], family: number, cellColors: number[][] }} PieceDef */

export const PIECE_COLORS = PIECE_PALETTE;

/**
 * Kefrov forms[0..11] 展平为「族 + 变体」。
 * SHAPE_PROBS_CUM：抽 family 用（与 shapes.py probs 一致，总和 1200）。
 */
export const SHAPE_PROBS_CUM = [0, 127, 202, 242, 307, 434, 561, 688, 815, 942, 1069, 1144, 1200];

/** @type {FormDef[][]} 外层 family 0..11，内层变体 */
export const FORM_FAMILIES = [
  // 0: 2×2
  [{ id: 'f0_0', family: 0, matrix: [[1, 1], [1, 1]] }],
  // 1: 3×2 / 2×3
  [
    { id: 'f1_0', family: 1, matrix: [[1, 1, 1], [1, 1, 1]] },
    { id: 'f1_1', family: 1, matrix: [[1, 1], [1, 1], [1, 1]] },
  ],
  // 2: 3×3
  [
    {
      id: 'f2_0',
      family: 2,
      matrix: [
        [1, 1, 1],
        [1, 1, 1],
        [1, 1, 1],
      ],
    },
  ],
  // 3: 长 L
  [
    { id: 'f3_0', family: 3, matrix: [[1, 1, 1], [1, 0, 0], [1, 0, 0]] },
    { id: 'f3_1', family: 3, matrix: [[1, 1, 1], [0, 0, 1], [0, 0, 1]] },
    { id: 'f3_2', family: 3, matrix: [[1, 0, 0], [1, 0, 0], [1, 1, 1]] },
    { id: 'f3_3', family: 3, matrix: [[0, 0, 1], [0, 0, 1], [1, 1, 1]] },
  ],
  // 4: 短 L
  [
    { id: 'f4_0', family: 4, matrix: [[1, 1, 1], [1, 0, 0]] },
    { id: 'f4_1', family: 4, matrix: [[1, 1, 1], [0, 0, 1]] },
    { id: 'f4_2', family: 4, matrix: [[0, 0, 1], [1, 1, 1]] },
    { id: 'f4_3', family: 4, matrix: [[1, 0, 0], [1, 1, 1]] },
    { id: 'f4_4', family: 4, matrix: [[1, 0], [1, 0], [1, 1]] },
    { id: 'f4_5', family: 4, matrix: [[0, 1], [0, 1], [1, 1]] },
    { id: 'f4_6', family: 4, matrix: [[1, 1], [0, 1], [0, 1]] },
    { id: 'f4_7', family: 4, matrix: [[1, 1], [1, 0], [1, 0]] },
  ],
  // 5: Z/S
  [
    { id: 'f5_0', family: 5, matrix: [[0, 1, 1], [1, 1, 0]] },
    { id: 'f5_1', family: 5, matrix: [[1, 1, 0], [0, 1, 1]] },
    { id: 'f5_2', family: 5, matrix: [[1, 0], [1, 1], [0, 1]] },
    { id: 'f5_3', family: 5, matrix: [[0, 1], [1, 1], [1, 0]] },
  ],
  // 6: T
  [
    { id: 'f6_0', family: 6, matrix: [[0, 1, 0], [1, 1, 1]] },
    { id: 'f6_1', family: 6, matrix: [[1, 1, 1], [0, 1, 0]] },
    { id: 'f6_2', family: 6, matrix: [[1, 0], [1, 1], [1, 0]] },
    { id: 'f6_3', family: 6, matrix: [[0, 1], [1, 1], [0, 1]] },
  ],
  // 7: 2 直
  [
    { id: 'f7_0', family: 7, matrix: [[1, 1]] },
    { id: 'f7_1', family: 7, matrix: [[1], [1]] },
  ],
  // 8: 3 直
  [
    { id: 'f8_0', family: 8, matrix: [[1, 1, 1]] },
    { id: 'f8_1', family: 8, matrix: [[1], [1], [1]] },
  ],
  // 9: 2×2 缺角（小 L 三格）
  [
    { id: 'f9_0', family: 9, matrix: [[1, 0], [1, 1]] },
    { id: 'f9_1', family: 9, matrix: [[1, 1], [0, 1]] },
    { id: 'f9_2', family: 9, matrix: [[1, 1], [1, 0]] },
    { id: 'f9_3', family: 9, matrix: [[0, 1], [1, 1]] },
  ],
  // 10: 4 直
  [
    { id: 'f10_0', family: 10, matrix: [[1, 1, 1, 1]] },
    { id: 'f10_1', family: 10, matrix: [[1], [1], [1], [1]] },
  ],
  // 11: 5 直
  [
    { id: 'f11_0', family: 11, matrix: [[1, 1, 1, 1, 1]] },
    { id: 'f11_1', family: 11, matrix: [[1], [1], [1], [1], [1]] },
  ],
];

/** 1×1 回落 */
export const FORM_1X1 = { id: 'dot', family: -1, matrix: [[1]] };

export function matrixSize(matrix) {
  return { rows: matrix.length, cols: matrix[0]?.length ?? 0 };
}

export function countCells(matrix) {
  let n = 0;
  for (const row of matrix) for (const v of row) if (v) n += 1;
  return n;
}

export function cloneMatrix(matrix) {
  return matrix.map((row) => row.slice());
}

export function matrixKey(matrix) {
  return matrix.map((row) => row.join('')).join('/');
}

function randomPaletteColor() {
  return PIECE_COLORS[Math.floor(Math.random() * PIECE_COLORS.length)];
}

/**
 * 默认样式：整 piece 单色（正版底栏 T/绿/橙 各一色）。
 * cellColors 仍提供，便于以后皮肤切多色。
 * @param {FormDef} form
 * @returns {PieceDef}
 */
export function makePiece(form) {
  const matrix = cloneMatrix(form.matrix);
  const color = randomPaletteColor();
  const cellColors = matrix.map((row) => row.map((v) => (v ? color : 0)));
  return {
    id: form.id,
    family: form.family,
    color,
    matrix,
    cellColors,
  };
}

/** 按 Kefrov 权重抽 family */
export function pickFamilyIndex(rng = Math.random) {
  const r = Math.floor(rng() * 1200);
  for (let i = 0; i < 12; i++) {
    if (SHAPE_PROBS_CUM[i] <= r && r < SHAPE_PROBS_CUM[i + 1]) return i;
  }
  return 0;
}

/**
 * 按权重抽一个变体 form
 * @param {() => number} [rng]
 * @returns {FormDef}
 */
export function pickWeightedForm(rng = Math.random) {
  const fam = pickFamilyIndex(rng);
  const variants = FORM_FAMILIES[fam];
  return variants[Math.floor(rng() * variants.length)];
}

export function pickRandomVariant(family, rng = Math.random) {
  const variants = FORM_FAMILIES[family];
  if (!variants?.length) return FORM_1X1;
  return variants[Math.floor(rng() * variants.length)];
}

// —— 兼容 M1 API ——
export const FORMS_M1 = FORM_FAMILIES.flat();

export function randomForm() {
  return pickWeightedForm();
}

export function resetPieceSequence() {
  /* no-op: M2 用权重发块 */
}

export function nextFormFromSequence() {
  return pickWeightedForm();
}
