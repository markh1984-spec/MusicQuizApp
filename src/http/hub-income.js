/**
 * `GET /api/hub/income` — MARK'S HUB READS HIS GIG-INVOICE INCOME, ONCE A DAY.
 *
 * Read-only, and the whole answer is `src/hub-income.js`: this only opens the
 * door, reads the house room's invoice book (Mark's — the owner and the host
 * key both run the house room) and sends what that file builds. Monthly
 * totals and nothing else — no venue, contact, invoice number or line ever
 * leaves here.
 *
 * - **ITS OWN TOKEN, `HUB_INCOME_TOKEN`, as `Authorization: Bearer …`** — never
 *   the host key, and no cookie: the hub is a server, not a person. Unset or
 *   under 32 characters is 503 `not_configured`, so the route is dark until
 *   Mark sets it.
 * - **NEVER ZEROS FOR A FAILURE.** The book is read back from the private
 *   repo after every deploy; a backup that could not be read is 503
 *   `source_unavailable` — `bookReadable()` says when.
 * - **`Cache-Control: private, no-store` and JSON on every answer**, the
 *   refusals included. GET and HEAD only; a write method is 405.
 */
import { HOUSE, fs, privateRepoConfigured, rooms } from './context.js';
import { callerOf, send } from './plumbing.js';
import { ensureInvoicesRestored, invoicesRestored } from './helpers.js';
import { bookReadable, hubGate, hubIncome, monthRange } from '../hub-income.js';

export const HUB_INCOME_ROUTE = '/api/hub/income';

/** Wrong tokens per address — in memory, see `HUB_WRONG_PER_WINDOW`. */
const hubFailures = new Map();

function answer(res, status, body, headers = {}) {
  send(res, status, JSON.stringify(body), {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'private, no-store',
    ...headers,
  });
  return true;
}

export async function getHubIncome(req, res, url, route) {
  if (route !== HUB_INCOME_ROUTE) return false;

  const refused = hubGate({
    authorization: req.headers.authorization,
    token: process.env.HUB_INCOME_TOKEN,
    who: callerOf(req),
    now: Date.now(),
    failures: hubFailures,
  });
  if (refused) return answer(res, refused.status, refused.body, refused.headers);

  const now = Date.now();
  const range = monthRange({ from: url.searchParams.get('from'), to: url.searchParams.get('to'), now });
  if (range.error) return answer(res, 400, { error: range.error });

  const house = rooms.get(HOUSE);
  try {
    await ensureInvoicesRestored(house);
    const book = house.invoices;
    const readable = bookReadable({
      restored: invoicesRestored.has(house.id),
      empty: book.isEmpty(),
      backedUp: privateRepoConfigured(),
      brokenCopy: fs.existsSync(`${book.filePath}.broken`),
    });
    if (!readable) {
      console.warn('[hub-income] the invoice book could not be read back, so no figures were sent');
      return answer(res, 503, { error: 'source_unavailable' });
    }
    return answer(res, 200, hubIncome({
      invoices: book.invoices,
      summary: book.summary({ now: () => now }),
      months: range.months,
      capped: range.capped,
      now,
    }));
  } catch (err) {
    console.warn('[hub-income] could not read the invoice book:', err.message);
    return answer(res, 503, { error: 'source_unavailable' });
  }
}

/** Any write method at the hub's address is 405 — it is read-only. */
export async function writeHubIncome(req, res, url, route) {
  if (route !== HUB_INCOME_ROUTE) return false;
  return answer(res, 405, { error: 'method_not_allowed' }, { Allow: 'GET, HEAD' });
}
