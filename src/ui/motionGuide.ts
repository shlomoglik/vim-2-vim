import { emptyCommand, interpret } from '../vim/command.js';
import type { Position } from '../vim/motion.js';
import { GUIDE_COMMAND_MS, GUIDE_CYCLE_MS, GUIDE_MOVE_MS } from './constants.js';

export type MotionGuide = {
  key: string;
  sequence: string;
  title: string;
  explanation: string;
  lines: readonly string[];
  from: Position;
  to: Position;
};

type GuideDefinition = Omit<MotionGuide, 'to' | 'sequence'>;
const definitions: Record<string, GuideDefinition> = {
  w: {
    key: 'w', title: 'NEXT WORD', explanation: 'Jump to the start of the next word.',
    lines: ['calm wind rain'], from: { row: 0, col: 0 },
  },
  b: {
    key: 'b', title: 'BACK A WORD', explanation: 'Jump to the start of the previous word.',
    lines: ['calm wind rain'], from: { row: 0, col: 10 },
  },
  e: {
    key: 'e', title: 'WORD END', explanation: 'Land on the last character of a word.',
    lines: ['calm wind rain'], from: { row: 0, col: 5 },
  },
  '0': {
    key: '0', title: 'LINE START', explanation: 'Jump to column one on this line.',
    lines: ['calm wind rain'], from: { row: 0, col: 10 },
  },
  '$': {
    key: '$', title: 'LINE END', explanation: 'Jump to the final character on this line.',
    lines: ['calm wind rain'], from: { row: 0, col: 5 },
  },
  '^': { key: '^', title: 'FIRST NONBLANK', explanation: 'Jump past indentation.', lines: ['  calm wind rain'], from: { row: 0, col: 10 } },
  gg: { key: 'gg', title: 'FILE START', explanation: 'Jump to the first line.', lines: ['first line', 'middle line', 'last line'], from: { row: 2, col: 0 } },
  G: { key: 'G', title: 'FILE END', explanation: 'Jump to the final line.', lines: ['first line', 'middle line', 'last line'], from: { row: 0, col: 0 } },
  Counts: { key: 'Counts', title: 'COUNTS', explanation: 'Prefix a motion with a number.', lines: ['one', 'two', 'three', 'four'], from: { row: 0, col: 0 } },
  f: { key: 'f', title: 'FIND FORWARD', explanation: 'Find a character ahead.', lines: ['x a x a x'], from: { row: 0, col: 0 } },
  F: { key: 'F', title: 'FIND BACKWARD', explanation: 'Find a character behind.', lines: ['x a x a x'], from: { row: 0, col: 8 } },
  t: { key: 't', title: 'UNTIL FORWARD', explanation: 'Stop before a character.', lines: ['x a x a x'], from: { row: 0, col: 0 } },
  T: { key: 'T', title: 'UNTIL BACKWARD', explanation: 'Stop after a character behind.', lines: ['x a x a x'], from: { row: 0, col: 8 } },
  ';': { key: ';', title: 'REPEAT FIND', explanation: 'Repeat the last character find.', lines: ['x a x a x'], from: { row: 0, col: 2 } },
  ',': { key: ',', title: 'REVERSE FIND', explanation: 'Reverse the last character find.', lines: ['x a x a x'], from: { row: 0, col: 6 } },
  '/': { key: '/', title: 'SEARCH FORWARD', explanation: 'Search for literal text ahead.', lines: ['star moon star'], from: { row: 0, col: 0 } },
  '?': { key: '?', title: 'SEARCH BACKWARD', explanation: 'Search for literal text behind.', lines: ['star moon star'], from: { row: 0, col: 10 } },
  n: { key: 'n', title: 'REPEAT SEARCH', explanation: 'Repeat the last search direction.', lines: ['star moon star'], from: { row: 0, col: 0 } },
  N: { key: 'N', title: 'REVERSE SEARCH', explanation: 'Reverse the last search direction.', lines: ['star moon star'], from: { row: 0, col: 10 } },
  '%': { key: '%', title: 'MATCH PAIR', explanation: 'Jump to the matching delimiter.', lines: ['(a [b] c)'], from: { row: 0, col: 0 } },
  Navigator: { key: 'Navigator', title: 'NAVIGATOR', explanation: 'You completed the navigation course.', lines: ['(you made it)'], from: { row: 0, col: 0 } },
};

export function motionGuideFor(key: string): MotionGuide {
  const definition = definitions[key];
  if (!definition) throw new RangeError(`Unknown guide ${key}`);
  const sequence: Record<string, string> = { Counts: '3j', f: 'fa', F: 'Fa', t: 'ta', T: 'Ta', ';': ';', ',': ',', '/': '/star\n', '?': '?star\n', n: 'n', N: 'N', Navigator: '%' };
  const keys = sequence[key] ?? key;
  let state = emptyCommand();
  if (key === ';' || key === ',') state = { ...state, lastFind: { command: 'f', char: 'a' } };
  if (key === 'n' || key === 'N') state = { ...state, lastSearch: { text: 'star', direction: 1 } };
  let to = definition.from;
  for (const char of keys) {
    const result = interpret(definition.lines, to, state, char, [...Object.keys(definitions), 'h', 'j', 'k', 'l']);
    to = result.cursor; state = result.state;
  }
  return { ...definition, sequence: keys.replace('\n', '↵'), to };
}

export function guideStep(ageMs: number): 0 | 1 | 2 {
  const cycle = Math.max(0, ageMs) % GUIDE_CYCLE_MS;
  return cycle < GUIDE_COMMAND_MS ? 0 : cycle < GUIDE_MOVE_MS ? 1 : 2;
}
