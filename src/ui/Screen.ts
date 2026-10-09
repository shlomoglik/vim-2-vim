import { matchesKey, type Component } from '@earendil-works/pi-tui';
import type { GameEngine } from '../game/GameEngine.js';
import { MIN_TERMINAL_COLUMNS, MIN_TERMINAL_ROWS } from './constants.js';
import { GameRenderer } from './GameRenderer.js';

export interface ScreenHost {
  columns: number;
  rows: number;
  requestRender(): void;
}

export function normalizeKey(data: string): string {
  return matchesKey(data, 'f1') ? 'f1' : matchesKey(data, 'enter') ? '\n' :
    matchesKey(data, 'escape') ? 'escape' : matchesKey(data, 'backspace') ? 'backspace' : data;
}

export class Screen implements Component {
  constructor(
    private readonly engine: GameEngine,
    private readonly host: ScreenHost,
    private readonly persist: () => void,
    private readonly renderer = new GameRenderer(),
  ) {}

  invalidate(): void {}
  render(width: number): string[] {
    return this.renderer.render(this.engine.state, width, this.host.rows, this.engine.clock.now());
  }
  handleInput(data: string): void {
    if (this.host.columns < MIN_TERMINAL_COLUMNS || this.host.rows < MIN_TERMINAL_ROWS) return;
    if (this.engine.handleInput(normalizeKey(data)).persist) this.persist();
    this.host.requestRender();
  }
}
