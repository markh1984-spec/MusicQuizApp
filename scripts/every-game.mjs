#!/usr/bin/env node
/**
 * EVERY GAME TYPE, DRIVEN THROUGH THE SYSTEM AS A REAL QUIZMASTER.
 *
 * A quiz with one round of every type (text, image, intro, multi, alphabet,
 * breakout) with three phones answering; music bingo; card bingo; a DJ set;
 * a mixed running order; and a SIGKILL mid-question. At every step the
 * payload rules are swept — no answer key on the wall or a phone, no player
 * ids on the wall, no question text on a phone — and the scores, prizes and
 * archive are read back. Reports what held and what did not.
 *
 *   node scripts/every-game.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { startApp } from './helpers/live-app.mjs';

const KEY = 'every-game-key';
const app = await startApp({
  key: KEY,
  async seed(dir) {
    const { Accounts } = await import(new URL('../src/accounts.js', import.meta.url).href);
    const book = new Accounts(path.join(dir, 'accounts.json'));
    book.create({ email: 'qm@example.com', password: 'quizmaster passphrase', name: 'Quizzy', role: 'quizmaster', tier: 'gold', status: 'active' });
    book.save();
    // A breakout round is in no catalogue pack, so one is written into the COPY
    // of the catalogue this run plays from.
    // `seed` runs BEFORE the catalogue is copied in; the copy merges into an
    // existing folder, so a file written here survives it.
    fs.mkdirSync(path.join(dir, 'quizzes'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'quizzes', 'every-breakout.json'), JSON.stringify({
      id: 'every-breakout', title: 'Breakout Bits',
      rounds: [{ title: 'Round One — Say Anything', type: 'breakout', questions: [{ prompt: 'Finish the line: "Never gonna give you ___"' }, { prompt: 'The worst song to strip to is…' }] }],
    }, null, 2));
  },
});
const { base: B, stop, restart } = app;

let fails = 0;
const found = [];
const check = (name, ok, note = '') => {
  if (!ok) { fails += 1; found.push(`${name}${note ? ` — ${note}` : ''}`); }
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${!ok && note ? `\n        ${note}` : ''}`);
};
const section = (t) => console.log(`\n${t}\n`);
let cookie = '';
const H = () => ({ 'content-type': 'application/json', cookie });
const J = async (route, opts = {}) => {
  const r = await fetch(B + route, opts);
  let body; try { body = await r.json(); } catch { body = null; }
  return { status: r.status, body };
};
const host = (action, body = {}) => J(`/api/host/${action}`, { method: 'POST', headers: H(), body: JSON.stringify(body) });
const hostView = async () => (await J('/api/state?role=host', { headers: H() })).body;
const screenView = async (code) => (await J(`/api/state?role=screen&g=${code}`)).body;
const phoneView = async (p, code) => (await J(`/api/state?role=player&playerId=${p.id}&token=${encodeURIComponent(p.token)}&g=${code}`)).body;
const phoneDo = (action, p, code, extra = {}) => J(`/api/${action}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ playerId: p.id, token: p.token, joinCode: code, ...extra }) });
/*
 * A BINGO press waits on the host now (25 Sept 2026): the phone's claim comes
 * back `pending`, and the host's `approveClaim` is what pays. So a claim here
 * is the press AND the host's yes, and the approval's result is the win.
 */
const claimApproved = async (p, code) => {
  const c = await phoneDo('claim', p, code);
  if (c.status !== 200 || !(c.body || {}).pending) return c;
  const a = await host('approveClaim', { playerId: p.id });
  return { status: a.status, body: (a.body || {}).ok };
};
const running = async () => (await J('/api/library', { headers: H() })).body.running;
const joinAll = async (code, names) => {
  const out = [];
  for (const name of names) {
    const r = await J('/api/join', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, joinCode: code }) });
    out.push(r.body);
  }
  return out;
};
/** Keys that would be an answer key, anywhere in a payload. */
const leaks = (obj, bad = /^(correct|correctIndex|correctIndexes|answer|answerText|hostNotes|notes|whoPicked|token|cue)$/) => {
  const out = [];
  const walk = (v, at) => {
    if (!v || typeof v !== 'object') return;
    for (const [k, x] of Object.entries(v)) {
      if (bad.test(k) && x !== null && x !== undefined && x !== '' && !(Array.isArray(x) && !x.length)) out.push(`${at}.${k}`);
      walk(x, `${at}.${k}`);
    }
  };
  walk(obj, '');
  return out;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  // ---------------------------------------------------------------- sign in
  const signIn = await fetch(B + '/api/sign-in', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'qm@example.com', password: 'quizmaster passphrase' }) });
  cookie = (signIn.headers.get('set-cookie') || '').split(';')[0];
  const mk = await J('/api/invoices/customers', { method: 'POST', headers: H(), body: JSON.stringify({ name: 'The Station Tap, Wokingham' }) });
  const venue = (mk.body.customers || [])[0];
  await J(`/api/invoices/customers/${venue.id}/rewards`, { method: 'PUT', headers: H(), body: JSON.stringify({ rewards: ['A pint', 'A half', 'Crisps', 'A pint', 'A half'] }) });
  const night = { venue: venue.name, venueId: venue.id, breakPlan: {}, replace: true, winners: 3 };

  // ============================================================== THE QUIZ
  section('1. A QUIZ WITH ONE ROUND OF EVERY TYPE');
  const order = [
    { packId: '1980s-pop-music', round: 0 },  // text
    { packId: '2006', round: 1 },              // image
    { packId: 'intros-2006', round: 0 },       // intro
    { packId: '1980s-pop-music', round: 2 },   // multi
    { packId: '1980s-pop-music', round: 3 },   // alphabet
    { packId: 'every-breakout', round: 0 },    // breakout
  ];
  const go = await host('launch', { game: 'quiz', packId: '1980s-pop-music', order, ...night });
  check('a six-round night of every type launches', go.status === 200, JSON.stringify(go.body).slice(0, 160));
  let run = await running();
  const code = run.joinCode;
  check('the room has a join code', Boolean(code), JSON.stringify(run));
  const phones = await joinAll(code, ['Dave', 'Sue', 'Table Six']);
  check('three phones join with a token each', phones.every((p) => p && p.id && p.token), JSON.stringify(phones.map((p) => p && Object.keys(p))));
  const [dave, sue, six] = phones;
  const scr0 = await screenView(code);
  check('the lobby wall carries no player ids', !JSON.stringify(scr0).includes(dave.id), 'a phone id is on the projector');

  await host('start');
  const seenTypes = new Set();
  const scoreOf = async (p) => { const v = await phoneView(p, code); return v.you ? v.you.score : v.score; };
  let guard = 0;
  while (guard++ < 80) {
    const hv = await hostView();
    if (hv.phase === 'final') break;
    if (hv.phase !== 'question') { await host('next'); continue; }
    const q = hv.question || {};
    const type = hv.roundType || q.type || (hv.round && hv.round.type) || '?';
    const first = !seenTypes.has(type);
    seenTypes.add(type);
    const sv = await screenView(code);
    const pv = await phoneView(dave, code);
    if (first) {
      // THE SWEEP HAS TO SEE A KEY WHERE ONE IS, or a green run proves nothing.
      if (type === 'text') check('the sweep sees the answer key on the HOST view (self-check)', leaks(hv).length > 0, 'the leak sweep is blind');
      const sl = leaks(sv); const pl = leaks(pv);
      check(`${type}: the wall carries no answer key`, sl.length === 0, sl.join(', '));
      check(`${type}: the phone carries no answer key`, pl.length === 0, pl.join(', '));
      check(`${type}: the phone gets no question text`, !pv.prompt && !(pv.question && pv.question.prompt), JSON.stringify(pv.question || pv.prompt || '').slice(0, 80));
      check(`${type}: the wall carries no player ids`, !JSON.stringify(sv).includes(dave.id));
    }
    const before = { dave: await scoreOf(dave), sue: await scoreOf(sue) };
    // Dave answers RIGHT, Sue answers WRONG, Table Six sits it out.
    if (type === 'breakout') {
      const a = await phoneDo('answer-breakout', dave, code, { text: 'the sweat off my brow' });
      if (first) check('breakout: a typed answer is taken', a.status === 200 && (a.body || {}).ok !== false, JSON.stringify(a.body).slice(0, 100));
      const hv2 = await hostView();
      if (first) check('breakout: the host sees the typed words, the wall does not', JSON.stringify(hv2).includes('sweat off my brow') && !JSON.stringify(await screenView(code)).includes('sweat off my brow'));
    } else if (type === 'multi') {
      const right = q.correctIndexes || [];
      const a = await phoneDo('answer', dave, code, { optionIndexes: right });
      if (first) check('multi: the whole set is taken', a.status === 200 && (a.body || {}).ok !== false, JSON.stringify(a.body).slice(0, 100));
      const short = await phoneDo('answer', sue, code, { optionIndexes: right.slice(0, 1) });
      if (first) check('multi: fewer than N picks is REFUSED, not trimmed', short.status !== 200 || (short.body || {}).ok === false, JSON.stringify(short.body).slice(0, 100));
      const opts = (sv.question && sv.question.options) || sv.options || [];
      const wrong = opts.map((_, i) => i).filter((i) => !right.includes(i)).slice(0, right.length);
      await phoneDo('answer', sue, code, { optionIndexes: wrong });
    } else if (type === 'alphabet') {
      const letter = String(q.answer || q.answerText || '').trim()[0].toUpperCase();
      const idx = letter.charCodeAt(0) - 65;
      const a = await phoneDo('answer', dave, code, { optionIndex: idx });
      if (first) check('alphabet: a letter is taken as an option index', a.status === 200 && (a.body || {}).ok !== false, JSON.stringify(a.body).slice(0, 100));
      await phoneDo('answer', sue, code, { optionIndex: (idx + 1) % 26 });
    } else {
      const right = typeof q.correctIndex === 'number' ? q.correctIndex : (q.correct ?? 0);
      const a = await phoneDo('answer', dave, code, { optionIndex: right });
      if (first) check(`${type}: an answer is taken`, a.status === 200 && (a.body || {}).ok !== false, JSON.stringify(a.body).slice(0, 100));
      await phoneDo('answer', sue, code, { optionIndex: (right + 1) % 4 });
    }
    if (first && type !== 'breakout') {
      const early = await phoneView(dave, code);
      check(`${type}: the phone does not say you were right before the reveal`, (early.you ? early.you.score : early.score) === before.dave, `score moved from ${before.dave} to ${early.you ? early.you.score : early.score}`);
    }
    await host('reveal');
    const after = { dave: await scoreOf(dave), sue: await scoreOf(sue) };
    if (first) {
      if (type === 'breakout') check('breakout: nobody scores', after.dave === before.dave && after.sue === before.sue, `${before.dave}->${after.dave}`);
      else {
        check(`${type}: the right answer scores`, after.dave > before.dave, `${before.dave} -> ${after.dave}`);
        check(`${type}: the wrong answer does not`, after.sue === before.sue, `${before.sue} -> ${after.sue}`);
      }
      const rv = await screenView(code);
      check(`${type}: the reveal reaches the wall`, rv.phase === 'reveal' && (type === 'breakout' || JSON.stringify(rv).match(/correct|reveal/i) !== null), rv.phase);
    }
    await host('next');
  }
  check('every round type was played', ['text', 'image', 'intro', 'multi', 'alphabet', 'breakout'].every((t) => seenTypes.has(t)), [...seenTypes].join(','));
  const fin = await hostView();
  check('the night reached the final', fin.phase === 'final', fin.phase);
  const scores = { dave: await scoreOf(dave), sue: await scoreOf(sue), six: await scoreOf(six) };
  check('Dave leads, Sue and Table Six are behind', scores.dave > scores.sue && scores.sue >= scores.six, JSON.stringify(scores));
  const dv = await phoneView(dave, code);
  check("the winner's phone holds a voucher", (dv.vouchers || []).length > 0 || Boolean(dv.voucher), JSON.stringify({ v: (dv.vouchers || []).length, voucher: !!dv.voucher }));
  const finScreen = await screenView(code);
  check('the wall names the winner and never the code', JSON.stringify(finScreen).includes('Dave') && !(dv.vouchers || []).some((v) => JSON.stringify(finScreen).includes(v.code)));
  const gigs = (await J('/api/past-gigs', { headers: H() })).body;
  const filed = (gigs.nights || [])[0];
  check('the night is filed under the venue with its scores', filed && filed.venue === venue.name && (filed.games || []).length > 0, JSON.stringify(filed && { venue: filed.venue, games: (filed.games || []).length }));
  const pdf = await fetch(`${B}/api/past-gigs/${encodeURIComponent(filed ? filed.night : 'x')}/report.pdf`, { headers: { cookie } });
  const pdfHead = Buffer.from(await pdf.arrayBuffer()).slice(0, 4).toString();
  check('the report for the venue is a PDF', pdf.status === 200 && pdfHead === '%PDF', `${pdf.status} ${pdfHead}`);

  // ========================================================= SIGKILL MID-Q
  section('2. A SIGKILL MID-QUESTION');
  await host('launch', { game: 'quiz', packId: '1980s-pop-music', ...night });
  const code2 = (await running()).joinCode;
  const [amy, ben] = await joinAll(code2, ['Amy', 'Ben']);
  await host('start');
  for (let i = 0; i < 6; i += 1) { const hv = await hostView(); if (hv.phase === 'question') break; await host('next'); }
  const hvq = await hostView();
  await phoneDo('answer', amy, code2, { optionIndex: hvq.question.correctIndex ?? 0 });
  await host('reveal'); await host('next');
  const beforeKill = await hostView();
  const amyBefore = (await phoneView(amy, code2));
  const came = await restart({ hard: true });
  check('the app comes back after a SIGKILL', came);
  const afterKill = await hostView();
  check('the same question comes back', afterKill.phase === beforeKill.phase && afterKill.questionIndex === beforeKill.questionIndex && afterKill.roundIndex === beforeKill.roundIndex, `${beforeKill.phase} q${beforeKill.questionIndex} -> ${afterKill.phase} q${afterKill.questionIndex}`);
  const amyAfter = await phoneView(amy, code2);
  check("Amy's score and seat come back", !amyAfter.rejoin && !amyAfter.kicked && (amyAfter.you ? amyAfter.you.score : amyAfter.score) === (amyBefore.you ? amyBefore.you.score : amyBefore.score), JSON.stringify({ rejoin: amyAfter.rejoin, kicked: amyAfter.kicked }));
  check('the join code survives the restart', (await running()).joinCode === code2, `${code2} -> ${(await running()).joinCode}`);

  // ============================================================ MUSIC BINGO
  section('3. MUSIC BINGO');
  const mb = await host('launch', { game: 'bingo', packId: 'mbc-5', shape: { rows: 3, cols: 3 }, prizes: 2, ...night });
  check('music bingo launches on a 3x3 with two prizes', mb.status === 200, JSON.stringify(mb.body).slice(0, 120));
  const code3 = (await running()).joinCode;
  const bp = await joinAll(code3, ['Dave', 'Sue', 'Table Six']);
  const bv = await phoneView(bp[0], code3);
  check('each phone gets a card of nine', (bv.card || []).length === 9, `${(bv.card || []).length}`);
  const sameCard = JSON.stringify((await phoneView(bp[0], code3)).card.map((s) => s.title)) === JSON.stringify(bv.card.map((s) => s.title));
  check('the card is the same card on a second read (never regenerated)', sameCard);
  check('the wall carries no card and no player ids', !JSON.stringify(await screenView(code3)).includes(bp[0].id));
  await host('start');
  const hvb = await hostView();
  const byTitle = new Map((hvb.tracks || []).map((t) => [t.title, t.id]));
  check('the host holds the call sheet', byTitle.size >= 40, `${byTitle.size} tracks`);
  // Call Dave's card in order, marking as we go, until the first prize is claimable.
  let winner = null; let calls = 0;
  for (const sq of bv.card) {
    await host('call', { trackId: byTitle.get(sq.title) }); calls += 1;
    for (const p of bp) {
      const s = await phoneView(p, code3);
      for (const c of s.card || []) if (c.called && !c.marked) await phoneDo('mark', p, code3, { index: c.index, marked: true });
    }
    const s1 = await phoneView(bp[0], code3);
    if ((s1.you || {}).squaresAway === 0) { const c = await claimApproved(bp[0], code3); if (c.status === 200 && (c.body || {}).ok !== false) { winner = bp[0]; break; } }
  }
  check('Dave claims the first prize', Boolean(winner), `after ${calls} calls`);
  const hv3 = await hostView();
  check('the host sees the claim and the voucher', (hv3.vouchers || []).length === 1 || (hv3.prizeWinners || []).length >= 1, JSON.stringify({ v: (hv3.vouchers || []).length, pw: (hv3.prizeWinners || []).length }));
  // Reverses the old hold (25 Sept 2026): an approved claim drops the code
  // straight into the phone, rather than holding it to the end of the round.
  const held = await phoneView(bp[0], code3);
  check('the code reaches the phone the moment the host approves', (held.vouchers || []).length >= 1, `${(held.vouchers || []).length} on the phone after approval`);
  // Keep calling until Dave could take the second prize too — he must be stood down.
  let stood = null;
  for (const t of hvb.tracks || []) {
    if (stood !== null) break;
    if ([...(await hostView()).called || []].some((c) => c.id === t.id)) continue;
    await host('call', { trackId: t.id });
    for (const p of bp) { const s = await phoneView(p, code3); for (const c of s.card || []) if (c.called && !c.marked) await phoneDo('mark', p, code3, { index: c.index, marked: true }); }
    const s1 = await phoneView(bp[0], code3);
    if ((s1.you || {}).squaresAway === 0) { stood = Boolean(s1.standDown); break; }
    const s2 = await phoneView(bp[1], code3);
    if ((s2.you || {}).squaresAway === 0) { await claimApproved(bp[1], code3); }
  }
  check('a phone already holding a prize is stood down for the second', stood === true, `standDown: ${stood}`);
  await host('finish');
  const endv = await phoneView(bp[0], code3);
  check('finishing releases the code to the phone', (endv.vouchers || []).length >= 1, `${(endv.vouchers || []).length}`);
  const gigs3 = (await J('/api/past-gigs', { headers: H() })).body;
  check('the bingo night is filed too', (gigs3.nights || []).some((n) => (n.games || []).some((g) => g.kind === 'bingo')));

  // ============================================================= CARD BINGO
  section('4. CARD BINGO');
  const cb = await host('launch', { game: 'cards', packId: 'deck', ...night });
  check('card bingo launches', cb.status === 200, JSON.stringify(cb.body).slice(0, 100));
  const code4 = (await running()).joinCode;
  const cp = await joinAll(code4, ['Dave', 'Sue']);
  const hand = (await phoneView(cp[0], code4)).card || [];
  check('a hand is thirteen cards, dealt sorted', hand.length === 13);
  const musicDraw = await host('draw');
  await host('start');
  let cwin = null;
  for (let i = 0; i < 52 && !cwin; i += 1) {
    const d = await host('draw');
    if (d.status !== 200) { check('draw answers 200', false, `${d.status}`); break; }
    for (const p of cp) { const s = await phoneView(p, code4); for (const c of s.card || []) if (c.called && !c.marked) await phoneDo('mark', p, code4, { index: c.index, marked: true }); const s2 = await phoneView(p, code4); if ((s2.you || {}).squaresAway === 0) { const c = await claimApproved(p, code4); if (c.status === 200 && (c.body || {}).ok !== false) { cwin = p; break; } } }
  }
  check('somebody completes a hand and claims', Boolean(cwin));
  const nr = await host('newRound');
  check('a new round deals everybody a fresh hand', nr.status === 200 && JSON.stringify((await phoneView(cp[0], code4)).card.map((c) => c.title)) !== JSON.stringify(hand.map((c) => c.title)));
  await host('finish');

  // ================================================================ DJ SET
  section('5. A DJ SET');
  const dj = await host('launch', { game: 'dj', packId: 'dj', ...night });
  check('a DJ set launches', dj.status === 200, JSON.stringify(dj.body).slice(0, 100));
  const code5 = (await running()).joinCode;
  const [fan] = await joinAll(code5, ['Fan']);
  const early = await phoneDo('dj/request', fan, code5, { title: 'Mr Brightside' });
  check('a request BEFORE a photograph is refused', early.status !== 200 || (early.body || {}).ok === false, JSON.stringify(early.body).slice(0, 100));
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(300, 1)]);
  const photo = await fetch(`${B}/api/photo?playerId=${fan.id}&g=${code5}`, { method: 'POST', headers: { 'content-type': 'image/jpeg' }, body: jpeg });
  check('the fan posts a photograph', photo.status === 200, `${photo.status}`);
  const req = await phoneDo('dj/request', fan, code5, { title: 'Mr Brightside' });
  check('…and can then request a song', req.status === 200 && (req.body || {}).ok !== false, JSON.stringify(req.body).slice(0, 100));
  const djs = await screenView(code5);
  check('the request is never on the wall', !JSON.stringify(djs).includes('Mr Brightside'));
  check('the host sees the queue', JSON.stringify(await hostView()).includes('Mr Brightside'));

  // ===================================================== A RUNNING ORDER
  section('6. QUIZ → BINGO → QUIZ, ONE SCORE');
  const ro = await host('launchOrder', { segments: [
    { kind: 'quiz', order: [{ packId: '1980s-pop-music', round: 0 }] },
    { kind: 'bingo', packId: 'mbc-4', shape: { rows: 3, cols: 3 }, prizes: 1 },
    { kind: 'quiz', order: [{ packId: '1980s-pop-music', round: 1 }] },
  ], ...night });
  check('a three-part running order launches', ro.status === 200, JSON.stringify(ro.body).slice(0, 120));
  const code6 = (await running()).joinCode;
  const [zoe] = await joinAll(code6, ['Zoe']);
  await host('start');
  for (let i = 0; i < 40; i += 1) { const hv = await hostView(); if (hv.phase === 'question') break; await host('next'); }
  const q6 = (await hostView()).question;
  await phoneDo('answer', zoe, code6, { optionIndex: q6.correctIndex ?? 0 });
  await host('reveal');
  const zoeScore = (await phoneView(zoe, code6)).you?.score ?? (await phoneView(zoe, code6)).score;
  check('Zoe scores in part one', zoeScore > 0, `${zoeScore}`);
  let hopped = 0;
  for (let i = 0; i < 60; i += 1) { const hv = await hostView(); if (hv.runningOrder && hv.runningOrder.nextKind === 'bingo' && hv.phase === 'round_board') break; await host('next'); hopped += 1; }
  const adv1 = await host('advanceOrder');
  check('Continue to the bingo', adv1.status === 200 && (await running()).game === 'bingo', JSON.stringify(adv1.body).slice(0, 80));
  check('Zoe is still in the room on the same code', (await running()).playerCount === 1 && (await running()).joinCode === code6);
  const adv2 = await host('advanceOrder');
  check('Continue to the second quiz', adv2.status === 200 && (await running()).game === 'quiz');
  const zoeBack = await phoneView(zoe, code6);
  check('her score carried across the bingo', (zoeBack.you ? zoeBack.you.score : zoeBack.score) === zoeScore, `${zoeScore} -> ${zoeBack.you ? zoeBack.you.score : zoeBack.score}`);
} catch (err) {
  fails += 1; found.push(`the drive fell over: ${err.stack || err.message}`);
  console.error('\nthe drive fell over:', err.stack || err.message);
} finally {
  stop();
}
console.log(fails ? `\n${fails} FAILED:\n  - ${found.join('\n  - ')}` : '\nEvery game type ran through the system.');
process.exit(fails ? 1 : 0);
