import type { Motion } from '../vim/motion.js';
import { badges, legacyIds } from './catalog.js';
import { foundationDefinitions } from './definitions/navigation.js';
import { replayRoutes } from './referenceRoutes.js';
import type { Difficulty, Lesson } from './types.js';

export const isFoundationLesson = (id: string) => foundationDefinitions.some(definition => definition.id === id);

export function foundationalLesson(index: number, difficulty: Difficulty, unlocked: readonly Motion[]): Lesson {
  const definition = foundationDefinitions.find(definition => definition.id === legacyIds[index]);
  if (!definition) throw new RangeError(`Unknown foundational lesson ${index}`);
  const { lines, start, checkpoints, routes: referenceRoutes } = definition.createPractice(difficulty);
  const { idealKeys } = replayRoutes(lines, start, referenceRoutes, unlocked, {
    label: definition.id, expectedCheckpoints: checkpoints, allowPending: true,
  });
  return { title: `${index + 1} · ${definition.title}`, instruction: definition.instruction, hint: definition.hint,
    lines, start, checkpoints, idealKeys, badge: index ? badges[index - 1]! : null, referenceRoutes, id: definition.id };
}
