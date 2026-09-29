import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from './config/gameConfig';
import { CHARACTERS, characterForColor } from './content/characters';
import { ENEMIES } from './content/enemies';
import { STAGES } from './content/stages';
import { createBattle } from './battle/battleFactory';
import { resolveDamage } from './battle/damageResolver';
import { forceCascadeTurn, forceMatchTurn, resolveTurn } from './battle/turnResolver';
import { createBoard, hasAnyValidSwap } from './board/createBoard';
import { applyGravity, refillBoard } from './board/gravity';
import { findMatches } from './board/matchFinder';
import { areAdjacent, hasMatchAfterSwap, swapTiles } from './board/swap';
import { DefaultRandom } from './rng/DefaultRandom';
import { SeededRandom } from './rng/SeededRandom';
import type { RandomSource } from './rng/RandomSource';
import { CHARACTER_IDS, JELLY_COLORS, STAT_KEYS, type Board, type JellyColor } from './types';
import { addGains, aggregateCharacterStats, emptyCharacterStats, sumStats, totalPower } from './stats/statAggregator';
import { emptyTurnStats, generateTileStats } from './stats/statGenerator';

class ConstantRandom implements RandomSource {
  next() { return 0; }
  int(min: number, _max: number) { return min; }
}

function stableBoard(): Board {
  return Array.from({ length: 6 }, (_, row) => Array.from({ length: 6 }, (_, col) => ({
    id: `fixture-${row}-${col}`,
    color: JELLY_COLORS[(row + col * 2) % 5]!,
  })));
}

function blankBoardWithout(color: JellyColor): Board {
  const others = JELLY_COLORS.filter((item) => item !== color);
  return Array.from({ length: 6 }, (_, row) => Array.from({ length: 6 }, (_, col) => ({ id: `blank-${row}-${col}`, color: others[(row + col * 2) % others.length]! })));
}

function oneSwapMatchBoard(): Board {
  const board = stableBoard();
  board[0]![0] = { id: 'a', color: 'green' };
  board[0]![1] = { id: 'b', color: 'purple' };
  board[0]![2] = { id: 'c', color: 'green' };
  board[1]![1] = { id: 'd', color: 'green' };
  return board;
}

function makeBattle(seed = 14) {
  const random = new SeededRandom(seed);
  const battle = createBattle(STAGES[0]!, random);
  battle.board = oneSwapMatchBoard();
  battle.enemyHp = 10000;
  return { battle, random };
}

function set(board: Board, row: number, col: number, color: JellyColor, id = `x-${row}-${col}`) {
  board[row]![col] = { id, color };
}

describe('board rules', () => {
  it('allows only horizontal or vertical adjacent swaps', () => {
    expect(areAdjacent({ row: 2, col: 2 }, { row: 2, col: 3 })).toBe(true);
    expect(areAdjacent({ row: 2, col: 2 }, { row: 3, col: 2 })).toBe(true);
    expect(areAdjacent({ row: 2, col: 2 }, { row: 3, col: 3 })).toBe(false);
    expect(areAdjacent({ row: 2, col: 2 }, { row: 2, col: 4 })).toBe(false);
  });

  it('keeps a non-adjacent swap from changing the board', () => {
    const board = oneSwapMatchBoard();
    expect(swapTiles(board, { row: 0, col: 0 }, { row: 2, col: 2 })).toBeNull();
    expect(board[0]![0]!.id).toBe('a');
  });

  it('restores a swap that produces no match without using RNG or a turn', () => {
    const { battle } = makeBattle();
    const random = new SeededRandom(77);
    const before = random.getSeedState();
    const result = resolveTurn(battle, { row: 4, col: 4 }, { row: 4, col: 5 }, random);
    expect(result.accepted).toBe(false);
    expect(result.events.map((event) => event.type)).toEqual(['SWAP', 'INVALID_SWAP']);
    expect(result.battle).toBe(battle);
    expect(result.battle.turns).toBe(0);
    expect(result.battle.stageStats).toEqual(emptyTurnStats());
    expect(random.getSeedState()).toBe(before);
  });

  it('accepts a swap only when it creates a match', () => {
    expect(hasMatchAfterSwap(oneSwapMatchBoard(), { row: 0, col: 1 }, { row: 1, col: 1 })).toBe(true);
    expect(hasMatchAfterSwap(oneSwapMatchBoard(), { row: 4, col: 4 }, { row: 4, col: 5 })).toBe(false);
  });

  it('finds horizontal matches of three, four, five and six', () => {
    for (const length of [3, 4, 5, 6]) {
      const board = blankBoardWithout('red');
      for (let col = 0; col < length; col += 1) set(board, 2, col, 'red');
      expect(findMatches(board).filter((cell) => cell.row === 2).length).toBe(length);
    }
  });

  it('finds vertical matches', () => {
    const board = blankBoardWithout('yellow');
    for (let row = 0; row < 4; row += 1) set(board, row, 3, 'purple');
    expect(findMatches(board).filter((cell) => cell.col === 3).length).toBe(4);
  });

  it.each(['L', 'T', 'cross'])('deduplicates tile instances in a %s overlap', (shape) => {
    const board = blankBoardWithout('yellow');
    const cells = shape === 'L'
      ? [[2,1],[2,2],[2,3],[3,1],[4,1]]
      : shape === 'T'
        ? [[2,1],[2,2],[2,3],[3,2],[4,2]]
        : [[2,1],[2,2],[2,3],[1,2],[3,2]];
    for (const [row, col] of cells) set(board, row!, col!, 'yellow');
    const found = findMatches(board);
    expect(found).toHaveLength(cells.length);
    expect(new Set(found.map((cell) => board[cell.row]![cell.col]!.id)).size).toBe(cells.length);
  });

  it('never matches or moves a locked tile', () => {
    const board = blankBoardWithout('green');
    board[2]![1]!.color = 'green'; board[2]![2]!.color = 'green'; board[2]![3]!.color = 'green';
    board[2]![2]!.lockHits = 1;
    expect(swapTiles(board, { row: 2, col: 1 }, { row: 2, col: 2 })).toBeNull();
    expect(findMatches(board)).toHaveLength(0);
  });

  it('applies gravity while preserving locked barriers and tile order', () => {
    const board = blankBoardWithout('yellow');
    const a = board[0]![0]!; const b = board[2]![0]!; const wall = board[3]![0]!;
    wall.lockHits = 2;
    board[1]![0] = null; board[2]![0] = b; board[4]![0] = null;
    const next = applyGravity(board);
    expect(next[2]![0]?.id).toBe(b.id);
    expect(next[1]![0]?.id).toBe(a.id);
    expect(next[3]![0]?.id).toBe(wall.id);
    expect(next[5]![0]?.id).toBe(board[5]![0]!.id);
    expect(next[0]![0]).toBeNull();
  });

  it('refills empty cells with unique new instance IDs', () => {
    const board = blankBoardWithout('green');
    board[0]![1] = null; board[0]![4] = null;
    const refilled = refillBoard(board, 100, (id) => ({ id: `j${id}`, color: 'cyan' }));
    expect(refilled.board.flat().every(Boolean)).toBe(true);
    expect(refilled.board[0]![1]!.id).toBe('j100');
    expect(refilled.board[0]![4]!.id).toBe('j101');
    expect(new Set(refilled.board.flat().map((tile) => tile!.id)).size).toBe(36);
    expect(refilled.nextTileId).toBe(102);
  });

  it('starts with a stable, solvable six by six board', () => {
    const { board, nextTileId } = createBoard(new SeededRandom(41));
    expect(board).toHaveLength(6);
    expect(board.every((row) => row.length === 6)).toBe(true);
    expect(findMatches(board)).toHaveLength(0);
    expect(hasAnyValidSwap(board)).toBe(true);
    expect(new Set(board.flat().map((tile) => tile!.id)).size).toBe(36);
    expect(nextTileId).toBeGreaterThan(36);
  });

  it('continues cascades and grants a stat event for each popped tile', () => {
    let cascaded = false;
    for (let seed = 1; seed <= 120 && !cascaded; seed += 1) {
      const { battle } = makeBattle(seed);
      const result = resolveTurn(battle, { row: 0, col: 1 }, { row: 1, col: 1 }, new SeededRandom(seed));
      const pops = result.events.filter((event) => event.type === 'JELLY_POP');
      if (pops.length > 1) {
        cascaded = true;
        const matchedIds = result.events.filter((event) => event.type === 'MATCH_FOUND').flatMap((event) => event.cells.map((cell) => event.board[cell.row]?.[cell.col]?.id));
        const gainedIds = result.events.filter((event) => event.type === 'STAT_GAIN').map((event) => event.tileId);
        expect(gainedIds).toEqual(matchedIds.filter((id): id is string => Boolean(id)));
        expect(result.battle.highestCascade).toBeGreaterThan(1);
      }
    }
    expect(cascaded).toBe(true);
  });

  it('stops an endless refill chain at the configured cascade limit', () => {
    const { battle } = makeBattle(91);
    const result = forceMatchTurn(battle, 'green', new ConstantRandom());
    expect(result.accepted).toBe(true);
    expect(result.battle.highestCascade).toBe(GAME_CONFIG.maxCascades);
    expect(findMatches(result.battle.board)).toHaveLength(0);
  });
});

describe('characters and per-tile stat generation', () => {
  it('defines all nine stat keys for every character', () => {
    const all = emptyCharacterStats();
    for (const id of CHARACTER_IDS) expect(Object.keys(all[id]).sort()).toEqual([...STAT_KEYS].sort());
  });

  it.each(CHARACTER_IDS)('%s has exactly the specified three main stats', (id) => {
    const expected = {
      PNN: ['Pai','Tum','Eye'], QCC: ['Bra','Eye','Vir'], REE: ['Sch','Neu','Pre'], KTT: ['Vir','Tum','Bac'], COO: ['Pre','Bra','Pai'],
    }[id];
    expect(CHARACTERS[id].mainStats).toEqual(expected);
    expect(new Set(CHARACTERS[id].mainStats).size).toBe(3);
  });

  it('maps each jelly color to its configured character', () => {
    expect(JELLY_COLORS.map((color) => characterForColor(color).id)).toEqual(CHARACTER_IDS);
  });

  it.each(CHARACTER_IDS)('%s always gets all three independent main stat gains from +1 to +3', (id) => {
    for (let seed = 1; seed <= 25; seed += 1) {
      const gains = generateTileStats(id, new SeededRandom(seed));
      const byStat = new Map(gains.map((gain) => [gain.stat, gain.amount]));
      for (const stat of CHARACTERS[id].mainStats) expect(byStat.get(stat)).toBeGreaterThanOrEqual(1);
      for (const stat of CHARACTERS[id].mainStats) expect(byStat.get(stat)).toBeLessThanOrEqual(3);
    }
  });

  it('never rolls a zero for a main stat', () => {
    for (const id of CHARACTER_IDS) for (let seed = 1; seed < 12; seed += 1) {
      const gains = generateTileStats(id, new SeededRandom(seed));
      for (const stat of CHARACTERS[id].mainStats) expect(gains.find((gain) => gain.stat === stat)?.amount).not.toBe(0);
    }
  });

  it('adds zero, one or two unique non-main stats and gives each +1 to +3', () => {
    for (const id of CHARACTER_IDS) for (let seed = 1; seed < 80; seed += 1) {
      const gains = generateTileStats(id, new SeededRandom(seed));
      const extras = gains.filter((gain) => !CHARACTERS[id].mainStats.includes(gain.stat));
      expect(extras.length).toBeGreaterThanOrEqual(GAME_CONFIG.extraStatCountMin);
      expect(extras.length).toBeLessThanOrEqual(GAME_CONFIG.extraStatCountMax);
      expect(new Set(extras.map((gain) => gain.stat)).size).toBe(extras.length);
      for (const extra of extras) {
        expect(extra.amount).toBeGreaterThanOrEqual(1);
        expect(extra.amount).toBeLessThanOrEqual(3);
      }
      for (const stat of CHARACTERS[id].mainStats) expect(extras.some((gain) => gain.stat === stat)).toBe(false);
    }
  });

  it('leaves every stat not rolled at zero in a full nine-stat record', () => {
    const gains = generateTileStats('PNN', new SeededRandom(33));
    const record = addGains(emptyTurnStats(), gains);
    expect(Object.keys(record).sort()).toEqual([...STAT_KEYS].sort());
    for (const stat of STAT_KEYS.filter((key) => !gains.some((gain) => gain.stat === key))) expect(record[stat]).toBe(0);
  });

  it('runs stat generation once per each of three matched tile instances', () => {
    const { battle } = makeBattle();
    const result = resolveTurn(battle, { row: 0, col: 1 }, { row: 1, col: 1 }, new SeededRandom(9));
    const firstStagePop = result.events.find((event) => event.type === 'JELLY_POP');
    const firstStageGains = result.events.filter((event) => event.type === 'STAT_GAIN').slice(0, 3);
    expect(firstStagePop?.type).toBe('JELLY_POP');
    expect(firstStageGains).toHaveLength(3);
    expect(new Set(firstStageGains.map((event) => event.tileId)).size).toBe(3);
  });

  it('counts a cascade match through the same per-tile stat generator', () => {
    const { battle } = makeBattle();
    const result = resolveTurn(battle, { row: 0, col: 1 }, { row: 1, col: 1 }, new ConstantRandom());
    const popped = result.events.filter((event) => event.type === 'JELLY_POP').reduce((sum, event) => sum + event.cells.length, 0);
    const generated = result.events.filter((event) => event.type === 'STAT_GAIN').length;
    expect(generated).toBe(popped);
    expect(result.battle.highestCascade).toBeGreaterThan(1);
  });

  it('forces a real second-stage cascade in debug mode while preserving each tile gain', () => {
    const { battle, random } = makeBattle(24);
    const result = forceCascadeTurn(battle, random);
    expect(result.events.filter((event) => event.type === 'JELLY_POP').length).toBeGreaterThanOrEqual(2);
    expect(result.events.filter((event) => event.type === 'STAT_GAIN').length).toBe(
      result.events.filter((event) => event.type === 'JELLY_POP').reduce((sum, event) => sum + event.cells.length, 0),
    );
  });

  it('does not generate stats twice for an overlapping tile instance', () => {
    const board = blankBoardWithout('green');
    for (const [row, col] of [[2,1],[2,2],[2,3],[1,2],[3,2]]) set(board, row!, col!, 'green');
    expect(findMatches(board)).toHaveLength(5);
    const ids = findMatches(board).map((cell) => board[cell.row]![cell.col]!.id);
    expect(new Set(ids).size).toBe(5);
  });
});

describe('aggregation and damage', () => {
  it('keeps characterTurnStats and turnStats aligned to each successful turn', () => {
    const { battle, random } = makeBattle(21);
    const first = forceMatchTurn(battle, 'green', random).battle;
    const second = forceMatchTurn(first, 'purple', random).battle;
    expect(second.turnStats).toEqual(aggregateCharacterStats(second.characterTurnStats));
    expect(second.characterTurnStats.PNN).toEqual(emptyTurnStats());
    expect(totalPower(second.turnStats)).toBeGreaterThan(0);
    expect(second.stageStats).toEqual(sumStats(first.stageStats, second.turnStats));
  });

  it('sums the nine turn stats into Total Power', () => {
    const stats = { Bra: 12, Sch: 8, Neu: 15, Pai: 17, Tum: 21, Vir: 9, Bac: 14, Eye: 20, Pre: 11 };
    expect(totalPower(stats)).toBe(127);
  });

  it('uses unconfigured enemy multipliers as 1', () => {
    expect(resolveDamage({ Bra: 1, Sch: 2, Neu: 3, Pai: 4, Tum: 5, Vir: 6, Bac: 7, Eye: 8, Pre: 9 }, ENEMIES.bacteria!)).toBe(45);
  });

  it('applies configured weakness and resistance multipliers only in final damage', () => {
    const stats = { Bra: 0, Sch: 0, Neu: 0, Pai: 10, Tum: 0, Vir: 0, Bac: 0, Eye: 10, Pre: 0 };
    expect(resolveDamage(stats, ENEMIES.blur!)).toBe(21);
    expect(stats.Pai).toBe(10);
  });
});

describe('seeded RNG and battle turn flow', () => {
  it('repeats the exact same board and turn result from the same seed and move', () => {
    const run = () => {
      const rng = new SeededRandom('c0ffee12');
      const battle = createBattle(STAGES[0]!, rng);
      const result = resolveTurn(battle, { row: 0, col: 0 }, { row: 0, col: 1 }, rng);
      return { battle: result.battle, events: result.events };
    };
    expect(run()).toEqual(run());
  });

  it('does not give invalid swaps a Player Turn or an enemy action', () => {
    const { battle, random } = makeBattle();
    const result = resolveTurn(battle, { row: 4, col: 4 }, { row: 4, col: 5 }, random);
    expect(result.battle.turns).toBe(0);
    expect(result.events.some((event) => event.type === 'ENEMY_ACTION')).toBe(false);
  });

  it('counts a multi-cascade move as exactly one Player Turn and one enemy action', () => {
    const { battle, random } = makeBattle();
    const result = resolveTurn(battle, { row: 0, col: 1 }, { row: 1, col: 1 }, random);
    expect(result.battle.turns).toBe(1);
    expect(result.events.filter((event) => event.type === 'ENEMY_ACTION')).toHaveLength(1);
  });

  it('applies the final attack exactly once after the cascades', () => {
    const { battle, random } = makeBattle();
    const result = resolveTurn(battle, { row: 0, col: 1 }, { row: 1, col: 1 }, random);
    expect(result.events.filter((event) => event.type === 'FINAL_ATTACK')).toHaveLength(1);
    expect(result.battle.totalDamage).toBeGreaterThan(0);
  });

  it('does not let a defeated enemy counterattack', () => {
    const { battle, random } = makeBattle();
    battle.enemyHp = 1;
    const result = forceMatchTurn(battle, 'green', random);
    expect(result.battle.status).toBe('victory');
    expect(result.events.filter((event) => event.type === 'ENEMY_ACTION')).toHaveLength(0);
    expect(result.events.at(-1)?.type).toBe('VICTORY');
  });

  it('ends the battle when player HP reaches zero', () => {
    const { battle, random } = makeBattle();
    battle.playerHp = 1;
    const result = forceMatchTurn(battle, 'green', random);
    expect(result.battle.playerHp).toBe(0);
    expect(result.battle.status).toBe('defeat');
    expect(result.events.at(-1)?.type).toBe('DEFEAT');
  });

  it('keeps animation speed and skip presentation settings out of RNG outcomes', () => {
    const resolveWithPresentation = (_fast: boolean, _skip: boolean) => {
      const rng = new SeededRandom(4545);
      const base = createBattle(STAGES[0]!, rng);
      base.board = oneSwapMatchBoard(); base.enemyHp = 10000;
      return resolveTurn(base, { row: 0, col: 1 }, { row: 1, col: 1 }, rng);
    };
    expect(resolveWithPresentation(false, false)).toEqual(resolveWithPresentation(true, false));
    expect(resolveWithPresentation(false, false)).toEqual(resolveWithPresentation(false, true));
  });

  it('runs the deterministic test implementation through the shared RandomSource interface', () => {
    expect(new DefaultRandom().int(2, 2)).toBe(2);
    const seeded = new SeededRandom(123);
    const values = Array.from({ length: 4 }, () => seeded.next());
    expect(new Set(values).size).toBe(4);
    expect(values.every((value) => value >= 0 && value < 1)).toBe(true);
  });
});
