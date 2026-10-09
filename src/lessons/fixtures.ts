import type { Difficulty } from './types.js';

export const ADVANCED_LINE_COUNTS: Record<Difficulty, number> = { easy: 5, normal: 7, hard: 10 };
export const EXTRA_ROUTE_COUNTS: Record<Difficulty, number> = { easy: 0, normal: 1, hard: 2 };
const ASCII_UPPERCASE_A = 65;

export function markerBuffer(difficulty: Difficulty): string[] {
  return Array.from({ length: ADVANCED_LINE_COUNTS[difficulty] }, (_, i) =>
    `  marker ${i + 1}    trail ${String.fromCharCode(ASCII_UPPERCASE_A + i)}`);
}
export function findBuffer(difficulty: Difficulty): string[] {
  const distractors = { easy: '', normal: ' a x', hard: ' a x a x' }[difficulty];
  return Array.from({ length: ADVANCED_LINE_COUNTS[difficulty] }, (_, i) =>
    i === 0 ? `x a x a x b x a x a x a x${distractors}` : `  marker ${i + 1}   a b a`);
}
export function searchBuffer(difficulty: Difficulty): string[] {
  return Array.from({ length: ADVANCED_LINE_COUNTS[difficulty] }, (_, i) => `orbit ${i + 1} star moon star trail`);
}
export function pairBuffer(difficulty: Difficulty): string[] {
  return ['(alpha [beta {gamma} delta] omega)',
    ...Array.from({ length: ADVANCED_LINE_COUNTS[difficulty] - 2 }, (_, i) => `  trail ${i + 1} (star)`),
    '{last [turn] here}'];
}
export function extendRoutes(routes: readonly string[], difficulty: Difficulty, extra: (index: number) => string): string[] {
  return [...routes, ...Array.from({ length: EXTRA_ROUTE_COUNTS[difficulty] }, (_, i) => extra(i))];
}
