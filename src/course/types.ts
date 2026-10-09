import type { CommandState } from '../vim/command.js';
import type { EditState } from '../vim/editing.js';
import type { Position } from '../vim/motion.js';

export type CourseExample = {
  id: string;
  command: string;
  description: string;
  lines: readonly string[];
  start: Position;
  keys: readonly string[];
  expected?: readonly string[];
};
export type CourseTopic = {
  id: string;
  title: string;
  group: string;
  commands: readonly string[];
  examples: readonly CourseExample[];
  legacyPractices?: readonly string[];
};
export type CourseSection = { id: string; title: string; topics: readonly CourseTopic[] };
export type CourseView = 'sections' | 'topics' | 'lesson' | 'examples' | 'practice';
export type DemoState = { index: number; step: number; cursor: Position; command: CommandState; edit: EditState | null; message: string; startedAtMs: number };
export type CourseState = {
  view: CourseView;
  sectionId: string | null;
  topicId: string | null;
  cursor: Position;
  demo: DemoState | null;
  practiceId: string | null;
  cursors: Partial<Record<CourseView, Position>>;
};
