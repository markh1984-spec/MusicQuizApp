#!/usr/bin/env node
/**
 * DOES A BROKEN NIGHT WRITE ITSELF DOWN, AND CAN THE HOST COPY IT?
 *
 * The flight recorder (`src/flight.js`) exists so the report of a bad night
 * is one Copy button rather than an hour of questions. A recorder that misses
 * the failure it was built for is worse than none — it is believed — so this
 * drives the real server through the things that go wrong on a night and
 * reads the record back the way a quizmaster would:
 *
 *  - the boot and the self-test are on the record, and the self-test PASSED
 *    on this instance (`/health` says so too);
 *  - a launch is written down; a launch REFUSED over a live room (409) is
 *    written down WITH ITS REASON, under that room;
 *  - a press the engine turned down (reveal at the lobby) is written down;
 *  - what a PHONE reports lands under the room its join code names;
 *  - the console's own script throwing lands under the quizmaster's room —
 *    the browser-side listener in `client.js`, exercised in a real browser;
 *  - another quizmaster's report shows NONE of it;
 *  - the Help tab draws the record, and Copy puts it on the clipboard.
 *
 * Verified by taking things away: with `res.flightRoom` unset the phone's
 * line files under nobody and the room check fails; with the listener gone
 * the synthetic throw never arrives.
 */

import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { startApp } from './helpers/live-app.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const EMAIL = 'qm@example.com';
const OTHER = 'other@example.com';
const PASSWORD = 'quizmaster passphrase';
let fails = 0;
const check = (name, ok, note = '') => { if (!ok) fails += 1; console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${!ok && note ? `\n        ${note}` : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { base: BASE, stop } = await startApp({
  key: 'flightkey',
  async seed(dir) {
    const { Accounts } = await import(new URL('../src/accounts.js', import.meta.url).href);
    const book = new Accounts(path.join(dir, 'accounts.json'));
    book.create({ email: EMAIL, password: PASSWORD, name: 'Quizzy', role: 'quizmaster', tier: 'gold', status: 'active' });
    book.create({ email: OTHER, password: PASSWORD, name: 'Somebody Else', role: 'quizmaster', tier: 'gold', status: 'active' });
    book.create({ email: 'owner@example.com', password: PASSWORD, name: 'The Owner', role: 'owner', status: 'active' });
    book.save();
  },
});

async function signIn(email) {
  const res = await fetch(`${BASE}/api/sign-in`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD }) });
  const cookie = (res.headers.get('set-cookie') || '').split(';')[0];
  return { cookie, H: { 'content-type': 'application/json', cookie } };
}
const post = (url, body, headers) => fetch(`${BASE}${url}`, { method: 'POST', headers, body: JSON.stringify(body) });
const record = async (H) => (await fetch(`${BASE}/api/flight`, { headers: H })).json();

console.log('\nTHE FLIGHT RECORDER — does a broken night write itself down?\n');
let browser;
try {
  // Give the boot-time self-test its second.
  await sleep(1800);
  const health = await (await fetch(`${BASE}/health`)).json();
  check('/health carries the self-test', health.selfTest && typeof health.selfTest.ok === 'boolean', JSON.stringify(health));
  check('and the self-test PASSED on this instance', health.selfTest && health.selfTest.ok, JSON.stringify(health.selfTest));

  const me = await signIn(EMAIL);
  const lib = await (await fetch(`${BASE}/api/library`, { headers: me.H })).json();
  const code = lib.running.joinCode;
  const packId = (lib.games || []).flatMap((g) => g.packs || []).find((p) => p && p.id)?.id || 'intros-2006';

  // A launch, a phone, then a launch refused over the live room.
  const launched = await post('/api/host/launch', { game: 'quiz', packId }, me.H);
  check('a quiz launches', launched.status === 200, `answered ${launched.status}`);
  const joined = await (await post('/api/join', { name: 'Table Nine', joinCode: code }, { 'content-type': 'application/json' })).json();
  check('a phone joins the room', Boolean(joined.id), JSON.stringify(joined));
  const again = await post('/api/host/launch', { game: 'quiz', packId }, me.H);
  check('a second launch over the live room is refused (409)', again.status === 409, `answered ${again.status}`);
  // A press the engine turns down.
  const reveal = await (await post('/api/host/reveal', {}, me.H)).json();
  check('reveal at the lobby is refused by the engine', reveal.ok === false, JSON.stringify(reveal).slice(0, 120));
  // What a phone saw.
  const phoneSaid = await post('/api/flight', { kind: 'phone', page: '/play', msg: 'TypeError: guard synthetic phone fault', data: 'play.js:1', joinCode: code }, { 'content-type': 'application/json' });
  check('a phone can report what it saw', phoneSaid.status === 200, `answered ${phoneSaid.status}`);

  const mine = await record(me.H);
  const text = mine.text || '';
  const has = (s) => text.includes(s);
  check('the boot is on the record', has(' boot '), text.slice(0, 400));
  check('the self-test verdict is on the record', /selftest .*passed \d+ steps/.test(text), text);
  check('the launch is written down', has('Launched quiz'), text);
  check('the refused launch is written down WITH its reason, under the room', new RegExp(`409 POST /api/host/launch.*is running right now`).test(text) && text.includes(`[${mine.room}] 409`), text);
  check('the refused press is written down', has('reveal refused'), text);
  check("the phone's report lands under this room", text.includes(`[${mine.room}] /play TypeError: guard synthetic phone fault`), text);
  check('the record reads as a night — a phase line', has('phase') && has('lobby'), text);
  check('every room-tagged line is THIS room', mine.entries.every((e) => !e.room || e.room === mine.room), JSON.stringify(mine.entries.filter((e) => e.room && e.room !== mine.room)));

  // Somebody else sees none of it.
  const other = await signIn(OTHER);
  const theirs = await record(other.H);
  check('another quizmaster sees none of this room', !(theirs.text || '').includes('Launched quiz') && !(theirs.text || '').includes('guard synthetic'), theirs.text);
  check('but still sees the boot and the self-test', (theirs.text || '').includes(' boot ') && (theirs.text || '').includes('selftest'), theirs.text);

  // The owner reaches a named quizmaster's record — the whole point of the ask.
  const owner = await signIn('owner@example.com');
  const ownerReadsQm = await (await fetch(`${BASE}/api/flight?account=${encodeURIComponent(mine.room)}`, { headers: owner.H })).json();
  check("the owner reads a named quizmaster's record", (ownerReadsQm.text || '').includes('Launched quiz') && ownerReadsQm.room === mine.room, JSON.stringify(ownerReadsQm).slice(0, 200));
  check('and it names whose it is', Boolean(ownerReadsQm.who), ownerReadsQm.who);
  const ownerAll = await (await fetch(`${BASE}/api/flight?all=1`, { headers: owner.H })).json();
  check('the owner can read the whole server', (ownerAll.text || '').includes('guard synthetic phone fault'), ownerAll.text);
  const qmCannotReach = await (await fetch(`${BASE}/api/flight?account=${encodeURIComponent('other')}`, { headers: (await signIn(OTHER)).H })).json();
  check('a quizmaster naming another account is ignored, not obeyed', !(qmCannotReach.text || '').includes('Launched quiz'), qmCannotReach.text);

  // The console in a real browser: its own throw is reported, and the Help tab draws and copies the record.
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  const [cookieName, cookieValue] = me.cookie.split('=');
  const url = new URL(BASE);
  await context.addCookies([{ name: cookieName, value: decodeURIComponent(cookieValue), domain: url.hostname, path: '/' }]);
  const page = await context.newPage();
  await page.goto(`${BASE}/console?door=account&tab=help`, { waitUntil: 'load' });
  await page.waitForSelector('.flight-panel .flight-text', { timeout: 15000 });
  await page.waitForFunction(() => /Launched quiz/.test(document.querySelector('.flight-panel .flight-text').textContent), null, { timeout: 15000 });
  check('the Help tab draws the record', await page.$eval('.flight-panel .flight-text', (el) => /Launched quiz/.test(el.textContent)));
  check('the panel says the self-test passed', await page.$eval('.flight-panel .flight-self', (el) => /passed \d+ steps/.test(el.textContent)));

  // A throw in the console's own script, after load — the window listener in client.js.
  await page.evaluate(() => setTimeout(() => { throw new Error('guard synthetic console fault'); }, 0));
  await sleep(600);
  const after = await record(me.H);
  check("the console's own throw is written down under this room", new RegExp(`\\[${mine.room}\\] /console .*guard synthetic console fault`).test(after.text || ''), after.text);

  // Copy.
  await page.click('.flight-panel .flight-refresh');
  await page.waitForFunction(() => /guard synthetic console fault/.test(document.querySelector('.flight-panel .flight-text').textContent), null, { timeout: 10000 });
  await page.click('.flight-panel .flight-copy');
  await page.waitForFunction(() => /Copied|Selected/.test(document.querySelector('.flight-panel .flight-said').textContent), null, { timeout: 5000 });
  const said = await page.$eval('.flight-panel .flight-said', (el) => el.textContent);
  const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ''));
  check('Copy puts the record on the clipboard', said.startsWith('Copied') && clip.includes('Launched quiz') && clip.includes('guard synthetic console fault'), `${said} / ${clip.slice(0, 200)}`);
  check('and the copied text names the app and the host', clip.startsWith('Quizporium — what the app saw'), clip.slice(0, 80));

  const shot = process.env.FLIGHT_SHOT;
  if (shot) {
    fs.mkdirSync(path.dirname(shot), { recursive: true });
    const panel = await page.$('.flight-panel');
    await panel.scrollIntoViewIfNeeded();
    await panel.screenshot({ path: shot });
    console.log(`  shot  ${shot}`);
  }
} catch (err) {
  fails += 1;
  console.log('  FAIL threw:', err.stack || err.message);
} finally {
  if (browser) await browser.close();
  await stop();
}

console.log(fails ? `\n${fails} FAILED\n` : '\nALL GOOD — a broken night writes itself down, and the host can copy it.\n');
process.exit(fails ? 1 : 0);
