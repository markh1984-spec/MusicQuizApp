/**
 * TAILBACK — running.
 *
 * The rules are in `tailback.js` so a test can play a whole game without a
 * browser; this is the part that needs a canvas. Same `startGame(canvas, …)`
 * as the other two, so `lobby-menu.js` chooses between all three with one
 * line each and nothing else.
 *
 * ---
 *
 * **IT IS GRID-BASED, so there is no timestep to get wrong.** Everything moves
 * one cell per `STEP_MS` off the frame's own timestamp, exactly as Maze Mouth
 * does — a 30Hz phone and a 120Hz one take the same steps at the same moments.
 * Rally needed a whole accumulator to reach the same place because a ball is
 * continuous; this does not, and that is a reason to prefer grid games for
 * this slot rather than an accident.
 *
 * **IT STOPS THE INSTANT THE NIGHT DOES ANYTHING**, and one score leaves the
 * phone — at game over and at each life lost. See `lobby-menu.js`.
 */

import { COLS, ROWS, STEP_MS, newGame, step, aim, inField } from './tailback.js';

const HEAD = '#ffd23f';           // gold, like everything that is yours here
const TAIL = 'rgba(255,210,63,0.55)';
const FOOD = '#ff2e88';
const GRID = 'rgba(120,110,220,0.16)';

export function startGame(canvas, { onEnd = () => {}, onBank = () => {}, seed = 1 } = {}) {
  const ctx = canvas.getContext('2d');
  const g = newGame(seed);
  let raf = 0;
  let over = false;
  let last = 0;
  let flash = 0;

  /* ------------------------------------------------------------- the thumb */
  /*
   * TAP WHERE YOU WANT TO GO — the maze's control, and the right one here for
   * the same reason: a swipe has to be READ, and a misread swipe costs a life.
   *
   * Canvas pixels are not CSS pixels — it is drawn at device resolution so the
   * field is not fuzzy, so a touch has to be scaled before it means a cell.
   * Getting this sum wrong sends the head to the wrong end of the field on
   * exactly the phones the game is for.
   */
  /**
   * WHERE THE FIELD SITS, worked out ONCE and used by both the drawing and the
   * thumb.
   *
   * It was computed separately in each, which is how the two drift — and the
   * bug that found it was worse than drift: the field filled the canvas edge to
   * edge, so `offY` was zero, and **the lives, the score and the "Tap to go"
   * prompt were all drawn outside the canvas buffer and never appeared at
   * all.** Nothing threw, the game played perfectly, and the only sign was that
   * a player had no idea how many lives they had.
   *
   * So the bands are reserved FIRST and the cells are sized into what is left.
   */
  const layout = () => {
    const top = canvas.height * 0.085;
    const bottom = canvas.height * 0.085;
    const size = Math.min(canvas.width / COLS, (canvas.height - top - bottom) / ROWS);
    return {
      size,
      offX: (canvas.width - size * COLS) / 2,
      offY: top + ((canvas.height - top - bottom) - size * ROWS) / 2,
    };
  };

  const point = (ev) => {
    const t = ev.touches ? ev.touches[0] : ev;
    if (!t) return;
    const box = canvas.getBoundingClientRect();
    const { size, offX, offY } = layout();
    const px = (t.clientX - box.left) * (canvas.width / box.width);
    const py = (t.clientY - box.top) * (canvas.height / box.height);
    aim(g, Math.floor((px - offX) / size), Math.floor((py - offY) / size));
  };
  const onDown = (ev) => point(ev);
  const onMove = (ev) => { if (ev.buttons || ev.touches) point(ev); };
  const onKey = (ev) => {
    // Arrows still work, and cost nothing — the console is driven from a
    // laptop and somebody will try the keys. One press aims as far that way as
    // the field goes, so it is a move rather than a nudge.
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[ev.key];
    if (!d) return;
    ev.preventDefault();
    let { col, row } = g.body[0];
    while (inField(col + d[0], row + d[1])) { col += d[0]; row += d[1]; }
    aim(g, col, row);
  };
  canvas.addEventListener('touchstart', onDown, { passive: true });
  canvas.addEventListener('touchmove', onMove, { passive: true });
  canvas.addEventListener('mousedown', onDown);
  canvas.addEventListener('mousemove', onMove);
  window.addEventListener('keydown', onKey);

  /* ------------------------------------------------------------ the drawing */
  function draw(now) {
    const { size, offX, offY } = layout();
    const X = (c) => offX + c * size;
    const Y = (r) => offY + r * size;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // A faint grid. Without it a tail on a plain field is hard to count, and
    // counting the gap you are about to fit through IS the game.
    ctx.strokeStyle = GRID;
    ctx.lineWidth = Math.max(1, size * 0.04);
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath(); ctx.moveTo(X(c), Y(0)); ctx.lineTo(X(c), Y(ROWS)); ctx.stroke();
    }
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath(); ctx.moveTo(X(0), Y(r)); ctx.lineTo(X(COLS), Y(r)); ctx.stroke();
    }

    if (g.pellet) {
      ctx.fillStyle = FOOD;
      ctx.beginPath();
      ctx.arc(X(g.pellet.col) + size / 2, Y(g.pellet.row) + size / 2, size * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    /*
     * THE TAIL FADES TOWARDS THE END, which is not decoration: the end of the
     * tail is the cell that is about to be free, and telling it from the rest
     * is exactly the judgement the game asks for. A tail in one flat colour
     * makes every gap look like a wall.
     */
    for (let i = g.body.length - 1; i >= 0; i--) {
      const p = g.body[i];
      ctx.fillStyle = i === 0 ? HEAD : TAIL;
      if (i > 0) ctx.globalAlpha = 0.45 + 0.55 * (1 - i / g.body.length);
      const pad = size * (i === 0 ? 0.06 : 0.14);
      ctx.beginPath();
      ctx.roundRect(X(p.col) + pad, Y(p.row) + pad, size - pad * 2, size - pad * 2, size * 0.28);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Where you last tapped, until it is reached — so a tap that landed is
    // visibly a tap that landed, on a phone where your thumb was over it.
    if (g.target) {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = Math.max(1, size * 0.08);
      ctx.beginPath();
      ctx.roundRect(X(g.target.col) + size * 0.2, Y(g.target.row) + size * 0.2,
        size * 0.6, size * 0.6, size * 0.2);
      ctx.stroke();
    }

    if (now - flash < 200) {
      ctx.globalAlpha = (1 - (now - flash) / 200) * 0.5;
      ctx.fillStyle = FOOD;
      ctx.fillRect(offX, offY, size * COLS, size * ROWS);
      ctx.globalAlpha = 1;
    }

    // Lives as pips and the score, in the margin above the field — read at a
    // glance while the tail is moving, which "2" has to be converted to be.
    ctx.fillStyle = HEAD;
    for (let i = 0; i < g.lives; i++) {
      ctx.beginPath();
      ctx.arc(X(0) + size * (0.4 + i * 0.7), offY - size * 0.45, size * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.font = `${Math.round(size * 0.62)}px system-ui, sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(String(g.score), X(COLS), offY - size * 0.25);

    /*
     * "TAP TO GO" while it is waiting — the one instruction the game needs,
     * and it is on the game rather than under it, because somebody looking at
     * a field that is not moving is looking at the field.
     */
    if (g.waiting) {
      ctx.textAlign = 'center';
      ctx.font = `${Math.round(size * 0.7)}px system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText('Tap to go', X(COLS / 2), Y(ROWS) + size * 0.9);
    }
  }

  /* --------------------------------------------------------------- the loop */
  function frame(now) {
    if (over) return;
    if (now - last >= STEP_MS) {
      last = now;
      const event = step(g);
      if (event === 'eat') flash = now;
      if (event === 'life') { flash = now; onBank(g.score); }
      if (event === 'over' || event === 'won') { onBank(g.score); end(event === 'won'); return; }
    }
    draw(now);
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  function end(won) {
    if (over) return;
    over = true;
    cancelAnimationFrame(raf);
    detach();
    onEnd({ score: g.score, won });
  }

  function detach() {
    canvas.removeEventListener('touchstart', onDown);
    canvas.removeEventListener('touchmove', onMove);
    canvas.removeEventListener('mousedown', onDown);
    canvas.removeEventListener('mousemove', onMove);
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
