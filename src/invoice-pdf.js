/**
 * What an invoice looks like on paper.
 *
 * Kept apart from `src/invoices.js` (what an invoice IS) and `src/pdf.js` (how
 * to put text on a page) so that changing the look never risks changing the
 * arithmetic, which is the only part a customer will argue about.
 *
 * Plain and legible on purpose. This goes to a finance department, and the
 * thing that gets an invoice paid quickly is the amount and the bank details
 * being impossible to miss — not a nice header.
 */

import { Page, renderPdf, fit, PAGE } from './pdf.js';
import { totals, money, shortDate, dueDate, describeEvent } from './invoices.js';

const LEFT = 56;
const RIGHT = PAGE.width - 56;
const INK = [0.06, 0.06, 0.1];
const DIM = [0.42, 0.42, 0.5];

export function invoicePdf(invoice, { termDays = 14 } = {}) {
  const sum = totals(invoice);
  const page = new Page();

  // ---- your name, and the word INVOICE, which is what gets it to the right desk
  page.text(invoice.from.name || 'Invoice', LEFT, 74, { size: 20, bold: true, rgb: INK });
  page.text('INVOICE', RIGHT, 74, { size: 20, bold: true, align: 'right', rgb: DIM });

  let y = 96;
  y = page.lines(
    [invoice.from.contact, ...String(invoice.from.address || '').split('\n'), invoice.from.email, invoice.from.phone].filter(Boolean),
    LEFT, y, { size: 9, rgb: DIM },
  );

  // The number and the dates, right-aligned against the word INVOICE.
  let ry = 96;
  const meta = [
    ['Invoice number', invoice.number],
    ['Date', shortDate(invoice.issuedAt)],
    ['Payment due', dueDate(invoice, termDays)],
  ];
  // Registered or not, this is the line that decides whether the document is a
  // VAT invoice. It appears only when it is true — see the note in invoices.js.
  if (invoice.vat && invoice.vat.registered && invoice.vat.number) {
    meta.push(['VAT number', invoice.vat.number]);
  }
  // The label starts well left of the value rather than being right-aligned
  // against it: "Invoice number" is a wide label and the two ran together.
  for (const [label, value] of meta) {
    page.text(label, RIGHT - 190, ry, { size: 9, rgb: DIM });
    page.text(value, RIGHT, ry, { size: 9, bold: true, align: 'right', rgb: INK });
    ry += 14;
  }

  y = Math.max(y, ry) + 16;
  page.rule(LEFT, y, RIGHT);
  y += 22;

  // ---- who it is for
  page.text('Invoice to', LEFT, y, { size: 8, bold: true, rgb: DIM });
  y += 14;
  y = page.lines(
    [invoice.to.name, invoice.to.contact, ...String(invoice.to.address || '').split('\n')].filter(Boolean),
    LEFT, y, { size: 10, rgb: INK },
  );
  if (invoice.event && (invoice.event.venue || invoice.event.date)) {
    page.text(describeEvent(invoice.event), RIGHT, y - 14, { size: 9, align: 'right', rgb: DIM });
  }

  y += 16;

  // ---- the lines
  const AMOUNT_COL = RIGHT;
  page.box(LEFT - 8, y - 12, RIGHT - LEFT + 16, 22);
  page.text('Description', LEFT, y, { size: 8, bold: true, rgb: DIM });
  page.text('Amount', AMOUNT_COL, y, { size: 8, bold: true, align: 'right', rgb: DIM });
  y += 22;

  for (const line of invoice.lines) {
    page.text(fit(line.description, RIGHT - LEFT - 90, 10), LEFT, y, { size: 10, rgb: INK });
    page.text(money(line.amountPence), AMOUNT_COL, y, { size: 10, align: 'right', rgb: INK });
    y += 18;
  }

  y += 4;
  page.rule(LEFT + 240, y, RIGHT);
  y += 18;

  // ---- what it adds up to
  const row = (label, value, { bold = false, size = 10 } = {}) => {
    page.text(label, AMOUNT_COL - 110, y, { size, bold, align: 'right', rgb: bold ? INK : DIM });
    page.text(value, AMOUNT_COL, y, { size, bold, align: 'right', rgb: INK });
    y += size * 1.7;
  };

  // Only shown when there is something else to show. On a plain, non-VAT
  // invoice with no deposit, one number is clearer than three.
  const showBreakdown = sum.vat > 0 || sum.deposit !== 0;
  if (showBreakdown) {
    row(sum.vat > 0 ? 'Subtotal' : 'Total', money(sum.net));
    if (sum.vat > 0) {
      row(`VAT at ${sum.vatRate}%`, money(sum.vat));
      row('Total', money(sum.gross));
    }
    if (sum.deposit !== 0) row('Deposit received', `-${money(sum.deposit)}`);
  }

  y += 4;
  page.box(AMOUNT_COL - 200, y - 14, 200, 30, { rgb: [0.94, 0.95, 1] });
  row('Amount due', money(sum.due), { bold: true, size: 13 });

  y += 22;

  // ---- how to pay, which is the other half of getting paid
  const bank = invoice.bank || {};
  const payTo = [
    bank.name ? `Account name: ${bank.name}` : '',
    bank.sortCode ? `Sort code: ${bank.sortCode}` : '',
    bank.accountNumber ? `Account number: ${bank.accountNumber}` : '',
    // Their own reference beats yours: it is what appears on your statement.
    `Payment reference: ${bank.reference || invoice.number}`,
  ].filter(Boolean);

  if (payTo.length > 1) {
    page.rule(LEFT, y, RIGHT);
    y += 20;
    page.text('How to pay', LEFT, y, { size: 8, bold: true, rgb: DIM });
    y += 14;
    y = page.lines(payTo, LEFT, y, { size: 9.5, rgb: INK });
    y += 6;
  }

  if (invoice.terms) {
    y = page.lines(String(invoice.terms).split('\n'), LEFT, y, { size: 9, rgb: DIM });
  }
  if (invoice.notes) {
    y += 8;
    y = page.lines(String(invoice.notes).split('\n'), LEFT, y, { size: 9, rgb: DIM });
  }

  return renderPdf(page, { title: `Invoice ${invoice.number}` });
}

/** A filename a finance department can file without renaming it. */
export function invoiceFilename(invoice) {
  const who = String(invoice.to.name || 'customer')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  return `${invoice.number}-${who || 'customer'}.pdf`;
}
