import { emptyCommand, interpret } from '../vim/command.js';
import { editKey, newEdit } from '../vim/editing.js';
import type { Lesson } from '../lessons/types.js';
import { displayKey } from './authoring.js';
import { courseTopics, examplePracticeId, navigationCommands } from './curriculum.js';
import type { CourseExample, CourseTopic } from './types.js';

export const extraPractices = new Map(courseTopics.flatMap(topic => topic.examples.map(example => [examplePracticeId(topic, example), { topic, example }] as const)));

export function createExamplePractice(topic: CourseTopic, example: CourseExample): Lesson {
  const id = examplePracticeId(topic, example);
  const keys = example.keys.map(displayKey).join(' ');
  const common = {
    id, title: `${topic.title} · ${example.command}`, instruction: `${example.description}${example.expected ? ' Match the target and save with :w.' : ' Reach the green target.'}`,
    hint: `Example: ${keys}${example.expected ? ' : w Enter' : ''}`,
    lines: [...example.lines], start: { ...example.start }, badge: null,
  };
  if (example.expected) return {
    ...common, checkpoints: [{ ...example.start }], idealKeys: [example.keys.length + 3], referenceRoutes: [],
    editing: { filename: `${topic.id}.txt`, expected: [...example.expected], requireSave: true },
  };
  let cursor = example.start, state = emptyCommand();
  for (const key of example.keys) {
    const outcome = interpret(example.lines, cursor, state, key, navigationCommands);
    if (outcome.message) throw new Error(`${id}: ${outcome.message}`);
    cursor = outcome.cursor; state = outcome.state;
  }
  if (state.pending || cursor.row === example.start.row && cursor.col === example.start.col) throw new Error(`${id}: incomplete or motionless practice`);
  return { ...common, checkpoints: [cursor], idealKeys: [example.keys.length], referenceRoutes: [example.keys.join('')] };
}

/** Authoring validation checks editing scripts against the independently authored target buffer. */
export function validateExample(example: CourseExample): void {
  if (!example.expected) return;
  let edit = newEdit(example.lines), cursor = example.start;
  for (const key of example.keys) {
    const outcome = editKey(edit, cursor, key, navigationCommands);
    if (outcome.message && outcome.message !== 'Written') throw new Error(`${example.command}: ${outcome.message}`);
    edit = outcome.edit; cursor = outcome.cursor;
  }
  if (edit.lines.join('\n') !== example.expected.join('\n')) throw new Error(`${example.command}: example missed its target: ${JSON.stringify(edit.lines)}`);
}
