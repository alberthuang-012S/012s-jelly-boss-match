export const STAT_KEYS = ['Bra', 'Sch', 'Neu', 'Pai', 'Tum', 'Vir', 'Bac', 'Eye', 'Pre'] as const;
export type StatKey = (typeof STAT_KEYS)[number];

export const CHARACTER_IDS = ['PNN', 'QCC', 'REE', 'KTT', 'AII'] as const;
export type CharacterId = (typeof CHARACTER_IDS)[number];
export const JELLY_COLORS = ['green', 'purple', 'red', 'orange', 'white'] as const;
export type JellyColor = (typeof JELLY_COLORS)[number];

export type CharacterConfig = {
  id: CharacterId;
  displayName: string;
  color: JellyColor;
  accent: string;
  mainStats: readonly [StatKey, StatKey, StatKey];
  portrait: string;
  title: string;
  symbol: string;
};

export type EnemyAction =
  | { type: 'attack'; amount: number }
  | { type: 'blocker'; amount: number }
  | { type: 'fog'; amount: number }
  | { type: 'shield'; amount: number }
  | { type: 'darken'; turns: number }
  | { type: 'confuse'; amount: number }
  | { type: 'slime'; amount: number }
  | { type: 'stone'; amount: number };

export type EnemyConfig = {
  id: string;
  name: string;
  type: 'normal' | 'boss';
  kind: 'bacteria' | 'cold' | 'sleepy' | 'forgetful' | 'blur' | 'three-high' | 'slime' | 'joint';
  maxHp: number;
  attackPattern: readonly EnemyAction[];
  statMultipliers?: Partial<Record<StatKey, number>>;
  asset: string;
  tagline: string;
};

export type StageConfig = {
  id: string;
  chapter: number;
  number: number;
  title: string;
  enemyId: string;
  difficulty: number;
};

export type Cell = { row: number; col: number };
export type Tile = {
  id: string;
  color: JellyColor;
  /** Fog makes a tile hazy without changing its actual color or symbol. */
  fog?: number;
  /** Locked tiles cannot move. An adjacent match chips the lock away. */
  lockHits?: number;
  /** Decorative hint only; the jelly symbol remains fully visible. */
  confused?: number;
};
export type Board = (Tile | null)[][];
export type CharacterStats = Record<CharacterId, Record<StatKey, number>>;
export type TurnStats = Record<StatKey, number>;

export type GameStatus = 'playing' | 'victory' | 'defeat';
export type BattleState = {
  stage: StageConfig;
  enemy: EnemyConfig;
  board: Board;
  nextTileId: number;
  turns: number;
  playerHp: number;
  enemyHp: number;
  enemyShield: number;
  characterTurnStats: CharacterStats;
  turnStats: TurnStats;
  stageStats: TurnStats;
  totalPower: number;
  totalDamage: number;
  highestTurnDamage: number;
  highestCascade: number;
  status: GameStatus;
  darkTurns: number;
};

export type Gain = { stat: StatKey; amount: number };
export type BattleEvent =
  | { type: 'SWAP'; board: Board; a: Cell; b: Cell }
  | { type: 'INVALID_SWAP'; board: Board; a: Cell; b: Cell }
  | { type: 'MATCH_FOUND'; board: Board; cells: Cell[]; cascade: number }
  | { type: 'JELLY_POP'; board: Board; cells: Cell[]; cascade: number }
  | { type: 'STAT_GAIN'; characterId: CharacterId; tileId: string; gains: Gain[]; cascade: number }
  | { type: 'GRAVITY'; board: Board; cascade: number }
  | { type: 'REFILL'; board: Board; cascade: number }
  | { type: 'CASCADE_START'; cascade: number }
  | { type: 'TURN_TOTAL'; stats: TurnStats; totalPower: number; damage: number }
  | { type: 'FINAL_ATTACK'; totalPower: number }
  | { type: 'ENEMY_DAMAGE'; damage: number; hpDamage: number; shieldDamage: number; enemyHp: number; enemyShield: number }
  | { type: 'ENEMY_ACTION'; action: EnemyAction; message: string }
  | { type: 'PLAYER_DAMAGE'; amount: number; playerHp: number }
  | { type: 'BOARD_EFFECT'; board: Board; message: string }
  | { type: 'VICTORY' }
  | { type: 'DEFEAT' };

export type TurnResolution = { accepted: boolean; battle: BattleState; events: BattleEvent[] };
