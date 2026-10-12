import { motion, repair } from './authoring.js';
import type { CourseExample, CourseTopic } from './types.js';

const islands = ['a.b cde.fgh ijk.lmnop', 'q.r stu.vwx xyz.abcde'];
const cargo = ['2. Food crates', '5. Signal flags', '3. Fresh water', '6. Rescue ropes', '1. Navigation map', '4. Medical kits'];
const sortedCargo = [cargo[4]!, cargo[0]!, cargo[2]!, cargo[5]!, cargo[1]!, cargo[3]!];
const sea = '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~';
const boat = '~~~~~~~~~~~\\_____/~~~~~~~~~~~';
const shore = '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^';

/** Puzzle routes combine the new tool with skills already available in the journey. */
export function topicPuzzles(topic: CourseTopic, earned: readonly string[]): CourseExample[] {
  switch (topic.id) {
    case 'WORD-movement': return [
      motion('W', 'Island hop: combine WORD jumps and small steps to reach the marked letter.', islands, { row: 1, col: 0 }, 'WWwllk'),
      motion('E', 'Explore island edges with WORD jumps and small steps.', islands, { row: 0, col: 0 }, 'WEh'),
      ...(earned.includes('Counts') ? [motion('W', 'Counted island hop: combine a WORD count with small steps.', islands, { row: 1, col: 0 }, '2Wwllk')] : []),
      motion('B', 'Return to the middle island and explore its dotted path.', islands, { row: 1, col: 15 }, 'Bwlk'),
    ];
    case 'word-movement': return [
      motion('w', 'Cross the dotted stepping stones and climb to the marked island.', islands, { row: 1, col: 0 }, 'wwwlk'),
      motion('e', 'Reach the end of the next island fragment, then climb.', islands, { row: 1, col: 4 }, 'eek'),
      motion('b', 'Retrace two stepping stones, then move to the upper island.', islands, { row: 1, col: 15 }, 'bbk'),
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
