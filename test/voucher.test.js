/**
 * The winner's prize, on their phone.
 *
 * Four things are worth being certain about, and only one of them is that it
 * works: the code must never reach the projector, a copy of it must be
 * worthless, an ordinary night must gain nothing at all, and the host must be
 * able to undo whatever the bar did.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { Engine, PHASES } from '../src/engine.js';

const QUIZ = {
  id: 'q', title: 'A Quiz', questionSeconds: 20,
  rounds: [{ id: 'r1', type: 'text', title: 'Round One', questions: [
    { id: 'q1', prompt: 'A question?', options: ['a', 'b', 'c', 'd'], correctIndex: 0 },
  ] }],
};

function withGame({ reward = '', teamPlay = false } = {}) {
  let at = Date.parse('2026-08-14T21:00:00.000Z');
  const engine = new Engine({ quiz: QUIZ, now: () => at });
  engine.state.reward = reward;
  engine.state.teamPlay = teamPlay;
  return { engine, tick: (ms) => { at += ms; } };
}

test('an ordinary night — no reward — issues nothing at all', () => {
  const { engine } = withGame();
  const p = engine.join({ name: 'Rob' });
  engine.finish();
  assert.deepEqual(engine.state.vouchers, {}, 'a night with no prize grew a voucher');
  assert.equal(engine.playerView(p.id).voucher, undefined,
    'a phone on an ordinary night gained a field it has never had');
});

test('the winner gets one, and it carries what the room was told', () => {
  const { engine } = withGame({ reward: 'A free drink at the bar' });
  engine.state.venue = 'The Station Tap';
  const rob = engine.join({ name: 'Rob' });
  engine.finish();
  const view = engine.playerView(rob.id);
  assert.ok(view.voucher, 'the winner was told nothing');
  assert.equal(view.voucher.reward, 'A free drink at the bar');
  assert.equal(view.voucher.venue, 'The Station Tap');
  assert.equal(view.voucher.name, 'Rob', 'a voucher with no name on it is not a voucher');
  assert.match(view.voucher.code, /^[23456789BCDFGHJKMNPQRSTVWXYZ]{8}$/,
    'the code can spell a word or contains a character people mistype');
});

/*
 * THE CODE IS A CREDENTIAL — the bar has no login, so holding it is the whole
 * proof. That puts it in the same class as the answer key, and it follows the
 * same rule: one role's payload, built field by field.
 */
test('THE CODE IS NEVER ON THE PROJECTOR, AND NEVER ON ANYBODY ELSE"S PHONE', () => {
  const { engine } = withGame({ reward: 'A free drink' });
  const rob = engine.join({ name: 'Rob' });
  const jo = engine.join({ name: 'Jo' });
  // Rob wins on the tie-break of having answered; force it plainly instead.
  engine.state.players[rob.id].score = 100;
  engine.finish();

  const screen = JSON.stringify(engine.screenView());
  const code = Object.values(engine.state.vouchers)[0].code;
  assert.ok(!screen.includes(code), 'the projector is showing the code to the whole room');
  assert.equal(engine.screenView().voucher, undefined);
  assert.equal(engine.playerView(jo.id).voucher, undefined,
    'somebody who did not win can read the winner’s code');
  assert.ok(engine.playerView(rob.id).voucher, 'the winner cannot see their own');
});

test('a copy of the code is worthless — the FIRST redeem wins', () => {
  const { engine, tick } = withGame({ reward: 'A free drink' });
  engine.join({ name: 'Rob' });
  engine.finish();
  const code = Object.values(engine.state.vouchers)[0].code;

  const first = engine.redeemVoucher(code);
  assert.equal(first.ok, true);
  tick(60000);
  // The screenshot, arriving a minute later at the same endpoint.
  const second = engine.redeemVoucher(code);
  assert.equal(second.ok, false);
  assert.equal(second.reason, 'already');
  assert.equal(second.voucher.redeemedAt, first.voucher.redeemedAt,
    'the second attempt moved the time, so the bar cannot tell when it really went');
});

test('the host can put it back, and it is counted', () => {
  const { engine } = withGame({ reward: 'A free drink' });
  engine.join({ name: 'Rob' });
  engine.finish();
  const code = Object.values(engine.state.vouchers)[0].code;

  engine.redeemVoucher(code);
  assert.equal(engine.reinstateVoucher(code).ok, true);
  const v = engine.state.vouchers[code];
  assert.equal(v.redeemedAt, null, 'it is still spent after being put back');
  assert.equal(v.reinstated, 1);
  assert.equal(v.history.length, 2, 'the history has to survive for a queried bar tab');
  // And it works again afterwards, or putting it back achieved nothing.
  assert.equal(engine.redeemVoucher(code).ok, true);
  // Reinstating one that was never spent is a no-op rather than a crash.
  engine.reinstateVoucher(code);
  assert.equal(engine.reinstateVoucher(code).reason, 'not_redeemed');
});

test('an unknown code is refused without saying anything about the night', () => {
  const { engine } = withGame({ reward: 'A free drink' });
  engine.join({ name: 'Rob' });
  engine.finish();
  const out = engine.redeemVoucher('ZZZZZZZZ');
  assert.equal(out.ok, false);
  assert.equal(out.reason, 'unknown');
  assert.equal(out.voucher, undefined);
});

/*
 * Back off the final and forward again is one press each way and a host will
 * do it. A second code minted for the same winner leaves the first one in
 * somebody's hand looking perfectly valid.
 */
test('going back and forward again does not mint a second code', () => {
  const { engine } = withGame({ reward: 'A free drink' });
  engine.join({ name: 'Rob' });
  engine.finish();
  const first = Object.keys(engine.state.vouchers);
  engine.back();
  engine.finish();
  assert.deepEqual(Object.keys(engine.state.vouchers), first,
    'the winner is holding a code that is no longer the live one');
});

test('a TEAM gets one voucher between them, not one each', () => {
  const { engine } = withGame({ reward: 'A £50 bar tab', teamPlay: true });
  const a = engine.join({ name: 'Rob' });
  const b = engine.join({ name: 'Jo' });
  const made = engine.makeTeam('The Quizzards');
  assert.equal(made.ok, true, 'the team was not made');
  const teamId = made.id;
  assert.equal(engine.joinTeam(a.id, teamId).ok, true);
  assert.equal(engine.joinTeam(b.id, teamId).ok, true);
  engine.finish();

  assert.equal(Object.keys(engine.state.vouchers).length, 1,
    'a team of six would redeem six drinks');
  const one = engine.playerView(a.id).voucher;
  const two = engine.playerView(b.id).voucher;
  assert.ok(one && two, 'somebody on the winning team was shown nothing');
  assert.equal(one.code, two.code, 'the team was handed two different codes');
});

test('a TIE gets one each, because the room watched it happen', () => {
  const { engine } = withGame({ reward: 'A free drink' });
  const a = engine.join({ name: 'Rob' });
  const b = engine.join({ name: 'Jo' });
  engine.state.players[a.id].score = 100;
  engine.state.players[b.id].score = 100;
  engine.finish();
  assert.equal(Object.keys(engine.state.vouchers).length, 2,
    'the app picked a winner the projector did not');
});

// ------------------------------------------------------- first, second, third

test('three prizes go to three places, and each gets its own', () => {
  const { engine } = withGame({ reward: '' });
  engine.state.rewards = ['A free drink', 'A bag of crisps', 'A packet of nuts'];
  const a = engine.join({ name: 'Rob' });
  const b = engine.join({ name: 'Jo' });
  const c = engine.join({ name: 'Sam' });
  engine.state.players[a.id].score = 300;
  engine.state.players[b.id].score = 200;
  engine.state.players[c.id].score = 100;
  engine.finish();

  const by = (id) => engine.playerView(id).voucher;
  assert.equal(by(a.id).reward, 'A free drink');
  assert.equal(by(a.id).place, 1);
  assert.equal(by(b.id).reward, 'A bag of crisps');
  assert.equal(by(b.id).place, 2);
  assert.equal(by(c.id).reward, 'A packet of nuts');
  assert.equal(by(c.id).place, 3);
});

test('one prize still means one voucher — fourth place gets nothing either', () => {
  const { engine } = withGame();
  engine.state.rewards = ['A free drink'];
  const a = engine.join({ name: 'Rob' });
  const b = engine.join({ name: 'Jo' });
  engine.state.players[a.id].score = 300;
  engine.state.players[b.id].score = 200;
  engine.finish();
  assert.equal(Object.keys(engine.state.vouchers).length, 1);
  assert.equal(engine.playerView(b.id).voucher, undefined, 'second place was given a prize nobody set');
});

/*
 * `rankPlayers` gives 1, 2, 2, 4 so the projector never lies about a tie. The
 * vouchers follow it exactly: two tied for first BOTH take the first prize and
 * there is no second, because there is no second on the big screen either.
 */
test('A TIE FOR FIRST TAKES BOTH FIRST PRIZES, AND THERE IS NO SECOND', () => {
  const { engine } = withGame();
  engine.state.rewards = ['A free drink', 'A bag of crisps', 'A packet of nuts'];
  const a = engine.join({ name: 'Rob' });
  const b = engine.join({ name: 'Jo' });
  const c = engine.join({ name: 'Sam' });
  engine.state.players[a.id].score = 300;
  engine.state.players[b.id].score = 300;
  engine.state.players[c.id].score = 100;
  engine.finish();

  const issued = Object.values(engine.state.vouchers);
  assert.equal(issued.filter((v) => v.place === 1).length, 2, 'the room watched a tie and one of them got nothing');
  assert.equal(issued.filter((v) => v.place === 2).length, 0, 'a second prize was invented that the board does not show');
  // Sam is third on the board, so Sam takes the third prize.
  assert.equal(engine.playerView(c.id).voucher.place, 3);
  assert.equal(engine.playerView(c.id).voucher.reward, 'A packet of nuts');
});

test('a gap in the middle cannot be expressed', () => {
  const { engine } = withGame();
  // "first and third but not second" is not a thing anybody means, and it
  // would hand the third prize to whoever the board calls second.
  engine.state.rewards = ['A free drink', '', 'A packet of nuts'];
  const a = engine.join({ name: 'Rob' });
  const b = engine.join({ name: 'Jo' });
  const c = engine.join({ name: 'Sam' });
  engine.state.players[a.id].score = 300;
  engine.state.players[b.id].score = 200;
  engine.state.players[c.id].score = 100;
  engine.finish();
  assert.equal(engine.playerView(b.id).voucher, undefined, 'second place was skipped over');
  assert.equal(engine.playerView(c.id).voucher.reward, 'A packet of nuts',
    'third place got second place’s blank');
});

/*
 * A NIGHT LAUNCHED BEFORE THIS EXISTED IS SITTING IN A STATE FILE, and may be
 * running in a room right now. Losing its prize on the next restart is exactly
 * what putting it in the state was meant to prevent.
 */
test('an older game with a single `reward` still issues its voucher', () => {
  const { engine } = withGame();
  delete engine.state.rewards;
  engine.state.reward = 'A free drink at the bar';
  engine.join({ name: 'Rob' });
  engine.finish();
  const issued = Object.values(engine.state.vouchers);
  assert.equal(issued.length, 1);
  assert.equal(issued[0].reward, 'A free drink at the bar');
});

test('trailing blanks are not prizes', () => {
  const { engine } = withGame();
  engine.state.rewards = ['A free drink', '', ''];
  engine.join({ name: 'Rob' });
  engine.finish();
  assert.equal(Object.keys(engine.state.vouchers).length, 1);
  assert.deepEqual(engine.rewardList(), ['A free drink']);
});

/*
 * THE END OF THE QUIZ, NEVER THE END OF A ROUND.
 *
 * The host's own night is one round of twenty questions, so the round board
 * after round one is the last thing before the final — and a voucher that
 * appeared on the board would be handing out drinks while the quiz was still
 * technically running. Issuing happens on the way INTO `FINAL` and the card is
 * only in a payload at `FINAL`, so both halves have to be wrong for this to
 * leak. Pinned because it is the question the host asked before running it.
 */
test('a voucher is issued at the END OF THE QUIZ, not at a round board', () => {
  const twoRounds = {
    id: 'q2', title: 'Two rounds', questionSeconds: 20,
    rounds: [
      { id: 'r1', type: 'text', title: 'One', questions: [
        { id: 'a', prompt: 'A?', options: ['a', 'b', 'c', 'd'], correctIndex: 0 }] },
      { id: 'r2', type: 'text', title: 'Two', questions: [
        { id: 'b', prompt: 'B?', options: ['a', 'b', 'c', 'd'], correctIndex: 0 }] },
    ],
  };
  let at = Date.parse('2026-08-14T21:00:00.000Z');
  const engine = new Engine({ quiz: twoRounds, now: () => at });
  engine.state.rewards = ['A free drink'];
  const rob = engine.join({ name: 'Rob' });

  // Drive it: rules, round intro, question, reveal, round board…
  for (let i = 0; i < 20 && engine.state.phase !== PHASES.ROUND_BOARD; i++) {
    at += 21000;
    engine.next();
  }
  assert.equal(engine.state.phase, PHASES.ROUND_BOARD, 'never reached a round board');
  assert.deepEqual(engine.state.vouchers, {}, 'a prize was handed out between rounds');
  assert.equal(engine.playerView(rob.id).voucher, undefined,
    'the leader was shown a voucher while the quiz was still running');

  // …and on to the end.
  for (let i = 0; i < 30 && engine.state.phase !== PHASES.FINAL; i++) {
    at += 21000;
    engine.next();
  }
  assert.equal(engine.state.phase, PHASES.FINAL);
  assert.equal(Object.keys(engine.state.vouchers).length, 1, 'nothing was issued at the end');
  assert.ok(engine.playerView(rob.id).voucher, 'the winner was told nothing at the final');
});
/*
 * THE VENUE'S LOGO ON THE VOUCHER — and the three things that keep it
 * decoration rather than a dependency.
 *
 * A voucher is a credential a stranger behind the bar has to decide whether to
 * honour, and the pub's own mark is what makes it read as the pub's rather
 * than the quiz app's. But the prize is WORDS, and it must stay words.
 */
test('the winner\'s phone carries the venue logo, and the projector never does', () => {
  const png = 'data:image/png;base64,iVBORw0KGgo=';
  const { engine } = withGame({ reward: 'A £30 bar tab' });
  engine.state.venue = 'The Dog & Duck';
  engine.state.venueLogo = png;
  const rob = engine.join({ name: 'Rob' });
  engine.finish();

  const view = engine.playerView(rob.id);
  assert.equal(view.voucher.logo, png);
  assert.equal(view.voucher.reward, 'A £30 bar tab', 'the words are still the prize');

  /*
   * NOT ON THE BIG SCREEN, and this is about bytes rather than secrecy. A logo
   * in the projector's payload rides in every state push — which at a lobby is
   * every time somebody joins, so sixty joins is sixty copies over pub wifi on
   * the one connection that must not stutter. If the big screen ever wants it,
   * it wants a URL it can cache.
   */
  const screen = JSON.stringify(engine.screenView());
  assert.ok(!screen.includes('base64'), 'the logo reached the projector payload');
});

test('no logo means no field, so an ordinary venue gains nothing', () => {
  const { engine } = withGame({ reward: 'A £30 bar tab' });
  const rob = engine.join({ name: 'Rob' });
  engine.finish();
  assert.equal('logo' in engine.playerView(rob.id).voucher, false,
    'a venue with no logo grew an empty field on every voucher');
});

test('a game restored from before logos existed simply has none', () => {
  const { engine } = withGame({ reward: 'A £30 bar tab' });
  const old = JSON.parse(JSON.stringify(engine.state));
  delete old.venueLogo;
  const back = new Engine({ quiz: QUIZ, state: old, now: () => Date.parse('2026-08-14T21:00:00.000Z') });
  const rob = back.join({ name: 'Rob' });
  back.finish();
  assert.equal(back.playerView(rob.id).voucher.logo, undefined);
});

/*
 * ---- HOW MANY WINNERS TONIGHT HAS ---------------------------------------
 *
 * *"I want to be able to define how many winners there are for a specific
 * quiz — tonight I want to do two shorter quizzes and only have a single
 * winner for each."*
 *
 * The setting can only ever SUBTRACT, which is what made it safe to add on a
 * gig day: it caps the places that are paid and the places the podium draws,
 * and it can never invent a prize the venue did not put up.
 */

test('one winner pays one place, even with three prizes on the venue', () => {
  const { engine } = withGame();
  engine.state.rewards = ['A free drink', 'A bag of crisps', 'A packet of nuts'];
  engine.state.winners = 1;
  const a = engine.join({ name: 'Rob' });
  const b = engine.join({ name: 'Jo' });
  const c = engine.join({ name: 'Sam' });
  engine.state.players[a.id].score = 300;
  engine.state.players[b.id].score = 200;
  engine.state.players[c.id].score = 100;
  engine.finish();

  assert.equal(Object.keys(engine.state.vouchers).length, 1, 'more than the one winner was paid');
  assert.equal(engine.playerView(a.id).voucher.reward, 'A free drink');
  assert.equal(engine.playerView(b.id).voucher, undefined, 'second was paid on a one-winner night');
  assert.equal(engine.playerView(c.id).voucher, undefined, 'third was paid on a one-winner night');
});

test('IT CAN ONLY SUBTRACT — three winners and one prize still pays one', () => {
  // The guard is a floor, not a substitute: `rewards[position - 1]` still has
  // to find a prize, so a generous `winners` cannot conjure one.
  const { engine } = withGame();
  engine.state.rewards = ['A free drink'];
  engine.state.winners = 3;
  const a = engine.join({ name: 'Rob' });
  const b = engine.join({ name: 'Jo' });
  engine.state.players[a.id].score = 300;
  engine.state.players[b.id].score = 200;
  engine.finish();
  assert.equal(Object.keys(engine.state.vouchers).length, 1);
});

test('THE DEFAULT IS THREE, and a state written before this existed reads as three', () => {
  // A redeploy mid-season must not change what a running night pays out.
  const { engine } = withGame();
  engine.state.rewards = ['One', 'Two', 'Three'];
  delete engine.state.winners;
  const a = engine.join({ name: 'Rob' });
  const b = engine.join({ name: 'Jo' });
  const c = engine.join({ name: 'Sam' });
  engine.state.players[a.id].score = 300;
  engine.state.players[b.id].score = 200;
  engine.state.players[c.id].score = 100;
  engine.finish();
  assert.equal(Object.keys(engine.state.vouchers).length, 3,
    'a state with no `winners` field stopped paying three places');
});

test('the projector is told only when it is NOT the default', () => {
  /*
   * The field is spread in like the draw and the comeback band, so an ordinary
   * three-place night gains nothing at all and `pub-unchanged` still says
   * IDENTICAL. `screen.js` reads three when it is absent.
   */
  const { engine } = withGame();
  engine.join({ name: 'Rob' });
  engine.finish();
  assert.equal(engine.screenView().winners, undefined,
    'a default night put a new field on every projector payload');

  const two = withGame().engine;
  two.join({ name: 'Rob' });
  two.state.winners = 1;
  two.finish();
  assert.equal(two.screenView().winners, 1);
});

test('a tie for first is still paid in full on a one-winner night', () => {
  // Two rows share position 1, the room watched it happen, and the cap is on
  // POSITION rather than on how many rows have been paid.
  const { engine } = withGame();
  engine.state.rewards = ['A free drink', 'A bag of crisps'];
  engine.state.winners = 1;
  const a = engine.join({ name: 'Rob' });
  const b = engine.join({ name: 'Jo' });
  engine.state.players[a.id].score = 300;
  engine.state.players[b.id].score = 300;
  engine.finish();
  assert.equal(Object.keys(engine.state.vouchers).length, 2, 'a tied winner went unpaid');
  for (const v of Object.values(engine.state.vouchers)) assert.equal(v.place, 1);
});
