import { truncateToWidth, visibleWidth } from '@earendil-works/pi-tui';
import { challengeTitles, hubLines } from '../../game/state.js';
import { challengeKeys, LESSON_COUNT } from '../../lessons/index.js';
import type { Position } from '../../vim/motion.js';
import { BOX_MIN_WIDTH, PANEL_WIDTH } from '../constants.js';
import { viewportStart } from '../layout.js';
import { cyan, paint } from '../styles.js';

type SelectorAppearance = { firstRow?: number; expandedRows?: ReadonlySet<number>; headingRows?: ReadonlySet<number> };

export function selectorPanel(options: readonly string[], cursor: Position, width: number, filename: string, visibleRows: number, pending = '', unlockedThrough?: number, pinnedRows = 0, contextRow = cursor.row, maxWidth = PANEL_WIDTH, appearance: SelectorAppearance = {}): string[] {
  const boxed = width >= BOX_MIN_WIDTH;
  const panelWidth = boxed ? Math.min(width, maxWidth) : width;
  const contentWidth = panelWidth - (boxed ? 2 : 0);
  const numberWidth = Math.max(2, String(options.length).length);
  const gutterWidth = numberWidth + (boxed ? 5 : 3);
  const textWidth = contentWidth - gutterWidth;
  const base = '\x1b[0;48;5;236;38;5;253m';
  const ghost = '\x1b[0;48;5;236;38;5;241m';
  const scrollingCount = options.length - pinnedRows;
  const scrollingRows = Math.max(1, visibleRows - pinnedRows);
  const firstRow = appearance.firstRow ?? viewportStart(scrollingCount, scrollingRows, Math.min(cursor.row, scrollingCount - 1), Math.min(contextRow, scrollingCount - 1));
  const rowIndices = [
    ...Array.from({ length: scrollingRows }, (_, offset) => firstRow + offset < scrollingCount ? firstRow + offset : -1),
    ...Array.from({ length: pinnedRows }, (_, offset) => scrollingCount + offset),
  ];
  const rows = rowIndices.map(row => {
    const source = options[row];
    if (source === undefined) return `\x1b[48;5;234;38;5;245m${'~'.padEnd(numberWidth)}${boxed ? ' │   ' : '│  '}${base}${' '.repeat(textWidth)}\x1b[0m`;
    if (appearance.headingRows?.has(row)) {
      return `\x1b[48;5;234m${' '.repeat(gutterWidth)}\x1b[1;38;5;117m${source.slice(0, textWidth).padEnd(textWidth)}\x1b[0m`;
    }
    const locked = unlockedThrough !== undefined && row < LESSON_COUNT && row > unlockedThrough;
    const background = appearance.expandedRows?.has(row) ? 24 : 234;
    const ink = appearance.expandedRows?.has(row) ? '\x1b[0;48;5;24;38;5;253m' : locked ? ghost : base;
    const label = boxed ? `${String(row + 1).padStart(numberWidth)} │ ` : `${String(row + 1).padStart(numberWidth)}│`;
    const arrow = row === cursor.row ? `\x1b[48;5;${background};1;96m›` : `\x1b[48;5;${background};38;5;${locked ? 240 : 245}m›`;
    let line = `\x1b[48;5;${background};38;5;${locked ? 240 : 245}m${label}${arrow} ${ink}`;
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

