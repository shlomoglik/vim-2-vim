import { truncateToWidth, visibleWidth } from '@earendil-works/pi-tui';
import { challengeTitles, hubLines } from '../../game/state.js';
import { challengeKeys, LESSON_COUNT } from '../../lessons/index.js';
import type { Position } from '../../vim/motion.js';
import { BOX_MIN_WIDTH, PANEL_WIDTH } from '../constants.js';
import { viewportStart } from '../layout.js';
import { cyan, paint } from '../styles.js';

export function selectorPanel(options: readonly string[], cursor: Position, width: number, filename: string, visibleRows: number, pending = '', unlockedThrough?: number): string[] {
  const boxed = width >= BOX_MIN_WIDTH;
  const panelWidth = boxed ? Math.min(width, PANEL_WIDTH) : width;
  const contentWidth = panelWidth - (boxed ? 2 : 0);
  const gutterWidth = boxed ? 7 : 5;
  const textWidth = contentWidth - gutterWidth;
  const base = '\x1b[0;48;5;236;38;5;253m';
  const ghost = '\x1b[0;48;5;236;38;5;241m';
  const firstRow = viewportStart(options.length, visibleRows, cursor.row);
  const rows = Array.from({ length: visibleRows }, (_, offset) => {
    const row = firstRow + offset;
    const source = options[row];
    if (source === undefined) return `\x1b[48;5;234;38;5;245m${boxed ? '~  │   ' : '~ │  '}${base}${' '.repeat(textWidth)}\x1b[0m`;
    const locked = unlockedThrough !== undefined && row < LESSON_COUNT && row > unlockedThrough;
    const ink = locked ? ghost : base;
    const label = boxed ? `${String(row + 1).padStart(2)} │ ` : `${String(row + 1).padStart(2)}│`;
    const arrow = row === cursor.row ? '\x1b[48;5;234;1;96m›' : locked ? '\x1b[48;5;234;38;5;240m›' : '\x1b[48;5;234;38;5;245m›';
    let line = `\x1b[48;5;234;38;5;${locked ? 240 : 245}m${label}${arrow} ${ink}`;
    const lockedWordStart = locked && source.endsWith(' locked') ? source.length - 'locked'.length : -1;
    for (let col = 0; col < textWidth; col++) {
      const char = source[col] ?? ' ';
      if (col === lockedWordStart) line += base;
      if (col === source.length && lockedWordStart >= 0) line += ghost;
      const charInk = col >= lockedWordStart && col < source.length && lockedWordStart >= 0 ? base : ink;
      line += row === cursor.row && col === cursor.col ? `\x1b[38;5;240;48;5;255m${char}${charInk}` : char;
    }
    return `${line}\x1b[0m`;
  });
  const status = paint('1;30;106', truncateToWidth(` ${pending.startsWith('/') || pending.startsWith('?') ? 'SEARCH' : 'NORMAL'}  ${pending || filename} ${cursor.row + 1}:${cursor.col + 1}`.padEnd(contentWidth), contentWidth));
  if (!boxed) return [...rows, status];
  return [cyan(`╭${'─'.repeat(panelWidth - 2)}╮`), ...rows.map(row => `${cyan('│')}${row}${cyan('│')}`),
    cyan(`├${'─'.repeat(panelWidth - 2)}┤`), `${cyan('│')}${status}${cyan('│')}`, cyan(`╰${'─'.repeat(panelWidth - 2)}╯`)];
}

export function courseOptions(width: number, completed: number): string[] {
  const textWidth = width >= BOX_MIN_WIDTH ? Math.min(width, PANEL_WIDTH) - 9 : width - 5;
  return hubLines.map((line, index) => {
    if (index >= LESSON_COUNT) return line;
    const keys = challengeKeys[index]!.map(key => `[${key}]`).join('');
    const locked = index > completed;
    if (width >= PANEL_WIDTH) return locked ? `${line} locked` : line;
    const titleWidth = Math.max(0, textWidth - visibleWidth(keys) - 1);
    const title = challengeTitles[index]!.slice(0, titleWidth);
    return title ? `${title} ${keys}` : keys;
  });
}

