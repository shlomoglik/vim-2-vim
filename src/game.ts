import { challengeKeys, difficulties, earnedBadges, legacyIds, lessonFor, LESSON_COUNT, NAVIGATION_COUNT, stageBadge, stageIds, type Difficulty, type Lesson } from './lessons.js';
import { editKey, newEdit, type EditState } from './editing.js';
import { type Motion, type Position } from './motion.js';
import { scoreCheckpoint, scoreLesson, type CheckpointScore, type LessonResult } from './scoring.js';
import { emptyCommand, interpret, type CommandState } from './command.js';

export const SCORING_VERSION = 2;
export type Attempt = LessonResult & { completedAt: string | null; scoringVersion?: number; commandsUsed?: string[] };
export type Progress = { completed: number; badges: string[]; difficulty: Difficulty; results: Record<string, LessonResult>; attempts: Record<string, Attempt[]> };
export type Phase = 'menu' | 'hub' | 'difficulty' | 'stats' | 'play' | 'reward' | 'complete';
export type Game = {
  phase: Phase; lesson: number; checkpoint: number; cursor: Position; hubCursor: Position;
  difficultyCursor: Position; activeLesson: Lesson | null; progress: Progress; message: string; hint: boolean;
  startedAtMs: number | null; checkpointAtMs: number | null; keysThisCheckpoint: number;
  checkpointScores: CheckpointScore[]; lastHit: Position | null; lastHitAtMs: number | null;
  newUnlock: boolean; statsOffset: number;
  command: CommandState;
  usedCommands: string[]; edit: EditState | null;
};
const base: Motion[] = ['h', 'j', 'k', 'l'];
const simpleMotions: readonly string[] = ['w', 'b', 'e', '0', '$', '^', 'gg', 'G'];
export const unlockedMotions = (progress: Progress): Motion[] => [...base, ...progress.badges.filter(b => simpleMotions.includes(b)) as Motion[]];
export const unlockedCommands = (progress: Progress): string[] => [...base, ...progress.badges];
export const resultKey = (difficulty: Difficulty, lesson: number) => `${difficulty}:${stageIds[lesson]}`;
export const blankProgress = (): Progress => ({ completed: 0, badges: [], difficulty: 'normal', results: {}, attempts: {} });
const freshRun = () => ({ startedAtMs: null, checkpointAtMs: null, keysThisCheckpoint: 0,
  checkpointScores: [] as CheckpointScore[], lastHit: null as Position | null, lastHitAtMs: null as number | null });
const oldTitles = [
  'Four directions', 'Jump forward', 'Jump backward', 'Word end', 'Line start',
  'Line end', 'First visible character', 'File start', 'File end', 'Measured jumps',
  'Find forward', 'Find backward', 'Stop before', 'Stop after', 'Repeat character find',
  'Reverse character find', 'Search forward', 'Search backward', 'Repeat search',
  'Reverse search', 'Matching pairs',
];
export const challengeTitles = stageIds.map(id => {
  const old = legacyIds.indexOf(id as typeof legacyIds[number]);
  return old >= 0 ? oldTitles[old]! : id === 'navigator' ? 'Navigator challenge' : id.startsWith('review-') ? `Review: ${id.slice(7)}` : `Editing: ${id.slice(5)}`;
});
export const hubLines = stageIds.map((_, i) => `${String(i + 1).padStart(2, '0')} ${challengeTitles[i]} ${challengeKeys[i]!.map(key => `[${key}]`).join('')}`).concat('View stats', 'Set difficulty');
export const difficultyLines = ['Easy', 'Normal', 'Hard'];
export const newGame = (progress: Progress = blankProgress()): Game => ({
  phase: 'menu', lesson: Math.min(progress.completed, LESSON_COUNT - 1), checkpoint: 0,
  cursor: { row: 0, col: 0 }, hubCursor: { row: Math.min(progress.completed, LESSON_COUNT - 1), col: 0 }, difficultyCursor: { row: difficulties.indexOf(progress.difficulty), col: 0 },
  activeLesson: null, progress, message: '', hint: false, newUnlock: false, statsOffset: 0, ...freshRun(),
  command: emptyCommand(), usedCommands: [], edit: null,
});
export function choose(game: Game, choice: 'resume' | 'restart'): Game {
  const progress = choice === 'restart' ? { ...blankProgress(), results: game.progress.results, attempts: game.progress.attempts } : game.progress;
  return { ...newGame(progress), phase: 'hub' };
}
export function startChallenge(game: Game): Game {
  if (game.phase !== 'hub') return game;
  const activeLesson = lessonFor(game.lesson, game.progress.difficulty, unlockedMotions(game.progress));
  return { ...game, phase: 'play', activeLesson, cursor: activeLesson.start, checkpoint: 0,
    message: '', hint: false, newUnlock: false, command: emptyCommand(), usedCommands: [], edit: activeLesson.editing ? newEdit(activeLesson.lines) : null, ...freshRun() };
}
export function navigate(game: Game, key: string): Game {
  if (game.phase !== 'hub' && game.phase !== 'difficulty') return game;
  const lines = game.phase === 'hub' ? hubLines : difficultyLines;
  const field = game.phase === 'hub' ? 'hubCursor' : 'difficultyCursor';
  if (key === 'f1') return { ...game, message: 'Move with unlocked commands, then press Enter.' };
  const outcome = interpret(lines, game[field], game.command, key, unlockedCommands(game.progress));
  return { ...game, [field]: outcome.cursor, command: outcome.state, message: outcome.message };
}
export function activate(game: Game): Game {
  if (game.phase === 'difficulty') {
    const difficulty = difficulties[game.difficultyCursor.row]!;
    return { ...game, phase: 'hub', progress: { ...game.progress, difficulty }, message: `Difficulty: ${difficulty}` };
  }
  if (game.phase !== 'hub') return game;
  if (game.hubCursor.row < LESSON_COUNT) {
    if (game.hubCursor.row > game.progress.completed) return { ...game, message: 'Challenge locked.' };
    return startChallenge({ ...game, lesson: game.hubCursor.row });
  }
  if (game.hubCursor.row === LESSON_COUNT) return { ...game, phase: 'stats', statsOffset: 0, message: '' };
  if (game.hubCursor.row === LESSON_COUNT + 1) return { ...game, phase: 'difficulty', difficultyCursor: { row: difficulties.indexOf(game.progress.difficulty), col: 0 }, message: '' };
  return game;
}
export function play(game: Game, key: string, nowMs = performance.now()): Game {
  if (game.phase !== 'play' || !game.activeLesson) return game;
  if (key === 'f1') return { ...game, hint: !game.hint, message: '' };
  const lesson = game.activeLesson;
  if (lesson.editing && game.edit) {
    const outcome = editKey(game.edit, game.cursor, key, unlockedCommands(game.progress));
    const timed = { ...game, edit: outcome.edit, cursor: outcome.cursor, message: outcome.message,
      startedAtMs: game.startedAtMs ?? nowMs, keysThisCheckpoint: game.keysThisCheckpoint + 1, usedCommands: outcome.edit.used };
    const correct = outcome.edit.lines.length === lesson.editing.expected.length && outcome.edit.lines.every((line, row) => line === lesson.editing!.expected[row]);
    if (outcome.quit && !correct) return { ...timed, phase: 'hub', activeLesson: null, message: 'File saved. Return to finish the repair.' };
    if (!correct || !outcome.edit.saved) return timed;
    return finishLesson(timed, scoreLesson([scoreCheckpoint(lesson.idealKeys[0]!, timed.keysThisCheckpoint, nowMs - timed.startedAtMs!)], nowMs - timed.startedAtMs!), nowMs);
  }
  const timed = { ...game, startedAtMs: game.startedAtMs ?? nowMs,
    checkpointAtMs: game.checkpointAtMs ?? nowMs, keysThisCheckpoint: game.keysThisCheckpoint + 1 };
  const outcome = interpret(lesson.lines, game.cursor, game.command, key, [...unlockedCommands(game.progress), stageBadge(game.lesson) ?? '']);
  const cursor = outcome.cursor;
  timed.command = outcome.state;
  timed.usedCommands = outcome.executed ? [...game.usedCommands, outcome.executed] : game.usedCommands;
  const goal = lesson.checkpoints[game.checkpoint]!;
  if (!outcome.moved || cursor.row !== goal.row || cursor.col !== goal.col) return { ...timed, cursor, message: outcome.message };
  const score = scoreCheckpoint(lesson.idealKeys[game.checkpoint]!, timed.keysThisCheckpoint, nowMs - timed.checkpointAtMs!);
  const checkpointScores = [...game.checkpointScores, score];
  const checkpoint = game.checkpoint + 1;
  const hit = { ...timed, cursor, checkpoint, checkpointScores, checkpointAtMs: nowMs,
    keysThisCheckpoint: 0, lastHit: cursor, lastHitAtMs: nowMs, message: 'Checkpoint!' };
  if (checkpoint < lesson.checkpoints.length) return hit;
  const missing = lesson.requiredCommands?.filter(command => !timed.usedCommands.includes(command)) ?? [];
  if (missing.length) return { ...timed, checkpoint: game.checkpoint, message: `Still needed: ${missing.join(' ')}` };
  const result = scoreLesson(checkpointScores, nowMs - timed.startedAtMs!);
  return finishLesson(hit, result, nowMs);
}
function finishLesson(game: Game, result: LessonResult, nowMs: number): Game {
  const newUnlock = game.lesson === game.progress.completed;
  const completed = newUnlock ? game.progress.completed + 1 : game.progress.completed;
  const recordKey = resultKey(game.progress.difficulty, game.lesson);
  const attempt: Attempt = { ...result, completedAt: new Date().toISOString(), scoringVersion: SCORING_VERSION,
    commandsUsed: [...new Set(game.usedCommands)] };
  const progress: Progress = { ...game.progress, completed, badges: [...new Set([...game.progress.badges, ...earnedBadges(completed)])],
    results: { ...game.progress.results, [recordKey]: result },
    attempts: { ...game.progress.attempts, [recordKey]: [...(game.progress.attempts[recordKey] ?? []), attempt] } };
  return { ...game, progress, phase: 'reward', newUnlock, message: '', lastHitAtMs: nowMs };
}
export function advance(game: Game): Game {
  if (game.phase !== 'reward') return game;
  return { ...game, lesson: game.newUnlock ? Math.min(game.progress.completed, LESSON_COUNT - 1) : game.lesson,
    phase: game.progress.completed === LESSON_COUNT || game.newUnlock && game.progress.completed === NAVIGATION_COUNT ? 'complete' : 'hub', hubCursor: { row: game.newUnlock ? Math.min(game.progress.completed, LESSON_COUNT - 1) : game.lesson, col: 0 }, activeLesson: null,
    message: game.progress.completed === LESSON_COUNT ? 'All lessons clear! Replay any challenge.' : '', hint: false, ...freshRun() };
}
export function leaveComplete(game: Game): Game { return game.phase === 'complete' ? { ...game, phase: 'hub' } : game; }
export function leaveStats(game: Game): Game { return game.phase === 'stats' ? { ...game, phase: 'hub' } : game; }
export function navigateStats(game: Game, key: string): Game {
  if (game.phase !== 'stats') return game;
  if (key === 'h' || key === 'l') return { ...game, lesson: Math.max(0, Math.min(LESSON_COUNT - 1, game.lesson + (key === 'l' ? 1 : -1))), statsOffset: 0 };
  const count = game.progress.attempts[resultKey(game.progress.difficulty, game.lesson)]?.length ?? 0;
  if (key === 'j' || key === 'k') return { ...game, statsOffset: Math.max(0, Math.min(Math.max(0, count - 1), game.statsOffset + (key === 'j' ? 1 : -1))) };
  return game;
}
