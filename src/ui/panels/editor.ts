import { truncateToWidth } from '@earendil-works/pi-tui';
import { type Game } from '../../game/state.js';
import { ghostColor } from '../animation.js';
import { BOX_MIN_WIDTH, PANEL_WIDTH } from '../constants.js';
import { firstDifferenceColumn, nextPreviewRows } from '../editingPreview.js';
import { viewportStart } from '../layout.js';
import { cyan, gold, green, paint } from '../styles.js';

export function editorPanel(game: Game, width: number, flashing: boolean, flashFrame: number, shade: number, pulse: number, ghostStep: number, visibleRows: number): string[] {
  const lesson = game.activeLesson!;
  const goal = lesson.checkpoints[Math.min(game.checkpoint, lesson.checkpoints.length - 1)]!;
  const lines = game.edit?.lines ?? lesson.lines;
  const modified = game.edit ? game.edit.lines.join('\n') !== game.edit.savedLines.join('\n') : false;
  const boxed = width >= BOX_MIN_WIDTH;
  const panelWidth = boxed ? Math.min(width, PANEL_WIDTH) : width;
  const contentWidth = panelWidth - (boxed ? 2 : 0);
  const gutterWidth = boxed ? 5 : 2;
  const textWidth = contentWidth - gutterWidth;
  const base = '\x1b[0;48;5;236;38;5;253m';
  const hintBase = '\x1b[0;48;5;238;38;5;145m';
  const gutter = '\x1b[48;5;234;38;5;245m';
  const cursorInk = `\x1b[38;5;240;48;5;${shade}m`;
  const rows: string[] = [];
  const preview = lesson.editing ? nextPreviewRows(lines, lesson.editing.expected) : lines.map((source, actualRow) => ({ source, target: null, actualRow, kind: 'live' as const }));
  const activeTarget = lesson.editing ? preview.findIndex(row => row.kind === 'insert' || row.kind === 'live' && row.source !== row.target) : -1;
  const cursorRow = preview.findIndex(row => row.actualRow === game.cursor.row);
  const goalRow = preview.findIndex(row => row.actualRow === goal.row);

  const firstRow = viewportStart(preview.length, visibleRows, Math.max(0, cursorRow), lesson.editing ? Math.max(0, cursorRow) : Math.max(0, goalRow));
  for (let offset = 0; offset < visibleRows; offset++) {
    const previewRow = preview[firstRow + offset];
    const hintRow = previewRow?.kind === 'insert' || previewRow?.kind === 'replace';
    const rowBase = hintRow ? hintBase : base;
    const row = previewRow?.actualRow;
    const source = previewRow?.source;
    const target = previewRow?.target;
    const isActive = previewRow && (previewRow.kind !== 'live' || preview[activeTarget] === previewRow);
    const ghost = isActive ? source === null ? target : source !== undefined && target?.startsWith(source) ? target : null : null;
    const wrongCol = isActive && source !== null && source !== undefined && target !== null && target !== undefined ? firstDifferenceColumn(source, target) : -1;
    const label = previewRow === undefined ? (boxed ? '~  │ ' : '~ ') : row === null ?
      (previewRow.kind === 'replace' ? (boxed ? '↳  │ ' : '↳ ') : (boxed ? '+  │ ' : '+ ')) : boxed ?
      `${lesson.editing && target === null ? '!' : !lesson.editing && row === goal.row ? '▶' : ' '}${row + 1} │ ` : `${lesson.editing && target === null ? '!' : ''}${row + 1}│`;
    let line = `${lesson.editing && previewRow?.kind === 'live' && target === null ? '\x1b[48;5;234;38;5;211m' : !lesson.editing && row === goal.row ? '\x1b[48;5;234;1;92m' : gutter}${label}${rowBase}`;
    if (previewRow) {
      const focus = row === game.cursor.row ? game.cursor.col : row === goal.row ? goal.col : 0;
      const other = row === game.cursor.row && row === goal.row ? goal.col : focus;
      const displayedLength = Math.max(source?.length ?? 0, ghost?.length ?? 0) + (game.edit && row === game.cursor.row ? 1 : 0);
      const firstCol = viewportStart(displayedLength, textWidth, focus, other);
      for (let col = firstCol; col < Math.min(displayedLength, firstCol + textWidth); col++) {
        const actual = source?.[col];
        const suggested = actual === undefined ? ghost?.[col] : undefined;
        const reference = previewRow?.kind === 'replace' ? preview[firstRow + offset - 1]?.source : null;
        const matchesReference = suggested !== undefined && reference !== null && reference !== undefined && reference[col] === suggested;
        const isWrong = actual !== undefined && col === wrongCol;
        const char = isWrong && actual === ' ' || suggested === ' ' ? '·' : actual ?? suggested ?? ' ';
        const isCursor = game.cursor.row === row && game.cursor.col === col;
        const isGoal = !lesson.editing && goal.row === row && goal.col === col;
        const isHit = flashing && game.lastHit?.row === row && game.lastHit.col === col;
        line += isCursor ? `${cursorInk}${char}${rowBase}` :
          isWrong ? `\x1b[1;38;5;211m${char}${rowBase}` :
          isGoal ? `\x1b[${pulse ? '1;92' : '32'}m${char}${rowBase}` :
          isHit ? `${flashFrame ? gold(char) : green(char)}${rowBase}` :
          suggested !== undefined ? `${matchesReference ? '\x1b[48;5;238;38;5;102m' : `\x1b[48;5;238;2;38;5;${ghostColor(ghostStep, col, firstRow + offset)}m`}${char}${rowBase}` : char;
      }
      line += ' '.repeat(Math.max(0, textWidth - Math.max(0, Math.min(textWidth, displayedLength - firstCol))));
    } else {
      line += ' '.repeat(textWidth);
    }
    rows.push(`${line}\x1b[0m`);
  }

  const statusText = game.edit ? ` ${(game.edit.navigation.pending.startsWith('/') || game.edit.navigation.pending.startsWith('?') ? 'SEARCH' : game.edit.mode.toUpperCase())} ${modified ? '[+]' : game.edit.saved ? 'saved' : ''} ${game.edit.pending || game.edit.navigation.pending || lesson.editing?.filename} ${game.cursor.row + 1}:${game.cursor.col + 1}` :
    `${game.command.pending.startsWith('/') || game.command.pending.startsWith('?') ? ' SEARCH ' : ' NORMAL '} ${game.command.pending || 'motion-lab.txt'} ${game.cursor.row + 1}:${game.cursor.col + 1}`;
  const status = paint('1;30;106', truncateToWidth(statusText.padEnd(contentWidth), contentWidth));
  if (!boxed) return [...rows, status];
  return [cyan(`╭${'─'.repeat(panelWidth - 2)}╮`),
    ...rows.map(row => `${cyan('│')}${row}${cyan('│')}`),
    cyan(`├${'─'.repeat(panelWidth - 2)}┤`), `${cyan('│')}${status}${cyan('│')}`,
    cyan(`╰${'─'.repeat(panelWidth - 2)}╯`)];
}

