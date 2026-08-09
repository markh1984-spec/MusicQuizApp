/**
 * Bits every screen needs: a live connection, a clock that agrees with the
 * server, and a couple of DOM helpers. Deliberately tiny and framework-free.
 */

import { recordMark } from './brandmark.js';

/**
 * The logo: a record. The drawing lives in brandmark.js because the server
 * serves the very same one as the tab icon, and two copies would be a logo
 * that changes in one place and not the other.
 *
 * Each one on a page gets its own gradient id — two sharing one would fight.
 */
let markCount = 0;
export function brandMark(size = 30) {
  return recordMark({ size, id: `bm${++markCount}`, cls: 'brand-mark' });
}

/**
 * The logo and the name, as a link back to the console — the way the top left
 * of any website behaves. Keeps the host key on the link so it does not ask
 * for it again.
 */
export function brandLink(name, { key = '', size = 30 } = {}) {
  const href = '/console' + (key ? '?key=' + encodeURIComponent(key) : '');
  return `<a class="brand" href="${href}" title="Back to the console">
    ${brandMark(size)}<span class="brand-name">${esc(name)}</span>
  </a>`;
}

/**
 * A bin, drawn rather than written out as a word or an emoji.
 *
 * Emoji bins are a different picture on every phone and some of them are a
 * cheerful little basket. This is the same everywhere, sharp at any size, and
 * inherits its colour — which matters, because the whole point is that the
 * host can see what a tap is about to do before it does it.
 */
export function binIcon(size = 18) {
  return `
    <svg class="bin-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true">
      <path d="M3 6h18"/>
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6M14 11v6"/>
    </svg>`;
}

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

export function html(strings, ...values) {
  return strings.reduce((out, s, i) => out + s + (i < values.length ? values[i] : ''), '');
}

export function node(markup) {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  return t.content.firstElementChild;
}

/**
 * Keeps a running estimate of the gap between this device's clock and the
 * server's, so a countdown shown on a phone whose clock is ten minutes out
 * still matches the projector. Scoring never uses this — only the display.
 */
export class ServerClock {
  constructor() {
    this.offset = 0;
    this.samples = [];
  }

  sync(serverNow) {
    if (!Number.isFinite(serverNow)) return;
    this.samples.push(serverNow - Date.now());
    if (this.samples.length > 9) this.samples.shift();
    // Median, so one slow response does not drag the clock about.
    const sorted = [...this.samples].sort((a, b) => a - b);
    this.offset = sorted[Math.floor(sorted.length / 2)];
  }

  now() {
    return Date.now() + this.offset;
  }
}

/**
 * A live connection that reconnects itself. EventSource already retries, but
 * we also watch for a stream that has gone quiet (a phone waking from sleep
 * often keeps a dead connection open) and rebuild it.
 */
export class Live {
  constructor(url, { onState, onStatus } = {}) {
    this.url = url;
    this.onState = onState || (() => {});
    this.onStatus = onStatus || (() => {});
    this.source = null;
    this.lastMessageAt = 0;
    this.stopped = false;
    this.timers = [];
    this.connect();
    this.timers.push(setInterval(() => this.checkAlive(), 5000));
    this.onVisible = () => { if (!document.hidden) this.checkAlive(true); };
    document.addEventListener('visibilitychange', this.onVisible);

    /*
     * Keep the server awake.
     *
     * Hosts that sleep idle apps (Render's free tier does, after 15 minutes)
     * count INBOUND requests. Our live connection is outbound-only once it is
     * open — the server pushes to it and the browser never sends anything —
     * so a quiet lobby or a long gap between rounds could look like no
     * traffic at all and put the app to sleep with the room watching.
     *
     * One tiny request every four minutes is enough to stop that. It costs
     * nothing and it removes a whole category of gig-night disaster.
     */
    this.timers.push(setInterval(() => {
      fetch('/health', { cache: 'no-store' }).catch(() => {});
    }, 4 * 60 * 1000));
  }

  /**
   * Shut this connection down for good — stream closed, timers cleared.
   *
   * Without this, replacing a connection left the old one alive: its stream
   * was closed but its keep-alive timer was not, so forty seconds later it
   * reopened itself and started delivering state again under the OLD player
   * id. The server rightly said it did not know that id, and the phone threw
   * the player out — a player who was, by then, perfectly happily rejoined
   * under a new one. One stray disconnection turned into being kicked over
   * and over for the rest of the night.
   */
  stop() {
    this.stopped = true;
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
    document.removeEventListener('visibilitychange', this.onVisible);
    if (this.source) {
      try { this.source.close(); } catch { /* already gone */ }
      this.source = null;
    }
  }

  connect() {
    if (this.stopped) return;
    if (this.source) this.source.close();
    this.source = new EventSource(this.url);
    this.source.addEventListener('open', () => {
      this.lastMessageAt = Date.now();
      this.onStatus('online');
    });
    this.source.addEventListener('state', (event) => {
      this.lastMessageAt = Date.now();
      this.onStatus('online');
      try {
        this.onState(JSON.parse(event.data));
      } catch (err) {
        console.error('bad state payload', err);
      }
    });
    this.source.addEventListener('error', () => this.onStatus('offline'));
  }

  /** Heartbeats arrive every 15s; 40s of silence means the link is dead. */
  checkAlive(force = false) {
    if (this.stopped) return;
    const quietFor = Date.now() - this.lastMessageAt;
    if (force || quietFor > 40000) {
      if (quietFor > 20000 || force) {
        this.onStatus('offline');
        this.connect();
      }
    }
  }
}

export async function postJson(url, body, headers = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body || {}),
  });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text }; }
  if (!res.ok) throw Object.assign(new Error(data.error || res.statusText), { data, status: res.status });
  return data;
}

/*
 * Which game this browser belongs to.
 *
 * One place, imported by the phone, the bingo card and the projector, because
 * three copies of "where do I read the code from" is three chances to disagree
 * — and disagreeing means a phone answering into somebody else's question.
 *
 * Read from the page's URL (`?g=XXXX`) and then REMEMBERED, for the same reason
 * the player id is remembered: a phone that locks, refreshes or drops off wifi
 * has to come back to the same game rather than landing somewhere else with no
 * score. No code anywhere means the house game, which is what every QR made
 * before rooms existed says — that fallback is why nothing had to be reprinted.
 */
const ROOM_KEY = 'musicquiz.room';

export function roomCode() {
  let fromUrl = '';
  try {
    fromUrl = new URL(location.href).searchParams.get('g') || '';
  } catch { /* no window: a test importing this for something else */ }
  if (fromUrl) {
    try { localStorage.setItem(ROOM_KEY, fromUrl); } catch { /* private browsing */ }
    return fromUrl;
  }
  try { return localStorage.getItem(ROOM_KEY) || ''; } catch { return ''; }
}

/** `&g=…` for a query string that already has something in it, or nothing. */
export function roomParam(prefix = '&') {
  const code = roomCode();
  return code ? `${prefix}g=${encodeURIComponent(code)}` : '';
}

export function rememberRoom(code) {
  if (code === undefined || code === null) return;
  try {
    if (code) localStorage.setItem(ROOM_KEY, code);
    else localStorage.removeItem(ROOM_KEY);
  } catch { /* private browsing */ }
}

/**
 * A bar across the top saying which hat is on.
 *
 * Only ever shown to an owner who has switched into their own quizmaster
 * account. Being unsure which hat you are wearing is worse than either hat —
 * especially minutes before a gig, where "why is there no Launch button" and
 * "why can I see everybody's invoices" are both alarming for the wrong reason.
 *
 * It goes at the very top and pushes the page down rather than floating over
 * it, because something that covers a control is a bug of its own.
 */
export function actingBar(me) {
  if (!hatOn(me)) return null;
  const el = node(`
    <div class="acting-bar">
      <span>Wearing your <b>quizmaster</b> hat — this is exactly what a subscriber sees.</span>
      <button type="button">Back to owner</button>
    </div>`);
  el.querySelector('button').addEventListener('click', async () => {
    await postJson('/api/owner/act-as', { on: false });
    location.href = '/owner';
  });
  document.body.prepend(el);
  return el;
}

/*
 * Two shapes reach these helpers and both are legitimate: the whole `/api/me`
 * payload (which is what the control view has) and the `account` off it (which
 * is what the console keeps). `actingAs` and `bootstrap` are set on BOTH by
 * `whoIs()` in server.js, so accept either rather than making every caller
 * remember which it is holding.
 */
const hat = (me) => (me && me.account) || me || {};
const hatOn = (me) => Boolean(hat(me).actingAs || (me && me.actingAs));
const isOwner = (me) => hat(me).role === 'owner' || (me && me.account && me.account.role === 'owner');

/**
 * The hat switch: Owner | Quizmaster, in the top right, one tap either way.
 *
 * It is BOTH the switch and the sign saying which hat is on, which is why the
 * live half is a solid block of colour rather than a tick — pink for the owner,
 * gold for the quizmaster, so it is answered from across the room and not read.
 * "Being unsure which hat you are wearing is worse than either hat" was already
 * the rule; a sticky corner beats a bar you scroll past.
 *
 * **Only an owner ever sees it, and only their own two hats.** A real
 * quizmaster has nothing to switch to. Neither does the HOST KEY, which is not
 * an owner account at all — it is every hat at once by a different route, so a
 * toggle there would be a control that cannot mean anything.
 *
 * Switching cannot disturb a night in progress. The two hats are two ROOMS, and
 * a room keeps its own game, its own phones and its own state file — so the
 * worst a mis-tap does is show you the other room until you tap back. Nothing
 * is stopped and nothing is lost, which is why this needs no confirm step.
 */
export function hatSwitch(me, { onSwitch = null } = {}) {
  const on = hatOn(me);
  if (!on && !isOwner(me)) return null;
  // The host key is not an owner account; it holds every hat by another route.
  if (hat(me).bootstrap || (me && me.bootstrap)) return null;

  const el = node(`
    <div class="hat-switch" role="group" aria-label="Which hat you are wearing"
         title="Switch between the owner console and your own quizmaster account. Same login, no second password — it is the only way to spot what annoys a quizmaster.">
      <button type="button" class="hat-half owner ${on ? '' : 'live'}" ${on ? '' : 'aria-current="true"'}>Owner</button>
      <button type="button" class="hat-half qm ${on ? 'live' : ''}" ${on ? 'aria-current="true"' : ''}>Quizmaster</button>
    </div>`);

  const go = async (wanted) => {
    if (wanted === on) return;                       // already wearing it
    el.classList.add('working');
    for (const b of el.querySelectorAll('button')) b.disabled = true;
    try {
      await postJson('/api/owner/act-as', { on: wanted });
      if (onSwitch) return onSwitch(wanted);
      // Stay where you are, so the toggle reads as "the same page with the
      // other powers". The exception is the owner page itself, which a
      // quizmaster may not open — going there would be a 403 on your own tap.
      const here = location.pathname;
      location.href = wanted && here === '/owner' ? '/console' : here;
    } catch (err) {
      el.classList.remove('working');
      for (const b of el.querySelectorAll('button')) b.disabled = false;
      alert(err.message || 'Could not switch.');
    }
  };
  el.querySelector('.owner').addEventListener('click', () => go(false));
  el.querySelector('.qm').addEventListener('click', () => go(true));

  // With the hat on, which RUNG of the ladder to wear it as.
  if (on) {
    const picker = tierPreview(me);
    if (picker) el.appendChild(picker);
  }
  return el;
}

/**
 * Look at the app as a Bronze / Silver / Gold subscriber would.
 *
 * The hat exists because every irritation a real quizmaster hits is invisible
 * from behind the host key. The linked quizmaster account is COMPED, though, so
 * wearing the hat has only ever shown the top of the ladder — and every
 * irritation a Bronze subscriber hits is invisible from there for exactly the
 * same reason. "Rob says the Invoices tab has gone" is not a question you can
 * answer from an account that has everything.
 *
 * It sits inside the hat switch rather than beside it because it only means
 * anything while the hat is on: three rungs, the live one filled, one tap each.
 * "All" is the linked account as it really is — comped, the whole ladder — and
 * is the one to come back to before doing anything real.
 *
 * ONLY EVER A DOWNGRADE, and only ever the owner's own account. The server
 * checks the same thing again; this is the control, not the rule.
 */
function tierPreview(me) {
  const tiers = (me && me.tiers) || [];
  if (!tiers.length) return null;
  const now = (me && me.previewTier) || '';

  const el = node(`
    <span class="tier-preview" title="Look at the console as a subscriber on this tier would see it">
      <button type="button" class="tier-half ${now ? '' : 'live'}" data-tier="">All</button>
      ${tiers.map((t) => `
        <button type="button" class="tier-half t-${esc(t.id)} ${now === t.id ? 'live' : ''}"
                data-tier="${esc(t.id)}" title="${esc(t.label)} — ${esc(t.plan)}">${esc(t.label[0])}</button>`).join('')}
    </span>`);

  for (const button of el.querySelectorAll('button')) {
    button.addEventListener('click', async (event) => {
      // The hat switch itself is two buttons in the same box; without this a
      // tap on a rung would also read as a tap on "Quizmaster".
      event.stopPropagation();
      for (const b of el.querySelectorAll('button')) b.disabled = true;
      try {
        await postJson('/api/owner/act-as', { tier: button.dataset.tier });
        location.reload();
      } catch (err) {
        for (const b of el.querySelectorAll('button')) b.disabled = false;
        alert(err.message || 'Could not change tier.');
      }
    });
  }
  return el;
}
