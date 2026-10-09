import { repair, topic } from '../authoring.js';
import type { CourseSection } from '../types.js';

export const visual: CourseSection = {
  id: 'visual', title: 'Visual mode', topics: [
    topic('select-characters', 'Select characters', 'Character selections', [
      repair('v', 'Enter Visual mode, extend the selection, and leave with Esc. Then delete the extra character.', ['caat'], ['cat'], 'vl\x1bx', { row: 0, col: 1 }),
    ], [], ['v', 'Esc']),
    topic('edit-selection', 'Edit a selection', 'Character selections', [
      repair('d', 'Delete the highlighted characters.', ['old new'], [' new'], 'ved'),
      repair('c', 'Change the highlighted characters in Insert mode.', ['old value'], ['new value'], 'vecnew\x1b'),
      repair('y', 'Yank the highlighted characters, then put a copy after them.', ['cat'], ['catcat'], 'vey$p'),
    ], [], ['v', 'd', 'c', 'y']),
    topic('selection-ends', 'Switch selection ends', 'Character selections', [
      repair('o', 'Swap the active end and anchor of a Visual selection.', ['old new'], ['new'], 'velod'),
    ], [], ['v', 'o']),
    topic('select-lines', 'Select lines', 'Line selections', [
      repair('V', 'Select whole lines, leave with Esc, then remove the extra line.', ['remove', 'keep'], ['keep'], 'V\x1bdd'),
    ], [], ['V', 'Esc']),
    topic('edit-selected-lines', 'Edit selected lines', 'Line selections', [
      repair('d', 'Delete every selected line.', ['remove one', 'remove two', 'keep'], ['keep'], 'Vjd'),
      repair('y', 'Yank selected lines and put a copy below.', ['one', 'two'], ['one', 'two', 'one', 'two'], 'VjyGp'),
    ], [], ['V', 'd', 'y']),
    topic('line-selection-ends', 'Switch line selection ends', 'Line selections', [
      repair('o', 'Swap the active end of a line selection before extending it.', ['remove one', 'remove two', 'remove three', 'keep'], ['keep'], 'Vjjod'),
    ], [], ['V', 'o']),
  ],
};
