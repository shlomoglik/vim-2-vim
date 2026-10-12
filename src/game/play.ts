import { navigationCommands } from '../course/curriculum.js';
import { stageBadge } from '../lessons/index.js';
import { interpret } from '../vim/command.js';
import { editKey, newEdit } from '../vim/editing.js';
import { practiceGoal } from '../course/practices.js';
import { finishLesson } from './progression.js';
import { scoreCheckpoint, scoreLesson } from './scoring.js';
import { unlockedCommands, type Game } from './state.js';

function completeGoal(game: Game, nowMs: number, timestamp?: () => string): Game {
  const lesson = game.activeLesson!;
  const score = scoreCheckpoint(lesson.idealKeys[game.checkpoint]!, game.keysThisCheckpoint, nowMs - game.checkpointAtMs!);
  const required = lesson.goals![game.checkpoint]!.requiredCommands;
  const used = lesson.editing ? game.edit!.used : game.usedCommands.slice(game.goalCommandOffset ?? 0);
  if (required.length) {
    score.expectedCommands = required.length;
    score.matchedCommands = required.filter(command => used.includes(command)).length;
    score.accuracy *= score.matchedCommands / score.expectedCommands;
  }
  const checkpointScores = [...game.checkpointScores, score];
  const checkpoint = game.checkpoint + 1;
  const hit = { ...game, checkpoint, checkpointScores, checkpointAtMs: nowMs, keysThisCheckpoint: 0,
    lastHit: game.cursor, lastHitAtMs: nowMs, message: 'Goal complete!' };
  if (checkpoint === lesson.checkpoints.length) return finishLesson(hit, scoreLesson(checkpointScores, nowMs - game.startedAtMs!), nowMs, timestamp);
  const next = practiceGoal(lesson, checkpoint);
  const board = game.edit?.lines ?? lesson.lines;
  const sameBoard = board.length === next.lines.length && board.every((line, row) => line === next.lines[row]);
  const cursor = sameBoard ? { ...game.cursor } : { ...next.start };
  return { ...hit, activeLesson: { ...next, start: cursor }, cursor, command: { ...game.command, pending: '', lastFind: null, lastSearch: null, preferredCol: null },
    edit: next.editing ? newEdit(next.lines) : null, goalCommandOffset: game.usedCommands.length, lastHit: null };
}

export function play(game: Game, key: string, nowMs = performance.now(), timestamp?: () => string): Game {
  if (game.phase !== 'play' || !game.activeLesson) return game;
  if (key === 'f1') return { ...game, hint: !game.hint, message: '' };
  const lesson = game.activeLesson;
  if (lesson.editing && game.edit) {
    const outcome = editKey(game.edit, game.cursor, key, game.course?.practiceId ? navigationCommands : unlockedCommands(game.progress));
    const timed = { ...game, edit: outcome.edit, cursor: outcome.cursor, message: outcome.message,
      startedAtMs: game.startedAtMs ?? nowMs, checkpointAtMs: game.checkpointAtMs ?? nowMs,
      keysThisCheckpoint: game.keysThisCheckpoint + 1, usedCommands: [...game.usedCommands, ...outcome.edit.used.filter(command => !game.edit!.used.includes(command))] };
    const correct = outcome.edit.lines.length === lesson.editing.expected.length && outcome.edit.lines.every((line, row) => line === lesson.editing!.expected[row]);
    if (outcome.quit && !correct) return { ...timed, phase: 'hub', activeLesson: null, message: 'File saved. Return to finish the repair.' };
    if (!correct || !outcome.edit.saved) return timed;
    if (lesson.goals) {
      return completeGoal(timed, nowMs, timestamp);
    }
    return finishLesson(timed, scoreLesson([scoreCheckpoint(lesson.idealKeys[0]!, timed.keysThisCheckpoint, nowMs - timed.startedAtMs!)], nowMs - timed.startedAtMs!), nowMs, timestamp);
  }
  const timed = { ...game, startedAtMs: game.startedAtMs ?? nowMs,
    checkpointAtMs: game.checkpointAtMs ?? nowMs, keysThisCheckpoint: game.keysThisCheckpoint + 1 };
  const outcome = interpret(lesson.lines, game.cursor, game.command, key, game.course?.practiceId ? navigationCommands : [...unlockedCommands(game.progress), stageBadge(game.lesson) ?? '']);
  const cursor = outcome.cursor;
  timed.command = outcome.state;
  timed.usedCommands = outcome.executed ? [...game.usedCommands, outcome.executed] : game.usedCommands;
  const goal = lesson.checkpoints[game.checkpoint]!;
  if (!outcome.moved || cursor.row !== goal.row || cursor.col !== goal.col) return { ...timed, cursor, message: outcome.message };
  if (lesson.goals) {
    return completeGoal({ ...timed, cursor }, nowMs, timestamp);
  }
  const score = scoreCheckpoint(lesson.idealKeys[game.checkpoint]!, timed.keysThisCheckpoint, nowMs - timed.checkpointAtMs!);
  const checkpointScores = [...game.checkpointScores, score];
  const checkpoint = game.checkpoint + 1;
  const hit = { ...timed, cursor, checkpoint, checkpointScores, checkpointAtMs: nowMs,
    keysThisCheckpoint: 0, lastHit: cursor, lastHitAtMs: nowMs, message: 'Checkpoint!' };
  if (checkpoint < lesson.checkpoints.length) return hit;
  const missing = lesson.requiredCommands?.filter(command => !timed.usedCommands.includes(command)) ?? [];
  if (missing.length) return { ...timed, checkpoint: game.checkpoint, message: `Still needed: ${missing.join(' ')}` };
  const result = scoreLesson(checkpointScores, nowMs - timed.startedAtMs!);
  return finishLesson(hit, result, nowMs, timestamp);
}
