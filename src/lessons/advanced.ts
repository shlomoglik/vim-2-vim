import { badges, legacyIds } from './catalog.js';
import { advancedDefinitions } from './definitions/navigation.js';
import { replayRoutes } from './referenceRoutes.js';
import type { Difficulty, Lesson } from './types.js';

export function advancedLesson(index: number, difficulty: Difficulty): Lesson {
  const definition = advancedDefinitions[legacyIds[index]!]!;
  const { title: name, instruction, hint } = definition;
  const { lines, start, routes } = definition.createPractice(difficulty);
  const unlocked = ['h', 'j', 'k', 'l', ...badges.slice(0, index)].filter(b => b !== 'Navigator');
  const { checkpoints, idealKeys } = replayRoutes(lines, start, routes, unlocked, { label: legacyIds[index]! });
  return { title: `${index + 1} · ${name}`, instruction, hint, lines, start, checkpoints, idealKeys,
    badge: badges[index - 1]!, referenceRoutes: routes, id: legacyIds[index]! };
}
