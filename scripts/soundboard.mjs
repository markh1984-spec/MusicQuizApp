#!/usr/bin/env node
/**
 * DOES A PRESS ON THE SOUNDBOARD ACTUALLY MAKE A NOISE ON THE PROJECTOR?
 *
 *   node scripts/soundboard.mjs
 *
 * ---
 *
 * Three separate questions, and only the last one is the feature:
 *
 *   1. the route accepts a real id and REFUSES an invented one;
 *   2. the projector's payload carries it, and stops carrying it;
 *   3. **the projector actually renders audio** — which is the one no unit
 *      test can answer, because the payload being right proves nothing about
 *      whether anybody played it.
 *
 * The third is measured by routing the page's Web Audio through an
 * `OfflineAudioContext`-style tap: a real `AudioContext` is created, an
 * analyser is spliced onto the destination, and the peak level is sampled
 * before and after the press. **Silence and a working sound look identical
 * from the DOM** — nothing is drawn, no class changes, no element appears —
 * so sampling the signal is the only honest check.
 *
 * It also asserts the thing that will actually go wrong on a gig night: a
 * page that has never been tapped is muted by the browser, so the arm chip
 * has to exist and have to work.
 */

import { createRequire } from 'node:module';
import { startApp } from './helpers/live-app.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const KEY = 'soundboard';
const { base: BASE, stop } = await startApp({ key: KEY });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failures += 1;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${detail ? `  — ${detail}` : ''}`);
};

const asHostJson = (route) => fetch(`${BASE}${route}`, { headers: { 'X-Host-Key': KEY } })
  .then((r) => r.json()).catch(() => null);
const act = (action, body = {}) => fetch(`${BASE}/api/host/${action}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Host-Key': KEY },
  body: JSON.stringify(body),
}).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
const asHost = (route) => fetch(`${BASE}${route}`, { headers: { 'X-Host-Key': KEY } }).then((r) => r.json());
const screenState = () => fetch(`${BASE}/api/state?role=screen`).then((r) => r.json());

/*
 * NO `--autoplay-policy=no-user-gesture-required`, DELIBERATELY.
 *
 * The first version passed it and the arm chip then never appeared — because
 * with that flag the page can already make a noise, so there is correctly
 * nothing to arm. The flag was switching off the exact browser behaviour this
 * feature exists to work around, and the guard called a working chip missing.
 * A real projector gets no such flag.
 */
const browser = await chromium.launch();
try {
  const library = await asHost('/api/library');
  const pack = (library.quizzes || [])[0];
  await act('launch', { game: 'quiz', packId: pack.id, replace: true });

  /* ---------------------------------------------- the route, and its refusal */
  const good = await act('sting', { id: 'applause' });
  check('a real sound is accepted', good.status === 200, `${good.status}`);
  const bad = await act('sting', { id: 'airhorn-of-doom' });
  check('AN INVENTED ONE IS REFUSED, not silently ignored', bad.status === 400,
    `${bad.status} ${JSON.stringify(bad.body)}`);

  /* -------------------------------------------- the payload, and its expiry */
  const now = await screenState();
  check('the projector is told which sound', now.sting && now.sting.id === 'applause',
    JSON.stringify(now.sting || null));
  const phone = await fetch(`${BASE}/api/state?role=screen`).then((r) => r.json());
  check('and it carries a press time so it plays once', Number.isFinite((phone.sting || {}).at));

  /* --------------------------------------------------- the noise itself */
  /*
   * Let the earlier press expire first. A projector opened within the TTL
   * legitimately plays whatever is still in the payload — which is what we
   * want in a pub and would make "nothing is playing before the press" below
   * a lie.
   */
  await wait(4200);
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`${BASE}/screen`, { waitUntil: 'domcontentloaded' });
  /*
   * WAIT FOR IT RATHER THAN GUESS A DELAY. The first version slept 900ms and
   * called a working chip missing — the projector draws on its first state
   * push, and how long that takes is not this script's business to predict.
   */
  const armed = await page.waitForSelector('#soundArm', { timeout: 10000 }).then(() => true, () => false);
  check('an un-tapped projector offers the arm chip', armed);

  /*
   * Splice an analyser onto the output BEFORE arming, so everything the page
   * plays afterwards passes through something we can measure.
   */
  await page.evaluate(() => {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    window.__peak = 0;
    const orig = Ctx.prototype.createGain;
    // Every sound in this app connects through a gain to `destination`; tap
    // the destination itself by wrapping connect on the context's output.
    const ctxs = [];
    window.__ctxs = ctxs;
    const Patched = new Proxy(Ctx, {
      construct(target, args) {
        const c = new target(...args);
        ctxs.push(c);
        const an = c.createAnalyser();
        an.fftSize = 2048;
        an.connect(c.destination);
        // Make `destination` resolve to the analyser for anything that asks.
        Object.defineProperty(c, 'destination', { get: () => an, configurable: true });
        window.__an = an;
        return c;
      },
    });
    window.AudioContext = Patched;
    window.webkitAudioContext = Patched;
    void orig;
  });

  await page.click('#soundArm');
  await wait(300);
  const gone = await page.evaluate(() => !document.getElementById('soundArm'));
  check('and the chip goes once it is armed', gone);

  const peakAfter = async () => page.evaluate(() => new Promise((resolve) => {
    const an = window.__an;
    if (!an) return resolve(-1);
    const buf = new Float32Array(an.fftSize);
    let peak = 0;
    let n = 0;
    const tick = () => {
      an.getFloatTimeDomainData(buf);
      for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i]));
      if (++n < 90) requestAnimationFrame(tick); else resolve(peak);
    };
    tick();
  }));

  const quiet = await peakAfter();
  check('nothing is playing before the press', quiet >= 0 && quiet < 0.01, `peak ${quiet}`);

  await act('sting', { id: 'applause' });
  const loud = await peakAfter();
  check('A PRESS ACTUALLY MAKES A NOISE ON THE PROJECTOR', loud > 0.02, `peak ${loud}`);

  /* Every sound, not just the one — a silent trombone is a dead button. */
  /*
   * EVERY SOUND, AND BOTH ENDS OF THE RANGE.
   *
   * Too quiet is a dead button. **Too loud CLIPS**, which through a PA is a
   * crack rather than a sting — and that is not hypothetical: `ding` was the
   * gentlest thing in the file on paper and measured 1.27 here, because two
   * pure sines started together sum in phase. A ceiling is the only way that
   * gets caught, since it sounds fine on a laptop speaker that cannot reach
   * it.
   */
  const CEILING = 0.95;
  const { STINGS } = await import('../public/assets/stings.js');
  for (const t of STINGS) {
    /*
     * LET THE LAST ONE DIE FIRST, or this measures the SUM.
     *
     * Applause runs 2.4 seconds and the first version fired the next sting
     * 150ms later, so "Ding" was reading applause's tail plus the ding — and
     * cutting the ding's own gain threefold barely moved the number, which is
     * what gave it away. A peak measured over somebody else's sound is not a
     * measurement of anything.
     */
    await wait(3000);
    const settled = await peakAfter();
    check(`the room is quiet before ${t.label}`, settled < 0.02, `peak ${settled}`);

    /*
     * ONE OF THEM IS A VOICE, AND IT CANNOT BE MEASURED HERE.
     *
     * `yourMum()` hands a sentence to the browser's own `speechSynthesis`,
     * which comes out of the platform's mixer rather than through the
     * `AudioContext` this analyser is spliced into. So the peak is a flat
     * zero however well it works, and asserting on it would be a guard
     * confidently answering a question it is not looking at — the fault this
     * repo records against `pub-unchanged` five times over.
     *
     * What CAN be established from here is that the press reached the right
     * function and the platform was asked to speak. That it made an audible
     * noise is a thing a person has to hear, and the reply that ships this
     * says so rather than implying the guard covered it.
     */
    if (t.id === 'yourmum') {
      await page.evaluate(() => {
        window.__spoke = [];
        const real = window.speechSynthesis && window.speechSynthesis.speak;
        if (!real) return;
        window.speechSynthesis.speak = function spy(u) {
          window.__spoke.push(String((u && u.text) || ''));
          try { return real.call(window.speechSynthesis, u); } catch { return undefined; }
        };
      });
      await act('sting', { id: t.id });
      await wait(900);
      const spoke = await page.evaluate(() => window.__spoke || []);
      check(`${t.label} asks the browser to say it`,
        spoke.length === 1 && /your mum/i.test(spoke[0]), JSON.stringify(spoke));
      check(`${t.label} says the right words`, spoke[0] === 'Your mum', JSON.stringify(spoke));
      continue;
    }

    await act('sting', { id: t.id });
    const lvl = await peakAfter();
    check(`${t.label} makes a sound`, lvl > 0.02, `peak ${lvl}`);
    check(`${t.label} does not clip`, lvl < CEILING, `peak ${lvl}, ceiling ${CEILING}`);
  }
  /*
   * AND THE HOST CAN STILL REACH THE BUTTONS — the panel FOLDS now.
   *
   * Everything above fires a sting over HTTP, which proves the route and the
   * noise and says nothing about whether a thumb can get to a button. *"Those
   * sound controls should be collapsible"* put them behind a press, and a fold
   * whose body cannot be opened is a soundboard nobody can use.
   */
  console.log('\n--- and on the control view');
  const host = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await host.goto(`${BASE}/host?key=${KEY}`, { waitUntil: 'domcontentloaded' });
  await wait(1800);

  const look = () => host.evaluate(() => {
    const box = document.querySelector('.panel.sounds');
    if (!box) return { there: false };
    const btn = box.querySelector('.sting');
    const r = btn && btn.getBoundingClientRect();
    let pressable = false;
    if (r && r.height > 0) {
      btn.scrollIntoView({ block: 'center' });
      const rr = btn.getBoundingClientRect();
      const hit = document.elementFromPoint(rr.left + rr.width / 2, rr.top + rr.height / 2);
      pressable = Boolean(hit && (btn === hit || btn.contains(hit)));
    }
    return {
      there: true,
      shut: box.classList.contains('shut'),
      buttonDrawn: Boolean(r && r.height > 0),
      pressable,
      head: (box.querySelector('.sounds-head') || {}).innerText || '',
    };
  });

  const shut = await look();
  check('the Sounds panel is there', shut.there === true, JSON.stringify(shut));
  check('AND IT STARTS SHUT, so the player list is not pushed down',
    shut.shut === true && shut.buttonDrawn === false, JSON.stringify(shut));
  check('with a row that says what it is', /Sounds/.test(shut.head), JSON.stringify(shut.head));

  await host.click('.sounds-head');
  await wait(400);
  const open = await look();
  check('PRESSING IT OPENS THE BUTTONS', open.shut === false && open.buttonDrawn === true,
    JSON.stringify(open));
  check('AND A BUTTON CAN ACTUALLY BE PRESSED', open.pressable === true, JSON.stringify(open));

  /* THE REAL PRESS, on the real button — not the API. */
  await host.evaluate(() => { window.__fired = 0; });
  await host.click('.panel.sounds .sting');
  await wait(600);
  const played = await asHostJson('/api/state?role=screen');
  check('and the real press reaches the room', Boolean(played && played.sting),
    JSON.stringify((played || {}).sting || null));

  await host.click('.sounds-head');
  await wait(300);
  const again = await look();
  check('and pressing it again folds it away', again.shut === true, JSON.stringify(again));
} finally {
  await browser.close();
  await stop();
}

console.log(failures ? `\n${failures} FAILED` : '\nthe soundboard reaches the room');
process.exit(failures ? 1 : 0);
