import { STAT_KEYS } from '../types';
import type { EnemyConfig, TurnStats } from '../types';

export function resolveDamage(stats: TurnStats, enemy: EnemyConfig): number {
  const resolved = STAT_KEYS.reduce((sum, stat) => sum + stats[stat] * (enemy.statMultipliers?.[stat] ?? 1), 0);
  return Math.round(resolved);
}
