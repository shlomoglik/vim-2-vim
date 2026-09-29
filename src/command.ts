import { move, type Motion, type Position } from './motion.js';

export type CommandState = {
  pending: string;
  lastFind: { command: 'f' | 'F' | 't' | 'T'; char: string } | null;
  lastSearch: { text: string; direction: 1 | -1 } | null;
  preferredCol: number | null;
};
export const emptyCommand = (): CommandState => ({ pending: '', lastFind: null, lastSearch: null, preferredCol: null });
export type CommandResult = { cursor: Position; state: CommandState; message: string; moved: boolean; executed?: string };
const same = (a: Position, b: Position) => a.row === b.row && a.col === b.col;
const clamp = (n: number, max: number) => Math.max(0, Math.min(max, n));
const first = (line: string) => Math.max(0, line.search(/\S/));

function characterFind(lines: readonly string[], at: Position, command: 'f' | 'F' | 't' | 'T', char: string, count: number, repeat = false): Position | null {
  const line = lines[at.row]!;
  const forward = command === 'f' || command === 't';
  let index = at.col;
  for (let i = 0; i < count; i++) {
    index = forward ? line.indexOf(char, index + 1) : line.lastIndexOf(char, index - 1);
    if (repeat && i === 0 && command === 't' && index === at.col + 1) index = line.indexOf(char, index + 1);
    if (repeat && i === 0 && command === 'T' && index === at.col - 1) index = line.lastIndexOf(char, index - 1);
    if (index < 0) return null;
  }
  const col = command === 't' ? index - 1 : command === 'T' ? index + 1 : index;
  return { row: at.row, col: clamp(col, line.length - 1) };
}

function search(lines: readonly string[], at: Position, query: string, direction: 1 | -1, count: number): Position | null {
  if (!query) return null;
  const text = lines.join('\n');
  const offset = lines.slice(0, at.row).reduce((n, line) => n + line.length + 1, 0) + at.col;
  let found = offset;
  for (let i = 0; i < count; i++) {
    if (direction === 1) {
      found = text.indexOf(query, found + 1);
      if (found < 0) found = text.indexOf(query);
    } else {
      found = text.lastIndexOf(query, found - 1);
      if (found < 0) found = text.lastIndexOf(query);
    }
    if (found < 0) return null;
  }
  const prefix = text.slice(0, found).split('\n');
  return { row: prefix.length - 1, col: prefix.at(-1)!.length };
}

function matching(lines: readonly string[], at: Position): Position {
  const text = lines.join('\n');
  const base = lines.slice(0, at.row).reduce((n, line) => n + line.length + 1, 0);
  let index = base + at.col;
  while (index < base + lines[at.row]!.length && !'()[]{}'.includes(text[index]!)) index++;
  const char = text[index];
  if (!char || !'()[]{}'.includes(char)) return at;
  const mate: Record<string, string> = { '(': ')', '[': ']', '{': '}', ')': '(', ']': '[', '}': '{' };
  const direction = '([{'.includes(char) ? 1 : -1;
  let depth = 0;
  for (let next = index + direction; next >= 0 && next < text.length; next += direction) {
    if (text[next] === char) depth++;
    else if (text[next] === mate[char]) {
      if (depth === 0) {
        const prefix = text.slice(0, next).split('\n');
        return { row: prefix.length - 1, col: prefix.at(-1)!.length };
      }
      depth--;
    }
  }
  return at;
}

export function interpret(lines: readonly string[], cursor: Position, state: CommandState, key: string, unlocked: readonly string[]): CommandResult {
  const done = (at: Position, next: CommandState = { ...state, pending: '', preferredCol: null }, message = '', executed?: string): CommandResult =>
    ({ cursor: at, state: next, message, moved: !same(at, cursor), executed: !message && !same(at, cursor) ? executed : undefined });
  if (key === '\x1b' || key === 'escape') return done(cursor, { ...state, pending: '' });
  const pending = state.pending;
  if (pending.startsWith('/') || pending.startsWith('?')) {
    if (key === '\r' || key === '\n' || key === 'enter') {
      const query = pending.slice(1);
      const previous = state.lastSearch;
      const text = query || previous?.text || '';
      const direction = pending[0] === '/' ? 1 : -1;
      const at = search(lines, cursor, text, direction, 1);
      return done(at ?? cursor, { ...state, pending: '', lastSearch: text ? { text, direction } : previous, preferredCol: null }, at ? '' : 'Pattern not found', direction === 1 ? '/' : '?');
    }
    if (key === '\x7f' || key === 'backspace') return { ...done(cursor), state: { ...state, pending: pending.slice(0, -1) } };
    return { ...done(cursor), state: { ...state, pending: pending + key } };
  }
  const digits = pending.match(/^[1-9][0-9]*/)?.[0] ?? '';
  const command = pending.slice(digits.length);
  if (command === 'g') {
    if (key !== 'g') return done(cursor, undefined, 'Unknown command');
    if (!unlocked.includes('gg')) return done(cursor, undefined, 'gg is locked');
    const row = digits ? clamp(Number(digits) - 1, lines.length - 1) : 0;
    return done({ row, col: first(lines[row]!) }, undefined, '', digits ? 'Counts' : 'gg');
  }
  if (/[fFtT]/.test(command) && command.length === 1) {
    const spec = command as 'f' | 'F' | 't' | 'T';
    const at = characterFind(lines, cursor, spec, key, Number(digits) || 1);
    return done(at ?? cursor, { ...state, pending: '', lastFind: { command: spec, char: key }, preferredCol: null }, at ? '' : `${spec}${key}: character not found`, digits ? 'Counts' : spec);
  }
  if (/^[0-9]$/.test(key) && (digits || key !== '0')) {
    if (!unlocked.includes('Counts')) return done(cursor, undefined, 'Counts are locked');
    return { ...done(cursor), state: { ...state, pending: pending + key } };
  }
  const count = Number(digits) || 1;
  if (key === 'g') {
    if (!unlocked.includes('gg')) return done(cursor, undefined, 'gg is locked');
    return { ...done(cursor), state: { ...state, pending: pending + key } };
  }
  if ('fFtT'.includes(key) && key.length === 1) {
    if (!unlocked.includes(key)) return done(cursor, undefined, `${key} is locked`);
    return { ...done(cursor), state: { ...state, pending: pending + key } };
  }
  if (key === '/' || key === '?') {
    if (!unlocked.includes(key)) return done(cursor, undefined, `${key} is locked`);
    return { ...done(cursor), state: { ...state, pending: key } };
  }
  if (!unlocked.includes(key)) return done(cursor, undefined, `${key} is locked`);
  if (key === 'j' || key === 'k') {
    const row = clamp(cursor.row + (key === 'j' ? count : -count), lines.length - 1);
    const desired = state.preferredCol ?? cursor.col;
    return done({ row, col: Math.min(desired, lines[row]!.length - 1) }, { ...state, pending: '', preferredCol: desired }, '', digits ? 'Counts' : key);
  }
  if (key === '^') return done({ row: cursor.row, col: first(lines[cursor.row]!) }, undefined, '', digits ? 'Counts' : key);
  if (key === '$') {
    if (count > 1 && cursor.row === lines.length - 1) return done(cursor, undefined, 'End of file');
    const row = clamp(cursor.row + count - 1, lines.length - 1);
    return done({ row, col: lines[row]!.length - 1 }, { ...state, pending: '', preferredCol: Number.POSITIVE_INFINITY }, '', digits ? 'Counts' : key);
  }
  if (key === 'G') {
    const row = digits ? clamp(count - 1, lines.length - 1) : lines.length - 1;
    return done({ row, col: first(lines[row]!) }, undefined, '', digits ? 'Counts' : key);
  }
  if (key === ';' || key === ',') {
    if (!state.lastFind) return done(cursor, undefined, 'No previous character find');
    let spec = state.lastFind.command;
    if (key === ',') spec = ({ f: 'F', F: 'f', t: 'T', T: 't' } as const)[spec];
    const at = characterFind(lines, cursor, spec, state.lastFind.char, count, true);
    return done(at ?? cursor, undefined, at ? '' : 'Character not found', digits ? 'Counts' : key);
  }
  if (key === 'n' || key === 'N') {
    if (!state.lastSearch) return done(cursor, undefined, 'No previous search');
    const direction = key === 'n' ? state.lastSearch.direction : state.lastSearch.direction === 1 ? -1 : 1;
    const at = search(lines, cursor, state.lastSearch.text, direction, count);
    return done(at ?? cursor, undefined, at ? '' : 'Pattern not found', digits ? 'Counts' : key);
  }
  if (key === '%') {
    if (digits) {
      if (count > 100) return done(cursor, undefined, 'Percentage must be 1–100');
      const row = clamp(Math.ceil(count * lines.length / 100) - 1, lines.length - 1);
      return done({ row, col: first(lines[row]!) }, undefined, '', 'Counts');
    }
    return done(matching(lines, cursor), undefined, '', '%');
  }
  let at = cursor;
  for (let i = 0; i < count; i++) at = move(lines, at, key as Motion);
  return done(at, undefined, '', digits ? 'Counts' : key);
}
