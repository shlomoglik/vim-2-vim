import { extendRoutes, findBuffer } from '../fixtures.js';
import type { NavigationDefinition } from '../types.js';

export const definition: NavigationDefinition = {
  title: 'Stop after',
  instruction: 'Stop immediately after a character behind you.',
  hint: 'T plus a character lands one column after it.',
  createPractice(difficulty) {
    const lines = findBuffer(difficulty);
    return {
      lines,
      start: { row: 0, col: 20 },
      routes: extendRoutes(['Ta', '2Ta', 'Tb', 'Ta'], difficulty, i => i === 0 ? '0$Ta' : '2Ta'),
    };
  },
};
