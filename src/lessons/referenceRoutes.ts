import { emptyCommand, interpret } from '../vim/command.js';
import type { Position } from '../vim/motion.js';

type ReplayOptions = {
  label: string;
  expectedCheckpoints?: readonly Position[];
  requireMovement?: boolean;
  allowPending?: boolean;
};

/** Reference routes use the same interpreter as player input, including remembered searches. */
export function replayRoutes(
  lines: readonly string[], start: Position, routes: readonly string[],
  unlocked: readonly string[], options: ReplayOptions,
): { checkpoints: Position[]; idealKeys: number[]; used: Set<string> } {
  let cursor = start;
  let state = emptyCommand();
  const checkpoints: Position[] = [];
  const idealKeys: number[] = [];
  const used = new Set<string>();
  for (const [step, route] of routes.entries()) {
    const before = cursor;
    for (const key of route) {
      const result = interpret(lines, cursor, state, key, unlocked);
      if (result.message) throw new Error(`${options.label}: ${route}: ${result.message}`);
      if (result.executed) used.add(result.executed);
      cursor = result.cursor;
      state = result.state;
    }
    if (!options.allowPending && state.pending) throw new Error(`${options.label}: incomplete reference route ${route}`);
    if (options.requireMovement && cursor.row === before.row && cursor.col === before.col) throw new Error(`${options.label}: motionless route ${route}`);
    const expected = options.expectedCheckpoints?.[step];
    if (expected && (cursor.row !== expected.row || cursor.col !== expected.col)) throw new Error(`${options.label}: reference route missed target ${step + 1}`);
    checkpoints.push(cursor);
    idealKeys.push(route.length);
  }
  return { checkpoints, idealKeys, used };
}
