/**
 * 拖拽会话（P7/P15）：槽位固定拿起 + 指速积分增益 + 短视觉平滑。
 * 不处理 grid / sticky / 震动。
 */
import { FEEL_DRAG_OFFSET_X } from '../defaults.js';
import { matrixSize } from '../forms.js';

/**
 * @param {object} opts
 * @param {ReturnType<import('../layout.js').computeLayout>} opts.layout
 * @param {import('../forms.js').PieceDef} opts.piece
 * @param {number} opts.trayIndex
 * @param {number} opts.pointerId
 * @param {number} opts.fx
 * @param {number} opts.fy
 * @param {() => import('../tune.js').TuneState} opts.getTune
 */
export function createDragSession(opts) {
  const { layout, piece, trayIndex, pointerId, fx, fy, getTune } = opts;
  const cell = layout.cell;
  const slot = layout.tray.slots[trayIndex];
  const { rows, cols } = matrixSize(piece.matrix);
  const tune = getTune();
  const centerX = slot.cx + FEEL_DRAG_OFFSET_X * cell;
  const centerY = slot.cy + tune.FEEL_DRAG_OFFSET_Y_MIN * cell;
  const originX = centerX - (cols * cell) / 2;
  const originY = centerY - (rows * cell) / 2;
  const now = performance.now();

  return {
    trayIndex,
    piece,
    pointerId,
    frameX: originX,
    frameY: originY,
    targetOriginX: originX,
    targetOriginY: originY,
    scale: 1,
    sticky: null,
    axisLock: null,
    startFx: fx,
    startFy: fy,
    baseCenterX: centerX,
    baseCenterY: centerY,
    accX: 0,
    accY: 0,
    lastFx: fx,
    lastFy: fy,
    lastT: now,
    smoothLastT: now,
    smoothGain: 1,
    lastPointerSpeed: 0,
    ghostFastMode: false,
    snapVisualOnce: true,
    extraLiftCells: 0,
    fingerFx: fx,
    fingerFy: fy,
    hapticKey: null,
    lastHapticAt: null,
  };
}

/**
 * @param {number} speedCellsPerSec
 * @param {() => import('../tune.js').TuneState} getTune
 */
export function pointerGainFromSpeed(speedCellsPerSec, getTune) {
  const tune = getTune();
  const gmin = tune.FEEL_POINTER_GAIN_MIN ?? 0.92;
  const gmax = tune.FEEL_POINTER_GAIN_MAX ?? 1.38;
  const vref = Math.max(0.5, tune.FEEL_POINTER_SPEED_REF ?? 9);
  const t = Math.min(1, Math.max(0, speedCellsPerSec / vref));
  const eased = t * t * (3 - 2 * t);
  return gmin + (gmax - gmin) * eased;
}

/**
 * 指针采样 → 更新积分目标（不碰 visual frame，由 tickSmooth 追）
 * @param {ReturnType<typeof createDragSession>} session
 * @param {number} fx
 * @param {number} fy
 * @param {ReturnType<import('../layout.js').computeLayout>} layout
 * @param {() => import('../tune.js').TuneState} getTune
 */
export function samplePointer(session, fx, fy, layout, getTune) {
  const cell = layout.cell;
  const tune = getTune();
  const now = performance.now();

  const dx = fx - session.lastFx;
  const dy = fy - session.lastFy;
  const dtSec = Math.max(0.001, (now - session.lastT) / 1000);
  const speedCells = Math.hypot(dx, dy) / cell / dtSec;
  const gainTarget = pointerGainFromSpeed(speedCells, getTune);

  const gTau = Math.max(0, tune.FEEL_GAIN_SMOOTH_TIME ?? 0);
  if (gTau <= 0 || session.smoothGain == null) {
    session.smoothGain = gainTarget;
  } else {
    const gk = 1 - Math.exp(-dtSec / gTau);
    session.smoothGain += (gainTarget - session.smoothGain) * gk;
  }
  const gain = session.smoothGain;

  session.accX += dx * gain;
  session.accY += dy * gain;
  session.lastFx = fx;
  session.lastFy = fy;
  session.lastT = now;
  session.lastPointerSpeed = speedCells;
  session.fingerFx = fx;
  session.fingerFy = fy;

  const upCells = Math.max(0, (session.startFy - fy) / cell);
  const horizCells = Math.abs((fx - session.startFx) / cell);
  const travel = upCells + horizCells * 0.25;
  const range = tune.FEEL_DRAG_LIFT_TRAVEL_CELLS;
  const tRaw = range > 0 ? travel / range : 1;
  const t = Math.min(1, Math.max(0, tRaw));
  const power = tune.FEEL_DRAG_LIFT_POWER;
  const eased = t === 0 ? 0 : t === 1 ? 1 : t ** power;
  session.extraLiftCells =
    (tune.FEEL_DRAG_OFFSET_Y_MAX - tune.FEEL_DRAG_OFFSET_Y_MIN) * eased;

  const { rows, cols } = matrixSize(session.piece.matrix);
  const centerX = session.baseCenterX + session.accX;
  const centerY =
    session.baseCenterY + session.accY + session.extraLiftCells * cell;
  session.targetOriginX = centerX - (cols * cell) / 2;
  session.targetOriginY = centerY - (rows * cell) / 2;
}

/**
 * 视觉趋近目标
 * @param {ReturnType<typeof createDragSession>} session
 * @param {() => import('../tune.js').TuneState} getTune
 */
export function tickSmooth(session, getTune) {
  const now = performance.now();
  const dt = Math.min(
    0.05,
    Math.max(0.001, (now - (session.smoothLastT || now)) / 1000),
  );
  session.smoothLastT = now;

  const tau = Math.max(0, getTune().FEEL_SMOOTH_TIME ?? 0);
  const tx = session.targetOriginX ?? session.frameX;
  const ty = session.targetOriginY ?? session.frameY;

  if (tau <= 0.0005) {
    session.frameX = tx;
    session.frameY = ty;
  } else {
    const k = 1 - Math.exp(-dt / tau);
    session.frameX += (tx - session.frameX) * k;
    session.frameY += (ty - session.frameY) * k;
    if (Math.hypot(tx - session.frameX, ty - session.frameY) < 0.35) {
      session.frameX = tx;
      session.frameY = ty;
    }
  }
  session.scale = 1;
}

/**
 * 指针事件帧：快追目标
 * @param {ReturnType<typeof createDragSession>} session
 * @param {() => import('../tune.js').TuneState} getTune
 */
export function chaseTargetOnPointer(session, getTune) {
  const tau = Math.max(0, getTune().FEEL_SMOOTH_TIME ?? 0);
  if (tau <= 0.0005 || session.snapVisualOnce) {
    session.frameX = session.targetOriginX;
    session.frameY = session.targetOriginY;
    session.snapVisualOnce = false;
  } else {
    const k = Math.min(
      1,
      1 - Math.exp(-0.016 / Math.max(0.004, tau * 0.45)),
    );
    session.frameX += (session.targetOriginX - session.frameX) * k;
    session.frameY += (session.targetOriginY - session.frameY) * k;
  }
  session.scale = 1;
}
