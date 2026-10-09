import { navigationBadges } from '../catalog.js';
import { routeLesson } from '../routeLesson.js';
import type { Difficulty } from '../types.js';

export function createLesson(index: number, difficulty: Difficulty) {
  const lines = Array.from({ length: 10 }, (_, i) => `  (alpha [beta {gamma} delta] omega) star moon star a x a x a ${i}`);
  const routes = ['w', 'b', 'e', '0', '$', '^', 'G', 'gg', '3j', 'fa', 'fa', ';', ',', 'Fa', 'ta', 'Ta', '/star\n', '?moon\n', 'n', 'N', '0%',
    ...(difficulty === 'easy' ? [] : difficulty === 'normal' ? ['G', 'gg'] : ['G', 'gg', '4j', 'G'])];
  return routeLesson(index, difficulty, lines, { row: 0, col: 2 }, routes,
    'Use every earned command while tracing this file. The remaining commands are shown below.',
    'Use every badge: word, line, find, search, count and matching pair.', navigationBadges);
}

