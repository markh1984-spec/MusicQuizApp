/**
 * RALLY — the lobby game for a bingo night, running.
 *
 * The rules are in `rally.js` so a test can play a whole game without a
 * browser; this file is the part that needs a canvas — drawing, the clock, the
 * thumb, and knowing when to stop. Exactly the split `maze.js` and
 * `lobby-game.js` already use, and it exports the same `startGame(canvas, …)`
 * so the phone chooses between the two with one branch and nothing else.
 *
 * ---
 *
 * **IT STOPS THE INSTANT THE GAME DOES ANYTHING.** `stop()` is called from the
 * phone on any phase that is not the lobby, and the loop cancels its own
 * frame. Nothing here may survive into a round: on a bingo night the room has
 * to hear the first track, and somebody head-down in a bat-and-ball game is
 * somebody who misses it and then wants the square anyway.
 *
 * **ONE SCORE LEAVES THE PHONE, AT GAME OVER AND AT EACH LIFE LOST.** Never a
 * stream of positions — the lobby is exactly when sixty people are joining,
 * which is the one path in this app that must not stutter. Banking at each
 * life is the fix Maze Mouth already needed and for the same reason: a game
 * interrupted by the bingo starting never reaches game over, and by then the
 * phase has moved and the server rightly refuses a score. The people who
 * played longest were the ones missing from the board.
 *
 * **THE CONTROL IS ONE AXIS AND HAS NO PRECISION IN IT.** The bat follows your
 * thumb along the bottom, and that is the whole of it. No buttons, nothing to
 * aim, nothing to misread — which is the same test Maze Mouth's
 * tap-where-you-want-to-go had to pass, arrived at from the other direction: a
 * maze needs two axes so it takes a destination, a bat needs one so it can
 * simply track. **It is ABSOLUTE, not a drag.** Relative dragging means the
 * bat is wherever you last left it plus however far you have moved since,
 * which after two frantic returns is nowhere you can predict; putting your
 * thumb somewhere and having the bat BE there is a thing you can do without
 * looking at your hand.
 */

import { COURT, BAT, BALL, TICK_MS, newGame, tick, moveBat } from './rally.js';
import { wakeSound, playPlink, playRicochet, playLost } from './lobby-sound.js';

/**
 * HOW MUCH TIME ONE FRAME MAY SPEND, and it is a correctness rule.
 *
 * A phone put face down on a pub table stops getting frames. Two minutes
 * later it wakes up and hands the loop a single 120,000ms step — which, spent
 * honestly, is every remaining life lost before the screen has repainted once,
 * on a game somebody was not playing. So a frame may catch up by a few ticks
 * and the rest of the time is simply missed. That is the truthful outcome:
 * they were not there.
 */
const MAX_CATCH_UP_MS = 100;

const COLOURS = {
  you: '#ffd23f',        // gold, like everything that is yours in this app
  them: '#ff2e88',
  ball: '#ffffff',
  net: 'rgba(120,110,220,0.30)',
};

export function startGame(canvas, { onEnd = () => {}, onBank = () => {}, seed = 1 } = {}) {
  const ctx = canvas.getContext('2d');
  const g = newGame(seed);
  let raf = 0;
  let over = false;
  let last = 0;
  let carry = 0;          // real milliseconds not yet spent as whole ticks
  let flash = 0;          // when the last thing worth seeing happened

  /* ------------------------------------------------------------- the thumb */
  /*
   * Canvas pixels are not CSS pixels — it is drawn at device resolution so the
   * court is not fuzzy, so a touch has to be scaled before it means a
   * position. Getting this wrong puts the bat at the wrong end of the court on
   * exactly the phones the game is for, which is the identical sum
   * `lobby-game.js` has to do and the identical trap.
   */
  const aim = (ev) => {
    const t = ev.touches ? ev.touches[0] : ev;
    if (!t) return;
    const box = canvas.getBoundingClientRect();
    const size = Math.min(canvas.width / COURT.w, canvas.height / COURT.h);
    const offX = (canvas.width - size * COURT.w) / 2;
    const px = (t.clientX - box.left) * (canvas.width / box.width);
    moveBat(g, (px - offX) / size);
  };
  const onDown = (ev) => { wakeSound(); aim(ev); };
  const onMove = (ev) => { if (ev.buttons || ev.touches) aim(ev); };
  const onKey = (ev) => {
    /*
     * ARROWS STILL WORK, and cost nothing — the console is driven from a
     * laptop and somebody will try the keys, exactly as in the maze. A fifth
     * of the court a press: enough to be useful, small enough to aim with.
     */
    const d = { ArrowLeft: -1, ArrowRight: 1 }[ev.key];
    if (!d) return;
    ev.preventDefault();
    moveBat(g, g.batX + d * COURT.w * 0.2);
  };
  canvas.addEventListener('touchstart', onDown, { passive: true });
  canvas.addEventListener('touchmove', onMove, { passive: true });
  canvas.addEventListener('mousedown', onDown);
  canvas.addEventListener('mousemove', onMove);
  window.addEventListener('keydown', onKey);

  /* ------------------------------------------------------------ the drawing */
  function draw(now) {
    const size = Math.min(canvas.width / COURT.w, canvas.height / COURT.h);
    const offX = (canvas.width - size * COURT.w) / 2;
    const offY = (canvas.height - size * COURT.h) / 2;
    const X = (x) => offX + x * size;
    const Y = (y) => offY + y * size;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // The net. A dashed line across the middle, which is the one mark that
    // makes a rectangle read as a court rather than as a box.
    ctx.strokeStyle = COLOURS.net;
    ctx.lineWidth = Math.max(1, size * 0.5);
    ctx.setLineDash([size * 3, size * 3]);
    ctx.beginPath();
    ctx.moveTo(X(0), Y(COURT.h / 2));
    ctx.lineTo(X(COURT.w), Y(COURT.h / 2));
    ctx.stroke();
    ctx.setLineDash([]);

    const bat = (x, y, colour) => {
      ctx.fillStyle = colour;
      const r = (BAT.h * size) / 2;
      const left = X(x - BAT.w / 2);
      const top = Y(y - BAT.h / 2);
      // Rounded, because nothing in this app is square — the host's own rule,
      // and a bat is the biggest thing on the screen after the court.
      ctx.beginPath();
      ctx.roundRect(left, top, BAT.w * size, BAT.h * size, r);
      ctx.fill();
    };
    bat(g.themX, BAT.them, COLOURS.them);
    bat(g.batX, BAT.you, COLOURS.you);

    // The ball, with a short tail behind it so a fast one can still be
    // followed on a phone — at full speed it moves most of its own width a
    // frame, and a bare circle strobes.
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = BALL.r * size * 1.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(X(g.ball.x - g.ball.vx * 2), Y(g.ball.y - g.ball.vy * 2));
    ctx.lineTo(X(g.ball.x), Y(g.ball.y));
    ctx.stroke();
    ctx.fillStyle = COLOURS.ball;
    ctx.beginPath();
    ctx.arc(X(g.ball.x), Y(g.ball.y), BALL.r * size, 0, Math.PI * 2);
    ctx.fill();

    // A flash off the wall the ball just left, so a hit reads as a hit even
    // when the ball has already gone. 180ms, then nothing.
    if (now - flash < 180) {
      ctx.globalAlpha = 1 - (now - flash) / 180;
      ctx.fillStyle = COLOURS.you;
      ctx.fillRect(X(0), Y(COURT.h) - size, COURT.w * size, size);
      ctx.globalAlpha = 1;
    }

    /*
     * LIVES AS PIPS, NOT AS A NUMBER. It is read at a glance while the ball is
     * moving, and "2" has to be converted where two dots do not. Top left,
     * away from the ball's half of the court for most of a rally.
     */
    ctx.fillStyle = COLOURS.you;
    for (let i = 0; i < g.lives; i++) {
      ctx.beginPath();
      ctx.arc(X(4 + i * 5), Y(COURT.h / 2 + 6), size * 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.font = `${Math.round(size * 7)}px system-ui, sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(String(g.score), X(COURT.w - 3), Y(COURT.h / 2 + 9));
  }

  /* --------------------------------------------------------------- the loop */
  function frame(now) {
    if (over) return;
    if (!last) last = now;
    carry += Math.min(now - last, MAX_CATCH_UP_MS);
    last = now;

    /*
     * WHOLE TICKS ONLY, and the remainder is carried rather than dropped.
     *
     * This is what makes a 120Hz phone and a tired 30Hz one play the identical
     * game — see the note at the top of `rally.js`. Advancing by the frame
     * delta instead would put two people on one leaderboard comparing their
     * handsets, which is the exact unfairness the seed exists to remove.
     */
    while (carry >= TICK_MS && !g.over) {
      carry -= TICK_MS;
      const event = tick(g);
      if (event === 'hit' || event === 'point') flash = now;
      // A tock off the bat, climbing with the rally, and the ricochet when you
      // actually get one past them — the noise marks the thing worth marking.
      if (event === 'hit') playPlink(Math.floor(g.rallies / 3));
      if (event === 'point') playRicochet();
      if (event === 'life') {
        flash = now;
        playLost();
        // Banked at each life, not only at the end — see the note at the top.
        onBank(g.score);
      }
      if (event === 'over') { onBank(g.score); end(); return; }
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
    canvas.removeEventListener('touchstart', onDown);
    canvas.removeEventListener('touchmove', onMove);
    canvas.removeEventListener('mousedown', onDown);
    canvas.removeEventListener('mousemove', onMove);
    window.removeEventListener('keydown', onKey);
  }

  return {
    /**
     * STOP EVERYTHING. Called when the phase leaves the lobby, and it must be
     * safe to call twice — the phone tears down on every state push, and a
     * game that had already ended would otherwise report a second score.
     */
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
