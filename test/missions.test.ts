import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { visibleWidth } from '@earendil-works/pi-tui';
import { courseEntries, newCourseState } from '../src/course/browser.js';
import { courseMotions, coursePracticeIds, courseTopics, navigationCommands, practiceTitle } from '../src/course/curriculum.js';
import { puzzleMissions } from '../src/course/missionCatalog.js';
import { createPuzzleMission } from '../src/course/missions.js';
import { editKey } from '../src/vim/editing.js';
import { interpret } from '../src/vim/command.js';
import { evaluateBonuses } from '../src/game/bonuses.js';
import { GameEngine } from '../src/game/GameEngine.js';
import { difficulties } from '../src/lessons/catalog.js';
import { LessonCatalog } from '../src/lessons/LessonCatalog.js';
import { loadProgress, saveProgress } from '../src/persistence/progress.js';
import { GameRenderer } from '../src/ui/GameRenderer.js';
import { newGame } from '../src/game/state.js';

const clock = { now: () => 1000, timestamp: () => '2026-10-12T12:00:00Z' };
function openMission(id: string, difficulty = 'normal' as typeof difficulties[number]): GameEngine {
  const mission = puzzleMissions.find(mission => mission.id === id)!;
  const course = { ...newCourseState(), expandedTopics: [mission.topicId] };
  const progress = { ...newGame().progress, difficulty };
  const row = courseEntries({ ...newGame(progress), course }).findIndex(entry => entry.id === id);
  assert.ok(row >= 0, `${id}: puzzle must be visible in its expanded topic`);
  const engine = new GameEngine(progress, { clock });
  engine.handleInput('r');
  const topic = courseTopics.find(topic => topic.id === mission.topicId)!;
  input(engine, [...`/${topic.title}\n`]);
  engine.handleInput('\n');
  input(engine, [...`/${mission.title}\n`]);
  engine.handleInput('\n');
  assert.equal(engine.state.phase, 'play');
  assert.equal(engine.state.course!.topicId, mission.topicId);
  assert.equal(engine.state.activeLesson!.id, id);
  return engine;
}
function input(engine: GameEngine, sequence: readonly string[]): void {
  for (const key of sequence) engine.handleInput(key);
}
const harborId = 'puzzle:copy-paste:harbor';

test('named puzzle menu entries launch and complete every mission at every difficulty', () => {
  const catalog = new LessonCatalog();
  for (const difficulty of difficulties) for (const mission of puzzleMissions) {
    const engine = openMission(mission.id, difficulty);
    const lesson = engine.state.activeLesson!;
    assert.equal(catalog.createById(mission.id, difficulty, courseMotions).id, lesson.id);
    assert.equal(lesson.goals!.length, mission.stages);
    assert.ok(coursePracticeIds.includes(mission.id));
    assert.equal(practiceTitle(mission.id), `Puzzle: ${mission.title}`);
    for (const [index, goal] of lesson.goals!.entries()) {
      for (const key of goal.keys) {
        const before = engine.state;
        const landing = before.edit ? editKey(before.edit, before.cursor, key, navigationCommands).cursor :
          interpret(before.activeLesson!.lines, before.cursor, before.command, key, navigationCommands).cursor;
        engine.handleInput(key);
        if (engine.state.checkpoint > index) {
          assert.deepEqual(engine.state.cursor, landing, `${mission.id}: stage transition moved the player`);
          break;
        }
      }
      assert.equal(engine.state.checkpoint, index + 1, `${mission.id}: stage ${index + 1}`);
      if (index < lesson.goals!.length - 1) assert.deepEqual(engine.state.cursor, lesson.goals![index + 1]!.start);
    }
    assert.equal(engine.state.phase, 'reward');
    assert.equal(engine.state.progress.completed, 0);
    assert.deepEqual(engine.state.progress.badges, []);
    const attempt = engine.state.progress.attempts[`${difficulty}:${mission.id}`]![0]!;
    assert.equal(attempt.bonuses!.length, mission.stages);
    engine.handleInput('\n');
    assert.equal(engine.state.phase, 'course');
    assert.ok(courseEntries(engine.state).find(entry => entry.id === mission.id)!.label.includes('✓'));
  }
});

test('harbor bonuses can all be earned and persist with their own attempt history', () => {
  const engine = openMission(harborId);
  input(engine, [...'j11l']);
  assert.equal(engine.state.checkpoint, 1);
  assert.equal(engine.state.message, 'Boat spotted!');
  input(engine, [...'dd4jp:w\n']);
  assert.equal(engine.state.checkpoint, 2);
  assert.equal(engine.state.message, 'Boat rescued!');
  const last = engine.state.activeLesson!.goals![2]!;
  assert.ok(last.lines.includes('CARGO'));
  assert.ok(last.lines[6]!.includes('_____/'));
  input(engine, last.keys);
  assert.equal(engine.state.phase, 'reward');
  const key = `normal:${harborId}`;
  const bonuses = engine.state.progress.attempts[key]![0]!.bonuses!;
  assert.deepEqual(bonuses.map(bonus => bonus.earned), [true, true, true]);
  const file = join(mkdtempSync(join(tmpdir(), 'vim-mission-')), 'progress.json');
  saveProgress(engine.state.progress, file);
  assert.deepEqual(loadProgress(file).attempts[key]![0]!.bonuses, bonuses);
  const stats = new GameRenderer().render({ ...engine.state, phase: 'stats', statsPracticeId: harborId }, 80, 40, 1000).join('\n');
  assert.match(stats, /Mission complete · 3\/3 bonuses/);
});

test('harbor completes with no bonuses and an alternate editing solution', () => {
  const engine = openMission(harborId);
  const lesson = engine.state.activeLesson!;
  input(engine, lesson.goals![0]!.keys);
  input(engine, lesson.goals![1]!.keys);
  const target = lesson.goals![2]!.editing!.expected.join('\n');
  input(engine, [...'ggVGc', ...target, 'escape', ':', 'w', '\n']);
  assert.equal(engine.state.phase, 'reward');
  const bonuses = engine.state.progress.attempts[`normal:${harborId}`]![0]!.bonuses!;
  assert.deepEqual(bonuses.map(bonus => bonus.earned), [false, false, false]);
  const rendered = new GameRenderer().render(engine.state, 80, 40, 1000).join('\n');
  assert.match(rendered, /MISSION COMPLETE/);
  assert.match(rendered, /Harbor restored!/);
  assert.match(rendered, /BONUSES 0\/3 \(optional\)/);
  assert.doesNotMatch(rendered, /SPEED|PROFICIENCY/);
});

test('bonus objectives evaluate each stage separately and never require an exact route', () => {
  const objectives = [
    { id: 'count', label: 'Use a count', kind: 'count' as const },
    { id: 'avoid', label: 'No h/l movement', kind: 'avoid' as const, commands: ['h', 'l'] },
    { id: 'budget', label: 'Use at most 5 keys', kind: 'keys' as const, maxKeys: 5 },
  ];
  assert.deepEqual(evaluateBonuses(objectives, ['Counts', 'f'], 5, 2).map(bonus => bonus.earned), [true, true, true]);
  assert.deepEqual(evaluateBonuses(objectives, ['h'], 6, 3).map(bonus => bonus.earned), [false, false, false]);
});

test('mission screens preserve the board and navigation on small and large terminals', () => {
  const engine = openMission(harborId);
  const lesson = createPuzzleMission(harborId, 'normal', []);
  const states = [engine.state];
  engine.handleInput('f1'); states.push(engine.state); engine.handleInput('f1');
  for (const goal of lesson.goals!) { input(engine, goal.keys); states.push(engine.state); }
  const renderer = new GameRenderer();
  for (const state of states) for (const [width, height] of [[22, 16], [32, 24], [46, 32], [80, 40]]) {
    const lines = renderer.render(state, width!, height!, 1000);
    assert.equal(lines.length, height);
    assert.ok(lines.every(line => visibleWidth(line) <= width!));
    const plain = lines.join('\n').replace(/\x1b\[[0-9;]*m/g, '');
    if (state.phase === 'play') {
      assert.match(plain, /MISSION/);
      assert.match(plain, /F1 hint/);
      assert.match(plain, /NORMAL/);
      if (state.hint) {
        assert.match(plain, /TIP/);
        if (width! < 46 || height! < 28) assert.match(plain, /TIP.*jlllllllllll/);
      }
    } else assert.match(plain, /Back to puzzles/);
  }
});


test('column adventures use visible stone structures and keep one board across every stage', () => {
  for (const id of ['puzzle:word-movement:islands', 'puzzle:WORD-movement:islands']) {
    const engine = openMission(id);
    const lesson = engine.state.activeLesson!;
    const board = lesson.lines;
    assert.deepEqual(board, [
      ' _____     _____     _____ ',
      '/II_II\\   /II_II\\   /II_II\\',
      '|II_II|   |II_II|   |II_II|',
      '|II_II|   |II_II|   |II_II|',
      '/_____\\   /_____\\   /_____\\',
    ]);
    for (const [index, stage] of lesson.goals!.entries()) {
      input(engine, stage.keys);
      if (index < lesson.goals!.length - 1) {
        assert.deepEqual(engine.state.activeLesson!.lines, board);
        assert.deepEqual(engine.state.cursor, stage.target);
        assert.deepEqual(engine.state.activeLesson!.start, stage.target);
        assert.notDeepEqual(engine.state.activeLesson!.checkpoints[index + 1], stage.target);
      }
    }
    assert.equal(engine.state.phase, 'reward');
  }
});

test('harbor keeps an alternate landing position and rebases the cargo hint from there', () => {
  const engine = openMission(harborId);
  input(engine, [...'j11l']);
  input(engine, [...'dd4jp$:w\n']);
  assert.equal(engine.state.checkpoint, 2);
  const landing = { row: 6, col: 28 };
  assert.deepEqual(engine.state.cursor, landing);
  assert.deepEqual(engine.state.activeLesson!.start, landing);
  const continued = engine.state.activeLesson!.goals![2]!;
  assert.deepEqual(continued.start, landing);
  input(engine, continued.keys);
  assert.equal(engine.state.phase, 'reward');
});


test('treasure trail visits all four bags before camp and finishes each route on its first target hit', () => {
  const engine = openMission('puzzle:basic-movement:treasure');
  const lesson = engine.state.activeLesson!;
  assert.equal(engine.state.edit, null);
  input(engine, ['f1', 'f1', 'z']);
  assert.equal(engine.state.checkpoint, 0, 'hints and stationary input cannot collect a bag');
  const bags = new Set<string>();
  for (const [index, stage] of lesson.goals!.entries()) {
    const symbol = stage.lines[stage.target.row]![stage.target.col];
    assert.equal(symbol, index < 4 ? '$' : '^');
    if (index < 4) bags.add(`${stage.target.row}:${stage.target.col}`);
    assert.notDeepEqual(stage.start, stage.target);
    for (const [step, key] of stage.keys.entries()) {
      const before = engine.state;
      const landing = interpret(stage.lines, before.cursor, before.command, key, navigationCommands).cursor;
      engine.handleInput(key);
      assert.equal(engine.state.checkpoint, index + (step === stage.keys.length - 1 ? 1 : 0));
      if (step === stage.keys.length - 1) {
        assert.deepEqual(engine.state.cursor, landing);
        if (index < 4) assert.deepEqual(engine.state.activeLesson!.lines, lesson.lines);
      }
    }
  }
  assert.equal(bags.size, 4);
  assert.equal(engine.state.phase, 'reward');
  assert.ok(engine.state.progress.attempts['normal:puzzle:basic-movement:treasure']![0]!.bonuses!.every(bonus => bonus.earned));
});

test('garden requires edits and saves, preserves alternate landing, and rebases the watering route', () => {
  const engine = openMission('puzzle:replace-delete:garden');
  input(engine, [...':w\n']);
  assert.equal(engine.state.checkpoint, 0);
  // Delete to the end instead of plucking with x, then walk back to the title.
  input(engine, [...'Dgg0']);
  assert.equal(engine.state.checkpoint, 0, 'the correct buffer still needs saving');
  const repaired = [...engine.state.edit!.lines];
  const landing = { ...engine.state.cursor };
  assert.deepEqual(landing, { row: 0, col: 0 });
  input(engine, [...':w\n']);
  assert.equal(engine.state.checkpoint, 1);
  assert.deepEqual(engine.state.cursor, landing);
  assert.deepEqual(engine.state.activeLesson!.lines, repaired);
  const next = engine.state.activeLesson!.goals![1]!;
  assert.deepEqual(next.start, landing);
  assert.equal(engine.state.activeLesson!.idealKeys[1], next.keys.length);
  assert.equal(next.shortHint, next.keys.map(key => key === '\n' ? 'Enter' : key).join(''));
  input(engine, next.keys);
  assert.equal(engine.state.phase, 'reward');
  assert.deepEqual(engine.state.progress.attempts['normal:puzzle:replace-delete:garden']![0]!.bonuses!.map(bonus => bonus.earned), [false, true]);
});

test('new puzzle stages and hints fit small and large terminals', () => {
  const renderer = new GameRenderer();
  for (const id of ['puzzle:basic-movement:treasure', 'puzzle:replace-delete:garden']) {
    const engine = openMission(id);
    const lesson = engine.state.activeLesson!;
    const states = [];
    for (const stage of lesson.goals!) {
      states.push(engine.state);
      engine.handleInput('f1');
      states.push(engine.state);
      engine.handleInput('f1');
      input(engine, stage.keys);
    }
    states.push(engine.state);
    for (const state of states) for (const [width, height] of [[22, 16], [32, 24], [46, 32], [80, 40]]) {
      const lines = renderer.render(state, width!, height!, 3000);
      assert.equal(lines.length, height);
      assert.ok(lines.every(line => visibleWidth(line) <= width!));
      const plain = lines.join('\n').replace(/\x1b\[[0-9;]*m/g, '');
      assert.match(plain, state.phase === 'play' ? /MISSION/ : /MISSION COMPLETE/);
      if (state.hint) assert.match(plain, /TIP/);
    }
  }
});
