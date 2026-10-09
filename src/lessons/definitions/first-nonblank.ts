import { extendRoutes, markerBuffer } from '../fixtures.js';
import type { NavigationDefinition } from '../types.js';

export const definition: NavigationDefinition = {
  title: 'First visible character',
  instruction: 'Navigate indentation with ^.',
  hint: '^ skips spaces and lands on the first visible character.',
  createPractice(difficulty) {
    const lines = markerBuffer(difficulty);
    return {
      lines,
      start: { row: 0, col: lines[0]!.indexOf('trail') || 0 },
      routes: extendRoutes(['j^', 'j^', 'k^', 'j^'], difficulty, i => 'j^'),
    };
  },
};
