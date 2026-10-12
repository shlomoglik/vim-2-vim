import { coursePracticeIds, practiceTitle } from '../../course/curriculum.js';
import { truncateToWidth, visibleWidth, wrapTextWithAnsi } from '@earendil-works/pi-tui';
import { formatTime, previousComparableAttempt } from '../../game/scoring.js';
import { hubLines, resultKey, type Game } from '../../game/state.js';
import { LESSON_COUNT } from '../../lessons/index.js';
import { BOX_MIN_WIDTH } from '../constants.js';
import { viewportStart } from '../layout.js';
import { cyan, faint, green, paint } from '../styles.js';

const STATS_WIDTH = 80;
function attemptDate(iso: string | null): string {
  if (!iso) return 'Date unavailable';
  const date = new Date(iso);
  const two = (value: number) => String(value).padStart(2, '0');
  return `${two(date.getMonth() + 1)}-${two(date.getDate())} ${two(date.getHours())}:${two(date.getMinutes())}`;
}
function statsBox(rows: (string | null)[], width: number): string[] {
  if (width < BOX_MIN_WIDTH) return rows.map(row => row === null ? faint('─'.repeat(width)) : row);
  const boxWidth = Math.min(width, STATS_WIDTH);
  const inner = boxWidth - 4;
  return [cyan(`╭${'─'.repeat(boxWidth - 2)}╮`),
    ...rows.map(row => {
      if (row === null) return cyan(`├${'─'.repeat(boxWidth - 2)}┤`);
      const fitted = truncateToWidth(row, inner);
      return `${cyan('│')} ${fitted}${' '.repeat(Math.max(0, inner - visibleWidth(fitted)))} ${cyan('│')}`;
    }), cyan(`╰${'─'.repeat(boxWidth - 2)}╯`)];
}

export function statsBody(game: Game, width: number, budget: number): string[] {
  const practice = game.course ? game.statsPracticeId ?? coursePracticeIds[0]! : null;
  const selectedIndex = practice ? coursePracticeIds.indexOf(practice) : game.lesson;
  const total = practice ? coursePracticeIds.length : LESSON_COUNT;
  const titleAt = (index: number) => practice ? practiceTitle(coursePracticeIds[index]!) : hubLines[index]!.replace(/^\d+\s+/, '');
  const key = practice ? `${game.progress.difficulty}:${practice}` : resultKey(game.progress.difficulty, game.lesson);
  const history = game.progress.attempts[key] ?? [];
  const offset = Math.min(game.statsOffset, Math.max(0, history.length - 1));
  const selected = history[history.length - 1 - offset];
  const inner = width >= BOX_MIN_WIDTH ? Math.min(width, STATS_WIDTH) - 4 : width;
  const room = budget - (width >= BOX_MIN_WIDTH ? 2 : 0);
  const rows: (string | null)[] = [
    `${faint(practice ? 'Practice' : 'Lesson')} ${cyan(`${selectedIndex + 1} of ${total}`)}`,
    ...wrapTextWithAnsi(paint('1', titleAt(selectedIndex)), inner).slice(0, room >= 16 ? 2 : 1),
    inner >= 44 ? `${paint('1', 'h')} ${faint('← Previous practice · Next practice →')} ${paint('1', 'l')}` :
      `${paint('1', 'h')} ${faint('← prev · next →')} ${paint('1', 'l')}`,
  ];
  const addContext = room >= 24 && inner >= 40;
  if (addContext) {
    rows.push(faint(selectedIndex > 0 ? `Previous: ${titleAt(selectedIndex - 1)}` : 'First practice'),
      faint(selectedIndex < total - 1 ? `Next: ${titleAt(selectedIndex + 1)}` : 'Last practice'), null);
  }
  if (selected) {
    rows.push(cyan(`Attempt ${history.length - offset} of ${history.length}`) + (offset === 0 ? ` ${faint('· LATEST')}` : ''),
      `${faint('Time')} ${paint('1', formatTime(selected.elapsedMs))}`);
    if (inner >= 48) rows.push(`${faint('Speed')} ${selected.speed}%  ${faint('Accuracy')} ${selected.accuracy}%  ${faint('Proficiency')} ${selected.proficiency}%`);
    else rows.push(`${faint('Speed')} ${selected.speed}%`, `${faint('Accuracy')} ${selected.accuracy}%`, `${faint('Proficiency')} ${selected.proficiency}%`);
    if (addContext) {
      rows.push(faint(selected.completedAt ? `Completed ${attemptDate(selected.completedAt)}` : 'Date unavailable'));
      const previous = previousComparableAttempt(history.slice(0, history.length - offset));
      if (previous) {
        const delta = selected.elapsedMs - previous.elapsedMs;
        rows.push(delta === 0 ? faint('Same time as previous comparable attempt') :
          `${delta < 0 ? green(formatTime(Math.abs(delta)) + ' faster') : paint('1', formatTime(delta) + ' slower')} ${faint('than previous comparable attempt')}`);
      }
      rows.push(...wrapTextWithAnsi(faint('Speed: pace vs target · Accuracy: key efficiency'), inner),
        ...wrapTextWithAnsi(faint('Proficiency: average of speed and accuracy'), inner));
      if (selected.commandsUsed?.length) rows.push(`${faint('Keys used')} ${selected.commandsUsed.join(' ')}`);
    }
  } else rows.push(faint('No attempts yet.'), faint('Complete this practice'), faint('to see your scores here.'));

  if (room - rows.length >= 5) rows.push(null);
  rows.push(paint('1', 'Attempt history'),
    `${paint('1', 'j')} ${faint('↓ older ·')} ${paint('1', 'k')} ${faint('↑ newer')}`);
  const table = inner >= 52 && room - rows.length >= 3;
  if (table) rows.push(faint(`  ${'Attempt'.padEnd(9)} ${'Time'.padEnd(10)} ${'Speed'.padStart(5)} ${'Accuracy'.padStart(8)} ${'Proficiency'.padStart(11)}`));
  const visibleRecords = Math.min(history.length, Math.max(1, room - rows.length));
  const first = viewportStart(history.length, visibleRecords, offset);
  if (!history.length) rows.push(faint('No saved attempts'));
  else for (let row = 0; row < visibleRecords; row++) {
    const index = first + row;
    const record = history[history.length - 1 - index]!;
    const number = history.length - index;
    const line = table ? `${('#' + number).padEnd(9)} ${formatTime(record.elapsedMs).padEnd(10)} ${(record.speed + '%').padStart(5)} ${(record.accuracy + '%').padStart(8)} ${(record.proficiency + '%').padStart(11)}` :
      `#${number}  ${formatTime(record.elapsedMs)}${inner >= 30 ? `  ${record.proficiency}% overall` : ''}`;
    rows.push(index === offset ? cyan(`› ${line}`) : `  ${line}`);
  }
  return statsBox(rows, width);
}
