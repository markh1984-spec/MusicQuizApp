/**
 * PUB PRIX ON THE PROJECTOR — every kart, on one track, sixty times a second.
 *
 * The server sends the race ONCE (who, which colour, the seed, when GO is) and
 * then only the steering, as `race` events, one per change — never a stream
 * of positions. This page runs `race-track.js` over those taps itself, so the
 * picture is smooth however quiet the wire is, and it is the SAME race the
 * server is deciding the winner of, because it is the same code.
 *
 * **IT DRAWS A LITTLE BEHIND THE SERVER — `DELAY_MS`.** A tap reaches the
 * projector a beat after it happens; drawing three tenths of a second behind
 * means it has nearly always arrived by the time its moment is drawn, so a
 * kart turns smoothly instead of jumping. A steer that is later still
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
import { faceFor } from './avatar.js';
import {
  courseFor, trackLayout, newKart, stepKart, standings, lapOf,
  speedOf, LAPS, LAP, SPEED, HALF, WALL, BENDS,
} from './race-track.js';

/** How far behind the server the picture is drawn. */
const DELAY_MS = 300;
/** How many rows the standings beside the track can hold and still be read. */
const BOARD_ROWS = 10;

let live = null;

/*
 * THE FACES — each driver's own photograph from tonight, or the drawn face
 * when they sent none (`faceFor()`, matched on `faceKey`, never the name).
 * Loaded once per address and kept, so sixty karts at sixty frames a second
 * never ask the network twice. The photographs ride on this same payload and
 * the kill switch empties them, so a stopped camera puts the drawn faces back.
 */
const faces = new Map();
function faceImage(k) {
  const url = faceFor(live.photos, { faceKey: k.face || '', name: k.name });
  let img = faces.get(url);
  if (!img) {
    img = new Image();
    img.decoding = 'async';
    img.src = url;
    faces.set(url, img);
  }
  return img.complete && img.naturalWidth ? img : null;
}

/*
 * A CARD KEY IS A FINGERPRINT OF WHAT IT DRAWS (rule 9). On the GRID that is
 * who is on it — a phone joining puts a kart on the line — so the names are
 * in the key there; once racing, the karts are fixed and taps come as events.
 */
export const raceKey = (s) => `race:${s.race.id}:${s.race.phase}${
  s.race.phase === 'grid' ? `:${(s.race.karts || []).map((k) => `${k.n}.${k.name}`).join('\u0001')}:${s.race.over ? 1 : 0}` : ''}`;

/** The card, either the race itself or, once it is over, the result. */
export function renderRace(s, now) {
  stopRace();
  if (s.race.phase === 'done') return renderResult(s);
  const wrap = node('<div class="race-stage"><canvas class="race-canvas" aria-label="Pub Prix — the race"></canvas></div>');
  const r = s.race;
  live = {
    id: r.id,
    startsAt: r.startsAt,
    // THE GRID — a Pub Prix part before the lights: nobody moves, nobody counts.
    grid: r.phase === 'grid',
    over: Boolean(r.over),
    photos: s.photos || [],
    now,
    course: courseFor(r.seed),
    layout: trackLayout(r.seed),
    karts: r.karts.map((k) => ({
      n: k.n,
      name: k.name,
      face: k.face || '',
      colour: k.colour,
      lane: k.lane,
      taps: (k.taps || []).slice(),
      sim: newKart(k.lane),
      vis: k.lane - 1,
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
  // A photograph sent since the race went up becomes that driver's face.
  live.photos = s.photos || [];
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
  if (last && last[0] === ev.at && last[1] === ev.steer) return;
  k.taps.push([ev.at, ev.steer]);
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
    if (live.grid) continue;
    stepKart(k.sim, live.course, k.taps, live.startsAt, t);
    // Drawn a touch behind the physics, so a turn glides rather than steps.
    k.vis += (k.sim.x - k.vis) * Math.min(1, dt * 16);
  }
  paint(t);
  live.raf = requestAnimationFrame(frame);
}

/** Where a kart is drawn, between two fixed steps, so it glides. */
function shownD(k, t) {
  const sim = k.sim;
  if (sim.finishedAt !== null || sim.startedAt === null || sim.at === null) return sim.d;
  return sim.d + Math.max(0, Math.min(50, t - sim.at)) / 1000 * SPEED * speedOf(sim, sim.at);
}

function geometry(W, H) {
  const board = Math.max(220, Math.min(380, W * 0.26));
  const pad = Math.max(12, W * 0.02);
  const top = H * 0.04;
  const bottom = H * 0.09;
  const tw = W - board - pad * 3;
  const th = H - top - bottom;
  // Wide enough that a driver's FACE reads from the back of the room.
  const laneW = Math.max(14, Math.min(tw, th) * 0.068);
  // The whole road, wall to wall: tarmac to ±HALF, grass to ±WALL.
  const half = laneW * WALL + laneW * 0.12;
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
 * A point on the stadium, `p` being where on the LAP (track units) and `off`
 * how far out from the centre line. **THE TURNS ARE THE PHYSICS' OWN** —
 * `BENDS` in `race-track.js` — so the stretch the phone pushes you wide on is
 * the stretch drawn as a bend here, whatever shape the projector is. The lap
 * starts mid-way along the bottom straight, heading right; `off` is OUTWARD,
 * so the inside of the turn (left on the phone) is negative.
 */
function pt(g, p, off) {
  const { Ls, R, cx, cy } = g;
  const h = Ls / 2;
  const [[a1, b1], [a2, b2]] = BENDS;
  const u = ((p % LAP) + LAP) % LAP;
  let x; let y; let nx; let ny;
  if (u < a1) { x = cx + (u / a1) * h; y = cy + R; nx = 0; ny = 1; }
  else if (u <= b1) { const a = ((u - a1) / (b1 - a1)) * Math.PI; x = cx + h + R * Math.sin(a); y = cy + R * Math.cos(a); nx = Math.sin(a); ny = Math.cos(a); }
  else if (u < a2) { x = cx + h - ((u - b1) / (a2 - b1)) * Ls; y = cy - R; nx = 0; ny = -1; }
  else if (u <= b2) { const a = ((u - a2) / (b2 - a2)) * Math.PI; x = cx - h - R * Math.sin(a); y = cy - R * Math.cos(a); nx = -Math.sin(a); ny = -Math.cos(a); }
  else { x = cx - h + ((u - b2) / (LAP - b2)) * h; y = cy + R; nx = 0; ny = 1; }
  return { x: x + nx * off, y: y + ny * off, nx, ny };
}

/** Pixels, measured along the start straight, as track units. */
const alongPx = (g, px) => (px * BENDS[0][0]) / (g.Ls / 2 || 1);

function strokeLoop(ctx, g, off) {
  ctx.beginPath();
  const n = 240;
  for (let i = 0; i <= n; i += 1) {
    const q = pt(g, (LAP * i) / n, off);
    if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
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

  // The grass to the wall, the tarmac, its kerbs and the lane lines.
  ctx.lineJoin = 'round';
  strokeLoop(ctx, g, 0);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.lineWidth = g.half * 2 + 6;
  ctx.stroke();
  ctx.strokeStyle = '#1c3a24';
  ctx.lineWidth = g.half * 2;
  ctx.stroke();
  ctx.strokeStyle = '#23232d';
  ctx.lineWidth = HALF * 2 * g.laneW;
  ctx.stroke();
  ctx.lineWidth = Math.max(2, g.laneW * 0.12);
  ctx.setLineDash([g.laneW * 0.4, g.laneW * 0.4]);
  for (const [colour, shift] of [['#e5484d', 0], ['#f4f4f4', g.laneW * 0.4]]) {
    ctx.strokeStyle = colour;
    ctx.lineDashOffset = shift;
    for (const off of [-HALF * g.laneW, HALF * g.laneW]) { strokeLoop(ctx, g, off); ctx.stroke(); }
  }
  ctx.lineDashOffset = 0;
  ctx.setLineDash([g.laneW * 0.5, g.laneW * 0.5]);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 2;
  for (const off of [-g.laneW / 2, g.laneW / 2]) { strokeLoop(ctx, g, off); ctx.stroke(); }
  ctx.setLineDash([]);

  // The chequered line.
  const sq = (HALF * 2 * g.laneW) / 6;
  for (let row = 0; row < 6; row += 1) {
    for (let col = 0; col < 2; col += 1) {
      const p = pt(g, alongPx(g, col * sq), -HALF * g.laneW + row * sq + sq / 2);
      ctx.fillStyle = (row + col) % 2 ? '#0b0b12' : '#f4f4f4';
      ctx.fillRect(p.x - sq / 2, p.y - sq / 2, sq, sq);
    }
  }

  // What is on the track: spilt pints and boosts, the same every lap.
  for (const it of live.layout) {
    const p = pt(g, it.p, (it.lane - 1) * g.laneW);
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
  const kr = g.laneW * 0.46;
  // Nose to tail, in TRACK units — a kart's length is pixels on the screen.
  const gap = (kr * 2.9) / (g.P / LAP);
  const placedAt = new Map();
  const drawn = live.karts
    .map((k) => {
      const onGrid = k.sim.startedAt === null;
      // A kart still on the grid waits BEHIND the line, three abreast.
      const s = onGrid ? -alongPx(g, (Math.floor(k.grid / 3) + 1) * kr * 3) : shownD(k, t);
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
    const p = pt(g, s, k.vis * g.laneW);
    const boosting = !onGrid && k.sim.at !== null && k.sim.at < k.sim.boostUntil;
    const slowed = !onGrid && k.sim.at !== null && k.sim.at < k.sim.slowUntil;
    const leads = leader && leader.n === k.n;
    if (boosting) { ctx.fillStyle = 'rgba(47, 224, 122, 0.35)'; ctx.beginPath(); ctx.arc(p.x, p.y, kr * 1.9, 0, Math.PI * 2); ctx.fill(); }
    // On the GRID of a Pub Prix part everybody is waiting, so nobody is dimmed;
    // mid-race a kart still on the line is, because it has not started.
    ctx.globalAlpha = onGrid && !live.grid ? 0.55 : 1;
    drawKart(ctx, p, kr, k, { leads, slowed, font });
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
  ctx.fillText(live.grid ? 'Waiting for the lights' : leader && leader.kart.finishedAt !== null ? 'Chequered flag' : `Lap ${lap} of ${LAPS}`, bx + 18, by + g.H * 0.125);
  // Room for the "+ N more" line INSIDE the panel, when there is one.
  const more = order.length > BOARD_ROWS;
  const rowH = Math.min(g.H * 0.068, (bh - g.H * 0.18) / (BOARD_ROWS + (more ? 1 : 0)));
  order.slice(0, BOARD_ROWS).forEach((x, i) => {
    const y = by + g.H * 0.17 + i * rowH + rowH * 0.62;
    ctx.globalAlpha = x.kart.startedAt === null ? 0.5 : 1;
    ctx.fillStyle = i === 0 && x.kart.startedAt !== null ? '#ffd23f' : 'rgba(255, 255, 255, 0.85)';
    ctx.font = `800 ${Math.round(rowH * 0.48)}px ${font}`;
    ctx.fillText(String(i + 1), bx + 16, y);
    face(ctx, x, bx + 16 + rowH * 1.05, y - rowH * 0.17, rowH * 0.32, Math.max(2, rowH * 0.07));
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${Math.round(rowH * 0.44)}px ${font}`;
    const name = fit(ctx, `${x.n + 1} · ${x.name}`, bw - rowH * 1.6 - 70);
    ctx.fillText(name, bx + 16 + rowH * 1.5, y);
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
  if (live.grid) {
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${Math.round(g.H * 0.075)}px ${font}`;
    ctx.fillText(live.over ? 'That’s Pub Prix' : 'Get ready to race', tw, g.cy - g.H * 0.05);
    ctx.font = `700 ${Math.round(g.H * 0.036)}px ${font}`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    if (!live.over) {
      ctx.fillText(`${live.karts.length} kart${live.karts.length === 1 ? '' : 's'} · join now to race`, tw, g.cy + g.H * 0.03);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.font = `600 ${Math.round(g.H * 0.03)}px ${font}`;
      ctx.fillText('Take a selfie on your phone and it drives your kart', tw, g.cy + g.H * 0.085);
    }
  } else if (t < live.startsAt) {
    const n = Math.ceil((live.startsAt - t) / 1000);
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${Math.round(g.H * 0.26)}px ${font}`;
    ctx.fillText(String(n), tw, g.cy - g.H * 0.03);
    ctx.font = `700 ${Math.round(g.H * 0.04)}px ${font}`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillText('Hold left or right on your phone to start your engine', tw, g.cy + g.H * 0.13);
  } else if (t - live.startsAt < 1200) {
    ctx.fillStyle = '#2fe07a';
    ctx.font = `900 ${Math.round(g.H * 0.22)}px ${font}`;
    ctx.fillText('GO!', tw, g.cy);
  } else {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = `600 ${Math.round(g.H * 0.034)}px ${font}`;
    ctx.fillText(leader && leader.kart.finishedAt !== null
      ? `${leader.name} is home first`
      : 'Hold the bends · dodge the pints', tw, g.cy);
  }
}

/**
 * ONE KART: a chassis in its colour, pointing the way the track runs, with the
 * driver's FACE on it — their own photograph from tonight, or the drawn one.
 * The number stays on the nose, because it is what the phone calls them.
 */
function drawKart(ctx, p, kr, k, { leads, slowed, font }) {
  const tx = p.ny; const ty = -p.nx; // along the track, the way it is driven
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(Math.atan2(ty, tx));
  // Wheels, then the body over them.
  ctx.fillStyle = '#0b0b12';
  for (const wx of [-0.75, 0.8]) for (const wy of [-0.78, 0.78]) {
    roundRect(ctx, (wx - 0.28) * kr, (wy - 0.16) * kr, 0.56 * kr, 0.32 * kr, 0.12 * kr); ctx.fill();
  }
  ctx.fillStyle = k.colour;
  roundRect(ctx, -1.3 * kr, -0.66 * kr, 2.6 * kr, 1.32 * kr, 0.5 * kr); ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = slowed ? 'rgba(214, 150, 40, 1)' : '#0b0b12';
  ctx.stroke();
  ctx.restore();
  // The driver sits just behind the middle; the number rides on the nose.
  const hx = p.x - tx * kr * 0.25; const hy = p.y - ty * kr * 0.25;
  face(ctx, k, hx, hy, kr * 0.92, leads ? 3 : 2, leads ? '#ffd23f' : '#ffffff');
  const nx = p.x + tx * kr * 1.05; const ny = p.y + ty * kr * 1.05;
  ctx.fillStyle = '#0b0b12';
  ctx.font = `800 ${Math.round(kr * 0.62)}px ${font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(k.n + 1), nx, ny + 1);
}

/** A driver's face in a circle, ringed — on a kart and on the board. */
function face(ctx, k, x, y, r, ring, ringColour = k.colour) {
  const img = faceImage(k);
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.closePath();
  ctx.fillStyle = k.colour;
  ctx.fill();
  if (img) {
    ctx.clip();
    // Cover the circle, centred — a photograph is rarely square.
    const sc = Math.max((r * 2) / img.naturalWidth, (r * 2) / img.naturalHeight);
    const w = img.naturalWidth * sc; const h = img.naturalHeight * sc;
    ctx.drawImage(img, x - w / 2, y - h / 2, w, h);
  }
  ctx.restore();
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.lineWidth = ring;
  ctx.strokeStyle = ringColour;
  ctx.stroke();
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
  const kart = (r.karts || [])[r.winner.index] || {};
  const photo = faceFor(s.photos || [], { faceKey: kart.face || '', name: r.winner.name });
  const runners = results.filter((x) => x.index !== r.winner.index && x.started).slice(0, 2);
  const time = (x) => (x && x.time !== null && x.time !== undefined ? `${x.time.toFixed(1)}s` : `lap ${x ? x.lap : ''}`);
  return node(`
    <div class="winner race-result">
      <div class="kicker">Pub Prix winner</div>
      <img class="race-winner-face" src="${esc(photo)}" alt="" style="--kart:${esc(kart.colour || '#ffd23f')}">
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
