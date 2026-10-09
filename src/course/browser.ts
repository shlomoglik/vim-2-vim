import type { Game, Progress } from '../game/state.js';
import { freshRun } from '../game/state.js';
import { stageIds, challengeTitles, LESSON_COUNT, type Lesson } from '../lessons/index.js';
import type { LessonCatalog } from '../lessons/LessonCatalog.js';
import { emptyCommand, interpret } from '../vim/command.js';
import { newEdit } from '../vim/editing.js';
import { courseMotions, courseSections, examplePracticeId, navigationCommands, sectionFor, topicFor, topicPracticeIds } from './curriculum.js';
import { animatedDemo, DEMO_STEP_MS, newDemo, stepDemo } from './demo.js';
import type { CourseState, CourseView } from './types.js';

export type MenuEntry = { label: string; kind: 'section' | 'heading' | 'topic' | 'examples' | 'practice-menu' | 'practice' | 'stats' | 'difficulty'; id?: string };
export type CourseLessonProvider = Pick<LessonCatalog, 'create'> & Partial<Pick<LessonCatalog, 'createById'>>;
export const newCourseState = (): CourseState => ({ view: 'sections', sectionId: null, topicId: null, cursor: { row: 0, col: 0 }, demo: null, practiceId: null, cursors: {} });
export const practiceCompleted = (progress: Progress, id: string) => !!progress.attempts[`${progress.difficulty}:${id}`]?.length;

export function courseEntries(game: Game): MenuEntry[] {
  const course = game.course!;
  if (course.view === 'sections') return [
    ...courseSections.map(section => ({ label: section.title, kind: 'section' as const, id: section.id })),
    { label: 'View stats', kind: 'stats' }, { label: 'Set difficulty', kind: 'difficulty' },
  ];
  const section = sectionFor(course.sectionId)!;
  if (course.view === 'topics') {
    let group = '';
    return section.topics.flatMap(topic => {
      const entries: MenuEntry[] = [];
      if (group !== topic.group) { group = topic.group; entries.push({ label: `-- ${group} --`, kind: 'heading' }); }
      const ids = topicPracticeIds(topic);
      const done = ids.filter(id => practiceCompleted(game.progress, id)).length;
      entries.push({ label: `${done === ids.length ? '✓' : '·'} ${topic.title} [${topic.commands.join(' ')}] ${done}/${ids.length}`, kind: 'topic', id: topic.id });
      return entries;
    });
  }
  const topic = topicFor(course.topicId)!;
  if (course.view === 'lesson') return [
    { label: `Examples - ${topic.commands.join(' ')}`, kind: 'examples' },
    { label: `Practice - ${topic.commands.join(' ')}`, kind: 'practice-menu' },
  ];
  if (course.view === 'practice') return [
    ...(topic.legacyPractices ?? []).map(id => ({ label: `${practiceCompleted(game.progress, id) ? '✓' : '·'} ${challengeTitles[stageIds.indexOf(id as typeof stageIds[number])]}`, kind: 'practice' as const, id })),
    ...topic.examples.map(example => ({ label: `${practiceCompleted(game.progress, examplePracticeId(topic, example)) ? '✓' : '·'} Practice ${example.command}`, kind: 'practice' as const, id: examplePracticeId(topic, example) })),
  ];
  return [];
}

function changeView(game: Game, view: CourseView, reset = false): Game {
  const course = game.course!;
  const cursors = { ...course.cursors, [course.view]: course.cursor };
  const entriesGame = { ...game, course: { ...course, view } };
  const entries = courseEntries(entriesGame);
  let cursor = reset ? { row: 0, col: 0 } : cursors[view] ?? { row: 0, col: 0 };
  cursor = { ...cursor, row: Math.min(cursor.row, Math.max(0, entries.length - 1)) };
  if (entries[cursor.row]?.kind === 'heading') cursor = { row: cursor.row + 1, col: 0 };
  return { ...game, phase: 'course', command: emptyCommand(), message: '', activeLesson: null,
    course: { ...course, view, cursor, cursors, demo: null, practiceId: null } };
}
export function openCourse(game: Game): Game {
  return { ...game, phase: 'course', course: newCourseState(), message: '', command: emptyCommand() };
}
export function returnToPractice(game: Game): Game {
  return { ...game, phase: 'course', activeLesson: null, edit: null, hint: false, message: '', command: emptyCommand(), ...freshRun(),
    course: { ...game.course!, view: 'practice', practiceId: null } };
}
export function backCourse(game: Game): Game {
  const view = game.course!.view;
  if (view === 'sections') return { ...game, phase: 'menu' };
  return changeView(game, view === 'topics' ? 'sections' : view === 'lesson' ? 'topics' : 'lesson');
}

function startPractice(game: Game, id: string, lessons: CourseLessonProvider): Game {
  const index = stageIds.indexOf(id as typeof stageIds[number]);
  let lesson: Lesson;
  if (index >= 0) lesson = lessons.create(index, game.progress.difficulty, courseMotions);
  else {
    if (!lessons.createById) throw new Error(`Lesson provider does not support practice ${id}`);
    lesson = lessons.createById(id, game.progress.difficulty, courseMotions);
  }
  return { ...game, phase: 'play', lesson: index >= 0 ? index : 0, activeLesson: lesson, checkpoint: 0,
    cursor: { ...lesson.start }, command: emptyCommand(), usedCommands: [], hint: false, newUnlock: false, message: '',
    edit: lesson.editing ? newEdit(lesson.lines) : null, statsPracticeId: id, course: { ...game.course!, practiceId: id }, ...freshRun() };
}

export function browseCourse(game: Game, key: string, lessons: CourseLessonProvider, nowMs = performance.now()): Game {
  const course = game.course!;
  if (course.view === 'examples') {
    const examples = topicFor(course.topicId)!.examples;
    const demo = course.demo ?? newDemo(examples[0]!, 0, nowMs);
    if (key === 'escape') return backCourse(game);
    if (key === 'h' || key === 'l' || key === 'k' || key === 'j') {
      const index = Math.max(0, Math.min(examples.length - 1, demo.index + (key === 'l' || key === 'j' ? 1 : -1)));
      return { ...game, course: { ...course, demo: newDemo(examples[index]!, index, nowMs) } };
    }
    if (key === 'r') return { ...game, course: { ...course, demo: newDemo(examples[demo.index]!, demo.index, nowMs) } };
    if (key === '\n') {
      const shown = animatedDemo(examples[demo.index]!, demo, nowMs);
      const stepped = shown.step === examples[demo.index]!.keys.length ? newDemo(examples[demo.index]!, demo.index, nowMs) : stepDemo(examples[demo.index]!, shown);
      return { ...game, course: { ...course, demo: { ...stepped, startedAtMs: nowMs - stepped.step * DEMO_STEP_MS } } };
    }
    if (key === 'p') return changeView(game, 'practice', true);
    return game;
  }
  if (key === 'escape' && !game.command.pending) return backCourse(game);
  const entries = courseEntries(game);
  const searching = game.command.pending.startsWith('/') || game.command.pending.startsWith('?');
  if (key === '\n' && !searching) {
    const entry = entries[course.cursor.row];
    if (!entry || entry.kind === 'heading') return game;
    switch (entry.kind) {
      case 'section': return changeView({ ...game, course: { ...course, sectionId: entry.id!, topicId: null } }, 'topics', true);
      case 'topic': return changeView({ ...game, course: { ...course, topicId: entry.id! } }, 'lesson', true);
      case 'examples': return { ...game, command: emptyCommand(), course: { ...course, cursors: { ...course.cursors, lesson: course.cursor }, view: 'examples', demo: newDemo(topicFor(course.topicId)!.examples[0]!, 0, nowMs) } };
      case 'practice-menu': return changeView(game, 'practice', true);
      case 'practice': return startPractice(game, entry.id!, lessons);
      case 'stats': return { ...game, phase: 'stats', lesson: Math.min(game.lesson, LESSON_COUNT - 1), statsOffset: 0 };
      case 'difficulty': return { ...game, phase: 'difficulty', command: emptyCommand() };
    }
  }
  if (key === 'f1') return { ...game, message: 'j/k move, Enter opens, Esc returns. / searches this menu.' };
  const outcome = interpret(entries.map(entry => entry.label), course.cursor, game.command, key, navigationCommands);
  let cursor = outcome.cursor;
  if (entries[cursor.row]?.kind === 'heading') {
    const direction = cursor.row >= course.cursor.row ? 1 : -1;
    const row = cursor.row + direction;
    cursor = { row: row < 0 || row >= entries.length ? course.cursor.row : row, col: 0 };
  }
  return { ...game, message: outcome.message, command: outcome.state, course: { ...course, cursor } };
}
