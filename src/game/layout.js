/**
 * 棋盘 / tray 几何（参数来自 tune，默认对齐正版竖屏）。
 *
 * 摆放区高度滑条：只改区外框 h，不改棋盘尺寸、不改区中心位置。
 */
import {
  GRID,
  LAYOUT_TRAY_BAND_CELLS as DEFAULT_TRAY_BAND_CELLS,
  TRAY_SIZE,
} from './defaults.js';
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
  /**
   * 棋盘占位只用「出厂」区高，与滑条解耦——
   * 否则调高度会连带缩放棋盘，整块布局上下跳。
   */
  const packBandCells = Math.max(0.8, DEFAULT_TRAY_BAND_CELLS);
  const trayStackCells = gapCells + packBandCells * scale;

  const maxByW = usableW;
  const maxByH = usableH / (1 + trayStackCells / GRID);
  const boardSideMax = Math.min(maxByW, maxByH);
  const boardSide = boardSideMax * t.LAYOUT_BOARD_SCALE;
  const cell = boardSide / GRID;

  const gap = cell * gapCells;
  const trayCell = cell * scale;

  const gridX = padL + (usableW - boardSide) / 2;
  const gridY = padT + fh * t.LAYOUT_BOARD_SHIFT_Y;

  const trayX = padL;
  const trayW = usableW;
  // 水平：三等分；垂直：高度随滑条，中心位置固定
  const colW = usableW / TRAY_SIZE;
  const zoneW = colW;
  /** 视觉/点击高度（滑条） */
  const bandCells = Math.max(0.8, t.LAYOUT_TRAY_BAND_CELLS);
  const zoneH = Math.max(trayCell * 1.2, trayCell * bandCells);
  const trayH = zoneH;

  /**
   * 锚点 = 盘底 + 间距 + 出厂半高 + 偏移。
   * 滑条改 zoneH 时绕该中心上下对称伸缩，块中心 (cx,cy) 不动。
   */
  const packBandH = trayCell * packBandCells;
  const trayAnchorCy =
    gridY + boardSide + gap + fh * t.LAYOUT_TRAY_SHIFT_Y + packBandH * 0.5;
  const trayY = trayAnchorCy - zoneH * 0.5;

  const boardCellInset = t.BOARD_CELL_INSET;
  const trayCellInset = t.TRAY_CELL_INSET;
  const cellFill = cell * (1 - 2 * boardCellInset);
  const cellGapPx = cell * 2 * boardCellInset;
  const trayCellFill = trayCell * (1 - 2 * trayCellInset);
  const trayCellGapPx = trayCell * 2 * trayCellInset;

  /** @type {{ index: number, x: number, y: number, w: number, h: number, cx: number, cy: number }[]} */
  const traySlots = [];
  for (let i = 0; i < TRAY_SIZE; i++) {
    const x = trayX + i * colW;
    const y = trayY;
    traySlots.push({
      index: i,
      x,
      y,
      w: zoneW,
      h: zoneH,
      cx: x + zoneW / 2,
      cy: trayAnchorCy,
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
