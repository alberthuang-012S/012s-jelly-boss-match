import type { RandomSource } from './RandomSource';
import { randomInt } from './RandomSource';

export class DefaultRandom implements RandomSource {
  next(): number { return Math.random(); }
  int(minInclusive: number, maxInclusive: number): number { return randomInt(this, minInclusive, maxInclusive); }
}
