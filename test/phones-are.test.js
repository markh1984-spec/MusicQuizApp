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

test('every quiz phase has an answer of its own — none falls through', () => {
  const seen = new Map();
  for (const phase of Object.values(PHASES)) {
    const said = phonesAre({ game: 'quiz', phase });
    assert.ok(said && said !== 'Waiting',
      `phase "${phase}" falls through to the default — the host is told nothing useful`);
    seen.set(phase, said);
  }
  assert.equal(seen.size, Object.values(PHASES).length);
});

test('and every bingo phase does too', () => {
  for (const phase of Object.values(BINGO_PHASES)) {
    const said = phonesAre({ game: 'bingo', phase });
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
