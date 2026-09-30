import { GAME_CONFIG } from '../config/gameConfig';
import { JELLY_COLORS } from '../types';
import type { BattleEvent, BattleState, Board, Cell, EnemyAction, JellyColor, Tile, TurnResolution } from '../types';
import type { BossChargeState } from '../types';
import { characterForColor } from '../content/characters';
import { CHARACTER_SKILLS } from '../content/skills';
import { applyGravity, refillBoard } from '../board/gravity';
import { createBoard } from '../board/createBoard';
import { findMatches } from '../board/matchFinder';
import { areAdjacent, swapTiles } from '../board/swap';
import type { RandomSource } from '../rng/RandomSource';
import { pick, sampleWithoutReplacement } from '../rng/RandomSource';
import { addGains, aggregateCharacterStats, emptyCharacterStats, sumStats, totalPower } from '../stats/statAggregator';
import { emptyTurnStats } from '../stats/statGenerator';
import { generateTileStats } from '../stats/statGenerator';
import { chainMultiplierForWaves, resolveDamage } from './damageResolver';

const cloneBoard = (board: Board): Board => board.map((row) => row.map((tile) => tile ? { ...tile } : null));
const eventBoard = (board: Board): Board => cloneBoard(board);

function nextTile(id: number, random: RandomSource): Tile {
  return { id: `j${id}`, color: pick(random, JELLY_COLORS) };
}

function actionMessage(action: EnemyAction): string {
  switch (action.type) {
    case 'attack': return `攻擊 ${action.amount}`;
    case 'blocker': return `障礙 +${action.amount}`;
    case 'fog': return '迷霧來襲';
    case 'shield': return `護盾 +${action.amount}`;
    case 'darken': return '陰影覆蓋';
    case 'confuse': return '問號干擾';
    case 'slime': return `黏液格 +${action.amount}`;
    case 'stone': return `石化格 +${action.amount}`;
  }
}

function resolveActionEffects(action: EnemyAction, board: Board, playerHp: number, enemyShield: number, darkTurns: number, random: RandomSource) {
  const events: BattleEvent[] = [];
  let nextPlayerHp = playerHp;
  let nextEnemyShield = enemyShield;
  let nextDarkTurns = darkTurns;
  switch (action.type) {
    case 'attack':
      nextPlayerHp = Math.max(0, playerHp - action.amount);
      events.push({ type: 'PLAYER_DAMAGE', amount: action.amount, playerHp: nextPlayerHp });
      break;
    case 'blocker':
    case 'slime':
    case 'stone':
    case 'fog':
    case 'confuse': {
      const eligible: Cell[] = [];
      for (let row = 0; row < board.length; row += 1) {
        for (let col = 0; col < (board[row]?.length ?? 0); col += 1) {
          if (!board[row]?.[col]?.lockHits) eligible.push({ row, col });
        }
      }
      const count = Math.min(action.amount, eligible.length);
      for (const cell of sampleWithoutReplacement(random, eligible, count)) {
        const tile = board[cell.row]?.[cell.col];
        if (!tile) continue;
        if (action.type === 'blocker' || action.type === 'slime') tile.lockHits = 1;
        else if (action.type === 'stone') tile.lockHits = 1;
        else if (action.type === 'fog') tile.fog = 2;
        else tile.confused = 2;
      }
      events.push({ type: 'BOARD_EFFECT', board: eventBoard(board), message: actionMessage(action) });
      break;
    }
    case 'shield':
      nextEnemyShield += action.amount;
      events.push({ type: 'BOARD_EFFECT', board: eventBoard(board), message: `護盾 +${action.amount}` });
      break;
    case 'darken':
      nextDarkTurns = Math.max(nextDarkTurns, action.turns);
      events.push({ type: 'BOARD_EFFECT', board: eventBoard(board), message: actionMessage(action) });
      break;
  }
  return { playerHp: nextPlayerHp, enemyShield: nextEnemyShield, darkTurns: nextDarkTurns, events };
}

function cellsAround(cells: readonly Cell[], rows: number, cols: number): Cell[] {
  const unique = new Map<string, Cell>();
  for (const { row, col } of cells) {
    for (const [r, c] of [[row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]] as const) {
      if (r >= 0 && c >= 0 && r < rows && c < cols) unique.set(`${r},${c}`, { row: r, col: c });
    }
  }
  return [...unique.values()];
}

function applyAdjacentMatchToLocks(board: Board, matched: readonly Cell[]): Board {
  const next = cloneBoard(board);
  for (const cell of cellsAround(matched, board.length, board[0]?.length ?? 0)) {
    const tile = next[cell.row]?.[cell.col];
    if (!tile?.lockHits) continue;
    tile.lockHits -= 1;
    if (tile.lockHits <= 0) delete tile.lockHits;
  }
  return next;
}

function prepareMatchBoard(battle: BattleState, initialBoard: Board, random: RandomSource): TurnResolution {
  if (battle.status !== 'playing') return { accepted: false, battle, events: [] };
  const events: BattleEvent[] = [];
  let board = cloneBoard(initialBoard);
  let nextTileId = battle.nextTileId;
  const characterTurnStats = emptyCharacterStats();
  const characterCharges = { ...battle.characterCharges };
  let turnStats = emptyTurnStats();
  let cascade = 0;
  const eventsPerTile: BattleEvent[] = [];

  while (cascade < GAME_CONFIG.maxCascades) {
    const matches = findMatches(board);
    if (matches.length === 0) break;
    cascade += 1;
    if (cascade > 1) events.push({ type: 'CASCADE_START', cascade });
    events.push({ type: 'MATCH_FOUND', board: eventBoard(board), cells: matches, cascade });
    const removedIds = new Set(matches.map(({ row, col }) => board[row]?.[col]?.id).filter((id): id is string => Boolean(id)));

    board = applyAdjacentMatchToLocks(board, matches);
    const popped: Cell[] = [];
    for (const cell of matches) {
      const tile = board[cell.row]?.[cell.col];
      if (!tile || !removedIds.has(tile.id)) continue;
      board[cell.row]![cell.col] = null;
      popped.push(cell);
    }
    events.push({ type: 'JELLY_POP', board: eventBoard(board), cells: matches, cascade });

    for (const cell of popped) {
      // The popped tile stays in the MATCH_FOUND snapshot after it leaves the live board.
      const resolvedTile = lastMatchedTile(events, cell, removedIds);
      if (!resolvedTile) continue;
      const character = characterForColor(resolvedTile.color);
      const gains = generateTileStats(character.id, random);
      characterTurnStats[character.id] = addGains(characterTurnStats[character.id], gains);
      turnStats = addGains(turnStats, gains);
      eventsPerTile.push({ type: 'STAT_GAIN', characterId: character.id, tileId: resolvedTile.id, gains, cascade });
      const capacity = CHARACTER_SKILLS[character.id].chargeCost;
      if (characterCharges[character.id] < capacity) {
        characterCharges[character.id] += 1;
        eventsPerTile.push({ type: 'CHARGE_GAIN', characterId: character.id, tileId: resolvedTile.id, charge: characterCharges[character.id], capacity });
      }
    }
    events.push(...eventsPerTile.splice(0));

    board = applyGravity(board);
    events.push({ type: 'GRAVITY', board: eventBoard(board), cascade });
    const refill = refillBoard(board, nextTileId, (id) => nextTile(id, random));
    board = refill.board;
    nextTileId = refill.nextTileId;
    events.push({ type: 'REFILL', board: eventBoard(board), cascade });
  }

  if (cascade >= GAME_CONFIG.maxCascades && findMatches(board).length > 0) {
    // A bounded board rebuild is a safe ceiling for intentionally adversarial RNG streams.
    const safe = createBoard(random, nextTileId);
    board = safe.board;
    nextTileId = safe.nextTileId;
    events.push({ type: 'BOARD_EFFECT', board: eventBoard(board), message: '連鎖已達上限，盤面穩定完成' });
  }

  // Both turn values are reset each valid swap; stageStats keeps the whole-stage aggregate.
  turnStats = aggregateCharacterStats(characterTurnStats);
  const turnPower = totalPower(turnStats);
  const turnChainMultiplier = chainMultiplierForWaves(cascade);
  const skillMultiplier = battle.reeBoostPending ? 1.25 : 1;
  const damage = resolveDamage(turnStats, battle.enemy, turnChainMultiplier, skillMultiplier);
  const enemyShieldDamage = Math.min(battle.enemyShield, damage);
  const enemyHpDamage = Math.min(battle.enemyHp, damage - enemyShieldDamage);
  const enemyShield = battle.enemyShield - enemyShieldDamage;
  const enemyHp = Math.max(0, battle.enemyHp - enemyHpDamage);
  const nextTurn = battle.turns + 1;

  events.push({ type: 'TURN_TOTAL', stats: { ...turnStats }, totalPower: turnPower, damage, chainWaves: cascade, chainMultiplier: turnChainMultiplier, skillMultiplier });
  events.push({ type: 'FINAL_ATTACK', totalPower: turnPower, chainWaves: cascade, chainMultiplier: turnChainMultiplier, skillMultiplier });
  events.push({ type: 'ENEMY_DAMAGE', damage, hpDamage: enemyHpDamage, shieldDamage: enemyShieldDamage, enemyHp, enemyShield });

  let playerHp = battle.playerHp;
  let darkTurns = Math.max(0, battle.darkTurns - 1);
  let status: BattleState['status'] = battle.status;
  let enemyShieldAfterAction = enemyShield;
  let bossCharge: BossChargeState | null = battle.bossCharge;
  let bossSpecialCooldown = battle.bossSpecialCooldown;

  if (enemyHp === 0) {
    status = 'victory';
    bossCharge = null;
    events.push({ type: 'VICTORY' });
  } else {
    let conditionsChanged = false;
    for (const row of board) {
      for (const tile of row) {
        if (!tile) continue;
        if (tile.fog) { tile.fog -= 1; conditionsChanged = true; if (!tile.fog) delete tile.fog; }
        if (tile.confused) { tile.confused -= 1; conditionsChanged = true; if (!tile.confused) delete tile.confused; }
      }
    }
    if (conditionsChanged) events.push({ type: 'BOARD_EFFECT', board: eventBoard(board), message: '干擾效果減弱' });

    if (bossCharge) {
      if (cascade >= 2) {
        events.push({ type: 'BOSS_BREAK', source: 'chain' });
        bossCharge = null;
      } else {
        events.push({ type: 'BOSS_SPECIAL', charge: bossCharge });
        for (const action of bossCharge.actions) {
          const result = resolveActionEffects(action, board, playerHp, enemyShieldAfterAction, darkTurns, random);
          playerHp = result.playerHp;
          enemyShieldAfterAction = result.enemyShield;
          darkTurns = result.darkTurns;
          events.push(...result.events);
        }
        bossCharge = null;
      }
    } else if (battle.enemy.bossSpecial && bossSpecialCooldown <= 0) {
      const special = battle.enemy.bossSpecial;
      bossCharge = { title: special.title, effectText: special.effectText, actions: [...special.actions] };
      bossSpecialCooldown = special.cooldown;
      events.push({ type: 'BOSS_CHARGE', charge: bossCharge });
    } else {
      const pattern = battle.enemy.attackPattern;
      const action = pattern[(battle.turns) % pattern.length]!;
      events.push({ type: 'ENEMY_ACTION', action, message: actionMessage(action) });
      const result = resolveActionEffects(action, board, playerHp, enemyShieldAfterAction, darkTurns, random);
      playerHp = result.playerHp;
      enemyShieldAfterAction = result.enemyShield;
      darkTurns = result.darkTurns;
      events.push(...result.events);
      if (battle.enemy.bossSpecial) bossSpecialCooldown = Math.max(0, bossSpecialCooldown - 1);
    }
    if (playerHp === 0) {
      status = 'defeat';
      events.push({ type: 'DEFEAT' });
    }
  }

  const stageStats = sumStats(battle.stageStats, turnStats);
  const nextBattle: BattleState = {
    ...battle,
    board,
    nextTileId,
    turns: nextTurn,
    playerHp,
    enemyHp,
    enemyShield: enemyShieldAfterAction,
    characterTurnStats,
    turnStats,
    stageStats,
    totalPower: turnPower,
    characterCharges,
    skillUsedSinceSwap: false,
    chainWaves: cascade,
    chainMultiplier: turnChainMultiplier,
    reeBoostPending: false,
    bossCharge,
    bossSpecialCooldown,
    totalDamage: battle.totalDamage + enemyHpDamage,
    highestTurnDamage: Math.max(battle.highestTurnDamage, enemyHpDamage),
    highestCascade: Math.max(battle.highestCascade, cascade),
    status,
    darkTurns,
  };
  return { accepted: true, battle: nextBattle, events };
}

/** Kept separate so tests can verify snapshots and unique tile credit without animation concerns. */
function lastMatchedTile(events: BattleEvent[], cell: Cell, ids: Set<string>): Tile | undefined {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i];
    if (event?.type !== 'MATCH_FOUND') continue;
    const id = event.board[cell.row]?.[cell.col]?.id;
    if (id && ids.has(id)) return event.board[cell.row]?.[cell.col] ?? undefined;
  }
  return undefined;
}

export function resolveTurn(battle: BattleState, a: Cell, b: Cell, random: RandomSource): TurnResolution {
  if (!areAdjacent(a, b)) return { accepted: false, battle, events: [] };
  const swapped = swapTiles(battle.board, a, b);
  if (!swapped) return { accepted: false, battle, events: [] };
  if (findMatches(swapped).length === 0) {
    return { accepted: false, battle, events: [
      { type: 'SWAP', board: eventBoard(swapped), a, b },
      { type: 'INVALID_SWAP', board: eventBoard(battle.board), a, b },
    ] };
  }
  const resolved = prepareMatchBoard(battle, swapped, random);
  resolved.events.unshift({ type: 'SWAP', board: eventBoard(swapped), a, b });
  return resolved;
}

export function forceMatchTurn(battle: BattleState, color: JellyColor, random: RandomSource): TurnResolution {
  const board = cloneBoard(battle.board);
  for (let col = 0; col < 3; col += 1) {
    const existing = board[0]?.[col];
    if (!existing) continue;
    existing.color = color;
    delete existing.lockHits;
  }
  return prepareMatchBoard(battle, board, random);
}

/** Debug-only setup that makes the first top refill form a second match. */
export function forceCascadeTurn(battle: BattleState, random: RandomSource): TurnResolution {
  const board = cloneBoard(battle.board);
  for (let col = 0; col < 3; col += 1) {
    const matchTile = board[5]?.[col];
    const cascadeTile = board[4]?.[col];
    if (!matchTile || !cascadeTile) continue;
    matchTile.color = 'green';
    cascadeTile.color = 'purple';
    cascadeTile.lockHits = 1;
    delete matchTile.lockHits;
  }
  return prepareMatchBoard(battle, board, random);
}
