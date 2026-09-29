export interface RandomSource {
  next(): number;
  int(minInclusive: number, maxInclusive: number): number;
}

export function randomInt(random: RandomSource, minInclusive: number, maxInclusive: number): number {
  if (maxInclusive < minInclusive) throw new RangeError('maxInclusive must be >= minInclusive');
  return minInclusive + Math.floor(random.next() * (maxInclusive - minInclusive + 1));
}

export function pick<T>(random: RandomSource, values: readonly T[]): T {
  if (values.length === 0) throw new RangeError('Cannot pick from an empty collection');
  return values[randomInt(random, 0, values.length - 1)];
}

export function sampleWithoutReplacement<T>(random: RandomSource, values: readonly T[], count: number): T[] {
  const copy = [...values];
  const wanted = Math.max(0, Math.min(count, copy.length));
  for (let i = 0; i < wanted; i += 1) {
    const j = randomInt(random, i, copy.length - 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, wanted);
}
