import type { Board, Cell } from '../types';
import { findMatches } from './matchFinder';

export function areAdjacent(a: Cell, b: Cell): boolean {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}

export function swapTiles(board: Board, a: Cell, b: Cell): Board | null {
  if (!areAdjacent(a, b)) return null;
  const first = board[a.row]?.[a.col];
  const second = board[b.row]?.[b.col];
  if (!first || !second || first.lockHits || second.lockHits) return null;
  const swapped = board.map((row) => [...row]);
  swapped[a.row]![a.col] = second;
  swapped[b.row]![b.col] = first;
  return swapped;
}

export function hasMatchAfterSwap(board: Board, a: Cell, b: Cell): boolean {
  const swapped = swapTiles(board, a, b);
  return swapped !== null && findMatches(swapped).length > 0;
}
