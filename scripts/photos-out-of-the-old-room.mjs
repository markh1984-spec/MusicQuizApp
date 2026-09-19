#!/usr/bin/env node
/**
 * DELETE A ROOM'S PHOTO FOLDER — but only once every photograph in it is
 * provably somewhere else.
 *
 * ---
 *
 * The other half of `photos-into-the-right-room.mjs`, which **copies and never
 * moves** so that a mistake costs disk rather than a night's photographs. That
 * leaves a duplicate behind, and a duplicate is not harmless: the next person
 * to read the bucket finds two folders holding the same five nights and no way
 * to tell which one the app reads. It is also the shape that started all of
 * this — a second copy of a night nobody is looking at.
 *
 *     node scripts/photos-out-of-the-old-room.mjs <from> <safeIn>        # look
 *     node scripts/photos-out-of-the-old-room.mjs <from> <safeIn> --go   # do it
 *
 * **IT REFUSES UNLESS THE COPY IS COMPLETE.** Every file under `photos/<from>`
 * has to exist under `photos/<safeIn>` — by name, night by night, plus the
 * files beside the nights that decide what is public. One missing and nothing
 * is deleted and the missing one is named. There is no `--force`: a delete
 * reaches git history on the repository and nothing at all on the object store,
 * so this is the one press in the photo story that cannot be taken back.
 *
 * `house` names the flat `photos/` folder, as it does in the copy script — but
 * it is refused as a SOURCE, deliberately. The flat folder is the destination
 * every read falls back to for a room with no id, and a script that could empty
 * it is a script somebody will one day run with the arguments the wrong way
 * round.
 *
 * Through `github.js` like everything else, so the delete reaches the object
 * store AND the repository while both exist — see `deleteFile()`.
 */

import { listDirs, tryListDir, tryGetFile, deleteFile, photosRepoConfigured, photosRepoName } from '../src/github.js';
import { isNightFolder, photoFolder } from '../src/past-gigs.js';

const [from, safeIn] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const GO = process.argv.includes('--go');
const BESIDE = ['published.json', 'flags.json', 'leagues-published.json'];

if (!from || !safeIn) {
  console.log('\nusage: node scripts/photos-out-of-the-old-room.mjs <fromRoom> <safeInRoom> [--go]\n');
  process.exit(1);
}
/*
 * THE REFUSAL IS ON THE SAFETY COPY, NOT ON THE SOURCE — and it took a real run
 * to get that the right way round.
 *
 * This deletes what is in `from` and provably also in `safeIn`, so the argument
 * order is the whole hazard. Written first as "the flat `photos/` folder may
 * never be a SOURCE", which reads sensibly and blocks the one cleanup the flat
 * folder actually needs. The catastrophic direction is the other one: with the
 * house nights now copied into a real room, `<that room> house` would delete
 * fifty-seven live photographs BECAUSE the flat folder holds copies of them.
 *
 * So `house` is refused as the thing being trusted, and allowed as the thing
 * being cleared. A room still cannot be its own safety copy.
 */
if (safeIn === 'house' || from === safeIn) {
  console.log('\nRefused. The flat house folder cannot be the safety copy, and a room cannot be its own.\n');
  process.exit(1);
}
if (!photosRepoConfigured()) {
  console.log('\nNo photo store configured — run this where the variables are.\n');
  process.exit(1);
}

const gone = photoFolder(from);
const kept = photoFolder(safeIn);
console.log(`\ndelete ${gone}      keep ${kept}      (${photosRepoName()})\n`);

/** Every path under a room's folder: the nights' photographs, then the sidecars. */
async function everything(folder) {
  const out = [];
  const nights = (await listDirs(folder, 'photos')).map((f) => f.name).filter(isNightFolder).sort();
  for (const night of nights) {
    const read = await tryListDir(`${folder}/${night}`, 'photos');
    if (!read.ok) return { ok: false, error: `could not list ${folder}/${night} — ${read.error}` };
    for (const f of read.files) out.push(`${night}/${f.name}`);
  }
  for (const name of BESIDE) {
    const read = await tryGetFile(`${folder}/${name}`, 'photos');
    if (read.ok && read.body) out.push(name);
  }
  return { ok: true, paths: out };
}

const mine = await everything(gone);
if (!mine.ok) { console.log(`  ${mine.error}\n`); process.exit(1); }
if (!mine.paths.length) { console.log('  nothing in there — nothing to delete\n'); process.exit(0); }

const theirs = await everything(kept);
if (!theirs.ok) { console.log(`  ${theirs.error}\n`); process.exit(1); }
const safe = new Set(theirs.paths);

const missing = mine.paths.filter((p) => !safe.has(p));
console.log(`  ${mine.paths.length} file(s) in ${gone}, ${theirs.paths.length} in ${kept}`);
if (missing.length) {
  console.log(`\n  REFUSED — ${missing.length} file(s) are not in ${kept}:`);
  for (const p of missing.slice(0, 20)) console.log(`     ${p}`);
  if (missing.length > 20) console.log(`     …and ${missing.length - 20} more`);
  console.log(`\n  Copy them first: node scripts/photos-into-the-right-room.mjs ${from} ${safeIn} --go\n`);
  process.exit(1);
}

if (!GO) {
  console.log(`\n  Every one of them is already in ${kept}, so ${mine.paths.length} file(s) WOULD be deleted.`);
  console.log('  Nothing was changed. Add --go when the line above reads right.\n');
  process.exit(0);
}

let done = 0;
let failed = 0;
for (const p of mine.paths) {
  const r = await deleteFile(`${gone}/${p}`, 'Delete the duplicate copy of these photographs', 'photos');
  if (r.ok) { done += 1; } else { console.log(`     COULD NOT DELETE ${p} — ${r.error}`); failed += 1; }
}
console.log(`\n${done} file(s) deleted${failed ? `, ${failed} FAILED` : ''}.\n`);
