/**
 * NOTHING ON THE FINAL SLIDE MAY BE CUT OFF.
 *
 * The last slide of the night was clipping at BOTH ends — "Tonight's winner"
 * off the top and the comeback QR sliced in half off the bottom — on any night
 * that had a draw and a comeback, and far worse with a league table as well.
 * At every resolution, for as long as both features had existed, with nobody
 * reporting it. It was found by measuring for something else.
 *
 * Nothing in `npm test` can see this: the markup is correct, the payload is
 * correct, every unit test passes, and the fault is entirely in how tall the
 * result is against the box it sits in. So this drives a real browser, builds
 * the winner card out of the REAL stylesheet, and measures the rendered boxes.
 *
 * **IT MEASURES THE CHILDREN'S BOUNDING RECTS, NOT `scrollHeight`** — on a grid
 * with `place-content: center` that value clamps to the container, so it reads
 * as "fits" exactly when it does not. That mistake is what let this ship.
 *
 *   node scripts/final-fits.mjs
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { toSvg } from '../src/qrcode.js';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const PORT = 8971;

let bad = 0;
const check = (what, ok, note = '') => {
  if (!ok) bad += 1;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${what}${note ? `  — ${note}` : ''}`);
};

/*
 * THE PAGE IS SERVED, NOT `setContent`-ed, and that is not a detail: an
 * `about:blank` document taints every canvas, and the canvas is how the check
 * below proves the QR actually PAINTED rather than merely being in the layout.
 */
let servePage = () => '';
const srv = http.createServer((q, r) => {
  const u = new URL(q.url, 'http://x');
  if (u.pathname === '/night') {
    r.writeHead(200, { 'Content-Type': 'text/html' });
    return r.end(servePage());
  }
  if (u.pathname === '/qr.svg') {
    r.writeHead(200, { 'Content-Type': 'image/svg+xml' });
    return r.end(toSvg('https://example.test/x', { margin: 2, dark: '#0b0b12', light: '#ffffff' }));
  }
  const f = path.join(ROOT, u.pathname);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': u.pathname.endsWith('.css') ? 'text/css' : 'text/plain' });
  r.end(fs.readFileSync(f));
});
await new Promise((r) => srv.listen(PORT, r));

/*
 * A LONG TEAM NAME ON PURPOSE. Names are capped at 28 characters and carry no
 * spaces if somebody decides they do not, and the winner's own name is what
 * sets how wide the slide is.
 */
const podium = `
  <div class="kicker">Tonight&rsquo;s winner</div>
  <h1 class="grad-text">Quizteama Aguilera</h1>
  <div class="score">4,820 points</div>
  <div class="runners">
    ${[1, 2, 3].map((i) => `<div class="runner place-${i}"><span class="rplace">${i}</span>
      <span class="rname">Les Quizerables ${i}</span><span class="rscore">4,${i}20</span></div>`).join('')}
  </div>
  <div class="alsoran"><span>4. The Quizzly Bears &mdash; 3,980</span></div>`;
const dip = `<div class="dip"><div class="dip-label">And the draw goes to</div>
  <div class="dip-name">Norfolk Enchants</div>
  <div class="dip-note">drawn from 14 still playing at the last question</div></div>`;
const comeback = `<div class="comeback has-qr"><div class="cb-words">
  <div class="cb-line">Back here Thursday 27th</div>
  <div class="cb-note">Scan for what else is on</div></div>
  <div class="cb-qr"><img src="/qr.svg"></div></div>`;
const league = `<div class="lgb"><div class="lgb-label">The league after tonight</div>
  <div class="lgb-rows">${[1, 2, 3, 4, 5].map((i) => `<div class="lgb-row${i === 1 ? ' lgb-top' : ''}">
    <span class="lgb-pos">${i}</span><span class="lgb-name">Team number ${i}</span>
    <span class="lgb-pts">${40 - i * 3}</span></div>`).join('')}</div>
  <div class="lgb-note">17 teams &middot; 9 nights &middot; best six finishes, plus one a night</div></div>`;

// Every combination a real night can produce, worst last.
const NIGHTS = {
  'podium only': podium,
  'and a draw': podium + `<div class="endband">${dip}</div>`,
  'and a comeback': podium + `<div class="endband">${comeback}</div>`,
  'draw + comeback': podium + `<div class="endband">${dip}${comeback}</div>`,
  'league + comeback': podium + league + `<div class="endband">${comeback}</div>`,
  'draw + league + comeback': podium + league + `<div class="endband">${dip}${comeback}</div>`,
};
// 4:3 is in here deliberately — plenty of pub projectors still are.
const SIZES = [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }, { width: 1024, height: 768 }];

const browser = await chromium.launch();
for (const size of SIZES) {
  console.log(`\n${size.width}x${size.height}`);
  for (const [name, body] of Object.entries(NIGHTS)) {
    const page = await browser.newPage({ viewport: size });
    servePage = () => `<!doctype html><html><head>
      <link rel="stylesheet" href="/assets/style.css"></head>
      <body class="screen"><div class="stage">
        <header class="topbar"><div class="titles"><span class="title">The 1980s Pop Music Quiz</span></div>
          <div class="right"><span class="pill">Results</span><span class="pill">18 playing</span></div></header>
        <main id="card" class="card"><div class="winner">${body}</div></main>
      </div></body></html>`;
    await page.goto(`http://127.0.0.1:${PORT}/night`, { waitUntil: 'networkidle' });

    // The real `fitWinner()`, run the way the projector runs it.
    const scale = await page.evaluate(() => {
      const w = document.querySelector('.winner');
      const cardEl = document.querySelector('main.card');
      w.style.setProperty('--fit', '1');
      const room = cardEl.clientHeight;
      const kids = [...w.children];
      const top = Math.min(...kids.map((n) => n.getBoundingClientRect().top));
      const bottom = Math.max(...kids.map((n) => n.getBoundingClientRect().bottom));
      const r = Math.min(1, room / Math.max(1, bottom - top));
      w.style.setProperty('--fit', String(r));
      return r;
    });
    await page.waitForTimeout(60);

    const m = await page.evaluate(() => {
      const w = document.querySelector('.winner');
      const box = document.querySelector('main.card').getBoundingClientRect();
      const kids = [...w.children];
      const top = Math.min(...kids.map((n) => n.getBoundingClientRect().top));
      const bottom = Math.max(...kids.map((n) => n.getBoundingClientRect().bottom));
      const qr = document.querySelector('.cb-qr');
      const kicker = document.querySelector('.kicker').getBoundingClientRect();
      return {
        over: Math.round(Math.max(0, box.top - top) + Math.max(0, bottom - box.bottom)),
        kickerIn: kicker.top >= box.top - 1,
        qrIn: !qr || (qr.getBoundingClientRect().bottom <= box.bottom + 1
          && qr.getBoundingClientRect().top >= box.top - 1),
        qrPx: qr ? Math.round(qr.getBoundingClientRect().width) : 0,
      };
    });

    /*
     * AND THE QR HAS TO HAVE ACTUALLY PAINTED.
     *
     * Every other measurement here is about POSITION — where the box is, how
     * big it is, whether it is inside the card. A QR that is perfectly placed
     * and blank passes all of them, and "it is in the document" versus
     * "somebody can see it" is the distinction this repo has now been bitten by
     * four times. `toSvg()` returns an SVG with a viewBox and no intrinsic
     * size, so `naturalWidth` is 0 even when it is fine — the only honest test
     * is to draw it and count the dark pixels.
     */
    const painted = await page.evaluate(() => {
      const el = document.querySelector('.cb-qr img');
      if (!el) return -1;
      const c = document.createElement('canvas');
      c.width = 200; c.height = 200;
      const x = c.getContext('2d');
      x.fillStyle = '#fff'; x.fillRect(0, 0, 200, 200);
      x.drawImage(el, 0, 0, 200, 200);
      const d = x.getImageData(0, 0, 200, 200).data;
      let dark = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] < 100) dark += 1;
      return dark;
    });
    if (painted !== -1) {
      check('  …and the QR is really drawn, not just placed', painted > 2000,
        `${painted} dark pixels of 40000`);
    }
    /*
     * AND AN ORDINARY 16:9 NIGHT MUST NOT NEED SCALING AT ALL.
     *
     * "Nothing is cut" is satisfied by the backstop alone — so on its own it
     * would go green with the side-by-side row deleted, quietly shrinking every
     * full night to 0.86 and the comeback QR with it. This is the assertion
     * that holds the other half of the fix in place. 4:3 is exempt: there it
     * genuinely has to shrink, and a threshold that is wrong on one screen is a
     * check somebody turns off.
     */
    if (size.height / size.width < 0.7 && name === 'draw + comeback') {
      check('  …and it needed no shrinking to do it', scale === 1,
        `scale ${scale.toFixed(2)} — under 1 means the bands are stacked again`);
    }
    check(`${name}`, m.over === 0 && m.kickerIn && m.qrIn,
      `${m.over ? `${m.over}px cut off` : 'nothing cut'}`
      + `${m.kickerIn ? '' : ', kicker gone'}${m.qrIn ? '' : ', QR sliced'}`
      + ` · scale ${scale.toFixed(2)}${m.qrPx ? `, QR ${m.qrPx}px` : ''}`);
    await page.close();
  }
}
await browser.close();
srv.close();

console.log(bad ? `\n${bad} FAILED` : '\nThe last slide of the night fits, on every screen.');
process.exit(bad ? 1 : 0);
