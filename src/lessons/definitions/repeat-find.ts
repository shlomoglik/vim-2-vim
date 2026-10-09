import { extendRoutes, findBuffer } from '../fixtures.js';
import type { NavigationDefinition } from '../types.js';

export const definition: NavigationDefinition = {
  title: 'Repeat character find',
  instruction: 'Traverse repeated characters with ;.',
  hint: '; repeats the latest f, F, t, or T direction.',
  createPractice(difficulty) {
    const lines = findBuffer(difficulty);
    return {
      lines,
      start: { row: 0, col: 0 },
      routes: extendRoutes(['fa', ';', ';', ';'], difficulty, i => i === 0 ? ';' : '0fa'),
    };
  },
};
