import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { DEFAULT_DIFFICULTY, MAX_SCORE } from '../game/constants.js';
import type { LessonResult } from '../game/scoring.js';
import { blankProgress, type Attempt, type Progress } from '../game/state.js';
import { badges, difficulties, earnedBadges, legacyIds, LESSON_COUNT, NAVIGATION_COUNT, stageIds, type Difficulty } from '../lessons/catalog.js';

const PROGRESS_SCHEMA_VERSION = 2;

function validResult(value: unknown): value is LessonResult {
  if (typeof value !== 'object' || value === null) return false;
  const result = value as Partial<LessonResult>;
  return Number.isFinite(result.elapsedMs) && result.elapsedMs! >= 0 &&
    Number.isInteger(result.actualKeys) && result.actualKeys! >= 1 &&
    Number.isInteger(result.idealKeys) && result.idealKeys! >= 1 &&
    [result.speed, result.accuracy, result.proficiency].every(score => Number.isInteger(score) && score! >= 0 && score! <= MAX_SCORE);
}
function validAttempt(value: unknown): value is Attempt {
  if (!validResult(value)) return false;
  const attempt = value as Attempt;
  return (attempt.completedAt === null || typeof attempt.completedAt === 'string' && Number.isFinite(Date.parse(attempt.completedAt))) &&
    (attempt.scoringVersion === undefined || Number.isInteger(attempt.scoringVersion) && attempt.scoringVersion > 0) &&
    (attempt.commandsUsed === undefined || Array.isArray(attempt.commandsUsed) && attempt.commandsUsed.every(command => typeof command === 'string'));
}
const validKey = (key: string) => {
  const match = /^(easy|normal|hard):(.+)$/.exec(key);
  return !!match && stageIds.includes(match[2] as typeof stageIds[number]);
};

export function progressPath(): string {
  return process.env.VIM_TO_VIM_PROGRESS_FILE ?? join(process.env.XDG_STATE_HOME ?? join(homedir(), '.local', 'state'), 'vim-to-vim', 'progress.json');
}

export function loadProgress(path = progressPath()): Progress {
  try {
    const data: unknown = JSON.parse(readFileSync(path, 'utf8'));
    if (typeof data !== 'object' || data === null) return blankProgress();
    const value = data as Partial<Progress> & { schemaVersion?: number };
    const legacy = value.schemaVersion !== PROGRESS_SCHEMA_VERSION;
    if (!Number.isInteger(value.completed) || value.completed! < 0 || value.completed! > (legacy ? legacyIds.length : LESSON_COUNT) ||
        !Array.isArray(value.badges) || !(legacy ? value.badges.length === value.completed && value.badges.every((badge, index) => badge === badges[index]) :
          value.badges.every(badge => badges.includes(badge as typeof badges[number])) && earnedBadges(value.completed!).every(badge => value.badges!.includes(badge)))) return blankProgress();
    const completed = legacy ? value.completed === legacyIds.length ? NAVIGATION_COUNT :
      value.completed === 0 ? 0 : stageIds.indexOf(legacyIds[value.completed!]!) : value.completed!;
    const normalizedKey = (key: string): string => {
      const match = /^(easy|normal|hard):(\d+)$/.exec(key);
      if (match && Number(match[2]) < legacyIds.length) return `${match[1]}:${legacyIds[Number(match[2])]}`;
      if (legacy && /^\d+$/.test(key) && Number(key) < legacyIds.length) return `normal:${legacyIds[Number(key)]}`;
      return key;
    };
    const difficulty: Difficulty = difficulties.includes(value.difficulty as Difficulty) ? value.difficulty as Difficulty : DEFAULT_DIFFICULTY;
    const results: Record<string, LessonResult> = {};
    if (typeof value.results === 'object' && value.results !== null && !Array.isArray(value.results)) {
      for (const [key, result] of Object.entries(value.results)) {
        const normalized = normalizedKey(key);
        if (validKey(normalized) && validResult(result)) results[normalized] = result;
      }
    }
    const attempts: Record<string, Attempt[]> = {};
    if (typeof value.attempts === 'object' && value.attempts !== null && !Array.isArray(value.attempts)) {
      for (const [key, history] of Object.entries(value.attempts)) {
        const normalized = normalizedKey(key);
        if (!validKey(normalized) || !Array.isArray(history)) continue;
        const valid = history.filter(validAttempt);
        if (valid.length) attempts[normalized] = valid;
      }
    }
    for (const [key, result] of Object.entries(results)) {
      if (!attempts[key]) attempts[key] = [{ ...result, completedAt: null }];
    }
    for (const [key, history] of Object.entries(attempts)) {
      const { completedAt: _, scoringVersion: __, commandsUsed: ___, ...latest } = history[history.length - 1]!;
      results[key] = latest;
    }
    return { completed, badges: [...new Set([...value.badges, ...earnedBadges(completed)])], difficulty, results, attempts };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return blankProgress();
    throw error;
  }
}

export function saveProgress(progress: Progress, path = progressPath()): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify({ ...progress, schemaVersion: PROGRESS_SCHEMA_VERSION }, null, 2) + '\n', { mode: 0o600 });
  renameSync(temporary, path);
}

/** File storage adapter; the engine can run with another repository or none at all. */
export interface ProgressRepository {
  load(): Progress;
  save(progress: Progress): void;
}

export class FileProgressRepository implements ProgressRepository {
  constructor(readonly path = progressPath()) {}
  load(): Progress { return loadProgress(this.path); }
  save(progress: Progress): void { saveProgress(progress, this.path); }
}
