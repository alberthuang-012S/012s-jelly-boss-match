import { describe, expect, it } from 'vitest';
import { loadProgress, loadSettings, saveSettings, saveStageClear, unlockAll, type StorageLike } from './progress';

class MemoryStorage implements StorageLike {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

class BrokenStorage implements StorageLike {
  getItem(): string | null { throw new Error('storage unavailable'); }
  setItem(): void { throw new Error('storage unavailable'); }
}

describe('local progress and settings', () => {
  it('unlocks the next stage when a stage is cleared', () => {
    const storage = new MemoryStorage();
    const data = saveStageClear(0, storage);
    expect(data.maxUnlockedIndex).toBe(1);
    expect(data.clearedIds).toContain('1-1');
  });

  it('keeps stage progress after a reload', () => {
    const storage = new MemoryStorage();
    saveStageClear(2, storage);
    expect(loadProgress(storage)).toEqual({ maxUnlockedIndex: 3, clearedIds: ['1-3'] });
  });

  it('persists sound and fast mode settings', () => {
    const storage = new MemoryStorage();
    saveSettings({ sound: true, fast: true }, storage);
    expect(loadSettings(storage)).toEqual({ sound: true, fast: true });
  });

  it('recovers safely from corrupt JSON or an unavailable storage provider', () => {
    const storage = new MemoryStorage();
    storage.values.set('jelly-boss-match.progress.v1', '{nope');
    storage.values.set('jelly-boss-match.settings.v1', 'null');
    expect(loadProgress(storage).maxUnlockedIndex).toBe(0);
    expect(loadSettings(storage)).toEqual({ sound: false, fast: false });
    expect(loadProgress(new BrokenStorage()).maxUnlockedIndex).toBe(0);
    saveSettings({ sound: true, fast: false }, new BrokenStorage());
    expect(unlockAll(new BrokenStorage()).maxUnlockedIndex).toBeGreaterThan(0);
  });

  it('clamps corrupt unlock indices and ignores unknown cleared stage IDs', () => {
    const storage = new MemoryStorage();
    storage.values.set('jelly-boss-match.progress.v1', JSON.stringify({ maxUnlockedIndex: 9999, clearedIds: ['1-1', 'unknown'] }));
    expect(loadProgress(storage)).toEqual({ maxUnlockedIndex: 7, clearedIds: ['1-1'] });
  });
});
