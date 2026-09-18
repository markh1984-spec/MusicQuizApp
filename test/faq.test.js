/**
 * THE FAQ — that it is written ONCE, that its numbers are true, and that
 * something actually draws it.
 *
 * ---
 *
 * The answers themselves are prose and are not a thing to assert on. What this
 * guards is the three ways an FAQ rots, all of them silent:
 *
 *  - **A NUMBER GOES STALE.** A price or a trial length typed out here would be
 *    true the day it was written and wrong the day either changed, on the page
 *    whose whole job is being believed. The ones it can import, it imports; the
 *    ceiling it cannot (it lives in `src/`, which a browser module may not
 *    reach) is pinned here instead.
 *  - **A SECOND COPY APPEARS.** The sales page carried four hand-typed
 *    questions and the console had none; two hand-written copies of an answer
 *    is two answers that drift, and the one that drifts is the one nobody is
 *    looking at.
 *  - **NOTHING DRAWS IT.** This repo's own recorded fault — the arcade board sat
 *    in a payload for as long as the feature existed with nobody drawing it, and
 *    the gallery publish route had no caller for weeks. A text search is a weak
 *    check and the right weight here: the fault would be the total absence of a
 *    caller, not a broken one.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { FAQ, ROOM_CEILING, faqHtml, faqPanelHtml } from '../public/assets/faq.js';
import { PACK_PENCE, TRIAL_DAYS, REFERRAL_BONUS_DAYS } from '../public/assets/plans.js';
import { MAX_PLAYERS } from '../src/engine.js';
import { RESERVED } from '../public/assets/slugs.js';
import { serverSource } from './server-source.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(ROOT, f), 'utf8');
const items = FAQ.flatMap((s) => s.items);
const words = items.map((i) => [i.q, ...i.a].join(' ')).join(' ');

test('THE ROOM CEILING IS THE ENGINE\'S OWN — a browser module cannot import it', () => {
  // Raising MAX_PLAYERS must fail here rather than leave a number on a public
  // page that used to be true.
  assert.equal(ROOM_CEILING, MAX_PLAYERS);
});

test('the price and the trial length are IMPORTED, never typed out', () => {
  // The £3 and the fortnight have to move when `plans.js` moves them.
  assert.ok(words.includes(`£${PACK_PENCE / 100}`), 'the pack price is not on the page');
  assert.ok(words.includes(`${TRIAL_DAYS} days`), 'the trial length is not on the page');
  assert.ok(words.includes(String(TRIAL_DAYS + REFERRAL_BONUS_DAYS)),
    'the referred trial length is not on the page');
});

test('EVERY LINK IN AN ANSWER GOES SOMEWHERE THIS APP SERVES', () => {
  /*
   * A dead link on the page somebody reads before paying is worse than no link.
   * Checked against `server.js` itself rather than a typed list, so a route
   * being renamed fails here.
   */
  const server = serverSource();
  const links = [...words.matchAll(/\]\((\/[^)]*)\)/g)].map((m) => m[1]);
  assert.ok(links.length, 'no answer links anywhere — has the markdown pass changed?');
  for (const href of links) {
    const path = href.split('?')[0];
    assert.ok(server.includes(`route === '${path}'`) || server.includes(`'${path}'`),
      `an answer links to ${href}, which nothing serves`);
  }
});

test('/faq cannot be shadowed by a venue address', () => {
  // The trap `RESERVED` exists for: two segments at the root are a venue's
  // address, and the first version of that route ate `/api/gallery`.
  assert.ok(RESERVED.includes('faq'));
});

test('THE SALES PAGE AND THE CONSOLE BOTH DRAW IT, and neither types it out', () => {
  const home = read('public/home.html');
  const faqPage = read('public/faq.html');
  const help = read('public/assets/console-account.js');

  assert.ok(home.includes('faqHtml('), 'the sales page stopped drawing the shared list');
  assert.ok(faqPage.includes('faqHtml('), '/faq stopped drawing the shared list');
  assert.ok(help.includes('faqPanelHtml('), 'the Help tab draws no answers at all');

  /*
   * AND THE HAND-TYPED COPY IS GONE. The four questions on the sales page were
   * its own markup; leaving them there would mean a fix to an answer had to be
   * remembered twice, which is the whole reason this module exists.
   */
  assert.ok(!home.includes('<summary>'), 'the sales page is typing its own questions again');
});

test('the console\'s copy is not folded, and the public one is', () => {
  // A <details> in the console shuts itself on the next state push — the
  // fault the bingo card's fold already records.
  assert.ok(!faqPanelHtml().includes('<details'), 'the Help tab would shut itself under a thumb');
  assert.ok(faqHtml({}).includes('<details'), 'the public page lost its fold');
});

test('the sales page shows a handful and the full list is bigger', () => {
  const home = items.filter((i) => i.home);
  assert.ok(home.length >= 3 && home.length <= 6, `${home.length} questions on a shop window`);
  assert.ok(items.length > home.length + 6, 'the full list is barely longer than the teaser');
  // No section headings over the teaser — they are picked across sections and
  // would print a heading per question.
  assert.ok(!faqHtml({ onlyHome: true }).includes('faq-section'));
});

test('AN ANSWER MAY NOT CARRY MARKUP, only the one link form', () => {
  /*
   * The content is ours and static, but an answer that can carry HTML is one
   * somebody will paste a fragment into later. Everything but `[words](/path)`
   * is escaped, so a stray bracket is a bracket.
   */
  const out = faqHtml({ fold: false });
  assert.ok(!out.includes('<script'), 'markup reached the output');
  for (const item of items) {
    for (const p of item.a) {
      assert.ok(!/<[a-z/]/i.test(p), `an answer contains raw markup: ${item.q}`);
    }
  }
  assert.ok(out.includes('<a href="/refunds">'), 'the link form stopped working');
});

test('every question is a question, and every answer is short enough to read', () => {
  for (const item of items) {
    assert.ok(item.q.endsWith('?'), `not a question: ${item.q}`);
    assert.ok(item.a.length && item.a.length <= 2, `${item.q} is a manual, not an answer`);
    for (const p of item.a) {
      // The house rule is a title and one short line; an FAQ is allowed a
      // paragraph, and this is the ceiling on one.
      assert.ok(p.length <= 460, `too long to read in a breath: ${item.q}`);
    }
  }
});
