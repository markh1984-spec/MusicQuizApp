/**
 * HTTP PLUMBING — send, read, origins. Moved whole from server.js.
 */
import { HOST_KEY, config, flight, http } from './context.js';
import { timingSafeEqual } from './gates.js';

// ----------------------------------------------------------------- helpers

/*
 * WHAT EVERY RESPONSE SAYS ABOUT ITSELF — one function, on every head this
 * server writes (`send()`, `serveFile()`, the photo, PDF, stream and progress
 * heads). There were no security headers at all: no policy behind the
 * reflected XSS /qr.svg had, no `nosniff`, and /console — the page that
 * drives Launch — could be framed by any site (O25, 23 September 2026
 * sweep).
 *
 * THE DOCUMENT POLICY IS THE STRICTEST THE APP SATISFIES, FOUND BY AUDITING
 * THE PAGES: `script-src 'self'` with no 'unsafe-inline' — the five inline
 * module scripts moved to `/assets/page-shell.js` and the six inline
 * `onerror=` handlers are one capture-phase listener in client.js — so an
 * injected script cannot run. `style-src` keeps 'unsafe-inline' because the
 * console, the phones and the projector build markup with `style=""` in
 * hundreds of places, and an inline style cannot run script. Images and
 * media are the app's own, data: or blob: (the camera, the logos, the QR);
 * nothing loads from another host and nothing is fetched from one. An SVG —
 * the QR codes, the favicon, the placeholders — is sandboxed with
 * `script-src 'none'` wherever it is opened. `scripts/csp-clean.mjs` reads
 * every screen's console for a violation; a policy that breaks the projector
 * or a phone is worse than none.
 */
export const DOCUMENT_CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'";
export const IMAGE_CSP = "sandbox; script-src 'none'";
export function secure(headers = {}) {
  const type = String(headers['Content-Type'] || headers['content-type'] || '');
  const out = { 'X-Content-Type-Options': 'nosniff', ...headers };
  if (type.startsWith('text/html')) {
    out['Content-Security-Policy'] = DOCUMENT_CSP;
    out['X-Frame-Options'] = 'DENY';
    out['Referrer-Policy'] = 'same-origin';
  } else if (type.startsWith('image/svg')) {
    out['Content-Security-Policy'] = IMAGE_CSP;
  }
  return out;
}

export function send(res, status, body, headers = {}) {
  res.writeHead(status, secure({ 'Cache-Control': 'no-store', ...headers }));
  res.end(body);
}

export function sendJson(res, status, data) {
  if (status >= 400) noteRefusal(res, status, data);
  send(res, status, JSON.stringify(data), { 'Content-Type': 'application/json; charset=utf-8' });
}

/*
 * A REFUSAL IS A LINE IN THE FLIGHT RECORDER, whatever route sent it.
 *
 * One hook here rather than a note in each of two hundred routes, so the next
 * route written is covered. The room comes off `res.flightRoom`, which the
 * host and phone routes set the moment they resolve one — a 409 on a launch
 * and a refused answer both land under the night they happened on. Two kinds
 * of noise are left out by name: the 401 every signed-out page load takes
 * from `/api/me`, and 404s off the static tree.
 */
const QUIET_REFUSALS = new Set(['/api/me', '/api/has-accounts', '/api/brand']);
function noteRefusal(res, status, data) {
  try {
    const req = res.req;
    const route = req && req.url ? req.url.split('?')[0] : '';
    if (status === 401 && QUIET_REFUSALS.has(route)) return;
    if (status === 404 && !route.startsWith('/api/')) return;
    const why = data && typeof data.error === 'string' ? data.error : '';
    flight.note('http', `${status} ${req ? req.method : ''} ${route}`, {
      room: res.flightRoom || null, level: status >= 500 ? 'fail' : 'warn', data: why || null,
    });
  } catch { /* the recorder must never be the thing that throws */ }
}

/** Raw bytes, refused rather than truncated once they go over the limit. */
export async function readBody(req, limitBytes) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > limitBytes) throw new Error('Body too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * A request body, and NOTHING here may throw its way to a 500.
 *
 * Every phone route is open by design — a phone has no login — so the bodies
 * arriving at them are whatever the room, a flaky mobile connection or a venue
 * proxy sends. A fuzz of 145 malformed bodies produced **26 unhandled 500s**:
 * `JSON.parse` throwing on a truncated body, and — the sneakier half — bodies
 * that are perfectly valid JSON but are not OBJECTS (`null`, `[]`, `42`), which
 * parse fine and then blow up on the first property read.
 *
 * A 500 is not fatal here (the top-level catch keeps the server up) but it is
 * the wrong answer: it tells a phone nothing, and it is indistinguishable in
 * the log from a real fault on a night when something IS wrong.
 */
/**
 * WHERE A REQUEST CAME FROM, for the one route that counts them.
 *
 * Behind Render there is a proxy, so the socket's own address is the proxy's
 * and the caller is the first entry of `x-forwarded-for`. That header is
 * spoofable, and it does not matter here: this feeds a courtesy limit on
 * signups, not an authorisation decision. **Nothing in this app authorises by
 * address** — a token does that (rule 3), and a pub puts the whole room behind
 * one router anyway (rule 4).
 */
export function callerOf(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.socket?.remoteAddress || 'unknown';
}

/**
 * IS THIS A LOCAL RUN RATHER THAN THE DEPLOYED APP?
 *
 * A forwarding header at all means something is in front of us, so this is
 * deployed; without one, only loopback counts. Used to decide whether a
 * password link may come back in a response body at all — see `/api/signup`.
 * Deliberately NOT an environment variable: one somebody forgets to set fails
 * in the insecure direction.
 */
export function isLocalRequest(req) {
  if (String(req.headers['x-forwarded-for'] || '').trim()) return false;
  const at = req.socket?.remoteAddress || '';
  return at === '127.0.0.1' || at === '::1' || at === '::ffff:127.0.0.1';
}

/*
 * HOW MANY ACCOUNTS ONE PLACE MAY CREATE IN AN HOUR.
 *
 * **A SAFETY NUMBER, like `MAX_TEAMS` and `MAX_SEATS`, not a design one.** Five
 * is far above anything honest — a quiz company signing its hosts up one by one
 * is the busiest real case and that is a handful over a Monday, not five in an
 * hour — and far below what a script does. It is in memory on purpose: a
 * restart forgiving everybody is the right failure for a courtesy limit.
 */
export const SIGNUPS_PER_HOUR = 5;
export const SIGNUP_WINDOW_MS = 3_600_000;
export const signupsSeen = new Map();

export function signupAllowed(req) {
  return allowedFrom(signupsSeen, req, SIGNUPS_PER_HOUR, SIGNUP_WINDOW_MS);
}

/*
 * HOW MANY SIGN-IN ATTEMPTS ONE PLACE MAY MAKE, AND HOW MANY HASHES RUN AT ONCE.
 *
 * **SAFETY NUMBERS, like the one above.** A password check is ~40ms of scrypt,
 * and with no door at all 120 wrong passwords from one script froze `/health`
 * for five seconds — one server hosts every room, so that was every projector
 * and every phone in every pub. Twenty attempts in ten minutes is far above a
 * human who has forgotten a password (the sign-in link is one press away) and
 * far below a script. The second number caps hashes in the thread pool at
 * once, whatever address they claim: `x-forwarded-for` is spoofable, and the
 * pool is what serves every static file. Refused BEFORE any hash runs, with a
 * sentence — nobody signing in is mid-gig, so a 429 costs nobody a night.
 */
export const SIGN_INS_PER_WINDOW = 20;
export const SIGN_IN_WINDOW_MS = 600_000;
export const SIGN_INS_AT_ONCE = 8;
export const signInsSeen = new Map();
let signInsRunning = 0;

export function signInAllowed(req) {
  return allowedFrom(signInsSeen, req, SIGN_INS_PER_WINDOW, SIGN_IN_WINDOW_MS);
}

/** A seat at the sign-in desk, or null when the pool is full. Call what it returns when done. */
export function signInSeat() {
  if (signInsRunning >= SIGN_INS_AT_ONCE) return null;
  signInsRunning += 1;
  return () => { signInsRunning -= 1; };
}

function allowedFrom(seen, req, cap, windowMs) {
  const who = callerOf(req);
  const now = Date.now();
  const recent = (seen.get(who) || []).filter((at) => now - at < windowMs);
  if (recent.length >= cap) {
    seen.set(who, recent);
    return false;
  }
  recent.push(now);
  seen.set(who, recent);
  /*
   * AND THE MAP MAY NOT GROW WITH THE INTERNET. `rooms.get()` never evicting
   * turned an open URL into a memory leak once; a counter keyed on a spoofable
   * header is the same shape, so anything with nothing left in its window goes.
   */
  if (seen.size > 5000) {
    for (const [key, at] of seen) {
      if (!at.some((t) => now - t < windowMs)) seen.delete(key);
    }
  }
  return true;
}

export async function readJson(req, limitBytes = 1024 * 1024) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > limitBytes) throw Object.assign(new Error('That request was too big.'), { badRequest: true });
    chunks.push(chunk);
  }
  if (!total) return {};

  let parsed;
  try {
    parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('That request was not valid JSON.'), { badRequest: true });
  }
  // Not an object means there are no fields to read, and every route here
  // reads fields. An empty one behaves exactly like a missing body.
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
}

/** The address the QR code should point at. */
export function publicOrigin(req) {
  /*
   * ON THE DJ SET'S OWN DOMAIN, THE VISITOR'S HOST WINS OVER `PUBLIC_URL`.
   *
   * `PUBLIC_URL` pins the origin, which is right when a service answers on
   * ONE domain — and silently wrong the moment it answers on two. The join QR
   * on the DJ screen is the entire product: pinned, it would send a room
   * standing in front of `dj.pubchampions.co.uk` to the QUIZ domain, where
   * they would land on somebody else's branding and, on a phone with no
   * cookie, on a sign-in page.
   *
   * Nothing changes for a pub night: the check is false on every host but the
   * one `DJ_HOST` names, and false always when it is unset.
   */
  if (config.publicUrl && !onDjHost(req)) return config.publicUrl.replace(/\/+$/, '');
  const proto = (req.headers['x-forwarded-proto'] || '').split(',')[0].trim() || 'http';
  const host = (req.headers['x-forwarded-host'] || req.headers.host || `localhost:${config.port}`).split(',')[0].trim();
  return `${proto}://${host}`;
}

/**
 * Where a phone should go to join a particular room.
 *
 * The house room gets the bare `/play` it has always had. That is not a
 * cosmetic choice: there are printed cards and bookmarks and a QR that has been
 * scanned at gigs, and every one of them says `/play`. Only the extra rooms
 * carry a code.
 */
/**
 * IS THIS REQUEST ON THE DJ SET'S OWN DOMAIN?
 *
 * One Render service can answer on several domains, and the two products on
 * it want different front doors. Compared against the FORWARDED host, because
 * behind Render's proxy `req.headers.host` is the internal one — the same
 * reasoning `publicOrigin()` above already runs on, and getting it wrong here
 * would simply mean the flag never fires.
 *
 * The port is stripped: a browser sends `host:443` on nothing, but a local
 * run sends `127.0.0.1:34207`, and a check that only works in production is
 * one nobody can test.
 */
export function onDjHost(req) {
  if (!config.djHost) return false;
  const host = (req.headers['x-forwarded-host'] || req.headers.host || '')
    .split(',')[0].trim().toLowerCase().replace(/:\d+$/, '');
  return Boolean(host) && host === config.djHost;
}

export function joinUrlFor(origin, code) {
  return code ? `${origin}/play?g=${encodeURIComponent(code)}` : `${origin}/play`;
}

/**
 * The host key: the way in before there were accounts.
 *
 * Still works, and deliberately still works. There are gigs in the diary and
 * a printed `?key=…` on somebody's phone, so the day accounts arrived could not
 * be the day the old way stopped. A request carrying the key is treated as the
 * owner wearing every hat at once — see `whoIs`.
 *
 * It is transitional. Once the owner and quizmaster accounts are set up and
 * signed in, HOST_KEY can be retired by removing this and the branch in
 * `whoIs` that uses it. Nothing else knows about it.
 */
export function isHostKey(req, url) {
  const supplied = req.headers['x-host-key'] || url.searchParams.get('key') || '';
  return timingSafeEqual(String(supplied), HOST_KEY);
}

