/**
 * Getting paid.
 *
 * The night ends, the room empties, and the thing most likely not to happen is
 * the invoice — because by then it is half eleven and everything is in the car.
 * So the app writes it while the final scores are still on the projector, and
 * sending it is one tap.
 *
 * Three rules shape everything in here, and all three are about not being
 * embarrassed in front of somebody who is about to pay you:
 *
 *  1. MONEY IS INTEGER PENCE, NEVER A FLOAT. 0.1 + 0.2 is not 0.3, and an
 *     invoice that adds up to £349.99999 is an invoice you have to apologise
 *     for. Pounds exist only where a human types or reads a number.
 *
 *  2. AN ISSUED INVOICE NEVER CHANGES. It carries its own copy of your details,
 *     the customer's details and every line — so correcting your address next
 *     month does not silently rewrite what somebody was sent in August. Only
 *     its status moves after it is issued. Getting this wrong is the difference
 *     between a record and a rumour.
 *
 *  3. NUMBERS ARE SEQUENTIAL AND NEVER REUSED. A number is handed out when an
 *     invoice is ISSUED, not when a draft is started, so abandoning a draft
 *     does not leave a hole HMRC would ask about.
 *
 * VAT is off by default and the wording is deliberate: an invoice from someone
 * who is not registered must not mention VAT at all, because charging it — or
 * looking like you are — when you are not registered is an offence. The fields
 * are all here behind `settings.vat.registered` for the day that changes.
 */

import fs from 'node:fs';
import path from 'node:path';

export const STATUSES = ['draft', 'sent', 'paid', 'cancelled'];

/** What a fresh install looks like, so the console has something to show. */
export function blankSettings() {
  return {
    // Yours. Printed at the top of every invoice.
    business: { name: '', contact: '', address: '', email: '', phone: '' },
    // How they pay you, printed at the bottom.
    bank: { name: '', sortCode: '', accountNumber: '', reference: '' },
    // Not registered until you say so, and the invoice says nothing about VAT
    // until you do. See the note at the top of this file.
    vat: { registered: false, number: '', ratePercent: 20 },
    terms: 'Payment within 14 days of the date of this invoice.',
    // "MMM-0007". Kept separate from the counter so renaming the prefix later
    // cannot renumber anything already issued.
    prefix: 'INV',
    nextNumber: 1,
  };
}

function blankFile() {
  return { settings: blankSettings(), customers: [], invoices: [] };
}

// ------------------------------------------------------------------- money

/**
 * "350", "350.00", "£350", "1,250.50" -> pence. Anything else -> null.
 *
 * Deliberately strict about the pence: "350.5" is £350.50 and "350.567" is a
 * typo, not something to round silently.
 */
export function toPence(input) {
  if (typeof input === 'number' && Number.isFinite(input)) return Math.round(input * 100);
  const cleaned = String(input ?? '').trim().replace(/[£,\s]/g, '');
  if (!cleaned) return null;
  if (!/^-?\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const negative = cleaned.startsWith('-');
  const [pounds, pence = ''] = cleaned.replace('-', '').split('.');
  const total = Number(pounds) * 100 + Number(pence.padEnd(2, '0'));
  return negative ? -total : total;
}

/**
 * Pence -> "1,250.50". No symbol: the caller decides where the £ goes.
 *
 * The grouping is done by hand rather than with `toLocaleString`, because that
 * depends on which ICU build node was compiled with — and an invoice that reads
 * differently on the host's Mac from the way it reads on the server is exactly
 * the sort of thing nobody notices until a customer queries it.
 */
export function formatPence(pence) {
  const n = Math.round(Number(pence) || 0);
  const abs = Math.abs(n);
  const pounds = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${n < 0 ? '-' : ''}${pounds}.${String(abs % 100).padStart(2, '0')}`;
}

export function money(pence) {
  return `£${formatPence(pence)}`;
}

// -------------------------------------------------------------------- sums

/**
 * What an invoice adds up to.
 *
 * Worked out from the lines every time rather than stored, so a total can never
 * drift away from the lines above it — the one error on an invoice that makes
 * the customer distrust all the others.
 *
 * VAT is added to the net, and the deposit comes off the gross, because a
 * deposit is money already handed over including whatever tax was on it.
 */
export function totals(invoice) {
  const lines = invoice.lines || [];
  const net = lines.reduce((sum, l) => sum + (Math.round(Number(l.amountPence)) || 0), 0);
  const vatRate = invoice.vat && invoice.vat.registered ? Number(invoice.vat.ratePercent) || 0 : 0;
  // Rounded once, on the total, rather than per line — pennies otherwise go
  // missing between the lines and the sum.
  const vat = Math.round((net * vatRate) / 100);
  const gross = net + vat;
  const deposit = Math.round(Number(invoice.depositPence)) || 0;
  return { net, vatRate, vat, gross, deposit, due: gross - deposit };
}

// ------------------------------------------------------------------ storage

export class Invoices {
  constructor(filePath) {
    this.filePath = filePath;
    this.tmpPath = filePath + '.tmp';
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    this.data = this.load();
  }

  load() {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      return {
        settings: { ...blankSettings(), ...(parsed.settings || {}) },
        customers: Array.isArray(parsed.customers) ? parsed.customers : [],
        invoices: Array.isArray(parsed.invoices) ? parsed.invoices : [],
      };
    } catch (err) {
      if (err.code !== 'ENOENT') {
        // Never overwrite something unreadable — it may be the only copy of a
        // year of invoices, and a parse error is not permission to bin it.
        console.error('[invoices] could not read the invoice file:', err.message);
        try { fs.renameSync(this.filePath, this.filePath + '.broken'); } catch { /* nothing useful */ }
      }
      return blankFile();
    }
  }

  /** Atomic, and immediate — an invoice is not something to debounce. */
  save() {
    fs.writeFileSync(this.tmpPath, JSON.stringify(this.data, null, 2) + '\n', 'utf8');
    fs.renameSync(this.tmpPath, this.filePath);
    return true;
  }

  /** The whole file, for backing up somewhere permanent. */
  serialise() {
    return JSON.stringify(this.data, null, 2) + '\n';
  }

  /**
   * Nothing has been done in this book yet.
   *
   * Used to decide whether a backup may be read in. Deliberately strict: a
   * single customer typed in counts as "in use", because restoring over it
   * would throw that away and the person who typed it would have no idea.
   */
  isEmpty() {
    return this.data.invoices.length === 0 && this.data.customers.length === 0;
  }

  /**
   * Read a backed-up invoice book back in.
   *
   * The same rules as the accounts: only ever into an EMPTY book, only at boot,
   * and a corrupt backup is refused rather than believed. On a host with no
   * permanent disk this is what stops a deploy taking a year of invoices with
   * it.
   *
   * **The counter is rebuilt from the invoices themselves, never trusted from
   * the file.** Invoice numbers are sequential and never reused, and a backup
   * can easily be a few minutes stale — written before the last invoice was
   * issued. Believing its `nextNumber` would hand out a number that is already
   * on somebody's invoice, which is the one mistake in this whole area that a
   * customer notices and an accountant asks about. So the counter comes out at
   * one past the highest number actually present, or the file's own value,
   * whichever is HIGHER. It can only ever move forwards.
   */
  restore(serialised) {
    if (!this.isEmpty()) return { ok: false, reason: 'already_in_use' };
    let parsed;
    try {
      parsed = JSON.parse(String(serialised));
    } catch (err) {
      return { ok: false, reason: 'unreadable', error: err.message };
    }
    if (!parsed || typeof parsed !== 'object') return { ok: false, reason: 'unreadable' };

    const invoices = Array.isArray(parsed.invoices) ? parsed.invoices : [];
    const customers = Array.isArray(parsed.customers) ? parsed.customers : [];
    const settings = { ...blankSettings(), ...(parsed.settings || {}) };

    // A number is `PREFIX-0007`; the digits on the end are what counts, and the
    // prefix may well have been changed since. Anything unparseable is ignored
    // rather than guessed at.
    let highest = 0;
    for (const invoice of invoices) {
      const digits = /(\d+)\s*$/.exec(String(invoice && invoice.number ? invoice.number : ''));
      if (digits) highest = Math.max(highest, Number(digits[1]));
    }
    const claimed = Number(settings.nextNumber);
    settings.nextNumber = Math.max(
      Number.isFinite(claimed) && claimed > 0 ? claimed : 1,
      highest + 1,
    );

    this.data = { settings, customers, invoices };
    this.save();
    return { ok: true, invoices: invoices.length, customers: customers.length, nextNumber: settings.nextNumber };
  }

  get settings() {
    return this.data.settings;
  }

  saveSettings(patch = {}) {
    const s = this.data.settings;
    this.data.settings = {
      ...s,
      ...patch,
      business: { ...s.business, ...(patch.business || {}) },
      bank: { ...s.bank, ...(patch.bank || {}) },
      vat: { ...s.vat, ...(patch.vat || {}) },
      // The counter is not editable from outside: moving it backwards would
      // hand out a number that has already been used.
      nextNumber: s.nextNumber,
    };
    this.save();
    return this.data.settings;
  }

  // -------------------------------------------------------------- customers

  get customers() {
    return this.data.customers;
  }

  saveCustomer(customer) {
    const clean = {
      id: customer.id || newId(),
      name: String(customer.name || '').trim(),
      contact: String(customer.contact || '').trim(),
      address: String(customer.address || '').trim(),
      email: String(customer.email || '').trim(),
      // What you normally charge them, so the next invoice fills itself in.
      usualFeePence: toPence(customer.usualFee ?? customer.usualFeePence) ?? null,
    };
    if (!clean.name) throw new Error('A customer needs a name.');
    const at = this.data.customers.findIndex((c) => c.id === clean.id);
    if (at >= 0) this.data.customers[at] = clean;
    else this.data.customers.push(clean);
    this.save();
    return clean;
  }

  deleteCustomer(id) {
    const before = this.data.customers.length;
    this.data.customers = this.data.customers.filter((c) => c.id !== id);
    // Invoices keep their own copy of the customer, so this cannot orphan one.
    if (this.data.customers.length !== before) this.save();
    return this.data.customers.length !== before;
  }

  // --------------------------------------------------------------- invoices

  get invoices() {
    return this.data.invoices;
  }

  find(number) {
    return this.data.invoices.find((i) => i.number === number) || null;
  }

  /**
   * What the next invoice would look like, without creating anything.
   *
   * Used to fill the form in from a night that has just finished, so the host
   * confirms rather than types.
   */
  draft({ customerId = '', event = {}, lines = [], depositPence = 0, notes = '' } = {}) {
    const customer = this.data.customers.find((c) => c.id === customerId) || null;
    const fee = customer && customer.usualFeePence != null ? customer.usualFeePence : 0;
    return {
      customerId,
      event: {
        title: String(event.title || ''),
        venue: String(event.venue || ''),
        date: String(event.date || ''),
        nightId: String(event.nightId || ''),
      },
      lines: lines.length ? lines : [{ description: describeEvent(event), amountPence: fee }],
      depositPence,
      notes,
    };
  }

  /**
   * Issue it. This is the only place a number is handed out.
   *
   * Everything is copied onto the invoice as it is now — your address, their
   * address, the VAT position, the terms, the bank details. Change any of them
   * tomorrow and this invoice still says what it said when it was sent.
   */
  issue(draft, { now = () => Date.now() } = {}) {
    const s = this.data.settings;
    const customer = this.data.customers.find((c) => c.id === draft.customerId) || null;
    const to = customer
      ? { name: customer.name, contact: customer.contact, address: customer.address, email: customer.email }
      : {
          name: String(draft.toName || '').trim(),
          contact: String(draft.toContact || '').trim(),
          address: String(draft.toAddress || '').trim(),
          email: String(draft.toEmail || '').trim(),
        };
    if (!to.name) throw new Error('An invoice needs somebody to send it to.');

    const lines = (draft.lines || [])
      .map((l) => ({
        description: String(l.description || '').trim(),
        amountPence: Math.round(Number(l.amountPence)) || 0,
      }))
      .filter((l) => l.description || l.amountPence);
    if (!lines.length) throw new Error('An invoice needs at least one line on it.');
    // A charge with nothing next to it is the one line on an invoice that gets
    // it queried, so it is refused rather than sent. The other way round is
    // fine: "Prizes — included" at nought is a real line.
    const blank = lines.findIndex((l) => l.amountPence && !l.description);
    if (blank >= 0) throw new Error(`Line ${blank + 1} has ${money(lines[blank].amountPence)} on it but nothing saying what it is for.`);

    const number = `${s.prefix}-${String(s.nextNumber).padStart(4, '0')}`;
    const invoice = {
      number,
      issuedAt: new Date(now()).toISOString(),
      status: 'sent',
      sentAt: null,
      paidAt: null,
      from: {
        name: s.business.name,
        contact: s.business.contact,
        address: s.business.address,
        email: s.business.email,
        phone: s.business.phone,
      },
      bank: { ...s.bank },
      // Copied, not referenced. An invoice issued while you were not registered
      // must never grow a VAT line because you registered in November.
      vat: { ...s.vat },
      terms: s.terms,
      to,
      event: { ...draft.event },
      lines,
      depositPence: Math.round(Number(draft.depositPence)) || 0,
      notes: String(draft.notes || '').trim(),
    };

    this.data.settings.nextNumber = s.nextNumber + 1;
    this.data.invoices.unshift(invoice);
    this.save();
    return invoice;
  }

  /**
   * Move an invoice along. Status only — everything else is fixed at issue.
   *
   * Cancelling keeps the number and the record rather than deleting it. A
   * missing number in a sequence is a question you have to answer later; a
   * cancelled one answers itself.
   */
  setStatus(number, status, { now = () => Date.now() } = {}) {
    if (!STATUSES.includes(status)) throw new Error(`"${status}" is not an invoice status.`);
    const invoice = this.find(number);
    if (!invoice) return null;
    invoice.status = status;
    if (status === 'sent' && !invoice.sentAt) invoice.sentAt = new Date(now()).toISOString();
    if (status === 'paid') invoice.paidAt = new Date(now()).toISOString();
    else if (status !== 'sent') invoice.paidAt = null;
    this.save();
    return invoice;
  }

  /**
   * What you are owed, and what is overdue — the two numbers worth seeing
   * without opening anything.
   */
  summary({ now = () => Date.now(), termDays = 14 } = {}) {
    const cutoff = now() - termDays * 86_400_000;
    let outstanding = 0;
    let overdue = 0;
    let overdueCount = 0;
    let unpaidCount = 0;
    for (const invoice of this.data.invoices) {
      if (invoice.status !== 'sent') continue;
      const due = totals(invoice).due;
      outstanding += due;
      unpaidCount++;
      if (Date.parse(invoice.issuedAt) < cutoff) {
        overdue += due;
        overdueCount++;
      }
    }
    return { outstanding, overdue, overdueCount, unpaidCount, count: this.data.invoices.length };
  }
}

/** "Music quiz night — The Crown, Thursday 7 August 2026" */
export function describeEvent(event = {}) {
  const bits = [event.title || 'Quiz night'];
  if (event.venue) bits.push(event.venue);
  if (event.date) bits.push(longDate(event.date));
  return bits.filter(Boolean).join(' — ');
}

/**
 * Dates are always read in London, and always written out the same way.
 *
 * Both halves of that matter. The server runs in UTC and the host does not, so
 * a quiz that finishes at half past midnight in August would otherwise be
 * invoiced with yesterday's date — and the pieces are assembled by hand rather
 * than taken from `toLocaleDateString` so the punctuation cannot change under
 * us when node is built against a different ICU.
 */
const LONDON = { timeZone: 'Europe/London' };

function parts(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const out = {};
  for (const p of new Intl.DateTimeFormat('en-GB', {
    ...LONDON, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).formatToParts(d)) out[p.type] = p.value;
  for (const p of new Intl.DateTimeFormat('en-GB', {
    ...LONDON, day: '2-digit', month: '2-digit', year: 'numeric',
  }).formatToParts(d)) {
    if (p.type === 'day') out.day2 = p.value;
    if (p.type === 'month') out.month2 = p.value;
  }
  return out;
}

/** "Friday 7 August 2026" — no comma, because it sits inside a dashed line. */
export function longDate(value) {
  const p = parts(value);
  if (!p) return String(value || '');
  return `${p.weekday} ${p.day} ${p.month} ${p.year}`;
}

/** "07/08/2026" */
export function shortDate(value) {
  const p = parts(value);
  if (!p) return String(value || '');
  return `${p.day2}/${p.month2}/${p.year}`;
}

/** When it should be paid by, from the terms. */
export function dueDate(invoice, termDays = 14) {
  const issued = Date.parse(invoice.issuedAt);
  if (Number.isNaN(issued)) return '';
  return shortDate(new Date(issued + termDays * 86_400_000));
}

function newId() {
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
