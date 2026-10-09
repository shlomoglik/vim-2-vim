import { defaultLessonCatalog, type LessonCatalog } from '../lessons/LessonCatalog.js';
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
export type EngineOptions = { clock?: Clock; lessons?: Pick<LessonCatalog, 'create'> };
export type InputEffect = { persist: boolean };

/** Owns a game session. Terminal input, storage, and rendering are external adapters. */
export class GameEngine {
  private current: Game;
  readonly clock: Clock;
  private readonly lessons: Pick<LessonCatalog, 'create'>;

  constructor(progress?: Progress, options: EngineOptions = {}) {
    this.current = newGame(progress);
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
        }
        break;
      }
      case 'complete': if (enter) this.current = leaveComplete(before); break;
      case 'reward': if (enter) this.current = advance(before); break;
      case 'hub':
      case 'difficulty': {
        const searching = before.command.pending.startsWith('/') || before.command.pending.startsWith('?');
        this.current = enter && !searching ? activate(before, this.lessons) : navigate(before, key);
        break;
      }
      case 'stats': this.current = enter ? leaveStats(before) : navigateStats(before, key); break;
      case 'play': this.current = play(before, key, this.clock.now(), () => this.clock.timestamp()); break;
    }
    return { persist: restart || this.current.progress.difficulty !== before.progress.difficulty || before.phase === 'play' && this.current.phase === 'reward' };
  }
}
