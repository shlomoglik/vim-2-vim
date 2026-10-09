import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { courseEntries, newCourseState } from '../src/course/browser.js';
import { animatedDemo, newDemo, stepDemo } from '../src/course/demo.js';
import { courseMotions, courseSections, courseTopics, examplePracticeId, extraPracticeIds, navigationCommands, topicPracticeIds } from '../src/course/curriculum.js';
import { createExamplePractice, validateExample } from '../src/course/practices.js';
import { play } from '../src/game/play.js';
import { newGame } from '../src/game/state.js';
import { loadProgress, saveProgress } from '../src/persistence/progress.js';
import { editKey, newEdit } from '../src/vim/editing.js';
import { GameEngine } from '../src/game/GameEngine.js';
import { LessonCatalog } from '../src/lessons/LessonCatalog.js';
import { difficulties, stageIds } from '../src/lessons/catalog.js';
import { GameRenderer } from '../src/ui/GameRenderer.js';
import { emptyCommand, interpret } from '../src/vim/command.js';
import { visibleWidth } from '@earendil-works/pi-tui';
import assert from 'node:assert/strict';

test('every grouped worked example has a reachable practice target', () => {
  for (const topic of courseTopics) for (const example of topic.examples) {
    validateExample(example);
    const lesson = createExamplePractice(topic, example);
    let game = {
      ...newGame(), phase: 'play' as const, activeLesson: lesson, cursor: { ...lesson.start },
      edit: lesson.editing ? newEdit(lesson.lines) : null,
      course: { ...newCourseState(), sectionId: topic.id, topicId: topic.id, practiceId: examplePracticeId(topic, example) },
    };
    const keys = example.expected ? [...example.keys, ':', 'w', '\n'] : example.keys;
    for (const key of keys) game = play(game, key, 1000) as typeof game;
    assert.equal(game.phase, 'reward', `${topic.id}/${example.id}`);
  }
});

test('worked examples replay their cursor movement before practice', () => {
  const example = courseTopics[0]!.examples[0]!;
  const demo = newDemo(example, 0, 1000);
  assert.equal(animatedDemo(example, demo, 1000).step, 0);
  assert.equal(animatedDemo(example, demo, 1700).step, 1);
  assert.notDeepEqual(animatedDemo(example, demo, 1700).cursor, example.start);
  assert.equal(animatedDemo(example, demo, 3100).step, 0);
});

test('focused practice attempts survive progress reload', () => {
  const topic = courseTopics[0]!;
  const example = topic.examples[0]!;
  const practiceId = examplePracticeId(topic, example);
  const lesson = createExamplePractice(topic, example);
  let game = { ...newGame(), phase: 'play' as const, activeLesson: lesson, cursor: { ...lesson.start },
    course: { ...newCourseState(), sectionId: 'movement', topicId: topic.id, practiceId } };
  for (const key of example.keys) game = play(game, key, 1000) as typeof game;
  assert.equal(game.phase, 'reward');
  const path = join(mkdtempSync(join(tmpdir(), 'vim-course-')), 'progress.json');
  saveProgress(game.progress, path);
  assert.equal(loadProgress(path).attempts[`normal:${practiceId}`]?.length, 1);
});


const clock = { now: () => 1000, timestamp: () => '2026-01-01T00:00:00.000Z' };

function searchMenu(engine: GameEngine, text: string): void {
  for (const key of `/${text}\n`) engine.handleInput(key);
  engine.handleInput('\n');
}
function openTopic(engine: GameEngine, section: string, title: string): void {
  engine.handleInput('r');
  searchMenu(engine, section);
  searchMenu(engine, title);
}

test('the curriculum covers each legacy practice and five sections without duplicate topic IDs', () => {
  assert.deepEqual(courseSections.map(section => section.title), ['Movement', 'Insertion', 'Editing', 'Text objects', 'Visual mode']);
  assert.equal(new Set(courseTopics.map(topic => topic.id)).size, courseTopics.length);
  const practices = new Set(courseTopics.flatMap(topicPracticeIds));
  assert.ok(stageIds.every(id => practices.has(id)));
  assert.equal(extraPracticeIds.size, courseTopics.reduce((sum, topic) => sum + topic.examples.length, 0));
  const words = courseTopics.find(topic => topic.id === 'word-movement')!;
  const WORDS = courseTopics.find(topic => topic.id === 'WORD-movement')!;
  assert.deepEqual(words.commands, ['w', 'e', 'b']);
  assert.deepEqual(WORDS.commands, ['W', 'E', 'B']);
});

test('all legacy practices can be opened independently at each difficulty', () => {
  const catalog = new LessonCatalog();
  for (const difficulty of difficulties) for (const id of stageIds) {
    assert.equal(catalog.createById(id, difficulty, courseMotions).id, id);
  }
});

test('all demonstrations can be stepped and replayed without modifying progress', () => {
  const renderer = new GameRenderer();
  for (const section of courseSections) for (const topic of section.topics) for (const [index, example] of topic.examples.entries()) {
    let demo = newDemo(example, index);
    for (const key of example.keys) { void key; demo = stepDemo(example, demo); }
    assert.equal(demo.step, example.keys.length);
    assert.equal(stepDemo(example, demo), demo);
    if (example.expected) assert.deepEqual(demo.edit?.lines, example.expected, `${topic.id}/${example.id}`);
    const game = { ...newGame(), phase: 'course' as const, course: { ...newCourseState(), sectionId: section.id, topicId: topic.id, view: 'examples' as const, demo } };
    for (const [width, height] of [[22, 16], [32, 24], [80, 40]]) {
      const lines = renderer.render(game, width!, height!, 1000);
      assert.equal(lines.length, height);
      assert.ok(lines.every(line => visibleWidth(line) <= width!), `${topic.id}/${example.id}: ${width}`);
      assert.match(lines.join('\n'), /Esc back/);
    }
  }
});

test('WORD practices save under stable IDs, resume their menu, and remain visible in Stats', () => {
  const engine = new GameEngine(undefined, { clock });
  openTopic(engine, 'Movement', 'Move by WORDS');
  assert.equal(engine.state.course?.topicId, 'WORD-movement');
  engine.handleInput('\n'); // examples
  const before = engine.state.progress;
  assert.equal(engine.handleInput('\n').persist, false);
  assert.equal(engine.state.progress, before);
  assert.equal(engine.state.course?.demo?.cursor.col, 8);
  engine.handleInput('r');
  assert.equal(engine.state.course?.demo?.step, 0);
  engine.handleInput('p'); engine.handleInput('\n');
  assert.equal(engine.state.phase, 'play');
  assert.equal(engine.handleInput('W').persist, true);
  const id = engine.state.course!.practiceId!;
  assert.equal(engine.state.progress.completed, 0);
  assert.ok(engine.state.progress.attempts[`normal:${id}`]?.length);
  engine.handleInput('\n');
  assert.equal(engine.state.phase, 'course');
  assert.equal(engine.state.course?.view, 'practice');
  assert.match(courseEntries(engine.state)[0]!.label, /^✓/);
  engine.handleInput('escape'); engine.handleInput('escape'); engine.handleInput('escape');
  searchMenu(engine, 'View stats');
  assert.equal(engine.state.phase, 'stats');
  assert.match(new GameRenderer().render(engine.state, 80, 40, 1000).join('\n'), /Move by WORDS/);
  assert.match(new GameRenderer().render(engine.state, 80, 40, 1000).join('\n'), /LATEST/);
  const file = join(mkdtempSync(join(tmpdir(), 'vim-grouped-')), 'progress.json');
  saveProgress(engine.state.progress, file);
  assert.deepEqual(loadProgress(file), engine.state.progress);
  const data = JSON.parse(readFileSync(file, 'utf8'));
  data.attempts['normal:course:unknown'] = data.attempts[`normal:${id}`];
  writeFileSync(file, JSON.stringify(data));
  assert.equal(loadProgress(file).attempts['normal:course:unknown'], undefined);
});

test('Escape cancels pending commands before returning to the practice menu', () => {
  const engine = new GameEngine(undefined, { clock });
  openTopic(engine, 'Insertion', 'Insert and append');
  engine.handleInput('j'); engine.handleInput('\n'); // practice menu
  engine.handleInput('j'); engine.handleInput('\n'); // i exercise
  engine.handleInput('i');
  engine.handleInput('escape');
  assert.equal(engine.state.phase, 'play');
  assert.equal(engine.state.edit?.mode, 'normal');
  engine.handleInput('/');
  engine.handleInput('escape');
  assert.equal(engine.state.phase, 'play');
  assert.equal(engine.state.edit?.navigation.pending, '');
  engine.handleInput('escape');
  assert.equal(engine.state.course?.view, 'practice');
  assert.equal(engine.state.phase, 'course');
});

test('menu navigation skips headings, returns to prior selections, and keeps difficulty accessible', () => {
  const engine = new GameEngine(undefined, { clock });
  engine.handleInput('r'); engine.handleInput('\n');
  assert.equal(courseEntries(engine.state)[engine.state.course!.cursor.row]!.id, 'basic-movement');
  searchMenu(engine, 'Find a character');
  engine.handleInput('j'); engine.handleInput('\n'); // practice
  engine.handleInput('escape'); engine.handleInput('k'); engine.handleInput('\n'); // examples
  engine.handleInput('escape');
  assert.equal(engine.state.course?.cursor.row, 0);
  engine.handleInput('escape');
  assert.equal(courseEntries(engine.state)[engine.state.course!.cursor.row]!.id, 'character-find');
  engine.handleInput('escape');
  searchMenu(engine, 'Set difficulty');
  assert.equal(engine.state.phase, 'difficulty');
  engine.handleInput('j');
  assert.equal(engine.handleInput('\n').persist, true);
  assert.equal(engine.state.progress.difficulty, 'hard');
  assert.equal(engine.state.phase, 'course');
});

function motionSequence(lines: string[], start: { row: number; col: number }, keys: string) {
  let cursor = start, state = emptyCommand();
  for (const key of keys) { const outcome = interpret(lines, cursor, state, key, navigationCommands); cursor = outcome.cursor; state = outcome.state; }
  return { cursor, state };
}
test('WORD motions, indentation, paragraphs, and whole-word searches have distinct targets', () => {
  const text = ['one.two three-four five'];
  assert.equal(motionSequence(text, { row: 0, col: 0 }, 'w').cursor.col, 3);
  assert.equal(motionSequence(text, { row: 0, col: 0 }, 'W').cursor.col, 8);
  assert.equal(motionSequence(text, { row: 0, col: 0 }, 'E').cursor.col, 6);
  assert.equal(motionSequence(text, { row: 0, col: 10 }, 'B').cursor.col, 8);
  assert.deepEqual(motionSequence(['  one', '    two'], { row: 0, col: 0 }, '2_').cursor, { row: 1, col: 4 });
  const search = ['cat cats cat', 'catapult cat'];
  assert.deepEqual(motionSequence(search, { row: 0, col: 0 }, '*').cursor, { row: 0, col: 9 });
  assert.deepEqual(motionSequence(search, { row: 0, col: 0 }, '*n').cursor, { row: 1, col: 9 });
  assert.deepEqual(motionSequence(search, { row: 0, col: 0 }, '*nN').cursor, { row: 0, col: 9 });
  assert.deepEqual(motionSequence(['one', '', 'two', 'three'], { row: 0, col: 0 }, '}').cursor, { row: 1, col: 0 });
});

test('nested and multiline text objects, registers, undo, and visual endpoints remain usable', () => {
  let edit = newEdit(['value = (one [two])']), cursor = { row: 0, col: 14 };
  const press = (key: string) => { const result = editKey(edit, cursor, key, navigationCommands); edit = result.edit; cursor = result.cursor; };
  for (const key of 'di[') press(key);
  assert.deepEqual(edit.lines, ['value = (one [])']);
  press('u');
  assert.deepEqual(edit.lines, ['value = (one [two])']);
  for (const key of 'da(') press(key);
  assert.deepEqual(edit.lines, ['value = ']);
  edit = newEdit(['(first', 'second)']); cursor = { row: 0, col: 2 };
  for (const key of 'di(') press(key);
  assert.deepEqual(edit.lines, ['()']);
  edit = newEdit(['one', 'two']); cursor = { row: 0, col: 0 };
  for (const key of 'Vj') press(key);
  assert.deepEqual(edit.selectionAnchor, { row: 0, col: 0 });
  press('o');
  assert.deepEqual(cursor, { row: 0, col: 0 });
  assert.deepEqual(edit.selectionAnchor, { row: 1, col: 0 });
  press('y'); press('G'); press('p');
  assert.deepEqual(edit.lines, ['one', 'two', 'one', 'two']);
});
