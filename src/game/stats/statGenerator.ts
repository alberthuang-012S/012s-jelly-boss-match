import { GAME_CONFIG } from '../config/gameConfig';
import { CHARACTERS } from '../content/characters';
import { STAT_KEYS, type CharacterId, type Gain, type StatKey } from '../types';
import type { RandomSource } from '../rng/RandomSource';
import { randomInt, sampleWithoutReplacement } from '../rng/RandomSource';

export function generateTileStats(characterId: CharacterId, random: RandomSource): Gain[] {
  const mains = CHARACTERS[characterId].mainStats;
  const gains: Gain[] = mains.map((stat) => ({
    stat,
    amount: randomInt(random, GAME_CONFIG.minStatGain, GAME_CONFIG.maxStatGain),
  }));
  const extras = STAT_KEYS.filter((stat) => !mains.includes(stat));
  const count = randomInt(random, GAME_CONFIG.extraStatCountMin, GAME_CONFIG.extraStatCountMax);
  for (const stat of sampleWithoutReplacement(random, extras, count)) {
    gains.push({ stat, amount: randomInt(random, GAME_CONFIG.minStatGain, GAME_CONFIG.maxStatGain) });
  }
  return gains;
}

export function emptyTurnStats(): Record<StatKey, number> {
  return Object.fromEntries(STAT_KEYS.map((stat) => [stat, 0])) as Record<StatKey, number>;
}
