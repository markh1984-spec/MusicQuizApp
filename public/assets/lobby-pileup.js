/**
 * PILE UP — running.
 *
 * The rules are in `pileup.js` and know nothing about a canvas or a clock;
 * this file owns both. Same `startGame(canvas, …)` as the other four.
 *
 * **THE CLOCK IS READ, NEVER ACCUMULATED**, as in Quick Draw: game time is
 * simply "how long since it started", and the crate's position is a pure
 * function of it. Nothing here needs Rally's catch-up cap, because nothing
 * carries over from one frame to the next — a phone that was face down for a
 * minute wakes up with the crate exactly where every other phone has it.
 *
 * **A DROP IS RESOLVED AT THE INSTANT THE FINGER LANDS**, not on the next
 * frame. The swing is continuous, so a tap resolved a frame late costs real
 * width on a 30Hz phone and none on a 120Hz one — which would put the handset
 * in the score, the exact thing the seed exists to keep out.
 *
 * **THE VIEW SCROLLS, THE TOWER DOES NOT MOVE.** Once the pile is taller than
 * the screen the camera lifts instead of the crates falling away, so what you
 * built stays behind you. It is drawn from the top down for that reason: only
 * the last dozen rows can ever be on screen, so the loop stops rather than
 * walking a stack that is hundreds long by the end of a good game.
 */

import {
  W, H, CRATE_H, LIVES, newGame, runTo, dropAt, crateAt, top,
} from './pileup.js';
import { wakeSound, playShot, playPlink, playOops, playLost } from './lobby-sound.js';

/** How many rows fit on screen. The camera keeps the top one here. */
const ROWS_SHOWN = Math.round(H / CRATE_H);

/** A crate's face and its shadowed side, so a stack reads as solid. */
const CRATE = '#c9873f';
const CRATE_DARK = '#8f5c22';
const CRATE_LINE = 'rgba(0,0,0,0.35)';
/** The one being swung is lighter, so it is never mistaken for the pile. */
const SWINGING = '#ffd23f';
const SKY = '#0b0b14';

export function startGame(canvas, { onEnd = () => {}, onBank = () => {}, seed = 1 } = {}) {
  const ctx = canvas.getContext('2d');
  const g = newGame(seed);
  let raf = 0;
  let over = false;
  let started = 0;
  /** A flash on the last thing that happened, purely to be seen. */
  let flash = null;
  let livesWas = g.lives;

  function now() {
    return performance.now() - started;
  }

  function drop(ev) {
    if (over) return;
    ev.preventDefault();
    // The tap's OWN moment, before anything is drawn. See the note above.
    const at = now();
    wakeSound();
    runTo(g, at);
    const events = dropAt(g, at);
    for (const e of events) {
      if (e === 'perfect') { playPlink(Math.min(8, g.perfects)); flash = { kind: 'perfect', at }; }
      else if (e === 'placed' && !events.includes('perfect')) { playShot(); flash = { kind: 'placed', at }; }
      else if (e === 'missed') { playOops(); flash = { kind: 'missed', at }; }
    }
    /*
     * ONE POST PER LIFE, AND ONE AT GAME OVER — never a stream.
     *
     * The same rule as the other four: the lobby is exactly when sixty phones
     * are joining, and banking at each life is what puts the people who played
     * LONGEST on the board rather than only those who finished before the
     * quiz started.
     */
    if (g.lives < livesWas) {
      livesWas = g.lives;
      onBank({ score: g.score });
    }
    if (g.over) {
      playLost();
      finish();
    }
  }

  function onKey(ev) {
    if (ev.key === ' ' || ev.key === 'Enter' || ev.key === 'ArrowDown') drop(ev);
  }

  function draw() {
    const t = now();
    runTo(g, t);

    const scale = canvas.width / W;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = SKY;
    ctx.fillRect(0, 0, W, H);

    /*
     * THE CAMERA KEEPS THE TOP OF THE PILE ONE ROW DOWN FROM THE CRATE, so
     * there is always somewhere visible to aim at. Below `ROWS_SHOWN` it does
     * not move at all, or a three-crate tower would sit off the bottom.
     */
    const lift = Math.max(0, g.stack.length - ROWS_SHOWN + 2);

    // Only what can be on screen — a long game's stack is hundreds deep.
    const first = Math.max(0, g.stack.length - ROWS_SHOWN - 1);
    for (let i = first; i < g.stack.length; i++) {
      const c = g.stack[i];
      const y = H - (i - lift + 1) * CRATE_H;
      if (y > H || y + CRATE_H < 0) continue;
      crate(c.x, y, c.w, CRATE);
    }

    // The one you are about to drop, a row above the pile.
    if (!g.over) {
      const swinging = crateAt(g, t);
      const y = H - (g.stack.length - lift + 1) * CRATE_H;
      crate(swinging.x, Math.max(0, y), swinging.w, SWINGING);
    }

    hud(t);
    raf = requestAnimationFrame(draw);
  }

  function crate(x, y, w, face) {
    ctx.fillStyle = face;
    ctx.fillRect(x, y, w, CRATE_H);
    // A shadowed underside, which is what makes a flat rectangle read as a box.
    ctx.fillStyle = CRATE_DARK;
    ctx.fillRect(x, y + CRATE_H - Math.max(2, CRATE_H * 0.18), w, Math.max(2, CRATE_H * 0.18));
    ctx.strokeStyle = CRATE_LINE;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 0.75, y + 0.75, Math.max(0, w - 1.5), CRATE_H - 1.5);
  }

  function hud(t) {
    ctx.fillStyle = '#fff';
    ctx.font = `600 ${Math.round(H * 0.032)}px system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(String(g.score), 14, H * 0.05);
    ctx.textAlign = 'right';
    ctx.fillText('●'.repeat(Math.max(0, g.lives)) + '○'.repeat(Math.max(0, LIVES - g.lives)), W - 14, H * 0.05);

    if (flash && t - flash.at < 420) {
      ctx.textAlign = 'center';
      ctx.fillStyle = flash.kind === 'missed' ? '#ff6b6b' : (flash.kind === 'perfect' ? '#ffd23f' : 'rgba(255,255,255,0.6)');
      ctx.font = `700 ${Math.round(H * 0.04)}px system-ui, sans-serif`;
      const said = flash.kind === 'missed' ? 'Missed!' : (flash.kind === 'perfect' ? 'Clean!' : '');
      if (said) ctx.fillText(said, W / 2, H * 0.12);
    }
  }

  function finish() {
    if (over) return;
    over = true;
    cancelAnimationFrame(raf);
    detach();
    onEnd({ score: g.score, won: false });
  }

  function detach() {
    canvas.removeEventListener('touchstart', drop);
    canvas.removeEventListener('mousedown', drop);
    window.removeEventListener('keydown', onKey);
  }

  canvas.addEventListener('touchstart', drop, { passive: false });
  canvas.addEventListener('mousedown', drop);
  window.addEventListener('keydown', onKey);

  started = performance.now();
  raf = requestAnimationFrame(draw);

  return {
    /** Safe to call twice — the phone tears down on every state push. */
    stop() {
      if (over) return;
      over = true;
      cancelAnimationFrame(raf);
      detach();
    },
    get score() { return g.score; },
    get lives() { return g.lives; },
  };
}
