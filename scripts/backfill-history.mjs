#!/usr/bin/env node
/**
 * Put every pack on disk into the no-repeats history.
 *
 * The history is written when a pack is MADE, so a pack that arrived any other
 * way — built by hand, written before the history existed, copied in from
 * somewhere — is invisible to it. Those songs are then free to come back in the
 * next round, which is the one thing a regular at a Tuesday night would
 * actually notice.
 *
 * That is not hypothetical: three packs (119 songs) were missing when this was
 * written. Nothing was wrong with the code — they simply never went through a
 * path that records.
 *
 * Safe to run whenever, and safe to run twice: a track already in the history
 * is left alone, so nothing is duplicated and no date is moved.
 *
 *   node scripts/backfill-history.mjs           # say what it would do
 *   node scripts/backfill-history.mjs --write   # actually do it
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readHistory, writeHistory, trackKey } from '../src/history.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BINGO = process.env.BINGO_DIR || path.join(ROOT, 'bingo');
const DATA = process.env.DATA_DIR || path.join(ROOT, 'data');
const write = process.argv.includes('--write');

const history = readHistory(DATA);
const known = new Set(history.entries.map((e) => e.key));
const added = [];

for (const file of fs.readdirSync(BINGO).filter((f) => f.endsWith('.json')).sort()) {
  let pack;
  try {
    pack = JSON.parse(fs.readFileSync(path.join(BINGO, file), 'utf8'));
  } catch (err) {
    console.log(`  ${file}: could not read it — ${err.message}`);
    continue;
  }

  // Dated from when the pack was made where that is recorded. Falling back to
  // today is the safe direction: it blocks the songs for a full three months
  // rather than letting them straight back in.
  const at = Date.parse(pack.createdAt || '') || Date.now();
  const mine = [];
  for (const track of pack.tracks || []) {
    const key = trackKey(track);
    if (known.has(key)) continue;
    known.add(key);
    mine.push({ key, title: track.title, artist: track.artist, packId: pack.id || path.basename(file, '.json'), usedAt: at });
  }
  added.push(...mine);
  const when = pack.createdAt ? new Date(at).toISOString().slice(0, 10) : 'no date, using today';
  console.log(`  ${file.padEnd(26)} ${String((pack.tracks || []).length).padStart(3)} tracks — ${mine.length ? `${mine.length} added (${when})` : 'already all known'}`);
}

console.log(`\n${added.length} songs were missing from the history.`);

if (!added.length) process.exit(0);
if (!write) {
  console.log('Nothing written. Run it again with --write to make the change.');
  process.exit(0);
}

history.entries.push(...added);
writeHistory(DATA, history);
console.log(`Written. The history now has ${history.entries.length} entries.`);
console.log('Commit data/track-history.json so the live app and Claude both see it.');
