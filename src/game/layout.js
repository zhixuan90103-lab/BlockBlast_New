/**
 * 棋盘 / tray 几何（参数来自 tune，默认对齐正版竖屏）。
 */
import { GRID, TRAY_SIZE } from './defaults.js';
import { getTune } from './tune.js';

/**
 * @param {{ width: number, height: number }} frame
 * @param {{ top: number, right: number, bottom: number, left: number }} safe
 */
export function computeLayout(frame, safe) {
  const t = getTune();
  const fw = frame.width;
  const fh = frame.height;
  if (fw < 2 || fh < 2) {
    return emptyLayout(fw, fh);
  }

  const padL = safe.left + fw * t.LAYOUT_GRID_MARGIN_X;
  const padR = safe.right + fw * t.LAYOUT_GRID_MARGIN_X;
  const padT = safe.top + fh * (t.LAYOUT_GRID_TOP_GAP + t.LAYOUT_HUD_SCORE_H);
  const padB = safe.bottom + fh * t.LAYOUT_PAD_BOTTOM_EXTRA;

  const usableW = Math.max(1, fw - padL - padR);
  const usableH = Math.max(1, fh - padT - padB);

  const scale = t.FEEL_TRAY_SCALE;
  const gapCells = t.LAYOUT_GAP_GRID_TRAY_CELLS;
  const bandCells = t.LAYOUT_TRAY_BAND_CELLS;
  // tray 点击区为正方形边长 ≈ usableW/3 → 约 GRID/3 个 board cell 高
  const traySquareCells = Math.max(bandCells * scale, GRID / TRAY_SIZE);
  const trayStackCells = gapCells + traySquareCells;

  const maxByW = usableW;
  const maxByH = usableH / (1 + trayStackCells / GRID);
  const boardSideMax = Math.min(maxByW, maxByH);
  const boardSide = boardSideMax * t.LAYOUT_BOARD_SCALE;
  const cell = boardSide / GRID;

  const gap = cell * gapCells;
  const trayCell = cell * scale;

  const gridX = padL + (usableW - boardSide) / 2;
  const gridY = padT + fh * t.LAYOUT_BOARD_SHIFT_Y;

  const trayY = gridY + boardSide + gap + fh * t.LAYOUT_TRAY_SHIFT_Y;
  const trayX = padL;
  const trayW = usableW;
  // 三等分列宽；点击区为正方形（边长 = 列宽）
  const colW = usableW / TRAY_SIZE;
  const zoneSide = colW;
  const trayH = Math.max(zoneSide, trayCell * bandCells, trayCell * 2.5);

  const boardCellInset = t.BOARD_CELL_INSET;
  const trayCellInset = t.TRAY_CELL_INSET;
  const cellFill = cell * (1 - 2 * boardCellInset);
  const cellGapPx = cell * 2 * boardCellInset;
  const trayCellFill = trayCell * (1 - 2 * trayCellInset);
  const trayCellGapPx = trayCell * 2 * trayCellInset;

  /** @type {{ index: number, x: number, y: number, w: number, h: number, cx: number, cy: number }[]} */
  const traySlots = [];
  for (let i = 0; i < TRAY_SIZE; i++) {
    // 列内水平居中；垂直贴 tray 带顶（与盘间距之后）
    const x = trayX + i * colW + (colW - zoneSide) / 2;
    const y = trayY + Math.max(0, (trayH - zoneSide) / 2);
    traySlots.push({
      index: i,
      x,
      y,
      w: zoneSide,
      h: zoneSide,
      cx: x + zoneSide / 2,
      cy: y + zoneSide / 2,
    });
  }

  return {
    frameW: fw,
    frameH: fh,
    cell,
    cellFill,
    cellGapPx,
    boardCellInset,
    boardSide,
    grid: {
      x: gridX,
      y: gridY,
      w: boardSide,
      h: boardSide,
    },
    tray: {
      x: trayX,
      y: trayY,
      w: trayW,
      h: trayH,
      cell: trayCell,
      cellFill: trayCellFill,
      cellGapPx: trayCellGapPx,
      cellInset: trayCellInset,
      scale,
      slots: traySlots,
      gapAbove: gap,
    },
    cellRect(col, row) {
      return {
        x: gridX + col * cell,
        y: gridY + row * cell,
        w: cell,
        h: cell,
      };
    },
  };
}

function emptyLayout(fw, fh) {
  const t = getTune();
  return {
    frameW: fw,
    frameH: fh,
    cell: 1,
    cellFill: 1,
    cellGapPx: 0,
    boardCellInset: t.BOARD_CELL_INSET,
    boardSide: 0,
    grid: { x: 0, y: 0, w: 0, h: 0 },
    tray: {
      x: 0,
      y: 0,
      w: 0,
      h: 0,
      cell: 1,
      cellFill: 1,
      cellGapPx: 0,
      cellInset: t.TRAY_CELL_INSET,
      scale: t.FEEL_TRAY_SCALE,
      slots: [],
      gapAbove: 0,
    },
    cellRect() {
      return { x: 0, y: 0, w: 1, h: 1 };
    },
  };
}

export function frameToThree(x, y, frameW, frameH) {
  return {
    x: x - frameW / 2,
    y: frameH / 2 - y,
  };
}
