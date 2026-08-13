/**
 * Invoicing.
 *
 * The two things under test are the two things that would be embarrassing in
 * front of somebody about to pay you: the arithmetic, and the fact that an
 * invoice already sent must never change afterwards.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { Invoices, WEEKDAYS, toPence, formatPence, money, totals, dueDate, describeEvent, shortDate, longDate } from '../src/invoices.js';
import { invoicePdf, invoiceFilename } from '../src/invoice-pdf.js';
import { textWidth, fit } from '../src/pdf.js';

const AT = Date.parse('2026-08-07T21:30:00.000Z');
const now = () => AT;

function withFile(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'invoices-'));
  try {
    return fn(path.join(dir, 'invoicing.json'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function setUp(file) {
  const book = new Invoices(file);
  book.saveSettings({
    business: { name: "Mark's Music Madness", contact: 'Mark Harris', address: '1 High Street\nBrentwood\nCM14 4AB', email: 'mark@example.com' },
    bank: { name: 'M Harris', sortCode: '00-00-00', accountNumber: '12345678' },
    prefix: 'MMM',
  });
  const customer = book.saveCustomer({ name: 'The Crown', contact: 'Dave', address: '2 Market Place\nRomford', email: 'dave@thecrown.example', usualFee: '350' });
  return { book, customer };
}

// ------------------------------------------------------------------- money

test('money is read as whole pence, and anything odd is refused', () => {
  assert.equal(toPence('350'), 35000);
  assert.equal(toPence('350.00'), 35000);
  assert.equal(toPence('£350.50'), 35050);
  assert.equal(toPence('1,250.05'), 125005);
  assert.equal(toPence(' 42.5 '), 4250, 'one decimal place is tenths of a pound');
  assert.equal(toPence(350), 35000);
  assert.equal(toPence('-25'), -2500);
  // A third decimal is a typo, not something to round away quietly.
  assert.equal(toPence('350.567'), null);
  assert.equal(toPence('three hundred'), null);
  assert.equal(toPence(''), null);
  assert.equal(toPence(null), null);
});

test('pence come back out formatted the way a customer expects', () => {
  assert.equal(formatPence(35000), '350.00');
  assert.equal(formatPence(125005), '1,250.05');
  assert.equal(formatPence(5), '0.05');
  assert.equal(formatPence(0), '0.00');
  assert.equal(money(35000), '£350.00');
});

test('the classic float bug cannot happen, because there are no floats', () => {
  // 0.1 + 0.2 in pounds is the reason everything in here is an integer.
  const lines = [{ amountPence: toPence('0.10') }, { amountPence: toPence('0.20') }];
  assert.equal(totals({ lines }).net, 30);
  assert.equal(money(totals({ lines }).net), '£0.30');
});

// -------------------------------------------------------------------- sums

test('a plain invoice is just the lines added up', () => {
  const sum = totals({ lines: [{ amountPence: 35000 }, { amountPence: 2500 }] });
  assert.deepEqual(sum, { net: 37500, vatRate: 0, vat: 0, gross: 37500, deposit: 0, due: 37500 });
});

test('a deposit comes off what is owed, not off the total charged', () => {
  const sum = totals({ lines: [{ amountPence: 35000 }], depositPence: 10000 });
  assert.equal(sum.gross, 35000, 'the fee is still the fee');
  assert.equal(sum.due, 25000, 'and this is what is left to pay');
});

test('VAT is added to the net and rounded once, on the total', () => {
  const sum = totals({
    lines: [{ amountPence: 33333 }, { amountPence: 3333 }],
    vat: { registered: true, ratePercent: 20 },
  });
  assert.equal(sum.net, 36666);
  assert.equal(sum.vat, 7333, '20% of 366.66 is 73.332, so 73.33');
  assert.equal(sum.gross, 43999);
});

test('VAT is not charged when you are not registered, whatever the rate says', () => {
  const sum = totals({ lines: [{ amountPence: 35000 }], vat: { registered: false, ratePercent: 20 } });
  assert.equal(sum.vat, 0);
  assert.equal(sum.due, 35000);
});

// ---------------------------------------------------------------- numbering

test('numbers are sequential, padded, and use your prefix', () => {
  withFile((file) => {
    const { book, customer } = setUp(file);
    const first = book.issue(book.draft({ customerId: customer.id }), { now });
    const second = book.issue(book.draft({ customerId: customer.id }), { now });
    assert.equal(first.number, 'MMM-0001');
    assert.equal(second.number, 'MMM-0002');
    assert.equal(book.settings.nextNumber, 3);
  });
});

test('a number is only handed out when an invoice is actually issued', () => {
  withFile((file) => {
    const { book, customer } = setUp(file);
    // Three drafts started and abandoned leave no hole in the sequence.
    book.draft({ customerId: customer.id });
    book.draft({ customerId: customer.id });
    assert.equal(book.issue(book.draft({ customerId: customer.id }), { now }).number, 'MMM-0001');
  });
});

test('numbers survive a restart, because a repeat is worse than a gap', () => {
  withFile((file) => {
    const { book, customer } = setUp(file);
    book.issue(book.draft({ customerId: customer.id }), { now });
    book.issue(book.draft({ customerId: customer.id }), { now });

    const reopened = new Invoices(file);
    assert.equal(reopened.invoices.length, 2);
    const next = reopened.issue({ toName: 'Somebody Else', lines: [{ description: 'Quiz', amountPence: 30000 }] }, { now });
    assert.equal(next.number, 'MMM-0003');
    assert.equal(new Set(reopened.invoices.map((i) => i.number)).size, 3, 'no number used twice');
  });
});

test('renaming the prefix does not renumber anything already issued', () => {
  withFile((file) => {
    const { book, customer } = setUp(file);
    const before = book.issue(book.draft({ customerId: customer.id }), { now });
    book.saveSettings({ prefix: 'MMQ' });
    const after = book.issue(book.draft({ customerId: customer.id }), { now });
    assert.equal(book.find(before.number).number, 'MMM-0001');
    assert.equal(after.number, 'MMQ-0002', 'the counter carries on rather than restarting');
  });
});

test('the counter cannot be wound back from outside', () => {
  withFile((file) => {
    const { book, customer } = setUp(file);
    book.issue(book.draft({ customerId: customer.id }), { now });
    book.saveSettings({ nextNumber: 1 });
    assert.equal(book.settings.nextNumber, 2);
    assert.equal(book.issue(book.draft({ customerId: customer.id }), { now }).number, 'MMM-0002');
  });
});

// -------------------------------------------------------------- immutability

test('an issued invoice keeps its own copy of everything', () => {
  withFile((file) => {
    const { book, customer } = setUp(file);
    const invoice = book.issue(book.draft({ customerId: customer.id }), { now });
    assert.equal(invoice.from.name, "Mark's Music Madness");
    assert.equal(invoice.to.name, 'The Crown');
    assert.equal(invoice.bank.sortCode, '00-00-00');
    assert.equal(invoice.terms.startsWith('Payment within 14 days'), true);

    // Now change absolutely everything it was built from.
    book.saveSettings({
      business: { name: 'Something Else Entirely', address: 'A New Address' },
      bank: { sortCode: '99-99-99' },
      terms: 'Payment on the night.',
    });
    book.saveCustomer({ ...customer, name: 'The Crown (renamed)', address: 'Moved' });

    const kept = book.find(invoice.number);
    assert.equal(kept.from.name, "Mark's Music Madness", 'your old address is what they were sent');
    assert.equal(kept.to.name, 'The Crown');
    assert.equal(kept.bank.sortCode, '00-00-00');
    assert.equal(kept.terms.startsWith('Payment within 14 days'), true);
  });
});

test('registering for VAT does not add a VAT line to old invoices', () => {
  withFile((file) => {
    const { book, customer } = setUp(file);
    const before = book.issue(book.draft({ customerId: customer.id }), { now });
    assert.equal(totals(before).vat, 0);

    book.saveSettings({ vat: { registered: true, number: 'GB123456789', ratePercent: 20 } });
    const after = book.issue(book.draft({ customerId: customer.id }), { now });

    assert.equal(totals(book.find(before.number)).vat, 0, 'the old one is untouched');
    assert.equal(totals(after).vat, 7000, 'and the new one carries VAT');
    // And the document must not mention VAT at all on the non-registered one.
    assert.equal(/vat/i.test(invoicePdf(book.find(before.number)).toString('latin1')), false);
  });
});

test('deleting a customer does not touch the invoices sent to them', () => {
  withFile((file) => {
    const { book, customer } = setUp(file);
    const invoice = book.issue(book.draft({ customerId: customer.id }), { now });
    assert.equal(book.deleteCustomer(customer.id), true);
    assert.equal(book.find(invoice.number).to.name, 'The Crown');
  });
});

// -------------------------------------------------------------------- status

test('an invoice moves sent -> paid, and cancelling keeps the record', () => {
  withFile((file) => {
    const { book, customer } = setUp(file);
    const invoice = book.issue(book.draft({ customerId: customer.id }), { now });
    assert.equal(invoice.status, 'sent');

    book.setStatus(invoice.number, 'paid', { now });
    assert.equal(book.find(invoice.number).status, 'paid');
    assert.equal(book.find(invoice.number).paidAt, new Date(AT).toISOString());

    book.setStatus(invoice.number, 'cancelled', { now });
    assert.equal(book.find(invoice.number).status, 'cancelled');
    assert.equal(book.find(invoice.number).paidAt, null);
    assert.equal(book.invoices.length, 1, 'a cancelled invoice is kept, not deleted');
    assert.throws(() => book.setStatus(invoice.number, 'lost'), /not an invoice status/);
  });
});

test('what you are owed, and what is late', () => {
  withFile((file) => {
    const { book, customer } = setUp(file);
    const old = book.issue(book.draft({ customerId: customer.id }), { now: () => AT - 30 * 86_400_000 });
    book.issue(book.draft({ customerId: customer.id }), { now });
    const paid = book.issue(book.draft({ customerId: customer.id }), { now });
    book.setStatus(paid.number, 'paid', { now });

    const summary = book.summary({ now });
    assert.equal(summary.count, 3);
    assert.equal(summary.outstanding, 70000, 'two at 350, the paid one does not count');
    assert.equal(summary.overdue, 35000);
    assert.equal(summary.overdueCount, 1);
    assert.equal(book.find(old.number).status, 'sent');
  });
});

// --------------------------------------------------------------- the draft

test('a draft fills itself in from the customer and the night', () => {
  withFile((file) => {
    const { book, customer } = setUp(file);
    const draft = book.draft({
      customerId: customer.id,
      event: { title: 'Music quiz night', venue: 'The Crown', date: '2026-08-07' },
    });
    assert.equal(draft.lines.length, 1);
    assert.equal(draft.lines[0].amountPence, 35000, 'their usual fee');
    assert.match(draft.lines[0].description, /Music quiz night — The Crown — Friday 7 August 2026/);
  });
});

test('an invoice with nobody to send it to, or nothing on it, is refused', () => {
  withFile((file) => {
    const { book } = setUp(file);
    assert.throws(() => book.issue({ lines: [{ description: 'Quiz', amountPence: 100 }] }), /somebody to send it to/);
    assert.throws(() => book.issue({ toName: 'A Pub', lines: [] }), /at least one line/);
    assert.equal(book.settings.nextNumber, 1, 'and a refused invoice burns no number');
  });
});

test('the due date comes off the issue date', () => {
  withFile((file) => {
    const { book, customer } = setUp(file);
    const invoice = book.issue(book.draft({ customerId: customer.id }), { now });
    assert.equal(dueDate(invoice, 14), '21/08/2026');
    assert.equal(dueDate(invoice, 30), '06/09/2026');
  });
});

test('an event describes itself the way it would be read out', () => {
  assert.equal(
    describeEvent({ title: 'Music bingo', venue: 'The Crown', date: '2026-08-07' }),
    'Music bingo — The Crown — Friday 7 August 2026',
  );
  assert.equal(describeEvent({}), 'Quiz night');
});

// ----------------------------------------------------------------- the PDF

test('the PDF is a real PDF, one page, with the numbers on it', () => {
  withFile((file) => {
    const { book, customer } = setUp(file);
    const invoice = book.issue(book.draft({
      customerId: customer.id,
      event: { title: 'Music quiz night', venue: 'The Crown', date: '2026-08-07' },
      depositPence: 10000,
    }), { now });

    const pdf = invoicePdf(invoice);
    const text = pdf.toString('latin1');
    assert.equal(text.startsWith('%PDF-1.4'), true);
    assert.equal(text.trimEnd().endsWith('%%EOF'), true);
    assert.equal((text.match(/\/Type \/Page[^s]/g) || []).length, 1, 'one page');
    // The four things that have to be on it.
    assert.ok(text.includes('MMM-0001'), 'the invoice number');
    assert.ok(text.includes('The Crown'), 'who it is for');
    assert.ok(text.includes('250.00'), 'what is actually owed after the deposit');
    assert.ok(text.includes('12345678'), 'and how to pay it');
    assert.ok(pdf.length > 900 && pdf.length < 40_000, `sensible size, got ${pdf.length}`);
  });
});

test('the cross-reference table points at the right bytes, or readers reject it', () => {
  withFile((file) => {
    const { book, customer } = setUp(file);
    const pdf = invoicePdf(book.issue(book.draft({ customerId: customer.id }), { now }));
    const text = pdf.toString('latin1');

    const startxref = Number(text.slice(text.lastIndexOf('startxref') + 9).trim().split('\n')[0]);
    assert.equal(text.slice(startxref, startxref + 4), 'xref', 'startxref must land on the table');

    const offsets = [...text.matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    assert.equal(offsets.length, 7, 'one entry per object');
    offsets.forEach((offset, i) => {
      assert.equal(text.slice(offset, offset + 8).trim().startsWith(`${i + 1} 0 obj`), true,
        `object ${i + 1} is not where the table says it is`);
    });
  });
});

test('a pound sign survives, and so does a pasted smart quote', () => {
  withFile((file) => {
    const { book } = setUp(file);
    const invoice = book.issue({
      toName: 'O’Malley’s — “the Irish one”',
      lines: [{ description: 'Quiz night — 350', amountPence: 35000 }],
    }, { now });
    const text = invoicePdf(invoice).toString('latin1');
    // The pound is 0xA3 in WinAnsi. Get this wrong and every invoice says ?350.
    assert.ok(text.includes('\\243350.00'), 'the pound sign is WinAnsi-escaped');
    assert.ok(text.includes('\\222'), 'and a smart quote becomes its WinAnsi code');
    assert.equal(text.includes('�'), false);
  });
});

test('a description too long for its column is cut, not wrapped off the page', () => {
  const long = 'Music quiz night including travel from Brentwood, a full PA system and prizes for three rounds';
  const cut = fit(long, 200, 10);
  assert.ok(cut.length < long.length);
  assert.ok(cut.endsWith('…'));
  assert.ok(textWidth(cut, 10) <= 200);
  assert.equal(fit('Quiz night', 200, 10), 'Quiz night', 'a short one is left alone');
});

test('the filename is one a finance department can file', () => {
  withFile((file) => {
    const { book, customer } = setUp(file);
    assert.equal(invoiceFilename(book.issue(book.draft({ customerId: customer.id }), { now })), 'MMM-0001-the-crown.pdf');
  });
});

// ---------------------------------------------------------------- the file

test('an unreadable invoice file is kept, never overwritten', () => {
  withFile((file) => {
    fs.writeFileSync(file, '{ this is not json');
    const book = new Invoices(file);
    assert.deepEqual(book.invoices, [], 'starts empty rather than crashing');
    assert.equal(fs.existsSync(file + '.broken'), true, 'and the old one is still there');
  });
});

test('the whole book can be handed over for backing up', () => {
  withFile((file) => {
    const { book, customer } = setUp(file);
    book.issue(book.draft({ customerId: customer.id }), { now });
    const parsed = JSON.parse(book.serialise());
    assert.equal(parsed.invoices.length, 1);
    assert.equal(parsed.settings.nextNumber, 2, 'the counter travels with it, or a restore repeats a number');
  });
});

test('a late-night invoice carries the date the host thinks it is', () => {
  withFile((file) => {
    const { book, customer } = setUp(file);
    // Half past midnight British Summer Time is 23:30 the previous day in UTC,
    // which is what the server's clock says. The invoice has to agree with the
    // person who ran the quiz, not with the server.
    const lateBST = () => Date.parse('2026-08-08T00:30:00+01:00');
    const invoice = book.issue(book.draft({ customerId: customer.id }), { now: lateBST });
    assert.equal(shortDate(invoice.issuedAt), '08/08/2026');
    assert.equal(longDate(invoice.issuedAt), 'Saturday 8 August 2026');
    assert.equal(dueDate(invoice, 14), '22/08/2026');
  });
});

test('money reads the same wherever node was built', () => {
  // No toLocaleString anywhere in the money path, so a small-icu build cannot
  // quietly print 1250.05 where the host expects 1,250.05.
  assert.equal(formatPence(125005), '1,250.05');
  assert.equal(formatPence(100000000), '1,000,000.00');
  assert.equal(formatPence(-125005), '-1,250.05');
  assert.equal(formatPence(99), '0.99');
});

test('a charge with nothing saying what it is for is refused', () => {
  withFile((file) => {
    const { book } = setUp(file);
    assert.throws(
      () => book.issue({ toName: 'The Crown', lines: [{ description: 'Quiz night', amountPence: 35000 }, { description: '', amountPence: 5000 }] }),
      /Line 2 has £50.00 on it but nothing saying what it is for/,
    );
    assert.equal(book.settings.nextNumber, 1, 'and it burns no number');
    // The other way round is fine — a nought line that explains itself.
    const ok = book.issue({ toName: 'The Crown', lines: [
      { description: 'Quiz night', amountPence: 35000 },
      { description: 'Prizes — included', amountPence: 0 },
    ] }, { now });
    assert.equal(ok.lines.length, 2);
    assert.equal(totals(ok).due, 35000);
  });
});

test('nothing on the page overlaps anything else on it', () => {
  withFile((file) => {
    const { book } = setUp(file);
    // The longest realistic values, which is where a layout gives way.
    book.saveSettings({ vat: { registered: true, number: 'GB123456789', ratePercent: 20 } });
    const invoice = book.issue({
      toName: 'A Rather Long Corporate Customer Name Ltd',
      lines: [{ description: 'Music quiz night', amountPence: 125000 }],
      depositPence: 25000,
    }, { now });

    // Pull every "put this text here" out of the content stream and check that
    // no two on the same line have run into each other.
    const stream = invoicePdf(invoice).toString('latin1');
    const placed = [...stream.matchAll(/\/(F\d) ([\d.]+) Tf\n([\d.]+) ([\d.]+) Td\n\((.*?)\) Tj/g)]
      .map((m) => ({ bold: m[1] === 'F2', size: Number(m[2]), x: Number(m[3]), y: Number(m[4]), text: m[5] }));
    assert.ok(placed.length > 15, `expected a full page of text, got ${placed.length}`);

    const byLine = new Map();
    for (const item of placed) {
      const key = item.y.toFixed(0);
      byLine.set(key, [...(byLine.get(key) || []), item]);
    }
    for (const [y, items] of byLine) {
      const sorted = items.sort((a, b) => a.x - b.x);
      for (let i = 1; i < sorted.length; i++) {
        const end = sorted[i - 1].x + textWidth(sorted[i - 1].text, sorted[i - 1].size, sorted[i - 1].bold);
        assert.ok(sorted[i].x >= end,
          `"${sorted[i - 1].text}" runs into "${sorted[i].text}" on the line at y=${y}`);
      }
    }
    // And nothing has fallen off the bottom of the sheet.
    for (const item of placed) assert.ok(item.y > 40, `"${item.text}" is off the page`);
  });
});


/*
 * Surviving a deploy.
 *
 * The invoice book lives in `data/`, which a host with no permanent disk empties
 * on every deploy. It was backed up to the private repo and never read back,
 * which is the same as not backing it up: a year of invoices gone, and the first
 * you know is a customer asking for a copy.
 *
 * The care this needs, and the reason it was not done alongside the accounts, is
 * INVOICE NUMBERS. They are sequential and never reused.
 */
test('a wiped disk gets the invoice book back', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'invoices-restore-'));
  try {
    const file = path.join(dir, 'invoicing.json');
    const book = new Invoices(file);
    book.saveSettings({ business: { name: 'Mark\u2019s Music Madness' } });
    const customer = book.saveCustomer({ name: 'The Red Lion', feePence: 15000 });
    book.issue(book.draft({ customerId: customer.id }), { now: () => Date.parse('2026-03-01T20:00:00Z') });
    const backup = book.serialise();

    fs.rmSync(file);                        // the deploy
    const fresh = new Invoices(file);
    assert.equal(fresh.invoices.length, 0);

    const result = fresh.restore(backup);
    assert.equal(result.ok, true);
    assert.equal(fresh.invoices.length, 1);
    assert.equal(fresh.customers.length, 1);
    assert.equal(fresh.settings.business.name, 'Mark\u2019s Music Madness');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('A STALE BACKUP CAN NEVER REISSUE A NUMBER', () => {
  // The one that decides the whole design. A backup taken a few minutes before
  // the last invoice went out will claim a counter that is already spent. If
  // that were believed, two different customers would hold an invoice with the
  // same number on it — which is the one mistake here that an accountant asks
  // about.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'invoices-restore-'));
  try {
    const file = path.join(dir, 'invoicing.json');
    const book = new Invoices(file);
    const customer = book.saveCustomer({ name: 'The Red Lion', feePence: 15000 });
    const first = book.issue(book.draft({ customerId: customer.id }), { now: () => 1 });
    const second = book.issue(book.draft({ customerId: customer.id }), { now: () => 2 });

    // A backup that has the invoices but an out-of-date counter, exactly as a
    // half-written or slightly old file would.
    const stale = JSON.parse(book.serialise());
    stale.settings.nextNumber = 1;

    fs.rmSync(file);
    const fresh = new Invoices(file);
    fresh.restore(JSON.stringify(stale));

    const third = fresh.issue(fresh.draft({ customerId: fresh.customers[0].id }), { now: () => 3 });
    assert.notEqual(third.number, first.number);
    assert.notEqual(third.number, second.number);
    // And it carried on from the highest one actually issued.
    assert.equal(third.number, second.number.replace(/(\d+)$/, (n) => String(Number(n) + 1).padStart(n.length, '0')));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a book that is already in use is never restored over', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'invoices-restore-'));
  try {
    const book = new Invoices(path.join(dir, 'invoicing.json'));
    book.saveCustomer({ name: 'The Red Lion', feePence: 15000 });
    const result = book.restore(JSON.stringify({ invoices: [], customers: [{ id: 'x', name: 'Somebody else' }] }));
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'already_in_use');
    assert.equal(book.customers[0].name, 'The Red Lion');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a corrupt backup is refused rather than believed', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'invoices-restore-'));
  try {
    const book = new Invoices(path.join(dir, 'invoicing.json'));
    assert.equal(book.restore('not json').ok, false);
    assert.equal(book.restore('null').ok, false);
    assert.equal(book.invoices.length, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/*
 * THE CHEAPEST DIARY: which night a venue has you.
 *
 * Asked for as "the quick launch should remember what you did the previous
 * week", then better — "or perhaps know which venue from the diary?". The
 * diary is not built; the useful half of one is a usual night on the venue
 * record, which is what TODO.md had already reasoned to.
 */
test('a venue remembers which night it has you, and only a real weekday', () => {
  withFile((file) => {
    const book = new Invoices(file, { now });
    const v = book.saveCustomer({ name: 'The Station Tap', usualNight: 'thu' });
    assert.equal(v.usualNight, 'thu');
    assert.equal(book.saveCustomer({ name: 'The Crown' }).usualNight, '',
      'a venue with no usual night must not claim one');
    assert.equal(book.saveCustomer({ name: 'Nonsense', usualNight: 'Thursday' }).usualNight, '',
      'only the ids in WEEKDAYS are kept — a near miss must not be stored');
    assert.equal(book.saveCustomer({ name: 'Number', usualNight: 4 }).usualNight, '',
      'a weekday NUMBER is refused: 0 is Sunday in JS and Monday in a diary');
    assert.deepEqual(WEEKDAYS, ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
  });
});

/*
 * THE WHOLE REASON THIS IS ITS OWN METHOD. `saveCustomer` writes the record
 * every time, so the Venues tab — which knows nothing about addresses or fees
 * — would blank them on every save. And the two fields it DOES own must not
 * clear each other either.
 */
test('setting a venue’s prizes cannot blank its address, fee or usual night', () => {
  withFile((file) => {
    const book = new Invoices(file, { now });
    const v = book.saveCustomer({
      name: 'The Station Tap', address: '1 Station Road', email: 'a@b.example',
      usualFee: '350', usualNight: 'thu',
    });

    book.setVenueDetails(v.id, { rewards: ['A free drink at the bar'] });
    const after = book.customers.find((c) => c.id === v.id);
    assert.deepEqual(after.rewards, ['A free drink at the bar']);
    assert.equal(after.address, '1 Station Road', 'the address was blanked');
    assert.equal(after.usualFeePence, 35000, 'the usual fee was blanked');
    assert.equal(after.usualNight, 'thu', 'saving prizes cleared the usual night');

    // …and the other way round.
    book.setVenueDetails(v.id, { usualNight: 'fri' });
    const later = book.customers.find((c) => c.id === v.id);
    assert.equal(later.usualNight, 'fri');
    assert.deepEqual(later.rewards, ['A free drink at the bar'],
      'changing the usual night wiped the prizes');
  });
});

test('a usual night survives being written and read back', () => {
  withFile((file) => {
    const book = new Invoices(file, { now });
    const v = book.saveCustomer({ name: 'The Station Tap', usualNight: 'thu' });
    const reopened = new Invoices(file, { now });
    assert.equal(reopened.customers.find((c) => c.id === v.id).usualNight, 'thu');
  });
});

/* A venue written before usual nights existed is not suddenly on a Monday. */
test('a venue saved before usual nights existed has none', () => {
  withFile((file) => {
    fs.writeFileSync(file, JSON.stringify({
      settings: {}, invoices: [], customers: [{ id: 'old', name: 'The Old Bell' }],
    }));
    const book = new Invoices(file, { now });
    const old = book.customers.find((c) => c.id === 'old');
    assert.ok(!old.usualNight, 'an old record grew a night nobody set');
  });
});

// ------------------------------------------------------------------ diary

/*
 * THE DIARY LIVES IN THIS BOOK, and it is a list of DATES pointing at the
 * venues already in here rather than a second list of venues — which is the
 * thing TODO.md warns hardest against. Same file because it is already the
 * quizmaster's business record, already per room, and already backed up.
 */
test('a booking is one entry per venue per date, replaced rather than stacked', () => {
  withFile((file) => {
    const book = new Invoices(file, { now });
    book.setBooking({ date: '2026-08-18', venue: 'The Dog and Duck', note: 'Corporate' });
    book.setBooking({ date: '2026-08-18', venue: 'The Dog and Duck', note: '40 in' });
    assert.equal(book.bookings.length, 1, 'pressing the button twice left two contradictory rows');
    assert.equal(book.bookings[0].note, '40 in');

    // A different venue on the same night is a different booking — December.
    book.setBooking({ date: '2026-08-18', venue: 'The Crown' });
    assert.equal(book.bookings.length, 2);
  });
});

test('cancelling then rebooking the same night just overwrites it', () => {
  withFile((file) => {
    const book = new Invoices(file, { now });
    book.setBooking({ date: '2026-08-20', venue: 'The Station Tap', off: true });
    assert.equal(book.bookings[0].off, true);
    book.setBooking({ date: '2026-08-20', venue: 'The Station Tap' });
    assert.equal(book.bookings.length, 1, 'changing your mind left the cancellation behind');
    assert.equal(book.bookings[0].off, false);
  });
});

test('a booking needs a real date and a venue', () => {
  withFile((file) => {
    const book = new Invoices(file, { now });
    assert.throws(() => book.setBooking({ venue: 'The Crown' }), /needs a date/);
    assert.throws(() => book.setBooking({ date: 'next thursday', venue: 'The Crown' }), /needs a date/);
    assert.throws(() => book.setBooking({ date: '2026-08-18' }), /needs a venue/);
    assert.equal(book.bookings.length, 0);
  });
});

test('the diary survives being written and read back', () => {
  withFile((file) => {
    const book = new Invoices(file, { now });
    book.setBooking({ date: '2026-08-18', venue: 'The Dog and Duck', note: 'Corporate' });
    const reopened = new Invoices(file, { now });
    assert.equal(reopened.bookings.length, 1);
    assert.equal(reopened.bookings[0].venue, 'The Dog and Duck');
  });
});

/* Removing is not the same as cancelling: it puts a residency back to normal. */
test('removing a booking forgets it entirely', () => {
  withFile((file) => {
    const book = new Invoices(file, { now });
    const entry = book.setBooking({ date: '2026-08-20', venue: 'The Station Tap', off: true });
    assert.equal(book.removeBooking(entry.id), true);
    assert.equal(book.bookings.length, 0);
    assert.equal(book.removeBooking('nonsense'), false);
  });
});

/* A book written before diaries existed reads as an empty one, not a crash. */
test('a book saved before the diary existed has no bookings', () => {
  withFile((file) => {
    fs.writeFileSync(file, JSON.stringify({ settings: {}, invoices: [], customers: [] }));
    const book = new Invoices(file, { now });
    assert.deepEqual(book.bookings, []);
    book.setBooking({ date: '2026-08-18', venue: 'The Crown' });
    assert.equal(book.bookings.length, 1);
  });
});

/* The backup carries it, or a deploy quietly empties somebody's diary. */
test('the diary comes back from a backup', () => {
  withFile((file) => {
    const book = new Invoices(file, { now });
    book.setBooking({ date: '2026-08-18', venue: 'The Dog and Duck', note: 'Corporate' });
    const serialised = book.serialise ? book.serialise() : fs.readFileSync(file, 'utf8');

    withFile((second) => {
      const fresh = new Invoices(second, { now });
      const res = fresh.restore(serialised);
      assert.equal(res.ok, true);
      assert.equal(fresh.bookings.length, 1, 'the diary was dropped on restore');
      assert.equal(fresh.bookings[0].venue, 'The Dog and Duck');
    });
  });
});
