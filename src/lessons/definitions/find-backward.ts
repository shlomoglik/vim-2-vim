import { extendRoutes, findBuffer } from '../fixtures.js';
import type { NavigationDefinition } from '../types.js';

export const definition: NavigationDefinition = {
  title: 'Find backward',
  instruction: 'Find characters behind the cursor.',
  hint: 'F plus a character searches left on the current line.',
  createPractice(difficulty) {
    const lines = findBuffer(difficulty);
    return {
      lines,
      start: { row: 0, col: 20 },
      routes: extendRoutes(['Fa', 'Fa', 'Fb', 'Fa'], difficulty, i => i === 0 ? '0$Fa' : 'Fa'),
    };
  },
};
