/**
 * 统一「单个有色格子」样式：盘面落子 / tray 摆放 / 拖拽 共用。
 * 圆角几何全局缓存共享；filled cell 用对象池，避免每帧 new/dispose。
 */
import * as THREE from 'three';

/** 空格/方块圆角半径相对短边比例 */
export const CELL_CORNER_RATIO = 0.12;
/**
 * @deprecated 棋盘外框圆角已与 CELL_CORNER_RATIO 联动（view 内平行外扩）
 */
export const BOARD_CORNER_CELLS = 0.12;

function shade(hex, f) {
  const r = Math.min(255, Math.max(0, Math.round(((hex >> 16) & 255) * f)));
  const g = Math.min(255, Math.max(0, Math.round(((hex >> 8) & 255) * f)));
  const b = Math.min(255, Math.max(0, Math.round((hex & 255) * f)));
  return (r << 16) | (g << 8) | b;
}

/**
 * 圆角矩形 BufferGeometry（中心原点，XY 平面）
 * @param {number} w
 * @param {number} h
 * @param {number} radius
 * @param {number} [segPerCorner]
 */
function buildRoundedRectGeometry(w, h, radius, segPerCorner = 5) {
  const hw = w / 2;
  const hh = h / 2;
  const r = Math.max(0.01, Math.min(radius, hw, hh));
  const positions = [];
  const uvs = [];
  const indices = [];

  // 中心点 + 轮廓
  positions.push(0, 0, 0);
  uvs.push(0.5, 0.5);

  const push = (x, y) => {
    positions.push(x, y, 0);
    uvs.push(x / w + 0.5, y / h + 0.5);
  };

  // 从左下角起顺时针绕一圈（含四角圆弧）
  const corners = [
    { cx: hw - r, cy: -hh + r, a0: -Math.PI / 2, a1: 0 }, // bottom-right
    { cx: hw - r, cy: hh - r, a0: 0, a1: Math.PI / 2 }, // top-right
    { cx: -hw + r, cy: hh - r, a0: Math.PI / 2, a1: Math.PI }, // top-left
    { cx: -hw + r, cy: -hh + r, a0: Math.PI, a1: (3 * Math.PI) / 2 }, // bottom-left
  ];

  // 底边左段起点
  push(-hw + r, -hh);

  for (const c of corners) {
    for (let i = 0; i <= segPerCorner; i++) {
      const t = i / segPerCorner;
      const a = c.a0 + (c.a1 - c.a0) * t;
      push(c.cx + Math.cos(a) * r, c.cy + Math.sin(a) * r);
    }
  }

  const n = positions.length / 3 - 1; // rim verts (exclude center)
  for (let i = 1; i <= n; i++) {
    const next = i === n ? 1 : i + 1;
    indices.push(0, i, next);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.userData.sharedTemplate = true;
  return geo;
}

/** @type {Map<string, THREE.BufferGeometry>} */
const geoCache = new Map();

/**
 * 取共享模板几何（勿 dispose；多 mesh 共用同一 BufferGeometry）。
 * @param {number} w
 * @param {number} h
 * @param {number} [cornerRatio]
 */
export function getRoundedRectGeometry(w, h, cornerRatio = CELL_CORNER_RATIO) {
  const ww = Math.max(0.5, w);
  const hh = Math.max(0.5, h);
  const r = Math.min(ww, hh) * cornerRatio;
  const key = `${ww.toFixed(2)}_${hh.toFixed(2)}_${r.toFixed(3)}`;
  let geo = geoCache.get(key);
  if (!geo) {
    geo = buildRoundedRectGeometry(ww, hh, r);
    geoCache.set(key, geo);
  }
  return geo;
}

function mkRoundedPlane(w, h, col, op, zz, cornerRatio = CELL_CORNER_RATIO) {
  // 共享几何；仅材质 per-mesh（颜色/透明度独立）
  const geo = getRoundedRectGeometry(w, h, cornerRatio);
  const isTrans = op < 0.999;
  const mat = new THREE.MeshBasicMaterial({
    color: col,
    transparent: isTrans,
    opacity: op,
    depthWrite: !isTrans,
    side: THREE.DoubleSide,
  });
  if ('forceSinglePass' in mat) mat.forceSinglePass = isTrans;
  // 供 view 动画恢复 opacity，禁止整块 setHex 抹平分层色
  mat.userData.baseOpacity = op;
  mat.userData.baseColor = col;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.z = zz;
  return mesh;
}

/** @type {THREE.Group[]} */
const filledPool = [];
const FILLED_POOL_MAX = 256;

/**
 * 按分层结构给已有 filled cell 上色（保留 bevel/高光比例）。
 * @param {THREE.Group} g
 * @param {number} color
 * @param {number} [opacity]
 */
export function recolorFilledCell(g, color, opacity = 1) {
  const children = g.children;
  // 0 rim, 1 main, 2 top, 3 bot, 4 glint
  const specs = [
    { f: 0.5, opMul: 1 },
    { f: 1, opMul: 1 },
    { f: 1.28, opMul: 0.55 },
    { f: 0.65, opMul: 0.5 },
    { f: null, opMul: 0.28, white: true },
  ];
  const wantTransparent = opacity < 0.999;
  for (let i = 0; i < children.length && i < specs.length; i++) {
    const mesh = children[i];
    if (!mesh?.isMesh || !mesh.material) continue;
    const mat = mesh.material;
    const sp = specs[i];
    const col = sp.white ? 0xffffff : shade(color, sp.f);
    // 半透明用途（ghost）：分层也保持整体可透，避免叠成实心
    const op = wantTransparent
      ? opacity * (i === 1 ? 1 : sp.opMul * 0.85)
      : opacity * sp.opMul;
    const prevT = mat.transparent;
    mat.color.setHex(col);
    mat.opacity = Math.min(1, Math.max(0, op));
    mat.transparent = wantTransparent || op < 0.999;
    mat.depthWrite = !mat.transparent;
    mat.userData.baseOpacity = mat.opacity;
    mat.userData.baseColor = col;
    if ('forceSinglePass' in mat) mat.forceSinglePass = mat.transparent;
    // transparent 开关变化时必须 needsUpdate，否则 WebGPU 仍走不透明通道
    if (prevT !== mat.transparent) mat.needsUpdate = true;
  }
  g.userData.color = color;
  if (g.userData.mainMat && children[1]?.material) {
    g.userData.mainMat = children[1].material;
  }
}

/**
 * 内容尺寸缩放（与消行动画 scale 相乘，勿直接 overwrite group.scale）。
 * @param {THREE.Group} g
 * @param {number} size 目标边长
 */
export function setFilledCellSize(g, size) {
  const base = g.userData.baseSize || size;
  const s = Math.max(2, size) / Math.max(2, base);
  g.userData.sizeScale = s;
  applyFilledCellScale(g, 1);
}

/**
 * 应用动画缩放：最终 scale = sizeScale * animScale
 * @param {THREE.Object3D} g
 * @param {number} [animScale]
 */
export function applyFilledCellScale(g, animScale = 1) {
  const sizeS = g.userData.sizeScale ?? 1;
  const a = animScale;
  g.scale.set(sizeS * a, sizeS * a, 1);
}

/**
 * @param {number} size
 * @param {number} color
 * @param {number} [opacity]
 * @param {number} [z]
 */
export function createBevelBlock(size, color, opacity = 1, z = 0) {
  return createFilledCell(size, color, opacity, z);
}

/**
 * @param {number} size
 * @param {number} color
 * @param {number} [opacity]
 * @param {number} [z]
 * @returns {THREE.Group}
 */
export function createFilledCell(size, color, opacity = 1, z = 0) {
  const g = new THREE.Group();
  const s = Math.max(2, size);
  const rim = s;
  const body = s * 0.98;
  const topBandH = body * 0.26;
  const botBandH = body * 0.18;
  const cr = CELL_CORNER_RATIO;

  g.add(mkRoundedPlane(rim, rim, shade(color, 0.5), opacity, z, cr));

  const main = mkRoundedPlane(body, body, color, opacity, z + 0.001, cr * 0.95);
  g.add(main);

  const top = mkRoundedPlane(
    body * 0.9,
    topBandH,
    shade(color, 1.28),
    opacity * 0.55,
    z + 0.002,
    0.4,
  );
  top.position.y = body * 0.5 - topBandH * 0.55;
  g.add(top);

  const bot = mkRoundedPlane(
    body * 0.9,
    botBandH,
    shade(color, 0.65),
    opacity * 0.5,
    z + 0.002,
    0.4,
  );
  bot.position.y = -(body * 0.5 - botBandH * 0.55);
  g.add(bot);

  const glintS = Math.max(1, body * 0.14);
  const glint = mkRoundedPlane(glintS, glintS, 0xffffff, opacity * 0.28, z + 0.003, 0.5);
  glint.position.set(-body * 0.28, body * 0.28, 0);
  g.add(glint);

  g.userData.mainMat = main.material;
  g.userData.color = color;
  g.userData.isEmpty = false;
  g.userData.kind = 'filledCell';
  g.userData.baseSize = s;
  g.userData.sizeScale = 1;
  g.userData.poolKind = 'filled';
  return g;
}

/**
 * 从池取 filled cell；不足则新建。
 * @param {number} size
 * @param {number} color
 * @param {number} [opacity]
 * @param {number} [z]
 */
export function acquireFilledCell(size, color, opacity = 1, z = 0) {
  let g = filledPool.pop();
  if (!g) {
    g = createFilledCell(size, color, opacity, z);
  } else {
    recolorFilledCell(g, color, opacity);
    setFilledCellSize(g, size);
    // 子 mesh z 偏移随 z 基准
    const children = g.children;
    if (children[0]) children[0].position.z = z;
    if (children[1]) children[1].position.z = z + 0.001;
    if (children[2]) children[2].position.z = z + 0.002;
    if (children[3]) children[3].position.z = z + 0.002;
    if (children[4]) children[4].position.z = z + 0.003;
    g.rotation.set(0, 0, 0);
    g.position.set(0, 0, 0);
    g.visible = true;
  }
  g.userData.isEmpty = false;
  g.userData.kind = 'filledCell';
  g.userData.poolKind = 'filled';
  return g;
}

/**
 * 回收 filled cell（不 dispose 材质/几何，供下帧复用）。
 * @param {THREE.Object3D | null | undefined} g
 */
export function releaseFilledCell(g) {
  if (!g) return;
  if (g.parent) g.parent.remove(g);
  g.visible = false;
  g.rotation.set(0, 0, 0);
  g.position.set(0, 0, 0);
  // 动画/消行 scale 归位，避免脏 sizeScale 残留
  g.userData.sizeScale = g.userData.sizeScale ?? 1;
  applyFilledCellScale(g, 1);
  // 清业务标记，避免脏状态
  if (g.userData) {
    g.userData.fillColor = undefined;
    g.userData.kind = 'filledCell';
    g.userData.poolKind = 'filled';
  }
  if (filledPool.length < FILLED_POOL_MAX) {
    filledPool.push(/** @type {THREE.Group} */ (g));
  } else {
    // 池满：仅 dispose 材质，几何为共享模板
    g.traverse?.((o) => {
      if (o.isMesh) {
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose?.());
        else o.material?.dispose?.();
      }
    });
  }
}

export function createEmptyCell(size, colors, opacity = 1) {
  const g = new THREE.Group();
  const s = Math.max(2, size);
  const cr = CELL_CORNER_RATIO;

  // 层差收紧，盘面格缝与 tray 同级（靠 BOARD_CELL_INSET）
  g.add(mkRoundedPlane(s, s, colors.stroke, opacity, 0, cr));
  g.add(mkRoundedPlane(s * 0.97, s * 0.97, colors.fill, opacity, 0.001, cr * 0.95));
  const inner = mkRoundedPlane(
    s * 0.93,
    s * 0.93,
    colors.inner,
    opacity,
    0.002,
    cr * 0.9,
  );
  g.add(inner);

  g.userData.mainMat = inner.material;
  g.userData.isEmpty = true;
  g.userData.kind = 'emptyCell';
  return g;
}

export function setGroupColor(group, hex, opacity = 1) {
  const main = group.userData.mainMat;
  if (main) {
    main.color.setHex(hex);
    main.opacity = opacity;
    main.transparent = opacity < 0.999;
  }
}

/** 调试/测试用：当前池大小 */
export function filledPoolSize() {
  return filledPool.length;
}

export { shade };
