#!/usr/bin/env node
/**
 * PUT A ROOM'S PHOTOGRAPHS WHERE THE APP IS LOOKING FOR THEM.
 *
 * ---
 *
 * Found on 19 September 2026, after `/api/gallery` came back `nights: []` on a
 * room with five nights of photographs in it. They were all there — filed under
 * `photos/3bLePiEIs6js`, a room id the accounts book no longer names — while
 * every reader asks `photoFolder(galleryRoomFor())`, which is the owner's own
 * quizmaster room. **A read and a write that disagree about the room**, the
 * fourth sighting in this codebase and the first that moved a whole gallery.
 *
 * So this copies one room's photo folder onto another's:
 *
 *     node scripts/photos-into-the-right-room.mjs <from> <to>        # look
 *     node scripts/photos-into-the-right-room.mjs <from> <to> --go   # do it
 *
 * **IT COPIES AND NEVER MOVES.** The source is left exactly as it is, so a
 * mistake costs disk rather than a night's photographs — and the bin, the
 * publish lamp and a human all still work on the copy. Deleting the old folder
 * is a separate, deliberate act once the gallery is seen to be right.
 *
 * **IT CARRIES THE FILES BESIDE THE NIGHTS TOO.** `published.json` is what
 * makes a night visible to a stranger, and it sits at the ROOT of the room's
 * folder rather than inside a night — move the pictures without it and the
 * gallery is still empty, which would read as the repair not working.
 * `flags.json` and `leagues-published.json` ride along for the same reason.
 *
 * **IT REFUSES TO WRITE OVER ANYTHING.** A destination file that already exists
 * is left alone and named. Nothing here is clever enough to merge two
 * `published.json` files, and guessing would unpublish a night.
 *
 * It goes through `github.js` like everything else, so a read is the store then
 * the repository and a write lands in whichever store is configured — the one
 * choke point, unchanged.
 */

import { listDirs, tryListDir, tryGetFile, putFile, photosRepoConfigured, photosRepoName } from '../src/github.js';
import { isNightFolder } from '../src/past-gigs.js';

const [from, to] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const GO = process.argv.includes('--go');
const BESIDE = ['published.json', 'flags.json', 'leagues-published.json'];

if (!from || !to) {
  console.log('\nusage: node scripts/photos-into-the-right-room.mjs <fromRoom> <toRoom> [--go]\n');
  process.exit(1);
}
if (!photosRepoConfigured()) {
  console.log('\nNo photo store configured — run this where the variables are.\n');
  process.exit(1);
}

const folderOf = (room) => `photos/${room}`;
console.log(`\n${folderOf(from)}  ->  ${folderOf(to)}      (${photosRepoName()})\n`);

const nights = (await listDirs(folderOf(from), 'photos')).map((f) => f.name).filter(isNightFolder).sort();
if (!nights.length) console.log('  no night folders in the source — nothing to copy');

let copied = 0;
let skipped = 0;
let failed = 0;

async function carry(path, into) {
  const already = await tryGetFile(into, 'photos');
  if (already.ok && already.body) { console.log(`     already there, left alone: ${into}`); skipped += 1; return; }
  const read = await tryGetFile(path, 'photos');
  if (!read.ok) { console.log(`     COULD NOT READ ${path} — ${read.error}`); failed += 1; return; }
  if (!read.body) { console.log(`     nothing at ${path}`); return; }
  if (!GO) { copied += 1; return; }
  const put = await putFile(into, read.body, 'Move photographs into the room the app reads', 'photos');
  if (!put.ok) { console.log(`     COULD NOT WRITE ${into} — ${put.error}`); failed += 1; return; }
  copied += 1;
}

for (const night of nights) {
  const files = (await tryListDir(`${folderOf(from)}/${night}`, 'photos'));
  const names = files.ok ? files.files.map((f) => f.name) : [];
  console.log(`  ${night} — ${names.length} photograph(s)${files.ok ? '' : ` — COULD NOT LIST: ${files.error}`}`);
  for (const name of names) {
    await carry(`${folderOf(from)}/${night}/${name}`, `${folderOf(to)}/${night}/${name}`);
  }
}

console.log('\n  and the files beside the nights (what makes them public):');
for (const name of BESIDE) {
  await carry(`${folderOf(from)}/${name}`, `${folderOf(to)}/${name}`);
}

console.log(`\n${GO ? `${copied} file(s) copied` : `${copied} file(s) WOULD be copied`}${skipped ? `, ${skipped} left alone` : ''}${failed ? `, ${failed} FAILED` : ''}.`);
if (!GO) console.log('Nothing was changed. Add --go when the list above reads right.');
console.log('The source folder is untouched either way — delete it by hand once the gallery is right.\n');
