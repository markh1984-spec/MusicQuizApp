/**
 * CLAUDE.md HAS A BYTE BUDGET, AND THIS IS WHY IT IS A TEST RATHER THAN A RULE.
 *
 * That file loads IN FULL at the start of every session, before a line of code
 * is read — so every byte in it is paid for by every future session, whether or
 * not the work touches what it says. It has been split twice for that reason,
 * and **both times it grew back**: 200,618 bytes on 14 August, split to
 * ~150,000, and 167,474 the next day. A written rule to keep it short is
 * exactly what was in place while that happened.
 *
 * So the rule has an assertion on it now. The number is not sacred — raise it
 * deliberately when something genuinely belongs in the always-loaded file, and
 * the diff will say that is what you did. What it stops is the quiet accretion
 * of one more paragraph per session, which is how both of the last two splits
 * became necessary.
 *
 * **WHERE THE PROSE GOES INSTEAD is already settled**: `docs/`, one file per
 * area, opened only by the session that needs it. `CLAUDE.md` keeps the RULE
 * and a link. See *Where the reasoning lives*.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { statSync, readFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;

/**
 * The ceiling, in bytes.
 *
 * Set at 132,000 on 15 August 2026, just above the 130,362 the third split
 * left — deliberately tight, because a budget with room in it is a budget
 * nobody notices until it is spent.
 *
 * **RAISED TO 134,000 ON 16 AUGUST 2026, deliberately, for SHOWS** — a whole
 * evening saved in advance and dragged onto Tonight. It earns always-loaded
 * space on one point rather than on being new: **a show is not a gate**, and
 * a session that does not know that is a session that might cache an
 * entitlement into it. Two of the eight lines are prohibitions, which is the
 * test this file's own rule sets.
 *
 * It was paid for as far as it could be first — the console theme's tab-bar
 * paragraph was rewritten in the same commit, because that bar became a
 * sidebar and the old text was describing something that no longer exists.
 * The remaining 1,760 bytes are genuine growth, and this comment is the diff
 * saying so.
 *
 * **AND TO 135,000 THE SAME DAY, when a show stopped being one game and became
 * an EVENING** — a quiz and the bingo after it. That added the rules that
 * matter most in the whole feature: `itemsOf()` is the one reader, the
 * one-game shape still reads, and **there is no migration step**. A session
 * that does not know the last of those is a session that writes one.
 *
 * Paid for again first, and this is the part worth copying rather than the
 * raise: two stale claims in the Tonight block were fixed in the same pass —
 * *"Tonight's pack is already chosen"*, which the file itself contradicts
 * eighty lines later, and *"Set it up is always there and goes disabled"*,
 * which stopped being true when the settings became a tab. **Look for what
 * has gone stale before asking for more room; a budget that is only ever
 * raised is a budget nobody is applying.**
 */
/*
 * RAISED TO 138,000 ON 16 AUGUST 2026, for the console split — and this is the
 * shape of raise the note above allows: the entry says WHERE ALL THE CONSOLE
 * CODE NOW LIVES, which every session needs before it can find anything, and
 * the two faults it records are both invisible to `node --check`.
 *
 * Paid for in the same pass, as the rule asks: five pointers in this file named
 * `console.js` for functions that are no longer in it — `diarySection()`,
 * `showsSection()`, `galleryToggle()`, `packDrag` and the tab recipe. A pointer
 * to the wrong file is worse than no pointer, because it is followed.
 */
/*
 * TIGHTENED TO 132,000 ON 16 AUGUST 2026, in the same pass that raised it —
 * which is the point. The raise bought room for the console-split entry; the
 * diet then took 9,497 bytes back out by moving what is READ ON DEMAND rather
 * than always: the two modes (GSD and Sweep, ~5.5KB that matter only in the
 * sessions where he types them) and the four-faults account behind the checks.
 * Each left its rule and a link behind, so nothing has to be looked up to
 * avoid a bad change.
 *
 * **A budget that only ever goes up is not a budget.** If a raise is genuinely
 * needed, look first for what has become reasoning rather than rule.
 */
/*
 * RAISED TO 133,000 ON 19 AUGUST 2026, for two small entries that are both
 * genuine gotchas rather than description: the bench's publish button now
 * opens the photographs instead of publishing (a safeguard walked round in
 * one tap), and the post-night report's PDF route has to sit above the
 * generic `/api/past-gigs/<night>` match, the same prefix trap the publish
 * route already guards against. Both were tightened for size before this was
 * raised, and 817 bytes is the genuine remainder.
 */
/*
 * RAISED TO 134,000 THE SAME DAY, for two more from the same batch of
 * decisions: the advert slide editor now collects `offerCode`/`offerWhen`
 * and reads the count back on the same fetch that opens a set, and the app's
 * two money emails exist and are tested but are NOT wired to a live route —
 * PayPal itself is still blocked on this environment's network egress. That
 * second fact is exactly the kind of thing a session must not rediscover by
 * building a webhook route from memory. Both entries were tightened first.
 */
/*
 * RAISED TO 134,500 THE SAME DAY, for one line in the checks section: a page
 * module (`editor.js`) has its own top-level boot code, and importing shared
 * helpers FROM it ran that boot code on `/console` and hung the whole page —
 * `node --check` saw nothing wrong. That is exactly the class of fault this
 * section already exists to catalogue, and every session touching a console
 * module needs to know it before reaching for the nearest file that already
 * has the function rather than the page-agnostic one.
 *
 * RAISED TO 136,000 ON 20 AUGUST 2026, for the quiz → bingo → quiz running
 * order — a protected-surface feature (Launch, the control view's primary
 * button) that changes what "Continue" does at exactly the moment it would
 * otherwise end a night early. A session touching `session.js`'s launch path,
 * `host.js`'s primary button, or the Shows editor needs to know this exists
 * before assuming the old single-game rules still hold everywhere.
 *
 * RAISED TO 136,200 THE SAME DAY, for one sentence: the running order can now
 * ALSO be built by dragging a bingo pack and a round dot straight onto the
 * Tonight row itself, not only via a saved show — a session reading the old
 * wording would wrongly assume the Tonight row still refuses bingo.
 *
 * RAISED TO 138,500 ON 20 AUGUST 2026, for the first slice of group/parent
 * accounts — genuinely account-security-boundary work, not a feature a
 * session can safely rediscover from the docs alone. A session touching
 * `whoIs()`, `can()`/`featuresFor()`, or anything under `/api/group/*` needs
 * to know BEFORE it starts that `parentId` is derived rather than assigned,
 * that `accounts.effective()` is the one substitution point, and that pack
 * sharing was deliberately left out because it would have touched the
 * protected launch surface for a feature with no real users yet.
 */
/*
 * RAISED TO 139,500 ON 21 AUGUST 2026, for the breakout round — a new round
 * TYPE that touches the two-screens rule (a new host-only field,
 * `breakoutAnswers`, that must never reach the projector or another phone)
 * and the scoring promise behind "Round X of Y" (`scoringRoundNumber()` now
 * excludes it, so the label a room reads stays true with one in the night).
 * A session touching `engine.js`'s answer/reveal functions, or the round
 * count shown on any screen, needs to know this exists before assuming every
 * round in `this.rounds` counts. Trimmed to ~1,250 bytes before this was
 * raised — the entry was closer to 2,200.
 */
/*
 * RAISED TO 140,000 THE SAME DAY, for the resolved hat-switch finding: a
 * group admin does not need one, because unlike the owner (who has a real
 * second route, `/owner`) their group panel already sits on `/console`, next
 * to the console they host from. Worth a session knowing BEFORE it goes
 * looking for `/api/owner/act-as` and tries to generalise a mechanism that
 * has nowhere to point.
 *
 * RAISED TO 140,100 ON 23 AUGUST 2026, for one index line: the public
 * gallery now only holds photos that looked like a camera took them —
 * `photos.js`'s `NOT_CAMERA_SUFFIX`/`isCameraFile()`, checked twice in
 * server.js for the same reason the publish gate is. Full reasoning in
 * `docs/gigs.md`; this is the pointer, same shape as every other gallery
 * entry already in this index.
 *
 * RAISED TO 140_300 THE SAME DAY, for two changes to the launch bar that a
 * session must not rediscover by re-applying the old rule:
 *
 *  - **the settings SPLIT** — night-wide above the packs, the picked pack's
 *    own below, and a tile is now tappable to pick it. The line it replaces
 *    said *"the settings are their own TAB"*, which had been false since the
 *    tab was deleted two days earlier — so the stale half was paid back
 *    first, exactly as the note above asks;
 *  - **a REVERSED decision**: both halves of the In-the-room/Online switch
 *    now wear the same lit treatment. The old text said only the Online half
 *    wears the gradient, and a session reading that would put it back.
 *
 * A reversal is the one kind of growth that cannot be moved to `docs/`: the
 * whole value is that the always-loaded file no longer asserts the opposite.
 *
 * RAISED TO 140_700 THE SAME DAY, for another reversal and by the same
 * argument: **a saved night no longer carries its VENUE**. The line it
 * replaces said the venue stays ON the show, so a session reading it would
 * put the field straight back — and the cost of that is not cosmetic, since
 * the prizes and the voucher follow the venue. It also has to say BOTH
 * halves (never stored, never read), or an old show still restores one.
 */
/*
 * RAISED TO 143_600 ON 23 AUGUST 2026, for per-venue play ranking. It earns
 * every-session space on the strength of what it FORBIDS rather than what it
 * adds: never-played-here must read as 0 and not fall back to the global date
 * (or the feature does nothing), a night is filed under its id AND its name
 * with the reader reconciling them (the split the headcounts were already
 * bitten by, hit a third time), and the order and the line explaining it come
 * from one place — "Never played · here 2 days ago" is a sentence this app
 * must not be able to print. Each of those is a change somebody would
 * otherwise make in good faith.
 */
/*
 * RAISED TO 146_800 ON 23 AUGUST 2026, for the break plan. Every line of it
 * either forbids something or records a trap that has now bitten more than
 * once: the three lobby-only guards changed SUBJECT rather than going away
 * (and one of them deliberately did not move), the final is not a break and
 * the lobby has no screen choice, an empty plan must stay byte-identical to
 * the app before breaks existed, and `listAdvertPacks()` returns a summary
 * rather than the pack — the third sighting of the picks-fields trap.
 */
/*
 * RAISED TO 149_200 ON 23 AUGUST 2026, for the launch bar's tidy-up. Two of
 * its lines are rules that would otherwise be rediscovered the expensive way:
 * **a drag with no tap is a broken control** (a shelf round dot had
 * `dragstart` and no `click`, so the feature was reported as not working at
 * all while the drag itself was fine), and **a bigger target is not the same
 * as a hittable one** (growing the tile's × put it under a `z-index: 1`
 * title, so half of it silently did nothing).
 */
/*
 * RAISED TO 152_000 ON 23 AUGUST 2026, for the band above Launch being kept
 * clear and the head holding the night. Three of its lines are rules that
 * stop a change rather than describe one: nothing goes between the running
 * order and Launch, a row is only drawn when it holds a control, and a
 * `border` SHORTHAND in the global destructive rule silently flattens the 2px
 * edge every other button wears — the same trap already recorded twice.
 */
/*
 * RAISED TO 154_400 ON 23 AUGUST 2026, for the three ways to play a night.
 * Most of the entry forbids something: `teamPlay` stays the boolean gate so a
 * solo night keeps its path, nobody is ever re-dealt, a dealt team cannot be
 * swapped, and the console keeps ONE field rather than two that can drift.
 */
/*
 * RAISED TO 156_600 ON 23 AUGUST 2026, for the stray-brace entry. It is a
 * rule about how to EDIT this repo — always pass a start offset to
 * `s.index()`, check the brace balance after a scripted CSS edit, and measure
 * what is VISIBLE rather than what is in the DOM — and the last of those has
 * now cost this project three separate bugs.
 */
/*
 * RAISED TO 159_800 ON 23 AUGUST 2026, for the popover pickers and the markup
 * guard. The load-bearing lines are the ones that stop a change: the native
 * `<select>` stays the truth because the LAUNCH reads it, choosing must
 * dispatch a real `change`, a floating sheet needs an outside-click close, and
 * a whole-file tag count was tried and turned down because a test needing an
 * exceptions list is a snapshot rather than a test.
 */
/*
 * RAISED TO 166_600 ON 23-24 AUGUST 2026 for the gap dial, the fifth door,
 * and what moved onto it.
 * The load-bearing lines are the ones that stop a change: a gap is not at the
 * end of a slot; the tile measurement (58px clear) is what allows ONE control
 * and forbids two; the dial's order is a SCALE; the era word moved because a
 * control beats a decoration; and a lost import drew a bar with no dials on it
 * while every static check passed.
 *
 * `docs/console.md` was split the same day — the launch bar's half is now
 * `docs/console/launch-bar.md` — so the reasoning behind all of it left this
 * file rather than landing in it.
 */
/*
 * 174_500 ON 24 AUGUST 2026, for the launch bar's drag rules. Every line of
 * that block stops a change rather than describing one: the slot you drop on
 * is the slot it goes in (for a round AND a pack), a highlight may only
 * promise what the drop will honour, a draggable child is what stops the
 * browser walking up to the tile, and a child's dragend bubbles into the
 * handler that removes the pack.
 */
/*
 * 176_500 ON 24 AUGUST 2026, for the four faults behind *"now I can't drag
 * into slot 2 as an empty slot"* and for naming `docs/console/drag.md` in the
 * index. Every line of that block stops a change: a descriptor is not the
 * thing it describes, a kind that disagrees with the night's own is a mixed
 * night, a pack card asks whether it is in Tonight rather than being painted
 * afterwards, and a `const` read in its temporal dead zone throws where the
 * console's own catch swallows it.
 *
 * **The structural price was paid rather than dodged**: 60 lines of break
 * plumbing left `console-tonight.js` for `console-breaks.js`, and 16KB of
 * drag reasoning left `docs/console/launch-bar.md` for `docs/console/drag.md`
 * — so what landed HERE is the rules alone.
 */
/*
 * 177_500 ON 24 AUGUST 2026, for one bullet under *Checks*, and it is the
 * cheapest 800 bytes in this file: **nothing in this repo pressed a control,
 * and a dead control draws perfectly.** The gap dial died twice inside a week
 * — a lost `import`, then a moved body still calling the launch bar's
 * `paintOrder()` from a module that has none — and on both occasions
 * `node --check`, the full suite, `pub-unchanged` and `drag-check`'s own real
 * browser drags all passed, because a `ReferenceError` on the PRESS lands in
 * the click handler's catch.
 *
 * The bullet stops a change (`drag-check.mjs` presses the dial twice now, and
 * no module but the bar may name a `paint*`) and it records the test that was
 * written and thrown away, so nobody writes it again. The full account is in
 * `docs/checks.md`; what is here is the rule.
 */
/*
 * 179_000 ON 25 AUGUST 2026, for the console polish pass — three rules that
 * each stop a change: `main` is a flex column because its two-row grid
 * stretched the doorhead the moment a banner rendered above it; the shelf
 * grid is auto-fill with a 150px floor because a fixed six squeezed the
 * square poster under its own content and clipped a pack's NAME off the top,
 * silently; and the finish layer at the foot of style.css is where the next
 * control's selection/caret/focus/hover lives, so it stays one block.
 */
/*
 * 180_500 ON 25 AUGUST 2026, for the league export — the first time the
 * league leaves the console. Every line of that block forbids something: a
 * report shows the table as it stood THAT NIGHT rather than today, the public
 * page publishes per venue and fails closed, it sends names and points and
 * NEVER faces (named fields, never a spread, or the next one added is a
 * photograph on a public web page), and an async paint looks where the thing
 * is rather than where it was made. It also corrects a bullet that said the
 * league was yours only — which is no longer true, and a stale prohibition is
 * worse than none.
 */
/*
 * 181_500 ON 25 AUGUST 2026, for the league's scoring rule — best six nights,
 * not a running total and not an average. It forbids both of the things that
 * look reasonable: a cumulative table (a fortnight away is a season nobody can
 * win back) and a mean (one lucky night beats a whole season). It also records
 * that "best six averaged" and "best six summed" are the SAME table, so nobody
 * re-argues the divisor.
 */
/*
 * 182_000 ON 25 AUGUST 2026, for the attendance point that finished the
 * league's scoring rule — and for the prohibition that came with it. The
 * position ladder pays NOTHING below seventh now: it used to floor at 1, and
 * keeping that floor beside a per-night attendance point would pay one point
 * twice under two names and make "one for turning up" mean two things in one
 * sentence. Eighth place is still worth exactly 1. That is the kind of line
 * that stops somebody "restoring" the floor a year from now.
 */
/*
 * 183_000 ON 25 AUGUST 2026, for the team-name filter — and this one is a
 * SCOPE of a standing prohibition rather than a new feature, which is exactly
 * the kind of text that has to be read before any work starts. "No profanity
 * filter on team names" still holds in the room and now has one stated
 * exception at the door; a session that read only half of that would either
 * strip the projector or publish a slur. The lines that stop a change: filter
 * on the SERVER (hiding it in the browser is not hiding it), mask rather than
 * drop, whole words for ordinary profanity, and never run the spaces-stripped
 * pass on the ordinary list.
 */
const BUDGET = 183_000;

test('CLAUDE.md STAYS INSIDE ITS BUDGET', () => {
  const bytes = statSync(`${ROOT}CLAUDE.md`).size;
  assert.ok(
    bytes <= BUDGET,
    `CLAUDE.md is ${bytes} bytes, over the ${BUDGET} budget by ${bytes - BUDGET}.\n`
    + 'It loads in full at the start of EVERY session. Move the reasoning to a\n'
    + 'file in docs/ and leave the rule plus a link behind — see "Where the\n'
    + 'reasoning lives". Raise the budget only if the new text genuinely has to\n'
    + 'be read by every session before any work starts.',
  );
});

test('every docs/ link in CLAUDE.md resolves', () => {
  /*
   * The split only works while the links do. A rule whose reasoning has moved
   * to a file that is not there any more is worse than one that never moved:
   * it reads as though the detail exists and can be checked.
   */
  const src = readFileSync(`${ROOT}CLAUDE.md`, 'utf8');
  const broken = [...src.matchAll(/\]\((docs\/[\w.-]+\.md)\)/g)]
    .map((m) => m[1])
    .filter((rel, i, all) => all.indexOf(rel) === i)
    .filter((rel) => {
      try { return !statSync(ROOT + rel).isFile(); } catch { return true; }
    });
  assert.deepEqual(broken, [], `CLAUDE.md links to files that are not there: ${broken.join(', ')}`);
});

test('EVERY DECISION IS STILL NAMED IN THE ALWAYS-LOADED FILE', () => {
  /*
   * The third split moved the decisions table to `docs/decisions.md` and left
   * an index: every decision NAME, plus every sentence that forbids something,
   * verbatim. That index is the half that has to survive — a decision nobody
   * can see is a decision that gets relitigated, which is the exact thing the
   * table is titled after.
   *
   * So this checks the two files against each other rather than trusting that
   * whoever edits one remembers the other.
   */
  const claude = readFileSync(`${ROOT}CLAUDE.md`, 'utf8');
  const doc = readFileSync(`${ROOT}docs/decisions.md`, 'utf8');
  const names = doc.split('\n')
    .filter((l) => l.startsWith('|') && !l.startsWith('|---') && !l.startsWith('| Decision |'))
    .map((l) => l.slice(1).split('|')[0].trim())
    .filter(Boolean);

  assert.ok(names.length > 30, `only found ${names.length} decisions — has the table moved again?`);
  const missing = names.filter((n) => !claude.includes(n));
  assert.deepEqual(missing, [], `these decisions are in docs/decisions.md but named nowhere in CLAUDE.md:\n${missing.join('\n')}`);
});
