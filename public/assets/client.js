/**
 * Bits every screen needs: a live connection, a clock that agrees with the
 * server, and a couple of DOM helpers. Deliberately tiny and framework-free.
 */

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
    this.connect();
    setInterval(() => this.checkAlive(), 5000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.checkAlive(true);
    });

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
    setInterval(() => {
      fetch('/health', { cache: 'no-store' }).catch(() => {});
    }, 4 * 60 * 1000);
  }

  connect() {
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
