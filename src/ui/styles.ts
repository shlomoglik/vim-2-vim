import { badges as courseBadges } from '../lessons/catalog.js';
import { PANEL_WIDTH, VISIBLE_BADGE_LIMIT, WIDE_VIEW_WIDTH } from './constants.js';

const badgesCount = courseBadges.length;
export const paint = (code: string, s: string) => `\x1b[${code}m${s}\x1b[0m`;
export const cyan = (s: string) => paint('1;96', s);
export const gold = (s: string) => paint('1;93', s);
export const green = (s: string) => paint('1;92', s);
export const pink = (s: string) => paint('1;95', s);
export const faint = (s: string) => paint('2', s);
export const keycap = (key: string, label: string) => `${paint('1;30;106', ` ${key} `)} ${label}`;
export const ribbon = (badges: readonly string[]) => badges.length ? badges.map(b => gold(`[${b}]`)).join(' ') : faint('[·] [·] [·] [·] [·]');
export const badgeDisplay = (badges: readonly string[], width: number) => badges.length === 0 ? faint('none') :
  width < WIDE_VIEW_WIDTH ? `${badges.length}/${badgesCount} ${gold(badges.at(-1)!)}` : ribbon(badges.slice(-VISIBLE_BADGE_LIMIT));
export const dots = (done: number, total: number) => Array.from({ length: total }, (_, i) => i < done ? green('◆') : faint('◇')).join(' ');
export const rule = (width: number) => pink('━'.repeat(Math.min(width, PANEL_WIDTH)));
