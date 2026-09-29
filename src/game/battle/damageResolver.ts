import { STAT_KEYS } from '../types';
import type { EnemyConfig, TurnStats } from '../types';
import { GAME_CONFIG } from '../config/gameConfig';

export function chainMultiplierForWaves(waves: number): number {
  if (waves <= 1) return GAME_CONFIG.chainMultipliers[0];
  return GAME_CONFIG.chainMultipliers[Math.min(waves, GAME_CONFIG.chainMultipliers.length) - 1]!;
}

export function resolveDamage(stats: TurnStats, enemy: EnemyConfig, chainMultiplier = 1, skillMultiplier = 1): number {
  const resolved = STAT_KEYS.reduce((sum, stat) => sum + stats[stat] * (enemy.statMultipliers?.[stat] ?? 1), 0);
  return Math.floor(resolved * chainMultiplier * skillMultiplier);
}
