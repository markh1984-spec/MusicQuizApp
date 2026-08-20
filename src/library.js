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

/**
 * Change part of a night that has already been filed.
 *
 * **It exists because the drinks are handed over AFTER the night is over.**
 * A night is archived the moment it reaches the final scores, and the bar
 * scans the winner's QR several minutes later — so every night in the record
 * said `redeemedAt: null` for every voucher, for ever. The live panel on the
 * control view was right and the permanent record was wrong, which is the
 * worst way round: one of them is a screen you glance at and the other is the
 * evidence a quizmaster shows a venue.
 *
 * An UPDATE rather than a second archive, deliberately — `archivedAs` guards
 * against filing a night twice, and two copies of one evening on the Past
 * gigs page is a worse bug than the one being fixed.
 *
 * Returns null rather than throwing if there is nothing there. A night can be
 * deleted, and a voucher moving must never be the thing that takes the app
 * down in front of a room.
 */
export function updateArchivedNight(dir, id, patch) {
  const safe = String(id || '');
  // Same rule as the restore: a name that is not plain letters, digits and
  // hyphens is refused rather than scrubbed, because stripping the bad
  // characters out invents a filename instead of saying no.
  if (!/^[a-z0-9-]+$/i.test(safe)) return null;
  const file = path.join(dir, safe + '.json');
  try {
    const record = JSON.parse(fs.readFileSync(file, 'utf8'));
    const updated = { ...record, ...patch };
    fs.writeFileSync(file, JSON.stringify(updated, null, 2) + '\n', 'utf8');
    return updated;
  } catch {
    return null;
  }
}

/**
 * The whole archive as one file, for the backup.
 *
 * **A night archive that does not survive a deploy is not a record of
 * anything.** It lives in `data/`, which on a host with no permanent disk is
 * empty again every time the app restarts — so every gig a quizmaster had
 * played simply vanished, and the only clue was a page that used to have
 * things on it and now does not.
 *
 * That mattered little while it was a curiosity. It matters a lot now the
 * archive is the "past gigs" record a quizmaster shows a venue when they are
 * pitching for work.
 */
export function serialiseArchive(dir) {
  let files = [];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  } catch {
    return JSON.stringify({ nights: [] }, null, 2) + '\n';
  }
  const nights = [];
  for (const file of files) {
    try {
      nights.push(JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')));
    } catch {
      // A single unreadable night must not cost the rest of somebody's history.
    }
  }
  return JSON.stringify({ nights }, null, 2) + '\n';
}

/**
 * Put it back, and ONLY into an empty archive.
 *
 * The same rule as the accounts, the invoice book and the play counts: a disk
 * that already has nights on it is ahead of any backup, and reading one over
 * the top would either duplicate a night or lose one, depending which way it
 * went.
 */
export function restoreArchive(dir, serialised) {
  let already = [];
  try {
    already = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  } catch { /* no folder yet is exactly the case this is for */ }
  if (already.length) return { ok: false, reason: 'already_have_some' };

  let parsed;
  try {
    parsed = JSON.parse(String(serialised));
  } catch (err) {
    return { ok: false, reason: 'unreadable', error: err.message };
  }
  if (!parsed || !Array.isArray(parsed.nights)) return { ok: false, reason: 'nothing_in_it' };

  fs.mkdirSync(dir, { recursive: true });
  let written = 0;
  for (const night of parsed.nights) {
    /*
     * Refused, not scrubbed. `archiveResults` only ever issues an id of
     * letters, digits and hyphens, so anything else did not come from here —
     * and stripping the bad characters out would quietly invent a filename
     * ("../../escaped" becoming "escaped.json") rather than saying no to
     * something that has no business being in a backup.
     */
    const id = String(night && night.id || '');
    if (!/^[a-z0-9-]+$/i.test(id)) continue;
    fs.writeFileSync(path.join(dir, id + '.json'), JSON.stringify(night, null, 2) + '\n', 'utf8');
    written++;
  }
  return { ok: true, nights: written };
}

/**
 * The nights on disk, as summaries.
 *
 * `boards: true` keeps each night's LEADERBOARD on the summary, which the
 * league needs and nothing else does. Behind an option rather than always on,
 * because these summaries are sent to the browser by `/api/past-gigs` and a
 * season of full leaderboards is a lot of payload for a list of dates — and
 * the one place that wants them (the league, computed on the server) never
 * sends them anywhere.
 */
export function listArchive(dir, { boards = false } = {}) {
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
          // Where it happened. Absent on every night filed before venues
          // existed, which is exactly right — those nights have no venue and
          // saying "" is honest where guessing one would not be.
          venue: r.venue || '',
          // The join. Empty on every night filed before it existed, which is
          // exactly why `venueKeyOf()` falls back to the name.
          venueId: r.venueId || '',
          // What was put up, first place first. Needed by `rewardsUsed` and
          // `rewardsByVenue`, which read this list rather than every file —
          // and both would have quietly returned nothing without it, because
          // this function builds a SUBSET rather than passing the record
          // through. The old single `reward` is read too, so a night filed
          // before there were three places still offers its prize back.
          rewards: Array.isArray(r.rewards) && r.rewards.length
            ? r.rewards
            : (r.reward ? [r.reward] : []),
          playerCount: (r.leaderboard || []).length,
          winner: (r.leaderboard || [])[0]?.name || null,
          /*
           * HOW MANY PRIZES WERE ACTUALLY TAKEN.
           *
           * The vouchers have been in the filed record since the bar started
           * scanning them, and `updateArchivedNight()` keeps them current when
           * one is redeemed minutes after the night is archived. Nothing ever
           * read the number back out, so Gigs could say what was PUT UP and
           * never what was COLLECTED — which is the half a landlord asks about,
           * and the half that says whether a prize is still owed behind the bar.
           *
           * A count rather than the vouchers themselves: this summary is built
           * for a list, and the codes are somebody's to redeem rather than
           * something to scatter through a payload.
           */
          rewardsTaken: (r.vouchers || []).filter((v) => v && v.redeemedAt).length,
          /*
           * HOW MANY TIMES A VOUCHER WAS PUT BACK — the signal worth reading,
           * not the redemption itself. `reinstateVoucher()` in engine.js has
           * counted this on the voucher since the day Put it back existed; it
           * simply never left the live control view. A voucher redeemed once
           * is the system working; one put back three times is either a bar
           * that cannot reach us or somebody working it.
           */
          rewardsReinstated: (r.vouchers || []).reduce((n, v) => n + (v && v.reinstated ? v.reinstated : 0), 0),
          // Only when asked for — see the note on the signature.
          ...(boards ? { leaderboard: r.leaderboard || [] } : {}),
          /*
           * A RUNNING-ORDER NIGHT'S OWN PARTS — quiz, a bingo interlude, quiz
           * again — small enough to carry unconditionally, unlike the
           * leaderboard above. Absent entirely on an ordinary night, same as
           * every other conditional field here: this function builds a
           * SUBSET, so a field left out of the object above never silently
           * reaches `mergeGigs()` no matter what the record on disk holds.
           */
          ...(Array.isArray(r.parts) && r.parts.length ? { parts: r.parts } : {}),
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


/**
 * Every venue this room has run a night at, most recent first.
 *
 * Offered back in the launch box so "The Dog and Duck" is typed once and
 * tapped ever after — which is most of what makes a venue on a night worth
 * having, because a field you retype every week gets left blank by the third
 * week and then the whole record is holes.
 *
 * Read off the ARCHIVE rather than kept as a list, for the same reason
 * `question-history.js` reads the packs: a second list is a second thing to
 * keep in sync, and a night that is deleted should take its venue with it if
 * nothing else was ever there.
 */
/**
 * What has been given away before, newest first.
 *
 * The same trick as `venuesUsed` and for the same reason: most weeks at one
 * pub have the same prize, and a field you retype every week is a field that
 * is blank by the third week. Read off the archive rather than kept as a list,
 * so a deleted night takes its prize with it and there is nothing to sync.
 */
export function rewardsUsed(dir) {
  const seen = new Map();
  for (const night of listArchive(dir)) {
    for (const name of nightRewards(night)) {
      if (!seen.has(name.toLowerCase())) seen.set(name.toLowerCase(), name);
    }
  }
  return [...seen.values()];
}

/** What a night paid out, first place first, whichever version wrote it. */
function nightRewards(night) {
  const list = Array.isArray(night.rewards) && night.rewards.length
    ? night.rewards
    : (night.reward ? [night.reward] : []);
  return list.map((r) => String(r || '').trim()).filter(Boolean);
}

/**
 * WHAT EACH VENUE PUTS UP, newest night first.
 *
 * The venue buys the prize, so it is their standing arrangement rather than a
 * fact about the quiz — the same drink every week at one pub and something
 * else entirely at another. Offering back "what this venue gave last time" is
 * the difference between a field somebody fills in and a field somebody
 * confirms, which is the whole shape this app uses everywhere: the app
 * prepares, the human reads, the human presses.
 *
 * Read off the archive like `venuesUsed`, so there is no second list to keep
 * in sync and a deleted night takes its arrangement with it.
 */
export function rewardsByVenue(dir) {
  const out = {};
  // `listArchive` is newest first, so the first time a venue is seen is the
  // last thing it actually gave out.
  for (const night of listArchive(dir)) {
    const venue = String(night.venue || '').trim();
    if (!venue || out[venue]) continue;
    const rewards = nightRewards(night);
    if (rewards.length) out[venue] = rewards;
  }
  return out;
}

export function venuesUsed(dir) {
  const seen = new Map();
  for (const night of listArchive(dir)) {
    const name = String(night.venue || '').trim();
    if (!name) continue;
    // Newest wins, so the list is ordered by when it was last used.
    if (!seen.has(name.toLowerCase())) seen.set(name.toLowerCase(), name);
  }
  return [...seen.values()];
}
