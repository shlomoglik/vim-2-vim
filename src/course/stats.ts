import type { Game } from '../game/state.js';
import { coursePracticeIds } from './curriculum.js';

export function navigateCourseStats(game: Game, key: string): Game {
  const selected = game.statsPracticeId ?? coursePracticeIds[0]!;
  if (key === 'h' || key === 'l') {
    const index = Math.max(0, Math.min(coursePracticeIds.length - 1, coursePracticeIds.indexOf(selected) + (key === 'l' ? 1 : -1)));
    return { ...game, statsPracticeId: coursePracticeIds[index]!, statsOffset: 0 };
  }
  const count = game.progress.attempts[`${game.progress.difficulty}:${selected}`]?.length ?? 0;
  if (key === 'j' || key === 'k') return { ...game, statsOffset: Math.max(0, Math.min(Math.max(0, count - 1), game.statsOffset + (key === 'j' ? 1 : -1))) };
  return game;
}
