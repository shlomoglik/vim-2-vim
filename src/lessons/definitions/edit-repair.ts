import type { EditingDefinition } from '../types.js';

export const definition: EditingDefinition = {
  lines: ['  spell = vmm', '  state = redy', '  mode = old'],
  expected: ['  spell = vim', '  state = ready', '  mode = new'],
  instruction: 'Travel to each typo. Repair with x, r, or s, then save.',
  hint: 'x deletes; r replaces one character; s substitutes and enters insert mode.',
};
