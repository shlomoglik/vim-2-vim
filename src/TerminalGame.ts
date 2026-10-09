import { ProcessTerminal, TUI, matchesKey } from '@earendil-works/pi-tui';
import { GameEngine } from './game/GameEngine.js';
import { FileProgressRepository, type ProgressRepository } from './persistence/progress.js';
import { AnimationController } from './ui/AnimationController.js';
import { ANIMATION_TICK_MS } from './ui/constants.js';
import { Screen } from './ui/Screen.js';

/** Composition and lifecycle for the terminal application. */
export class TerminalGame {
  private readonly terminal = new ProcessTerminal();
  private readonly tui = new TUI(this.terminal);
  private readonly engine: GameEngine;
  private animationTimer: ReturnType<typeof setInterval> | undefined;
  private stopped = false;
  private started = false;

  constructor(private readonly repository: ProgressRepository = new FileProgressRepository()) {
    this.engine = new GameEngine(repository.load());
  }

  start(): void {
    if (this.started || this.stopped) return;
    this.started = true;
    const app = this;
    const screen = new Screen(this.engine, {
      get columns() { return app.terminal.columns; },
      get rows() { return app.terminal.rows; },
      requestRender: () => this.tui.requestRender(),
    }, () => this.persist());
    this.tui.addChild(screen);
    this.tui.setFocus(screen);
    this.tui.addInputListener(data => {
      if (matchesKey(data, 'ctrl+c')) { this.stop(); process.exit(0); return { consume: true }; }
    });
    process.once('SIGTERM', this.onSignal);
    process.once('uncaughtException', this.onError);
    const animation = new AnimationController(this.engine.clock.now());
    this.animationTimer = setInterval(() => {
      if (animation.needsRender(this.engine.state, this.engine.clock.now())) this.tui.requestRender();
    }, ANIMATION_TICK_MS);
    this.terminal.write('\x1b[2J\x1b[H\x1b[3J');
    this.tui.start();
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    clearInterval(this.animationTimer);
    this.tui.stop();
    process.removeListener('SIGTERM', this.onSignal);
    process.removeListener('uncaughtException', this.onError);
  }

  private readonly onSignal = () => { this.stop(); process.exit(0); };
  private readonly onError = (error: Error) => { this.stop(); console.error(error); process.exit(1); };
  private persist(): void {
    try { this.repository.save(this.engine.state.progress); }
    catch (error) {
      this.stop();
      const path = this.repository instanceof FileProgressRepository ? ` to ${this.repository.path}` : '';
      console.error(`Could not save progress${path}: ${String(error)}`);
      process.exitCode = 1;
    }
  }
}
