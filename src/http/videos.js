/**
 * VIDEO ROUTES — a phone or the bar's camera sends one, the host's console
 * lists, plays, stars and bins them, and a daily sweep clears the unused ones.
 * The rules are `src/videos.js`; a pub's staff reach theirs through
 * `src/http/venue-photos.js`, which reuses `serveVideo()` and the keep marks.
 *
 * **THE OBJECT STORE OR NOTHING.** A video goes in the bucket, never the
 * private repository, whose history keeps every byte for ever. With no store
 * configured `/api/video/ok` says no and the phones draw no button — not a
 * button that fails.
 *
 * **NEVER ON THE BIG SCREEN** — nothing here touches a room's photo list, so
 * the projector, the wall and the kill switch's own grid never see a video.
 * The kill switch still STOPS them: `photosWanted()` is asked first.
 */
import { FEATURES, accounts, dropNight, isNightFolder, nightOf, photoFolder, tidyCode } from './context.js';
import { readBody, readJson, secure, sendJson } from './plumbing.js';
import { galleryRoomFor, nightFiles, roomForPhone } from './identity.js';
import { allowed } from './gates.js';
import { photosWanted } from './views.js';
import { galleryRoomOf, publicRoomId } from './helpers.js';
import * as store from '../r2.js';
import { MAX_VIDEO_BYTES, dueToGo, goesOn, isVideoName, keepKey, rangeOf, sniffVideo, videoName, videoType } from '../videos.js';

// ------------------------------------------------------------- keep marks

const keepFile = (galleryId) => `${photoFolder(galleryId)}/videos-kept.json`;
const queues = new Map();
/** One write at a time per room — the shape `inOrder()` gives the gallery. */
function inOrder(galleryId, job) {
  const next = (queues.get(galleryId) || Promise.resolve()).then(job, job);
  queues.set(galleryId, next.catch(() => {}));
  return next;
}

export async function keptMarks(galleryId) {
  const read = await store.tryGet(keepFile(galleryId));
  if (!read.ok || !read.body) return {};
  try { return JSON.parse(read.body.toString('utf8')) || {}; } catch { return {}; }
}

/** Mark a video kept (`star` from the host, `saved` from a save) or not. */
export function setKept(galleryId, night, name, how) {
  return inOrder(galleryId, async () => {
    const marks = await keptMarks(galleryId);
    const key = keepKey(night, name);
    if (how) marks[key] = { how, at: new Date().toISOString() };
    else delete marks[key];
    return store.put(keepFile(galleryId), JSON.stringify(marks, null, 2), 'application/json');
  });
}

// ------------------------------------------------------------- reading

/** A night's videos, each with whether it is kept and when it goes. */
export async function nightVideos(galleryId, night) {
  const files = await nightFiles(`${photoFolder(galleryId)}/${night}`);
  const marks = await keptMarks(galleryId);
  return files.map((f) => f.name).filter(isVideoName).map((name) => {
    const kept = marks[keepKey(night, name)] || null;
    return { name, kept: kept ? kept.how : '', goesOn: kept ? null : goesOn(night) };
  });
}

// Safari asks for a video in pieces; one fetch from the store serves them all.
const held = new Map();
async function videoBytes(key) {
  const now = Date.now();
  const hit = held.get(key);
  if (hit && hit.at > now - 10 * 60_000) return hit.bytes;
  const read = await store.tryGet(key);
  if (!read.ok || !read.body) return null;
  held.set(key, { at: now, bytes: read.body });
  while (held.size > 8) held.delete(held.keys().next().value);
  return read.body;
}

/** Serve a stored video, answering a `Range` the way a phone's player asks. */
export async function serveVideo(req, res, galleryId, night, name) {
  if (!store.configured() || !isNightFolder(night) || !isVideoName(name)) return sendJson(res, 404, { error: 'No video there.' });
  const bytes = await videoBytes(`${photoFolder(galleryId)}/${night}/${name}`);
  if (!bytes) return sendJson(res, 404, { error: 'No video there.' });
  const range = rangeOf(req.headers.range, bytes.length);
  const head = { 'Content-Type': videoType(name), 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=86400' };
  if (!range) {
    res.writeHead(416, secure({ ...head, 'Content-Range': `bytes */${bytes.length}` }));
    return res.end();
  }
  if (range.whole) {
    res.writeHead(200, secure({ ...head, 'Content-Length': bytes.length }));
    return res.end(bytes);
  }
  const part = bytes.subarray(range.start, range.end + 1);
  res.writeHead(206, secure({ ...head, 'Content-Length': part.length, 'Content-Range': `bytes ${range.start}-${range.end}/${bytes.length}` }));
  return res.end(part);
}

// ------------------------------------------------------------- receiving

async function receive(req, res, room, { house }) {
  if (!store.configured()) return sendJson(res, 200, { ok: false, reason: 'no_store' });
  if (!photosWanted(room)) return sendJson(res, 200, { ok: false, reason: 'off' });
  let bytes;
  try {
    bytes = await readBody(req, MAX_VIDEO_BYTES);
  } catch {
    // The rest of the body was never read, so this connection must not be
    // reused for the next request — or THAT one arrives on a broken socket.
    res.setHeader('Connection', 'close');
    return sendJson(res, 200, { ok: false, reason: 'too_big' });
  }
  const type = sniffVideo(bytes);
  if (!type) return sendJson(res, 200, { ok: false, reason: 'not_a_video' });
  const night = nightOf(Date.now());
  const folder = `${photoFolder(galleryRoomOf(room.id))}/${night}`;
  const name = videoName(`${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`, { house, type });
  const put = await store.put(`${folder}/${name}`, bytes, type);
  if (!put.ok) {
    console.warn('[video] could not store a video:', put.error);
    return sendJson(res, 200, { ok: false, reason: 'not_stored' });
  }
  dropNight(folder);
  return sendJson(res, 200, { ok: true, night, name });
}

// ------------------------------------------------------------- the sweep

/**
 * THIRTY DAYS, VIDEOS ONLY, NEVER A KEPT ONE — the host's call (2 October
 * 2026). It walks every room that keeps photographs, reads each night old
 * enough to have something due, and removes what nobody starred or saved.
 * A photograph is never touched: the test is `isVideoName()`.
 */
export async function sweepVideos(today = new Date().toISOString().slice(0, 10)) {
  if (!store.configured()) return { removed: 0 };
  const ids = new Set([galleryRoomOf(publicRoomId())]);
  for (const a of accounts.all || []) if (a.role === 'quizmaster') ids.add(galleryRoomOf(a.id));
  let removed = 0;
  for (const galleryId of ids) {
    const nights = (await store.listDirs(photoFolder(galleryId))).map((d) => d.name).filter(isNightFolder);
    const due = nights.filter((n) => dueToGo(n, false, today));
    if (!due.length) continue;
    const marks = await keptMarks(galleryId);
    for (const night of due) {
      const folder = `${photoFolder(galleryId)}/${night}`;
      for (const f of await store.listDir(folder)) {
        if (!isVideoName(f.name) || marks[keepKey(night, f.name)]) continue;
        if ((await store.remove(`${folder}/${f.name}`)).ok) removed += 1;
      }
      dropNight(folder);
    }
  }
  if (removed) console.log(`[video] cleared ${removed} unused video(s) older than thirty days`);
  return { removed };
}

export function startVideoSweep() {
  const run = () => sweepVideos().catch((err) => console.warn('[video] sweep failed:', err.message));
  // `VIDEO_SWEEP_FIRST_MS`: a seam for a check, like `FILE_REST_WAIT_MS`.
  setTimeout(run, Number(process.env.VIDEO_SWEEP_FIRST_MS) || 2 * 60_000).unref();
  setInterval(run, 24 * 60 * 60_000).unref();
}

// ------------------------------------------------------------- the routes

export async function getVideos(req, res, url, route) {
  // May this phone send one? Asked once when its menu draws — never a field on
  // the game's payload, which every pub night's guard compares byte for byte.
  if (route === '/api/video/ok') {
    if (!tidyCode(url.searchParams.get('g') || '')) return sendJson(res, 200, { ok: false }), true;
    const room = roomForPhone(req, url);
    return sendJson(res, 200, { ok: store.configured() && photosWanted(room) }), true;
  }
  // THE HOST'S CONSOLE — a night's videos, and one played.
  if (route.startsWith('/api/videos/')) {
    if (!allowed(req, res, url, FEATURES.PAST_GIGS)) return true;
    const night = decodeURIComponent(route.slice('/api/videos/'.length));
    if (!isNightFolder(night)) return sendJson(res, 404, { error: 'No night with that date.' }), true;
    if (!store.configured()) return sendJson(res, 200, { videos: [], store: false }), true;
    const videos = await nightVideos(galleryRoomFor(req, url), night);
    return sendJson(res, 200, { store: true, videos: videos.map((v) => ({ ...v, url: `/past-video/${night}/${v.name}` })) }), true;
  }
  if (route.startsWith('/past-video/')) {
    if (!allowed(req, res, url, FEATURES.PAST_GIGS)) return true;
    const [night, name, ...rest] = route.slice('/past-video/'.length).split('/').map(decodeURIComponent);
    if (rest.length) return sendJson(res, 404, { error: 'No video there.' }), true;
    return serveVideo(req, res, galleryRoomFor(req, url), night, name), true;
  }
  return false;
}

export async function writeVideos(req, res, url, route) {
  if (route === '/api/video' && req.method === 'POST') {
    const room = roomForPhone(req, url);
    const playerId = String(url.searchParams.get('playerId') || '');
    // Joined phones only, as for a photograph.
    if (!room.session.engine.state.players[playerId]) return sendJson(res, 200, { ok: false, reason: 'not_playing' }), true;
    return receive(req, res, room, { house: false }), true;
  }
  if (route === '/api/snap-video' && req.method === 'POST') {
    // The bar's camera: a code is required, never the house room by default.
    if (!tidyCode(url.searchParams.get('g') || '')) return sendJson(res, 400, { error: 'That link is missing its room.' }), true;
    return receive(req, res, roomForPhone(req, url), { house: true }), true;
  }
  if (route === '/api/videos/keep' && req.method === 'POST') {
    if (!allowed(req, res, url, FEATURES.PAST_GIGS)) return true;
    const body = await readJson(req);
    const night = String(body.night || '');
    const name = String(body.name || '');
    if (!isNightFolder(night) || !isVideoName(name)) return sendJson(res, 400, { error: 'No video like that.' }), true;
    const how = body.keep ? (body.how === 'saved' ? 'saved' : 'star') : '';
    const done = await setKept(galleryRoomFor(req, url), night, name, how);
    return sendJson(res, done.ok ? 200 : 500, done.ok ? { ok: true, kept: how } : { error: 'That would not save — try again.' }), true;
  }
  if (route.startsWith('/api/videos/') && req.method === 'DELETE') {
    if (!allowed(req, res, url, FEATURES.PAST_GIGS)) return true;
    const [night, name, ...rest] = route.slice('/api/videos/'.length).split('/').map(decodeURIComponent);
    if (rest.length || !isNightFolder(night) || !isVideoName(name)) return sendJson(res, 404, { error: 'No video there.' }), true;
    const galleryId = galleryRoomFor(req, url);
    const folder = `${photoFolder(galleryId)}/${night}`;
    const gone = await store.remove(`${folder}/${name}`);
    held.delete(`${folder}/${name}`);
    dropNight(folder);
    await setKept(galleryId, night, name, '');
    return sendJson(res, gone.ok ? 200 : 500, gone.ok ? { ok: true } : { error: 'That would not delete — try again.' }), true;
  }
  return false;
}
