# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Classic arcade Asteroids clone built with pure HTML5 Canvas and vanilla JavaScript (ES6+). Zero dependencies, no build step — runs directly in a browser.

## Running the Game

```bash
# Open directly
start index.html

# Or serve locally
npx serve .
```

## Architecture

The entire game lives in two files: `index.html` (800×600 canvas entry point) and `game.js` (single-file implementation, ~420 lines).

**`game.js` structure:**
- Lines 1–24: Input system (`keys[]` for continuous state, `justPressed[]` for one-shot presses)
- Lines 25–30: Utilities (`wrap`, `dist`, `rand`)
- Lines 32–58: `Bullet` class
- Lines 60–119: `Asteroid` class (3 size classes, random polygon vertices)
- Lines 121–204: `Ship` class (thrust/rotation physics, invincibility frames)
- Lines 206–236: `Particle` class (explosion effects)
- Lines 238–290: Game state variables and initialization (`initGame`)
- Lines 292–351: `update(dt)` — physics, collision detection, level progression
- Lines 353–409: `draw()` — canvas rendering
- Lines 411–423: `loop(ts)` — `requestAnimationFrame` main loop

**Game state machine:** `state` is `'playing'` | `'dead'` | `'gameover'`

**Physics constants:** rotation 3.5 rad/s, thrust 260 px/s², drag 0.987, delta time capped at 50 ms.

**Collision detection:** circle-based distance checks between entities.

**Scoring:** large asteroid (size 3) = 20 pts, medium (size 2) = 50 pts, small (size 1) = 100 pts.

**Level progression:** clearing all asteroids spawns `3 + level` new asteroids.

## Testing
Vitest  = use the skill y la informacion de: @
