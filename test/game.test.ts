import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { emptyCommand, interpret } from '../src/command.js';
import { activate, advance, choose, hubLines, leaveComplete, navigate, newGame, play, resultKey, type Game } from '../src/game.js';
import { fitHeight, viewportStart } from '../src/layout.js';
import { LESSON_COUNT, badges, challengeKeys, difficulties, lessonFor } from '../src/lessons.js';
import { move } from '../src/motion.js';
import { guideStep, motionGuideFor } from '../src/motionGuide.js';
import { loadProgress, saveProgress } from '../src/progress.js';
import { formatTime, previousComparableAttempt, scoreCheckpoint, scoreCourse, scoreLesson } from '../src/scoring.js';

function finish(game: Game, now = 1000): Game {
  const lesson = game.activeLesson!;
  for (let index = 0; index < lesson.checkpoints.length; index++) {
    const route = lesson.referenceRoutes[index]!;
    for (const key of route) { game = play(game, key, now); now += 100; }
    assert.equal(game.checkpoint, index + 1, `${lesson.title} checkpoint ${index + 1}`);
  }
  return game;
}

test('21 lessons have valid reference routes at each difficulty', () => {
  assert.equal(LESSON_COUNT, 21);
  for (const difficulty of difficulties) for (let index = 0; index < LESSON_COUNT; index++) {
    const lesson = lessonFor(index, difficulty, ['h', 'j', 'k', 'l', ...badges.slice(0, index).filter(b => b !== 'Counts' && b !== 'Navigator')] as Parameters<typeof lessonFor>[2]);
    assert.ok(lesson.lines.length >= 4);
    assert.ok(lesson.checkpoints.length >= 4);
    assert.ok(lesson.idealKeys.every(count => count > 0));
    lesson.checkpoints.forEach(target => assert.ok(target.col < lesson.lines[target.row]!.length));
    {
      let cursor = lesson.start;
      let state = emptyCommand();
      const unlocked = ['h', 'j', 'k', 'l', ...badges.slice(0, index)];
      lesson.referenceRoutes.forEach((route, stop) => {
        assert.equal(route.length, lesson.idealKeys[stop]);
        for (const key of route) {
          const outcome = interpret(lesson.lines, cursor, state, key, unlocked);
          assert.equal(outcome.message, '');
          cursor = outcome.cursor; state = outcome.state;
        }
        assert.deepEqual(cursor, lesson.checkpoints[stop]);
      });
    }
  }
});

test('motion interpreter handles boundaries, counts, cancellation, and locked commands', () => {
  const lines = ['  alpha beta', 'short', '  gamma', 'bottom'];
  const all = ['h', 'j', 'k', 'l', 'w', 'b', 'e', '0', '$', '^', 'gg', 'G', 'Counts'];
  const run = (sequence: string, start = { row: 0, col: 2 }, allowed = all) => {
    let cursor = start, state = emptyCommand();
    for (const key of sequence) { const result = interpret(lines, cursor, state, key, allowed); cursor = result.cursor; state = result.state; }
    return { cursor, state };
  };
  assert.deepEqual(run('10j').cursor, { row: 3, col: 2 });
  assert.deepEqual(run('0', { row: 0, col: 6 }).cursor, { row: 0, col: 0 });
  assert.deepEqual(run('3G').cursor, { row: 2, col: 2 });
  assert.deepEqual(run('gg', { row: 3, col: 0 }).cursor, { row: 0, col: 2 });
  assert.deepEqual(run('^', { row: 0, col: 0 }).cursor, { row: 0, col: 2 });
  assert.deepEqual(run('2$', { row: 0, col: 2 }).cursor, { row: 1, col: 4 });
  assert.deepEqual(run('jj', { row: 0, col: 9 }).cursor, { row: 2, col: 6 });
  assert.equal(run('12\x1b').state.pending, '');
  assert.equal(interpret(lines, { row: 0, col: 2 }, emptyCommand(), 'f', all).message, 'f is locked');
  assert.deepEqual(move(lines, { row: 0, col: 0 }, 'h'), { row: 0, col: 0 });
});

test('find, reverse find, search wrapping, and nested pairs', () => {
  const all = [...badges, 'h', 'j', 'k', 'l'];
  const lines = ['a x a x a', 'star moon', 'STAR star', '(a [b {c} d] e)'];
  let cursor = { row: 0, col: 0 }, state = emptyCommand();
  const type = (keys: string) => { for (const key of keys) { const result = interpret(lines, cursor, state, key, all); cursor = result.cursor; state = result.state; } return cursor; };
  assert.deepEqual(type('fa'), { row: 0, col: 4 });
  assert.deepEqual(type(';'), { row: 0, col: 8 });
  assert.deepEqual(type(','), { row: 0, col: 4 });
  assert.deepEqual(type('Fz'), { row: 0, col: 4 });
  cursor = { row: 0, col: 3 };
  assert.equal(interpret(lines, cursor, emptyCommand(), 't', all).state.pending, 't');
  let adjacent = interpret(lines, cursor, { ...emptyCommand(), pending: 't' }, 'a', all);
  assert.deepEqual(adjacent.cursor, cursor);
  assert.equal(adjacent.message, '');
  cursor = { row: 0, col: 4 };
  assert.deepEqual(type('/star\n'), { row: 1, col: 0 });
  assert.deepEqual(type('n'), { row: 2, col: 5 });
  assert.deepEqual(type('n'), { row: 1, col: 0 });
  assert.deepEqual(type('N'), { row: 2, col: 5 });
  cursor = { row: 3, col: 0 };
  assert.deepEqual(type('%'), { row: 3, col: 14 });
  cursor = { row: 3, col: 3 };
  assert.deepEqual(type('%'), { row: 3, col: 11 });
});

test('F1 is free, pending keys count, and alternate checkpoint routes complete', () => {
  let game = activate(choose(newGame(), 'resume'));
  game = play(game, 'f1', 100);
  assert.equal(game.startedAtMs, null);
  game = play(game, 'w', 200);
  assert.match(game.message, /locked/);
  game = finish(game, 300);
  assert.equal(game.phase, 'reward');
  assert.equal(game.progress.completed, 1);
  assert.ok(game.progress.results['normal:0']!.accuracy < 100);
  const progress = { ...game.progress, completed: 5, badges: [...badges.slice(0, 5)] };
  let alternate = activate({ ...choose(newGame(progress), 'resume'), hubCursor: { row: 5, col: 0 } });
  for (const key of 'jjk$') alternate = play(alternate, key, 1000);
  assert.equal(alternate.checkpoint, 1);
  assert.equal(alternate.checkpointScores[0]?.actualKeys, 4);
});

test('full course, replay, saved history, and Navigator badge', () => {
  const file = join(mkdtempSync(join(tmpdir(), 'vim-to-vim-')), 'progress.json');
  let game = choose(newGame(), 'resume');
  for (let index = 0; index < LESSON_COUNT; index++) {
    assert.equal(game.lesson, index);
    game = finish(activate(game));
    assert.equal(game.phase, 'reward');
    assert.equal(game.progress.completed, index + 1);
    saveProgress(game.progress, file);
    game = advance(game);
    game = choose(newGame(loadProgress(file)), 'resume');
  }
  assert.deepEqual(game.progress.badges, [...badges]);
  game = finish(activate({ ...game, lesson: 20, hubCursor: { row: 20, col: 0 } }));
  assert.equal(game.progress.attempts[resultKey('normal', 20)]?.length, 2);
  game = advance(game);
  assert.equal(game.phase, 'complete');
  game = leaveComplete(game);
  game = choose(game, 'restart');
  saveProgress(game.progress, file);
  assert.equal(loadProgress(file).completed, 0);
  assert.equal(loadProgress(file).attempts[resultKey('normal', 20)]?.length, 2);
});

test('hub scrolls through lessons and retains difficulty access', () => {
  assert.equal(challengeKeys.length, LESSON_COUNT);
  assert.equal(hubLines[0], '01 Four directions [h][j][k][l]');
  assert.equal(hubLines[9], '10 Measured jumps [3j][12G]');
  let game = choose(newGame(), 'resume');
  assert.match(navigate(game, 'w').message, /locked/);
  for (let i = 0; i < LESSON_COUNT + 1; i++) game = navigate(game, 'j');
  game = activate(game);
  assert.equal(game.phase, 'difficulty');
  game = navigate(game, 'j');
  game = activate(game);
  assert.equal(game.progress.difficulty, 'hard');
  const searched: Game = { ...game, progress: { ...game.progress, completed: 16, badges: [...badges.slice(0, 16)] }, hubCursor: { row: 0, col: 0 } };
  let found = searched;
  for (const key of '/View\n') found = navigate(found, key);
  assert.equal(found.hubCursor.row, LESSON_COUNT);
});

test('old progress migrates, including legacy attempts', () => {
  const file = join(mkdtempSync(join(tmpdir(), 'vim-to-vim-old-')), 'progress.json');
  const result = scoreLesson([scoreCheckpoint(2, 2, 500)], 500);
  writeFileSync(file, JSON.stringify({ completed: 3, badges: ['w', 'b', 'e'], results: { 0: result } }));
  const progress = loadProgress(file);
  assert.equal(progress.completed, 3);
  assert.equal(progress.attempts['normal:0']?.[0]?.completedAt, null);
  assert.equal(choose(newGame(progress), 'resume').lesson, 3);
});

test('guide sequences, scores, and compact layout', () => {
  for (const badge of badges) assert.ok(motionGuideFor(badge).sequence.length > 0);
  assert.equal(guideStep(3000), 1);
  assert.equal(guideStep(3300), 2);
  assert.deepEqual(fitHeight(['TOP'], ['MIDDLE'], ['BOTTOM'], 5), ['TOP', 'MIDDLE', '', '', 'BOTTOM']);
  assert.equal(viewportStart(6, 3, 4, 5), 3);
  const result = scoreLesson([scoreCheckpoint(2, 2, 500)], 500);
  assert.equal(scoreCourse([result, result])?.elapsedMs, 1000);
  assert.equal(formatTime(61520), '01:01.52');
  assert.equal(previousComparableAttempt([{ scoringVersion: 2, id: 1 }, { id: 2 }, { scoringVersion: 2, id: 3 }])?.id, 1);
  assert.equal(previousComparableAttempt([{ id: 1 }, { scoringVersion: 2, id: 2 }]), undefined);
});
