/**
 * 统一「单个有色格子」样式：盘面落子 / tray 摆放 / 拖拽 共用。
 * 圆角用自建 BufferGeometry（WebGPU 友好）；每 mesh clone，避免 dispose 共享缓冲。
 */
import * as THREE from 'three';

/** 圆角半径相对短边比例 */
export const CELL_CORNER_RATIO = 0.12;
/** 棋盘外框圆角半径 ≈ 该值 × cell */
export const BOARD_CORNER_CELLS = 0.32;

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
 * 取模板几何；mesh 使用时请 .clone()。
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
  // 每 mesh 独立 clone，rebuild dispose 不会毁掉缓存 / 其他 mesh
  const geo = getRoundedRectGeometry(w, h, cornerRatio).clone();
  geo.userData.sharedTemplate = false;
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({
      color: col,
      transparent: op < 0.999,
      opacity: op,
      depthWrite: op >= 0.999,
      side: THREE.DoubleSide,
    }),
  );
  mesh.position.z = zz;
  return mesh;
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
  return g;
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

export { shade };
