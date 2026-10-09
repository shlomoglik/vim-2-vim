import { defaultLessonCatalog, type LessonCatalog } from '../lessons/LessonCatalog.js';
import { emptyCommand } from '../vim/command.js';
import { newEdit } from '../vim/editing.js';
import { blankProgress, freshRun, newGame, unlockedMotions, type Game } from './state.js';

export function choose(game: Game, choice: 'resume' | 'restart'): Game {
  const progress = choice === 'restart' ? { ...blankProgress(), results: game.progress.results, attempts: game.progress.attempts } : game.progress;
  return { ...newGame(progress), phase: 'hub' };
}
export function startChallenge(game: Game, lessons: Pick<LessonCatalog, 'create'> = defaultLessonCatalog): Game {
  if (game.phase !== 'hub') return game;
  const activeLesson = lessons.create(game.lesson, game.progress.difficulty, unlockedMotions(game.progress));
  return { ...game, phase: 'play', activeLesson, cursor: activeLesson.start, checkpoint: 0,
    message: '', hint: false, newUnlock: false, command: emptyCommand(), usedCommands: [], edit: activeLesson.editing ? newEdit(activeLesson.lines) : null, ...freshRun() };
}
