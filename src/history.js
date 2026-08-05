/**
 * What you have already played, so you stop playing it.
 *
 * Every track that goes into a generated bingo pack is written down with the
 * date. The generator then refuses to reuse anything from the last few months,
 * so a regular at your Tuesday night does not get "Take On Me" four weeks in
 * a row.
 *
 * IMPORTANT, AND IN THE DOCS TOO: this lives in the data folder. On a host
 * that wipes its filesystem on every deploy (Render's free and starter tiers
 * both do) this memory resets, and the generator quietly starts allowing
 * repeats again. To make it stick you need a Render Disk mounted at the data
 * folder, or you generate packs on your own laptop where the file survives.
 */

import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_MONTHS = 3;
const DAY = 86400000;

function historyPath(dataDir) {
  return path.join(dataDir, 'track-history.json');
}

/** A track is "the same track" if the title and artist match, loosely. */
export function trackKey(track) {
  const norm = (s) => String(s || '')
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, '')       // "(Remastered 2011)", "[Live]"
    .replace(/ - .*$/, '')                  // " - Radio Edit"
    .replace(/[^a-z0-9]+/g, '')
    .trim();
  return `${norm(track.title)}|${norm(track.artist)}`;
}

export function readHistory(dataDir) {
  try {
    const parsed = JSON.parse(fs.readFileSync(historyPath(dataDir), 'utf8'));
    return Array.isArray(parsed.entries) ? parsed : { entries: [] };
  } catch {
    return { entries: [] };
  }
}

export function writeHistory(dataDir, history) {
  fs.mkdirSync(dataDir, { recursive: true });
  const file = historyPath(dataDir);
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(history, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, file);
}

/**
 * Record a pack's tracks as used.
 * @returns {number} how many entries were added
 */
export function recordUsed(dataDir, tracks, { packId = '', at = Date.now() } = {}) {
  const history = readHistory(dataDir);
  for (const t of tracks) {
    history.entries.push({
      key: trackKey(t),
      title: t.title,
      artist: t.artist,
      packId,
      usedAt: at,
    });
  }
  // Keep a year and a half. Beyond that it is not informing any decision and
  // the file just grows.
  const cutoff = at - 550 * DAY;
  history.entries = history.entries.filter((e) => e.usedAt >= cutoff);
  writeHistory(dataDir, history);
  return tracks.length;
}

/**
 * Everything played within the window, as a Set of keys the generator can
 * check against.
 */
export function recentKeys(dataDir, months = DEFAULT_MONTHS, now = Date.now()) {
  const cutoff = now - months * 30 * DAY;
  const keys = new Set();
  for (const entry of readHistory(dataDir).entries) {
    if (entry.usedAt >= cutoff) keys.add(entry.key);
  }
  return keys;
}

/** The same thing, but readable, for showing you what is currently blocked. */
export function recentTracks(dataDir, months = DEFAULT_MONTHS, now = Date.now()) {
  const cutoff = now - months * 30 * DAY;
  const seen = new Map();
  for (const entry of readHistory(dataDir).entries) {
    if (entry.usedAt < cutoff) continue;
    const existing = seen.get(entry.key);
    if (!existing || entry.usedAt > existing.usedAt) seen.set(entry.key, entry);
  }
  return [...seen.values()].sort((a, b) => b.usedAt - a.usedAt);
}

/** Drop anything from a candidate list that has been played recently. */
export function filterRecent(dataDir, tracks, months = DEFAULT_MONTHS, now = Date.now()) {
  const blocked = recentKeys(dataDir, months, now);
  const kept = [];
  const dropped = [];
  const seenInBatch = new Set();

  for (const track of tracks) {
    const key = trackKey(track);
    if (blocked.has(key)) {
      dropped.push({ ...track, reason: 'played recently' });
    } else if (seenInBatch.has(key)) {
      dropped.push({ ...track, reason: 'duplicate in this list' });
    } else {
      seenInBatch.add(key);
      kept.push(track);
    }
  }
  return { kept, dropped };
}

export function forgetAll(dataDir) {
  writeHistory(dataDir, { entries: [] });
  return true;
}
