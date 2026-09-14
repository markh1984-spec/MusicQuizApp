#!/usr/bin/env node
/**
 * A DJ SET, IN A REAL BROWSER — the phone, the projector and the desk.
 *
 * ---
 *
 * **A TEST THAT THE PAYLOAD IS RIGHT PROVES NOTHING ABOUT WHETHER ANYBODY
 * DREW IT.** `test/dj.test.js` drives the whole mechanic over HTTP and every
 * assertion in it passed while not one of these three screens existed. This
 * is the other half: it puts a finger on the controls and reads what is on
 * the glass.
 *
 * What it checks, in order:
 *
 *  - the projector draws the join code and **no request anywhere on it**,
 *    which is rule 1 and the reason this feature is safe to sell;
 *  - the phone draws the camera FIRST and the request box **present and
 *    inert**, with the reason ON the control;
 *  - a photograph unlocks it — sent through the unchanged `/api/photo`;
 *  - a typed request lands, the phone shows its own, and the projector still
 *    shows none;
 *  - the desk draws it with the line the DJ pastes, and **Played it** empties
 *    the queue;
 *  - nothing on any of the three screens overflows sideways at 390px.
 *
 * Screenshots go to `/tmp` and are named on the way out, because the standing
 * rule in this project is that a UI change is SHOWN.
 */

import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { withApp } from './helpers/live-app.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const KEY = 'dj-shot-key';
const SHOTS = process.env.SHOT_DIR || '/tmp';
const PW = 'a dj passphrase here';
const A_JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(4000, 7)]);

const fails = [];
const ok = (cond, what) => { if (!cond) fails.push(what); return cond; };

async function post(base, path, body, key) {
  return fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(key ? { 'X-Host-Key': key } : {}) },
    body: JSON.stringify(body),
  });
}

/** Sideways scroll is the one layout fault a screenshot alone can hide. */
async function overflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

await withApp(async ({ base }) => {
  const browser = await chromium.launch();
  try {
    // ------------------------------------------------- the door STARTS it
    /*
     * PRESSED, NOT POSTED. The gallery publish route existed for weeks with
     * nothing calling it, and the arcade board sat in a payload nobody drew —
     * so the set is started the way the host will start it, by pressing the
     * button on `/dj`, and only then is the rest of this driven over HTTP.
     */
    const door = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await door.goto(`${base}/dj?key=${KEY}`);
    await door.waitForTimeout(600);
    ok(await door.locator('#djStart').count() === 1, 'the door draws no way to start a set');
    await door.screenshot({ path: `${SHOTS}/dj-door.png`, fullPage: true });
    await door.locator('#djStart').click();
    await door.waitForTimeout(1200);
    const doorText = await door.locator('body').innerText();
    ok(/The set is on/.test(doorText), 'pressing Start did not start a set');
    ok(/Open the screen/.test(doorText), 'the door does not say where to go next');
    ok(await overflow(door) <= 0, `the door scrolls sideways by ${await overflow(door)}px`);
    await door.screenshot({ path: `${SHOTS}/dj-door-on.png`, fullPage: true });

    const started = await fetch(`${base}/api/state?role=host&key=${KEY}`);
    ok(started.status === 200, `the set would not start (${started.status})`);
    const { joinCode } = await started.json();
    const g = joinCode ? `&g=${joinCode}` : '';

    // ------------------------------------------------------------ the projector
    const wall = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await wall.goto(`${base}/screen?role=screen${g ? `${g}` : ''}`.replace('?role=screen&', '?role=screen&'));
    await wall.waitForTimeout(900);
    const wallText = await wall.locator('body').innerText();
    ok(/photo/i.test(wallText), 'the projector never says what to do');
    ok(await wall.locator('.qr-panel img').count() === 1, 'no QR code on the projector');
    ok(!/Music Quiz/i.test(wallText), 'the projector calls a DJ set a music quiz');
    // The corner points at a code that is already half the screen, and it drew
    // itself over the top of the panel holding it.
    ok(await wall.locator('#joinCorner').count() === 0, 'the join corner is over the QR panel');
    await wall.screenshot({ path: `${SHOTS}/dj-screen.png` });

    // ------------------------------------------------------------ the phone
    const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await phone.goto(`${base}/play?${joinCode ? `g=${joinCode}` : ''}`);
    await phone.waitForTimeout(400);
    await phone.fill('#nameInput, input[name="name"], .join input[type="text"]', 'Sam').catch(() => {});
    await phone.locator('button:has-text("Join")').first().click().catch(() => {});
    await phone.waitForTimeout(900);

    const locked = await phone.locator('body').innerText();
    ok(/Send a photo/i.test(locked), 'the phone never asks for a photo');
    ok(/Ask for a song/i.test(locked), 'the request box is absent rather than present-and-inert');
    ok(/Send a photo first/i.test(locked), 'the reason the box is off is not on the box');
    ok(await overflow(phone) <= 0, `the phone scrolls sideways by ${await overflow(phone)}px`);
    await phone.screenshot({ path: `${SHOTS}/dj-phone-locked.png`, fullPage: true });

    // A photograph, through the route a quiz night uses unchanged.
    const me = await phone.evaluate(() => JSON.parse(localStorage.getItem('musicquiz.player') || 'null'));
    ok(me && me.id, 'the phone never joined');
    const shot = await fetch(`${base}/api/photo?playerId=${me.id}${joinCode ? `&g=${joinCode}` : ''}`, {
      method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: A_JPEG,
    });
    ok(shot.status === 200, `the photo did not land (${shot.status})`);
    await phone.waitForTimeout(900);

    const open = await phone.locator('body').innerText();
    ok(!/Send a photo first/i.test(open), 'the box stayed locked after a photograph');
    ok(await phone.locator('.dj-q').count() === 1, 'no search box after the unlock');
    await phone.screenshot({ path: `${SHOTS}/dj-phone-open.png`, fullPage: true });

    // Ask for something, by typing — the path that works with no Spotify.
    await phone.locator('.dj-swap').first().click();
    await phone.fill('.dj-title', 'Blue Monday');
    await phone.fill('.dj-artist', 'New Order');
    await phone.locator('.dj-send').click();
    await phone.waitForTimeout(900);
    const asked = await phone.locator('body').innerText();
    ok(/Blue Monday/.test(asked), 'the phone does not show what it asked for');
    ok(/with the DJ/i.test(asked), 'the phone does not say where the request went');
    await phone.screenshot({ path: `${SHOTS}/dj-phone-asked.png`, fullPage: true });

    // ------------------------------------------- AND THE PROJECTOR STILL HAS NONE
    await wall.waitForTimeout(600);
    const wallNow = await wall.locator('body').innerText();
    ok(!/Blue Monday/i.test(wallNow), 'A REQUEST REACHED THE BIG SCREEN — rule 1');
    ok(!/New Order/i.test(wallNow), 'A REQUEST REACHED THE BIG SCREEN — rule 1');

    // ------------------------------------------------------------ the desk
    const desk = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await desk.goto(`${base}/host?key=${KEY}`);
    await desk.waitForTimeout(1000);
    const deskText = await desk.locator('body').innerText();
    ok(/New Order — Blue Monday/.test(deskText), 'the desk does not draw the line to paste');
    ok(/Sam/.test(deskText), 'the desk does not say who asked');
    ok(await overflow(desk) <= 0, `the desk scrolls sideways by ${await overflow(desk)}px`);
    await desk.screenshot({ path: `${SHOTS}/dj-desk.png`, fullPage: true });

    await desk.locator('.djq-played').first().click();
    await desk.waitForTimeout(900);
    const afterText = await desk.locator('body').innerText();
    ok(/Played · 1/.test(afterText), 'Played it did not move the request');
    ok(/Nothing waiting/.test(afterText), 'the queue did not empty');

    // And the phone hears about it.
    await phone.waitForTimeout(600);
    ok(/played/i.test(await phone.locator('body').innerText()), 'the phone was never told it got played');

    // ------------------------------------------- SIGNING IN COMES BACK HERE
    /*
     * REPORTED IN THESE WORDS: *"that just signed me into my quiz app."* The
     * door's Sign in was a bare `/login`, which lands a quizmaster on the
     * console and the OWNER on `/owner` — so the one press somebody makes on
     * a page they have never seen took them into the quiz app and left them
     * there. It is a SEPARATE APP to the person using it, so every way in has
     * to end up back on the door.
     *
     * Driven as a real sign-in rather than checked as an href, because the
     * bug was never in the link: it was in where the journey ENDED.
     */
    const out = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await out.goto(`${base}/dj`);          // no key, no cookie — a cold arrival
    await out.waitForTimeout(700);
    ok(/Sign in/i.test(await out.locator('body').innerText()), 'a signed-out arrival is not offered a sign-in');
    await out.locator('a.ld-cta').click();
    await out.waitForTimeout(700);
    ok(/\/login/.test(out.url()), `Sign in did not reach the sign-in page (${out.url()})`);

    await out.fill('input[type=email]', 'dj@example.com');
    await out.fill('input[type=password]', PW);
    await out.evaluate(() => document.querySelector('form')?.requestSubmit());
    await out.waitForTimeout(2000);
    ok(out.url().includes('/dj'), `signing in from the door landed on ${out.url()} instead of the door`);
    ok(!/\/owner|\/console/.test(out.url()), `signing in from the door went into the quiz app: ${out.url()}`);
    await out.screenshot({ path: `${SHOTS}/dj-door-signedin.png`, fullPage: true });

    // ------------------------------------------- ITS OWN DOMAIN'S FRONT DOOR
    /*
     * `dj.pubchampions.co.uk` and the quiz app are one Render service, so the
     * only thing telling them apart is the Host header. Asked with a RAW
     * request because a browser will not let a page set its own Host, and the
     * decision under test is the SERVER'S — the rendering is already proven
     * by the legs above.
     */
    const askHost = (host) => new Promise((resolve) => {
      const u = new URL(base);
      http.get({ host: u.hostname, port: u.port, path: '/', headers: { Host: host } }, (r) => {
        let body = '';
        r.on('data', (c) => { body += c; });
        r.on('end', () => resolve({ status: r.statusCode, to: r.headers.location || '', body }));
      });
    });

    const onDj = await askHost('dj.example.test');
    ok(onDj.status === 200, `the DJ domain's bare address answered ${onDj.status}`);
    ok(/id="djDoor"/.test(onDj.body), 'the DJ domain\'s bare address is not the DJ door');

    /*
     * AND THE JOIN QR FOLLOWS THE DOMAIN THE ROOM IS LOOKING AT, even with
     * `PUBLIC_URL` pinned to the quiz app — otherwise the code on the DJ
     * screen sends a room to somebody else's branding and a sign-in page.
     */
    const qr = await new Promise((resolve) => {
      const u = new URL(base);
      http.get({ host: u.hostname, port: u.port, path: '/api/join-url', headers: { Host: 'dj.example.test' } }, (r) => {
        let b = ''; r.on('data', (c) => { b += c; }); r.on('end', () => resolve(JSON.parse(b || '{}')));
      });
    });
    ok(String(qr.url).includes('dj.example.test'),
      `the DJ screen's join code points at ${qr.url} instead of the DJ domain`);

    const onQuiz = await askHost('quiz.example.test');
    ok(onQuiz.status === 302, `the quiz domain's bare address stopped redirecting (${onQuiz.status})`);
    ok(/^\/(home|console|owner)$/.test(onQuiz.to), `the quiz front door moved: ${onQuiz.to}`);

    // The desk at a laptop width too — this is the screen with the buttons on.
    await desk.setViewportSize({ width: 1280, height: 800 });
    await desk.waitForTimeout(400);
    await desk.screenshot({ path: `${SHOTS}/dj-desk-wide.png`, fullPage: true });
  } finally {
    await browser.close();
  }
}, {
  key: KEY,
  // The DJ set's own domain, so the Host-header decision can be driven.
  // `PUBLIC_URL` pinned to the OTHER domain, which is the case that breaks it.
  env: { DJ_HOST: 'dj.example.test', PUBLIC_URL: 'https://quiz.example.test' },
  async seed(dir) {
    const { Accounts } = await import(new URL('../src/accounts.js', import.meta.url).href);
    const book = new Accounts(path.join(dir, 'accounts.json'));
    book.create({ email: 'dj@example.com', password: PW, name: 'A DJ', role: 'quizmaster', tier: 'gold', status: 'active' });
    book.save();
  },
});

if (fails.length) {
  console.error('\nA DJ SET IS BROKEN:\n');
  for (const f of fails) console.error(`  ✗ ${f}`);
  process.exitCode = 1;
} else {
  console.log('\nA DJ set works, in a real browser: the code and the wall on the projector,');
  console.log('the camera then the box on the phone, the queue on the desk — and NO request');
  console.log('anywhere on the big screen.');
  console.log(`\nScreenshots: ${SHOTS}/dj-screen.png, dj-phone-locked.png, dj-phone-open.png,`);
  console.log('             dj-phone-asked.png, dj-desk.png, dj-desk-wide.png, dj-door.png');
}
