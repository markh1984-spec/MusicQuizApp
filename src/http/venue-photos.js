/**
 * A PUB'S STAFF AND THEIR PHOTOGRAPHS — `/venue-photos`, and the routes behind
 * it. The book is `src/gallery-logins.js`; read its header for why the logins
 * are not accounts.
 *
 * **EVERY ROUTE HERE RESOLVES THE LOGIN FROM ITS OWN COOKIE AND NOTHING ELSE.**
 * No route takes a room, a venue or a night owner from the request: the login
 * says which pub, and the pub says which nights — the rule `/api/host/*`
 * follows with `whoIs()`. A night is served only when it is one of THAT pub's,
 * so a guessed date or photo name from another pub is a 404.
 *
 * **EVERY PHOTO FROM THEIR NIGHTS** — the host's call (1 October 2026), not
 * only the ones lit for the public gallery.
 *
 * **WHO MAY MAKE ONE: the host alone for now** (*"just me for now"*) — his
 * own quizmaster room or the house room, `isHostsRoom()`. Opening it to every
 * quizmaster is a later decision, and a one-line change here.
 */
import { HOUSE, accounts, config, galleryLogins, isNightFolder, listArchive, listDirs, mergeGigs, photoFolder, photosRepoConfigured, privateRepoConfigured, putFile, rooms, safePhotoName, sameVenue } from './context.js';
import { readJson, secure, sendJson, signInAllowed, signInSeat } from './plumbing.js';
import { brandForRoom, cookie, cookieFor, gigRoomsOf, nightFiles, photoBytes, refuseBreached, roomForHost, whoIs } from './identity.js';
import { ensureArchiveRestored, ensureInvoicesRestored, galleryRoomOf, publicRoomId, within } from './helpers.js';
import { serveFile } from './static.js';
import { GALLERY_COOKIE } from '../gallery-logins.js';
import { checkPassword } from '../accounts.js';
import { storyLine } from '../../public/assets/story-line.js';

function backUpLogins() {
  if (!privateRepoConfigured()) return Promise.resolve({ ok: false });
  return within(putFile('gallery-logins.json', galleryLogins.serialise(), 'Update gallery logins', 'private'), undefined, 'the gallery logins');
}

const isHostsRoom = (roomId) => roomId === HOUSE || roomId === publicRoomId();

/**
 * Where a login's pub lives — `gigRoomsOf()`, the one definition Past gigs
 * uses. The host's nights are filed under BOTH hats, so a login made on
 * either reads from the house room, whose rooms are both of his.
 */
function placeOf(login) {
  const from = isHostsRoom(login.roomId) ? HOUSE : login.roomId;
  return { galleryId: galleryRoomOf(from), gigRooms: gigRoomsOf(from), venueRoom: rooms.get(login.roomId) };
}

// The nights are read once a minute per pub, not once per photograph.
const nightsHeld = new Map();
async function nightsFor(login) {
  const key = `${login.roomId}|${login.venueId}`;
  const held = nightsHeld.get(key);
  if (held && held.at > Date.now() - 60_000) return held.nights;
  const { galleryId, gigRooms } = placeOf(login);
  for (const room of gigRooms) await ensureArchiveRestored(room);
  const folders = photosRepoConfigured() ? await listDirs(photoFolder(galleryId), 'photos') : [];
  const pub = { venue: login.venue, venueId: login.venueId };
  const nights = mergeGigs(gigRooms.flatMap((room) => listArchive(room.paths.archive)), folders.map((f) => f.name))
    .filter((n) => n.hasPhotos && sameVenue(n, pub))
    .map((n) => n.night)
    .sort((a, b) => b.localeCompare(a));
  nightsHeld.set(key, { at: Date.now(), nights });
  return nights;
}

async function venueRecord(login) {
  const { venueRoom } = placeOf(login);
  await ensureInvoicesRestored(venueRoom);
  return (venueRoom.invoices.customers || []).find((c) => c.id === login.venueId) || null;
}

const signedIn = (req) => galleryLogins.who(cookie(req, GALLERY_COOKIE));

export async function getVenuePhotos(req, res, url, route) {
  if (route === '/venue-photos') return serveFile(res, config.publicDir, 'venue-photos.html'), true;

  if (route === '/api/venue-photos') {
    const login = signedIn(req);
    if (!login) return sendJson(res, 401, { signedIn: false }), true;
    res.flightRoom = login.roomId;
    const { galleryId } = placeOf(login);
    const owner = accounts.find(galleryId);
    const rec = await venueRecord(login);
    const { venueRoom } = placeOf(login);
    return sendJson(res, 200, {
      signedIn: true,
      username: login.username,
      venue: login.venue,
      brand: brandForRoom(rooms.get(galleryId)),
      scheme: (owner && owner.scheme) || '',
      hasFrame: Boolean(rec && rec.overlay),
      line: storyLine(login.venue, {
        venues: rec ? [{ name: rec.name, usualNight: rec.usualNight || '' }] : [],
        bookings: venueRoom.invoices.bookings || [],
      }),
      nights: await nightsFor(login),
    }), true;
  }

  if (route === '/api/venue-photos/frame') {
    const login = signedIn(req);
    if (!login) return sendJson(res, 401, { signedIn: false }), true;
    const rec = await venueRecord(login);
    return sendJson(res, 200, { overlay: (rec && rec.overlay) || '' }), true;
  }

  if (route.startsWith('/api/venue-photos/night/')) {
    const login = signedIn(req);
    if (!login) return sendJson(res, 401, { signedIn: false }), true;
    const night = decodeURIComponent(route.slice('/api/venue-photos/night/'.length));
    if (!isNightFolder(night) || !(await nightsFor(login)).includes(night)) return sendJson(res, 404, { error: 'No night of yours with that date.' }), true;
    const files = await nightFiles(`${photoFolder(placeOf(login).galleryId)}/${night}`);
    return sendJson(res, 200, {
      night,
      photos: files.map((f) => safePhotoName(f.name)).filter(Boolean)
        .map((name) => ({ name, url: `/venue-photo/${night}/${name}` })),
    }), true;
  }

  if (route.startsWith('/venue-photo/')) {
    const login = signedIn(req);
    if (!login) return sendJson(res, 401, { signedIn: false }), true;
    const parts = route.slice('/venue-photo/'.length).split('/');
    const night = decodeURIComponent(parts[0] || '');
    const name = safePhotoName(decodeURIComponent(parts[1] || ''));
    if (parts.length !== 2 || !isNightFolder(night) || !name || !(await nightsFor(login)).includes(night)) {
      return sendJson(res, 404, { error: 'No photo there.' }), true;
    }
    const bytes = photosRepoConfigured() ? await photoBytes(`${photoFolder(placeOf(login).galleryId)}/${night}/${name}`) : null;
    if (!bytes) return sendJson(res, 404, { error: 'No photo there.' }), true;
    res.writeHead(200, secure({
      'Content-Type': name.endsWith('.png') ? 'image/png' : name.endsWith('.webp') ? 'image/webp' : 'image/jpeg',
      'Content-Length': bytes.length,
      'Cache-Control': 'private, max-age=86400',
    }));
    return res.end(bytes), true;
  }

  // THE HOST'S SIDE — the logins a pub has, for its card on the Venues tab.
  if (route === '/api/venue-logins') {
    const me = whoIs(req, url);
    const room = me ? roomForHost(req, url) : null;
    if (!room || !isHostsRoom(room.id)) return sendJson(res, 403, { error: 'Pub logins are only on the host\'s own account for now.' }), true;
    const venueId = String(url.searchParams.get('venue') || '');
    return sendJson(res, 200, { logins: galleryLogins.list(room.id, venueId) }), true;
  }
  return false;
}

export async function writeVenuePhotos(req, res, url, route) {
  if (route === '/api/venue-photos/sign-in' && req.method === 'POST') {
    const body = await readJson(req);
    // The accounts desk's own door and seat — a guess here costs a hash too.
    if (!signInAllowed(req)) return sendJson(res, 429, { error: 'Too many tries from here. Wait ten minutes and try again.' }), true;
    const seat = signInSeat();
    if (!seat) return sendJson(res, 429, { error: 'Busy — try again in a moment.' }), true;
    let session;
    try {
      session = await galleryLogins.signIn(String(body.username || ''), String(body.password || ''));
    } finally {
      seat();
    }
    if (!session) return sendJson(res, 401, { error: 'That username and password do not match.' }), true;
    res.setHeader('Set-Cookie', cookieFor(req, GALLERY_COOKIE, session.token));
    await backUpLogins();
    return sendJson(res, 200, { ok: true, username: session.login.username, venue: session.login.venue }), true;
  }

  if (route === '/api/venue-photos/sign-out' && req.method === 'POST') {
    const token = cookie(req, GALLERY_COOKIE);
    if (token) galleryLogins.signOut(token);
    res.setHeader('Set-Cookie', cookieFor(req, GALLERY_COOKIE, '', 0));
    await backUpLogins();
    return sendJson(res, 200, { ok: true }), true;
  }

  if (route === '/api/venue-photos/password' && req.method === 'POST') {
    const body = await readJson(req);
    const token = cookie(req, GALLERY_COOKIE);
    if (!galleryLogins.who(token)) return sendJson(res, 401, { error: 'Sign in again first.' }), true;
    // Too short is said as too short — the breach list would call "short" breached.
    try { checkPassword(body.next); } catch (err) { return sendJson(res, 400, { error: err.message }), true; }
    if (await refuseBreached(res, body.next)) return true;
    try {
      await galleryLogins.changePassword(token, String(body.current || ''), String(body.next || ''));
    } catch (err) {
      return sendJson(res, 400, { error: err.message }), true;
    }
    await backUpLogins();
    return sendJson(res, 200, { ok: true }), true;
  }

  if (route === '/api/venue-logins' && req.method === 'POST') {
    const me = whoIs(req, url);
    const room = me ? roomForHost(req, url) : null;
    if (!room || !isHostsRoom(room.id)) return sendJson(res, 403, { error: 'Pub logins are only on the host\'s own account for now.' }), true;
    const body = await readJson(req);
    await ensureInvoicesRestored(room);
    const rec = (room.invoices.customers || []).find((c) => c.id === String(body.venueId || ''));
    if (!rec) return sendJson(res, 400, { error: 'Pick one of your venues first.' }), true;
    try { checkPassword(body.password); } catch (err) { return sendJson(res, 400, { error: err.message }), true; }
    if (await refuseBreached(res, body.password)) return true;
    let made;
    try {
      made = galleryLogins.create({ roomId: room.id, venueId: rec.id, venue: rec.name, username: body.username, password: String(body.password || '') });
    } catch (err) {
      return sendJson(res, 400, { error: err.message }), true;
    }
    const backup = await backUpLogins();
    return sendJson(res, 200, { ok: true, login: made, backedUp: Boolean(backup && backup.ok) }), true;
  }

  if (route.startsWith('/api/venue-logins/') && req.method === 'DELETE') {
    const me = whoIs(req, url);
    const room = me ? roomForHost(req, url) : null;
    if (!room || !isHostsRoom(room.id)) return sendJson(res, 403, { error: 'Pub logins are only on the host\'s own account for now.' }), true;
    const id = decodeURIComponent(route.slice('/api/venue-logins/'.length));
    if (!galleryLogins.remove(id, room.id)) return sendJson(res, 404, { error: 'No login like that on your account.' }), true;
    await backUpLogins();
    return sendJson(res, 200, { ok: true }), true;
  }
  return false;
}
