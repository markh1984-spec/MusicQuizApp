#!/usr/bin/env node
/**
 * A LONG NIGHT — sixty phones, forty questions, and what it costs the server.
 *
 * Every other guard runs a handful of phones for a minute. A real Thursday is
 * sixty streams held open for three hours with every one of them answering
 * within seconds of each other, forty times — and the failures that shape
 * has are the ones nothing short of running it can see: a stream not let go
 * of when a phone leaves, a heap that only grows, a push that takes longer
 * to reach the sixtieth phone than the room can feel. On a 512MB instance
 * any of those is a server that falls over at half past ten.
 *
 * So this joins sixty phones over HTTP, opens a real SSE stream for each,
 * plays forty questions with all sixty answering every one, and measures:
 *
 *   - FAN-OUT: from Next to the LAST phone hearing about it, per question;
 *   - EVERY ANSWER LANDS: sixty answered on every question;
 *   - MEMORY: RSS from `/health` before, halfway and after — bounded growth;
 *   - LETTING GO: when the phones disconnect, the stream count returns to
 *     what it was, within seconds.
 *
 * The limits are generous on purpose — this runs on a shared box — and they
 * are there to catch a regression by a factor, not a millisecond.
 */

import { startApp } from './helpers/live-app.mjs';

const KEY = 'longnight';
const PHONES = 60;
const QUESTIONS = 40;
const FANOUT_LIMIT_MS = 1500;
const RSS_GROWTH_LIMIT = 120 * 1024 * 1024;
let fails = 0;
const check = (name, ok, note = '') => { if (!ok) fails += 1; console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${!ok && note ? `\n        ${note}` : ''}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const mb = (n) => `${Math.round(n / 1024 / 1024)}MB`;

const { base: B, stop } = await startApp({ key: KEY });
const H = { 'content-type': 'application/json', 'X-Host-Key': KEY };
const J = async (route, opts = {}) => { const r = await fetch(B + route, opts); let body; try { body = await r.json(); } catch { body = null; } return { status: r.status, body }; };
const host = (action, body = {}) => J(`/api/host/${action}`, { method: 'POST', headers: H, body: JSON.stringify(body) });
const hv = async () => (await J(`/api/state?role=host&key=${KEY}`)).body;
const health = async () => (await J('/health')).body;

/** A phone's stream: reads SSE for ever, remembering the latest state it heard. */
function openStream(p) {
  const ac = new AbortController();
  const phone = { ...p, latest: null, heard: 0, ac };
  (async () => {
    try {
      const res = await fetch(`${B}/api/stream?role=player&playerId=${encodeURIComponent(p.id)}&token=${encodeURIComponent(p.token)}`, { signal: ac.signal });
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
          const data = chunk.split('\n').find((l) => l.startsWith('data: '));
          if (data && /^event: state/m.test(chunk)) { phone.latest = JSON.parse(data.slice(6)); phone.heard += 1; phone.heardAt = Date.now(); }
        }
      }
    } catch { /* aborted, or the server went */ }
  })();
  return phone;
}

console.log(`\nA LONG NIGHT — ${PHONES} phones, ${QUESTIONS} questions\n`);
const phones = [];
try {
  const baseline = await health();
  const go = await host('launch', { game: 'quiz', packId: '1980s-pop-music', questionSeconds: 20, replace: true });
  check('launched', go.status === 200, JSON.stringify(go.body).slice(0, 100));

  for (let i = 0; i < PHONES; i += 1) {
    const j = await J('/api/join', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: `Table ${i + 1}` }) });
    phones.push(openStream(j.body));
  }
  await wait(1500);
  const opened = await health();
  check(`${PHONES} phones joined and ${PHONES} streams are open`, ((await hv()).players || []).length === PHONES && opened.streams - baseline.streams === PHONES, `players ${((await hv()).players || []).length}, streams ${opened.streams - baseline.streams}`);
  console.log(`        RSS with the room in: ${mb(opened.rss)} (empty: ${mb(baseline.rss)})`);

  await host('start');
  const fanouts = [];
  let answeredEvery = true;
  let asked = 0;
  let midRss = 0;
  for (let n = 0; n < QUESTIONS * 3 && asked < QUESTIONS; n += 1) {
    const before = await hv();
    if (before.phase === 'final') break;
    const t0 = Date.now();
    await host('next');
    const after = await hv();
    if (after.phase !== 'question') continue;
    asked += 1;
    // Fan-out: wait until every phone's latest state names this question.
    const want = `${after.roundIndex}:${after.questionIndex}`;
    let allHeard = 0;
    while (Date.now() - t0 < 10_000) {
      if (phones.every((p) => p.latest && `${p.latest.roundIndex}:${p.latest.questionIndex}` === want && p.latest.phase === 'question')) { allHeard = Math.max(...phones.map((p) => p.heardAt)) - t0; break; }
      await wait(20);
    }
    fanouts.push(allHeard || 10_000);
    // Everybody answers at once.
    const q = after.question || {};
    // `pickCount` is on every question (1 for an ordinary one); only a
    // pick-them-all round takes a SET.
    const body = (p) => q.pickCount > 1
      ? { playerId: p.id, token: p.token, optionIndexes: Array.from({ length: q.pickCount }, (_, k) => k) }
      : { playerId: p.id, token: p.token, optionIndex: 0 };
    const replies = await Promise.all(phones.map((p) => J('/api/answer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body(p)) })));
    const landed = (await hv()).answeredCount;
    if (landed !== PHONES) { answeredEvery = false; console.log(`        question ${asked}: ${landed} of ${PHONES} answered (${replies.filter((r) => r.status !== 200 || !(r.body && r.body.ok)).length} refused: ${JSON.stringify((replies.find((r) => r.status !== 200 || !(r.body && r.body.ok)) || {}).body).slice(0, 80)})`); }
    await host('reveal');
    if (asked === Math.floor(QUESTIONS / 2)) midRss = (await health()).rss;
  }
  check(`${asked} questions asked`, asked >= Math.min(QUESTIONS, 30), `${asked}`);
  check('every phone answered every question', answeredEvery);
  const worst = Math.max(...fanouts);
  const median = [...fanouts].sort((a, b) => a - b)[Math.floor(fanouts.length / 2)];
  check(`the slowest fan-out to the ${PHONES}th phone was under ${FANOUT_LIMIT_MS}ms (worst ${worst}ms, median ${median}ms)`, worst < FANOUT_LIMIT_MS, `${fanouts.join(' ')}`);

  const end = await health();
  console.log(`        RSS halfway: ${mb(midRss)}, at the end: ${mb(end.rss)}`);
  check(`memory grew less than ${mb(RSS_GROWTH_LIMIT)} over the night`, end.rss - opened.rss < RSS_GROWTH_LIMIT, `${mb(end.rss - opened.rss)}`);
  check('the streams are all still open at the end', end.streams - baseline.streams === PHONES, `${end.streams - baseline.streams}`);

  for (const p of phones) p.ac.abort();
  let letGo = null;
  for (let t = 0; t < 40; t += 1) { await wait(250); const h = await health(); if (h.streams === baseline.streams) { letGo = t * 250; break; } }
  check('when the phones leave, every stream is let go of within ten seconds', letGo !== null, `streams still open: ${(await health()).streams - baseline.streams}`);
} catch (err) {
  fails += 1;
  console.log('  FAIL threw:', err.stack || err);
} finally {
  for (const p of phones) p.ac.abort();
  await stop();
}
if (fails) { console.log(`\n${fails} FAILED — a long night costs the server more than it should.`); process.exit(1); }
console.log('\nSixty phones, forty questions: the server ended the night where it started.');
