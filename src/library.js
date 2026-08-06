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

import { listQuizzes } from './quizzes.js';
import { validateBingoPack } from './bingo.js';

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
          cardSize: pack.cardSize || 4,
          trackCount: (pack.tracks || []).length,
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
export function fullLibrary({ quizDir, bingoDir, dataDir }) {
  const stats = readStats(dataDir);
  const decorate = (item) => ({
    ...item,
    playCount: stats[`${item.kind}:${item.id}`]?.playCount || 0,
    lastPlayedAt: stats[`${item.kind}:${item.id}`]?.lastPlayedAt || null,
  });

  return {
    quizzes: listQuizzes(quizDir).map((q) => decorate({ ...q, kind: 'quiz' })),
    bingo: listBingoPacks(bingoDir).map(decorate),
  };
}

// ------------------------------------------------------------- play history

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

export function recordLaunch(dataDir, kind, id, at = Date.now()) {
  const stats = readStats(dataDir);
  const key = `${kind}:${id}`;
  stats[key] = {
    playCount: (stats[key]?.playCount || 0) + 1,
    lastPlayedAt: at,
  };
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(statsPath(dataDir), JSON.stringify(stats, null, 2), 'utf8');
  } catch {
    /* best effort — never block a launch over a stats file */
  }
  return stats[key];
}

// ------------------------------------------------------------- past nights

function archiveDir(dataDir) {
  return path.join(dataDir, 'archive');
}

/**
 * Keep the result of a night. Named by date and pack so the list reads like a
 * diary: 2026-08-05-eighties.json.
 */
export function archiveResults(dataDir, results, at = Date.now()) {
  const dir = archiveDir(dataDir);
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

export function listArchive(dataDir) {
  let files = [];
  try {
    files = fs.readdirSync(archiveDir(dataDir)).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }
  return files
    .map((file) => {
      try {
        const r = JSON.parse(fs.readFileSync(path.join(archiveDir(dataDir), file), 'utf8'));
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

export function loadArchived(dataDir, id) {
  return JSON.parse(fs.readFileSync(path.join(archiveDir(dataDir), safePackFile(id)), 'utf8'));
}
