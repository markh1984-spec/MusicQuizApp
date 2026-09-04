#!/usr/bin/env node
/**
 * WHAT A PERSON WOULD SEE — the layout half of the checks, at three sizes.
 *
 * ---
 *
 * **A high-effort read of the code misses layout every time.** The faults this
 * exists to catch do not throw, do not fail a unit test and look correct in a
 * diff: a solid word running off a stage that cannot scroll, a fixed bar
 * parked on top of the one control that stops a photo, a 34px button in a dark
 * pub. Every one of those was live on 4 September 2026 and every one was found
 * by taking a picture and measuring it.
 *
 * It drives a real quiz loop — lobby, joined, rules, round intro, question,
 * answer chosen, reveal, round board, final — plus all four lobby games, at
 * **390x844, 820x1180 and 1440x900**, and asks four questions of each frame:
 *
 *   1. does the page run off sideways (a projector cannot scroll to it);
 *   2. is any text clipped by its own box (a deliberate ellipsis does not count);
 *   3. is anything painted outside the viewport (a row you can SWIPE does not count);
 *   4. is anything pressable under the 44px touch floor.
 *
 * And one more that needs a real browser to answer at all: **can every control
 * actually be pressed**, after scrolling as far as the page will go. That is
 * how the photo kill switch was found buried under the action bar — on screen,
 * fully scrolled, and unreachable at both sizes.
 *
 * **IT WRITES ITS OWN STRESS PACK.** No pack in `quizzes/` contains a
 * forty-five-letter word, so nothing in the library could have found the
 * wrapping bug. The awkward content is the point.
 *
 * Its own server, own port, own DATA_DIR, own pack directories — the real ones
 * are copied rather than written to, so a run cannot touch the library.
 *
 *   node scripts/visual-qa.mjs
 *   node scripts/visual-qa.mjs --shots /tmp/look    # keep the pictures
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const at = process.argv.indexOf('--shots');
const SHOTS = at > -1 ? process.argv[at + 1] : fs.mkdtempSync(path.join(os.tmpdir(), 'visualqa-shots-'));
fs.mkdirSync(SHOTS, { recursive: true });

/* A random port: a killed run leaves its server behind, and a fixed port then
   collides with the orphan so every check quietly measures a server this script
   never started. */
const PORT = Number(process.env.PORT || 49100 + Math.floor(Math.random() * 200));
const KEY = 'visualqa';
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'visualqa-'));
const DATA = path.join(ROOT, 'data');
const QUIZ = path.join(ROOT, 'quizzes');
const BINGO = path.join(ROOT, 'bingo');
for (const d of [DATA, QUIZ, BINGO]) fs.mkdirSync(d, { recursive: true });
// Packs only — `bingo/` also holds a `tracklists/` directory.
const copyPacks = (from, to) => {
  for (const f of fs.readdirSync(from)) {
    if (!f.endsWith('.json')) continue;
    fs.copyFileSync(path.join(from, f), path.join(to, f));
  }
};
copyPacks('quizzes', QUIZ);
copyPacks('bingo', BINGO);

/* THE AWKWARD CONTENT IS THE POINT — a prompt that fills the stage, options
   with no break opportunity in them at all, and one of each round type. */
const LONG = 'Which extraordinarily long-titled 1997 single by a band whose name nobody at'
  + ' the back of the pub can ever quite remember spent an unusually protracted period at'
  + ' the very top of the UK singles chart that summer?';
fs.writeFileSync(path.join(QUIZ, 'qa-stress-test.json'), JSON.stringify({
  id: 'qa-stress-test', title: 'QA Stress Test Quiz', subtitle: 'Awkward text, for layout only.',
  questionSeconds: 90, createdAt: '2026-09-04T09:00:00.000Z', notes: 'Written by scripts/visual-qa.mjs.',
  rounds: [
    { id: 'r1', type: 'text', title: 'Round One — A Very Long Round Title That Goes On And On', blurb: 'Long text.',
      questions: [
        { id: 'r1q1', prompt: LONG, correctIndex: 1, answerNote: 'A note long enough that the reveal has a full sentence under the answer.',
          options: ['The Boy With The Thorn In His Side (Extended Remastered Anniversary Edition Mix)', 'Short one',
            'A medium-length answer that is plausible enough', 'Another quite long option with a parenthetical (1997)'] },
        { id: 'r1q2', prompt: 'Short?', options: ['A', 'B', 'C', 'D'], correctIndex: 0, answerNote: 'Short.' },
        { id: 'r1q3', prompt: 'Which of these is the longest single word in common English usage?', correctIndex: 2,
          answerNote: 'Chosen purely to stress the option boxes.',
          options: ['Antidisestablishmentarianism', 'Supercalifragilisticexpialidocious',
            'Pneumonoultramicroscopicsilicovolcanoconiosis', 'Floccinaucinihilipilification'] },
      ] },
    { id: 'r2', type: 'multi', title: 'Round Two — Pick Them All', blurb: 'Six options.',
      questions: [{ id: 'r2q1', prompt: 'Which of these were UK number ones in the 1980s — tick every one?',
        options: ['Careless Whisper', 'Come On Eileen', 'A Very Long Option Name Indeed To Test Wrapping', 'Relax', 'Short', 'Two Tribes'],
        correctIndexes: [0, 1, 3, 5], answerNote: 'Four of the six.' }] },
    { id: 'r3', type: 'alphabet', title: 'Round Three — First Letter Only', blurb: 'Just the letter.',
      questions: [
        { id: 'r3q1', prompt: 'Which band, formed in London in 1970, are we thinking of?', answer: 'Queen' },
        { id: 'r3q2', prompt: 'Short one?', answer: 'Blur' },
      ] },
  ],
}, null, 2));

const VIEWS = [
  { name: 'mobile', w: 390, h: 844 },
  { name: 'tablet', w: 820, h: 1180 },
  { name: 'desktop', w: 1440, h: 900 },
];
const GAMES = ['maze', 'rally', 'tailback', 'quickdraw'];
const B = `http://127.0.0.1:${PORT}`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let server = null;
const stop = () => { if (server) server.kill('SIGKILL'); fs.rmSync(ROOT, { recursive: true, force: true }); };
process.on('exit', stop);
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { stop(); process.exit(1); });

const api = (p, body) => fetch(B + p, { method: 'POST',
  headers: { 'content-type': 'application/json', 'X-Host-Key': KEY }, body: JSON.stringify(body || {}) })
  .then((r) => r.status);
const phase = () => fetch(`${B}/api/state?role=screen`).then((r) => r.json()).then((s) => s.phase).catch(() => '');

/* Everything below runs INSIDE the page, so it measures what was painted. */
const MEASURE = () => {
  const out = { overflowX: 0, clipped: [], offscreen: [], tiny: [] };
  const de = document.documentElement;
  out.overflowX = de.scrollWidth - de.clientWidth;
  const vis = (n) => n.getClientRects().length > 0;
  const all = [...document.querySelectorAll('body *')].filter(vis);
  const name = (n) => n.tagName.toLowerCase() + '.' + String(n.className || '').split(' ')[0];

  for (const n of all) {
    if (n.childElementCount || (n.textContent || '').trim().length < 2) continue;
    const st = getComputedStyle(n);
    // A deliberate ellipsis is graceful truncation, not a clip.
    if (st.textOverflow === 'ellipsis' && st.whiteSpace === 'nowrap') continue;
    // `-webkit-line-clamp` is the multi-line version of the same thing: it
    // truncates with an ellipsis on purpose. The call sheet uses it so no box
    // is twice the height of its neighbours, with the reason written above it.
    if (st.webkitLineClamp && st.webkitLineClamp !== 'none') continue;
    const hidden = st.overflow === 'hidden' || st.overflowY === 'hidden' || st.overflowX === 'hidden';
    const dh = n.scrollHeight - n.clientHeight;
    const dw = n.scrollWidth - n.clientWidth;
    if (hidden && (dh > 2 || dw > 2)) {
      out.clipped.push({ sel: name(n), text: (n.textContent || '').trim().slice(0, 50), hides: `${dw}x${dh}` });
    }
  }

  // A row you can SWIPE is not a thing that has fallen off the screen.
  const inScroller = (n) => {
    for (let p = n.parentElement; p; p = p.parentElement) {
      const st = getComputedStyle(p);
      if ((st.overflowX === 'auto' || st.overflowX === 'scroll') && p.scrollWidth > p.clientWidth) return true;
    }
    return false;
  };
  for (const n of all) {
    const r = n.getBoundingClientRect();
    if (r.width < 4 || r.height < 4 || inScroller(n)) continue;
    if (r.right > innerWidth + 2 || r.left < -2) {
      out.offscreen.push({ sel: name(n), text: (n.textContent || '').trim().slice(0, 40),
        rect: `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}` });
    }
  }

  for (const n of document.querySelectorAll('button, a[href], input, select, [role=button]')) {
    if (!vis(n)) continue;
    const r = n.getBoundingClientRect();
    if (Math.min(r.width, r.height) < 44) {
      out.tiny.push({ sel: name(n), text: (n.textContent || n.getAttribute('aria-label') || '').trim().slice(0, 28),
        size: `${Math.round(r.width)}x${Math.round(r.height)}` });
    }
  }
  return out;
};

const found = [];
const errors = [];
const note = (where, m) => {
  if (m.overflowX > 2) found.push(`${where}: the page runs ${m.overflowX}px off sideways`);
  m.clipped.forEach((c) => found.push(`${where}: ${c.sel} clips its own text (${c.hides}) — "${c.text}"`));
  m.offscreen.forEach((c) => found.push(`${where}: ${c.sel} painted off-viewport at ${c.rect} — "${c.text}"`));
  m.tiny.forEach((t) => found.push(`${where}: ${t.sel} "${t.text}" is ${t.size}, under the 44px floor`));
};

try {
  server = spawn(process.execPath, ['server.js'], { stdio: 'ignore',
    env: { ...process.env, PORT: String(PORT), HOST_KEY: KEY, DATA_DIR: DATA, QUIZ_DIR: QUIZ, BINGO_DIR: BINGO } });
  for (let i = 0; i < 80; i += 1) { try { await fetch(`${B}/health`); break; } catch { await wait(250); } }

  const browser = await chromium.launch();
  const ctxs = {};
  for (const v of VIEWS) {
    const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h } });
    const pages = { screen: await ctx.newPage(), phone: await ctx.newPage(), host: await ctx.newPage() };
    for (const [role, p] of Object.entries(pages)) {
      p.on('pageerror', (e) => errors.push(`${v.name}/${role}: ${e.message}`));
      p.on('console', (m) => { if (m.type() === 'error') errors.push(`${v.name}/${role}: ${m.text().slice(0, 120)}`); });
    }
    ctxs[v.name] = pages;
  }

  const shot = async (state) => {
    for (const v of VIEWS) {
      for (const [role, page] of Object.entries(ctxs[v.name])) {
        await page.screenshot({ path: `${SHOTS}/${state}__${role}__${v.name}.png` });
        note(`${state} ${role}/${v.name}`, await page.evaluate(MEASURE));
      }
    }
  };

  console.log(`\nVISUAL QA — three sizes, a real browser\n  pictures: ${SHOTS}\n`);
  await api('/api/host/launch', { game: 'quiz', packId: 'qa-stress-test', questionSeconds: 90, replace: true });
  for (const v of VIEWS) {
    await ctxs[v.name].screen.goto(`${B}/screen`, { waitUntil: 'domcontentloaded' });
    await ctxs[v.name].host.goto(`${B}/host?key=${KEY}`, { waitUntil: 'domcontentloaded' });
    await ctxs[v.name].phone.goto(`${B}/play`, { waitUntil: 'domcontentloaded' });
  }
  await wait(2500);
  await shot('01-lobby');

  for (const v of VIEWS) {
    await ctxs[v.name].phone.waitForSelector('#nameInput', { timeout: 15000 });
    await ctxs[v.name].phone.fill('#nameInput', v.name === 'mobile' ? 'The Quizzly Bears (A Very Lo' : `Team ${v.name}`);
    await ctxs[v.name].phone.click('#joinBtn');
  }
  await wait(2000);
  await shot('02-joined');

  const step = async (label, want) => {
    await api('/api/host/next');
    for (let i = 0; i < 30 && (await phase()) !== want; i += 1) await wait(200);
    await wait(1200);
    await shot(label);
  };
  await step('03-rules', 'rules');
  await step('04-round-intro', 'round_intro');
  await step('05-question-long', 'question');
  for (const v of VIEWS) {
    await ctxs[v.name].phone.evaluate(() => {
      const b = [...document.querySelectorAll('button')].filter((n) => n.getClientRects().length && !n.disabled);
      if (b[0]) b[0].click();
    });
  }
  await wait(1400);
  await shot('06-answer-chosen');
  await step('07-reveal', 'reveal');
  await step('08-question-short', 'question');
  await step('09-reveal-short', 'reveal');
  await step('10-question-solidword', 'question');
  await step('11-reveal-solidword', 'reveal');
  await step('12-round-board', 'round_board');
  await step('13-multi-intro', 'round_intro');
  await step('14-multi-question', 'question');
  await step('15-multi-reveal', 'reveal');
  await step('16-round-board-2', 'round_board');
  await step('17-alphabet-intro', 'round_intro');
  await step('18-alphabet-question', 'question');
  await step('19-alphabet-reveal', 'reveal');
  await step('20-alphabet-q2', 'question');
  await step('21-alphabet-reveal-2', 'reveal');
  await step('22-round-board-3', 'round_board');
  await step('23-final', 'final');

  /*
   * CAN EVERY CONTROL ACTUALLY BE PRESSED, with the page scrolled as far as it
   * will go? This is the question a screenshot cannot answer and a DOM read
   * gets wrong — the photo kill switch was on screen, fully scrolled, and
   * underneath the fixed action bar at both sizes.
   */
  for (const v of VIEWS) {
    const p = ctxs[v.name].host;
    await p.goto(`${B}/host?key=${KEY}`, { waitUntil: 'domcontentloaded' });
    await wait(2200);
    /*
     * AT EVERY SCROLL POSITION, NOT ONE. This page has a sticky bar at the top
     * and a fixed one at the bottom, so at any given offset SOMETHING is under
     * one of them — and scrolling frees it. Sampling once reports four controls
     * that are perfectly fine.
     *
     * A control is broken only when it is covered wherever you stand. That is
     * what the photo kill switch was: last panel on the page, under the bottom
     * bar, at maximum scroll, with nothing left to reveal it.
     */
    const label = (n) => (n.textContent || '').trim().slice(0, 30);
    const blockedNow = () => p.evaluate(() => {
      const out = {};
      for (const n of document.querySelectorAll('main button, main a[href], main select')) {
        if (!n.getClientRects().length || n.disabled) continue;
        const key = (n.textContent || '').trim().slice(0, 30);
        const r = n.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const onScreen = cx > 0 && cy > 0 && cx < innerWidth && cy < innerHeight;
        if (!onScreen) { if (!(key in out)) out[key] = null; continue; }
        const top = document.elementFromPoint(cx, cy);
        const clear = !top || top === n || n.contains(top) || top.contains(n);
        if (clear) out[key] = 'clear';
        else if (out[key] !== 'clear') out[key] = String(top.className || top.tagName).slice(0, 30);
      }
      return out;
    });
    const everClear = new Map();
    await p.evaluate(() => scrollTo(0, 0));
    await wait(300);
    for (let pass = 0; pass < 16; pass += 1) {
      for (const [k, v2] of Object.entries(await blockedNow())) {
        if (!everClear.has(k) || v2 === 'clear') everClear.set(k, v2);
      }
      await p.mouse.move(v.w / 2, v.h / 2);
      await p.mouse.wheel(0, 220);
      await wait(120);
    }
    for (const [k, v2] of everClear) {
      if (v2 && v2 !== 'clear') {
        found.push(`host/${v.name}: "${k}" cannot be pressed at ANY scroll position — ${v2} is over it`);
      }
    }
    await p.screenshot({ path: `${SHOTS}/24-host-scrolled__host__${v.name}.png` });
  }

  /*
   * AND THE WHOLE BINGO NIGHT, which is a DIFFERENT ENGINE with different
   * screens — a card in somebody's hand, a call sheet on the wall, a claim, a
   * prize stage, fresh cards. None of it shares a view with the quiz, so none
   * of it was covered by anything above.
   */
  {
    const bctx = {};
    for (const v of VIEWS) {
      const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h } });
      const pages = { screen: await ctx.newPage(), phone: await ctx.newPage(), host: await ctx.newPage() };
      for (const [role, pg] of Object.entries(pages)) {
        pg.on('pageerror', (e) => errors.push(`bingo ${v.name}/${role}: ${e.message}`));
        pg.on('console', (m) => { if (m.type() === 'error') errors.push(`bingo ${v.name}/${role}: ${m.text().slice(0, 120)}`); });
      }
      bctx[v.name] = pages;
    }
    const bshot = async (state) => {
      for (const v of VIEWS) {
        for (const [role, pg] of Object.entries(bctx[v.name])) {
          await pg.screenshot({ path: `${SHOTS}/${state}__${role}__${v.name}.png` });
          note(`${state} ${role}/${v.name}`, await pg.evaluate(MEASURE));
        }
      }
    };

    // A 5x5 with three prizes, so every stage — a line, two lines, a full house.
    await api('/api/host/launch', { game: 'bingo', packId: 'eighties-bingo', replace: true,
      shape: { rows: 5, cols: 5 }, prizes: 3 });
    await wait(1000);
    for (const v of VIEWS) {
      await bctx[v.name].screen.goto(`${B}/screen`, { waitUntil: 'domcontentloaded' });
      await bctx[v.name].host.goto(`${B}/host?key=${KEY}`, { waitUntil: 'domcontentloaded' });
      await bctx[v.name].phone.goto(`${B}/play`, { waitUntil: 'domcontentloaded' });
    }
    await wait(2500);
    await bshot('b01-lobby');

    for (const v of VIEWS) {
      await bctx[v.name].phone.waitForSelector('#nameInput', { timeout: 15000 });
      await bctx[v.name].phone.fill('#nameInput', `Bingo ${v.name}`);
      await bctx[v.name].phone.click('#joinBtn');
    }
    await wait(2000);
    await bshot('b02-joined');

    /* `start`, not `next` — bingo has its own dispatcher and `next` is a quiz
       action, so calling it here left the game sitting in the lobby and every
       screenshot after it was of a lobby. */
    await api('/api/host/start');
    for (let i = 0; i < 25 && (await phase()) === 'lobby'; i += 1) await wait(200);
    await wait(1500);
    if ((await phase()) === 'lobby') found.push('bingo: the game would not start — still in the lobby after `start`');
    await bshot('b03-card');

    /* The tracks under one phone's card, so the calling can actually reach a
       win rather than hoping — and CALLED BY PRESSING THE CALL SHEET, which is
       what a host does and what an API call would not prove. */
    /* The TITLE only — `.bt` — because a cell also carries the artist and the
       call sheet is matched on its own `.tt`. Comparing whole cell text against
       a title never matched, so nothing was ever called and every screen after
       it was of a game that had not started. */
    const cardTitles = await bctx.mobile.phone.evaluate(() =>
      [...document.querySelectorAll('.bingo-cell')].map((n) => {
        const t = n.querySelector('.bt');
        return (t ? t.textContent : n.textContent || '').trim();
      }));
    if (!cardTitles.length) found.push('bingo: the phone was issued no card once the game started');

    const calledCount = () => fetch(`${B}/api/state?role=screen`).then((r) => r.json())
      .then((x) => Number(x.calledCount || (x.called || []).length) || 0).catch(() => 0);

    const callFor = async (titles) => {
      for (const t of titles) {
        const hit = await bctx.desktop.host.evaluate((want) => {
          const box = [...document.querySelectorAll('.trackbox')]
            .find((n) => (n.querySelector('.tt') || n).textContent.trim() === want);
          if (!box || box.classList.contains('called')) return false;
          box.scrollIntoView({ block: 'center' }); box.click(); return true;
        }, t);
        if (hit) await wait(220);
      }
    };
    const before = await calledCount();
    await callFor(cardTitles.slice(0, 5));
    await wait(900);
    if ((await calledCount()) === before) {
      found.push('bingo: tapping a track on the call sheet did not call it — the count did not move');
    }
    await bshot('b04-tracks-called');

    /* MARK ONCE, AND ONLY WHAT HAS BEEN PLAYED.
       A square is good only when it is marked AND called, and a cell TOGGLES —
       so clicking every cell on each pass turned the marks straight back off
       and claimed on squares whose track had never been played. That is a false
       alarm, which is a real state but not the one being tested. */
    const markCalled = async () => {
      for (const v of VIEWS) {
        await bctx[v.name].phone.evaluate(() => {
          for (const c of document.querySelectorAll('.bingo-cell')) {
            if (!c.classList.contains('marked')) c.click();
          }
        });
      }
      await wait(1000);
    };
    await markCalled();
    await bshot('b05-marked');

    /* Then play the WHOLE SHEET rather than matching titles for the rest.
       Matching left two squares uncalled — a title that differs by a character
       between the card and the sheet is enough — and the phone then sat two
       away from a line for ever. Pressing every uncalled box is what a caller
       ends up doing anyway, and it cannot miss. */
    /* ONE AT A TIME. Calling a track pushes state and the call sheet REBUILDS,
       so a loop that grabs every uncalled box and clicks them in one go lands
       the first press and throws the other nineteen at detached nodes — the
       card then sits two squares short for ever and the claim is refused,
       correctly, with "one of those has not been played". */
    /* Read every track's id off the sheet ONCE, then play them. Pressing the
       boxes one by one is what a caller does and it is checked above; for
       getting to a full house it is the wrong tool, because the sheet rebuilds
       under each press and a stale handle silently does nothing. */
    const allIds = await bctx.desktop.host.evaluate(() =>
      [...document.querySelectorAll('.trackbox')].map((n) => n.dataset.id).filter(Boolean));
    for (const id of allIds) { await api('/api/host/call', { trackId: id }); }
    await wait(1200);
    const playedAll = await fetch(`${B}/api/state?role=screen`).then((r) => r.json())
      .then((x) => Number(x.calledCount || 0)).catch(() => 0);
    if (playedAll < allIds.length) {
      found.push(`bingo: only ${playedAll} of ${allIds.length} tracks registered as played`);
    }
    await wait(900);
    await markCalled();
    await markCalled();
    const armed = await bctx.mobile.phone.evaluate(() => {
      const b = document.querySelector('#bingoCall');
      return Boolean(b && !b.disabled);
    });
    await bshot('b06-bingo-armed');
    if (!armed) found.push('bingo: BINGO! never became pressable with every track on the card played and marked');

    if (armed) {
      await bctx.mobile.phone.click('#bingoCall');
      await wait(2200);
      await bshot('b07-claimed');
      const won = await fetch(`${B}/api/state?role=screen`).then((r) => r.json())
        .then((x) => Boolean(x.win)).catch(() => false);
      if (!won) found.push('bingo: BINGO! was pressed on a full line and the projector never showed a win');
    }

    /* On to the next prize, then a fresh round — the two moves a caller makes
       between a claim and the rest of the night. */
    await api('/api/host/playOn');
    await wait(1800);
    await bshot('b08-next-prize');

    await api('/api/host/newRound');
    await wait(2000);
    await bshot('b09-new-round');

    await bctx.mobile.phone.close();
    await bctx.tablet.phone.close();
    await bctx.desktop.phone.close();
  }

  /* AND THE FOUR LOBBY GAMES, which nothing else in this repo looks at. */
  for (const game of GAMES) {
    await api('/api/host/launch', { game: 'quiz', packId: 'qa-stress-test', lobbyGame: game, replace: true });
    await wait(900);
    for (const v of VIEWS) {
      const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h } });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(`${game}/${v.name}: ${e.message}`));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(`${game}/${v.name}: ${m.text().slice(0, 120)}`); });
      await page.goto(`${B}/play`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#nameInput', { timeout: 15000 });
      await page.fill('#nameInput', `${game}-${v.name}`);
      await page.click('#joinBtn');
      await wait(1800);
      const opened = await page.evaluate(() => {
        const b = document.querySelector('.arcade-open');
        if (!b) return false;
        b.scrollIntoView({ block: 'center' }); b.click(); return true;
      });
      if (!opened) found.push(`${game}/${v.name}: no way to open the game from the lobby`);
      await wait(2200);
      const canvas = await page.evaluate(() => {
        const c = document.querySelector('canvas');
        if (!c) return null;
        const r = c.getBoundingClientRect();
        let ink = 0;
        try {
          const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
          for (let i = 0; i < d.length; i += 16) if (d[i] + d[i + 1] + d[i + 2] > 110) ink += 1;
        } catch { ink = -1; }
        return { ink, offBottom: Math.round(Math.max(0, r.bottom - innerHeight)) };
      });
      if (!canvas) found.push(`${game}/${v.name}: the game opened but drew no canvas`);
      else {
        if (canvas.ink === 0) found.push(`${game}/${v.name}: the canvas is blank — nothing drawn`);
        if (canvas.offBottom > 2) found.push(`${game}/${v.name}: the canvas runs ${canvas.offBottom}px below the fold`);
      }
      await page.screenshot({ path: `${SHOTS}/game-${game}__${v.name}.png` });
      note(`${game}/${v.name}`, await page.evaluate(MEASURE));
      await ctx.close();
    }
  }

  await browser.close();
} catch (err) {
  found.push(`the check itself fell over: ${err.message}`);
}

const uniqueErrors = [...new Set(errors)];
console.log(found.length ? 'WHAT A PERSON WOULD SEE\n' : '');
found.forEach((f) => console.log('  ' + f));
if (uniqueErrors.length) {
  console.log('\nERRORS THROWN WHILE THIS RAN\n');
  uniqueErrors.slice(0, 20).forEach((e) => console.log('  ' + e));
}
console.log('');
if (found.length || uniqueErrors.length) {
  console.log(`${found.length} layout problem(s), ${uniqueErrors.length} page error(s). Pictures: ${SHOTS}`);
  process.exitCode = 1;
} else {
  console.log(`Nothing clipped, nothing off screen, nothing under the touch floor, nothing unreachable, no errors.\nPictures: ${SHOTS}`);
}
