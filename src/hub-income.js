/**
 * THE HUB'S INCOME LINE — Mark's gig invoices to venues, as monthly totals.
 *
 * Mark's hub (a separate app) shows his income from every project on one page,
 * and asks each one for it once a day over `GET /api/hub/income`. The contract
 * is the hub's, shared by every app: monthly totals in signed whole pence, a
 * plain sentence saying what they are, and NOTHING about anybody — no venue,
 * no contact, no invoice number, no line. This file is the whole of the
 * answer and holds no clock, no file and no network, so all of it is testable
 * with an injected `now`; `src/http/hub-income.js` is the thin route.
 *
 * **ONLY PAID MONEY IS IN THE WATERFALL.** An invoice raised is not money in —
 * a venue that never pays would read as income for the month it was sent. So
 * the one line is the invoices marked PAID, in the UK month they were marked;
 * what is still owed is a warning sentence, never a figure in a month.
 *
 * **THE SUM IS `totals(invoice).due`, THE NUMBER THE INVOICE TAB PRINTS** on
 * every row, and what is owed is `summary().outstanding`, the line at the top
 * of the same tab — the same functions, so the hub and the console agree to
 * the penny. A deposit is money handed over BEFORE the invoice, with no date
 * in the book, so it is said in a warning rather than guessed into a month.
 *
 * **IT IS MARK'S OWN MONEY — 100%, NO SPLIT** — so there is no pool and
 * nothing reimbursed: both are `null`, and his share is the paid total.
 */

import crypto from 'node:crypto';
import { money, totals } from './invoices.js';

export const HUB_PROJECT = 'quizporium-invoices';
export const HUB_BASIS = "Mark's gig invoices to venues, counted when paid; UK months.";
export const HUB_PAID_LABEL = 'Gig invoices paid';

/** The token is long or it is not set at all — a short one is refused as unset. */
export const HUB_TOKEN_MIN = 32;
/** The default window: the current month and the twelve before it. */
export const HUB_DEFAULT_MONTHS = 13;
/** The most months one request may ask for. */
export const HUB_MAX_MONTHS = 24;

/*
 * WRONG TOKENS, PER ADDRESS — a SAFETY number, like `SIGN_INS_PER_WINDOW`.
 * The hub asks once a day; ten misses in fifteen minutes is a script. In
 * memory on purpose: a restart forgiving everybody is the right failure for a
 * courtesy limit, and the token's own length is the real protection.
 */
export const HUB_WRONG_PER_WINDOW = 10;
export const HUB_WRONG_WINDOW_MS = 15 * 60_000;

// ------------------------------------------------------------------ months

/*
 * UK MONTHS, never UTC. A gig paid at 00:30 on 1 August in London is August's
 * money; read in UTC it is July's. Built once, the same zone `invoices.js`
 * reads every date in.
 */
const LONDON_MONTH = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit' });
const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** "2026-08" in London for a date, an ISO string or epoch ms — or null for nothing readable. */
export function ukMonth(value) {
  if (value === null || value === undefined || value === '') return null;
  const at = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(at.getTime())) return null;
  const parts = {};
  for (const p of LONDON_MONTH.formatToParts(at)) parts[p.type] = p.value;
  return `${parts.year}-${parts.month}`;
}

const indexOf = (month) => {
  const m = MONTH.exec(month);
  return m ? Number(m[1]) * 12 + Number(m[2]) - 1 : NaN;
};
const monthAt = (index) => `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;

/**
 * Which months to answer for, from the request's `from` and `to`.
 *
 * Both optional: no `to` is the current UK month, no `from` is twelve before
 * `to`. A `to` past the current month is brought back to it — a month that
 * has not started has no figures, and a zero for it would read as a real one.
 * Over `HUB_MAX_MONTHS` keeps the LATEST months and says so. Anything that is
 * not `YYYY-MM`, or a `from` after the `to`, is `{ error: 'bad_range' }`.
 */
export function monthRange({ from = null, to = null, now = Date.now() } = {}) {
  const current = indexOf(ukMonth(now));
  const read = (v) => (v === null || v === undefined || v === '' ? null : indexOf(String(v)));
  let end = read(to);
  let start = read(from);
  if (Number.isNaN(end) || Number.isNaN(start)) return { error: 'bad_range' };
  if (end === null || end > current) end = current;
  if (start === null) start = end - (HUB_DEFAULT_MONTHS - 1);
  if (start > end) return { error: 'bad_range' };
  let capped = false;
  if (end - start + 1 > HUB_MAX_MONTHS) {
    start = end - (HUB_MAX_MONTHS - 1);
    capped = true;
  }
  const months = [];
  for (let i = start; i <= end; i += 1) months.push(monthAt(i));
  return { months, capped };
}

// ------------------------------------------------------------------ totals

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/**
 * The whole response body, from the invoice book's own invoices and summary.
 *
 * @param {object[]} invoices  `room.invoices.invoices` — read, never changed
 * @param {object} summary     `room.invoices.summary()` — what the tab says is owed
 * @param {string[]} months    from `monthRange()`, oldest first
 * @param {boolean} capped     the range was cut to `HUB_MAX_MONTHS`
 */
export function hubIncome({ invoices = [], summary = null, months = [], capped = false, now = Date.now() } = {}) {
  const current = indexOf(ukMonth(now));
  const rows = new Map(months.map((month) => [month, { pence: 0, count: 0 }]));
  let undated = 0;
  let deposits = 0;
  let vat = 0;

  for (const invoice of invoices) {
    if (!invoice || invoice.status !== 'paid') continue;
    const month = ukMonth(invoice.paidAt);
    if (!month) { undated += 1; continue; }
    const row = rows.get(month);
    if (!row) continue;
    const sum = totals(invoice);
    row.pence += sum.due;
    row.count += 1;
    if (sum.deposit > 0) deposits += sum.deposit;
    if (sum.vat > 0) vat += sum.vat;
  }

  /*
   * PLAIN SENTENCES, TOTALS ONLY. Nothing here may name a venue or quote an
   * invoice number — a count and a sum is the most any of them says.
   */
  const warnings = [];
  if (summary && summary.unpaidCount > 0) {
    warnings.push(`${money(summary.outstanding)} invoiced and not yet paid (${plural(summary.unpaidCount, 'invoice', 'invoices')}); each counts in the month it is marked paid.`);
  }
  if (deposits > 0) {
    warnings.push(`${money(deposits)} of deposits taken before invoicing is not counted: the invoice book has no date for when a deposit was paid.`);
  }
  if (vat > 0) {
    warnings.push(`${money(vat)} of the paid total is VAT, which is not Mark's to keep.`);
  }
  if (undated > 0) {
    warnings.push(`${plural(undated, 'paid invoice has', 'paid invoices have')} no paid date, so not counted in any month.`);
  }
  if (capped) {
    warnings.push(`Only the latest ${HUB_MAX_MONTHS} months are sent in one answer.`);
  }

  return {
    schemaVersion: 1,
    project: HUB_PROJECT,
    currency: 'GBP',
    generatedAt: new Date(now).toISOString(),
    basis: HUB_BASIS,
    months: months.map((month) => {
      const row = rows.get(month);
      return {
        month,
        complete: indexOf(month) < current,
        lines: [{ label: HUB_PAID_LABEL, pence: row.pence }],
        poolPence: null,
        markSharePence: row.pence,
        markReimbursedPence: null,
        count: row.count,
      };
    }),
    warnings,
  };
}

/**
 * CAN THE BOOK BE BELIEVED? A failure is a 503, NEVER a row of zeros.
 *
 * - `restored` — the backup was read back this boot (or there is none yet).
 *   A GitHub that did not answer leaves an empty disk looking like a year
 *   with no gigs, which is the exact lie this exists to refuse.
 * - an EMPTY book with no backup set up cannot be told from one a deploy
 *   wiped — Render empties `data/` on every deploy — so it is not zero, it is
 *   unknown.
 * - an EMPTY book beside a `.broken` copy is one `Invoices.load()` could not
 *   parse and put aside: unreadable, not empty.
 */
export function bookReadable({ restored, empty, backedUp, brokenCopy }) {
  if (!restored) return false;
  if (empty && (!backedUp || brokenCopy)) return false;
  return true;
}

// -------------------------------------------------------------------- door

/** Two strings compared in constant time, length included — hashed first so the lengths always match. */
export function sameToken(supplied, expected) {
  const digest = (s) => crypto.createHash('sha256').update(String(s), 'utf8').digest();
  return crypto.timingSafeEqual(digest(supplied), digest(expected));
}

/**
 * Is this caller let in? `null` for yes, otherwise the refusal to send.
 *
 * In order: no usable token configured is 503 `not_configured` (never a 401 —
 * the hub must be able to tell "set it up" from "wrong key"); an address with
 * too many wrong tries is 429 even with the right one, or it is no lockout; a
 * missing or wrong token is 401 and one more strike. The right one clears the
 * address's strikes. `failures` is the caller's own Map, so a test owns its.
 */
export function hubGate({ authorization, token, who = 'unknown', now = Date.now(), failures }) {
  const expected = String(token || '').trim();
  if (expected.length < HUB_TOKEN_MIN) return { status: 503, body: { error: 'not_configured' } };

  const recent = (failures.get(who) || []).filter((at) => now - at < HUB_WRONG_WINDOW_MS);
  if (recent.length >= HUB_WRONG_PER_WINDOW) {
    failures.set(who, recent);
    const retry = Math.max(1, Math.ceil((recent[0] + HUB_WRONG_WINDOW_MS - now) / 1000));
    return { status: 429, body: { error: 'too_many_attempts' }, headers: { 'Retry-After': String(retry) } };
  }

  const m = /^Bearer\s+(\S+)\s*$/i.exec(String(authorization || ''));
  if (m && sameToken(m[1], expected)) {
    failures.delete(who);
    return null;
  }

  recent.push(now);
  failures.set(who, recent);
  // The Map may not grow with the internet: an address keyed on a header the
  // caller writes is the same shape as the signup counter, pruned the same way.
  if (failures.size > 5000) {
    for (const [key, at] of failures) if (!at.some((t) => now - t < HUB_WRONG_WINDOW_MS)) failures.delete(key);
  }
  return { status: 401, body: { error: 'unauthorised' } };
}
