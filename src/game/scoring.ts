import { CENTISECOND_MS, CENTISECONDS_PER_MINUTE, CENTISECONDS_PER_SECOND, MAX_CHECKPOINT_SPEED, MAX_SCORE, MIN_ELAPSED_MS, PAR_MS_PER_KEY } from './constants.js';

// Vim Hero's public challenge scores each target against an ideal key sequence.
// Its default par is 250 ms per ideal key; speed may reach 110% per target,
// then the displayed lesson score is capped at 100%.
export { PAR_MS_PER_KEY } from './constants.js';

export type CheckpointScore = {
  idealKeys: number;
  actualKeys: number;
  elapsedMs: number;
  speed: number;
  accuracy: number;
};

export type LessonResult = {
  elapsedMs: number;
  actualKeys: number;
  idealKeys: number;
  speed: number;
  accuracy: number;
  proficiency: number;
};

export function scoreCheckpoint(idealKeys: number, actualKeys: number, elapsedMs: number): CheckpointScore {
  if (idealKeys < 1 || actualKeys < 1 || elapsedMs < 0) throw new RangeError('Invalid checkpoint score input');
  return {
    idealKeys, actualKeys, elapsedMs,
    speed: Math.min(MAX_CHECKPOINT_SPEED, (idealKeys * PAR_MS_PER_KEY / Math.max(elapsedMs, MIN_ELAPSED_MS)) * MAX_SCORE),
    accuracy: Math.min(MAX_SCORE, (idealKeys / actualKeys) * MAX_SCORE),
  };
}

export function scoreLesson(scores: readonly CheckpointScore[], elapsedMs: number): LessonResult {
  if (scores.length === 0 || elapsedMs < 0) throw new RangeError('Invalid lesson score input');
  const speed = Math.min(MAX_SCORE, Math.round(scores.reduce((sum, score) => sum + score.speed, 0) / scores.length));
  const accuracy = Math.min(MAX_SCORE, Math.round(scores.reduce((sum, score) => sum + score.accuracy, 0) / scores.length));
  return {
    elapsedMs,
    actualKeys: scores.reduce((sum, score) => sum + score.actualKeys, 0),
    idealKeys: scores.reduce((sum, score) => sum + score.idealKeys, 0),
    speed, accuracy, proficiency: Math.round((speed + accuracy) / 2),
  };
}

export function scoreCourse(results: readonly LessonResult[]): LessonResult | null {
  if (results.length === 0) return null;
  const speed = Math.round(results.reduce((sum, result) => sum + result.speed, 0) / results.length);
  const accuracy = Math.round(results.reduce((sum, result) => sum + result.accuracy, 0) / results.length);
  return {
    elapsedMs: results.reduce((sum, result) => sum + result.elapsedMs, 0),
    actualKeys: results.reduce((sum, result) => sum + result.actualKeys, 0),
    idealKeys: results.reduce((sum, result) => sum + result.idealKeys, 0),
    speed, accuracy, proficiency: Math.round((speed + accuracy) / 2),
  };
}

export function formatTime(ms: number): string {
  const centiseconds = Math.floor(Math.max(0, ms) / CENTISECOND_MS);
  const minutes = Math.floor(centiseconds / CENTISECONDS_PER_MINUTE);
  const seconds = Math.floor((centiseconds % CENTISECONDS_PER_MINUTE) / CENTISECONDS_PER_SECOND);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds % CENTISECONDS_PER_SECOND).padStart(2, '0')}`;
}

export function previousComparableAttempt<T extends { scoringVersion?: number }>(history: readonly T[]): T | undefined {
  const latest = history.at(-1);
  if (!latest || latest.scoringVersion === undefined) return undefined;
  return [...history.slice(0, -1)].reverse().find(attempt => attempt.scoringVersion === latest.scoringVersion);
}
