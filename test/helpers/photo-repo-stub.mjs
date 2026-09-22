/**
 * A STAND-IN FOR THE PRIVATE PHOTO REPOSITORY — a directory behind a stubbed
 * `fetch`, answering the same GitHub Contents API the app calls.
 *
 * **THIS EXISTS BECAUSE THE PUBLISH PATH COULD NOT BE TESTED, AND IT HAS NOW
 * PRODUCED TWO LIVE BUGS.** Everything about a night going public — the flag,
 * the per-photo rulings, the card pins, which ROOM any of it lands in — lives
 * in a private repo that the suite has no token for and must never need one.
 * So the routes around it were only ever read as text, and this repo already
 * knows what that is worth: a test that never runs the artefact proves nothing
 * about it.
 *
 * Loaded with `node --import`, so the server under test makes its real calls
 * and only the network behind them is a fixture. Files go under `GH_STUB_DIR`.
 *
 * It is deliberately dumb: no shas, no conflicts, no rate limits. What it is
 * for is proving that a write lands where the next read looks — which is
 * exactly what went wrong.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.env.GH_STUB_DIR;
const real = globalThis.fetch;
const full = (p) => path.join(ROOT, p);
/*
 * A SLOW GITHUB, WHEN A CHECK ASKS FOR ONE — `GH_STUB_DELAY_MS`.
 *
 * A local write finishes in well under a millisecond, so a guard about the
 * BACKUP BUDGET cannot be written against this stub as it stands: the race is
 * always won by the write and the timeout branch never runs. That is not a
 * detail — `a-night-survives-a-deploy.mjs` asserted that a late backup does not
 * cry wolf, and passed with the fault deliberately put back, because nothing
 * was ever late. A guard that cannot see the fault is worse than no guard.
 */
const DELAY = Number(process.env.GH_STUB_DELAY_MS) || 0;
const hold = () => (DELAY ? new Promise((r) => setTimeout(r, DELAY)) : null);
/*
 * A GITHUB THAT REFUSES, WHILE A CHECK SAYS SO — `GH_STUB_REFUSE` names a flag
 * file OUTSIDE the stub's directory, so nothing listing the repository ever
 * sees it. While the file exists every write answers 503, which is how a check
 * makes the first attempt at filing a photograph fail and then watches what
 * retries it. And `GH_STUB_LOG`, also outside, gets one line per request, so a
 * check can COUNT writes rather than infer them.
 */
const REFUSE = process.env.GH_STUB_REFUSE || '';
const LOG = process.env.GH_STUB_LOG || '';
const note = (line) => { if (LOG) fs.appendFileSync(LOG, `${line}\n`); };

globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url;
  if (!url.startsWith('https://api.github.com/')) return real(input, init);
  if (DELAY) await hold();
  const m = url.match(/\/repos\/[^/]+\/[^/]+\/contents\/([^?]*)/);
  if (!m) return new Response('{}', { status: 404 });
  const p = decodeURI(m[1]);
  const method = (init.method || 'GET').toUpperCase();
  const abs = full(p);
  note(`${method} ${p}`);

  if (method === 'PUT' && REFUSE && fs.existsSync(REFUSE)) {
    return new Response('{"message":"stub refusing writes"}', { status: 503 });
  }
  if (method === 'PUT') {
    const body = JSON.parse(init.body);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, Buffer.from(body.content, 'base64'));
    return new Response(JSON.stringify({ content: { sha: 'x' } }), { status: 200 });
  }
  if (method === 'DELETE') {
    fs.rmSync(abs, { force: true });
    return new Response('{}', { status: 200 });
  }
  if (!fs.existsSync(abs)) return new Response('{"message":"Not Found"}', { status: 404 });
  const st = fs.statSync(abs);
  if (st.isDirectory()) {
    const items = fs.readdirSync(abs).map((n) => ({
      name: n, path: `${p}/${n}`, sha: 'x', size: 1,
      type: fs.statSync(path.join(abs, n)).isDirectory() ? 'dir' : 'file',
    }));
    return new Response(JSON.stringify(items), { status: 200 });
  }
  return new Response(JSON.stringify({
    name: path.basename(p), path: p, sha: 'x', size: st.size,
    type: 'file', encoding: 'base64', content: fs.readFileSync(abs).toString('base64'),
  }), { status: 200 });
};
