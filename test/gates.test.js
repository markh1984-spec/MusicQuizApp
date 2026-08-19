import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { OWNER_ONLY, changesTheLibrary } from '../src/gates.js';
import { consoleSource } from './console-source.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/*
 * These come straight out of a safety sweep: signing in as a quizmaster and
 * trying, one at a time, everything a subscriber should not be able to do.
 *
 * Two of them worked. `POST /api/quiz` took the id in the BODY rather than the
 * path, so the `startsWith('/api/quiz/')` test — with the trailing slash —
 * never matched it, and a quizmaster could overwrite any quiz in the library
 * with one request. `POST /api/bingo` had the identical gap. Importing, the
 * playlist builder and the no-repeats memory were open for a different reason:
 * none of them looks like "saving a pack", so none of them was on the list.
 *
 * The bare path and the prefix are therefore BOTH asserted for every one.
 */

test('a pack cannot be written by the path the id is not in', () => {
  for (const base of ['/api/quiz', '/api/bingo']) {
    for (const method of ['POST', 'PUT', 'DELETE']) {
      // The id in the body…
      assert.equal(changesTheLibrary(base, method), true,
        `${method} ${base} is not gated — the id goes in the body`);
      // …and the id in the path.
      assert.equal(changesTheLibrary(`${base}/madonna`, method), true,
        `${method} ${base}/madonna is not gated`);
    }
  }
});

test('annotating a pack is writing to it', () => {
  assert.equal(changesTheLibrary('/api/quiz/madonna/checked', 'POST'), true);
});

/*
 * Importing IS how bingo packs are made now, the playlist step writes to the
 * owner's own Spotify account, and forgetting the history is what brings a
 * song back in front of a room months early. None of the three saves a pack in
 * the obvious way and all three are the catalogue.
 */
test('import, the playlist builder and the no-repeats memory are the catalogue', () => {
  assert.equal(changesTheLibrary('/api/import/bingo', 'POST'), true);
  assert.equal(changesTheLibrary('/api/playlist/intro', 'POST'), true);
  assert.equal(changesTheLibrary('/api/history/forget', 'POST'), true);
});

test('reading is never writing', () => {
  for (const route of ['/api/quiz/madonna', '/api/bingo/disco-funk', '/api/library', '/api/history']) {
    assert.equal(changesTheLibrary(route, 'GET'), false, `${route} counted as a write`);
  }
});

// Checking a pasted pack against the rules saves nothing, so the editor can do
// it mid-edit without the catalogue.
test('validating a pack is not writing to the library', () => {
  assert.equal(changesTheLibrary('/api/quiz/__validate', 'POST'), false);
  assert.equal(changesTheLibrary('/api/bingo/__validate', 'POST'), false);
});

test('nothing outside the library is caught by accident', () => {
  for (const route of [
    '/api/host/next', '/api/host/launch', '/api/join', '/api/answer', '/api/photo',
    '/api/sign-in', '/api/me/password', '/api/invoices', '/api/owner/accounts',
  ]) {
    assert.equal(changesTheLibrary(route, 'POST'), false, `${route} wrongly needs the catalogue`);
  }
});

/*
 * Every route on the Invoices tab asks for the ADMIN ADD-ON, not the library.
 *
 * Three of them asked for `FEATURES.LIBRARY`, which every quizmaster has, so a
 * subscriber with no admin add-on at all could download somebody else's
 * invoice — an invoice carries the host's own sort code and account number and
 * the customer's address — and could mark one paid or cancel it. Found by
 * signing in as a quizmaster and simply fetching one.
 *
 * Read out of the source because the gate is one line inside the request
 * handler, the same trick `looks.test.js` uses to keep emoji out of the
 * seasonal shapes. A wrong gate here is a bank detail, not a papercut.
 */
test('nothing on the Invoices tab is gated on the library', () => {
  const lines = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8').split('\n');
  const offenders = [];
  lines.forEach((line, i) => {
    if (!/route\b.*['"`]\/api\/invoices/.test(line)) return;
    // The gate is the first `allowed(` within the few lines that open the route.
    for (const next of lines.slice(i, i + 6)) {
      if (!next.includes('allowed(')) continue;
      if (next.includes('FEATURES.LIBRARY')) offenders.push(`${i + 1}: ${line.trim()}`);
      break;
    }
  });
  assert.deepEqual(offenders, [],
    `an invoice route is gated on the library, not the admin add-on:\n${offenders.join('\n')}`);
});

/*
 * The other half of the same trap, and it has now bitten FOUR times: the owner
 * has no quiz features at all, so anything only an owner does has to skip the
 * broad `FEATURES.QUIZ` gate as well as pass its own. Import was the fourth —
 * the owner got a 403 on the main way bingo packs are made.
 *
 * A route is safe from that if it is on one list or the other. This test is
 * the thing that fails when somebody adds a fifth.
 */
test('every owner-only route escapes the broad quiz gate', () => {
  const ownerRoutes = [
    ['/api/generate/quiz', 'POST'],
    ['/api/generate/bingo', 'POST'],
    ['/api/generate/images', 'POST'],
    ['/api/owner/accounts', 'POST'],
    ['/api/owner/act-as', 'POST'],
    ['/api/reports/abc', 'POST'],
    ['/api/import/bingo', 'POST'],
    ['/api/playlist/intro', 'POST'],
    ['/api/history/forget', 'POST'],
    ['/api/quiz', 'POST'],
    ['/api/quiz/madonna', 'DELETE'],
    ['/api/bingo', 'POST'],
    ['/api/bingo/disco-funk', 'DELETE'],
  ];
  for (const [route, method] of ownerRoutes) {
    const exempt = changesTheLibrary(route, method)
      || OWNER_ONLY.some((prefix) => route.startsWith(prefix));
    assert.equal(exempt, true,
      `${method} ${route} would 403 for the OWNER — it is on neither list`);
  }
});

/*
 * Advert sets came OFF the owner-only list when they became per room.
 *
 * They were only ever there because one shared folder meant a quizmaster
 * tidying their own venue list could delete somebody else's slides off a
 * projector. Rooms fixed that, and a slide costs nothing to run — so under the
 * host's own tier rule, writing one is a quizmaster's job.
 *
 * The trap this pins: taking a route off `changesTheLibrary()` drops it into
 * the broad quiz gate, which the OWNER fails, because an owner deliberately
 * holds no quiz features. That has caught something four times, so adverts get
 * their own explicit gate in server.js and this test says the route is on
 * neither owner list on purpose.
 */
test('advert writes are a quizmaster’s, not the owner’s', () => {
  for (const method of ['POST', 'PUT', 'DELETE']) {
    assert.equal(changesTheLibrary('/api/advert', method), false,
      'adverts are back on the owner-only list — was that deliberate?');
    assert.equal(changesTheLibrary('/api/advert/the-crown', method), false);
  }
  assert.equal(OWNER_ONLY.some((p) => '/api/advert/the-crown'.startsWith(p)), false);
});

/*
 * And the gate that replaced it has to actually be in server.js. A route on
 * neither owner list and with no explicit gate of its own would fall through
 * to the broad quiz check, where the owner gets a 403 that talks about quizzes.
 */
test('server.js gates advert writes on ADVERTS explicitly', () => {
  const server = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  assert.match(server, /advertRoute[\s\S]{0,200}FEATURES\.ADVERTS/,
    'advert writes have no explicit gate — they will fall into the broad quiz check');
});

/*
 * The suggestion box has to be reachable by the OWNER and by everybody else.
 *
 * Sending one is open to anybody signed in — a feedback route behind a paywall
 * hears only from people already happy enough to have paid. Reading and
 * closing them is the owner's. But the owner holds no quiz features, so any
 * route that falls through to the broad FEATURES.QUIZ check 403s for them:
 * the trap that has now caught something six times.
 *
 * These routes answer BEFORE that check rather than being exempted from it,
 * which works and is fragile — it depends on where they sit in the file. So
 * the ordering is what gets pinned.
 */
test('the suggestion box answers before the broad quiz gate', () => {
  const server = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  const gate = server.indexOf('const changesLibrary = changesTheLibrary(');
  assert.ok(gate > 0, 'the broad gate has moved — re-read this test');

  // The LAST mention rather than the first, so a route added to this group
  // later is covered without anybody remembering to update the test.
  const last = server.lastIndexOf("'/api/suggestions", gate + 200_000);
  const firstAfterGate = server.indexOf("'/api/suggestions", gate);
  assert.ok(server.indexOf("'/api/suggestions") < gate, 'the suggestion box has moved below the broad gate');
  assert.equal(firstAfterGate, -1,
    'a suggestion route now sits after the broad quiz gate — the OWNER will get a 403 on their own inbox');
  void last;
});

test('suggestions are not treated as a pack write', () => {
  for (const method of ['POST', 'DELETE']) {
    assert.equal(changesTheLibrary('/api/suggestions', method), false);
    assert.equal(changesTheLibrary('/api/suggestions/s123', method), false);
  }
});

/*
 * Past gigs and the photo export are two different questions and two different
 * gates, and the whole point of the split is who each one is for.
 *
 * A quizmaster reads their own nights and the pictures from them; the owner
 * gets them off and onto social media. Both are pinned here because both are
 * one word in a route that somebody could widen without noticing — and the
 * cheap mistake in either direction is a bad one. Loosen the export and every
 * subscriber gets a Clear all button pointed at their own night; tighten past
 * gigs and a quizmaster is refused their own history.
 */
test('the past-gigs routes ask for PAST_GIGS, not for the invoicing add-on', () => {
  const server = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  for (const route of ["'/api/past-gigs'", "'/api/past-gigs/'", "'/past-photo/'", "'/api/archive/'"]) {
    const at = server.indexOf(route);
    assert.ok(at > 0, `${route} has moved or gone`);
    assert.match(server.slice(at, at + 400), /FEATURES\.PAST_GIGS/,
      `${route} is no longer gated on past gigs`);
  }
});

test('the owner photo tab is gated on PHOTO_EXPORT and nothing else', () => {
  const server = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  for (const route of ["'/api/owner/photos'", "'/api/owner/photos/'"]) {
    const at = server.indexOf(route);
    assert.ok(at > 0, `${route} has moved or gone`);
    assert.match(server.slice(at, at + 300), /FEATURES\.PHOTO_EXPORT/,
      `${route} is no longer the owner's alone`);
  }
});

test('the owner photo routes are owner-only by path, so they skip the broad quiz gate', () => {
  // The trap this file already records six times: the owner holds no quiz
  // features, so anything falling through that check 403s on their own page.
  assert.ok(OWNER_ONLY.some((prefix) => '/api/owner/photos/clear'.startsWith(prefix)),
    'the owner photo actions are not on the owner-only list');
});

/*
 * The photos a room sends are foldered PER ROOM in the private repository.
 *
 * Without the room in that path two quizmasters' nights land in one folder —
 * and on the one feature whose whole point is "this is my work", showing
 * somebody else's pictures is about as wrong as it gets. The house keeps the
 * flat path it has always used, so nothing Mark already has moves.
 */
test('a photo is filed under its own room', () => {
  const server = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  const at = server.indexOf('async function fileAway(');
  assert.ok(at > 0, 'fileAway has moved');
  assert.match(server.slice(at, at + 900), /photoFolder\(room\.id\)/,
    'photos are being filed without the room in the path — two quizmasters would share a folder');
});

/*
 * ============================================================ the projector
 *
 * A "Big screen" link with no ?g= opens the HOUSE room's projector. For the
 * owner that is right, because their room IS the house room — which is exactly
 * why this was invisible until a second login existed, and why it is worth a
 * test that reads the files rather than trusting a comment.
 *
 * For a quizmaster it is somebody else's game on their projector, five minutes
 * before their own gig.
 */
test('no Big screen link opens the house projector by accident', () => {
  const console_ = consoleSource();
  const host = fs.readFileSync(new URL('../public/assets/host.js', import.meta.url), 'utf8');

  // A bare '/screen' in a link or window.open, with no room code anywhere near
  // it, is the bug. screenLink() and the ?g= template are the two right ways.
  const bare = /(?:href=["'`]|window\.open\(\s*["'`])\/screen["'`]/g;
  for (const [name, src] of [['console.js', console_], ['host.js', host]]) {
    const found = src.match(bare) || [];
    assert.equal(found.length, 0,
      `${name} has a Big screen link with no room code: ${found.join(', ')}`);
  }
  assert.match(console_, /function screenLink\(/, 'the helper that adds the code has gone');
});

test('the room code is on the library payload, not only on a running game', () => {
  // Before a launch there is no `running`, and the console still has to know
  // which room it is — the host opens the big screen five minutes early, which
  // is precisely when nothing is running yet.
  const src = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  const library = src.slice(src.indexOf('running: {') - 2000, src.indexOf('running: {'));
  assert.match(library, /joinCode: roomForHost\(req, url\)\.code/,
    'the room code rides on `running` only, so it vanishes before a launch');
});

/*
 * Past gigs reads its photo list OUT of the private repository, so every
 * picture it can show is filed by definition. Without the `filed` class the
 * stylesheet's `:not(.filed)` rule stamps "NOT FILED" on all of them — telling
 * a quizmaster their night's pictures are one restart from gone, on the one
 * page whose whole job is "here is my work".
 */
test('a past-gigs photo is never labelled as unfiled', () => {
  const src = consoleSource();
  /*
   * The FIGURE only. `cphoto-bin` is the delete button inside it and has
   * nothing to do with filing — matching it here made this fail the moment a
   * bin was added, which is a test complaining about the wrong thing.
   */
  const rows = (src.match(/class="cphoto[^"]*"/g) || []).filter((c) => !/cphoto-/.test(c));
  assert.ok(rows.length, 'the past-gigs photo grid has gone');
  for (const row of rows) {
    assert.match(row, /\bfiled\b/, `past gigs draws ${row}, which the CSS marks NOT FILED`);
  }
});

/*
 * ============================================================ house style
 *
 * "A title that names the thing, and one short line." Fourteen features with
 * two or three sentences each is a wall, and a wall gets scrolled past — so
 * the page whose whole job is to say what you get says nothing.
 *
 * Pinned as a test rather than a note in CLAUDE.md because copy is exactly the
 * kind of thing that grows back one helpful sentence at a time, and nobody
 * notices until it is a paragraph again.
 */
test('every feature and tier blurb is one short line', async () => {
  const { FEATURE_META, TIERS } = await import('../public/assets/plans.js');
  const LIMIT = 60;

  for (const [id, meta] of Object.entries(FEATURE_META)) {
    assert.ok(meta.blurb.length <= LIMIT,
      `${id}: ${meta.blurb.length} chars — "${meta.blurb}"`);
    // One sentence, or two very short ones. A semicolon or a third full stop
    // is the tell that an explanation has crept back in.
    assert.ok((meta.blurb.match(/\./g) || []).length <= 2, `${id} has too many sentences`);
  }

  for (const tier of TIERS) {
    assert.ok(tier.blurb.length <= LIMIT, `${tier.id}: "${tier.blurb}"`);
    assert.ok(tier.content.blurb.length <= LIMIT, `${tier.id} content: "${tier.content.blurb}"`);
  }
});

/*
 * THE BARE DOMAIN IS THE QUIZMASTER'S FRONT DOOR.
 *
 * It redirected to `/screen`, so typing quizporium.co.uk got you a lobby slide
 * with a QR on it — a page that is opened once, on a laptop plugged into a
 * projector, from a link on the console. Players are unaffected either way:
 * every QR and printed card says `/play`, never the bare domain.
 *
 * `no-store` is the part worth a test, because getting it wrong fails
 * INVISIBLY: where `/` goes depends on who is asking, so a cached 302 to
 * /login would follow a signed-in quizmaster around for as long as the browser
 * kept it, and nobody would think to look at a redirect.
 */
/*
 * THE SHOP TAB IS FOR QUIZMASTERS, NOT FOR THE OWNER.
 *
 * `needs: FEATURES.CATALOGUE` gates it against the owner's own right to WRITE
 * the catalogue — so it was drawn `// ---- Owner only.` a few lines above its
 * own definition in plans.js, and no quizmaster, on any tier, ever saw a
 * Shop tab. Found by a design audit, not by anybody clicking around, which
 * is exactly the kind of bug a test that only checks routes never catches:
 * the tab was reachable, gated, and simply always false for the one
 * population it exists for.
 *
 * `packs.buy` is the quizmaster's actual right to buy from the shelf.
 */
test('the shop tab is gated on buying packs, not on writing the catalogue', () => {
  const src = consoleSource();
  const at = src.indexOf("id: 'shop',");
  assert.ok(at > 0, 'the shop tab has moved or gone');
  const block = src.slice(at, at + 200);
  assert.match(block, /needs:\s*FEATURES\.BUY_PACKS/,
    'the shop tab is gated on something other than packs.buy — check which population can see it');
  assert.ok(!/needs:\s*FEATURES\.CATALOGUE/.test(block),
    'the shop tab is still gated on the OWNER\'S right to write the catalogue');
});

test('the bare domain goes by WHO IS ASKING, and is never cached', () => {
  const src = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  const at = src.indexOf("if (route === '/') {");
  assert.ok(at > 0, 'the root route still exists');
  const block = src.slice(at, src.indexOf('\n  }', at));
  assert.ok(block.includes('whoIs('), 'it asks who is asking');
  assert.ok(/no-store/.test(block), 'and says not to cache the answer');
  assert.ok(!/Location: '\/screen'/.test(block), 'and no longer sends everybody to the projector');
});
