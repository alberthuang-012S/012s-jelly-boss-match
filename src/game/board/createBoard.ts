import { GAME_CONFIG } from '../config/gameConfig';
import { JELLY_COLORS } from '../types';
import type { Board, JellyColor, Tile } from '../types';
import { findMatches } from './matchFinder';
import type { RandomSource } from '../rng/RandomSource';
import { pick } from '../rng/RandomSource';

function tile(id: number, color: JellyColor): Tile { return { id: `j${id}`, color }; }

function makeStableBoard(random: RandomSource, startId: number): { board: Board; nextTileId: number } {
  let nextTileId = startId;
  const board: Board = [];
  for (let row = 0; row < GAME_CONFIG.rows; row += 1) {
    const line: (Tile | null)[] = [];
    for (let col = 0; col < GAME_CONFIG.columns; col += 1) {
      const choices = JELLY_COLORS.filter((color) => {
        if (col > 1 && line[col - 1]?.color === color && line[col - 2]?.color === color) return false;
        if (row > 1 && board[row - 1]?.[col]?.color === color && board[row - 2]?.[col]?.color === color) return false;
        return true;
      });
      line.push(tile(nextTileId++, pick(random, choices)));
    }
    board.push(line);
  }
  return { board, nextTileId };
}

export function hasAnyValidSwap(board: Board): boolean {
  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < (board[row]?.length ?? 0); col += 1) {
      const a = board[row]?.[col];
      if (!a || a.lockHits) continue;
      for (const [nextRow, nextCol] of [[row, col + 1], [row + 1, col]] as const) {
        const b = board[nextRow]?.[nextCol];
        if (!b || b.lockHits) continue;
        const copy = board.map((line) => [...line]);
        copy[row]![col] = b;
        copy[nextRow]![nextCol] = a;
        if (findMatches(copy).length) return true;
      }
    }
  }
  return false;
}

function fallbackBoard(startId: number): { board: Board; nextTileId: number } {
  const board = Array.from({ length: GAME_CONFIG.rows }, (_, row) =>
    Array.from({ length: GAME_CONFIG.columns }, (_, col) => tile(startId + row * GAME_CONFIG.columns + col, JELLY_COLORS[(row + col * 2) % JELLY_COLORS.length]!)),
  );
  // A guaranteed, match-free setup with a legal horizontal match one swap away.
  board[0]![0]!.color = 'green';
  board[0]![1]!.color = 'purple';
  board[0]![2]!.color = 'green';
  board[1]![1]!.color = 'green';
  return { board, nextTileId: startId + GAME_CONFIG.rows * GAME_CONFIG.columns };
}

export function createBoard(random: RandomSource, startId = 1): { board: Board; nextTileId: number } {
  let id = startId;
  for (let attempt = 0; attempt < GAME_CONFIG.initialBoardAttempts; attempt += 1) {
    const candidate = makeStableBoard(random, id);
    id = candidate.nextTileId;
    if (findMatches(candidate.board).length === 0 && hasAnyValidSwap(candidate.board)) return candidate;
  }
  return fallbackBoard(id);
}
