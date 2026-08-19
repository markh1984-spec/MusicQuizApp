/**
 * THE MONEY EMAILS — a receipt when a payment lands, a notice when one does
 * not. Both come from Quizporium, decided 19 August 2026, because the app
 * took the money — unlike an invoice, which is the quizmaster's own.
 *
 * `resetEmail()` has its own tests in test/reset.test.js, alongside the
 * sending machinery it exercises. These two are pure templates with nothing
 * to send yet — see test/billing.test.js for how an applied billing event
 * turns into one of them.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { receiptEmail, cardFailedEmail } from '../src/email.js';

test('a receipt never says undefined, whatever it is handed', () => {
  for (const label of [undefined, null, '', 'Silver']) {
    const mail = receiptEmail({ label, pence: 2000 });
    assert.ok(!/undefined|null|\[object/.test(mail.subject), `subject: ${mail.subject}`);
    assert.ok(!/undefined|null|\[object/.test(mail.text), `body: ${mail.text}`);
  }
});

test('a receipt names the tier and the amount', () => {
  const mail = receiptEmail({ label: 'Silver', pence: 2000 });
  assert.equal(mail.subject, 'Payment received — Silver');
  assert.match(mail.text, /£20\.00/);
});

test('a receipt with no amount still reads as a sentence', () => {
  const mail = receiptEmail({ label: 'Silver' });
  assert.equal(/£/.test(mail.text), false);
  assert.match(mail.text, /the payment for Silver went through\./);
});

test('with nothing to go on, a receipt falls back to "your subscription"', () => {
  const mail = receiptEmail({});
  assert.equal(mail.subject, 'Payment received — your subscription');
});

test('a card-failed notice never says undefined either', () => {
  for (const label of [undefined, null, '']) {
    const mail = cardFailedEmail({ label });
    assert.ok(!/undefined|null|\[object/.test(mail.subject), `subject: ${mail.subject}`);
    assert.ok(!/undefined|null|\[object/.test(mail.text), `body: ${mail.text}`);
  }
});

/*
 * THE ONE THING THIS EMAIL MUST NEVER SAY: that a night is at risk.
 * `applyBilling()` moves the status and never the tier on a failed payment —
 * a booked or running quiz is untouched — so the words must not frighten
 * somebody about a game that was never in danger.
 */
test('a card-failed notice reassures rather than threatens', () => {
  const mail = cardFailedEmail({ label: 'Gold' });
  assert.match(mail.text, /never affected/i);
  assert.equal(/cancel|suspend|lose access|will be removed/i.test(mail.text), false);
});

test('a card-failed notice names the tier', () => {
  assert.equal(cardFailedEmail({ label: 'Gold' }).subject, 'A payment did not go through — Gold');
});
