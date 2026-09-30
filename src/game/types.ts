export const STAT_KEYS = ['Bra', 'Sch', 'Neu', 'Pai', 'Tum', 'Vir', 'Bac', 'Eye', 'Pre'] as const;
export type StatKey = (typeof STAT_KEYS)[number];

export const CHARACTER_IDS = ['PNN', 'QCC', 'REE', 'KTT', 'COO'] as const;
export type CharacterId = (typeof CHARACTER_IDS)[number];
export const JELLY_COLORS = ['green', 'purple', 'red', 'cyan', 'yellow'] as const;
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

export type CharacterSkillConfig = {
  id: CharacterId;
  name: string;
  chargeCost: number;
  effectText: string;
  icon: string;
};

export type EnemyAction =
  | { type: 'attack'; amount: number }
  | { type: 'blocker'; amount: number }
  | { type: 'fog'; amount: number }
  | { type: 'shield'; amount: number }
  | { type: 'darken'; turns: number }
  | { type: 'slime'; amount: number }
  | { type: 'stone'; amount: number };

export type BossSpecialConfig = {
  title: string;
  effectText: string;
  actions: readonly EnemyAction[];
  /** Number of ordinary enemy actions before the first charge. */
  initialDelay: number;
  /** Number of ordinary enemy actions between charged attacks. */
  cooldown: number;
};

export type BossChargeState = Pick<BossSpecialConfig, 'title' | 'effectText' | 'actions'>;

export type EnemyConfig = {
  id: string;
  name: string;
  type: 'normal' | 'boss';
  kind: 'bacteria' | 'cold' | 'sleepy' | 'forgetful' | 'blur' | 'three-high' | 'slime' | 'joint' | 'shell' | 'forest';
  maxHp: number;
  attackPattern: readonly EnemyAction[];
  bossSpecial?: BossSpecialConfig;
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
};
export type Board = (Tile | null)[][];
export type CharacterStats = Record<CharacterId, Record<StatKey, number>>;
export type CharacterCharges = Record<CharacterId, number>;
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
  chainWaves: number;
  chainMultiplier: number;
  reeBoostPending: boolean;
  characterCharges: CharacterCharges;
  skillUsedSinceSwap: boolean;
  bossCharge: BossChargeState | null;
  bossSpecialCooldown: number;
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
  | { type: 'CHARGE_GAIN'; characterId: CharacterId; tileId: string; charge: number; capacity: number }
  | { type: 'GRAVITY'; board: Board; cascade: number }
  | { type: 'REFILL'; board: Board; cascade: number }
  | { type: 'CASCADE_START'; cascade: number }
  | { type: 'TURN_TOTAL'; stats: TurnStats; totalPower: number; damage: number; chainWaves: number; chainMultiplier: number; skillMultiplier: number }
  | { type: 'FINAL_ATTACK'; totalPower: number; chainWaves: number; chainMultiplier: number; skillMultiplier: number }
  | { type: 'ENEMY_DAMAGE'; damage: number; hpDamage: number; shieldDamage: number; enemyHp: number; enemyShield: number }
  | { type: 'ENEMY_ACTION'; action: EnemyAction; message: string }
  | { type: 'BOSS_CHARGE'; charge: BossChargeState }
  | { type: 'BOSS_BREAK'; source: 'chain' | 'skill' }
  | { type: 'BOSS_SPECIAL'; charge: BossChargeState }
  | { type: 'SKILL_USED'; characterId: CharacterId; skillName: string; chargeAfter: number }
  | { type: 'PLAYER_HEAL'; amount: number; playerHp: number }
  | { type: 'ENEMY_SHIELD_DAMAGE'; amount: number; enemyShield: number }
  | { type: 'REE_BOOST_READY' }
  | { type: 'PLAYER_DAMAGE'; amount: number; playerHp: number }
  | { type: 'BOARD_EFFECT'; board: Board; message: string }
  | { type: 'VICTORY' }
  | { type: 'DEFEAT' };

export type TurnResolution = { accepted: boolean; battle: BattleState; events: BattleEvent[] };
