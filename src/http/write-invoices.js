/**
 * WRITE ROUTES — invoices. Moved whole out of `handleWrite()` in server.js;
 * the body is unchanged, it is one of the functions the shell tries in order.
 */
import { FEATURES } from './context.js';
import { readJson, sendJson } from './plumbing.js';
import { roomForHost, whoIs } from './identity.js';
import { allowed } from './gates.js';
import { backUpAsks, backUpInvoices, ensureInvoicesRestored, invoiceState } from './helpers.js';

export async function writeInvoices(req, res, url, route) {
  /*
   * ---- invoicing, the parts that change something
   *
   * Split from the reads because the server routes GET and everything else
   * through different functions. Putting these on the GET side meant the PDF
   * worked and nothing could be saved, which is a confusing way to fail.
   */

  if (route === '/api/invoices') {
    if (!allowed(req, res, url, FEATURES.INVOICES)) return true;
    // Always your OWN book, worked out from who you are — the same rule as
    // /api/host/*. There is no room parameter on any of these on purpose.
    const room = roomForHost(req, url);
    await ensureInvoicesRestored(room);
    const books = room.invoices;

    if (req.method === 'GET') {
      return sendJson(res, 200, invoiceState(books)), true;
    }

    // Issue one. This is the only thing that hands out a number.
    if (req.method === 'POST') {
      const body = await readJson(req);
      try {
        const invoice = books.issue(readDraft(body));
        const backup = await backUpInvoices(room);
        return sendJson(res, 200, {
          invoice: withTotals(invoice),
          filename: invoiceFilename(invoice),
          backedUp: backup.ok,
          ...invoiceState(books),
        }), true;
      } catch (err) {
        return sendJson(res, 400, { error: err.message }), true;
      }
    }
  }

  if (route === '/api/invoices/settings' && req.method === 'PUT') {
    if (!allowed(req, res, url, FEATURES.INVOICES)) return true;
    const room = roomForHost(req, url);
    await ensureInvoicesRestored(room);
    const body = await readJson(req);
    room.invoices.saveSettings(body);
    const backup = await backUpInvoices(room);
    return sendJson(res, 200, { backedUp: backup.ok, ...invoiceState(room.invoices) }), true;
  }

  if (route === '/api/invoices/customers' && req.method === 'POST') {
    if (!allowed(req, res, url, FEATURES.INVOICES)) return true;
    const room = roomForHost(req, url);
    await ensureInvoicesRestored(room);
    const body = await readJson(req);
    try {
      room.invoices.saveCustomer(body);
    } catch (err) {
      return sendJson(res, 400, { error: err.message }), true;
    }
    const backup = await backUpInvoices(room);
    return sendJson(res, 200, { backedUp: backup.ok, ...invoiceState(room.invoices) }), true;
  }

  /*
   * What a venue puts up. A route of its own so it cannot touch anything else
   * on the record — see `setVenueDetails` for why that matters.
   */
  if (route.startsWith('/api/asks/') && (req.method === 'POST' || req.method === 'DELETE')) {
    const me = whoIs(req, url);
    if (!me) return sendJson(res, 401, { error: 'Sign in first' }), true;
    const room = roomForHost(req, url);
    const id = decodeURIComponent(route.slice('/api/asks/'.length).replace(/\/keep$/, ''));
    /*
     * YES KEEPS IT, NO DELETES IT — and there is deliberately no third state.
     * A list of things you have already said no to is a list you read twice,
     * which is the opposite of what this is for.
     */
    const done = req.method === 'DELETE' ? room.asks.drop(id) : room.asks.keep(id);
    if (!done) return sendJson(res, 404, { error: 'No such request.' }), true;
    backUpAsks(room);
    return sendJson(res, 200, {
      asked: room.asks.grouped(),
      kept: room.asks.grouped(room.asks.kept),
    }), true;
  }

  if (route.startsWith('/api/invoices/customers/') && route.endsWith('/rewards') && req.method === 'PUT') {
    if (!allowed(req, res, url, FEATURES.INVOICES)) return true;
    const room = roomForHost(req, url);
    // Same reason as every other invoice route: without this a PUT lands on an
    // empty book, finds no venue and 404s on one that plainly exists.
    await ensureInvoicesRestored(room);
    const id = decodeURIComponent(route.slice('/api/invoices/customers/'.length, -'/rewards'.length));
    const body = await readJson(req);
    /*
     * The body carries whichever of the two the Venues tab just changed, and
     * `setVenueDetails` writes only what it was sent — so saving prizes cannot
     * clear a usual night. The path still says `/rewards` because a route is
     * not a label, and renaming it would 404 for any console still open in a
     * tab when this deploys.
     */
    const saved = room.invoices.setVenueDetails(id, body);
    if (!saved) return sendJson(res, 404, { error: 'No venue with that id.' }), true;
    const backup = await backUpInvoices(room);
    return sendJson(res, 200, { backedUp: backup.ok, ...invoiceState(room.invoices) }), true;
  }

  /*
   * The diary — a night put in, or a night taken out.
   *
   * On the INVOICES feature like everything else that reads or writes this
   * book, rather than on `FEATURES.CALENDAR`: the two are both Bronze and the
   * data is the same file, so a second gate here would be a second thing to
   * get wrong for no difference in who may do it. The console decides whether
   * to DRAW the diary from `CALENDAR`, which is where that distinction is
   * worth anything.
   */
  if (route === '/api/invoices/bookings' && req.method === 'POST') {
    if (!allowed(req, res, url, FEATURES.INVOICES)) return true;
    const room = roomForHost(req, url);
    await ensureInvoicesRestored(room);
    const body = await readJson(req);
    try {
      room.invoices.setBooking(body);
    } catch (err) {
      // Said in words: a booking with no date or no venue is a mistake worth
      // naming rather than a silent no-op.
      return sendJson(res, 400, { error: err.message }), true;
    }
    const backup = await backUpInvoices(room);
    return sendJson(res, 200, { backedUp: backup.ok, ...invoiceState(room.invoices) }), true;
  }

  if (route.startsWith('/api/invoices/bookings/') && req.method === 'DELETE') {
    if (!allowed(req, res, url, FEATURES.INVOICES)) return true;
    const room = roomForHost(req, url);
    await ensureInvoicesRestored(room);
    room.invoices.removeBooking(decodeURIComponent(route.slice('/api/invoices/bookings/'.length)));
    const backup = await backUpInvoices(room);
    return sendJson(res, 200, { backedUp: backup.ok, ...invoiceState(room.invoices) }), true;
  }

  if (route.startsWith('/api/invoices/customers/') && req.method === 'DELETE') {
    // INVOICES, like every other route on this tab — see the PDF one above.
    if (!allowed(req, res, url, FEATURES.INVOICES)) return true;
    const room = roomForHost(req, url);
    await ensureInvoicesRestored(room);
    room.invoices.deleteCustomer(decodeURIComponent(route.slice('/api/invoices/customers/'.length)));
    const backup = await backUpInvoices(room);
    return sendJson(res, 200, { backedUp: backup.ok, ...invoiceState(room.invoices) }), true;
  }

  // Mark it sent, paid or cancelled. Status is the only thing that can move on
  // an invoice that has already gone out — see src/invoices.js.
  if (route.startsWith('/api/invoices/') && req.method === 'POST') {
    // INVOICES, like every other route on this tab — see the PDF one above.
    // On LIBRARY, anybody with a login could mark somebody else's invoice paid
    // or cancel it, which is the invoice book quietly telling you a lie.
    if (!allowed(req, res, url, FEATURES.INVOICES)) return true;
    const room = roomForHost(req, url);
    await ensureInvoicesRestored(room);
    const number = decodeURIComponent(route.slice('/api/invoices/'.length));
    const body = await readJson(req);
    try {
      const invoice = room.invoices.setStatus(number, String(body.status || ''));
      if (!invoice) return sendJson(res, 404, { error: 'No invoice with that number' }), true;
      const backup = await backUpInvoices(room);
      return sendJson(res, 200, { backedUp: backup.ok, ...invoiceState(room.invoices) }), true;
    } catch (err) {
      return sendJson(res, 400, { error: err.message }), true;
    }
  }

  return false;
}
