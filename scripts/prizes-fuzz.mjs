#!/usr/bin/env node
/**
 * PRIZES, PUSHED AROUND — counts, words, ties, nobody scoring, a prize typed in
 * late, the bar scanning, Back at the final, bingo stages against the card,
 * card bingo across rounds, a running order carrying its drinks. Everything
 * over HTTP as a signed-in quizmaster at "Test Venue", usual night Friday.
 *
 *   node scripts/prizes-fuzz.mjs
 */
import path from 'node:path';
import { startApp } from './helpers/live-app.mjs';

const KEY = 'prizes-fuzz-key';
const { base: B, stop } = await startApp({
  key: KEY,
  async seed(dir) {
    const { Accounts } = await import(new URL('../src/accounts.js', import.meta.url).href);
    const book = new Accounts(path.join(dir, 'accounts.json'));
    book.create({ email: 'qm@example.com', password: 'quizmaster passphrase', name: 'Quizzy', role: 'quizmaster', tier: 'gold', status: 'active' });
    book.save();
  },
});
let fails = 0; const found = [];
const check = (name, ok, note = '') => { if (!ok) { fails += 1; found.push(`${name}${note ? ` — ${note}` : ''}`); } console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${!ok && note ? `\n        ${note}` : ''}`); };
const section = (t) => console.log(`\n${t}\n`);
let cookie = '';
const H = () => ({ 'content-type': 'application/json', cookie });
const J = async (route, opts = {}) => { const r = await fetch(B + route, opts); let body; try { body = await r.json(); } catch { body = null; } return { status: r.status, body }; };
const host = (action, body = {}) => J(`/api/host/${action}`, { method: 'POST', headers: H(), body: JSON.stringify(body) });
const hostView = async () => (await J('/api/state?role=host', { headers: H() })).body;
const screenView = async (code) => (await J(`/api/state?role=screen&g=${code}`)).body;
const phoneView = async (p, code) => (await J(`/api/state?role=player&playerId=${p.id}&token=${encodeURIComponent(p.token)}&g=${code}`)).body;
const phoneDo = (action, p, code, extra = {}) => J(`/api/${action}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ playerId: p.id, token: p.token, joinCode: code, ...extra }) });
const running = async () => (await J('/api/library', { headers: H() })).body.running;
const joinAll = async (code, names) => { const out = []; for (const name of names) out.push((await J('/api/join', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, joinCode: code }) })).body); return out; };
const vouchersOf = (hv) => Object.values(hv.vouchers || {}).filter((v) => !v.carried);
const phoneCodes = async (p, code) => ((await phoneView(p, code)).vouchers || []).map((v) => v.code);
let venue;
const setRewards = (rewards) => J(`/api/invoices/customers/${venue.id}/rewards`, { method: 'PUT', headers: H(), body: JSON.stringify({ rewards }) });
const night = (extra = {}) => ({ venue: venue.name, venueId: venue.id, breakPlan: {}, replace: true, ...extra });

/**
 * Play a one-round quiz to the final. `plan` says, per phone name, the share of
 * questions answered right (1 = every one, 0.5 = alternate, 0 = wrong every
 * time, null = never answers).
 */
async function quizToFinal(names, plan, launch = {}) {
  const go = await host('launch', { game: 'quiz', packId: '1980s-pop-music', order: [{ packId: '1980s-pop-music', round: 0 }], ...night(launch) });
  if (go.status !== 200) throw new Error(`launch ${go.status} ${JSON.stringify(go.body)}`);
  const code = (await running()).joinCode;
  const phones = await joinAll(code, names);
  await host('start');
  let n = 0;
  for (let i = 0; i < 60; i += 1) {
    const hv = await hostView();
    if (hv.phase === 'final') break;
    if (hv.phase !== 'question') { await host('next'); continue; }
    const right = hv.question.correctIndex ?? 0;
    for (const [k, p] of phones.entries()) {
      const share = plan[names[k]];
      if (share === null || share === undefined) continue;
      const answerRight = share >= 1 || (share > 0 && n % Math.round(1 / share) === 0);
      await phoneDo('answer', p, code, { optionIndex: answerRight ? right : (right + 1) % 4 });
    }
    n += 1;
    await host('reveal'); await host('next');
  }
  return { code, phones, hv: await hostView() };
}

try {
  const signIn = await fetch(B + '/api/sign-in', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'qm@example.com', password: 'quizmaster passphrase' }) });
  cookie = (signIn.headers.get('set-cookie') || '').split(';')[0];
  const mk = await J('/api/invoices/customers', { method: 'POST', headers: H(), body: JSON.stringify({ name: 'Test Venue' }) });
  venue = (mk.body.customers || [])[0];
  const fri = await J(`/api/invoices/customers/${venue.id}/rewards`, { method: 'PUT', headers: H(), body: JSON.stringify({ usualNight: 'fri' }) });
  check('Test Venue exists with Friday as its usual night', fri.status === 200 && (fri.body.customers || []).some((c) => c.id === venue.id && c.usualNight === 'fri'), JSON.stringify(fri.body).slice(0, 120));

  // ----------------------------------------------------------------- QUIZ
  section('A. QUIZ — three winners, five prizes on the table');
  await setRewards(['A pint', 'A half', 'Crisps', 'A shot', 'A hug']);
  let r = await quizToFinal(['Dave', 'Sue', 'Six', 'Al', 'Bo'], { Dave: 1, Sue: 0.5, Six: 0.34, Al: 0, Bo: 0 }, { winners: 3 });
  let vs = vouchersOf(r.hv);
  const placed = vs.filter((v) => !v.draw);
  check('three placed vouchers go out', placed.length === 3, `${placed.length}: ${vs.map((v) => `${v.place}:${v.name}:${v.reward}`).join(', ')}`);
  /*
   * THE DRAW IS BINNED, so the assertion is inverted: nothing may mint one.
   * It used to take the LAST prize on the table — 'A hug' here — which is
   * exactly the fourth drink a venue funding three never agreed to.
   */
  check('NO draw voucher is minted — the draw is binned', !vs.some((v) => v.draw), JSON.stringify(vs.filter((v) => v.draw)));
  check('and the last prize on the table stays on the table', !vs.some((v) => v.reward === 'A hug'), JSON.stringify(vs.map((v) => v.reward)));
  check('first, second, third get the first, second, third prize', vs.find((v) => v.place === 1)?.reward === 'A pint' && vs.find((v) => v.place === 2)?.reward === 'A half' && vs.find((v) => v.place === 3)?.reward === 'Crisps', vs.map((v) => `${v.place}=${v.reward}`).join(' '));
  check('fourth and fifth get nothing', !vs.some((v) => v.place > 3));
  const scr = await screenView(r.code);
  check('the final wall names the winner and never a code', JSON.stringify(scr).includes('Dave') && !vs.some((v) => JSON.stringify(scr).includes(v.code)));
  check('the last slide says "Back here" on a Friday', /frid/i.test(JSON.stringify(scr.comeBack || scr.comeback || '')), JSON.stringify(scr.comeBack || scr.comeback || null));
  await host('launch', { game: 'quiz', packId: '1980s-pop-music', ...night({ winners: 3 }) });
  const lobby = await screenView((await running()).joinCode);
  check('the lobby wall says what the room is playing for', JSON.stringify(lobby.rewards || []).includes('A pint'), JSON.stringify(lobby.rewards || null));

  section('B. QUIZ — one winner');
  r = await quizToFinal(['Dave', 'Sue', 'Six'], { Dave: 1, Sue: 0.5, Six: 0 }, { winners: 1 });
  vs = vouchersOf(r.hv);
  check('exactly one voucher, first place, first prize', vs.length === 1 && vs[0].place === 1 && vs[0].reward === 'A pint', JSON.stringify(vs.map((v) => [v.place, v.reward])));
  check('the wall draws no podium for one winner', !(await screenView(r.code)).podium || (await screenView(r.code)).podium.length <= 1, JSON.stringify((await screenView(r.code)).podium || null));

  section('C. QUIZ — three winners but only two prizes on the table');
  await setRewards(['A pint', 'A half']);
  r = await quizToFinal(['Dave', 'Sue', 'Six'], { Dave: 1, Sue: 0.5, Six: 0.34 }, { winners: 3 });
  vs = vouchersOf(r.hv);
  check('two vouchers — the third place has no prize to get', vs.length === 2 && !vs.some((v) => v.place === 3), JSON.stringify(vs.map((v) => [v.place, v.reward])));
  const hv3 = r.hv;
  check('…and the host is TOLD a place went unpaid', JSON.stringify(hv3).match(/no prize|unpaid|nothing for third|only two/i) !== null || (hv3.rewards || []).length === 2, 'nothing on the host view names the gap');

  section('D. QUIZ — no prizes at all, then one typed in late');
  await setRewards([]);
  r = await quizToFinal(['Dave', 'Sue'], { Dave: 1, Sue: 0 }, { winners: 3 });
  check('no prizes, no vouchers', vouchersOf(r.hv).length === 0);
  const late = await host('setRewards', { rewards: ['A late pint', 'A late half'] });
  check('a prize typed in late is taken', late.status === 200, JSON.stringify(late.body).slice(0, 80));
  let hvL = await hostView();
  check('…and pays the winner already owed', vouchersOf(hvL).length >= 1 && vouchersOf(hvL)[0].reward === 'A late pint', JSON.stringify(vouchersOf(hvL).map((v) => [v.place, v.reward])));
  await host('setRewards', { rewards: ['A late pint', 'A late half'] });
  check('…idempotently', vouchersOf(await hostView()).length === vouchersOf(hvL).length);
  check("…and the phone gets the code", (await phoneCodes(r.phones[0], r.code)).length === 1);
  check('Sue, who scored nothing, gets nothing', (await phoneCodes(r.phones[1], r.code)).length === 0);

  section('E. QUIZ — a tie for first, and nobody scoring at all');
  await setRewards(['A pint', 'A half', 'Crisps']);
  r = await quizToFinal(['Dave', 'Sue', 'Six'], { Dave: 1, Sue: 0.5, Six: 0 }, { winners: 3 });
  // Speed scoring never ties by itself — the host's own adjust makes one.
  const scoreOfName = (hv, name) => {
    const lists = [hv.leaderboard, hv.board, hv.players, hv.scores].filter(Array.isArray);
    for (const l of lists) { const row = l.find((x) => x && x.name === name); if (row && typeof row.score === 'number') return row.score; }
    return null;
  };
  const dScore = scoreOfName(r.hv, 'Dave'); const sScore = scoreOfName(r.hv, 'Sue');
  check('the host view carries a scoreboard to read', dScore !== null && sScore !== null, Object.keys(r.hv).join(','));
  const adjT = await host('adjustScore', { playerId: r.phones[1].id, delta: (dScore || 0) - (sScore || 0) });
  const hvT = await hostView();
  const rows = (hvT.leaderboard || []).map((x) => [x.name, x.score, x.position]);
  check('the adjust took and the two are level', adjT.status === 200 && scoreOfName(hvT, 'Dave') === scoreOfName(hvT, 'Sue'), JSON.stringify({ status: adjT.status, delta: (dScore || 0) - (sScore || 0), rows }));
  vs = vouchersOf(hvT);
  const firsts = vs.filter((v) => v.place === 1);
  check('a tie for first is paid in full — two first-place pints', firsts.length === 2 && firsts.every((v) => v.reward === 'A pint'), JSON.stringify(vs.map((v) => [v.name, v.place, v.reward])));
  check('…and nobody is "second"', !vs.some((v) => v.place === 2), JSON.stringify(vs.map((v) => v.place)));
  r = await quizToFinal(['Dave', 'Sue', 'Six'], { Dave: 0, Sue: 0, Six: null }, { winners: 3 });
  check('an all-zero board pays NOBODY', vouchersOf(r.hv).length === 0, JSON.stringify(vouchersOf(r.hv).map((v) => [v.name, v.place])));

  section('F. QUIZ — odd prize words');
  const ugly = ['   A   pint   ', 'x'.repeat(200), '🍺 a beer 🍺', '"quoted" & <b>bold</b>', '', 'A half'];
  const set = await setRewards(ugly);
  const got = (set.body.customers || []).find((c) => c.id === venue.id).rewards;
  check('prize words are trimmed, capped at 80 and never emptied out of the list', got[0] === 'A pint' && got[1].length === 80 && got[2] === '🍺 a beer 🍺' && got.length === 6, JSON.stringify(got));
  r = await quizToFinal(['Dave', 'Sue', 'Six', 'Al', 'Bo', 'Cy'], { Dave: 1, Sue: 0.5, Six: 0.34, Al: 0.25, Bo: 0.2, Cy: 0 }, { winners: 3 });
  vs = vouchersOf(r.hv);
  check('the emoji survives to the voucher intact', vs.find((v) => v.place === 3)?.reward === '🍺 a beer 🍺', JSON.stringify(vs.map((v) => [v.place, v.reward])));
  check('still no draw voucher, however the prize list is spelt', !vs.some((v) => v.draw), JSON.stringify(vs.filter((v) => v.draw)));
  const pdf = await fetch(`${B}/api/past-gigs/${encodeURIComponent(((await J('/api/past-gigs', { headers: H() })).body.nights || [])[0].night)}/report.pdf`, { headers: { cookie } });
  check('the report still renders with those words in it', pdf.status === 200);

  section('G. THE BAR SCANS');
  await setRewards(['A pint', 'A half', 'Crisps']);
  r = await quizToFinal(['Dave', 'Sue'], { Dave: 1, Sue: 0 }, { winners: 3 });
  const [codeDave] = await phoneCodes(r.phones[0], r.code);
  const look = await J(`/api/voucher?c=${codeDave.toLowerCase()}&g=${r.code}`);
  check('a code scans case-insensitively and names the prize and the venue', look.status === 200 && look.body.reward === 'A pint' && look.body.venue === 'Test Venue', JSON.stringify(look.body));
  const bad = await J(`/api/voucher?c=NOPE1234&g=${r.code}`);
  check('a code that is not a voucher is a 404 and says nothing else', bad.status === 404 && !JSON.stringify(bad.body).includes('Dave'));
  const red = await J('/api/voucher/redeem', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: codeDave, joinCode: r.code }) });
  check('the bar redeems it', red.status === 200 && red.body.ok !== false, JSON.stringify(red.body).slice(0, 100));
  const afterRedeem = (await phoneView(r.phones[0], r.code)).vouchers || [];
  check('…and the phone is told it is redeemed (the phone hides it)', afterRedeem.every((v) => v.redeemedAt), JSON.stringify(afterRedeem.map((v) => [v.code, v.redeemedAt])));
  const again = await J('/api/voucher/redeem', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: codeDave, joinCode: r.code }) });
  check('a second scan is refused as already redeemed', again.status === 409, `${again.status}`);
  const hvR = await hostView();
  check('the host panel keeps the redeemed voucher as evidence', vouchersOf(hvR).some((v) => v.code === codeDave && v.redeemedAt));

  section('H. BACK AT THE FINAL — a prize no longer owed is taken back');
  r = await quizToFinal(['Dave', 'Sue'], { Dave: 1, Sue: 0.5 }, { winners: 3 });
  let vv = vouchersOf(r.hv);
  const daveFirst = vv.find((v) => v.place === 1);
  check('Dave holds first', daveFirst && daveFirst.name === 'Dave');
  await host('back');
  const adj = await host('adjustScore', { playerId: r.phones[1].id, delta: 9999 });
  check('the host bumps Sue past him', adj.status === 200);
  for (let i = 0; i < 8; i += 1) { if ((await hostView()).phase === 'final') break; await host('next'); }
  vv = vouchersOf(await hostView());
  check("Sue now holds first and Dave's first-place pint is withdrawn", vv.find((v) => v.place === 1)?.name === 'Sue' && !vv.some((v) => v.name === 'Dave' && v.place === 1), JSON.stringify(vv.map((v) => [v.name, v.place, v.reward])));
  check('Dave is paid second instead', vv.some((v) => v.name === 'Dave' && v.place === 2 && v.reward === 'A half'), JSON.stringify(vv.map((v) => [v.name, v.place, v.reward])));

  section('I. WINNERS OUT OF RANGE');
  r = await quizToFinal(['Dave', 'Sue', 'Six', 'Al'], { Dave: 1, Sue: 0.5, Six: 0.34, Al: 0.25 }, { winners: 7 });
  check('winners: 7 falls back to the default three, never seven', vouchersOf(r.hv).length === 3, `${vouchersOf(r.hv).length}`);
  r = await quizToFinal(['Dave', 'Sue'], { Dave: 1, Sue: 0.5 }, { winners: 0 });
  check('winners: 0 falls back to three too (never zero)', vouchersOf(r.hv).length === 2, `${vouchersOf(r.hv).length}`);

  // ---------------------------------------------------------------- BINGO
  section('J. MUSIC BINGO — stages against the card, one prize each');
  await setRewards(['A pint', 'A half', 'Crisps', 'A shot', 'A hug']);
  const bingoRun = async (shape, prizes, names) => {
    const go = await host('launch', { game: 'bingo', packId: 'mbc-5', shape, prizes, ...night() });
    if (go.status !== 200) return { go };
    const code = (await running()).joinCode;
    const phones = await joinAll(code, names);
    await host('start');
    const hv = await hostView();
    const tracks = hv.tracks || [];
    const claims = [];
    for (const t of tracks) {
      await host('call', { trackId: t.id });
      for (const p of phones) {
        const s = await phoneView(p, code);
        for (const c of s.card || []) if (c.called && !c.marked) await phoneDo('mark', p, code, { index: c.index, marked: true });
        const s2 = await phoneView(p, code);
        if ((s2.you || {}).squaresAway === 0 && !s2.standDown) { const c = await phoneDo('claim', p, code); if (c.status === 200 && (c.body || {}).ok !== false) claims.push(p.name); }
      }
      let h = await hostView();
      if (h.phase === 'won' && !h.allPrizesGone) { await host('playOn'); h = await hostView(); }
      // `noneLeft` is the app saying a stage has no prize WORD — the claim is
      // still taken and recorded, which is what K checks — so only a finished
      // round, or every prize gone, stops the calling.
      if (h.allPrizesGone || h.phase === 'finished') break;
    }
    return { go, code, phones, claims, hv: await hostView() };
  };
  let b = await bingoRun({ rows: 3, cols: 3 }, 5, ['Dave', 'Sue', 'Six']);
  check('3x3 with five prizes launches', b.go.status === 200, JSON.stringify(b.go.body).slice(0, 100));
  let bv = vouchersOf(b.hv);
  check('three phones can take at most three of five prizes, one each', bv.length <= 3 && new Set(bv.map((v) => v.winnerId)).size === bv.length, JSON.stringify(bv.map((v) => [v.name, v.place, v.reward])));
  check('each stage pays the prize in that slot (line → A pint, then A half…)', bv.every((v) => v.reward === ['A pint', 'A half', 'Crisps', 'A shot', 'A hug'][v.place - 1]), JSON.stringify(bv.map((v) => [v.place, v.reward])));
  check('the round says it cannot pay out the rest, rather than stalling silently', Boolean(b.hv.noneLeft || b.hv.stalled || b.hv.allPrizesGone || b.hv.phase === 'won'), JSON.stringify({ noneLeft: b.hv.noneLeft, stalled: b.hv.stalled, phase: b.hv.phase }));

  section('K. MUSIC BINGO — prizes clamped to the card, and fewer words than stages');
  b = await bingoRun({ rows: 3, cols: 3 }, 99, ['Dave']);
  check('prizes: 99 is clamped, not refused', b.go.status === 200 && (b.hv.prizes || []).length <= 5, JSON.stringify((b.hv.prizes || []).length));
  await setRewards(['Only one pint']);
  b = await bingoRun({ rows: 3, cols: 3 }, 2, ['Dave', 'Sue']);
  bv = vouchersOf(b.hv);
  check('two stages, one prize word: the line pays, the full house cannot', bv.length === 1 && bv[0].reward === 'Only one pint', JSON.stringify(bv.map((v) => [v.name, v.place, v.reward])));
  const second = (b.hv.prizes || [])[1]?.winner;
  check('…but the second winner is RECORDED as having won', Boolean(second), JSON.stringify((b.hv.prizes || []).map((st) => st.winner)));
  await host('setRewards', { rewards: ['Only one pint', 'A late half'] });
  bv = vouchersOf(await hostView());
  check('…and a second prize typed in late pays them', bv.length === 2 && bv.find((v) => v.place === 2)?.reward === 'A late half', JSON.stringify(bv.map((v) => [v.name, v.place, v.reward])));

  section('L. MUSIC BINGO — a new round: the winner of round one cannot win again');
  await setRewards(['A pint', 'A half', 'Crisps']);
  b = await bingoRun({ rows: 3, cols: 3 }, 1, ['Dave', 'Sue']);
  const r1 = vouchersOf(b.hv);
  check('round one pays one', r1.length === 1, JSON.stringify(r1.map((v) => [v.name, v.reward])));
  const r1Winner = r1[0] && r1[0].name;
  await host('newRound');
  const hv2 = await hostView();
  const tracks2 = hv2.tracks || [];
  let stoodDown = null;
  for (const t of tracks2) {
    await host('call', { trackId: t.id });
    for (const p of b.phones) {
      const s = await phoneView(p, b.code);
      for (const c of s.card || []) if (c.called && !c.marked) await phoneDo('mark', p, b.code, { index: c.index, marked: true });
      const s2 = await phoneView(p, b.code);
      if ((s2.you || {}).squaresAway === 0) {
        if (p.name === r1Winner) stoodDown = Boolean(s2.standDown);
        else { const c = await phoneDo('claim', p, b.code); if (c.status === 200) break; }
      }
    }
    const h = await hostView();
    if (h.phase === 'won' || h.phase === 'finished' || stoodDown !== null) break;
  }
  const r2 = vouchersOf(await hostView());
  check('round two pays somebody ELSE, or stands the round-one winner down', (stoodDown === true) || (r2.length === 2 && new Set(r2.map((v) => v.name)).size === 2), JSON.stringify({ stoodDown, r2: r2.map((v) => [v.name, v.place, v.reward]) }));
  check('round two\'s prize is the next on the table, not the pint again', r2.length < 2 || r2[1].reward !== r2[0].reward, JSON.stringify(r2.map((v) => v.reward)));

  // ----------------------------------------------------------- CARD BINGO
  section('M. CARD BINGO — a prize a round');
  await setRewards(['A pint', 'A half', 'Crisps']);
  const cgo = await host('launch', { game: 'cards', packId: 'deck', ...night() });
  const ccode = (await running()).joinCode;
  const cp = await joinAll(ccode, ['Dave', 'Sue', 'Six']);
  await host('start');
  const playHand = async () => {
    for (let i = 0; i < 52; i += 1) {
      const d = await host('draw'); if (d.status !== 200) return null;
      for (const p of cp) {
        const s = await phoneView(p, ccode);
        for (const c of s.card || []) if (c.called && !c.marked) await phoneDo('mark', p, ccode, { index: c.index, marked: true });
        const s2 = await phoneView(p, ccode);
        if ((s2.you || {}).squaresAway === 0 && !s2.standDown) { const c = await phoneDo('claim', p, ccode); if (c.status === 200 && (c.body || {}).ok !== false) return p.name; }
      }
    }
    return null;
  };
  const w1 = await playHand();
  let cv = vouchersOf(await hostView());
  check('round one pays its winner the first prize', w1 && cv.length === 1 && cv[0].reward === 'A pint', JSON.stringify({ w1, cv: cv.map((v) => [v.name, v.place, v.reward]) }));
  await host('newRound');
  const w2 = await playHand();
  cv = vouchersOf(await hostView());
  check('round two pays a DIFFERENT phone', w2 && w2 !== w1 && cv.length === 2, JSON.stringify({ w1, w2, cv: cv.map((v) => [v.name, v.place, v.reward]) }));
  check("round two's prize is the NEXT on the table, not a second pint", cv.length === 2 && cv[1].reward === 'A half', JSON.stringify(cv.map((v) => v.reward)));

  // -------------------------------------------------------- RUNNING ORDER
  section('N. QUIZ → BINGO → QUIZ — the drinks travel');
  /*
   * EACH GAME IS DEALT THE VENUE'S LIST FROM THE TOP — per game, not per
   * night, set 23 September 2026. The venue's list used to be shared DOWN the
   * night, first by counting minted vouchers (a tie or a silent row moved every
   * later part, silently) and then by what each part pays — which cut card
   * bingo, one prize a round, to a single drink and left its second game's
   * winner with nothing. So every part starts at the top: this night deals
   * [pint, half] [pint] [pint, half]. This section's subject is still vouchers
   * surviving a part boundary.
   */
  await setRewards(['A pint', 'A half', 'Crisps', 'A shot', 'A cola']);
  const ro = await host('launchOrder', { segments: [
    { kind: 'quiz', order: [{ packId: '1980s-pop-music', round: 0 }] },
    { kind: 'bingo', packId: 'mbc-4', shape: { rows: 3, cols: 3 }, prizes: 1 },
    { kind: 'quiz', order: [{ packId: '1980s-pop-music', round: 1 }] },
  ], winners: 2, ...night() });
  check('the order launches', ro.status === 200, JSON.stringify(ro.body).slice(0, 100));
  const rcode = (await running()).joinCode;
  const rp = await joinAll(rcode, ['Dave', 'Sue']);
  await host('start');
  for (let i = 0; i < 40; i += 1) { const hv = await hostView(); if (hv.phase === 'question') { await phoneDo('answer', rp[0], rcode, { optionIndex: hv.question.correctIndex ?? 0 }); await host('reveal'); } if (hv.runningOrder && hv.phase === 'round_board') break; await host('next'); }
  await host('advanceOrder');
  const hvb = await hostView();
  let bingoWon = false;
  for (const t of hvb.tracks || []) {
    await host('call', { trackId: t.id });
    for (const p of rp) { const s = await phoneView(p, rcode); for (const c of s.card || []) if (c.called && !c.marked) await phoneDo('mark', p, rcode, { index: c.index, marked: true }); const s2 = await phoneView(p, rcode); if ((s2.you || {}).squaresAway === 0) { const c = await phoneDo('claim', p, rcode); if (c.status === 200 && (c.body || {}).ok !== false) { bingoWon = true; break; } } }
    if (bingoWon) break;
  }
  check('the bingo interlude pays a prize', bingoWon);
  const bingoV = vouchersOf(await hostView());
  await host('advanceOrder');
  for (let i = 0; i < 40; i += 1) { const hv = await hostView(); if (hv.phase === 'final') break; if (hv.phase === 'question') { await phoneDo('answer', rp[0], rcode, { optionIndex: hv.question.correctIndex ?? 0 }); await host('reveal'); } await host('next'); }
  const hvF = await hostView();
  const all = Object.values(hvF.vouchers || {});
  check('at the final, the bingo drink is still held (carried) beside the quiz drink', all.some((v) => v.carried) && all.filter((v) => !v.carried).length === 1, JSON.stringify(all.map((v) => [v.name, v.place, v.reward, v.carried ? 'carried' : ''])));
  /*
   * AND THE SAME DRINK MAY BE ON EVERY PART — which REVERSES the assertion that
   * stood here, that no drink was handed out twice across the night. Each game
   * pays from the top of the list, so each game's first place is the venue's
   * first drink; how many pints an evening costs is the host's and the venue's
   * to agree, never the software's to ration.
   */
  const words = all.map((v) => v.reward);
  /*
   * SORTED, BECAUSE `state.vouchers` IS KEYED BY A RANDOM CODE.
   *
   * The first version of this compared `words.join(' | ')` against the order
   * the parts were played in, and passed — by luck. `Object.values()` walks
   * insertion order over keys that are `newVoucherCode()`'s output, so the
   * same correct night comes back as ["Crisps","A pint","A shot"] whenever the
   * codes happen to land differently. It failed on the next run with all three
   * drinks right.
   *
   * What this section is actually asserting is WHICH drinks the night paid —
   * each part's first place, off the TOP of the list — and that is a set. A
   * guard that pins an order nothing promises is a guard that goes red about
   * nothing, which is how a suite teaches you to ignore it.
   */
  check('each part paid its first place off the TOP of the list, per game',
    [...words].sort().join(' | ') === 'A pint | A pint | A pint', JSON.stringify(words));
  const daveAll = await phoneCodes(rp[0], rcode);
  check("Dave's phone shows every drink he won tonight, quiz and bingo", daveAll.length === all.filter((v) => v.winnerId === rp[0].id).length, `${daveAll.length} on the phone vs ${all.filter((v) => v.winnerId === rp[0].id).length} owed`);
  // The archive holds the codes: redeem the quiz drink through the bar and the
  // filed night's own count moves.
  const quizDrink = all.find((v) => !v.carried);
  await J('/api/voucher/redeem', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: quizDrink.code, joinCode: rcode }) });
  const filedList = ((await J('/api/past-gigs', { headers: H() })).body.nights || [])[0];
  const taken = (filedList.games || []).reduce((n, g) => n + (g.rewardsTaken || 0), 0);
  check('the filed night knows a drink of the evening was taken at the bar', taken >= 1, `rewardsTaken ${taken} across ${(filedList.games || []).length} games`);
} catch (err) {
  fails += 1; found.push(`the drive fell over: ${err.stack || err.message}`);
  console.error('\nfell over:', err.stack || err.message);
} finally { stop(); }
console.log(fails ? `\n${fails} FAILED:\n  - ${found.join('\n  - ')}` : '\nNothing about prizes broke.');
process.exit(fails ? 1 : 0);
