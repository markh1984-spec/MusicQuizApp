#!/usr/bin/env node
/**
 * MOVE THE PHOTOGRAPHS OUT OF THE PRIVATE REPOSITORY AND INTO THE OBJECT
 * STORE — once, by hand, with the repository left exactly as it was.
 *
 * ---
 *
 * **NOTHING DEPENDS ON THIS HAVING RUN.** The app reads the store first and
 * the repository after (see the note at the top of `src/github.js`), so every
 * night already filed goes on working whether this is run today, next month
 * or never. That is on purpose: a migration that has to run before the app
 * works is a migration that can half-run in front of a room.
 *
 * **SO WHAT THIS IS FOR IS DELETING THE REPOSITORY AFTERWARDS.** That is the
 * whole prize. While the old repo exists, so does its history — every binned
 * photograph, every duplicate, for ever, because that is what version control
 * promises. Copying the current files across and then removing the repository
 * outright is the only thing that genuinely erases them, and it is a thing a
 * human does deliberately, on a laptop, having looked at the count.
 *
 * **IT COPIES WHAT IS THERE NOW, WHICH IS EXACTLY THE POINT.** A binned
 * photograph is not in the working tree, so it is not copied — it simply stops
 * existing when the repository goes.
 *
 * **IT SAYS WHAT IT WILL DO AND DOES NOTHING UNTIL TOLD.** Run it once to
 * read the plan, then again with `--go`. Every copy is verified by reading the
 * bytes back out of the store and comparing the length, because *a test that
 * never runs the artefact proves nothing about it* and this one is moving
 * somebody's only copy.
 *
 *     node scripts/photos-to-r2.mjs          # what would move
 *     node scripts/photos-to-r2.mjs --go     # move it
 *
 * Needs BOTH sets of variables in the environment: PHOTO_REPO / PHOTO_TOKEN
 * for the side it is reading, and R2_ENDPOINT / R2_BUCKET / R2_ACCESS_KEY_ID /
 * R2_SECRET_ACCESS_KEY for the side it is writing.
 */

import * as store from '../src/r2.js';

/*
 * THE READ SIDE HAS TO BYPASS THE VERY SHIM THIS SCRIPT EXISTS TO FILL.
 *
 * `github.js` sends `which === 'photos'` to the object store whenever one is
 * configured — which, while this is running, it is. So the repository is read
 * with the store's variables taken OUT of the environment and put back for the
 * write. Both modules read `process.env` at the moment of the call, so the
 * toggle is exact; what it is not is thread-safe, which is why each phase
 * below keeps the environment CONSTANT across everything it runs in parallel.
 */
const KEYS = ['R2_ENDPOINT', 'R2_BUCKET', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'];
const held = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
const storeOff = () => { for (const k of KEYS) delete process.env[k]; };
const storeOn = () => { for (const k of KEYS) if (held[k]) process.env[k] = held[k]; };

storeOff();
const github = await import('../src/github.js');
storeOn();

const GO = process.argv.includes('--go');
const BATCH = 8;

const missing = store.missingConfig();
if (missing.length) {
  console.error(`\nThe object store is not set up — missing: ${missing.join(', ')}\n`);
  process.exit(1);
}
if (!held.R2_BUCKET || !process.env.PHOTO_REPO || !(process.env.PHOTO_TOKEN || process.env.GITHUB_TOKEN)) {
  console.error('\nPHOTO_REPO and PHOTO_TOKEN (or GITHUB_TOKEN) must be set — this reads the repository.\n');
  process.exit(1);
}

console.log('\nMOVING THE PHOTOGRAPHS INTO THE OBJECT STORE\n');

/*
 * THE STORE IS PROVED BEFORE A SINGLE PHOTOGRAPH IS READ. `checkAccess()`
 * WRITES and removes rather than reading, because a key that can list but not
 * put looks exactly like a working one from a read — and this is the only
 * moment a signing fault can be told apart from a bad key cheaply.
 */
const reach = await store.checkAccess();
if (!reach.ok) {
  console.error(`  the object store would not take a write: ${reach.error}`);
  console.error('  nothing has been read and nothing has moved.\n');
  process.exit(1);
}
console.log(`  the object store answers, and takes a write  (bucket: ${reach.repo})`);

/** Everything under a folder, nights and all. Repository side. */
async function walk(folder) {
  storeOff();
  try {
    const files = (await github.listDir(folder, 'photos')).map((f) => f.path);
    const folders = await github.listDirs(folder, 'photos');
    for (const sub of folders) files.push(...await walk(sub.path));
    return files;
  } finally {
    storeOn();
  }
}

const all = await walk('photos');
console.log(`  ${all.length} file${all.length === 1 ? '' : 's'} in the repository\n`);
if (!all.length) { console.log('Nothing to move.\n'); process.exit(0); }

if (!GO) {
  for (const f of all.slice(0, 12)) console.log(`    ${f}`);
  if (all.length > 12) console.log(`    …and ${all.length - 12} more`);
  console.log('\nNothing has moved. Run it again with --go to copy these across.\n');
  process.exit(0);
}

let moved = 0;
let failed = 0;
for (let i = 0; i < all.length; i += BATCH) {
  const batch = all.slice(i, i + BATCH);

  // Phase one: READ, with the store switched out of the environment.
  storeOff();
  const read = await Promise.all(batch.map(async (at) => ({ at, read: await github.tryGetFile(at, 'photos') })));
  storeOn();

  // Phase two: WRITE, with it switched back in. Verified by reading back —
  // this is somebody's only copy of a photograph of their own customers.
  await Promise.all(read.map(async ({ at, read: got }) => {
    if (!got.ok) { failed += 1; console.log(`  COULD NOT READ  ${at} — ${got.error}`); return; }
    if (!got.body) { failed += 1; console.log(`  NOTHING THERE   ${at}`); return; }
    const put = await store.put(at, got.body);
    if (!put.ok) { failed += 1; console.log(`  COULD NOT WRITE ${at} — ${put.error}`); return; }
    const back = await store.tryGet(at);
    if (!back.ok || !back.body || back.body.length !== got.body.length) {
      failed += 1;
      console.log(`  DID NOT LAND    ${at} — ${got.body.length} bytes in, ${back.body ? back.body.length : 'nothing'} back`);
      return;
    }
    moved += 1;
  }));
  console.log(`  ${Math.min(i + BATCH, all.length)} / ${all.length}`);
}

console.log(`\n${moved} moved, ${failed} failed.\n`);
if (failed) {
  console.log('Some did not move. The repository is UNCHANGED — fix the reason and run it again;\n'
    + 'copying one twice is harmless, the key is the same and the second write replaces the first.\n');
  process.exit(1);
}
console.log('Every file is in the object store and the repository is untouched.\n'
  + 'Check the gallery, then DELETE THE PRIVATE REPOSITORY — deleting it is the only\n'
  + 'thing that removes its history, which is the whole reason for the move.\n');
