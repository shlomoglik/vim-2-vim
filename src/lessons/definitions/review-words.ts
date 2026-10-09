import { routeLesson } from '../routeLesson.js';
import type { Difficulty } from '../types.js';

export function createLesson(index: number, difficulty: Difficulty) {
  return routeLesson(index, difficulty,
    ['  alpha beta gamma', '  delta epsilon zeta', '  eta theta iota', '  kappa lambda mu'], { row: 0, col: 2 },
    ['w', 'e', 'b', 'jw', ...(difficulty === 'easy' ? [] : difficulty === 'normal' ? ['k', 'j'] : ['k', 'j', 'k', 'j'])], 'Travel through this note with word motions and line jumps.', 'Use w, b, e and the four directions.');
}
