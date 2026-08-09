/**
 * The game server.
 *
 * One small always-on Node process. No framework, no build step, no database:
 * game packs are JSON files, live state is one JSON file, and the realtime
 * channel is server-sent events. Fewer moving parts is the whole point —
 * every dependency is something that can break on a Wednesday night.
 *
 * It runs one game at a time — a music quiz or music bingo — chosen from the
 * console. The Session object hides which, so everything below this point
 * works the same either way.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

import { config, paths, hostKey, hostKeyIsTemporary } from './src/config.js';
import { Store } from './src/store.js';
import { Hub } from './src/sse.js';
import { Photos, MAX_BYTES } from './src/photos.js';
import { Session } from './src/session.js';
import { saveQuiz, deleteQuiz, validateQuiz, normaliseQuiz, loadQuiz, reviewWarnings, setWarningChecked, ROUND_TYPES } from './src/quizzes.js';
import { validateBingoPack, normaliseBingoPack, minimumTracks, CARD_SHAPES, shapeLabel, maxPrizes, stagePlan, stageLabel } from './src/bingo.js';
import { fullLibrary, listArchive, loadArchived, saveBingoPack, loadBingoPack, deleteBingoPack } from './src/library.js';
import { generateBingoPack } from './src/generate-bingo.js';
import { generateQuizPack, buildIntroPlaylists, roundPlan } from './src/generate-quiz.js';
import { importBingoPack } from './src/import-bingo.js';
import { listAdvertPacks, loadAdvertPack, saveAdvertPack, deleteAdvertPack, validateAdvertPack, normaliseAdvertPack } from './src/adverts.js';
import { generateImages, imageStatus, imageJobs, imagePlan, openaiConfigured } from './src/generate-images.js';
import { STYLES, findStyle, QUALITIES, DEFAULT_QUALITY } from './src/portraits.js';
import { recentTracks, forgetAll } from './src/history.js';
import { spotifyConfigured, missingSpotifyConfig } from './src/spotify.js';
import { getFile, githubConfigured, missingGithubConfig, putFile, deleteFile, checkAccess, photosRepoConfigured, photosRepoName, missingPhotoConfig, photoRepoProblem, privateRepoConfigured } from './src/github.js';
import { Invoices, totals, toPence, money } from './src/invoices.js';
import { invoicePdf, invoiceFilename } from './src/invoice-pdf.js';
import { toSvg } from './src/qrcode.js';
import { LOOKS } from './public/assets/looks.js';
import { Accounts } from './src/accounts.js';
import { Rooms, HOUSE, tidyCode } from './src/rooms.js';
import { FEATURES, whyNot, entitlements } from './public/assets/plans.js';
// The logo, shared with the browser so the tab icon and the on-screen mark are
// one drawing rather than two that look alike today.
import { faviconSvg } from './public/assets/brandmark.js';

const HOST_KEY = hostKey();
const hub = new Hub();
const invoices = new Invoices(paths.invoices);
const accounts = new Accounts(paths.accounts);

/*
 * One room per quizmaster.
 *
 * `session`, `store` and `photos` used to be module-level singletons, which is
 * exactly what made a second login unsafe: Rob pressing Launch would have
 * ended Mark's night mid-question. Everything that belongs to one night now
 * hangs off a room, and every request resolves which room it is talking about
 * before it touches a game. See src/rooms.js.
 *
 * The house room keeps the original file locations, so deploying this in the
 * middle of a season does not lose a game that is being played as it restarts.
 */
const rooms = new Rooms({ config, paths, onPush: (room) => pushState(room) });
rooms.get(HOUSE);

/**
 * Whether the GitHub backup actually works, not just whether it is configured.
 * Checked at most every five minutes so the console can say "token rejected"
 * up front rather than letting you find out after generating a quiz.
 */
let backupCheck = { at: 0, result: null };
async function backupStatus() {
  if (!githubConfigured()) return { ok: false, error: 'not set up' };
  if (backupCheck.result && Date.now() - backupCheck.at < 5 * 60 * 1000) return backupCheck.result;
  const result = await checkAccess();
  backupCheck = { at: Date.now(), result };
  return result;
}

// ------------------------------------------------------------- broadcasting

function viewFor(client) {
  // A client that arrived before its room existed, or whose room was never
  // booted, is shown the house game rather than nothing — the same silent
  // fallback a phone with no code gets.
  const room = client.room || rooms.get(HOUSE);
  const { session, photos } = room;
  const view = client.role === 'host' ? session.hostView()
    : client.role === 'player' ? session.playerView(client.playerId)
    : session.screenView();
  // The wall of photos rides along with whatever else is on screen, so it
  // survives every phase change and every game without each card knowing.
  if (client.role === 'screen') view.photos = photos.forScreen();
  else if (client.role === 'host') view.photos = { enabled: photos.enabled, count: photos.count(), items: photos.forHost() };
  else view.photosOpen = photos.enabled;
  // Your name travels with every payload, so a page never has to ask for it
  // separately or flash the wrong thing while it loads.
  view.brand = config.brandName;
  // Which game this is, so a phone that was handed a code can tell it reached
  // the right one and the projector can print it for latecomers.
  view.joinCode = room.code;
  return view;
}

const pushQueued = new Set();
function pushState(room) {
  // Coalesce: sixty phones answering at once is one broadcast, not sixty.
  // Queued PER ROOM, so a busy game in one room cannot swallow the push that
  // another room's question needed.
  const id = room ? room.id : HOUSE;
  if (pushQueued.has(id)) return;
  pushQueued.add(id);
  queueMicrotask(() => {
    pushQueued.delete(id);
    // Only the phones and screens watching THIS room. Broadcasting to everyone
    // would put one quizmaster's question on another's projector.
    hub.broadcast('state', viewFor, (client) => (client.room ? client.room.id : HOUSE) === id);
  });
}

// ----------------------------------------------------------------- helpers

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}

function sendJson(res, status, data) {
  send(res, status, JSON.stringify(data), { 'Content-Type': 'application/json; charset=utf-8' });
}

/** Raw bytes, refused rather than truncated once they go over the limit. */
async function readBody(req, limitBytes) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > limitBytes) throw new Error('Body too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function readJson(req, limitBytes = 1024 * 1024) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > limitBytes) throw new Error('Body too large');
    chunks.push(chunk);
  }
  if (!total) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

/** The address the QR code should point at. */
function publicOrigin(req) {
  if (config.publicUrl) return config.publicUrl.replace(/\/+$/, '');
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
function joinUrlFor(origin, code) {
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
function isHostKey(req, url) {
  const supplied = req.headers['x-host-key'] || url.searchParams.get('key') || '';
  return timingSafeEqual(String(supplied), HOST_KEY);
}

const SESSION_COOKIE = 'mmm_session';

/** One cookie out of a header, without pulling in a parser. */
function cookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const at = part.indexOf('=');
    if (at < 0) continue;
    if (part.slice(0, at).trim() === name) return decodeURIComponent(part.slice(at + 1).trim());
  }
  return '';
}

/**
 * Who is asking.
 *
 * A signed-in account, or the bootstrap host key, or nobody. The bootstrap
 * account is not written to disk and cannot sign in — it exists only so the
 * old `?key=` links keep working while the accounts are being set up.
 */
/**
 * Who is making this request.
 *
 * **The host key beats a signed-in account, deliberately, and the order here
 * matters more than it looks.** The owner account has no quiz controls at all —
 * that is the design, the owner writes and sells packs and does not run nights.
 * So on the one laptop that is both the dev machine and the gig machine,
 * signing in as the owner would otherwise take the Launch button away from the
 * `?key=` bookmark that has been running quiz nights for months. Minutes before
 * a gig, with no way back except signing out.
 *
 * It gives nothing away: the key already grants every feature in the app, so
 * preferring it cannot widen what the holder can do. It just means the way in
 * that predates accounts keeps working no matter what else is going on in the
 * browser, which is the whole reason it is still here.
 */
function whoIs(req, url) {
  if (isHostKey(req, url)) return BOOTSTRAP;
  const account = accounts.fromToken(cookie(req, SESSION_COOKIE));
  if (account) return account;
  return null;
}

/**
 * Which room this request is talking about.
 *
 * Two quite different questions, deliberately answered separately:
 *
 *  - A QUIZMASTER is working on their own room, always. It is decided by who
 *    they are signed in as and never by anything they send, so there is no
 *    parameter to tamper with and no way to drive somebody else's night.
 *  - A PHONE is told a code, off the projector. No code means the house room,
 *    which is what every QR printed before today says, so nothing Mark has
 *    already handed out or bookmarked stops working.
 */
function roomIdFor(account) {
  // The owner and the host key both run the house room: it is Mark's, and it is
  // the game that was already running before rooms existed.
  if (!account || account.bootstrap || account.role === 'owner') return HOUSE;
  return account.id;
}

function roomForHost(req, url) {
  const account = whoIs(req, url);
  return rooms.get(roomIdFor(account), account ? account.name || account.email : '');
}

function roomForPhone(req, url, body = null) {
  const code = tidyCode((body && body.joinCode) || url.searchParams.get('g') || '');
  if (!code) return rooms.get(HOUSE);
  return rooms.byCode(code) || rooms.get(HOUSE);
}

const BOOTSTRAP = {
  id: 'host-key',
  email: '',
  name: 'Host key',
  role: 'quizmaster',
  plan: 'basic',
  addons: ['admin', 'stream'],
  comped: true,
  status: 'active',
  bootstrap: true,
};

/**
 * The gate. Every route that is not for the room goes through here.
 *
 * Two answers rather than one: 401 means "sign in", 403 means "signed in, but
 * this is not on your plan" — and the 403 carries the reason in words, because
 * a locked door with no sign on it is how people decide an app is broken
 * rather than that they have not bought something.
 *
 * @param {boolean} [opts.live]  a running game rather than a new one. A failed
 *   payment must never black out a projector mid-question, so anything the
 *   control view and the live connection need asks with this set.
 */
function allowed(req, res, url, feature, { live = false } = {}) {
  const account = whoIs(req, url);
  if (!account) {
    sendJson(res, 401, { error: 'Sign in first', signIn: '/login' });
    return null;
  }
  // The bootstrap key is the owner with every hat on. Deliberately one branch,
  // in one place, so retiring it later is deleting these two lines.
  if (account.bootstrap) return account;

  const ok = live ? accounts.mayCarryOn(account, feature) : accounts.mayStartSomething(account, feature);
  if (!ok) {
    sendJson(res, 403, { error: whyNot(account, feature), feature });
    return null;
  }
  return account;
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

function serveFile(res, baseDir, relPath, { cache = false } = {}) {
  // Resolve and then check we are still inside the directory we meant.
  const full = path.resolve(baseDir, '.' + path.posix.normalize('/' + relPath));
  if (!full.startsWith(path.resolve(baseDir))) return send(res, 403, 'Forbidden');
  fs.readFile(full, (err, data) => {
    if (err) return send(res, 404, 'Not found');
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(full).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': cache ? 'public, max-age=3600' : 'no-cache',
    });
    res.end(data);
  });
}

// ------------------------------------------------------------------ routing

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const route = url.pathname;

  try {
    if (req.method === 'GET' || req.method === 'HEAD') {
      if (await handleGet(req, res, url, route)) return;
    } else if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
      if (await handleWrite(req, res, url, route)) return;
    }
    send(res, 404, 'Not found');
  } catch (err) {
    console.error('[http]', req.method, route, err.message);
    if (!res.headersSent) sendJson(res, 500, { error: err.message });
    else res.end();
  }
});

async function handleGet(req, res, url, route) {
  // ---- pages
  if (route === '/' ) {
    send(res, 302, '', { Location: '/screen' });
    return true;
  }
  if (route === '/screen') return serveFile(res, config.publicDir, 'screen.html'), true;
  if (route === '/play') return serveFile(res, config.publicDir, 'play.html'), true;
  if (route === '/host') return serveFile(res, config.publicDir, 'host.html'), true;
  if (route === '/editor') return serveFile(res, config.publicDir, 'editor.html'), true;
  if (route === '/console') return serveFile(res, config.publicDir, 'console.html'), true;
  if (route === '/login') return serveFile(res, config.publicDir, 'login.html'), true;
  if (route === '/owner') return serveFile(res, config.publicDir, 'owner.html'), true;
  /*
   * The tab icon: the same record that is in the top left of every screen,
   * from the same drawing, so the two cannot drift apart.
   *
   * SVG rather than a .ico because there is no build step here to make one,
   * and every browser worth worrying about has taken SVG favicons since 2022.
   * A browser that has not simply shows its default, which is what it showed
   * before this existed.
   */
  if (route === '/favicon.svg') {
    return send(res, 200, faviconSvg(), {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    }), true;
  }
  if (route === '/health') {
    const house = rooms.get(HOUSE);
    return sendJson(res, 200, { ok: true, game: house.session.kind, phase: house.session.engine.state.phase, rooms: rooms.all().length }), true;
  }

  // ---- static
  if (route.startsWith('/assets/')) {
    return serveFile(res, config.publicDir, route), true;
  }
  if (route.startsWith('/quiz-images/')) {
    const rel = decodeURIComponent(route.slice('/quiz-images/'.length));
    // If the real artwork is not there yet, fall back to a placeholder of the
    // same name. That way a quiz pack can name its final .png files from the
    // start and still be rehearsable before any images have been made.
    const swap = rel.replace(/\.(png|jpg|jpeg|webp)$/i, '.svg');
    const exists = fs.existsSync(path.join(config.imageDir, rel));
    return serveFile(res, config.imageDir, exists ? rel : swap, { cache: true }), true;
  }

  /*
   * Serving a photo. Only a filename the app itself issued is ever looked up,
   * so nothing from the request reaches the filesystem as a path.
   *
   * No key on this one — it has to load on the projector, which has no key,
   * and the whole point is that the room can see them.
   */
  if (route.startsWith('/photos/')) {
    // Every room's wall, because the URL carries only the filename the app
    // itself issued. The name is unique across rooms (it has the timestamp and
    // a counter in it), and a projector has no session to tell us whose it is.
    const wanted = decodeURIComponent(route.slice('/photos/'.length));
    let full = null;
    for (const room of rooms.all()) {
      full = room.photos.fileFor(wanted);
      if (full) break;
    }
    if (!full) return send(res, 404, 'Not found'), true;
    return fs.readFile(full, (err, data) => {
      if (err) return send(res, 404, 'Not found');
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(full).toLowerCase()] || 'image/jpeg',
        'Cache-Control': 'public, max-age=3600',
      });
      res.end(data);
    }), true;
  }

  // Everything from the night in one go, for the social posts afterwards.
  // The night's photos as a list. NOT a download yet — getting them off in one
  // go still has to be built, and a route called .zip that hands back JSON is
  // the kind of thing somebody trusts at the wrong moment.
  if (route === '/api/photos/list') {
    if (!allowed(req, res, url, FEATURES.PHOTOS)) return true;
    const { photos } = roomForHost(req, url);
    return sendJson(res, 200, {
      enabled: photos.enabled,
      count: photos.count(),
      unfiled: photos.unfiled().length,
      repo: photosRepoName(),
      repoReady: photosRepoConfigured(),
      // Which variable is actually missing, and whether one that IS set looks
      // wrong. "It says temporary" is not something anybody can act on.
      missing: missingPhotoConfig(),
      repoProblem: photoRepoProblem(),
      // Proof the app can see a value at all, without printing a token.
      seen: {
        PHOTO_REPO: Boolean(process.env.PHOTO_REPO),
        PHOTO_BRANCH: process.env.PHOTO_BRANCH || '(default: main)',
        PHOTO_TOKEN: Boolean(process.env.PHOTO_TOKEN),
        GITHUB_TOKEN: Boolean(process.env.GITHUB_TOKEN),
      },
      nights: photos.nights(),
    }), true;
  }

  // ---- the join QR
  if (route === '/join-qr.svg') {
    // The code of the room asking for it, so a phone that scans Rob's
    // projector joins Rob's game. The house room has no code and its QR is the
    // plain /play it has always been, so every printed card still works.
    const room = roomForPhone(req, url) ;
    const target = joinUrlFor(publicOrigin(req), room.code);
    send(res, 200, toSvg(target, { margin: 2, dark: '#0b0b12', light: '#ffffff' }), {
      'Content-Type': 'image/svg+xml; charset=utf-8',
    });
    return true;
  }
  // A general-purpose QR, ready for the Instagram code on the lobby screen.
  if (route === '/qr.svg') {
    const text = url.searchParams.get('text') || publicOrigin(req);
    send(res, 200, toSvg(text, { margin: 2, dark: url.searchParams.get('dark') || '#0b0b12', light: url.searchParams.get('light') || '#ffffff' }), {
      'Content-Type': 'image/svg+xml; charset=utf-8',
    });
    return true;
  }

  // ---- realtime
  if (route === '/api/stream') {
    const role = url.searchParams.get('role') || 'screen';
    // The projector and the phones are open by design; only the control view
    // is not. Asked with `live` set, because this is the connection a running
    // game hangs off and a failed payment must not cut it.
    if (role === 'host' && !allowed(req, res, url, FEATURES.QUIZ, { live: true })) return true;
    const playerId = url.searchParams.get('playerId') || null;
    // The control view drives the room of whoever is signed in; a projector or
    // a phone follows the code it was given.
    const room = role === 'host' ? roomForHost(req, url) : roomForPhone(req, url);
    if (playerId) room.session.engine.touch(playerId);
    const client = hub.add(res, { role, playerId, room });
    hub.send(client, 'state', viewFor(client));
    return true;
  }

  // ---- info
  if (route === '/api/join-url') {
    const room = roomForPhone(req, url);
    return sendJson(res, 200, {
      url: joinUrlFor(publicOrigin(req), room.code),
      code: room.code,
      brand: config.brandName,
    }), true;
  }
  /*
   * ---- signing in
   *
   * Open, obviously — it is the way in. The token goes in an httpOnly cookie so
   * a script on the page cannot read it, and SameSite=Lax so another site
   * cannot spend it. `secure` only when the request actually arrived over
   * https, or a laptop on http://localhost could never sign in.
   */
  if (route === '/api/owner/accounts') {
    if (!allowed(req, res, url, FEATURES.SUBSCRIBERS)) return true;
    return sendJson(res, 200, { accounts: subscriberList(), backupReady: privateRepoConfigured() }), true;
  }

  /*
   * Are there accounts on this app at all?
   *
   * Open, and deliberately says nothing more than yes or no — it exists so the
   * console can tell "sign in" apart from "type the host key", which are very
   * different pieces of advice to give somebody locked out five minutes before
   * a gig. It reveals no email address and no count.
   */
  if (route === '/api/has-accounts') {
    return sendJson(res, 200, { any: accounts.all.length > 0 }), true;
  }

  if (route === '/api/me') {
    const account = whoIs(req, url);
    if (!account) return sendJson(res, 200, { signedIn: false }), true;
    return sendJson(res, 200, {
      signedIn: true,
      account: { ...account, entitlements: entitlements(account) },
      // Said out loud, because a bootstrap session looks exactly like a real
      // one until something it cannot do goes wrong.
      bootstrap: Boolean(account.bootstrap),
    }), true;
  }

  // Open, because the join page needs it before anybody has joined.
  if (route === '/api/brand') {
    return sendJson(res, 200, { name: config.brandName }), true;
  }
  if (route === '/api/state') {
    const role = url.searchParams.get('role') || 'screen';
    // The projector and the phones are open by design; only the control view
    // is not. Asked with `live` set, because this is the connection a running
    // game hangs off and a failed payment must not cut it.
    if (role === 'host' && !allowed(req, res, url, FEATURES.QUIZ, { live: true })) return true;
    const room = role === 'host' ? roomForHost(req, url) : roomForPhone(req, url);
    return sendJson(res, 200, viewFor({ role, playerId: url.searchParams.get('playerId'), room })), true;
  }

  // ---- host-only reads
  if (route === '/api/quizzes') {
    if (!allowed(req, res, url, FEATURES.LIBRARY)) return true;
    return sendJson(res, 200, { quizzes: fullLibrary(config).quizzes, loaded: roomForHost(req, url).session.pack.id }), true;
  }
  // The console's library: every quiz and every bingo pack you have saved.
  if (route === '/api/library') {
    if (!allowed(req, res, url, FEATURES.LIBRARY)) return true;
    const library = fullLibrary(config);
    const backup = await backupStatus();
    const { session } = roomForHost(req, url);
    const me = whoIs(req, url);
    return sendJson(res, 200, {
      brand: config.brandName,
      ...library,
      adverts: listAdvertPacks(config.advertDir),
      // How many tracks each card size wants, straight from the rule itself so
      // the console can size a pasted list without keeping its own copy of the
      // sum and drifting from it.
      // The card shapes on offer, with what each needs, straight from the rules
      // themselves so the console keeps no copy of the sum to drift from.
      cardShapes: CARD_SHAPES.map((shape) => ({
        ...shape,
        label: shapeLabel(shape),
        minimum: minimumTracks(shape),
        // How many prizes this shape can carry, and what each of them is, so
        // the console can offer the right ones without doing the sums itself.
        maxPrizes: maxPrizes(shape),
        plans: Array.from({ length: maxPrizes(shape) }, (_, i) => stagePlan(i + 1).map(stageLabel)),
      })),
      // Your own room, and only ever your own — Stop and Take control on this
      // panel must never reach somebody else's night.
      running: {
        room: roomIdFor(me),
        joinCode: roomForHost(req, url).code,
        game: session.kind,
        packId: session.pack.id,
        title: session.pack.title,
        phase: session.engine.state.phase,
        // Optional on an engine — a new game that has not written one still
        // shows up in the console, it just says less about itself.
        at: typeof session.engine.where === 'function' ? session.engine.where() : '',
        playerCount: session.engine.playerList().length,
        // The console offers to invoice for a night that has actually ended,
        // and only then — an invoice raised in the middle of round two is a
        // mis-tap, not a decision.
        finished: session.engine.state.phase === 'final' || Boolean(session.engine.state.finishedAt),
      },
      // What every OTHER room is doing, owner only. Not so it can be driven
      // from here — it cannot, and deliberately — but so the owner can see at a
      // glance that somebody is mid-question before deploying over them.
      otherRooms: me && me.role === 'owner'
        ? rooms.summaries().filter((r) => r.id !== roomIdFor(me))
        : [],
      archive: listArchive(config.dataDir),
      // Offered on every pack card, so a night can be dressed up without
      // editing anything.
      looks: LOOKS.map(({ id, label, blurb }) => ({ id, label, blurb })),
      // Just the totals, so the Invoices tab can wear a badge saying how many
      // are still unpaid. The invoices themselves are never in this payload.
      invoicing: invoices.summary(),
      generation: {
        claude: Boolean(process.env.ANTHROPIC_API_KEY),
        openai: openaiConfigured(),
        spotify: spotifyConfigured(),
        spotifyMissing: missingSpotifyConfig(),
        recentCount: recentTracks(config.dataDir, 3).length,
        backup: backup.ok,
        backupConfigured: githubConfigured(),
        backupError: backup.ok ? null : backup.error,
        backupRepo: backup.repo || null,
        backupMissing: missingGithubConfig(),
      },
    }), true;
  }
  if (route.startsWith('/api/advert/')) {
    if (!allowed(req, res, url, FEATURES.LIBRARY)) return true;
    const id = decodeURIComponent(route.slice('/api/advert/'.length));
    try {
      return sendJson(res, 200, loadAdvertPack(config.advertDir, id)), true;
    } catch (err) {
      return sendJson(res, 404, { error: err.message }), true;
    }
  }

  // What round 2 actually has on disk: real portraits, stand-ins, or nothing.
  // Read before spending anything, so the panel can say what it is about to do.
  if (route.startsWith('/api/images/')) {
    if (!allowed(req, res, url, FEATURES.LIBRARY)) return true;
    const id = decodeURIComponent(route.slice('/api/images/'.length));
    const style = findStyle(url.searchParams.get('style') || '');
    try {
      const quiz = loadQuiz(config.quizDir, id);
      return sendJson(res, 200, {
        ...imageStatus(quiz, config.imageDir),
        openai: openaiConfigured(),
        // What pressing the button would actually cost, given what the shared
        // library already holds. This is the number that shows the sharing
        // working, so it is read before anything is spent, not reported after.
        plan: imagePlan(quiz, config.imageDir, { style }),
        styles: Object.entries(STYLES).map(([sid, st]) => ({ id: sid, label: st.label, hint: st.hint })),
        style,
        qualities: QUALITIES,
        defaultQuality: DEFAULT_QUALITY,
        questions: imageJobs(quiz, { style }).map(({ q, musician, wants }) => ({
          id: q.id,
          answer: q.options[q.correctIndex],
          image: q.image,
          musician,
          wants,
          real: fs.existsSync(path.join(config.imageDir, q.image)),
          inLibrary: fs.existsSync(path.join(config.imageDir, wants)),
        })),
      }), true;
    } catch (err) {
      return sendJson(res, 404, { error: err.message }), true;
    }
  }
  if (route.startsWith('/api/bingo/')) {
    if (!allowed(req, res, url, FEATURES.LIBRARY)) return true;
    const id = decodeURIComponent(route.slice('/api/bingo/'.length));
    try {
      return sendJson(res, 200, normaliseBingoPack(loadBingoPack(config.bingoDir, id), id)), true;
    } catch (err) {
      return sendJson(res, 404, { error: err.message }), true;
    }
  }
  // What the generator is currently refusing to reuse.
  if (route === '/api/history') {
    if (!allowed(req, res, url, FEATURES.LIBRARY)) return true;
    const months = Number(url.searchParams.get('months')) || 3;
    return sendJson(res, 200, { months, tracks: recentTracks(config.dataDir, months) }), true;
  }
  /*
   * ---- invoicing
   *
   * All of it behind the host key, and none of it in any player or screen
   * payload. Customer addresses and your own bank details have no business
   * being one mistyped URL away from a room full of phones.
   *
   * The PDF route comes first because the catch-all below it would otherwise
   * read "MMM-0001.pdf" as an invoice number.
   */
  if (route.startsWith('/api/invoices/') && route.endsWith('.pdf')) {
    if (!allowed(req, res, url, FEATURES.LIBRARY)) return true;
    const number = decodeURIComponent(route.slice('/api/invoices/'.length, -4));
    const invoice = invoices.find(number);
    if (!invoice) return sendJson(res, 404, { error: 'No invoice with that number' }), true;
    const pdf = invoicePdf(invoice);
    // `inline` so tapping it on a phone opens a preview to check before
    // sending, rather than dropping a file into Downloads unseen.
    res.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${invoiceFilename(invoice)}"`,
      'Cache-Control': 'no-store',
    });
    return res.end(pdf), true;
  }

  if (route === '/api/invoices' && req.method === 'GET') {
    if (!allowed(req, res, url, FEATURES.INVOICES)) return true;
    return sendJson(res, 200, invoiceState()), true;
  }

  if (route.startsWith('/api/archive/')) {
    if (!allowed(req, res, url, FEATURES.INVOICES)) return true;
    const id = decodeURIComponent(route.slice('/api/archive/'.length));
    try {
      return sendJson(res, 200, loadArchived(config.dataDir, id)), true;
    } catch (err) {
      return sendJson(res, 404, { error: err.message }), true;
    }
  }
  if (route.startsWith('/api/quiz/')) {
    if (!allowed(req, res, url, FEATURES.LIBRARY)) return true;
    const id = decodeURIComponent(route.slice('/api/quiz/'.length));
    try {
      const quiz = loadQuiz(config.quizDir, id);
      return sendJson(res, 200, { ...quiz, reviewWarnings: reviewWarnings(quiz), problems: validateQuiz(quiz) }), true;
    } catch (err) {
      return sendJson(res, 404, { error: err.message }), true;
    }
  }
  if (route === '/api/results.json') {
    if (!allowed(req, res, url, FEATURES.LIBRARY)) return true;
    return sendJson(res, 200, roomForHost(req, url).session.results()), true;
  }
  if (route === '/api/results.csv') {
    if (!allowed(req, res, url, FEATURES.LIBRARY)) return true;
    const { session } = roomForHost(req, url);
    const results = session.results();
    const rows = session.kind === 'bingo'
      ? [['Team', 'Squares away', 'False calls', 'Won'], ...results.leaderboard.map((p) => [p.name, p.away, p.falseCalls, p.won ? 'yes' : ''])]
      : [['Position', 'Team', 'Score', 'Correct', 'Answered'], ...results.leaderboard.map((p) => [p.position, p.name, p.score, p.correctCount, p.answeredCount])];
    const csv = rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
    return send(res, 200, csv, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="quiz-results.csv"`,
    }), true;
  }

  return false;
}

/**
 * File a pack into the repository so it survives a restart.
 *
 * Never throws and never blocks what you were doing — a failed backup is
 * reported and moved on from, because losing the pack you just made because
 * the backup failed would be daft.
 */
/**
 * Open a streaming progress response, and keep it open.
 *
 * Generation spends a minute or more inside one Claude call with nothing to
 * report. Write nothing for that long and something between here and the
 * browser — a proxy, a load balancer, the free tier — is entitled to hang up,
 * and then the console is left holding a stream that ended with no result.
 * That is exactly what it looked like from the host's side: the log stopped at
 * "writing 15 questions…" and never said another word.
 *
 * So a PING goes down the wire every fifteen seconds. The console skips them.
 */
function progressStream(res) {
  res.writeHead(200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'X-Accel-Buffering': 'no',
  });
  const write = (line) => { try { res.write(line + '\n'); } catch { /* client left */ } };
  const beat = setInterval(() => write('PING'), 15_000);
  if (beat.unref) beat.unref();
  return {
    log: write,
    end() { clearInterval(beat); res.end(); },
  };
}

async function backUp(relPath, contents, message, log = () => {}) {
  if (!githubConfigured()) {
    log(`not backed up — GitHub backup is not set up, so this will be lost when the app restarts`);
    return { ok: false };
  }
  const result = await putFile(relPath, contents, message);
  log(result.ok
    ? `backed up to GitHub — this one is permanent`
    : `saved here, but NOT backed up: ${result.error}`);
  return result;
}

/**
 * Back up the no-repeats memory.
 *
 * It matters as much as the pack it came with. Without it the rule quietly
 * forgets everything on the next restart, and the app then cheerfully hands a
 * regular the same forty songs it gave them last month — with nothing on screen
 * to say anything went wrong.
 *
 * Every route that adds to the history calls this. Generating did; IMPORTING
 * DID NOT, which was invisible right up until importing became the main way
 * packs get made.
 *
 * Never throws: the pack is already saved by this point and a GitHub problem
 * must not turn a finished job into a failed one.
 */
/**
 * Back up the invoice book.
 *
 * To the PRIVATE repository, never the main one. The main one is public, and
 * this file holds customer addresses and the host's own sort code and account
 * number — committing that to a public repo is not something you can undo,
 * because git history is forever. Same reasoning as the photos, same repo.
 *
 * There is no persistent disk on the free tier, so without this an invoice
 * survives exactly until the next deploy. That is why every route that changes
 * anything reports `backedUp` and the console says so out loud: an invoice you
 * think you have a record of and do not is worse than no record at all.
 */
async function backUpInvoices() {
  if (!privateRepoConfigured()) return { ok: false, error: 'no private repo set up' };
  try {
    return await putFile('invoicing.json', invoices.serialise(), 'Update invoices', 'private');
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Back up the accounts.
 *
 * To the PRIVATE repository, for the same reason as the invoices and more so:
 * this file is every subscriber's email address, their password hash and their
 * payment reference. The main repo is public and git history is forever.
 */
async function backUpAccounts() {
  if (!privateRepoConfigured()) return { ok: false, error: 'no private repo set up' };
  try {
    return await putFile('accounts.json', accounts.serialise(), 'Update accounts', 'private');
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Bring the accounts and the invoice book back from the private repository.
 *
 * This is the other half of a mechanism that was only ever half built: both
 * files were backed up faithfully and nothing ever read them again. On Render's
 * free tier there is no permanent disk, so `data/` is empty on every boot — the
 * login you made last week had quietly stopped existing, and the only clue was
 * being asked to sign in again.
 *
 * Only ever restores into an EMPTY file. Reading a backup over live data would
 * sign everybody out and could roll a password change back to the one before
 * it, so a disk that already has accounts on it always wins.
 *
 * Deliberately not fatal. A missing backup is the normal first boot, and a
 * GitHub that is having a bad morning must not stop a quiz night starting — the
 * host key still works either way.
 */
async function restoreFromBackup() {
  if (!privateRepoConfigured()) {
    if (!accounts.all.length) {
      console.warn('[accounts] no accounts and no private repo configured — the host key is the only way in.');
    }
    return;
  }
  if (!accounts.all.length) {
    const saved = await getFile('accounts.json', 'private');
    if (saved) {
      const result = accounts.restore(saved.toString('utf8'));
      if (result.ok) console.log(`[accounts] restored ${result.accounts} account(s) from the private repository`);
      else console.warn('[accounts] could not restore the backup:', result.reason);
    } else {
      console.log('[accounts] nothing backed up yet — this is a first boot, or nobody has been added.');
    }
  }
  // NOT the invoice book yet. It is backed up the same way and has the same
  // hole, but restoring it needs a little care about invoice NUMBERS — they are
  // sequential and never reused, so a restore that lost the counter would hand
  // out a number twice. That is its own job, not a line here.
}

/** What the owner console lists. Never a hash, and never a session token. */
function subscriberList() {
  return accounts.all
    .filter((a) => a.role === 'quizmaster')
    .map((a) => ({
      ...accounts.view(a),
      supportOpen: accounts.supportOpen(a.id),
    }));
}

/** Everything the invoices tab draws itself from. */
function invoiceState() {
  return {
    settings: invoices.settings,
    customers: invoices.customers,
    invoices: invoices.invoices.map(withTotals),
    summary: invoices.summary(),
    // Reported separately from anything else, because this is the one that
    // quietly loses a year of records on a redeploy.
    backupReady: privateRepoConfigured(),
  };
}

/** The sums travel with the invoice so the browser never adds money up. */
function withTotals(invoice) {
  return { ...invoice, totals: totals(invoice) };
}

/**
 * Read a draft off the wire.
 *
 * Money arrives as whatever was typed into a box — "350", "£350.00", "1,250.50"
 * — and becomes integer pence here, at the edge, so nothing past this point
 * has to wonder. A line whose amount cannot be read is refused rather than
 * quietly counted as nothing.
 */
function readDraft(body = {}) {
  const lines = (Array.isArray(body.lines) ? body.lines : []).map((line, i) => {
    const pence = toPence(line.amountPence ?? line.amount);
    if (pence === null) throw new Error(`Line ${i + 1}: "${line.amount ?? ''}" is not an amount.`);
    return { description: String(line.description || ''), amountPence: pence };
  });
  const deposit = body.deposit || body.depositPence ? toPence(body.depositPence ?? body.deposit) : 0;
  if (deposit === null) throw new Error(`"${body.deposit}" is not an amount.`);
  return {
    customerId: String(body.customerId || ''),
    toName: body.toName,
    toContact: body.toContact,
    toAddress: body.toAddress,
    toEmail: body.toEmail,
    event: body.event || {},
    lines,
    depositPence: deposit,
    notes: body.notes,
  };
}

async function backUpHistory(log = () => {}) {
  try {
    const historyFile = path.join(config.dataDir, 'track-history.json');
    if (!fs.existsSync(historyFile)) return { ok: false };
    const result = await backUp('data/track-history.json', fs.readFileSync(historyFile, 'utf8'), 'Update song history', () => {});
    log(result.ok
      ? 'song history pushed to GitHub'
      : `song history NOT pushed: ${result.error || 'GitHub backup is not set up'}`);
    return result;
  } catch (err) {
    log('could not back up the song history: ' + err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Put one photo in the private repository, foldered by night.
 *
 * Never throws and never blocks a response: a failure here means the photo is
 * still on screen and still on this server, just not yet permanent. It is
 * retried by the "file the rest away" button rather than in a loop, because a
 * loop on a bad token would hammer GitHub all night for nothing.
 */
async function fileAway(room, photo) {
  if (!photosRepoConfigured()) return { ok: false };
  const { photos } = room;
  const read = photos.read(photo.id);
  if (!read) return { ok: false };
  const result = await putFile(
    `photos/${photo.night}/${photo.file}`,
    read.bytes,
    `${photo.night}${photo.teamName ? ` — ${photo.teamName}` : ''}`,
    'photos',
  );
  if (result.ok) {
    photos.markFiled(photo.id);
    pushState(room);
  } else {
    console.warn('[photos] could not file one away:', result.error);
  }
  return result;
}

/**
 * Reload a quiz pack in every room that is currently playing it.
 *
 * The library is shared, so one save can affect more than one live game. It
 * used to reload "the" session because there was only ever one; missing a room
 * here would leave that quizmaster running the version from before the edit,
 * which is the sort of thing you only discover when the answer on the
 * projector disagrees with the one on the host's phone.
 */
function reloadPackEverywhere(id, { clamp = true } = {}) {
  let touched = 0;
  for (const room of rooms.all()) {
    const { session } = room;
    if (session.kind !== 'quiz' || session.pack?.id !== id) continue;
    session.pack = loadQuiz(config.quizDir, id);
    session.engine.quiz = session.pack;
    if (clamp) session.engine.clampPointers();
    session.engine.changed();
    touched++;
  }
  return touched;
}

/** Is any room playing this pack right now? */
function packInUse(kind, id) {
  return rooms.all().some((r) => r.session.kind === kind && r.session.pack?.id === id);
}

function csvCell(value) {
  const s = String(value ?? '');
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

async function handleWrite(req, res, url, route) {
  if (route === '/api/sign-in' && req.method === 'POST') {
    const body = await readJson(req);
    const session = accounts.signIn(body.email, body.password);
    // One message for a wrong password and for an address with no account —
    // otherwise this page will happily tell anybody who has an account here.
    if (!session) return sendJson(res, 401, { error: 'That email address and password do not match.' }), true;
    const secure = (req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
    res.setHeader('Set-Cookie', [
      `${SESSION_COOKIE}=${encodeURIComponent(session.token)}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      `Max-Age=${30 * 86400}`,
      ...(secure ? ['Secure'] : []),
    ].join('; '));
    return sendJson(res, 200, {
      account: { ...session.account, entitlements: entitlements(session.account) },
    }), true;
  }

  if (route === '/api/sign-out' && req.method === 'POST') {
    accounts.signOut(cookie(req, SESSION_COOKIE));
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
    return sendJson(res, 200, { ok: true }), true;
  }

  // Your own password. The old one is required even though you are signed in:
  // a borrowed laptop should not be a way to take somebody's account.
  if (route === '/api/me/password' && req.method === 'PUT') {
    const account = whoIs(req, url);
    if (!account || account.bootstrap) return sendJson(res, 401, { error: 'Sign in first' }), true;
    const body = await readJson(req);
    try {
      accounts.setPassword(account.id, body.password, { requireOld: body.current ?? '' });
      await backUpAccounts();
      return sendJson(res, 200, { ok: true, signedOut: true }), true;
    } catch (err) {
      return sendJson(res, 400, { error: err.message }), true;
    }
  }

  /*
   * ---- invoicing, the parts that change something
   *
   * Split from the reads because the server routes GET and everything else
   * through different functions. Putting these on the GET side meant the PDF
   * worked and nothing could be saved, which is a confusing way to fail.
   */

  if (route === '/api/invoices') {
    if (!allowed(req, res, url, FEATURES.INVOICES)) return true;

    if (req.method === 'GET') {
      return sendJson(res, 200, invoiceState()), true;
    }

    // Issue one. This is the only thing that hands out a number.
    if (req.method === 'POST') {
      const body = await readJson(req);
      try {
        const invoice = invoices.issue(readDraft(body));
        const backup = await backUpInvoices();
        return sendJson(res, 200, {
          invoice: withTotals(invoice),
          filename: invoiceFilename(invoice),
          backedUp: backup.ok,
          ...invoiceState(),
        }), true;
      } catch (err) {
        return sendJson(res, 400, { error: err.message }), true;
      }
    }
  }

  if (route === '/api/invoices/settings' && req.method === 'PUT') {
    if (!allowed(req, res, url, FEATURES.INVOICES)) return true;
    const body = await readJson(req);
    invoices.saveSettings(body);
    const backup = await backUpInvoices();
    return sendJson(res, 200, { backedUp: backup.ok, ...invoiceState() }), true;
  }

  if (route === '/api/invoices/customers' && req.method === 'POST') {
    if (!allowed(req, res, url, FEATURES.INVOICES)) return true;
    const body = await readJson(req);
    try {
      invoices.saveCustomer(body);
    } catch (err) {
      return sendJson(res, 400, { error: err.message }), true;
    }
    const backup = await backUpInvoices();
    return sendJson(res, 200, { backedUp: backup.ok, ...invoiceState() }), true;
  }

  if (route.startsWith('/api/invoices/customers/') && req.method === 'DELETE') {
    if (!allowed(req, res, url, FEATURES.LIBRARY)) return true;
    invoices.deleteCustomer(decodeURIComponent(route.slice('/api/invoices/customers/'.length)));
    const backup = await backUpInvoices();
    return sendJson(res, 200, { backedUp: backup.ok, ...invoiceState() }), true;
  }

  // Mark it sent, paid or cancelled. Status is the only thing that can move on
  // an invoice that has already gone out — see src/invoices.js.
  if (route.startsWith('/api/invoices/') && req.method === 'POST') {
    if (!allowed(req, res, url, FEATURES.LIBRARY)) return true;
    const number = decodeURIComponent(route.slice('/api/invoices/'.length));
    const body = await readJson(req);
    try {
      const invoice = invoices.setStatus(number, String(body.status || ''));
      if (!invoice) return sendJson(res, 404, { error: 'No invoice with that number' }), true;
      const backup = await backUpInvoices();
      return sendJson(res, 200, { backedUp: backup.ok, ...invoiceState() }), true;
    } catch (err) {
      return sendJson(res, 400, { error: err.message }), true;
    }
  }

  // ---- players (open to anyone with the join link)
  if (route === '/api/join' && req.method === 'POST') {
    const body = await readJson(req);
    const room = roomForPhone(req, url, body);
    const player = room.session.joinPlayer({ playerId: body.playerId, name: body.name });
    // The code goes back with the player so the phone can keep hold of it and
    // reconnect to the same game after a lock, a refresh or a lost signal —
    // the same reason it keeps the player id.
    return sendJson(res, 200, {
      id: player.id, name: player.name, score: player.score ?? 0,
      game: room.session.kind, joinCode: room.code,
    }), true;
  }

  /*
   * A photo from somebody's phone, straight onto the big screen.
   *
   * There is no approval step, on purpose and by the host's explicit decision:
   * the fun is that it is theirs to do, and he handles the room with the mic.
   * What he has instead is a switch that stops the lot and a bin for one, both
   * on his control view and both one tap.
   *
   * The body is the image itself rather than a form or base64. A phone photo
   * is already scaled down before it is sent; wrapping it in base64 would add
   * a third again for nothing, on the worst wifi in the building.
   */
  if (route === '/api/photo' && req.method === 'POST') {
    const room = roomForPhone(req, url);
    const { photos, session } = room;
    if (!photos.enabled) return sendJson(res, 200, { ok: false, reason: 'off' }), true;

    const playerId = String(url.searchParams.get('playerId') || '');
    const player = session.engine.state.players[playerId];
    // Joined phones only. Not a security boundary — it stops a stray request
    // putting an unattributed picture on a projector.
    if (!player) return sendJson(res, 200, { ok: false, reason: 'not_playing' }), true;

    let bytes;
    try {
      bytes = await readBody(req, MAX_BYTES);
    } catch {
      return sendJson(res, 200, { ok: false, reason: 'too_big' }), true;
    }

    const result = photos.add(bytes, {
      contentType: req.headers['content-type'],
      playerId,
      teamName: player.name,
      filter: String(url.searchParams.get('filter') || ''),
    });
    if (result.ok) {
      pushState(room);
      // File it away in the background. The phone gets its answer first —
      // nobody should watch a spinner while GitHub thinks about it — and the
      // photo is on screen either way. This is only about surviving the
      // restart that would otherwise wipe it.
      fileAway(room, result.photo);
    }
    return sendJson(res, 200, result.ok ? { ok: true, id: result.photo.id } : result), true;
  }

  // What a phone is allowed to do: answer a question, or mark a bingo square
  // and call house. Nothing else, and nothing that could hand out a new card.
  if (['/api/answer', '/api/mark', '/api/claim', '/api/wandered'].includes(route) && req.method === 'POST') {
    const body = await readJson(req);
    const action = route.slice('/api/'.length);
    const result = roomForPhone(req, url, body).session.runPlayerAction(action, body);
    // 200 either way: the phone shows its own feedback, and a rejected action
    // is a normal thing (too late, already answered), not an error.
    return sendJson(res, 200, result), true;
  }

  /*
   * ---- everything below this line needs an account
   *
   * A broad gate first, so nothing new can be added below it and accidentally
   * be public. The routes that need MORE than "is a quizmaster" ask for it
   * themselves underneath — generating, in particular, is the owner's alone
   * because it spends the owner's money.
   *
   * Asked with `live` set: this covers /api/host/*, which is the control view,
   * and a failed payment must never take the Next button away in the middle of
   * a round. A new night cannot be launched on a lapsed subscription — that is
   * checked on `launch` itself, below.
   */
  //
   // The owner's own routes are exempt from the broad gate below, because the
   // owner deliberately has no quiz features — an owner account manages
   // subscribers and writes the packs they buy, it does not run nights.
  const OWNER_ONLY = ['/api/generate/', '/api/owner/'];
  if (!OWNER_ONLY.some((prefix) => route.startsWith(prefix))) {
    if (!allowed(req, res, url, FEATURES.QUIZ, { live: true })) return true;
  }

  // ---- managing subscribers
  if (route === '/api/owner/accounts' && req.method === 'POST') {
    /*
     * The very first account is a special case, and only this one.
     *
     * Making an owner needed the command line, and Render's free tier has no
     * shell — so there was no way to create the first login on the live app at
     * all. A "set up the first owner" page open to the world is the thing
     * CLAUDE.md rules out, and rightly: it is a door that only ever needs
     * opening once and can be walked through by whoever finds it first.
     *
     * Gated on the HOST KEY it is neither. The host key already grants every
     * feature in the app, so this hands out nothing that holding it did not
     * already give you. The moment one account exists it goes back to being
     * owner-only, so the door closes behind you.
     */
    const first = accounts.all.length === 0 && isHostKey(req, url);
    if (!first && !allowed(req, res, url, FEATURES.SUBSCRIBERS)) return true;
    const body = await readJson(req);
    try {
      const made = accounts.create({
        email: body.email,
        password: body.password,
        name: body.name,
        role: first ? 'owner' : 'quizmaster',
        plan: body.plan || 'basic',
        addons: body.addons || [],
        comped: Boolean(body.comped),
        status: body.status || 'trialing',
      });
      const backup = await backUpAccounts();
      return sendJson(res, 200, { account: made, backedUp: backup.ok, accounts: subscriberList() }), true;
    } catch (err) {
      return sendJson(res, 400, { error: err.message }), true;
    }
  }

  if (route.startsWith('/api/owner/accounts/') && (req.method === 'PUT' || req.method === 'DELETE')) {
    if (!allowed(req, res, url, FEATURES.SUBSCRIBERS)) return true;
    const id = decodeURIComponent(route.slice('/api/owner/accounts/'.length));
    try {
      const changed = req.method === 'DELETE' ? accounts.close(id) : accounts.update(id, await readJson(req));
      if (!changed) return sendJson(res, 404, { error: 'No account with that id' }), true;
      const backup = await backUpAccounts();
      return sendJson(res, 200, { account: changed, backedUp: backup.ok, accounts: subscriberList() }), true;
    } catch (err) {
      return sendJson(res, 400, { error: err.message }), true;
    }
  }

  if (route.startsWith('/api/host/') && req.method === 'POST') {
    const action = route.slice('/api/host/'.length);
    const body = await readJson(req);
    // Always your own room, worked out from who you are signed in as. There is
    // no room parameter on any of these on purpose: a control view that could
    // be pointed at somebody else's night is the whole thing rooms exist to
    // prevent.
    const room = roomForHost(req, url);
    const { session, photos } = room;

    // Launching a different game is the one action that replaces the engine.
    if (action === 'launch') {
      /*
       * The one host action a lapsed subscription DOES stop.
       *
       * Everything else under /api/host/ is asked with `live` set, because a
       * card that failed on Tuesday must not take the Next button away from
       * somebody mid-round on Wednesday. Starting a brand new night is the
       * other side of that line: it is not an interruption, it is a beginning,
       * and it is exactly where "you need to sort the payment out" belongs.
       */
      const wanted = String(body.game || 'quiz') === 'bingo' ? FEATURES.BINGO : FEATURES.QUIZ;
      if (!allowed(req, res, url, wanted)) return true;
      try {
        // The card shape is chosen at launch, not stored on the pack: the same
        // forty-two songs are a quick game on a 3x3 and a long one on a strip,
        // and which you want is a decision about tonight.
        const shape = body.shape && Number(body.shape.rows) && Number(body.shape.cols)
          ? { rows: Number(body.shape.rows), cols: Number(body.shape.cols) }
          : null;
        const prizes = Math.max(0, Math.min(5, Number(body.prizes) || 0));
        // How it looks tonight. Same reasoning as the card shape: the pack
        // carries a default, and "it is the fourteenth of February" is a fact
        // about this evening rather than about the pack.
        const look = String(body.look || '');
        const started = session.launch(String(body.game || 'quiz'), String(body.packId), { shape, prizes, look });
        return sendJson(res, 200, { ok: true, started, view: session.hostView() }), true;
      } catch (err) {
        return sendJson(res, 400, { error: err.message }), true;
      }
    }

    // The photo controls: the switch, and the bin. Deliberately as immediate
    // as every other button on that view — something on the projector that
    // should not be there is not a moment for a confirmation dialog.
    if (action === 'photosOn') {
      photos.setEnabled(body.on !== false);
      pushState(room);
      return sendJson(res, 200, { ok: true, enabled: photos.enabled }), true;
    }
    if (action === 'photoRemove') {
      const removed = photos.remove(String(body.id || ''));
      if (removed) pushState(room);
      return sendJson(res, 200, { ok: removed }), true;
    }
    // File everything that has not made it to the private repo yet. Used at
    // the end of a night, or after a spell where GitHub was unreachable.
    if (action === 'photosFile') {
      if (!photosRepoConfigured()) {
        return sendJson(res, 200, { ok: false, reason: 'no_repo' }), true;
      }
      const todo = photos.unfiled();
      let filed = 0;
      for (const photo of todo) {
        const result = await fileAway(room, photo);
        if (result.ok) filed++;
      }
      return sendJson(res, 200, { ok: true, filed, failed: todo.length - filed }), true;
    }
    if (action === 'photosClear') {
      const n = photos.clear();
      pushState(room);
      return sendJson(res, 200, { ok: true, cleared: n }), true;
    }

    const ok = session.run(action, body);
    if (ok === undefined) return sendJson(res, 404, { error: 'Unknown action: ' + action }), true;
    return sendJson(res, 200, { ok, view: session.hostView() }), true;
  }

  // ---- the editor
  // Check a quiz without saving it, so problems can be seen mid-edit.
  if (route === '/api/quiz/__validate' && req.method === 'POST') {
    const body = await readJson(req, 4 * 1024 * 1024);
    return sendJson(res, 200, { problems: validateQuiz(normaliseQuiz(body, body.id)) }), true;
  }

  /*
   * Advertising slides: save and delete a venue's set.
   *
   * Backed up like a quiz pack, because a venue's offer is worth having again
   * next week and losing it to a redeploy would make the feature useless as a
   * thing to sell.
   */
  if (route.startsWith('/api/advert/') && (req.method === 'PUT' || req.method === 'DELETE')) {
    const id = decodeURIComponent(route.slice('/api/advert/'.length));
    if (req.method === 'DELETE') {
      try {
        deleteAdvertPack(config.advertDir, id);
      } catch (err) {
        return sendJson(res, 404, { error: err.message }), true;
      }
      if (githubConfigured()) await deleteFile(`adverts/${id}.json`, `Delete adverts: ${id}`);
      return sendJson(res, 200, { ok: true }), true;
    }

    const body = await readJson(req, 512 * 1024);
    const problems = validateAdvertPack(body);
    if (problems.length) return sendJson(res, 400, { error: 'Advert set is not valid', problems }), true;
    saveAdvertPack(config.advertDir, id, body);
    const backup = await backUp(
      `adverts/${id}.json`,
      JSON.stringify(normaliseAdvertPack(body, id), null, 2) + '\n',
      `Adverts: ${body.title || id}`,
    );
    return sendJson(res, 200, { ok: true, backedUp: backup.ok, backupError: backup.error }), true;
  }

  // Ticking a review flag off as you read a quiz through. Deliberately its own
  // endpoint rather than part of the Save button: a tick records that YOU have
  // looked at something, and losing it because you shut the panel would mean
  // reading the same twenty flags again.
  if (route.startsWith('/api/quiz/') && route.endsWith('/checked') && req.method === 'POST') {
    const id = decodeURIComponent(route.slice('/api/quiz/'.length, -'/checked'.length));
    const body = await readJson(req, 16 * 1024);
    let quiz;
    try {
      quiz = loadQuiz(config.quizDir, id);
    } catch {
      return sendJson(res, 404, { error: 'No such quiz' }), true;
    }
    const found = setWarningChecked(quiz, String(body.questionId || ''), String(body.warning || ''), body.checked !== false);
    if (!found) return sendJson(res, 409, { error: 'That question is not in this quiz any more. Reopen it.' }), true;

    // Annotating, not editing — see saveQuiz. A broken question elsewhere in
    // the quiz must not stop you recording that you have read this one.
    saveQuiz(config.quizDir, id, quiz, { allowProblems: true });
    // Back up in the background — a tick is not worth making you wait for
    // GitHub, and the next save will carry it anyway if this one misses.
    const backup = await backUp(`quizzes/${id}.json`, JSON.stringify(normaliseQuiz(quiz, id), null, 2) + '\n', `Review notes: ${quiz.title || id}`);
    return sendJson(res, 200, { ok: true, backedUp: backup.ok, warnings: reviewWarnings(quiz) }), true;
  }

  if (route.startsWith('/api/quiz/')) {
    const id = decodeURIComponent(route.slice('/api/quiz/'.length));
    if (req.method === 'PUT') {
      const body = await readJson(req, 4 * 1024 * 1024);
      const problems = validateQuiz(body);
      if (problems.length) return sendJson(res, 400, { error: 'Quiz is not valid', problems }), true;
      saveQuiz(config.quizDir, id, body);
      // If a running quiz was the one just edited, pick up the changes live —
      // in every room playing it, not just the editor's own.
      reloadPackEverywhere(id);
      const backup = await backUp(`quizzes/${id}.json`, JSON.stringify(normaliseQuiz(body, id), null, 2) + '\n', `Edit quiz: ${body.title || id}`);
      return sendJson(res, 200, { ok: true, backedUp: backup.ok, backupError: backup.error }), true;
    }
    if (req.method === 'DELETE') {
      if (packInUse('quiz', id)) {
        return sendJson(res, 400, { error: 'That quiz is loaded in a game right now.' }), true;
      }
      deleteQuiz(config.quizDir, id);
      if (githubConfigured()) await deleteFile(`quizzes/${id}.json`, `Delete quiz: ${id}`);
      return sendJson(res, 200, { ok: true }), true;
    }
  }

  if (route === '/api/quiz' && req.method === 'POST') {
    const body = await readJson(req, 4 * 1024 * 1024);
    const quizToSave = normaliseQuiz(body, body.id);
    const problems = validateQuiz(quizToSave);
    if (problems.length) return sendJson(res, 400, { error: 'Quiz is not valid', problems }), true;
    saveQuiz(config.quizDir, quizToSave.id, quizToSave);
    return sendJson(res, 200, { ok: true, id: quizToSave.id }), true;
  }

  // ---- one button: theme in, playable bingo game out.
  // Generation takes a while (Claude, then a Spotify lookup per track), so
  // this streams progress lines as it goes rather than leaving the console
  // staring at a spinner with no idea whether it is working.
  if (route === '/api/generate/bingo' && req.method === 'POST') {
    if (!allowed(req, res, url, FEATURES.GENERATE)) return true;
    const body = await readJson(req);
    const stream = progressStream(res);
    const log = stream.log;
    try {
      const result = await generateBingoPack({
        config,
        theme: String(body.theme || '').slice(0, 200),
        trackCount: Math.min(90, Math.max(9, Number(body.trackCount) || 40)),
        cardSize: [3, 4, 5].includes(Number(body.cardSize)) ? Number(body.cardSize) : 4,
        avoidMonths: Math.min(24, Math.max(0, Number(body.avoidMonths ?? 3))),
        log,
      });
      const backup = await backUp(
        `bingo/${result.pack.id}.json`,
        JSON.stringify(result.pack, null, 2) + '\n',
        `Add bingo pack: ${result.pack.title}`,
        log,
      );
      const history = await backUpHistory(log);
      log('DONE ' + JSON.stringify({
        id: result.pack.id,
        title: result.pack.title,
        trackCount: result.pack.tracks.length,
        playlist: result.playlist ? result.playlist.url : null,
        playlistError: result.playlistError || null,
        backedUp: backup.ok,
        // Reported separately from the pack's own backup. They can differ, and
        // when they do it is this one that matters: Claude in the browser reads
        // the pushed history to decide what NOT to pick, so a history that
        // stayed here means the next round can repeat these songs.
        historyBackedUp: history.ok,
      }));
    } catch (err) {
      log('ERROR ' + err.message);
    }
    stream.end();
    return true;
  }

  // Same shape as the bingo generator: streams progress while it works,
  // because three rounds of Claude takes the best part of a minute.
  if (route === '/api/generate/quiz' && req.method === 'POST') {
    if (!allowed(req, res, url, FEATURES.GENERATE)) return true;
    const body = await readJson(req);
    const stream = progressStream(res);
    const log = stream.log;
    try {
      // Whitelisting is roundPlan's job now, and it is done against
      // ROUND_TYPES rather than a list written out here. It WAS written out
      // here, and "multi" was added to the app months later — so the console
      // offered the round, sent it, and this quietly dropped it on the floor.
      // A quiz came back with the tickbox ignored and nothing saying why.
      //
      // Each entry may be a bare type name or { type, count }: the console
      // sends a count per round now, because "fifteen general knowledge and
      // five pictures" is a normal quiz and "ten of everything" is not.
      const asked = roundPlan(body.rounds, Number(body.perRound) || 10);
      const rounds = asked.length ? asked : ['text', 'image', 'intro'];
      const result = await generateQuizPack({
        config,
        theme: String(body.theme || '').slice(0, 200),
        rounds,
        perRound: Math.min(30, Math.max(1, Number(body.perRound) || 10)),
        hard: Boolean(body.hard),
        // Always checked. The console deliberately offers no way to skip it —
        // an option that only ever makes the questions worse is a footgun on a
        // panel used in a hurry.
        check: true,
        log,
      });
      const backup = await backUp(
        `quizzes/${result.quiz.id}.json`,
        JSON.stringify(result.quiz, null, 2) + '\n',
        `Add quiz: ${result.quiz.title}`,
        log,
      );
      log('DONE ' + JSON.stringify({
        id: result.quiz.id,
        title: result.quiz.title,
        rounds: result.quiz.rounds.length,
        questionCount: result.quiz.rounds.reduce((n, r) => n + r.questions.length, 0),
        problems: result.problems,
        needsImages: result.needsImages,
        backedUp: backup.ok,
        checked: result.checked,
        rejected: result.rejected.length,
        unchecked: result.unchecked || [],
      }));
    } catch (err) {
      log('ERROR ' + err.message);
    }
    stream.end();
    return true;
  }

  /*
   * Round 2 artwork.
   *
   * Streams like the other generators, because ten real portraits is the best
   * part of a minute and you are watching money being spent.
   *
   * Each picture is backed up the moment it lands rather than all at the end:
   * if the run dies halfway, the ones already paid for are safe.
   */
  if (route === '/api/generate/images' && req.method === 'POST') {
    if (!allowed(req, res, url, FEATURES.ARTWORK)) return true;
    const body = await readJson(req);
    const stream = progressStream(res);
    const log = stream.log;
    try {
      const id = String(body.quizId || '');
      const quiz = loadQuiz(config.quizDir, id);
      const provider = body.provider === 'openai' ? 'openai' : 'placeholder';

      const result = await generateImages({
        quiz,
        imageDir: config.imageDir,
        provider,
        only: String(body.only || ''),
        force: Boolean(body.force),
        style: String(body.style || ''),
        quality: String(body.quality || ''),
        log,
        onFile: async (name, bytes) => {
          await backUp(`images/${name}`, bytes, `Round 2 picture: ${name}`, () => {});
        },
      });

      // Questions moved onto the shared portrait library have to be written
      // back, or the pack still points at its old per-quiz filename and the
      // sharing buys nothing. `allowProblems` for the same reason ticking a
      // review flag has it: one bad question in round 2 must not stop the
      // pictures being filed.
      if (result.repointed.length) {
        saveQuiz(config.quizDir, id, quiz, { allowProblems: true });
        log(`${result.repointed.length} question${result.repointed.length === 1 ? '' : 's'} moved onto the shared picture library`);
        reloadPackEverywhere(id, { clamp: false });
      }

      const backedUp = githubConfigured();
      if (result.made.length) {
        log(backedUp
          ? `${result.made.length} backed up to GitHub — they will survive a restart`
          : 'NOT backed up — set GITHUB_TOKEN or these vanish when the app restarts');
      }
      log('DONE ' + JSON.stringify({
        quizId: id,
        provider,
        made: result.made.length,
        skipped: result.skipped.length,
        failed: result.failed.length,
        reused: result.skipped.length,
        style: result.style,
        quality: result.quality,
        status: imageStatus(quiz, config.imageDir),
        backedUp,
      }));
    } catch (err) {
      log('ERROR ' + err.message);
    }
    stream.end();
    return true;
  }

  /*
   * The playlist for a "name that intro" round, built after the fact.
   *
   * You can easily have an intro round before you have a Spotify login, and a
   * playlist deleted by accident should not mean regenerating the quiz and
   * getting different questions. So this is its own button rather than only
   * something that happens once, during generation.
   */
  if (route === '/api/playlist/intro' && req.method === 'POST') {
    const body = await readJson(req);
    const stream = progressStream(res);
    const log = stream.log;
    try {
      const id = String(body.quizId || '');
      const quiz = loadQuiz(config.quizDir, id);
      const results = await buildIntroPlaylists({ quiz, log });

      // The lookups rewrote the cues with Spotify's spelling and uris, so the
      // pack has to be saved or the control view still points at the guesses.
      saveQuiz(config.quizDir, id, quiz);
      reloadPackEverywhere(id, { clamp: false });
      const backup = await backUp(`quizzes/${id}.json`, JSON.stringify(normaliseQuiz(quiz, id), null, 2) + '\n', `Intro playlist: ${quiz.title}`, log);

      log('DONE ' + JSON.stringify({
        quizId: id,
        playlists: results.filter((r) => r.playlist).map((r) => ({ round: r.round, url: r.playlist.url, missing: r.playlist.missing })),
        backedUp: backup.ok,
      }));
    } catch (err) {
      log('ERROR ' + err.message);
    }
    stream.end();
    return true;
  }

  // Bring in a track list you already have — a Spotify playlist you built, or
  // one Claude made for you in a browser. Streams like the generators do.
  if (route === '/api/import/bingo' && req.method === 'POST') {
    const body = await readJson(req, 512 * 1024);
    const stream = progressStream(res);
    const log = stream.log;
    try {
      const result = await importBingoPack({
        config,
        playlistUrl: String(body.playlistUrl || ''),
        text: String(body.text || ''),
        title: String(body.title || '').slice(0, 80) || undefined,
        cardSize: [3, 4, 5].includes(Number(body.cardSize)) ? Number(body.cardSize) : 4,
        avoidMonths: Math.min(24, Math.max(0, Number(body.avoidMonths ?? 0))),
        log,
      });
      const backup = await backUp(
        `bingo/${result.pack.id}.json`,
        JSON.stringify(result.pack, null, 2) + '\n',
        `Import bingo pack: ${result.pack.title}`,
        log,
      );
      // The import writes every track into the no-repeats history too, so that
      // has to survive the next restart just as it does when generating.
      const history = await backUpHistory(log);
      log('DONE ' + JSON.stringify({
        id: result.pack.id,
        title: result.pack.title,
        trackCount: result.pack.tracks.length,
        playlist: result.playlist ? result.playlist.url : null,
        playlistError: result.playlistError || null,
        backedUp: backup.ok,
        // Reported separately from the pack's own backup. They can differ, and
        // when they do it is this one that matters: Claude in the browser reads
        // the pushed history to decide what NOT to pick, so a history that
        // stayed here means the next round can repeat these songs.
        historyBackedUp: history.ok,
      }));
    } catch (err) {
      log('ERROR ' + err.message);
    }
    stream.end();
    return true;
  }

  if (route === '/api/history/forget' && req.method === 'POST') {
    forgetAll(config.dataDir);
    return sendJson(res, 200, { ok: true }), true;
  }

  // ---- bingo packs, same shape as the quiz endpoints
  if (route === '/api/bingo/__validate' && req.method === 'POST') {
    const body = await readJson(req, 4 * 1024 * 1024);
    return sendJson(res, 200, { problems: validateBingoPack(normaliseBingoPack(body, body.id)) }), true;
  }

  if (route.startsWith('/api/bingo/') && req.method === 'DELETE') {
    const id = decodeURIComponent(route.slice('/api/bingo/'.length));
    if (packInUse('bingo', id)) {
      return sendJson(res, 400, { error: 'That pack is loaded in a game right now. Launch something else first.' }), true;
    }
    try {
      deleteBingoPack(config.bingoDir, id);
      if (githubConfigured()) await deleteFile(`bingo/${id}.json`, `Delete bingo pack: ${id}`);
      return sendJson(res, 200, { ok: true }), true;
    } catch (err) {
      return sendJson(res, 404, { error: err.message }), true;
    }
  }

  if (route.startsWith('/api/bingo/') && req.method === 'PUT') {
    const id = decodeURIComponent(route.slice('/api/bingo/'.length));
    const body = await readJson(req, 4 * 1024 * 1024);
    const pack = normaliseBingoPack(body, id);
    const problems = validateBingoPack(pack);
    if (problems.length) return sendJson(res, 400, { error: 'Bingo pack is not valid', problems }), true;
    saveBingoPack(config.bingoDir, id, pack);
    const backup = await backUp(`bingo/${id}.json`, JSON.stringify(pack, null, 2) + '\n', `Edit bingo pack: ${pack.title || id}`);
    return sendJson(res, 200, { ok: true, backedUp: backup.ok, backupError: backup.error }), true;
  }

  if (route === '/api/bingo' && req.method === 'POST') {
    const body = await readJson(req, 4 * 1024 * 1024);
    const pack = normaliseBingoPack(body, body.id);
    const problems = validateBingoPack(pack);
    if (problems.length) return sendJson(res, 400, { error: 'Bingo pack is not valid', problems }), true;
    saveBingoPack(config.bingoDir, pack.id, pack);
    return sendJson(res, 200, { ok: true, id: pack.id }), true;
  }

  return false;
}

// ------------------------------------------------------------------ startup

/*
 * Read the backups back before anything else happens.
 *
 * Before listening rather than after: a request that arrives in the gap would
 * be told there are no accounts, and the login page would offer to set the app
 * up from scratch on a server that already has subscribers.
 */
await restoreFromBackup();

server.listen(config.port, () => {
  const local = `http://localhost:${config.port}`;
  console.log('');
  console.log('  ┌───────────────────────────────────────────────┐');
  console.log(`  │  ${config.brandName.padEnd(43).slice(0, 43)}│`);
  console.log('  └───────────────────────────────────────────────┘');
  console.log('');
  console.log(`  Big screen   ${local}/screen`);
  console.log(`  Players      ${local}/play`);
  console.log(`  Your control ${local}/host?key=${HOST_KEY}`);
  console.log(`  Editor       ${local}/editor?key=${HOST_KEY}`);
  console.log('');
  console.log(`  Console      ${local}/console?key=${HOST_KEY}`);
  console.log('');
  console.log(`  Loaded:      ${rooms.get(HOUSE).session.pack.title} (${rooms.get(HOUSE).session.kind})`);
  console.log(`  Host key:    ${HOST_KEY}`);
  if (hostKeyIsTemporary()) {
    console.log('');
    console.log('  ** HOST_KEY is not set, so this key was invented just now. **');
    console.log('  It is kept in data/, which a host with no permanent disk wipes');
    console.log('  on every deploy — so the next deploy will invent a different');
    console.log('  one and every bookmark you have will stop working. Set HOST_KEY');
    console.log('  as an environment variable to any long phrase and it stops.');
  }
  if (!accounts.all.length) {
    console.log('');
    console.log('  No accounts yet. The host key above is the way in, and it can');
    console.log('  make the first owner from the Console — everything else about');
    console.log('  accounts is owner-only once that exists.');
  }
  console.log('');
});

/** Save on the way out, so even a deliberate restart loses nothing. */
function shutdown(signal) {
  console.log(`\n[server] ${signal} — saving state and closing`);
  for (const room of rooms.all()) room.store.flush();
  hub.closeAll();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (err) => {
  // Never take the quiz down over one bad request. Log it and carry on.
  console.error('[server] uncaught:', err);
  for (const room of rooms.all()) room.store.flush();
});

export { server, rooms };
