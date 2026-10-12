# Exercise design rules

## Keep the cursor where the player landed

Completing a target or mission stage must not teleport the player. Continue the
exercise from the cursor produced by the player's last command.

- For navigation, the next stage starts at the target just reached.
- For editing, retain the actual cursor after the successful edit and save.
  An alternate solution may leave the cursor somewhere different from the
  authored solution; the actual position takes precedence.
- Author subsequent targets and reference routes from that landing point.
  If the actual position differs from the authored start, adapt the route,
  hints, and ideal key count. Let the player perform any repositioning with Vim
  commands; never move the cursor there automatically.
- Keep the board stable during a continuous navigation puzzle. When extending
  or changing a mission scene, preserve the existing area and cursor coordinates
  where possible. Clamp only if the previous position is no longer valid in the
  new buffer. A stage boundary alone is not a reason to reset the cursor.
- Choose a next target different from the current position. Reference solutions
  must finish at the first target hit, matching actual completion behavior.
- Initial entry into an independent exercise and an explicit restart can use its
  authored starting position. Do not treat each goal in a continuous exercise as
  a new independent exercise.

Implementation context: `src/game/play.ts` preserves mission landing positions
and adapts subsequent routes. `src/course/practices.ts` connects goals sharing a
board. Author mission stages in `src/course/missions.ts` and puzzle boards in
`src/course/puzzles.ts`.

When changing exercise transitions, verify cursor continuity through the actual
`GameEngine` input flow. Cover navigation, editing, alternate solutions, and
scene extensions. Assert that the cursor after transitioning equals the cursor
produced by the completing command, rather than merely comparing it with the
next goal's authored start. Existing coverage is in `test/missions.test.ts` and
`test/course.test.ts`.

See the exercise-authoring guidance in `README.md` for additional context.
