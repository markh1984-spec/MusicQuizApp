/**
 * HTTP PLUMBING — send, read, origins. Moved whole from server.js.
 */
import { HOST_KEY, config, http } from './context.js';
import { timingSafeEqual } from './gates.js';

// ----------------------------------------------------------------- helpers

export function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}

export function sendJson(res, status, data) {
  send(res, status, JSON.stringify(data), { 'Content-Type': 'application/json; charset=utf-8' });
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
  const who = callerOf(req);
  const now = Date.now();
  const recent = (signupsSeen.get(who) || []).filter((at) => now - at < SIGNUP_WINDOW_MS);
  if (recent.length >= SIGNUPS_PER_HOUR) {
    signupsSeen.set(who, recent);
    return false;
  }
  recent.push(now);
  signupsSeen.set(who, recent);
  /*
   * AND THE MAP MAY NOT GROW WITH THE INTERNET. `rooms.get()` never evicting
   * turned an open URL into a memory leak once; a counter keyed on a spoofable
   * header is the same shape, so anything with nothing left in its window goes.
   */
  if (signupsSeen.size > 5000) {
    for (const [key, seen] of signupsSeen) {
      if (!seen.some((at) => now - at < SIGNUP_WINDOW_MS)) signupsSeen.delete(key);
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

