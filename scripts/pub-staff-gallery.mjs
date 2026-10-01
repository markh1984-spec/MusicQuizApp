#!/usr/bin/env node
/**
 * A PUB'S STAFF, SIGNED IN TO THAT PUB'S PHOTOGRAPHS AND NOTHING ELSE.
 *
 *   node scripts/pub-staff-gallery.mjs
 *
 * The host, 1 October 2026: Evie and Tabby at the Station Tap get their own
 * logins — a username and a password he sets, which they can change — to save
 * the pub's photos with his name on them, square or Story, and *"only have
 * access to the gallery"*.
 *
 * Driven as REAL accounts, never the host key: the owner, his own quizmaster
 * hat (the only account allowed to make one, *"just me for now"*) and another
 * quizmaster who must not be. Then a fresh browser as the barmaid: sign in,
 * only her pub's night, save both shapes, change the password — and every
 * door she should not have, knocked on.
 */
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startApp } from './helpers/live-app.mjs';
import { playwright } from './helpers/playwright.mjs';

const { chromium } = playwright();
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TAP = 'The Station Tap, Wokingham';
const CROWN = 'The Crown';
const TAP_NIGHT = '2026-09-24';
const CROWN_NIGHT = '2026-09-17';
const PW = 'quizmaster passphrase';
let fails = 0;
const check = (name, ok, note = '') => { if (!ok) fails += 1; console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${note ? `  — ${note}` : ''}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// `SHOT_DIR=… node scripts/pub-staff-gallery.mjs` keeps a picture of each screen.
const SHOTS = process.env.SHOT_DIR || '';
const shot = async (page, name, sel) => { if (!SHOTS) return; const el = sel ? page.locator(sel).first() : page; await el.screenshot({ path: join(SHOTS, name) }).catch(() => {}); };

const repo = mkdtempSync(join(tmpdir(), 'staff-gh-'));
let ids = {};
const app = await startApp({
  key: 'pub-staff-gallery',
  nodeArgs: ['--import', join(ROOT, 'test', 'helpers', 'photo-repo-stub.mjs')],
  env: { GH_STUB_DIR: repo, PHOTO_REPO: 'a/b', PHOTO_TOKEN: 'stub' },
  async seed(dir) {
    const { Accounts } = await import('../src/accounts.js');
    const b = new Accounts(join(dir, 'accounts.json'));
    const owner = b.create({ email: 'owner@example.com', password: PW, name: 'Mark', role: 'owner' });
    const mine = b.create({ email: 'qm@example.com', password: PW, name: 'Mark', role: 'quizmaster', tier: 'gold', comped: true, ownedBy: owner.id });
    const other = b.create({ email: 'other@example.com', password: PW, name: 'Rival', role: 'quizmaster', tier: 'gold', status: 'active' });
    ids = { owner: owner.id, mine: mine.id, other: other.id };
    b.save();
  },
});
const B = app.base;
const signIn = async (email) => (await fetch(`${B}/api/sign-in`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PW }) })).headers.get('set-cookie').split(';')[0];
let browser;
try {
  const cookie = await signIn('qm@example.com');
  const H = { 'Content-Type': 'application/json', Cookie: cookie };
  const roomId = (await (await fetch(`${B}/api/me`, { headers: H })).json()).account.id;

  browser = await chromium.launch();
  const maker = await browser.newPage();
  await maker.goto(`${B}/`);
  const { jpeg, overlay } = await maker.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 1200; c.height = 900;
    const x = c.getContext('2d'); x.fillStyle = '#2f6fff'; x.fillRect(0, 0, 1200, 900);
    const o = document.createElement('canvas'); o.width = 1080; o.height = 1080; const ox = o.getContext('2d');
    ox.fillStyle = 'rgba(20,16,40,0.95)'; ox.fillRect(0, 960, 1080, 120);
    return { jpeg: c.toDataURL('image/jpeg', 0.9).split(',')[1], overlay: o.toDataURL('image/png') };
  });
  await maker.close();
  const mkVenue = async (name, extra) => {
    const mk = await (await fetch(`${B}/api/invoices/customers`, { method: 'POST', headers: H, body: JSON.stringify({ name }) })).json();
    const v = (mk.customers || []).find((c) => c.name === name);
    await fetch(`${B}/api/invoices/customers/${encodeURIComponent(v.id)}/rewards`, { method: 'PUT', headers: H, body: JSON.stringify({ rewards: ['A pint'], ...extra }) });
    return v;
  };
  const tap = await mkVenue(TAP, { overlay, usualNight: 'thu' });
  const crown = await mkVenue(CROWN, {});
  const arc = join(app.data, 'rooms', roomId, 'archive'); mkdirSync(arc, { recursive: true });
  writeFileSync(join(arc, 'n1.json'), JSON.stringify({ id: 'n1', kind: 'quiz', quizTitle: '2006', packId: '2006', archivedAt: Date.parse(`${TAP_NIGHT}T21:30:00Z`), venue: TAP, venueId: tap.id, leaderboard: [] }));
  writeFileSync(join(arc, 'n2.json'), JSON.stringify({ id: 'n2', kind: 'quiz', quizTitle: '2006', packId: '2006', archivedAt: Date.parse(`${CROWN_NIGHT}T21:30:00Z`), venue: CROWN, venueId: crown.id, leaderboard: [] }));
  for (const [night, names] of [[TAP_NIGHT, ['h1abc.jpg', 'u2abc-picked.jpg']], [CROWN_NIGHT, ['h9abc.jpg']]]) {
    const dir = join(repo, 'photos', roomId, night); mkdirSync(dir, { recursive: true });
    for (const n of names) writeFileSync(join(dir, n), Buffer.from(jpeg, 'base64'));
  }
  if (!await app.restart({ hard: false })) throw new Error('the server did not come back');

  console.log('\nTHE HOST MAKES TWO LOGINS ON THE STATION TAP\'S CARD (Community > Venues)');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await ctx.addCookies([{ name: cookie.split('=')[0], value: cookie.split('=').slice(1).join('='), url: B }]);
  const con = await ctx.newPage();
  const errors = [];
  con.on('pageerror', (e) => errors.push(`console: ${String(e.message).slice(0, 140)}`));
  await con.goto(`${B}/console?door=community`, { waitUntil: 'load' });
  await wait(2000);
  await con.evaluate(() => document.querySelector('[data-tab="venues"]')?.click());
  await wait(1500);
  await con.evaluate((name) => [...document.querySelectorAll('button.venue-name')].find((b) => b.textContent.includes(name))?.click(), TAP);
  await wait(1500);
  const panel = await con.locator('.venue-card.open .venue-logins-in').count();
  check('the open card has a Gallery logins panel', panel === 1, `${panel}`);
  for (const [user, pass] of [['Tabby', 'tabby test password'], ['Evie', 'evie test password']]) {
    await con.fill('.venue-card.open .vl-user', user);
    await con.fill('.venue-card.open .vl-pass', pass);
    await con.click('.venue-card.open .vl-add button');
    await wait(1200);
  }
  const listed = await con.$$eval('.venue-card.open .vl-name', (n) => n.map((x) => x.textContent.trim()));
  check('both are listed on the card', listed.includes('Tabby') && listed.includes('Evie'), JSON.stringify(listed));
  await shot(con, 'logins-on-the-card.png', '.venue-card.open');
  const said = await con.$eval('.venue-card.open .vl-said', (n) => n.textContent.trim());
  check('it says it was added', /Added Evie/.test(said), said);
  check('and the book is backed up to the private repository', existsSync(join(repo, 'gallery-logins.json'))
    && /Tabby/.test(readFileSync(join(repo, 'gallery-logins.json'), 'utf8')));
  const weak = await (await fetch(`${B}/api/venue-logins`, { method: 'POST', headers: H, body: JSON.stringify({ venueId: tap.id, username: 'Shorty', password: 'short' }) })).json();
  check('a password under 8 is refused, in words', /at least 8/.test(weak.error || ''), weak.error);

  console.log('\nNOBODY ELSE MAY MAKE ONE');
  const other = await signIn('other@example.com');
  const theirs = await fetch(`${B}/api/venue-logins?venue=x`, { headers: { Cookie: other } });
  check('another quizmaster is refused', theirs.status === 403, String(theirs.status));
  const sneak = await fetch(`${B}/api/venue-logins`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: other }, body: JSON.stringify({ venueId: tap.id, username: 'Sneaky', password: 'a long enough one' }) });
  check('and cannot make one on the host\'s pub', sneak.status === 403, String(sneak.status));
  const anon = await fetch(`${B}/api/venue-logins?venue=${tap.id}`);
  check('nor can nobody', anon.status === 403, String(anon.status));

  console.log('\nTABBY, ON HER OWN PHONE');
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const p = await phone.newPage();
  p.on('pageerror', (e) => errors.push(`venue page: ${String(e.message).slice(0, 140)}`));
  await p.goto(`${B}/venue-photos`, { waitUntil: 'load' });
  await wait(800);
  check('a sign-in form, username and password', await p.locator('.vp-form input[name=username]').count() === 1);
  await shot(p, 'staff-sign-in.png');
  await p.fill('input[name=username]', 'tabby');
  await p.fill('input[name=password]', 'the wrong one');
  await p.click('.vp-form button');
  await wait(900);
  check('a wrong password is said', /do not match/.test(await p.$eval('.vp-said', (n) => n.textContent)));
  await p.fill('input[name=password]', 'tabby test password');
  await p.click('.vp-form button');
  await wait(1800);
  check('signed in, her pub is the heading', (await p.$eval('#vpTitle', (n) => n.textContent)) === TAP);
  const nights = await p.$$eval('.vp-night > summary', (n) => n.map((x) => x.textContent.trim()));
  check('ONE night — the Station Tap\'s, not The Crown\'s', nights.length === 1 && /24 September/.test(nights[0]), JSON.stringify(nights));
  await wait(800);
  const shots = await p.locator('.vp-night .gal-shot').count();
  check('every photo from it, unreviewed ones included', shots === 2, `${shots}`);
  const loaded = await p.$$eval('.vp-night .gal-shot img', (imgs) => imgs.every((i) => i.complete && i.naturalWidth > 0));
  check('and the pictures load', loaded);
  await shot(p, 'staff-signed-in.png');
  await p.locator('.vp-night .gal-shot').first().click();
  await wait(700);
  const btns = await p.$$eval('.gal-big .gal-save', (b) => b.map((x) => x.textContent.trim()));
  await shot(p, 'staff-photo-open.png');
  check('an opened photo offers the square and the Story', JSON.stringify(btns) === JSON.stringify(['Save square', 'Save as a Story']), JSON.stringify(btns));
  const measure = async (dl) => {
    const to = join(repo, `dl-${Date.now()}.jpg`); await dl.saveAs(to);
    return p.evaluate(async (b64) => { const i = new Image(); await new Promise((r) => { i.onload = r; i.src = `data:image/jpeg;base64,${b64}`; }); return [i.naturalWidth, i.naturalHeight]; }, readFileSync(to).toString('base64'));
  };
  for (const [label, want] of [['Save square', (w, h) => w === h], ['Save as a Story', (w, h) => w === 1080 && h === 1920]]) {
    const dl = p.waitForEvent('download', { timeout: 15000 }).catch(() => null);
    await p.locator('.gal-big .gal-save', { hasText: label }).click();
    const got = await dl;
    const size = got ? await measure(got) : null;
    check(`${label} saves the right shape`, size && want(...size), JSON.stringify(size));
    await wait(2600);
  }
  await p.keyboard.press('Escape');

  console.log('\nTHE DOORS SHE MUST NOT HAVE');
  const herCookie = (await phone.cookies()).find((c) => c.name === 'mqz_gallery');
  const HC = { Cookie: `mqz_gallery=${herCookie.value}` };
  const st = async (path) => (await fetch(`${B}${path}`, { headers: HC })).status;
  check('the console\'s library: not signed in', await st('/api/library') === 401, String(await st('/api/library')));
  check('her quizmaster\'s Past gigs: refused', [401, 403].includes(await st('/api/past-gigs')), String(await st('/api/past-gigs')));
  check('the other pub\'s night: not hers', await st(`/api/venue-photos/night/${CROWN_NIGHT}`) === 404);
  check('the other pub\'s photo, by its real name: not hers', await st(`/venue-photo/${CROWN_NIGHT}/h9abc.jpg`) === 404);
  check('the console\'s own photo route: refused', [401, 403].includes(await st(`/past-photo/${TAP_NIGHT}/h1abc.jpg`)));
  check('the logins list: refused', await st(`/api/venue-logins?venue=${tap.id}`) === 403);

  console.log('\nSHE CHANGES HER PASSWORD');
  await p.click('#vpWho button:has-text("Change password")');
  await p.fill('.vp-pw input[name=current]', 'not it');
  await p.fill('.vp-pw input[name=next]', 'a brand new password');
  await p.click('.vp-pw button[type=submit]');
  await wait(900);
  check('the wrong current password is said', /not right/.test(await p.$eval('.vp-pw .vp-said', (n) => n.textContent)));
  await p.fill('.vp-pw input[name=current]', 'tabby test password');
  await p.fill('.vp-pw input[name=next]', 'a brand new password');
  await p.click('.vp-pw button[type=submit]');
  await wait(1200);
  check('changed', /Changed/.test(await p.$eval('.vp-pw .vp-said', (n) => n.textContent)));
  const oldPw = await fetch(`${B}/api/venue-photos/sign-in`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'Tabby', password: 'tabby test password' }) });
  check('the old password no longer works', oldPw.status === 401, String(oldPw.status));
  const newPw = await fetch(`${B}/api/venue-photos/sign-in`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'Tabby', password: 'a brand new password' }) });
  check('the new one does', newPw.status === 200, String(newPw.status));

  console.log('\nTHE HOST REMOVES HER');
  await con.reload({ waitUntil: 'load' });
  await wait(1800);
  await con.evaluate(() => document.querySelector('[data-tab="venues"]')?.click());
  await wait(1200);
  const isOpen = await con.locator('.venue-card.open .vl-row').count();
  if (!isOpen) { await con.evaluate((name) => [...document.querySelectorAll('button.venue-name')].find((b) => b.textContent.includes(name))?.click(), TAP); await wait(1200); }
  const row = con.locator('.venue-card.open .vl-row', { hasText: 'Tabby' }).locator('.vl-off');
  await row.click(); await wait(200); await row.click(); await wait(1200);
  check('removed from the card', !(await con.$$eval('.venue-card.open .vl-name', (n) => n.map((x) => x.textContent.trim()))).includes('Tabby'));
  check('and her phone is signed out at once', await st('/api/venue-photos') === 401);
  check('nothing threw', errors.length === 0, errors.join(' | '));
} finally {
  if (browser) await browser.close();
  await app.stop();
}
console.log(fails ? `\n${fails} FAILED — a pub's staff login is not what it says` : '\nA pub\'s staff see their pub\'s photographs, save them for Instagram, and nothing else.');
process.exit(fails ? 1 : 0);
