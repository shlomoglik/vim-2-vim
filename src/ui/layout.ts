/** Fill the viewport while keeping the first and last sections at the screen edges. */
export function fitHeight(top: readonly string[], middle: readonly string[], bottom: readonly string[], height: number): string[] {
  if (height <= 0) return [];
  if (top.length + bottom.length > height) {
    const keptBottom = bottom.slice(-Math.min(bottom.length, height));
    return [...top.slice(0, height - keptBottom.length), ...keptBottom];
  }
  const room = Math.max(0, height - top.length - bottom.length);
  return [...top, ...middle.slice(0, room), ...Array(Math.max(0, room - middle.length)).fill(''), ...bottom].slice(0, height);
}

/** Keep the cursor in view, and include the target too when both fit. */
export function viewportStart(total: number, visible: number, cursor: number, target = cursor): number {
  if (visible >= total) return 0;
  const lastStart = Math.max(0, total - visible);
  const first = Math.min(cursor, target);
  const last = Math.max(cursor, target);
  if (last - first < visible) return Math.max(0, Math.min(first, lastStart));
  return Math.max(0, Math.min(cursor - Math.floor(visible / 2), lastStart));
}
