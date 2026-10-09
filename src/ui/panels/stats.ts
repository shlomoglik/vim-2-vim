import { truncateToWidth, visibleWidth } from '@earendil-works/pi-tui';
import { formatTime, previousComparableAttempt, scoreCourse } from '../../game/scoring.js';
import { hubLines, resultKey, type Game } from '../../game/state.js';
import { badges as courseBadges } from '../../lessons/catalog.js';
import { LESSON_COUNT } from '../../lessons/index.js';
import { BOX_MIN_WIDTH, PANEL_WIDTH } from '../constants.js';
import { viewportStart } from '../layout.js';
import { badgeDisplay, cyan, faint, gold, pink } from '../styles.js';

const signed = (value: number) => `${value >= 0 ? '+' : ''}${value}`;
function attemptDate(iso: string | null): string {
  if (!iso) return 'legacy';
  const date = new Date(iso);
  const two = (value: number) => String(value).padStart(2, '0');
  return `${two(date.getMonth() + 1)}-${two(date.getDate())} ${two(date.getHours())}:${two(date.getMinutes())}`;
}
function statsBox(rows: (string | null)[], width: number): string[] {
  if (width < BOX_MIN_WIDTH) return rows.map(row => row === null ? faint('─'.repeat(width)) : row);
  const boxWidth = Math.min(width, PANEL_WIDTH);
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

export function statsBody(game: Game, width: number, budget: number): string[] {
  const key = resultKey(game.progress.difficulty, game.lesson);
  const history = game.progress.attempts[key] ?? [];
  const latest = history.at(-1);
  const previous = previousComparableAttempt(history);
  const inner = width >= BOX_MIN_WIDTH ? Math.min(width, PANEL_WIDTH) - 4 : width;
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
  const borderRows = width >= BOX_MIN_WIDTH ? 2 : 0;
  const minimumHistoryRows = 1;
  if (overview.length + borderRows + 3 > budget && latest) overview.pop();
  if (overview.length + borderRows + 3 > budget) overview.splice(3 + lessons.length, 1);
  let spare = budget - borderRows - overview.length - 1 - minimumHistoryRows - 1;
  if (spare > 0) { overview.splice(3 + lessons.length, 0, null); spare--; }
  if (spare > 0 && game.progress.badges.length) {
    const badgesLine = `${faint('BADGES')} ${badgeDisplay(game.progress.badges, inner)}`;
    const compactBadges = `${faint('BADGES')} ${game.progress.badges.length}/${courseBadges.length}${inner >= BOX_MIN_WIDTH ? `  ${gold(`[${game.progress.badges.at(-1)}]`)}` : ''}`;
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

