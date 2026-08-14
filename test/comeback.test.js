/**
 * THE LAST SLIDE OF THE NIGHT — "Back here Thursday 20th".
 *
 * The things worth pinning down are the ones that would put a WRONG date in
 * front of sixty people, or a QR nobody can check pointing somewhere it should
 * not: a night written off in the diary, a one-off, a link that is not a link,
 * and the slide surviving the restart that happens at half eleven.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { comeBackFor, comeBackText, ordinalDay, safeLink, cleanComeBack, comeBackView } from '../src/comeback.js';
import { Engine, PHASES } from '../src/engine.js';
import { BingoGame } from '../src/bingo.js';

// A Thursday night, mid-quiz.
const NOW = Date.parse('2026-08-13T22:40:00Z');
const crown = (extra = {}) => ({ name: 'The Crown', usualNight: 'thu', rewards: [], ...extra });

test('the next Thursday, said the way it is said on a microphone', () => {
  const cb = comeBackFor({ venue: 'The Crown', venues: [crown()], bookings: [], now: NOW });
  assert.equal(cb.text, 'Back here Thursday 20th');
  assert.equal(cb.date, '2026-08-20');
});

test('TONIGHT IS NOT THE NEXT ONE — the room is sitting in it', () => {
  const cb = comeBackFor({ venue: 'The Crown', venues: [crown()], bookings: [], now: NOW });
  assert.notEqual(cb.date, '2026-08-13');
});

test('A NIGHT WRITTEN OFF IS SKIPPED, which is the whole reason it asks the diary', () => {
  // Saying "back here Thursday" on the Thursday you are not coming is the one
  // failure that makes the slide untrustworthy for good.
  const cb = comeBackFor({
    venue: 'The Crown',
    venues: [crown()],
    bookings: [{ date: '2026-08-20', venue: 'The Crown', off: true }],
    now: NOW,
  });
  assert.equal(cb.date, '2026-08-27');
  assert.equal(cb.text, 'Back here Thursday 27th');
});

test('a one-off sooner than the residency wins', () => {
  const cb = comeBackFor({
    venue: 'The Crown',
    venues: [crown()],
    bookings: [{ date: '2026-08-16', venue: 'The Crown', note: 'Bank holiday special' }],
    now: NOW,
  });
  assert.equal(cb.date, '2026-08-16');
  assert.equal(cb.text, 'Back here Sunday 16th');
});

test('somebody else’s Thursday is not this venue’s next night', () => {
  const cb = comeBackFor({
    venue: 'The Crown',
    venues: [crown({ usualNight: '' }), { name: 'The Dog and Duck', usualNight: 'thu' }],
    bookings: [],
    now: NOW,
  });
  assert.equal(cb, null, 'no usual night here and no link means no slide at all');
});

test('NOTHING TRUE TO SAY MEANS NO SLIDE', () => {
  assert.equal(comeBackFor({ venue: '', venues: [crown()], bookings: [], now: NOW }), null);
  assert.equal(comeBackFor({ venue: 'The Crown', venues: [], bookings: [], now: NOW }), null);
});

test('a link with no usual night is still worth a slide', () => {
  const cb = comeBackFor({
    venue: 'The Crown',
    venues: [crown({ usualNight: '', link: 'https://thecrown.example/whats-on' })],
    bookings: [],
    now: NOW,
  });
  assert.equal(cb.text, 'See what else is on');
  assert.equal(cb.date, '');
  assert.equal(cb.link, 'https://thecrown.example/whats-on');
});

test('the venue is matched however it was capitalised', () => {
  const cb = comeBackFor({ venue: '  the crown ', venues: [crown()], bookings: [], now: NOW });
  assert.equal(cb.date, '2026-08-20');
});

test('11th, 12th and 13th — the ones every naive version gets wrong', () => {
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 31].map(ordinalDay),
    ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '31st']);
  assert.equal(comeBackText('2026-08-11'), 'Back here Tuesday 11th');
  assert.equal(comeBackText('nonsense'), '');
});

test('A QR MAY ONLY EVER CARRY http(s)', () => {
  // Everything else on that slide can be read from the back of the room. A QR
  // is the one thing sixty strangers point a camera at without being able to
  // see where it goes.
  assert.equal(safeLink('javascript:alert(1)'), '');
  assert.equal(safeLink('data:text/html,<script>'), '');
  assert.equal(safeLink('file:///etc/passwd'), '');
  assert.equal(safeLink('https://thecrown.example/x'), 'https://thecrown.example/x');
  assert.equal(safeLink('http://thecrown.example/x'), 'http://thecrown.example/x');
  // The common case: somebody copies it off a business card with no scheme.
  assert.equal(safeLink('thecrown.co.uk/whats-on'), 'https://thecrown.co.uk/whats-on');
  assert.equal(safeLink('not a link'), '');
  assert.equal(safeLink(''), '');
});

test('what goes into the state is tidied like a venue name', () => {
  const cleaned = cleanComeBack({ text: '  Back here   Thursday 20th  ', link: 'javascript:x', date: '2026-08-20' });
  assert.equal(cleaned.text, 'Back here Thursday 20th');
  assert.equal(cleaned.link, '', 'a link that is not http(s) is dropped, not shown');
  assert.equal(cleanComeBack(null), null);
  assert.equal(cleanComeBack({ text: '   ' }), null);
});

test('a screen is told the line and the link, and not the date twice', () => {
  assert.deepEqual(comeBackView({ text: 'Back here Thursday 20th', date: '2026-08-20', link: '' }),
    { text: 'Back here Thursday 20th', link: '' });
  assert.equal(comeBackView(null), null);
});

// ------------------------------------------------------------- in the engine

const quiz = () => ({
  id: 'comeback-test',
  title: 'A Test Quiz',
  rounds: [{ title: 'Round One', type: 'text', questions: [
    { prompt: 'Q?', options: ['a', 'b', 'c', 'd'], correctIndex: 0 },
  ] }],
});

/** A game sitting on the final scores, with a slide to show. */
function atTheEnd() {
  const engine = new Engine({ quiz: quiz(), now: () => NOW });
  engine.state.comeBack = { text: 'Back here Thursday 20th', date: '2026-08-20', link: 'https://thecrown.example/x' };
  engine.state.phase = PHASES.FINAL;
  return engine;
}

test('the projector gets it at the FINAL and nowhere else', () => {
  const engine = atTheEnd();
  assert.deepEqual(engine.screenView().comeBack,
    { text: 'Back here Thursday 20th', link: 'https://thecrown.example/x' });

  engine.state.phase = PHASES.LOBBY;
  assert.equal(engine.screenView().comeBack, undefined);
  engine.state.phase = PHASES.ROUND_BOARD;
  assert.equal(engine.screenView().comeBack, undefined, 'never over a round board — one thing on a projector');
});

test('THE HOST SEES IT FROM THE LOBBY ON — they are the one who knows it is wrong', () => {
  const engine = atTheEnd();
  engine.state.phase = PHASES.LOBBY;
  assert.equal(engine.hostView().comeBack.text, 'Back here Thursday 20th');
});

test('IT IS NOT ON ANYBODY’S PHONE', () => {
  // The room is looking up at the big screen for this; a player payload gains
  // no field, at any phase.
  const engine = atTheEnd();
  const id = engine.join({ name: 'Rob' }).id;
  assert.ok(!JSON.stringify(engine.playerView(id)).includes('Back here'));
});

test('IT SURVIVES A RESTART, which is exactly when it is needed', () => {
  // Half eleven, the winner is up, and a free host restarts. The slide is in
  // the state for the same reason the look and the card shape are.
  const engine = atTheEnd();
  const back = new Engine({ quiz: quiz(), state: JSON.parse(JSON.stringify(engine.state)), now: () => NOW });
  assert.equal(back.screenView().comeBack.text, 'Back here Thursday 20th');
});

test('a night launched before this existed simply has none', () => {
  const engine = new Engine({ quiz: quiz(), now: () => NOW });
  const old = JSON.parse(JSON.stringify(engine.state));
  delete old.comeBack;
  const back = new Engine({ quiz: quiz(), state: old, now: () => NOW });
  back.state.phase = PHASES.FINAL;
  assert.equal(back.screenView().comeBack, undefined);
  assert.equal(back.hostView().comeBack, undefined);
});

// ---------------------------------------------------------------- and bingo

test('BINGO ENDS A NIGHT TOO — same field, same slide', () => {
  // A night is a night whichever game happened to finish it, so the bingo
  // engine carries the identical field rather than a second one.
  const pack = { id: 'cb-bingo', title: 'A Test Bingo', cardSize: 3,
    tracks: Array.from({ length: 12 }, (_, i) => ({ id: `t${i}`, title: `Song ${i}`, artist: 'Somebody' })) };
  const game = new BingoGame({ pack, now: () => NOW });
  game.state.comeBack = { text: 'Back here Thursday 20th', date: '2026-08-20', link: '' };

  game.state.phase = 'playing';
  assert.equal(game.screenView().comeBack, undefined, 'never over a call sheet somebody is marking');

  game.state.phase = 'finished';
  assert.deepEqual(game.screenView().comeBack, { text: 'Back here Thursday 20th', link: '' });
  assert.equal(game.hostView().comeBack.text, 'Back here Thursday 20th');
});
