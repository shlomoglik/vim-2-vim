import { extendRoutes, markerBuffer } from '../fixtures.js';
import type { NavigationDefinition } from '../types.js';

export const definition: NavigationDefinition = {
  title: 'File start',
  instruction: 'Return to targets near the top with gg.',
  hint: 'gg jumps to the first line.',
  createPractice(difficulty) {
    const lines = markerBuffer(difficulty);
    return {
      lines,
      start: { row: lines.length - 1, col: 2 },
      routes: extendRoutes(['gg', 'jjj', 'gg', 'jj'], difficulty, i => i % 2 ? 'jj' : 'gg'),
    };
  },
};
