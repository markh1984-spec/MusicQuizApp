/**
 * THE LOBBY GAME, running.
 *
 * The maze and its rules are in `maze.js` so a test can walk them without a
 * browser; this file is the part that needs a canvas — drawing, the clock, the
 * thumb, and knowing when to stop.
 *
 * ---
 *
 * **IT STOPS THE INSTANT THE QUIZ DOES ANYTHING.** `stop()` is called from
 * `play.js` on any phase that is not the lobby, and the loop cancels its own
 * frame. Nothing about this may survive into a question: the whole design of
 * this app is a room looking UP, and a game still running while somebody is
 * reading out question one is the single way this feature could make a night
 * worse rather than better.
 *
 * **ONE SCORE LEAVES THE PHONE, AT GAME OVER.** Not a stream of positions —
 * the lobby is exactly when the connection is busiest, because it is when
 * sixty people are joining, and that is the one path in this app that must not
 * stutter. One small POST when a game ends is nothing beside a join, and it is
 * the only server call this file makes.
 *
 * **THE CHASERS ARE DELIBERATELY NOT CLEVER.** Three of them, each picking the
 * turn that shortens the gap to the player, with a one-in-four chance of a
 * random turn instead — which is what stops three identical chasers walking in
 * a line and making the game either trivial or impossible. Perfect pursuit is
 * easy to write and horrible to play: the point is a few minutes of something
 * to do, not a game anybody is trying to beat.
 */

import { MAZE, COLS, ROWS, open, startPoints, pellets, stepToward } from './maze.js';

/**
 * EVERY PHONE IN THE ROOM PLAYS THE SAME GAME, and that is what makes a
 * scoreboard mean anything.
 *
 * The host's own words: *"the game has to be consistent or else the
 * scoreboard makes no sense."* He is right, and it is the fault this would
 * have shipped with — the chasers took a random turn one time in four, so two
 * people on the same leaderboard had faced different games and the higher
 * score might only have been the luckier one.
 *
 * So the wobble is SEEDED, from a number the server puts in the game state at
 * launch. Same seed, same turns, same game, all night — which is exactly the
 * arrangement `roundIdeas` and the prize draw already use, and for the same
 * reason: a thing you want to count has to be the same thing for everybody.
 *
 * Mulberry32 — eight lines, no dependency, and far better than good enough
 * for deciding which way a chaser turns.
 */
function seeded(seed) {
  let a = (Number(seed) || 1) >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STEP_MS = 150;          // how often anything moves. Slow enough to steer.
const CHASE_MS = 260;         // the chasers are slower than you, or it is grim.
const SCARED_MS = 6000;       // how long a big pellet lasts.

const COLOURS = ['#ff2e88', '#4bd8ff', '#ff8a3d'];

export function startGame(canvas, { onEnd = () => {}, seed = 1 } = {}) {
  const ctx = canvas.getContext('2d');
  // Seeded, not random — see `seeded()`. Every phone in the room gets the
  // same one from the game state, so the scoreboard compares like with like.
  const roll = seeded(seed);
  let raf = 0;
  let over = false;

  const eaten = new Set();
  const all = pellets();
  const key = (c, r) => `${c},${r}`;

  const begin = startPoints();
  let you = { ...begin.player, dir: null, last: 0 };
  let chasers = begin.chasers.map((c, i) => ({
    ...c, home: { ...c }, colour: COLOURS[i % COLOURS.length], last: 0, dir: null,
  }));
  let score = 0;
  let lives = 3;
  let scaredUntil = 0;

  /* ------------------------------------------------------------ the thumb */
  /*
   * NO CONTROL PANEL AT ALL — you touch the maze and it walks there, the
   * quickest way, recomputed every step.
   *
   * Asked for directly, and it is the better control on a phone: a swipe has
   * to be READ — was that up, or was it left-and-a-bit-up? — and a misread
   * swipe in a maze costs a life. A destination cannot be misread. It also
   * gives the screen back: no buttons means the maze is as big as the phone.
   *
   * **TAP AHEAD OF YOURSELF RATHER THAN DRAGGING ON TOP OF YOURSELF.** The one
   * real cost of this control is that a finger held on the maze covers the
   * thing you are trying to look at, so this is built for tapping where you
   * want to GO — the target holds until you tap somewhere else, and dragging
   * works too for anybody who prefers it.
   */
  let target = null;
  const aim = (ev) => {
    const t = ev.touches ? ev.touches[0] : ev;
    if (!t) return;
    const box = canvas.getBoundingClientRect();
    // Canvas pixels are not CSS pixels — it is drawn at device resolution so
    // the maze is not fuzzy, so a touch has to be scaled before it means a
    // cell. Getting this wrong sends the player to the wrong end of the maze
    // on exactly the phones the game is for.
    const size = Math.min(canvas.width / COLS, canvas.height / ROWS);
    const offX = (canvas.width - size * COLS) / 2;
    const offY = (canvas.height - size * ROWS) / 2;
    const px = (t.clientX - box.left) * (canvas.width / box.width);
    const py = (t.clientY - box.top) * (canvas.height / box.height);
    const col = Math.floor((px - offX) / size);
    const row = Math.floor((py - offY) / size);
    if (!open(col, row)) return;
    target = { col, row };
  };
  const onDown = (ev) => { aim(ev); };
  const onMove = (ev) => { if (ev.buttons || ev.touches) aim(ev); };
  const onKey = (ev) => {
    /*
     * ARROWS STILL WORK, and cost nothing: they set a target one cell away, so
     * a laptop plays it as a maze game and a phone plays it by pointing. The
     * console is driven from a laptop and somebody will try the keys.
     */
    const map = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const d = map[ev.key];
    if (!d) return;
    ev.preventDefault();
    let col = you.col;
    let row = you.row;
    // Run as far that way as the corridor allows, so one press is a move
    // rather than a nudge.
    while (open(col + d[0], row + d[1])) { col += d[0]; row += d[1]; }
    target = { col, row };
  };
  canvas.addEventListener('touchstart', onDown, { passive: true });
  canvas.addEventListener('touchmove', onMove, { passive: true });
  canvas.addEventListener('mousedown', onDown);
  canvas.addEventListener('mousemove', onMove);
  window.addEventListener('keydown', onKey);

  /* ------------------------------------------------------------- the rules */
  const step = (at, dir) => ({ col: at.col + dir[0], row: at.row + dir[1] });

  function movePlayer(now) {
    if (now - you.last < STEP_MS) return;
    you.last = now;
    // Recomputed EVERY step rather than following a stored route: change your
    // mind mid-corridor and the very next move goes the new way, which in a
    // maze with three things chasing you is the difference between a control
    // and a passenger.
    const dir = stepToward(you, target);
    if (!dir) { you.dir = null; return; }
    you.dir = dir;
    you.col += dir[0];
    you.row += dir[1];
    if (target && you.col === target.col && you.row === target.row) target = null;

    const here = key(you.col, you.row);
    const pellet = all.find((p) => key(p.col, p.row) === here);
    if (pellet && !eaten.has(here)) {
      eaten.add(here);
      score += pellet.big ? 50 : 10;
      if (pellet.big) scaredUntil = now + SCARED_MS;
    }
    if (eaten.size === all.length) end(true);
  }

  function moveChasers(now) {
    for (const g of chasers) {
      if (now - g.last < CHASE_MS) continue;
      g.last = now;
      const ways = [[1, 0], [-1, 0], [0, 1], [0, -1]]
        .filter((d) => open(g.col + d[0], g.row + d[1]))
        // No turning straight back the way you came, or a chaser dithers in
        // one corridor for ever and never reaches anybody.
        .filter((d) => !g.dir || !(d[0] === -g.dir[0] && d[1] === -g.dir[1]));
      const options = ways.length ? ways : [[1, 0], [-1, 0], [0, 1], [0, -1]].filter((d) => open(g.col + d[0], g.row + d[1]));
      if (!options.length) continue;
      const scared = now < scaredUntil;
      /*
       * One turn in four is random. Three chasers all taking the shortest
       * route walk in a line, which makes the game either trivial (they all
       * miss) or impossible (they all arrive) — the wobble is what makes them
       * feel like three of them.
       */
      const pick = roll() < 0.25
        ? options[Math.floor(roll() * options.length)]
        : options.reduce((best, d) => {
          const far = (dd) => Math.abs(g.col + dd[0] - you.col) + Math.abs(g.row + dd[1] - you.row);
          // Scared, they run AWAY — which is the whole point of a big pellet.
          return (scared ? far(d) > far(best) : far(d) < far(best)) ? d : best;
        }, options[0]);
      g.dir = pick;
      g.col += pick[0];
      g.row += pick[1];
    }
  }

  function touching(now) {
    for (const g of chasers) {
      if (g.col !== you.col || g.row !== you.row) continue;
      if (now < scaredUntil) {
        // Eaten. Straight home, and worth having chased.
        score += 100;
        g.col = g.home.col;
        g.row = g.home.row;
        continue;
      }
      lives -= 1;
      if (lives <= 0) { end(false); return; }
      // Everybody back to their corner, so a lost life is not immediately a
      // second one on the same square.
      you = { ...begin.player, dir: null, last: now };
      target = null;
      chasers = chasers.map((c) => ({ ...c, col: c.home.col, row: c.home.row, dir: null }));
      scaredUntil = 0;
      return;
    }
  }

  /* ------------------------------------------------------------ the drawing */
  function draw(now) {
    const size = Math.min(canvas.width / COLS, canvas.height / ROWS);
    const offX = (canvas.width - size * COLS) / 2;
    const offY = (canvas.height - size * ROWS) / 2;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const x = offX + col * size;
        const y = offY + row * size;
        if (MAZE[row][col] === '#') {
          ctx.fillStyle = 'rgba(120,110,220,0.28)';
          ctx.fillRect(x + size * 0.1, y + size * 0.1, size * 0.8, size * 0.8);
          continue;
        }
        const here = key(col, row);
        const pellet = all.find((p) => key(p.col, p.row) === here);
        if (!pellet || eaten.has(here)) continue;
        ctx.fillStyle = pellet.big ? '#ffd23f' : 'rgba(255,255,255,0.55)';
        ctx.beginPath();
        ctx.arc(x + size / 2, y + size / 2, pellet.big ? size * 0.24 : size * 0.1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // You. A circle with a mouth that opens and shuts as you go — the one
    // detail that makes a dot read as something alive.
    const bite = Math.abs(Math.sin(now / 90)) * 0.7;
    const facing = you.dir ? Math.atan2(you.dir[1], you.dir[0]) : 0;
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.moveTo(offX + you.col * size + size / 2, offY + you.row * size + size / 2);
    ctx.arc(offX + you.col * size + size / 2, offY + you.row * size + size / 2,
      size * 0.42, facing + bite / 2, facing - bite / 2 + Math.PI * 2);
    ctx.closePath();
    ctx.fill();

    const scared = now < scaredUntil;
    for (const g of chasers) {
      const x = offX + g.col * size + size / 2;
      const y = offY + g.row * size + size / 2;
      // Flashing as it wears off, so nobody is caught out by it ending.
      ctx.fillStyle = scared
        ? (scaredUntil - now < 1500 && Math.floor(now / 200) % 2 ? '#ffffff' : '#3a3a7a')
        : g.colour;
      ctx.beginPath();
      ctx.arc(x, y - size * 0.05, size * 0.36, Math.PI, 0);
      ctx.lineTo(x + size * 0.36, y + size * 0.34);
      ctx.lineTo(x, y + size * 0.16);
      ctx.lineTo(x - size * 0.36, y + size * 0.34);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#0b0b14';
      ctx.beginPath();
      ctx.arc(x - size * 0.13, y - size * 0.08, size * 0.07, 0, Math.PI * 2);
      ctx.arc(x + size * 0.13, y - size * 0.08, size * 0.07, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function frame(now) {
    if (over) return;
    movePlayer(now);
    moveChasers(now);
    touching(now);
    if (over) return;
    draw(now);
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  function end(won) {
    if (over) return;
    over = true;
    cancelAnimationFrame(raf);
    detach();
    onEnd({ score, won });
  }

  function detach() {
    canvas.removeEventListener('touchstart', onDown);
    canvas.removeEventListener('touchmove', onMove);
    canvas.removeEventListener('mousedown', onDown);
    canvas.removeEventListener('mousemove', onMove);
    window.removeEventListener('keydown', onKey);
  }

  return {
    /**
     * STOP EVERYTHING. Called when the phase leaves the lobby, and it must be
     * safe to call twice — `play.js` tears down on every state push, and a
     * game that had already ended would otherwise report a second score.
     */
    stop() {
      if (over) return;
      over = true;
      cancelAnimationFrame(raf);
      detach();
    },
    get score() { return score; },
    get lives() { return lives; },
  };
}
