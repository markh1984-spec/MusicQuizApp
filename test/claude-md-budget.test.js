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
/*
 * 184_000 ON 25 AUGUST 2026, for the manual override on the name filter. The
 * lines that stop a change: it works in BOTH directions (the list is wrong
 * both ways), a ruling that only restates the filter is CLEARED rather than
 * stored — or a later change to the word list can never reach that name —
 * and the row's key travels with the row so the console combines the two
 * halves without a second copy of `teamKey()` in the browser.
 */
/*
 * RAISED TO 189,000 ON 29 AUGUST 2026, deliberately, and for two rules rather
 * than one.
 *
 * The first is CROSS-CUTTING and is the expensive one to have to rediscover:
 * every door's bay is the launch bay's size, `--bay-h`, from 900px up. It
 * governs five sections and any that are added, and a session that changes a
 * bay without knowing it will break the rule silently — the frame is fixed, so
 * a bay that grows moves the tab column and everything under it, and nothing
 * throws. The second is the Community door's own arrangement: the bay is the
 * tab you are on, and the bottom is controls and options rather than a second
 * copy of the thing.
 *
 * RAISED AGAIN TO 192,000 THE SAME DAY, for the generalisation of that
 * arrangement to every door — `console-bay.js` — and for one pub being one
 * league. Both are cross-cutting: the first governs five sections and any
 * added after them, and the second is a reader rule about the archive that
 * `venueHeadcounts()` and `playedByVenue()` also live under. A session that
 * does not know either will reintroduce the exact faults they were written
 * for, and neither fails a test until somebody looks at a screen.
 *
 * RAISED A THIRD TIME THE SAME DAY, to 193,000, for the quizmaster adding
 * their own room photographs. Said plainly because three raises in a session
 * is exactly the pattern this budget exists to make visible: it was a heavy
 * day of cross-cutting work, every one of these moved its reasoning to
 * `docs/`, and the file was trimmed twice on the way rather than only grown.
 * **The next thing added should pay for itself by cutting something stale**,
 * not by moving the line again.
 *
 * The reasoning for all of it went to `docs/console.md` and `docs/gigs.md`;
 * what is here is the rules and the guards' names.
 *
 * RAISED TO 195,000 ON 31 AUGUST 2026, and the note above asked for the next
 * addition to pay for itself instead — so here is what it bought and what was
 * cut, because the point of this number is that a raise has to be argued for.
 *
 * CUT FIRST, and it came to about 1,700 bytes: 27 lines of the `docs/` index
 * restated a section CLAUDE.md already carries with its own *Full reasoning*
 * link at the foot of it, one entry was listed twice, and one pointed at a
 * file it was already filed under. None of that was a rule; all of it was
 * paid for on every session.
 *
 * WHAT IT BOUGHT: two rules about SILENT DATA LOSS ON A PUBLIC PAGE, which is
 * what an always-loaded file is for. `published.json` holds two halves that
 * two callers edit, and nothing ordered them — a lamp write that overlapped a
 * publish quietly un-published the night, GitHub answered 200 to both, and it
 * reached a live gallery. Plus the rule that a page SCROLLS and the projector
 * is the one that does not, after four public pages spent two years unable to
 * scroll at all. Both are the shape this budget exists to keep visible: a
 * fault that nothing throws, nothing fails, and only a person notices.
 *
 * AND RAISED AGAIN THE SAME DAY, to 197,000, which is the second raise on
 * 31 August and needs saying rather than hiding.
 *
 * WHAT IT BOUGHT: the two halves of the fault behind *"it says not published,
 * but it is"*. One is that the console read and wrote photo state through a
 * different ROOM from the one the public gallery reads, so a night could be
 * published into a folder the page never looks at and still report success —
 * a hazard that was written down in `server.js` in as many words and left,
 * until it arrived as a bug report with a screenshot. The other is that the
 * private repository had never been runnable by this suite at all, so nothing
 * about publishing had ever been executed; two silent live bugs in one day
 * came out of that gap, and the stub that closes it deserves a line somebody
 * reads before writing the next photo route.
 *
 * WHY NOT TRIMMED THIS TIME: the candidates were measured. What is left in
 * this file is rules — the best-six league argument, the name filter, the gap
 * dial, the drags — and each is a paragraph that stops a specific bad change.
 * Cutting one to pay for another is not a saving, it is choosing which fault
 * to reintroduce. About 1,700 bytes of genuine duplication went earlier today
 * (27 index lines restating headings, a repeat, a pointer to a pointer) and
 * that is spent.
 *
 * **The line to hold now is that a raise must be for a rule about something
 * SILENT** — a fault nothing throws, nothing fails and only a person notices.
 * Everything bought on 31 August is that shape. A feature description is not,
 * and belongs in `docs/`.
 *
 * AND A THIRD TIME ON 31 AUGUST, to 198,000. Three raises in one day is the
 * pattern this budget exists to make visible, so: what bought it, and what was
 * cut first.
 *
 * CUT FIRST, in this order, and it came to about 900 bytes: two photo-cache
 * rules merged into one when they turned out to be the same story told twice;
 * the gallery-index card rule, the night-navigation rule, the bay-head link
 * rule and the private-repo-stub rule each trimmed to their prohibitions with
 * their reasoning left in `docs/gigs/photos.md`; and the new rule's own
 * history — 297 calls, then 99, then 0 — moved out of it, because CLAUDE.md
 * carries the rule and `docs/` carries how it was arrived at.
 *
 * WHAT IT BOUGHT: a gallery that stopped working after seventeen visits. Every
 * photograph served cost three GitHub calls against a 5,000/hour limit, and
 * the traffic a gallery actually gets is a link sent to a pub full of people
 * who were all there on the same night — the worst possible shape for a
 * per-request limit. Nothing threw, no test failed, and the only symptom was
 * *"these photos take a while to load"*.
 *
 * That is the line, unchanged and now applied a third time: **a raise is for a
 * rule about something SILENT.** A feature description is not, and belongs in
 * `docs/`. Four of the five things cut above were feature descriptions that had
 * crept in the same day, which is the real lesson of this raise.
 */
/*
 * 198,000 -> 199,000 on 1 SEPTEMBER 2026, and the trims came FIRST — the diff
 * beside this line says which. Four passages were cut to their prohibition
 * before a byte was asked for: the *"a test that never runs the artefact"*
 * paragraph in the protected-surface section, which `Checks` already states
 * verbatim; the promise-chain sentence on the photo lamp, which the
 * `published.json` rule below it already carries; the four `pub-unchanged`
 * faults, which `docs/checks.md` lists in full; and the launch-route test's
 * own description. The three new rules were then written twice, the second
 * time at half the length. It still came to 398 bytes over.
 *
 * WHAT IT BOUGHT: a publish that asks first, and the reason the fault it
 * uncovered was invisible. A row that reads its state when it is BUILT is
 * wrong the moment something stops rebuilding it — and the lamp's whole point
 * is that nothing rebuilds it. The first press was right, nothing threw, and a
 * state push papered over it, so it only failed on a quiet console: exactly
 * when somebody is doing their photographs.
 *
 * That is the line, unchanged and now applied a fourth time: **a raise is for
 * a rule about something SILENT.**
 */
/*
 * 199,000 -> 201,000 on 1 SEPTEMBER 2026, and the trims came first again: four
 * gallery-cache bullets cut to their prohibition, and the four new rules
 * written twice, the second time shorter.
 *
 * WHAT IT BOUGHT: three rules about things that fail SILENTLY, which is the
 * line this budget has always been raised on.
 *
 *  - The projector's final slide has been CLIPPING on any night with both a
 *    draw and a comeback — "Tonight's winner" off the top, half the QR off the
 *    bottom, at every resolution, for as long as both have existed. Nobody
 *    reported it; it was found by measuring for something else.
 *  - `view.photos` was already taken, on the host AND the screen, and
 *    `server.js` sets it AFTER the engine builds the view. A new field of that
 *    name held somebody else's data and the button it fed was never drawn.
 *  - The gallery's "not up yet" page changes the WORDING and nothing else, so
 *    a night that never happened still reads identically to a real
 *    unpublished one. The rule is there to stop the obvious next change — a
 *    `pending` state on the server — which would leak which dates exist.
 */
/*
 * RAISED TO 202,000 ON 3 SEPTEMBER 2026, for the metals: three tokens and one
 * sheen, replacing SIX hand-written sets with SEVEN different values (bronze
 * alone was #cd7f32, #cd895a, #e0a066 and #cd8c58). That is a token system
 * rather than a description, and the entry is mostly prohibitions — name the
 * token never a hex, fills only and metal text stays solid, `--gold` and
 * `--metal-gold` are two jobs, a `background` shorthand resets
 * `background-clip`.
 *
 * **What was trimmed first, per the rule above.** Twelve entries across two
 * commits today went from narrative to their prohibitions: the gallery's
 * cache accounting, the camera gate, the photo lamp, the publish confirm, the
 * league bay, a venue's own address, `?as=visitor`, the drafts banner, the
 * stale sha, the pin spread, the flips-now-saves-later lamp and the final's
 * two-part fit. The suite's own line in the Checks block was also two hundred
 * tests out of date, which is its own small lesson.
 *
 * 823 bytes is the genuine remainder, and the trims are in the same diff so
 * it can be read as a trade rather than as growth.
 */
/*
 * AND TO 205,500 ON 4 SEPTEMBER 2026, for two entries. ~2,600 bytes of *A
 * PRIZE TYPED IN LATE STILL REACHES THE WINNER* — 700 of which arrived the
 * same evening, correcting its own last bullet: the prize default was written
 * up as a formula, the host then named two shapes the formula gets wrong, and
 * the entry now records that it is a table and WHY the formula looked right.
 * A rule that was reversed within the hour is exactly the kind a future
 * session re-derives if the reversal is not written down beside it. Off a live gig — *"my quiz and bingo winners
 * on thursday didn't receive a QR code"* — and it holds four rules a future
 * session would otherwise rediscover from a room: where prizes are read from,
 * why pressing Prizes afterwards has to pay anybody owed, why bingo's catch-up
 * keys on the win's timestamp rather than the stage, and that the card shape
 * chooses the count.
 *
 * **THIS ONE IS GROWTH, NOT A TRADE, and the diff should say so.** The rule
 * above is to trim an old entry to its prohibition first, and it was tried:
 * the two largest candidate sections were read through bullet by bullet and
 * every one of them is already at prohibition density — the shortest is 164
 * bytes. There was nothing left to take out that was not itself a rule.
 *
 * The other ~700 is the photo consent tick — that the SENDER's no outranks the
 * quizmaster's lamp, that it is opt-OUT rather than opt-in (the camera gate
 * above is why), and that the phone remembers it. All three are rules a future
 * session would otherwise reverse, and the middle one contradicts what the
 * to-do list asked for, which is exactly the kind of thing this file exists to
 * settle once.
 */
/*
 * AND TO 207,300 THE SAME EVENING, for *ONE PRIZE EACH PER BINGO ROUND* —
 * off a live night where one player took three of four prizes. It records
 * four things a future session would otherwise undo: that a refused claim is
 * still a CORRECT claim, that the rule must lift once everybody has won or a
 * small room cannot finish, that the button stays present and inert, and that
 * pub-unchanged.mjs reads `quizzes/` only and so proves nothing at all about
 * a bingo change.
 */
const BUDGET = 207_300;

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
