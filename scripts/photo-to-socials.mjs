/**
 * CAN A MATE BE SENT A PHOTOGRAPH — AND IS THE QUIZMASTER'S NAME IN THE BYTES?
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
 * The public page's control is SHARE now — *"I want share this photo but no
 * save option"* — and the watermarked download is the quizmaster's own, on the
 * console. Both halves are still checked here, because this is where a real
 * browser and a real published gallery already are:
 *
 *   - the night is seeded, published, and opened in a real browser;
 *   - the Share is found, and a finger is put on it (`elementFromPoint`);
 *   - it is pressed with the sheet stubbed, and the LINK it was handed is read:
 *     the night, the photograph, and no host key on it;
 *   - a fresh browser with no cookie follows that link and has to land on the
 *     same photograph, enlarged — which is the whole of "links back to the
 *     site";
 *   - and `framedBlob()` is called directly, its bottom-right corner SAMPLED —
 *     the source is a flat bright colour, so the dark plate either landed on it
 *     or the watermark is not there;
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

import { freePort, stopped } from '../test/helpers/live-server.mjs';
import { playwright } from './helpers/playwright.mjs';

const { chromium } = playwright();

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
  await page.waitForSelector('.gal-share', { timeout: 5000 }).catch(() => {});

  /*
   * AND THERE IS NO SAVE ON THIS PAGE — *"I want share this photo but no save
   * option."* A removal gets an assertion like anything else: the pill is
   * styled for the CONSOLE's own copy, so it would draw perfectly if somebody
   * put the markup back while tidying.
   */
  check('the public picture offers no save', await page.locator('.gal-save').count() === 0,
    'a Save came back onto the public gallery');

  /* ------------- and the watermark composite still puts the name in the bytes
   *
   * `photo-save.js` is the console's now, not this page's — but this is where
   * the pixel-level assertions live, and a real browser is what they need. So
   * the module is called DIRECTLY in the page rather than through a control
   * that is no longer there: the bug this guards against (the mic's `src` set
   * and `complete` checked in one breath, so the logo never landed for anybody)
   * is in the compositing, not in the button.
   */
  {
    const seen = await page.evaluate(async () => {
      const mod = await import('/assets/photo-save.js');
      const blob = await mod.framedBlob(
        document.querySelector('.gal-big-pic > .gal-photo').src,
        { words: "Mark's Quizporium" },
      );
      const src = await new Promise((res) => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result);
        fr.readAsDataURL(blob);
      });
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
    });

    check('the composite is the photograph at its own size',
      seen.w === 900 && seen.h === 1200, `${seen.w}x${seen.h}`);
    check('the mark is on the bottom-right of it', seen.markedCorner,
      'the corner is still the bare photograph');
    check('and the LOGO is on it, not only the words', seen.logoDrawn,
      'the plate and the name landed and the mark did not');
    check('and the photograph itself survived', seen.middleKept && seen.topLeftClean,
      'the picture came back dark — the canvas drew the mark and lost the photo');
  }

  /* ---------------------------------------------------------------- SHARE
   *
   * *"So instead of saving they can share to their mates and it links back to
   * the site."* The link is the feature, so it is the link that is checked:
   * what the share sheet is actually HANDED, that it carries no key, and that
   * following it as a stranger lands on that same photograph. A share button
   * that opens the sheet with the wrong address in it draws perfectly.
   */
  const shareReach = await page.evaluate(() => {
    const el = document.querySelector('.gal-share');
    if (!el) return 'not drawn';
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return 'no size';
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (!hit) return 'off the screen';
    return el.contains(hit) || hit === el ? 'yes' : `covered by ${hit.className}`;
  });
  check('the Share can actually be pressed', shareReach === 'yes', shareReach);

  await page.evaluate(() => {
    window.__shared = [];
    navigator.share = (d) => { window.__shared.push(d); return Promise.resolve(); };
  });
  await page.locator('.gal-share').click();
  await wait(300);
  const shared = await page.evaluate(() => (window.__shared || [])[0] || null);
  check('pressing it opens the share sheet with a link on it',
    Boolean(shared && shared.url), JSON.stringify(shared));
  check('the link names the night and the photograph',
    Boolean(shared && shared.url.includes(NIGHT) && /#p=p0\.jpg$/.test(shared.url)),
    shared && shared.url);
  check('and it carries no host key', Boolean(shared) && !/[?&]key=/.test(shared.url), shared && shared.url);
  check('the photograph did not shut under the press',
    await page.locator('.gal-big').count() === 1, 'it closed instead of sharing');

  if (shared && shared.url) {
    const mate = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await mate.goto(shared.url);
    await mate.waitForSelector('.gal-big-pic > .gal-photo', { timeout: 8000 }).catch(() => {});
    const landed = await mate.evaluate(() => {
      const img = document.querySelector('.gal-big-pic > .gal-photo');
      return img ? img.getAttribute('src') : '';
    });
    check('a mate following it lands on that photograph, enlarged',
      /p0\.jpg/.test(landed || ''), landed || 'no photograph opened');
    await mate.close();
  }

  /*
   * AND A PREVIEW LINK MAY NOT PUT THE KEY IN A GROUP CHAT.
   *
   * The one thing that would make this feature a liability: a quizmaster checks
   * a night on a `?key=` link, presses Share, and hands out the key to their own
   * console. `shareLink()` builds the address from scratch for exactly this
   * reason — everything else on the page uses `linked()`, which carries it on
   * purpose — so the refusal is checked on a visit that HAS one.
   */
  await page.goto(`${base}/gallery?n=${NIGHT}&key=not-used-here&as=visitor`);
  await page.waitForSelector('.gal-shot img', { timeout: 10000 }).catch(() => {});
  await page.locator('.gal-shot').first().click();
  await page.waitForSelector('.gal-share', { timeout: 5000 }).catch(() => {});
  await page.evaluate(() => {
    window.__shared = [];
    navigator.share = (d) => { window.__shared.push(d); return Promise.resolve(); };
  });
  await page.locator('.gal-share').click();
  await wait(300);
  const fromPreview = await page.evaluate(() => (window.__shared || [])[0] || null);
  check('a share from a preview link leaves the key and the stand-down behind',
    Boolean(fromPreview) && !/[?&]key=/.test(fromPreview.url) && !/[?&]as=/.test(fromPreview.url),
    fromPreview && fromPreview.url);

  /*
   * A PICTURE OF THE PAIR, at the two widths a phone actually is — the controls
   * are a LOOK as much as a mechanism, and two pills that fit at 390 and wrap
   * at 320 is the thing a measurement will not tell anybody.
   */
  if (process.env.SHOT_DIR) {
    for (const width of [390, 320]) {
      // A FRESH PAGE PER WIDTH, never `setViewportSize` in a loop — that is
      // non-deterministic here, and this repo has the note.
      const shot = await browser.newPage({ viewport: { width, height: 844 } });
      await shot.goto(`${base}/gallery?n=${NIGHT}`);
      await shot.waitForSelector('.gal-shot img', { timeout: 10000 }).catch(() => {});
      await shot.locator('.gal-shot').first().click();
      await shot.waitForSelector('.gal-share', { timeout: 5000 }).catch(() => {});
      await wait(400);
      await shot.screenshot({ path: join(process.env.SHOT_DIR, `gallery-share-${width}.png`) });
      await shot.close();
    }
  }

  check('nothing threw on the page', boom.length === 0, boom.join(' | '));
} finally {
  await browser.close().catch(() => {});
  /*
   * WAITED FOR, NEVER JUST SIGNALLED — `kill()` returns before the process has
   * gone, and deleting its DATA_DIR on the next line raced a server still
   * flushing state: ENOTEMPTY out of this very block, with every assertion
   * above it passed. The same fault cost a day in the suite.
   */
  await stopped(server);
  rmSync(data, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  rmSync(repo, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
}

console.log(failures ? `\n${failures} FAILED` : '\nAll good.');
process.exit(failures ? 1 : 0);
