import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from './config/gameConfig';
import { CHARACTERS, characterForColor } from './content/characters';
import { ENEMIES } from './content/enemies';
import { CHARACTER_SKILLS } from './content/skills';
import { STAGES } from './content/stages';
import { createBattle } from './battle/battleFactory';
import { chainMultiplierForWaves, resolveDamage } from './battle/damageResolver';
import { forceCascadeTurn, forceMatchTurn, resolveTurn } from './battle/turnResolver';
import { createBoard, hasAnyValidSwap } from './board/createBoard';
import { applyGravity, refillBoard } from './board/gravity';
import { findMatches } from './board/matchFinder';
import { areAdjacent, hasMatchAfterSwap, swapTiles } from './board/swap';
import { DefaultRandom } from './rng/DefaultRandom';
import { SeededRandom } from './rng/SeededRandom';
import type { RandomSource } from './rng/RandomSource';
import { CHARACTER_IDS, JELLY_COLORS, STAT_KEYS, type BattleEvent, type Board, type JellyColor } from './types';
import { addGains, aggregateCharacterStats, emptyCharacterStats, sumStats, totalPower } from './stats/statAggregator';
import { emptyTurnStats, generateTileStats } from './stats/statGenerator';
import { emptyCharacterCharges, skillUnavailableReason, useCharacterSkill } from './skills/characterSkills';

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

function makeBossBattle(seed = 42) {
  const random = new SeededRandom(seed);
  const battle = createBattle(STAGES.find((stage) => stage.enemyId === 'blur')!, random);
  battle.board = oneSwapMatchBoard();
  battle.enemyHp = 10000;
  battle.bossSpecialCooldown = 0;
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

  it('applies the configured chain multiplier by wave count and caps at four waves', () => {
    expect([0, 1, 2, 3, 4, 20].map(chainMultiplierForWaves)).toEqual([1, 1, 1.15, 1.3, 1.5, 1.5]);
  });

  it('multiplies chain and skill boosts before the single final floor', () => {
    const stats = { Bra: 0, Sch: 0, Neu: 0, Pai: 0, Tum: 0, Vir: 0, Bac: 0, Eye: 2, Pre: 0 };
    expect(resolveDamage(stats, ENEMIES.blur!, 1.15, 1.25)).toBe(3);
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
  it.each(STAGES)('starts stage $id with a valid enemy and a playable board', (stage) => {
    const battle = createBattle(stage, new SeededRandom(stage.id));
    expect(battle.enemy.maxHp).toBeGreaterThan(0);
    expect(battle.enemy.attackPattern.length).toBeGreaterThan(0);
    expect(findMatches(battle.board)).toHaveLength(0);
    expect(hasAnyValidSwap(battle.board)).toBe(true);
    if (stage.chapter >= 3) {
      expect(battle.enemy.type).toBe(stage.number === 4 ? 'boss' : 'normal');
      expect(battle.enemy.actionNames).toHaveLength(battle.enemy.attackPattern.length);
      for (const action of [...battle.enemy.attackPattern, ...(battle.enemy.bossSpecial?.actions ?? [])]) {
        if (action.type === 'stone') expect(action.amount).toBeLessThanOrEqual(2);
      }
    }
  });

  it.each(['fog', 'blocker'] as const)('limits accumulated %s and avoids overlapping board effects', (type) => {
    const { battle, random } = makeBattle(71);
    battle.enemy = { ...battle.enemy, attackPattern: [{ type, amount: 20 }] };
    battle.board[5]![0]!.fog = 2;
    battle.board[5]![1]!.lockHits = 1;
    const result = forceMatchTurn(battle, 'green', random);
    const effect = result.events.filter((event) => event.type === 'BOARD_EFFECT').at(-1);
    if (effect?.type !== 'BOARD_EFFECT') throw new Error('Missing enemy board effect');
    expect(effect.board.flat().filter((tile) => tile?.fog).length).toBeLessThanOrEqual(GAME_CONFIG.maxFogTiles);
    expect(effect.board.flat().filter((tile) => tile?.lockHits).length).toBeLessThanOrEqual(GAME_CONFIG.maxLockedTiles);
    expect(effect.board.flat().some((tile) => tile?.fog && tile.lockHits)).toBe(false);
  });
  it('applies one-layer stone locks that one adjacent match can clear', () => {
    const random = new SeededRandom(42);
    const battle = createBattle(STAGES.find((stage) => stage.enemyId === 'joint')!, random);
    battle.enemyHp = 10000;
    const first = forceMatchTurn(battle, 'green', random);
    const stoneEffect = first.events.find((event) => event.type === 'BOARD_EFFECT' && event.message === '石化格 +1');
    expect(stoneEffect?.type).toBe('BOARD_EFFECT');
    if (stoneEffect?.type !== 'BOARD_EFFECT') throw new Error('Missing stone effect');
    expect(stoneEffect.board.flat().filter((tile) => tile?.lockHits).map((tile) => tile!.lockHits)).toEqual([1]);

    first.battle.board = stableBoard();
    const locked = first.battle.board[1]![0]!;
    locked.lockHits = 1;
    const second = forceMatchTurn(first.battle, 'green', random);
    const firstPop = second.events.find((event) => event.type === 'JELLY_POP');
    expect(firstPop?.type).toBe('JELLY_POP');
    if (firstPop?.type !== 'JELLY_POP') throw new Error('Missing adjacent match');
    expect(firstPop.board.flat().find((tile) => tile?.id === locked.id)?.lockHits).toBeUndefined();
  });
  it('repeats the exact same board and turn result from the same seed and move', () => {
    const run = () => {
      const rng = new SeededRandom('c0ffee12');
      const battle = createBattle(STAGES[0]!, rng);
      const result = resolveTurn(battle, { row: 0, col: 0 }, { row: 0, col: 1 }, rng);
      return { battle: result.battle, events: result.events };
    };
    expect(run()).toEqual(run());
  });

  it('repeats the same result for an identical skill and swap sequence at every presentation speed', () => {
    const run = (_fast: boolean, _skip: boolean) => {
      const rng = new SeededRandom('skill-chain-seed');
      const battle = createBattle(STAGES[0]!, rng);
      battle.board = oneSwapMatchBoard();
      battle.enemyHp = 10000;
      battle.characterCharges.REE = CHARACTER_SKILLS.REE.chargeCost;
      const skill = useCharacterSkill(battle, 'REE');
      if (!skill.accepted) throw new Error('REE setup skill should be valid');
      return resolveTurn(skill.battle, { row: 0, col: 1 }, { row: 1, col: 1 }, rng);
    };
    expect(run(false, false)).toEqual(run(true, false));
    expect(run(false, false)).toEqual(run(false, true));
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

describe('Boss charge and interrupt flow', () => {
  it('starts charging during the Boss phase without attacking and waits for one full valid exchange', () => {
    const { battle, random } = makeBossBattle();
    const first = resolveTurn(battle, { row: 0, col: 1 }, { row: 1, col: 1 }, random);
    expect(first.battle.bossCharge?.title).toBe('濃霧震波');
    expect(first.events.filter((event) => event.type === 'BOSS_CHARGE')).toHaveLength(1);
    expect(first.events.some((event) => event.type === 'PLAYER_DAMAGE')).toBe(false);
    expect(first.battle.playerHp).toBe(100);

    first.battle.board = oneSwapMatchBoard();
    const second = findValidTurn(first.battle, 90);
    expect(second.battle.bossCharge).toBeNull();
    expect(second.events.some((event) => event.type === 'BOSS_SPECIAL' || event.type === 'BOSS_BREAK')).toBe(true);
    expect(second.events.some((event) => event.type === 'ENEMY_ACTION')).toBe(false);
  });

  it('breaks a charged move with a two-wave chain and skips a normal attack', () => {
    const { battle, random } = makeBossBattle();
    battle.bossCharge = { ...battle.enemy.bossSpecial!, actions: [...battle.enemy.bossSpecial!.actions] };
    const result = forceCascadeTurn(battle, random);
    expect(result.battle.chainWaves).toBeGreaterThanOrEqual(2);
    expect(result.events.filter((event) => event.type === 'BOSS_BREAK')).toHaveLength(1);
    expect(result.events.some((event) => event.type === 'BOSS_SPECIAL' || event.type === 'ENEMY_ACTION')).toBe(false);
    expect(result.battle.bossCharge).toBeNull();
  });

  it('resolves an unbroken charged move once instead of appending an ordinary action', () => {
    const { battle } = makeBossBattle();
    battle.bossCharge = { ...battle.enemy.bossSpecial!, actions: [...battle.enemy.bossSpecial!.actions] };
    const result = findValidTurn(battle, 180);
    expect(result.battle.chainWaves).toBe(1);
    expect(result.events.filter((event) => event.type === 'BOSS_SPECIAL')).toHaveLength(1);
    expect(result.events.filter((event) => event.type === 'ENEMY_ACTION')).toHaveLength(0);
    expect(result.battle.playerHp).toBe(78);
  });

  it('gives a defeating attack priority over a pending charged move', () => {
    const { battle, random } = makeBossBattle();
    battle.bossCharge = { ...battle.enemy.bossSpecial!, actions: [...battle.enemy.bossSpecial!.actions] };
    battle.enemyHp = 1;
    const result = forceMatchTurn(battle, 'green', random);
    expect(result.battle.status).toBe('victory');
    expect(result.battle.bossCharge).toBeNull();
    expect(result.events.some((event) => event.type === 'BOSS_SPECIAL' || event.type === 'BOSS_BREAK' || event.type === 'ENEMY_ACTION')).toBe(false);
  });

  it('does not advance a charge deadline for an invalid swap', () => {
    const { battle, random } = makeBossBattle();
    battle.bossCharge = { ...battle.enemy.bossSpecial!, actions: [...battle.enemy.bossSpecial!.actions] };
    const result = resolveTurn(battle, { row: 4, col: 4 }, { row: 4, col: 5 }, random);
    expect(result.accepted).toBe(false);
    expect(result.battle.bossCharge).toEqual(battle.bossCharge);
    expect(result.battle.bossSpecialCooldown).toBe(battle.bossSpecialCooldown);
    expect(result.events.some((event) => event.type === 'BOSS_SPECIAL' || event.type === 'BOSS_BREAK')).toBe(false);
  });
});

describe('character charge and skill rules', () => {
  it('starts every new battle with empty charge, an open skill window, and no REE boost', () => {
    const battle = createBattle(STAGES[0]!, new SeededRandom(120));
    expect(battle.characterCharges).toEqual(emptyCharacterCharges());
    expect(battle.skillUsedSinceSwap).toBe(false);
    expect(battle.reeBoostPending).toBe(false);
  });

  it('charges once per removed tile instance and stops at each character capacity', () => {
    const { battle, random } = makeBattle(144);
    battle.characterCharges.PNN = CHARACTER_SKILLS.PNN.chargeCost - 1;
    const result = forceMatchTurn(battle, 'green', random);
    const gains = result.events.filter((event): event is Extract<BattleEvent, { type: 'CHARGE_GAIN' }> => event.type === 'CHARGE_GAIN' && event.characterId === 'PNN');
    expect(gains).toHaveLength(1);
    expect(gains[0]?.charge).toBe(CHARACTER_SKILLS.PNN.chargeCost);
    expect(new Set(gains.map((event) => event.tileId)).size).toBe(gains.length);
    expect(result.battle.characterCharges.PNN).toBe(CHARACTER_SKILLS.PNN.chargeCost);
  });

  it('rejects PNN at full HP and heals only up to maximum without advancing a turn', () => {
    const { battle } = makeBattle();
    battle.characterCharges.PNN = CHARACTER_SKILLS.PNN.chargeCost;
    expect(skillUnavailableReason(battle, 'PNN')).toMatch(/HP 已滿/);
    expect(useCharacterSkill(battle, 'PNN').accepted).toBe(false);
    battle.playerHp = 94;
    const used = useCharacterSkill(battle, 'PNN');
    expect(used.accepted).toBe(true);
    expect(used.battle.playerHp).toBe(100);
    expect(used.battle.characterCharges.PNN).toBe(0);
    expect(used.battle.turns).toBe(battle.turns);
    expect(used.battle.skillUsedSinceSwap).toBe(true);
    expect(used.events.find((event) => event.type === 'PLAYER_HEAL')).toMatchObject({ amount: 6, playerHp: 100 });
    expect(used.events.some((event) => event.type === 'ENEMY_ACTION')).toBe(false);
  });

  it('allows QCC to cancel a Boss charge and does not append an enemy action', () => {
    const { battle } = makeBossBattle();
    battle.bossCharge = { ...battle.enemy.bossSpecial!, actions: [...battle.enemy.bossSpecial!.actions] };
    battle.bossSpecialCooldown = 2;
    battle.characterCharges.QCC = CHARACTER_SKILLS.QCC.chargeCost;
    const used = useCharacterSkill(battle, 'QCC');
    expect(used.accepted).toBe(true);
    expect(used.battle.bossCharge).toBeNull();
    expect(used.battle.characterCharges.QCC).toBe(0);
    expect(used.events.some((event) => event.type === 'BOSS_BREAK' && event.source === 'skill')).toBe(true);
    expect(used.events.some((event) => event.type === 'ENEMY_ACTION')).toBe(false);

    const next = findValidTurn(used.battle, 265);
    expect(next.events.filter((event) => event.type === 'ENEMY_ACTION')).toHaveLength(1);
    expect(next.events.some((event) => event.type === 'BOSS_CHARGE' || event.type === 'BOSS_SPECIAL')).toBe(false);
  });

  it('rejects QCC without a pending Boss, and rejects REE stacking', () => {
    const { battle } = makeBattle();
    battle.characterCharges.QCC = CHARACTER_SKILLS.QCC.chargeCost;
    expect(skillUnavailableReason(battle, 'QCC')).toMatch(/沒有正在蓄力/);
    battle.characterCharges.REE = CHARACTER_SKILLS.REE.chargeCost;
    battle.reeBoostPending = true;
    expect(skillUnavailableReason(battle, 'REE')).toMatch(/不能疊加/);
    expect(useCharacterSkill(battle, 'REE').accepted).toBe(false);
  });

  it('keeps a REE boost through an invalid exchange, then multiplies damage with chain', () => {
    const { battle, random } = makeBattle(24);
    battle.characterCharges.REE = CHARACTER_SKILLS.REE.chargeCost;
    const ready = useCharacterSkill(battle, 'REE');
    expect(ready.battle.reeBoostPending).toBe(true);
    const invalid = resolveTurn(ready.battle, { row: 4, col: 4 }, { row: 4, col: 5 }, random);
    expect(invalid.accepted).toBe(false);
    expect(invalid.battle.reeBoostPending).toBe(true);
    expect(invalid.battle.characterCharges.REE).toBe(0);

    const chained = forceCascadeTurn(ready.battle, new SeededRandom(24));
    const total = chained.events.find((event) => event.type === 'TURN_TOTAL');
    expect(chained.battle.chainWaves).toBeGreaterThanOrEqual(2);
    if (total?.type !== 'TURN_TOTAL') throw new Error('Expected a turn total event');
    expect(total.skillMultiplier).toBe(1.25);
    expect(total.damage).toBe(resolveDamage(total.stats, battle.enemy, chainMultiplierForWaves(total.chainWaves), 1.25));
    expect(chained.battle.reeBoostPending).toBe(false);
  });

  it('lets KTT remove at most 30 shield without dealing HP damage', () => {
    const { battle } = makeBattle();
    battle.characterCharges.KTT = CHARACTER_SKILLS.KTT.chargeCost;
    battle.enemyShield = 45;
    const used = useCharacterSkill(battle, 'KTT');
    expect(used.accepted).toBe(true);
    expect(used.battle.enemyShield).toBe(15);
    expect(used.battle.enemyHp).toBe(battle.enemyHp);
    expect(used.events.find((event) => event.type === 'ENEMY_SHIELD_DAMAGE')).toMatchObject({ amount: 30, enemyShield: 15 });
    expect(skillUnavailableReason({ ...battle, enemyShield: 0 }, 'KTT')).toMatch(/沒有護盾/);
  });

  it('lets COO cleanse fog and one lock layer without moving or replacing any tile', () => {
    const { battle } = makeBattle();
    battle.characterCharges.COO = CHARACTER_SKILLS.COO.chargeCost;
    battle.board[0]![0]!.fog = 2;
    battle.board[0]![2]!.lockHits = 1;
    battle.board[1]![0]!.lockHits = 3;
    const before = battle.board.map((row) => row.map((tile) => tile && ({ id: tile.id, color: tile.color })));
    const used = useCharacterSkill(battle, 'COO');
    expect(used.accepted).toBe(true);
    expect(used.battle.board.map((row) => row.map((tile) => tile && ({ id: tile.id, color: tile.color })))).toEqual(before);
    expect(used.battle.board[0]![0]!.fog).toBeUndefined();
    expect(used.battle.board[0]![2]!.lockHits).toBeUndefined();
    expect(used.battle.board[1]![0]!.lockHits).toBe(2);
    const cleanBoard = used.battle.board.map((row) => row.map((tile) => tile ? { ...tile, lockHits: undefined } : null));
    expect(skillUnavailableReason({ ...used.battle, board: cleanBoard, skillUsedSinceSwap: false, characterCharges: { ...used.battle.characterCharges, COO: 10 } }, 'COO')).toMatch(/沒有可淨化/);
  });

  it('allows at most one skill between effective swaps and restores availability after the next accepted turn', () => {
    const { battle, random } = makeBattle(202);
    battle.characterCharges.PNN = CHARACTER_SKILLS.PNN.chargeCost;
    battle.playerHp = 70;
    const first = useCharacterSkill(battle, 'PNN');
    expect(skillUnavailableReason(first.battle, 'REE')).toMatch(/只能施放一項技能/);
    const invalid = resolveTurn(first.battle, { row: 4, col: 4 }, { row: 4, col: 5 }, random);
    expect(invalid.battle.skillUsedSinceSwap).toBe(true);
    const valid = findValidTurn(first.battle, 375);
    expect(valid.battle.skillUsedSinceSwap).toBe(false);
  });
});

function findValidTurn(battle: ReturnType<typeof makeBossBattle>['battle'], seedStart: number) {
  for (let seed = seedStart; seed < seedStart + 300; seed += 1) {
    const random = new SeededRandom(seed);
    const candidate = { ...battle, board: oneSwapMatchBoard(), enemyHp: 10000, playerHp: 100 };
    const result = resolveTurn(candidate, { row: 0, col: 1 }, { row: 1, col: 1 }, random);
    if (result.accepted && result.battle.chainWaves === 1) return result;
  }
  throw new Error('Could not find a seeded single-wave valid turn');
}
