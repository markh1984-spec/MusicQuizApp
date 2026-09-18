/**
 * GET ROUTES — invoices. Moved whole out of `handleGet()` in server.js;
 * the body is unchanged, it is one of the functions the shell tries in order.
 */
import { FEATURES, invoiceFilename, invoicePdf, suggestions } from './context.js';
import { sendJson } from './plumbing.js';
import { roomForHost, whoIs } from './identity.js';
import { allowed } from './gates.js';
import { accountRef, backUpSuggestions, ensureInvoicesRestored, invoiceState } from './helpers.js';

export async function getInvoices(req, res, url, route) {
  /*
   * ---- invoicing
   *
   * All of it behind the host key, and none of it in any player or screen
   * payload. Customer addresses and your own bank details have no business
   * being one mistyped URL away from a room full of phones.
   *
   * The PDF route comes first because the catch-all below it would otherwise
   * read "MMM-0001.pdf" as an invoice number.
   */
  if (route.startsWith('/api/invoices/') && route.endsWith('.pdf')) {
    // INVOICES, not LIBRARY. This asked for LIBRARY, which every quizmaster
    // has, so anybody with a login could download anybody's invoice — and an
    // invoice carries the host's own sort code and account number and the
    // customer's address. Found by a signed-in quizmaster fetching one.
    if (!allowed(req, res, url, FEATURES.INVOICES)) return true;
    const number = decodeURIComponent(route.slice('/api/invoices/'.length, -4));
    const room = roomForHost(req, url);
    await ensureInvoicesRestored(room);
    // Their own book. Looked up in a SHARED book, a number somebody guessed
    // would have handed them another quizmaster's invoice, complete with that
    // quizmaster's sort code — which is the whole reason these are now split.
    const invoice = room.invoices.find(number);
    if (!invoice) return sendJson(res, 404, { error: 'No invoice with that number' }), true;
    const pdf = invoicePdf(invoice);
    // `inline` so tapping it on a phone opens a preview to check before
    // sending, rather than dropping a file into Downloads unseen.
    res.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${invoiceFilename(invoice)}"`,
      'Cache-Control': 'no-store',
    });
    return res.end(pdf), true;
  }

  /*
   * The suggestion box.
   *
   * READING the list is the owner's — a quizmaster seeing everybody else's
   * complaints is the same mistake as a shared invoice book. SENDING one is
   * everybody's, and deliberately not gated on a tier: the whole point is to
   * hear from the people who are finding it hardest, who are the least likely
   * to be on the top rung.
   */
  /*
   * Their own thread. Without this the box is one-way — you send something into
   * the dark and never learn whether it landed, which is how a feedback route
   * stops being used after the second time.
   */
  /*
   * WHAT THE ROOM ASKED FOR — read, kept or binned.
   *
   * Behind the same owner check the launch uses, because the feature is his
   * alone for now. It is a quizmaster's own customers' words either way, so it
   * is read out of THEIR room and never pooled.
   */
  if (route === '/api/asks' && req.method === 'GET') {
    const me = whoIs(req, url);
    if (!me) return sendJson(res, 401, { error: 'Sign in first' }), true;
    const room = roomForHost(req, url);
    return sendJson(res, 200, {
      // Grouped: four people asking for reggae is one row with a 4 on it, not
      // four rows. That is what makes a Monday's worth of these one pass.
      asked: room.asks.grouped(),
      // Grouped as well, or one idea four people asked for turns into four
      // identical rows on the list of things worth writing — and then it looks
      // like four jobs.
      kept: room.asks.grouped(room.asks.kept),
    }), true;
  }

  if (route === '/api/suggestions/mine' && req.method === 'GET') {
    const me = whoIs(req, url);
    if (!me) return sendJson(res, 401, { error: 'Sign in first' }), true;
    const mine = suggestions.forAccount(me.id);
    /*
     * Drawing it counts as opening it.
     *
     * Marked AFTER the payload is built, so the reply they are being shown
     * right now is the one that gets stamped — and only if a real account is
     * asking, since the owner reading their own inbox must not mark somebody
     * else's reply as seen.
     */
    if (!me.actingAs && suggestions.markSeen(me.id)) backUpSuggestions();
    return sendJson(res, 200, { suggestions: mine }), true;
  }

  if (route === '/api/suggestions' && req.method === 'GET') {
    const me = whoIs(req, url);
    if (!me || (me.role !== 'owner' && !me.bootstrap)) {
      return sendJson(res, 403, { error: 'Owners only.' }), true;
    }
    return sendJson(res, 200, {
      suggestions: suggestions.all.map((x) => ({ ...x, ref: accountRef(x.byId) })),
      summary: suggestions.summary(),
      // What the owner has taught the drafting model, so they can edit it.
      house: suggestions.house,
      // Whether the Draft button can work at all. Said up front rather than
      // found out by pressing it and getting an error.
      canDraft: Boolean(process.env.ANTHROPIC_API_KEY),
    }), true;
  }

  if (route === '/api/invoices' && req.method === 'GET') {
    if (!allowed(req, res, url, FEATURES.INVOICES)) return true;
    // Their own book, worked out from who they are. This is the route the tab
    // actually loads from — the one in handleWrite only answers GET when the
    // request reaches it, which it does not.
    const room = roomForHost(req, url);
    await ensureInvoicesRestored(room);
    return sendJson(res, 200, invoiceState(room.invoices)), true;
  }

  return false;
}
