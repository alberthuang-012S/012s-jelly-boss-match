import { CHARACTER_IDS, STAT_KEYS } from '../types';
import type { CharacterId, CharacterStats, Gain, StatKey, TurnStats } from '../types';
import { emptyTurnStats } from './statGenerator';

export function emptyCharacterStats(): CharacterStats {
  return Object.fromEntries(CHARACTER_IDS.map((id) => [id, emptyTurnStats()])) as CharacterStats;
}

export function addGains(target: Record<StatKey, number>, gains: readonly Gain[]): Record<StatKey, number> {
  const next = { ...target };
  for (const gain of gains) next[gain.stat] += gain.amount;
  return next;
}

export function aggregateCharacterStats(characters: CharacterStats): TurnStats {
  const totals = emptyTurnStats();
  for (const id of CHARACTER_IDS) for (const stat of STAT_KEYS) totals[stat] += characters[id][stat];
  return totals;
}

export function totalPower(stats: TurnStats): number {
  return STAT_KEYS.reduce((sum, stat) => sum + stats[stat], 0);
}

export function sumStats(destination: TurnStats, source: TurnStats): TurnStats {
  return Object.fromEntries(STAT_KEYS.map((key) => [key, destination[key] + source[key]])) as TurnStats;
}

export function addCharacterGains(characters: CharacterStats, id: CharacterId, gains: readonly Gain[]): CharacterStats {
  return { ...characters, [id]: addGains(characters[id], gains) };
}
