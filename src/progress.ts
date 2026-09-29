import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { blankProgress, type Attempt, type Progress } from './game.js';
import { badges, difficulties, LESSON_COUNT, type Difficulty } from './lessons.js';
import type { LessonResult } from './scoring.js';

function validResult(value: unknown): value is LessonResult {
  if (typeof value !== 'object' || value === null) return false;
  const result = value as Partial<LessonResult>;
  return Number.isFinite(result.elapsedMs) && result.elapsedMs! >= 0 &&
    Number.isInteger(result.actualKeys) && result.actualKeys! >= 1 &&
    Number.isInteger(result.idealKeys) && result.idealKeys! >= 1 &&
    [result.speed, result.accuracy, result.proficiency].every(score => Number.isInteger(score) && score! >= 0 && score! <= 100);
}
function validAttempt(value: unknown): value is Attempt {
  if (!validResult(value)) return false;
  const attempt = value as Attempt;
  return (attempt.completedAt === null || typeof attempt.completedAt === 'string' && Number.isFinite(Date.parse(attempt.completedAt))) &&
    (attempt.scoringVersion === undefined || Number.isInteger(attempt.scoringVersion) && attempt.scoringVersion > 0);
}
const validKey = (key: string) => {
  const match = /^(easy|normal|hard):(\d+)$/.exec(key);
  return !!match && Number(match[2]) < LESSON_COUNT;
};

export function progressPath(): string {
  return process.env.VIM_TO_VIM_PROGRESS_FILE ?? join(process.env.XDG_STATE_HOME ?? join(homedir(), '.local', 'state'), 'vim-to-vim', 'progress.json');
}

export function loadProgress(path = progressPath()): Progress {
  try {
    const data: unknown = JSON.parse(readFileSync(path, 'utf8'));
    if (typeof data !== 'object' || data === null) return blankProgress();
    const value = data as Partial<Progress>;
    if (!Number.isInteger(value.completed) || value.completed! < 0 || value.completed! > LESSON_COUNT ||
        !Array.isArray(value.badges) || value.badges.length !== value.completed ||
        !value.badges.every((badge, index) => badge === badges[index])) return blankProgress();
    const difficulty: Difficulty = difficulties.includes(value.difficulty as Difficulty) ? value.difficulty as Difficulty : 'normal';
    const results: Record<string, LessonResult> = {};
    if (typeof value.results === 'object' && value.results !== null && !Array.isArray(value.results)) {
      for (const [key, result] of Object.entries(value.results)) {
        const normalized = /^\d+$/.test(key) ? `normal:${key}` : key;
        if (validKey(normalized) && validResult(result)) results[normalized] = result;
      }
    }
    const attempts: Record<string, Attempt[]> = {};
    if (typeof value.attempts === 'object' && value.attempts !== null && !Array.isArray(value.attempts)) {
      for (const [key, history] of Object.entries(value.attempts)) {
        if (!validKey(key) || !Array.isArray(history)) continue;
        const valid = history.filter(validAttempt);
        if (valid.length) attempts[key] = valid;
      }
    }
    for (const [key, result] of Object.entries(results)) {
      if (!attempts[key]) attempts[key] = [{ ...result, completedAt: null }];
    }
    for (const [key, history] of Object.entries(attempts)) {
      const { completedAt: _, scoringVersion: __, ...latest } = history[history.length - 1]!;
      results[key] = latest;
    }
    return { completed: value.completed!, badges: value.badges, difficulty, results, attempts };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return blankProgress();
    throw error;
  }
}

export function saveProgress(progress: Progress, path = progressPath()): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify(progress, null, 2) + '\n', { mode: 0o600 });
  renameSync(temporary, path);
}
