#!/usr/bin/env node
/**
 * THE LAUNCH BAR OFFERS REAL GAMES, AND A NIGHT CAN NAME ANY PACK YOU HOLD.
 *
 * Two faults, both found by a sweep, both introduced by a change to the TAB
 * LIST — which is why they need a guard that opens the real console rather
 * than one that reads `TABS`:
 *
 *  1. The game dropdown was built from every `TABS` entry with `packs` +
 *     `needs`. That was quiz and bingo until the round tabs landed, and then
 *     five — so the picker offered General Knowledge, Image Rounds and Music
 *     Intros, and `gameOf().id` went to `/api/host/launch` as `game`:
 *     `400 Unknown game: text`, on the protected surface.
 *
 *  2. Quiz Packs deliberately hides the one-round packs, and `applyShow()`
 *     resolved a show's pack ids against THAT filtered shelf. So loading a
 *     saved show naming one of the twenty-four left Tonight EMPTY with
 *     nothing said anywhere — `loadShow()`'s banner cannot cover it, because
 *     the server reports no `problems`: the file is there and perfectly fine.
 *
 * Neither throws, both draw a page that looks right, and `npm test` cannot
 * see either — *a test that never runs the artefact proves nothing about it.*
 *
 *   node scripts/tonight-resolves.mjs
 */


import { startApp } from './helpers/live-app.mjs';
import { playwright } from './helpers/playwright.mjs';

const { chromium } = playwright();

const KEY = 'tonightresolves';
const { base: BASE, stop } = await startApp({ key: KEY });

let failures = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures += 1;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}`);
  if (!ok) console.log(`        wanted ${JSON.stringify(want)}\n        got    ${JSON.stringify(got)}`);
};

try {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${BASE}/console?key=${KEY}`, { waitUntil: 'load' });
  await page.waitForSelector('.launchbar');
  await page.waitForTimeout(1200);

  console.log('\nTONIGHT — what it offers, and what it can find\n');

  /*
   * THE NATIVE `<select>` IS THE TRUTH, not the popover skin over it — see
   * `console-pick.js`. So this reads the options the LAUNCH would send.
   */
  const kinds = await page.evaluate(() => {
    const sel = document.querySelector('.launchbar select.lb-game')
      || [...document.querySelectorAll('.launchbar select')]
        .find((s) => [...s.options].some((o) => o.value === 'bingo'));
    return sel ? [...sel.options].map((o) => o.value) : ['NO GAME PICKER FOUND'];
  });
  /*
   * AGAINST THE APP'S OWN LIST, NEVER ONE WRITTEN OUT HERE.
   *
   * This said `['bingo', 'quiz']` and Card Bingo shipped, so it failed on a
   * working picker and called a real game an intruder — *a COUNT goes stale
   * silently*, wearing a list. `GAME_KINDS` is the console's own named
   * constant and `game-kinds.test.js` already pins it against the server's
   * `LAUNCHERS`, so reading it here means the two move together and a fourth
   * game needs no edit in this file.
   *
   * The dynamic import is safe precisely because this is the console's own
   * page: the module is already evaluated, so it comes back cached rather
   * than booting a second time. Do NOT copy this into a script pointed at any
   * other page — *importing from a page's own module runs that page's own
   * boot code*.
   */
  const named = await page.evaluate(() => import('/assets/console.js')
    .then((m) => [...(m.GAME_KINDS || [])].sort()).catch(() => ['COULD NOT READ GAME_KINDS']));
  check('the game picker offers exactly the console\'s own GAME_KINDS', kinds.sort(), named);

  /*
   * AND EVERY ONE OF THEM IS ASKED OF THE SERVER, rather than trusted to a
   * list — the 400 is what a host actually met.
   */
  for (const kind of kinds) {
    const res = await page.evaluate(async ([b, k, key]) => {
      const r = await fetch(`${b}/api/host/launch?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game: k, packId: 'definitely-not-a-pack' }),
      });
      return { status: r.status, body: await r.text() };
    }, [BASE, kind, KEY]);
    check(`  ...and "${kind}" is not refused as an unknown game`, /Unknown game/.test(res.body), false);
  }

  /*
   * A ONE-ROUND PACK IS OFF THE QUIZ PACKS SHELF BY DESIGN — this finds one
   * and then asks Tonight to resolve it, which is the whole of fault 2.
   */
  const oneRound = await page.evaluate(async ([b, key]) => {
    const lib = await (await fetch(`${b}/api/library?key=${key}`)).json();
    const found = (lib.quizzes || []).find((p) => (p.rounds || []).length === 1 && !p.locked && !p.broken);
    return found ? found.id : '';
  }, [BASE, KEY]);
  check('there is a one-round pack to test with', Boolean(oneRound), true);

  if (oneRound) {
    const onShelf = await page.evaluate((id) => [...document.querySelectorAll('.pack-card[data-pack]')]
      .some((c) => c.dataset.pack === id), oneRound);
    check('  ...and it is NOT on the Quiz Packs shelf, which is the whole trap', onShelf, false);

    // A show naming it. `?show=` is not a thing, so it is saved and loaded the
    // way the console itself does it.
    const saved = await page.evaluate(async ([b, key, id]) => {
      const r = await fetch(`${b}/api/shows?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'One round only', items: [{ kind: 'quiz', packId: id }] }),
      });
      return r.status;
    }, [BASE, KEY, oneRound]);
    // The STATUS, not `true` — the first version of this line returned a bare
    // `true` and reported a save that had 404ed.
    check('  ...a show naming it saved', saved, 200);

    // Loaded THROUGH THE CARD, on the tab a quizmaster would use — a
    // synthesised call would not be the path that was broken.
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('.launchbar');
    await page.waitForTimeout(1200);
    await page.evaluate(() => document.querySelector('button.tab[data-tab="shows"]')?.click());
    await page.waitForSelector('.show-card');
    await page.waitForTimeout(400);
    const found = await page.evaluate(() => Boolean(document.querySelector('.show-card')));
    check('  ...the show has a card to press', found, true);
    await page.evaluate(() => document.querySelector('.show-card')?.click());
    await page.waitForTimeout(1500);
    const tiles = await page.evaluate(() => document.querySelectorAll('.lb-tiles .lb-tile.is-pack').length);
    check('  ...and loading it puts the pack in Tonight rather than nothing', tiles > 0, true);
  }

  /*
   * A SHOW WITH TWO PARTS IS TWO GAMES ON THE BAR, AND LAUNCH SENDS THE TILES
   * (O2, 23 September 2026). The bar used to load ONE part and name the next
   * in a "Then:" line, while Launch quietly sent the whole SAVED show: one
   * tile on the bar, two games on the wire, and a round taken off the bar was
   * still played. Saved with a subset order, loaded through the card, one
   * tile removed, and the launch body read off the real request.
   */
  const twoPart = await page.evaluate(async ([b, key]) => {
    const lib = await (await fetch(`${b}/api/library?key=${key}`)).json();
    const quiz = (lib.quizzes || []).find((p) => (p.rounds || []).length >= 3 && !p.locked && !p.broken);
    const bingo = (lib.bingo || [])[0];
    if (!quiz || !bingo) return null;
    const order = [0, 1, 2].map((round) => ({ packId: quiz.id, round }));
    const r = await fetch(`${b}/api/shows?key=${key}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Two parts tonight', winners: 1, questionSeconds: 30, items: [{ kind: 'quiz', packId: quiz.id, order }, { kind: 'bingo', packId: bingo.id, prizes: 2 }] }),
    });
    const H = { 'Content-Type': 'application/json' };
    const mk = await fetch(`${b}/api/invoices/customers?key=${key}`, { method: 'POST', headers: H, body: JSON.stringify({ name: 'The Show Arms' }) });
    const c = ((await mk.json()).customers || []).find((x) => x.name === 'The Show Arms');
    if (c) await fetch(`${b}/api/invoices/customers/${encodeURIComponent(c.id)}/rewards?key=${key}`, { method: 'PUT', headers: H, body: JSON.stringify({ rewards: ['Pint', 'Half', 'Crisps'], usualNight: 'thu' }) });
    return { saved: r.status, quiz: quiz.id, bingo: bingo.id };
  }, [BASE, KEY]);
  check('a two-part show saved, with a venue to pay it', twoPart && twoPart.saved === 200, true);
  if (twoPart) {
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('.launchbar');
    await page.waitForTimeout(1200);
    await page.evaluate(() => document.querySelector('button.tab[data-tab="shows"]')?.click());
    await page.waitForSelector('.show-card');
    await page.waitForTimeout(400);
    await page.evaluate(() => [...document.querySelectorAll('.show-card')].find((c) => /Two parts tonight/.test(c.textContent))?.click());
    await page.waitForTimeout(1500);
    const kinds = await page.evaluate(() => [...document.querySelectorAll('.lb-tiles .lb-tile.is-pack')].map((t) => (t.className.match(/is-(quiz|bingo|cards)/) || [])[1] || (t.innerText.includes('Round') ? 'quiz' : '?')));
    check(`  ...both parts are on the bar as tiles (${kinds.length})`, kinds.length >= 4, true);
    // Y17: the night's own selects follow the show the moment it is loaded, not on the next redraw.
    const picks = await page.evaluate(() => ({
      winners: document.querySelector('.winners-pick')?.value,
      secs: document.querySelector('.seconds-pick')?.value,
      // THE FACE TOO: the popover skin repaints only when asked (`refreshPicks(el)`), and a select's value can be right under a face still saying 3.
      face: (document.querySelector('.winners-pick')?.closest('.pick')?.querySelector('.pick-word')?.textContent || '').trim(),
    }));
    check(`  ...and Winners and Secs per Q show the show's own, on the face as well (${JSON.stringify(picks)})`, picks.winners === '1' && String(picks.secs) === '30' && picks.face === '1', true);
    await page.evaluate(async (v) => {
      document.querySelector('.lb-where')?.click();
      await new Promise((r) => setTimeout(r, 400));
      [...document.querySelectorAll('.lb-venues button')].find((x) => x.textContent.includes(v))?.click();
    }, 'The Show Arms');
    await page.waitForTimeout(700);
    const label = await page.evaluate(() => (document.querySelector('.lb-go') || {}).textContent || '');
    check(`  ...and Launch names both games ("${label.trim()}")`, /round/.test(label) && /bingo/.test(label), true);
    // take the first quiz tile out, then read what Launch actually sends
    const before = await page.evaluate(() => document.querySelectorAll('.lb-tiles .lb-tile.is-pack').length);
    await page.evaluate(() => document.querySelector('.lb-tiles .lb-tile.is-pack .lb-tile-off')?.click());
    await page.waitForTimeout(600);
    const after = await page.evaluate(() => document.querySelectorAll('.lb-tiles .lb-tile.is-pack').length);
    check('  ...a tile taken off the loaded show goes', after, before - 1);
    const bodies = [];
    page.on('request', (r) => { if (r.method() === 'POST' && /\/api\/host\/launch/.test(r.url())) bodies.push(r.postData() || ''); });
    page.on('dialog', (d) => d.accept().catch(() => {}));
    await page.evaluate(() => document.querySelector('.lb-go')?.click());
    await page.waitForTimeout(3000);
    const sent = bodies.length ? JSON.parse(bodies[bodies.length - 1]) : {};
    const segs = sent.segments || [];
    const quizRounds = segs.filter((x) => x.kind === 'quiz').flatMap((x) => x.order || []).length;
    check(`  ...and the wire carries what the tiles said: two rounds and the bingo, not the saved three (${quizRounds} rounds, ${segs.map((x) => x.kind).join('+')})`, quizRounds === 2 && segs.some((x) => x.kind === 'bingo'), true);
    await page.goto(`${BASE}/console?key=${KEY}`, { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    for (let i = 0; i < 3; i += 1) {
      const pressed = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((n) => /^(unlaunch|stop)$/i.test((n.textContent || '').trim())); if (!b) return false; b.click(); return true; });
      if (!pressed) break;
      await page.waitForTimeout(1500);
    }
  }

  /*
   * THE SAME BINGO PACK GOES IN TWICE — *"I need to be able to add multiple
   * music bingo and card bingo rounds and at the moment that's not
   * possible."* A second game of bingo is its own part; tapped on the
   * shelf, the way a real host does it.
   */
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.launchbar');
  await page.waitForTimeout(1200);
  await page.evaluate(() => document.querySelector('button.tab[data-tab="bingo"]')?.click());
  await page.waitForTimeout(500);
  const bingoCard = await page.evaluate(() => (document.querySelector('.pack-card[data-pack]') || {}).dataset?.pack || '');
  check('there is a bingo pack to tap', Boolean(bingoCard), true);
  if (bingoCard) {
    const before = await page.evaluate(() => document.querySelectorAll('.lb-tiles .lb-tile.is-pack').length);
    for (let i = 0; i < 2; i += 1) {
      await page.evaluate((id) => document.querySelector(`.pack-card[data-pack="${id}"]`)?.click(), bingoCard);
      await page.waitForTimeout(900);
    }
    const after = await page.evaluate(() => document.querySelectorAll('.lb-tiles .lb-tile.is-pack').length);
    // Two TILES, not the Launch label — with no venue picked the button
    // stands down for want of prizes and says so instead of counting games.
    check('  ...and tapping it twice puts TWO games of it in Tonight', after - before, 2);
  }

  /*
   * The 400s this check causes ITSELF are the point of the launch probes
   * above — a pack id that does not exist. Anything else is a real error.
   */
  check('nothing threw', errors.filter((e) => !/favicon/i.test(e) && !/400 \(Bad Request\)/.test(e)), []);

  await browser.close();
  console.log(failures
    ? `\n${failures} problem${failures === 1 ? '' : 's'}.\n`
    : '\nTonight offers real games, and can find every pack you hold.\n');
} finally {
  stop();
}

process.exit(failures ? 1 : 0);
