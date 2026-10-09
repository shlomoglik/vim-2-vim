# Vim-to-Vim

A terminal Vim course with navigation reviews, a Navigator challenge, and an editing lab. Follow checkpoints through text buffers, then repair a practice file. Navigation has Easy, Normal, and Hard routes and separate scores.

Requires Node.js 22.19 or newer and a terminal.

```sh
npm install
npm start
```

Press `R` to resume or `S` to start over. Starting over resets lesson unlocks and badges while preserving every attempt. In the scrollable course hub, use earned Vim commands and press Enter on a lesson, Stats, or Difficulty. Locked lessons remain visible. The timer starts on the first play keystroke. Press **F1** for a free hint, Escape to cancel an unfinished command, and Ctrl+C to quit. The title and controls stay pinned when the terminal is short; the editor scrolls vertically and horizontally to follow the cursor and target.

## Course

Command lessons earn `w`, `b`, `e`, `0`, `$`, `^`, `gg`, `G`, Counts, `f`, `F`, `t`, `T`, `;`, `,`, `/`, `?`, `n`, `N`, and `%`. Four reviews revisit earlier commands without awarding a badge. The Navigator challenge requires successful use of all 20 commands before it awards Navigator; its remaining commands appear during play. A count such as `10j` or `12G` includes each digit in the score. For character finds, type the command and target character, such as `fa`. Searches use literal, case-sensitive text and Enter, such as `/star↵` or `?star↵`; they wrap through the buffer.

The editing lab covers `i`, `a`, Escape, `I`, `A`, `o`, `O`, `x`, `r`, `s`, `u`, Ctrl-R, and `dd`. Use navigation to reach each repair. A dim green suggestion shows one target at a time. The status line shows the practice filename and modified or saved state. `:w` saves the buffer within the exercise. Editing stages complete when the saved file exactly matches the target, regardless of which commands were used; used commands are kept with each attempt for Stats.

Each navigation checkpoint has an authored reference route, replayed through the same command interpreter as player input. Accuracy compares the route's keystroke count with yours. Speed uses a par of 250 ms per reference key; proficiency averages speed and accuracy. Scores are feedback for replay; completing the stage unlocks the next one.

Progress saves to `~/.local/state/vim-to-vim/progress.json`, or `$XDG_STATE_HOME/vim-to-vim/progress.json`. Set `VIM_TO_VIM_PROGRESS_FILE` to use another path. Stats keeps every historical attempt, including records from older saves. Proficiency changes are shown only for attempts using the same scoring version.

```sh
npm run typecheck
npm test
```

## Project structure

The application composes a stateful game engine with terminal, rendering, and file storage adapters. Game rules remain pure transitions, so they can be tested and reused independently of the terminal.

| Module | Responsibility |
| --- | --- |
| `src/main.ts` | Start the application |
| `src/TerminalGame.ts` | Terminal lifecycle, animation scheduling, and saving |
| `src/game/GameEngine.ts` | Own the session and route input by phase; accept a clock and lesson catalog |
| `src/game/` | Session setup, menu navigation, play, completion, scores, and state types |
| `src/lessons/definitions/` | One authoring module per lesson |
| `src/lessons/LessonCatalog.ts` | Register and create lessons by stable course ID |
| `src/lessons/catalog.ts` | Course order, displayed keys, badges, and legacy save IDs |
| `src/lessons/referenceRoutes.ts` | Replay and validate authored routes with the player command interpreter |
| `src/vim/` | Command parsing, movement, and editing rules |
| `src/ui/` | Input normalization, screen rendering, animations, and individual panels |
| `src/persistence/progress.ts` | File repository, atomic writes, validation, and save migration |

Scoring and time constants live in `src/game/constants.ts`; terminal dimensions and animation durations live in `src/ui/constants.ts`. Shared practice buffers and difficulty settings live in `src/lessons/fixtures.ts` and `foundationFixtures.ts`. The original top-level module paths re-export their implementations for compatibility.

## Editing lessons

Open the corresponding file in `src/lessons/definitions/`, such as `word-forward.ts`, `find-backward.ts`, or `edit-insert.ts`.

- Navigation definitions contain teaching text and `createPractice(difficulty)`, which returns the buffer, starting cursor, and reference routes. Foundational lessons also author their checkpoint positions. The shared replay helper computes key counts and validates routes, including remembered searches and finds.
- Review and Navigator modules author their buffers and routes through `routeLesson`. Navigator also specifies the commands that must be successfully used.
- Editing definitions contain `lines`, `expected`, `instruction`, and `hint`. Optional `start` and `referenceKeys` override the shared defaults. Completion still requires an exact match saved with `:w`.

For example, an editing repair can be authored as:

```ts
export const definition: EditingDefinition = {
  lines: ['  state = redy'],
  expected: ['  state = ready'],
  instruction: 'Repair the state and save with :w.',
  hint: 'Move to the typo and insert the missing character.',
  referenceKeys: 20,
};
```

Navigation teaching titles also supply the course hub title; `hubTitle` handles the two foundational lessons whose hub labels differ. Course order, key labels, and badge rules are defined in `catalog.ts`. Keep existing stage IDs stable because saved attempt records use them. `legacyIds` describes the original save format and must retain its original order.

To add a new lesson, create its definition or factory, add its stable ID to the course order in `catalog.ts`, and register its factory in `LessonCatalog`. Add any new key labels and badge metadata there as well. Existing navigation definitions are wired through `definitions/navigation.ts`; editing definitions are wired through `editing.ts`. The engine and renderer consume the same `Lesson` contract.

For an alternative lesson in a test or another game instance, create a `LessonCatalog`, call `register(existingId, factory)`, and pass it to `new GameEngine(progress, { lessons: catalog })`. Each catalog has its own registrations. A custom `Clock` makes session timings and attempt timestamps deterministic. A custom `ProgressRepository` can replace file storage in `TerminalGame`.

## Regression checks

```sh
npm run typecheck
npm test
```

The tests retain the original command, scoring, course, editing, and save-migration coverage. They also compare fingerprints captured before this refactor for all 31 lessons at three difficulties and 12 screen scenarios at six terminal sizes. Engine tests cover course completion, pending searches, difficulty changes, saving, custom catalogs, and terminal input handling.

After an intentional lesson or visual change, review its behavior, then run `npm run snapshots:update` and review the changed fixture entries before committing. Snapshot updates are explicit; tests never rewrite the baseline. The snapshot scenarios use fixed time and UTC dates.
