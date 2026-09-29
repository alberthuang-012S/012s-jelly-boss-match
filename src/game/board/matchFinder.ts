import type { Board, Cell } from '../types';
import { GAME_CONFIG } from '../config/gameConfig';

/** Scans complete horizontal and vertical runs, then unions their cells by tile instance. */
export function findMatches(board: Board): Cell[] {
  const found = new Map<string, Cell>();
  const addRun = (run: Cell[]) => {
    if (run.length < 3) return;
    for (const cell of run) {
      const tile = board[cell.row]?.[cell.col];
      if (tile) found.set(tile.id, cell);
    }
  };

  for (let row = 0; row < board.length; row += 1) {
    let run: Cell[] = [];
    for (let col = 0; col <= GAME_CONFIG.columns; col += 1) {
      const tile = board[row]?.[col] ?? null;
      const previous = run.length ? board[row]?.[run[run.length - 1]!.col] : null;
      if (tile && !tile.lockHits && previous?.color === tile.color) run.push({ row, col });
      else {
        addRun(run);
        run = tile && !tile.lockHits ? [{ row, col }] : [];
      }
    }
  }

  for (let col = 0; col < GAME_CONFIG.columns; col += 1) {
    let run: Cell[] = [];
    for (let row = 0; row <= board.length; row += 1) {
      const tile = board[row]?.[col] ?? null;
      const previous = run.length ? board[run[run.length - 1]!.row]?.[col] : null;
      if (tile && !tile.lockHits && previous?.color === tile.color) run.push({ row, col });
      else {
        addRun(run);
        run = tile && !tile.lockHits ? [{ row, col }] : [];
      }
    }
  }

  return [...found.values()].sort((a, b) => a.row - b.row || a.col - b.col);
}

export function cellKey(cell: Cell): string { return `${cell.row},${cell.col}`; }
