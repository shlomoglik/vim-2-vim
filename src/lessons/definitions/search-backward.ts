import { extendRoutes, searchBuffer } from '../fixtures.js';
import type { NavigationDefinition } from '../types.js';

export const definition: NavigationDefinition = {
  title: 'Search backward',
  instruction: 'Find earlier literal matches across lines.',
  hint: 'Type ?word then Enter. Search wraps at the top.',
  createPractice(difficulty) {
    const lines = searchBuffer(difficulty);
    return {
      lines,
      start: { row: lines.length - 1, col: 0 },
      routes: extendRoutes(['?star\n', '?moon\n', '?star\n', '?moon\n'], difficulty, i => '?star\n'),
    };
  },
};
