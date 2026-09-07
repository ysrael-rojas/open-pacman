# AGENTS.md

## Project

Pac-Man clone in plain JS + HTML + CSS. No build step, no `package.json`, no tests, no linter. The repo is a learning exercise for **Spec-Driven Development**.

## Run / verify

- Open `src/index.html` directly in a browser (`file://` works). Plain `<script>` tags, no server or bundler.
- There is no automated verification; play the game manually. Spec acceptance criteria are checked in-browser.

## Architecture

- Scripts load in dependency order in `src/index.html`: `js/maze.js` → `js/game.js` → `js/render.js` → `js/main.js`. Add any new file as a `<script>` tag before `main.js`.
- Modules share state via **globals, not imports**: `maze.js` assigns `window.MAZE`, `window.PACMAN_START`, `window.GHOST_STARTS`, `window.TUNNEL_ROW`; `game.js` exposes `window.createGame`/`window.update`; `render.js` exposes `window.draw`. Don't convert to ES modules — that breaks `file://`.
- File roles: `main.js` = loop, keyboard, overlay screens; `game.js` = pure state/rules (no DOM); `render.js` = draws `game.grid`. `render.js` reads the top-level `DIRS` const from `game.js`.
- Game lifecycle: `game.state` ∈ `start` / `playing` / `won` / `lost`. Each run copies the pristine `MAZE` into `game.grid` (dots eaten mutate the copy, never the original).

## Maze gotchas

- Maze is 28 cols × 31 rows, authored as 31 strings of 28 chars in `MAZE_STR` (`src/js/maze.js`). After parse, tile codes: `#`=1 wall, `.`=2 dot, `-`=3 door (blocks pacman only), space=0 walkable.
- Cell coordinates, origin top-left: x∈[0,27], y∈[0,30]. Canvas is 560×620 = grid dims × `TILE` (20) in `src/js/render.js`. If the maze dimensions ever change, update the canvas `width`/`height` in `src/index.html`.
- Movement is fractional cell/frame (e.g. pacman 0.125) and snaps at cell centers via `aligned()` in `game.js`. Tunnel row is 14, open at both ends.

## Spec-Driven Development workflow

This is the point of the repo. Driver skills live in `.agents/skills/`:

- `/spec <desc>` writes a spec to `specs/NN-slug.md`. `specs/` does not exist yet — numbering starts at `01-`. Never write code during `/spec`; the skill also seeds `specs/.spec-config.yml` if missing.
- `/spec-impl <NN-slug>` only implements specs whose status means **Approved** in any language (Spanish: `Aprobado`). It creates/switches to branch `spec-NN-slug`, implements the plan step by step, pauses after each step for diff review, and **never commits automatically**. Changing a spec's status to Approved is the user's job, not the agent's.
- Read `.agents/skills/spec/SKILL.md`, `.agents/skills/spec-impl/SKILL.md` and `.agents/skills/spec/template.md` before driving either skill — they define the spec section format and hard rules.

## Conventions

- Language: code comments, UI text, README and specs are all Spanish. Write new comments and specs in Spanish.
- Code style (deviates from common defaults): single quotes, spaces inside parens and brackets — `func( x )`, `arr[ 0 ]` — `const` over `let`, functions grouped per file with a Spanish header comment. Match the existing style.
