/**
 * ON A TEAM NIGHT THE FUNNIEST-PHOTO DRINK LANDS ON THE TABLE THAT SENT IT.
 *
 * `closeVote()` minted the drink to the sender's own PLAYER id, and on a team
 * night a phone only ever shows its TEAM's codes — `playerView()` matches
 * `winnerId` against `boardIdFor()`, one entity per board row, everywhere.
 * So the winner the projector named had nothing to show the bar (launch-path
 * sweep, 23 September 2026): the code existed, on the host's panel, on a
 * player id no phone was looking for.
 *
 * The drink goes to the BOARD ROW now, exactly as a placing does: every phone
 * on the winning table shows the one code they share, the other tables see
 * nothing, and on an ordinary night the row IS the handset so nothing moves.
 * Over real HTTP, because the join, the team, the photo and the vote are four
 * routes and the fault lived between two of them.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { withServer } from './helpers/live-server.mjs';

const KEY = 'funny-team-key';
const H = { 'Content-Type': 'application/json', 'X-Host-Key': KEY };
/* Enough of a JPEG for the store's sniff — nothing here draws it. */
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(300, 1)]);

test('the funniest-photo drink goes to the winning TABLE, and every phone on it can show the bar', async () => {
  await withServer(async (base) => {
    const J = async (route, opts = {}) => {
      const r = await fetch(base + route, opts);
      return { status: r.status, body: await r.json().catch(() => null) };
    };
    const host = (action, body = {}) => J(`/api/host/${action}`, { method: 'POST', headers: H, body: JSON.stringify(body) });
    const lib = (await J('/api/library', { headers: H })).body;
    const pack = (lib.quizzes || [])[0];
    const launched = await host('launch', {
      game: 'quiz', packId: pack.id, replace: true, venue: 'The Team Room',
      rewards: ['A pint', 'A half', 'Crisps'], teamPlay: true, teamMode: 'assigned',
    });
    assert.equal(launched.status, 200, JSON.stringify(launched.body));

    const join = async (name) => (await J('/api/join', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
    })).body;
    const phone = (p, action, extra = {}) => J(`/api/${action}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: p.id, token: p.token, ...extra }),
    });
    const view = async (p) => (await J(`/api/state?role=player&playerId=${encodeURIComponent(p.id)}&token=${encodeURIComponent(p.token)}`)).body;

    const alice = await join('Alice');
    const bob = await join('Bob');
    const carol = await join('Carol');
    // Alice starts Table Two and Bob sits with her; Carol is Table One.
    const madeTwo = await phone(alice, 'team', { name: 'Table Two' });
    assert.equal(madeTwo.body.ok, true, JSON.stringify(madeTwo.body));
    const two = ((await view(alice)).teams || []).find((t) => t.name === 'Table Two');
    assert.ok(two, 'the team was made');
    assert.equal((await phone(bob, 'team', { teamId: two.id })).body.ok, true);
    assert.equal((await phone(carol, 'team', { name: 'Table One' })).body.ok, true);

    const sendPhoto = (p) => fetch(`${base}/api/photo?playerId=${encodeURIComponent(p.id)}&camera=1`, {
      method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: JPEG,
    }).then((r) => r.json());
    const a = await sendPhoto(alice);
    const c = await sendPhoto(carol);
    assert.ok(a.ok && c.ok, JSON.stringify({ a, c }));

    const opened = await host('photoVoteOpen', { ids: [a.id, c.id] });
    assert.equal(opened.status, 200, JSON.stringify(opened.body));
    // Both tables vote for Alice's photograph — Table One through Carol,
    // Table Two through Bob, so the winner is not a phone that voted.
    assert.equal((await phone(carol, 'photo-vote', { photoId: a.id })).body.ok, true);
    assert.equal((await phone(bob, 'photo-vote', { photoId: a.id })).body.ok, true);
    const closed = await host('photoVoteClose', {});
    assert.equal(closed.status, 200, JSON.stringify(closed.body));

    const funnyOn = async (p) => ((await view(p)).vouchers || []).filter((v) => v.funny);
    const onAlice = await funnyOn(alice);
    assert.equal(onAlice.length, 1,
      'the phone that sent the winning photograph holds no drink — the code went to a player id, and on a team night a phone only shows its TABLE\'s codes');
    assert.equal(onAlice[0].reward, 'Crisps', 'the last prize on the table');
    assert.equal((await funnyOn(bob)).length, 1, 'her table-mate shows the same code, as a placing would');
    assert.equal((await funnyOn(bob))[0].code, onAlice[0].code);
    assert.equal((await funnyOn(carol)).length, 0, 'the other table does not');

    // The host's panel names the TABLE the room knows, not the handset.
    const hv = (await J('/api/state?role=host', { headers: H })).body;
    const funny = (hv.vouchers || []).filter((v) => v.funny);
    assert.equal(funny.length, 1, 'one drink, once');
    assert.equal(funny[0].name, 'Table Two', 'the voucher names the table on the board');

    // And every other voucher rule still holds when the same table then WINS
    // the quiz: the placing is minted beside the drink, the final slide
    // headlines the placing, and the wallet underneath still lists both.
    await host('start');
    let guard = 0;
    let v = (await J('/api/state?role=host', { headers: H })).body;
    while (v.phase !== 'question' && guard++ < 10) { await host('next'); v = (await J('/api/state?role=host', { headers: H })).body; }
    assert.equal(v.phase, 'question');
    await phone(alice, 'answer', { optionIndex: v.question.correctIndex ?? 0 });
    // One right answer is a lead; Stop the quiz takes the night to its final.
    await host('reveal');
    await host('finish');
    v = (await J('/api/state?role=host', { headers: H })).body;
    assert.equal(v.phase, 'final');
    const aliceFinal = await view(alice);
    assert.equal(aliceFinal.voucher && aliceFinal.voucher.place, 1, 'the headline card at the final is the PLACING, not the drink');
    assert.equal((aliceFinal.vouchers || []).length, 2, 'the wallet holds the placing and the drink');
    assert.equal((aliceFinal.vouchers || []).filter((x) => x.funny).length, 1);
    const hostFinal = (await J('/api/state?role=host', { headers: H })).body;
    assert.equal((hostFinal.vouchers || []).filter((x) => !x.redeemedAt).length, 2, 'two live codes for one table: its place and its photograph');
  }, { hostKey: KEY });
});
