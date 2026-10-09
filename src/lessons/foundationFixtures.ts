import type { Position } from '../vim/motion.js';
import type { Difficulty } from './types.js';

const wordLines = [
  'calm wind rain glow',
  'warm blue star path',
  'rock leaf moon tide',
  'hope pace line jump',
  'seek find word home',
  'step move back done',
];
const FOUNDATION_LINE_COUNTS: Record<Difficulty, number> = { easy: 4, normal: 5, hard: 6 };
const FOUNDATION_WORD_COUNTS: Record<Difficulty, number> = { easy: 7, normal: 9, hard: 11 };
function words(lines: readonly string[]): Position[] {
  return lines.flatMap((line, row) => Array.from(line.matchAll(/[A-Za-z0-9_]+/g), match => ({ row, col: match.index })));
}


export function foundationWords(difficulty: Difficulty) {
  const lines = wordLines.slice(0, FOUNDATION_LINE_COUNTS[difficulty]);
  return { lines, found: words(lines), count: FOUNDATION_WORD_COUNTS[difficulty] };
}
