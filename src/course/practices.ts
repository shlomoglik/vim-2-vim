import { emptyCommand, interpret } from '../vim/command.js';
import { editKey, newEdit } from '../vim/editing.js';
import type { Lesson, PracticeGoal } from '../lessons/types.js';
import { shortestRoute } from '../lessons/routing.js';
import type { Position } from '../vim/motion.js';
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

/** Keep each board visible for at least five goals, aiming for ten per batch. */
function boardBatches(goals: readonly PracticeGoal[]): PracticeGoal[] {
  const boards = new Map<string, PracticeGoal[]>();
  for (const goal of goals) {
    const key = JSON.stringify(goal.lines);
    const group = boards.get(key) ?? [];
    group.push(goal);
    boards.set(key, group);
  }
  const batches: PracticeGoal[][] = [];
  for (const group of boards.values()) {
    const count = Math.max(5, group.length);
    const batchCount = Math.max(1, Math.round(count / 10));
    for (let batch = 0, offset = 0; batch < batchCount; batch++) {
      const size = Math.floor(count / batchCount) + (batch < count % batchCount ? 1 : 0);
      batches.push(Array.from({ length: size }, (_, index) => group[(offset + index) % group.length]!));
      offset += size;
    }
  }
  // Alternate boards where possible, rather than exhausting one board at a time.
  const ordered: PracticeGoal[] = [];
  while (batches.length) {
    const previous = ordered.at(-1);
    const index = batches.findIndex(batch => JSON.stringify(batch[0]!.lines) !== JSON.stringify(previous?.lines));
    ordered.push(...batches.splice(Math.max(0, index), 1)[0]!);
  }
  return ordered;
}

const samePosition = (a: Position, b: Position) => a.row === b.row && a.col === b.col;

function navigationTarget(goal: PracticeGoal, start: Position): Position | null {
  let cursor = start, state = emptyCommand();
  for (const key of goal.keys) {
    const outcome = interpret(goal.lines, cursor, state, key, navigationCommands);
    if (outcome.message || outcome.cursor.col < 0) return null;
    cursor = outcome.cursor; state = outcome.state;
  }
  return state.pending || samePosition(cursor, start) ? null : cursor;
}

/** Author each route from the previous landing point, keeping targets reachable. */
function connectGoals(goals: readonly PracticeGoal[]): PracticeGoal[] {
  const connected: PracticeGoal[] = [];
  for (const goal of goals) {
    const previous = connected.at(-1);
    const previousLines = previous?.editing?.expected ?? previous?.lines;
    if (!previous || JSON.stringify(previousLines) !== JSON.stringify(goal.lines)) {
      connected.push(goal);
      continue;
    }
    let start = previous.target;
    if (previous.editing) {
      let edit = newEdit(previous.lines), cursor = previous.start;
      for (const key of previous.keys) {
        const outcome = editKey(edit, cursor, key, navigationCommands);
        edit = outcome.edit; cursor = outcome.cursor;
      }
      start = cursor;
    }
    let keys = [...goal.keys], target = goal.target;
    if (goal.editing) {
      keys = [...shortestRoute(goal.lines, start, goal.start, ['h', 'j', 'k', 'l']), ...keys];
    } else {
      const direct = navigationTarget(goal, start);
      if (direct) target = direct;
      else {
        const reposition = shortestRoute(goal.lines, start, goal.start, ['h', 'j', 'k', 'l']);
        if (samePosition(goal.target, start)) {
          // Fixed destinations such as 0 or gg need a return goal before repeating.
          connected.push({ ...goal, start: { ...start }, target: goal.start, keys: reposition,
            requiredCommands: [...new Set(reposition)],
            instruction: `${goal.focus ? 'Focus' : 'Review'} · Reach the green target to set up the next motion.`,
            hint: `Example: ${reposition.map(displayKey).join(' ')}` });
          connected.push(goal);
          continue;
        }
        // At a boundary, include a repositioning route instead of jumping the cursor.
        keys = [...reposition, ...keys];
      }
    }
    connected.push({ ...goal, start: { ...start }, target, keys,
      hint: `Example: ${keys.map(displayKey).join(' ')}` });
  }
  return connected;
}

/** Mix focused goals with other topics' review, when available. */
export function createTopicPractice(topic: CourseTopic, earned: readonly string[] = []): Lesson {
  const basic = courseTopics[0]!;
  const candidates = courseTopics.flatMap(candidate => candidate.examples
    .filter(example => candidate !== topic && (candidate === basic ||
      earned.includes(`topic:${candidate.id}`) || !example.expected && earned.includes(example.command) ||
      earned.includes('Counts') && /^\d/.test(example.command) ||
      earned.includes('Navigator') && !example.expected ||
      topic.id === 'WORD-movement' && candidate.id === 'word-movement'))
    .map(example => ({ topic: candidate, example })));
  const review = [...new Map(candidates.map(source => [
    /^\d/.test(source.example.command) ? 'Counts' : source.example.command, source,
  ])).values()];
  const authoredGoals: PracticeGoal[] = Array.from({ length: Math.max(60, review.length * 2, topic.examples.length * 2) }, (_, index) => {
    const focus = review.length === 0 || index % 2 === 0;
    const sourceIndex = review.length === 0 ? index : Math.floor(index / 2);
    const source = focus ? { topic, example: topic.examples[sourceIndex % topic.examples.length]! } : review[sourceIndex % review.length]!;
    const example = navigationVariant(source.example, Math.floor(sourceIndex / (focus ? topic.examples.length : review.length)));
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
  const goals = connectGoals(boardBatches(authoredGoals));
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
