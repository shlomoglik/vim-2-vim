import { routeLesson } from '../routeLesson.js';
import type { Difficulty } from '../types.js';

export function createLesson(index: number, difficulty: Difficulty) {
  const extra = difficulty === 'easy' ? [] : difficulty === 'normal' ? ['G', 'gg'] : ['G', 'gg', '3j', 'gg'];
  return routeLesson(index, difficulty,
    ['a x a x a x a x a x a x a', '  find a mark then return', '  verify a mark again', '  close a mark here'], { row: 0, col: 0 },
    ['fa', ';', ',', 'ta', '0$Fa', 'Fa', 'Ta', ...extra], 'Trace repeated markers in this code line.', 'f and t find ahead; F and T find behind. ; repeats and , reverses.');
}
