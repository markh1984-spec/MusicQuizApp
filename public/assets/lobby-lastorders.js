/**
 * LAST ORDERS on a canvas — the rules are in `lastorders.js` and everything
 * here is drawing and input.
 *
 * The split is the same one every game in this folder keeps: a decision that
 * can be tested without a clock belongs in the rules file, so "does the wave
 * speed up as it thins", "can it be lost" and "is the same seed the same game"
 * are assertions rather than things somebody has to watch for.
 *
 * **THE TICK IS FIXED AND THE CATCH-UP IS CAPPED**, which is Rally's lesson
 * applied rather than rediscovered: advanced by a frame delta, a 120Hz phone
 * and a 30Hz one play different games, and a phone face down for two minutes
 * spends the whole gap in one frame the moment it wakes.
 */

import {
  COLS, ROWS, BAR_ROW, TICK_MS, newGame, tick, aim, edges,
} from './lastorders.js';
import { wakeSound, playShot, playRicochet, playOops, playLost } from './lobby-sound.js';

/* The pub at night: a dark room, warm drinkers, a cold glass. */
const ROOM = '#120d18';
const BAR = 'rgba(255,255,255,0.14)';
const ORD = '#e8734a';
const TOP = '#f2c14e';
const GLASS = '#8fd6ff';
const SHOT = '#ffffff';
const THROWN = '#ff5d73';

export function startGame(canvas, { onEnd = () => {}, onBank = () => {}, seed = 1 } = {}) {
  const ctx = canvas.getContext('2d');
  const g = newGame(seed);
  let raf = 0;
  let over = false;
  let last = 0;
  let owed = 0;
  let started = false;
  let shookAt = -1e9;
  let livesWas = g.lives;

  const cell = () => ({ w: canvas.width / COLS, h: canvas.height / ROWS });

  /*
   * TAP A COLUMN, and the glass slides there on its own.
   *
   * The x is all that is read — tapping high or low means the same thing,
   * because asking somebody to hit a row as well as a column is the control
   * panel this folder does not have. A tap outside is a miss rather than a
   * clamp, which `aim()` enforces.
   */
  function tapped(ev) {
    if (over) return;
    const box = canvas.getBoundingClientRect();
    const touch = ev.touches ? ev.touches[0] : ev;
    const x = ((touch.clientX - box.left) / box.width) * canvas.width;
    if (!started) { started = true; wakeSound(); last = performance.now(); }
    aim(g, Math.floor(x / cell().w));
  }
  canvas.addEventListener('touchstart', tapped, { passive: true });
  canvas.addEventListener('mousedown', tapped);
  // Arrow keys for a laptop, because the console is driven from one.
  const onKey = (ev) => {
    if (over) return;
    const step = ev.key === 'ArrowLeft' ? -1 : ev.key === 'ArrowRight' ? 1 : 0;
    if (!step) return;
    ev.preventDefault();
    if (!started) { started = true; wakeSound(); last = performance.now(); }
    aim(g, Math.max(0, Math.min(COLS - 1, (g.want === null ? g.col : g.want) + step)));
  };
  window.addEventListener('keydown', onKey);

  function detach() {
    canvas.removeEventListener('touchstart', tapped);
    canvas.removeEventListener('mousedown', tapped);
    window.removeEventListener('keydown', onKey);
  }

  /** One drinker. Two kinds, told apart by COLOUR and SHAPE, never a detail. */
  function drinker(x, y, w, h, kind, wobble) {
    const cx = x + w / 2;
    const cy = y + h / 2 + Math.sin(wobble) * h * 0.06;
    ctx.fillStyle = kind === 'top' ? TOP : ORD;
    // A pint glass silhouette: tapered body, a head on top.
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.26, cy - h * 0.22);
    ctx.lineTo(cx + w * 0.26, cy - h * 0.22);
    ctx.lineTo(cx + w * 0.19, cy + h * 0.28);
    ctx.lineTo(cx - w * 0.19, cy + h * 0.28);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.55;
    ctx.fillRect(cx - w * 0.28, cy - h * 0.3, w * 0.56, h * 0.09);
    ctx.globalAlpha = 1;
  }

  function draw(nowMs) {
    const c = cell();
    ctx.save();
    const shake = Math.max(0, 1 - (nowMs - shookAt) / 240);
    if (shake > 0) {
      const amp = canvas.width * 0.02 * shake;
      ctx.translate(Math.sin(nowMs / 17) * amp, Math.cos(nowMs / 11) * amp);
    }

    ctx.fillStyle = ROOM;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // The bar itself, so "they are getting to the bar" is a place on screen.
    ctx.fillStyle = BAR;
    ctx.fillRect(0, BAR_ROW * c.h + c.h * 0.72, canvas.width, c.h * 0.28);

    for (const d of g.drinkers) {
      drinker(d.col * c.w, d.row * c.h, c.w, c.h, d.kind, nowMs / 260 + d.col);
    }

    ctx.fillStyle = SHOT;
    for (const s of g.shots) {
      ctx.fillRect(s.col * c.w + c.w * 0.44, s.row * c.h + c.h * 0.2, c.w * 0.12, c.h * 0.6);
    }
    ctx.fillStyle = THROWN;
    for (const t of g.thrown) {
      ctx.beginPath();
      ctx.arc(t.col * c.w + c.w / 2, t.row * c.h + c.h / 2, c.w * 0.14, 0, Math.PI * 2);
      ctx.fill();
    }

    // The glass you are moving.
    ctx.fillStyle = GLASS;
    const gx = g.col * c.w;
    ctx.beginPath();
    ctx.roundRect(gx + c.w * 0.18, BAR_ROW * c.h + c.h * 0.12, c.w * 0.64, c.h * 0.6, c.w * 0.1);
    ctx.fill();

    const pip = canvas.width * 0.024;
    ctx.fillStyle = GLASS;
    for (let i = 0; i < g.lives; i += 1) {
      ctx.beginPath();
      ctx.arc(pip * 2 + i * pip * 2.4, pip * 2, pip, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.font = `${Math.round(canvas.width * 0.06)}px system-ui, sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText(String(g.score), canvas.width - pip * 2, pip * 3.2);

    if (!started) {
      ctx.textAlign = 'center';
      ctx.font = `${Math.round(canvas.width * 0.055)}px system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillText('Tap to start', canvas.width / 2, canvas.height * 0.55);
      ctx.font = `${Math.round(canvas.width * 0.04)}px system-ui, sans-serif`;
      ctx.fillStyle = TOP;
      ctx.fillText('tap where you want the glass', canvas.width / 2, canvas.height * 0.55 + canvas.width * 0.07);
    }
    ctx.restore();
  }

  function frame(nowMs) {
    if (over) return;
    if (started) {
      /*
       * WHOLE TICKS ONLY, AND NEVER MORE THAN A HANDFUL AT ONCE. Uncapped, a
       * backgrounded phone returns and plays the missing minute instantly —
       * which is a game over nobody watched.
       */
      owed += nowMs - last;
      let budget = 8;
      while (owed >= TICK_MS && budget > 0 && !g.over) {
        owed -= TICK_MS;
        budget -= 1;
        for (const e of tick(g)) {
          if (e === 'fire') playShot();
          if (e === 'wave') playRicochet();
          if (e === 'life') { shookAt = nowMs; playOops(); }
        }
      }
      if (owed > TICK_MS * 8) owed = 0;
      last = nowMs;
      if (g.lives < livesWas) { livesWas = g.lives; onBank(g.score); }
      if (g.over) {
        playLost();
        onBank(g.score);
        draw(nowMs);
        over = true;
        detach();
        onEnd(g.score);
        return;
      }
    } else {
      last = nowMs;
    }
    draw(nowMs);
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

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
