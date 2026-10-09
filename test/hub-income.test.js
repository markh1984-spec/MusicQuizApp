/**
 * THE HUB'S INCOME LINE — `GET /api/hub/income`, `src/hub-income.js`.
 *
 * Mark's hub reads his gig-invoice income once a day. Three promises, each
 * proven here: the figures are the invoice tab's own to the penny (a real
 * `Invoices` book, never a hand-built sum), the answer carries nothing about
 * anybody — no venue, contact, invoice number or line — and a book that could
 * not be read is a 503, NEVER a row of zeros. The route is pressed over HTTP
 * as well, because a route is proven by pressing it, never by reading it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { Invoices, money, totals } from '../src/invoices.js';
import {
  HUB_BASIS, HUB_MAX_MONTHS, HUB_PROJECT, HUB_TOKEN_MIN, HUB_WRONG_PER_WINDOW, HUB_WRONG_WINDOW_MS,
  bookReadable, hubGate, hubIncome, monthRange, sameToken, ukMonth,
} from '../src/hub-income.js';
import { withServer } from './helpers/live-server.mjs';

const TOKEN = 'hub-income-test-token-0123456789abcdef';
const SECRETS = ['The Secret Arms', 'landlord@secret.example', 'Jo Landlord', 'SEC-0001', 'SEC-0002', 'SEC-0003', 'Quiz night at the secret', '1 Hidden Lane'];

const at = (iso) => () => Date.parse(iso);

/** A real book in a temp dir, so the sums are the invoice tab's own functions. */
function bookWith(run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-income-'));
  try {
    const book = new Invoices(path.join(dir, 'invoicing.json'));
    book.saveSettings({ prefix: 'SEC' });
    const venue = book.saveCustomer({ name: 'The Secret Arms', contact: 'Jo Landlord', email: 'landlord@secret.example', address: '1 Hidden Lane' });
    const issue = (iso, pounds, extra = {}) => book.issue({
      customerId: venue.id,
      event: { venue: 'The Secret Arms', date: iso.slice(0, 10) },
      lines: [{ description: 'Quiz night at the secret', amountPence: pounds * 100 }],
      ...extra,
    }, { now: at(iso) });
    return run({ book, issue });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ------------------------------------------------------------------ months

test('a month is the UK month, never the UTC one', () => {
  assert.equal(ukMonth('2026-07-31T23:30:00Z'), '2026-08', '00:30 BST on 1 August is August');
  assert.equal(ukMonth('2026-12-31T23:30:00Z'), '2026-12', 'GMT in winter: still December');
  assert.equal(ukMonth(Date.parse('2026-03-01T00:00:00Z')), '2026-03');
  for (const nothing of [null, undefined, '', 'not a date']) assert.equal(ukMonth(nothing), null, `${nothing} is no month`);
});

test('the range: thirteen months by default, a bad one refused, a long one capped to the latest 24', () => {
  const now = Date.parse('2026-10-09T12:00:00Z');
  const def = monthRange({ now });
  assert.equal(def.months.length, 13);
  assert.equal(def.months[0], '2025-10');
  assert.equal(def.months.at(-1), '2026-10', 'the current month is the last');
  assert.deepEqual(monthRange({ from: '', to: '', now }).months, def.months, 'an empty parameter is no parameter');

  assert.deepEqual(monthRange({ from: '2025-12', to: '2026-02', now }).months, ['2025-12', '2026-01', '2026-02']);
  assert.equal(monthRange({ to: '2027-05', now }).months.at(-1), '2026-10', 'a month that has not started is not answered for');

  const long = monthRange({ from: '2020-01', to: '2026-10', now });
  assert.equal(long.months.length, HUB_MAX_MONTHS);
  assert.equal(long.months.at(-1), '2026-10');
  assert.equal(long.capped, true);

  for (const [from, to] of [['2026-13', null], ['26-01', null], ['2026-1', null], [null, 'garbage'], ['2026-05', '2026-04'], ['2027-01', null]]) {
    assert.deepEqual(monthRange({ from, to, now }), { error: 'bad_range' }, `${from}..${to} was accepted`);
  }
});

// ------------------------------------------------------------------ totals

test('only PAID money is in a month, in the month it was marked paid, at the sum the invoice tab prints', () => {
  bookWith(({ book, issue }) => {
    const a = issue('2026-08-07T20:00:00Z', 300);                        // paid in August
    const b = issue('2026-08-14T20:00:00Z', 250, { depositPence: 5000 }); // paid in September, £50 deposit
    const c = issue('2026-09-04T20:00:00Z', 200);                        // still owed
    const d = issue('2026-09-11T20:00:00Z', 400);                        // cancelled
    const e = issue('2026-07-31T22:00:00Z', 150);                        // paid 00:30 BST on 1 Aug
    book.setStatus(a.number, 'paid', { now: at('2026-08-20T10:00:00Z') });
    book.setStatus(b.number, 'paid', { now: at('2026-09-02T10:00:00Z') });
    book.setStatus(d.number, 'cancelled', { now: at('2026-09-12T10:00:00Z') });
    book.setStatus(e.number, 'paid', { now: at('2026-07-31T23:30:00Z') });
    assert.equal(c.status, 'sent');

    const now = Date.parse('2026-09-20T12:00:00Z');
    const body = hubIncome({ invoices: book.invoices, summary: book.summary(), months: ['2026-07', '2026-08', '2026-09'], now });
    const by = Object.fromEntries(body.months.map((m) => [m.month, m]));

    assert.equal(by['2026-07'].markSharePence, 0, 'nothing was paid in July (UK)');
    assert.equal(by['2026-08'].markSharePence, totals(a).due + totals(e).due);
    assert.equal(by['2026-08'].markSharePence, 45000);
    assert.equal(by['2026-08'].count, 2);
    assert.equal(by['2026-09'].markSharePence, 20000, "£250 less the £50 deposit — the row's own figure");
    assert.equal(by['2026-09'].count, 1, 'the owed and the cancelled invoices are not income');
    for (const m of body.months) {
      assert.deepEqual(m.lines, [{ label: 'Gig invoices paid', pence: m.markSharePence }]);
      assert.equal(m.poolPence, null, 'no split: nothing is pooled');
      assert.equal(m.markReimbursedPence, null);
    }
    assert.deepEqual(body.months.map((m) => m.complete), [true, true, false], 'the current month is not complete');

    assert.ok(body.warnings.includes(`${money(book.summary().outstanding)} invoiced and not yet paid (1 invoice); each counts in the month it is marked paid.`),
      `the owed money is not said the way the tab says it: ${JSON.stringify(body.warnings)}`);
    assert.ok(body.warnings.some((w) => w.startsWith('£50.00 of deposits')), 'the deposit is not said');
  });
});

test('every month in the range is answered, zero when nothing was paid, oldest first', () => {
  const body = hubIncome({ invoices: [], summary: { outstanding: 0, unpaidCount: 0 }, months: ['2026-01', '2026-02'], now: Date.parse('2026-10-01T00:00:00Z') });
  assert.deepEqual(body.months.map((m) => [m.month, m.markSharePence, m.count]), [['2026-01', 0, 0], ['2026-02', 0, 0]]);
  assert.deepEqual(body.warnings, []);
});

test('a paid invoice with no paid date is said, not guessed into a month', () => {
  const body = hubIncome({
    invoices: [{ status: 'paid', paidAt: null, lines: [{ amountPence: 1000 }] }],
    months: ['2026-01'], now: Date.parse('2026-10-01T00:00:00Z'),
  });
  assert.equal(body.months[0].markSharePence, 0);
  assert.ok(body.warnings.includes('1 paid invoice has no paid date, so not counted in any month.'));
});

// --------------------------------------------------------------- the shape

const TOP = ['schemaVersion', 'project', 'currency', 'generatedAt', 'basis', 'months', 'warnings'];
const MONTH_KEYS = ['month', 'complete', 'lines', 'poolPence', 'markSharePence', 'markReimbursedPence', 'count'];

function assertContractOnly(body) {
  assert.deepEqual(Object.keys(body), TOP, 'a field outside the contract');
  assert.equal(body.schemaVersion, 1);
  assert.equal(body.project, HUB_PROJECT);
  assert.equal(body.currency, 'GBP');
  assert.equal(body.basis, HUB_BASIS);
  assert.ok(!Number.isNaN(Date.parse(body.generatedAt)));
  for (const m of body.months) {
    assert.deepEqual(Object.keys(m), MONTH_KEYS, `month ${m.month} carries a field outside the contract`);
    for (const line of m.lines) assert.deepEqual(Object.keys(line), ['label', 'pence']);
    assert.ok(Number.isInteger(m.markSharePence) && Number.isInteger(m.count));
  }
  assert.ok(body.warnings.every((w) => typeof w === 'string'));
  const text = JSON.stringify(body);
  for (const secret of SECRETS) assert.equal(text.includes(secret), false, `"${secret}" left in the hub's answer`);
}

test('the answer carries the contract and nothing about anybody', () => {
  bookWith(({ book, issue }) => {
    const paid = issue('2026-08-07T20:00:00Z', 300, { notes: 'Jo Landlord' });
    issue('2026-08-08T20:00:00Z', 120);
    book.setStatus(paid.number, 'paid', { now: at('2026-08-20T10:00:00Z') });
    const range = monthRange({ now: Date.parse('2026-10-09T12:00:00Z') });
    assertContractOnly(hubIncome({ invoices: book.invoices, summary: book.summary(), ...range, now: Date.parse('2026-10-09T12:00:00Z') }));
  });
});

// -------------------------------------------------------------------- door

test('the door: unset or short is not_configured, missing or wrong is 401, the right token is in', () => {
  const failures = new Map();
  const gate = (authorization, token = TOKEN) => hubGate({ authorization, token, who: '198.51.100.1', now: 1000, failures });
  assert.deepEqual(gate(`Bearer ${TOKEN}`, null), { status: 503, body: { error: 'not_configured' } }, 'unset');
  assert.deepEqual(gate(`Bearer ${TOKEN}`, ''), { status: 503, body: { error: 'not_configured' } });
  const short = 'x'.repeat(HUB_TOKEN_MIN - 1);
  assert.deepEqual(gate(`Bearer ${short}`, short), { status: 503, body: { error: 'not_configured' } }, 'a short token is refused even when it matches');

  assert.deepEqual(gate(undefined), { status: 401, body: { error: 'unauthorised' } });
  assert.deepEqual(gate(TOKEN), { status: 401, body: { error: 'unauthorised' } }, 'no "Bearer"');
  assert.deepEqual(gate(`Bearer ${TOKEN}x`), { status: 401, body: { error: 'unauthorised' } });
  assert.deepEqual(gate(`Bearer ${TOKEN.slice(0, -1)}`), { status: 401, body: { error: 'unauthorised' } });
  assert.equal(gate(`Bearer ${TOKEN}`), null);
  assert.equal(gate(`bearer  ${TOKEN} `), null, 'the scheme is case-blind');
  assert.equal(failures.has('198.51.100.1'), false, 'the right token clears the strikes');
});

test('too many wrong tokens from one address locks it out — the right one too — and the lock lifts', () => {
  const failures = new Map();
  const gate = (token, who, now) => hubGate({ authorization: `Bearer ${token}`, token: TOKEN, who, now, failures });
  for (let i = 0; i < HUB_WRONG_PER_WINDOW; i += 1) assert.equal(gate('wrong', '203.0.113.9', 1000 + i).status, 401);
  const locked = gate(TOKEN, '203.0.113.9', 2000);
  assert.equal(locked.status, 429, 'the right token got through a lockout');
  assert.deepEqual(locked.body, { error: 'too_many_attempts' });
  assert.ok(Number(locked.headers['Retry-After']) > 0);
  assert.equal(gate(TOKEN, '203.0.113.10', 2000), null, 'another address is not locked out');
  assert.equal(gate(TOKEN, '203.0.113.9', 1000 + HUB_WRONG_WINDOW_MS + HUB_WRONG_PER_WINDOW), null, 'the lock never lifted');
});

test('the token compare is constant-time over hashes, so a length never decides it early', () => {
  assert.equal(sameToken('abc', 'abc'), true);
  assert.equal(sameToken('abc', 'abcd'), false);
  assert.equal(sameToken('', TOKEN), false);
});

test('a book is believed only when it was read back — never zeros for a failure', () => {
  assert.equal(bookReadable({ restored: true, empty: false, backedUp: true, brokenCopy: false }), true);
  assert.equal(bookReadable({ restored: true, empty: true, backedUp: true, brokenCopy: false }), true, 'backed up and genuinely empty is a true zero');
  assert.equal(bookReadable({ restored: true, empty: false, backedUp: false, brokenCopy: false }), true);
  assert.equal(bookReadable({ restored: false, empty: false, backedUp: true, brokenCopy: false }), false, 'the backup was not read back');
  assert.equal(bookReadable({ restored: true, empty: true, backedUp: false, brokenCopy: false }), false, 'empty with no backup could be a wiped disk');
  assert.equal(bookReadable({ restored: true, empty: true, backedUp: true, brokenCopy: true }), false, 'an unparseable book is not an empty one');
});

// ----------------------------------------------------------- over HTTP

const STUB = path.join(path.dirname(new URL(import.meta.url).pathname), 'helpers', 'photo-repo-stub.mjs');
const hub = (base, { token = TOKEN, query = '', method = 'GET', from } = {}) => fetch(`${base}/api/hub/income${query}`, {
  method,
  headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(from ? { 'X-Forwarded-For': from } : {}) },
});
async function read(res) {
  assert.equal(res.headers.get('cache-control'), 'private, no-store', `${res.status} without private, no-store`);
  assert.match(res.headers.get('content-type') || '', /^application\/json/);
  return { status: res.status, json: await res.json() };
}

test('over HTTP, with no token set the route is dark: 503 not_configured', async () => {
  await withServer(async (base) => {
    assert.deepEqual(await read(await hub(base)), { status: 503, json: { error: 'not_configured' } });
    assert.deepEqual(await read(await hub(base, { token: '' })), { status: 503, json: { error: 'not_configured' } });
  }, { env: { HUB_INCOME_TOKEN: '' } });
});

const BACKED_UP_BOOK = {
  settings: { prefix: 'SEC', nextNumber: 4 },
  customers: [{ id: 'secret', name: 'The Secret Arms', contact: 'Jo Landlord', email: 'landlord@secret.example', address: '1 Hidden Lane' }],
  bookings: [],
  invoices: [
    { number: 'SEC-0001', issuedAt: '2026-01-09T20:00:00Z', status: 'paid', paidAt: '2026-01-20T10:00:00Z', to: { name: 'The Secret Arms', email: 'landlord@secret.example' }, vat: { registered: false }, lines: [{ description: 'Quiz night at the secret', amountPence: 30000 }], depositPence: 0 },
    { number: 'SEC-0002', issuedAt: '2026-03-06T20:00:00Z', status: 'paid', paidAt: '2026-03-31T23:30:00Z', to: { name: 'The Secret Arms' }, vat: { registered: false }, lines: [{ description: 'Quiz night at the secret', amountPence: 25000 }], depositPence: 0 },
    { number: 'SEC-0003', issuedAt: '2026-02-13T20:00:00Z', status: 'sent', paidAt: null, to: { name: 'The Secret Arms' }, vat: { registered: false }, lines: [{ description: 'Quiz night at the secret', amountPence: 12000 }], depositPence: 0 },
  ],
};

test('over HTTP: GitHub down after a deploy is 503, never zeros; back, the backed-up book is counted', async () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-income-gh-'));
  const flag = path.join(os.tmpdir(), `hub-income-refuse-${process.pid}-${Date.now()}`);
  fs.writeFileSync(path.join(repo, 'invoicing.json'), `${JSON.stringify(BACKED_UP_BOOK, null, 2)}\n`);
  fs.writeFileSync(flag, '');
  try {
    await withServer(async (base) => {
      // An empty disk and a GitHub that will not answer: a year of no gigs is the lie.
      const range = '?from=2026-01&to=2026-04';
      assert.deepEqual(await read(await hub(base, { query: range })), { status: 503, json: { error: 'source_unavailable' } });

      fs.rmSync(flag, { force: true });
      await new Promise((r) => setTimeout(r, 150));   // past RESTORE_BACKOFF_MS, so the next read is a real retry

      const ok = await read(await hub(base, { query: range }));
      assert.equal(ok.status, 200, JSON.stringify(ok.json));
      assertContractOnly(ok.json);
      assert.deepEqual(ok.json.months.map((m) => [m.month, m.markSharePence, m.count, m.complete]),
        [['2026-01', 30000, 1, true], ['2026-02', 0, 0, true], ['2026-03', 0, 0, true], ['2026-04', 25000, 1, true]],
        '23:30 UTC on 31 March is 00:30 BST on 1 April — April\'s money');
      assert.deepEqual(ok.json.warnings, ['£120.00 invoiced and not yet paid (1 invoice); each counts in the month it is marked paid.']);

      const def = await read(await hub(base));
      assert.equal(def.status, 200);
      assert.equal(def.json.months.length, 13, 'the default is thirteen months');

      const head = await hub(base, { method: 'HEAD' });
      assert.equal(head.status, 200);
      assert.equal(head.headers.get('cache-control'), 'private, no-store');
      for (const method of ['POST', 'PUT', 'DELETE']) {
        const res = await hub(base, { method });
        assert.deepEqual(await read(res), { status: 405, json: { error: 'method_not_allowed' } }, `${method} was not refused`);
        assert.equal(res.headers.get('allow'), 'GET, HEAD');
      }
      assert.deepEqual(await read(await hub(base, { query: '?from=2026-13' })), { status: 400, json: { error: 'bad_range' } });

      // Missing and wrong are 401; enough of them from one address lock it out, right token or not.
      const from = '203.0.113.77';
      assert.deepEqual(await read(await hub(base, { token: '', from })), { status: 401, json: { error: 'unauthorised' } });
      for (let i = 1; i < HUB_WRONG_PER_WINDOW; i += 1) {
        assert.deepEqual(await read(await hub(base, { token: `${TOKEN}-wrong`, from })), { status: 401, json: { error: 'unauthorised' } });
      }
      const locked = await hub(base, { from });
      assert.deepEqual(await read(locked), { status: 429, json: { error: 'too_many_attempts' } });
      assert.ok(Number(locked.headers.get('retry-after')) > 0);
      assert.equal((await hub(base, { from: '203.0.113.78' })).status, 200, 'one address locked out everybody');
    }, {
      nodeArgs: ['--import', STUB],
      env: { GH_STUB_DIR: repo, GH_STUB_REFUSE_READS: flag, PHOTO_REPO: 'someone/photos', PHOTO_TOKEN: 'stub', RESTORE_BACKOFF_MS: '50', HUB_INCOME_TOKEN: TOKEN },
    });
  } finally {
    fs.rmSync(flag, { force: true });
    fs.rmSync(repo, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});
