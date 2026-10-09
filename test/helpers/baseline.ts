import { createHash } from 'node:crypto';
import { difficulties, stageIds, badges, lessonFor } from '../../src/lessons/index.js';
import { GameRenderer } from '../../src/ui/GameRenderer.js';
import { screenScenarios, screenSizes, SCREEN_TIME } from './scenarios.js';

export type Baseline = { lessons: Record<string, string>; screens: Record<string, string> };
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function captureBaseline(): Baseline {
  const lessons = Object.fromEntries(difficulties.flatMap(difficulty => stageIds.map((id, index) => {
    const unlocked = ['h', 'j', 'k', 'l', ...badges.slice(0, index).filter(b => b !== 'Counts' && b !== 'Navigator')];
    return [`${difficulty}:${id}`, hash(lessonFor(index, difficulty, unlocked as Parameters<typeof lessonFor>[2]))];
  })));
  const previousTimezone = process.env.TZ;
  process.env.TZ = 'UTC';
  try {
    const renderer = new GameRenderer();
    const screens = Object.fromEntries(Object.entries(screenScenarios()).flatMap(([name, game]) => screenSizes.map(([width, height]) =>
      [`${name}:${width}x${height}`, hash(renderer.render(game, width, height, SCREEN_TIME))])));
    return { lessons, screens };
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimezone;
  }
}
