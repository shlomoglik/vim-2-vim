import { displayKey, motion, repair } from './authoring.js';
import { courseTopics, navigationCommands } from './curriculum.js';
import { createExamplePractice } from './practices.js';
import { topicPuzzles } from './puzzles.js';
import { puzzleMissions } from './missionCatalog.js';
import type { CourseExample } from './types.js';
import type { BonusObjective, Difficulty, Lesson, PracticeGoal } from '../lessons/types.js';

function goal(example: CourseExample, topicId: string, title: string, successMessage: string, tools: string[], bonuses: BonusObjective[]): PracticeGoal {
  const topic = courseTopics.find(topic => topic.id === topicId)!;
  const lesson = createExamplePractice(topic, example);
  const keys = example.expected && example.keys.slice(-3).join('') !== ':w\n' ? [...example.keys, ':', 'w', '\n'] : [...example.keys];
  return { lines: lesson.lines, start: lesson.start, target: lesson.checkpoints[0]!, editing: lesson.editing,
    instruction: lesson.instruction, hint: `${lesson.instruction} ${lesson.hint} Bonus (optional): ${bonuses.map(bonus => bonus.label).join('; ')}`, keys, requiredCommands: tools, focus: true,
    stageTitle: title, shortHint: keys.map(displayKey).join(''), successMessage, bonuses };
}

export function createPuzzleMission(id: string, difficulty: Difficulty, earned: readonly string[]): Lesson {
  const mission = puzzleMissions.find(mission => mission.id === id);
  if (!mission) throw new RangeError(`Unknown puzzle ${id}`);
  const topic = courseTopics.find(topic => topic.id === mission.topicId)!;
  let goals: PracticeGoal[];
  if (mission.topicId === 'copy-paste') {
    const [rescue, cargo] = topicPuzzles(topic, earned) as [CourseExample, CourseExample];
    const locate = motion('j', 'Spot the stranded boat: reach its bow, marked by the backslash.', rescue.lines, { row: 0, col: 0 }, 'j' + 'l'.repeat(11));
    const moveBoat = { ...rescue, start: { row: 1, col: 11 }, keys: rescue.keys.slice(1) };
    const cargoStart = rescue.expected!.length + 2;
    const supplies = repair('P', 'The boat is safe. Sort its numbered supplies for the harbor crew.',
      [...rescue.expected!, '', 'CARGO', ...cargo.lines], [...rescue.expected!, '', 'CARGO', ...cargo.expected!],
      'j'.repeat(cargoStart - 6) + cargo.keys.join(''), { row: 6, col: 0 });
    goals = [
      goal(locate, topic.id, 'Find the boat', 'Boat spotted!', ['h', 'j', 'k', 'l'],
        [{ id: 'count', label: 'Use a count', shortLabel: 'Use a count', kind: 'count' }]),
      goal(moveBoat, topic.id, 'Bring it ashore', 'Boat rescued!', ['dd', 'p', 'j', 'k'],
        [{ id: 'efficient-rescue', label: 'Rescue in 8 keys or fewer (including :w)', shortLabel: '8 keys incl :w', kind: 'keys', maxKeys: 8 }]),
      goal(supplies, topic.id, 'Organize the cargo', 'Cargo ready. Harbor restored!', ['dd', 'p', 'P', 'j', 'k'],
        [{ id: 'cut-and-put', label: 'Sort with dd, p and P', shortLabel: 'Use dd,p,P', kind: 'commands', commands: ['dd', 'p', 'P'] }]),
    ];
  } else if (mission.topicId === 'small-edits') {
    const [thorns, taps] = topicPuzzles(topic, earned) as [CourseExample, CourseExample];
    // Deleting the last thorn leaves the cursor on the trailing space of its label.
    const openTaps = { ...taps, start: { row: 7, col: 9 }, keys: [...'kkkkkkhhhh', ...taps.keys] };
    goals = [
      goal(thorns, topic.id, 'Clear the thorns', 'Thorns cleared. Time to water the flowers!', ['x', 'h', 'j', 'k', 'l'],
        [{ id: 'pluck', label: 'Remove the thorns with x', shortLabel: 'Use x', kind: 'commands', commands: ['x'] }]),
      goal(openTaps, topic.id, 'Water the flowers', 'Taps open. The garden is blooming!', ['r', 'h', 'j', 'k', 'l'],
        [{ id: 'open-taps', label: 'Open the taps with r', shortLabel: 'Use r', kind: 'commands', commands: ['r'] }]),
    ];
  } else if (mission.topicId === 'basic-movement') {
    goals = topicPuzzles(topic, earned).map((example, index) => goal(example, topic.id,
      index < 4 ? `Money bag ${index + 1} of 4` : 'Reach the campsite',
      index < 4 ? `Money bag ${index + 1}/4 collected!` : 'Treasure secured. Camp reached!',
      ['h', 'j', 'k', 'l'],
      [{ id: 'small-steps', label: 'Navigate using only h, j, k and l', shortLabel: 'Use h/j/k/l', kind: 'avoid',
        commands: navigationCommands.filter(command => !['h', 'j', 'k', 'l'].includes(command)) }]));
  } else {
    const examples = topicPuzzles(topic, earned).filter(example => !example.keys.join('').startsWith('2W'));
    goals = examples.map((example, index) => goal(example, topic.id, mission.stages === 1 ? mission.title : ['Cross the garden', 'Follow the edge', 'Return to the middle'][index]!,
      mission.stages === 1 ? 'Trail cleared!' : `Stone ${index + 1} reached!`,
      example.expected ? ['dd', 'j', 'k'] : [...topic.commands, 'h', 'j', 'k', 'l'],
      example.expected ? [{ id: 'cut', label: 'Clear the trail with dd', shortLabel: 'Use dd', kind: 'commands', commands: ['dd'] }] :
        [{ id: 'no-small-steps', label: 'Solve without h or l', shortLabel: 'No h/l', kind: 'avoid', commands: ['h', 'l'] }]));
  }
  const first = goals[0]!;
  return { id, title: mission.title, badge: null, lines: first.lines, start: first.start, instruction: first.instruction,
    hint: first.hint, editing: first.editing, goals, checkpoints: goals.map(goal => goal.target),
    idealKeys: goals.map(goal => goal.keys.length), referenceRoutes: goals.map(goal => goal.keys.join('')),
    mission: { completeMessage: mission.topicId === 'copy-paste' ? 'Harbor restored!' : `${mission.title} complete!` },
    pace: { msPerKey: { easy: 750, normal: 500, hard: 250 }[difficulty], thinkingMs: { easy: 3000, normal: 2000, hard: 1000 }[difficulty] } };
}
