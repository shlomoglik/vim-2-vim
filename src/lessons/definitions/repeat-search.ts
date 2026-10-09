import { extendRoutes, searchBuffer } from '../fixtures.js';
import type { NavigationDefinition } from '../types.js';

export const definition: NavigationDefinition = {
  title: 'Repeat search',
  instruction: 'Visit successive matches with n.',
  hint: 'n repeats the last search direction and query.',
  createPractice(difficulty) {
    const lines = searchBuffer(difficulty);
    return {
      lines,
      start: { row: 0, col: 0 },
      routes: extendRoutes(['/star\n', 'n', 'n', 'n'], difficulty, i => 'n'),
    };
  },
};
