import { truncateToWidth, wrapTextWithAnsi } from '@earendil-works/pi-tui';
import { courseEntries } from '../../course/browser.js';
import { displayKey } from '../../course/authoring.js';
import { animatedDemo, DEMO_COMPLETE_MS, DEMO_STEP_MS } from '../../course/demo.js';
import { sectionFor, topicFor } from '../../course/curriculum.js';
import { createExamplePractice } from '../../course/practices.js';
import type { Game } from '../../game/state.js';
import { BOX_MIN_WIDTH } from '../constants.js';
import { cursorShade, ghostFrame, targetPulse } from '../animation.js';
import { cyan, faint, green, keycap, paint } from '../styles.js';
import { editorPanel } from './editor.js';
import { selectorPanel } from './selector.js';
import { edgeViewportStart } from '../layout.js';

export function courseScreen(game: Game, width: number, height: number, masthead: string[], nowMs: number, previousScrollTop = 0): { top: string[]; middle: string[]; bottom: string[]; scrollTop?: number } {
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
    const next = example.keys[demo.step];
    const cycleMs = example.keys.length * DEMO_STEP_MS + DEMO_COMPLETE_MS;
    const elapsedMs = Math.max(0, nowMs - stored.startedAtMs) % cycleMs;
    const completionAgeMs = elapsedMs - example.keys.length * DEMO_STEP_MS;
    const highlightNext = next === undefined && demo.index < topic!.examples.length - 1 && completionAgeMs < DEMO_STEP_MS;
    const forwardArrow = highlightNext ? cyan('→') : faint('→');
    const forwardKey = paint(highlightNext ? '1;30;106' : '1', 'l');
    const examples = topic!.examples.map((_, index) => index === demo.index
      ? paint('1;30;106', ` ${index + 1} `)
      : faint(String(index + 1))).join(faint(', '));
    top.push(...wrapTextWithAnsi(`${faint('prev')} ${paint('1', 'h')} ${faint('←')} ${examples} ${forwardArrow} ${faint('next')} ${forwardKey}`, width));
    top.push(...wrapTextWithAnsi(`${cyan(`[${example.command}]`)} ${example.description}`, width).slice(0, 2));
    const input = example.keys.slice(0, demo.step + 1).map((key, index) => {
      const label = `[${displayKey(key)}]`;
      return index === demo.step ? paint('1;30;102', label) : faint(label);
    }).join(' ');
    const inputLines = wrapTextWithAnsi(`${input}${next === undefined ? ` ${green('→ Example complete!')}` : ''}`, width);
    const inputBudget = Math.max(1, height - top.length - (width >= BOX_MIN_WIDTH ? 4 : 1) - 6);
    const visibleInput = inputLines.slice(-inputBudget);
    if (visibleInput.length < inputLines.length) visibleInput[0] = `${faint('… ')}${truncateToWidth(visibleInput[0]!, Math.max(1, width - 2))}`;
    const bottom = [faint('User Input:'), ...visibleInput,
      `${paint('1', 'Enter')} ${faint('step ·')} ${paint('1', 'r')} ${faint('replay')}`, `${paint('1', 'p')} ${faint('practice ·')} ${paint('1', 'Esc')} ${faint('back')}`];
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
  const scrollingRows = Math.max(1, visibleRows - 2);
  let scrollTop = edgeViewportStart(entries.length - 2, scrollingRows, course.cursor.row, previousScrollTop);
  if (scrollingRows > 1 && scrollTop === course.cursor.row && entries[scrollTop - 1]?.kind === 'heading') scrollTop--;
  const expandedRows = new Set(entries.flatMap((entry, row) => entry.kind === 'topic' && course.expandedTopics?.includes(entry.id!) ? [row] : []));
  const headingRows = new Set(entries.flatMap((entry, row) => entry.kind === 'heading' ? [row] : []));
  const middle = [...selectorPanel(entries.map(entry => entry.label), course.cursor, width, 'lessons.txt', visibleRows, game.command.pending, undefined, 2, course.cursor.row, width, { firstRow: scrollTop, expandedRows, headingRows }), ...notes];
  return { top, middle, bottom, scrollTop };
}
