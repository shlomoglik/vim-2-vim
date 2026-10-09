import { extendRoutes, markerBuffer } from '../fixtures.js';
import type { NavigationDefinition } from '../types.js';

export const definition: NavigationDefinition = {
  title: 'Measured jumps',
  instruction: 'Cross measured line distances with count prefixes.',
  hint: 'Type a number before a motion, such as 3j or 4G.',
  createPractice(difficulty) {
    const lines = markerBuffer(difficulty);
    return {
      lines,
      start: { row: 0, col: 2 },
      routes: extendRoutes(['3j', '2j', '4k', `${lines.length}G`], difficulty, i => i % 2 ? '2j' : '2k'),
    };
  },
};
