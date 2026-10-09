import { routeLesson } from '../routeLesson.js';
import type { Difficulty } from '../types.js';

export function createLesson(index: number, difficulty: Difficulty) {
  const extra = difficulty === 'easy' ? [] : difficulty === 'normal' ? ['G', 'gg'] : ['G', 'gg', '3j', 'gg'];
  return routeLesson(index, difficulty,
    Array.from({ length: 10 }, (_, i) => `  task ${i + 1} = ready;`), { row: 0, col: 2 },
    ['3j', '$', 'gg', 'G', '2k', '$', ...extra], 'Inspect distant task lines using measured jumps.', 'Use counts with j or k, and gg or G for file edges.');
}
