import type { Position } from './motion.js';

export type TextRange = { start: number; end: number; linewise: boolean };
export const offsetAt = (lines: readonly string[], at: Position): number =>
  lines.slice(0, at.row).reduce((total, line) => total + line.length + 1, 0) + at.col;
export function positionAt(lines: readonly string[], offset: number): Position {
  const prefix = lines.join('\n').slice(0, Math.max(0, offset)).split('\n');
  return { row: prefix.length - 1, col: prefix.at(-1)!.length };
}
export function lineRange(lines: readonly string[], firstRow: number, lastRow = firstRow): TextRange {
  const first = Math.max(0, Math.min(firstRow, lastRow));
  const last = Math.min(lines.length - 1, Math.max(firstRow, lastRow));
  return { start: offsetAt(lines, { row: first, col: 0 }), end: offsetAt(lines, { row: last, col: lines[last]!.length }), linewise: true };
}
const wordKind = (char: string, big: boolean) => /\s/.test(char) ? 0 : big || /[A-Za-z0-9_]/.test(char) ? 1 : 2;

/** A text-object range uses an exclusive end, including across line breaks. */
export function textObjectRange(lines: readonly string[], cursor: Position, around: boolean, object: string): TextRange | null {
  const text = lines.join('\n');
  const at = offsetAt(lines, cursor);
  if (object === 'w' || object === 'W') {
    let start = at, end = at;
    const big = object === 'W';
    if (!text[at]) return null;
    const kind = wordKind(text[at]!, big);
    while (start > 0 && wordKind(text[start - 1]!, big) === kind) start--;
    while (end < text.length && wordKind(text[end]!, big) === kind) end++;
    if (around) {
      const after = end;
      while (end < text.length && /[ \t]/.test(text[end]!)) end++;
      if (after === end) while (start > 0 && /[ \t]/.test(text[start - 1]!)) start--;
    }
    return { start, end, linewise: false };
  }
  if (object === 'p') {
    let first = cursor.row, last = cursor.row;
    while (first > 0 && lines[first - 1]!.trim()) first--;
    while (last < lines.length - 1 && lines[last + 1]!.trim()) last++;
    if (around) while (last < lines.length - 1 && !lines[last + 1]!.trim()) last++;
    return lineRange(lines, first, last);
  }
  if ('"\'`'.includes(object) && object.length === 1) {
    const line = lines[cursor.row]!;
    const quotes: number[] = [];
    for (let col = 0; col < line.length; col++) {
      let slashes = 0;
      for (let before = col - 1; before >= 0 && line[before] === '\\'; before--) slashes++;
      if (line[col] === object && slashes % 2 === 0) quotes.push(col);
    }
    for (let index = 0; index + 1 < quotes.length; index += 2) {
      const open = quotes[index]!, close = quotes[index + 1]!;
      if (close < cursor.col) continue;
      const base = offsetAt(lines, { row: cursor.row, col: 0 });
      return { start: base + open + (around ? 0 : 1), end: base + close + (around ? 1 : 0), linewise: false };
    }
    return null;
  }
  const pairs: Record<string, [string, string]> = {
    '(': ['(', ')'], ')': ['(', ')'], '[': ['[', ']'], ']': ['[', ']'],
    '{': ['{', '}'], '}': ['{', '}'], '<': ['<', '>'], '>': ['<', '>'],
  };
  const pair = pairs[object];
  if (!pair) return null;
  const stack: number[] = [];
  const enclosing: Array<[number, number]> = [];
  for (let index = 0; index < text.length; index++) {
    if (text[index] === pair[0]) stack.push(index);
    else if (text[index] === pair[1]) {
      const open = stack.pop();
      if (open !== undefined && open <= at && index >= at) enclosing.push([open, index]);
    }
  }
  const nearest = enclosing.sort((a, b) => b[0] - a[0])[0];
  return nearest ? { start: nearest[0] + (around ? 0 : 1), end: nearest[1] + (around ? 1 : 0), linewise: false } : null;
}

export function selectionRange(lines: readonly string[], anchor: Position, cursor: Position, linewise: boolean): TextRange {
  if (linewise) return lineRange(lines, anchor.row, cursor.row);
  const from = offsetAt(lines, anchor), to = offsetAt(lines, cursor);
  return { start: Math.min(from, to), end: Math.min(lines.join('\n').length, Math.max(from, to) + 1), linewise: false };
}
export function isSelected(lines: readonly string[], anchor: Position | null | undefined, cursor: Position, mode: string, at: Position): boolean {
  if (!anchor || mode !== 'visual' && mode !== 'visual-line') return false;
  const range = selectionRange(lines, anchor, cursor, mode === 'visual-line');
  const offset = offsetAt(lines, at);
  return offset >= range.start && offset < range.end;
}
