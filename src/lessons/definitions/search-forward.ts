import { extendRoutes, searchBuffer } from '../fixtures.js';
import type { NavigationDefinition } from '../types.js';

export const definition: NavigationDefinition = {
  title: 'Search forward',
  instruction: 'Find a literal word across lines.',
  hint: 'Type /word then Enter. Search wraps at the end.',
  createPractice(difficulty) {
    const lines = searchBuffer(difficulty);
    return {
      lines,
      start: { row: 0, col: 0 },
      routes: extendRoutes(['/star\n', '/moon\n', '/star\n', '/moon\n'], difficulty, i => '/star\n'),
    };
  },
};
