/**
 * 计分 + combo（M1 可用；对齐 DEFAULTS / scoring-default）。
 */
import {
  COMBO_INCREMENT,
  COMBO_MODE,
  MAX_WITHOUT_CLEAR,
  SCORE_ALL_CLEAR,
  SCORE_LINE_BASE,
  SCORE_PER_CELL,
} from './defaults.js';

export function createScoreState() {
  let score = 0;
  let combo = 0;
  let placementsWithoutClear = 0;
  let trayHadClear = false; // tray mode

  function reset() {
    score = 0;
    combo = 0;
    placementsWithoutClear = 0;
    trayHadClear = false;
  }

  /**
   * @param {{ cellsPlaced: number, linesCleared: number, boardEmpty: boolean }} e
   */
  function onPlace(e) {
    const { cellsPlaced, linesCleared, boardEmpty } = e;
    score += cellsPlaced * SCORE_PER_CELL;

    if (linesCleared > 0) {
      const mult = combo + 1;
      let bonus = linesCleared * SCORE_LINE_BASE * mult;
      if (linesCleared > 2) bonus *= linesCleared - 1;
      score += bonus;
      if (boardEmpty) score += SCORE_ALL_CLEAR;

      combo += COMBO_INCREMENT === 'lines' ? linesCleared : 1;
      placementsWithoutClear = 0;
      trayHadClear = true;
    } else if (COMBO_MODE === 'slide3') {
      placementsWithoutClear += 1;
      if (placementsWithoutClear >= MAX_WITHOUT_CLEAR) {
        combo = 0;
        placementsWithoutClear = 0;
      }
    }
  }

  /** tray 用尽刷新时调用（tray 模式） */
  function onTrayRefill() {
    if (COMBO_MODE === 'tray') {
      if (!trayHadClear) combo = 0;
      trayHadClear = false;
    }
  }

  return {
    reset,
    onPlace,
    onTrayRefill,
    get score() {
      return score;
    },
    get combo() {
      return combo;
    },
  };
}
