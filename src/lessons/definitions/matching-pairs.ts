import { extendRoutes, pairBuffer } from '../fixtures.js';
import type { NavigationDefinition } from '../types.js';

export const definition: NavigationDefinition = {
  title: 'Matching pairs',
  instruction: 'Cross nested (), [], and {} pairs.',
  hint: '% jumps between matching delimiters.',
  createPractice(difficulty) {
    const lines = pairBuffer(difficulty);
    return {
      lines,
      start: { row: 0, col: 0 },
      routes: extendRoutes(['%', 'F[', '%', 'F{', '%', 'G%'], difficulty, i => '%'),
    };
  },
};
