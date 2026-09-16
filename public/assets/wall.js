/**
 * THE SECOND SCREEN — the code to send a photograph, and the photographs.
 *
 * ---
 *
 * Asked for on 16 September 2026: *"if I'm doing karaoke, then the karaoke
 * screen uses one of the output screens. But then if I'm trying to get photo
 * uploads during the night as well, I would need a second screen for that
 * second QR code and photo uploads."*
 *
 * **THE REASON THIS IS SMALL IS THAT PHOTOGRAPHS ALREADY BELONG TO THE ROOM.**
 * `POST /api/photo` has never cared which game is running — the decision that
 * gave a DJ set the camera, the wall and the gallery for nothing — so a screen
 * that wants only the code and the pictures needs no engine, no phase and no
 * game at all. `wallView()` in `server.js` is the whole payload.
 *
 * **IT IS A PAGE RATHER THAN A SECOND `/screen`.** Every `role=screen` client
 * in a room gets the identical `screenView()`, which is right — two projectors
 * at one night must agree — and is exactly why a second output cannot be one of
 * them. Opening `/screen` twice mirrors it; the point here is a display showing
 * something *else* while the main output belongs to KaraFun.
 *
 * **NOTHING HERE IMPORTS `screen.js`** — *a page module may not be imported by
 * another page*, and the shared half lives in `client.js`. The photo layout is
 * deliberately NOT lifted out of the projector either: that one is a strip plus
 * a moment in the middle of a quiz, torn down whenever a phase has no room for
 * it, and this one is a grid beside a code that stands all night. Two different
 * jobs that happen to draw photographs, so sharing them would mean one function
 * carrying both sets of rules — and the projector is protected surface, which is
 * a bad thing to refactor for a screen it will never draw.
 *
 * **NO SOUND, EVER.** The soundboard is `role === 'screen'` on the server, so
 * the noise still comes out of exactly one laptop — the one wired to the PA.
 */

import {
  esc, node, Live, brandMark, brandWords, roomParam,
} from './client.js';
import { paintScheme } from './schemes.js';

/*
 * Taken from the page's own URL — `/wall?g=XXXX` — like the projector's, and
 * for the same reason: the QR is needed before any state has arrived. No code
 * means the house room.
 */
const roomQuery = roomParam('?');
const joinQr = `/join-qr.svg${roomQuery}`;

const cardEl = document.getElementById('card');
const countPill = document.getElementById('countPill');
const connWarnEl = document.getElementById('connWarn');

let joinUrl = '';
let built = false;
let brandDone = false;

/**
 * The frame: the code on the left, the photographs on the right.
 *
 * **BUILT ONCE AND REFILLED**, never re-rendered on a push. A photograph
 * arriving every few seconds all night would otherwise rebuild the QR each
 * time — and a code that flickers while somebody is pointing a camera at it is
 * the one thing on this screen that has to be still.
 */
function build() {
  cardEl.replaceChildren(node(`
    <div class="wall-grid">
      <div class="wall-ask">
        <h1 class="grad-text">Get your photos on the screen</h1>
        <ol class="join-steps">
          <li><span class="n">1</span><span>Point your camera at the code</span></li>
          <li><span class="n">2</span><span>Take a photo</span></li>
          <li><span class="n">3</span><span>It lands here</span></li>
        </ol>
        <div class="qr-panel wall-qr">
          <img src="${joinQr}" alt="Scan to send a photo">
          <div class="url" id="wallUrl">${esc(joinUrl)}</div>
        </div>
      </div>
      <div class="wall-shots" id="wallShots"></div>
    </div>`));
  built = true;
}

/**
 * The photographs, newest first.
 *
 * **REBUILT ONLY WHERE IT CHANGED**, the projector's own discipline: replacing
 * the grid wholesale on every push would reload every picture over a pub's wifi
 * and flash the screen each time anybody sent one.
 *
 * **NEWEST FIRST AND CAPPED**, because this stands all night with nothing to
 * clear it. `forScreen()` already hands back the last forty reversed, so the cap
 * here is about what can be SEEN: past about two dozen on a 1280px display each
 * picture is a thumbnail nobody at the back can make out, and a wall of stamps
 * says less than a wall of photographs.
 */
const SHOWN = 24;

function paintShots(items) {
  const shots = document.getElementById('wallShots');
  if (!shots) return;
  const want = items.slice(0, SHOWN);
  const have = new Map([...shots.children].map((c) => [c.dataset.id, c]));
  const wantedIds = new Set(want.map((p) => p.id));
  for (const [id, el] of have) if (!wantedIds.has(id)) el.remove();

  want.forEach((p, i) => {
    let el = have.get(p.id);
    if (!el) {
      el = node(`
        <figure class="wall-shot" data-id="${esc(p.id)}">
          <img src="${esc(p.url)}" alt="" loading="lazy">
          ${p.teamName ? `<figcaption>${esc(p.teamName)}</figcaption>` : ''}
        </figure>`);
    }
    if (shots.children[i] !== el) shots.insertBefore(el, shots.children[i] || null);
  });

  /*
   * THE EMPTY STATE IS NOT A BLANK HALF-SCREEN. Ten minutes before anybody has
   * sent one, the right-hand side is the biggest thing on the display and it
   * would read as a screen that had failed to load — which is the same fault as
   * a projector with nothing on it saying nothing.
   */
  shots.classList.toggle('waiting', want.length === 0);
  if (!want.length && !shots.querySelector('.wall-empty')) {
    shots.replaceChildren(node('<div class="wall-empty">They land here as they arrive</div>'));
  }
}

/**
 * The photo feature is off for this night, so say so rather than invite a room
 * to scan a code that will refuse them. *The reason a control is off goes on
 * the control* — here the control is the whole screen.
 */
function paintShut() {
  cardEl.replaceChildren(node(`
    <div class="wall-grid wall-shut">
      <div class="wall-ask">
        <h1 class="grad-text">Photos are switched off</h1>
        <p class="sub">Turn them back on from your control view and this screen
          fills itself in.</p>
      </div>
    </div>`));
  built = false;
}

function draw(s) {
  if (s.brand && !brandDone) {
    brandDone = true;
    document.getElementById('brandSlot').innerHTML = `${brandMark(26)}${brandWords(s.brand, s.appName || '')}`;
    document.title = `${s.brand} — Second Screen`;
  }
  paintScheme(s.scheme);

  if (!s.open) { paintShut(); return; }
  if (!built) build();

  const items = s.photos || [];
  paintShots(items);
  countPill.textContent = `${items.length} photo${items.length === 1 ? '' : 's'}`;
}

// -------------------------------------------------------------------- boot

fetch(`/api/join-url${roomQuery}`)
  .then((r) => r.json())
  .then((d) => {
    joinUrl = (d.url || '').replace(/^https?:\/\//, '');
    const el = document.getElementById('wallUrl');
    if (el) el.textContent = joinUrl;
  })
  .catch(() => {});

new Live(`/api/stream?role=wall${roomParam()}`, {
  onState: draw,
  onStatus: (status) => connWarnEl.classList.toggle('hidden', status === 'online'),
});

/*
 * Keep it awake — the projector's own rule, and this screen needs it MORE: it
 * has no question clock and nothing moving for minutes at a time, which is
 * exactly the state a laptop decides to dim in.
 */
if ('wakeLock' in navigator) {
  let lock = null;
  const hold = async () => {
    try {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => { lock = null; });
    } catch { /* denied, or not visible — nothing we can do */ }
  };
  hold();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !lock) hold();
  });
}
