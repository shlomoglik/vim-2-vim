import { extendRoutes, markerBuffer } from '../fixtures.js';
import type { NavigationDefinition } from '../types.js';

export const definition: NavigationDefinition = {
  title: 'File end',
  instruction: 'Alternate between distant top and bottom targets.',
  hint: 'G jumps to the final line; gg returns to the first.',
  createPractice(difficulty) {
    const lines = markerBuffer(difficulty);
    return {
      lines,
      start: { row: 0, col: 2 },
      routes: extendRoutes(['G', 'gg', 'G', 'gg'], difficulty, i => i % 2 ? 'gg' : 'G'),
    };
  },
};
