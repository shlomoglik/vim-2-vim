import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { emptyCommand, interpret } from '../src/command.js';
import { activate, advance, choose, hubLines, leaveComplete, navigate, newGame, play, resultKey, type Game } from '../src/game.js';
import { fitHeight, viewportStart } from '../src/layout.js';
import { LESSON_COUNT, NAVIGATION_COUNT, badges, challengeKeys, difficulties, lessonFor, stageIds, earnedBadges } from '../src/lessons.js';
import { editKey, newEdit } from '../src/editing.js';
import { editingMismatch, nextPreviewRows, previewRows } from '../src/editingGhost.js';
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

test('navigation reference routes and required coverage work at each difficulty', () => {
  assert.equal(LESSON_COUNT, 31);
  for (const difficulty of difficulties) for (let index = 0; index < NAVIGATION_COUNT; index++) {
    const lesson = lessonFor(index, difficulty, ['h', 'j', 'k', 'l', ...badges.slice(0, index).filter(b => b !== 'Counts' && b !== 'Navigator')] as Parameters<typeof lessonFor>[2]);
    assert.ok(lesson.lines.length >= 4);
    assert.ok(lesson.checkpoints.length >= 4);
    assert.ok(lesson.idealKeys.every(count => count > 0));
    lesson.checkpoints.forEach(target => assert.ok(target.col < lesson.lines[target.row]!.length));
    {
      let cursor = lesson.start;
      let state = emptyCommand();
      const unlocked = ['h', 'j', 'k', 'l', ...badges];
      const used = new Set<string>();
      lesson.referenceRoutes.forEach((route, stop) => {
        assert.equal(route.length, lesson.idealKeys[stop]);
        for (const key of route) {
          const outcome = interpret(lesson.lines, cursor, state, key, unlocked);
          assert.equal(outcome.message, '');
          if (outcome.executed) used.add(outcome.executed);
          cursor = outcome.cursor; state = outcome.state;
        }
        assert.deepEqual(cursor, lesson.checkpoints[stop]);
      });
      assert.ok(lesson.requiredCommands?.every(command => used.has(command)) ?? true);
    }
  }
});

test('navigation reference routes clear each difficulty in the game', () => {
  for (const difficulty of difficulties) {
    let game = choose(newGame({ ...newGame().progress, difficulty }), 'resume');
    for (let index = 0; index < NAVIGATION_COUNT; index++) {
      game = finish(activate(game));
      assert.equal(game.phase, 'reward', `${difficulty} ${stageIds[index]}`);
      game = advance(game);
      if (game.phase === 'complete') game = leaveComplete(game);
    }
    assert.equal(game.progress.completed, NAVIGATION_COUNT);
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
  assert.ok(game.progress.results[resultKey('normal', 0)]!.accuracy < 100);
  const progress = { ...game.progress, completed: 6, badges: earnedBadges(6) };
  let alternate = activate({ ...choose(newGame(progress), 'resume'), hubCursor: { row: 6, col: 0 } });
  for (const key of 'jjk$') alternate = play(alternate, key, 1000);
  assert.equal(alternate.checkpoint, 1);
  assert.equal(alternate.checkpointScores[0]?.actualKeys, 4);
});

test('navigation course, replay, saved history, and Navigator badge', () => {
  const file = join(mkdtempSync(join(tmpdir(), 'vim-to-vim-')), 'progress.json');
  let game = choose(newGame(), 'resume');
  for (let index = 0; index < NAVIGATION_COUNT; index++) {
    assert.equal(game.lesson, index);
    game = finish(activate(game));
    assert.equal(game.phase, 'reward');
    assert.equal(game.progress.completed, index + 1);
    saveProgress(game.progress, file);
    game = advance(game);
    game = choose(newGame(loadProgress(file)), 'resume');
  }
  assert.deepEqual(game.progress.badges, [...badges]);
  assert.equal(game.phase, 'hub');
  game = finish(activate({ ...game, lesson: 25, hubCursor: { row: 25, col: 0 } }));
  assert.equal(game.progress.attempts[resultKey('normal', 25)]?.length, 2);
  game = advance(game);
  assert.equal(game.phase, 'hub');
  game = leaveComplete(game);
  game = choose(game, 'restart');
  saveProgress(game.progress, file);
  assert.equal(loadProgress(file).completed, 0);
  assert.equal(loadProgress(file).attempts[resultKey('normal', 25)]?.length, 2);
});

test('hub scrolls through lessons and retains difficulty access', () => {
  assert.equal(challengeKeys.length, LESSON_COUNT);
  assert.equal(hubLines[0], '01 Four directions [h][j][k][l]');
  assert.equal(hubLines[10], '11 Measured jumps [3j][12G]');
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
  assert.equal(progress.attempts['normal:directions']?.[0]?.completedAt, null);
  assert.equal(choose(newGame(progress), 'resume').lesson, 3);
  writeFileSync(file, JSON.stringify({ completed: 21, badges: [...badges], results: { 'normal:20': result } }));
  const finished = loadProgress(file);
  assert.equal(finished.completed, NAVIGATION_COUNT);
  assert.ok(finished.badges.includes('Navigator'));
  assert.ok(finished.results['normal:percent']);
});

test('only successful executed motions satisfy Navigator coverage', () => {
  const lines = ['(one [two])', 'second'];
  const all = ['h', 'j', 'k', 'l', ...badges];
  const invalid = interpret(lines, { row: 0, col: 0 }, emptyCommand(), 'h', all);
  assert.equal(invalid.executed, undefined);
  const locked = interpret(lines, { row: 0, col: 0 }, emptyCommand(), '%', ['h']);
  assert.equal(locked.executed, undefined);
  const motion = interpret(lines, { row: 0, col: 0 }, emptyCommand(), '%', all);
  assert.equal(motion.executed, '%');
  const pending = interpret(lines, { row: 0, col: 0 }, emptyCommand(), 'f', all);
  assert.equal(pending.executed, undefined);
});

test('editing mode, repair, undo, redo, save, and quit', () => {
  let edit = newEdit(['  code = old']);
  let cursor = { row: 0, col: 9 };
  const all = ['h', 'j', 'k', 'l', ...badges];
  const press = (key: string) => { const result = editKey(edit, cursor, key, all); edit = result.edit; cursor = result.cursor; return result; };
  press('s'); assert.equal(edit.mode, 'insert');
  for (const key of 'new') press(key);
  press('escape');
  assert.equal(edit.mode, 'normal');
  assert.equal(edit.lines[0], '  code = newld');
  press('u'); assert.notEqual(edit.lines[0], '  code = newld');
  press('\x12'); assert.equal(edit.lines[0], '  code = newld');
  press(':'); press('w'); press('\n'); assert.equal(edit.saved, true);
  assert.equal(press(':').quit, false); press('q'); assert.equal(press('\n').quit, true);
  press('x'); assert.equal(edit.saved, false);
  press(':'); press('q'); assert.match(press('\n').message, /Save/);
});

test('Backspace deletes in Insert mode, including across a line break', () => {
  let edit = newEdit(['Ada', ' Lovelace']);
  let cursor = { row: 0, col: 2 };
  const press = (key: string) => { const result = editKey(edit, cursor, key, ['h', 'j', 'k', 'l']); edit = result.edit; cursor = result.cursor; };
  press('a');
  press('x');
  press('\x7f');
  assert.deepEqual(edit.lines, ['Ada', ' Lovelace']);
  assert.deepEqual(cursor, { row: 0, col: 3 });
  press('\n');
  assert.deepEqual(edit.lines, ['Ada', '', ' Lovelace']);
  press('backspace');
  assert.deepEqual(edit.lines, ['Ada', ' Lovelace']);
  assert.deepEqual(cursor, { row: 0, col: 3 });
  press('\x08');
  assert.deepEqual(edit.lines, ['Ad', ' Lovelace']);
  assert.deepEqual(cursor, { row: 0, col: 2 });
});

test('editing preview aligns missing text and lines with the live buffer', () => {
  assert.deepEqual(previewRows(['  name = Ada'], ['  name = Ada Lovelace']), [
    { source: '  name = Ada', target: '  name = Ada Lovelace', actualRow: 0, kind: 'live' },
  ]);
  const expected = ['# practice', '  title = Vim lab', '  status = ready', '  done'];
  assert.deepEqual(previewRows(['  title = Vim', '  status = ready'], expected), [
    { source: null, target: '# practice', actualRow: null, kind: 'insert' },
    { source: '  title = Vim', target: '  title = Vim lab', actualRow: 0, kind: 'live' },
    { source: '  status = ready', target: '  status = ready', actualRow: 1, kind: 'live' },
    { source: null, target: '  done', actualRow: null, kind: 'insert' },
  ]);
  assert.deepEqual(previewRows(['', '  title = Vim', '  status = ready'], expected)[0],
    { source: '', target: '# practice', actualRow: 0, kind: 'live' });
  assert.deepEqual(previewRows(['  spell = vmm'], ['  spell = vim']), [
    { source: '  spell = vmm', target: '  spell = vim', actualRow: 0, kind: 'live' },
    { source: null, target: '  spell = vim', actualRow: null, kind: 'replace' },
  ]);
  assert.equal(nextPreviewRows(['  title = Vim', '  status = ready'], expected).filter(row => row.kind === 'insert').length, 1);
  assert.equal(nextPreviewRows(['# practice', '  title = Vim', '  status = ready'], expected).filter(row => row.kind === 'insert').length, 0);
  assert.equal(editingMismatch(['', '# practice', '  title = Vim lab', '  status = ready', '  done'], expected),
    'Extra blank line 1. Use gg then dd to remove it.');
  assert.equal(editingMismatch(['  mode = new '], ['  mode = new']),
    'Extra trailing space on line 1, column 13. Delete it with x.');
  assert.equal(nextPreviewRows(['  mode = new '], ['  mode = new']).length, 1);
});

test('editing stage completes only when the repaired buffer is saved', () => {
  const progress = { ...newGame().progress, completed: NAVIGATION_COUNT, badges: earnedBadges(NAVIGATION_COUNT) };
  let game = activate({ ...choose(newGame(progress), 'resume'), hubCursor: { row: NAVIGATION_COUNT, col: 0 } });
  game = play(game, 'i', 1000);
  game = play(game, 'escape', 1000);
  for (const key of '/Ada\nea Lovelace') game = play(game, key, 1000);
  game = play(game, 'escape', 1000);
  assert.equal(game.edit?.lines[0], '  name = Ada Lovelace');
  assert.equal(game.phase, 'play');
  for (const key of ':w\n') game = play(game, key, 1100);
  assert.equal(game.phase, 'reward');
  assert.equal(game.progress.completed, NAVIGATION_COUNT + 1);
});

test('Ada lesson can be completed using the displayed instructions', () => {
  const progress = { ...newGame().progress, completed: NAVIGATION_COUNT, badges: earnedBadges(NAVIGATION_COUNT) };
  let game = activate({ ...choose(newGame(progress), 'resume'), hubCursor: { row: NAVIGATION_COUNT, col: 0 } });
  for (const key of ['i', 'escape', '$', 'a', ...' Lovelace', 'escape', ':', 'w', '\n']) game = play(game, key, 1000);
  assert.equal(game.phase, 'reward');
  assert.equal(game.edit?.lines[0], '  name = Ada Lovelace');
});

test('editing completion uses the saved file, regardless of commands used', () => {
  const progress = { ...newGame().progress, completed: NAVIGATION_COUNT, badges: earnedBadges(NAVIGATION_COUNT) };
  let game = activate({ ...choose(newGame(progress), 'resume'), hubCursor: { row: NAVIGATION_COUNT, col: 0 } });
  for (const key of ['$', 'a', ...' Lovelace', 'escape', ':', 'w', '\n']) game = play(game, key, 1000);
  assert.equal(game.phase, 'reward');
  const attempt = game.progress.attempts[resultKey(game.progress.difficulty, NAVIGATION_COUNT)]!.at(-1)!;
  assert.ok(attempt.commandsUsed?.includes('a'));
  assert.ok(attempt.commandsUsed?.includes('$'));
  assert.ok(!attempt.commandsUsed?.includes('i'));
  const file = join(mkdtempSync(join(tmpdir(), 'vim-to-vim-commands-')), 'progress.json');
  saveProgress(game.progress, file);
  assert.deepEqual(loadProgress(file).attempts[resultKey(game.progress.difficulty, NAVIGATION_COUNT)]!.at(-1)!.commandsUsed, attempt.commandsUsed);
});

test('extra blank line prevents completion until removed and saved', () => {
  const index = NAVIGATION_COUNT + 1;
  const progress = { ...newGame().progress, completed: index, badges: earnedBadges(index) };
  let game = activate({ ...choose(newGame(progress), 'resume'), hubCursor: { row: index, col: 0 } });
  game = { ...game, edit: { ...game.edit!, lines: ['', ...game.activeLesson!.editing!.expected], saved: true }, cursor: { row: 4, col: 0 } };
  for (const key of ['g', 'g', 'd', 'd']) game = play(game, key, 1000);
  assert.deepEqual(game.edit?.lines, game.activeLesson?.editing?.expected);
  assert.equal(game.phase, 'play');
  for (const key of ':w\n') game = play(game, key, 1000);
  assert.equal(game.phase, 'reward');
});

test('line editing and small repair stages accept their taught commands', () => {
  const run = (index: number, chunks: string[]) => {
    const progress = { ...newGame().progress, completed: index, badges: earnedBadges(index) };
    let game = activate({ ...choose(newGame(progress), 'resume'), hubCursor: { row: index, col: 0 } });
    for (const chunk of chunks) for (const key of chunk) game = play(game, key === '@' ? 'escape' : key, 1000);
    return game;
  };
  const lines = run(NAVIGATION_COUNT + 1, ['I', '@', 'A', ' lab', '@', 'O', '# practice', '@', 'G', 'o', '  done', '@', ':w\n']);
  assert.equal(lines.phase, 'reward');
  const repaired = run(NAVIGATION_COUNT + 2,
    ['/vmm\n', 'x', 'i', 'v', '@', 'l', 'ri', '/redy\n', 'l', 'a', 'a', '@', '/old\n', 's', 'n', '@', 'l', 're', 'l', 'rw', ':w\n']);
  assert.equal(repaired.phase, 'reward');
  assert.deepEqual(repaired.edit?.lines, ['  spell = vim', '  state = ready', '  mode = new']);
});

test('undo and redo are recorded in the editing stage', () => {
  const index = NAVIGATION_COUNT + 3;
  const progress = { ...newGame().progress, completed: index, badges: earnedBadges(index) };
  let game = activate({ ...choose(newGame(progress), 'resume'), hubCursor: { row: index, col: 0 } });
  const chunks = ['/wrong\n', 'rr', 'lri', 'lrg', 'lrh', 'lrt', 'u', '~', '/pending\n', 'rd', 'lro', 'lrn', 'lre', 'l', 'xxx', ':w\n'];
  for (const chunk of chunks) for (const key of chunk) game = play(game, key === '~' ? '\x12' : key, 1000);
  assert.equal(game.phase, 'reward');
  assert.ok(game.edit?.used.includes('u'));
  assert.ok(game.edit?.used.includes('Ctrl-R'));
});

test('final repair completes when the correct buffer is saved', () => {
  const index = LESSON_COUNT - 1;
  const progress = { ...newGame().progress, completed: index, badges: earnedBadges(index) };
  let game = activate({ ...choose(newGame(progress), 'resume'), hubCursor: { row: index, col: 0 } });
  const chunks = ['/opn\n', 'l', 'a', 'e', '@', '/Ad\n', 'e', 'a', 'a', '@', '/fail\n', 's', 'p', '@', 'll', 'rs', 'l', 'rs', ':w\n'];
  for (const chunk of chunks) for (const key of chunk) game = play(game, key === '@' ? 'escape' : key, 1000);
  assert.deepEqual(game.edit?.lines, ['  (task) = open', '  owner = Ada', '  result = pass']);
  assert.equal(game.edit?.saved, true);
  assert.equal(game.phase, 'reward');
  assert.equal(game.progress.completed, LESSON_COUNT);
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
