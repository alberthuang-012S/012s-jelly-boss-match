import { GAME_CONFIG } from '../config/gameConfig';
import { ENEMIES } from '../content/enemies';
import { createBoard } from '../board/createBoard';
import { emptyTurnStats } from '../stats/statGenerator';
import { emptyCharacterStats } from '../stats/statAggregator';
import { emptyCharacterCharges } from '../skills/characterSkills';
import type { BattleState, StageConfig } from '../types';
import type { RandomSource } from '../rng/RandomSource';

export function createBattle(stage: StageConfig, random: RandomSource): BattleState {
  const enemy = ENEMIES[stage.enemyId];
  if (!enemy) throw new Error(`Unknown enemy: ${stage.enemyId}`);
  const { board, nextTileId } = createBoard(random);
  return {
    stage,
    enemy,
    board,
    nextTileId,
    turns: 0,
    playerHp: GAME_CONFIG.playerMaxHp,
    enemyHp: enemy.maxHp,
    enemyShield: 0,
    characterTurnStats: emptyCharacterStats(),
    turnStats: emptyTurnStats(),
    stageStats: emptyTurnStats(),
    totalPower: 0,
    chainWaves: 0,
    chainMultiplier: 1,
    reeBoostPending: false,
    characterCharges: emptyCharacterCharges(),
    skillUsedSinceSwap: false,
    bossCharge: null,
    bossSpecialCooldown: enemy.bossSpecial?.initialDelay ?? 0,
    totalDamage: 0,
    highestTurnDamage: 0,
    highestCascade: 0,
    status: 'playing',
  };
}
