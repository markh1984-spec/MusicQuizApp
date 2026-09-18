#!/usr/bin/env node
/**
 * WHY DOES THE GALLERY SAY NOTHING IS THERE — read-only, and safe to run live.
 *
 * Written on 18 September 2026, after the photographs were moved into an object
 * store and `PHOTO_REPO`/`PHOTO_TOKEN` were removed for a few minutes. The app
 * then believed there were no accounts, wrote fresh private state into the
 * bucket, and `/api/gallery` came back `{"nights":[],"preview":true}` with
 * nothing in the log.
 *
 * **IT WRITES NOTHING AND IT ANSWERS THE ONE QUESTION THE LOG CANNOT.** Every
 * step of that path degrades quietly by design — a store listing that fails
 * returns `[]`, a repo read that 403s returns `{ok:false}` and a fallback only
 * happens on a MISS — so "no nights" is what you get whether the photographs
 * are gone, the room id moved, or one credential cannot see one repository.
 * This prints all three side by side.
 *
 * Run it where the variables are (the Render shell, in the repo root):
 *
 *     node scripts/why-no-nights.mjs
 *
 * **NOTHING SECRET IS PRINTED** — no token, no key, no password hash, no email
 * address. Sizes, ids, roles, names and counts only, so the output can be
 * pasted into a chat.
 */

const store = await import(`${process.cwd()}/src/r2.js`);

const line = (...a) => console.log(...a);
const ok = (b) => (b ? 'yes' : 'NO');

line('\n---- WHAT IS CONFIGURED\n');
line('object store:', ok(store.configured()), store.configured() ? `bucket ${store.bucketName()}` : `missing ${store.missingConfig().join(', ')}`);
const REPO = process.env.PHOTO_REPO || '';
const TOKEN = process.env.PHOTO_TOKEN || process.env.GITHUB_TOKEN || '';
line('PHOTO_REPO: ', REPO || '(unset)');
line('PHOTO_TOKEN:', ok(Boolean(process.env.PHOTO_TOKEN)), '   GITHUB_TOKEN:', ok(Boolean(process.env.GITHUB_TOKEN)));
line('so the old repository is still a fallback:', ok(Boolean(REPO && TOKEN)));

/* ---------------------------------------- the repository, read directly
 *
 * DIRECTLY, never through `github.js`: that is the thing under suspicion —
 * `inStore()` routes BOTH 'photos' and 'private' to the bucket and reads it
 * first, so asking it would ask the bucket again and call it the repo.
 */
const [owner, name] = REPO.split('/');
const branch = process.env.PHOTO_BRANCH || 'main';
async function repoGet(path) {
  if (!owner || !name || !TOKEN) return { ok: false, error: 'not configured' };
  const url = `https://api.github.com/repos/${owner}/${name}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(branch)}`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'quizporium-diag' },
      signal: AbortSignal.timeout(15000),
    });
    if (res.status === 404) return { ok: true, body: null };
    if (!res.ok) return { ok: false, error: `${res.status} ${res.statusText}` };
    return { ok: true, body: await res.json() };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
const repoFile = async (path) => {
  const got = await repoGet(path);
  if (!got.ok) return got;
  if (!got.body) return { ok: true, text: null };
  const raw = Buffer.from(String(got.body.content || ''), 'base64').toString('utf8');
  return { ok: true, text: raw, size: got.body.size };
};
const repoDir = async (path) => {
  const got = await repoGet(path);
  if (!got.ok) return got;
  if (!Array.isArray(got.body)) return { ok: true, entries: [] };
  return { ok: true, entries: got.body.map((e) => ({ name: e.name, dir: e.type === 'dir' })) };
};

/* ---------------------------------------- the two books, side by side */

const peek = (text, where) => {
  if (text === null) return line(`  ${where}: MISSING`);
  let book = null;
  try { book = JSON.parse(text); } catch { return line(`  ${where}: ${text.length} bytes and NOT VALID JSON`); }
  const list = Array.isArray(book) ? book : (book.accounts || []);
  line(`  ${where}: ${text.length} bytes, ${list.length} account${list.length === 1 ? '' : 's'}`);
  for (const a of list) {
    line(`     id=${a.id} role=${a.role || '-'} status=${a.status || '-'} ownedBy=${a.ownedBy || '-'} name=${JSON.stringify(a.name || '')}`);
  }
  const ownerAcc = list.find((a) => a.role === 'owner');
  const mine = ownerAcc ? list.find((a) => a.ownedBy === ownerAcc.id && a.role !== 'owner') : null;
  line(`     -> the gallery's room for the signed-in owner would be: ${mine ? mine.id : 'HOUSE (no owner-quizmaster in this book)'}`);
  return mine ? mine.id : 'house';
};

line('\n---- accounts.json\n');
let roomFromStore = '';
let roomFromRepo = '';
if (store.configured()) {
  const got = await store.tryGet('accounts.json');
  if (!got.ok) line('  in the bucket: COULD NOT LOOK —', got.error);
  else roomFromStore = peek(got.body ? got.body.toString('utf8') : null, 'in the bucket');
}
const fromRepo = await repoFile('accounts.json');
if (!fromRepo.ok) line('  in the repository: COULD NOT LOOK —', fromRepo.error);
else roomFromRepo = peek(fromRepo.text, 'in the repository');

line('\n---- room-codes.json (printed codes live here)\n');
if (store.configured()) {
  const got = await store.tryGet('room-codes.json');
  if (!got.ok) line('  in the bucket: COULD NOT LOOK —', got.error);
  else if (!got.body) line('  in the bucket: MISSING');
  else {
    const text = got.body.toString('utf8');
    let n = '?';
    try { const b = JSON.parse(text); n = Object.keys(b.codes || b).length; } catch { /* said below */ }
    line(`  in the bucket: ${text.length} bytes, ${n} code${n === 1 ? '' : 's'} in it`);
  }
}
const codesRepo = await repoFile('room-codes.json');
if (!codesRepo.ok) line('  in the repository: COULD NOT LOOK —', codesRepo.error);
else if (codesRepo.text === null) line('  in the repository: MISSING');
else {
  let n = '?';
  try { const b = JSON.parse(codesRepo.text); n = Object.keys(b.codes || b).length; } catch { /* as above */ }
  line(`  in the repository: ${codesRepo.text.length} bytes, ${n} code${n === 1 ? '' : 's'} in it`);
}

/* ---------------------------------------- and where the photographs are */

line('\n---- THE PHOTOGRAPHS\n');
const rooms = [...new Set([roomFromStore, roomFromRepo].filter((r) => r && r !== 'house'))];
if (store.configured()) {
  const top = await store.listDirs('photos');
  line(`  bucket: photos/ holds ${top.length} room folder${top.length === 1 ? '' : 's'}:`, top.map((f) => f.name).join(', ') || '(none)');
  const loose = await store.tryListDir('photos');
  line(`  bucket: and ${loose.ok ? loose.files.length : '?'} file(s) directly in photos/ (the house room's own)`);
  for (const room of rooms) {
    const nights = await store.listDirs(`photos/${room}`);
    line(`  bucket: photos/${room} holds ${nights.length} night folder(s):`, nights.map((f) => f.name).join(', ') || '(none)');
    const pub = await store.tryGet(`photos/${room}/published.json`);
    line(`  bucket: photos/${room}/published.json:`, pub.ok ? (pub.body ? `${pub.body.length} bytes` : 'MISSING') : `COULD NOT LOOK — ${pub.error}`);
  }
}
const topRepo = await repoDir('photos');
if (!topRepo.ok) line('  repository: COULD NOT LOOK at photos/ —', topRepo.error);
else line(`  repository: photos/ holds ${topRepo.entries.filter((e) => e.dir).length} folder(s):`, topRepo.entries.filter((e) => e.dir).map((e) => e.name).join(', ') || '(none)');
for (const room of rooms) {
  const got = await repoDir(`photos/${room}`);
  if (!got.ok) line(`  repository: COULD NOT LOOK at photos/${room} —`, got.error);
  else line(`  repository: photos/${room} holds ${got.entries.filter((e) => e.dir).length} night folder(s):`, got.entries.filter((e) => e.dir).map((e) => e.name).join(', ') || '(none)');
}

line('\n---- WHAT THAT MEANS\n');
if (!roomFromStore && !roomFromRepo) {
  line('  NEITHER BOOK COULD BE READ, so nothing above is a diagnosis — run this');
  line('  where the variables are, in the repository root.');
} else if (roomFromStore && roomFromRepo && roomFromStore !== roomFromRepo) {
  line('  THE TWO BOOKS DISAGREE ABOUT THE ROOM. The bucket is read first, so the');
  line('  gallery is looking in', roomFromStore, 'while the photographs are filed under', roomFromRepo);
} else if (roomFromStore === 'house' || roomFromRepo === 'house') {
  line('  ONE BOOK HAS NO OWNER-QUIZMASTER ACCOUNT IN IT, so the gallery falls back');
  line('  to the house room — whose folder holds other rooms, not nights.');
} else {
  line('  The books agree about the room. If the night folders above are listed in');
  line('  the bucket, the fault is downstream of the listing; if they are only in');
  line('  the repository, the bucket half is what is answering and it is empty.');
}
line('');
