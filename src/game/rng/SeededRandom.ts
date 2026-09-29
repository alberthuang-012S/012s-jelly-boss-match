import type { RandomSource } from './RandomSource';
import { randomInt } from './RandomSource';

/** Small deterministic Mulberry32 stream. Animation speed never touches this state. */
export class SeededRandom implements RandomSource {
  private state: number;

  constructor(seed: number | string) {
    const parsed = typeof seed === 'number' ? seed : Number.parseInt(seed.replace(/^0x/i, ''), 16);
    this.state = (Number.isFinite(parsed) ? parsed : 1) >>> 0;
  }

  next(): number {
    let t = this.state += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(minInclusive: number, maxInclusive: number): number { return randomInt(this, minInclusive, maxInclusive); }
  getSeedState(): number { return this.state >>> 0; }
}
