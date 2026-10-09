import { defaultLessonCatalog, type LessonCatalog } from '../lessons/LessonCatalog.js';
import { difficulties, LESSON_COUNT } from '../lessons/index.js';
import { interpret } from '../vim/command.js';
import { startChallenge } from './session.js';
import { difficultyLines, hubLines, resultKey, unlockedCommands, type Game } from './state.js';

export function navigate(game: Game, key: string): Game {
  if (game.phase !== 'hub' && game.phase !== 'difficulty') return game;
  const lines = game.phase === 'hub' ? hubLines : difficultyLines;
  const field = game.phase === 'hub' ? 'hubCursor' : 'difficultyCursor';
  if (key === 'f1') return { ...game, message: 'Move with unlocked commands, then press Enter.' };
  const outcome = interpret(lines, game[field], game.command, key, unlockedCommands(game.progress));
  return { ...game, [field]: outcome.cursor, command: outcome.state, message: outcome.message };
}
export function activate(game: Game, lessons: Pick<LessonCatalog, 'create'> = defaultLessonCatalog): Game {
  if (game.phase === 'difficulty') {
    const difficulty = difficulties[game.difficultyCursor.row]!;
    return { ...game, phase: 'hub', progress: { ...game.progress, difficulty }, message: `Difficulty: ${difficulty}` };
  }
  if (game.phase !== 'hub') return game;
  if (game.hubCursor.row < LESSON_COUNT) {
    if (game.hubCursor.row > game.progress.completed) return { ...game, message: 'Challenge locked.' };
    return startChallenge({ ...game, lesson: game.hubCursor.row }, lessons);
  }
  if (game.hubCursor.row === LESSON_COUNT) return { ...game, phase: 'stats', statsOffset: 0, message: '' };
  if (game.hubCursor.row === LESSON_COUNT + 1) return { ...game, phase: 'difficulty', difficultyCursor: { row: difficulties.indexOf(game.progress.difficulty), col: 0 }, message: '' };
  return game;
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
