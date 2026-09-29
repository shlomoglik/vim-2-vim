import { ProcessTerminal, TUI, matchesKey, truncateToWidth, visibleWidth, wrapTextWithAnsi, type Component } from '@earendil-works/pi-tui';
import { activate, advance, challengeTitles, choose, difficultyLines, hubLines, leaveComplete, leaveStats, navigate, navigateStats, newGame, play, resultKey, type Game } from './game.js';
import { challengeKeys, LESSON_COUNT, NAVIGATION_COUNT } from './lessons.js';
import { guideStep, motionGuideFor } from './motionGuide.js';
import { fitHeight, viewportStart } from './layout.js';
import { editingMismatch, firstDifferenceColumn, nextPreviewRows } from './editingGhost.js';
import type { Position } from './motion.js';
import { loadProgress, progressPath, saveProgress } from './progress.js';
import { formatTime, previousComparableAttempt, scoreCourse } from './scoring.js';

const paint = (code: string, s: string) => `\x1b[${code}m${s}\x1b[0m`;
const cyan = (s: string) => paint('1;96', s);
const gold = (s: string) => paint('1;93', s);
const green = (s: string) => paint('1;92', s);
const pink = (s: string) => paint('1;95', s);
const faint = (s: string) => paint('2', s);
const keycap = (key: string, label: string) => `${paint('1;30;106', ` ${key} `)} ${label}`;
const ribbon = (badges: readonly string[]) => badges.length ? badges.map(b => gold(`[${b}]`)).join(' ') : faint('[·] [·] [·] [·] [·]');
const badgeDisplay = (badges: readonly string[], width: number) => badges.length === 0 ? faint('none') :
  width < 50 ? `${badges.length}/21 ${gold(badges.at(-1)!)}` : ribbon(badges.slice(-6));
const dots = (done: number, total: number) => Array.from({ length: total }, (_, i) => i < done ? green('◆') : faint('◇')).join(' ');
const rule = (width: number) => pink('━'.repeat(Math.min(width, 46)));
// Two short brightness dips, then a rest: a quiet heartbeat without hiding the glyph.
function cursorShade(nowMs: number): number {
  const beat = nowMs % 1400;
  return beat < 140 ? 253 : beat >= 240 && beat < 380 ? 251 : 255;
}
const targetPulse = (nowMs: number) => Math.floor(nowMs / 420) % 2;
const ghostFrame = (nowMs: number) => Math.floor(nowMs / 180);
const ghostColors = [108, 114, 150, 151, 150, 114] as const;
const ghostColor = (frame: number, col: number, row: number) => ghostColors[(frame + Math.floor(col / 2) + row) % ghostColors.length]!;
const rewardShine = (ageMs: number) => ageMs >= 0 && ageMs < 2800 && Math.floor(ageMs / 700) % 2 === 1;

function frame(content: string[], width: number): string[] {
  if (width < 32) return content;
  const boxWidth = Math.min(width, 46);
  const inner = boxWidth - 4;
  return [cyan(`╭${'─'.repeat(boxWidth - 2)}╮`),
    ...content.map(line => {
      const fitted = truncateToWidth(line, inner);
      return `${cyan('│')} ${fitted}${' '.repeat(Math.max(0, inner - visibleWidth(fitted)))} ${cyan('│')}`;
    }), cyan(`╰${'─'.repeat(boxWidth - 2)}╯`)];
}

function editorPanel(game: Game, width: number, flashing: boolean, flashFrame: number, shade: number, pulse: number, ghostStep: number, visibleRows: number): string[] {
  const lesson = game.activeLesson!;
  const goal = lesson.checkpoints[Math.min(game.checkpoint, lesson.checkpoints.length - 1)]!;
  const lines = game.edit?.lines ?? lesson.lines;
  const modified = game.edit ? game.edit.lines.join('\n') !== game.edit.savedLines.join('\n') : false;
  const boxed = width >= 32;
  const panelWidth = boxed ? Math.min(width, 46) : width;
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

function selectorPanel(options: readonly string[], cursor: Position, width: number, filename: string, visibleRows: number, pending = '', unlockedThrough?: number): string[] {
  const boxed = width >= 32;
  const panelWidth = boxed ? Math.min(width, 46) : width;
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

function courseOptions(width: number, completed: number): string[] {
  const textWidth = width >= 32 ? Math.min(width, 46) - 9 : width - 5;
  return hubLines.map((line, index) => {
    if (index >= LESSON_COUNT) return line;
    const keys = challengeKeys[index]!.map(key => `[${key}]`).join('');
    const locked = index > completed;
    if (width >= 46) return locked ? `${line} locked` : line;
    const titleWidth = Math.max(0, textWidth - visibleWidth(keys) - 1);
    const title = challengeTitles[index]!.slice(0, titleWidth);
    return title ? `${title} ${keys}` : keys;
  });
}

function meter(label: string, value: number, narrow: boolean): string {
  if (narrow) return `${label.padEnd(11)} ${green(`${value}%`)}`;
  const filled = Math.round(value / 10);
  const color = value >= 80 ? green : value >= 60 ? gold : pink;
  return `${label.padEnd(12)} ${color('█'.repeat(filled))}${faint('░'.repeat(10 - filled))} ${color(`${value}%`)}`;
}

function motionGuidePanel(key: string, width: number, ageMs: number, shade: number): string[] {
  const guide = motionGuideFor(key);
  const step = guideStep(ageMs);
  const cursor = step === 2 ? guide.to : guide.from;
  const base = '\x1b[0;48;5;236;38;5;253m';
  const examples = guide.lines.map((source, row) => {
    let example = `\x1b[48;5;234;38;5;245m${row + 1}│ `+base;
    for (let col = 0; col < source.length; col++) {
      const char = source[col]!;
      example += row === cursor.row && col === cursor.col ? `\x1b[38;5;240;48;5;${shade}m${char}${base}` :
        row === guide.to.row && col === guide.to.col ? `\x1b[1;92m${char}${base}` : char;
    }
    return example + '\x1b[0m';
  });
  const command = step === 0 ? '' : cyan(`[${guide.sequence}]`);
  return [
    `${pink('HOW TO USE')} ${gold(`[${key}]`)}${width >= 40 ? ` ${cyan(guide.title)}` : ''}`,
    ...wrapTextWithAnsi(guide.explanation, width),
    ...frame([...examples, command], width),
  ];
}

const signed = (value: number) => `${value >= 0 ? '+' : ''}${value}`;
function attemptDate(iso: string | null): string {
  if (!iso) return 'legacy';
  const date = new Date(iso);
  const two = (value: number) => String(value).padStart(2, '0');
  return `${two(date.getMonth() + 1)}-${two(date.getDate())} ${two(date.getHours())}:${two(date.getMinutes())}`;
}
function statsBox(rows: (string | null)[], width: number): string[] {
  if (width < 32) return rows.map(row => row === null ? faint('─'.repeat(width)) : row);
  const boxWidth = Math.min(width, 46);
  const inner = boxWidth - 4;
  return [cyan(`╭${'─'.repeat(boxWidth - 2)}╮`),
    ...rows.map(row => {
      if (row === null) return cyan(`├${'─'.repeat(boxWidth - 2)}┤`);
      const fitted = truncateToWidth(row, inner);
      return `${cyan('│')} ${fitted}${' '.repeat(Math.max(0, inner - visibleWidth(fitted)))} ${cyan('│')}`;
    }), cyan(`╰${'─'.repeat(boxWidth - 2)}╯`)];
}

function lessonSelector(selected: number, width: number): string[] {
  const rows: string[] = [];
  let row = '';
  for (let index = 0; index < LESSON_COUNT; index++) {
    const number = String(index + 1);
    const token = index === selected ? cyan(`[${number}]`) : faint(number);
    if (row && visibleWidth(row) + 2 + visibleWidth(token) > width) {
      rows.push(row);
      row = token;
    } else row += `${row ? '  ' : ''}${token}`;
  }
  if (row) rows.push(row);
  return rows;
}

function statsBody(game: Game, width: number, budget: number): string[] {
  const key = resultKey(game.progress.difficulty, game.lesson);
  const history = game.progress.attempts[key] ?? [];
  const latest = history.at(-1);
  const previous = previousComparableAttempt(history);
  const inner = width >= 32 ? Math.min(width, 46) - 4 : width;
  const narrow = inner < 36;
  const lessons = lessonSelector(game.lesson, inner);
  const title = hubLines[game.lesson]!.replace(/^\d+\s+/, '');
  const overview: (string | null)[] = [
    `${pink('STATS')} ${faint('·')} ${cyan(game.progress.difficulty.toUpperCase())}`,
    `${gold('LESSONS')} ${faint(`${game.lesson + 1} / ${LESSON_COUNT}`)}`,
    ...lessons,
    faint('h / l  change lesson'),
    `${cyan(String(game.lesson + 1).padStart(2, '0'))}  ${title}`,
    latest ? `${gold('LATEST')} ${formatTime(latest.elapsedMs)}${narrow ? '' : `  ${faint(`· ${history.length} attempts`)}`}` :
      faint(narrow ? 'No attempts yet' : 'No attempts yet. Play this lesson.'),
  ];
  if (latest) overview.push(narrow ? `S${latest.speed}%  A${latest.accuracy}%  P${latest.proficiency}%` :
    `${faint('SPEED')} ${latest.speed}%   ${faint('ACC')} ${latest.accuracy}%   ${faint('PROF')} ${latest.proficiency}%`);

  const historyHeader = `${gold('HISTORY')} ${faint(history.length ? `${game.statsOffset + 1} / ${history.length}` : '0 attempts')}`;
  const historyHint = faint('j / k  browse attempts');
  const borderRows = width >= 32 ? 2 : 0;
  const minimumHistoryRows = 1;
  if (overview.length + borderRows + 3 > budget && latest) overview.pop();
  if (overview.length + borderRows + 3 > budget) overview.splice(3 + lessons.length, 1);
  let spare = budget - borderRows - overview.length - 1 - minimumHistoryRows - 1;
  if (spare > 0) { overview.splice(3 + lessons.length, 0, null); spare--; }
  if (spare > 0 && game.progress.badges.length) {
    const badgesLine = `${faint('BADGES')} ${badgeDisplay(game.progress.badges, inner)}`;
    const compactBadges = `${faint('BADGES')} ${game.progress.badges.length}/21${inner >= 32 ? `  ${gold(`[${game.progress.badges.at(-1)}]`)}` : ''}`;
    overview.splice(5 + lessons.length, 0, visibleWidth(badgesLine) <= inner ? badgesLine : compactBadges);
    spare--;
  }
  if (spare > 0) { overview.push(null); spare--; }
  if (spare > 0 && previous && latest) {
    const delta = latest.elapsedMs - previous.elapsedMs;
    overview.push(`${pink('VS PRIOR')} ${formatTime(Math.abs(delta))} ${delta <= 0 ? 'faster' : 'slower'}`);
    spare--;
  }
  if (spare > 0 && previous && latest) {
    overview.push(faint(`S${signed(latest.speed - previous.speed)}  A${signed(latest.accuracy - previous.accuracy)}  P${signed(latest.proficiency - previous.proficiency)}`));
    spare--;
  }
  if (spare > 0) {
    const results = Array.from({ length: LESSON_COUNT }, (_, index) => game.progress.results[resultKey(game.progress.difficulty, index)]);
    if (results.every(Boolean)) {
      const course = scoreCourse(results as NonNullable<typeof results[number]>[]);
      if (course) { overview.push(`${gold('COURSE')} ${formatTime(course.elapsedMs)}  P${course.proficiency}%`); spare--; }
    }
  }
  if (spare > 0) { overview.push(null); spare--; }
  const selectedCommands = history[history.length - 1 - game.statsOffset]?.commandsUsed;
  const commandsLine = spare > 0 && selectedCommands?.length ? `${gold('USED')} ${selectedCommands.join(' ')}` : null;
  const visibleRecords = Math.min(history.length, Math.max(1, spare + minimumHistoryRows - (commandsLine ? 1 : 0)));
  const first = viewportStart(history.length, visibleRecords, game.statsOffset);
  const records = history.length ? Array.from({ length: visibleRecords }, (_, offset) => {
    const index = first + offset;
    const record = history[history.length - 1 - index]!;
    const label = inner < 30 ? `#${history.length - index} ${formatTime(record.elapsedMs)} P${record.proficiency}` :
      narrow ? `#${history.length - index} ${formatTime(record.elapsedMs)} S${record.speed} A${record.accuracy} P${record.proficiency}` :
      `#${history.length - index}  ${formatTime(record.elapsedMs)}  S${record.speed} A${record.accuracy} P${record.proficiency}`;
    const line = narrow ? label : `${label}  ${attemptDate(record.completedAt)}`;
    return index === game.statsOffset ? cyan(`› ${line}`) : `  ${faint(line)}`;
  }) : [faint('  No history for this lesson')];
  return statsBox([...overview, historyHeader, ...records, ...(commandsLine ? [commandsLine] : []), historyHint], width);
}

let game: Game;
try { game = newGame(loadProgress()); }
catch (error) { console.error(`Could not read progress: ${String(error)}`); process.exit(1); }

const terminal = new ProcessTerminal();
const tui = new TUI(terminal);

class Screen implements Component {
  invalidate(): void {}

  render(width: number): string[] {
    const height = tui.terminal.rows;
    if (width < 22 || height < 16) {
      const warning = width < 22 ? 'Widen to 22 columns' : 'Grow to 16 rows';
      return fitHeight([cyan('TERMINAL TOO SMALL'), warning], [], [faint('Ctrl+C quit')], height)
        .map(line => truncateToWidth(line, Math.max(1, width)));
    }
    const narrow = width < 50;
    const nowMs = performance.now();
    const flashAge = game.lastHitAtMs === null ? Infinity : nowMs - game.lastHitAtMs;
    const flashing = flashAge >= 0 && flashAge < 700;
    const flashFrame = Math.floor(flashAge / 140) % 2;
    const shining = rewardShine(flashAge);
    const masthead = [`${pink('◆')} ${cyan('VIM')}${faint(' / ')}${green('VIM')}${width >= 32 ? `  ${faint('MOTION LAB')}` : ''}`, rule(width)];
    let top: string[];
    let middle: string[];
    let bottom: string[] = [];

    if (game.phase === 'menu') {
      top = [...masthead, cyan('CHOOSE YOUR RUN'), faint(game.progress.completed >= NAVIGATION_COUNT ? 'Navigation complete · Editing lab open' : narrow ? 'Move. Learn. Level up.' : 'Move through text. Collect motions.')];
      middle = [`${gold('PROGRESS')} ${game.progress.completed}/${LESSON_COUNT}`,
        `${faint('BADGES')} ${badgeDisplay(game.progress.badges, width)}`];
      bottom = [keycap('R', 'Resume'), keycap('S', 'Start over'), faint('Ctrl+C quit')];
    } else if (game.phase === 'complete') {
      top = [...masthead, green(game.progress.completed === LESSON_COUNT ? 'COURSE COMPLETE' : 'NAVIGATION COMPLETE'), gold('NAVIGATOR')];
      middle = [cyan(game.progress.completed === LESSON_COUNT ? `All ${LESSON_COUNT} stages cleared.` : 'Editing basics is ready.'), faint('Your attempts remain available in Stats.')];
      bottom = [faint('Ctrl+C quit'), keycap('↵', 'Open course')];
    } else if (game.phase === 'reward') {
      const lesson = game.activeLesson!;
      const result = game.progress.results[resultKey(game.progress.difficulty, game.lesson)];
      top = [...masthead, green(shining ? '✦ LEVEL CLEAR ✦' : 'LEVEL CLEAR'),
        `${faint('LESSON')} ${game.lesson + 1} ${game.progress.completed}/${LESSON_COUNT}`];
      const budget = height - top.length - 1;
      middle = lesson.badge ? [`${pink(game.newUnlock ? 'NEW REWARD' : 'REWARD')} ${gold(shining ? `✦ ${lesson.badge} ✦` : `[ ${lesson.badge} ]`)}`,
        ...motionGuidePanel(lesson.badge, width, nowMs - (game.lastHitAtMs ?? nowMs), cursorShade(nowMs))] :
        [green('STAGE CLEAR'), faint(lesson.editing ? `${lesson.editing.filename} saved` : 'Review complete')];
      if (result) {
        const compact = width < 32 || budget < middle.length + 7;
        middle.push(...(compact ? [
          `${cyan('TIME')} ${formatTime(result.elapsedMs)}${width >= 32 ? ` ${faint(`· ${result.actualKeys} keys`)}` : ''}`,
          `SPEED ${result.speed}%  ACC ${result.accuracy}%`, `PROFICIENCY ${result.proficiency}%`,
        ] : [...frame([
          `${cyan('TIME')} ${formatTime(result.elapsedMs)} ${faint(`· ${result.actualKeys} keys`)}`,
          meter('SPEED', result.speed, width < 32), meter('ACCURACY', result.accuracy, width < 32),
          meter('PROFICIENCY', result.proficiency, width < 32),
        ], width), faint('Accuracy = ideal keys / keys used')]));
      }
      bottom = [keycap('↵', 'Continue')];
    } else if (game.phase === 'hub' || game.phase === 'difficulty') {
      const selectingDifficulty = game.phase === 'difficulty';
      const options = selectingDifficulty ? difficultyLines : courseOptions(width, game.progress.completed);
      const cursor = selectingDifficulty ? game.difficultyCursor : game.hubCursor;
      top = [...masthead, cyan(selectingDifficulty ? 'SELECT DIFFICULTY' : game.hubCursor.row < LESSON_COUNT ? `CHALLENGE ${game.hubCursor.row + 1}/${LESSON_COUNT}` : 'COURSE HUB'),
        faint(selectingDifficulty ? 'Choose your pace' : `Difficulty: ${game.progress.difficulty}  ·  ${game.progress.completed}/${LESSON_COUNT} clear`),
        `${faint('BADGES')} ${badgeDisplay(game.progress.badges, width)}`];
      bottom = [faint('Vim keys navigate · Ctrl+C quit'), keycap('↵', 'Select')];
      const note = game.message ? wrapTextWithAnsi(game.message, width) : [];
      const budget = height - top.length - bottom.length - note.length;
      const visibleRows = Math.max(1, budget - (width >= 32 ? 4 : 1));
      middle = [...selectorPanel(options, cursor, width, selectingDifficulty ? 'difficulty.txt' : 'course.txt', visibleRows, game.command.pending,
        selectingDifficulty ? undefined : game.progress.completed), ...note];
    } else if (game.phase === 'stats') {
      const title = hubLines[game.lesson]!;
      top = [...masthead, cyan(`STATS · ${game.progress.difficulty.toUpperCase()}`),
        `${gold(`LESSON ${game.lesson + 1}/${LESSON_COUNT}`)} ${faint(title)}`,
        `${faint('BADGES')} ${badgeDisplay(game.progress.badges, width)}`];
      bottom = [faint('h/l lesson · j/k history'), keycap('↵', 'Back to hub')];
      middle = statsBody(game, width, height - top.length - bottom.length);
    } else {
      const lesson = game.activeLesson!;
      const goal = lesson.checkpoints[game.checkpoint]!;
      const instruction = lesson.instruction;
      const lessonName = lesson.title.split('· ')[1] ?? '';
      top = [...masthead, `${cyan(`STAGE ${String(game.lesson + 1).padStart(2, '0')}`)} ${faint(`/ ${String(LESSON_COUNT).padStart(2, '0')}`)}${width >= 32 ? ` ${pink(lessonName)}` : ''}`,
        ...(width < 32 ? [pink(lessonName)] : []),
        ...wrapTextWithAnsi(instruction, width),
        ...(lesson.editing ? wrapTextWithAnsi(`${gold('FILE')} ${game.edit?.lines.join('\n') !== game.edit?.savedLines.join('\n') ? '[+]' : game.edit?.saved ? 'saved' : ''} ${lesson.editing.filename}`, width) :
        [`${gold('TARGET')} ${game.checkpoint + 1}/${lesson.checkpoints.length} ${faint(`@ ${goal.row + 1}:${goal.col + 1}`)}${width >= 50 ? ` ${dots(game.checkpoint, lesson.checkpoints.length)}` : ''}`]),
        ...(lesson.editing ? wrapTextWithAnsi(`${gold('TARGET')} ${editingMismatch(game.edit!.lines, lesson.editing.expected) ?? 'Match reached. Save with :w.'}`, width) :
          lesson.requiredCommands ? wrapTextWithAnsi(`${gold('REMAINING')} ${lesson.requiredCommands.filter(command => !game.usedCommands.includes(command)).join(' ') || 'none'}`, width) : [])];
      const elapsed = game.startedAtMs === null ? 0 : nowMs - game.startedAtMs;
      bottom = [`${cyan('TIME')} ${game.startedAtMs === null ? 'Ready' : formatTime(elapsed)}`,
        lesson.editing ? `${paint('2;38;5;150', 'Green = next target')} ${faint('· gray = matches · · = space · + add · ↳ fix')}` :
          `${faint('BADGES')} ${badgeDisplay(game.progress.badges, width)}`, faint('F1 hint · Ctrl+C quit')];
      const notice = flashing ? [green(flashFrame ? '✦ Target reached! ✦' : '✓ Target reached!')] :
        game.hint ? wrapTextWithAnsi(`${gold('TIP')} ${lesson.hint}`, width) :
        game.message ? wrapTextWithAnsi(game.message, width) : [];
      const budget = height - top.length - bottom.length - notice.length;
      const visibleRows = Math.max(1, budget - (width >= 32 ? 4 : 1));
      middle = [...editorPanel(game, width, flashing, flashFrame, cursorShade(nowMs), targetPulse(nowMs), ghostFrame(nowMs), visibleRows), ...notice];
    }
    return fitHeight(top, middle, bottom, height)
      .map(line => truncateToWidth(line, Math.max(1, width)));
  }

  handleInput(data: string): void {
    if (tui.terminal.columns < 22 || tui.terminal.rows < 16) return;
    if (game.phase === 'menu') {
      if (data.toLowerCase() === 'r' || data.toLowerCase() === 's') {
        game = choose(game, data.toLowerCase() === 'r' ? 'resume' : 'restart');
        if (data.toLowerCase() === 's') persist();
      }
    } else if (game.phase === 'complete') {
      if (matchesKey(data, 'enter')) game = leaveComplete(game);
    } else if (game.phase === 'reward') {
      if (matchesKey(data, 'enter')) game = advance(game);
    } else if (game.phase === 'hub' || game.phase === 'difficulty') {
      const oldDifficulty = game.progress.difficulty;
      game = matchesKey(data, 'enter') && (game.command.pending.startsWith('/') || game.command.pending.startsWith('?')) ? navigate(game, '\n') :
        matchesKey(data, 'enter') ? activate(game) : navigate(game, matchesKey(data, 'f1') ? 'f1' : data);
      if (game.progress.difficulty !== oldDifficulty) persist();
    } else if (game.phase === 'stats') {
      game = matchesKey(data, 'enter') ? leaveStats(game) : navigateStats(game, data);
    } else {
      const prior = game.phase;
      game = play(game, matchesKey(data, 'f1') ? 'f1' : matchesKey(data, 'enter') ? '\n' : matchesKey(data, 'escape') ? 'escape' : matchesKey(data, 'backspace') ? 'backspace' : data);
      if (prior === 'play' && game.phase === 'reward') persist();
    }
    tui.requestRender();
  }
}

function persist(): void {
  try { saveProgress(game.progress); }
  catch (error) { shutdown(); console.error(`Could not save progress to ${progressPath()}: ${String(error)}`); process.exitCode = 1; }
}

let stopped = false;
let previousCursorShade = cursorShade(performance.now());
let previousTargetPulse = targetPulse(performance.now());
let previousGhostFrame = ghostFrame(performance.now());
let previousGuideStep: 0 | 1 | 2 = 0;
let previousRewardShine = false;
const animationTimer = setInterval(() => {
  const nowMs = performance.now();
  const shade = cursorShade(nowMs);
  const pulse = targetPulse(nowMs);
  const ghostStep = ghostFrame(nowMs);
  const currentGuideStep = guideStep(nowMs - (game.lastHitAtMs ?? nowMs));
  const shining = rewardShine(nowMs - (game.lastHitAtMs ?? nowMs));
  const flashActive = game.phase === 'play' && game.lastHitAtMs !== null && nowMs - game.lastHitAtMs < 700;
  if (game.phase === 'reward' && (currentGuideStep !== previousGuideStep || shade !== previousCursorShade || shining !== previousRewardShine) ||
      game.phase === 'play' && (game.startedAtMs !== null || shade !== previousCursorShade || pulse !== previousTargetPulse || game.edit !== null && ghostStep !== previousGhostFrame) || flashActive) tui.requestRender();
  previousCursorShade = shade;
  previousTargetPulse = pulse;
  previousGhostFrame = ghostStep;
  previousGuideStep = currentGuideStep;
  previousRewardShine = shining;
}, 100);
function shutdown(): void {
  if (stopped) return;
  stopped = true;
  clearInterval(animationTimer);
  tui.stop();
}

const screen = new Screen();
tui.addChild(screen);
tui.setFocus(screen);
tui.addInputListener(data => {
  if (matchesKey(data, 'ctrl+c')) { shutdown(); process.exit(0); return { consume: true }; }
});
process.once('SIGTERM', () => { shutdown(); process.exit(0); });
process.once('uncaughtException', error => { shutdown(); console.error(error); process.exit(1); });
terminal.write('\x1b[2J\x1b[H\x1b[3J');
tui.start();
