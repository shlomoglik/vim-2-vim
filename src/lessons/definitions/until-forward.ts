import { extendRoutes, findBuffer } from '../fixtures.js';
import type { NavigationDefinition } from '../types.js';

export const definition: NavigationDefinition = {
  title: 'Stop before',
  instruction: 'Stop immediately before a chosen character.',
  hint: 't plus a character lands one column before it.',
  createPractice(difficulty) {
    const lines = findBuffer(difficulty);
    return {
      lines,
      start: { row: 0, col: 0 },
      routes: extendRoutes(['ta', '2ta', 'tb', 'ta'], difficulty, i => i === 0 ? '0ta' : '2ta'),
    };
  },
};
