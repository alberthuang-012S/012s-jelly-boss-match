export const GAME_CONFIG = {
  columns: 6,
  rows: 6,
  playerMaxHp: 100,
  extraStatCountMin: 0,
  extraStatCountMax: 2,
  minStatGain: 1,
  maxStatGain: 3,
  maxCascades: 20,
  maxFloatingGroups: 3,
  initialBoardAttempts: 40,
  chainMultipliers: [1, 1.15, 1.3, 1.5] as const,
} as const;
