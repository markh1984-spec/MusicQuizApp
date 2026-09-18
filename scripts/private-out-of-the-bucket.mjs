#!/usr/bin/env node
/**
 * PUT THE ACCOUNTS BOOK AND THE JOIN CODES BACK WHERE THEY BELONG.
 *
 * ---
 *
 * `github.js` routed `which === 'private'` into the object store for one
 * evening — see `inStore()` for the whole account of it. While it did, the
 * accounts book, the join codes, and any invoice or archive backup taken in
 * that window were WRITTEN to the bucket and nowhere else, and then READ from
 * the bucket first, which shadowed the good copies in the repository.
 *
 * The fix stops both. What the fix cannot do is move the files: whatever was
 * written up there while it was live is the NEWEST copy of it, and the moment
 * the app stops reading the bucket those writes are invisible. **The join-code
 * book is the sharp one — it exists ONLY in the bucket, and a lost code book is
 * printed QR codes that stop working in front of a room.**
 *
 * So this walks the bucket's ROOT — never `photos/`, which is where the
 * photographs correctly live — and for every file up there it prints the
 * bucket's copy beside the repository's:
 *
 *     node scripts/private-out-of-the-bucket.mjs            # look
 *     node scripts/private-out-of-the-bucket.mjs --go       # copy into the repo
 *     node scripts/private-out-of-the-bucket.mjs --go --tidy  # and remove it
 *
 * **IT REFUSES TO OVERWRITE A RICHER FILE.** A book with three accounts in it
 * does not go over one with four, and neither does a code book with fewer codes:
 * the bucket's copy is newer BY TIME, which is not the same as better — the very
 * first thing that happened in this incident was the app writing a nearly empty
 * book. Naming the pair and standing down is the only safe default; `--force`
 * is there for a human who has read the numbers.
 *
 * **AND IT READS BACK BEFORE IT TIDIES.** A delete from the bucket after a
 * write that did not land is the one order of operations that loses the file for
 * good, which is this repo's own rule about the photo backup wearing a hat.
 *
 * Run it where the variables are — the Render shell, in the repository root.
 */

const store = await import(`${process.cwd()}/src/r2.js`);

const GO = process.argv.includes('--go');
const TIDY = process.argv.includes('--tidy');
const FORCE = process.argv.includes('--force');

const REPO = process.env.PHOTO_REPO || '';
const TOKEN = process.env.PHOTO_TOKEN || process.env.GITHUB_TOKEN || '';
const [owner, name] = REPO.split('/');
const branch = process.env.PHOTO_BRANCH || 'main';

if (!store.configured()) {
  console.log(`\nNo object store configured (${store.missingConfig().join(', ')}) — nothing to move.\n`);
  process.exit(0);
}
if (!owner || !name || !TOKEN) {
  console.log('\nPHOTO_REPO and a token are needed to put anything back. Set them first.\n');
  process.exit(1);
}

const api = async (path, init = {}) => {
  const res = await fetch(`https://api.github.com/repos/${owner}/${name}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'quizporium-rescue',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
    signal: AbortSignal.timeout(20000),
  });
  return res;
};

/** The repository's copy — `{ok, text, sha}`, with `text: null` for absent. */
async function fromRepo(file) {
  const res = await api(`contents/${encodeURIComponent(file)}?ref=${encodeURIComponent(branch)}`);
  if (res.status === 404) return { ok: true, text: null, sha: '' };
  if (!res.ok) return { ok: false, error: `${res.status} ${res.statusText}` };
  const data = await res.json();
  return { ok: true, text: Buffer.from(String(data.content || ''), 'base64').toString('utf8'), sha: data.sha || '' };
}

async function intoRepo(file, text, sha) {
  const res = await api(`contents/${encodeURIComponent(file)}`, {
    method: 'PUT',
    body: JSON.stringify({
      // [skip render] for the same reason every other backup carries it: a
      // rescue must not restart the app it is rescuing.
      message: `Put ${file} back in the repository [skip render]`,
      content: Buffer.from(text, 'utf8').toString('base64'),
      branch,
      ...(sha ? { sha } : {}),
    }),
  });
  if (!res.ok) return { ok: false, error: `${res.status} ${res.statusText}` };
  return { ok: true };
}

/*
 * HOW RICH A FILE IS, in its own terms. Bytes are not the measure — a book with
 * one long session token in it can outweigh a book with four accounts — so each
 * known file is counted by the thing that would be LOST.
 */
function richness(file, text) {
  if (text === null) return { n: -1, said: 'MISSING' };
  let book = null;
  try { book = JSON.parse(text); } catch { return { n: -1, said: `${text.length} bytes, NOT VALID JSON` }; }
  if (file === 'accounts.json') {
    const list = Array.isArray(book) ? book : (book.accounts || []);
    return { n: list.length, said: `${list.length} account(s): ${list.map((a) => `${a.id}${a.role ? `/${a.role}` : ''}`).join(' ') || '(none)'}` };
  }
  if (file === 'room-codes.json') {
    const codes = book.codes || book;
    const n = Object.keys(codes || {}).length;
    return { n, said: `${n} join code(s)` };
  }
  if (file.startsWith('archive')) {
    const nights = book.nights || book.archive || (Array.isArray(book) ? book : []);
    const n = Array.isArray(nights) ? nights.length : Object.keys(nights || {}).length;
    return { n, said: `${n} night(s)` };
  }
  const n = Object.keys(book || {}).length;
  return { n, said: `${text.length} bytes, ${n} top-level key(s)` };
}

/* ---------------------------------------------------------------- the sweep */

console.log(`\nTHE BUCKET'S ROOT — ${store.bucketName()} — against ${REPO}#${branch}\n`);
const loose = await store.tryListDir('');
if (!loose.ok) {
  console.log('Could not list the bucket:', loose.error, '\n');
  process.exit(1);
}
// `photos/` is where the photographs correctly live and is never touched. A
// root listing with `delimiter=/` does not descend into it anyway; this is the
// belt to that braces.
const strays = loose.files.map((f) => f.path).filter((k) => k && !k.includes('/'));
if (!strays.length) {
  console.log('Nothing in the root but the photographs. There is nothing to move.\n');
  process.exit(0);
}

let moved = 0;
let held = 0;
for (const file of strays) {
  const got = await store.tryGet(file);
  if (!got.ok) { console.log(`${file}\n  bucket: COULD NOT LOOK — ${got.error}\n`); held += 1; continue; }
  const here = got.body ? got.body.toString('utf8') : null;
  const there = await fromRepo(file);
  if (!there.ok) { console.log(`${file}\n  repository: COULD NOT LOOK — ${there.error}\n`); held += 1; continue; }
  const a = richness(file, here);
  const b = richness(file, there.text);
  console.log(file);
  console.log(`  bucket:     ${a.said}`);
  console.log(`  repository: ${b.said}`);

  if (here === null) { console.log('  nothing in the bucket to move.\n'); continue; }
  if (here === there.text) { console.log('  the two are identical.', TIDY && GO ? 'Removing the bucket\'s copy.' : 'Nothing to copy.'); }
  else if (a.n < b.n && !FORCE) {
    console.log(`  HELD BACK: the repository's copy has more in it (${b.n} against ${a.n}).`);
    console.log('  Read the two lines above. If the bucket\'s really is the one you want, --force.\n');
    held += 1;
    continue;
  }

  if (!GO) { console.log('  --go would copy the bucket\'s copy into the repository.\n'); continue; }

  if (here !== there.text) {
    const put = await intoRepo(file, here, there.sha);
    if (!put.ok) { console.log('  COULD NOT WRITE IT:', put.error, '\n'); held += 1; continue; }
    // READ BACK before anything is removed — a write that reported success and
    // did not land, followed by a delete, is the one sequence that loses it.
    const check = await fromRepo(file);
    if (!check.ok || check.text !== here) {
      console.log('  WROTE IT AND COULD NOT READ IT BACK — leaving the bucket\'s copy alone.\n');
      held += 1;
      continue;
    }
    console.log('  copied into the repository, and read back.');
    moved += 1;
  }
  if (TIDY) {
    const gone = await store.remove(file);
    console.log(gone.ok ? '  and removed from the bucket.' : `  could NOT remove it from the bucket: ${gone.error}`);
  }
  console.log('');
}

console.log(`${GO ? `${moved} file(s) put back` : 'Looked only'}${held ? `, ${held} held back` : ''}.`);
if (!GO) console.log('Nothing was changed. Add --go when the numbers above read right.');
console.log('');
