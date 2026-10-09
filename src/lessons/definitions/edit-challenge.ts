import type { EditingDefinition } from '../types.js';

export const definition: EditingDefinition = {
  lines: ['  (task) = opn', '  owner = Ad', '  result = fail'],
  expected: ['  (task) = open', '  owner = Ada', '  result = pass'],
  instruction: 'Navigate, repair the file, then save it with :w.',
  hint: 'Use searches or finds to reach errors; the saved file must match the target.',
};
