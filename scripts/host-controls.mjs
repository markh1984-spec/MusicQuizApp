#!/usr/bin/env node
/**
 * IS EVERY CONTROL ON THE CONTROL VIEW ALIVE? — at every phase of a night.
 *
 * ---
 *
 * `dead-controls.mjs` presses everything on the CONSOLE's five doors. It has
 * never touched `/host`, which is the other half of the protected surface and
 * the only screen a quizmaster drives all night, with a thumb, in a dark pub.
 * Half a dozen guards open the control view to drive a night — press Next,
 * press Reveal — and none of them asks whether the OTHER controls do anything.
 *
 * THE FAULT IT HUNTS IS THIS REPO'S COMMONEST: *"a control that reports
 * success it did not have"*, and *"a dead one draws perfectly"*. It has landed
 * on this very page before — `paintHostNote()` sat inside `draw()`'s
 * `state.kicked` branch, which RETURNS, so the message panel drew for a phone
 * that had been thrown out and for nothing else, while every HTTP check
 * passed.
 *
 * HOW IT DECIDES, and it is `dead-controls.mjs`'s test: fingerprint the page,
 * press, and look for ANY reaction — the DOM changed, a request left, a
 * confirm appeared. A control that produces none of those did nothing.
 *
 * AND IT RE-DRIVES BETWEEN PRESSES, which is the difference from the console.
 * A console door sits still; here a press may genuinely move the night on, so
 * the next probe would be at a different phase and measuring something else.
 * Every control gets a freshly launched night driven to its own phase.
 *
 *   node scripts/host-controls.mjs            # the quiz
 *   node scripts/host-controls.mjs --bingo    # music bingo
 */
import path from 'node:path';
import { startApp } from './helpers/live-app.mjs';
import { playwright } from './helpers/playwright.mjs';
const { chromium } = playwright();

const BINGO = process.argv.includes('--bingo');
const KEY = 'host-controls';
let fails = 0;
const dead = [];
const tiny = [];

/*
 * PRESSES THAT END THE NIGHT ARE NOT PROBED. Not because they are safe to
 * assume — `console-controls.mjs` exists because a rename once DELETED a night
 * — but because each is a one-way door whose own guard drives it properly:
 * Stop and Finish file the evening (`prizes-fuzz`, `bingo-round-ends`), Sign
 * out ends the session. A probe here would measure the teardown rather than
 * the control.
 */
const NEVER_PRESS_TEXT = /^(sign out|stop|finish|end the night|take control|console|open the projector|second screen|photo screen|edit this pack|check the photos|invoice)/i;
/*
 * AND THE ONES THAT ARE MEANT TO DO NOTHING WHEN PRESSED. A control that is
 * already in the state it names is a no-op BY DESIGN, and reporting it fills
 * the list with noise — which teaches somebody to skim past the one real
 * finding underneath. Named, with the reason, exactly as the console's is.
 */
const ALLOWED_INERT = [
  { match: /^(arm|sounds)/i, why: 'the soundboard arms audio; with no gesture yet it may draw nothing' },
  /*
   * A WHO-PICKED ROW WITH NOBODY UNDER IT. The rows fold open to name the
   * teams who chose each option — the host's own line off the mic — so one
   * showing 0 opens onto nothing and the page does not change. That is an
   * empty fold rather than a dead control, and it is worth naming here rather
   * than letting six of them bury a real finding.
   *
   * IT IS STILL A BUTTON A THUMB CAN PRESS FOR NOTHING, which this app's own
   * rule mildly disapproves of ("the reason a control is off goes ON the
   * control"). Left alone deliberately: the count IS the reason, it is printed
   * on the row, and a row that stopped being pressable the moment it emptied
   * would move under the thumb mid-question — which is the worse fault.
   */
  { match: /\s0$/, why: 'a who-picked row with a count of 0 opens onto nothing' },
];

const { base: BASE, stop } = await startApp({
  key: KEY,
  async seed(dir) {
    const { Accounts } = await import('../src/accounts.js');
    const b = new Accounts(path.join(dir, 'accounts.json'));
    b.create({ email: 'o@example.com', password: 'owner passphrase here', name: 'Owner', role: 'owner', status: 'active' });
    b.create({ email: 'qm@example.com', password: 'quizmaster passphrase', name: 'Quizzy', role: 'quizmaster', tier: 'gold', status: 'active' });
    b.save();
  },
});

const J = async (route, opts = {}) => {
  const r = await fetch(`${BASE}${route}`, opts);
  const t = await r.text();
  try { return { status: r.status, body: JSON.parse(t) }; } catch { return { status: r.status, body: t }; }
};
const H = { 'Content-Type': 'application/json', 'X-Host-Key': KEY };
const host = (action, body = {}) => J(`/api/host/${action}`, { method: 'POST', headers: H, body: JSON.stringify(body) });
const view = async () => (await J('/api/state?role=host', { headers: H })).body;

let browser;
try {
  browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 420, height: 900 } })).newPage();
  const errs = [];
  let requests = 0;
  let dialogs = 0;
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(`[console] ${m.text().slice(0, 160)}`); });
  page.on('request', (r) => { if (/\/api\//.test(r.url())) requests += 1; });
  page.on('dialog', (d) => { dialogs += 1; d.dismiss(); });

  const print = () => page.evaluate(() => {
    const main = document.querySelector('main') || document.body;
    const txt = (main.innerText || '').replace(/\s+/g, ' ');
    let h = 0;
    for (let i = 0; i < txt.length; i += 1) h = (h * 31 + txt.charCodeAt(i)) | 0;
    return `${main.innerHTML.length}|${h}|${document.querySelectorAll('*').length}`;
  });

  const controlsHere = () => page.evaluate((neverText) => {
    const out = [];
    const seen = new Set();
    [...document.querySelectorAll('button, [role="button"], a.minor, a.go')].forEach((n) => {
      if (!n.getClientRects().length || n.disabled) return;
      if (n.getAttribute('aria-selected') === 'true' || n.getAttribute('aria-pressed') === 'true') return;
      const label = (n.textContent || n.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40);
      if (!label) return;
      if (new RegExp(neverText, 'i').test(label)) return;
      const r = n.getBoundingClientRect();
      const key = `${n.className}|${label}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ label, cls: String(n.className || '').split(' ')[0], w: Math.round(r.width), h: Math.round(r.height) });
    });
    return out;
  }, NEVER_PRESS_TEXT.source);

  const press = (c) => page.evaluate((want) => {
    const all = [...document.querySelectorAll('button, [role="button"], a.minor, a.go')];
    const hit = all.find((n) => {
      const label = (n.textContent || n.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40);
      return label === want.label && String(n.className || '').split(' ')[0] === want.cls;
    });
    if (!hit) return false;
    hit.click();
    return true;
  }, c);

  /** Launch a fresh night and drive it to a named phase. */
  const driveTo = async (phase) => {
    await host('launch', {
      game: BINGO ? 'bingo' : 'quiz',
      packId: BINGO ? 'mbc-6' : '2000s-2010s-mixed',
      venue: 'The Probe Arms',
      rewards: ['A pint', 'A half', 'A shot'],
      prizes: 3,
      breakPlan: {},
      replace: true,
    });
    const code = (await view()).joinCode || '';
    const players = [];
    for (const name of ['Table One', 'Table Two']) {
      const r = await J('/api/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, joinCode: code }) });
      const me = (r.body && (r.body.you || r.body.player || r.body)) || {};
      if (me.id) players.push({ id: me.id, token: me.token });
    }
    if (phase !== 'lobby') {
      await host('start');
      /*
       * AND THE PHONES ANSWER, which is not decoration.
       *
       * The who-picked rows on the control view fold open to name the teams
       * under each option — the host's own line off the mic. With nobody
       * having answered, every count is 0 and opening one reveals nothing, so
       * a probe reads the whole feature as dead. Two phones answering gives
       * the rows something to hold, which is the state a real gig is in.
       */
      const answer = async () => {
        const v = await view();
        if (v.phase !== 'question') return;
        const n = ((v.question || {}).options || []).length || 4;
        for (let i = 0; i < players.length; i += 1) {
          await J('/api/answer', { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId: players[i].id, token: players[i].token, joinCode: code, optionIndex: i % n }) });
        }
      };
      for (let i = 0; i < 60; i += 1) {
        const v = await view();
        if (v.phase === phase && (phase !== 'reveal' || (v.question || {}).revealedAt)) break;
        /*
         * A BINGO NIGHT MOVES BY CALLING TRACKS, not by `next` — and `won`
         * arrives only when somebody genuinely completes a line, which this
         * drive does by marking every called square on one phone.
         */
        if (v.kind === 'bingo' || Array.isArray(v.tracks)) {
          const nextTrack = (v.tracks || []).find((t) => !t.called);
          if (!nextTrack) break;
          await host('call', { trackId: nextTrack.id });
          if (phase === 'won' && players[0]) {
            const ps = await J(`/api/state?role=player&playerId=${encodeURIComponent(players[0].id)}&g=${encodeURIComponent(code)}`);
            for (const sq of ((ps.body || {}).card || [])) {
              if (sq.called && !sq.marked) {
                await J('/api/mark', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ playerId: players[0].id, token: players[0].token, joinCode: code, index: sq.index, marked: true }) });
              }
            }
            const again = await J(`/api/state?role=player&playerId=${encodeURIComponent(players[0].id)}&g=${encodeURIComponent(code)}`);
            if (((again.body || {}).you || {}).squaresAway === 0) {
              await J('/api/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playerId: players[0].id, token: players[0].token, joinCode: code }) });
            }
          }
          continue;
        }
        if (v.phase === 'question') {
          await answer();
          if (phase === 'question') break;
          await host('reveal');
          if (phase === 'reveal') break;
          continue;
        }
        await host('next');
      }
    }
    await page.goto(`${BASE}/host?key=${KEY}`, { waitUntil: 'load' });
    await page.waitForTimeout(1200);
    return (await view()).phase;
  };

  const PHASES = BINGO ? ['lobby', 'playing', 'won'] : ['lobby', 'rules', 'round_intro', 'question', 'reveal', 'round_board'];
  console.log(`\nPRESSING EVERY CONTROL ON THE CONTROL VIEW — ${BINGO ? 'music bingo' : 'the quiz'}\n`);

  for (const phase of PHASES) {
    const got = await driveTo(phase);
    if (got !== phase) { console.log(`  (skipped ${phase} — the night reached ${got})`); continue; }
    /*
     * THE BUTTON COUNTS PRIZES THE WAY THE HOST DOES ON THE MIC. This night
     * launched with three prizes and three drinks; after the first win the
     * primary must offer the SECOND
     * prize by its ordinal, never "a full house" for whatever comes next.
     */
    if (BINGO && phase === 'won') {
      const label = await page.evaluate(() => (document.querySelector('.actions .primary, button.primary') || {}).textContent || '');
      const ok = /^Play on for the second prize — /.test(label.trim());
      if (!ok) fails += 1;
      console.log(`  ${ok ? 'ok  ' : 'FAIL'} after the first win the button reads "${label.trim()}"`);
    }
    const controls = await controlsHere();
    let pressed = 0;
    for (const c of controls) {
      if (ALLOWED_INERT.some((a) => a.match.test(c.label))) continue;
      if (Math.min(c.w, c.h) < 44) tiny.push({ phase, ...c });
      // A FRESH NIGHT AT THIS PHASE for every press — the last one may have
      // moved the game on, and a probe at the wrong phase measures nothing.
      const at = await driveTo(phase);
      if (at !== phase) continue;
      const before = await print();
      const reqBefore = requests;
      const dlgBefore = dialogs;
      if (!(await press(c))) continue;
      await page.waitForTimeout(700);
      /*
       * A CONTROL THAT ARMS ON THE FIRST PRESS IS PRESSED AGAIN, as a person
       * would — `pressTwice()` in host-bingo.js replaced the native confirm()
       * this guard used to dismiss. The second press is the one that acts.
       */
      const armed = await page.evaluate(() => {
        const b = [...document.querySelectorAll('.actions button')].find((x) => /^Press again/.test(x.textContent.trim()));
        if (!b) return false;
        b.click();
        return true;
      });
      if (armed) await page.waitForTimeout(700);
      const after = await print();
      if (after === before && requests === reqBefore && dialogs === dlgBefore) dead.push({ phase, ...c });
      pressed += 1;
    }
    console.log(`  ${phase} — pressed ${pressed} of ${controls.length}`);
    /*
     * FINISH IS PRESSED TWICE, FOR REAL. It used to ask with a native
     * confirm(), which this guard DISMISSES — so the path behind OK was never
     * driven, and on a gig day the host reported *"nothing at all happens"*.
     * It arms on the first press and acts on the second now; both presses go
     * through the real button, and the night must end.
     */
    if (BINGO && phase === 'playing') {
      const at = await driveTo('playing');
      if (at === 'playing') {
        const twice = await page.evaluate(async () => {
          const find = () => [...document.querySelectorAll('.actions button')].find((b) => /^Finish$|^Press again/.test(b.textContent.trim()));
          const b1 = find(); if (!b1) return 'no Finish button';
          b1.click();
          await new Promise((r) => setTimeout(r, 300));
          const b2 = find(); if (!b2) return 'button vanished after the first press';
          const label = b2.textContent.trim();
          b2.click();
          return label;
        });
        await page.waitForTimeout(900);
        const ended = (await view()).phase === 'finished';
        if (!ended) fails += 1;
        console.log(`  ${ended ? 'ok  ' : 'FAIL'} Finish pressed twice ends the game (armed label "${twice}")`);
      }
    }
  }

  console.log('');
  if (dead.length) {
    fails += dead.length;
    console.log('DEAD — pressed, and nothing at all happened:');
    for (const d of dead) console.log(`  FAIL ${d.phase.padEnd(12)} "${d.label}"  (${d.cls}, ${d.w}x${d.h})`);
  } else console.log('  ok   every control reacted to a press');

  if (tiny.length) {
    console.log('\nUNDER THE 44px TOUCH FLOOR — a thumb misses these, and missing looks like dead:');
    for (const t of tiny) console.log(`  --   ${t.phase.padEnd(12)} "${t.label}"  ${t.w}x${t.h}`);
  }
  if (errs.length) {
    fails += 1;
    console.log('\nTHREW WHILE BEING DRIVEN:');
    for (const e of [...new Set(errs)].slice(0, 10)) console.log(`  FAIL ${e}`);
  } else console.log('\n  ok   nothing threw all night');
} finally {
  if (browser) await browser.close();
  await stop();
}
console.log(fails ? `\n${fails} FAILED` : '\nEvery control on the control view does something.');
process.exit(fails ? 1 : 0);
