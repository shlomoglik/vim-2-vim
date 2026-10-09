import { emptyCommand, interpret } from '../vim/command.js';
import { editKey, newEdit } from '../vim/editing.js';
import { navigationCommands } from './curriculum.js';
import type { CourseExample, DemoState } from './types.js';

export const DEMO_STEP_MS = 700;
export function newDemo(example: CourseExample, index = 0, startedAtMs = 0): DemoState {
  return { index, step: 0, cursor: { ...example.start }, command: emptyCommand(), edit: example.expected ? newEdit(example.lines) : null, message: '', startedAtMs };
}
export function stepDemo(example: CourseExample, demo: DemoState): DemoState {
  const key = example.keys[demo.step];
  if (key === undefined) return demo;
  if (demo.edit) {
    const result = editKey(demo.edit, demo.cursor, key, navigationCommands);
    return { ...demo, step: demo.step + 1, edit: result.edit, cursor: result.cursor, message: result.message };
  }
  const result = interpret(example.lines, demo.cursor, demo.command, key, navigationCommands);
  return { ...demo, step: demo.step + 1, cursor: result.cursor, command: result.state, message: result.message };
}

export function animatedDemo(example: CourseExample, demo: DemoState, nowMs: number): DemoState {
  const cycleSteps = example.keys.length + 2;
  const step = Math.min(example.keys.length, Math.floor(Math.max(0, nowMs - demo.startedAtMs) / DEMO_STEP_MS) % cycleSteps);
  let state = newDemo(example, demo.index, demo.startedAtMs);
  for (let index = 0; index < step; index++) state = stepDemo(example, state);
  return state;
}
