import { motion, repair } from './authoring.js';
import type { CourseExample, CourseTopic } from './types.js';

// Spaces divide WORDS; the stone borders divide Vim words within each column.
export const columnGarden = [
  ' _____     _____     _____ ',
  '/II_II\\   /II_II\\   /II_II\\',
  '|II_II|   |II_II|   |II_II|',
  '|II_II|   |II_II|   |II_II|',
  '/_____\\   /_____\\   /_____\\',
];

// One stable map: each money bag is a checkpoint, followed by the campsite.
export const treasureTrail = [
  '___          ___',
  '> $ \\   ___   / $ \\',
  '    |  |__/   |    |',
  '    |__/   |__|    |',
  '_*$     _*___    |  ^ |',
  '  \\_*_/      \\__  |_ __|',
  '              \\*    $ /',
  '               \\__*__/',
].map(line => line.padEnd(26, ' '));

export const flowerGarden = [
  '      FLOWER GARDEN',
  '    [|]-------------[|]',
  '     |               |',
  '    \\|/     \\|/     \\|/',
  '    (@)     (@)     (@)',
  '     |       |       |',
  '  ___|_______|_______|___',
  '  Thorns: ****',
];
export const thornFreeGarden = [...flowerGarden.slice(0, 7), '  Thorns: '];
export const wateredGarden = [thornFreeGarden[0]!, '    [!]-------------[!]', ...thornFreeGarden.slice(2)];

const cargo = ['2. Food crates', '5. Signal flags', '3. Fresh water', '6. Rescue ropes', '1. Navigation map', '4. Medical kits'];
const sortedCargo = [cargo[4]!, cargo[0]!, cargo[2]!, cargo[5]!, cargo[1]!, cargo[3]!];
const sea = '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~';
const boat = '~~~~~~~~~~~\\_____/~~~~~~~~~~~';
const shore = '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^';

/** Puzzle routes combine the new tool with skills already available in the journey. */
export function topicPuzzles(topic: CourseTopic, earned: readonly string[]): CourseExample[] {
  switch (topic.id) {
    case 'WORD-movement': return [
      motion('W', 'Cross the column garden with WORD jumps. Reach the marked stone on the far column.', columnGarden, { row: 3, col: 1 }, 'WWwk'),
      motion('E', 'Walk to the column edge, then descend to the next marked stone.', columnGarden, { row: 2, col: 21 }, 'Ej'),
      ...(earned.includes('Counts') ? [motion('W', 'Count your WORD jumps across the column garden.', columnGarden, { row: 3, col: 1 }, '2Wwk')] : []),
      motion('B', 'Return across the columns and climb to the marked stone.', columnGarden, { row: 3, col: 26 }, 'BBwk'),
    ];
    case 'word-movement': return [
      motion('w', 'Cross the stone borders, follow the column edge, then climb to the marked stone.', columnGarden, { row: 3, col: 1 }, 'wwwek'),
      motion('e', 'Cross to the far column and descend to the marked stone.', columnGarden, { row: 2, col: 15 }, 'wwwj'),
      motion('b', 'Retrace the stone borders and climb back to the middle column.', columnGarden, { row: 3, col: 21 }, 'bbbk'),
    ];
    case 'copy-paste': return [
      repair('p', 'Harbor rescue: move the boat to the water beside the beach.',
        [sea, boat, sea, sea, sea, sea, sea, shore, shore],
        [sea, sea, sea, sea, sea, sea, boat, shore, shore], 'jddjjjjp'),
      repair('P', 'Cargo puzzle: sort the numbered supplies using cut and put.', cargo, sortedCargo,
        'jjjjddkkkkPjjddjpjddkPjddp'),
    ];
    case 'edit-lines': return [
      repair('dd', 'Clear the trail: remove both fallen trees and keep the route markers.',
        ['START', 'fallen tree', 'trail marker', 'fallen tree', 'FINISH'],
        ['START', 'trail marker', 'FINISH'], 'jddjdd'),
    ];
    case 'small-edits': return [
      repair('x', 'Clear the thorn pile (*), keeping the flowers and irrigation pipes intact.',
        flowerGarden, thornFreeGarden, 'xxxx', { row: 7, col: 10 }, 'garden-thorns'),
      repair('r', 'Open both irrigation taps: replace the | inside each bracket with !.',
        thornFreeGarden, wateredGarden, 'r!' + 'l'.repeat(16) + 'r!', { row: 1, col: 5 }, 'garden-taps'),
    ];
    case 'basic-movement': return [
      motion('l', 'Collect the first money bag ($) beside the entrance (>).', treasureTrail, { row: 1, col: 0 }, 'll'),
      motion('j', 'Collect the money bag ($) on the lower island.', treasureTrail, { row: 1, col: 2 }, 'jjj'),
      motion('k', 'Climb to the money bag ($) on the far island.', treasureTrail, { row: 4, col: 2 }, 'kkk' + 'l'.repeat(14)),
      motion('l', 'Collect the last money bag ($) near the bottom of the trail.', treasureTrail, { row: 1, col: 16 }, 'jjjjjllll'),
      motion('k', 'All four bags found! Reach the campsite (^).', treasureTrail, { row: 6, col: 20 }, 'kk'),
    ];
    default: {
      if (topic.examples.some(example => example.expected)) return [];
      const learnedWord = earned.includes('w') || earned.includes('topic:word-movement');
      // Combine each taught route with a learned vertical move on its existing board.
      return topic.examples.filter(example => example.lines.length > 1).flatMap(example => {
        const vertical = example.start.row === 0 ? 'j' : 'k';
        return [{ ...example, id: `${example.id}-quest`, description: `Trail quest: ${example.description} Then take the next trail.`,
          keys: [...example.keys, vertical, ...(learnedWord ? ['w'] : [])] }];
      });
    }
  }
}
