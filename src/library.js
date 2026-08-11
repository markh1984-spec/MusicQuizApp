/**
 * Your library of games, and a record of the nights you have run.
 *
 * A "game pack" is just a JSON file on disk — a quiz pack in /quizzes or a
 * bingo pack in /bingo. That is what makes a Harry Potter quiz reusable: it is
 * a file, so it sits there until you delete it, and launching it again is one
 * tap in the console.
 *
 * Play counts and last-played dates live in /data, which is convenience rather
 * than truth. On a host that wipes its filesystem on redeploy those numbers go
 * back to zero — the packs themselves, which are the bit that matters, are in
 * git and do not.
 */

import fs from 'node:fs';
import path from 'node:path';

import { listQuizzes, searchBlob } from './quizzes.js';
import { validateBingoPack, cardShape, shapeFields } from './bingo.js';

export const GAME_KINDS = ['quiz', 'bingo'];

/** Every bingo pack in the folder, summarised. */
export function listBingoPacks(dir) {
  let files = [];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }
  return files
    .map((file) => {
      try {
        const pack = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
        return {
          id: pack.id || path.basename(file, '.json'),
          kind: 'bingo',
          file,
          title: pack.title || file,
          subtitle: pack.subtitle || '',
          // The shape it was filed as. Only a default — the shape is chosen
          // when you launch it, so the same pack can be a quick game one week
          // and a long one the next.
          look: pack.look || 'default',
          cardSize: pack.cardSize || 4,
          ...shapeFields(cardShape(pack)),
          trackCount: (pack.tracks || []).length,
          // Every artist and title, so the console's search box can answer
          // "which pack has Abba on it" — see `searchBlob` in quizzes.js.
          search: searchBlob([
            pack.title, pack.subtitle,
            ...(pack.tracks || []).flatMap((t) => [t.artist, t.title]),
          ]),
          // The playlist this pack was built with, so the console can put it
          // one tap away on the night. It was only ever shown once, in the
          // generator's log, and then you had to go and find it in Spotify.
          playlist: (pack.spotifyPlaylist && pack.spotifyPlaylist.url) || '',
          problems: validateBingoPack(pack).length,
        };
      } catch (err) {
        return { id: path.basename(file, '.json'), kind: 'bingo', file, title: file, broken: err.message };
      }
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function loadBingoPack(dir, id) {
  const file = path.join(dir, safePackFile(id));
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function saveBingoPack(dir, id, pack) {
  const file = path.join(dir, safePackFile(id));
  const tmp = file + '.tmp';
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(pack, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, file);
  return true;
}

export function deleteBingoPack(dir, id) {
  fs.unlinkSync(path.join(dir, safePackFile(id)));
  return true;
}

export function safePackFile(id) {
  const clean = String(id || '').replace(/[^a-zA-Z0-9._-]/g, '');
  if (!clean || clean.startsWith('.')) throw new Error('Bad pack id: ' + id);
  return clean.endsWith('.json') ? clean : clean + '.json';
}

/**
 * The whole library: quizzes and bingo packs together, each tagged with how
 * often you have run it and when you last did.
 */
/**
 * @param {object} [own]  this room's OWN packs, already summarised — see
 *   `listOwn()` in own-packs.js. Passed IN rather than read here, because the
 *   folder they live in is a rooms question and this file deliberately does
 *   not know rooms exist. (It is also what keeps the two modules from
 *   importing each other in a circle.)
 *
 *   They go through the same decoration as the catalogue's, so "played twice"
 *   works on a quiz somebody wrote themselves, and they carry `mine: true` so
 *   the console can mark them without a second kind of pack card.
 */
export function fullLibrary({ quizDir, bingoDir, dataDir }, roomId = HOUSE_ROOM, own = null) {
  const mine = statsFor(readStats(dataDir), roomId);
  const decorate = (item) => ({
    ...item,
    playCount: mine[`${item.kind}:${item.id}`]?.playCount || 0,
    lastPlayedAt: mine[`${item.kind}:${item.id}`]?.lastPlayedAt || null,
  });

  return {
    quizzes: [
      ...listQuizzes(quizDir).map((q) => decorate({ ...q, kind: 'quiz' })),
      ...((own && own.quizzes) || []).map((q) => decorate({ ...q, kind: 'quiz' })),
    ],
    bingo: [
      ...listBingoPacks(bingoDir).map(decorate),
      ...((own && own.bingo) || []).map((b) => decorate({ ...b, kind: 'bingo' })),
    ],
  };
}

// ------------------------------------------------------------- play history

/**
 * "Never played" is per QUIZMASTER, not per pack.
 *
 * The library is shared — the owner writes the packs and everybody plays them
 * — but how often YOU have run one is a fact about your nights, not about the
 * file. Counting them globally would tell Rob a quiz he has never opened was
 * played twice last week, which is worse than no count at all: the whole use
 * of this line is deciding what not to run at the same venue again.
 *
 * One file rather than one per room, so it is one thing to back up, keyed by
 * room inside it.
 */
export const HOUSE_ROOM = 'house';

function statsPath(dataDir) {
  return path.join(dataDir, 'library-stats.json');
}

export function readStats(dataDir) {
  try {
    return JSON.parse(fs.readFileSync(statsPath(dataDir), 'utf8'));
  } catch {
    return {};
  }
}

/**
 * One room's counts, coping with the flat shape this file used to have.
 *
 * Everything recorded before rooms existed was the house room's by definition
 * — it was the only game there was — so it is read as the house's rather than
 * thrown away. A pack a quizmaster has genuinely never played still reads as
 * never played, because a bare `kind:id` key is only ever the house's.
 */
export function statsFor(stats, roomId = HOUSE_ROOM) {
  const rooms = stats && stats.rooms ? stats.rooms : {};
  const old = Object.fromEntries(
    Object.entries(stats || {}).filter(([k]) => k.includes(':')),
  );
  const mine = rooms[roomId] || {};
  return roomId === HOUSE_ROOM ? { ...old, ...mine } : mine;
}

export function recordLaunch(dataDir, kind, id, at = Date.now(), roomId = HOUSE_ROOM) {
  const stats = readStats(dataDir);
  if (!stats.rooms) stats.rooms = {};
  // Fold anything from before rooms into the house on first write, so the file
  // only ever holds one answer to "how many times has the house played this".
  if (!stats.rooms[HOUSE_ROOM]) {
    const old = Object.entries(stats).filter(([k]) => k.includes(':'));
    if (old.length) stats.rooms[HOUSE_ROOM] = Object.fromEntries(old);
  }
  for (const key of Object.keys(stats)) if (key.includes(':')) delete stats[key];

  const room = stats.rooms[roomId] || (stats.rooms[roomId] = {});
  const key = `${kind}:${id}`;
  room[key] = {
    playCount: (room[key]?.playCount || 0) + 1,
    lastPlayedAt: at,
  };
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(statsPath(dataDir), JSON.stringify(stats, null, 2), 'utf8');
  } catch {
    /* best effort — never block a launch over a stats file */
  }
  return room[key];
}

// ------------------------------------------------------------- past nights

/*
 * These take the ARCHIVE DIRECTORY, not the data directory.
 *
 * A record of the nights you have run is a fact about YOUR nights, so it
 * belongs to a room rather than to the server — `rooms.pathsFor()` decides
 * where, and the house keeps `data/archive/` exactly where it always was.
 * Taking the folder itself rather than appending "archive" here is what makes
 * that possible without this file knowing rooms exist.
 */

/**
 * Keep the result of a night. Named by date and pack so the list reads like a
 * diary: 2026-08-05-eighties.json.
 */
export function archiveResults(dir, results, at = Date.now()) {
  fs.mkdirSync(dir, { recursive: true });
  const date = new Date(at).toISOString().slice(0, 10);
  const base = `${date}-${String(results.packId || results.quizId || 'game').replace(/[^a-z0-9-]/gi, '')}`;

  // Two gigs with the same pack on the same day should not overwrite each other.
  let name = base;
  let n = 2;
  while (fs.existsSync(path.join(dir, name + '.json'))) name = `${base}-${n++}`;

  const record = { ...results, archivedAt: at, id: name };
  fs.writeFileSync(path.join(dir, name + '.json'), JSON.stringify(record, null, 2) + '\n', 'utf8');
  return record;
}

export function listArchive(dir) {
  let files = [];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }
  return files
    .map((file) => {
      try {
        const r = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
        return {
          id: r.id || path.basename(file, '.json'),
          kind: r.kind || 'quiz',
          title: r.quizTitle || r.title || file,
          archivedAt: r.archivedAt || null,
          playerCount: (r.leaderboard || []).length,
          winner: (r.leaderboard || [])[0]?.name || null,
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => (b.archivedAt || 0) - (a.archivedAt || 0));
}

export function loadArchived(dir, id) {
  return JSON.parse(fs.readFileSync(path.join(dir, safePackFile(id)), 'utf8'));
}
