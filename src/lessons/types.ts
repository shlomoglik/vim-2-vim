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
