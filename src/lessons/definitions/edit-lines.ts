import type { EditingDefinition } from '../types.js';

export const definition: EditingDefinition = {
  lines: ['  title = Vim', '  status = ready'],
  expected: ['# practice', '  title = Vim lab', '  status = ready', '  done'],
  instruction: 'Make the file match the green target, one line at a time, then save. Try I/A for line edges and O/o for new lines.',
  hint: 'I/A edit line edges; O/o open a line above/below. Use dd to remove an extra line.',
};
