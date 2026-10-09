import { wrapTextWithAnsi } from '@earendil-works/pi-tui';
import { HIGH_SCORE_THRESHOLD, MEDIUM_SCORE_THRESHOLD, METER_SEGMENTS } from '../constants.js';
import { guideStep, motionGuideFor } from '../motionGuide.js';
import { cyan, faint, gold, green, pink } from '../styles.js';
import { frame } from './frame.js';

export function meter(label: string, value: number, narrow: boolean): string {
  if (narrow) return `${label.padEnd(11)} ${green(`${value}%`)}`;
  const filled = Math.round(value / METER_SEGMENTS);
  const color = value >= HIGH_SCORE_THRESHOLD ? green : value >= MEDIUM_SCORE_THRESHOLD ? gold : pink;
  return `${label.padEnd(12)} ${color('█'.repeat(filled))}${faint('░'.repeat(METER_SEGMENTS - filled))} ${color(`${value}%`)}`;
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

