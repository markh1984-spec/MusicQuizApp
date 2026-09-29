/**
 * SPEED POINTS SCALE TO THE CLOCK — every question tops out at the same 200,
 * whatever its seconds.
 *
 * The host, 29 September 2026, asked for seconds per ROUND and was told the
 * cost: at a flat ten points a second, a 30-second intros round is worth half
 * as many speed points again as a 20-second one. His answer: *"just divide
 * the time into smaller chunks so its 200 points over 30 seconds = 6.66
 * points per second."* So a 20-second question scores EXACTLY as it always
 * did — every pack on disk is 20 — and a longer or shorter one is scaled.
 * This REVERSES "speed scoring is flat — 10 points a second", on his word.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreAnswer, scoreMultiAnswer, SPEED_MAX } from '../src/scoring.js';

const END = 1_000_000;
const left = (s) => END - s * 1000;   // answered with `s` whole seconds on the clock

test('a 20-second question scores exactly as it always did', () => {
  for (let s = 0; s <= 20; s += 1) {
    assert.equal(scoreAnswer({ correct: true, answeredAt: left(s), endsAt: END, seconds: 20 }), 100 + 10 * s);
  }
});

test('a 30-second question tops out at the same 200 speed points', () => {
  assert.equal(SPEED_MAX, 200);
  assert.equal(scoreAnswer({ correct: true, answeredAt: left(30), endsAt: END, seconds: 30 }), 100 + 200);
  assert.equal(scoreAnswer({ correct: true, answeredAt: left(15), endsAt: END, seconds: 30 }), 100 + 100);
  assert.equal(scoreAnswer({ correct: true, answeredAt: left(29), endsAt: END, seconds: 30 }), 100 + 193, '6.67 a second, rounded once');
  assert.equal(scoreAnswer({ correct: true, answeredAt: left(0), endsAt: END, seconds: 30 }), 100);
});

test('a 10-second question is not worth less for being short', () => {
  assert.equal(scoreAnswer({ correct: true, answeredAt: left(10), endsAt: END, seconds: 10 }), 100 + 200);
  assert.equal(scoreAnswer({ correct: true, answeredAt: left(5), endsAt: END, seconds: 10 }), 100 + 100);
});

test('the first-correct bonus and a wrong answer are untouched', () => {
  assert.equal(scoreAnswer({ correct: true, answeredAt: left(30), endsAt: END, seconds: 30, isFirstCorrect: true }), 100 + 200 + 100);
  assert.equal(scoreAnswer({ correct: false, answeredAt: left(30), endsAt: END, seconds: 30 }), 0);
});

test('pick-them-all part marks scale the same way', () => {
  assert.equal(scoreMultiAnswer({ gotRight: 2, totalCorrect: 2, answeredAt: left(30), endsAt: END, seconds: 30 }), 300);
  assert.equal(scoreMultiAnswer({ gotRight: 1, totalCorrect: 2, answeredAt: left(30), endsAt: END, seconds: 30 }), 150);
});

test('an answer recorded before the clock length was passed scores ten a second, as it did', () => {
  assert.equal(scoreAnswer({ correct: true, answeredAt: left(12), endsAt: END }), 100 + 120);
});

/*
 * AND THE ENGINE HANDS THE CLOCK OVER — the maths above is worth nothing if
 * `answer()` never passes the question's own seconds, which it did not: a
 * round authored at 30 seconds paid 300 speed points for an instant answer.
 */
test('a round with its own 30-second clock pays at most 200 for speed, in a real game', async () => {
  const { Engine, PHASES } = await import('../src/engine.js');
  const quiz = {
    id: 'q', title: 'Q', questionSeconds: 20,
    rounds: [{ id: 'r1', type: 'text', title: 'Slow round', questionSeconds: 30, questions: [
      { id: 'q1', prompt: 'A?', options: ['a', 'b', 'c', 'd'], correctIndex: 0 },
    ] }],
  };
  const t = { now: 1_700_000_000_000 };
  const engine = new Engine({ quiz, now: () => t.now });
  const p = engine.join({ name: 'Alpha' });
  engine.start();
  let guard = 0;
  while (engine.state.phase !== PHASES.QUESTION && guard++ < 10) engine.next();
  assert.equal(engine.state.question.seconds, 30);
  engine.answer({ playerId: p.id, optionIndex: 0 });
  assert.equal(engine.state.players[p.id].score, 100 + 200 + 100,
    'an instant right answer on a 30-second clock: base, 200 for speed, the first-correct bonus');
});

/*
 * AND THE RULES SLIDE STAYS TRUE — it is built from the scoring constants so
 * the room can hold you to it, and "+10 for every whole second left" is only
 * true at 20 seconds. A night where every round is 20 says it as it always
 * has; any other clock says the maximum instead.
 */
test('the rules slide says +10 a second only when every round runs at 20 seconds', async () => {
  const { Engine } = await import('../src/engine.js');
  const round = (secs) => ({ id: `r${secs}`, type: 'text', title: 'R', ...(secs ? { questionSeconds: secs } : {}), questions: [
    { id: 'q1', prompt: 'A?', options: ['a', 'b', 'c', 'd'], correctIndex: 0 },
  ] });
  const slide = (quiz, opts = {}) => {
    const e = new Engine({ quiz, now: () => 1_700_000_000_000 });
    if (opts.questionSeconds) e.state.questionSeconds = opts.questionSeconds;
    return e.rulesView().scoring[1];
  };
  assert.equal(slide({ id: 'a', title: 'A', questionSeconds: 20, rounds: [round(), round()] }).big, '+10');
  const mixed = slide({ id: 'b', title: 'B', questionSeconds: 20, rounds: [round(), round(30)] });
  assert.equal(mixed.big, '+200', 'a 30-second round makes "+10 a second" untrue');
  assert.match(mixed.text, /at most/);
  assert.equal(slide({ id: 'c', title: 'C', questionSeconds: 20, rounds: [round()] }, { questionSeconds: 30 }).big, '+200',
    "the host's own Secs per Q counts too");
});
