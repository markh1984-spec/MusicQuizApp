/**
 * Who is allowed to do what.
 *
 * The tests here are the commercial rules written down: what Basic gets, what
 * costs money and is therefore not in Basic, and the one that matters most on
 * the night — a lapsed subscription must never black out a live projector.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  FEATURES, TIERS, FEATURE_TIER, DEFAULT_TIER,
  can, featuresFor, activeFeatures, whyNot, entitlements,
  tierFor, tierRank, featuresAt, ladderFor, FEATURE_META, switchable, SWITCHABLE, NOT_BUILT } from '../public/assets/plans.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const owner = { role: 'owner' };
const basic = { role: 'quizmaster', tier: 'bronze', status: 'active' };
const withAdmin = { role: 'quizmaster', tier: 'silver', status: 'active' };
const gold = { role: 'quizmaster', tier: 'gold', status: 'active' };
const mark = { role: 'quizmaster', tier: 'bronze', comped: true, status: 'active' };

test('Basic runs a whole night, both games', () => {
  assert.equal(can(basic, FEATURES.QUIZ), true);
  assert.equal(can(basic, FEATURES.BINGO), true);
  assert.equal(can(basic, FEATURES.LIBRARY), true);
  assert.equal(can(basic, FEATURES.BUY_PACKS), true);
  assert.equal(can(basic, FEATURES.LOOKS), true);
  assert.equal(can(basic, FEATURES.PHOTOS), true);
});

/*
 * Advert slides are the one thing up a rung for a reason other than cost.
 *
 * A slide costs nothing to run, so the host's rule does not push it out of
 * Bronze — but that rule only says what cannot be in Bronze. This one is
 * Silver because it makes the QUIZMASTER money: they sell the venue the
 * product nobody is shifting this week, and a QR to tickets they take a cut
 * of. It pays for the upgrade in their terms rather than the owner's.
 *
 * And the usual objection does not apply: withholding a capability normally
 * means the GAME looking cheap in front of sixty people, which is the one
 * thing Bronze must never do. A slide is not part of the game and a room that
 * never sees one does not know it was possible.
 */
test('advert slides are Silver — they make the quizmaster money', () => {
  assert.equal(can(basic, FEATURES.ADVERTS), false);
  assert.equal(can(withAdmin, FEATURES.ADVERTS), true);
  assert.equal(can(gold, FEATURES.ADVERTS), true);
});

test('nothing that costs the owner money per use is in Bronze', () => {
  // The rule the tiers are drawn with. If one of these ever passes, either the
  // cost moved or somebody put a bill on the owner's account by accident.
  for (const feature of [FEATURES.GENERATE, FEATURES.ARTWORK, FEATURES.STREAM]) {
    assert.equal(can(basic, feature), false, `${feature} must not be in Basic`);
  }
});

test('a quizmaster can never generate a quiz — the packs are written for them', () => {
  for (const account of [basic, withAdmin, mark]) {
    assert.equal(can(account, FEATURES.GENERATE), false);
    assert.equal(can(account, FEATURES.ARTWORK), false);
  }
  assert.equal(can(owner, FEATURES.GENERATE), true);
  // And it says why, rather than just refusing.
  assert.match(whyNot(basic, FEATURES.GENERATE), /written for you/);
});

/*
 * ================================================================ THE LADDER
 *
 * Three tiers and they STACK: Gold includes Silver includes Bronze. This is the
 * structure the pricing hangs off, so it is asserted directly rather than
 * inferred from whichever features happen to be in each today — the features
 * will move, the ladder should not.
 */
test('the tiers are an ordered ladder with no gaps or ties', () => {
  const ranks = TIERS.map((t) => t.rank);
  assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b), 'TIERS is not in rank order');
  assert.equal(new Set(ranks).size, ranks.length, 'two tiers share a rank');
  assert.equal(TIERS[0].id, DEFAULT_TIER, 'the bottom rung is not the default');
  for (const tier of TIERS) {
    assert.ok(tier.label, `${tier.id} has no label`);
    assert.ok(tier.plan, `${tier.id} has no plan name`);
    assert.ok(tier.blurb, `${tier.id} has no blurb`);
    assert.equal(typeof tier.pence, 'number', `${tier.id} has no price`);
  }
});

test('a tier includes everything below it', () => {
  for (const tier of TIERS) {
    const held = featuresAt(tier.id);
    for (const lower of TIERS.filter((t) => t.rank < tier.rank)) {
      for (const f of featuresAt(lower.id)) {
        assert.ok(held.includes(f), `${tier.id} is missing ${f} from ${lower.id}`);
      }
    }
  }
});

test('every feature on the ladder is on exactly one rung', () => {
  for (const [feature, tier] of Object.entries(FEATURE_TIER)) {
    assert.ok(TIERS.some((t) => t.id === tier), `${feature} is on "${tier}", which is not a tier`);
  }
  // Owner-only features are deliberately NOT on the ladder — they are not for
  // sale at any price, so putting one on a rung would be offering to sell it.
  for (const f of [FEATURES.GENERATE, FEATURES.ARTWORK, FEATURES.CATALOGUE, FEATURES.SUBSCRIBERS, FEATURES.PHOTO_EXPORT]) {
    assert.equal(FEATURE_TIER[f], undefined, `${f} is on the ladder and must not be`);
  }
});

/*
 * Invoicing used to be the example here. It is Bronze now: the tiers separate
 * on QUIZ-APP functionality rather than on business tools, and withholding the
 * thing that helps a quizmaster get paid creates no upgrade pressure — it just
 * makes the app less useful to the person you most want recommending it.
 * Advert slides stay above Bronze because a slide is part of the show.
 */
test('a venue slide is above Bronze, and it says which tier rather than just no', () => {
  assert.equal(can(basic, FEATURES.ADVERTS), false);
  assert.equal(can(withAdmin, FEATURES.ADVERTS), true);
  assert.equal(can(basic, FEATURES.CALENDAR), true, 'the calendar is a business tool, so it is Bronze');
  assert.equal(can(basic, FEATURES.INVOICES), true, 'invoicing is a business tool, so it is Bronze');
  // "Not on your plan" is a dead end. "That is on Silver" is something to act on.
  assert.match(whyNot(basic, FEATURES.ADVERTS), /Silver/);
});

test('streaming is the top of the ladder, because egress is a real bill', () => {
  assert.equal(can(withAdmin, FEATURES.STREAM), false);
  assert.equal(can(gold, FEATURES.STREAM), true);
  assert.match(whyNot(basic, FEATURES.STREAM), /Gold/);
});

/*
 * The switches on the My account page. A quizmaster may turn OFF anything their
 * tier includes — and that is the only direction the switch works in.
 */
test('a switch can only ever subtract from what the tier includes', () => {
  const off = { ...withAdmin, prefs: { featuresOff: [FEATURES.INVOICES, FEATURES.STREAM] } };
  // Off means off, on the page.
  assert.ok(!activeFeatures(off).includes(FEATURES.INVOICES));
  // …but the entitlement is untouched, which is what the server gate reads, so
  // a switch can never lock somebody out in the middle of a night.
  assert.ok(featuresFor(off).includes(FEATURES.INVOICES));
  assert.equal(can(off, FEATURES.INVOICES), true);
  // And a feature above the tier is not reachable by naming it either way.
  assert.ok(!activeFeatures(off).includes(FEATURES.STREAM));
  assert.ok(!featuresFor(off).includes(FEATURES.STREAM));
  assert.equal(can(off, FEATURES.STREAM), false);
  // Whatever is switched off, ON is always a subset of ENTITLED.
  for (const f of activeFeatures(off)) assert.ok(featuresFor(off).includes(f));
});

test('the ladder the account page draws says which rungs are yours', () => {
  const ladder = ladderFor(withAdmin);
  assert.deepEqual(ladder.map((t) => t.id), TIERS.map((t) => t.id), 'the page would draw them out of order');
  assert.deepEqual(ladder.map((t) => t.included), [true, true, false]);
  const silver = ladder.find((t) => t.id === 'silver');
  assert.ok(silver.features.some((f) => f.id === FEATURES.ADVERTS));
  assert.ok(silver.features.every((f) => f.label), 'a feature reached the page with no name on it');
  // A tier above yours still lists what is in it — something you can see and
  // cannot use is a thing you might buy.
  assert.ok(ladder.find((t) => t.id === 'gold').features.length);
});

test('an old plan-and-add-ons account still reads as the right tier', () => {
  assert.equal(tierFor({ plan: 'basic', addons: [] }), 'bronze');
  assert.equal(tierFor({ plan: 'basic', addons: ['admin'] }), 'silver');
  assert.equal(tierFor({ plan: 'basic', addons: ['admin', 'stream'] }), 'gold');
  assert.equal(tierFor({}), DEFAULT_TIER);
  // An explicit tier always wins over the old fields.
  assert.equal(tierFor({ tier: 'gold', addons: [] }), 'gold');
  assert.equal(tierRank('gold') > tierRank('bronze'), true);
});

test("the owner's own quizmaster account gets everything, for nothing", () => {
  for (const feature of Object.keys(FEATURE_TIER)) {
    assert.equal(can(mark, feature), true, `comped account should have ${feature}`);
  }
  // But it is still not the owner console.
  assert.equal(can(mark, FEATURES.SUBSCRIBERS), false);
});

test('the owner account runs no quiz nights of its own', () => {
  assert.equal(can(owner, FEATURES.QUIZ), false);
  assert.equal(can(owner, FEATURES.INVOICES), false);
  assert.equal(can(owner, FEATURES.SUBSCRIBERS), true);
  assert.equal(can(owner, FEATURES.CATALOGUE), true);
  assert.match(whyNot(owner, FEATURES.QUIZ), /quizmaster account/);
});

test('an unpaid subscription loses its features', () => {
  const lapsed = { ...basic, status: 'past_due' };
  assert.equal(can(lapsed, FEATURES.QUIZ), false);
  assert.deepEqual(featuresFor(lapsed), []);
  assert.match(whyNot(lapsed, FEATURES.QUIZ), /needs a payment/);

  const cancelled = { ...basic, status: 'cancelled' };
  assert.equal(can(cancelled, FEATURES.QUIZ), false);
  assert.match(whyNot(cancelled, FEATURES.QUIZ), /has ended/);
});

test('a trial is a paying customer as far as the app is concerned', () => {
  assert.equal(can({ ...basic, status: 'trialing' }, FEATURES.QUIZ), true);
});

test('nobody at all can do anything', () => {
  assert.equal(can(null, FEATURES.QUIZ), false);
  assert.equal(can(undefined, FEATURES.QUIZ), false);
  assert.equal(can(basic, ''), false);
  assert.equal(can(basic, 'made.up.feature'), false);
  assert.match(whyNot(null, FEATURES.QUIZ), /not signed in/);
});

test('the console is told what is missing AND why, so it can offer it', () => {
  const ent = entitlements(basic);
  assert.equal(ent.tier, 'bronze');
  assert.ok(ent.features.includes(FEATURES.QUIZ));
  assert.ok(ent.ladder.length, 'the account page has no ladder to draw');

  const invoices = ent.missing.find((m) => m.feature === FEATURES.ADVERTS);
  assert.ok(invoices, 'invoicing should be offered rather than hidden');
  assert.match(invoices.why, /Silver/);

  // Owner-only things are not for sale, so they are not dangled.
  assert.equal(ent.missing.some((m) => m.feature === FEATURES.GENERATE), false);
  assert.equal(ent.missing.some((m) => m.feature === FEATURES.SUBSCRIBERS), false);
});

test('a comped account is marked as such, so the owner console can see why it pays nothing', () => {
  assert.equal(entitlements(mark).comped, true);
  assert.equal(entitlements(basic).comped, false);
});


/*
 * The one that nearly broke a gig.
 *
 * The owner account deliberately has no quiz controls: the owner writes and
 * sells packs and does not run nights. But Mark is one person with two hats and
 * one laptop, and signing in as the owner on the machine he runs gigs from must
 * not take the Launch button off his `?key=` bookmark.
 *
 * The rule that saves it is in server.js `whoIs()`: the HOST KEY beats a
 * signed-in account. It gives nothing away, because the key already grants
 * every feature — it just means the way in that predates accounts keeps working
 * whatever else is going on in the browser.
 */
test('the owner genuinely cannot run a night — that part is on purpose', () => {
  const owner = { role: 'owner', status: 'active' };
  assert.equal(can(owner, FEATURES.QUIZ), false);
  assert.equal(can(owner, FEATURES.BINGO), false);
  // …and can do the things that ARE the owner's job.
  assert.equal(can(owner, FEATURES.GENERATE), true);
  assert.equal(can(owner, FEATURES.SUBSCRIBERS), true);
});

test('the host key identity can run a night, which is why it must win', () => {
  // The shape server.js hands to `can()` for a request carrying the host key.
  const bootstrap = {
    role: 'quizmaster', tier: 'gold',
    comped: true, status: 'active', bootstrap: true,
  };
  assert.equal(can(bootstrap, FEATURES.QUIZ), true);
  assert.equal(can(bootstrap, FEATURES.BINGO), true);
  assert.equal(can(bootstrap, FEATURES.LIBRARY), true);
});

/*
 * …and it can do EVERYTHING, because that is what `allowed()` in server.js
 * already does: it short-circuits on the same `bootstrap` flag and never asks
 * about a feature at all. The browser's copy said basic-plus-add-ons, so the
 * console drew a page for somebody who could not generate a quiz or touch the
 * catalogue — with a "have a look in the shop" note where the generator goes,
 * shown to the man who writes the packs.
 *
 * The key already grants the lot, so agreeing with it cannot widen anything.
 * Every feature, asked one at a time, so a new one cannot be missed.
 */
test('the host key is every hat at once, on the page as well as on the server', () => {
  const bootstrap = {
    role: 'quizmaster', tier: 'gold',
    comped: true, status: 'active', bootstrap: true,
  };
  for (const feature of Object.values(FEATURES)) {
    assert.equal(can(bootstrap, feature), true, `the host key cannot ${feature}`);
  }
  const held = entitlements(bootstrap).features;
  for (const feature of Object.values(FEATURES)) {
    assert.ok(held.includes(feature), `/api/me would not report ${feature} for the host key`);
  }
  // Nothing to offer for sale to somebody who already has all of it.
  assert.deepEqual(entitlements(bootstrap).missing, []);
});


/*
 * Writing to the pack library is the owner's alone.
 *
 * Found by the owner putting the quizmaster hat on and looking at his own
 * console: a signed-in quizmaster could DELETE one of the owner's quizzes with
 * a single request. The packs are written to a house style and sold — three
 * people editing them is how that style stops being one, and one person
 * deleting them is worse.
 *
 * Reading is LIBRARY, which everybody has. Changing is CATALOGUE, which only
 * the owner has. The gate itself lives in server.js `CHANGES_THE_LIBRARY`.
 */
test('a quizmaster can read the library but never change it', () => {
  for (const tier of TIERS.map((t) => t.id)) {
    const qm = { role: 'quizmaster', tier, status: 'active' };
    assert.equal(can(qm, FEATURES.LIBRARY), true, `${tier} cannot read the library`);
    assert.equal(can(qm, FEATURES.CATALOGUE), false, `${tier} can CHANGE the library`);
  }
  // Comped and lapsed alike — this is not a billing question.
  assert.equal(can({ role: 'quizmaster', tier: 'gold', comped: true, status: 'active' }, FEATURES.CATALOGUE), false);
});

test('the owner can change the library, because writing the packs is the job', () => {
  assert.equal(can({ role: 'owner', status: 'active' }, FEATURES.CATALOGUE), true);
});

/*
 * ---------------------------------------- looking at it AS a subscriber
 *
 * The owner previewing a tier is `whoIs()` in server.js handing `can()` an
 * account with a `tier` and `comped` cleared. Two things have to hold, and both
 * are asserted on the shape the server actually builds:
 *
 *  1. it is a real downgrade — the console AND the gate agree, or a preview is
 *     a lie and worse than not having one;
 *  2. `comped` MUST be cleared, or the tier means nothing at all, because a
 *     comped account holds the whole ladder whatever tier it says.
 */
test('previewing a tier is a genuine downgrade, gate included', () => {
  const hat = { role: 'quizmaster', tier: 'gold', comped: true, status: 'active', actingAs: true };
  // As itself: comped, so the whole ladder.
  assert.equal(can(hat, FEATURES.STREAM), true);
  assert.equal(can(hat, FEATURES.INVOICES), true);

  const asBronze = { ...hat, previewTier: 'bronze', tier: 'bronze', comped: false };
  assert.equal(can(asBronze, FEATURES.QUIZ), true);
  assert.equal(can(asBronze, FEATURES.ADVERTS), false, 'a Bronze preview could still sell an advert slide');
  assert.equal(can(asBronze, FEATURES.STREAM), false);
  assert.match(whyNot(asBronze, FEATURES.ADVERTS), /Silver/);

  const asSilver = { ...hat, previewTier: 'silver', tier: 'silver', comped: false };
  assert.equal(can(asSilver, FEATURES.ADVERTS), true);
  assert.equal(can(asSilver, FEATURES.STREAM), false);
});

test('a preview that forgot to clear comped would show everything — so that is pinned', () => {
  // The failure mode this guards: keep `comped` and the tier is decoration.
  const wrong = { role: 'quizmaster', tier: 'bronze', comped: true, status: 'active' };
  assert.equal(can(wrong, FEATURES.STREAM), true, 'comped no longer means the whole ladder');
  const right = { ...wrong, comped: false };
  assert.equal(can(right, FEATURES.STREAM), false);
});

// It can only ever show LESS. There is nothing above the top of the ladder, and
// the account being previewed already holds all of it.
test('there is no tier above the top, so a preview can only subtract', () => {
  const top = TIERS[TIERS.length - 1].id;
  const everything = featuresAt(top);
  for (const tier of TIERS) {
    for (const f of featuresAt(tier.id)) {
      assert.ok(everything.includes(f), `${tier.id} has ${f}, which the top of the ladder does not`);
    }
  }
});

/*
 * **Anything on the ladder that does not exist yet has to say so.**
 *
 * The account page draws a row per feature with its blurb, and a rung that
 * lists something which is not built is a rung nobody trusts the rest of. This
 * was already the rule for streaming and had been missed for the calendar,
 * which advertised "the nights you have booked in" on a feature that exists
 * only as a name.
 *
 * When one of these gets built, delete it from the list AND drop "Not built
 * yet" from its blurb in the same breath.
 */
test('a feature that is not built says so on its own card', () => {
  /*
   * CALENDAR came off this list the day the diary was built.
   *
   * And the SAYING moved: it used to be prose in the blurb, which is not
   * checkable and was being repeated by the chip beside it. `NOT_BUILT` in
   * plans.js is the list, the account page draws a "not yet" chip from it and
   * offers no switch, and this is what fails if somebody adds a rung for
   * something that does not exist.
   */
  assert.deepEqual(NOT_BUILT, [FEATURES.MARKETING, FEATURES.STREAM]);
  for (const f of NOT_BUILT) {
    assert.ok(FEATURE_META[f], `${f} is on the not-built list but has nothing to draw`);
    assert.equal(switchable(f), false, `${f} offers a switch on something that does not exist`);
  }
  // Nothing should be claiming in prose to be unbuilt — that is the chip's job
  // now, and two places saying it is two places to forget to update.
  for (const [f, meta] of Object.entries(FEATURE_META)) {
    assert.doesNotMatch(meta.blurb, /not built yet/i,
      `${f} says it is not built — if that is now true, add it to the list above`);
  }
});

/*
 * Past gigs, and the line between looking and exporting.
 *
 * A quizmaster's own record of their nights is theirs — it is what they show a
 * venue they are pitching to, and withholding the evidence that somebody is
 * good at their job from the rung where they are still building the business
 * is the wrong way round. Getting the pictures OUT and onto social media is a
 * different job and a different person's: it is the owner's own workflow, on
 * the owner's own page.
 */
test('every quizmaster can see their own past gigs, from the bottom rung up', () => {
  assert.equal(can({ tier: 'bronze', status: 'active' }, FEATURES.PAST_GIGS), true);
  assert.equal(FEATURE_TIER[FEATURES.PAST_GIGS], 'bronze');
});

test('the owner can read their own past nights but a quizmaster cannot export photos', () => {
  // The owner runs gigs too — on the host key, in the house room — so the
  // record of them is theirs to read.
  assert.equal(can(owner, FEATURES.PAST_GIGS), true);
  assert.equal(can(owner, FEATURES.PHOTO_EXPORT), true);
  // And it is owner-only, so no rung and no comp hands it out.
  assert.equal(can({ tier: 'gold', status: 'active' }, FEATURES.PHOTO_EXPORT), false);
  assert.equal(can({ tier: 'gold', status: 'active', comped: true }, FEATURES.PHOTO_EXPORT), false);
});

/*
 * PHOTOS IS THE ONE SWITCH THAT REALLY REFUSES.
 *
 * Every other feature switch on My account is cosmetic by design — it tidies
 * the console and the server still answers, because a switch that could 403
 * somebody mid-gig is a reliability risk for no benefit. Photos cannot work
 * that way: the whole meaning of turning them off is that nobody in the room
 * can put a picture on the wall, and a switch that only hid the camera button
 * would be a promise the app does not keep.
 *
 * The check lives in `photosWanted()` in server.js. This pins that it is
 * WIRED — the route and the payload both go through it — because the failure
 * mode is silent: photos would simply keep working.
 */
test('turning photos off is enforced, not just hidden', () => {
  const source = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  assert.match(source, /function photosWanted\(/, 'the helper has gone');
  assert.match(source, /switchedOn\(account, FEATURES\.PHOTOS\)/,
    'photosWanted no longer reads the account preference');

  // The upload route must refuse, not merely stop drawing the button.
  const route = source.slice(source.indexOf("route === '/api/photo' && req.method === 'POST'"));
  assert.match(route.slice(0, 400), /photosWanted\(room\)/,
    'POST /api/photo does not ask whether this room takes photos');

  // And nothing may go back to reading the bare kill switch for these two.
  assert.doesNotMatch(source, /view\.photosOpen = photos\.enabled/,
    'the player payload is back on the kill switch alone');
});

/*
 * WHICH FEATURES EARN A SWITCH — the host's own rule, from looking at his
 * account page: *"'asking for a pack' isn't a feature worth turning on or off
 * since they can just ask for a pack when they want one, but advert slides is
 * — some venues might be for and others against and you genuinely need the
 * switch."*
 */
test('nothing that is not built carries a switch', () => {
  for (const f of NOT_BUILT) {
    assert.equal(switchable(f), false, `${f} offers a switch on something that does not exist`);
  }
});

test('the things the app IS are not switchable', () => {
  // Turning LIBRARY off takes both pack tabs away; turning QUIZ off leaves the
  // tab with no Launch on any card. Either is a console that looks broken.
  for (const f of [FEATURES.QUIZ, FEATURES.BINGO, FEATURES.LIBRARY]) {
    assert.equal(switchable(f), false, `${f} can be switched off, which breaks the console`);
  }
});

test('advert slides ARE switchable — the case the rule was written from', () => {
  assert.equal(switchable(FEATURES.ADVERTS), true);
  assert.equal(switchable(FEATURES.REQUEST_PACK), false,
    'you do not hide the thing that gets you a free pack, you just do not ask');
});

/* Every switchable feature must be a real one on the ladder, or the account
 * page would offer a control for something nobody can hold. */
test('every switchable feature is on the ladder', () => {
  for (const f of SWITCHABLE) {
    assert.ok(FEATURE_TIER[f], `${f} is switchable but on no tier`);
    assert.ok(FEATURE_META[f], `${f} is switchable but has nothing to draw`);
  }
});
