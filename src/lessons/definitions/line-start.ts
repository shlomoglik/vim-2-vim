import { foundationWords } from '../foundationFixtures.js';
import type { Difficulty } from '../types.js';

const routes = {
  easy: ['w', 'jjbe', 'w', 'kkbe', 'w', 'jjbe', 'w'],
  normal: ['w', 'jjbe', 'w', 'jbje', 'kkkk0', 'jjbe', 'w', 'jjbe', 'w'],
  hard: ['w', 'jjbe', 'w', 'jjbe', 'w', 'kkkkbe', 'w', 'jjbe', 'w', 'jjbe', 'w'],
};

export const definition = {
  id: '0' as const, title: 'Return to column zero', hubTitle: 'Line start',
  instruction: 'Cross lines between their first and last characters.',
  hint: '0 jumps to the first column. Use your other motions to reach each line end.',
  createPractice(difficulty: Difficulty) {
    const { lines, found, count } = foundationWords(difficulty);
    const start = { row: 0, col: lines[0]!.length - 1 };
    const checkpoints = Array.from({ length: count }, (_, i) => {
      const row = (i + 1) % lines.length;
      return { row, col: i % 2 === 0 ? 0 : lines[row]!.length - 1 };
    });
    return { lines, start, checkpoints, routes: routes[difficulty] };
  },
};
