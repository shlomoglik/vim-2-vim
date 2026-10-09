import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { GameEngine } from '../src/game/GameEngine.js';
import { blankProgress,newGame,resultKey } from '../src/game/state.js';
import { LESSON_COUNT,LessonCatalog,NAVIGATION_COUNT,difficulties,earnedBadges,lessonFor } from '../src/lessons/index.js';
import { GameRenderer } from '../src/ui/GameRenderer.js';
import { Screen } from '../src/ui/Screen.js';
import { captureBaseline,type Baseline } from './helpers/baseline.js';

const baseline = JSON.parse(readFileSync(new URL('./fixtures/baseline.json', import.meta.url), 'utf8')) as Baseline;
const current = captureBaseline();

test('all authored lessons match their pre-refactor definitions at every difficulty', () => {
  assert.deepEqual(current.lessons, baseline.lessons);
});

test('screens match approved output across phases and terminal sizes', () => {
  assert.deepEqual(current.screens, baseline.screens);
});

test('hub actions stay pinned while lessons scroll at every supported layout', () => {
  const renderer = new GameRenderer();
  for (const [width, height] of [[22, 16], [32, 16], [46, 24], [80, 40], [80, 60]]) {
    let actionPositions: number[] | undefined;
    for (const row of [0, 15, LESSON_COUNT - 1, LESSON_COUNT, LESSON_COUNT + 1]) {
      const game = { ...newGame(), phase: 'hub' as const, hubCursor: { row, col: 0 } };
      const rendered = renderer.render(game, width!, height!, 1000);
      const plain = rendered.map(line => line.replace(/\x1b\[[0-9;]*m/g, ''));
      const positions = ['View stats', 'Set difficulty'].map(label => plain.findIndex(line => line.includes(label)));
      assert.ok(positions.every(position => position >= 0), `${width}x${height}: row ${row}`);
      assert.equal(positions[1], positions[0]! + 1);
      if (actionPositions) assert.deepEqual(positions, actionPositions);
      actionPositions = positions;
      if (row >= LESSON_COUNT) {
        assert.ok(rendered[positions[row - LESSON_COUNT]!]!.includes('\x1b[38;5;240;48;5;255m'));
      }
    }
  }
});

const clock = { now: () => 1000, timestamp: () => '2026-01-01T00:00:00.000Z' };

test('flat course expands examples and practice without leaving the lesson list', () => {
  const engine = new GameEngine(undefined, { clock });
  engine.handleInput('r');
  engine.handleInput('\n'); // expand Basic movement
  assert.equal(engine.state.course?.view, 'sections');
  const screen = new GameRenderer().render(engine.state, 80, 30, 1000).join('\n');
  assert.ok(screen.indexOf('Examples') < screen.indexOf('Practice'));
  engine.handleInput('j'); engine.handleInput('\n');
  assert.equal(engine.state.course?.view, 'examples');
  engine.handleInput('\n');
  assert.equal(engine.state.course?.demo?.step, 1);
  engine.handleInput('escape');
  assert.equal(engine.state.course?.view, 'sections');
  engine.handleInput('\n');
  assert.equal(engine.state.course?.view, 'examples');
  engine.handleInput('p');
  assert.equal(engine.state.phase, 'play');
  for (const goal of engine.state.activeLesson!.goals!) for (const key of goal.keys) engine.handleInput(key);
  assert.equal(engine.state.phase, 'reward');
  engine.handleInput('\n');
  assert.equal(engine.state.course?.view, 'sections');
});

test('engine completes the navigation course through input and emits save effects once per completion', () => {
  for (const difficulty of difficulties) {
    const engine = new GameEngine({ ...blankProgress(), difficulty }, { clock, navigation: 'legacy' });
    assert.deepEqual(engine.handleInput('R'), { persist: false });
    for (let index = 0; index < NAVIGATION_COUNT; index++) {
      assert.equal(engine.handleInput('\n').persist, false);
      const keys = engine.state.activeLesson!.referenceRoutes.join('');
      let saves = 0;
      for (const key of keys) if (engine.handleInput(key).persist) saves++;
      assert.equal(saves, 1, `${difficulty}:${index}`);
      assert.equal(engine.state.phase, 'reward');
      assert.equal(engine.state.progress.attempts[resultKey(difficulty, index)]![0]!.completedAt, clock.timestamp());
      engine.handleInput('\n');
    }
    assert.equal(engine.state.phase, 'complete');
    assert.equal(engine.state.progress.completed, NAVIGATION_COUNT);
    engine.handleInput('\n');
    assert.equal(engine.state.phase, 'hub');
    const attempts = engine.state.progress.attempts;
    // Restart is available only from the initial menu, preserving all attempt records.
    const restarted = new GameEngine(engine.state.progress, { clock, navigation: 'legacy' });
    assert.equal(restarted.handleInput('s').persist, true);
    assert.equal(restarted.state.progress.completed, 0);
    assert.deepEqual(restarted.state.progress.attempts, attempts);
  }
});

test('engine routes pending searches through Enter and saves difficulty changes', () => {
  const engine = new GameEngine({ ...blankProgress(), completed: NAVIGATION_COUNT, badges: earnedBadges(NAVIGATION_COUNT) }, { clock, navigation: 'legacy' });
  engine.handleInput('r');
  engine.handleInput('g'); engine.handleInput('g');
  for (const key of '/View\n') engine.handleInput(key);
  assert.equal(engine.state.phase, 'hub');
  engine.handleInput('\n');
  assert.equal(engine.state.phase, 'stats');
  engine.handleInput('\n');
  engine.handleInput('j'); engine.handleInput('\n');
  assert.equal(engine.state.phase, 'difficulty');
  engine.handleInput('j');
  assert.equal(engine.handleInput('\n').persist, true);
  assert.equal(engine.state.progress.difficulty, 'hard');
});

test('engine editing save uses injected clock and completes only after writing', () => {
  const engine = new GameEngine({ ...blankProgress(), completed: NAVIGATION_COUNT, badges: earnedBadges(NAVIGATION_COUNT) }, { clock, navigation: 'legacy' });
  engine.handleInput('r'); engine.handleInput('\n');
  for (const key of ['$', 'a', ...' Lovelace', 'escape']) assert.equal(engine.handleInput(key).persist, false);
  assert.equal(engine.state.phase, 'play');
  engine.handleInput(':'); engine.handleInput('w');
  assert.equal(engine.handleInput('\n').persist, true);
  const attempt = engine.state.progress.attempts[resultKey('normal', NAVIGATION_COUNT)]![0]!;
  assert.equal(attempt.completedAt, clock.timestamp());
  assert.deepEqual(attempt.commandsUsed, ['$', 'a', 'Escape', ':w']);
});

test('a separate lesson catalog can customize a lesson without changing the default course', () => {
  const catalog = new LessonCatalog();
  const original = lessonFor(0, 'normal', ['h', 'j', 'k', 'l']);
  catalog.register('directions', () => ({ ...original, instruction: 'Custom instructions' }));
  const engine = new GameEngine(undefined, { lessons: catalog, clock, navigation: 'legacy' });
  engine.handleInput('r'); engine.handleInput('\n');
  assert.equal(engine.state.activeLesson?.instruction, 'Custom instructions');
  assert.equal(lessonFor(0, 'normal', ['h', 'j', 'k', 'l']).instruction, original.instruction);
});

test('terminal screen gates undersized input and persists engine save effects', () => {
  const engine = new GameEngine(undefined, { clock, navigation: 'legacy' });
  let saves = 0, renders = 0;
  const host = { columns: 21, rows: 16, requestRender: () => { renders++; } };
  const screen = new Screen(engine, host, () => { saves++; });
  screen.handleInput('s');
  assert.equal(engine.state.phase, 'menu');
  assert.equal(saves, 0);
  host.columns = 46;
  screen.handleInput('s');
  assert.equal(engine.state.phase, 'hub');
  assert.equal(saves, 1);
  assert.equal(renders, 1);
  screen.handleInput('\r');
  assert.equal(engine.state.phase, 'play');
  screen.handleInput('\x1bOP');
  assert.equal(engine.state.hint, true);
  assert.equal(engine.state.startedAtMs, null);
});
