#!/usr/bin/env node
/**
 * ASK AGAIN PUTS THE BUTTONS BACK — on the phone that had already answered.
 *
 *   node scripts/ask-again-unlocks.mjs
 *
 * "Ask again" exists for the PA cutting out: the host wipes the answers and
 * the clock and the room goes again. The phone keyed its question card on
 * `q:round:question:phase`, which does not change on a redo — so a phone that
 * had answered never rebuilt, kept its old pick painted, and read *"Locked in.
 * No changing your mind"* for the whole replay. The fastest tables scored
 * nothing, and were told they had answered. Found by the 23 September
 * launch-path sweep, in a real browser; a test that the payload is right
 * proves nothing about whether anybody drew it, so this is a real browser too.
 *
 * It also proves the other half of the same key: a question CORRECTED while it
 * is live (rule 11) reaches the phone's options, which the old key never did.
 */
import { startApp } from './helpers/live-app.mjs';
import { playwright } from './helpers/playwright.mjs';

const { chromium } = playwright();
const KEY = 'askagain';
const PHONE = { width: 390, height: 844 };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const { base: BASE, stop } = await startApp({ key: KEY });

let failures = 0;
const check = (name, got, want) => {
  const ok = got === want;
  if (!ok) failures += 1;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}`);
  if (!ok) console.log(`        wanted ${want}\n        got    ${got}`);
};

let browser;
try {
  const post = (action, body) => fetch(`${BASE}/api/host/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Host-Key': KEY },
    body: JSON.stringify(body || {}),
  }).then((r) => r.json().then((json) => ({ status: r.status, json })));
  const screen = () => fetch(`${BASE}/api/state?role=screen`).then((r) => r.json());

  const library = await (await fetch(`${BASE}/api/library`, { headers: { 'X-Host-Key': KEY } })).json();
  // A pack whose first round is plain text, so the first question has options.
  const pack = (library.quizzes || []).find((p) => (p.rounds || []).some((r) => r.type === 'text')) || (library.quizzes || [])[0];
  await post('launch', { game: 'quiz', packId: pack.id });

  browser = await chromium.launch();
  console.log('\nASK AGAIN — does the phone that answered get its buttons back?\n');

  const page = await browser.newPage({ viewport: PHONE });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  await page.goto(`${BASE}/play`, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  await page.fill('#nameInput', 'Table Nine');
  await page.click('#joinBtn');
  await page.waitForTimeout(1200);

  await post('start', {});
  for (let i = 0; i < 12; i += 1) {
    if ((await screen()).phase === 'question') break;
    await post('next', {});
    await wait(150);
  }
  await page.waitForTimeout(1200);
  const live = () => page.evaluate(() => ({
    live: [...document.querySelectorAll('.answer-btn')].filter((b) => !b.disabled).length,
    hint: document.getElementById('pHint')?.textContent || '',
    options: [...document.querySelectorAll('.answer-btn')].map((b) => b.textContent.trim()),
  }));
  check('a question is up with options on the phone', (await live()).live > 0, true);

  // The phone answers, and is locked in — correctly.
  await page.locator('.answer-btn').first().click();
  await page.waitForTimeout(900);
  const answered = await live();
  check('after answering the phone is locked in', answered.live, 0);

  // The PA cut out: the host asks the question again.
  const redo = await post('redo', {});
  check('the host could ask again', redo.status, 200);
  const cleared = await screen();
  check('and the server wiped the answers', cleared.answeredCount || 0, 0);
  await page.waitForTimeout(1500);
  const again = await live();
  check('the phone that answered has live buttons again', again.live > 0, true);
  check('and no longer says it is locked in', /locked in/i.test(again.hint), false);

  // It can answer the replay. A click on a disabled button waits for ever in
  // Playwright, so it is only attempted when the buttons are live — and the
  // check above has already said so if they are not.
  if (again.live > 0) {
    await page.locator('.answer-btn').first().click({ timeout: 3000 });
    await page.waitForTimeout(900);
  }
  check('and its answer on the replay lands', (await screen()).answeredCount, 1);

  /*
   * THE SAME KEY, THE OTHER WAY — a correction to the LIVE question reaches
   * the phone's options. Rule 11 says every copy; the phone was the copy it
   * never reached.
   */
  const hostView = (await fetch(`${BASE}/api/state?role=host&key=${KEY}`, { headers: { 'X-Host-Key': KEY } })).json ? await (await fetch(`${BASE}/api/state?role=host&key=${KEY}`, { headers: { 'X-Host-Key': KEY } })).json() : null;
  const full = await (await fetch(`${BASE}/api/quiz/${encodeURIComponent(pack.id)}?key=${KEY}`, { headers: { 'X-Host-Key': KEY } })).json();
  const quiz = full.quiz || full;
  const ri = hostView ? hostView.roundIndex : 0;
  const qi = hostView ? hostView.questionIndex : 0;
  const q = quiz.rounds[ri].questions[qi];
  const before = (await live()).options;
  if (Array.isArray(q.options) && q.options.length) {
    q.options[q.options.length - 1] = `${q.options[q.options.length - 1]} (FIXED)`;
    const saved = await fetch(`${BASE}/api/quiz/${encodeURIComponent(pack.id)}?key=${KEY}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Host-Key': KEY },
      body: JSON.stringify({ ...quiz, confirmLive: true }),
    });
    check('a correction to the live question was saved', saved.ok, true);
    await page.waitForTimeout(1500);
    const after = (await live()).options;
    check('and it reached the phone', after.some((o) => /\(FIXED\)$/.test(o)), true);
    check('(the options had changed on the wire)', before.join('|') !== after.join('|'), true);
  } else {
    console.log('  --    (the live question has no options to correct; skipped)');
  }

  check('nothing threw on the phone', errors.join(' | ') || 'none', 'none');
  console.log(failures ? `\n${failures} check(s) failed.\n` : '\nAsk again gives the room its buttons back.\n');
  process.exitCode = failures ? 1 : 0;
} catch (err) {
  console.error('\nthrew:', err.message, '\n');
  process.exitCode = 1;
} finally {
  try { await browser?.close(); } catch { /* already gone */ }
  stop();
}
