import { move, type Motion, type Position } from './motion.js';
import { emptyCommand, interpret } from './command.js';

export const difficulties = ['easy', 'normal', 'hard'] as const;
export type Difficulty = typeof difficulties[number];
export const badges = ['w', 'b', 'e', '0', '$', '^', 'gg', 'G', 'Counts', 'f', 'F', 't', 'T', ';', ',', '/', '?', 'n', 'N', '%', 'Navigator'] as const;
export const legacyIds = ['directions', 'w', 'b', 'e', '0', 'dollar', 'caret', 'gg', 'G', 'counts', 'f', 'F', 't', 'T', 'semicolon', 'comma', 'search-forward', 'search-backward', 'n', 'N', 'percent'] as const;
export const stageIds = [
  ...legacyIds.slice(0, 4), 'review-words', ...legacyIds.slice(4, 10), 'review-lines',
  ...legacyIds.slice(10, 16), 'review-finds', ...legacyIds.slice(16, 20), 'review-search',
  legacyIds[20], 'navigator', 'edit-insert', 'edit-lines', 'edit-repair', 'edit-undo', 'edit-challenge',
] as const;
export const LESSON_COUNT = stageIds.length;
export const NAVIGATION_COUNT = stageIds.indexOf('edit-insert');
const oldKeys: readonly (readonly string[])[] = [
  ['h', 'j', 'k', 'l'], ['w'], ['b'], ['e'], ['0'], ['$'], ['^'], ['gg'], ['G'],
  ['3j', '12G'], ['f{char}'], ['F{char}'], ['t{char}'], ['T{char}'], [';'], [','],
  ['/text↵'], ['?text↵'], ['n'], ['N'], ['%'],
];
export const challengeKeys: readonly (readonly string[])[] = stageIds.map(id => {
  const old = legacyIds.indexOf(id as typeof legacyIds[number]);
  if (old >= 0) return oldKeys[old]!;
  if (id.startsWith('review-')) return ['review'];
  if (id === 'navigator') return ['all motions'];
  return ['edit', ':w'];
});
export const stageBadge = (index: number): string | null => {
  const old = legacyIds.indexOf(stageIds[index] as typeof legacyIds[number]);
  return old > 0 ? badges[old - 1]! : stageIds[index] === 'navigator' ? 'Navigator' : null;
};
export const earnedBadges = (completed: number): string[] => stageIds.slice(0, completed).map((_, i) => stageBadge(i)).filter((badge): badge is string => badge !== null);

export type Lesson = {
  title: string;
  instruction: string;
  hint: string;
  lines: readonly string[];
  start: Position;
  checkpoints: readonly Position[];
  idealKeys: readonly number[];
  badge: string | null;
  referenceRoutes: readonly string[];
  id: string;
  requiredCommands?: readonly string[];
  editing?: { filename: string; expected: readonly string[]; requireSave: boolean };
};

const movementLines = [
  'start move across map',
  'step right then down',
  'left turn near exit',
  'follow winding road',
  'climb back to ridge',
  'final motion waits',
];
const wordLines = [
  'calm wind rain glow',
  'warm blue star path',
  'rock leaf moon tide',
  'hope pace line jump',
  'seek find word home',
  'step move back done',
];
const movementStops: Position[] = [
  { row: 0, col: 4 }, { row: 1, col: 4 }, { row: 1, col: 15 },
  { row: 2, col: 15 }, { row: 2, col: 3 }, { row: 1, col: 3 },
  { row: 3, col: 3 }, { row: 3, col: 16 }, { row: 4, col: 16 },
  { row: 4, col: 5 }, { row: 3, col: 5 }, { row: 5, col: 5 },
];
const lineCounts: Record<Difficulty, number> = { easy: 4, normal: 5, hard: 6 };
const movementCounts: Record<Difficulty, number> = { easy: 8, normal: 10, hard: 12 };
const wordCounts: Record<Difficulty, number> = { easy: 7, normal: 9, hard: 11 };
const firstRoutes: readonly string[][] = [
  ['llll', 'j', 'lllllllllll', 'j', 'hhhhhhhhhhhh', 'k', 'jj', 'lllllllllllll', 'j', 'hhhhhhhhhhh', 'k', 'jj'],
  ['wl', 'wwl', 'wwl', 'wwl', 'wwl', 'wwl', 'wwl', 'wwl', 'wwl', 'wwl', 'wwl'],
  ['bl', 'hbbl', 'hbbl', 'hbbl', 'hbbl', 'hbbl', 'hbbl', 'hbbl', 'hbbl', 'hbbl', 'hbbl'],
  ['we', 'ee', 'ee', 'ee', 'ee', 'ee', 'ee', 'ee', 'ee', 'ee', 'ee'],
];
const fifthRoutes: Record<Difficulty, readonly string[]> = {
  easy: ['w', 'jjbe', 'w', 'kkbe', 'w', 'jjbe', 'w'],
  normal: ['w', 'jjbe', 'w', 'jbje', 'kkkk0', 'jjbe', 'w', 'jjbe', 'w'],
  hard: ['w', 'jjbe', 'w', 'jjbe', 'w', 'kkkkbe', 'w', 'jjbe', 'w', 'jjbe', 'w'],
};
const id = (pos: Position) => `${pos.row}:${pos.col}`;

/** Shortest route using only motions unlocked for this run. */
export function shortestRoute(lines: readonly string[], start: Position, goal: Position, motions: readonly Motion[]): Motion[] {
  const queue: Array<{ at: Position; path: Motion[] }> = [{ at: start, path: [] }];
  const seen = new Set([id(start)]);
  for (let head = 0; head < queue.length; head++) {
    const { at, path } = queue[head]!;
    if (id(at) === id(goal)) return path;
    for (const motion of motions) {
      const next = move(lines, at, motion);
      const key = id(next);
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push({ at: next, path: [...path, motion] });
    }
  }
  throw new Error(`Unreachable lesson target ${id(goal)}`);
}

function words(lines: readonly string[]): Position[] {
  return lines.flatMap((line, row) => Array.from(line.matchAll(/[A-Za-z0-9_]+/g), match => ({ row, col: match.index })));
}

export function lessonFor(index: number, difficulty: Difficulty, unlocked: readonly Motion[]): Lesson {
  const id = stageIds[index];
  if (!id) throw new RangeError(`Unknown lesson ${index}`);
  if (id.startsWith('review-') || id === 'navigator') return reviewLesson(index, difficulty);
  if (id.startsWith('edit-')) return editingLesson(index);
  const oldIndex = legacyIds.indexOf(id as typeof legacyIds[number]);
  const lesson = oldLessonFor(oldIndex, difficulty, [...unlocked, stageBadge(index) as Motion]);
  return { ...lesson, id, title: `${index + 1} · ${lesson.title.split('· ')[1]}`, badge: stageBadge(index) };
}

function oldLessonFor(index: number, difficulty: Difficulty, unlocked: readonly Motion[]): Lesson {
  if (index >= 5 && index < LESSON_COUNT) return advancedLesson(index, difficulty);
  const lineCount = lineCounts[difficulty];
  let lines: readonly string[];
  let start: Position;
  let checkpoints: Position[];
  let title: string;
  let instruction: string;
  let hint: string;
  if (index === 0) {
    lines = movementLines.slice(0, lineCount);
    start = { row: 0, col: 0 };
    checkpoints = movementStops.slice(0, movementCounts[difficulty]);
    title = '1 · Four directions';
    instruction = 'Find every green target with h, j, k and l.';
    hint = 'h moves left, j down, k up, and l right. You can use any unlocked motion.';
  } else if (index >= 1 && index <= 4) {
    lines = wordLines.slice(0, lineCount);
    const found = words(lines);
    const count = wordCounts[difficulty];
    if (index === 1) {
      start = found[0]!;
      checkpoints = Array.from({ length: count }, (_, i) => ({ row: found[1 + i * 2]!.row, col: found[1 + i * 2]!.col + 1 }));
      title = '2 · Jump forward';
      instruction = 'Cross lines and combine w with character motions.';
      hint = 'w lands at the next word start. Use l to reach a character inside it.';
    } else if (index === 2) {
      start = found[found.length - 1]!;
      checkpoints = Array.from({ length: count }, (_, i) => ({ row: found[found.length - 2 - i * 2]!.row, col: found[found.length - 2 - i * 2]!.col + 1 }));
      title = '3 · Jump backward';
      instruction = 'Travel back across lines with b and your other motions.';
      hint = 'From inside a word, b first returns to its start; press b again to go farther back.';
    } else if (index === 3) {
      start = found[0]!;
      checkpoints = Array.from({ length: count }, (_, i) => {
        const word = found[1 + i * 2]!;
        const line = lines[word.row]!;
        return { row: word.row, col: word.col + line.slice(word.col).match(/^[A-Za-z0-9_]+/)![0].length - 1 };
      });
      title = '4 · Land on the end';
      instruction = 'Use e with your earned motions to reach word ends.';
      hint = 'e lands on the end of the current or next word. You can combine it with w, b and character motions.';
    } else {
      start = { row: 0, col: lines[0]!.length - 1 };
      checkpoints = Array.from({ length: count }, (_, i) => {
        const row = (i + 1) % lineCount;
        return { row, col: i % 2 === 0 ? 0 : lines[row]!.length - 1 };
      });
      title = '5 · Return to column zero';
      instruction = 'Cross lines between their first and last characters.';
      hint = '0 jumps to the first column. Use your other motions to reach each line end.';
    }
  } else {
    throw new RangeError(`Unknown lesson ${index}`);
  }
  const referenceRoutes = index === 4 ? fifthRoutes[difficulty] : firstRoutes[index]!.slice(0, checkpoints.length);
  let current = start;
  let state = emptyCommand();
  const idealKeys = checkpoints.map((checkpoint, step) => {
    const route = referenceRoutes[step]!;
    for (const key of route) {
      const outcome = interpret(lines, current, state, key, unlocked);
      current = outcome.cursor; state = outcome.state;
      if (outcome.message) throw new Error(`Invalid reference route ${index + 1}: ${route}`);
    }
    if (current.row !== checkpoint.row || current.col !== checkpoint.col) throw new Error(`Reference route missed target ${index + 1}:${step + 1}`);
    return route.length;
  });
  return { title, instruction, hint, lines, start, checkpoints, idealKeys, badge: index ? badges[index - 1]! : null, referenceRoutes, id: legacyIds[index]! };
}

const advanced = [
  ['Line end', 'Use $ to reach the end of each line, then change lines.', '$ lands on the last character of the current line.', ['j$', 'j$', 'k$', 'j$']],
  ['First visible character', 'Navigate indentation with ^.', '^ skips spaces and lands on the first visible character.', ['j^', 'j^', 'k^', 'j^']],
  ['File start', 'Return to targets near the top with gg.', 'gg jumps to the first line.', ['G', 'gg', '3j', 'gg']],
  ['File end', 'Alternate between distant top and bottom targets.', 'G jumps to the final line; gg returns to the first.', ['G', 'gg', 'G', 'gg']],
  ['Measured jumps', 'Cross measured line distances with count prefixes.', 'Type a number before a motion, such as 3j or 4G.', ['3j', '2j', '4k', '6G']],
  ['Find forward', 'Find a chosen character among repeated characters.', 'f plus a character lands on its next occurrence.', ['fa', 'fa', 'fb', 'fa']],
  ['Find backward', 'Find characters behind the cursor.', 'F plus a character searches left on the current line.', ['Fa', 'Fa', 'Fb', 'Fa']],
  ['Stop before', 'Stop immediately before a chosen character.', 't plus a character lands one column before it.', ['ta', '2ta', 'tb', 'ta']],
  ['Stop after', 'Stop immediately after a character behind you.', 'T plus a character lands one column after it.', ['Ta', '2Ta', 'Tb', 'Ta']],
  ['Repeat character find', 'Traverse repeated characters with ;.', '; repeats the latest f, F, t, or T direction.', ['fa', ';', ';', ';']],
  ['Reverse character find', 'Traverse repeated characters in both directions.', ', repeats the latest find in the opposite direction.', ['fa', ';', ',', ';']],
  ['Search forward', 'Find a literal word across lines.', 'Type /word then Enter. Search wraps at the end.', ['/star\n', '/moon\n', '/star\n', '/moon\n']],
  ['Search backward', 'Find earlier literal matches across lines.', 'Type ?word then Enter. Search wraps at the top.', ['?star\n', '?moon\n', '?star\n', '?moon\n']],
  ['Repeat search', 'Visit successive matches with n.', 'n repeats the last search direction and query.', ['/star\n', 'n', 'n', 'n']],
  ['Reverse search', 'Move among matches in both directions.', 'N repeats the last search in the opposite direction.', ['/star\n', 'n', 'N', 'n']],
  ['Matching pairs', 'Cross nested (), [], and {} pairs.', '% jumps between matching delimiters.', ['%', 'F[', '%', 'F{', '%', 'G%']],
] as const;

function advancedLesson(index: number, difficulty: Difficulty): Lesson {
  const step = index - 5;
  const [name, instruction, hint, seed] = advanced[step]!;
  const lineCount = { easy: 5, normal: 7, hard: 10 }[difficulty];
  let lines: string[];
  let start: Position;
  let routes: string[] = [...seed];
  if (step <= 4) {
    lines = Array.from({ length: lineCount }, (_, i) => `  marker ${i + 1}    trail ${String.fromCharCode(65 + i)}`);
    start = { row: 0, col: 2 };
    if(step === 1) { start.col = lines[0].indexOf('trail') || 0;}
    if (step === 4) routes = ['3j', '2j', '4k', `${lineCount}G`];
    if (step === 2) { start = { row: lineCount - 1, col: 2 }; routes = ['gg', 'jjj', 'gg', 'jj']; }
  } else if (step <= 10) {
    const distractors = difficulty === 'easy' ? '' : difficulty === 'normal' ? ' a x' : ' a x a x';
    lines = Array.from({ length: lineCount }, (_, i) => i === 0 ? `x a x a x b x a x a x a x${distractors}` : `  marker ${i + 1}   a b a`);
    start = { row: 0, col: step === 6 || step === 8 ? 20 : 0 };
    if (step === 6) routes = ['Fa', 'Fa', 'Fb', 'Fa'];
    if (step === 8) routes = ['Ta', '2Ta', 'Tb', 'Ta'];
    if (step === 7) routes = ['ta', '2ta', 'tb', 'ta'];
    if (step === 9) routes = ['fa', ';', ';', ';'];
    if (step === 10) routes = ['fa', ';', ',', ';'];
  } else if (step <= 14) {
    lines = Array.from({ length: lineCount }, (_, i) => `orbit ${i + 1} star moon star trail`);
    start = { row: step === 12 ? lineCount - 1 : 0, col: 0 };
  } else {
    lines = ['(alpha [beta {gamma} delta] omega)', ...Array.from({ length: lineCount - 2 }, (_, i) => `  trail ${i + 1} (star)`), '{last [turn] here}'];
    start = { row: 0, col: 0 };
    routes = ['%', 'F[', '%', 'F{', '%', 'G%'];
  }
  const extra = difficulty === 'easy' ? 0 : difficulty === 'normal' ? 1 : 2;
  routes = [...routes, ...Array.from({ length: extra }, (_, i) => {
    if (step <= 1) return step === 1 ? 'j^' : 'j$';
    if (step === 2) return i % 2 ? 'jj' : 'gg';
    if (step === 3) return i % 2 ? 'gg' : 'G';
    if (step === 4) return i % 2 ? '2j' : '2k';
    if (step === 7) return i === 0 ? '0ta' : '2ta';
    if (step === 8) return i === 0 ? '0$Ta' : '2Ta';
    if (step <= 6) return step === 6 ? (i === 0 ? '0$Fa' : 'Fa') : (i === 0 ? '0fa' : 'fa');
    if (step <= 10) return i === 0 ? ';' : '0fa';
    if (step <= 14) return step <= 12 ? `${step === 12 ? '?' : '/'}star\n` : 'n';
    return '%';
  })];
  const unlocked = ['h', 'j', 'k', 'l', ...badges.slice(0, index)].filter(b => b !== 'Navigator');
  let cursor = start;
  let state = emptyCommand();
  const checkpoints: Position[] = [];
  const idealKeys: number[] = [];
  for (const route of routes) {
    for (const key of route) {
      const result = interpret(lines, cursor, state, key, unlocked);
      cursor = result.cursor;
      state = result.state;
      if (result.message) throw new Error(`Invalid reference route ${index + 1}: ${route} (${result.message})`);
    }
    if (state.pending) throw new Error(`Incomplete reference route ${route}`);
    checkpoints.push(cursor);
    idealKeys.push(route.length);
  }
  return { title: `${index + 1} · ${name}`, instruction, hint, lines, start, checkpoints, idealKeys,
    badge: badges[index - 1]!, referenceRoutes: routes, id: legacyIds[index]! };
}

function routeLesson(index: number, difficulty: Difficulty, lines: string[], start: Position, routes: string[], instruction: string, hint: string, requiredCommands?: readonly string[]): Lesson {
  let cursor = start;
  let state = emptyCommand();
  const checkpoints: Position[] = [];
  const idealKeys: number[] = [];
  const used = new Set<string>();
  const unlocked = ['h', 'j', 'k', 'l', ...badges];
  for (const route of routes) {
    const before = cursor;
    for (const key of route) {
      const result = interpret(lines, cursor, state, key, unlocked);
      if (result.message) throw new Error(`${stageIds[index]}: ${route}: ${result.message}`);
      if (result.executed) used.add(result.executed);
      cursor = result.cursor; state = result.state;
    }
    if (state.pending || cursor.row === before.row && cursor.col === before.col) throw new Error(`${stageIds[index]}: motionless route ${route}`);
    checkpoints.push(cursor); idealKeys.push(route.length);
  }
  if (requiredCommands?.some(command => !used.has(command))) throw new Error(`${stageIds[index]}: incomplete reference coverage: ${requiredCommands.filter(command => !used.has(command)).join(', ')}`);
  return { id: stageIds[index]!, title: `${index + 1} · ${stageIds[index] === 'navigator' ? 'Navigator challenge' : 'Navigation review'}`,
    instruction, hint, lines, start, checkpoints, idealKeys, badge: stageBadge(index), referenceRoutes: routes, requiredCommands };
}

function reviewLesson(index: number, difficulty: Difficulty): Lesson {
  const id = stageIds[index];
  const extra = difficulty === 'easy' ? [] : difficulty === 'normal' ? ['G', 'gg'] : ['G', 'gg', '3j', 'gg'];
  if (id === 'review-words') return routeLesson(index, difficulty,
    ['  alpha beta gamma', '  delta epsilon zeta', '  eta theta iota', '  kappa lambda mu'], { row: 0, col: 2 },
    ['w', 'e', 'b', 'jw', ...(difficulty === 'easy' ? [] : difficulty === 'normal' ? ['k', 'j'] : ['k', 'j', 'k', 'j'])], 'Travel through this note with word motions and line jumps.', 'Use w, b, e and the four directions.');
  if (id === 'review-lines') return routeLesson(index, difficulty,
    Array.from({ length: 10 }, (_, i) => `  task ${i + 1} = ready;`), { row: 0, col: 2 },
    ['3j', '$', 'gg', 'G', '2k', '$', ...extra], 'Inspect distant task lines using measured jumps.', 'Use counts with j or k, and gg or G for file edges.');
  if (id === 'review-finds') return routeLesson(index, difficulty,
    ['a x a x a x a x a x a x a', '  find a mark then return', '  verify a mark again', '  close a mark here'], { row: 0, col: 0 },
    ['fa', ';', ',', 'ta', '0$Fa', 'Fa', 'Ta', ...extra], 'Trace repeated markers in this code line.', 'f and t find ahead; F and T find behind. ; repeats and , reverses.');
  if (id === 'review-search') return routeLesson(index, difficulty,
    ['  star = open', '  moon = wait', '  star = ready', '  moon = done', '  star = close'], { row: 0, col: 2 },
    ['/moon\n', 'n', 'N', '?star\n', 'n', 'N', ...extra], 'Inspect repeated states across the file.', 'Search with / or ?, then use n and N.');
  const lines = Array.from({ length: 10 }, (_, i) => `  (alpha [beta {gamma} delta] omega) star moon star a x a x a ${i}`);
  const routes = ['w', 'b', 'e', '0', '$', '^', 'G', 'gg', '3j', 'fa', 'fa', ';', ',', 'Fa', 'ta', 'Ta', '/star\n', '?moon\n', 'n', 'N', '0%',
    ...(difficulty === 'easy' ? [] : difficulty === 'normal' ? ['G', 'gg'] : ['G', 'gg', '4j', 'G'])];
  return routeLesson(index, difficulty, lines, { row: 0, col: 2 }, routes,
    'Use every earned command while tracing this file. The remaining commands are shown below.',
    'Use every badge: word, line, find, search, count and matching pair.', badges.slice(0, 20));
}

function editingLesson(index: number): Lesson {
  const id = stageIds[index]!;
  const specs: Record<string, { lines: string[]; expected: string[]; instruction: string; hint: string }> = {
    'edit-insert': { lines: ['  name = Ada', '  role = coder'], expected: ['  name = Ada Lovelace', '  role = coder'], instruction: 'Press i, then Escape. Press $ to reach the last a in Ada. Press a, type " Lovelace" (with a leading space), Escape, then :w and Enter.', hint: 'i inserts before the cursor; a inserts after it. The target line is "  name = Ada Lovelace".' },
    'edit-lines': { lines: ['  title = Vim', '  status = ready'], expected: ['# practice', '  title = Vim lab', '  status = ready', '  done'], instruction: 'Make the file match the green target, one line at a time, then save. Try I/A for line edges and O/o for new lines.', hint: 'I/A edit line edges; O/o open a line above/below. Use dd to remove an extra line.' },
    'edit-repair': { lines: ['  spell = vmm', '  state = redy', '  mode = old'], expected: ['  spell = vim', '  state = ready', '  mode = new'], instruction: 'Travel to each typo. Repair with x, r, or s, then save.', hint: 'x deletes; r replaces one character; s substitutes and enters insert mode.' },
    'edit-undo': { lines: ['  value = wrong', '  status = pending'], expected: ['  value = right', '  status = done'], instruction: 'Repair the two values, use undo and Ctrl-R to inspect your edits, then save.', hint: 'u undoes one edit; Ctrl-R redoes it.' },
    'edit-challenge': { lines: ['  (task) = opn', '  owner = Ad', '  result = fail'], expected: ['  (task) = open', '  owner = Ada', '  result = pass'], instruction: 'Navigate, repair the file, then save it with :w.', hint: 'Use searches or finds to reach errors; the saved file must match the target.' },
  };
  const spec = specs[id]!;
  return { id, title: `${index + 1} · ${id.replace('edit-', 'Editing: ')}`, instruction: spec.instruction,
    hint: `${spec.hint} Target file: ${spec.expected.join(' | ')}`,
    lines: spec.lines, start: { row: 0, col: 2 }, checkpoints: [{ row: 0, col: 2 }], idealKeys: [20], badge: null,
    referenceRoutes: [], editing: { filename: `${id}.txt`, expected: spec.expected, requireSave: true } };
}
