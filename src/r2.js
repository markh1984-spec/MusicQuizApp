/**
 * OBJECT STORAGE FOR THE PHOTOGRAPHS — S3's API, spoken by hand.
 *
 * ---
 *
 * **WHY THIS EXISTS: A DELETED PHOTO LEAVES THE REPO BUT NOT GIT HISTORY.**
 * That sentence is a rule in `CLAUDE.md` and it is the whole problem. The
 * private repository has been an honest store for a year, but it is a VERSION
 * CONTROL SYSTEM, and version control's promise is that nothing you put in it
 * ever really goes away. For pictures of the public in a pub that promise is
 * the wrong way round:
 *
 *   - the bin takes a photograph off every screen and leaves the bytes in the
 *     history for ever, so "I deleted it" is true about the page and false
 *     about the storage;
 *   - the same joke uploaded eleven times in one night is eleven copies that
 *     can never be reclaimed, so the repository only ever grows;
 *   - and a repo big enough to hold years of nights is one GitHub starts
 *     warning about, on a store whose whole job is to be dull.
 *
 * An object store has no history. A delete is a delete. That is the feature
 * being bought — not speed, and not the rate limit, though it fixes that too:
 * the Contents API allows 5,000 calls an hour on a token shared with the
 * packs, the accounts book and every backup, and a gallery is READ BY A ROOM
 * FULL OF PEOPLE AT ONCE.
 *
 * **IT IS S3's API, NOT CLOUDFLARE'S.** Everything here is the ordinary S3
 * REST interface with SigV4 signing, so it works against Cloudflare R2,
 * Backblaze B2, MinIO or Amazon itself by changing one endpoint. Nothing in
 * this file names a supplier, and that is deliberate: this app has been moved
 * off a supplier before and will be again.
 *
 * **NO DEPENDENCIES, AND SIGV4 IS THE REASON THAT IS FINE.** The whole of
 * AWS's signing scheme is SHA-256 and HMAC-SHA256 over strings in a fixed
 * order — `node:crypto` does both, and this app already computes an HMAC by
 * hand to verify the Stripe webhook. An SDK here would be twenty megabytes to
 * avoid sixty lines.
 *
 * **INERT WITHOUT CONFIGURATION, LIKE EVERY OTHER INTEGRATION HERE.** With no
 * `R2_*` variables set, `configured()` is false, nothing in this file runs,
 * and the photographs go to GitHub exactly as they always have. The switch is
 * environment only: there is no setting, no toggle and no migration step that
 * has to run in the right order.
 *
 * **AND THE SWAP HAPPENS AT ONE CHOKE POINT.** `github.js` delegates its
 * `which === 'photos'` calls here when this is configured, so not one of the
 * twenty call sites changed and the return shapes are identical — including
 * the `{ok:false}`-is-not-empty distinction that `tryGetFile()` and
 * `tryListDir()` exist for. A second store that answered "empty" for "could
 * not look" would put a blank gallery in front of a room and cache it.
 */

import { createHash, createHmac } from 'node:crypto';

/** The same pair of ceilings GitHub gets, and for the same reason. */
export const R2_TIMEOUT_MS = Number(process.env.R2_TIMEOUT_MS) || 20_000;
export const R2_READ_TIMEOUT_MS = Number(process.env.R2_READ_TIMEOUT_MS) || 8_000;

/**
 * Is the object store set up?
 *
 * All four are required and there is deliberately no partial mode. A store
 * that could read but not write, or that fell back to GitHub per call, would
 * file half a night in each place — and which half would depend on when a
 * variable was typed.
 */
export function configured() {
  return Boolean(
    process.env.R2_ENDPOINT
    && process.env.R2_BUCKET
    && process.env.R2_ACCESS_KEY_ID
    && process.env.R2_SECRET_ACCESS_KEY,
  );
}

/**
 * Which variables are missing, by name.
 *
 * The same courtesy `missingPhotoConfig()` pays: "it says not set up" is not a
 * diagnosis, and on a host with a project level and a service level that look
 * alike, "I definitely set it" and "the app can see it" are different things.
 */
export function missingConfig() {
  const missing = [];
  for (const v of ['R2_ENDPOINT', 'R2_BUCKET', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']) {
    if (!process.env[v]) missing.push(v);
  }
  return missing;
}

/** The bucket's name, for the console to print. Never the keys. */
export function bucketName() {
  return process.env.R2_BUCKET || '';
}

function settings() {
  const endpoint = String(process.env.R2_ENDPOINT || '').replace(/\/+$/, '');
  return {
    endpoint,
    host: new URL(endpoint).host,
    bucket: process.env.R2_BUCKET,
    key: process.env.R2_ACCESS_KEY_ID,
    secret: process.env.R2_SECRET_ACCESS_KEY,
    // R2 ignores the region but SigV4 signs it, so both ends must agree on a
    // word. `auto` is Cloudflare's; anything else needs it stated.
    region: process.env.R2_REGION || 'auto',
  };
}

/*
 * ---- SIGNING -----------------------------------------------------------
 *
 * **RFC 3986, NOT `encodeURIComponent`.** They differ on exactly four
 * characters — ! ' ( ) * — and S3 computes its signature over ITS encoding of
 * the path. A photograph whose name held one of them would be signed one way
 * and requested another, and the answer is a 403 that reads like a bad key.
 * `safePhotoName()` would not let one through today; the signature must not
 * depend on that staying true.
 */
export const rfc3986 = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
/**
 * Exported so a test can pin it. The signature is computed over THIS spelling
 * of the path, so a difference of one character between what is signed and
 * what is requested is a 403 that reads exactly like a bad key — the hardest
 * failure in this file to diagnose from the outside, and the easiest to pin
 * from the inside.
 */
export const encodePath = (p) => String(p).split('/').map(rfc3986).join('/');
const sha256 = (x) => createHash('sha256').update(x).digest('hex');
const hmac = (k, x) => createHmac('sha256', k).update(x).digest();

/**
 * One signed request.
 *
 * The scheme in four lines: hash the canonical request, sign the string that
 * names it, derive a key that is only good for one day and one region, and put
 * the result in an `Authorization` header. Every part of it is a string
 * comparison at the far end, which is why the encoding above matters so much.
 */
function sign({ method, path, query, headers, payloadHash, at }) {
  const { key, secret, region } = settings();
  const stamp = at.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const day = stamp.slice(0, 8);
  const scope = `${day}/${region}/s3/aws4_request`;

  const all = { ...headers, 'x-amz-content-sha256': payloadHash, 'x-amz-date': stamp };
  const names = Object.keys(all).map((n) => n.toLowerCase()).sort();
  const canonicalHeaders = names.map((n) => {
    const found = Object.keys(all).find((k) => k.toLowerCase() === n);
    return `${n}:${String(all[found]).trim()}\n`;
  }).join('');
  const signed = names.join(';');

  // The query string is signed SORTED BY KEY, whatever order it was built in.
  const canonicalQuery = Object.keys(query).sort()
    .map((k) => `${rfc3986(k)}=${rfc3986(query[k])}`).join('&');

  const canonical = [method, encodePath(path), canonicalQuery, canonicalHeaders, signed, payloadHash].join('\n');
  const toSign = ['AWS4-HMAC-SHA256', stamp, scope, sha256(canonical)].join('\n');
  const signingKey = ['aws4_request', 's3', region, day]
    .reduceRight((k, part) => hmac(k, part), `AWS4${secret}`);

  return {
    ...all,
    Authorization: `AWS4-HMAC-SHA256 Credential=${key}/${scope}, SignedHeaders=${signed}, Signature=${hmac(signingKey, toSign).toString('hex')}`,
  };
}

/** The one place a request actually leaves. Every call carries a timeout. */
async function call(method, objectPath, { query = {}, body = null, type = '' } = {}) {
  const { endpoint, host, bucket } = settings();
  // The bucket is part of the path, not the host: R2's endpoint is per
  // ACCOUNT, and path style is what every S3-compatible store accepts.
  const path = `/${bucket}${objectPath ? `/${objectPath}` : ''}`;
  const payload = body === null ? Buffer.alloc(0) : (Buffer.isBuffer(body) ? body : Buffer.from(body));
  const headers = sign({
    method,
    path,
    query,
    headers: { host, ...(type ? { 'content-type': type } : {}) },
    payloadHash: sha256(payload),
    at: new Date(),
  });
  const qs = Object.keys(query).sort().map((k) => `${rfc3986(k)}=${rfc3986(query[k])}`).join('&');
  return fetch(`${endpoint}${encodePath(path)}${qs ? `?${qs}` : ''}`, {
    method,
    headers,
    ...(method === 'GET' || method === 'HEAD' || method === 'DELETE' ? {} : { body: payload }),
    signal: AbortSignal.timeout(method === 'GET' ? R2_READ_TIMEOUT_MS : R2_TIMEOUT_MS),
  });
}

/*
 * ---- THE STORE ---------------------------------------------------------
 *
 * Every function below answers in `github.js`'s own shapes, deliberately, so
 * the swap is invisible to twenty call sites. Read `tryGetFile()` there before
 * changing any of them: the difference between *"there is nothing there"* and
 * *"I could not find out"* is load-bearing, and collapsing it has already cost
 * this app an empty gallery that cached itself.
 */

/** Put one object. `{ok, error}`, exactly like `putFile()`. */
export async function put(key, contents, type = '') {
  try {
    const bytes = Buffer.isBuffer(contents) ? contents : Buffer.from(contents, 'utf8');
    const res = await call('PUT', key, { body: bytes, type: type || guessType(key) });
    if (!res.ok) return { ok: false, error: `Object store ${res.status}: ${(await res.text()).slice(0, 160)}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Put several. There is no batch in S3 and none is wanted: `putFiles()` on
 * GitHub exists to make ONE COMMIT out of many files, and a store with no
 * commits has nothing to coalesce. They go up in parallel, which is what that
 * function was really buying.
 */
export async function putMany(files, type = '') {
  const list = (files || []).filter((f) => f && f.path);
  if (!list.length) return { ok: true, count: 0 };
  try {
    const done = await Promise.all(list.map((f) => put(f.path, f.contents, type)));
    const bad = done.find((d) => !d.ok);
    return bad ? { ok: false, error: bad.error } : { ok: true, count: list.length };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/** Read one. `{ok:true, body}` with `body: null` for a genuine 404. */
export async function tryGet(key) {
  try {
    const res = await call('GET', key);
    if (res.status === 404) return { ok: true, body: null };
    if (!res.ok) return { ok: false, error: `Object store ${res.status}` };
    return { ok: true, body: Buffer.from(await res.arrayBuffer()) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function get(key) {
  const read = await tryGet(key);
  return read.ok ? read.body : null;
}

/**
 * Remove one — and this time it is gone.
 *
 * S3 answers 204 whether or not the object was there, which matches
 * `deleteFile()`'s own "was not in the repository anyway" being an `ok`.
 */
export async function remove(key) {
  try {
    const res = await call('DELETE', key);
    if (!res.ok && res.status !== 404) return { ok: false, error: `Object store ${res.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/*
 * ---- LISTING, AND WHY A FOLDER IS A FICTION ----------------------------
 *
 * **AN OBJECT STORE HAS NO DIRECTORIES.** There are only keys, and `/` is an
 * ordinary character in one. What makes `photos/<room>/<night>/<file>` behave
 * like folders is `delimiter=/`: everything sharing a prefix up to the next
 * slash is rolled up into a `CommonPrefixes` entry instead of being listed.
 * That is exactly the file/folder split `listDir()` and `listDirs()` already
 * make, so both map straight onto one request.
 *
 * **A PAGE IS 1,000 KEYS AND THE LOOP IS NOT OPTIONAL.** A room with more than
 * a thousand photographs is a year of Thursdays, and a listing that silently
 * stopped at the first page would drop the oldest nights off Past gigs with
 * nothing to see and nothing thrown.
 */
async function listPage(prefix, token) {
  const query = { 'list-type': '2', prefix, delimiter: '/', 'max-keys': '1000' };
  if (token) query['continuation-token'] = token;
  const res = await call('GET', '', { query });
  if (!res.ok) throw new Error(`Object store ${res.status}`);
  return res.text();
}

/*
 * The response is XML and this reads it with two regular expressions, which is
 * worth defending. S3's ListObjectsV2 body is a fixed, flat, machine-written
 * schema of about six element names — there is no nesting to get lost in, no
 * attributes, and no author who might reformat it. An XML parser would be the
 * first dependency this app has ever taken, to read six tags.
 */
const between = (xml, tag) => [...xml.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'g'))].map((m) => m[1]);
const unescape = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

async function listAll(prefix) {
  const keys = [];
  const folders = [];
  let token = '';
  for (let page = 0; page < 100; page += 1) {
    const xml = await listPage(prefix, token);
    // `<Prefix>` appears at the top level as well, so the rolled-up folders
    // are read out of their own blocks rather than swept for the tag.
    for (const block of between(xml, 'CommonPrefixes')) {
      for (const p of between(block, 'Prefix')) folders.push(unescape(p));
    }
    for (const block of between(xml, 'Contents')) {
      for (const k of between(block, 'Key')) keys.push(unescape(k));
    }
    const more = between(xml, 'IsTruncated')[0] === 'true';
    token = between(xml, 'NextContinuationToken')[0] || '';
    if (!more || !token) break;
  }
  return { keys, folders };
}

/** The FILES directly in a folder — `{ok, files:[{name, path}]}`. */
export async function tryListDir(dirPath) {
  const prefix = dirPath ? `${String(dirPath).replace(/\/+$/, '')}/` : '';
  try {
    const { keys } = await listAll(prefix);
    return {
      ok: true,
      files: keys
        // A key ending in `/` is a folder marker some tools write. It is not a
        // photograph and must never be listed as one.
        .filter((k) => !k.endsWith('/'))
        .map((k) => ({ name: k.slice(prefix.length), path: k })),
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function listDir(dirPath) {
  const read = await tryListDir(dirPath);
  return read.ok ? read.files : [];
}

/** The FOLDERS in a folder — the list of nights somebody has run. */
export async function listDirs(dirPath) {
  const prefix = dirPath ? `${String(dirPath).replace(/\/+$/, '')}/` : '';
  try {
    const { folders } = await listAll(prefix);
    return folders.map((f) => {
      const path = f.replace(/\/+$/, '');
      return { name: path.slice(prefix.length), path };
    }).filter((f) => f.name);
  } catch {
    return [];
  }
}

/**
 * Can this store actually be reached and written to — for the console to show.
 *
 * It WRITES and then removes, rather than asking for the bucket's metadata: a
 * key that can list but not put is the failure that matters here, and it looks
 * exactly like a working one from a read.
 */
export async function checkAccess() {
  if (!configured()) return { ok: false, error: 'not set up' };
  const probe = 'health/.write-check';
  try {
    const wrote = await put(probe, Buffer.from('ok'), 'text/plain');
    if (!wrote.ok) return { ok: false, error: wrote.error };
    await remove(probe);
    return { ok: true, repo: bucketName(), private: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * The content type of an object, from its name.
 *
 * Stored rather than guessed on the way out, because this store is read
 * DIRECTLY by a browser one day and a photograph served as
 * `application/octet-stream` downloads instead of showing. The app's own route
 * sets its own header today, so this is groundwork rather than a promise.
 */
function guessType(key) {
  const ext = String(key).toLowerCase().match(/\.([a-z0-9]+)$/);
  return {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
    gif: 'image/gif', heic: 'image/heic', json: 'application/json', txt: 'text/plain',
  }[ext && ext[1]] || 'application/octet-stream';
}
