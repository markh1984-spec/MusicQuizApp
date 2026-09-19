#!/usr/bin/env node
/**
 * PUT BACK THE ONE FACT A HUMAN STILL KNOWS: WHICH PUB A NIGHT WAS AT.
 *
 * ---
 *
 * Written on 19 September 2026, after six weeks of night archives turned out
 * never to have been backed up (see `saidSo()` in `http/helpers.js`). The
 * photographs survived — they go to the photo store — but the records did not,
 * so five nights came back as dates with pictures and nothing else: no venue,
 * therefore no frame on the gallery, nothing in the league, nothing in the
 * headcounts.
 *
 * **THE SCORES ARE GONE AND THIS DOES NOT PRETEND OTHERWISE.** It writes the
 * same NOTE the console's own venue picker writes — `noteNightVenue()`, a
 * record carrying the venue and nothing else, which `mergeGigs()` deliberately
 * does not count as a game. The night still reads *"No results saved"*, because
 * it still has none. It just knows which pub it was at, which is the fact the
 * gallery's frame, the season table and the headcount-per-venue all hang on.
 *
 * **IT IS THE CONSOLE'S OWN PATH, not a second one** — the same two functions
 * the picker calls (`setNightVenue` where a record exists, `noteNightVenue`
 * where none does), so a night fixed here and a night fixed by hand cannot
 * differ.
 *
 * **AND IT BACKS UP AFTERWARDS, which is the whole point.** Writing into
 * `data/` alone would last until the next deploy — the fault this exists to
 * repair, repeated.
 *
 *     node scripts/say-where-these-nights-were.mjs <room> "The Pub" 2026-08-13 …
 *     node scripts/say-where-these-nights-were.mjs <room> "The Pub" 2026-08-13 … --go
 *
 * The venue is matched by NAME, deliberately: no `venueId` is written, because
 * the id of a venue record that was lost is worth nothing and a wrong one is
 * worse than none. `sameVenue()` and `venueOverlayFor()` both match on the name
 * when there is no id, so re-adding the venue with the SAME NAME is all it
 * takes for the overlay to land on every one of these nights.
 */

import fs from 'node:fs';
import path from 'node:path';
import { config } from '../src/config.js';
import { listArchive, serialiseArchive } from '../src/library.js';
import { nightOfGig, isNightFolder, setNightVenue, noteNightVenue } from '../src/past-gigs.js';
import { putFile, privateRepoConfigured, photosRepoName } from '../src/github.js';
import { HOUSE } from '../src/rooms.js';

const args = process.argv.slice(2);
const GO = args.includes('--go');
const [room, venue, ...nights] = args.filter((a) => a !== '--go');

if (!room || !venue || !nights.length) {
  console.log('\nusage: node scripts/say-where-these-nights-were.mjs <room> "The Pub, Town" 2026-08-13 2026-08-20 [--go]\n');
  process.exit(1);
}
const bad = nights.filter((n) => !isNightFolder(n));
if (bad.length) {
  console.log(`\nthese are not nights: ${bad.join(', ')}  (they look like 2026-08-13)\n`);
  process.exit(1);
}

const dir = room === HOUSE
  ? path.join(config.dataDir, 'archive')
  : path.join(config.dataDir, 'rooms', room, 'archive');
const backupName = room === HOUSE ? 'archive.json' : `archive-${room}.json`;

console.log(`\n${venue}\n  onto ${nights.length} night(s) in ${dir}\n`);
fs.mkdirSync(dir, { recursive: true });

let written = 0;
for (const night of nights) {
  const has = listArchive(dir).filter((r) => nightOfGig(r.archivedAt) === night);
  if (has.length) {
    // A record exists — patch it, exactly as the picker does.
    if (!GO) { console.log(`  ${night} — would name the pub on ${has.length} filed record(s)`); written += 1; continue; }
    const out = setNightVenue(dir, night, { venue });
    console.log(`  ${night} — named the pub on ${out.changed} record(s)`);
    written += out.changed;
  } else {
    if (!GO) { console.log(`  ${night} — would file a note (nothing was ever saved for this night)`); written += 1; continue; }
    const rec = noteNightVenue(dir, night, { venue });
    console.log(`  ${night} — ${rec ? 'filed a note' : 'REFUSED'}`);
    if (rec) written += 1;
  }
}

if (!GO) {
  console.log(`\nLooked only — ${written} night(s) would be written. Add --go.\n`);
  process.exit(0);
}

/*
 * AND STRAIGHT INTO THE BACKUP. `data/` is wiped on every deploy and there is
 * no disk: an archive that is only on this box is the exact fault being
 * repaired here, so the repair is not finished until the file has landed.
 */
if (!privateRepoConfigured()) {
  console.log('\nWROTE THE NIGHTS BUT COULD NOT BACK THEM UP — no private repo configured.');
  console.log('They will be gone at the next deploy. Set PHOTO_REPO and PHOTO_TOKEN and run this again.\n');
  process.exit(1);
}
const put = await putFile(backupName, serialiseArchive(dir), 'Say where these nights were', 'private');
console.log(put.ok
  ? `\n${written} night(s) written, and ${backupName} is in ${photosRepoName()}.\n`
  : `\n${written} night(s) written — BUT THE BACKUP FAILED: ${put.error}\nThey are on this box only, which a deploy wipes.\n`);
process.exit(put.ok ? 0 : 1);
