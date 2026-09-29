# Vim-to-Vim

A 21-lesson terminal navigation course. Follow the green checkpoints through a text buffer, earning a new Vim command after each lesson. The course begins with `h`/`j`/`k`/`l` and ends with matching delimiters (`%`) and the Navigator badge. Easy, Normal, and Hard have separate fixtures and scores.

Requires Node.js 22.19 or newer and a terminal.

```sh
npm install
npm start
```

Press `R` to resume or `S` to start over. Starting over resets lesson unlocks and badges while preserving every attempt. In the scrollable course hub, use earned Vim commands and press Enter on a lesson, Stats, or Difficulty. Locked lessons remain visible. The timer starts on the first play keystroke. Press **F1** for a free hint, Escape to cancel an unfinished command, and Ctrl+C to quit. The title and controls stay pinned when the terminal is short; the editor scrolls vertically and horizontally to follow the cursor and target.

## Course

Lessons earn `w`, `b`, `e`, `0`, `$`, `^`, `gg`, `G`, Counts, `f`, `F`, `t`, `T`, `;`, `,`, `/`, `?`, `n`, `N`, `%`, and finally Navigator. A count such as `10j` or `12G` includes each digit in the score. For character finds, type the command and target character, such as `fa`. Searches use literal, case-sensitive text and Enter, such as `/star↵` or `?star↵`; they wrap through the buffer. The bottom Vim status area shows incomplete commands and search text.

Each checkpoint has an authored reference route, replayed through the same command interpreter as player input. Accuracy compares the route's keystroke count with yours. Speed uses a par of 250 ms per reference key; proficiency averages speed and accuracy. The reward screen shows an animated command example, time, speed, accuracy, and proficiency.

Progress saves to `~/.local/state/vim-to-vim/progress.json`, or `$XDG_STATE_HOME/vim-to-vim/progress.json`. Set `VIM_TO_VIM_PROGRESS_FILE` to use another path. Stats keeps every historical attempt, including records from older saves. Proficiency changes are shown only for attempts using the same scoring version.

```sh
npm run typecheck
npm test
```

Command parsing is in `src/command.ts`, lesson fixtures in `src/lessons.ts`, game transitions in `src/game.ts`, and terminal rendering in `src/main.ts`.
