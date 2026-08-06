/**
 * Bits every screen needs: a live connection, a clock that agrees with the
 * server, and a couple of DOM helpers. Deliberately tiny and framework-free.
 */

/**
 * The logo: a record, drawn rather than loaded, so it costs no request and
 * stays sharp at any size. Each one gets its own gradient id, because two on a
 * page with the same id would fight.
 */
let markCount = 0;
export function brandMark(size = 30) {
  const id = `bm${++markCount}`;
  return `
    <svg class="brand-mark" width="${size}" height="${size}" viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#ff2e88"/>
          <stop offset="55%" stop-color="#ff8a3d"/>
          <stop offset="100%" stop-color="#ffd23f"/>
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="19" fill="url(#${id})"/>
      <circle cx="20" cy="20" r="13" fill="none" stroke="rgba(0,0,0,0.22)" stroke-width="1.6"/>
      <circle cx="20" cy="20" r="8.5" fill="none" stroke="rgba(0,0,0,0.18)" stroke-width="1.2"/>
      <circle cx="20" cy="20" r="3.6" fill="#0a0a12"/>
    </svg>`;
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
