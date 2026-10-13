import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { courseEntries, newCourseState } from '../src/course/browser.js';
import { animatedDemo, DEMO_COMPLETE_MS, DEMO_STEP_MS, newDemo, stepDemo } from '../src/course/demo.js';
import { courseMotions, courseSections, courseTopics, examplePracticeId, extraPracticeIds, navigationCommands, topicPracticeId, topicPracticeIds } from '../src/course/curriculum.js';
import { createExamplePractice, createTopicPractice, practiceGoalCount, validateExample } from '../src/course/practices.js';
import { puzzleMissions } from '../src/course/missionCatalog.js';
import { topicPuzzles } from '../src/course/puzzles.js';
import { scoreCheckpoint } from '../src/game/scoring.js';
import { play } from '../src/game/play.js';
import { newGame, resultKey } from '../src/game/state.js';
import { loadProgress, saveProgress } from '../src/persistence/progress.js';
import { editKey, newEdit } from '../src/vim/editing.js';
import { GameEngine } from '../src/game/GameEngine.js';
import { LessonCatalog } from '../src/lessons/LessonCatalog.js';
import { difficulties, stageIds } from '../src/lessons/catalog.js';
import { GameRenderer } from '../src/ui/GameRenderer.js';
import { courseScreen } from '../src/ui/panels/course.js';
import { editorPanel } from '../src/ui/panels/editor.js';
import { emptyCommand, interpret } from '../src/vim/command.js';
import { visibleWidth } from '@earendil-works/pi-tui';
import assert from 'node:assert/strict';

test('every grouped worked example has a reachable practice target', () => {
  for (const topic of courseTopics) for (const example of topic.examples) {
    validateExample(example);
    const lesson = createExamplePractice(topic, example);
    let game = {
      ...newGame(), phase: 'play' as const, activeLesson: lesson, cursor: { ...lesson.start },
      edit: lesson.editing ? newEdit(lesson.lines) : null,
      course: { ...newCourseState(), sectionId: topic.id, topicId: topic.id, practiceId: examplePracticeId(topic, example) },
    };
    const keys = example.expected ? [...example.keys, ':', 'w', '\n'] : example.keys;
    for (const key of keys) game = play(game, key, 1000) as typeof game;
    assert.equal(game.phase, 'reward', `${topic.id}/${example.id}`);
  }
});

test('worked examples replay their cursor movement before practice', () => {
  const example = courseTopics[0]!.examples[0]!;
  const demo = newDemo(example, 0, 1000);
  assert.equal(animatedDemo(example, demo, 1000).step, 0);
  assert.equal(animatedDemo(example, demo, 1700).step, 1);
  assert.notDeepEqual(animatedDemo(example, demo, 1700).cursor, example.start);
  assert.equal(animatedDemo(example, demo, 3100).step, 1);
  for (const topic of courseTopics) for (const example of topic.examples) {
    const demo = newDemo(example, 0, 1000);
    const completedAtMs = 1000 + example.keys.length * DEMO_STEP_MS;
    assert.equal(animatedDemo(example, demo, completedAtMs).step, example.keys.length);
    assert.equal(animatedDemo(example, demo, completedAtMs + DEMO_COMPLETE_MS - 1).step, example.keys.length);
    assert.equal(animatedDemo(example, demo, completedAtMs + DEMO_COMPLETE_MS).step, 0);
  }
});

test('focused practice attempts survive progress reload', () => {
  const topic = courseTopics[0]!;
  const example = topic.examples[0]!;
  const practiceId = examplePracticeId(topic, example);
  const lesson = createExamplePractice(topic, example);
  let game = { ...newGame(), phase: 'play' as const, activeLesson: lesson, cursor: { ...lesson.start },
    course: { ...newCourseState(), sectionId: 'movement', topicId: topic.id, practiceId } };
  for (const key of example.keys) game = play(game, key, 1000) as typeof game;
  assert.equal(game.phase, 'reward');
  const path = join(mkdtempSync(join(tmpdir(), 'vim-course-')), 'progress.json');
  saveProgress(game.progress, path);
  assert.equal(loadProgress(path).attempts[`normal:${practiceId}`]?.length, 1);
});


const clock = { now: () => 1000, timestamp: () => '2026-01-01T00:00:00.000Z' };

function searchMenu(engine: GameEngine, text: string): void {
  for (const key of `/${text}\n`) engine.handleInput(key);
  engine.handleInput('\n');
}
function openTopic(engine: GameEngine, section: string, title: string): void {
  engine.handleInput('r');
  void section;
  searchMenu(engine, title);
}

test('the curriculum covers each legacy practice and five sections without duplicate topic IDs', () => {
  assert.deepEqual(courseSections.map(section => section.title), ['Movement', 'Insertion', 'Editing', 'Text objects', 'Visual mode']);
  assert.equal(new Set(courseTopics.map(topic => topic.id)).size, courseTopics.length);
  const practices = new Set(courseTopics.flatMap(topicPracticeIds));
  assert.ok(courseTopics.every(topic => practices.has(topicPracticeId(topic))));
  assert.ok(stageIds.every(id => courseTopics.some(topic => topic.legacyPractices?.includes(id))));
  assert.equal(extraPracticeIds.size, courseTopics.reduce((sum, topic) => sum + topic.examples.length + 1, 0) + puzzleMissions.length);
  const words = courseTopics.find(topic => topic.id === 'word-movement')!;
  const WORDS = courseTopics.find(topic => topic.id === 'WORD-movement')!;
  assert.deepEqual(words.commands, ['w', 'e', 'b']);
  assert.deepEqual(WORDS.commands, ['W', 'E', 'B']);
});

test('all legacy practices can be opened independently at each difficulty', () => {
  const catalog = new LessonCatalog();
  for (const difficulty of difficulties) for (const id of stageIds) {
    assert.equal(catalog.createById(id, difficulty, courseMotions).id, id);
  }
});

test('all demonstrations can be stepped and replayed without modifying progress', () => {
  const renderer = new GameRenderer();
  for (const section of courseSections) for (const topic of section.topics) for (const [index, example] of topic.examples.entries()) {
    let demo = newDemo(example, index);
    for (const key of example.keys) { void key; demo = stepDemo(example, demo); }
    assert.equal(demo.step, example.keys.length);
    assert.equal(stepDemo(example, demo), demo);
    if (example.expected) assert.deepEqual(demo.edit?.lines, example.expected, `${topic.id}/${example.id}`);
    const game = { ...newGame(), phase: 'course' as const, course: { ...newCourseState(), sectionId: section.id, topicId: topic.id, view: 'examples' as const, demo } };
    for (const [width, height] of [[22, 16], [32, 24], [80, 40]]) {
      const lines = renderer.render(game, width!, height!, 1000);
      assert.equal(lines.length, height);
      assert.ok(lines.every(line => visibleWidth(line) <= width!), `${topic.id}/${example.id}: ${width}`);
      assert.match(lines.join('\n').replace(/\x1b\[[0-9;]*m/g, ''), /Esc back/);
    }
  }
});

test('WORD practices save under stable IDs, resume their menu, and remain visible in Stats', () => {
  const engine = new GameEngine(undefined, { clock });
  openTopic(engine, 'Movement', 'Move by WORDS');
  assert.equal(engine.state.course?.topicId, 'WORD-movement');
  engine.handleInput('j'); engine.handleInput('\n'); // examples
  const before = engine.state.progress;
  assert.equal(engine.handleInput('\n').persist, false);
  assert.equal(engine.state.progress, before);
  assert.equal(engine.state.course?.demo?.cursor.col, 8);
  engine.handleInput('r');
  assert.equal(engine.state.course?.demo?.step, 0);
  engine.handleInput('p');
  assert.equal(engine.state.phase, 'play');
  assert.equal(engine.handleInput('W').persist, false);
  for (const [index, goal] of engine.state.activeLesson!.goals!.entries()) {
    if (index < engine.state.checkpoint) continue;
    for (const key of goal.keys) {
      engine.handleInput(key);
      if (engine.state.checkpoint > index) break;
    }
  }
  assert.equal(engine.state.phase, 'reward');
  const id = engine.state.course!.practiceId!;
  assert.equal(engine.state.progress.completed, 0);
  assert.ok(engine.state.progress.attempts[`normal:${id}`]?.length);
  engine.handleInput('\n');
  assert.equal(engine.state.phase, 'course');
  assert.equal(engine.state.course?.view, 'sections');
  assert.match(courseEntries(engine.state).find(entry => entry.id === 'WORD-movement')!.label, /✓/);
  assert.ok(engine.state.progress.badges.includes('W'));
  searchMenu(engine, 'View stats');
  assert.equal(engine.state.phase, 'stats');
  assert.match(new GameRenderer().render(engine.state, 80, 40, 1000).join('\n'), /Move by WORDS/);
  assert.match(new GameRenderer().render(engine.state, 80, 40, 1000).join('\n'), /LATEST/);
  const file = join(mkdtempSync(join(tmpdir(), 'vim-grouped-')), 'progress.json');
  saveProgress(engine.state.progress, file);
  assert.deepEqual(loadProgress(file), engine.state.progress);
  const data = JSON.parse(readFileSync(file, 'utf8'));
  data.attempts['normal:course:unknown'] = data.attempts[`normal:${id}`];
  writeFileSync(file, JSON.stringify(data));
  assert.equal(loadProgress(file).attempts['normal:course:unknown'], undefined);
});

test('Escape cancels pending commands before returning to the practice menu', () => {
  const engine = new GameEngine(undefined, { clock });
  openTopic(engine, 'Insertion', 'Insert and append');
  engine.handleInput('p'); // mixed insertion practice
  engine.handleInput('i');
  engine.handleInput('escape');
  assert.equal(engine.state.phase, 'play');
  assert.equal(engine.state.edit?.mode, 'normal');
  engine.handleInput('/');
  engine.handleInput('escape');
  assert.equal(engine.state.phase, 'play');
  assert.equal(engine.state.edit?.navigation.pending, '');
  engine.handleInput('escape');
  assert.equal(engine.state.course?.view, 'sections');
  assert.equal(engine.state.phase, 'course');
});

test('flat menu expands inline, searches every topic, and retains difficulty access', () => {
  const engine = new GameEngine(undefined, { clock });
  engine.handleInput('r');
  assert.equal(courseEntries(engine.state).filter(entry => entry.kind === 'topic').length, courseTopics.length);
  assert.deepEqual(courseEntries(engine.state).filter(entry => entry.kind === 'heading').map(entry => entry.label), courseSections.map(section => `### ${section.title}`));
  searchMenu(engine, 'Find a character');
  const row = engine.state.course!.cursor.row;
  assert.equal(engine.state.course?.view, 'sections');
  assert.ok(engine.state.course?.expandedTopics?.includes('character-find'));
  engine.handleInput('j'); engine.handleInput('\n'); // examples inline
  engine.handleInput('escape');
  assert.equal(engine.state.course?.cursor.row, row + 1);
  engine.handleInput('k'); engine.handleInput(' '); // collapse
  assert.ok(!engine.state.course?.expandedTopics?.includes('character-find'));
  assert.equal(courseEntries(engine.state)[engine.state.course!.cursor.row]!.id, 'character-find');
  searchMenu(engine, 'Set difficulty');
  assert.equal(engine.state.phase, 'difficulty');
  engine.handleInput('j');
  assert.equal(engine.handleInput('\n').persist, true);
  assert.equal(engine.state.progress.difficulty, 'hard');
  assert.equal(engine.state.phase, 'course');
});

test('course actions stay pinned and selectable as collapsed and expanded lessons scroll', () => {
  const renderer = new GameRenderer();
  for (const expandedTopics of [[], courseTopics.map(topic => topic.id)]) {
    const menu = { ...newGame(), phase: 'course' as const, course: { ...newCourseState(), expandedTopics } };
    const entries = courseEntries(menu);
    for (const [width, height] of [[22, 16], [32, 16], [46, 24], [80, 40], [80, 60]]) {
      let actionPositions: number[] | undefined;
      for (const row of [0, 15, entries.length - 3, entries.length - 2, entries.length - 1]) {
        const game = { ...menu, course: { ...menu.course, cursor: { row, col: 0 } } };
        const rendered = renderer.render(game, width!, height!, 1000);
        const plain = rendered.map(line => line.replace(/\x1b\[[0-9;]*m/g, ''));
        const positions = ['View stats', 'Set difficulty'].map(label => plain.findIndex(line => line.includes(label)));
        assert.ok(positions.every(position => position >= 0), `${width}x${height}: row ${row}`);
        assert.equal(positions[1], positions[0]! + 1);
        if (actionPositions) assert.deepEqual(positions, actionPositions);
        actionPositions = positions;
        if (row >= entries.length - 2) {
          assert.ok(rendered[positions[row - (entries.length - 2)]!]!.includes('\x1b[38;5;240;48;5;255m'));
        }
      }
    }
  }
});

test('lesson menu uses the terminal width to show complete lesson labels', () => {
  const game = { ...newGame(), phase: 'course' as const, course: newCourseState() };
  const label = courseEntries(game).find(entry => entry.kind === 'topic')!.label;
  for (const width of [80, 120]) {
    const lines = new GameRenderer().render(game, width, 24, 1000);
    const plain = lines.map(line => line.replace(/\x1b\[[0-9;]*m/g, ''));
    assert.ok(plain.some(line => line.includes(label)));
    const border = plain.find(line => line.startsWith('╭'))!;
    assert.equal(visibleWidth(border), width);
    assert.ok(lines.every(line => visibleWidth(line) <= width));
  }
});

test('expanded lesson backgrounds remain visible after moving the cursor and clear on collapse', () => {
  const engine = new GameEngine(undefined, { clock });
  const renderer = new GameRenderer();
  engine.handleInput('r'); engine.handleInput('\n'); engine.handleInput('j');
  const expanded = renderer.render(engine.state, 80, 24, 1000).find(line => line.includes('Basic movement'))!;
  assert.ok(expanded.includes('48;5;24'));
  engine.handleInput('k'); engine.handleInput('\n');
  const collapsed = renderer.render(engine.state, 80, 24, 1000).find(line => line.includes('Basic movement'))!;
  assert.ok(!collapsed.includes('48;5;24'));
});

test('menu scrolls only at viewport edges, including reverse movement and pinned actions', () => {
  const engine = new GameEngine(undefined, { clock });
  const renderer = new GameRenderer();
  engine.handleInput('r'); engine.handleInput('\n'); // Expand enough rows to exercise scrolling.
  const renderRows = () => renderer.render(engine.state, 80, 16, 1000)
    .map(line => line.replace(/\x1b\[[0-9;]*m/g, ''))
    .flatMap(line => {
      const match = /^│\s*(\d+)\s*│/.exec(line);
      return match ? [Number(match[1])] : [];
    }).filter(row => row <= courseEntries(engine.state).length - 2);
  const initial = renderRows();
  const lastVisible = initial.at(-1)!;
  while (engine.state.course!.cursor.row < lastVisible - 1) {
    engine.handleInput('j');
    assert.deepEqual(renderRows(), initial);
  }
  engine.handleInput('j');
  const scrolled = renderRows();
  assert.notDeepEqual(scrolled, initial);
  assert.ok(scrolled.includes(engine.state.course!.cursor.row + 1));
  engine.handleInput('k');
  assert.deepEqual(renderRows(), scrolled);
  engine.handleInput('G'); // The pinned difficulty action does not scroll lessons.
  assert.deepEqual(renderRows(), scrolled);
  engine.handleInput('g'); engine.handleInput('g');
  assert.deepEqual(renderRows(), initial);
});

test('section headers are separate rows and are skipped by movement and searches', () => {
  const engine = new GameEngine(undefined, { clock });
  engine.handleInput('r');
  const selected = () => courseEntries(engine.state)[engine.state.course!.cursor.row]!;
  assert.equal(selected().id, 'basic-movement');
  for (const key of '/### Insertion\n') engine.handleInput(key);
  assert.equal(selected().id, 'insert-append');
  engine.handleInput('k');
  assert.equal(selected().id, 'matching-pairs');
  engine.handleInput('j');
  assert.equal(selected().id, 'insert-append');
  assert.ok(!selected().label.includes('Insertion'));
  engine.handleInput('g'); engine.handleInput('g');
  assert.equal(selected().id, 'basic-movement');
});

test('basic movement does not duplicate focused goals as review', () => {
  const topic = courseTopics.find(topic => topic.id === 'basic-movement')!;
  const lesson = createTopicPractice(topic);
  assert.ok(lesson.goals!.every(goal => goal.focus));
  assert.ok(lesson.goals!.some(goal => goal.keys.length > 1));
  assert.deepEqual(lesson.goals![4]!.start, lesson.goals![3]!.target);

  const withReview = createTopicPractice(topic, ['topic:word-movement']);
  const review = withReview.goals!.filter(goal => !goal.focus);
  assert.ok(review.length > 0);
  assert.ok(review.every(goal => !['h', 'j', 'k', 'l'].includes(goal.keys.join(''))));
});

test('every topic practice stays within its budget and clears with its authored routes', () => {
  for (const difficulty of difficulties) for (const earned of [[], [...navigationCommands, ...courseTopics.map(previous => `topic:${previous.id}`)]]) for (const topic of courseTopics) {
    const lesson = createTopicPractice(topic, earned, difficulty);
    assert.equal(lesson.goals!.length, practiceGoalCount(topic, difficulty));
    assert.ok(lesson.goals!.filter(goal => goal.focus).length >= Math.ceil(lesson.goals!.length / 3));
    for (const example of topic.examples) assert.ok(lesson.goals!.some(goal => goal.focus && goal.keys.join('').includes(example.keys.join(''))));
    let game = { ...newGame(), phase: 'play' as const, activeLesson: lesson, cursor: { ...lesson.start },
      edit: lesson.editing ? newEdit(lesson.lines) : null,
      course: { ...newCourseState(), topicId: topic.id, practiceId: lesson.id } };
    for (const [index, goal] of lesson.goals!.entries()) {
      for (const key of goal.keys) {
        game = play(game, key, 1000 + index * 100) as typeof game;
        if (game.checkpoint > index) break;
      }
      assert.equal(game.checkpoint, index + 1, `${topic.id}: goal ${index + 1}`);
      assert.equal(game.checkpointScores[index]!.accuracy, 100, `${topic.id}: solution should earn full accuracy`);
      assert.equal(game.phase, index === lesson.goals!.length - 1 ? 'reward' : 'play', topic.id);
      const next = lesson.goals![index + 1];
      if (next) {
        const board = goal.editing?.expected ?? goal.lines;
        const sameBoard = JSON.stringify(board) === JSON.stringify(next.lines);
        if (sameBoard && !goal.editing) {
          assert.deepEqual(game.cursor, goal.target, `${topic.id}: cursor jumped after goal ${index + 1}`);
          assert.deepEqual(next.start, goal.target);
        } else if (!sameBoard) {
          assert.deepEqual(game.cursor, next.start, `${topic.id}: new board start`);
        }
        if (!next.editing) assert.notDeepEqual(game.cursor, next.target, `${topic.id}: target already reached`);
      }
    }
    assert.equal(game.checkpointScores.length, lesson.goals!.length);
    assert.equal(game.progress.attempts[`normal:${lesson.id}`]?.length, 1);
  }
});

test('review selects earned tools within the budget and keeps editing contexts distinct', () => {
  const topic = courseTopics.find(topic => topic.id === 'WORD-movement')!;
  const lesson = createTopicPractice(topic, ['f', 'F', 't', 'T', ';', ',', '/', '?', 'n', 'N', '%', 'Counts', 'topic:open-lines']);
  const review = lesson.goals!.filter(goal => !goal.focus);
  const commands = new Set(review.flatMap(goal => [...goal.requiredCommands]));
  assert.ok(commands.has('w'));
  assert.ok(review.some(goal => goal.requiredCommands.some(command => ['f', 'F', 'Counts'].includes(command))));
  assert.ok(review.length <= 20);
  assert.ok(!commands.has('yy'));
  assert.ok(review.every(goal => !goal.instruction.includes('Visual')));
  const targets = new Set(lesson.goals!.filter(goal => goal.focus).map(goal => JSON.stringify([goal.start, goal.target])));
  assert.ok(targets.size > topic.examples.length);
});

test('WORD practice includes h j k l, w e b, and accepts alternate routes with lower accuracy', () => {
  const topic = courseTopics.find(topic => topic.id === 'WORD-movement')!;
  const lesson = createTopicPractice(topic);
  const commands = new Set(lesson.goals!.flatMap(goal => [...goal.requiredCommands]));
  for (const key of ['h', 'j', 'k', 'l', 'w', 'e', 'b', 'W', 'E', 'B']) assert.ok(commands.has(key), key);
  let game = { ...newGame(), phase: 'play' as const, activeLesson: lesson, cursor: { ...lesson.start },
    course: { ...newCourseState(), topicId: topic.id, practiceId: lesson.id } };
  for (let index = 0; index < 8; index++) game = play(game, 'l', 1000) as typeof game;
  assert.equal(game.checkpoint, 1);
  assert.equal(game.checkpointScores[0]!.accuracy, 0);
  assert.equal(game.checkpointScores[0]!.actualKeys, 8);
  assert.equal(game.checkpointScores[0]!.speed, 110);
  const next = game.activeLesson!.goals![1]!;
  for (const key of next.keys) {
    game = play(game, key, 1100) as typeof game;
    if (game.checkpoint > 1) break;
  }
  assert.equal(game.checkpoint, 2);
  assert.equal(game.checkpointScores[1]!.accuracy, 100);
});

test('practice boards stay visible for at least five consecutive goals', () => {
  for (const earned of [[], [...navigationCommands, ...courseTopics.map(topic => `topic:${topic.id}`)]]) {
    for (const topic of courseTopics) {
      const lesson = createTopicPractice(topic, earned);
      let previous = '', count = 0;
      for (const goal of lesson.goals!) {
        const board = JSON.stringify(goal.lines);
        if (board !== previous && count) {
          assert.ok(count >= 5, `${topic.id}: board changed after ${count} goals`);
          count = 0;
        }
        previous = board;
        count++;
      }
      assert.ok(count >= 5, `${topic.id}: final board has ${count} goals`);
    }
  }
});

test('an alternate route leaves the cursor at the target for the next goal', () => {
  const topic = courseTopics.find(topic => topic.id === 'basic-movement')!;
  const lesson = createTopicPractice(topic);
  let game = { ...newGame(), phase: 'play' as const, activeLesson: lesson, cursor: { ...lesson.start },
    course: { ...newCourseState(), topicId: topic.id, practiceId: lesson.id } };
  game = play(game, '0', 1000) as typeof game;
  game = play(game, 'l', 1100) as typeof game;
  assert.equal(game.checkpoint, 1);
  assert.deepEqual(game.cursor, lesson.checkpoints[0]);
  assert.deepEqual(game.activeLesson!.start, game.cursor);
  assert.notDeepEqual(game.cursor, game.activeLesson!.checkpoints[1]);
  for (const key of lesson.goals![1]!.keys) game = play(game, key, 1200) as typeof game;
  assert.equal(game.checkpoint, 2);
  assert.deepEqual(game.cursor, lesson.checkpoints[1]);
});

test('reward explains percentage targets and actuals, including missed commands', () => {
  const topic = courseTopics.find(topic => topic.id === 'WORD-movement')!;
  const practice = createTopicPractice(topic);
  const lesson = { ...practice, goals: practice.goals!.slice(0, 1), checkpoints: practice.checkpoints.slice(0, 1),
    idealKeys: practice.idealKeys.slice(0, 1), referenceRoutes: practice.referenceRoutes.slice(0, 1) };
  let game = { ...newGame(), phase: 'play' as const, activeLesson: lesson, cursor: { ...lesson.start },
    course: { ...newCourseState(), topicId: topic.id, practiceId: lesson.id } };
  for (let index = 0; index < 8; index++) game = play(game, 'l', 1000 + index * 155) as typeof game;
  assert.equal(game.phase, 'reward');
  assert.equal(game.checkpointScores[0]!.expectedCommands, 1);
  assert.equal(game.checkpointScores[0]!.matchedCommands, 0);
  const renderer = new GameRenderer();
  for (const [width, height] of [[22, 16], [32, 16], [32, 24], [46, 32], [80, 40]]) {
    const lines = renderer.render(game, width!, height!, 3000);
    assert.equal(lines.length, height);
    assert.ok(lines.every(line => visibleWidth(line) <= width!));
    const plain = lines.join('\n').replace(/\x1b\[[0-9;]*m/g, '');
    assert.match(plain, /TARGET \/ ACTUAL/);
    assert.match(plain, /SPEED.*100%/);
    assert.match(plain, /ACCURACY.*0%/);
    assert.match(plain, /PROFICIENCY.*50%/);
    assert.match(plain, /Keys[: ]+1 (ideal )?\/ 8/);
    assert.match(plain, /400\s?ms/);
    assert.match(plain, /Back to practice/);
    if (width! < 46) {
      assert.match(plain, /Time 2.40s \/ 1.08s/);
      assert.match(plain, /Badges 1 \/ 0 matched/);
      assert.match(plain, /Target 100%; \(S\+A\)\/2/);
      assert.match(plain, /Scores: goal averages/);
    } else {
      assert.match(plain, /Time: 00:02.40 target \/ 00:01.08 actual/);
      assert.match(plain, /Expected commands: 1 target \/ 0 matched/);
      assert.match(plain, /command match rate/);
      assert.match(plain, /average goal scores/);
    }
  }
});

test('editing goals accept an alternate command once the correct buffer is saved', () => {
  const topic = courseTopics.find(topic => topic.id === 'insert-append')!;
  const lesson = createTopicPractice(topic);
  let game = { ...newGame(), phase: 'play' as const, activeLesson: lesson, cursor: { ...lesson.start },
    edit: newEdit(lesson.lines), course: { ...newCourseState(), topicId: topic.id, practiceId: lesson.id } };
  // The first goal expects i; I produces the same file from column zero.
  for (const key of 'IA\x1b') game = play(game, key, 1000) as typeof game;
  assert.equal(game.checkpoint, 0);
  assert.deepEqual(game.edit!.lines, ['Ada']);
  for (const key of ':w\n') game = play(game, key, 1100) as typeof game;
  assert.equal(game.checkpoint, 1);
  assert.ok(game.checkpointScores[0]!.accuracy < 100);
});

test('expanded menu and mixed editing/navigation goals fit narrow and wide terminals', () => {
  const renderer = new GameRenderer();
  const menu = { ...newGame(), phase: 'course' as const, course: {
    ...newCourseState(), expandedTopics: courseTopics.map(topic => topic.id),
  } };
  const topic = courseTopics.find(topic => topic.id === 'small-edits')!;
  const lesson = createTopicPractice(topic);
  let practice = { ...newGame(), phase: 'play' as const, activeLesson: lesson, cursor: { ...lesson.start },
    edit: newEdit(lesson.lines), course: { ...newCourseState(), topicId: topic.id, practiceId: lesson.id } };
  const scenes = [menu, practice];
  for (const key of lesson.goals![0]!.keys) practice = play(practice, key, 1000) as typeof practice;
  scenes.push(practice);
  for (const scene of scenes) for (const [width, height] of [[22, 16], [32, 24], [80, 40]]) {
    const lines = renderer.render(scene, width!, height!, 1000);
    assert.equal(lines.length, height);
    assert.ok(lines.every(line => visibleWidth(line) <= width!));
  }
});

function motionSequence(lines: string[], start: { row: number; col: number }, keys: string) {
  let cursor = start, state = emptyCommand();
  for (const key of keys) { const outcome = interpret(lines, cursor, state, key, navigationCommands); cursor = outcome.cursor; state = outcome.state; }
  return { cursor, state };
}
test('WORD motions, indentation, paragraphs, and whole-word searches have distinct targets', () => {
  const text = ['one.two three-four five'];
  assert.equal(motionSequence(text, { row: 0, col: 0 }, 'w').cursor.col, 3);
  assert.equal(motionSequence(text, { row: 0, col: 0 }, 'W').cursor.col, 8);
  assert.equal(motionSequence(text, { row: 0, col: 0 }, 'E').cursor.col, 6);
  assert.equal(motionSequence(text, { row: 0, col: 10 }, 'B').cursor.col, 8);
  assert.deepEqual(motionSequence(['  one', '    two'], { row: 0, col: 0 }, '2_').cursor, { row: 1, col: 4 });
  const search = ['cat cats cat', 'catapult cat'];
  assert.deepEqual(motionSequence(search, { row: 0, col: 0 }, '*').cursor, { row: 0, col: 9 });
  assert.deepEqual(motionSequence(search, { row: 0, col: 0 }, '*n').cursor, { row: 1, col: 9 });
  assert.deepEqual(motionSequence(search, { row: 0, col: 0 }, '*nN').cursor, { row: 0, col: 9 });
  assert.deepEqual(motionSequence(['one', '', 'two', 'three'], { row: 0, col: 0 }, '}').cursor, { row: 1, col: 0 });
});

test('nested and multiline text objects, registers, undo, and visual endpoints remain usable', () => {
  let edit = newEdit(['value = (one [two])']), cursor = { row: 0, col: 14 };
  const press = (key: string) => { const result = editKey(edit, cursor, key, navigationCommands); edit = result.edit; cursor = result.cursor; };
  for (const key of 'di[') press(key);
  assert.deepEqual(edit.lines, ['value = (one [])']);
  press('u');
  assert.deepEqual(edit.lines, ['value = (one [two])']);
  for (const key of 'da(') press(key);
  assert.deepEqual(edit.lines, ['value = ']);
  edit = newEdit(['(first', 'second)']); cursor = { row: 0, col: 2 };
  for (const key of 'di(') press(key);
  assert.deepEqual(edit.lines, ['()']);
  edit = newEdit(['one', 'two']); cursor = { row: 0, col: 0 };
  for (const key of 'Vj') press(key);
  assert.deepEqual(edit.selectionAnchor, { row: 0, col: 0 });
  press('o');
  assert.deepEqual(cursor, { row: 0, col: 0 });
  assert.deepEqual(edit.selectionAnchor, { row: 1, col: 0 });
  press('y'); press('G'); press('p');
  assert.deepEqual(edit.lines, ['one', 'two', 'one', 'two']);
});

test('Stats details follow the selected attempt and keep navigation visible on small screens', () => {
  const game = newGame();
  const older = { elapsedMs: 65000, actualKeys: 20, idealKeys: 10, speed: 40, accuracy: 50, proficiency: 45,
    completedAt: '2026-01-01T12:00:00.000Z', scoringVersion: 1, commandsUsed: ['h'] };
  const latest = { ...older, elapsedMs: 32000, speed: 80, proficiency: 65, commandsUsed: ['l'] };
  game.progress.attempts[resultKey('normal', 0)] = [older, latest];
  const engine = new GameEngine(game.progress, { clock, navigation: 'legacy' });
  engine.handleInput('r');
  for (let index = 0; index < stageIds.length; index++) engine.handleInput('j');
  engine.handleInput('\n');
  const render = (width = 80, height = 40) => new GameRenderer().render(engine.state, width, height, 1000)
    .join('\n').replace(/\x1b\[[0-9;]*m/g, '');
  assert.match(render(), /Attempt 2 of 2 · LATEST/);
  assert.match(render(), /Keys used l/);
  engine.handleInput('j');
  assert.match(render(), /Attempt 1 of 2/);
  assert.match(render(), /Time 01:05.00/);
  assert.match(render(), /Speed 40%/);
  assert.match(render(), /Keys used h/);
  assert.doesNotMatch(render(), /LATEST/);
  for (const [width, height] of [[22, 16], [32, 16], [46, 32], [80, 40]]) {
    assert.match(render(width, height), /h ← prev|h ← Previous/);
    assert.match(render(width, height), /j ↓ older · k ↑ newer/);
    assert.match(render(width, height), /› #1/);
  }
  engine.handleInput('k');
  assert.match(render(), /Attempt 2 of 2 · LATEST/);
  engine.handleInput('l');
  assert.match(render(), /Lesson 2 of/);
  assert.match(render(), /No attempts yet/);
});

test('editor gutters align text and borders across line-number digit boundaries', () => {
  const template = createExamplePractice(courseTopics[0]!, courseTopics[0]!.examples[0]!);
  for (const lineCount of [12, 105]) for (const width of [22, 46]) {
    const lines = Array.from({ length: lineCount }, () => '  task = ready');
    const boundary = lineCount === 12 ? 9 : 99;
    const game = { ...newGame(), activeLesson: { ...template, lines, checkpoints: [{ row: boundary, col: 2 }] },
      cursor: { row: boundary, col: 2 } };
    const rendered = editorPanel(game, width, false, 0, 255, 0, 0, lineCount + 2);
    const plain = rendered.map(line => line.replace(/\x1b\[[0-9;]*m/g, ''));
    assert.ok(rendered.every(line => visibleWidth(line) === width));
    const textColumns = plain.filter(line => line.includes('task = ready')).map(line => line.indexOf('task'));
    assert.ok(textColumns.length > 1);
    assert.equal(new Set(textColumns).size, 1);
    assert.ok(plain.some(line => line.includes('~')));
  }
});

test('example input grows one key at a time and highlights the current key', () => {
  const section = courseSections.find(section => section.topics.some(topic => topic.examples.some(example => example.keys.join('') === 'fa;')))!;
  const topic = section.topics.find(topic => topic.examples.some(example => example.keys.join('') === 'fa;'))!;
  const index = topic.examples.findIndex(example => example.keys.join('') === 'fa;');
  const example = topic.examples[index]!;
  const game = { ...newGame(), phase: 'course' as const, course: { ...newCourseState(),
    view: 'examples' as const, sectionId: section.id, topicId: topic.id, demo: newDemo(example, index, 1000) } };
  for (let step = 0; step <= example.keys.length; step++) {
    const { top, bottom } = courseScreen(game, 80, 40, [], 1000 + step * DEMO_STEP_MS);
    assert.equal(top.at(-2)!.replace(/\x1b\[[0-9;]*m/g, ''), 'User Input:');
    assert.equal(bottom.length, 2);
    const input = top.at(-1)!;
    assert.equal(input.replace(/\x1b\[[0-9;]*m/g, ''),
      example.keys.slice(0, step + 1).map(key => `[${key}]`).join(' ') + (step === 3 ? ' → Example complete!' : ''));
    if (step < 3) assert.ok(input.includes(`\x1b[1;30;102m[${example.keys[step]}]`));
    else assert.ok(!input.includes('\x1b[1;30;102m'));
  }
});


test('puzzles combine learned tools and independently authored editing targets', () => {
  const words = courseTopics.find(topic => topic.id === 'WORD-movement')!;
  const puzzle = topicPuzzles(words, [])[0]!;
  const lesson = createExamplePractice(words, puzzle);
  assert.equal(lesson.lines[lesson.checkpoints[0]!.row]![lesson.checkpoints[0]!.col], 'I');
  assert.equal(puzzle.keys.join(''), 'WWwk');
  assert.ok(!topicPuzzles(words, []).some(example => example.keys.join('').startsWith('2W')));
  const counted = topicPuzzles(words, ['Counts']).find(example => example.keys.join('').startsWith('2W'))!;
  assert.deepEqual(createExamplePractice(words, counted).checkpoints, lesson.checkpoints);
  for (const id of ['copy-paste', 'edit-lines', 'small-edits']) {
    const topic = courseTopics.find(topic => topic.id === id)!;
    for (const puzzle of topicPuzzles(topic, [])) validateExample(puzzle);
    assert.ok(createTopicPractice(topic).goals!.some(goal => goal.instruction.startsWith('Quest')));
  }
});

test('puzzle pace includes thinking time, varies by difficulty, and preserves legacy scoring', () => {
  const topic = courseTopics.find(topic => topic.id === 'WORD-movement')!;
  for (const difficulty of difficulties) {
    const lesson = createTopicPractice(topic, [], difficulty);
    const targetMs = 5 * lesson.pace!.msPerKey + lesson.pace!.thinkingMs;
    const score = scoreCheckpoint(5, 5, targetMs, lesson.pace);
    assert.equal(score.speed, 100);
    assert.equal(score.targetMs, targetMs);
    const game = { ...newGame(), phase: 'course' as const, progress: { ...newGame().progress, difficulty },
      course: { ...newCourseState(), expandedTopics: [topic.id] } };
    assert.ok(courseEntries(game).some(entry => entry.label.includes(`${lesson.goals!.length} goals`)));
  }
  assert.equal(scoreCheckpoint(5, 5, 1250).speed, 100);
  assert.throws(() => scoreCheckpoint(5, 5, 100, { msPerKey: 0, thinkingMs: 0 }), RangeError);
});
