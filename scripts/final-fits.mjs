/**
 * NOTHING ON THE FINAL SLIDE MAY BE CUT OFF.
 *
 * The last slide of the night was clipping at BOTH ends — "Tonight's winner"
 * off the top and the comeback QR sliced in half off the bottom — on any night
 * that had a comeback, and far worse with a league table as well. At every
 * resolution, for as long as both features had existed, with nobody reporting
 * it. It was found by measuring for something else.
 *
 * Nothing in `npm test` can see this: the markup is correct, the payload is
 * correct, every unit test passes, and the fault is entirely in how tall the
 * result is against the box it sits in. So this plays REAL nights to the final
 * and measures the real projector, `/screen`, in a real browser.
 *
 * **IT PLAYS THE NIGHT; IT DOES NOT TYPE THE CARD.** It used to build the
 * winner card by hand — its own podium, its own draw band, its own fourth
 * place — and measure THAT. The card drifted away from it: the draw was binned
 * on 21 September and fourth place came off the podium, and the guard went on
 * measuring a slide no projector draws any more (launch-path sweep, 23
 * September 2026). Worse, the page it built called `fitWinner()` ITSELF, so
 * deleting the projector's own call left every check green while every real
 * final ran unscaled. **A guard that builds the thing it guards is testing its
 * own copy** — so the card, the band order, the topbar and the call that fits
 * them are all the projector's now, because it is the projector.
 *
 * **IT MEASURES THE CHILDREN'S BOUNDING RECTS, NOT `scrollHeight`** — on a grid
 * with `place-content: center` that value clamps to the container, so it reads
 * as "fits" exactly when it does not. That mistake is what let this ship.
 *
 *   node scripts/final-fits.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { startApp } from './helpers/live-app.mjs';
import { playwright } from './helpers/playwright.mjs';

const { chromium } = playwright();

/*
 * FOUR PUBS, because the bands under the podium are decided by the VENUE: a
 * usual night and a link put the comeback slide up, and a second night in the
 * season puts the league table up. Two are new tonight and two have a night
 * filed LAST WEEK — a league counts EVENINGS, so two nights played by this
 * script on one day are one night and would never draw a table.
 */
const QUIET = 'The Quiet Arms';
const TAP = 'The Station Tap, Wokingham';
const QUIET_REGULAR = 'The Old Regular';
const TAP_REGULAR = 'The Crown, Twyford';
const SEASON = ['Quizteama Aguilera And Sons', 'Les Quizerables', 'The Quizzly Bears', 'Norfolk Enchants',
  'Universally Challenged', 'Agatha Quiztie', 'Quiz Team Aguilera', 'The Brews Brothers'];

const KEY = 'final-fits';
const { base: B, stop, data: DATA } = await startApp({
  key: KEY,
  // The house room files its nights in `data/archive/`. A night keyed by the
  // venue's NAME alone matches tonight's by `sameVenue()`, which is how every
  // night filed before venue ids existed is read.
  seed(dir) {
    const archive = path.join(dir, 'archive');
    fs.mkdirSync(archive, { recursive: true });
    // A NUMBER, as `archiveResults()` files it — `nightDay()` reads no
    // ISO string, so a night seeded as one is silently not a night. And a DAY
    // APART, for the reason `clearToday()` gives below.
    const DAY = 24 * 60 * 60 * 1000;
    for (const [n, venueName] of [QUIET_REGULAR, TAP_REGULAR].entries()) {
      const lastWeek = Date.now() - (7 + n) * DAY;
      const id = `last-week-${venueName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      fs.writeFileSync(path.join(archive, `${id}.json`), JSON.stringify({
        id, kind: 'quiz', quizTitle: 'Last week', archivedAt: lastWeek, venue: venueName,
        leaderboard: SEASON.map((name, i) => ({ id: `p${i}`, name, position: i + 1, score: 4000 - i * 300 })),
      }, null, 2));
    }
  },
});

let bad = 0;
const check = (what, ok, note = '') => {
  if (!ok) bad += 1;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${what}${note ? `  — ${note}` : ''}`);
};
const H = { 'content-type': 'application/json', 'X-Host-Key': KEY };
const J = async (route, opts = {}) => {
  const r = await fetch(B + route, opts);
  let body; try { body = await r.json(); } catch { body = null; }
  return { status: r.status, body };
};
const host = (action, body = {}) => J(`/api/host/${action}`, { method: 'POST', headers: H, body: JSON.stringify(body) });
const hostView = async () => (await J('/api/state?role=host', { headers: H })).body;

async function venue(name, details) {
  const made = await J('/api/invoices/customers', { method: 'POST', headers: H, body: JSON.stringify({ name }) });
  const rec = ((made.body || {}).customers || []).find((c) => c.name === name);
  if (!rec) throw new Error(`could not make the venue ${name}: ${JSON.stringify(made.body).slice(0, 160)}`);
  if (details) await J(`/api/invoices/customers/${rec.id}/rewards`, { method: 'PUT', headers: H, body: JSON.stringify(details) });
}
await venue(QUIET, { rewards: ['A pint', 'A half', 'A packet of crisps'] });
await venue(TAP, { rewards: ['A pint', 'A half', 'A packet of crisps'], usualNight: 'thu', link: 'https://example.test/whats-on' });
await venue(QUIET_REGULAR, { rewards: ['A pint', 'A half', 'A packet of crisps'] });
await venue(TAP_REGULAR, { rewards: ['A pint', 'A half', 'A packet of crisps'], usualNight: 'thu', link: 'https://example.test/whats-on' });

/*
 * A LONG TEAM NAME ON PURPOSE, and it WINS. Names are capped at 28 characters
 * and carry no spaces if somebody decides they do not, and the winner's own
 * name is what sets how wide the slide is.
 */
const TEAMS = SEASON.slice(0, 4);
// How often each table gets it right: first every time, the last never.
const RIGHT = [() => true, (n) => n % 3 !== 0, (n) => n % 2 === 0, () => false];
const phones = TEAMS.map((name) => ({ name, id: '', token: '' }));

/*
 * ONE ROUND A NIGHT. The final is what is measured, and four nights of a
 * whole pack would spend minutes answering questions nobody looks at. A
 * one-round night is a composed night, which files like any other — and the
 * filed nights are what the league is read from.
 */
const lib = (await J('/api/library', { headers: H })).body;
const pack = (lib.quizzes || [])
  .filter((q) => ((q.rounds || [])[0] || {}).type === 'text')
  .sort((a, b) => ((a.rounds[0].questions || []).length || 99) - ((b.rounds[0].questions || []).length || 99))[0];
if (!pack) throw new Error('no quiz pack opening on a general knowledge round');

/*
 * ONE PUB AN EVENING, as it is for a real quizmaster. Everything here is
 * played on one day, and `mergeGigs()` folds a day into one evening — four
 * pubs on it is a night with no venue (`venueMixed`), which the league
 * rightly refuses to count. So the nights this script filed earlier TODAY are
 * cleared before the next; last week's, seeded above, stay.
 */
function clearToday() {
  const archive = path.join(DATA, 'archive');
  for (const file of fs.existsSync(archive) ? fs.readdirSync(archive) : []) {
    if (!file.startsWith('last-week-')) fs.rmSync(path.join(archive, file), { force: true });
  }
}

async function launchNight(venueName) {
  clearToday();
  const go = await host('launch', { game: 'quiz', packId: pack.id, order: [{ packId: pack.id, round: 0 }], venue: venueName, replace: true });
  if (go.status !== 200) throw new Error(`launch at ${venueName}: ${go.status} ${JSON.stringify(go.body).slice(0, 160)}`);
}

async function playNight(venueName) {
  for (const p of phones) {
    const j = await J('/api/join', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: p.name, ...(p.id ? { playerId: p.id, token: p.token } : {}) }) });
    p.id = j.body.id || j.body.playerId || p.id;
    p.token = j.body.token || p.token;
  }
  let asked = 0;
  for (let i = 0; i < 400; i += 1) {
    const v = await hostView();
    if (v.phase === 'final') return v;
    if (v.phase === 'question' && v.question && !(v.clock && v.clock.closed)) {
      asked += 1;
      const q = v.question;
      await Promise.all(phones.map((p, k) => {
        const right = RIGHT[k](asked);
        const pick = right ? q.correctIndex : (q.correctIndex + 1) % Math.max(2, (q.options || []).length);
        return J('/api/answer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ playerId: p.id, token: p.token, optionIndex: pick }) });
      }));
      await host('reveal');
      continue;
    }
    await host('next');
  }
  throw new Error(`the night at ${venueName} never reached the final`);
}

// 4:3 is in here deliberately — plenty of pub projectors still are.
const SIZES = [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }, { width: 1024, height: 768 }];

// Every combination a real night can produce, in the order that builds them.
const NIGHTS = [
  { name: 'podium only', venue: QUIET, league: false, comeback: false },
  { name: 'podium + comeback', venue: TAP, league: false, comeback: true },
  { name: 'league + comeback', venue: TAP_REGULAR, league: true, comeback: true },
  { name: 'podium + league', venue: QUIET_REGULAR, league: true, comeback: false },
];

/*
 * TWO PROJECTORS PER SIZE, because the final is reached two ways and they fit
 * differently. One is up all night and is handed the final by a push, which is
 * the ordinary evening. The other is OPENED at the final — the laptop that
 * reloaded, the host who put the projector up late — and there the card is
 * still running its entrance animation when `fitWinner()` measures it, which
 * is the case the old hand-built card could never have shown.
 */
async function openProjector(size) {
  const page = await browser.newPage({ viewport: size });
  await page.goto(`${B}/screen`, { waitUntil: 'load' });
  return page;
}

const browser = await chromium.launch();
try {
  for (const night of NIGHTS) {
    await launchNight(night.venue);
    // Navigate fresh per size — resizing one page in a loop is
    // non-deterministic here (see CLAUDE.md, the console's polish pass).
    const allNight = [];
    for (const size of SIZES) allNight.push({ size, how: 'up all night', page: await openProjector(size) });
    await playNight(night.venue);
    console.log(`\n${night.name} — ${night.venue}`);
    const atTheFinal = [];
    for (const size of SIZES) atTheFinal.push({ size, how: 'opened at the final', page: await openProjector(size) });
    for (const { size, how, page } of [...allNight, ...atTheFinal]) {
      await page.waitForSelector('#card .winner .kicker', { timeout: 10_000 });
      // The projector fits the card a frame after it draws, and the QR has to
      // arrive before it can be measured as painted.
      await page.waitForFunction(() => {
        const img = document.querySelector('.cb-qr img');
        return !img || img.complete;
      }, null, { timeout: 10_000 }).catch(() => {});
      await page.waitForTimeout(400);

      const m = await page.evaluate(() => {
        const w = document.querySelector('#card .winner');
        const box = document.querySelector('#card').getBoundingClientRect();
        const kids = [...w.children].filter((n) => n.getClientRects().length);
        const top = Math.min(...kids.map((n) => n.getBoundingClientRect().top));
        const bottom = Math.max(...kids.map((n) => n.getBoundingClientRect().bottom));
        const qr = document.querySelector('.cb-qr');
        const kicker = document.querySelector('.kicker').getBoundingClientRect();
        return {
          scale: Number(getComputedStyle(w).getPropertyValue('--fit')) || 1,
          over: Math.round(Math.max(0, box.top - top) + Math.max(0, bottom - box.bottom)),
          kickerIn: kicker.top >= box.top - 1,
          league: Boolean(document.querySelector('.lgb')),
          comeback: Boolean(document.querySelector('.comeback')),
          qrIn: !qr || (qr.getBoundingClientRect().bottom <= box.bottom + 1
            && qr.getBoundingClientRect().top >= box.top - 1),
          qrPx: qr ? Math.round(qr.getBoundingClientRect().width) : 0,
        };
      });

      // The combination named is the one measured, or a pass says nothing.
      const label = `${size.width}x${size.height} ${how}`;
      check(`${label}  the slide carries what this night should`, m.league === night.league && m.comeback === night.comeback,
        `league ${m.league ? 'up' : 'absent'}, comeback ${m.comeback ? 'up' : 'absent'}`);

      /*
       * AND THE QR HAS TO HAVE ACTUALLY PAINTED.
       *
       * Every other measurement here is about POSITION — where the box is, how
       * big it is, whether it is inside the card. A QR that is perfectly placed
       * and blank passes all of them, and "it is in the document" versus
       * "somebody can see it" is the distinction this repo has now been bitten
       * by four times. `toSvg()` returns an SVG with a viewBox and no intrinsic
       * size, so `naturalWidth` is 0 even when it is fine — the only honest
       * test is to draw it and count the dark pixels. Same origin, so the
       * canvas is not tainted.
       */
      if (night.comeback) {
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
        check(`${label}  …and the QR is really drawn, not just placed`, painted > 2000, `${painted} dark pixels of 40000`);
      }
      /*
       * THERE WAS AN ASSERTION HERE THAT A 16:9 NIGHT NEEDED NO SHRINKING, and
       * it is gone because what it held is gone. It kept the draw and the
       * comeback SIDE BY SIDE rather than stacked; the draw was binned on 21
       * September, so the end band holds one thing and there is nothing left
       * to stack. Its 1.00 was also measured on the hand-built stage — the
       * real projector's card is shorter, and a podium with a comeback under
       * it fits at 0.96 on a real 1280x720, which is the backstop doing its
       * job rather than a fault.
       *
       * AND ONE PIXEL IS NOT A CUT. `fitWinner()` makes the content exactly
       * as tall as the card, so a centred result lands on half pixels at
       * both ends; the kicker, the thing a real cut takes first, is checked
       * on its own.
       */
      check(`${label}  nothing cut`, m.over <= 1 && m.kickerIn && m.qrIn,
        `${m.over ? `${m.over}px cut off` : 'nothing cut'}`
        + `${m.kickerIn ? '' : ', kicker gone'}${m.qrIn ? '' : ', QR sliced'}`
        + ` · scale ${m.scale.toFixed(2)}${m.qrPx ? `, QR ${m.qrPx}px` : ''}`);
      await page.close();
    }
  }
} catch (err) {
  bad += 1;
  console.log(`threw: ${err.message}`);
} finally {
  await browser.close().catch(() => {});
  await stop();
}

console.log(bad ? `\n${bad} FAILED` : '\nThe last slide of the night fits, on every screen.');
process.exit(bad ? 1 : 0);
