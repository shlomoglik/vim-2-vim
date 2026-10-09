import { foundationWords } from '../foundationFixtures.js';
import type { Difficulty } from '../types.js';

const routes = ['bl', 'hbbl', 'hbbl', 'hbbl', 'hbbl', 'hbbl', 'hbbl', 'hbbl', 'hbbl', 'hbbl', 'hbbl'];

export const definition = {
  id: 'b' as const, title: 'Jump backward',
  instruction: 'Travel back across lines with b and your other motions.',
  hint: 'From inside a word, b first returns to its start; press b again to go farther back.',
  createPractice(difficulty: Difficulty) {
    const { lines, found, count } = foundationWords(difficulty);
    const start = found[found.length - 1]!;
    const checkpoints = Array.from({ length: count }, (_, i) => ({ row: found[found.length - 2 - i * 2]!.row, col: found[found.length - 2 - i * 2]!.col + 1 }));
    return { lines, start, checkpoints, routes: routes.slice(0, checkpoints.length) };
  },
};
