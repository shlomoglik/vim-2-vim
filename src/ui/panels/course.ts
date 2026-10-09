import { truncateToWidth, wrapTextWithAnsi } from '@earendil-works/pi-tui';
import { courseEntries } from '../../course/browser.js';
import { displayKey } from '../../course/authoring.js';
import { animatedDemo } from '../../course/demo.js';
import { sectionFor, topicFor } from '../../course/curriculum.js';
import { createExamplePractice } from '../../course/practices.js';
import type { Game } from '../../game/state.js';
import { BOX_MIN_WIDTH } from '../constants.js';
import { cursorShade, ghostFrame, targetPulse } from '../animation.js';
import { cyan, faint, gold, green, keycap } from '../styles.js';
import { editorPanel } from './editor.js';
import { selectorPanel } from './selector.js';

export function courseScreen(game: Game, width: number, height: number, masthead: string[], nowMs: number): { top: string[]; middle: string[]; bottom: string[] } {
  const course = game.course!;
  const section = sectionFor(course.sectionId);
  const topic = topicFor(course.topicId);
  const heading = course.view === 'sections' ? 'LESSONS' : topic!.title;
  const breadcrumb = course.view === 'sections' ? `All topics · ${game.progress.difficulty}` : section!.title + ' > ' + topic!.title;
  const top = [...masthead, cyan(truncateToWidth(heading, width)), faint(truncateToWidth(breadcrumb, width))];
  if (course.view === 'examples') {
    const stored = course.demo!;
    const example = topic!.examples[stored.index]!;
    const demo = animatedDemo(example, stored, nowMs);
    top.push(`${gold(`[${example.command}]`)} ${faint(`Example ${demo.index + 1}/${topic!.examples.length}`)}`);
    top.push(...wrapTextWithAnsi(example.description, width).slice(0, 2));
    const next = example.keys[demo.step];
    const bottom = [next === undefined ? green('Example complete · r replay') : `${gold('NEXT')} ${cyan(`[${displayKey(next)}]`)} ${faint(`${demo.step}/${example.keys.length}`)}`,
      faint('h/l example · Enter step'), faint('p practice · Esc back')];
    const visibleRows = Math.max(1, height - top.length - bottom.length - (width >= BOX_MIN_WIDTH ? 4 : 1));
    const preview: Game = { ...game, activeLesson: createExamplePractice(topic!, example), cursor: demo.cursor, command: demo.command, edit: demo.edit, checkpoint: 0, lastHit: null };
    const middle = editorPanel(preview, width, false, 0, cursorShade(nowMs), targetPulse(nowMs), ghostFrame(nowMs), visibleRows);
    return { top, middle, bottom };
  }
  const entries = courseEntries(game);
  const bottom = [faint('j/k move · / search · Esc back'), keycap('↵', 'Expand/collapse') + ' · ' + keycap('p', 'Practice')];
  const notes = game.message ? wrapTextWithAnsi(game.message, width) : [];
  const budget = height - top.length - bottom.length - notes.length;
  const visibleRows = Math.max(1, budget - (width >= BOX_MIN_WIDTH ? 4 : 1));
  const middle = [...selectorPanel(entries.map(entry => entry.label), course.cursor, width, 'lessons.txt', visibleRows, game.command.pending), ...notes];
  return { top, middle, bottom };
}
