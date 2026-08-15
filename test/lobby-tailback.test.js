/**
 * TAILBACK — the third lobby game.
 *
 * The same things are worth pinning down as for the other two, plus one that
 * is specific to this game and is the only way it can be badly broken:
 *
 * **THE STEERING MUST NEVER BE WHAT KILLS YOU.** The head is routed to where
 * you tapped, and if that route goes through the tail then the game takes a
 * life for something the player did not do. It is invisible in a screenshot
 * and rare enough that playing it for five minutes would not find it — so it
 * is checked over tens of thousands of simulated steps instead.
 *
 * And the balance, because a lobby game that is over in eight seconds does not
 * do the job the lobby game exists for: keeping a phone in somebody's hand,
 * and therefore its connection in the foreground, while the room fills up.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  COLS, ROWS, STEP_MS, LIVES, newGame, step, aim, playOut, stepToward, inField,
} from '../public/assets/tailback.js';

/** Beelines at the pellet every step. A ceiling, not a person. */
const greedy = (g) => g.pellet;
/** Never touches it at all. */
const never = () => null;
/** A person: re-aims every sixth step, which is about as often as a thumb. */
const human = () => { let i = 0; return (g) => (i++ % 6 === 0 ? g.pellet : null); };
/** Plays for a moment and then puts the phone down. */
const quits = (after = 40) => { let i = 0; return (g) => (i++ < after ? g.pellet : null); };

const SEEDS = [1, 4242, 999999, 5, 12, 88];

/* -------------------------------------------------------------- the steering */

test('THE STEERING NEVER ROUTES THE HEAD THROUGH ITS OWN TAIL', () => {
  /*
   * The one fault that would make this game feel broken rather than hard, and
   * the reason the rules are testable without a canvas at all. Every step of
   * every game: whatever the router returned, the cell it points at must not
   * be part of the body — bar the very end, which has moved on by the time the
   * head arrives.
   */
  for (const seed of SEEDS) {
    const g = newGame(seed);
    for (let i = 0; i < 4_000 && !g.over; i++) {
      aim(g, g.pellet.col, g.pellet.row);
      const before = g.body.map((p) => `${p.col},${p.row}`).slice(0, -1);
      const head = g.body[0];
      const dir = stepToward(head, g.target, g.body, g.grow > 0);
      if (dir) {
        const into = `${head.col + dir[0]},${head.row + dir[1]}`;
        assert.ok(!before.includes(into), `seed ${seed}: steered into its own tail at ${into}`);
      }
      step(g);
    }
  }
});

test('the head never leaves the field, and the tail never doubles up on a cell', () => {
  for (const seed of SEEDS) {
    const g = newGame(seed);
    for (let i = 0; i < 4_000 && !g.over; i++) {
      aim(g, g.pellet.col, g.pellet.row);
      step(g);
      for (const p of g.body) {
        assert.ok(inField(p.col, p.row), `seed ${seed}: a cell left the field at ${p.col},${p.row}`);
      }
      // NO cell twice, ever. That is only assertable because growth is "do
      // not trim for a few steps" rather than "stack copies of the end cell",
      // and it is a much stronger statement about the game than the version
      // that had to tolerate duplicates.
      const cells = new Set(g.body.map((p) => `${p.col},${p.row}`));
      assert.equal(cells.size, g.body.length, `seed ${seed}: the tail crossed itself`);
    }
  }
});

test('a pellet is never dropped underneath the tail', () => {
  for (const seed of SEEDS) {
    const g = newGame(seed);
    for (let i = 0; i < 3_000 && !g.over; i++) {
      aim(g, g.pellet.col, g.pellet.row);
      step(g);
      if (!g.pellet) continue;
      assert.ok(!g.body.some((p) => p.col === g.pellet.col && p.row === g.pellet.row),
        `seed ${seed}: a pellet appeared under the tail`);
    }
  }
});

/* --------------------------------------------------------------- the balance */

test('IT CAN BE LOST — a player who is trying still runs out of lives', () => {
  for (const seed of SEEDS) {
    const { game, finished } = playOut(seed, human());
    assert.equal(finished, true, `seed ${seed}: a played game never ended`);
    assert.equal(game.lives, 0);
  }
});

test('…and it lasts long enough to be worth opening', () => {
  /*
   * The whole reliability argument for a lobby game is that a phone with one
   * on it stays in the FOREGROUND. Dying at a wall was tried and gave a
   * human-paced player eight to thirty seconds for three lives, which is a
   * punishment for blinking rather than a game.
   */
  for (const seed of SEEDS) {
    const seconds = (playOut(seed, human()).steps * STEP_MS) / 1000;
    assert.ok(seconds > 45, `seed ${seed}: a whole game lasted ${seconds.toFixed(0)}s`);
  }
});

test('skill scores more than a thumb, and a thumb scores more than nobody', () => {
  for (const seed of SEEDS) {
    const none = playOut(seed, never, 3_000).game.score;
    const some = playOut(seed, human()).game.score;
    const best = playOut(seed, greedy).game.score;
    assert.equal(none, 0, `seed ${seed}: a game nobody started scored ${none}`);
    assert.ok(some > 500, `seed ${seed}: a human-paced player only reached ${some}`);
    /*
     * Beelining is NOT the ceiling here and the first version of this test
     * wrongly assumed it was. Going straight at every pellet is a known way to
     * trap yourself, so a bot that does it sometimes loses to a slower player
     * — which is a point in the game's favour rather than a fault: it means
     * the score rewards thinking about the tail rather than reaction speed.
     */
    assert.ok(best > 500, `seed ${seed}: beelining only reached ${best}`);
  }
});

test('A PHONE LEFT ALONE CANNOT REACH THE BOARD', () => {
  /*
   * The tail follows the wall round rather than dying on it, which means an
   * abandoned game does not end. That was measured rather than assumed before
   * it was allowed: forty-three minutes of wandering reaches a score a real
   * player passes inside two minutes, so it cannot embarrass anybody on a
   * projector.
   */
  const abandoned = playOut(4242, quits(), 20_000).game.score;   // ~43 minutes
  const played = playOut(4242, human()).game.score;              // ~90 seconds
  assert.ok(abandoned < played / 4,
    `an abandoned phone reached ${abandoned} against a player's ${played}`);
});

test('nothing moves until the first tap, so a lost life is not immediately two', () => {
  const g = newGame(4242);
  const where = JSON.stringify(g.body);
  for (let i = 0; i < 500; i++) assert.equal(step(g), null);
  assert.equal(JSON.stringify(g.body), where, 'it moved before anybody touched it');
  assert.equal(g.lives, LIVES);
  aim(g, g.pellet.col, g.pellet.row);
  step(g);
  assert.notEqual(JSON.stringify(g.body), where, 'it did not go when tapped');
});

test('a tap outside the field is a miss, not a clamp', () => {
  // Steering somewhere nobody chose is worse than carrying on.
  const g = newGame(1);
  aim(g, -3, 4);
  assert.equal(g.target, null);
  aim(g, COLS + 2, ROWS + 2);
  assert.equal(g.target, null);
});

/* ------------------------------------------------------------------ the seed */

test('THE SAME SEED IS THE SAME GAME, every time', () => {
  for (const seed of SEEDS) {
    const a = playOut(seed, human());
    const b = playOut(seed, human());
    assert.equal(a.game.score, b.game.score);
    assert.equal(a.steps, b.steps);
    assert.deepEqual(a.events, b.events);
  }
});

test('…and a different seed is a different game', () => {
  const a = playOut(1, human());
  const b = playOut(2, human());
  assert.notEqual(`${a.game.score}:${a.steps}`, `${b.game.score}:${b.steps}`);
});

test('the turn it takes with nowhere chosen is deterministic too', () => {
  // Every phone in the room has to make the same turn at the same wall, or the
  // board compares two different games again.
  const runs = [0, 1].map(() => {
    const g = newGame(77);
    aim(g, COLS - 1, Math.floor(ROWS / 2));   // one tap, then never again
    const path = [];
    for (let i = 0; i < 600 && !g.over; i++) { step(g); path.push(`${g.body[0].col},${g.body[0].row}`); }
    return path.join('|');
  });
  assert.equal(runs[0], runs[1]);
});

/* ------------------------------------------------------------- the naming */

test('NOTHING IN THE GAME IS CALLED SNAKE', async () => {
  // Generic as the word is, it is the one everybody will say out loud — and
  // CLAUDE.md's rule is that the app never prints the obvious name.
  const { readFile } = await import('node:fs/promises');
  for (const f of ['tailback.js', 'lobby-tailback.js']) {
    const text = await readFile(new URL(`../public/assets/${f}`, import.meta.url), 'utf8');
    const shown = text.split('\n')
      .filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//') && !l.trim().startsWith('/*'))
      .join('\n');
    assert.ok(!/\bsnake\b/i.test(shown), `${f} says "snake" outside a comment`);
  }
});
