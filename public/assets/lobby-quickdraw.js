/**
 * QUICK DRAW — running.
 *
 * The rules are in `quickdraw.js` and know nothing about a canvas or a clock;
 * this file owns both. Same `startGame(canvas, …)` as the other three.
 *
 * **THE CLOCK IS READ, NEVER ACCUMULATED.** Game time is simply "how long
 * since it started", handed to `runTo()`, which lands in the same state
 * whatever the frame rate — see the note at the top of `quickdraw.js`. There
 * is deliberately no catch-up cap here as there is in Rally: a phone that was
 * busy for two seconds really did have three outlaws draw on it, and skipping
 * them would let a stuttering handset play an easier game.
 *
 * **A SHOT IS RESOLVED AT THE INSTANT IT LANDS**, not on the next frame —
 * `runTo()` is called with the tap's own moment before `shoot()`. Resolving a
 * tap against last frame's picture is a shot at somebody who had already
 * ducked, which a player would rightly call a bug, and at 620ms windows it
 * would happen constantly.
 */

import {
  COLS, ROWS, SLOTS, OUTLAW, newGame, runTo, shoot, showing,
} from './quickdraw.js';
import { wakeSound, playShot, playRicochet, playOops, playLost } from './lobby-sound.js';

/** How long somebody takes to rise, so it reads as popping up. */
const RISE_MS = 130;

const WALL = '#3a2a1f';
const WALL_LINE = 'rgba(0,0,0,0.35)';
const HOLE = '#0b0b14';
const BADDIE = '#c9384a';
const GOODIE = '#ffd23f';

export function startGame(canvas, { onEnd = () => {}, onBank = () => {}, seed = 1 } = {}) {
  const ctx = canvas.getContext('2d');
  const g = newGame(seed);
  let raf = 0;
  let over = false;
  let started = 0;
  let flash = 0;
  let flashBad = false;
  let lives = g.lives;
  /*
   * A STREAK, and it exists for the ricochet rather than for the score.
   *
   * A noise on every single hit is wallpaper within twenty seconds. A noise
   * that means "you are on a run" is a reward, and it self-limits — which
   * matters when the room has sixty phones in it.
   */
  let streak = 0;

  const gameTime = (now) => (started ? now - started : 0);

  /* ------------------------------------------------------------- the thumb */
  /*
   * Canvas pixels are not CSS pixels — the same scaling sum as the other three
   * and the same trap: get it wrong and every shot lands in the wrong hole on
   * exactly the phones this is for.
   */
  const slotAt = (ev) => {
    const t = ev.touches ? ev.touches[0] : ev;
    if (!t) return -1;
    const box = canvas.getBoundingClientRect();
    const px = (t.clientX - box.left) * (canvas.width / box.width);
    const py = (t.clientY - box.top) * (canvas.height / box.height);
    const cell = layout();
    const col = Math.floor((px - cell.offX) / cell.w);
    const row = Math.floor((py - cell.offY) / cell.h);
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return -1;
    return row * COLS + col;
  };

  const fire = (ev) => {
    const slot = slotAt(ev);
    if (slot < 0) return;
    // The tap's own moment, so a shot is judged against what was on screen
    // when the thumb landed rather than when the next frame happened to run.
    const now = performance.now();
    // A browser will not make a sound until somebody has touched the page, and
    // on iOS will not even build the context — so it is woken here, inside a
    // real tap, and never on load.
    if (!started) { started = now; wakeSound(); }
    runTo(g, gameTime(now));
    const what = shoot(g, slot);
    if (what === 'hit') { flash = now; flashBad = false; hit(); }
    if (what === 'sheriff') { flash = now; flashBad = true; streak = 0; playOops(); }
    check(now);
  };
  canvas.addEventListener('touchstart', fire, { passive: true });
  canvas.addEventListener('mousedown', fire);
  const onKey = (ev) => {
    // 1-6 still work, so a laptop can play it. The console is driven from one.
    const n = Number(ev.key);
    if (!n || n < 1 || n > SLOTS) return;
    ev.preventDefault();
    const now = performance.now();
    if (!started) { started = now; wakeSound(); }
    runTo(g, gameTime(now));
    const what = shoot(g, n - 1);
    if (what === 'hit' || what === 'sheriff') { flash = now; flashBad = what === 'sheriff'; }
    if (what === 'hit') hit();
    if (what === 'sheriff') { streak = 0; playOops(); }
    check(now);
  };
  window.addEventListener('keydown', onKey);

  /* ------------------------------------------------------------ the drawing */
  function layout() {
    const w = canvas.width / COLS;
    const h = canvas.height / ROWS;
    return { w, h, offX: 0, offY: 0 };
  }

  /**
   * A SILHOUETTE, AND THE TWO KINDS MUST BE UNMISTAKABLE AT A GLANCE.
   *
   * You have about eight-tenths of a second to decide, in a dark pub, on a
   * phone at arm's length — so they differ by COLOUR and by SHAPE, never by
   * one small detail. Red with a bandana across the face, or gold with a star
   * on the chest. Telling them apart must never be the hard part; deciding
   * fast enough is meant to be.
   */
  function figure(x, y, w, h, kind, up) {
    const rise = h * (1 - up);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.translate(0, rise);

    const cx = x + w / 2;
    const bodyTop = y + h * 0.42;
    ctx.fillStyle = kind === OUTLAW ? BADDIE : GOODIE;
    // Body
    ctx.beginPath();
    ctx.roundRect(cx - w * 0.24, bodyTop, w * 0.48, h * 0.6, w * 0.12);
    ctx.fill();
    // Head
    ctx.beginPath();
    ctx.arc(cx, y + h * 0.34, w * 0.15, 0, Math.PI * 2);
    ctx.fill();
    // Hat — the wide brim is what says "western" at any size.
    ctx.beginPath();
    ctx.roundRect(cx - w * 0.3, y + h * 0.2, w * 0.6, h * 0.05, h * 0.025);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(cx - w * 0.14, y + h * 0.1, w * 0.28, h * 0.12, w * 0.05);
    ctx.fill();

    if (kind === OUTLAW) {
      // A bandana across the face, in the hole's own dark, so it reads as a
      // mask rather than as a stripe.
      ctx.fillStyle = HOLE;
      ctx.fillRect(cx - w * 0.15, y + h * 0.34, w * 0.3, h * 0.05);
    } else {
      // A star. Drawn rather than an emoji, like every other icon here.
      ctx.fillStyle = HOLE;
      const r = w * 0.09;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (Math.PI / 5) * i - Math.PI / 2;
        const rr = i % 2 ? r * 0.45 : r;
        ctx[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rr, bodyTop + h * 0.16 + Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function draw(now) {
    const cell = layout();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = WALL;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const at = gameTime(now);
    const up = showing(g);
    for (let i = 0; i < SLOTS; i++) {
      const x = cell.offX + (i % COLS) * cell.w;
      const y = cell.offY + Math.floor(i / COLS) * cell.h;
      const pad = Math.min(cell.w, cell.h) * 0.1;
      ctx.fillStyle = HOLE;
      ctx.beginPath();
      ctx.roundRect(x + pad, y + pad, cell.w - pad * 2, cell.h - pad * 2, pad);
      ctx.fill();

      const who = up.find((p) => p.slot === i);
      if (!who) continue;
      const grown = Math.min(1, (at - who.upAt) / RISE_MS);
      figure(x + pad, y + pad, cell.w - pad * 2, cell.h - pad * 2, who.kind, grown);
    }

    // The planks, drawn OVER the holes so a figure rises from behind the wall
    // rather than floating in a box.
    ctx.strokeStyle = WALL_LINE;
    ctx.lineWidth = Math.max(1, canvas.width * 0.006);
    for (let r = 1; r < ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, cell.offY + r * cell.h);
      ctx.lineTo(canvas.width, cell.offY + r * cell.h);
      ctx.stroke();
    }

    if (now - flash < 200) {
      ctx.globalAlpha = (1 - (now - flash) / 200) * 0.4;
      ctx.fillStyle = flashBad ? BADDIE : GOODIE;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1;
    }

    const pip = canvas.width * 0.03;
    ctx.fillStyle = GOODIE;
    for (let i = 0; i < g.lives; i++) {
      ctx.beginPath();
      ctx.arc(pip * 2 + i * pip * 2.4, pip * 2, pip, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.font = `${Math.round(canvas.width * 0.07)}px system-ui, sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText(String(g.score), canvas.width - pip * 2, pip * 3);

    if (!started) {
      ctx.textAlign = 'center';
      ctx.font = `${Math.round(canvas.width * 0.06)}px system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillText('Tap to start', canvas.width / 2, canvas.height / 2);
      ctx.font = `${Math.round(canvas.width * 0.042)}px system-ui, sans-serif`;
      ctx.fillStyle = GOODIE;
      ctx.fillText('never the one with the star', canvas.width / 2, canvas.height / 2 + canvas.width * 0.075);
    }
  }

  /** A shot that landed, and every fifth one in a row gets the ricochet. */
  function hit() {
    playShot();
    streak += 1;
    if (streak % 5 === 0) playRicochet();
  }

  /** Banked at each life, for the reason every game here banks at each life. */
  function check(now) {
    if (g.lives < lives) {
      lives = g.lives;
      flash = now;
      flashBad = true;
      // A life can also go by an outlaw drawing on you, which never passes
      // through `fire()` — so the noise for it belongs here, where BOTH ways
      // of losing one arrive.
      streak = 0;
      playLost();
      onBank(g.score);
    }
    if (g.over) { onBank(g.score); end(); }
  }

  function frame(now) {
    if (over) return;
    if (started) {
      runTo(g, gameTime(now));
      check(now);
      if (over) return;
    }
    draw(now);
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  function end() {
    if (over) return;
    over = true;
    cancelAnimationFrame(raf);
    detach();
    onEnd({ score: g.score, won: false });
  }

  function detach() {
    canvas.removeEventListener('touchstart', fire);
    canvas.removeEventListener('mousedown', fire);
    window.removeEventListener('keydown', onKey);
  }

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
