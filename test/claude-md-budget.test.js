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
 */
const BUDGET = 134_500;

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
