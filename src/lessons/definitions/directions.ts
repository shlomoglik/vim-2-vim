import type { Position } from '../../vim/motion.js';
import type { Difficulty } from '../types.js';

const movementLines = [
  'start move across map',
  'step right then down',
  'left turn near exit',
  'follow winding road',
  'climb back to ridge',
  'final motion waits',
];
const movementStops: Position[] = [
  { row: 0, col: 4 }, { row: 1, col: 4 }, { row: 1, col: 15 },
  { row: 2, col: 15 }, { row: 2, col: 3 }, { row: 1, col: 3 },
  { row: 3, col: 3 }, { row: 3, col: 16 }, { row: 4, col: 16 },
  { row: 4, col: 5 }, { row: 3, col: 5 }, { row: 5, col: 5 },
];
const LINE_COUNTS: Record<Difficulty, number> = { easy: 4, normal: 5, hard: 6 };
const CHECKPOINT_COUNTS: Record<Difficulty, number> = { easy: 8, normal: 10, hard: 12 };

const routes = ['llll', 'j', 'lllllllllll', 'j', 'hhhhhhhhhhhh', 'k', 'jj', 'lllllllllllll', 'j', 'hhhhhhhhhhh', 'k', 'jj'];

export const definition = {
  id: 'directions' as const, title: 'Four directions',
  instruction: 'Find every green target with h, j, k and l.',
  hint: 'h moves left, j down, k up, and l right. You can use any unlocked motion.',
  createPractice(difficulty: Difficulty) {
    const checkpoints = movementStops.slice(0, CHECKPOINT_COUNTS[difficulty]);
    return { lines: movementLines.slice(0, LINE_COUNTS[difficulty]), start: { row: 0, col: 0 },
      checkpoints, routes: routes.slice(0, checkpoints.length) };
  },
};
