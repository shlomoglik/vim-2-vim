import type { EditingDefinition } from '../types.js';

export const definition: EditingDefinition = {
  lines: ['  value = wrong', '  status = pending'],
  expected: ['  value = right', '  status = done'],
  instruction: 'Repair the two values, use undo and Ctrl-R to inspect your edits, then save.',
  hint: 'u undoes one edit; Ctrl-R redoes it.',
};
