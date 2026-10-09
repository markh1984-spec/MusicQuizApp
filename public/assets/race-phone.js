/**
 * PUB PRIX ON A PHONE — your own kart, the road ahead, and three lanes to tap.
 *
 * **NO CONTROL PANEL: YOU TAP THE LANE AND THE KART GOES THERE** — the lobby
 * games' own rule (`docs/lobby-games.md`). The road IS the control: tap the
 * left third, the kart moves left. Nothing to read, nothing to hold.
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
  courseFor, newKart, stepKart, lapOf, LAPS, LAP, SPEED, BOOST, SLOW, MIN_TAP_MS,
} from './race-track.js';

/** How much road is on the screen, ahead of the kart — about three seconds. */
const VIEW = 170;
const LEAD_START = 120;
const LEAD_MAX = 350;

let live = null;

/** Is this phone in a race right now? Then the race is the whole screen. */
export function racing(s) {
  return Boolean(s && s.race && s.race.phase === 'racing' && s.race.you);
}

export function stopRacePhone() {
  if (live && live.raf) cancelAnimationFrame(live.raf);
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
      <div class="race-road">
        <canvas class="race-road-canvas" aria-hidden="true"></canvas>
        <div class="race-lanes">
          <button type="button" data-lane="0" aria-label="Left lane"></button>
          <button type="button" data-lane="1" aria-label="Middle lane"></button>
          <button type="button" data-lane="2" aria-label="Right lane"></button>
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
    vis: r.you.lane,
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
  };
  // `pointerdown`, not `click` — a click waits for the finger to lift, and on
  // a road that is the difference between missing a puddle and not.
  el.querySelectorAll('[data-lane]').forEach((b) => {
    b.addEventListener('pointerdown', (ev) => { ev.preventDefault(); steer(Number(b.dataset.lane)); });
  });
  live.raf = requestAnimationFrame(frame);
  return el;
}

function taps() {
  return [...live.acked, ...live.pending].sort((a, b) => a[0] - b[0]);
}

function resim() {
  live.sim = newKart(live.startLane);
}

function steer(lane) {
  if (!live) return;
  const me = live;
  const at = me.now() + me.lead;
  const all = taps();
  const last = all[all.length - 1];
  if (last && at - last[0] < MIN_TAP_MS) return;
  // The lane it is already in, once the engine is running, is no change.
  if (last && last[1] === lane) return;
  const guess = [at, lane];
  me.pending.push(guess);
  resim();
  if (navigator.vibrate) navigator.vibrate(10);
  const sent = performance.now();
  const p = me.player || {};
  postJson('/api/race', { playerId: p.id, token: p.token, joinCode: roomCode(), lane })
    .then((res) => {
      if (live !== me) return;
      const half = (performance.now() - sent) / 2;
      me.lead = Math.max(0, Math.min(LEAD_MAX, me.lead * 0.7 + half * 0.3));
      me.pending = me.pending.filter((x) => x !== guess);
      if (res && res.ok && !res.same) me.acked.push([res.at, res.lane]);
      resim();
    })
    .catch(() => {
      if (live !== me) return;
      me.pending = me.pending.filter((x) => x !== guess);
      resim();
    });
}

function frame(stamp) {
  if (!live) return;
  if (!live.canvas.isConnected) { live = null; return; }
  const dt = live.last ? Math.min(0.1, (stamp - live.last) / 1000) : 0;
  live.last = stamp;
  const t = live.now() + live.lead;
  stepKart(live.sim, live.course, taps(), live.startsAt, t);
  live.vis += (live.sim.lane - live.vis) * Math.min(1, dt * 14);
  paint(t);
  say(t);
  live.raf = requestAnimationFrame(frame);
}

function shownD(t) {
  const sim = live.sim;
  if (sim.finishedAt !== null || sim.startedAt === null || sim.at === null) return sim.d;
  const mult = sim.at < sim.slowUntil ? SLOW : sim.at < sim.boostUntil ? BOOST : 1;
  return sim.d + Math.max(0, Math.min(50, t - sim.at)) / 1000 * SPEED * mult;
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
  ctx.clearRect(0, 0, W, H);
  const laneW = W / 3;
  const kartY = H * 0.8;
  const px = (H * 0.8) / VIEW;
  const d = shownD(t);

  ctx.fillStyle = '#23232d';
  ctx.fillRect(0, 0, W, H);
  // Lane lines that scroll with the kart, so standing still LOOKS still.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.lineWidth = 3;
  ctx.setLineDash([22, 22]);
  ctx.lineDashOffset = -((d * px) % 44);
  for (const x of [laneW, laneW * 2]) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  ctx.setLineDash([]);

  // The finish line, when it is on screen.
  const finishY = kartY - (LAPS * LAP - d) * px;
  if (finishY > -20 && finishY < H) {
    const sq = laneW / 6;
    for (let i = 0; i < 18; i += 1) {
      for (let j = 0; j < 2; j += 1) {
        ctx.fillStyle = (i + j) % 2 ? '#0b0b12' : '#f4f4f4';
        ctx.fillRect(i * sq, finishY + j * sq, sq, sq);
      }
    }
  }

  // What is coming: spilt pints and boosts.
  for (const it of live.course) {
    if (it.at < d - 25) continue;
    if (it.at > d + VIEW) break;
    const y = kartY - (it.at - d) * px;
    const x = laneW * (it.lane + 0.5);
    if (it.kind === 'spill') {
      ctx.fillStyle = 'rgba(214, 150, 40, 0.95)';
      ctx.beginPath(); ctx.ellipse(x, y, laneW * 0.32, laneW * 0.2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(250, 236, 196, 0.9)';
      ctx.beginPath(); ctx.ellipse(x - laneW * 0.08, y - laneW * 0.05, laneW * 0.11, laneW * 0.06, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.strokeStyle = '#2fe07a';
      ctx.lineWidth = Math.max(3, laneW * 0.07);
      for (const k of [0, laneW * 0.18]) {
        ctx.beginPath();
        ctx.moveTo(x - laneW * 0.2, y + k + laneW * 0.1);
        ctx.lineTo(x, y + k - laneW * 0.08);
        ctx.lineTo(x + laneW * 0.2, y + k + laneW * 0.1);
        ctx.stroke();
      }
    }
  }

  // The kart.
  const kx = laneW * (live.vis + 0.5);
  const kw = laneW * 0.42; const kh = laneW * 0.56;
  const sim = live.sim;
  if (sim.at !== null && sim.at < sim.boostUntil) {
    ctx.fillStyle = 'rgba(47, 224, 122, 0.35)';
    ctx.beginPath(); ctx.ellipse(kx, kartY + kh * 0.6, kw * 0.6, kh * 0.5, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = live.colour || '#4bd8ff';
  roundRect(ctx, kx - kw / 2, kartY - kh / 2, kw, kh, kw * 0.3);
  ctx.fill();
  ctx.strokeStyle = '#0b0b12';
  ctx.lineWidth = 3;
  ctx.stroke();
}

function say(t) {
  const sim = live.sim;
  let text;
  if (sim.finishedAt !== null) text = `Home in ${((sim.finishedAt - live.startsAt) / 1000).toFixed(1)}s — look up`;
  else if (t < live.startsAt) {
    const n = Math.ceil((live.startsAt - t) / 1000);
    text = sim.ci > 0 || live.pending.length || live.acked.length ? `${n}… engine running` : `${n}… tap a lane to start your engine`;
  } else if (sim.startedAt === null && !live.pending.length) text = 'Tap a lane to start your engine!';
  else if (sim.at !== null && sim.at < sim.slowUntil) text = 'Spilt pint!';
  else if (sim.at !== null && sim.at < sim.boostUntil) text = 'Boost!';
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
