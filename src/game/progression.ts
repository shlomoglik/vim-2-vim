import { returnToPractice } from '../course/browser.js';
import { stageIds } from '../lessons/catalog.js';
import { earnedBadges, LESSON_COUNT, NAVIGATION_COUNT } from '../lessons/index.js';
import { type LessonResult } from './scoring.js';
import { freshRun, resultKey, SCORING_VERSION, type Attempt, type Game, type Progress } from './state.js';

export function finishLesson(game: Game, result: LessonResult, nowMs: number, timestamp = () => new Date().toISOString()): Game {
  const newUnlock = game.lesson === game.progress.completed && (!game.course?.practiceId || game.course.practiceId === stageIds[game.lesson]);
  const completed = newUnlock ? game.progress.completed + 1 : game.progress.completed;
  const recordKey = game.course?.practiceId ? `${game.progress.difficulty}:${game.course.practiceId}` : resultKey(game.progress.difficulty, game.lesson);
  const attempt: Attempt = { ...result, completedAt: timestamp(), scoringVersion: SCORING_VERSION,
    commandsUsed: [...new Set(game.usedCommands)] };
  const progress: Progress = { ...game.progress, completed, badges: [...new Set([...game.progress.badges, ...earnedBadges(completed)])],
    results: { ...game.progress.results, [recordKey]: result },
    attempts: { ...game.progress.attempts, [recordKey]: [...(game.progress.attempts[recordKey] ?? []), attempt] } };
  return { ...game, progress, phase: 'reward', newUnlock, message: '', lastHitAtMs: nowMs };
}
export function advance(game: Game): Game {
  if (game.phase !== 'reward') return game;
  if (game.course?.practiceId) return returnToPractice(game);
  return { ...game, lesson: game.newUnlock ? Math.min(game.progress.completed, LESSON_COUNT - 1) : game.lesson,
    phase: game.progress.completed === LESSON_COUNT || game.newUnlock && game.progress.completed === NAVIGATION_COUNT ? 'complete' : 'hub', hubCursor: { row: game.newUnlock ? Math.min(game.progress.completed, LESSON_COUNT - 1) : game.lesson, col: 0 }, activeLesson: null,
    message: game.progress.completed === LESSON_COUNT ? 'All lessons clear! Replay any challenge.' : '', hint: false, ...freshRun() };
}
