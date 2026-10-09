import { extendRoutes, markerBuffer } from '../fixtures.js';
import type { NavigationDefinition } from '../types.js';

export const definition: NavigationDefinition = {
  title: 'Line end',
  instruction: 'Use $ to reach the end of each line, then change lines.',
  hint: '$ lands on the last character of the current line.',
  createPractice(difficulty) {
    const lines = markerBuffer(difficulty);
    return {
      lines,
      start: { row: 0, col: 2 },
      routes: extendRoutes(['j$', 'j$', 'k$', 'j$'], difficulty, i => 'j$'),
    };
  },
};
