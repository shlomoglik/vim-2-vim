import { repair, topic } from '../authoring.js';
import type { CourseSection } from '../types.js';

export const insertion: CourseSection = {
  id: 'insertion', title: 'Insertion', topics: [
    topic('insert-append', 'Insert and append', 'Insert & append', [
      repair('i', 'Insert before the cursor, then return to Normal mode with Esc.', ['da'], ['Ada'], 'iA\x1b'),
      repair('a', 'Append after the cursor, then return to Normal mode with Esc.', ['Ad'], ['Ada'], 'aa\x1b', { row: 0, col: 1 }),
      repair('Esc', 'Leave Insert mode before issuing more Vim commands.', ['Ad'], ['Ada'], 'aa\x1b', { row: 0, col: 1 }, 'escape'),
    ], ['edit-insert']),
    topic('insert-line-ends', 'Insert at line ends', 'Insert & append', [
      repair('I', 'Insert before the first nonblank character.', ['  name = Ada'], ['  # name = Ada'], 'I# \x1b', { row: 0, col: 7 }),
      repair('A', 'Append at the very end of the current line.', ['  name = Ada'], ['  name = Ada Lovelace'], 'A Lovelace\x1b', { row: 0, col: 7 }),
    ], [], ['I', 'A', 'Esc']),
    topic('open-lines', 'Open new lines', 'Insert & append', [
      repair('o', 'Open a new line below and enter Insert mode.', ['first', 'last'], ['first', 'middle', 'last'], 'omiddle\x1b'),
      repair('O', 'Open a new line above and enter Insert mode.', ['last'], ['first', 'last'], 'Ofirst\x1b'),
    ], ['edit-lines']),
  ],
};
