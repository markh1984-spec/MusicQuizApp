/**
 * WHERE PLAYWRIGHT IS, ASKED RATHER THAN ASSUMED.
 *
 * ---
 *
 * **FIFTY-ONE GUARDS HARD-CODED ONE ABSOLUTE PATH**, and it was one machine's:
 *
 *     createRequire(import.meta.url)('/opt/node22/lib/node_modules/playwright')
 *
 * On a fresh clone of this repository on any other computer, **21 of the 31
 * checks `gig-build.mjs` runs died in under a second** — every one of them with
 * `Cannot find module`, none of them with anything to do with the app. The
 * verdict printed DO NOT DEPLOY, which is the right verdict for the wrong
 * reason, and that is the shape this repo already has a rule about: *a guard
 * that quietly tests nothing is worse than no guard, because it is believed* —
 * and its twin, a guard that fails for a reason that is not the app's, which
 * teaches you to read past red.
 *
 * **IT IS STILL NOT A DEPENDENCY, and that is deliberate.** `package.json` says
 * `"dependencies": {}` and must go on saying it: the app ships with none, which
 * is a decision this project has held from the start. Playwright is a tool the
 * GUARDS use, never something the server imports — so it is looked for OUTSIDE
 * the repository, and the lookup is what changed rather than the policy.
 *
 * **THE ORDER IS DELIBERATE, MOST SPECIFIC FIRST:**
 *
 *  1. `PLAYWRIGHT_PATH`, so a machine that keeps it somewhere odd says so once
 *     rather than patching fifty-one files again.
 *  2. ordinary resolution from this file — which finds a repo-local copy if one
 *     ever exists, and costs nothing when it does not.
 *  3. the known global locations, the original `/opt/node22` one among them, so
 *     **the machine this was written on is unaffected**.
 *  4. `~/.quizporium-tools`, which is where the install instruction below puts
 *     it: user-owned, so it needs no `sudo`, and outside the repo, so it cannot
 *     drift into `package.json`.
 *
 * **AND A MISS IS SAID OUT LOUD, WITH THE CURE ON IT.** The old failure was a
 * `MODULE_NOT_FOUND` stack fifteen frames deep naming a path that means nothing
 * to anybody. A guard that cannot run should say so in one line a human can
 * act on — the same rule the app itself follows for *not configured*.
 */

import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);

/** Every place Playwright is known to live, most specific first. */
const WHERE = [
  process.env.PLAYWRIGHT_PATH,
  'playwright',
  '/opt/node22/lib/node_modules/playwright',
  '/usr/local/lib/node_modules/playwright',
  '/opt/homebrew/lib/node_modules/playwright',
  join(homedir(), '.quizporium-tools', 'node_modules', 'playwright'),
].filter(Boolean);

/**
 * How to fix it, in the words of somebody who has to fix it.
 *
 * Not a link: *keep everything in the chat* applies to a terminal too, and a
 * guard that tells you to go and read a page is a guard you run tomorrow.
 */
const HOW = `
Playwright is missing, so this check cannot drive a browser.

It is NOT a dependency of this app and must never become one — the server
ships with zero. Install it beside the repo instead:

    mkdir -p ~/.quizporium-tools && cd ~/.quizporium-tools
    npm init -y && npm install playwright
    npx playwright install chromium

Or, if you keep it somewhere else already, name that place once:

    PLAYWRIGHT_PATH=/path/to/playwright node scripts/<check>.mjs
`;

/**
 * Playwright, or a refusal that says what to do about it.
 *
 * Callers destructure exactly what they always did — `const { chromium } =
 * playwright()` — so the fifty-one call sites changed by one line each and no
 * check's body moved.
 */
export function playwright() {
  for (const where of WHERE) {
    try { return require(where); } catch { /* the next one, then */ }
  }
  /*
   * A THROW RATHER THAN AN EXIT, so a caller that wants to carry on without a
   * browser still can. Nothing does today; `gig-build.mjs` reads the exit code
   * and the message lands in that check's own log either way.
   */
  const err = new Error(HOW.trim());
  err.code = 'NO_PLAYWRIGHT';
  throw err;
}

/** Was it found? For a check that would rather skip than fail. */
export function havePlaywright() {
  try { playwright(); return true; } catch { return false; }
}
