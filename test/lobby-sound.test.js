/**
 * THE LOBBY GAMES' SOUND — who decides, and who wins.
 *
 * There is nothing to test about how a gunshot sounds. What is worth pinning
 * down is the PRECEDENCE, because there are two switches and they belong to
 * different people:
 *
 * - **the HOST's**, off the game state, deciding whether the room may make a
 *   noise tonight;
 * - **the PHONE's**, in `localStorage`, deciding whether this one does.
 *
 * The host's wins, and it must not wipe the phone's — muting a room for one
 * night should not clear what somebody chose for themselves. That is three
 * cases and a default, none of which shows up in a screenshot.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * A fresh copy of the module each time.
 *
 * It caches the phone's preference in a module-level variable — deliberately,
 * because `soundOn()` is called on every noise — so a test that wants to see
 * the first read has to start from a module nobody has touched. The query
 * string is what makes Node hand back a separate instance.
 */
let n = 0;
async function fresh(stored) {
  const store = new Map();
  if (stored !== undefined) store.set('qp.lobbySound', stored);
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
  };
  n += 1;
  const mod = await import(`../public/assets/lobby-sound.js?case=${n}`);
  return { mod, store };
}

test('ON BY DEFAULT — a phone nobody has asked makes a noise', async () => {
  /*
   * It shipped off and that was wrong: the game only exists in the lobby, so a
   * noise during a question is impossible rather than unlikely, and a garnish
   * behind a toggle nobody finds is a garnish nobody hears.
   */
  const { mod } = await fresh(undefined);
  assert.equal(mod.soundOn(), true);
});

test('…and a phone that opted out stays out', async () => {
  const { mod } = await fresh('0');
  assert.equal(mod.soundOn(), false);
});

test('a phone that opted IN stays in', async () => {
  const { mod } = await fresh('1');
  assert.equal(mod.soundOn(), true);
});

test('THE HOST\'S SWITCH WINS over a phone that wants sound', async () => {
  const { mod } = await fresh('1');
  assert.equal(mod.soundOn(), true);
  mod.allowSound(false);
  assert.equal(mod.soundOn(), false, 'a muted room still made a noise');
});

test('…and it does NOT wipe what the phone chose', async () => {
  /*
   * The case that would only ever be noticed a week later: mute the room on
   * Thursday, and somebody's own preference should still be theirs on Friday.
   */
  const { mod, store } = await fresh('1');
  mod.allowSound(false);
  assert.equal(store.get('qp.lobbySound'), '1', 'muting the room rewrote the phone');
  mod.allowSound(true);
  assert.equal(mod.soundOn(), true, 'the phone did not come back on with the room');
});

test('THERE IS NO BUTTON AT ALL WHEN THE ROOM IS MUTED', async () => {
  /*
   * It used to draw one anyway, so a player could press it, watch it turn to
   * 🔊 and hear nothing — a control that lies about what it did. The host's
   * switch is not this phone's business to argue with.
   */
  const { mod } = await fresh(undefined);
  assert.match(mod.soundButton(), /arcade-sound/);
  mod.allowSound(false);
  assert.equal(mod.soundButton(), '');
});

test('the button says which way it is', async () => {
  const on = await fresh('1');
  assert.match(on.mod.soundButton(), /aria-pressed="true"/);
  const off = await fresh('0');
  assert.match(off.mod.soundButton(), /aria-pressed="false"/);
});

test('toggling flips the PHONE and writes it down', async () => {
  const { mod, store } = await fresh(undefined);
  assert.equal(mod.toggleSound(), false);
  assert.equal(store.get('qp.lobbySound'), '0');
  assert.equal(mod.soundOn(), false);
  assert.equal(mod.toggleSound(), true);
  assert.equal(store.get('qp.lobbySound'), '1');
});

test('toggling reports the PHONE, not the room', async () => {
  /*
   * `!soundOn()` would have been the obvious way to write this and is wrong:
   * with the room muted it reads as off, so one press would silently flip the
   * phone's own setting to something nobody asked for.
   */
  const { mod, store } = await fresh('1');
  mod.allowSound(false);
  assert.equal(mod.toggleSound(), false, 'the toggle answered for the room rather than the phone');
  assert.equal(store.get('qp.lobbySound'), '0');
});

test('nothing throws and nothing plays when there is no audio at all', async () => {
  /*
   * A browser with no `AudioContext`, or a private window that refuses
   * `localStorage`, must cost a player the noise and nothing else. Every one
   * of these is called from inside a game loop.
   */
  const { mod } = await fresh(undefined);
  delete globalThis.AudioContext;
  globalThis.window = {};
  assert.doesNotThrow(() => {
    mod.wakeSound();
    mod.playShot();
    mod.playRicochet();
    mod.playOops();
    mod.playPlink(3);
    mod.playLost();
  });
});

test('a night saved before any of this existed still plays', async () => {
  // `allowSound(undefined)` is what an older state file amounts to, and it
  // must mean yes — going mysteriously silent is worse than making a noise.
  const { mod } = await fresh(undefined);
  mod.allowSound(undefined);
  assert.equal(mod.soundOn(), true);
});
