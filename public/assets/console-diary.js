/** CALENDAR — the month, what is on, and what you do about a date. */

import { esc, node, postJson } from './client.js';
import { invoiceApi } from './console-invoices.js';
import { venueBox, venueFrom, wireVenue } from './console-packs.js';
import { book, library, setPendingInvoice } from './console-state.js';
import { night } from './console-tonight.js';
import { TAB_STORE, can, hostKey, keyed, renderKeepingPlace } from './console.js';
import { nightKey, tonight, upcoming } from './diary.js';
import { FEATURES } from './plans.js';

/**
 * The diary.
 *
 * **ALMOST ALL OF IT IS DERIVED AND THAT IS THE POINT.** The recurring nights
 * come out of the usual nights already set on the Venues tab, projected six
 * weeks forward by `upcoming()` — so a quizmaster with their residencies set
 * up has a working diary having typed nothing, and it can never go stale
 * because there is nothing to keep up. A feature's real price here is the
 * admin it creates on a Monday, and a diary of dates somebody has to maintain
 * is the most expensive shape this could have taken.
 *
 * So the only things typed are the two a pattern cannot express: a one-off
 * somewhere, and a night off.
 *
 * ---
 *
 * **THE MONTH SITS LEFT AND EVERYTHING ELSE HAPPENS ON THE RIGHT**, asked for
 * directly: *"perhaps the calendar needs to sit off to the left in the section
 * to allow room for the right to populate?"* It is the right shape, and it
 * fixes a real fault rather than only looking tidier. Full width, the month
 * was seven columns of mostly-empty boxes across a laptop, and what answered a
 * date was a thin strip UNDER it — so picking the 23rd pushed the thing you
 * wanted below the fold, and the form it sent you to was below that again.
 * Beside it, a date and what you can do about it are one glance.
 *
 * **THERE IS ONE PLACE A NIGHT IS ADDED, AND IT IS THE DATE YOU PICKED.** The
 * bottom of this tab used to carry its own date box, venue and Add a night —
 * a second control for a job the month already does, which is exactly how a
 * booking lands on the date the other one happened to be showing. **Book a
 * quiz** now opens the whole form against the date in the heading: *"perhaps
 * when you click 'book a quiz' it just asks for all quiz info like venue, time
 * etc."*
 */
export function diarySection() {
  const el = node(`
    <div class="game-section">
      <div class="game-head">
        <div>
          <h2>Coming up</h2>
          <div class="tiny">The next four weeks, from the usual nights on your Venues tab.
            Pick a date to book anything that is not your usual.</div>
        </div>
      </div>
      <!-- THE MONTH, because "book a quiz on the 23rd" needs a 23rd to click.
           The panel beside it answers a different question — what is next — and
           both were rendered side by side before choosing: a list can only
           ever offer actions on nights that ALREADY exist. -->
      <div class="cal-wrap">
        <div class="cal-left">
          <div class="cal-head">
            <button class="minor cal-prev" type="button" aria-label="The month before">&larr;</button>
            <b class="cal-month"></b>
            <button class="minor cal-next" type="button" aria-label="The month after">&rarr;</button>
            <button class="minor cal-today" type="button">Today</button>
          </div>
          <div class="cal-days"></div>
          <div class="cal-grid"></div>
        </div>
        <div class="cal-side"></div>
      </div>
      <!-- YOUR NIGHTS IN YOUR OWN CALENDAR. A residency that exists only in
           this app is a residency you double-book yourself over. -->
      <div class="cal-feed">
        <div class="tiny"><b>Put these in your own calendar.</b>
          Subscribe once and every night keeps itself up to date — in Google,
          Apple or Outlook, on your phone and your laptop.</div>
        <div class="cal-feed-row">
          <input class="cal-url" type="text" readonly aria-label="Your calendar address">
          <button class="minor cal-copy" type="button">Copy</button>
          <button class="minor danger cal-roll" type="button" title="Stop every calendar that has this address">New address</button>
        </div>
        <div class="tiny cal-feed-said"></div>
      </div>
    </div>`);

  /*
   * THE MONTH GRID.
   *
   * `upcoming()` already knows how to turn residencies plus one-offs minus
   * nights off into a list of nights — it simply starts from today. Asked for
   * an arbitrary month it does the same job: hand it the first of the month
   * and six weeks, then keep what falls inside. One source, so the grid, the
   * panel beside it and Tonight can never disagree about whose night a
   * Thursday is.
   */
  const gridEl = el.querySelector('.cal-grid');
  const daysEl = el.querySelector('.cal-days');
  const sideEl = el.querySelector('.cal-side');
  const monthEl = el.querySelector('.cal-month');
  const today = new Date();
  let shown = new Date(today.getFullYear(), today.getMonth(), 1);
  let picked = '';
  /*
   * Whether the booking form is open in the right-hand panel. Held out here
   * rather than read off the DOM because the panel is rebuilt every time
   * anything is saved — a form that shut itself the moment you added a night
   * would make adding a second one a hunt for the button again.
   */
  let booking = false;
  // What the month grid worked out, so the panel beside it reads the SAME
  // answer rather than asking `upcoming()` a second question with a second
  // clock in it.
  let onByDate = new Map();

  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const drawMonth = () => {
    const first = new Date(shown.getFullYear(), shown.getMonth(), 1);
    const last = new Date(shown.getFullYear(), shown.getMonth() + 1, 0);
    monthEl.textContent = first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

    // Monday first, which is how a week reads to anybody working in a pub.
    daysEl.replaceChildren(...['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      .map((d) => node(`<span class="cal-day">${d}</span>`)));

    const nights = upcoming({
      venues: library.venueRecords || [],
      bookings: library.bookings || [],
      now: first.getTime(),
      weeks: 6,
    });
    onByDate = new Map();
    for (const n of nights) {
      if (!onByDate.has(n.date)) onByDate.set(n.date, []);
      onByDate.get(n.date).push(n);
    }

    const cells = [];
    // getDay() is 0 for Sunday; Monday-first means Sunday sits at the end.
    const lead = (first.getDay() + 6) % 7;
    for (let i = 0; i < lead; i++) cells.push(node('<div class="cal-cell is-blank"></div>'));
    for (let d = 1; d <= last.getDate(); d++) {
      const date = iso(new Date(shown.getFullYear(), shown.getMonth(), d));
      const on = onByDate.get(date) || [];
      const cell = node(`
        <button class="cal-cell ${on.length ? 'has' : ''} ${date === iso(today) ? 'is-today' : ''} ${date === picked ? 'open' : ''}"
          type="button" data-date="${date}">
          <span class="cal-num">${d}</span>
          ${on.slice(0, 2).map((n) => `<span class="cal-dot ${n.why === 'booked' ? 'one' : ''}">${esc(n.venue)}</span>`).join('')}
          ${on.length > 2 ? `<span class="cal-dot more">and ${on.length - 2} more</span>` : ''}
        </button>`);
      cell.addEventListener('click', () => {
        picked = picked === date ? '' : date;
        // A different date is a different question, so a half-filled form for
        // the 23rd must not be handed to the 24th with a venue still in it.
        booking = false;
        drawMonth();
        /*
         * ON A PHONE THE PANEL IS UNDER THE MONTH, so picking a date puts the
         * answer off the bottom of the screen — the exact fault the two
         * columns fix on a laptop, arriving on the device this is most often
         * held on. Only while it is stacked: side by side it is already next
         * to your thumb, and scrolling would be the page moving for nothing.
         */
        if (picked && window.matchMedia('(max-width: 899px)').matches) {
          sideEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      });
      cells.push(cell);
    }
    gridEl.replaceChildren(...cells);
    drawSide();
  };

  /*
   * THE RIGHT-HAND PANEL — the diary when no date is picked, and that date
   * when one is.
   *
   * Two things in one column rather than two columns of their own, because
   * they are never both wanted: what is coming up is what you READ, and a date
   * is what you ACT on. Nothing picked is the resting state and shows the
   * list, which is what this tab was before the month existed.
   */
  function drawSide() {
    sideEl.replaceChildren(...(picked ? dayPanel() : comingUp()));
  }

  function comingUp() {
    const head = node(`
      <div class="cal-side-head">
        <b>The next four weeks</b>
        <span class="tiny">Pick a date to book one.</span>
      </div>`);
    const nights = upcoming({
      venues: library.venueRecords || [],
      bookings: library.bookings || [],
    });
    if (!nights.length) {
      return [head, node(`<div class="tiny">Nothing coming up.
        ${(library.venueRecords || []).some((v) => v.usualNight)
    ? 'Pick a date on the left to add a one-off.'
    : 'Give a venue its usual night on the Venues tab and its weeks fill themselves in.'}</div>`)];
    }
    const list = node('<div class="diary-list"></div>');
    list.replaceChildren(...nights.map(comingRow));
    return [head, list];
  }

  /**
   * A NIGHT IN THE LIST IS SOMETHING YOU READ, NOT TEN THINGS YOU DO.
   *
   * It was `diaryRow()` — the same card as the day panel, buttons and all —
   * which put **Invoice it** and **Not on this week** on every one of ten
   * rows. Two faults, and the second is a rule this project already has in
   * writing:
   *
   * - **A WALL OF RED.** *"Don't want a wall of red either"* is the host's
   *   own line, set when three tinted button options were turned down. Ten
   *   outlined-red buttons in a column is louder than one filled one, and it
   *   made a perfectly ordinary diary read as ten things that had gone wrong
   *   — on a page whose only other colour was a pink underline on the button
   *   beside it.
   * - **It contradicted the panel's own split.** What is coming up is what you
   *   READ; a date is what you ACT on. Putting the actions in both halves
   *   meant the day panel was not the place a night is dealt with, it was one
   *   of two.
   *
   * So the row is the date, the place and what it plays for — and **the whole
   * row picks that date**, which lands you in the day panel where the actions
   * live. One tap, no buttons, and the month moves to the right month on the
   * way so you can see where you are.
   */
  function comingRow(night) {
    const when = new Date(night.date + 'T12:00:00');
    const prizes = (night.rewards || []).filter(Boolean);
    const row = node(`
      <button class="diary-row is-pick ${night.why === 'booked' ? 'is-booked' : ''}" type="button">
        <div class="d-when">
          <b>${esc(when.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }))}</b>
          <span class="tiny">${esc(whenAway(night.date))}</span>
        </div>
        <div class="d-what">
          <b>${esc(night.venue)}</b>
          ${night.why === 'booked' ? '<span class="d-tag">one-off</span>' : ''}
          ${night.time ? `<span class="d-time">${esc(saidTime(night.time))}</span>` : ''}
          ${night.note ? `<div class="tiny">${esc(night.note)}</div>` : ''}
          ${prizes.length ? `<div class="tiny">Playing for ${esc(prizes[0])}</div>` : ''}
        </div>
      </button>`);
    row.addEventListener('click', () => {
      const [y, m] = night.date.split('-').map(Number);
      shown = new Date(y, m - 1, 1);
      picked = night.date;
      booking = false;
      drawMonth();
    });
    return row;
  }

  /*
   * ONE DATE, AND EVERYTHING THAT CAN BE DONE TO IT — deliberately a LIST
   * pushed onto rather than a fixed set. The host's own framing: *"maybe just
   * build that in at the start so we can add to it later"*. So another action
   * is a line here rather than a redesign.
   */
  function dayPanel() {
    const when = new Date(picked + 'T12:00:00');
    const said = when.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    const out = [];

    const head = node(`
      <div class="cal-side-head">
        <b>${esc(said)}</b>
        <button class="minor cal-shut" type="button">Back to the list</button>
      </div>`);
    head.querySelector('.cal-shut').addEventListener('click', () => {
      picked = ''; booking = false; drawMonth();
    });
    out.push(head);

    const on = onByDate.get(picked) || [];
    if (on.length) {
      const list = node('<div class="diary-list"></div>');
      list.replaceChildren(...on.map(diaryRow));
      out.push(list);
    } else {
      out.push(node('<div class="tiny">Nothing on this night.</div>'));
    }

    /*
     * WHAT "NOT ON THIS WEEK" ACTUALLY DID, and the way back from it.
     *
     * Asked directly — *"not sure what 'not on' would be useful for"* — and
     * the honest answer is that the button was right and INVISIBLE. It writes
     * one week of a residency off; the night then vanishes from the diary and
     * from the calendar feed, and nothing anywhere said so or offered to undo
     * it. A control whose entire effect is something disappearing is a control
     * nobody can learn. So a written-off night is now shown on its own date,
     * named, with **Put it back** on it.
     */
    for (const b of (library.bookings || []).filter((x) => x.off && x.date === picked)) {
      out.push(offRow(b));
    }

    if (booking) {
      out.push(bookForm(said));
    } else {
      const go = node('<button class="role-make cal-add" type="button">Book a quiz</button>');
      go.addEventListener('click', () => { booking = true; drawSide(); });
      out.push(go);
    }

    /*
     * NOT WHILE THE FORM IS OPEN. Under a half-filled booking it reads as one
     * more field in it, and pressing it would leave the tab for the invoices
     * with what you had typed still on screen behind you.
     */
    if (!booking && can(FEATURES.INVOICES)) {
      const bill = node('<button class="minor cal-bill" type="button">Invoice for this date</button>');
      bill.addEventListener('click', () => billFor((on[0] && on[0].venue) || '', picked));
      out.push(bill);
    }
    return out;
  }

  /**
   * A night written off, and the way to put it back.
   *
   * `removeBooking` rather than another `setBooking` — FORGETTING the
   * exception is what returns a residency to being an ordinary one, which is
   * exactly what "I cancelled that by mistake" means. Writing a second record
   * over it would leave the app holding two opinions about one Thursday.
   */
  function offRow(b) {
    const row = node(`
      <div class="diary-row is-off">
        <div class="d-what">
          <b>${esc(b.venue)}</b>
          <span class="d-tag off">not on</span>
          <div class="tiny">Written off, so it is not in your diary or your calendar feed.</div>
        </div>
        <div class="d-acts"><button class="minor d-back" type="button">Put it back</button></div>
      </div>`);
    row.querySelector('.d-back').addEventListener('click', async () => {
      try {
        const data = await invoiceApi(`/api/invoices/bookings/${encodeURIComponent(b.id)}`, { method: 'DELETE' });
        library.bookings = data.bookings || [];
        drawMonth();
      } catch (err) {
        alert(err.message || 'Could not put it back.');
      }
    });
    return row;
  }

  /**
   * BOOK A QUIZ — the whole night, against the date already picked.
   *
   * *"perhaps when you click 'book a quiz' it just asks for all quiz info like
   * venue, time etc."* The date is the HEADING rather than a field, because it
   * is the thing you clicked to get here and a box repeating it is a second
   * place for it to be wrong.
   *
   * Only the venue is required. A time is genuinely optional — a residency has
   * none, and demanding one would make somebody invent a fact in order to save
   * a booking — but given, it reaches their real calendar as an appointment
   * rather than a day-long block. See `src/ics.js`.
   */
  function bookForm(said) {
    const form = node(`
      <div class="cal-book">
        <b>Book a quiz — ${esc(said)}</b>
        <label class="cal-f"><span>Where</span>
          <!-- WRAPPED, because venueBox() is TWO elements: a select and the
               free-text box that replaces it for a one-off. wireVenue and
               venueFrom both use querySelector, which searches descendants,
               so nesting costs nothing. -->
          <div class="d-venue">${venueBox()}</div>
        </label>
        <label class="cal-f"><span>Starts at</span>
          <input class="d-time" type="time">
        </label>
        <label class="cal-f"><span>Note</span>
          <input class="d-note" type="text" maxlength="120" placeholder="Anything worth remembering">
        </label>
        <div class="tiny">Only the venue is needed. A start time goes into your own calendar as a real appointment.</div>
        <div class="cal-book-acts">
          <button class="minor cal-book-off" type="button">Cancel</button>
          <button class="role-make d-go" type="button">Add it</button>
        </div>
      </div>`);

    form.querySelector('.cal-book-off').addEventListener('click', () => { booking = false; drawSide(); });

    const add = form.querySelector('.d-go');
    add.addEventListener('click', async () => {
      const venue = venueFrom(form);
      if (!venue) { alert('A night needs a venue.'); return; }
      add.disabled = true;
      await save({
        date: picked,
        venue,
        time: form.querySelector('.d-time').value,
        note: form.querySelector('.d-note').value.trim(),
      });
      add.disabled = false;
    });
    wireVenue(form);
    return form;
  }

  /*
   * THE SUBSCRIPTION ADDRESS.
   *
   * Fetched rather than built here, because the key lives on the account and
   * this page must not invent one. Shown in full and copyable: pasting a URL
   * into Google Calendar is the actual job, and a button that says "subscribe"
   * cannot do it for you — every calendar app wants the address typed into its
   * own box.
   *
   * NEW ADDRESS is destructive and says so: it stops every calendar already
   * subscribed, which is exactly what you want if the old one went somewhere
   * it should not, and exactly what you do not want by accident.
   */
  const urlBox = el.querySelector('.cal-url');
  const feedSaid = el.querySelector('.cal-feed-said');
  const showFeed = async (roll) => {
    try {
      const data = roll
        ? await postJson('/api/calendar/link', {}, { 'X-Host-Key': hostKey })
        : await (await fetch(keyed('/api/calendar/link'))).json();
      if (data.error) throw new Error(data.error);
      urlBox.value = location.origin + data.path;
      if (roll) feedSaid.textContent = 'New address. Any calendar using the old one has stopped.';
    } catch (err) {
      feedSaid.textContent = err.message || 'Could not fetch your calendar address.';
    }
  };
  el.querySelector('.cal-copy').addEventListener('click', async () => {
    urlBox.select();
    try {
      await navigator.clipboard.writeText(urlBox.value);
      feedSaid.textContent = 'Copied. Paste it into your calendar as a subscription.';
    } catch {
      // Clipboard is refused without a gesture on some phones; the text is
      // already selected, so there is still a way through.
      feedSaid.textContent = 'Selected — copy it and paste it into your calendar.';
    }
  });
  el.querySelector('.cal-roll').addEventListener('click', () => {
    if (!confirm('Make a new address?\n\nEvery calendar already subscribed to the old one stops updating.')) return;
    showFeed(true);
  });
  showFeed(false);

  el.querySelector('.cal-prev').addEventListener('click', () => {
    shown = new Date(shown.getFullYear(), shown.getMonth() - 1, 1); picked = ''; booking = false; drawMonth();
  });
  el.querySelector('.cal-next').addEventListener('click', () => {
    shown = new Date(shown.getFullYear(), shown.getMonth() + 1, 1); picked = ''; booking = false; drawMonth();
  });
  el.querySelector('.cal-today').addEventListener('click', () => {
    shown = new Date(today.getFullYear(), today.getMonth(), 1); picked = ''; booking = false; drawMonth();
  });

  /*
   * A night, and the three things you can do to it.
   *
   * **"NOT ON THIS WEEK" AND "DELETE THIS BOOKING" ARE DIFFERENT ACTS ON
   * DIFFERENT OBJECTS, and one label used to cover both.** It said "Not on",
   * which is a verb with no object — the collision this project's sweep
   * already looks for. A residency is not a row that can be removed: it is
   * generated from the venue's usual night, so the only way to say "not that
   * Thursday" is to RECORD the exception. A one-off is a real row somebody
   * typed, and the thing you want is for it to be gone.
   */
  function diaryRow(night) {
    const when = new Date(night.date + 'T12:00:00');
    const said = when.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    const oneOff = night.why === 'booked';
    // The typed row behind this night, if there is one. A residency has none.
    const typed = (library.bookings || []).find((b) => !b.off && b.date === night.date
      && String(b.venue || '').toLowerCase() === String(night.venue || '').toLowerCase());
    const row = node(`
      <div class="diary-row ${oneOff ? 'is-booked' : ''}">
        <div class="d-when">
          <b>${esc(when.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }))}</b>
          <span class="tiny">${esc(whenAway(night.date))}</span>
        </div>
        <div class="d-what">
          <b>${esc(night.venue)}</b>
          ${oneOff ? '<span class="d-tag">one-off</span>' : ''}
          ${night.time ? `<span class="d-time">${esc(saidTime(night.time))}</span>` : ''}
          ${night.note ? `<div class="tiny">${esc(night.note)}</div>` : ''}
          ${night.rewards && night.rewards.filter(Boolean).length
    ? `<div class="tiny">Playing for ${esc(night.rewards.filter(Boolean)[0])}</div>`
    : '<div class="tiny">No prizes set</div>'}
        </div>
        <div class="d-acts">
          ${can(FEATURES.INVOICES) ? '<button class="minor d-bill">Invoice it</button>' : ''}
          <button class="minor danger d-off">${oneOff ? 'Delete this booking' : 'Not on this week'}</button>
        </div>
      </div>`);
    /*
     * INVOICE A NIGHT BEFORE IT HAPPENS.
     *
     * "Past and future" — the past half already worked, from Invoice this on a
     * finished night and from the unbilled list. The future half did not exist
     * at all: a booking you had taken could only be billed after you had run
     * it, which is the wrong way round for anybody who invoices on booking
     * rather than on delivery. Some venues pay a deposit; some want the
     * paperwork before their month end.
     *
     * **IT GOES TO THE INVOICES TAB rather than opening a form over the
     * diary**, at the host's own reading: *"'invoice for this date' goes to
     * the invoice section with that date pre-filled"*. He is right, and the
     * reason is what happens AFTER you press Send — you are left standing on
     * the calendar with no sight of the invoice you just raised, its number or
     * whether it is a draft. Landing on the tab that owns them means the thing
     * you made is on the page behind the form.
     *
     * It opens a DRAFT rather than issuing: a number is handed out at issue,
     * and handing one out for a night that might get cancelled is the sort of
     * hole in a sequence HMRC asks about.
     */
    row.querySelector('.d-bill')?.addEventListener('click', () => billFor(night.venue, night.date));
    row.querySelector('.d-off').addEventListener('click', async () => {
      if (oneOff && typed) {
        if (!confirm(`Delete the booking at ${night.venue} on ${said}?`)) return;
        try {
          const data = await invoiceApi(`/api/invoices/bookings/${encodeURIComponent(typed.id)}`, { method: 'DELETE' });
          library.bookings = data.bookings || [];
          drawMonth();
        } catch (err) {
          alert(err.message || 'Could not delete that.');
        }
        return;
      }
      if (!confirm(`Not doing ${night.venue} on ${said}?\n\nIt comes off your diary and your calendar feed. Pick the date and book it again to put it back.`)) return;
      await save({ date: night.date, venue: night.venue, off: true });
    });
    return row;
  }

  async function save(body) {
    try {
      const data = await invoiceApi('/api/invoices/bookings', { method: 'POST', body: JSON.stringify(body) });
      // The route hands the new list straight back, so the page does not have
      // to reload the whole library to show what it just wrote.
      library.bookings = data.bookings || [];
      drawMonth();
    } catch (err) {
      alert(err.message || 'Could not save that.');
    }
  }

  drawMonth();
  return el;
}

function billFor(venue, date) {
  setPendingInvoice({
    venueName: venue || '',
    event: { title: 'Music quiz night', venue: venue || '', date },
    description: 'Music quiz night',
  });
  goToTab('invoices');
}

/**
 * Move to another tab from inside a panel.
 *
 * The remembered tab is what `currentTab()` reads — **unless there is a
 * `?tab=` in the address bar, which wins**. A link that landed somebody here
 * would otherwise drag them straight back the moment the page redrew, so the
 * URL is moved along with the memory when it is carrying one.
 */
function goToTab(id) {
  localStorage.setItem(TAB_STORE, id);
  const url = new URL(location.href);
  if (url.searchParams.get('tab')) {
    url.searchParams.set('tab', id);
    history.replaceState(null, '', url.toString());
  }
  // The same landing as pressing the tab yourself, because that is what this
  // is — arriving somewhere different depending on how you got there is how a
  // page stops feeling like one place.
  renderKeepingPlace();
}

/** "20:00" as somebody says it out loud. */
export function saidTime(time) {
  const [h, m] = String(time || '').split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return '';
  const hour = h % 12 || 12;
  return `${hour}${m ? ':' + String(m).padStart(2, '0') : ''}${h < 12 ? 'am' : 'pm'}`;
}

/** "tonight", "in 3 days", "in 2 weeks" — how far off, not a second date. */
function whenAway(date) {
  const days = Math.round((new Date(date + 'T12:00:00') - new Date(nightKey() + 'T12:00:00')) / 86400000);
  if (days <= 0) return 'tonight';
  if (days === 1) return 'tomorrow';
  if (days < 14) return `in ${days} days`;
  return `in ${Math.round(days / 7)} weeks`;
}

export function dayName(date) {
  return date.toLocaleDateString('en-GB', { weekday: 'long' });
}

/** The shelf for one kind of game, whichever tab it is drawn on. */
