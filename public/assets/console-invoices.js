/** Invoices — the book, what is unbilled, who is late, and chasing them. */

import { esc, node } from './client.js';
import { book, pendingInvoice, setBook, setPendingInvoice } from './console-state.js';
import { night } from './console-tonight.js';
import { hostKey, keyed } from './console.js';

export async function invoiceApi(path, options) {
  const res = await fetch(keyed(path), {
    headers: { 'Content-Type': 'application/json', 'X-Host-Key': hostKey },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export function invoicesSection() {
  const el = node(`
    <div class="game-section">
      <div class="game-head">
        <div>
          <h2>Invoices</h2>
          <div class="tiny status">Loading…</div>
        </div>
        <div class="row">
          <button class="minor who-to">Venues</button>
          <button class="minor my-details">Your details</button>
          <button class="role-make new-invoice">New invoice</button>
        </div>
      </div>
      <div class="inv-warn"></div>
      <div class="inv-body"></div>
    </div>`);

  const status = el.querySelector('.status');
  const body = el.querySelector('.inv-body');
  const warn = el.querySelector('.inv-warn');

  const refresh = async () => {
    try {
      setBook(await invoiceApi('/api/invoices'));
    } catch (err) {
      status.textContent = err.message;
      return;
    }
    const s = book.summary;
    status.innerHTML = s.count
      ? `${s.count} invoice${s.count === 1 ? '' : 's'} · <b>${esc(money(s.outstanding))}</b> outstanding`
        + (s.overdueCount ? ` · <b style="color:var(--bad)">${esc(money(s.overdue))} overdue</b>` : '')
      : 'Nothing invoiced yet.';

    /*
     * The one warning that matters, and it is the same shape as the song
     * history's: there is no permanent disk, so without the private repo an
     * invoice lives until the next deploy. An invoice you think you have a
     * record of and do not is worse than no record at all.
     *
     * It used to name PHOTO_REPO and GITHUB_TOKEN and tell the reader to set
     * them on Render — which is the owner's dashboard, on the one tab that is
     * a quizmaster's own business. Same fault as the "nothing here is being
     * saved permanently" banner that was being shown to subscribers. It says
     * what it means to them and what to do about it, like the own-packs one.
     */
    warn.replaceChildren(...(book.backupReady ? [] : [node(`
      <div class="pv-warn pv-broken" style="margin-bottom:12px">
        <b class="pv-warn-head">Invoices are not being backed up</b>
        <div class="tiny" style="margin-top:6px">
          They are saved here, and this server has nowhere permanent to keep them — so
          everything on this page disappears the next time the app restarts, including
          the invoice numbering. Download anything you have sent out, and ask about
          turning the backup on.
        </div>
      </div>`)]));

    drawList(body, refresh);

    /*
     * A DATE THE CALENDAR SENT OVER — see `billFor()`.
     *
     * Consumed HERE rather than acted on there, because this is the first
     * moment the invoice book exists: the venue arrives as a NAME, and turning
     * it into a customer id needs `book.customers`. Doing it this way round
     * also means the calendar raises an invoice without fetching the book at
     * all.
     *
     * Taken once and cleared, or the form would reopen on every refresh — and
     * `refresh()` runs after every save, which would trap somebody inside it.
     */
    if (pendingInvoice) {
      const want = pendingInvoice;
      setPendingInvoice(null);
      const named = String(want.venueName || '').trim().toLowerCase();
      const customer = named
        ? (book.customers || []).find((c) => String(c.name || '').trim().toLowerCase() === named)
        : null;
      openInvoiceForm({ ...want, customerId: customer ? customer.id : '' }, refresh);
    }
  };

  el.querySelector('.new-invoice').addEventListener('click', () => openInvoiceForm({}, refresh));
  el.querySelector('.my-details').addEventListener('click', () => openSettings(refresh));
  el.querySelector('.who-to').addEventListener('click', () => openCustomers(refresh));
  refresh();
  return el;
}

/** Pence to "£350.00", the same sum the server did. Never adds anything up. */
export function money(pence) {
  const n = Math.round(Number(pence) || 0);
  const abs = Math.abs(n);
  const pounds = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${n < 0 ? '-' : ''}£${pounds}.${String(abs % 100).padStart(2, '0')}`;
}

const STATUS_LABEL = { draft: 'Draft', sent: 'Awaiting payment', paid: 'Paid', cancelled: 'Cancelled' };

function drawList(body, refresh) {
  if (!book.invoices.length) {
    body.replaceChildren(node(`
      <div class="tiny" style="padding:18px 0">
        Nothing yet. Fill in <b>Your details</b> once, add the places you play under
        <b>Venues</b>, and an invoice is then two taps at the end of a night.
      </div>`));
    return;
  }

  const rows = book.invoices.map((invoice) => {
    /*
     * HOW LATE, in whole days past the terms — 0 when it is not.
     *
     * Worked out here rather than sent, because the browser has the issue date
     * and the terms already and a number computed on a page that reloads is
     * one that cannot go stale. It decides both the chase button and the line
     * under the row.
     */
    const late = daysLate(invoice, book.settings);
    const row = node(`
      <div class="inv-row status-${esc(invoice.status)} ${late ? 'is-late' : ''}">
        <div class="inv-main">
          <div class="inv-top">
            <b>${esc(invoice.number)}</b>
            <span class="inv-who">${esc(invoice.to.name)}</span>
            <span class="inv-status">${esc(STATUS_LABEL[invoice.status] || invoice.status)}</span>
          </div>
          <div class="tiny">${esc(invoice.lines.map((l) => l.description).join(' · '))}</div>
          ${late ? `<div class="tiny inv-late">${late} day${late === 1 ? '' : 's'} past its terms</div>` : ''}
        </div>
        <div class="inv-amount">${esc(money(invoice.totals.due))}</div>
        <div class="inv-actions">
          <a class="minor" href="${esc(keyed('/api/invoices/' + encodeURIComponent(invoice.number) + '.pdf'))}" target="_blank" rel="noopener">Open</a>
          <button class="minor send">Send</button>
          ${late ? '<button class="minor chase">Chase it</button>' : ''}
          ${invoice.status === 'paid'
            ? '<button class="minor unpaid">Not paid</button>'
            : invoice.status === 'cancelled' ? '' : '<button class="go paid">Mark paid</button>'}
        </div>
      </div>`);

    row.querySelector('.send').addEventListener('click', () => share(invoice));
    row.querySelector('.chase')?.addEventListener('click', () => chase(invoice, late));
    row.querySelector('.paid')?.addEventListener('click', async () => {
      await invoiceApi(`/api/invoices/${encodeURIComponent(invoice.number)}`, { method: 'POST', body: JSON.stringify({ status: 'paid' }) });
      refresh();
    });
    row.querySelector('.unpaid')?.addEventListener('click', async () => {
      await invoiceApi(`/api/invoices/${encodeURIComponent(invoice.number)}`, { method: 'POST', body: JSON.stringify({ status: 'sent' }) });
      refresh();
    });
    return row;
  });
  body.replaceChildren(...rows);
}

/**
 * HOW LATE AN INVOICE IS, in whole days past its terms.
 *
 * Mirrors `daysLate` in `src/invoices.js` — same rule, so the browser and the
 * server can never disagree about whether somebody is late. Only ever true of
 * a SENT one: a draft is not late, and a paid or cancelled one is finished.
 */
function daysLate(invoice, settings = {}) {
  if (!invoice || invoice.status !== 'sent') return 0;
  const issued = Date.parse(invoice.issuedAt);
  if (!Number.isFinite(issued)) return 0;
  const terms = Number(settings.termDays) || 14;
  return Math.max(0, Math.floor((Date.now() - (issued + terms * 86400000)) / 86400000));
}

/**
 * CHASE IT — the most disliked admin job there is, drafted.
 *
 * The blank page is where the time goes, not the pressing of send. So this
 * writes the awkward sentence and hands it to the share sheet; the quizmaster
 * reads it and presses send, exactly like `reply-draft.js` and for the same
 * reason. **It never sends on its own.** A chase that went out unread is the
 * one that nags somebody who paid last Tuesday, on the relationship they are
 * being paid to keep.
 *
 * The words are deliberately mild and they do NOT threaten anything — no
 * interest, no late fees, no "final notice". A quizmaster wants the money AND
 * the booking next month, and a stiff letter costs the second to get the
 * first a week earlier. It also gives them the out ("if it has already gone,
 * ignore this"), because the usual reason an invoice is unpaid is that
 * somebody forgot.
 *
 * The PDF goes with it. Chasing an invoice somebody has to go and find is
 * half a chase.
 */
async function chase(invoice, late) {
  const url = keyed(`/api/invoices/${encodeURIComponent(invoice.number)}.pdf`);
  const subject = `Invoice ${invoice.number} — a gentle reminder`;
  const signOff = invoice.from.contact || invoice.from.name || '';
  const lines = [
    `Hi${invoice.to.contact ? ' ' + invoice.to.contact : ''},`,
    '',
    `Hope all is well. Just a nudge on invoice ${invoice.number} for ${money(invoice.totals.due)}`
      + `${invoice.event && invoice.event.venue ? ` — ${invoice.event.venue}` : ''}`
      + `${invoice.event && invoice.event.date
        // Noon, so no timezone can pull the date back a day — the same trap
        // the invoice code itself records for a night that ends after midnight.
        ? `, ${new Date(invoice.event.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}`
        : ''}.`,
    // "It IS now N days past", not "it went out N days past" — the first
    // version said the invoice was sent late, which is the opposite of the
    // point and would read as an apology.
    `It is now ${late} day${late === 1 ? '' : 's'} past its terms, so I thought I would check it reached the right person.`,
    '',
    'If it has already gone through, please ignore this — and thanks again for having us.',
    '',
    // A dangling "Best," with nothing under it is worse than no sign-off, and
    // it happens on any book where the business details are not filled in yet.
    ...(signOff ? ['Best,', signOff] : ['Thanks!']),
  ].join('\n');

  try {
    const res = await fetch(url, { headers: { 'X-Host-Key': hostKey } });
    const blob = await res.blob();
    const file = new File([blob], invoice.number + '.pdf', { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: subject, text: lines });
      return;
    }
  } catch (err) {
    // A cancelled share sheet throws too — the same trap `share()` records.
    if (err && err.name === 'AbortError') return;
  }

  window.open(url, '_blank', 'noopener');
  if (invoice.to.email) {
    location.href = `mailto:${encodeURIComponent(invoice.to.email)}`
      + `?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines)}`;
  }
}

/**
 * Send it.
 *
 * The share sheet where the phone has one, which puts the PDF straight into
 * Mail or WhatsApp from your own account. On a laptop there is no share sheet,
 * so it opens the customer's email with the subject and body written and the
 * PDF in another tab to attach — clumsier, but a laptop is where you have the
 * patience for it.
 */
export async function share(invoice) {
  const url = keyed(`/api/invoices/${encodeURIComponent(invoice.number)}.pdf`);
  const subject = `Invoice ${invoice.number} — ${invoice.from.name || 'Quiz night'}`;
  const lines = [
    `Hi${invoice.to.contact ? ' ' + invoice.to.contact : ''},`,
    '',
    `Thanks for having us. Invoice ${invoice.number} is attached — ${money(invoice.totals.due)}, ${invoice.terms || 'payable on receipt'}.`,
    '',
    'Best,',
    invoice.from.contact || invoice.from.name || '',
  ].join('\n');

  try {
    const res = await fetch(url, { headers: { 'X-Host-Key': hostKey } });
    const blob = await res.blob();
    const file = new File([blob], invoice.number + '.pdf', { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: subject, text: lines });
      return;
    }
  } catch (err) {
    // A cancelled share sheet throws too. Falling through to the email draft
    // would then open a window they did not ask for, so only carry on if the
    // share genuinely was not available.
    if (err && err.name === 'AbortError') return;
  }

  window.open(url, '_blank', 'noopener');
  if (invoice.to.email) {
    location.href = `mailto:${encodeURIComponent(invoice.to.email)}`
      + `?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines)}`;
  }
}

/** A plain sheet with a title, a body and a Save. Escape and the backdrop close it. */
export function sheet(title, buildBody, onSave, { saveLabel = 'Save' } = {}) {
  const overlay = node(`
    <div class="overlay">
      <div class="sheet">
        <div class="sheet-head">
          <div style="min-width:0;flex:1 1 auto"><b>${esc(title)}</b><div class="tiny inv-sheet-note"></div></div>
          <div class="sheet-actions">
            <button class="role-make inv-save">${esc(saveLabel)}</button>
            <button class="minor inv-close">Close</button>
          </div>
        </div>
        <div class="sheet-body inv-form"></div>
      </div>
    </div>`);
  const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  overlay.querySelector('.inv-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  const form = overlay.querySelector('.inv-form');
  const note = overlay.querySelector('.inv-sheet-note');
  buildBody(form, { close, note });

  overlay.querySelector('.inv-save').addEventListener('click', async (e) => {
    e.target.disabled = true;
    try {
      await onSave(form, { close, note });
    } catch (err) {
      note.textContent = err.message;
      note.style.color = 'var(--bad)';
      e.target.disabled = false;
    }
  });
  document.body.appendChild(overlay);
  return overlay;
}

export const field = (label, name, value = '', { type = 'text', placeholder = '', wide = false } = {}) => `
  <label class="inv-field ${wide ? 'wide' : ''}">
    <span>${esc(label)}</span>
    ${type === 'textarea'
      ? `<textarea name="${name}" rows="3" placeholder="${esc(placeholder)}">${esc(value)}</textarea>`
      : `<input type="${type}" name="${name}" value="${esc(value)}" placeholder="${esc(placeholder)}">`}
  </label>`;

const valuesOf = (form) => {
  const out = {};
  for (const el of form.querySelectorAll('[name]')) out[el.name] = el.type === 'checkbox' ? el.checked : el.value.trim();
  return out;
};

/** Your own details. Typed once, printed on every invoice from then on. */
function openSettings(refresh) {
  const s = book.settings;
  sheet('Your details', (form) => {
    form.innerHTML = `
      <div class="inv-group"><h4>Who the invoice is from</h4>
        ${field('Trading name', 'name', s.business.name, { placeholder: 'Quizporium' })}
        ${field('Your name', 'contact', s.business.contact)}
        ${field('Address', 'address', s.business.address, { type: 'textarea', wide: true })}
        ${field('Email', 'email', s.business.email)}
        ${field('Phone', 'phone', s.business.phone)}
      </div>
      <div class="inv-group"><h4>How they pay you</h4>
        ${field('Account name', 'bankName', s.bank.name)}
        ${field('Sort code', 'sortCode', s.bank.sortCode, { placeholder: '00-00-00' })}
        ${field('Account number', 'accountNumber', s.bank.accountNumber)}
        ${field('Payment reference', 'reference', s.bank.reference, { placeholder: 'Leave blank to use the invoice number' })}
      </div>
      <div class="inv-group"><h4>The small print</h4>
        ${field('Payment terms', 'terms', s.terms, { type: 'textarea', wide: true })}
        ${field('Invoice number prefix', 'prefix', s.prefix, { placeholder: 'INV' })}
        <div class="tiny" style="align-self:end">Next invoice will be <b>${esc(s.prefix)}-${String(s.nextNumber).padStart(4, '0')}</b></div>
      </div>
      <div class="inv-group"><h4>VAT</h4>
        <label class="inv-field"><span>Registered for VAT</span>
          <input type="checkbox" name="vatRegistered" ${s.vat.registered ? 'checked' : ''}>
        </label>
        ${field('VAT number', 'vatNumber', s.vat.number, { placeholder: 'GB123456789' })}
        ${field('Rate %', 'vatRate', String(s.vat.ratePercent), { type: 'number' })}
        <div class="tiny wide">
          Leave this off unless you are actually registered. An invoice from somebody who
          is not registered must not mention VAT at all — so while this is off, nothing
          on the page says the word. Turning it on later does not change any invoice you
          have already sent.
        </div>
      </div>`;
  }, async (form, { close }) => {
    const v = valuesOf(form);
    await invoiceApi('/api/invoices/settings', {
      method: 'PUT',
      body: JSON.stringify({
        business: { name: v.name, contact: v.contact, address: v.address, email: v.email, phone: v.phone },
        bank: { name: v.bankName, sortCode: v.sortCode, accountNumber: v.accountNumber, reference: v.reference },
        vat: { registered: v.vatRegistered, number: v.vatNumber, ratePercent: Number(v.vatRate) || 20 },
        terms: v.terms,
        prefix: v.prefix || 'INV',
      }),
    });
    close();
    refresh();
  });
}

/**
 * The venues you work for, so an invoice is a pick rather than a retype.
 *
 * IT SAYS "VENUE", not "customer", and that is the whole reason this comment
 * is longer than it was. One record was wearing two nouns: the Venues tab
 * called it a venue, this sheet called it a customer, the launch picker and
 * the pack card and the archive all said venue — and the Venues tab had to
 * carry a sentence explaining that they were the same list, which by the house
 * rule is the tell that it is a design problem rather than a copy one.
 *
 * The wire is untouched (`/api/invoices/customers`, `book.customers`): a route
 * is not a label, and renaming one to tidy a word is how you break a backup.
 * Invoices already issued are untouched too — they carry their own copy of
 * everything, which is the point of them.
 */
function openCustomers(refresh) {
  sheet('Venues', (form) => {
    const draw = () => {
      form.innerHTML = `<div class="inv-customers">${book.customers.map((c) => `
        <div class="inv-cust" data-id="${esc(c.id)}">
          <div><b>${esc(c.name)}</b>${c.contact ? ` · ${esc(c.contact)}` : ''}
            <div class="tiny">${esc((c.address || '').replace(/\n/g, ', '))}${c.usualFeePence != null ? ` · usually ${esc(money(c.usualFeePence))}` : ''}</div>
          </div>
          <button class="minor danger del">Remove</button>
        </div>`).join('') || '<div class="tiny">Nobody yet.</div>'}</div>
        <div class="inv-group"><h4>Add a venue</h4>
          ${field('Name', 'name', '', { placeholder: 'The Crown' })}
          ${field('Contact', 'contact', '', { placeholder: 'Dave' })}
          ${field('Address', 'address', '', { type: 'textarea', wide: true })}
          ${field('Email', 'email', '')}
          ${field('Usual fee', 'usualFee', '', { placeholder: '350' })}
        </div>`;
      for (const row of form.querySelectorAll('.inv-cust')) {
        row.querySelector('.del').addEventListener('click', async () => {
          /*
           * The SAME confirm the Venues tab shows, because it is the same act
           * on the same record — `DELETE /api/invoices/customers/:id`. This
           * one had none at all: one tap and a venue's address, contact, usual
           * fee and prizes were gone, with no undo. A destructive act that
           * asks on one screen and not on the other teaches you that it does
           * not ask, which is the worse of the two ways to be inconsistent.
           */
          if (!confirm('Remove this venue? Invoices already sent keep their own copy.')) return;
          await invoiceApi(`/api/invoices/customers/${encodeURIComponent(row.dataset.id)}`, { method: 'DELETE' });
          setBook(await invoiceApi('/api/invoices'));
          draw();
          refresh();
        });
      }
    };
    draw();
  }, async (form, { close }) => {
    const v = valuesOf(form);
    if (!v.name) throw new Error('A venue needs a name.');
    await invoiceApi('/api/invoices/customers', { method: 'POST', body: JSON.stringify(v) });
    close();
    refresh();
  });
}

/**
 * The invoice itself.
 *
 * Pre-filled from the customer and from the night that has just finished, so
 * the usual case is: check the number, press Issue, press Send.
 */
export function openInvoiceForm(prefill, refresh) {
  sheet('New invoice', (form, { note }) => {
    if (!book.settings.business.name) {
      note.textContent = 'Fill in "Your details" first — an invoice with no name on it is not much use.';
    }
    // The first line describes itself from the event, and keeps doing so until
    // you type over it. Left blank it produced an invoice with a charge on it
    // and nothing saying what the charge was for, which is the one line that
    // gets an invoice queried.
    const lines = prefill.lines && prefill.lines.length
      ? prefill.lines
      : [{ description: prefill.description || 'Music quiz night', amount: '' }];

    form.innerHTML = `
      <div class="inv-group"><h4>Who it is for</h4>
        <label class="inv-field wide"><span>Venue</span>
          <select name="customerId">
            <option value="">Someone not on the list…</option>
            ${book.customers.map((c) => `<option value="${esc(c.id)}" ${prefill.customerId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
          </select>
        </label>
        <div class="inv-oneoff" hidden>
          ${field('Name', 'toName', '')}
          ${field('Contact', 'toContact', '')}
          ${field('Address', 'toAddress', '', { type: 'textarea', wide: true })}
          ${field('Email', 'toEmail', '')}
        </div>
      </div>
      <div class="inv-group"><h4>The event</h4>
        ${field('What it was', 'eventTitle', prefill.event?.title || 'Music quiz night')}
        ${field('Venue', 'eventVenue', prefill.event?.venue || '')}
        ${field('Date', 'eventDate', prefill.event?.date || new Date().toISOString().slice(0, 10), { type: 'date' })}
      </div>
      <div class="inv-group wide"><h4>What they owe</h4>
        <div class="inv-lines"></div>
        <button class="minor add-line" type="button">Add a line</button>
      </div>
      <div class="inv-group">
        ${field('Deposit already paid', 'deposit', prefill.deposit || '', { placeholder: '0' })}
        ${field('Anything else on the invoice', 'notes', '', { type: 'textarea', wide: true })}
      </div>
      <div class="inv-total tiny"></div>`;

    const linesEl = form.querySelector('.inv-lines');
    const totalEl = form.querySelector('.inv-total');

    // The running total is worked out here only to show you what you typed.
    // The invoice's own figures come back from the server, which is the one
    // place money is ever added up.
    const retotal = () => {
      let pence = 0;
      let bad = false;
      for (const row of linesEl.querySelectorAll('.inv-line')) {
        const raw = row.querySelector('[data-amount]').value.trim();
        if (!raw) continue;
        const parsed = readMoney(raw);
        if (parsed === null) bad = true;
        else pence += parsed;
      }
      const deposit = readMoney(form.querySelector('[name=deposit]').value.trim() || '0');
      totalEl.innerHTML = bad || deposit === null
        ? '<b style="color:var(--bad)">That does not look like an amount — try 350 or 350.00</b>'
        : `Amount due <b>${esc(money(pence - (deposit || 0)))}</b>`;
    };

    const addLine = (line = { description: '', amount: '' }) => {
      const row = node(`
        <div class="inv-line">
          <input type="text" data-desc placeholder="Music quiz night" value="${esc(line.description || '')}">
          <input type="text" data-amount placeholder="350" value="${esc(line.amount || '')}" inputmode="decimal">
          <button class="minor danger" type="button">×</button>
        </div>`);
      row.querySelector('button').addEventListener('click', () => { row.remove(); retotal(); });
      row.querySelector('[data-amount]').addEventListener('input', retotal);
      linesEl.appendChild(row);
      retotal();
    };
    for (const line of lines) addLine(line);
    form.querySelector('.add-line').addEventListener('click', () => addLine());
    form.querySelector('[name=deposit]').addEventListener('input', retotal);

    /*
     * Keep the first line reading like the night it is for, until it is edited.
     * "Music quiz night — The Crown" writes itself as you fill the form in;
     * touch the box and it stops, because from then on it is yours.
     */
    const firstDesc = () => linesEl.querySelector('.inv-line [data-desc]');
    let autoDesc = firstDesc() ? firstDesc().value : '';
    const describe = () => {
      const box = firstDesc();
      if (!box || box.value !== autoDesc) return;
      const bits = [form.querySelector('[name=eventTitle]').value.trim(), form.querySelector('[name=eventVenue]').value.trim()];
      autoDesc = bits.filter(Boolean).join(' — ');
      box.value = autoDesc;
    };
    for (const name of ['eventTitle', 'eventVenue']) {
      form.querySelector(`[name=${name}]`).addEventListener('input', describe);
    }

    // A one-off booking should not have to become a saved customer first.
    const picker = form.querySelector('[name=customerId]');
    const oneOff = form.querySelector('.inv-oneoff');
    const togglePicker = () => { oneOff.hidden = Boolean(picker.value); };
    /*
     * THE VENUE'S USUAL FEE IS THE TEMPLATE — and it was only ever applied
     * when you CHANGED the venue by hand.
     *
     * This lived inside the picker's `change` listener, which does not fire
     * when the form opens with a venue already chosen. So every invoice raised
     * the way the app actually offers — "Invoice this" on a finished night,
     * "Invoice it" on a booking, anything arriving with a customer — came up
     * with an empty amount and "Amount due £0.00", next to a box whose grey
     * PLACEHOLDER says 350. That reads as a filled-in figure at a glance,
     * which is the worst version of the fault: it looks done and is not.
     *
     * The venue's usual fee is exactly the per-venue template — it is what
     * `draft()` on the server has always used. The form simply never asked.
     */
    const fillFromCustomer = () => {
      togglePicker();
      const customer = book.customers.find((c) => c.id === picker.value);
      const first = linesEl.querySelector('[data-amount]');
      if (customer && customer.usualFeePence != null && first && !first.value) {
        first.value = money(customer.usualFeePence).replace('£', '');
        retotal();
      }
      // A venue you already know the name of should not have to be typed twice.
      const venue = form.querySelector('[name=eventVenue]');
      if (customer && !venue.value) {
        venue.value = customer.name;
        describe();
      }
    };
    picker.addEventListener('change', fillFromCustomer);
    // …and once on the way in, for a form that arrives already knowing whose
    // night it is.
    if (picker.value) fillFromCustomer();
    togglePicker();
    picker.dispatchEvent(new Event('change'));
  }, async (form, { close }) => {
    const v = valuesOf(form);
    const lines = [...form.querySelectorAll('.inv-line')].map((row) => ({
      description: row.querySelector('[data-desc]').value.trim(),
      amount: row.querySelector('[data-amount]').value.trim() || '0',
    })).filter((l) => l.description || l.amount !== '0');

    const done = await invoiceApi('/api/invoices', {
      method: 'POST',
      body: JSON.stringify({
        customerId: v.customerId,
        toName: v.toName, toContact: v.toContact, toAddress: v.toAddress, toEmail: v.toEmail,
        event: { title: v.eventTitle, venue: v.eventVenue, date: v.eventDate },
        lines,
        deposit: v.deposit || '0',
        notes: v.notes,
      }),
    });
    close();
    refresh();
    // Straight into sending it, because that is what you opened this to do.
    share(done.invoice);
  // "Save" is ambiguous on an invoice — saved as a draft, or sent? This one
  // hands out a number and cannot be taken back, so it says so.
  }, { saveLabel: 'Issue and send' });
}

/** Mirrors toPence in src/invoices.js — same rules, so the same things are refused. */
function readMoney(input) {
  const cleaned = String(input ?? '').trim().replace(/[£,\s]/g, '');
  if (!cleaned) return null;
  if (!/^-?\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const negative = cleaned.startsWith('-');
  const [pounds, pence = ''] = cleaned.replace('-', '').split('.');
  const total = Number(pounds) * 100 + Number(pence.padEnd(2, '0'));
  return negative ? -total : total;
}
