/**
 * MAZE MOUTH — a maze chase, for the five minutes before a quiz starts.
 *
 * Asked for as *"a little game to play on their phones while they're waiting…
 * like an old school video game like tennis or pac-man"*. The lobby is the one
 * stretch of an evening where every phone in the room already has this app
 * open and the projector has nothing on it but a join code, so it is the one
 * place a game costs the night nothing.
 *
 * ---
 *
 * **IT IS NOT PAC-MAN, AND THAT IS A LEGAL DECISION RATHER THAN A TECHNICAL
 * ONE.** The name, the maze, the characters and the sounds are Namco's, and
 * this app is SOLD — which is the same reasoning already written into
 * `portraits.js` about photoreal pictures of living musicians: UK fair dealing
 * does not cover commercial entertainment. So the maze below is ours, the
 * chasers are ours, and nobody in a pub will care.
 *
 * **NOTHING HERE TOUCHES THE SERVER WHILE IT IS BEING PLAYED.** Sixty phones
 * reporting positions over pub wifi would put load on the one connection that
 * must not stutter all night — and the lobby is precisely when that connection
 * is busiest, because it is when everybody is joining. The game runs entirely
 * in the browser; the only thing that ever leaves the phone is one small score
 * at game over.
 *
 * **IT IS DRAWN, LIKE EVERYTHING ELSE IN THIS APP.** No sprites, no images, no
 * dependency — the same reasoning as the QR encoder, the bin icon and the
 * brandmark. One file, no assets, nothing to 404 on a venue's wifi.
 *
 * **THE MAZE IS EXPORTED SO A TEST CAN WALK IT.** A pellet behind a wall is a
 * game nobody can finish, and it is exactly the kind of fault that survives
 * every check except somebody playing to the end — so `reachable()` proves
 * every pellet can be got to, in a unit test, without a browser.
 */

/**
 * Ours. Fifteen across so a cell is 20px on a 320px phone — big enough to see
 * a chaser coming, small enough that the whole maze fits without scrolling,
 * which matters because a game you have to scroll is a game you lose.
 *
 * `#` wall · `.` pellet · `o` a big one · ` ` empty · `P` you · `G` a chaser
 */
export const MAZE = [
  '###############',
  '#o...........o#',
  '#.###.###.###.#',
  '#.#.........#.#',
  '#.#.##.#.##.#.#',
  '#......G......#',
  '#.###.#.#.###.#',
  '#...G.....G...#',
  '#.###.#.#.###.#',
  '#......#......#',
  '#.###.###.###.#',
  '#.#.........#.#',
  '#.#.#.###.#.#.#',
  '#o..#..P..#..o#',
  '###############',
];

export const COLS = MAZE[0].length;
export const ROWS = MAZE.length;

const WALL = '#';

/* Always in this order, so a route is the same route every time — which is
   what lets two people who tapped the same square play the same game. */
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Is this cell inside the maze and not a wall? */
export function open(col, row) {
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return false;
  return MAZE[row][col] !== WALL;
}

/** Where the player and the chasers begin, read off the maze itself. */
export function startPoints() {
  let player = null;
  const chasers = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const cell = MAZE[row][col];
      if (cell === 'P') player = { col, row };
      if (cell === 'G') chasers.push({ col, row });
    }
  }
  return { player, chasers };
}

/** Every cell holding something to eat, and what it is worth. */
export function pellets() {
  const all = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const cell = MAZE[row][col];
      if (cell === '.') all.push({ col, row, big: false });
      if (cell === 'o') all.push({ col, row, big: true });
    }
  }
  return all;
}

/**
 * Every cell you can walk to from the start.
 *
 * Exported for the test rather than for the game — a pellet walled off from
 * the player is a game that cannot be finished, and nothing short of playing
 * it to the end would ever find that. A flood fill costs nothing and turns it
 * into a thing a machine checks.
 */
export function reachable(from = startPoints().player) {
  const seen = new Set();
  if (!from) return seen;
  const queue = [from];
  seen.add(`${from.col},${from.row}`);
  while (queue.length) {
    const at = queue.shift();
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const col = at.col + dc;
      const row = at.row + dr;
      const key = `${col},${row}`;
      if (!open(col, row) || seen.has(key)) continue;
      seen.add(key);
      queue.push({ col, row });
    }
  }
  return seen;
}

/**
 * THE SHORTEST WAY FROM ONE CELL TO ANOTHER — the first STEP of it, which is
 * all a mover ever needs.
 *
 * This is what lets the game have no control panel at all: you touch the maze
 * and the player walks to where you touched, the quickest way. Asked for as
 * *"could make it so it just follows your finger the quickest route so there's
 * no control panel?"* — and it is the better control on a phone, because a
 * swipe has to be read (was that up or left?) where a destination cannot be
 * misread.
 *
 * **A BREADTH-FIRST WALK, RECOMPUTED EVERY STEP.** 225 cells is nothing, and
 * doing it fresh each time is what makes re-tapping instant: change your mind
 * mid-corridor and the very next step goes the new way. Caching a whole route
 * would mean walking the old one until it finished, which in a maze with three
 * things chasing you is the difference between a control and a passenger.
 *
 * **IT IS DETERMINISTIC, which the scoreboard depends on.** Neighbours are
 * always tried in the same order, so the same tap from the same square always
 * produces the same step — two players who tapped identically get identical
 * games, which is the whole point of seeding the chasers as well.
 *
 * @returns {number[]|null} `[dc, dr]`, or null if you are already there or it
 *                          cannot be reached
 */
export function stepToward(from, to) {
  if (!from || !to) return null;
  if (from.col === to.col && from.row === to.row) return null;
  if (!open(to.col, to.row)) return null;

  // Walk OUT from the target rather than the player, so the map that comes
  // back is "how far is every cell from where they tapped" — then the step is
  // simply whichever neighbour of the player is nearest, and one walk answers
  // it however far apart they are.
  const dist = new Map();
  dist.set(`${to.col},${to.row}`, 0);
  const queue = [{ col: to.col, row: to.row, d: 0 }];
  while (queue.length) {
    const at = queue.shift();
    if (at.col === from.col && at.row === from.row) break;
    for (const [dc, dr] of DIRS) {
      const col = at.col + dc;
      const row = at.row + dr;
      const key = `${col},${row}`;
      if (!open(col, row) || dist.has(key)) continue;
      dist.set(key, at.d + 1);
      queue.push({ col, row, d: at.d + 1 });
    }
  }

  let best = null;
  let bestD = Infinity;
  for (const [dc, dr] of DIRS) {
    const d = dist.get(`${from.col + dc},${from.row + dr}`);
    if (d === undefined || d >= bestD) continue;
    bestD = d;
    best = [dc, dr];
  }
  return best;
}

/**
 * WHICH WAY THE NEXT STEP GOES when somebody is steering with the keys.
 *
 * **A TURN PRESSED EARLY IS REMEMBERED**, which is what every maze game has
 * done since 1980 and what this one did the opposite of. Reported off the live
 * game: *"the turning corners function is a little glitchy — usually you can
 * press left or right ahead of the next turn and it'll remember to turn that
 * way?"*
 *
 * The old arrow handler set a TARGET by running as far down the corridor as it
 * could — so with a wall that way the run never happened and the target came
 * out as the cell you were standing on, which `stepToward()` answers with
 * null. Pressing a turn a moment early therefore did not merely fail to turn,
 * **it stopped you dead in front of three chasers.**
 *
 * Pure, so it can be tested without a canvas or a clock: it takes where you
 * are, the way you are going and the way you have asked to go, and returns the
 * step plus the state to carry into the next one.
 *
 * @param {{col:number,row:number}} at   where the player is now
 * @param {number[]|null} heading        the way they are travelling
 * @param {number[]|null} want           the turn they have asked for
 * @param {number} wantFor               how many more steps to hold that turn
 * @returns {{ dir: number[]|null, heading: number[]|null, want: number[]|null, wantFor: number }}
 */
export function turnFrom(at, heading, want, wantFor) {
  const canGo = (d) => Boolean(d) && open(at.col + d[0], at.row + d[1]);

  /*
   * THE WANTED TURN IS TRIED FIRST AT EVERY CELL. That is the whole feature:
   * it is what makes "press it before the corner and it turns at the corner"
   * true, rather than "press it at the exact cell or nothing happens".
   */
  if (want && canGo(want)) {
    return { dir: want, heading: want, want: null, wantFor: 0 };
  }

  // Not yet — hold it for a few more cells, then forget it. A turn nobody
  // remembers asking for is worse than one that did not happen.
  const left = want ? wantFor - 1 : 0;
  const stillWant = want && left > 0 ? want : null;

  if (canGo(heading)) {
    return { dir: heading, heading, want: stillWant, wantFor: left };
  }

  /*
   * Ran into a wall. STOP FACING IT, exactly as a maze game does — picking
   * some other direction for somebody is how a control stops being one. The
   * caller falls back to the tapped target from here.
   */
  return { dir: null, heading: null, want: stillWant, wantFor: left };
}
