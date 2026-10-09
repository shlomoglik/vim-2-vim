import { extendRoutes, findBuffer } from '../fixtures.js';
import type { NavigationDefinition } from '../types.js';

export const definition: NavigationDefinition = {
  title: 'Find forward',
  instruction: 'Find a chosen character among repeated characters.',
  hint: 'f plus a character lands on its next occurrence.',
  createPractice(difficulty) {
    const lines = findBuffer(difficulty);
    return {
      lines,
      start: { row: 0, col: 0 },
      routes: extendRoutes(['fa', 'fa', 'fb', 'fa'], difficulty, i => i === 0 ? '0fa' : 'fa'),
    };
  },
};
