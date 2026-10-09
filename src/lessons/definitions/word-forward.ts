import { foundationWords } from '../foundationFixtures.js';
import type { Difficulty } from '../types.js';

const routes = ['wl', 'wwl', 'wwl', 'wwl', 'wwl', 'wwl', 'wwl', 'wwl', 'wwl', 'wwl', 'wwl'];

export const definition = {
  id: 'w' as const, title: 'Jump forward',
  instruction: 'Cross lines and combine w with character motions.',
  hint: 'w lands at the next word start. Use l to reach a character inside it.',
  createPractice(difficulty: Difficulty) {
    const { lines, found, count } = foundationWords(difficulty);
    const start = found[0]!;
    const checkpoints = Array.from({ length: count }, (_, i) => ({ row: found[1 + i * 2]!.row, col: found[1 + i * 2]!.col + 1 }));
    return { lines, start, checkpoints, routes: routes.slice(0, checkpoints.length) };
  },
};
