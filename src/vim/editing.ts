import { lineRange, offsetAt, positionAt, selectionRange, textObjectRange, type TextRange } from './ranges.js';
import { move } from './motion.js';
import { emptyCommand, interpret, type CommandState } from './command.js';
import type { Position } from './motion.js';

export type EditState = { lines: string[]; mode: 'normal' | 'insert' | 'visual' | 'visual-line'; pending: string; saved: boolean;
  savedLines: string[]; undo: string[][]; redo: string[][]; navigation: CommandState; used: string[]; selectionAnchor?: Position | null; register?: { lines: string[]; linewise: boolean } };
export const newEdit = (lines: readonly string[]): EditState => ({ lines: [...lines], mode: 'normal', pending: '', saved: false,
  savedLines: [...lines], undo: [], redo: [], navigation: emptyCommand(), used: [] });
const clamp = (n: number, max: number) => Math.max(0, Math.min(n, max));
export function editKey(edit: EditState, cursor: Position, key: string, unlocked: readonly string[]): { edit: EditState; cursor: Position; message: string; quit: boolean } {
  const state: EditState = { ...edit, lines: [...edit.lines], undo: [...edit.undo], redo: [...edit.redo], used: [...edit.used] };
  const result = (at = cursor, message = '', quit = false) => ({ edit: state, cursor: at, message, quit });
  const remember = () => { state.undo.push([...state.lines]); state.redo = []; state.saved = false; };
  const use = (command: string) => { if (!state.used.includes(command)) state.used.push(command); };
  const escape = key === 'escape' || key === '\x1b';
  const applyRange = (range: TextRange | null, operator: string, command: string) => {
    if (!range) { state.pending = ''; return result(cursor, 'No matching text'); }
    const text = state.lines.join('\n');
    const at = positionAt(state.lines, range.start);
    const end = positionAt(state.lines, range.end);
    state.register = { lines: text.slice(range.start, range.end).split('\n'), linewise: range.linewise };
    state.pending = ''; state.selectionAnchor = null; state.mode = 'normal'; use(command);
    if (operator === 'y') return result(at);
    remember();
    if (range.linewise) {
      state.lines.splice(at.row, end.row - at.row + 1, ...(operator === 'c' ? [''] : []));
      if (!state.lines.length) state.lines = [''];
    } else state.lines = (text.slice(0, range.start) + text.slice(range.end)).split('\n');
    const row = clamp(at.row, state.lines.length - 1);
    const col = clamp(at.col, state.lines[row]!.length - (operator === 'c' ? 0 : 1));
    if (operator === 'c') state.mode = 'insert';
    return result({ row, col });
  };
  if (state.mode === 'visual' || state.mode === 'visual-line') {
    if (escape || key === 'v' && state.mode === 'visual' || key === 'V' && state.mode === 'visual-line') {
      state.mode = 'normal'; state.selectionAnchor = null;
      state.navigation = { ...state.navigation, pending: '' };
      use('Escape'); return result();
    }
    if (key === 'v' || key === 'V') { state.mode = key === 'v' ? 'visual' : 'visual-line'; use(key); return result(); }
    if (key === 'o') { const anchor = state.selectionAnchor ?? cursor; state.selectionAnchor = cursor; use('o'); return result(anchor); }
    if ('dcy'.includes(key) && key.length === 1) return applyRange(selectionRange(state.lines, state.selectionAnchor ?? cursor, cursor, state.mode === 'visual-line'), key, key);
    const motion = interpret(state.lines, cursor, state.navigation, key, unlocked);
    state.navigation = motion.state; if (motion.executed) use(motion.executed);
    return result(motion.cursor, motion.message);
  }
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
  if (/^[dcy](?:[ia])?$/.test(state.pending)) {
    const operator = state.pending[0]!;
    if (state.pending.length === 2) return applyRange(textObjectRange(state.lines, cursor, state.pending[1] === 'a', key), operator, state.pending + key);
    if (key === 'i' || key === 'a') { state.pending += key; return result(); }
    const command = operator + key;
    if (key === operator) {
      const outcome = applyRange(lineRange(state.lines, cursor.row), operator, command);
      // Keep dd's established cursor placement for existing exercises.
      if (operator === 'd') outcome.cursor.col = clamp(cursor.col, state.lines[outcome.cursor.row]!.length - 1);
      return outcome;
    }
    if (key === 'j' || key === 'k') return applyRange(lineRange(state.lines, cursor.row, clamp(cursor.row + (key === 'j' ? 1 : -1), state.lines.length - 1)), operator, command);
    if (key === 'w' || key === 'W' || key === 'e' || key === 'E' || key === '$') {
      const target = move(state.lines, cursor, operator === 'c' && (key === 'w' || key === 'W') ? key === 'w' ? 'e' : 'E' : key);
      const start = offsetAt(state.lines, cursor);
      let end = offsetAt(state.lines, target);
      if (key === 'e' || key === 'E' || key === '$' || operator === 'c') end++;
      if (end <= start && (key === 'w' || key === 'W')) end = state.lines.join('\n').length;
      return applyRange({ start, end, linewise: false }, operator, command);
    }
    state.pending = ''; return result(cursor, 'Unknown operator motion');
  }
  if (key === 'v' || key === 'V') { state.mode = key === 'v' ? 'visual' : 'visual-line'; state.selectionAnchor = cursor; use(key); return result(); }
  if (key === 'D' || key === 'C') {
    return applyRange({ start: offsetAt(state.lines, cursor), end: offsetAt(state.lines, { row: cursor.row, col: state.lines[cursor.row]!.length }), linewise: false }, key === 'D' ? 'd' : 'c', key);
  }
  if (key === 'p' || key === 'P') {
    if (!state.register) return result(cursor, 'Nothing to put');
    remember(); use(key);
    if (state.register.linewise) {
      const row = cursor.row + (key === 'p' ? 1 : 0);
      state.lines.splice(row, 0, ...state.register.lines);
      return result({ row, col: Math.max(0, state.lines[row]!.search(/\S/)) });
    }
    const text = state.lines.join('\n');
    const offset = offsetAt(state.lines, cursor) + (key === 'p' && state.lines[cursor.row]!.length ? 1 : 0);
    const inserted = state.register.lines.join('\n');
    state.lines = (text.slice(0, offset) + inserted + text.slice(offset)).split('\n');
    return result(positionAt(state.lines, offset + inserted.length - 1));
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
  if (key === 'd' || key === 'c' || key === 'y') { state.pending = key; return result(); }
  if (key === 'Y') return applyRange(lineRange(state.lines, cursor.row), 'y', 'Y');
  const motion = interpret(state.lines, cursor, state.navigation, key, unlocked);
  state.navigation = motion.state;
  if (motion.executed) use(motion.executed);
  return result(motion.cursor, motion.message);
}
