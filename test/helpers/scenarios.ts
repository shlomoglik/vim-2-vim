import { activate, advance, choose, newGame, play, resultKey, type Game } from '../../src/game.js';
import { earnedBadges, NAVIGATION_COUNT } from '../../src/lessons.js';

export const SCREEN_TIME = 4000;
export function screenScenarios(): Record<string, Game> {
  const menu = newGame();
  const hub = choose(menu, 'resume');
  let reward = activate(hub);
  let now = 1000;
  for (const route of reward.activeLesson!.referenceRoutes) {
    for (const key of route) { reward = play(reward, key, now); now += 100; }
  }
  const recordKey = resultKey(reward.progress.difficulty, reward.lesson);
  reward = { ...reward, progress: { ...reward.progress, attempts: { ...reward.progress.attempts, [recordKey]: reward.progress.attempts[recordKey]!.map(attempt => ({ ...attempt, completedAt: '2026-01-01T12:00:00.000Z' })) } } };
  const editingIndex = NAVIGATION_COUNT + 1;
  const edit = activate({ ...choose(newGame({ ...menu.progress, completed: editingIndex, badges: earnedBadges(editingIndex) }), 'resume'), hubCursor: { row: editingIndex, col: 0 } });
  return {
    menu, hub, difficulty: { ...hub, phase: 'difficulty' },
    play: activate(hub), hint: play(activate(hub), 'f1', 1000),
    checkpoint: { ...activate(hub), checkpoint: 1, cursor: { row: 0, col: 4 }, lastHit: { row: 0, col: 4 }, lastHitAtMs: 3900 },
    reward, replayHub: advance(reward), stats: { ...reward, phase: 'stats' },
    complete: { ...reward, phase: 'complete' }, editing: edit,
    insert: play(edit, 'i', 1000),
  };
}
export const screenSizes = [[21, 15], [22, 16], [31, 20], [32, 24], [46, 32], [80, 40]] as const;
