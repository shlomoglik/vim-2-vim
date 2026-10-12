import { wrapTextWithAnsi } from '@earendil-works/pi-tui';
import { PAR_MS_PER_KEY } from '../../game/constants.js';
import { formatTime, type CheckpointScore, type LessonResult } from '../../game/scoring.js';
import { BOX_MIN_WIDTH, HIGH_SCORE_THRESHOLD, MEDIUM_SCORE_THRESHOLD, METER_SEGMENTS, PANEL_WIDTH } from '../constants.js';
import { guideStep, motionGuideFor } from '../motionGuide.js';
import { cyan, faint, gold, green, pink } from '../styles.js';
import { frame } from './frame.js';

export function meter(label: string, value: number, narrow: boolean): string {
  const color = value >= HIGH_SCORE_THRESHOLD ? green : value >= MEDIUM_SCORE_THRESHOLD ? gold : pink;
  const heading = label === 'SPEED' ? cyan : label === 'ACCURACY' ? green : gold;
  if (narrow) return `${heading(label.padEnd(11))} ${color(`${value}%`)}`;
  const filled = Math.round(value / METER_SEGMENTS);
  return `${heading(label.padEnd(12))} ${color('█'.repeat(filled))}${faint('░'.repeat(METER_SEGMENTS - filled))} ${color(`${value}%`)}`;
}

function shortTime(ms: number): string {
  const seconds = ms / 1000;
  if (seconds >= 3600) return `${(seconds / 3600).toFixed(1)}h`;
  if (seconds >= 100) return `${Math.round(seconds)}s`;
  return `${seconds.toFixed(seconds >= 10 ? 1 : 2)}s`;
}

export function resultPanel(result: LessonResult, scores: readonly CheckpointScore[], width: number, rows: number): string[] {
  const targetTime = scores.length ? scores.reduce((sum, score) => sum + (score.targetMs ?? score.idealKeys * PAR_MS_PER_KEY), 0) : result.idealKeys * PAR_MS_PER_KEY;
  const pace = scores[0]?.pace;
  const paceLabel = pace ? `${pace.msPerKey}ms/key + ${pace.thinkingMs / 1000}s thinking/goal` : `${PAR_MS_PER_KEY}ms per ideal key`;
  const expected = scores.reduce((sum, score) => sum + (score.expectedCommands ?? 0), 0);
  const matched = scores.reduce((sum, score) => sum + (score.matchedCommands ?? 0), 0);
  const timeColor = result.elapsedMs <= targetTime ? green : pink;
  const keysColor = result.actualKeys <= result.idealKeys ? green : gold;
  const matchColor = matched === expected ? green : pink;
  const legend = `${cyan('TARGET')} ${faint('/')} ${gold('ACTUAL')}`;
  const details = [
    legend,
    '',
    meter('SPEED', result.speed, false),
    `${faint('Time:')} ${cyan(formatTime(targetTime))} ${faint('target /')} ${timeColor(formatTime(result.elapsedMs))} ${faint('actual')}`,
    faint(pace ? `100% pace: ${paceLabel}.` : `100% pace = ${PAR_MS_PER_KEY} ms per ideal key.`),
    faint('Per goal: target time / actual time.'),
    '',
    meter('ACCURACY', result.accuracy, false),
    `${faint('Keys:')} ${cyan(String(result.idealKeys))} ${faint('ideal /')} ${keysColor(String(result.actualKeys))} ${faint('used')}`,
    ...(expected ? [`${faint('Expected commands:')} ${cyan(String(expected))} ${faint('target /')} ${matchColor(String(matched))} ${faint('matched')}`,
      faint('Per goal: key efficiency (max 100%) × command match rate.')] : [faint('Per goal: ideal keys / keys used (up to 100%).')]),
    '',
    meter('PROFICIENCY', result.proficiency, false),
    `${faint('Target:')} ${cyan('100%')}${faint('. Actual: (')}${cyan(`${result.speed}%`)} ${faint('speed +')} ${green(`${result.accuracy}%`)} ${faint('accuracy) / 2.')}`,
    '',
    faint('Speed and accuracy average goal scores; displayed scores cap at 100%.'),
  ].flatMap(line => wrapTextWithAnsi(line, Math.min(width, PANEL_WIDTH) - 4));
  if (width >= BOX_MIN_WIDTH && details.length + 2 <= rows) return frame(details, width);
  return [
    legend,
    meter('SPEED', result.speed, true),
    `${faint('Time')} ${cyan(shortTime(targetTime))} ${faint('/')} ${timeColor(shortTime(result.elapsedMs))}`,
    faint(paceLabel),
    meter('ACCURACY', result.accuracy, true),
    `${faint('Keys')} ${cyan(String(result.idealKeys))} ${faint('/')} ${keysColor(String(result.actualKeys))}`,
    ...(expected ? [`${faint('Badges')} ${cyan(String(expected))} ${faint('/')} ${matchColor(String(matched))} ${faint('matched')}`] : []),
    meter('PROFICIENCY', result.proficiency, true),
    faint('Target 100%; (S+A)/2'),
    faint('Scores: goal averages'),
  ];
}

export function motionGuidePanel(key: string, width: number, ageMs: number, shade: number): string[] {
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

