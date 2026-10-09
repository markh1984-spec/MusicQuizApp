/**
 * PUB PRIX ON A PHONE — your own kart, the road ahead, and a wheel to hold.
 *
 * **HOLD TO STEER — the road IS the control.** A thumb on the left half turns
 * left, on the right half turns right, nothing held drives straight. No
 * buttons to find in a dark pub: the whole screen is the wheel. It used to be
 * three lanes to tap; the host asked for real steering, *"its meant to be
 * hard"*, and the bends and the grass are what make it so.
 *
 * **IT RUNS THE SAME RACE THE SERVER DOES** — `race-track.js`, over this
 * kart's own taps — so the road scrolls smoothly however quiet the wire is.
 *
 * **AND IT DRAWS ITSELF A LITTLE AHEAD OF THE SERVER — `lead`.** The server
 * stamps a tap when it ARRIVES (rule 2), a beat after the thumb went down. So
 * the phone shows the road as it will be when the tap lands — half the round
 * trip ahead, measured off every tap — and a dodge that looks just in time on
 * the phone is just in time on the server. The tap is drawn at once, and put
 * right when the server's own time for it comes back.
 *
 * **IT TAKES THE WHOLE SCREEN ONLY WHILE THE RACE IS ON.** Once it is over the
 * phone goes back to whatever the night was showing, with one card saying how
 * it went (`raceResultCard()`) — and a drink, if it was won, in My prizes,
 * where every other drink lives.
 *
 * A LEAF: `play.js` and `play-bingo.js` both import it, and **a page module may
 * not be imported by another page**.
 */
import { esc, postJson, node, ordinal, roomCode } from './client.js';
import {
  courseFor, newKart, stepKart, lapOf, bendAt, onGrass, speedOf, tiltAmount, tiltToSteer,
  LAPS, LAP, SPEED, MIN_TAP_MS, HALF, WALL,
} from './race-track.js';

/** How much road is on the screen, ahead of the kart — about three seconds. */
const VIEW = 170;
const LEAD_START = 120;
const LEAD_MAX = 350;

let live = null;

/*
 * ============================================================ TILT TO STEER
 *
 * Tip the phone and the kart turns — `tiltAmount()` in `race-track.js`. A
 * thumb on the screen still wins, so holding is the backup and never fights
 * the tilt.
 *
 * **ONE LISTENER FOR THE WHOLE PAGE**, kept across races (it only records the
 * angle), and module state rather than the race's, because an iPhone's
 * permission is asked ONCE and is good until the page is reloaded.
 *
 * **AN iPHONE MUST BE ASKED, FROM A TAP** — `DeviceOrientationEvent
 * .requestPermission()` throws outside a press — so a phone that needs it
 * draws a button, on the grid card and on the race. Anywhere else the sensor
 * simply starts; a laptop has none, never sends an angle, and holds instead.
 */
const tilt = { listening: false, asked: false, refused: false, seen: false, wheel: 0 };
const needsAsking = () => typeof DeviceOrientationEvent !== 'undefined'
  && typeof DeviceOrientationEvent.requestPermission === 'function';
const screenAngle = () => {
  const o = window.screen && window.screen.orientation;
  if (o && typeof o.angle === 'number') return o.angle;
  return typeof window.orientation === 'number' ? window.orientation : 0;
};

function onTilt(ev) {
  if (ev.beta === null || ev.gamma === null || ev.beta === undefined) return;
  tilt.seen = true;
  const next = tiltToSteer(tiltAmount(ev.beta, ev.gamma, screenAngle()), tilt.wheel);
  if (next === tilt.wheel) return;
  tilt.wheel = next;
  if (live && live.update) live.update();
}

function listen() {
  if (tilt.listening) return;
  tilt.listening = true;
  window.addEventListener('deviceorientation', onTilt);
}

/** Is tilting on, waiting to be allowed, or not available here? */
export function tiltState() {
  if (tilt.refused) return 'refused';
  if (tilt.listening) return tilt.seen ? 'on' : 'starting';
  return needsAsking() ? 'ask' : 'off';
}

/**
 * Turn tilting on — called from a PRESS, which an iPhone insists on. Resolves
 * to the new `tiltState()`.
 */
export async function enableTilt() {
  if (tilt.listening) return tiltState();
  if (needsAsking()) {
    tilt.asked = true;
    try {
      const answer = await DeviceOrientationEvent.requestPermission();
      if (answer !== 'granted') { tilt.refused = true; return tiltState(); }
    } catch {
      tilt.refused = true;
      return tiltState();
    }
  }
  listen();
  return tiltState();
}

// Everywhere that needs no permission, the sensor starts with the page.
if (typeof window !== 'undefined' && !needsAsking()) listen();

/** The button that asks — drawn only where a phone has to be asked. */
export function tiltButton(cls = '') {
  const state = tiltState();
  if (state !== 'ask' && state !== 'refused') return '';
  return state === 'refused'
    ? `<p class="tiny race-tilt-no ${cls}">Tilt is off on this phone — hold the left or right of the screen instead.</p>`
    : `<button class="race-tilt ${cls}" type="button">Steer by tilting the phone</button>`;
}

/** Wire whatever `tiltButton()` drew inside `root`; `after` repaints the caller. */
export function wireTiltButton(root, after = () => {}) {
  const b = root.querySelector('.race-tilt');
  if (!b) return;
  b.addEventListener('click', async (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    b.disabled = true;
    await enableTilt();
    after();
  });
}

/** Is this phone in a race right now? Then the race is the whole screen. */
export function racing(s) {
  return Boolean(s && s.race && s.race.phase === 'racing' && s.race.you);
}

export function stopRacePhone() {
  if (live) {
    if (live.raf) cancelAnimationFrame(live.raf);
    if (live.timer) clearTimeout(live.timer);
    // The arrow keys are a WINDOW listener — left behind, they would steer a
    // race that is no longer on the screen.
    if (live.onKey) {
      window.removeEventListener('keydown', live.onKey);
      window.removeEventListener('keyup', live.onKey);
    }
  }
  live = null;
}

export function buildRace(s, { player, now }) {
  stopRacePhone();
  const r = s.race;
  const el = node(`
    <div class="race-phone" style="--kart:${esc(r.you.colour)}">
      <div class="race-phone-head">
        <span class="race-chip">${r.you.n + 1}</span>
        <span class="race-phone-who"><b>Pub Prix</b> · kart ${r.you.n + 1}</span>
        <span class="race-phone-lap" id="raceLap"></span>
      </div>
      <div class="race-tilt-slot">${tiltButton()}</div>
      <div class="race-road">
        <canvas class="race-road-canvas" aria-hidden="true"></canvas>
        <div class="race-steer" role="group" aria-label="Steering — hold the left or right of the screen">
          <span class="race-steer-hint left" aria-hidden="true">&#9664; ${tilt.seen ? 'tilt or hold' : 'hold'}</span>
          <span class="race-steer-hint right" aria-hidden="true">${tilt.seen ? 'tilt or hold' : 'hold'} &#9654;</span>
        </div>
        <div class="race-say" id="raceSay" aria-live="polite"></div>
      </div>
    </div>`);
  live = {
    id: r.id,
    startsAt: r.startsAt,
    course: courseFor(r.seed),
    startLane: r.you.lane,
    acked: (r.you.taps || []).slice(),
    pending: [],
    lead: LEAD_START,
    sim: newKart(r.you.lane),
    vis: r.you.lane - 1,
    colour: r.you.colour,
    canvas: el.querySelector('canvas'),
    lapEl: el.querySelector('#raceLap'),
    sayEl: el.querySelector('#raceSay'),
    said: '',
    lapSaid: '',
    player,
    now,
    raf: null,
    last: 0,
    // THE THUMBS — every finger on the glass and which side it is on. The
    // newest one wins, so rolling from one thumb to the other just works.
    fingers: new Map(),
    keys: [],
    want: 0,
    sentWant: (r.you.taps || []).length ? r.you.taps[r.you.taps.length - 1][1] : null,
    lastSend: 0,
    timer: null,
    onKey: null,
  };
  wireSteering(el.querySelector('.race-steer'));
  // Allowed mid-race, the button goes and the hints say so.
  const slot = el.querySelector('.race-tilt-slot');
  wireTiltButton(slot, () => {
    slot.innerHTML = tiltButton();
    wireTiltButton(slot, () => { slot.innerHTML = tiltButton(); });
    el.querySelectorAll('.race-steer-hint').forEach((h, i) => {
      h.textContent = tilt.listening ? (i ? 'tilt or hold \u25B6' : '\u25C0 tilt or hold') : h.textContent;
    });
  });
  live.raf = requestAnimationFrame(frame);
  return el;
}

/*
 * HOLD TO STEER. `pointerdown`, never `click` — a click waits for the finger
 * to lift, and steering is the finger staying down. Captured, so a thumb that
 * slides off the road still lets go when it lifts; and its side is read from
 * where it IS, so sliding from left to right turns the wheel the other way.
 * The arrow keys do the same on a laptop, for trying it out.
 */
function wireSteering(pad) {
  const me = live;
  const sideOf = (ev) => {
    const box = pad.getBoundingClientRect();
    return ev.clientX < box.left + box.width / 2 ? -1 : 1;
  };
  // A thumb wins, then a key, then the tilt — so holding is always the backup.
  const update = () => {
    if (live !== me) return;
    const held = [...me.fingers.values()];
    const key = me.keys[me.keys.length - 1];
    want(held.length ? held[held.length - 1] : key || tilt.wheel || 0);
  };
  me.update = update;
  update();
  pad.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    try { pad.setPointerCapture(ev.pointerId); } catch { /* an old browser — it still steers */ }
    me.fingers.delete(ev.pointerId);
    me.fingers.set(ev.pointerId, sideOf(ev));
    if (navigator.vibrate) navigator.vibrate(8);
    update();
  });
  pad.addEventListener('pointermove', (ev) => {
    if (!me.fingers.has(ev.pointerId)) return;
    const side = sideOf(ev);
    if (me.fingers.get(ev.pointerId) !== side) { me.fingers.set(ev.pointerId, side); update(); }
  });
  const lift = (ev) => { if (me.fingers.delete(ev.pointerId)) update(); };
  pad.addEventListener('pointerup', lift);
  pad.addEventListener('pointercancel', lift);
  pad.addEventListener('lostpointercapture', lift);
  pad.addEventListener('contextmenu', (ev) => ev.preventDefault());
  me.onKey = (ev) => {
    const side = ev.key === 'ArrowLeft' ? -1 : ev.key === 'ArrowRight' ? 1 : 0;
    if (!side) return;
    ev.preventDefault();
    me.keys = me.keys.filter((k) => k !== side);
    if (ev.type === 'keydown') me.keys.push(side);
    update();
  };
  window.addEventListener('keydown', me.onKey);
  window.addEventListener('keyup', me.onKey);
}

function taps() {
  return [...live.acked, ...live.pending].sort((a, b) => a[0] - b[0]);
}

function resim() {
  live.sim = newKart(live.startLane);
}

/** How long to leave between two sends — the server's floor, plus room for jitter. */
const SEND_GAP = MIN_TAP_MS + 30;

/**
 * THE WHEEL WANTS `v`. Sent at once when the server would take it, otherwise
 * held and sent the moment it would — only the LATEST wish, so a thumb that
 * flickers left-right-left in a tenth of a second costs one request, not
 * three. A refusal puts the wish back to be tried again: a turn the server
 * never took must not be drawn on the phone as if it had.
 */
function want(v) {
  const me = live;
  if (!me) return;
  me.want = v;
  flush(me);
}

function flush(me) {
  if (live !== me) return;
  const v = me.want;
  if (v === me.sentWant) return;
  // The engine starts on a press, never on a lift.
  if (me.sentWant === null && v === 0) return;
  const wait = me.lastSend + SEND_GAP - performance.now();
  if (wait > 0) {
    if (!me.timer) me.timer = setTimeout(() => { me.timer = null; flush(me); }, wait);
    return;
  }
  const before = me.sentWant;
  me.sentWant = v;
  me.lastSend = performance.now();
  const guess = [me.now() + me.lead, v];
  me.pending.push(guess);
  resim();
  const sent = performance.now();
  const p = me.player || {};
  postJson('/api/race', { playerId: p.id, token: p.token, joinCode: roomCode(), steer: v })
    .then((res) => {
      if (live !== me) return;
      const half = (performance.now() - sent) / 2;
      me.lead = Math.max(0, Math.min(LEAD_MAX, me.lead * 0.7 + half * 0.3));
      me.pending = me.pending.filter((x) => x !== guess);
      if (res && res.ok && !res.same) me.acked.push([res.at, res.steer]);
      if (!res || !res.ok) {
        // Not taken (too soon after the last, most likely): try again shortly.
        if (me.sentWant === v) me.sentWant = before;
        setTimeout(() => flush(me), SEND_GAP);
      }
      resim();
    })
    .catch(() => {
      if (live !== me) return;
      me.pending = me.pending.filter((x) => x !== guess);
      if (me.sentWant === v) me.sentWant = before;
      setTimeout(() => flush(me), SEND_GAP * 2);
      resim();
    });
}

function frame(stamp) {
  if (!live) return;
  if (!live.canvas.isConnected) { stopRacePhone(); return; }
  const dt = live.last ? Math.min(0.1, (stamp - live.last) / 1000) : 0;
  live.last = stamp;
  const t = live.now() + live.lead;
  stepKart(live.sim, live.course, taps(), live.startsAt, t);
  live.vis += (live.sim.x - live.vis) * Math.min(1, dt * 18);
  paint(t);
  say(t);
  live.raf = requestAnimationFrame(frame);
}

function shownD(t) {
  const sim = live.sim;
  if (sim.finishedAt !== null || sim.startedAt === null || sim.at === null) return sim.d;
  return sim.d + Math.max(0, Math.min(50, t - sim.at)) / 1000 * SPEED * speedOf(sim, sim.at);
}

function paint(t) {
  const c = live.canvas;
  const dpr = window.devicePixelRatio || 1;
  const W = c.clientWidth; const H = c.clientHeight;
  if (!W || !H) return;
  if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) {
    c.width = Math.round(W * dpr);
    c.height = Math.round(H * dpr);
  }
  const ctx = c.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sx = W / (2 * (WALL + 0.12));             // pixels per lane-width, across
  const X = (x) => W / 2 + x * sx;
  const kartY = H * 0.8;
  const px = (H * 0.8) / VIEW;                     // pixels per track unit, along
  const d = shownD(t);
  const Y = (at) => kartY - (at - d) * px;

  // Grass, striped so standing still LOOKS still.
  ctx.fillStyle = '#1c3a24';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#21452b';
  for (let a = Math.floor((d - 40) / 40) * 40; a < d + VIEW + 40; a += 80) ctx.fillRect(0, Y(a + 40), W, 40 * px);
  // The tarmac.
  ctx.fillStyle = '#23232d';
  ctx.fillRect(X(-HALF), 0, X(HALF) - X(-HALF), H);
  // A bend, where the road pushes you wide: tinted, with arrows the way it pushes.
  for (let a = Math.floor((d - 25) / 10) * 10; a < d + VIEW; a += 10) {
    const b = bendAt(a);
    if (!b) continue;
    ctx.fillStyle = `rgba(255, 138, 61, ${0.13 * b})`;
    // Edge to edge, never overlapping: a translucent overlap draws a seam.
    const top = Math.round(Y(a + 10)); const bottom = Math.round(Y(a));
    ctx.fillRect(X(-HALF), top, X(HALF) - X(-HALF), bottom - top);
  }
  ctx.strokeStyle = 'rgba(255, 168, 110, 0.4)';
  ctx.lineWidth = Math.max(3, sx * 0.08);
  for (let a = Math.ceil((d - 25) / 45) * 45; a < d + VIEW; a += 45) {
    if (bendAt(a) < 0.5) continue;
    const y = Y(a);
    for (const x0 of [-0.75, 0.75]) {
      ctx.beginPath();
      ctx.moveTo(X(x0 - 0.15), y - sx * 0.2);
      ctx.lineTo(X(x0 + 0.15), y);
      ctx.lineTo(X(x0 - 0.15), y + sx * 0.2);
      ctx.stroke();
    }
  }
  // Kerbs, red and white, scrolling.
  const kerb = 20;
  for (let a = Math.floor((d - 30) / kerb) * kerb; a < d + VIEW + kerb; a += kerb) {
    ctx.fillStyle = Math.round(a / kerb) % 2 ? '#e5484d' : '#f4f4f4';
    for (const side of [-1, 1]) ctx.fillRect(side < 0 ? X(-HALF) - sx * 0.12 : X(HALF), Y(a + kerb), sx * 0.12, kerb * px + 1);
  }
  // Lane lines, faint — the pints still sit on three lines.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.lineWidth = 2;
  ctx.setLineDash([22, 22]);
  ctx.lineDashOffset = -((d * px) % 44);
  for (const x of [-0.5, 0.5]) { ctx.beginPath(); ctx.moveTo(X(x), 0); ctx.lineTo(X(x), H); ctx.stroke(); }
  ctx.setLineDash([]);

  // The finish line, when it is on screen.
  const finishY = Y(LAPS * LAP);
  if (finishY > -20 && finishY < H) {
    const sq = (X(HALF) - X(-HALF)) / 12;
    for (let i = 0; i < 12; i += 1) {
      for (let j = 0; j < 2; j += 1) {
        ctx.fillStyle = (i + j) % 2 ? '#0b0b12' : '#f4f4f4';
        ctx.fillRect(X(-HALF) + i * sq, finishY + j * sq, sq, sq);
      }
    }
  }

  // What is coming: spilt pints and boosts.
  const r = sx * 0.34;
  for (const it of live.course) {
    if (it.at < d - 25) continue;
    if (it.at > d + VIEW) break;
    const y = Y(it.at);
    const x = X(it.lane - 1);
    if (it.kind === 'spill') {
      ctx.fillStyle = 'rgba(214, 150, 40, 0.95)';
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.62, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(250, 236, 196, 0.9)';
      ctx.beginPath(); ctx.ellipse(x - r * 0.25, y - r * 0.15, r * 0.34, r * 0.18, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.strokeStyle = '#2fe07a';
      ctx.lineWidth = Math.max(3, sx * 0.07);
      for (const k of [0, r * 0.55]) {
        ctx.beginPath();
        ctx.moveTo(x - r * 0.6, y + k + r * 0.3);
        ctx.lineTo(x, y + k - r * 0.25);
        ctx.lineTo(x + r * 0.6, y + k + r * 0.3);
        ctx.stroke();
      }
    }
  }

  // The kart, leaning into the turn it is making.
  const sim = live.sim;
  const kx = X(live.vis);
  const kw = sx * 0.42; const kh = sx * 0.6;
  ctx.save();
  ctx.translate(kx, kartY);
  ctx.rotate((sim.steer || 0) * 0.22);
  if (sim.at !== null && sim.at < sim.boostUntil) {
    ctx.fillStyle = 'rgba(47, 224, 122, 0.35)';
    ctx.beginPath(); ctx.ellipse(0, kh * 0.6, kw * 0.6, kh * 0.5, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#0b0b12';
  for (const wx of [-1, 1]) for (const wy of [-0.3, 0.3]) ctx.fillRect(wx * kw * 0.55 - kw * 0.12, wy * kh - kh * 0.12, kw * 0.24, kh * 0.24);
  ctx.fillStyle = live.colour || '#4bd8ff';
  roundRect(ctx, -kw / 2, -kh / 2, kw, kh, kw * 0.3);
  ctx.fill();
  ctx.strokeStyle = onGrass(sim) ? '#2fe07a' : '#0b0b12';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
}

function say(t) {
  const sim = live.sim;
  const started = sim.ci > 0 || live.pending.length || live.acked.length;
  let text;
  if (sim.finishedAt !== null) text = `Home in ${((sim.finishedAt - live.startsAt) / 1000).toFixed(1)}s — look up`;
  else if (t < live.startsAt) {
    const n = Math.ceil((live.startsAt - t) / 1000);
    text = started ? `${n}… engine running` : `${n}… ${tilt.seen ? 'tilt or hold' : 'hold left or right'} to start your engine`;
  } else if (!started) text = `${tilt.seen ? 'Tilt or hold' : 'Hold left or right'} to start your engine!`;
  else if (onGrass(sim)) text = 'On the grass — steer back on!';
  else if (sim.at !== null && sim.at < sim.slowUntil) text = 'Spilt pint!';
  else if (sim.at !== null && sim.at < sim.boostUntil) text = 'Boost!';
  else if (bendAt(sim.d) > 0.3 || bendAt(sim.d + 45) > 0.3) text = tilt.seen ? 'Bend — lean left' : 'Bend — hold left';
  else text = '';
  if (text !== live.said) {
    live.said = text;
    live.sayEl.textContent = text;
    live.sayEl.classList.toggle('shown', Boolean(text));
  }
  const lap = sim.finishedAt !== null ? 'Finished' : `Lap ${lapOf(sim.d)} of ${LAPS}`;
  if (lap !== live.lapSaid) {
    live.lapSaid = lap;
    live.lapEl.textContent = lap;
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

/**
 * The one card about the race on every OTHER screen: a phone that joined after
 * the start, and every phone once it is over. Empty when there is nothing true
 * to say — which is every night with no race.
 */
export function raceResultCard(s) {
  const r = s && s.race;
  if (!r) return '';
  if (r.phase === 'racing') {
    if (r.you) return '';
    return `
      <div class="panel racecard">
        <div class="sub">Pub Prix</div>
        <b>A race is on — look up.</b>
        <span class="tiny">You will be in the next one.</span>
      </div>`;
  }
  const w = r.winner;
  const line = !w ? 'Nobody started their engine, so nobody won.'
    : w.you ? 'You won! Your drink is in My prizes.'
      : r.place ? `You came ${ordinal(r.place)} of ${r.karts}. ${esc(w.name)} won.`
        : `${esc(w.name)} won.`;
  return `
    <div class="panel racecard${w && w.you ? ' won' : ''}">
      <div class="sub">Pub Prix</div>
      <b>${line}</b>
    </div>`;
}
