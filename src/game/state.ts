import { challengeKeys, challengeTitles, difficulties, LESSON_COUNT, stageIds, type Difficulty, type Lesson } from '../lessons/index.js';
import { emptyCommand, type CommandState } from '../vim/command.js';
import type { EditState } from '../vim/editing.js';
import type { Motion, Position } from '../vim/motion.js';
import { DEFAULT_DIFFICULTY } from './constants.js';
import type { CheckpointScore, LessonResult } from './scoring.js';
export { challengeTitles } from '../lessons/catalog.js';
export { SCORING_VERSION } from './constants.js';

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
export const blankProgress = (): Progress => ({ completed: 0, badges: [], difficulty: DEFAULT_DIFFICULTY, results: {}, attempts: {} });
export const freshRun = () => ({ startedAtMs: null, checkpointAtMs: null, keysThisCheckpoint: 0,
  checkpointScores: [] as CheckpointScore[], lastHit: null as Position | null, lastHitAtMs: null as number | null });
export const hubLines = stageIds.map((_, i) => `${String(i + 1).padStart(2, '0')} ${challengeTitles[i]} ${challengeKeys[i]!.map(key => `[${key}]`).join('')}`).concat('View stats', 'Set difficulty');
export const difficultyLines = ['Easy', 'Normal', 'Hard'];
export const newGame = (progress: Progress = blankProgress()): Game => ({
  phase: 'menu', lesson: Math.min(progress.completed, LESSON_COUNT - 1), checkpoint: 0,
  cursor: { row: 0, col: 0 }, hubCursor: { row: Math.min(progress.completed, LESSON_COUNT - 1), col: 0 }, difficultyCursor: { row: difficulties.indexOf(progress.difficulty), col: 0 },
  activeLesson: null, progress, message: '', hint: false, newUnlock: false, statsOffset: 0, ...freshRun(),
  command: emptyCommand(), usedCommands: [], edit: null,
});
