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

Command parsing is in `src/command.ts`, lesson fixtures in `src/lessons.ts`, game transitions in `src/game.ts`, and terminal rendering in `src/main.ts`.
