import type { Position } from '../vim/motion.js';
import { badges, stageBadge, stageIds } from './catalog.js';
import { replayRoutes } from './referenceRoutes.js';
import type { Difficulty, Lesson } from './types.js';

export function routeLesson(index: number, difficulty: Difficulty, lines: string[], start: Position, routes: string[], instruction: string, hint: string, requiredCommands?: readonly string[]): Lesson {
  const { checkpoints, idealKeys, used } = replayRoutes(lines, start, routes, ['h', 'j', 'k', 'l', ...badges], { label: stageIds[index]!, requireMovement: true });
  if (requiredCommands?.some(command => !used.has(command))) throw new Error(`${stageIds[index]}: incomplete reference coverage: ${requiredCommands.filter(command => !used.has(command)).join(', ')}`);
  return { id: stageIds[index]!, title: `${index + 1} · ${stageIds[index] === 'navigator' ? 'Navigator challenge' : 'Navigation review'}`,
    instruction, hint, lines, start, checkpoints, idealKeys, badge: stageBadge(index), referenceRoutes: routes, requiredCommands };
}

