import type { Game, Progress } from '../game/state.js';
import { freshRun } from '../game/state.js';
import { stageIds, LESSON_COUNT, type Lesson } from '../lessons/index.js';
import type { LessonCatalog } from '../lessons/LessonCatalog.js';
import { emptyCommand, interpret } from '../vim/command.js';
import { newEdit } from '../vim/editing.js';
import { courseMotions, courseSections, courseTopics, navigationCommands, topicFor, topicPracticeId } from './curriculum.js';
import { animatedDemo, DEMO_STEP_MS, newDemo, stepDemo } from './demo.js';
import type { CourseState, CourseView } from './types.js';

export type MenuEntry = { label: string; kind: 'topic' | 'examples' | 'practice' | 'stats' | 'difficulty'; id?: string };
export type CourseLessonProvider = Pick<LessonCatalog, 'create'> & Partial<Pick<LessonCatalog, 'createById'>>;
export const newCourseState = (): CourseState => ({ view: 'sections', sectionId: null, topicId: null, cursor: { row: 0, col: 0 }, demo: null, practiceId: null, cursors: {}, expandedTopics: [] });
export const practiceCompleted = (progress: Progress, id: string) => !!progress.attempts[`${progress.difficulty}:${id}`]?.length;

export function courseEntries(game: Game): MenuEntry[] {
  const course = game.course!;
  if (course.view === 'sections') return [
    ...courseSections.flatMap(section => section.topics.flatMap(topic => {
      const done = practiceCompleted(game.progress, topicPracticeId(topic));
      const expanded = course.expandedTopics?.includes(topic.id);
      const entries: MenuEntry[] = [{
        label: `${expanded ? '▾' : '▸'} ${done ? '✓' : '·'} ${topic.title} [${topic.commands.join(' ')}] · ${section.title}`,
        kind: 'topic', id: topic.id,
      }];
      if (expanded) entries.push(
        { label: `    Examples · ${topic.commands.join(' ')}`, kind: 'examples', id: topic.id },
        { label: `    ${done ? '✓' : '·'} Practice · 60+ mixed goals`, kind: 'practice', id: topicPracticeId(topic) },
      );
      return entries;
    })),
    { label: 'View stats', kind: 'stats' }, { label: 'Set difficulty', kind: 'difficulty' },
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
  return { ...game, phase: 'course', command: emptyCommand(), message: '', activeLesson: null,
    course: { ...course, view, cursor, cursors, demo: null, practiceId: null } };
}
export function openCourse(game: Game): Game {
  return { ...game, phase: 'course', course: newCourseState(), message: '', command: emptyCommand() };
}
export function returnToPractice(game: Game): Game {
  return { ...game, phase: 'course', activeLesson: null, edit: null, hint: false, message: '', command: emptyCommand(), ...freshRun(),
    course: { ...game.course!, view: 'sections', practiceId: null } };
}
export function backCourse(game: Game): Game {
  if (game.course!.view === 'sections') return { ...game, phase: 'menu' };
  return changeView(game, 'sections');
}

function startPractice(game: Game, id: string, lessons: CourseLessonProvider): Game {
  const index = stageIds.indexOf(id as typeof stageIds[number]);
  const selectedTopic = courseTopics.find(topic => topicPracticeId(topic) === id);
  let lesson: Lesson;
  if (index >= 0) lesson = lessons.create(index, game.progress.difficulty, courseMotions);
  else {
    if (!lessons.createById) throw new Error(`Lesson provider does not support practice ${id}`);
    const earned = [...game.progress.badges, ...courseSections.flatMap(section => section.topics)
      .filter(topic => practiceCompleted(game.progress, topicPracticeId(topic))).map(topic => `topic:${topic.id}`)];
    lesson = lessons.createById(id, game.progress.difficulty, courseMotions, earned);
  }
  return { ...game, phase: 'play', lesson: index >= 0 ? index : 0, activeLesson: lesson, checkpoint: 0,
    cursor: { ...lesson.start }, command: emptyCommand(), usedCommands: [], goalCommandOffset: 0, hint: false, newUnlock: false, message: '',
    edit: lesson.editing ? newEdit(lesson.lines) : null, statsPracticeId: id, course: { ...game.course!, topicId: selectedTopic?.id ?? game.course!.topicId,
      sectionId: selectedTopic ? courseSections.find(section => section.topics.includes(selectedTopic))!.id : game.course!.sectionId, practiceId: id }, ...freshRun() };
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
    if (key === 'p') return startPractice(game, topicPracticeId(topicFor(course.topicId)!), lessons);
    return game;
  }
  if (key === 'escape' && !game.command.pending) return backCourse(game);
  const selected = courseEntries(game)[course.cursor.row];
  if (key === 'p' && !game.command.pending && selected?.kind === 'topic') {
    return startPractice({ ...game, course: { ...course, topicId: selected.id!,
      sectionId: courseSections.find(section => section.topics.some(topic => topic.id === selected.id))!.id } },
      topicPracticeId(topicFor(selected.id!)!), lessons);
  }
  if ((key === ' ' || key === 'tab') && !game.command.pending && selected?.kind === 'topic') {
    return browseCourse(game, '\n', lessons, nowMs);
  }
  const entries = courseEntries(game);
  const searching = game.command.pending.startsWith('/') || game.command.pending.startsWith('?');
  if (key === '\n' && !searching) {
    const entry = entries[course.cursor.row];
    if (!entry) return game;
    switch (entry.kind) {
      case 'topic': {
        const expanded = new Set(course.expandedTopics ?? []);
        if (expanded.has(entry.id!)) expanded.delete(entry.id!); else expanded.add(entry.id!);
        return { ...game, command: emptyCommand(), course: { ...course, topicId: entry.id!,
          sectionId: courseSections.find(section => section.topics.some(topic => topic.id === entry.id))!.id,
          expandedTopics: [...expanded] } };
      }
      case 'examples': return { ...game, command: emptyCommand(), course: { ...course, topicId: entry.id ?? course.topicId, sectionId: courseSections.find(section => section.topics.some(topic => topic.id === entry.id))!.id, cursors: { ...course.cursors, sections: course.cursor }, view: 'examples', demo: newDemo(topicFor(entry.id ?? course.topicId)!.examples[0]!, 0, nowMs) } };
      case 'practice': return startPractice(game, entry.id!, lessons);
      case 'stats': return { ...game, phase: 'stats', lesson: Math.min(game.lesson, LESSON_COUNT - 1), statsOffset: 0 };
      case 'difficulty': return { ...game, phase: 'difficulty', command: emptyCommand() };
    }
  }
  if (key === 'f1') return { ...game, message: 'j/k move, Enter/Space expands, p practices, Esc returns. / searches all topics.' };
  const outcome = interpret(entries.map(entry => entry.label), course.cursor, game.command, key, navigationCommands);
  return { ...game, message: outcome.message, command: outcome.state, course: { ...course, cursor: outcome.cursor } };
}
