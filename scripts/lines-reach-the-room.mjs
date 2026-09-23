#!/usr/bin/env node
/**
 * WHICH LINES PAY — chosen on the bar, and does the ROOM play them?
 *
 *   node scripts/lines-reach-the-room.mjs
 *
 * *"I select 3 and then select lines 2, 3 and full house."* The engine could
 * always play any list of stages; the choice has to travel from a dropdown in
 * the prize table through `setPickedBingo()`, `doLaunch()`, the running
 * order's segments, a saved show, the launch route and `session.launch()` —
 * EIGHT places that each name the fields they carry, which is the whitelist
 * trap this repo has sprung six times already: a field missing from any one of
 * them is dropped in silence and the room plays the default. So this presses
 * the real controls and reads the room, three ways:
 *
 *  1. bingo on its own — the one-game launch, off `night.*`;
 *  2. bingo leading a running order — the segments, off the slots;
 *  3. that running order SAVED, reloaded and launched again — the show.
 *
 * Between 2 and 3 the room is put back on the default plan through the API, so
 * the third check cannot pass on what the second one left behind.
 */
import { startApp } from './helpers/live-app.mjs';
import { playwright } from './helpers/playwright.mjs';

const { chromium } = playwright();
const KEY = 'linesvsroom';

let failures = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures += 1;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}`);
  if (!ok) console.log(`        wanted ${JSON.stringify(want)}\n        got    ${JSON.stringify(got)}`);
};
const wait = (page, ms) => page.waitForTimeout(ms);

/** A venue with prizes, picked — Launch stands down without one. */
async function aVenue(page, base) {
  await page.goto(`${base}/console?key=${KEY}`, { waitUntil: 'load' });
  await wait(page, 1800);
  await page.evaluate(async (key) => {
    const H = { 'Content-Type': 'application/json', 'X-Host-Key': key };
    const mk = await fetch('/api/invoices/customers', { method: 'POST', headers: H, body: JSON.stringify({ name: 'The Wet Arms' }) });
    const c = ((await mk.json()).customers || []).find((x) => x.name === 'The Wet Arms');
    await fetch(`/api/invoices/customers/${encodeURIComponent(c.id)}/rewards`, {
      method: 'PUT', headers: H, body: JSON.stringify({ rewards: ['A pint', 'A half', 'Crisps', 'A pint', 'A half'] }),
    });
  }, KEY);
  await page.reload({ waitUntil: 'load' });
  await wait(page, 1800);
  await pickTheVenue(page);
}

async function pickTheVenue(page) {
  await page.evaluate(async () => {
    document.querySelector('.lb-where')?.click();
    await new Promise((r) => setTimeout(r, 500));
    [...document.querySelectorAll('.lb-venues button')].find((b) => /Wet Arms/.test(b.textContent))?.click();
  });
  await wait(page, 900);
}

/** Tap the first pack on a tab — the tap puts it in Tonight. */
async function tapAPack(page, tab) {
  await page.evaluate((t) => document.querySelector(`button.tab[data-tab="${t}"]`)?.click(), tab);
  await page.waitForSelector('.pack-card[data-pack]');
  await wait(page, 500);
  const id = await page.evaluate(() => {
    const card = document.querySelector('.pack-card[data-pack]');
    card?.click();
    return card ? card.dataset.pack : '';
  });
  await wait(page, 1300);
  return id;
}

/** The settings row: a 5x5 card and three prizes, the way a host sets them. */
async function fiveByFiveThreePrizes(page) {
  return page.evaluate(async () => {
    const pause = () => new Promise((r) => setTimeout(r, 400));
    const shape = document.querySelector('.shape-pick');
    const prizes = document.querySelector('.prize-pick');
    if (!shape || !prizes) return 'no Card or Bingo prizes control on the bar';
    const five = [...shape.options].find((o) => /"rows":5,"cols":5/.test(o.value.replace(/\s/g, '')));
    if (!five) return 'no 5x5 on offer for this pack';
    shape.value = five.value;
    shape.dispatchEvent(new Event('change', { bubbles: true }));
    await pause();
    prizes.value = '3';
    prizes.dispatchEvent(new Event('change', { bubbles: true }));
    await pause();
    return 'ok';
  });
}

/** Open the prize table and say what each bingo prize row shows. */
async function bingoRows(page) {
  return page.evaluate(async () => {
    const head = document.querySelector('.lb-pz-head');
    if (!head) return { error: 'no prize table on the bar' };
    if (head.getAttribute('aria-expanded') !== 'true') head.click();
    await new Promise((r) => setTimeout(r, 400));
    const row = [...document.querySelectorAll('.lb-pz-row')]
      .find((r) => r.querySelector('.lb-pz-who')?.textContent.trim() === 'Bingo');
    if (!row) return { error: 'no Bingo row in the prize table' };
    return {
      part: row.dataset.part,
      rows: [...row.querySelectorAll('.lb-pz-box')].map((box) => {
        const pick = box.querySelector('.lb-pz-stage');
        return pick ? pick.options[pick.selectedIndex].textContent : box.querySelector('.lb-pz-stage-said')?.textContent;
      }),
    };
  });
}

/** Choose what wins one prize, with the real dropdown. */
async function choose(page, part, at, lines) {
  await page.selectOption(`.lb-pz-stage[data-part="${part}"][data-at="${at}"]`, String(lines));
  await wait(page, 300);
}

async function shutTheTable(page) {
  await page.evaluate(() => document.querySelector('.lb-pz-head')?.click());
  await wait(page, 500);
  return page.evaluate(() => (document.querySelector('.lb-prizes')?.innerText || '').replace(/\s+/g, ' ').trim());
}

/** Press Launch and hand back the body that left the browser. */
async function launch(page, bodies) {
  bodies.length = 0;
  await page.evaluate(() => {
    const go = [...document.querySelectorAll('button')].find((b) => /^Launch/.test(b.textContent.trim()));
    if (go) go.click();
  });
  await wait(page, 2000);
  return bodies.length ? JSON.parse(bodies[bodies.length - 1]) : null;
}

/** What the projector says the prizes are. */
async function roomPrizes(base) {
  const room = await (await fetch(`${base}/api/state?role=screen`)).json();
  return { kind: room.kind, prizes: (room.prizes || []).map((p) => p.label) };
}

function watch(page, bodies, errors) {
  page.on('pageerror', (e) => errors.push(String(e.message)));
  page.on('dialog', async (d) => { await (d.type() === 'prompt' ? d.accept('Lines night') : d.accept()); });
  page.on('request', (r) => {
    if (r.method() === 'POST' && /\/api\/host\/launch(Order)?\b/.test(r.url())) bodies.push(r.postData() || '');
  });
}

let browser;
const apps = [];
try {
  browser = await chromium.launch();

  // ------------------------------------------------ 1. bingo on its own
  console.log('\n1. BINGO ON ITS OWN — pick lines 2, 3 and a full house, press Launch\n');
  {
    const app = await startApp({ key: KEY });
    apps.push(app);
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    const bodies = [];
    const errors = [];
    watch(page, bodies, errors);
    await aVenue(page, app.base);
    await tapAPack(page, 'bingo');
    check('a 5x5 card and three prizes, set on the bar', await fiveByFiveThreePrizes(page), 'ok');

    const before = await bingoRows(page);
    check('the table offers a line, 2 lines, and SAYS the full house',
      before.rows || before.error, ['a line', '2 lines', 'a full house']);
    await choose(page, before.part, 0, 2);
    const after = await bingoRows(page);
    check('choosing 2 lines for the first moves the second up to 3',
      after.rows || after.error, ['2 lines', '3 lines', 'a full house']);
    const named = await page.evaluate(() => document.querySelector('.prize-pick option[value="3"]')?.textContent || '');
    check('the Bingo prizes dropdown names the same lines', named, '3 — 2 lines, then 3 lines, then a full house');
    const ledger = await shutTheTable(page);
    check('the shut ledger says what wins each prize', ['2 lines', '3 lines', 'a full house'].every((w) => ledger.includes(w)), true);

    const sent = await launch(page, bodies);
    check('Launch sent the lines', sent && sent.stages, [2, 3, 'full']);
    check('and the ROOM plays them', await roomPrizes(app.base),
      { kind: 'bingo', prizes: ['2 lines', '3 lines', 'a full house'] });
    check('nothing threw', errors.join(' | ') || 'none', 'none');
    await page.close();
  }

  // ------------------------------------------ 2. bingo leading a running order
  console.log('\n2. BINGO THEN A QUIZ — the running order, off the slots\n');
  const app = await startApp({ key: KEY });
  apps.push(app);
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const bodies = [];
  const errors = [];
  watch(page, bodies, errors);
  await aVenue(page, app.base);
  await tapAPack(page, 'bingo');
  await tapAPack(page, 'quiz');
  const kinds = await page.evaluate(() => [...document.querySelectorAll('.lb-tiles .lb-tile.is-pack')].length);
  check('Tonight holds the bingo and the quiz', kinds >= 2, true);
  check('a 5x5 card and three prizes, set on the bar', await fiveByFiveThreePrizes(page), 'ok');
  const mixed = await bingoRows(page);
  check('the bingo part has its own row in the table', mixed.error || 'ok', 'ok');
  // The other example: the SECOND prize moved, the first left alone.
  if (!mixed.error) await choose(page, mixed.part, 1, 4);
  const chosen = await bingoRows(page);
  check('choosing 4 lines for the second leaves the first where it was',
    chosen.rows || chosen.error, ['a line', '4 lines', 'a full house']);
  await shutTheTable(page);

  // SAVED BEFORE THE LAUNCH, so part 3 has a show to load.
  await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Save')?.click());
  await wait(page, 1500);
  const shows = await page.evaluate(async (key) => ((await (await fetch(`/api/library?key=${key}`)).json()).shows || []), KEY);
  const kept = shows.find((s) => s.name === 'Lines night');
  check('the night was saved as a show', Boolean(kept), true);
  const keptBingo = kept && (kept.items || []).find((i) => i.kind === 'bingo');
  check('and the show kept the lines on its bingo part', keptBingo && keptBingo.stages, [1, 4, 'full']);

  const sentOrder = await launch(page, bodies);
  const seg = sentOrder && (sentOrder.segments || []).find((s) => s.kind === 'bingo');
  check('Launch sent the lines on the bingo segment', seg && seg.stages, [1, 4, 'full']);
  check('and the ROOM plays them', await roomPrizes(app.base),
    { kind: 'bingo', prizes: ['a line', '4 lines', 'a full house'] });

  // ------------------------------------------------------ 3. the show, loaded
  console.log('\n3. THE SAVED SHOW, LOADED BACK AND LAUNCHED\n');
  // Back to the default plan first, so this cannot pass on what part 2 left.
  const reset = await fetch(`${app.base}/api/host/launch?key=${KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Host-Key': KEY },
    body: JSON.stringify({ game: 'bingo', packId: keptBingo ? keptBingo.packId : '', prizes: 3, shape: { rows: 5, cols: 5 }, replace: true }),
  });
  check('the room is put back on the default plan', (await roomPrizes(app.base)).prizes,
    reset.ok ? ['a line', '2 lines', 'a full house'] : ['(reset refused)']);

  await page.goto(`${app.base}/console?door=workshop&key=${KEY}`, { waitUntil: 'load' });
  await wait(page, 1800);
  await page.evaluate(() => document.querySelector('button.tab[data-tab="shows"]')?.click());
  await wait(page, 600);
  await page.evaluate(() => [...document.querySelectorAll('.show-card')].find((c) => /Lines night/.test(c.textContent))?.click());
  await wait(page, 1500);
  await pickTheVenue(page);
  const sentShow = await launch(page, bodies);
  const showSeg = sentShow && (sentShow.segments || []).find((s) => s.kind === 'bingo');
  check('the loaded show sent the lines', showSeg ? showSeg.stages : (sentShow && sentShow.stages), [1, 4, 'full']);
  check('and the ROOM plays them again', await roomPrizes(app.base),
    { kind: 'bingo', prizes: ['a line', '4 lines', 'a full house'] });
  check('nothing threw', errors.join(' | ') || 'none', 'none');

  console.log(failures
    ? `\n${failures} check${failures === 1 ? '' : 's'} failed — the lines chosen on the bar are not the lines the room plays.\n`
    : '\nThe lines chosen on the bar are the lines the room plays — alone, in a running order, and from a saved show.\n');
  process.exitCode = failures ? 1 : 0;
} catch (err) {
  console.error('\nthrew:', err.message, '\n');
  process.exitCode = 1;
} finally {
  try { await browser?.close(); } catch { /* already gone */ }
  for (const app of apps) await app.stopAndWait();
}
