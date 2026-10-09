import { repair, topic } from '../authoring.js';
import type { CourseSection } from '../types.js';

const quotes = ['"', "'", '`'];
const brackets = [['(', ')'], ['[', ']'], ['{', '}'], ['<', '>']] as const;
export const textObjects: CourseSection = {
  id: 'text-objects', title: 'Text objects', topics: [
    topic('inside-word', 'Delete inside a word', 'Words', [repair('diw', 'Delete a word from anywhere inside it.', ['one old two'], ['one  two'], 'diw', { row: 0, col: 5 })]),
    topic('inside-WORD', 'Delete inside a WORD', 'Words', [repair('diW', 'Delete a whitespace-separated WORD, including its punctuation.', ['one old.value two'], ['one  two'], 'diW', { row: 0, col: 7 })]),
    topic('around-word', 'Delete around a word', 'Words', [
      repair('daw', 'Delete a word and its surrounding space.', ['one old two'], ['one two'], 'daw', { row: 0, col: 5 }),
      repair('daW', 'Delete a WORD and its surrounding space.', ['one old.value two'], ['one two'], 'daW', { row: 0, col: 7 }),
    ]),
    topic('change-word-object', 'Change inside a word', 'Words', [
      repair('ciw', 'Change a complete word without removing surrounding spaces.', ['one old two'], ['one new two'], 'ciwnew\x1b', { row: 0, col: 5 }),
      repair('ciW', 'Change a complete whitespace-separated WORD.', ['one old.value two'], ['one new two'], 'ciWnew\x1b', { row: 0, col: 7 }),
    ]),
    ...(['di', 'da', 'ci', 'ca'] as const).map(operator => topic(`quotes-${operator}`, `${operator[0] === 'd' ? 'Delete' : 'Change'} ${operator[1] === 'i' ? 'inside' : 'around'} quotes`, 'Quotes', quotes.map((quote, i) => {
      const around = operator[1] === 'a', change = operator[0] === 'c';
      return repair(operator + quote, `${change ? 'Change' : 'Delete'} quoted text ${around ? 'including the quotes' : 'while keeping the quotes'}.`, [`value = ${quote}old${quote}`], [`value = ${around ? '' : quote}${change ? 'new' : ''}${around ? '' : quote}`], operator + quote + (change ? 'new\x1b' : ''), { row: 0, col: 9 }, `quote-${i}`);
    }))),
    ...(['di', 'da', 'ci', 'ca'] as const).map(operator => topic(`brackets-${operator}`, `${operator[0] === 'd' ? 'Delete' : 'Change'} ${operator[1] === 'i' ? 'inside' : 'around'} brackets`, 'Brackets', brackets.map(([open, close], i) => {
      const around = operator[1] === 'a', change = operator[0] === 'c';
      return repair(operator + open, `${change ? 'Change' : 'Delete'} enclosed text ${around ? 'including its brackets' : 'while keeping its brackets'}.`, [`value = ${open}old${close}`], [`value = ${around ? '' : open}${change ? 'new' : ''}${around ? '' : close}`], operator + open + (change ? 'new\x1b' : ''), { row: 0, col: 9 }, `bracket-${i}`);
    }))),
    topic('paragraph-objects', 'Delete paragraphs', 'Paragraphs', [
      repair('dip', 'Delete the paragraph while keeping its following blank line.', ['old paragraph', 'old line', '', 'keep'], ['', 'keep'], 'dip'),
      repair('dap', 'Delete the paragraph and its following blank lines.', ['old paragraph', 'old line', '', 'keep'], ['keep'], 'dap'),
    ]),
  ],
};
