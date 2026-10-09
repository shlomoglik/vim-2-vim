import { extendRoutes, searchBuffer } from '../fixtures.js';
import type { NavigationDefinition } from '../types.js';

export const definition: NavigationDefinition = {
  title: 'Reverse search',
  instruction: 'Move among matches in both directions.',
  hint: 'N repeats the last search in the opposite direction.',
  createPractice(difficulty) {
    const lines = searchBuffer(difficulty);
    return {
      lines,
      start: { row: 0, col: 0 },
      routes: extendRoutes(['/star\n', 'n', 'N', 'n'], difficulty, i => 'n'),
    };
  },
};
