import { coursePracticeIds, topicFor } from '../course/curriculum.js';
import { truncateToWidth, wrapTextWithAnsi } from '@earendil-works/pi-tui';
import { formatTime } from '../game/scoring.js';
import { difficultyLines, hubLines, resultKey, type Game } from '../game/state.js';
import { LESSON_COUNT, NAVIGATION_COUNT } from '../lessons/index.js';
import { cursorShade, ghostFrame, rewardShine, targetPulse } from './animation.js';
import { BOX_MIN_WIDTH, CHECKPOINT_FLASH_FRAME_MS, CHECKPOINT_FLASH_MS, MIN_TERMINAL_COLUMNS, MIN_TERMINAL_ROWS, WIDE_VIEW_WIDTH } from './constants.js';
import { editingMismatch } from './editingPreview.js';
import { fitHeight } from './layout.js';
import { courseScreen } from './panels/course.js';
import { editorPanel } from './panels/editor.js';
import { motionGuidePanel, resultPanel } from './panels/reward.js';
import { courseOptions, selectorPanel } from './panels/selector.js';
import { statsBody } from './panels/stats.js';
import { badgeDisplay, cyan, dots, faint, gold, green, keycap, paint, pink, rule } from './styles.js';

/** Keeps the menu viewport stable; game state, time, and dimensions come from the adapter. */
export class GameRenderer {
  private menuScrollTop = 0;

  render(game: Game, width: number, height: number, nowMs: number): string[] {
    if (game.phase === 'menu') this.menuScrollTop = 0;

    if (width < MIN_TERMINAL_COLUMNS || height < MIN_TERMINAL_ROWS) {
      const warning = width < MIN_TERMINAL_COLUMNS ? 'Widen to 22 columns' : 'Grow to 16 rows';
      return fitHeight([cyan('TERMINAL TOO SMALL'), warning], [], [faint('Ctrl+C quit')], height)
        .map(line => truncateToWidth(line, Math.max(1, width)));
    }
    const narrow = width < WIDE_VIEW_WIDTH;

    const flashAge = game.lastHitAtMs === null ? Infinity : nowMs - game.lastHitAtMs;
    const flashing = flashAge >= 0 && flashAge < CHECKPOINT_FLASH_MS;
    const flashFrame = Math.floor(flashAge / CHECKPOINT_FLASH_FRAME_MS) % 2;
    const shining = rewardShine(flashAge);
    const masthead = [`${pink('◆')} ${cyan('VIM')}${faint(' / ')}${green('VIM')}${width >= BOX_MIN_WIDTH ? `  ${faint('MOTION LAB')}` : ''}`, rule(width)];
    let top: string[];
    let middle: string[];
    let bottom: string[] = [];

    if (game.phase === 'course') {
      const screen = courseScreen(game, width, height, masthead, nowMs, this.menuScrollTop);
      ({ top, middle, bottom } = screen);
      if (screen.scrollTop !== undefined) this.menuScrollTop = screen.scrollTop;
    } else if (game.phase === 'menu') {
      top = [...masthead, cyan('CHOOSE YOUR RUN'), faint(game.course ? 'Choose a section. Learn, then practice.' : game.progress.completed >= NAVIGATION_COUNT ? 'Navigation complete · Editing lab open' : narrow ? 'Move. Learn. Level up.' : 'Move through text. Collect motions.')];
      middle = [`${gold('PROGRESS')} ${game.course ? `${coursePracticeIds.filter(id => !!game.progress.attempts[`${game.progress.difficulty}:${id}`]?.length).length}/${coursePracticeIds.length} practices` : `${game.progress.completed}/${LESSON_COUNT}`}`,
        `${faint('BADGES')} ${badgeDisplay(game.progress.badges, width)}`];
      bottom = [keycap('R', game.course ? 'Browse course' : 'Resume'), keycap('S', 'Start over'), faint('Ctrl+C quit')];
    } else if (game.phase === 'complete') {
      top = [...masthead, green(game.progress.completed === LESSON_COUNT ? 'COURSE COMPLETE' : 'NAVIGATION COMPLETE'), gold('NAVIGATOR')];
      middle = [cyan(game.progress.completed === LESSON_COUNT ? `All ${LESSON_COUNT} stages cleared.` : 'Editing basics is ready.'), faint('Your attempts remain available in Stats.')];
      bottom = [faint('Ctrl+C quit'), keycap('↵', 'Open course')];
    } else if (game.phase === 'reward') {
      const lesson = game.activeLesson!;
      const result = game.progress.results[game.course?.practiceId ? `${game.progress.difficulty}:${game.course.practiceId}` : resultKey(game.progress.difficulty, game.lesson)];
      top = [...masthead, green(shining ? '✦ LEVEL CLEAR ✦' : 'LEVEL CLEAR'),
        game.course?.practiceId ? cyan(topicFor(game.course.topicId)!.title) : `${faint('LESSON')} ${game.lesson + 1} ${game.progress.completed}/${LESSON_COUNT}`];
      const budget = height - top.length - 1;
      middle = lesson.badge ? [`${pink(game.newUnlock ? 'NEW REWARD' : 'REWARD')} ${gold(shining ? `✦ ${lesson.badge} ✦` : `[ ${lesson.badge} ]`)}`] :
        [green('STAGE CLEAR')];
      if (result) {
        middle.push(...resultPanel(result, game.checkpointScores, width, budget - middle.length));
      }
      if (lesson.editing && middle.length < budget) middle.push(faint(`${lesson.editing.filename} saved`));
      if (lesson.badge && !game.course) {
        const guide = motionGuidePanel(lesson.badge, width, nowMs - (game.lastHitAtMs ?? nowMs), cursorShade(nowMs));
        if (middle.length + guide.length <= budget) middle.push(...guide);
      }
      bottom = [keycap('↵', game.course?.practiceId ? 'Back to practice' : 'Continue')];
    } else if (game.phase === 'hub' || game.phase === 'difficulty') {
      const selectingDifficulty = game.phase === 'difficulty';
      const options = selectingDifficulty ? difficultyLines : courseOptions(width, game.progress.completed);
      const cursor = selectingDifficulty ? game.difficultyCursor : game.hubCursor;
      top = [...masthead, cyan(selectingDifficulty ? 'SELECT DIFFICULTY' : game.hubCursor.row < LESSON_COUNT ? `CHALLENGE ${game.hubCursor.row + 1}/${LESSON_COUNT}` : 'COURSE HUB'),
        faint(selectingDifficulty ? 'Choose your pace' : `Difficulty: ${game.progress.difficulty}  ·  ${game.progress.completed}/${LESSON_COUNT} clear`),
        `${faint('BADGES')} ${badgeDisplay(game.progress.badges, width)}`];
      bottom = [faint('Vim keys navigate · Ctrl+C quit'), keycap('↵', 'Select')];
      const note = game.message ? wrapTextWithAnsi(game.message, width) : [];
      const budget = height - top.length - bottom.length - note.length;
      const visibleRows = Math.max(1, budget - (width >= BOX_MIN_WIDTH ? 4 : 1));
      middle = [...selectorPanel(options, cursor, width, selectingDifficulty ? 'difficulty.txt' : 'course.txt', visibleRows, game.command.pending,
        selectingDifficulty ? undefined : game.progress.completed, selectingDifficulty ? 0 : 2), ...note];
    } else if (game.phase === 'stats') {
      top = [...masthead, cyan(`STATS · ${game.progress.difficulty.toUpperCase()}`)];
      bottom = [`${paint('1', 'Enter')} ${faint('/')} ${paint('1', 'Esc')} ${faint(game.course ? 'Back to lessons' : 'Back to hub')}`];
      middle = statsBody(game, width, height - top.length - bottom.length);
    } else {
      const lesson = game.activeLesson!;
      const goal = lesson.checkpoints[game.checkpoint]!;
      const instruction = lesson.instruction;
      const lessonName = game.course?.practiceId ? topicFor(game.course.topicId)!.title : lesson.title.split('· ')[1] ?? '';
      top = [...masthead, ...(game.course?.practiceId ? [cyan(truncateToWidth(lessonName, width))] : [`${cyan(`STAGE ${String(game.lesson + 1).padStart(2, '0')}`)} ${faint(`/ ${String(LESSON_COUNT).padStart(2, '0')}`)}${width >= BOX_MIN_WIDTH ? ` ${pink(lessonName)}` : ''}`,
        ...(width < BOX_MIN_WIDTH ? [pink(lessonName)] : [])]),
        ...wrapTextWithAnsi(instruction, width),
        ...(lesson.goals ? [gold(`GOAL ${game.checkpoint + 1}/${lesson.goals.length}`)] : []),
        ...(lesson.goals ? wrapTextWithAnsi(`${gold('USE')} ${lesson.goals[game.checkpoint]!.requiredCommands.join(' ')}`, width) : []),
        ...(lesson.editing ? wrapTextWithAnsi(`${gold('FILE')} ${game.edit?.lines.join('\n') !== game.edit?.savedLines.join('\n') ? '[+]' : game.edit?.saved ? 'saved' : ''} ${lesson.editing.filename}`, width) :
        [`${gold('TARGET')} ${game.checkpoint + 1}/${lesson.checkpoints.length} ${faint(`@ ${goal.row + 1}:${goal.col + 1}`)}${width >= WIDE_VIEW_WIDTH ? ` ${dots(game.checkpoint, lesson.checkpoints.length)}` : ''}`]),
        ...(lesson.editing ? wrapTextWithAnsi(`${gold('TARGET')} ${editingMismatch(game.edit!.lines, lesson.editing.expected) ?? 'Match reached. Save with :w.'}`, width) :
          lesson.requiredCommands ? wrapTextWithAnsi(`${gold('REMAINING')} ${lesson.requiredCommands.filter(command => !game.usedCommands.includes(command)).join(' ') || 'none'}`, width) : [])];
      const elapsed = game.startedAtMs === null ? 0 : nowMs - game.startedAtMs;
      bottom = [`${cyan('TIME')} ${game.startedAtMs === null ? 'Ready' : formatTime(elapsed)}`,
        lesson.editing ? `${paint('2;38;5;150', 'Green = next target')} ${faint('· gray = matches · · = space · + add · ↳ fix')}` :
          `${faint('BADGES')} ${badgeDisplay(game.progress.badges, width)}`, faint(game.course?.practiceId ? 'F1 hint · Esc back (Normal)' : 'F1 hint · Ctrl+C quit')];
      const notice = flashing ? [green(flashFrame ? '✦ Target reached! ✦' : '✓ Target reached!')] :
        game.hint ? wrapTextWithAnsi(`${gold('TIP')} ${lesson.hint}`, width) :
        game.message ? wrapTextWithAnsi(game.message, width) : [];
      const budget = height - top.length - bottom.length - notice.length;
      const visibleRows = Math.max(1, budget - (width >= BOX_MIN_WIDTH ? 4 : 1));
      middle = [...editorPanel(game, width, flashing, flashFrame, cursorShade(nowMs), targetPulse(nowMs), ghostFrame(nowMs), visibleRows), ...notice];
    }
    return fitHeight(top, middle, bottom, height)
      .map(line => truncateToWidth(line, Math.max(1, width)));
  }
}
