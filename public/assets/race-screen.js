/**
 * PUB PRIX ON THE PROJECTOR — every kart, on one track, sixty times a second.
 *
 * The server sends the race ONCE (who, which colour, the seed, when GO is) and
 * then only the taps, as `race` events, one per lane change — never a stream
 * of positions. This page runs `race-track.js` over those taps itself, so the
 * picture is smooth however quiet the wire is, and it is the SAME race the
 * server is deciding the winner of, because it is the same code.
 *
 * **IT DRAWS A LITTLE BEHIND THE SERVER — `DELAY_MS`.** A tap reaches the
 * projector a beat after it happens; drawing three tenths of a second behind
 * means it has nearly always arrived by the time its moment is drawn, so a
 * kart changes lane smoothly instead of jumping. A tap that is later still
 * rebuilds that one kart from the grid, which is cheap because karts never
 * touch each other.
 *
 * **THE GAME IS STOPPED ON EVERY CARD CHANGE** — `stopRace()`, called by
 * `draw()` in `screen.js` exactly where the break's advert cycle is stopped. A
 * frame loop nothing can reach is the big-photo fault this repo has already
 * had once.
 *
 * **NO PLAYER ID ANYWHERE (rule 3).** A kart is a number; the name beside it
 * is the one already on the scoreboard.
 */
import { esc, node } from './client.js';
import {
  courseFor, trackLayout, newKart, stepKart, standings, lapOf,
  LAPS, LAP, SPEED, BOOST, SLOW,
} from './race-track.js';

/** How far behind the server the picture is drawn. */
const DELAY_MS = 300;
/** How many rows the standings beside the track can hold and still be read. */
const BOARD_ROWS = 10;

let live = null;

export const raceKey = (s) => `race:${s.race.id}:${s.race.phase}`;

/** The card, either the race itself or, once it is over, the result. */
export function renderRace(s, now) {
  stopRace();
  if (s.race.phase === 'done') return renderResult(s);
  const wrap = node('<div class="race-stage"><canvas class="race-canvas" aria-label="Pub Prix — the race"></canvas></div>');
  const r = s.race;
  live = {
    id: r.id,
    startsAt: r.startsAt,
    now,
    course: courseFor(r.seed),
    layout: trackLayout(r.seed),
    karts: r.karts.map((k) => ({
      n: k.n,
      name: k.name,
      colour: k.colour,
      lane: k.lane,
      taps: (k.taps || []).slice(),
      sim: newKart(k.lane),
      vis: k.lane,
      grid: k.n,
    })),
    canvas: wrap.querySelector('canvas'),
    raf: null,
    last: 0,
    geo: null,
  };
  live.raf = requestAnimationFrame(frame);
  return wrap;
}

/** A state push while the same race is up — a reconnect may carry taps we missed. */
export function updateRace(s) {
  if (!live || !s.race || s.race.id !== live.id) return;
  for (const k of s.race.karts || []) {
    const mine = live.karts[k.n];
    if (!mine || !Array.isArray(k.taps) || k.taps.length <= mine.taps.length) continue;
    mine.taps = k.taps.slice();
    mine.sim = newKart(mine.lane);
  }
}

/** One tap, off the `race` event. */
export function raceTap(ev) {
  if (!live || !ev || ev.id !== live.id) return;
  const k = live.karts[ev.n];
  if (!k) return;
  const last = k.taps[k.taps.length - 1];
  if (last && last[0] === ev.at && last[1] === ev.lane) return;
  k.taps.push([ev.at, ev.lane]);
  k.taps.sort((a, b) => a[0] - b[0]);
  // Already drawn past that moment: rebuild this kart from the grid.
  if (k.sim.at !== null && ev.at <= k.sim.at) k.sim = newKart(k.lane);
}

export function stopRace() {
  if (live && live.raf) cancelAnimationFrame(live.raf);
  live = null;
}

// -------------------------------------------------------------- the picture

function frame(stamp) {
  if (!live) return;
  if (!live.canvas.isConnected) { live = null; return; }
  const dt = live.last ? Math.min(0.1, (stamp - live.last) / 1000) : 0;
  live.last = stamp;
  const t = live.now() - DELAY_MS;
  for (const k of live.karts) {
    stepKart(k.sim, live.course, k.taps, live.startsAt, t);
    // A lane change is drawn as a quick slide, never a jump.
    k.vis += (k.sim.lane - k.vis) * Math.min(1, dt * 12);
  }
  paint(t);
  live.raf = requestAnimationFrame(frame);
}

/** Where a kart is drawn, between two fixed steps, so it glides. */
function shownD(k, t) {
  const sim = k.sim;
  if (sim.finishedAt !== null || sim.startedAt === null || sim.at === null) return sim.d;
  const mult = sim.at < sim.slowUntil ? SLOW : sim.at < sim.boostUntil ? BOOST : 1;
  return sim.d + Math.max(0, Math.min(50, t - sim.at)) / 1000 * SPEED * mult;
}

function geometry(W, H) {
  const board = Math.max(220, Math.min(380, W * 0.26));
  const pad = Math.max(12, W * 0.02);
  const top = H * 0.04;
  const bottom = H * 0.09;
  const tw = W - board - pad * 3;
  const th = H - top - bottom;
  const laneW = Math.max(14, Math.min(tw, th) * 0.06);
  const half = laneW * 1.5 + laneW * 0.35;
  let R = (th - half * 2) / 2;
  let Ls = tw - 2 * R - half * 2;
  if (Ls < R * 0.6) { R = (tw - half * 2) / (2 + 0.6); Ls = R * 0.6; }
  return {
    W, H, board, pad, laneW, half, R, Ls,
    cx: pad + tw / 2,
    cy: top + th / 2,
    P: 2 * Ls + 2 * Math.PI * R,
    boardX: W - board - pad,
  };
}

/**
 * A point on the stadium: `s` along the centre line from the start (the middle
 * of the bottom straight, heading right), `off` out from it. Lane 0 — LEFT on
 * the phone — is the INSIDE, because the karts turn left.
 */
function pt(g, s, off) {
  const { Ls, R, cx, cy, P } = g;
  let u = ((s % P) + P) % P;
  const h = Ls / 2;
  let x; let y; let nx; let ny;
  if (u < h) { x = cx + u; y = cy + R; nx = 0; ny = 1; }
  else if ((u -= h) < Math.PI * R) { const a = u / R; x = cx + h + R * Math.sin(a); y = cy + R * Math.cos(a); nx = Math.sin(a); ny = Math.cos(a); }
  else if ((u -= Math.PI * R) < Ls) { x = cx + h - u; y = cy - R; nx = 0; ny = -1; }
  else if ((u -= Ls) < Math.PI * R) { const a = u / R; x = cx - h - R * Math.sin(a); y = cy - R * Math.cos(a); nx = -Math.sin(a); ny = -Math.cos(a); }
  else { u -= Math.PI * R; x = cx - h + u; y = cy + R; nx = 0; ny = 1; }
  return { x: x + nx * off, y: y + ny * off, nx, ny };
}

function strokeLoop(ctx, g, off) {
  ctx.beginPath();
  const n = 220;
  for (let i = 0; i <= n; i += 1) {
    const p = pt(g, (g.P * i) / n, off);
    if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
}

function paint(t) {
  const c = live.canvas;
  const dpr = window.devicePixelRatio || 1;
  const W = c.clientWidth; const H = c.clientHeight;
  if (!W || !H) return;
  if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) {
    c.width = Math.round(W * dpr);
    c.height = Math.round(H * dpr);
    live.geo = null;
  }
  if (!live.geo || live.geo.W !== W || live.geo.H !== H) live.geo = geometry(W, H);
  const g = live.geo;
  /*
   * THE JOIN CODE IS NEVER COVERED — the decisions table's rule for a big
   * photo, and the same for the race. The corner sits over the top right, so
   * the running order starts underneath it. Measured, never written out: the
   * corner is there on some phases and not others.
   */
  const corner = document.getElementById('joinCorner');
  let boardTop = H * 0.04;
  if (corner && corner.offsetParent) {
    const cr = corner.getBoundingClientRect(); const me = c.getBoundingClientRect();
    if (cr.left - me.left < W && cr.bottom > me.top) boardTop = Math.max(boardTop, cr.bottom - me.top + 12);
  }
  const ctx = c.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const font = getComputedStyle(document.body).fontFamily || 'sans-serif';

  // The tarmac, its kerbs and the lane lines.
  ctx.lineJoin = 'round';
  strokeLoop(ctx, g, 0);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.lineWidth = g.half * 2 + 6;
  ctx.stroke();
  ctx.strokeStyle = '#23232d';
  ctx.lineWidth = g.half * 2;
  ctx.stroke();
  ctx.setLineDash([g.laneW * 0.5, g.laneW * 0.5]);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.lineWidth = 2;
  for (const off of [-g.laneW / 2, g.laneW / 2]) { strokeLoop(ctx, g, off); ctx.stroke(); }
  ctx.setLineDash([]);

  // The chequered line.
  const sq = g.half / 3;
  for (let row = 0; row < 6; row += 1) {
    for (let col = 0; col < 2; col += 1) {
      const p = pt(g, col * sq, -g.half + row * sq + sq / 2);
      ctx.fillStyle = (row + col) % 2 ? '#0b0b12' : '#f4f4f4';
      ctx.fillRect(p.x - sq / 2, p.y - sq / 2, sq, sq);
    }
  }

  // What is on the track: spilt pints and boosts, the same every lap.
  for (const it of live.layout) {
    const p = pt(g, (it.p / LAP) * g.P, (it.lane - 1) * g.laneW);
    if (it.kind === 'spill') {
      ctx.fillStyle = 'rgba(214, 150, 40, 0.92)';
      ctx.beginPath(); ctx.ellipse(p.x, p.y, g.laneW * 0.4, g.laneW * 0.3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(250, 236, 196, 0.85)';
      ctx.beginPath(); ctx.ellipse(p.x - g.laneW * 0.1, p.y - g.laneW * 0.08, g.laneW * 0.14, g.laneW * 0.09, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      const tx = p.ny; const ty = -p.nx; // along the track, the way it is driven
      ctx.strokeStyle = '#2fe07a';
      ctx.lineWidth = Math.max(2, g.laneW * 0.12);
      for (const back of [0, g.laneW * 0.28]) {
        const bx = p.x - tx * back; const by = p.y - ty * back;
        ctx.beginPath();
        ctx.moveTo(bx - tx * g.laneW * 0.18 + p.nx * g.laneW * 0.22, by - ty * g.laneW * 0.18 + p.ny * g.laneW * 0.22);
        ctx.lineTo(bx + tx * g.laneW * 0.1, by + ty * g.laneW * 0.1);
        ctx.lineTo(bx - tx * g.laneW * 0.18 - p.nx * g.laneW * 0.22, by - ty * g.laneW * 0.18 - p.ny * g.laneW * 0.22);
        ctx.stroke();
      }
    }
  }

  // The order, from the same code the server decides the winner with.
  const rows = live.karts.map((k) => ({ ...k, kart: k.sim, tie: k.n }));
  const order = standings(rows);
  const leader = order.find((x) => x.kart.startedAt !== null);

  /*
   * The karts. **TWO KARTS IN ONE PLACE ARE DRAWN NOSE TO TAIL, NEVER ON TOP
   * OF EACH OTHER** — every kart that tapped in the countdown leaves the line
   * together, so a lane of ten is one dot and nobody can find their own. Each
   * lane is laid out front to back, and a kart too close to the one ahead of
   * it is drawn just behind it: a pack, in the right order, every number
   * readable. The board beside the track has the exact order.
   */
  const kr = g.laneW * 0.42;
  const gap = kr * 2.15;
  const placedAt = new Map();
  const drawn = live.karts
    .map((k) => {
      const onGrid = k.sim.startedAt === null;
      // A kart still on the grid waits BEHIND the line, three abreast.
      const s = onGrid ? -(Math.floor(k.grid / 3) + 1) * kr * 2.4 : (shownD(k, t) / LAP) * g.P;
      return { k, onGrid, s, d: onGrid ? -1 : k.sim.d };
    })
    .sort((a, b) => b.d - a.d || a.k.n - b.k.n);
  for (const x of drawn) {
    if (x.onGrid) continue;
    const lane = Math.round(x.k.vis);
    const ahead = placedAt.get(lane);
    if (ahead !== undefined && ahead - x.s < gap) x.s = ahead - gap;
    placedAt.set(lane, x.s);
  }
  for (const { k, onGrid, s } of drawn.reverse()) {
    const p = pt(g, s, (k.vis - 1) * g.laneW);
    const boosting = !onGrid && k.sim.at !== null && k.sim.at < k.sim.boostUntil;
    const slowed = !onGrid && k.sim.at !== null && k.sim.at < k.sim.slowUntil;
    if (boosting) { ctx.fillStyle = 'rgba(47, 224, 122, 0.35)'; ctx.beginPath(); ctx.arc(p.x, p.y, kr * 1.6, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = onGrid ? 0.55 : 1;
    ctx.fillStyle = k.colour;
    ctx.beginPath(); ctx.arc(p.x, p.y, kr, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = leader && leader.n === k.n ? 3 : 2;
    ctx.strokeStyle = leader && leader.n === k.n ? '#ffd23f' : slowed ? 'rgba(214, 150, 40, 1)' : '#0b0b12';
    ctx.stroke();
    ctx.fillStyle = '#0b0b12';
    ctx.font = `800 ${Math.round(kr * 1.05)}px ${font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(k.n + 1), p.x, p.y + 1);
    ctx.globalAlpha = 1;
  }

  // The board beside the track.
  const bx = g.boardX; const by = boardTop; const bw = g.board; const bh = g.H * 0.96 - boardTop;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
  roundRect(ctx, bx, by, bw, bh, 14); ctx.fill();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 ${Math.round(g.H * 0.06)}px ${font}`;
  ctx.fillText('PUB PRIX', bx + 18, by + g.H * 0.08);
  const lap = leader ? lapOf(leader.kart.d) : 1;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.font = `700 ${Math.round(g.H * 0.032)}px ${font}`;
  ctx.fillText(leader && leader.kart.finishedAt !== null ? 'Chequered flag' : `Lap ${lap} of ${LAPS}`, bx + 18, by + g.H * 0.125);
  // Room for the "+ N more" line INSIDE the panel, when there is one.
  const more = order.length > BOARD_ROWS;
  const rowH = Math.min(g.H * 0.068, (bh - g.H * 0.18) / (BOARD_ROWS + (more ? 1 : 0)));
  order.slice(0, BOARD_ROWS).forEach((x, i) => {
    const y = by + g.H * 0.17 + i * rowH + rowH * 0.62;
    ctx.globalAlpha = x.kart.startedAt === null ? 0.5 : 1;
    ctx.fillStyle = i === 0 && x.kart.startedAt !== null ? '#ffd23f' : 'rgba(255, 255, 255, 0.85)';
    ctx.font = `800 ${Math.round(rowH * 0.48)}px ${font}`;
    ctx.fillText(String(i + 1), bx + 16, y);
    ctx.fillStyle = x.colour;
    ctx.beginPath(); ctx.arc(bx + 16 + rowH * 0.85, y - rowH * 0.17, rowH * 0.24, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${Math.round(rowH * 0.44)}px ${font}`;
    const name = fit(ctx, `${x.n + 1} · ${x.name}`, bw - rowH * 1.4 - 70);
    ctx.fillText(name, bx + 16 + rowH * 1.25, y);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.textAlign = 'right';
    ctx.font = `600 ${Math.round(rowH * 0.38)}px ${font}`;
    const tail = x.kart.finishedAt !== null ? `${((x.kart.finishedAt - live.startsAt) / 1000).toFixed(1)}s`
      : x.kart.startedAt === null ? 'grid' : `lap ${lapOf(x.kart.d)}`;
    ctx.fillText(tail, bx + bw - 14, y);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  });
  if (more) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.font = `600 ${Math.round(rowH * 0.36)}px ${font}`;
    ctx.fillText(`+ ${order.length - BOARD_ROWS} more`, bx + 16, by + g.H * 0.17 + BOARD_ROWS * rowH + rowH * 0.5);
  }

  // The countdown, and GO.
  const tw = g.cx;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (t < live.startsAt) {
    const n = Math.ceil((live.startsAt - t) / 1000);
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${Math.round(g.H * 0.26)}px ${font}`;
    ctx.fillText(String(n), tw, g.cy - g.H * 0.03);
    ctx.font = `700 ${Math.round(g.H * 0.04)}px ${font}`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillText('Tap a lane on your phone to start your engine', tw, g.cy + g.H * 0.13);
  } else if (t - live.startsAt < 1200) {
    ctx.fillStyle = '#2fe07a';
    ctx.font = `900 ${Math.round(g.H * 0.22)}px ${font}`;
    ctx.fillText('GO!', tw, g.cy);
  } else {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = `600 ${Math.round(g.H * 0.034)}px ${font}`;
    ctx.fillText(leader && leader.kart.finishedAt !== null
      ? `${leader.name} is home first`
      : 'Dodge the spilt pints · hit the green boosts', tw, g.cy);
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fit(ctx, text, width) {
  if (ctx.measureText(text).width <= width) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > width) s = s.slice(0, -1);
  return `${s}…`;
}

/**
 * The result: the winner in gold, second and third as a PODIUM, never a
 * caption (the decisions table). The code is never here — it is on the
 * winner's phone and nowhere else a room can read.
 */
function renderResult(s) {
  const r = s.race;
  const results = r.results || [];
  if (!r.winner) {
    return node(`
      <div class="winner race-result">
        <div class="kicker">Pub Prix</div>
        <h1 class="grad-text">No winner</h1>
        <div class="score">Nobody started their engine.</div>
      </div>`);
  }
  const first = results.find((x) => x.index === r.winner.index);
  const runners = results.filter((x) => x.index !== r.winner.index && x.started).slice(0, 2);
  const time = (x) => (x && x.time !== null && x.time !== undefined ? `${x.time.toFixed(1)}s` : `lap ${x ? x.lap : ''}`);
  return node(`
    <div class="winner race-result">
      <div class="kicker">Pub Prix winner</div>
      <h1 class="grad-text">${esc(r.winner.name)}</h1>
      <div class="score">${first && first.time !== null ? `${first.time.toFixed(1)} seconds` : 'In front when the flag came down'}</div>
      ${runners.length ? `<div class="runners">${runners.map((x, i) => `
        <div class="runner place-${i + 2}">
          <span class="rplace">${i + 2}</span>
          <span class="rname">${esc(x.name)}</span>
          <span class="rscore">${esc(time(x))}</span>
        </div>`).join('')}</div>` : ''}
    </div>`);
}
