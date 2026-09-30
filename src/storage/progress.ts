import { STAGES } from '../game/content/stages';

export type ProgressData = { maxUnlockedIndex: number; clearedIds: string[] };
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const KEY = 'jelly-boss-match.progress.v1';
export const DEFAULT_PROGRESS: ProgressData = { maxUnlockedIndex: 0, clearedIds: [] };

function browserStorage(explicit?: StorageLike): StorageLike | undefined {
  if (explicit) return explicit;
  try { return globalThis.localStorage; } catch { return undefined; }
}

export function loadProgress(storage?: StorageLike): ProgressData {
  try {
    const raw = browserStorage(storage)?.getItem(KEY);
    if (!raw) return { ...DEFAULT_PROGRESS, clearedIds: [] };
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object') return { ...DEFAULT_PROGRESS, clearedIds: [] };
    const candidate = data as Partial<ProgressData>;
    const clearedIds = Array.isArray(candidate.clearedIds)
      ? candidate.clearedIds.filter((id): id is string => typeof id === 'string' && STAGES.some((stage) => stage.id === id))
      : [];
    const clearUnlock = Math.min(STAGES.length - 1, Math.max(0, clearedIds.reduce((max, id) => Math.max(max, STAGES.findIndex((stage) => stage.id === id) + 1), 0)));
    const storedIndex = Number.isInteger(candidate.maxUnlockedIndex) ? candidate.maxUnlockedIndex! : 0;
    const maxUnlockedIndex = Math.min(STAGES.length - 1, Math.max(clearUnlock, 0, storedIndex));
    return { maxUnlockedIndex, clearedIds: [...new Set(clearedIds)] };
  } catch {
    return { ...DEFAULT_PROGRESS, clearedIds: [] };
  }
}

export function saveStageClear(stageIndex: number, storage?: StorageLike): ProgressData {
  const target = browserStorage(storage);
  const current = loadProgress(target);
  const index = Math.max(0, Math.min(STAGES.length - 1, stageIndex));
  const stage = STAGES[index];
  const next: ProgressData = {
    maxUnlockedIndex: Math.min(STAGES.length - 1, Math.max(current.maxUnlockedIndex, index + 1)),
    clearedIds: stage && !current.clearedIds.includes(stage.id) ? [...current.clearedIds, stage.id] : current.clearedIds,
  };
  try { target?.setItem(KEY, JSON.stringify(next)); } catch { /* local progress remains available for this session */ }
  return next;
}

export function unlockAll(storage?: StorageLike): ProgressData {
  const next = { maxUnlockedIndex: STAGES.length - 1, clearedIds: [...STAGES.map((stage) => stage.id)] };
  try { browserStorage(storage)?.setItem(KEY, JSON.stringify(next)); } catch { /* safe fallback */ }
  return next;
}

const SETTINGS_KEY = 'jelly-boss-match.settings.v1';
export type GameSettings = { sound: boolean; fast: boolean };
export const DEFAULT_SETTINGS: GameSettings = { sound: false, fast: false };

export function loadSettings(storage?: StorageLike): GameSettings {
  try {
    const raw = browserStorage(storage)?.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_SETTINGS };
    const data = parsed as Partial<GameSettings>;
    return { sound: typeof data.sound === 'boolean' ? data.sound : false, fast: typeof data.fast === 'boolean' ? data.fast : false };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: GameSettings, storage?: StorageLike): void {
  try { browserStorage(storage)?.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* settings remain in memory */ }
}

const TEAM_NAME_KEY = 'jelly-boss-match.team-name.v1';
export const DEFAULT_TEAM_NAME = '水母小隊';

export function loadTeamName(storage?: StorageLike): string {
  try { return browserStorage(storage)?.getItem(TEAM_NAME_KEY)?.trim().slice(0, 12) || DEFAULT_TEAM_NAME; }
  catch { return DEFAULT_TEAM_NAME; }
}

export function saveTeamName(name: string, storage?: StorageLike): string {
  const next = name.trim().slice(0, 12) || DEFAULT_TEAM_NAME;
  try { browserStorage(storage)?.setItem(TEAM_NAME_KEY, next); } catch { /* name remains in memory */ }
  return next;
}
