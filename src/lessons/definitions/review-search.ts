import { routeLesson } from '../routeLesson.js';
import type { Difficulty } from '../types.js';

export function createLesson(index: number, difficulty: Difficulty) {
  const extra = difficulty === 'easy' ? [] : difficulty === 'normal' ? ['G', 'gg'] : ['G', 'gg', '3j', 'gg'];
  return routeLesson(index, difficulty,
    ['  star = open', '  moon = wait', '  star = ready', '  moon = done', '  star = close'], { row: 0, col: 2 },
    ['/moon\n', 'n', 'N', '?star\n', 'n', 'N', ...extra], 'Inspect repeated states across the file.', 'Search with / or ?, then use n and N.');
}
