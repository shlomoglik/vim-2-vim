import { truncateToWidth, visibleWidth } from '@earendil-works/pi-tui';
import { BOX_MIN_WIDTH, PANEL_WIDTH } from '../constants.js';
import { cyan } from '../styles.js';

export function frame(content: string[], width: number): string[] {
  if (width < BOX_MIN_WIDTH) return content;
  const boxWidth = Math.min(width, PANEL_WIDTH);
  const inner = boxWidth - 4;
  return [cyan(`╭${'─'.repeat(boxWidth - 2)}╮`),
    ...content.map(line => {
      const fitted = truncateToWidth(line, inner);
      return `${cyan('│')} ${fitted}${' '.repeat(Math.max(0, inner - visibleWidth(fitted)))} ${cyan('│')}`;
    }), cyan(`╰${'─'.repeat(boxWidth - 2)}╯`)];
}

