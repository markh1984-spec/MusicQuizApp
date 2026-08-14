/**
 * Which packs an account can reach.
 *
 * The upsell lever is CONTENT rather than capability: a Bronze host gets the
 * whole machine and a starter set of packs, and the pressure to move up
 * arrives on its own when the room has heard them all. Nothing is greyed out,
 * so nothing looks broken in front of a paying room.
 *
 * The ladder is built on CAPEX AND OPEX rather than on a pack count. An
 * evergreen pack is written once and sells for ever, so how much of that
 * library you get is the Bronze-to-Silver axis. A topical pack has to be
 * written every week or it stops being topical — the only recurring cost in
 * the product, and the one thing nobody can buy once and reuse — so it is what
 * Gold IS.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import * as plans from '../public/assets/plans.js';
import { packsFor, canPlayPack, TIER_PACKS, TIERS, PACK_PENCE, FEATURES, can } from '../public/assets/plans.js';
import { Accounts } from '../src/accounts.js';

import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function book() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quiz-ent-'));
  return new Accounts(path.join(dir, 'accounts.json'));
}

/*
 * The lever, switched on. This is what the whole ladder is made of: Bronze
 * buys packs, Silver gets them included — the host's own reasoning, and also
 * why a quizmaster never generates.
 *
 * Deliberately asserts the SHAPE rather than the contents. Which eight packs
 * Bronze starts with is a commercial decision that will move, and a test that
 * named them would fail every time somebody changed their mind rather than
 * every time something broke.
 */
test('Bronze is a starter set, Silver is the evergreen catalogue, Gold is the lot', () => {
  assert.ok(Array.isArray(TIER_PACKS.bronze), 'Bronze is no longer a starter set — was that deliberate?');
  assert.ok(TIER_PACKS.bronze.length >= 4, 'the starter set is too thin to run a month on');
  assert.equal(new Set(TIER_PACKS.bronze).size, TIER_PACKS.bronze.length, 'a pack is listed twice');

  assert.equal(TIER_PACKS.silver, 'evergreen', 'Silver no longer holds the evergreen catalogue');
  assert.equal(TIER_PACKS.gold, 'all', 'Gold no longer includes everything');
  assert.deepEqual(packsFor({ role: 'quizmaster', tier: 'bronze' }), TIER_PACKS.bronze);
});

/*
 * ============================================ CAPEX AND OPEX, AS A LADDER
 *
 * The split the whole ladder now rests on. An evergreen pack is written ONCE
 * and sells for ever — an asset, and a fair thing to meter. A topical one has
 * to be written every week or it stops being topical, which makes it the only
 * recurring cost in the product and the one thing that cannot be bought once
 * and reused. So it is what Gold IS.
 */
const EVERGREEN = { id: 'eighties', title: 'The Eighties Quiz' };
const TOPICAL = { id: 'topical-2026-08-11', title: 'The Topical Quiz', freshUntil: '2026-08-25T00:00:00.000Z' };

test('a dated pack is Gold, and it is told by its DATE rather than its name', () => {
  const silver = { role: 'quizmaster', tier: 'silver', status: 'active' };
  const gold = { role: 'quizmaster', tier: 'gold', status: 'active' };

  assert.equal(canPlayPack(silver, EVERGREEN.id, EVERGREEN), true);
  assert.equal(canPlayPack(silver, TOPICAL.id, TOPICAL), false, 'Silver got a topical pack for nothing');
  assert.equal(canPlayPack(gold, TOPICAL.id, TOPICAL), true);

  // Keyed on freshUntil, never on the id. A topical pack is named after the
  // day it was written, so a gate reading the name would work today and open
  // the moment somebody renamed one.
  assert.equal(canPlayPack(silver, 'topical-2026-08-11', {}), true,
    'the gate is reading the pack NAME — rename one and it is free');
  assert.equal(canPlayPack(silver, 'perfectly-ordinary-name', { freshUntil: '2026-08-25T00:00:00.000Z' }), false);
});

test('an account-level list still beats the tier, dated or not', () => {
  const bought = { role: 'quizmaster', tier: 'bronze', status: 'active', packs: [TOPICAL.id] };
  assert.equal(canPlayPack(bought, TOPICAL.id, TOPICAL), true, 'a bought topical pack was refused');
  assert.equal(canPlayPack(bought, EVERGREEN.id, EVERGREEN), false);
});

/*
 * The gradient, which is the reason for the whole arrangement: a Silver
 * subscriber buying topical weekly must spend MORE than Gold costs, or the
 * rung above them is not worth climbing to.
 */
test('buying topical weekly on Silver costs more than Gold', () => {
  const price = (id) => TIERS.find((t) => t.id === id).pence;
  const monthOfTopical = 4 * PACK_PENCE;
  assert.ok(price('silver') + monthOfTopical > price('gold'),
    'a Silver subscriber can buy topical weekly for less than Gold — the ladder has stopped being one');
  // And the step up from Bronze stays a step rather than a cliff.
  assert.ok(price('bronze') + monthOfTopical < price('gold'),
    'Bronze plus topical already costs more than Gold — nobody would ever buy a pack');
});

/*
 * The starter packs have to BE packs. A list of ids drifts silently when one is
 * renamed — the pack does not disappear, it just stops being in Bronze, and
 * nothing on any screen says so.
 */
test('every pack in the starter set is really in the catalogue', () => {
  const inLibrary = new Set([
    ...fs.readdirSync(path.join(ROOT, 'quizzes')).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)),
    ...fs.readdirSync(path.join(ROOT, 'bingo')).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)),
  ]);
  for (const id of TIER_PACKS.bronze) {
    assert.ok(inLibrary.has(id), `Bronze starts with "${id}", which is not in the catalogue — renamed?`);
  }
});

/*
 * A price is a decision, but a FREE rung is a structural one: the machine is
 * the same at every level, so a £0 tier is somebody running paying gigs on it
 * forever. The host decided against one. A trial is a status, not a rung.
 */
test('there is no free rung', () => {
  for (const tier of TIERS) {
    assert.ok(tier.pence > 0, `${tier.id} is free — a trial is a status, not a tier`);
  }
});

test('a starter list on the account beats the tier', () => {
  const rob = { role: 'quizmaster', tier: 'bronze', packs: ['eighties', 'madonna'] };
  assert.deepEqual(packsFor(rob), ['eighties', 'madonna']);
  assert.equal(canPlayPack(rob, 'eighties'), true);
  assert.equal(canPlayPack(rob, 'metallica'), false);
});

test('an empty list means none, and is not confused with following the tier', () => {
  assert.deepEqual(packsFor({ role: 'quizmaster', tier: 'bronze', packs: [] }), []);
  assert.equal(canPlayPack({ role: 'quizmaster', packs: [] }, 'anything'), false);
});

/*
 * The three that must never be restricted. An owner writes the catalogue, the
 * host key is every hat at once, and a comped account is the owner's own
 * quizmaster — locking any of them out of a pack would be locking the author
 * out of their own work.
 */
test('the owner, the host key and a comped account always see everything', () => {
  assert.equal(packsFor({ role: 'owner' }), 'all');
  assert.equal(packsFor({ bootstrap: true }), 'all');
  assert.equal(packsFor({ role: 'quizmaster', tier: 'bronze', comped: true, packs: ['one'] }), 'all');
});

test('a pack list is an entitlement, so it is set by the owner and not by prefs', () => {
  const accounts = book();
  accounts.create({ email: 'rob@x.com', password: 'a-long-test-password', role: 'quizmaster' });
  const rob = accounts.all.find((a) => a.email === 'rob@x.com');

  accounts.update(rob.id, { packs: ['eighties'] });
  assert.deepEqual(accounts.find(rob.id).packs, ['eighties']);

  // The wall: a preferences payload must not widen what you can reach.
  accounts.setPrefs(rob.id, { packs: ['eighties', 'metallica', 'madonna'] });
  assert.deepEqual(accounts.find(rob.id).packs, ['eighties'], 'prefs handed out packs');
});

test('null clears the list back to the tier, an empty array does not', () => {
  const accounts = book();
  accounts.create({ email: 'rob@x.com', password: 'a-long-test-password', role: 'quizmaster' });
  const rob = accounts.all.find((a) => a.email === 'rob@x.com');

  accounts.update(rob.id, { packs: ['eighties'] });
  accounts.update(rob.id, { packs: [] });
  assert.deepEqual(accounts.find(rob.id).packs, [], 'an empty list is a real answer meaning none');

  accounts.update(rob.id, { packs: null });
  assert.equal(accounts.find(rob.id).packs, undefined, 'null follows the tier again');
  // Back to whatever the tier says — which for a brand new account is Bronze's
  // starter set, not the whole catalogue.
  assert.deepEqual(packsFor(accounts.find(rob.id)), TIER_PACKS.bronze);
});

test('duplicate ids are folded, and rubbish is dropped', () => {
  const accounts = book();
  accounts.create({ email: 'rob@x.com', password: 'a-long-test-password', role: 'quizmaster' });
  const rob = accounts.all.find((a) => a.email === 'rob@x.com');
  accounts.update(rob.id, { packs: ['a', 'a', '', 'b'] });
  assert.deepEqual(accounts.find(rob.id).packs, ['a', 'b']);
});

test('a list that is not a list is refused rather than half-stored', () => {
  const accounts = book();
  accounts.create({ email: 'rob@x.com', password: 'a-long-test-password', role: 'quizmaster' });
  const rob = accounts.all.find((a) => a.email === 'rob@x.com');
  assert.throws(() => accounts.update(rob.id, { packs: 'eighties' }), /list of pack ids/);
  assert.equal(accounts.find(rob.id).packs, undefined);
});

/*
 * The library is what you can PLAY, not what you can DO. A starter set must
 * not quietly take the running of a night away with it — that is the whole
 * point of choosing content as the lever instead of capability.
 */
test('a smaller library takes away no features at all', () => {
  const full = { role: 'quizmaster', tier: 'bronze', status: 'active' };
  const starter = { ...full, packs: ['eighties'] };
  for (const feature of [FEATURES.QUIZ, FEATURES.BINGO, FEATURES.LIBRARY, FEATURES.PHOTOS, FEATURES.LOOKS]) {
    assert.equal(can(starter, feature), can(full, feature), `${feature} changed with the pack list`);
  }
});

/*
 * The account page's line about what a higher tier holds.
 *
 * The first version named the LOWEST tier that includes the whole catalogue —
 * which today is Bronze, since nothing is switched on. So a Bronze subscriber
 * on a starter list was told "Bronze includes every pack" while looking at
 * three of seven. That reads as a fault in their account, not as an offer.
 *
 * Kept in step with server.js: only ever a tier ABOVE this one, and nothing
 * about tiers at all when the limit is an explicit list rather than the ladder.
 */
function upsellLine(who, tierPacks) {
  const { TIERS, tierFor } = plans;
  const theirs = TIERS.find((t) => t.id === tierFor(who || {}));
  const rank = theirs ? theirs.rank : -1;
  // The NEXT rung that widens the library, not the top one — since Silver
  // holds the evergreen catalogue and Gold adds the weekly topical quizzes,
  // "the lowest tier holding everything" would skip the step a Bronze
  // subscriber should actually take.
  const up = TIERS
    .filter((t) => t.rank > rank && (tierPacks[t.id] === 'all' || tierPacks[t.id] === 'evergreen'))
    .sort((a, b) => a.rank - b.rank)[0];
  return up ? `${up.label} includes every pack` : 'Ask about the rest of the catalogue.';
}

test('the upsell never names the tier the reader is already on', () => {
  const allAll = { bronze: 'all', silver: 'all', gold: 'all' };
  const rob = { role: 'quizmaster', tier: 'bronze', packs: ['one'] };
  const line = upsellLine(rob, allAll);
  assert.doesNotMatch(line, /Bronze/, 'told a Bronze reader that Bronze has everything');
  assert.match(line, /Silver/);
});

test('a Gold reader with a hand-set list is sold nothing, because there is nothing above', () => {
  const allAll = { bronze: 'all', silver: 'all', gold: 'all' };
  const line = upsellLine({ role: 'quizmaster', tier: 'gold', packs: ['one'] }, allAll);
  assert.match(line, /Ask about the rest/);
  assert.doesNotMatch(line, /Gold|Silver|Bronze/);
});

test('once Bronze is a starter set, a Bronze reader is pointed at Silver', () => {
  const starter = { bronze: ['one', 'two'], silver: 'evergreen', gold: 'all' };
  const line = upsellLine({ role: 'quizmaster', tier: 'bronze' }, starter);
  assert.match(line, /Silver includes every pack/);
});

// ========================================================== the shop window

/*
 * **The hole the tier lever opened, and the test that keeps it shut.**
 *
 * Launching a pack outside your library was refused from the day the lever was
 * built. READING one was not — and a pack read hands over every question and
 * every answer, so a starter library could be worked around by opening the
 * other packs and copying them out. A content lever with a hole in it is not a
 * lever, and this one was invisible for as long as every tier was `'all'`.
 */
/*
 * **The gate that was open for an afternoon, and how.**
 *
 * Reading and launching take a bare pack ID, so they cannot tell a topical
 * pack from an evergreen one without opening the file — which is what
 * `packDating` is for. Its first version read `freshUntil` off the WRAPPER
 * `readPack` returns (`{ pack, mine }`) rather than off the pack, so every
 * dated pack came back looking evergreen and Silver could read and launch the
 * lot.
 *
 * It was invisible from the console, which is the part worth remembering: the
 * shop card is drawn from the library LISTING, which filters correctly, so the
 * padlock was on the card while the API behind it said 200. Found by signing
 * in as a Silver account against a running server, not by reading the code.
 */
test('the dated-pack gate opens the file, and reads the PACK rather than the wrapper', () => {
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const dating = server.match(/function packDating[\s\S]*?\n}/);
  assert.ok(dating, 'packDating has gone — the read and launch gates cannot see a date any more');
  assert.match(dating[0], /const \{ pack \}/,
    'packDating is reading freshUntil off readPack\'s wrapper again — every topical pack is free');
  assert.match(dating[0], /freshUntil/);

  for (const gate of ['function mayReadPack', 'const launchKind =']) {
    const at = server.indexOf(gate);
    assert.ok(at > 0, `${gate} has moved`);
    assert.match(server.slice(at, at + 1400), /packDating/,
      `${gate} no longer tells a topical pack from an evergreen one`);
  }
});

/*
 * AND THE LAUNCH GATE HAS TO CHECK EVERY PACK IN A RUNNING ORDER.
 *
 * Tonight can be composed of rounds taken from several packs. The gate used
 * to read one `body.packId`, which is exactly right for one pack and a hole
 * the moment there are several: a Bronze account borrowing one round out of a
 * Gold quiz would walk round the whole subscription in a drag, and the failure
 * is silent — the night simply plays.
 *
 * Read off the source rather than driven, for the reason the test above gives:
 * the gate needs a real signed-in account and a dated pack to exercise
 * properly, and the thing most likely to break it is somebody simplifying the
 * loop back to a single id.
 */
test('the launch gate checks EVERY pack in a running order, not just the first', () => {
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const at = server.indexOf('const launchKind =');
  assert.ok(at > 0, 'the launch gate has moved');
  const gate = server.slice(at, at + 1400);

  assert.match(gate, /body\.order/, 'the launch gate no longer looks at the running order at all');
  assert.match(gate, /for \(const id of needed\)/,
    'the launch gate is back to checking a single pack id — a composed night bypasses the tier');
  assert.match(gate, /canPlayPack/);
  assert.match(gate, /isOwnPack/);
});

test('reading a pack you do not hold is refused, not just launching it', () => {
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const guard = server.match(/function mayReadPack[\s\S]*?\n}/);
  assert.ok(guard, 'mayReadPack has gone — the pack read routes are open again');
  assert.match(guard[0], /canPlayPack/, 'the read gate no longer asks what they hold');
  // Their OWN packs are never a tier question — no tier reaches that library.
  assert.match(guard[0], /isOwnPack/, 'a quizmaster can no longer read a pack they wrote');

  for (const route of ["/api/quiz/", "/api/bingo/", "/api/images/"]) {
    const at = server.indexOf(`route.slice('${route}'.length)`);
    assert.ok(at > 0, `${route} has moved`);
    assert.match(server.slice(at, at + 400), /mayReadPack/,
      `${route} does not check what this account holds`);
  }
});

/*
 * A shop window shows the label, never the contents.
 *
 * A pack summary carries `search` — every question, answer, artist and track
 * title blobbed together for the search box — and a bingo summary carries a
 * Spotify link to the whole track list. Either one sent alongside a padlock
 * would be decoration rather than a lever.
 */
test('a pack you have not bought is sent with nothing of the pack in it', () => {
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const shop = server.match(/function withShop[\s\S]*?\n}/);
  assert.ok(shop, 'withShop has gone');
  assert.match(shop[0], /search[\s\S]{0,40}playlist/,
    'a locked summary no longer strips the search blob and the playlist link');
  assert.match(shop[0], /locked: true/, 'a locked pack is no longer marked as one');
});

/*
 * The price is set to make the UPGRADE obvious rather than to make money, so
 * the floor is the Silver gap divided by a weekly host's four packs a month.
 * Below £2.50 nobody running weekly ever has a reason to climb, and the whole
 * Bronze-buys / Silver-includes structure stops being a ladder.
 */
test('a pack costs more than a quarter of the step up to Silver', () => {
  const bronze = TIERS.find((t) => t.id === 'bronze');
  const silver = TIERS.find((t) => t.id === 'silver');
  const gap = silver.pence - bronze.pence;
  assert.ok(PACK_PENCE * 4 > gap,
    `at ${PACK_PENCE}p a pack, a weekly host pays ${PACK_PENCE * 4}p a month rather than `
    + `${gap}p to upgrade — Bronze wins and the ladder stops being one`);
});
