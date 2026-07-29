/**
 * 棋盘 / tray / ghost / 拖拽 — 木纹 + 立体块视觉。
 */
import * as THREE from 'three';
import {
  CELL_CORNER_RATIO,
  createEmptyCell,
  createFilledCell,
  getRoundedRectGeometry,
} from './block-mesh.js';
import {
  COLOR,
  FEEL_CLEAR_SHRINK,
  FEEL_DRAG_ALPHA,
  GRID,
} from './defaults.js';
import { matrixSize } from './forms.js';
import { frameToThree } from './layout.js';
import { getTune } from './tune.js';

/**
 * @param {THREE.Scene} scene
 */
export function createBoardView(scene) {
  const root = new THREE.Group();
  root.name = 'boardView';
  scene.add(root);

  const staticRoot = new THREE.Group();
  const dynamicRoot = new THREE.Group();
  root.add(staticRoot);
  root.add(dynamicRoot);

  /** @type {THREE.Object3D[]} */
  let staticMeshes = [];
  /** 8×8 空槽：rebuild 后常驻，永不因落子/消行 dispose */
  /** @type {Map<string, THREE.Group>} */
  const boardCells = new Map();
  /** 落子填充块（叠在空槽之上）；消行只动这块 */
  /** @type {Map<string, THREE.Group>} */
  const boardFills = new Map();
  /** @type {THREE.Object3D[]} */
  let dynamicMeshes = [];

  function disposeObject(m) {
    m.traverse?.((o) => {
      // 共享模板几何勿 dispose（圆角缓存）
      if (o.geometry && !o.geometry.userData?.sharedTemplate) {
        o.geometry.dispose?.();
      }
      if (Array.isArray(o.material)) o.material.forEach((x) => x.dispose?.());
      else o.material?.dispose?.();
    });
    if (!m.traverse) {
      if (m.geometry && !m.geometry.userData?.sharedTemplate) {
        m.geometry.dispose?.();
      }
      m.material?.dispose?.();
    }
  }

  function clearList(list, parent) {
    for (const m of list) {
      parent.remove(m);
      disposeObject(m);
    }
    list.length = 0;
  }

  /**
   * @param {ReturnType<import('./layout.js').computeLayout>} layout
   */
  function clearBoardFills() {
    for (const fill of boardFills.values()) {
      staticRoot.remove(fill);
      disposeObject(fill);
    }
    boardFills.clear();
  }

  function removeBoardFill(key) {
    const fill = boardFills.get(key);
    if (!fill) return;
    staticRoot.remove(fill);
    disposeObject(fill);
    boardFills.delete(key);
  }

  function rebuildStatic(layout) {
    clearBoardFills();
    clearList(staticMeshes, staticRoot);
    boardCells.clear();

    const { cell, cellFill, grid, tray, frameW, frameH } = layout;
    if (cell < 2 || grid.w < 2) return;

    /** 棋盘格内容边长（决定格间距观感） */
    const size = Math.max(2, cellFill);

    // 棋盘底板：外框/底层圆角与空格一致（外扩平行圆角，避免角上「大圆角被空格压住」）
    {
      const framePad = cell * 0.08;
      const c = frameToThree(grid.x + grid.w / 2, grid.y + grid.h / 2, frameW, frameH);
      // 空格圆角半径（与 createEmptyCell 相同）
      const cellR = size * CELL_CORNER_RATIO;
      // 底层（盘面）：略大于 8×8 内容区，圆角 = 空格圆角 + 微边
      const innerW = grid.w + cell * 0.02;
      const innerH = grid.h + cell * 0.02;
      const innerR = cellR + cell * 0.01;
      // 浅色外框：再外扩 pad，圆角同步 +pad（平行圆角）
      const outerW = grid.w + framePad * 2;
      const outerH = grid.h + framePad * 2;
      const outerR = innerR + framePad;

      const outer = new THREE.Mesh(
        getRoundedRectGeometry(
          outerW,
          outerH,
          outerR / Math.min(outerW, outerH),
        ).clone(),
        new THREE.MeshBasicMaterial({ color: COLOR.boardFrame }),
      );
      outer.position.set(c.x, c.y, -0.08);
      staticRoot.add(outer);
      staticMeshes.push(outer);

      const bg = new THREE.Mesh(
        getRoundedRectGeometry(
          innerW,
          innerH,
          innerR / Math.min(innerW, innerH),
        ).clone(),
        new THREE.MeshBasicMaterial({ color: COLOR.boardFill }),
      );
      bg.position.set(c.x, c.y, -0.04);
      staticRoot.add(bg);
      staticMeshes.push(bg);
    }

    for (let row = 0; row < GRID; row++) {
      for (let col = 0; col < GRID; col++) {
        const rect = layout.cellRect(col, row);
        const center = frameToThree(rect.x + rect.w / 2, rect.y + rect.h / 2, frameW, frameH);
        const cellG = createEmptyCell(size, {
          stroke: COLOR.cellEmptyStroke,
          fill: COLOR.cellEmpty,
          inner: COLOR.cellEmptyInner,
        });
        cellG.position.set(center.x, center.y, 0);
        cellG.userData = { col, row, kind: 'cell', cellSize: size, isEmpty: true };
        staticRoot.add(cellG);
        staticMeshes.push(cellG);
        boardCells.set(`${row},${col}`, cellG);
      }
    }

    // tray：正版无大槽框，仅三区居中放块（命中区在 layout.slots，不绘制）
  }

  function paintEmptyStyle(group) {
    // rebuild empty look via mainMat only — full empty is multi-layer
    // Replace group children colors
    const mats = [];
    group.traverse((o) => {
      if (o.isMesh && o.material) mats.push(o.material);
    });
    if (mats[0]) mats[0].color.setHex(COLOR.cellEmptyStroke);
    if (mats[1]) mats[1].color.setHex(COLOR.cellEmpty);
    if (mats[2]) {
      mats[2].color.setHex(COLOR.cellEmptyInner);
      mats[2].opacity = 1;
      mats[2].transparent = false;
    }
    group.userData.isEmpty = true;
    group.scale.set(1, 1, 1);
    group.rotation.z = 0;
    group.visible = true;
  }

  /**
   * 在常驻空槽之上叠/换填充块（不碰空槽本身）
   * @param {string} key
   * @param {THREE.Group} slot 空槽
   * @param {number} color
   * @param {number} [opacity]
   */
  function ensureBoardFill(key, slot, color, opacity = 1) {
    let block = boardFills.get(key);
    if (block && block.userData.fillColor === color) {
      return block;
    }
    if (block) removeBoardFill(key);

    const size = slot.userData.cellSize || 20;
    block = createFilledCell(size, color, opacity, 0.02);
    block.position.set(slot.position.x, slot.position.y, 0.02);
    block.userData = {
      col: slot.userData.col,
      row: slot.userData.row,
      kind: 'filledOverlay',
      cellSize: size,
      isEmpty: false,
      fillColor: color,
    };
    staticRoot.add(block);
    boardFills.set(key, block);
    return block;
  }

  /**
   * 将消格集合
   * @param {{ rows?: number[], cols?: number[] } | null} preclear
   */
  function preclearKeySet(preclear) {
    /** @type {Set<string>} */
    const set = new Set();
    if (!preclear) return set;
    for (const r of preclear.rows || []) {
      for (let c = 0; c < GRID; c++) set.add(`${r},${c}`);
    }
    for (const c of preclear.cols || []) {
      for (let r = 0; r < GRID; r++) set.add(`${r},${c}`);
    }
    return set;
  }

  /**
   * @param {(number|null)[][]} cells
   * @param {{ rows: number[], cols: number[] } | null} preclear
   * @param {number} [nowMs] 用于将消旋转预警
   * @param {{
   *   cells?: { row: number, col: number, delay01?: number, spin?: number }[],
   *   t01?: number,
   *   sweep?: { fromLeft?: boolean, fromTop?: boolean },
   * } | null} [clearFx]
   */
  function paintBoard(cells, preclear, nowMs = 0, clearFx = null) {
    const pcSet = preclearKeySet(preclear);
    // 小幅度绕自身中心 Z 轴摆动（弧度）
    // 小幅、更快：角频率 0.038，幅度约 ±0.055 rad
    const wobble =
      pcSet.size > 0 ? Math.sin((nowMs || 0) * 0.038) * 0.055 : 0;
    const clearT = clearFx?.t01 ?? -1;
    /** @type {Map<string, { delay: number, spin: number }>} */
    const clearMeta = new Map();
    if (clearFx?.cells?.length) {
      for (const c of clearFx.cells) {
        clearMeta.set(`${c.row},${c.col}`, {
          delay: c.delay01 ?? 0,
          spin: c.spin ?? 0,
        });
      }
    }
    const shrinkSpan = Math.max(0.12, Math.min(0.6, FEEL_CLEAR_SHRINK));
    // 消行旋转峰值（弧度，约 ±42°），方向与扫过一致
    const clearSpinMax = 0.74;

    for (let row = 0; row < GRID; row++) {
      for (let col = 0; col < GRID; col++) {
        const key = `${row},${col}`;
        const slot = boardCells.get(key);
        if (!slot) continue;

        // 空槽始终在、始终满尺寸（消行/预警只动上层填充）
        paintEmptyStyle(slot);

        const v = cells[row][col];
        if (v == null) {
          removeBoardFill(key);
          continue;
        }

        const fill = ensureBoardFill(key, slot, v, 1);
        // 恢复 transform；禁止整块改色（会抹掉 bevel/高光）
        fill.scale.set(1, 1, 1);
        fill.rotation.z = 0;
        fill.position.set(slot.position.x, slot.position.y, 0.02);
        fill.visible = true;

        // 仅「已落子且属于将满行/列」才预警（空槽、无关块不预警）
        const inPreclear = pcSet.has(key);
        const meta = clearMeta.get(key);

        if (meta && clearT >= 0) {
          // 一边→另一边：缩 + 与方向一致的旋转
          const { delay, spin } = meta;
          const localT =
            clearT <= delay
              ? 0
              : Math.min(1, (clearT - delay) / shrinkSpan);
          // ease-in：前半稍留形，后半加速收完
          const ease = localT * localT;
          const shrink = Math.max(0.06, 1 - ease * 0.98);
          fill.scale.set(shrink, shrink, 1);
          // spin: +1 / -1，与行/列扫过方向一致
          fill.rotation.z = spin * ease * clearSpinMax;
        } else if (inPreclear) {
          // 将消预警：中心小幅旋转 + 轻微放大（仅填充）
          fill.rotation.z = wobble;
          fill.scale.set(1.01, 1.01, 1);
        }
      }
    }
  }

  /**
   * 棋盘投影：与实体块同样式、半透明，落在目标格上
   * @param {{ row: number, col: number, color?: number }[]} ghostCells
   * @param {boolean} ghostValid
   * @param {ReturnType<import('./layout.js').computeLayout>} layout
   */
  /** 底栏三等分命中区（与 hitTrayIndex 一致） */
  function addTrayZoneOverlays(layout) {
    const { frameW, frameH } = layout;
    const slots = layout.tray?.slots;
    if (!slots?.length) return;
    // 左 / 中 / 右 易区分
    const fills = [0x38bdf8, 0xfbbf24, 0xf472b6];
    const stroke = 0xffffff;
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const cx = slot.x + slot.w / 2;
      const cy = slot.y + slot.h / 2;
      const center = frameToThree(cx, cy, frameW, frameH);
      const z = 0.04;

      const fill = new THREE.Mesh(
        new THREE.PlaneGeometry(Math.max(1, slot.w - 2), Math.max(1, slot.h - 2)),
        new THREE.MeshBasicMaterial({
          color: fills[i % fills.length],
          transparent: true,
          opacity: 0.22,
          depthWrite: false,
        }),
      );
      fill.position.set(center.x, center.y, z);
      dynamicRoot.add(fill);
      dynamicMeshes.push(fill);

      // 细边框（略大于 fill）
      const border = new THREE.Mesh(
        new THREE.PlaneGeometry(Math.max(1, slot.w), Math.max(1, slot.h)),
        new THREE.MeshBasicMaterial({
          color: stroke,
          transparent: true,
          opacity: 0.35,
          depthWrite: false,
        }),
      );
      border.position.set(center.x, center.y, z - 0.001);
      dynamicRoot.add(border);
      dynamicMeshes.push(border);
    }
  }

  /**
   * 合法落点投影：与实体同色半透；将消时仅对「会参与消除」的投影格加旋转预警
   * @param {{ row: number, col: number, color?: number }[]} ghostCells
   * @param {ReturnType<import('./layout.js').computeLayout>} layout
   * @param {Set<string> | null} [clearKeys] 将满行/列格 key；null=不预警
   * @param {number} [nowMs]
   */
  function addBoardGhost(ghostCells, layout, clearKeys = null, nowMs = 0) {
    if (!ghostCells?.length) return;
    const { cell, cellFill, frameW, frameH, boardCellInset } = layout;
    const size = Math.max(2, cellFill ?? cell * (1 - 2 * (boardCellInset ?? 0.012)));
    const z = 0.12;
    const alpha = getTune().FEEL_GHOST_ALPHA ?? 0.15;
    const wobble = Math.sin(nowMs * 0.038) * 0.055;

    for (const gcell of ghostCells) {
      if (gcell.row < 0 || gcell.col < 0 || gcell.row >= GRID || gcell.col >= GRID) {
        continue;
      }
      const key = `${gcell.row},${gcell.col}`;
      const inClear = clearKeys?.has(key);
      const rect = layout.cellRect(gcell.col, gcell.row);
      const center = frameToThree(
        rect.x + rect.w / 2,
        rect.y + rect.h / 2,
        frameW,
        frameH,
      );
      // 投影统一本色半透，不改金/变色
      const col = gcell.color ?? 0x93c5fd;
      const ghost = createFilledCell(size, col, alpha, z);
      ghost.position.set(center.x, center.y, z);
      // 仅将消格：旋转 + 轻微放大
      if (inClear) {
        ghost.rotation.z = wobble;
        ghost.scale.set(1.01, 1.01, 1);
      }
      dynamicRoot.add(ghost);
      dynamicMeshes.push(ghost);
    }
  }

  /**
   * 摆放区阴影：一块 mesh、polyomino 整体轮廓（格间无缝合并，不是多格拼影）。
   */
  function addTrayPieceShadow(
    matrix,
    originFrameX,
    originFrameY,
    cellPitch,
    _cellInset,
    frameW,
    frameH,
  ) {
    const { rows, cols } = matrixSize(matrix);
    // 用满 pitch 铺格，邻格共边合并成连续面
    const pitch = cellPitch;
    const ox = cellPitch * 0.14;
    const oy = cellPitch * 0.18;
    const z = 0.04;

    const positions = [];
    const indices = [];
    let base = 0;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!matrix[r][c]) continue;
        // 格在 frame 坐标下的四角（左上为 origin，Y 向下）
        const x0 = originFrameX + c * pitch + ox;
        const x1 = x0 + pitch;
        const y0 = originFrameY + r * pitch + oy;
        const y1 = y0 + pitch;
        // 转 three，压成一个平面 mesh
        const tl = frameToThree(x0, y0, frameW, frameH);
        const tr = frameToThree(x1, y0, frameW, frameH);
        const br = frameToThree(x1, y1, frameW, frameH);
        const bl = frameToThree(x0, y1, frameW, frameH);
        positions.push(tl.x, tl.y, z, tr.x, tr.y, z, br.x, br.y, z, bl.x, bl.y, z);
        indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
        base += 4;
      }
    }

    if (positions.length === 0) return;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    const mat = new THREE.MeshBasicMaterial({
      color: 0x2a1a0c,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    dynamicRoot.add(mesh);
    dynamicMeshes.push(mesh);
  }

  function addPieceMeshes(
    matrix,
    colors,
    originFrameX,
    originFrameY,
    cellPitch,
    cellInset,
    frameW,
    frameH,
    scale = 1,
    opacity = 1,
    z = 0.05,
  ) {
    const { rows, cols } = matrixSize(matrix);
    // 与盘面 cellFill 同一公式：pitch * (1 - 2*inset)，落子/拖/ tray 样式一致
    const inset = Number.isFinite(cellInset) ? cellInset : 0.004;
    const fill = cellPitch * (1 - 2 * inset);
    const size = Math.max(2, fill * scale);
    const pieceW = cols * cellPitch;
    const pieceH = rows * cellPitch;
    const cx0 = originFrameX + pieceW / 2;
    const cy0 = originFrameY + pieceH / 2;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!matrix[r][c]) continue;
        const fx = originFrameX + c * cellPitch + cellPitch / 2;
        const fy = originFrameY + r * cellPitch + cellPitch / 2;
        const sfx = cx0 + (fx - cx0) * scale;
        const sfy = cy0 + (fy - cy0) * scale;
        const p = frameToThree(sfx, sfy, frameW, frameH);
        const color = Array.isArray(colors)
          ? colors[r]?.[c] || colors[0]?.[0] || 0x4a9eff
          : colors;
        // 与盘面落子同一 createFilledCell，仅 size 不同（tray 更小）
        const block = createFilledCell(size, color, opacity, z);
        block.position.set(p.x, p.y, z);
        dynamicRoot.add(block);
        dynamicMeshes.push(block);
      }
    }
  }

  /**
   * @param {object} state
   * @param {object} [state.clearFx]
   * @param {number} [state.nowMs]
   */
  function render(state) {
    clearList(dynamicMeshes, dynamicRoot);
    const { layout, cells, tray, drag, hover, clearFx = null, nowMs = performance.now() } =
      state;
    if (!layout || layout.cell < 2) return;

    const { cell, boardCellInset, frameW, frameH } = layout;
    const trayCell = layout.tray.cell;
    const trayInset = layout.tray.cellInset;

    let ghostCells = null;
    let ghostValid = false;
    let preclear = null;
    let willClear = false;

    if (hover && drag?.piece) {
      const { matrix, cellColors } = drag.piece;
      const { rows, cols } = matrixSize(matrix);
      ghostCells = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (matrix[r][c]) {
            ghostCells.push({
              row: hover.originRow + r,
              col: hover.originCol + c,
              color: cellColors?.[r]?.[c] ?? drag.piece.color,
            });
          }
        }
      }
      ghostValid = hover.valid;
      preclear = hover.valid ? hover.preclear : null;
      willClear = !!(preclear && preclear.count > 0);
    }

    const clearT01 =
      clearFx && clearFx.duration > 0
        ? Math.min(1, Math.max(0, (nowMs - clearFx.start) / clearFx.duration))
        : -1;

    // 仅 count>0 时传 preclear；paintBoard 只对「已落子且在将消行列」转预警
    paintBoard(
      cells,
      willClear ? preclear : null,
      nowMs,
      clearFx && clearT01 >= 0
        ? {
            cells: clearFx.cells,
            t01: clearT01,
            sweep: clearFx.sweep,
          }
        : null,
    );

    // 投影：统一本色；仅将消格加旋转
    if (drag?.piece && ghostValid && ghostCells?.length) {
      const clearKeys = willClear ? preclearKeySet(preclear) : null;
      addBoardGhost(ghostCells, layout, clearKeys, nowMs);
    }



    // 调试：底栏三等分点击区
    if (getTune().SHOW_TRAY_ZONES >= 0.5) {
      addTrayZoneOverlays(layout);
    }

    // tray 摆放区：先阴影再块（拖起中的槽不画，避免残影）
    const dragTrayIndex = drag?.trayIndex;
    for (let i = 0; i < tray.length; i++) {
      const piece = tray[i];
      if (!piece || i === dragTrayIndex) continue;
      const slot = layout.tray.slots[i];
      if (!slot) continue;
      const { rows, cols } = matrixSize(piece.matrix);
      const tw = cols * trayCell;
      const th = rows * trayCell;
      const ox = slot.cx - tw / 2;
      const oy = slot.cy - th / 2;
      addTrayPieceShadow(
        piece.matrix,
        ox,
        oy,
        trayCell,
        trayInset,
        frameW,
        frameH,
      );
      addPieceMeshes(
        piece.matrix,
        piece.cellColors || piece.color,
        ox,
        oy,
        trayCell,
        trayInset,
        frameW,
        frameH,
        1,
        1,
        0.08,
      );
    }

    // 拖起后用棋盘 pitch + 棋盘 inset（满格）
    if (drag?.piece) {
      addPieceMeshes(
        drag.piece.matrix,
        drag.piece.cellColors || drag.piece.color,
        drag.frameX,
        drag.frameY,
        cell,
        boardCellInset,
        frameW,
        frameH,
        drag.scale ?? 1,
        FEEL_DRAG_ALPHA,
        0.25,
      );
    }
  }

  function rebuild(layout) {
    rebuildStatic(layout);
  }

  function dispose() {
    clearList(dynamicMeshes, dynamicRoot);
    clearBoardFills();
    clearList(staticMeshes, staticRoot);
    boardCells.clear();
    scene.remove(root);
  }

  return { root, rebuild, render, dispose };
}
