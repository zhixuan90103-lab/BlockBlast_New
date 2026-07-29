/**
 * 8×8 网格逻辑：fits / place / clear 行列（无重力）。
 */
import { GRID } from './defaults.js';
import { matrixSize } from './forms.js';

export function createGrid() {
  /** @type {(number|null)[][]} color or null */
  const cells = Array.from({ length: GRID }, () => Array(GRID).fill(null));

  function inBounds(r, c) {
    return r >= 0 && r < GRID && c >= 0 && c < GRID;
  }

  /**
   * @param {number[][]} matrix
   * @param {number} originRow
   * @param {number} originCol
   */
  function fits(matrix, originRow, originCol) {
    const { rows, cols } = matrixSize(matrix);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!matrix[r][c]) continue;
        const gr = originRow + r;
        const gc = originCol + c;
        if (!inBounds(gr, gc)) return false;
        if (cells[gr][gc] != null) return false;
      }
    }
    return true;
  }

  /**
   * @param {number[][]} matrix
   * @param {number} originRow
   * @param {number} originCol
   * @param {number | number[][]} colorOrGrid 单色或与 matrix 同形的颜色格
   */
  function place(matrix, originRow, originCol, colorOrGrid) {
    if (!fits(matrix, originRow, originCol)) return false;
    const { rows, cols } = matrixSize(matrix);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!matrix[r][c]) continue;
        const col =
          Array.isArray(colorOrGrid)
            ? colorOrGrid[r]?.[c] || colorOrGrid[0]?.[0] || 0x4a9eff
            : colorOrGrid;
        cells[originRow + r][originCol + c] = col;
      }
    }
    return true;
  }

  function findFullLines() {
    /** @type {number[]} */
    const rows = [];
    /** @type {number[]} */
    const cols = [];
    for (let r = 0; r < GRID; r++) {
      if (cells[r].every((v) => v != null)) rows.push(r);
    }
    for (let c = 0; c < GRID; c++) {
      let full = true;
      for (let r = 0; r < GRID; r++) {
        if (cells[r][c] == null) {
          full = false;
          break;
        }
      }
      if (full) cols.push(c);
    }
    return { rows, cols, count: rows.length + cols.length };
  }

  /**
   * 模拟放置后将满的行/列（不改盘面）— preclear
   */
  function previewClearLines(matrix, originRow, originCol) {
    if (!fits(matrix, originRow, originCol)) {
      return { rows: [], cols: [], count: 0 };
    }
    const sim = cells.map((row) => row.slice());
    const { rows: h, cols: w } = matrixSize(matrix);
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        if (matrix[r][c]) sim[originRow + r][originCol + c] = 1;
      }
    }
    /** @type {number[]} */
    const fullRows = [];
    /** @type {number[]} */
    const fullCols = [];
    for (let r = 0; r < GRID; r++) {
      if (sim[r].every((v) => v != null)) fullRows.push(r);
    }
    for (let c = 0; c < GRID; c++) {
      let full = true;
      for (let r = 0; r < GRID; r++) {
        if (sim[r][c] == null) {
          full = false;
          break;
        }
      }
      if (full) fullCols.push(c);
    }
    return { rows: fullRows, cols: fullCols, count: fullRows.length + fullCols.length };
  }

  function clearLines(lineInfo) {
    const { rows, cols } = lineInfo;
    for (const r of rows) {
      for (let c = 0; c < GRID; c++) cells[r][c] = null;
    }
    for (const c of cols) {
      for (let r = 0; r < GRID; r++) cells[r][c] = null;
    }
    return rows.length + cols.length;
  }

  function isEmpty() {
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        if (cells[r][c] != null) return false;
      }
    }
    return true;
  }

  /**
   * 盘上是否存在任意合法落点
   * @param {number[][]} matrix
   */
  function canPlaceAnywhere(matrix) {
    const { rows, cols } = matrixSize(matrix);
    for (let r = 0; r <= GRID - rows; r++) {
      for (let c = 0; c <= GRID - cols; c++) {
        if (fits(matrix, r, c)) return true;
      }
    }
    return false;
  }

  function reset() {
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) cells[r][c] = null;
    }
  }

  /** 深拷贝只读快照 */
  function snapshot() {
    return cells.map((row) => row.slice());
  }

  return {
    cells,
    fits,
    place,
    findFullLines,
    previewClearLines,
    clearLines,
    isEmpty,
    canPlaceAnywhere,
    reset,
    snapshot,
  };
}
