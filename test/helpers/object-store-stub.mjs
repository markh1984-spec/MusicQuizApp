/**
 * A STAND-IN FOR THE OBJECT STORE — a directory behind a stubbed `fetch`,
 * answering the same S3 REST calls `src/r2.js` makes.
 *
 * The twin of `photo-repo-stub.mjs`, and it exists for the same reason: the
 * whole publish path — the flag, the rulings, the pins, the bin — now runs
 * through a store the suite has no keys for and must never need any. Without
 * this, every route around it would once again only be read as text, and *a
 * test that never runs the artefact proves nothing about it*.
 *
 * Loaded with `node --import`, so the app makes its real signed requests and
 * only the network behind them is a fixture. Objects go under
 * `OBJECT_STUB_DIR`, keyed exactly as they are in the store, so a test can
 * look at the shelf directly.
 *
 * Deliberately dumb: no signature checking, no pagination, no errors. What it
 * is for is proving that a write lands where the next read looks, and — the
 * point of the whole move — that a DELETE actually removes it.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.env.OBJECT_STUB_DIR;
const BUCKET = process.env.R2_BUCKET || 'photos';
const real = globalThis.fetch;

const allKeys = (dir = ROOT, prefix = '') => (fs.existsSync(dir) ? fs.readdirSync(dir) : []).flatMap((n) => {
  const abs = path.join(dir, n);
  return fs.statSync(abs).isDirectory() ? allKeys(abs, `${prefix}${n}/`) : [`${prefix}${n}`];
});

const xmlSafe = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url;
  if (!/r2\.cloudflarestorage\.com|127\.0\.0\.1:9\d{3}\/objects/.test(url)) return real(input, init);
  const parsed = new URL(url);
  const segments = parsed.pathname.split('/').slice(1).map(decodeURIComponent);
  if (segments[0] !== BUCKET) return new Response('', { status: 404 });
  const key = segments.slice(1).join('/');
  const method = (init.method || 'GET').toUpperCase();
  const abs = key ? path.join(ROOT, key) : ROOT;

  if (method === 'PUT') {
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, Buffer.isBuffer(init.body) ? init.body : Buffer.from(init.body || ''));
    return new Response('', { status: 200 });
  }
  if (method === 'DELETE') {
    // THE WHOLE REASON FOR THE MOVE: gone is gone, with no history behind it.
    fs.rmSync(abs, { force: true });
    return new Response(null, { status: 204 });
  }
  if (parsed.searchParams.get('list-type') === '2') {
    const prefix = parsed.searchParams.get('prefix') || '';
    const files = [];
    const folders = new Set();
    for (const k of allKeys()) {
      if (!k.startsWith(prefix)) continue;
      const rest = k.slice(prefix.length);
      if (rest.includes('/')) folders.add(`${prefix}${rest.split('/')[0]}/`);
      else files.push(k);
    }
    return new Response(`<?xml version="1.0"?><ListBucketResult><Name>${BUCKET}</Name>`
      + `<Prefix>${xmlSafe(prefix)}</Prefix><IsTruncated>false</IsTruncated>`
      + [...folders].map((f) => `<CommonPrefixes><Prefix>${xmlSafe(f)}</Prefix></CommonPrefixes>`).join('')
      + files.map((f) => `<Contents><Key>${xmlSafe(f)}</Key><Size>1</Size></Contents>`).join('')
      + '</ListBucketResult>', { status: 200 });
  }
  if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) return new Response('', { status: 404 });
  return new Response(fs.readFileSync(abs), { status: 200 });
};
