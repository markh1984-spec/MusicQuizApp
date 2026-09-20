/**
 * THE FUNNIEST PHOTOGRAPH OF THE NIGHT — does the room's vote reach a drink?
 *
 * ---
 *
 * Asked for as *"the funniest photo of the night getting a free drink is
 * actually a really good idea, perhaps you could let the crowd vote on their
 * favourite as well"*, built as **the host shortlists four at the break**.
 *
 * **`pub-unchanged.mjs` SAYS NOTHING ABOUT ANY OF THIS AND SAYS IT
 * CONFIDENTLY.** It never posts a photograph, never opens a vote and never
 * mints a voucher, so IDENTICAL on this change is the guard answering about
 * something it is not looking at — the fifth time this repo has written that
 * sentence down. So this drives three phones, a projector and a control view
 * over real HTTP, and checks the four things that break silently:
 *
 *   - **the leak.** A shortlist carries the SENDER, because the drink has to
 *     find somebody — and a player id is a bearer credential (rule 3) on a
 *     payload the projector hands to anybody holding the join code. It must
 *     not be on the wire.
 *   - **the bandwagon.** The live counts are host-only by construction. A
 *     tally on the wall turns the last twenty voters into followers.
 *   - **the drink.** The winner's own phone gets a code and nobody else's
 *     does. Every step of that is a payload nothing else checks.
 *   - **the silent loss.** Pressing on SETTLES a vote rather than discarding
 *     it. Nothing throws either way, and the difference is forty people's
 *     votes.
 *
 * And a REAL BROWSER leg, because *a test that the payload is right proves
 * nothing about whether anybody drew it* — the arcade board sat in a payload
 * for as long as the feature existed with nobody drawing it.
 *
 *     node scripts/funniest-photo.mjs
 */

import path from 'node:path';

import { startApp } from './helpers/live-app.mjs';
import { playwright } from './helpers/playwright.mjs';

const { chromium } = playwright();

const KEY = 'funniest-photo';
const OWNER = { email: 'funny@example.com', password: 'funniest-photo-password' };

const { Accounts } = await import('../src/accounts.js');
const seedOwner = (dir) => new Accounts(path.join(dir, 'accounts.json'))
  .create({ ...OWNER, name: 'Funny Check', role: 'owner' });

const { base: BASE, stop } = await startApp({ key: KEY, seed: seedOwner });

let failures = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failures += 1;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${detail ? `  — ${detail}` : ''}`);
};

/*
 * `/api/host/<action>` WRAPS A SESSION ACTION AS `{ ok, view }` and answers a
 * route with its own handler (`photoVoteOpen`) with the bare result. Unwrapped
 * here rather than at each call, because a check reading `body.winner` off the
 * wrapper is `undefined === undefined` — a guard passing by looking in the
 * wrong place, which is worse than one that fails.
 */
const unwrap = (r) => (r.body && typeof r.body.ok === 'object' && r.body.ok !== null
  ? { status: r.status, body: r.body.ok }
  : r);

const host = (route, body) => fetch(`${BASE}${route}`, {
  method: body ? 'POST' : 'GET',
  headers: { 'Content-Type': 'application/json', 'X-Host-Key': KEY },
  ...(body ? { body: JSON.stringify(body) } : {}),
}).then(async (r) => unwrap({ status: r.status, body: await r.json().catch(() => null) }));

const browser = await chromium.launch();
try {
  const lib = (await host('/api/library')).body;
  const pack = (lib.quiz || lib.text || [])[0] || (lib.quizzes || [])[0];
  /*
   * A VENUE WITH PRIZES ON IT, or there is no drink to win and the whole
   * back half of this guard passes by doing nothing — which is the shape of
   * false pass this repo keeps paying for.
   */
  const launch = await host('/api/host/launch', {
    game: 'quiz', packId: pack.id, replace: true,
    venue: 'The Laughing Dog',
    rewards: ['A bottle of fizz', 'A round of drinks', 'A pint'],
  });
  check('a quiz launches with prizes on the table', launch.status === 200, `${launch.status}`);

  const joinCode = ((await host('/api/library')).body.running || {}).joinCode || '';
  const g = joinCode ? `?g=${joinCode}` : '';
  const gq = joinCode ? `&g=${joinCode}` : '';

  /* A real JPEG, made in a browser — the fixtures elsewhere are 64 bytes of
   * nothing, and these get drawn into an <img> further down. */
  const maker = await browser.newPage();
  await maker.goto(`${BASE}/`);
  const shots = await maker.evaluate(() => ['#c94', '#49c', '#4c9', '#c49'].map((fill) => {
    const c = document.createElement('canvas');
    c.width = 400; c.height = 300;
    const x = c.getContext('2d');
    x.fillStyle = fill; x.fillRect(0, 0, 400, 300);
    return c.toDataURL('image/jpeg', 0.8).split(',')[1];
  }));
  await maker.close();

  const join = (name) => fetch(`${BASE}/api/join${g}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  }).then((r) => r.json());
  const playerState = (who) => fetch(
    `${BASE}/api/state?role=player&playerId=${who.playerId || who.id}`
    + `&token=${encodeURIComponent(who.token)}${gq}`,
  ).then((r) => r.json());
  const screenState = () => fetch(`${BASE}/api/state?role=screen${gq}`).then((r) => r.json());
  const hostState = () => host(`/api/state?role=host${gq}`).then((r) => r.body);
  const sendPhoto = (who, i) => fetch(
    `${BASE}/api/photo?playerId=${encodeURIComponent(who.playerId || who.id)}&camera=1${gq}`,
    { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: Buffer.from(shots[i], 'base64') },
  ).then((r) => r.json());
  const vote = (who, photoId) => fetch(`${BASE}/api/photo-vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      playerId: who.playerId || who.id, token: who.token, joinCode, photoId,
    }),
  }).then((r) => r.json());

  const teams = [];
  for (const name of ['Quiz Team Aguilera', 'The Scrabble Rousers', 'Norfolk Enchants', 'Les Quizerables']) {
    teams.push(await join(name));
  }
  const photoIds = [];
  for (let i = 0; i < 4; i += 1) {
    const out = await sendPhoto(teams[i], i);
    photoIds.push(out.id);
  }
  check('four photographs arrive', photoIds.every(Boolean), JSON.stringify(photoIds));

  /*
   * EVERYTHING HAPPENS AT A BREAK, BECAUSE THAT IS WHERE IT HAPPENS.
   *
   * The first version of this guard ran the whole vote at a REVEAL and then
   * asked why the winner's phone was empty: `VOUCHER_PHASES` does not include
   * one, so the code was minted correctly and simply not sent yet. A guard
   * that walks a path a host never walks reports a bug the app does not have,
   * which is the same disease as one that passes by doing nothing.
   */

  /* ---------------------------------------------------- AND SOMEBODY DRAWS IT */

  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const boom = [];
  phone.on('pageerror', (e) => boom.push(String(e)));
  await phone.goto(`${BASE}/play${g}`);
  await phone.fill('#nameInput', 'The Watchers');
  await phone.click('#joinBtn');
  await phone.waitForTimeout(600);

  const opened = await host('/api/host/photoVoteOpen', { ids: photoIds });
  check('four photographs go to the room', opened.status === 200, JSON.stringify(opened.body));

  await phone.waitForSelector('.vote-pic', { timeout: 10000 }).catch(() => {});
  check('a real phone DRAWS the four', await phone.locator('.vote-pic').count() === 4,
    'every payload correct and nobody drew it — the arcade board again');

  /*
   * PUT A FINGER ON IT — in the document, has a size and can be pressed are
   * three questions, and the gap has bitten this repo five times.
   */
  const reach = await phone.evaluate(() => {
    const el = document.querySelector('.vote-pic');
    if (!el) return 'not drawn';
    const r = el.getBoundingClientRect();
    if (r.width < 44 || r.height < 44) return `only ${Math.round(r.width)}x${Math.round(r.height)}`;
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return el.contains(hit) || hit === el ? 'yes' : `covered by ${hit && hit.className}`;
  });
  check('and it is a real target that can be pressed', reach === 'yes', reach);

  await phone.locator('.vote-pic').first().click();
  await phone.waitForTimeout(500);
  check('pressing it lights that one straight away',
    await phone.locator('.vote-pic.picked').count() === 1,
    'a vote in a noisy room that does nothing for half a second is pressed twice');
  const landed = await hostState();
  check('and the vote actually reaches the server',
    ((landed.photoVote || {}).cast || 0) >= 1,
    'the tile lit and nothing was sent — a control reporting success it did not have');

  /* ------------------------------------------- what each screen is told */

  const scr = await screenState();
  check('the projector draws all four',
    (((scr.photoVote || {}).photos) || []).length === 4,
    JSON.stringify(((scr.photoVote || {}).photos || []).length));

  /*
   * THE LEAK, IN ONE SWEEP RATHER THAN FIELD BY FIELD.
   *
   * A named check on `photos[].playerId` only ever catches the field somebody
   * thought of. This searches the WHOLE payload for every real player id, so a
   * sender riding out under any name at any depth fails here.
   */
  const ids = teams.map((t) => t.playerId || t.id);
  const hides = (payload, where, own = '') => {
    const text = JSON.stringify(payload);
    // A phone's OWN id is legitimately on its own payload — that is what
    // `you.id` has always been. What must not be there is anybody ELSE's.
    const found = ids.filter((id) => id !== own && text.includes(id));
    check(`no other player's id is on the ${where} payload`, found.length === 0, found.join(', '));
  };
  hides(scr, 'projector');
  hides(await playerState(teams[1]), 'phone', teams[1].playerId || teams[1].id);

  check('and no running tally is on the projector',
    !('counts' in (scr.photoVote || {})),
    'a count on the wall turns the vote into a bandwagon');

  const p1 = await playerState(teams[1]);
  check('a phone is offered the same four',
    (((p1.photoVote || {}).photos) || []).length === 4);
  check('and is told no counts either', !('counts' in (p1.photoVote || {})));

  /* ------------------------------------------------- the room votes */

  // Team 0's photograph wins, and team 0 does NOT vote for it — a winner who
  // is also a voter, or who is simply first in the list, would pass by
  // accident.
  await vote(teams[1], photoIds[0]);
  await vote(teams[2], photoIds[0]);
  await vote(teams[3], photoIds[1]);
  const changed = await vote(teams[3], photoIds[1]);
  check('a vote is accepted', changed.ok === true, JSON.stringify(changed));

  const junk = await vote(teams[1], 'not-a-photo');
  check('a pick that names nothing is REFUSED, not swallowed', junk.ok === false, JSON.stringify(junk));

  /*
   * THREE, NOT TWO: the real browser above tapped the first tile as well, which
   * is the whole point of it being a real browser. Written out rather than
   * derived, so the day a tap stops landing this reads 2 and fails rather than
   * agreeing with whatever happened.
   */
  const hv = await hostState();
  const tally = ((hv.photoVote || {}).photos || []).map((p) => p.votes);
  check('the host sees the live counts', JSON.stringify(tally) === '[3,1,0,0]', JSON.stringify(tally));

  const stillHidden = await screenState();
  check('the projector still does not', !('counts' in (stillHidden.photoVote || {})));

  /* ------------------------------------------- closing names a winner and pays */

  const closed = await host('/api/host/photoVoteClose', {});
  check('closing it names the winner',
    closed.status === 200 && (closed.body.winner || {}).votes === 3,
    JSON.stringify(closed.body));

  const wall = await screenState();
  check('the winner is on the wall with the count',
    ((wall.photoVote || {}).winner || {}).votes === 3,
    JSON.stringify((wall.photoVote || {}).winner));
  check('and the CODE is not', !((wall.photoVote || {}).winner || {}).code,
    'a bearer token for a drink, on the one screen the whole room reads');

  const winner = await playerState(teams[0]);
  const mine = (winner.vouchers || []).filter((v) => v.funny);
  check('the winner holds the drink on their own phone',
    mine.length === 1 && Boolean(mine[0].code), JSON.stringify(winner.vouchers || []));
  check('and it says what it is for rather than claiming a place',
    mine.length === 1 && mine[0].place === null,
    '`place || 1` tells somebody who came eleventh they won the quiz');
  check('and the prize is the LAST one on the table',
    mine.length === 1 && mine[0].reward === 'A pint', JSON.stringify(mine[0] || {}));

  const loser = await playerState(teams[1]);
  check('nobody else does', (loser.vouchers || []).filter((v) => v.funny).length === 0);

  /* --------------------------------- the host's own panel, pressed not read */

  const desk = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const deskBoom = [];
  desk.on('pageerror', (e) => deskBoom.push(String(e)));
  await desk.goto(`${BASE}/host?key=${KEY}${gq}`);
  await desk.waitForSelector('.votepanel', { timeout: 10000 }).catch(() => {});
  check('the control view draws the result', await desk.locator('.votepanel').count() === 1);
  const again = desk.locator('#voteAgain');
  check('with a way to run another one', await again.count() === 1);
  if (await again.count()) {
    await again.click();
    await desk.waitForTimeout(700);
    check('and pressing it actually clears the vote',
      !(await hostState()).photoVote,
      'a dead control draws perfectly — nothing here had ever pressed one');
    await desk.waitForSelector('.vote-thumb', { timeout: 8000 }).catch(() => {});
    check('and the shortlist comes back to pick from',
      await desk.locator('.vote-thumb').count() >= 4);
    const go = desk.locator('#voteOpen');
    check('the button is off until two are picked', await go.isDisabled());
    await desk.locator('.vote-thumb').nth(0).click();
    await desk.locator('.vote-thumb').nth(1).click();
    check('and it NAMES the prize once it is on',
      (await go.textContent()).includes('A pint'),
      'a host who cannot see what he is giving away is one who gives away the wrong thing');
    await go.click();
    await desk.waitForTimeout(700);
    check('and pressing it puts them to the room',
      ((await hostState()).photoVote || {}).open === true);
  }

  /* ------------------------------------- pressing on settles rather than discards */

  await host('/api/host/photoVoteDrop', {});
  await host('/api/host/photoVoteOpen', { ids: [photoIds[2], photoIds[3]] });
  await vote(teams[0], photoIds[3]);
  await vote(teams[1], photoIds[3]);
  await host('/api/host/start', {});
  const after = await hostState();
  check('pressing on CLOSES the vote rather than throwing it away',
    ((after.photoVote || {}).winner || {}).votes === 2,
    JSON.stringify((after.photoVote || {}).winner));
  const paid = await playerState(teams[3]);
  check('and the drink still reaches whoever the room chose',
    (paid.vouchers || []).filter((v) => v.funny).length === 1,
    JSON.stringify(paid.vouchers || []));

  /* ------------------------------------- a vote with nobody in it wins nothing */

  await host('/api/host/photoVoteDrop', {});
  await host('/api/host/photoVoteOpen', { ids: [photoIds[0], photoIds[1]] });
  const empty = await host('/api/host/photoVoteClose', {});
  check('nobody voting is not somebody winning',
    empty.status === 200 && empty.body.winner === null, JSON.stringify(empty.body));
  await host('/api/host/photoVoteDrop', {});

  /* --------------------------------------- and it is refused over a live question */

  await host('/api/host/next', {});
  let live = await hostState();
  for (let i = 0; i < 3 && live.phase !== 'question'; i += 1) {
    await host('/api/host/next', {});
    live = await hostState();
  }
  check('the quiz reaches a live question', live.phase === 'question', live.phase);
  const overQuestion = await host('/api/host/photoVoteOpen', { ids: photoIds });
  check('a vote is refused over a live question', overQuestion.status === 400,
    `got ${overQuestion.status} ${JSON.stringify(overQuestion.body)}`);

  check('nothing threw on the phone', boom.length === 0, boom.join(' | '));
  check('nothing threw on the control view', deskBoom.length === 0, deskBoom.join(' | '));
} finally {
  await browser.close().catch(() => {});
  await stop();
}

console.log(failures ? `\n${failures} FAILED` : '\nAll good.');
process.exit(failures ? 1 : 0);
