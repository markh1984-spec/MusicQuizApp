/**
 * ISSUING AN INVOICE, OVER HTTP — because the route answered 400 "readDraft is
 * not defined" from the day the server was split into modules.
 *
 * `write-invoices.js` used `readDraft()`, `withTotals()` and
 * `invoiceFilename()` without importing them; the ReferenceError landed in the
 * route's own `catch` and came back as a polite 400, so nothing was thrown and
 * nothing logged as a fault. `test/server-split.test.js` promised to catch
 * exactly this and could not see it: its comment-stripping regex took a `/*`
 * inside a STRING as a comment opener and threw most of the file away before
 * looking. Found by the scope pass that replaced it (`test/scope.js`), while
 * fixing the `statsFile` fault of the same shape (O23, 23 September sweep).
 *
 * A route is proven by pressing it, never by reading it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { withServer } from './helpers/live-server.mjs';
import { Accounts } from '../src/accounts.js';

const EMAIL = 'bill@x.com';
const PASSWORD = 'a-long-invoice-password';

test('a signed-in quizmaster can issue an invoice and gets it back with its totals and filename', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/sign-in`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    assert.equal(res.status, 200, 'could not sign the quizmaster in');
    const cookie = (res.headers.get('set-cookie') || '').split(';')[0];
    const post = (route, body) => fetch(`${base}${route}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify(body),
    }).then((r) => r.json().then((json) => ({ status: r.status, json })));

    const venue = await post('/api/invoices/customers', { name: 'The Ledger Arms' });
    assert.equal(venue.status, 200, `could not make a venue: ${JSON.stringify(venue.json)}`);
    const customer = (venue.json.customers || []).find((c) => c.name === 'The Ledger Arms');
    assert.ok(customer, 'the venue did not come back');

    const issued = await post('/api/invoices', {
      customerId: customer.id,
      event: { date: '2026-09-24', description: 'Thursday quiz' },
      lines: [{ description: 'Quiz night', amount: '250' }],
    });
    assert.equal(issued.status, 200, `issuing the invoice failed: ${JSON.stringify(issued.json)}`);
    assert.ok(issued.json.invoice && issued.json.invoice.totals, 'the invoice came back without its totals');
    assert.equal(issued.json.invoice.totals.gross, 25000, 'the total is wrong');
    assert.match(String(issued.json.filename || ''), /\.pdf$/, 'no filename for the PDF');
  }, {
    seed(dir) {
      const accounts = new Accounts(path.join(dir, 'accounts.json'));
      accounts.create({ email: EMAIL, password: PASSWORD, name: 'Bill', role: 'quizmaster', tier: 'gold', status: 'active' });
      accounts.save();
    },
  });
});
