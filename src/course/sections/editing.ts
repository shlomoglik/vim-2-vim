import { repair, topic } from '../authoring.js';
import type { CourseSection } from '../types.js';

export const editing: CourseSection = {
  id: 'editing', title: 'Editing', topics: [
    topic('small-edits', 'Small edits', 'Characters & words', [
      repair('s', 'Substitute a character and type its replacement.', ['cat'], ['bat'], 'sb\x1b'),
      repair('x', 'Delete the character under the cursor.', ['caat'], ['cat'], 'x', { row: 0, col: 1 }),
      repair('r', 'Replace one character without entering Insert mode.', ['cot'], ['cat'], 'ra', { row: 0, col: 1 }),
    ], ['edit-repair']),
    topic('delete-words', 'Delete words', 'Characters & words', [
      repair('dw', 'Delete up to the next word, including the following space.', ['old value'], ['value'], 'dw'),
      repair('de', 'Delete through the end of the current word.', ['old value'], [' value'], 'de'),
    ]),
    topic('change-words', 'Change words', 'Characters & words', [
      repair('cw', 'Change the current word and keep its trailing space.', ['old value'], ['new value'], 'cwnew\x1b'),
      repair('ce', 'Change through the word end.', ['old value'], ['new value'], 'cenew\x1b'),
    ]),
    topic('edit-lines', 'Delete and change lines', 'Lines', [
      repair('dd', 'Delete the whole current line.', ['remove', 'keep'], ['keep'], 'dd'),
      repair('D', 'Delete from the cursor through the end of the line.', ['keep remove'], ['keep '], 'D', { row: 0, col: 5 }),
      repair('cc', 'Replace the entire line in Insert mode.', ['old line', 'keep'], ['new line', 'keep'], 'ccnew line\x1b'),
      repair('C', 'Change from the cursor through the end of the line.', ['name = old'], ['name = Ada'], 'CAda\x1b', { row: 0, col: 7 }),
    ]),
    topic('delete-multiple-lines', 'Delete multiple lines', 'Lines', [
      repair('dj', 'Delete this line and the line below it.', ['remove one', 'remove two', 'keep'], ['keep'], 'dj'),
      repair('dk', 'Delete this line and the line above it.', ['remove one', 'remove two', 'keep'], ['keep'], 'dk', { row: 1, col: 0 }),
    ]),
    topic('copy-paste', 'Copy and paste lines', 'Lines', [
      repair('yy', 'Yank a line into the register, then put it below with p.', ['alpha', 'beta'], ['alpha', 'alpha', 'beta'], 'yyp'),
      repair('p', 'Put the yanked line below the cursor.', ['alpha', 'beta'], ['alpha', 'beta', 'alpha'], 'yyjp'),
      repair('P', 'Put the yanked line above the cursor.', ['alpha', 'beta'], ['beta', 'alpha', 'beta'], 'jyykP'),
    ]),
    topic('undo-redo', 'Undo and redo', 'Review & repair', [
      repair('u', 'Undo an edit. Here a wrong replacement is undone before repairing it.', ['cot'], ['cat'], 'rzura', { row: 0, col: 1 }),
      repair('Ctrl+R', 'Redo an edit after undoing it.', ['cot'], ['cat'], 'rau\x12', { row: 0, col: 1 }, 'redo'),
    ], ['edit-undo']),
    topic('repair-challenge', 'Repair a file', 'Review & repair', [
      repair(':w', 'Save the repaired buffer with :w and Enter.', ['name = Ad'], ['name = Ada'], '$aa\x1b:w\n'),
    ], ['edit-challenge']),
  ],
};
