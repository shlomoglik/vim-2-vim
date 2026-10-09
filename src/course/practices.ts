import { emptyCommand, interpret } from '../vim/command.js';
import { editKey, newEdit } from '../vim/editing.js';
import type { Lesson, PracticeGoal } from '../lessons/types.js';
import { displayKey } from './authoring.js';
import { courseTopics, examplePracticeId, navigationCommands, topicPracticeId } from './curriculum.js';
import type { CourseExample, CourseTopic } from './types.js';

export const extraPractices = new Map(courseTopics.flatMap(topic => topic.examples.map(example => [examplePracticeId(topic, example), { topic, example }] as const)));

function navigationVariant(example: CourseExample, round: number): CourseExample {
  if (example.expected || round === 0) return example;
  const positions = example.lines.flatMap((line, row) => [...line].map((_, col) => ({ row, col })));
  for (let offset = 0; offset < positions.length; offset++) {
    const start = positions[(round * 7 + offset) % positions.length]!;
    let cursor = start, state = emptyCommand();
    let valid = true;
    for (const key of example.keys) {
      const outcome = interpret(example.lines, cursor, state, key, navigationCommands);
      if (outcome.message || outcome.cursor.col < 0) { valid = false; break; }
      cursor = outcome.cursor; state = outcome.state;
    }
    if (valid && !state.pending && (cursor.row !== start.row || cursor.col !== start.col)) return { ...example, start };
  }
  return example;
}

/** Alternate focused goals with review so every run covers the entire command group. */
export function createTopicPractice(topic: CourseTopic, earned: readonly string[] = []): Lesson {
  const basic = courseTopics[0]!;
  const candidates = courseTopics.flatMap(candidate => candidate.examples
    .filter(example => candidate === basic || candidate !== topic && (
      earned.includes(`topic:${candidate.id}`) || !example.expected && earned.includes(example.command) ||
      earned.includes('Counts') && /^\d/.test(example.command) ||
      earned.includes('Navigator') && !example.expected ||
      topic.id === 'WORD-movement' && candidate.id === 'word-movement'))
    .map(example => ({ topic: candidate, example })));
  const review = [...new Map(candidates.map(source => [
    /^\d/.test(source.example.command) ? 'Counts' : source.example.command, source,
  ])).values()];
  const goals: PracticeGoal[] = Array.from({ length: Math.max(60, review.length * 2, topic.examples.length * 2) }, (_, index) => {
    const focus = index % 2 === 0;
    const source = focus ? { topic, example: topic.examples[(index / 2) % topic.examples.length]! } : review[Math.floor(index / 2) % review.length]!;
    const example = navigationVariant(source.example, Math.floor(index / 2 / (focus ? topic.examples.length : review.length)));
    const lesson = createExamplePractice(source.topic, example);
    const alreadySaved = example.keys.slice(-3).join('') === ':w\n';
    const keys = example.expected && !alreadySaved ? [...example.keys, ':', 'w', '\n'] : [...example.keys];
    const required = new Set<string>();
    if (lesson.editing) {
      let edit = newEdit(lesson.lines), cursor = lesson.start;
      for (const key of keys) {
        const outcome = editKey(edit, cursor, key, navigationCommands);
        edit = outcome.edit; cursor = outcome.cursor;
      }
      for (const command of edit.used) required.add(command);
    } else {
      let cursor = lesson.start, state = emptyCommand();
      for (const key of keys) {
        const outcome = interpret(lesson.lines, cursor, state, key, navigationCommands);
        if (outcome.executed) required.add(outcome.executed);
        cursor = outcome.cursor; state = outcome.state;
      }
    }
    return { lines: lesson.lines, start: lesson.start, target: lesson.checkpoints[0]!,
      instruction: `${focus ? 'Focus' : 'Review'} · ${source.example.command}: ${lesson.instruction}`,
      hint: lesson.hint, editing: lesson.editing, keys, requiredCommands: [...required], focus };
  });
  const first = goals[0]!;
  return { id: topicPracticeId(topic), title: `${topic.title} · mixed practice`, badge: null,
    lines: first.lines, start: first.start, instruction: first.instruction, hint: first.hint, editing: first.editing,
    checkpoints: goals.map(goal => goal.target), idealKeys: goals.map(goal => goal.keys.length),
    referenceRoutes: goals.map(goal => goal.keys.join('')), goals };
}

export function practiceGoal(lesson: Lesson, index: number): Lesson {
  const goal = lesson.goals![index]!;
  return { ...lesson, lines: goal.lines, start: goal.start, instruction: goal.instruction, hint: goal.hint, editing: goal.editing };
}

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
