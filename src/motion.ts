export type Motion = 'h' | 'j' | 'k' | 'l' | 'w' | 'b' | 'e' | '0' | '$' | '^' | 'gg' | 'G';
export type Position = { row: number; col: number };

const kind = (char: string): number => /[A-Za-z0-9_]/.test(char) ? 1 : /\s/.test(char) ? 0 : 2;

export function move(lines: readonly string[], from: Position, motion: Motion): Position {
  const row = from.row;
  const col = from.col;
  if (motion === 'h') return { row, col: Math.max(0, col - 1) };
  if (motion === 'l') return { row, col: Math.min(lines[row]!.length - 1, col + 1) };
  if (motion === '0') return { row, col: 0 };
  if (motion === '$') return { row, col: lines[row]!.length - 1 };
  if (motion === '^') return { row, col: Math.max(0, lines[row]!.search(/\S/)) };
  if (motion === 'gg' || motion === 'G') {
    const target = motion === 'gg' ? 0 : lines.length - 1;
    return { row: target, col: Math.max(0, lines[target]!.search(/\S/)) };
  }
  if (motion === 'j' || motion === 'k') {
    const next = Math.max(0, Math.min(lines.length - 1, row + (motion === 'j' ? 1 : -1)));
    return { row: next, col: Math.min(col, lines[next]!.length - 1) };
  }

  const text = lines.join('\n');
  const offsets = lines.map((_, i) => lines.slice(0, i).reduce((n, line) => n + line.length + 1, 0));
  let index = offsets[row]! + col;
  if (motion === 'w') {
    if (index >= text.length - 1) return from;
    const current = kind(text[index]!);
    if (current !== 0) while (index < text.length && kind(text[index]!) === current) index++;
    while (index < text.length && kind(text[index]!) === 0) index++;
    if (index >= text.length) return from;
  } else if (motion === 'e') {
    if (index >= text.length - 1) return from;
    const current = kind(text[index]!);
    if (current !== 0 && kind(text[index + 1]!) === current) {
      while (index + 1 < text.length && kind(text[index + 1]!) === current) index++;
    } else {
      index++;
      while (index < text.length && kind(text[index]!) === 0) index++;
      if (index >= text.length) return from;
      const nextKind = kind(text[index]!);
      while (index + 1 < text.length && kind(text[index + 1]!) === nextKind) index++;
    }
  } else {
    if (index === 0) return from;
    index--;
    while (index > 0 && kind(text[index]!) === 0) index--;
    const targetKind = kind(text[index]!);
    while (index > 0 && kind(text[index - 1]!) === targetKind) index--;
  }
  let targetRow = 0;
  while (targetRow + 1 < offsets.length && offsets[targetRow + 1]! <= index) targetRow++;
  return { row: targetRow, col: index - offsets[targetRow]! };
}
