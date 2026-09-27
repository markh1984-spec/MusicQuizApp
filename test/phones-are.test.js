/**
 * WHAT THE HOST IS TOLD THE PHONES ARE SHOWING MUST BE WHAT THE PHONES ARE
 * SENT.
 *
 * `phonesAre()` is a performer's prompt: a quizmaster behind a microphone
 * cannot see sixty phones, and what is on them decides what they say next.
 * CLAUDE.md puts it plainly — *"a host who says something the phones are not
 * offering has said it OUT LOUD to sixty people."*
 *
 * It said it. With the scoreboard up the line read **"On their phones: The
 * scores"**, because the function treated the projector's flags as if they
 * reached a phone. They do not: `playerView()` carries no `scoreboard`, no
 * `leaderboard`, no `advert` and no `photoSlide`. Sixty people were looking at
 * the answer to the last question.
 *
 * So this walks the PHASE LISTS THEMSELVES — never a typed list, which is the
 * rule that made the original check honest — and, for every flag the engine
 * can raise, asserts the prompt does not name something the payload has not
 * got. If a flag ever does reach a phone, this fails and the prompt gets to
 * become true again.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { PHASES } from '../src/engine.js';
import { BINGO_PHASES } from '../src/bingo.js';
import { phonesAre } from '../public/assets/phones.js';

// A night with everything on: the camera switch up and a break offering both.
const ALL_ON = { photos: { enabled: true }, gap: { photos: true, game: true } };

test('every quiz phase has an answer of its own — none falls through', () => {
  const seen = new Map();
  for (const phase of Object.values(PHASES)) {
    const said = phonesAre({ game: 'quiz', phase, ...ALL_ON });
    assert.ok(said && said !== 'Waiting',
      `phase "${phase}" falls through to the default — the host is told nothing useful`);
    seen.set(phase, said);
  }
  assert.equal(seen.size, Object.values(PHASES).length);
});

test('and every bingo phase does too', () => {
  for (const phase of Object.values(BINGO_PHASES)) {
    const said = phonesAre({ game: 'bingo', phase, ...ALL_ON });
    assert.ok(said, `bingo phase "${phase}" has no answer`);
  }
});

/*
 * THE FLAGS. Each is a thing the host can put over the PROJECTOR, and none of
 * them changes a phone — so the prompt must go on describing the phase.
 *
 * Asserted as "does not claim the flag" rather than "equals X": the wording of
 * a phase's own answer is free to change, and a test that pins the sentence
 * would fail on a rewrite that was not a bug.
 */
test('a projector flag does not make the prompt claim the phones changed', () => {
  for (const phase of Object.values(PHASES)) {
    const plain = phonesAre({ game: 'quiz', phase });
    const withScores = phonesAre({ game: 'quiz', phase, scoreboard: { on: true } });
    const withAdvert = phonesAre({ game: 'quiz', phase, advert: { showing: true } });
    const withPhotos = phonesAre({ game: 'quiz', phase, photoSlide: { up: true } });
    for (const [name, said] of [['scoreboard', withScores], ['advert', withAdvert], ['photos', withPhotos]]) {
      assert.equal(said, plain,
        `with the ${name} up at "${phase}" the host is told "${said}" — but the phones are `
        + `still on "${plain}". playerView() sends no ${name} field, so the prompt is describing `
        + 'the big screen and calling it the phones.');
    }
  }
});

/*
 * TWO ORDINARY STATES IT GOT WRONG, off a real browser (launch-path sweep, 23
 * September 2026): at the rules slide it said *"The rules"* while the phones
 * read *"You're in — Hang tight"* over a Send-a-photo row; and it said
 * *"…and photos"* with photos switched OFF, the one switch on the control
 * view that exists for something having gone up that should not have. The
 * camera and the game are offered by the break plan and the kill switch, and
 * the prompt reads both now, exactly as `gapWants()` on the phone does.
 */
test('the rules slide does not claim the phones show the rules — they are waiting, with the camera', () => {
  const said = phonesAre({ game: 'quiz', phase: 'rules', photos: { enabled: true } });
  assert.ok(!/rules/i.test(said),
    `at the rules slide the host is told "${said}" — the phones show "You're in — Hang tight" and a photo row`);
  assert.ok(/photo/i.test(said), `with photos on the phones offer a Send a photo row, but the host is told "${said}"`);
});

test('photos switched OFF are not promised at any phase', () => {
  for (const phase of Object.values(PHASES)) {
    const said = phonesAre({ game: 'quiz', phase, photos: { enabled: false } });
    assert.ok(!/photo/i.test(said),
      `with photos off at "${phase}" the host is told "${said}" — and says "get your photos in" to a room with no camera`);
  }
});

test('a break set to nothing offers neither the game nor the camera, and the prompt says so', () => {
  const quiet = phonesAre({ game: 'quiz', phase: 'round_board', photos: { enabled: true }, gap: { photos: false, game: false } });
  assert.ok(!/photo|game/i.test(quiet), `a round board set to nothing reads "${quiet}"`);
  const photosOnly = phonesAre({ game: 'quiz', phase: 'lobby', photos: { enabled: true }, gap: { photos: true, game: false } });
  assert.ok(!/game/i.test(photosOnly) && /photo/i.test(photosOnly), `a lobby set to photos alone reads "${photosOnly}"`);
});

test('an open vote is on the phones wherever there is room for one, and the host is told', () => {
  for (const phase of ['lobby', 'rules', 'round_intro', 'round_board', 'reveal', 'final']) {
    const said = phonesAre({ game: 'quiz', phase, photos: { enabled: true }, photoVote: { open: true } });
    assert.ok(/vot/i.test(said), `at "${phase}" with a vote open the host is told "${said}"`);
  }
  const bingo = phonesAre({ game: 'bingo', phase: 'playing', photoVote: { open: true } });
  assert.ok(/vot/i.test(bingo), `on a bingo card with a vote open the host is told "${bingo}"`);
});

/*
 * AND THE BREAK THE PHONES ARE IN COMES OFF THE HOST VIEW, from the same plan
 * the phone reads — so the two cannot disagree about what a gap offers.
 */
test('hostView carries the gap the phones are offered, resolved from the same break plan', async () => {
  const { Engine } = await import('../src/engine.js');
  const quiz = {
    id: 'gap', title: 'Gap', questionSeconds: 20,
    rounds: [
      { id: 'r1', type: 'text', title: 'One', questions: [{ id: 'q1', prompt: '?', options: ['a', 'b'], correctIndex: 0 }] },
      { id: 'r2', type: 'text', title: 'Two', questions: [{ id: 'q2', prompt: '?', options: ['a', 'b'], correctIndex: 0 }] },
    ],
  };
  const engine = new Engine({ quiz, now: () => 1_700_000_000_000 });
  engine.state.breakPlan = { 'p0:r0': { phone: 'nothing', screen: 'scores' } };
  const p = engine.join({ name: 'Rob' });
  engine.start();
  while (engine.state.phase !== PHASES.ROUND_BOARD) engine.next();
  const host = engine.hostView();
  assert.deepEqual(host.gap, engine.playerView(p.id).gap, 'the host and the phone read different breaks');
  assert.equal(host.gap.photos, false);
  assert.equal(host.gap.game, false);
  assert.equal(engine.hostView().gap && engine.state.phase, PHASES.ROUND_BOARD);
  engine.next();                                   // a round intro is not a break
  assert.equal(engine.hostView().gap, undefined, 'outside a break the field is absent, as it is on the phone');
});

/*
 * AND THE PAYLOAD IS THE SOURCE OF THAT CLAIM, not this file's memory of it.
 * If `playerView()` ever starts carrying one of these, the test above becomes
 * wrong and this is what says so.
 */
test('playerView still sends none of the three flags to a phone', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../src/engine.js', import.meta.url), 'utf8');
  const from = src.indexOf('\n  playerView(');
  assert.ok(from > 0, 'playerView has moved or been renamed');
  // To the next method at the same indentation.
  const rest = src.slice(from + 3);
  const to = rest.search(/\n {2}[a-zA-Z][a-zA-Z0-9]*\(/);
  const body = rest.slice(0, to > 0 ? to : rest.length)
    // Comments mention the words; only an assignment counts.
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  for (const field of ['scoreboard', 'advert', 'photoSlide']) {
    assert.ok(!new RegExp(`view\\.${field}\\s*=`).test(body),
      `playerView now sets view.${field} — a phone CAN see it, so phonesAre() should say so again`);
  }
});
