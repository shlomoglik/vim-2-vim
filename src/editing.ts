import { emptyCommand, interpret, type CommandState } from './command.js';
import type { Position } from './motion.js';

export type EditState = { lines: string[]; mode: 'normal' | 'insert'; pending: string; saved: boolean;
  savedLines: string[]; undo: string[][]; redo: string[][]; navigation: CommandState; used: string[] };
export const newEdit = (lines: readonly string[]): EditState => ({ lines: [...lines], mode: 'normal', pending: '', saved: false,
  savedLines: [...lines], undo: [], redo: [], navigation: emptyCommand(), used: [] });
const clamp = (n: number, max: number) => Math.max(0, Math.min(n, max));
export function editKey(edit: EditState, cursor: Position, key: string, unlocked: readonly string[]): { edit: EditState; cursor: Position; message: string; quit: boolean } {
  const state: EditState = { ...edit, lines: [...edit.lines], undo: [...edit.undo], redo: [...edit.redo], used: [...edit.used] };
  const result = (at = cursor, message = '', quit = false) => ({ edit: state, cursor: at, message, quit });
  const remember = () => { state.undo.push([...state.lines]); state.redo = []; state.saved = false; };
  const use = (command: string) => { if (!state.used.includes(command)) state.used.push(command); };
  const escape = key === 'escape' || key === '\x1b';
  if (state.mode === 'insert') {
    if (escape) { state.mode = 'normal'; use('Escape'); return result({ row: cursor.row, col: clamp(cursor.col - 1, state.lines[cursor.row]!.length - 1) }); }
    if (key === 'backspace' || key === '\x7f' || key === '\x08') {
      if (cursor.col > 0) {
        remember(); const line = state.lines[cursor.row]!;
        state.lines[cursor.row] = line.slice(0, cursor.col - 1) + line.slice(cursor.col);
        return result({ row: cursor.row, col: cursor.col - 1 });
      }
      if (cursor.row > 0) {
        remember(); const previous = state.lines[cursor.row - 1]!;
        state.lines.splice(cursor.row - 1, 2, previous + state.lines[cursor.row]!);
        return result({ row: cursor.row - 1, col: previous.length });
      }
      return result();
    }
    if (key === '\n' || key === '\r') {
      remember(); const line = state.lines[cursor.row]!; state.lines.splice(cursor.row, 1, line.slice(0, cursor.col), line.slice(cursor.col));
      return result({ row: cursor.row + 1, col: 0 });
    }
    if (key.length === 1 && key >= ' ') {
      remember(); const line = state.lines[cursor.row]!;
      state.lines[cursor.row] = line.slice(0, cursor.col) + key + line.slice(cursor.col);
      return result({ row: cursor.row, col: cursor.col + 1 });
    }
    return result();
  }
  if (state.pending.startsWith(':')) {
    if (escape) { state.pending = ''; return result(); }
    if (key === '\n' || key === '\r') {
      const command = state.pending; state.pending = '';
      if (command === ':w') { state.saved = true; state.savedLines = [...state.lines]; use(':w'); return result(cursor, 'Written'); }
      if (command === ':q') return state.saved ? result(cursor, 'Closed', true) : result(cursor, 'Save before leaving');
      return result(cursor, 'Unknown command');
    }
    state.pending += key; return result();
  }
  if (escape && state.pending) { state.pending = ''; return result(); }
  if (state.navigation.pending) {
    const motion = interpret(state.lines, cursor, state.navigation, key, unlocked);
    state.navigation = motion.state;
    if (motion.executed) use(motion.executed);
    return result(motion.cursor, motion.message);
  }
  if (key === ':') { state.pending = ':'; return result(); }
  if (state.pending === 'r') {
    state.pending = '';
    const line = state.lines[cursor.row]!;
    if (!line[cursor.col]) return result(cursor, 'No character here');
    remember(); state.lines[cursor.row] = line.slice(0, cursor.col) + key + line.slice(cursor.col + 1); use('r');
    return result();
  }
  if (state.pending === 'd') {
    state.pending = '';
    if (key !== 'd') return result(cursor, 'Press d again to delete this line');
    remember();
    state.lines.splice(cursor.row, 1);
    if (!state.lines.length) state.lines.push('');
    use('dd');
    const row = clamp(cursor.row, state.lines.length - 1);
    return result({ row, col: clamp(cursor.col, state.lines[row]!.length - 1) });
  }
  if (key === 'u' || key === '\x12' || key === 'ctrl+r') {
    const from = key === 'u' ? state.undo : state.redo;
    const to = key === 'u' ? state.redo : state.undo;
    const previous = from.pop();
    if (!previous) return result(cursor, 'Nothing to undo or redo');
    to.push([...state.lines]); state.lines = previous; state.saved = false; use(key === 'u' ? 'u' : 'Ctrl-R');
    return result({ row: clamp(cursor.row, state.lines.length - 1), col: clamp(cursor.col, state.lines[clamp(cursor.row, state.lines.length - 1)]!.length - 1) });
  }
  if ('iaIAoO'.includes(key) && key.length === 1) {
    use(key);
    if (key === 'o' || key === 'O') {
      remember(); const row = cursor.row + (key === 'o' ? 1 : 0); state.lines.splice(row, 0, ''); state.mode = 'insert';
      return result({ row, col: 0 });
    }
    state.mode = 'insert';
    const col = key === 'i' ? cursor.col : key === 'a' ? cursor.col + 1 : key === 'I' ? state.lines[cursor.row]!.search(/\S/) : state.lines[cursor.row]!.length;
    return result({ row: cursor.row, col: Math.max(0, col) });
  }
  if (key === 'x' || key === 'r' || key === 's') {
    if (key === 'r') { state.pending = 'r'; return result(); }
    const line = state.lines[cursor.row]!;
    if (cursor.col >= line.length) return result(cursor, 'No character here');
    remember(); state.lines[cursor.row] = line.slice(0, cursor.col) + line.slice(cursor.col + 1); use(key);
    if (key === 's') state.mode = 'insert';
    return result({ row: cursor.row, col: clamp(cursor.col, state.lines[cursor.row]!.length - 1) });
  }
  if (key === 'd') { state.pending = 'd'; return result(); }
  const motion = interpret(state.lines, cursor, state.navigation, key, unlocked);
  state.navigation = motion.state;
  if (motion.executed) use(motion.executed);
  return result(motion.cursor, motion.message);
}
