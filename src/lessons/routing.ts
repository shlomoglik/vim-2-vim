import { move, type Motion, type Position } from '../vim/motion.js';

const id = (pos: Position) => `${pos.row}:${pos.col}`;

/** Shortest route using only motions unlocked for this run. */
export function shortestRoute(lines: readonly string[], start: Position, goal: Position, motions: readonly Motion[]): Motion[] {
  const queue: Array<{ at: Position; path: Motion[] }> = [{ at: start, path: [] }];
  const seen = new Set([id(start)]);
  for (let head = 0; head < queue.length; head++) {
    const { at, path } = queue[head]!;
    if (id(at) === id(goal)) return path;
    for (const motion of motions) {
      const next = move(lines, at, motion);
      const key = id(next);
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push({ at: next, path: [...path, motion] });
    }
  }
  throw new Error(`Unreachable lesson target ${id(goal)}`);
}

