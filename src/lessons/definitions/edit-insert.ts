import type { EditingDefinition } from '../types.js';

export const definition: EditingDefinition = {
  lines: ['  name = Ada', '  role = coder'],
  expected: ['  name = Ada Lovelace', '  role = coder'],
  instruction: 'Press i, then Escape. Press $ to reach the last a in Ada. Press a, type " Lovelace" (with a leading space), Escape, then :w and Enter.',
  hint: 'i inserts before the cursor; a inserts after it. The target line is "  name = Ada Lovelace".',
};
