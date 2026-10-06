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
    // WAIT FOR THE REDRAW, NEVER A GUESS AT HOW LONG IT TAKES: on a busy
    // machine the second name was typed into a form the first one's redraw
    // then replaced, and the click sent it empty.
    await con.waitForFunction((u) => (document.querySelector('.venue-card.open .vl-said')?.textContent || '').includes(`Added ${u}`), user, { timeout: 15000 }).catch(() => {});
  }
  const listed = await con.$$eval('.venue-card.open .vl-name', (n) => n.map((x) => x.textContent.trim()));
  check('both are listed on the card', listed.includes('Tabby') && listed.includes('Evie'), JSON.stringify(listed));
  const before = await con.$$eval('.venue-card.open .vl-row', (rs) => rs.map((r) => r.textContent.replace(/\s+/g, ' ').trim()));
  check('each says it has not been used yet', before.every((t) => /Not signed in yet/.test(t)), JSON.stringify(before));
  const noAutocorrect = await con.$$eval('.venue-card.open .vl-add input', (is) => is.every((i) => i.getAttribute('autocorrect') === 'off' && i.getAttribute('spellcheck') === 'false'));
  check('autocorrect and spell-check are off on the password box (a phone turned one password into another)', noAutocorrect);
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
  // A PHOTO OPENS INTO ITS TWO INSTAGRAM SHAPES, each drawn, each with its own
  // button (2 October 2026). Headless Chromium has no share sheet, so the
  // button must say Download — "Share" there would be a lie.
  await p.waitForFunction(() => document.querySelectorAll('.vp-big .vp-prev img').length === 2, null, { timeout: 15000 }).catch(() => {});
  const opened = await p.evaluate(() => [...document.querySelectorAll('.vp-big .vp-opt')].map((f) => {
    const img = f.querySelector('.vp-prev img');
    const box = f.querySelector('.vp-prev').getBoundingClientRect();
    return { caption: f.querySelector('figcaption').textContent.trim(), button: f.querySelector('.vp-share').textContent.trim(),
      off: f.querySelector('.vp-share').disabled, w: img ? img.naturalWidth : 0, h: img ? img.naturalHeight : 0,
      shownW: Math.round(box.width), shownH: Math.round(box.height), right: Math.round(box.right) };
  }));
  await shot(p, 'staff-photo-open.png');
  check('an opened photo shows its square and its Story, drawn', opened.length === 2
    && opened[0].w === opened[0].h && opened[0].w > 0 && opened[1].w === 1080 && opened[1].h === 1920, JSON.stringify(opened));
  check('each with its own button, and it says what it will do here', opened.every((o) => o.button === 'Download' && !o.off), JSON.stringify(opened.map((o) => o.button)));
  check('both previews fit a phone, side by side', opened.every((o) => o.right <= 390 && o.shownW > 100), JSON.stringify(opened.map((o) => [o.shownW, o.shownH, o.right])));
  const measure = async (dl) => {
    const to = join(repo, `dl-${Date.now()}.jpg`); await dl.saveAs(to);
    return p.evaluate(async (b64) => { const i = new Image(); await new Promise((r) => { i.onload = r; i.src = `data:image/jpeg;base64,${b64}`; }); return [i.naturalWidth, i.naturalHeight]; }, readFileSync(to).toString('base64'));
  };
  for (const [which, want] of [['.vp-opt-square', (w, h) => w === h], ['.vp-opt-story', (w, h) => w === 1080 && h === 1920]]) {
    const dl = p.waitForEvent('download', { timeout: 15000 }).catch(() => null);
    await p.locator(`.vp-big ${which} .vp-share`).click();
    const got = await dl;
    const size = got ? await measure(got) : null;
    check(`${which === '.vp-opt-square' ? 'the square' : 'the Story'} downloads the right shape`, size && want(...size), JSON.stringify(size));
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
  // WAIT FOR THE ANSWER, NEVER A GUESSED PAUSE: a change runs a password hash
  // and the breach check, and on a busy machine 900ms was not enough.
  const saidBy = (re) => p.waitForFunction((src) => new RegExp(src).test(document.querySelector('.vp-pw .vp-said')?.textContent || ''), re.source, { timeout: 20000 }).then(() => true, () => false);
  await p.click('.vp-pw button[type=submit]');
  check('the wrong current password is said', await saidBy(/not right/));
  await p.fill('.vp-pw input[name=current]', 'tabby test password');
  await p.fill('.vp-pw input[name=next]', 'a brand new password');
  await p.click('.vp-pw button[type=submit]');
  check('changed', await saidBy(/Changed/));
  const oldPw = await fetch(`${B}/api/venue-photos/sign-in`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'Tabby', password: 'tabby test password' }) });
  check('the old password no longer works', oldPw.status === 401, String(oldPw.status));
  const newPw = await fetch(`${B}/api/venue-photos/sign-in`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'Tabby', password: 'a brand new password' }) });
  check('the new one does', newPw.status === 200, String(newPw.status));

  console.log('\nTHE HOST SEES WHEN SHE USED IT, AND SETS EVIE A NEW PASSWORD');
  await con.reload({ waitUntil: 'load' });
  await wait(1800);
  await con.evaluate(() => document.querySelector('[data-tab="venues"]')?.click());
  await wait(1200);
  const isOpen = await con.locator('.venue-card.open .vl-row').count();
  if (!isOpen) { await con.evaluate((name) => [...document.querySelectorAll('button.venue-name')].find((b) => b.textContent.includes(name))?.click(), TAP); await wait(1200); }
  const tabbyRow = (await con.locator('.venue-card.open .vl-row', { hasText: 'Tabby' }).textContent()).replace(/\s+/g, ' ');
  check('Tabby\'s row says she signed in today', /Signed in today \d\d:\d\d/.test(tabbyRow), tabbyRow);
  const evieRow = (await con.locator('.venue-card.open .vl-row', { hasText: 'Evie' }).textContent()).replace(/\s+/g, ' ');
  check('Evie\'s still says not yet', /Not signed in yet/.test(evieRow), evieRow);
  await shot(con, 'logins-activity.png', '.venue-card.open .venue-logins-in');
  // THE CONSOLE CAN REDRAW THE CARD UNDER A HALF-TYPED BOX — a library
  // refresh rebuilds it — so wait for each piece rather than for a guessed
  // time, and if the box went before it was sent, open it and send again.
  const setEvie = async () => {
    await con.locator('.venue-card.open .vl-row', { hasText: 'Evie' }).locator('.vl-new').click();
    await con.waitForSelector('.venue-card.open .vl-set input', { timeout: 5000 }).catch(() => {});
    await con.fill('.venue-card.open .vl-set input', 'evie second password').catch(() => {});
    await con.click('.venue-card.open .vl-set button', { timeout: 5000 }).catch(() => {});
    return con.waitForFunction(() => /New password set for Evie/.test(document.querySelector('.venue-card.open .vl-said')?.textContent || ''), null, { timeout: 8000 }).then(() => true, () => false);
  };
  const setOk = (await setEvie()) || (await setEvie());
  check('the card says the new password is set', setOk);
  const evieOld = await fetch(`${B}/api/venue-photos/sign-in`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'Evie', password: 'evie test password' }) });
  const evieNew = await fetch(`${B}/api/venue-photos/sign-in`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'Evie', password: 'evie second password' }) });
  check('Evie\'s old password stops working and the new one works', evieOld.status === 401 && evieNew.status === 200, `${evieOld.status} / ${evieNew.status}`);
  const otherSets = await fetch(`${B}/api/venue-logins/x/password`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: other }, body: JSON.stringify({ password: 'a long enough one' }) });
  check('another quizmaster cannot set one', otherSets.status === 403, String(otherSets.status));

  console.log('\nTHE HOST GIVES EVIE BLOCKYARD AND TABBY WALKIES');
  const gameOf = async (who) => con.locator('.venue-card.open .vl-row', { hasText: who }).locator('.vl-game').inputValue();
  check('both start with no game', await gameOf('Evie') === '' && await gameOf('Tabby') === '');
  await con.locator('.venue-card.open .vl-row', { hasText: 'Evie' }).locator('.vl-game').selectOption('blockyard');
  await wait(1200);
  check('Evie\'s says Blockyard, and the card says what it did', await gameOf('Evie') === 'blockyard'
    && /Play Blockyard button/.test(await con.$eval('.venue-card.open .vl-said', (n) => n.textContent)), await gameOf('Evie'));
  check('Tabby\'s is still none', await gameOf('Tabby') === '');
  await con.locator('.venue-card.open .vl-row', { hasText: 'Tabby' }).locator('.vl-game').selectOption('walkies');
  await wait(1200);
  check('Tabby\'s says Walkies, and Evie\'s did not move', await gameOf('Tabby') === 'walkies' && await gameOf('Evie') === 'blockyard');
  const heroBox = (who) => con.locator('.venue-card.open .vl-row', { hasText: who }).locator('.vl-hero');
  check('the name box takes no autocorrect — a phone would turn StEvie into Stevie',
    await heroBox('Evie').getAttribute('autocorrect') === 'off' && await heroBox('Evie').getAttribute('spellcheck') === 'false');
  await heroBox('Evie').fill('StEvie');
  await heroBox('Evie').press('Tab');
  await wait(1200);
  check('Evie\'s character is StEvie, capital E kept', await heroBox('Evie').inputValue() === 'StEvie'
    && /called StEvie/.test(await con.$eval('.venue-card.open .vl-said', (n) => n.textContent)), await heroBox('Evie').inputValue());
  check('Tabby\'s box says it is the DOG\'s name — the walker is her, already named',
    (await con.locator('.venue-card.open .vl-row', { hasText: 'Tabby' }).locator('.vl-hero-w').textContent()).trim() === 'Dog\'s name'
    && (await con.locator('.venue-card.open .vl-row', { hasText: 'Evie' }).locator('.vl-hero-w').textContent()).trim() === 'Character\'s name');
  await heroBox('Tabby').fill('Luna');
  await heroBox('Tabby').press('Tab');
  await wait(1200);
  await shot(con, 'logins-games.png', '.venue-card.open .venue-logins-in');
  const otherGame = await fetch(`${B}/api/venue-logins/x/game`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: other }, body: JSON.stringify({ game: 'walkies' }) });
  check('another quizmaster cannot choose one', otherGame.status === 403, String(otherGame.status));
  const tabbyId = await con.locator('.venue-card.open .vl-row', { hasText: 'Tabby' }).getAttribute('data-id');
  const madeUp = await fetch(`${B}/api/venue-logins/${tabbyId}/game`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify({ game: 'not-a-game' }) });
  check('a game that does not exist is refused', madeUp.status === 400, String(madeUp.status));

  console.log('\nTABBY PLAYS WALKIES');
  await p.reload({ waitUntil: 'load' });
  await wait(1200);
  // THE GAME IS A CARD ABOVE THE PHOTOS, with a picture of it — a pill in the
  // account row read as one more setting (the host, 6 October 2026).
  await p.waitForFunction(() => { const i = document.querySelector('.vp-game-pic'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 5000 }).catch(() => {});
  const card = await p.evaluate(() => {
    const c = document.querySelector('#vpBody > .vp-game:first-child');
    const pic = c && c.querySelector('.vp-game-pic');
    return c && { name: c.querySelector('.vp-game-name').textContent, line: c.querySelector('.vp-game-line').textContent, drawn: pic.complete && pic.naturalWidth > 0, inRow: !!document.querySelector('#vpWho .vp-play') };
  });
  check('Tabby\'s page leads with a Walkies card, and no Blockyard', !!card && card.name === 'Walkies' && !card.inRow, JSON.stringify(card));
  check('the card has a picture of the game, and says whose dog it is', !!card && card.drawn && /Luna/.test(card.line), card && card.line);
  await shot(p, 'walkies-card.png');
  await p.click('.vp-game .vp-play');
  await p.waitForSelector('.toy-sheet canvas', { timeout: 10000 }).catch(() => {});
  await wait(700);
  const park = () => p.evaluate(() => {
    const c = document.querySelector('.toy-canvas');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const seen = new Set();
    let sum = 0;
    for (let i = 0; i < d.length; i += 4 * 37) { seen.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]); sum = (sum * 31 + d[i] + d[i + 1] * 7 + d[i + 2] * 13) >>> 0; }
    return { colours: seen.size, sum };
  });
  const still = await park();
  await wait(500);
  check('the park draws, and nothing moves before the first tap', still.colours > 25 && (await park()).sum === still.sum, JSON.stringify(still));
  await shot(p, 'walkies-start.png');
  const wk = await p.locator('.toy-canvas').boundingBox();
  await p.mouse.click(wk.x + wk.width / 2, wk.y + wk.height / 2);
  await wait(600);
  check('a tap starts the walk and the park slides by', (await park()).sum !== still.sum);
  await shot(p, 'walkies-running.png');
  // No more taps: the dog walks into whatever comes first.
  await p.waitForFunction(() => /best|Good dog/.test(document.querySelector('.toy-said')?.textContent || ''), null, { timeout: 30000 }).catch(() => {});
  const over = (await p.$eval('.toy-said', (n) => n.textContent)).trim();
  check('three knocks end the walk, and it says the score — to the dog, by name', /A new best: \d+\. Good dog, Luna\./.test(over), over);
  await wait(800);
  await shot(p, 'walkies-woof.png');
  check('the best is kept on her phone', Number(await p.evaluate(() => localStorage.getItem('musicquiz.walkies.tabby'))) > 0);
  await p.click('.toy-close');

  const evPhone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const ev = await evPhone.newPage();
  ev.on('pageerror', (e) => errors.push(`game: ${String(e.message).slice(0, 140)}`));
  await ev.goto(`${B}/venue-photos`, { waitUntil: 'load' });
  await wait(600);
  await ev.fill('input[name=username]', 'Evie');
  await ev.fill('input[name=password]', 'evie second password');
  await ev.click('.vp-form button');
  await wait(1800);
  check('Evie\'s page has a Blockyard card', (await ev.locator('.vp-game .vp-game-name').textContent()) === 'Blockyard');
  await shot(ev, 'evie-signed-in.png');
  await ev.click('.vp-game .vp-play');
  await ev.waitForSelector('.toy-sheet canvas', { timeout: 10000 }).catch(() => {});
  await wait(900);
  check('and she is playing as StEvie', (await ev.getAttribute('.toy-sheet', 'aria-label')) === 'Blockyard, playing as StEvie');
  // PAINTED AND MOVING ARE TWO QUESTIONS, and a canvas answers neither by existing.
  const picture = () => ev.evaluate(() => {
    const c = document.querySelector('.toy-canvas');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const seen = new Set();
    let sum = 0;
    for (let i = 0; i < d.length; i += 4 * 37) { seen.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]); sum = (sum * 31 + d[i] + d[i + 1] * 7 + d[i + 2] * 13) >>> 0; }
    return { colours: seen.size, sum, w: c.clientWidth, h: c.clientHeight };
  });
  const first = await picture();
  check('the game draws a world — sky, ground and a miner — not a blank box', first.colours > 25, JSON.stringify(first));
  // The block under the miner's feet: the view is centred on the miner.
  const T = Math.max(22, Math.min(48, Math.floor(Math.min(first.w / 15, first.h / 10))));
  const box = await ev.locator('.toy-canvas').boundingBox();
  await ev.mouse.click(box.x + first.w / 2, box.y + first.h / 2 + 0.9 * T + 0.5 * T);
  await wait(900);
  const saidNow = (await ev.$eval('.toy-said', (n) => n.textContent)).trim();
  const slots = await ev.$$eval('.by-slot', (n) => n.map((x) => x.getAttribute('aria-label')));
  check('a tap on the ground digs it into the bag', /^\+1 /.test(saidNow) && slots.length === 2, `${saidNow} ${JSON.stringify(slots)}`);
  const second = await picture();
  check('and the picture changes — the hole, and the miner dropping into it', second.sum !== first.sum);
  await shot(ev, 'blockyard-phone.png');
  await ev.click('.by-slot:not([data-tool="pick"])');
  // THE MINER THEMSELVES — they dropped into the hole and the view followed,
  // so the middle of the picture is the one spot that does not depend on the
  // world's shape: tapping them puts the block under their feet.
  await ev.mouse.click(box.x + first.w / 2, box.y + first.h / 2);
  await wait(700);
  const placed = (await ev.$eval('.toy-said', (n) => n.textContent)).trim();
  check('a block put under the miner\'s feet goes down and lifts them out of the hole', /^0 [a-z]+ left\.$/.test(placed), placed);
  await ev.click('.toy-close');
  await wait(400);
  const kept = await ev.evaluate(() => localStorage.getItem('musicquiz.blockyard.evie'));
  check('closing keeps the world on her phone', Boolean(kept && kept.length > 1000));
  await ev.click('.vp-game .vp-play');
  await wait(900);
  const again = await ev.$$eval('.by-slot', (n) => n.length);
  check('and opening it again brings the same world and bag back', again >= 1 && (await picture()).colours > 25);
  await ev.click('.toy-close');

  console.log('\nTHE HOST REMOVES HER');
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
