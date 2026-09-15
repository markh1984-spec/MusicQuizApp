/**
 * CAN A LANDLORD ACTUALLY SAVE A PHOTOGRAPH, AND IS THE QUIZMASTER'S NAME ON IT?
 *
 * ---
 *
 * Asked for as *"would be kinda cool to allow venues to download photos from
 * their own nights for use on socials?"* The convenience half was never the
 * point — a published gallery is a web page and a long-press has always
 * worked. **The feature is the name on the file**, because the pub does the
 * posting and the marketing should land on whoever ran the night.
 *
 * Which is exactly the kind of thing this repo keeps shipping dead. Every
 * piece of it draws perfectly when it is broken: the button is there, the
 * overlay is there, the photograph is there — and the press is eaten by the
 * overlay's own close handler, or the canvas comes back blank because the
 * picture had not finished arriving, or the mark is drawn off the bottom edge.
 * **None of that throws and none of it shows in a diff.**
 *
 * So this presses the real control on a real published gallery and then looks
 * at the BYTES that came out:
 *
 *   - the night is seeded, published, and opened in a real browser;
 *   - the Save is found, and a finger is put on it (`elementFromPoint`);
 *   - it is pressed, and a file has to actually leave;
 *   - the file is decoded again and the bottom-right corner SAMPLED — the
 *     source is a flat bright colour, so the dark plate either landed on it or
 *     the watermark is not there;
 *   - and the photograph itself has to survive, so the middle is sampled too.
 *
 * The source JPEG is made by the browser rather than checked in: the fixtures
 * the unit tests use are 64 bytes of nothing, which no decoder will open, and
 * a real image is one `toDataURL` away with no dependency.
 *
 *     node scripts/photo-to-socials.mjs
 */

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

import { freePort } from '../test/helpers/live-server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STUB = join(ROOT, 'test', 'helpers', 'photo-repo-stub.mjs');
const NIGHT = '2026-08-20';
const VENUE = 'The Station Tap, Wokingham';
const PASSWORD = 'a-long-enough-one-for-here';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failures += 1;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${detail ? `  — ${detail}` : ''}`);
};

const data = mkdtempSync(join(tmpdir(), 'socials-'));
const repo = mkdtempSync(join(tmpdir(), 'socials-gh-'));
const port = await freePort();
const env = {
  ...process.env,
  PORT: String(port), HOST_KEY: 'not-used-here', DATA_DIR: data,
  GH_STUB_DIR: repo, PHOTO_REPO: 'someone/photos', PHOTO_TOKEN: 'stub',
};
const base = `http://127.0.0.1:${port}`;
let server = spawn(process.execPath, ['--import', STUB, 'server.js'], { cwd: ROOT, env, stdio: 'ignore' });
const up = async () => {
  for (let i = 0; i < 60; i += 1) {
    try { await fetch(base); return; } catch { await wait(200); }
  }
  throw new Error('the server never came up');
};
const post = (path, body, cookie = '') => fetch(`${base}${path}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
  body: JSON.stringify(body),
});

const browser = await chromium.launch();
try {
  await up();

  /* ---------------------------------------- one login, an owner and his room */

  const made = await (await post('/api/signup',
    { email: 'mark@example.com', password: PASSWORD, name: 'Mark' })).json();
  const token = new URL(made.devLink).searchParams.get('t');
  await post('/api/reset/complete', { token, password: PASSWORD });

  const file = join(data, 'accounts.json');
  const acc = JSON.parse(readFileSync(file, 'utf8'));
  acc.accounts[0].role = 'owner';
  acc.accounts.push({
    ...acc.accounts[0], id: 'qm-mark', email: 'mark+qm@example.com',
    name: "Mark's Quizporium", role: 'quizmaster', ownedBy: acc.accounts[0].id,
    comped: true, status: 'active',
  });
  writeFileSync(file, JSON.stringify(acc));
  server.kill(); await wait(300);
  server = spawn(process.execPath, ['--import', STUB, 'server.js'], { cwd: ROOT, env, stdio: 'ignore' });
  await up();

  const signIn = await post('/api/sign-in', { email: 'mark@example.com', password: PASSWORD });
  const cookie = (signIn.headers.getSetCookie() || []).map((c) => c.split(';')[0]).join('; ');

  /* ------------------------- a real photograph, made by the browser itself */

  const maker = await browser.newPage();
  await maker.goto(`${base}/`);
  const b64 = await maker.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 900; c.height = 1200;
    const x = c.getContext('2d');
    /*
     * FLAT, BRIGHT AND COLOURLESS ON PURPOSE, and all three do work.
     *
     * BRIGHT so the watermark's plate darkens it measurably; FLAT so no corner
     * of the photograph is dark by accident; and GREY because the plate is
     * TRANSLUCENT — over an orange fixture it comes out orange, and the first
     * version of the logo check then found the plate and passed with the mark
     * missing. On a neutral photograph the only saturated thing that can
     * possibly be in that corner is the mark itself.
     */
    x.fillStyle = '#d9d9d9'; x.fillRect(0, 0, 900, 1200);
    return c.toDataURL('image/jpeg', 0.92).split(',')[1];
  });
  await maker.close();
  const jpeg = Buffer.from(b64, 'base64');

  const arc = join(data, 'rooms', 'qm-mark', 'archive');
  mkdirSync(arc, { recursive: true });
  writeFileSync(join(arc, 'n1.json'), JSON.stringify({
    id: 'n1', kind: 'quiz', quizTitle: '80s Anthems', packId: 'eighties',
    archivedAt: Date.parse(`${NIGHT}T21:30:00Z`), venue: VENUE,
    leaderboard: [{ name: 'Beer Pressure', score: 2000, position: 1, faceKey: '' }],
  }));
  const dir = join(repo, 'photos', 'qm-mark', NIGHT);
  mkdirSync(dir, { recursive: true });
  for (let i = 0; i < 3; i += 1) writeFileSync(join(dir, `p${i}.jpg`), jpeg);

  const pub = await post('/api/past-gigs/publish', { night: NIGHT, on: true }, cookie);
  check('the night publishes', pub.status === 200, `${pub.status}`);

  /* ------------------------------- and now a stranger opens it on a phone */

  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    acceptDownloads: true,
  });
  const boom = [];
  page.on('pageerror', (e) => boom.push(String(e)));
  await page.goto(`${base}/gallery?n=${NIGHT}`);
  await page.waitForSelector('.gal-shot img', { timeout: 10000 }).catch(() => {});

  const shots = await page.locator('.gal-shot').count();
  check('a visitor with no cookie sees the published photographs', shots === 3, `${shots} on the wall`);

  await page.locator('.gal-shot').first().click();
  await page.waitForSelector('.gal-save', { timeout: 5000 }).catch(() => {});

  /*
   * PUT A FINGER ON IT. In the document, has a size and can be pressed are
   * three different questions, and this control sits inside a full-screen
   * button whose only job is to close — so "painted over" is the exact way it
   * would fail.
   */
  const reachable = await page.evaluate(() => {
    const el = document.querySelector('.gal-save');
    if (!el) return 'not drawn';
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return 'no size';
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return el.contains(hit) || hit === el ? 'yes' : `covered by ${hit && hit.className}`;
  });
  check('the Save can actually be pressed', reachable === 'yes', reachable);

  const waitDownload = page.waitForEvent('download', { timeout: 20000 });
  await page.locator('.gal-save').click();

  let saved = null;
  let named = '';
  try {
    const dl = await waitDownload;
    named = dl.suggestedFilename();
    saved = await dl.path();
  } catch { /* reported below */ }
  check('pressing it actually sends a file', Boolean(saved), named || 'nothing left the page');

  check('the overlay did not shut under the press',
    await page.locator('.gal-big').count() === 1,
    'the photograph closed instead of saving');

  check('the file is named for the pub and the night',
    /station-tap/.test(named) && /2026|august/i.test(named), named);

  /* --------------------------------- and the mark is really in the bytes */

  if (saved) {
    const out = `data:image/jpeg;base64,${readFileSync(saved).toString('base64')}`;
    const seen = await page.evaluate(async (src) => {
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = src; });
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const x = c.getContext('2d');
      x.drawImage(img, 0, 0);
      const at = (px, py) => {
        const d = x.getImageData(px, py, 1, 1).data;
        return { r: d[0], g: d[1], b: d[2] };
      };
      // "Darkened", not "dark": the plate is translucent, so over a light grey
      // photograph it lands well under the source's own 651 without ever being
      // black. Naming an absolute here is how a check starts measuring the
      // fixture instead of the feature.
      const SOURCE = 217 * 3;
      const darkened = (p) => p.r + p.g + p.b < SOURCE - 150;
      const corner = at(c.width - 60, c.height - 40);

      /*
       * AND THE LOGO IS A SEPARATE QUESTION FROM THE PLATE — this took three
       * goes and every wrong one PASSED with the fault put back.
       *
       * The bug it exists for: the drawing's `src` was set and `complete`
       * checked in the same breath, which on a first save is always false, so
       * the plate and the words landed and **the mic never did, for everybody,
       * every time.** The dark corner said yes and was answering about the
       * plate.
       *
       * The mark is drawn in the account's own two colours. The photograph is
       * grey, the plate is grey over grey and the words are white — so a
       * saturated pixel anywhere in that corner is the mark, and nothing else
       * can be.
       */
      /*
       * THE WHOLE BOTTOM BAND, because the plate is as wide as the NAME.
       *
       * A window pinned to the right-hand corner missed the mark entirely: the
       * logo sits at the LEFT end of the plate and the plate's width is
       * whatever the quizmaster is called, so a longer name walks the icon
       * further from the corner. The check then said "no logo" about a logo
       * that was there — a guard measuring its own assumption.
       */
      let coloured = false;
      const strip = x.getImageData(0, c.height - 140, c.width, 140).data;
      for (let i = 0; i < strip.length; i += 4) {
        const hi = Math.max(strip[i], strip[i + 1], strip[i + 2]);
        const lo = Math.min(strip[i], strip[i + 1], strip[i + 2]);
        if (hi > 70 && hi - lo > 45) { coloured = true; break; }
      }
      return {
        w: c.width, h: c.height,
        markedCorner: darkened(corner),
        logoDrawn: coloured,
        middleKept: !darkened(at(Math.round(c.width / 2), Math.round(c.height / 3))),
        topLeftClean: !darkened(at(40, 40)),
      };
    }, out);

    check('the saved file is the photograph at its own size',
      seen.w === 900 && seen.h === 1200, `${seen.w}x${seen.h}`);
    check('the mark is on the bottom-right of the saved file', seen.markedCorner,
      'the corner is still the bare photograph');
    check('and the LOGO is on it, not only the words', seen.logoDrawn,
      'the plate and the name landed and the mark did not');
    check('and the photograph itself survived', seen.middleKept && seen.topLeftClean,
      'the picture came back dark — the canvas drew the mark and lost the photo');
  }

  check('nothing threw on the page', boom.length === 0, boom.join(' | '));
} finally {
  await browser.close().catch(() => {});
  server.kill();
  rmSync(data, { recursive: true, force: true });
  rmSync(repo, { recursive: true, force: true });
}

console.log(failures ? `\n${failures} FAILED` : '\nAll good.');
process.exit(failures ? 1 : 0);
