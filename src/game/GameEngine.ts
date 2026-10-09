import { navigateCourseStats } from '../course/stats.js';
import { browseCourse, newCourseState, openCourse, returnToPractice, type CourseLessonProvider } from '../course/browser.js';
import { defaultLessonCatalog } from '../lessons/LessonCatalog.js';
import { activate, leaveComplete, leaveStats, navigate, navigateStats } from './navigation.js';
import { play } from './play.js';
import { advance } from './progression.js';
import { choose } from './session.js';
import { newGame, type Game, type Progress } from './state.js';

export interface Clock {
  now(): number;
  timestamp(): string;
}
export const systemClock: Clock = {
  now: () => performance.now(),
  timestamp: () => new Date().toISOString(),
};
export type EngineOptions = { clock?: Clock; lessons?: CourseLessonProvider; navigation?: 'course' | 'legacy' };
export type InputEffect = { persist: boolean };

/** Owns a game session. Terminal input, storage, and rendering are external adapters. */
export class GameEngine {
  private current: Game;
  readonly clock: Clock;
  private readonly lessons: CourseLessonProvider;
  private readonly groupedCourse: boolean;

  constructor(progress?: Progress, options: EngineOptions = {}) {
    this.groupedCourse = options.navigation !== 'legacy';
    this.current = this.groupedCourse ? { ...newGame(progress), course: newCourseState() } : newGame(progress);
    this.clock = options.clock ?? systemClock;
    this.lessons = options.lessons ?? defaultLessonCatalog;
  }

  get state(): Game { return this.current; }

  /** Keys are normalized by the input adapter; pending Vim sequences stay in game state. */
  handleInput(key: string): InputEffect {
    const before = this.current;
    const enter = key === '\n';
    let restart = false;
    switch (before.phase) {
      case 'menu': {
        const choice = key.toLowerCase();
        if (choice === 'r' || choice === 's') {
          restart = choice === 's';
          this.current = choose(before, restart ? 'restart' : 'resume');
          if (this.groupedCourse) this.current = openCourse(this.current);
        }
        break;
      }
      case 'course': this.current = browseCourse(before, key, this.lessons, this.clock.now()); break;
      case 'complete': if (enter) this.current = before.course ? openCourse(before) : leaveComplete(before); break;
      case 'reward': if (enter) this.current = advance(before); break;
      case 'hub':
      case 'difficulty': {
        const searching = before.command.pending.startsWith('/') || before.command.pending.startsWith('?');
        if (key === 'escape' && before.course && !before.command.pending) this.current = { ...before, phase: 'course' };
        else {
          this.current = enter && !searching ? activate(before, this.lessons) : navigate(before, key);
          if (before.course && this.current.phase === 'hub') this.current = { ...this.current, phase: 'course' };
        }
        break;
      }
      case 'stats': this.current = enter || key === 'escape' ? before.course ? { ...before, phase: 'course' } : leaveStats(before) : before.course ? navigateCourseStats(before, key) : navigateStats(before, key); break;
      case 'play': {
        const canceling = before.edit ? before.edit.mode !== 'normal' || !!before.edit.pending || !!before.edit.navigation.pending : !!before.command.pending;
        this.current = key === 'escape' && before.course?.practiceId && !canceling ? returnToPractice(before) : play(before, key, this.clock.now(), () => this.clock.timestamp());
        if (before.course?.practiceId && this.current.phase === 'hub') this.current = returnToPractice(this.current);
        break;
      }
    }
    return { persist: restart || this.current.progress.difficulty !== before.progress.difficulty || before.phase === 'play' && this.current.phase === 'reward' };
  }
}
