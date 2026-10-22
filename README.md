# 🌋 Cauldron Eruption

Day 14 of a daily Halloween web-game series – **6 days to Halloween 🎃**

A cinematic 3D match-3 in a witch's kitchen at night. The board floats as a licorice-and-glass tray on a giant bubbling cauldron, lit by the fire below, glowing potion jars and the moon in the window. Glossy, physically lit candies: wrapped orange bonbons, candy corn, gummy eyeballs (they follow your finger), swirl lollipops, chocolate skulls and red jelly bats.

**The hook – THE CAULDRON ERUPTS.** Every match and every cascade fills the brew meter. When it boils over, time slows, the whole board is blasted up in a candy geyser (score ×2), and **the Gummy Ghoul** – a giant wobbling jelly monster with gummy-eyeball eyes and candy-corn teeth – rises out of the cauldron, roars and gulps the falling candies. Then a golden refill rains down (double points).

## How to play
- **Swipe** a candy onto its neighbour (or tap two) to line up 3 or more of a kind. Mouse drag works the same on desktop.
- Keyboard: **arrows** move the cursor, **Space** picks, then an **arrow** swaps · **H** hint · **1 / 2 / 3** boosters · **Esc** quit.
- **Specials:** 4 in a row = **striped** candy (clears a whole line) · L or T shape = **wrapped bomb** (explodes twice) · 5 in a row = colour **ghost** candy (clears one colour).
- **Fusions:** swap two specials together – striped + striped = cross, striped + bomb = triple cross, bomb + bomb = giant blast, ghost + striped/bomb = every candy of that colour turns special and fires, ghost + ghost = the whole board erupts.
- **Obstacles:** cobweb-locked candies (match them to tear the web), pumpkin blockers (two hits), slime tiles (clear candies on top), golden skulls (bring them down to the bottom), ghost tiles (holes in the board).
- **Boosters:** hammer (one candy), broom (a whole row), shuffle. A hint glows after a few idle seconds, and a board without moves reshuffles itself.
- Reach the goal within the moves and the remaining moves turn into striped candies – **Witching Hour** – for 1 to 3 stars.

**20 levels** with a smooth curve (score, candy collections, slime, cobwebs, pumpkins, golden skulls, shaped boards), stars and best score per level and difficulty.
**Modes:** level journey · **Player 1 vs Player 2** hot-seat Candy Duel (one board, alternating moves, highest score wins).
**Difficulty:** Easy / Medium / Hard (moves, colours, boosters, hint delay, how fast the brew boils). **Kids mode:** unlimited moves (can't fail), 5 colours, hints after 3 s, plenty of boosters.

**One tap to play.** The game opens with a cinematic: a bonbon falls past the moon into the cauldron, sets off a real cascade, and the cauldron erupts. Tap (or click) anywhere and you are straight in Level 1, sound on. After the opening the start screen has one big PLAY button; levels, the duel, difficulty, kids mode, quality and the intro replay sit behind "Levels & options". The language follows the browser (German for German browsers, English otherwise) with a small DE/EN switch (remembered). A 1080×1350 score card to save or share. Quality is automatic (Normal, steps down only if the frame rate stays low).

## Tech
- Three.js (WebGL): MeshPhysical candies with clearcoat, sheen and iridescence, PMREM environment light, shadowed key light, potion and geyser shaders, instanced candy fountain, a jelly monster with a wobble vertex shader, HDR bloom with a clamped high-pass, colour grade with vignette and grain, MSAA.
- A pure, fuzz-tested match-3 engine (`src/board.js`): groups, specials, fusions, gravity through holes and blockers, collectables, move finder, shuffle. Level move counts were calibrated with a bot.
- Frame-rate independent clock with NaN guards; overlays follow game time.
- Sounds: real CC0 recordings only, no oscillators; sample-based waltz. See `LICENSES/SOUNDS.md`.
- Everything is bundled into `js/game.bundle.js` + `js/sounds-src.js`, so it also runs straight from the file system (`start.command` or open `index.html`).

## Build & test
```
npm install
node tools/build.mjs
python3 test/test_game.py     # headless Chrome (SwiftShader) via Playwright
python3 test/test_mobile.py   # phones: WebKit iPhone + Chromium Pixel, real taps, portrait + landscape
```

Built with Grok Bot. Sound credits by source ID in `LICENSES/SOUNDS.md`. Code licenses: three.js (MIT), Fredoka font (OFL).
