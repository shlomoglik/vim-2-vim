export type PreviewRow = { source: string | null; target: string | null; actualRow: number | null; kind: 'live' | 'insert' | 'replace' };

export function firstDifferenceColumn(actual: string, expected: string): number {
  let col = 0;
  while (col < actual.length && col < expected.length && actual[col] === expected[col]) col++;
  return col;
}

function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++)
      next[j] = Math.min(previous[j]! + 1, next[j - 1]! + 1, previous[j - 1]! + Number(a[i - 1] !== b[j - 1]));
    previous = next;
  }
  return previous[b.length]!;
}

/** Align the live buffer with the target so added lines can appear as ghost rows. */
export function previewRows(lines: readonly string[], expected: readonly string[]): PreviewRow[] {
  const gap = 4;
  const costs = Array.from({ length: lines.length + 1 }, () => Array<number>(expected.length + 1).fill(0));
  for (let i = 1; i <= lines.length; i++) costs[i]![0] = i * gap;
  for (let j = 1; j <= expected.length; j++) costs[0]![j] = j * gap;
  for (let i = 1; i <= lines.length; i++) for (let j = 1; j <= expected.length; j++) {
    costs[i]![j] = Math.min(
      costs[i - 1]![j - 1]! + Math.min(6, editDistance(lines[i - 1]!, expected[j - 1]!)),
      costs[i - 1]![j]! + gap,
      costs[i]![j - 1]! + gap,
    );
  }
  const rows: PreviewRow[] = [];
  let i = lines.length, j = expected.length;
  while (i || j) {
    if (i && j && costs[i]![j] === costs[i - 1]![j - 1]! + Math.min(6, editDistance(lines[i - 1]!, expected[j - 1]!))) {
      rows.push({ source: lines[--i]!, target: expected[--j]!, actualRow: i, kind: 'live' });
    } else if (i && costs[i]![j] === costs[i - 1]![j]! + gap) {
      rows.push({ source: lines[--i]!, target: null, actualRow: i, kind: 'live' });
    } else {
      rows.push({ source: null, target: expected[--j]!, actualRow: null, kind: 'insert' });
    }
  }
  return rows.reverse().flatMap(row => row.source !== null && row.target !== null && !row.target.startsWith(row.source) && row.source.trimEnd() !== row.target ?
    [row, { source: null, target: row.target, actualRow: null, kind: 'replace' as const }] : [row]);
}

/** Keep only the next unresolved suggestion visible. */
export function nextPreviewRows(lines: readonly string[], expected: readonly string[]): PreviewRow[] {
  const aligned = previewRows(lines, expected);
  const active = aligned.findIndex(row => row.kind === 'insert' || row.kind === 'live' && row.source !== row.target);
  return aligned.filter((row, index) => row.kind === 'live' || index === active || row.kind === 'replace' && index === active + 1);
}

export function editingMismatch(lines: readonly string[], expected: readonly string[]): string | null {
  if (lines.length === expected.length && lines.every((line, row) => line === expected[row])) return null;
  const rows = previewRows(lines, expected);
  const extra = rows.find(row => row.kind === 'live' && row.target === null);
  if (extra) return extra.source === '' ? `Extra blank line ${extra.actualRow! + 1}. Use gg then dd to remove it.` :
    `Extra line ${extra.actualRow! + 1}. Remove it with dd.`;
  const missing = rows.find(row => row.kind === 'insert');
  if (missing) return 'A green + line is still missing.';
  const different = rows.find(row => row.kind === 'live' && row.source !== row.target);
  if (!different || different.target === null || different.source === null) return 'File differs from the target.';
  const col = firstDifferenceColumn(different.source, different.target);
  if (different.source.slice(col).trim() === '' && col >= different.target.length)
    return `Extra trailing space on line ${different.actualRow! + 1}, column ${col + 1}. Delete it with x.`;
  const name = (char: string | undefined) => char === undefined ? 'end of line' : char === ' ' ? 'space' : char === '\t' ? 'tab' : JSON.stringify(char);
  return `Line ${different.actualRow! + 1}, column ${col + 1}: expected ${name(different.target[col])}, found ${name(different.source[col])}.`;
}
