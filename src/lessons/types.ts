import type { Motion, Position } from '../vim/motion.js';

export type Lesson = {
  title: string;
  instruction: string;
  hint: string;
  lines: readonly string[];
  start: Position;
  checkpoints: readonly Position[];
  idealKeys: readonly number[];
  badge: string | null;
  referenceRoutes: readonly string[];
  id: string;
  requiredCommands?: readonly string[];
  editing?: { filename: string; expected: readonly string[]; requireSave: boolean };
  goals?: readonly PracticeGoal[];
  mission?: { completeMessage: string };
  pace?: { msPerKey: number; thinkingMs: number };
};

export type PracticeGoal = Pick<Lesson, 'lines' | 'start' | 'instruction' | 'hint' | 'editing'> & {
  target: Position;
  keys: readonly string[];
  requiredCommands: readonly string[];
  focus: boolean;
  stageTitle?: string;
  shortHint?: string;
  successMessage?: string;
  bonuses?: readonly BonusObjective[];
};


export type Difficulty = 'easy' | 'normal' | 'hard';
export type LessonFactory = (index: number, difficulty: Difficulty, unlocked: readonly Motion[]) => Lesson;

export type NavigationPractice = {
  lines: readonly string[];
  start: Position;
  routes: readonly string[];
};
export type NavigationDefinition = Pick<Lesson, 'title' | 'instruction' | 'hint'> & {
  createPractice(difficulty: Difficulty): NavigationPractice;
};
export type EditingDefinition = {
  lines: string[];
  expected: string[];
  instruction: string;
  hint: string;
  referenceKeys?: number;
  start?: Position;
};

export type BonusObjective = { id: string; label: string; shortLabel?: string } & (
  { kind: 'count' } | { kind: 'keys'; maxKeys: number } |
  { kind: 'commands' | 'avoid'; commands: readonly string[] }
);
export type BonusResult = { id: string; label: string; earned: boolean };
