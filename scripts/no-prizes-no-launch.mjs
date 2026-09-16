/**
 * NOBODY WINS A BLANK PHONE — Launch stands down when there are no prizes.
 *
 * ---
 *
 * Asked for on 16 September 2026, after a night where the winners got no QR
 * code: *"can I have a default prize list in case the venue prize list isn't
 * available? Or perhaps a prompt that doesn't allow me to launch without
 * prizes?"* — and he chose the block, with the fix named in the same warning.
 *
 * Prizes are read off the venue record at LAUNCH and nowhere else, so a night
 * with no venue, or a venue with an empty list, mints no voucher at all. A
 * warning had sat beside the button since that night and had not stopped it
 * happening: **a line next to a working button is a line you launch past.**
 *
 * **THE HALF THIS GUARD EXISTS FOR IS THE FAIL-OPEN.** `noPrizesReason()`
 * returns null for everything it is not certain about, because `venueRecords`
 * rides in with the library — so a slow fetch, a failed one, or a payload that
 * never carried the field must launch exactly as it always did. A missed
 * warning costs a voucher; a false block costs the evening, in a pub, ten
 * minutes before a room sits down, on the one button this project protects
 * above all others. Only one of those is recoverable.
 *
 * **AND IT DRIVES THE REAL BUTTON.** The first build put the check in
 * `paintGo()` alone — and `paintOrder()` sets the same button's words and
 * disabled state independently, which is the painter an ordinary night goes
 * through now that a pack bursts into a tile per round. It drew perfectly and
 * gated nothing. This caught it, five assertions at once, which is the whole
 * argument for pressing a control rather than reading a diff.
 *
 *     node scripts/no-prizes-no-launch.mjs
 */

import path from 'node:path';
import { createRequire } from 'node:module';
import { startApp } from '/home/user/MusicQuizApp/scripts/helpers/live-app.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const QM = { email: 'qm@example.com', password: 'quizmaster passphrase' };
const { base: BASE, stop } = await startApp({
  key: 'noprizes',
  async seed(dir) {
    const { Accounts } = await import('/home/user/MusicQuizApp/src/accounts.js');
    const b = new Accounts(path.join(dir, 'accounts.json'));
    b.create({ email: 'owner@example.com', password: 'owner passphrase here', name: 'Owner', role: 'owner', status: 'active' });
    b.create({ ...QM, name: 'Mark', role: 'quizmaster', tier: 'gold', status: 'active' });
    b.save();
  },
});
let fails = 0;
const check = (n, ok, d = '') => { if (!ok) fails += 1; console.log(`${ok ? '  ok  ' : '  FAIL'} ${n}${d ? `  — ${d}` : ''}`); };
/** The venue is a BUTTON and a sheet on this bar, never a <select>. */
async function pickVenue(page, name) {
  await page.locator('.lb-venue-btn, .lb-where, [class*="lb-venue"]').first().click().catch(() => {});
  await page.waitForTimeout(500);
  const row = page.locator('.lb-venue-list button', { hasText: name }).first();
  if (await row.count()) await row.click();
  await page.waitForTimeout(1200);
}

const browser = await chromium.launch();
try {
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 1100 } })).newPage();
  const boom = [];
  page.on('pageerror', (e) => boom.push(String(e.message)));
  await page.goto(`${BASE}/login`); await page.fill('input[type=email]', QM.email);
  await page.fill('input[type=password]', QM.password);
  await page.evaluate(() => document.querySelector('form')?.requestSubmit());
  await page.waitForTimeout(2500);
  await page.goto(`${BASE}/console`, { waitUntil: 'load' });
  await page.waitForSelector('.launchbar'); await page.waitForTimeout(1500);

  const go = () => page.evaluate(() => {
    const b = document.querySelector('.lb-go');
    return { text: (b.textContent || '').trim(), disabled: b.disabled };
  });

  // Put a pack in Tonight, with NO venue chosen.
  await page.locator('.pack-card').first().click();
  await page.waitForTimeout(900);
  const noVenue = await go();
  check('with no venue, Launch stands down', noVenue.disabled === true, JSON.stringify(noVenue));
  check('  ...and says how to fix it', /venue/i.test(noVenue.text), JSON.stringify(noVenue.text));

  // Make a venue WITHOUT prizes, pick it.
  // The create route answers with the whole invoice state, so the id is read
  // back off the customer list rather than guessed off the reply.
  const venueId = await page.evaluate(() => fetch('/api/invoices/customers', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'The Dry Arms' }),
  }).then((r) => r.json())
    .then((d) => ((d.customers || []).find((c) => c.name === 'The Dry Arms') || {}).id));
  await page.reload({ waitUntil: 'load' }); await page.waitForSelector('.launchbar'); await page.waitForTimeout(1500);
  await page.locator('.pack-card').first().click(); await page.waitForTimeout(900);
  await pickVenue(page, 'The Dry Arms');
  const dry = await go();
  check('a venue with NO prizes still stands Launch down', dry.disabled === true, JSON.stringify(dry));
  check('  ...and the button NAMES the pub and the fix', /Dry Arms/.test(dry.text) && /Venues tab/i.test(dry.text), JSON.stringify(dry.text));
  const warn = await page.locator('.lb-say-none').first().textContent().catch(() => '');
  check('  ...and the warning above carries the LINK', /Venues tab/i.test(warn || ''), JSON.stringify((warn || '').slice(0, 80)));

  // Now give that venue prizes — Launch must come back.
  await page.evaluate((id) => fetch(`/api/invoices/customers/${encodeURIComponent(id)}/rewards`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rewards: ['A pint', 'A half', 'A packet of crisps'] }),
  }).then((r) => r.json()), venueId);
  await page.reload({ waitUntil: 'load' }); await page.waitForSelector('.launchbar'); await page.waitForTimeout(1500);
  await page.locator('.pack-card').first().click(); await page.waitForTimeout(900);
  await pickVenue(page, 'The Dry Arms');
  const wet = await go();
  check('WITH prizes, Launch comes back', wet.disabled === false, JSON.stringify(wet));
  check('  ...and offers the night', /^Launch/i.test(wet.text), JSON.stringify(wet.text));

  // FAIL OPEN: venueRecords missing entirely must NOT block.
  const failOpen = await page.evaluate(async () => {
    const m = await import('/assets/console-warnings.js');
    return {
      unloaded: m.noPrizesReason('The Dry Arms', undefined),
      nullish: m.noPrizesReason('The Dry Arms', null),
      empty: m.noPrizesReason('The Dry Arms', []),
    };
  });
  check('an UNLOADED library never blocks a launch', failOpen.unloaded === null && failOpen.nullish === null,
    JSON.stringify(failOpen));
  check('  ...but a loaded, empty one does', typeof failOpen.empty === 'string', JSON.stringify(failOpen.empty));
  check('nothing threw', boom.length === 0, boom.join(' | '));
} finally { await browser.close(); await stop(); }
console.log(fails ? `\n${fails} FAILED` : '\nThe prize gate holds, and fails open.');
process.exit(fails ? 1 : 0);
