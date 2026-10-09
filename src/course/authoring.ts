import type { CourseExample, CourseTopic } from './types.js';
import type { Position } from '../vim/motion.js';

export const keys = (sequence: string): string[] => [...sequence].map(key => key === '\x1b' ? 'escape' : key);
export function motion(command: string, description: string, lines: readonly string[], start: Position, sequence = command): CourseExample {
  return { id: command, command, description, lines, start, keys: keys(sequence) };
}
export function repair(command: string, description: string, lines: readonly string[], expected: readonly string[], sequence: string, start: Position = { row: 0, col: 0 }, id = command): CourseExample {
  return { id, command, description, lines, expected, start, keys: keys(sequence) };
}
export function topic(id: string, title: string, group: string, examples: readonly CourseExample[], legacyPractices: readonly string[] = [], commands = examples.map(example => example.command)): CourseTopic {
  return { id, title, group, commands, examples, legacyPractices };
}
export function displayKey(key: string): string {
  return ({ '\n': 'Enter', '\r': 'Enter', escape: 'Esc', '\x12': 'Ctrl+R', '\x04': 'Ctrl+d', '\x15': 'Ctrl+u', ' ': 'Space' } as Record<string, string>)[key] ?? key;
}
