# Vim-to-Vim

A terminal Vim course with navigation reviews, a Navigator challenge, and an editing lab. Follow checkpoints through text buffers, then repair a practice file. Navigation has Easy, Normal, and Hard routes and separate scores.

Requires Node.js 22.19 or newer and a terminal.

```sh
npm install
npm start
```

Press `R` to browse the course or `S` to start over. Starting over resets badges while preserving every attempt. Every topic appears in one list under a standalone section header (Movement, Insertion, Editing, Text objects, or Visual mode). Expanded lesson rows have a blue background. The list scrolls only when the selection moves past the visible edge, and Stats and Difficulty stay pinned at the bottom. The menu uses the terminal’s full width. Press Enter or Space to expand/collapse its Examples, Practice, and available Puzzles actions; press `p` on a topic to start practice directly. Use `j`/`k` to move and `/` to search all topics. Examples animate automatically; Enter steps ahead, `h`/`l` switches examples, `r` replays, and `p` starts the mixed practice. Escape returns to the lesson list. Stats and Difficulty are available in the same list. The timer starts on the first practice keystroke. Press **F1** for a free hint and Ctrl+C to quit. The editor scrolls vertically and horizontally to follow the cursor and target.

## Course

Each topic has one mixed practice with **30 goals**, or **50 for hard navigation**. Editing puzzles stay at 30 because each goal requires more work. Five-goal chapters mix the topic’s commands with a selection of basic movement and earned tools, keeping the session within its budget. Word movement combines `w/e/b` with `h/j/k/l`; WORD movement combines `W/E/B`, `w/e/b`, and `h/j/k/l`. Navigation goals vary their starting positions. The relevant badge toolkit appears beside **USE** as `[W] [w] [l] [k]`. Suggested routes combine tools in column-garden puzzles, cargo sorting, boat rescue, and trail clearing. Alternate solutions still complete the goal; command matching contributes to accuracy, and completing the whole session earns the topic's command badges. Editing goals also require the correct buffer saved with `:w`. One attempt records the entire session, including per-goal scores and commands used.

Named puzzles are available directly under expanded topics. **Movement → Basic movement → Puzzles · Treasure trail** collects four money bags in order before reaching the campsite, using one stable map. **Editing → Small edits → Puzzles · Flower keeper** clears the thorn pile with `x`, then opens both irrigation taps with `r!`; each repair requires `:w`. **Editing → Copy and paste lines → Puzzles · Harbor rescue** starts a three-stage mission: find the boat, bring it ashore, and organize its cargo. **Move by words**, **Move by WORDS**, and **Delete and change lines** also offer short puzzle adventures. Navigation boards use Roman-style columns built from `|II_II|`, caps, and bases; spaces separate WORDS and stone borders separate smaller Vim words. Stages continue from your landing position, and the harbor adds cargo below the rescued boat without moving your cursor. Each stage shows an optional bonus (use a count, solve with fewer keys, or combine specific tools). Solving the board completes the stage even when bonuses are missed. Mission rewards celebrate completion, and bonus results are saved per attempt and shown in Stats. Puzzles appear on every difficulty and have their own completion marks; they do not replace topic practice or grant its command badges.

A count such as `10j` or `12G` includes each digit in the score. For character finds, type the command and target character, such as `fa`. Searches use literal, case-sensitive text and Enter, such as `/star↵` or `?star↵`; they wrap through the buffer.

Insertion and Editing cover `i/a`, `I/A`, `o/O`, Escape, `s/x/r`, `dw/de`, `cw/ce`, `dd/D/cc/C`, `dj/dk`, `yy/p/P`, and undo/redo. Text objects cover words, WORDS, quotes, brackets, and paragraphs. Visual mode covers character and line selections, changing selection ends, and deleting, changing, or yanking selections. Use navigation to reach each repair. A dim green suggestion shows one target at a time. The status line shows the practice filename and modified or saved state. `:w` saves the buffer within the exercise. Each editing goal completes when the saved file exactly matches the target; suggested command matching affects accuracy. Used commands are kept with each attempt for Stats.

Each navigation checkpoint has an authored reference route, replayed through the same command interpreter as player input. Accuracy compares the route's keystroke count with yours. Mixed practices allow thinking time per goal: easy uses 750 ms/key + 3 seconds, normal 400 ms/key + 2 seconds, and hard 300 ms/key + 1 second. These are initial design values to tune through playtesting. Original staged exercises retain 250 ms/key. The reward screen shows the actual session’s pace and target time; proficiency averages speed and accuracy. Scores are feedback for replay; topics can be practiced in any order.

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
| `src/course/sections/` | Grouped lessons, examples, command lists, and links to original practices |
| `src/course/browser.ts` | Flat expandable lesson list, examples, and direct practice navigation |
| `src/lessons/definitions/` | One authoring module per lesson |
| `src/lessons/LessonCatalog.ts` | Register and create lessons by stable course ID |
| `src/lessons/catalog.ts` | Course order, displayed keys, badges, and legacy save IDs |
| `src/lessons/referenceRoutes.ts` | Replay and validate authored routes with the player command interpreter |
| `src/vim/` | Command parsing, movement, and editing rules |
| `src/ui/` | Input normalization, screen rendering, animations, and individual panels |
| `src/persistence/progress.ts` | File repository, atomic writes, validation, and save migration |

Scoring and time constants live in `src/game/constants.ts`; terminal dimensions and animation durations live in `src/ui/constants.ts`. Shared practice buffers and difficulty settings live in `src/lessons/fixtures.ts` and `foundationFixtures.ts`. The original top-level module paths re-export their implementations for compatibility.

## Editing grouped lessons

Edit the corresponding section in `src/course/sections/`: `movement.ts`, `insertion.ts`, `editing.ts`, `textObjects.ts`, or `visual.ts`. Each topic declares its title, subgroup, commands, examples, and optional `legacyPractices` linking to existing exercises. These modules follow the supplied VimHero lesson grouping.

The `motion` helper authors a navigation example with a buffer, starting cursor, and key sequence. The `repair` helper authors an editing example with an independently specified target buffer. `topic` groups them into a lesson. The examples and `src/course/puzzles.ts` supply focused goals for a mixed practice, with one stable attempt ID per topic; completed topics and earned badges supply review goals and optional counted or word-jump puzzle routes. Editing goals require `:w` to finish. The original exercises retain their IDs, difficulty routes, scores, and saved history.

```ts
topic('change-words', 'Change words', 'Characters & words', [
  repair('cw', 'Change the word and keep its trailing space.',
    ['old value'], ['new value'], 'cwnew\x1b'),
  repair('ce', 'Change through the word end.',
    ['old value'], ['new value'], 'cenew\x1b'),
]);
```

Use `\x1b` in an authored sequence for Escape. Keep topic and example IDs stable to preserve saved attempts. Worked examples loop automatically, support stepping and replay, and never affect scores or saved progress. In Normal mode, Escape returns from a practice; in Insert or Visual mode, it first leaves that mode.

The course is freely browsable. Original staged unlocks and badge history remain compatible with older saves. Stats includes mixed sessions and historical original/focused practices, with separate difficulty histories. The embedded editor implements the taught command subset; half-page movement uses ten practice rows.

### Cursor continuity when authoring exercises

**Keep the cursor where the player landed.** Completing a goal advances the objective, not the player's position. In a continuous puzzle, the next navigation stage starts at the target just reached. After an editing stage, use the actual cursor left by the player's edit and save, including alternate solutions.

Author the next route from that position. If an alternate solution lands somewhere different from the reference solution, adapt the subsequent route, hints, and ideal key count. Any repositioning must happen through commands the player performs. Do not assign the next goal's authored `start` to the cursor merely because the stage changed.

Keep continuous navigation stages on the same board. When a mission adds a scene, preserve the existing area and coordinates where possible: Harbor rescue appends cargo beneath the rescued boat and keeps the player on the boat. Clamp the cursor only when its previous position is no longer valid in the new buffer. Initial entry into an independent exercise or an explicit restart can use an authored start.

For example, if the player completes an editing stage at row 6, column 28, the next stage must retain `(6, 28)`, even if its reference solution was written from `(6, 0)`. Update the hint to include the necessary movement; let the player execute it. Select a next target different from the landing position, and ensure each reference route stops at its first target hit.

`src/game/play.ts` handles mission continuity and route adaptation; `src/course/practices.ts` connects goals sharing a board. Transition tests should replay actual input and compare the post-transition cursor with the position produced by the completing command. Cover alternate editing solutions and scene extensions as well as navigation. See `test/missions.test.ts` and `test/course.test.ts`. This rule is also recorded in [AGENTS.md](AGENTS.md) for coding agents.

## Editing original practices

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

To add an original staged practice, create its definition or factory, add its stable ID to the course order in `catalog.ts`, and register its factory in `LessonCatalog`. Add any new key labels and badge metadata there as well. Existing navigation definitions are wired through `definitions/navigation.ts`; editing definitions are wired through `editing.ts`. The engine and renderer consume the same `Lesson` contract.

For an alternative lesson in a test or another game instance, create a `LessonCatalog`, call `register(existingId, factory)`, and pass it to `new GameEngine(progress, { lessons: catalog })`. Each catalog has its own registrations. A custom `Clock` makes session timings and attempt timestamps deterministic. A custom `ProgressRepository` can replace file storage in `TerminalGame`.

## Regression checks

```sh
npm run typecheck
npm test
```

The tests retain the original command, scoring, course, editing, and save-migration coverage. They also compare fingerprints captured before this refactor for all 31 lessons at three difficulties and 12 screen scenarios at six terminal sizes. Engine tests cover course completion, pending searches, difficulty changes, saving, custom catalogs, and terminal input handling. Grouped-course tests also validate every example against its authored target, exercise new Vim commands, check save/reload, and render every example at narrow and wide terminal sizes.

After an intentional lesson or visual change, review its behavior, then run `npm run snapshots:update` and review the changed fixture entries before committing. Snapshot updates are explicit; tests never rewrite the baseline. The snapshot scenarios use fixed time and UTC dates.
