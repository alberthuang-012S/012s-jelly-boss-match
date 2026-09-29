import type { Board, Tile } from '../types';

/** Gravity operates independently between locked cells, preserving every tile instance. */
export function applyGravity(board: Board): Board {
  const next = board.map((row) => [...row]);
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  for (let col = 0; col < cols; col += 1) {
    let segmentEnd = rows - 1;
    while (segmentEnd >= 0) {
      if (board[segmentEnd]?.[col]?.lockHits) {
        segmentEnd -= 1;
        continue;
      }
      let segmentStart = segmentEnd;
      while (segmentStart >= 0 && !board[segmentStart]?.[col]?.lockHits) segmentStart -= 1;
      const movable: Tile[] = [];
      for (let row = segmentStart + 1; row <= segmentEnd; row += 1) {
        const item = board[row]?.[col];
        if (item) movable.push(item);
      }
      for (let row = segmentEnd; row > segmentStart; row -= 1) next[row]![col] = movable.pop() ?? null;
      segmentEnd = segmentStart - 1;
    }
  }
  return next;
}

export function refillBoard(board: Board, nextTileId: number, makeTile: (id: number) => Tile): { board: Board; nextTileId: number } {
  let id = nextTileId;
  const next = board.map((row) => [...row]);
  for (let row = 0; row < next.length; row += 1) {
    for (let col = 0; col < (next[row]?.length ?? 0); col += 1) {
      if (!next[row]![col]) next[row]![col] = makeTile(id++);
    }
  }
  return { board: next, nextTileId: id };
}
