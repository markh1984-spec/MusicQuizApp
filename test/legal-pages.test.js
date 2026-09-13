/*
 * THE LEGAL PAGES ARE READ BY SOMEBODY ABOUT TO PAY, AND NOTHING TESTED THEM.
 *
 * ---
 *
 * Found by an audit of the money path on 13 September 2026. Two faults, both
 * live, neither visible from any other check:
 *
 * **`refunds.html` NAMED A CONTROL THAT DOES NOT EXIST.** It said *"Cancel from
 * your account settings"* — and cancelling is Stripe's portal by decision,
 * reachable through one button on My account that is only drawn once a first
 * payment has gone through. So the page somebody opens IN ORDER to stop paying
 * sent them to a screen with nothing on it. That is the *"do it over there" must
 * be a link to there* rule failing in its worst place, and it is a LABEL
 * COLLISION of the kind the sweeps exist to find: no test, no 500, no visual
 * defect.
 *
 * **AND THREE PLACEHOLDERS RENDER LIVE** — `[your trading name]`,
 * `[support email]`. They are marked with `class="ld-legal-todo"`, which is the
 * only reason they can be found at all, and the marking was a convention
 * nothing enforced: the next one added unmarked is one nobody ever greps.
 *
 * So this file asserts the two things that keep those honest. **It deliberately
 * does NOT fail while a placeholder is unfilled** — that is information the host
 * has to supply, and a suite left red until he does is a suite people learn to
 * ignore, which this project already records as worse than a slow one.
 * `node scripts/legal-ready.mjs` is the thing that answers "are these safe to
 * show a paying customer yet".
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const PAGES = ['terms.html', 'privacy.html', 'refunds.html'];
const read = (f) => fs.readFileSync(path.join(ROOT, 'public', f), 'utf8');

test('every legal page exists and is linked from the other two', () => {
  for (const page of PAGES) {
    const html = read(page);
    for (const other of PAGES) {
      if (other === page) continue;
      assert.ok(
        html.includes(`/${other.replace('.html', '')}`),
        `${page} must link to /${other.replace('.html', '')} — somebody reading one of these is deciding whether to pay`,
      );
    }
  }
});

/*
 * A PLACEHOLDER MAY NOT GO UNMARKED.
 *
 * The bracketed form is what a human notices while writing; the `ld-legal-todo`
 * span is what a grep finds six weeks later. This asserts the second always
 * wraps the first, so there is exactly one way to look for unfinished wording.
 */
test('an unfinished placeholder is always MARKED, so it can be found', () => {
  for (const page of PAGES) {
    const html = read(page);
    // Every [bracketed] run, ignoring markdown-ish links and attribute values.
    const found = html.match(/\[[a-z][^[\]]{2,40}\]/g) || [];
    for (const hole of found) {
      const at = html.indexOf(hole);
      const before = html.slice(Math.max(0, at - 120), at);
      assert.ok(
        before.includes('ld-legal-todo'),
        `${page}: ${hole} is not inside an ld-legal-todo span — an unmarked placeholder is one nobody greps`,
      );
    }
  }
});

/*
 * AND THE CANCEL SENTENCE NAMES THE CONTROL THAT IS REALLY THERE.
 *
 * Both strings are read out of the app's own source rather than typed here, so
 * renaming the button fails this test instead of silently making a legal page
 * lie. That is the whole point: the collision was invisible precisely because
 * the two halves live in different files.
 */
test('the refund page names the control that actually cancels', () => {
  /*
   * WHITESPACE IS COLLAPSED FIRST. The page wraps at eighty columns, so a
   * four-word button label is split across two lines — an exact `includes()`
   * on the raw file says the words are absent when they are plainly there, and
   * a guard that fails for the wrong reason gets softened until it proves
   * nothing.
   */
  const html = read('refunds.html').replace(/\s+/g, ' ');
  const wiring = fs.readFileSync(path.join(ROOT, 'public/assets/console-subscribe.js'), 'utf8');
  const nav = fs.readFileSync(path.join(ROOT, 'public/assets/client.js'), 'utf8');

  // Anchored on the button's own id, not on a loose word — a greedy match
  // across a whole module reads as a pass for the wrong reason.
  const button = (wiring.match(/id="acctBilling">([^<]+)</) || [])[1];
  assert.ok(button, 'console-subscribe.js should still draw a button naming the subscription');
  assert.ok(
    html.includes(button),
    `refunds.html must name the button as it is actually labelled (${JSON.stringify(button)})`,
  );

  const door = (nav.match(/label: '(My account)'/) || [])[1];
  assert.ok(door, 'client.js should still label the account door');
  assert.ok(html.includes(door), `refunds.html must name the door as it is labelled (${door})`);

  assert.ok(
    !/cancel from your account settings/i.test(html),
    'refunds.html must not send somebody to a settings screen with no cancel control on it',
  );
});

/*
 * THE ONE FACT ON THESE PAGES THAT COSTS MONEY IF IT DRIFTS.
 *
 * The prices are `TIERS` in plans.js and nothing else — a figure typed into
 * terms or onto the sales page is a figure that can disagree with what Stripe
 * charges, which is the argument you cannot win with a customer.
 */
test('no legal page states a price of its own', async () => {
  const { TIERS } = await import(new URL('../public/assets/plans.js', import.meta.url).href);
  const real = new Set(TIERS.map((t) => `£${t.pence / 100}`));
  for (const page of PAGES) {
    for (const said of read(page).match(/£\s?\d+(?:\.\d\d)?/g) || []) {
      assert.ok(
        real.has(said.replace(/\s/g, '')),
        `${page} states ${said}, which is not a price on the ladder — read it off plans.js or do not state it`,
      );
    }
  }
});
