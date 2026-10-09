import { extendRoutes, findBuffer } from '../fixtures.js';
import type { NavigationDefinition } from '../types.js';

export const definition: NavigationDefinition = {
  title: 'Reverse character find',
  instruction: 'Traverse repeated characters in both directions.',
  hint: ', repeats the latest find in the opposite direction.',
  createPractice(difficulty) {
    const lines = findBuffer(difficulty);
    return {
      lines,
      start: { row: 0, col: 0 },
      routes: extendRoutes(['fa', ';', ',', ';'], difficulty, i => i === 0 ? ';' : '0fa'),
    };
  },
};
