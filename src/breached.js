/**
 * HAS THIS PASSWORD ALREADY BEEN IN A BREACH?
 *
 * ---
 *
 * Built when the minimum length came down from ten characters to eight, and it
 * is the reason that was a reasonable thing to do rather than simply a weaker
 * rule. Length is a poor proxy for safety on its own: `Password1` is nine
 * characters and has been in every wordlist for twenty years, while a password
 * nobody has ever used is fine at eight. **What actually loses an account is
 * REUSE** — one password across several sites, one of which gets breached, and
 * then somebody tries the pair everywhere. That is credential stuffing, and it
 * is the commonest way an account is taken over.
 *
 * So the rule that replaced four characters is: *a password that is already on
 * a public list is refused, however long it is.*
 *
 * **THE PASSWORD NEVER LEAVES THIS PROCESS.** Have I Been Pwned's range API
 * takes the FIRST FIVE hex characters of the SHA-1 and answers with every
 * suffix it holds under that prefix — about eight hundred of them — and the
 * comparison happens here. A prefix that short matches roughly one in a
 * million of the hashes in the set, so what goes out identifies nothing. This
 * is the published k-anonymity design of that API and not a trick played on
 * it.
 *
 * **IT FAILS OPEN, AND THAT IS THE WHOLE OPERATIONAL DECISION.** Three states,
 * never two: yes, no, and COULD NOT TELL. A network blip, a timeout or an
 * outage must never stop somebody setting a password — the person doing it is
 * often already locked out, and an app that refuses to let them back in
 * because a third party is down has done far more damage than a reused
 * password would. `null` means unknown and every caller treats it as allowed.
 *
 * **NO KEY AND NO DEPENDENCY.** The range endpoint is open, and this is one
 * `fetch` and one `crypto.createHash` — both node's own. `fetch` is injected
 * so the tests never touch the network.
 */

import crypto from 'node:crypto';

/** Short, because somebody is waiting on a form. Fail open past this. */
const TIMEOUT_MS = 2500;

const API = 'https://api.pwnedpasswords.com/range/';

/**
 * @returns {Promise<number|null>} how many breaches it is known from, 0 if it
 *   is not on the list, or `null` when the answer could not be got at all.
 */
export async function timesBreached(password, {
  fetchIt = globalThis.fetch,
  timeout = TIMEOUT_MS,
  url = API,
} = {}) {
  const value = String(password ?? '');
  if (!value) return null;

  const sha = crypto.createHash('sha1').update(value, 'utf8').digest('hex').toUpperCase();
  const prefix = sha.slice(0, 5);
  const suffix = sha.slice(5);

  /*
   * ABORTED RATHER THAN RACED, so a hung connection is not left running behind
   * a form that has already moved on. `AbortSignal.timeout` is node's own.
   */
  let text = '';
  try {
    const res = await fetchIt(`${url}${prefix}`, {
      signal: AbortSignal.timeout(timeout),
      headers: {
        // Asks for the padded response: every prefix comes back with the same
        // number of lines, so the SIZE of the reply says nothing about how
        // many hashes sit under it.
        'Add-Padding': 'true',
        'User-Agent': 'Quizporium',
      },
    });
    if (!res || !res.ok) return null;
    text = await res.text();
  } catch {
    return null;                       // could not tell — see the note above
  }

  for (const line of text.split('\n')) {
    const at = line.indexOf(':');
    if (at < 0) continue;
    if (line.slice(0, at).trim().toUpperCase() !== suffix) continue;
    const count = Number(line.slice(at + 1).trim());
    return Number.isFinite(count) ? count : 0;
  }
  return 0;
}

/**
 * The one sentence a caller needs: may this password be used?
 *
 * **A COUNT OF ZERO IS PADDING, NOT A HIT.** The padded response includes
 * decoy lines with a count of `0`, so "is it in the list at all" is the wrong
 * question — the right one is whether it has been seen more than none.
 */
export async function looksBreached(password, opts = {}) {
  const seen = await timesBreached(password, opts);
  return typeof seen === 'number' && seen > 0;
}

/** What to tell somebody, in words that say what to do about it. */
export const BREACHED_SAID =
  'That password has turned up in a data breach somewhere else, so it is not safe to use here. '
  + 'Pick a different one — a short sentence is ideal.';
