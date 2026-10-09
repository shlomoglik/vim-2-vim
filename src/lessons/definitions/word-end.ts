import { foundationWords } from '../foundationFixtures.js';
import type { Difficulty } from '../types.js';

const routes = ['we', 'ee', 'ee', 'ee', 'ee', 'ee', 'ee', 'ee', 'ee', 'ee', 'ee'];

export const definition = {
  id: 'e' as const, title: 'Land on the end', hubTitle: 'Word end',
  instruction: 'Use e with your earned motions to reach word ends.',
  hint: 'e lands on the end of the current or next word. You can combine it with w, b and character motions.',
  createPractice(difficulty: Difficulty) {
    const { lines, found, count } = foundationWords(difficulty);
    const start = found[0]!;
    const checkpoints = Array.from({ length: count }, (_, i) => {
      const word = found[1 + i * 2]!;
      return { row: word.row, col: word.col + lines[word.row]!.slice(word.col).match(/^[A-Za-z0-9_]+/)![0].length - 1 };
    });
    return { lines, start, checkpoints, routes: routes.slice(0, checkpoints.length) };
  },
};
