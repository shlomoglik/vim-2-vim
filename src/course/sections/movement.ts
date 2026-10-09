import { motion, topic } from '../authoring.js';
import type { CourseSection } from '../types.js';

const words = ['calm wind rain', 'blue star moon'];
const punctuation = ['one.two three-four five', 'six.seven eight-nine ten'];
const findLine = ['x a x a x a x'];
const rows = Array.from({ length: 25 }, (_, i) => `  task ${i + 1} = ready`);
const search = ['star moon star', 'moon starlight star'];

export const movement: CourseSection = {
  id: 'movement', title: 'Movement', topics: [
    topic('basic-movement', 'Basic movement', 'Basic & word movement', [
      motion('h', 'Move one character left.', words, { row: 0, col: 2 }),
      motion('j', 'Move one line down.', words, { row: 0, col: 2 }),
      motion('k', 'Move one line up.', words, { row: 1, col: 2 }),
      motion('l', 'Move one character right.', words, { row: 0, col: 2 }),
    ], ['directions']),
    topic('word-movement', 'Move by words', 'Basic & word movement', [
      motion('w', 'Jump to the next word start. Punctuation forms separate words.', punctuation, { row: 0, col: 0 }),
      motion('e', 'Jump to the end of a word.', punctuation, { row: 0, col: 0 }),
      motion('b', 'Jump to the previous word start.', punctuation, { row: 0, col: 8 }),
    ], ['w', 'e', 'b', 'review-words']),
    topic('WORD-movement', 'Move by WORDS', 'Basic & word movement', [
      motion('W', 'Jump to the next whitespace-separated WORD. one.two is one WORD.', punctuation, { row: 0, col: 0 }),
      motion('E', 'Jump to the end of a whitespace-separated WORD.', punctuation, { row: 0, col: 0 }),
      motion('B', 'Jump to the previous whitespace-separated WORD.', punctuation, { row: 0, col: 10 }),
    ]),
    topic('line-ends', 'Move to line ends', 'Within a line', [
      motion('0', 'Jump to column one, including indentation.', ['  calm wind rain'], { row: 0, col: 7 }),
      motion('_', 'Jump to the first nonblank character. A count chooses a later line.', rows, { row: 0, col: 7 }),
      motion('$', 'Jump to the last character on the line.', words, { row: 0, col: 0 }),
      motion('^', 'Jump past indentation to the first nonblank character.', rows, { row: 0, col: 7 }),
    ], ['0', 'dollar', 'caret']),
    topic('character-find', 'Find a character', 'Within a line', [
      motion('f', 'Type f and a character to find it ahead.', findLine, { row: 0, col: 0 }, 'fa'),
      motion('F', 'Type F and a character to find it behind.', findLine, { row: 0, col: 12 }, 'Fa'),
      motion(';', 'Repeat the most recent character find in its original direction.', findLine, { row: 0, col: 0 }, 'fa;'),
      motion(',', 'Repeat the most recent character find in reverse.', findLine, { row: 0, col: 0 }, 'fa;,'),
    ], ['f', 'F', 'semicolon', 'comma', 'review-finds']),
    topic('character-till', 'Till a character', 'Within a line', [
      motion('t', 'Stop just before a character ahead.', findLine, { row: 0, col: 0 }, 'ta'),
      motion('T', 'Stop just after a character behind.', findLine, { row: 0, col: 12 }, 'Ta'),
      motion(';', 'Repeat till; skip the adjacent match you just stopped before.', findLine, { row: 0, col: 0 }, 'ta;'),
    ], ['t', 'T']),
    topic('relative-jumps', 'Relative line jumps', 'Vertical movement', [
      motion('3j', 'Move three lines down using a count.', rows, { row: 0, col: 2 }),
      motion('3k', 'Move three lines up using a count.', rows, { row: 6, col: 2 }),
    ], ['counts', 'review-lines']),
    topic('absolute-jumps', 'Absolute line jumps', 'Vertical movement', [
      motion('gg', 'Jump to the first line.', rows, { row: 6, col: 2 }),
      motion('G', 'Jump to the last line.', rows, { row: 0, col: 2 }),
      motion('12G', 'Jump to line twelve with a count.', rows, { row: 0, col: 2 }),
    ], ['gg', 'G']),
    topic('paragraphs', 'Move by paragraphs', 'Vertical movement', [
      motion('}', 'Move forward to the paragraph boundary.', ['first paragraph', 'still first', '', 'second paragraph', '', 'third'], { row: 0, col: 0 }),
      motion('{', 'Move backward to the paragraph boundary.', ['first paragraph', '', 'second paragraph', 'still second', '', 'third'], { row: 3, col: 0 }),
    ]),
    topic('half-page', 'Half-page movement', 'Vertical movement', [
      motion('Ctrl+d', 'Move half a practice page down (ten rows).', rows, { row: 0, col: 2 }, '\x04'),
      motion('Ctrl+u', 'Move half a practice page up (ten rows).', rows, { row: 20, col: 2 }, '\x15'),
    ]),
    topic('literal-search', 'Search and repeat', 'Search & matching', [
      motion('/', 'Search forward for literal text, then press Enter.', search, { row: 0, col: 0 }, '/moon\n'),
      motion('?', 'Search backward for literal text, then press Enter.', search, { row: 1, col: 5 }, '?moon\n'),
      motion('n', 'Repeat the search in the same direction.', search, { row: 0, col: 0 }, '/moon\nn'),
      motion('N', 'Repeat the search in the opposite direction.', search, { row: 0, col: 0 }, '/moon\nnN'),
    ], ['search-forward', 'search-backward', 'n', 'N', 'review-search']),
    topic('word-search', 'Search the word under cursor', 'Search & matching', [
      motion('*', 'Search forward for the complete word under the cursor.', search, { row: 0, col: 0 }),
      motion('#', 'Search backward for the complete word under the cursor.', search, { row: 1, col: 15 }),
    ]),
    topic('matching-pairs', 'Matching pairs', 'Search & matching', [
      motion('%', 'Jump between matching parentheses, brackets, or braces.', ['(one [two {three}])'], { row: 0, col: 0 }),
    ], ['percent', 'navigator']),
  ],
};
