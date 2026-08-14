/**
 * THE LAST SLIDE OF THE NIGHT — "Back here Thursday 19th".
 *
 * ---
 *
 * The winner is up, the room has a drink in front of them and every phone in
 * the place is out. **That moment is currently spent on a scoreboard nobody
 * needs any more**, and it is the one moment in the evening when the whole
 * room is looking at the screen with nothing to do. Telling them when the next
 * one is costs nothing and is the single cheapest thing this app can do for
 * the venue's takings — which is what gets the quizmaster booked again.
 *
 * ---
 *
 * **IT WRITES ITSELF, and that is the whole design.** TODO.md said "a line of
 * text and a link, typed at launch", and that was right before the Venues tab
 * existed. It does now: a venue already carries its USUAL NIGHT, and the diary
 * already projects those forward and knows which weeks are off. So the date is
 * derived and there is nothing to type at the one moment the host is most
 * rushed — the same reasoning that shaped the diary itself, where almost
 * everything is derived precisely so there is nothing to keep up.
 *
 * A feature's real price is the admin it creates, and a "what to say at the
 * end" box on the launch form is a box that is blank by the third week and
 * then puts a wrong date in front of sixty people.
 *
 * **A NIGHT OFF AND A ONE-OFF BOTH WIN, for free**, because this asks
 * `upcoming()` rather than doing weekday arithmetic of its own. Saying "back
 * here Thursday" on the Thursday they are not coming is the one failure that
 * would make the whole thing untrustworthy, and the diary already solved it.
 *
 * **Resolved AT LAUNCH and written into the game state**, like the look, the
 * card shape and the prizes — so a restart mid-evening brings the same date
 * back rather than nothing, and so the engine never has to know that venue
 * records or diaries exist.
 *
 * **Silence when there is nothing true to say.** No usual night and no booking
 * means no line at all, rather than a slide with a hole in it.
 */

import { upcoming, nightKey } from '../public/assets/diary.js';

/**
 * Tidy what is about to be written into the state.
 *
 * The text is tidied exactly like a venue name — control characters out, a
 * length cap, and no word filtering, which is the rule everywhere a human's
 * words end up on a screen.
 *
 * **A link that is not http(s) is DROPPED rather than shown**, and this is
 * the one place to be strict about it: everything else on that slide can be
 * read from the back of the room and checked, where a QR code is a thing
 * sixty strangers point a camera at without being able to see where it goes.
 * `javascript:` and `data:` have no business in one.
 */
export function cleanComeBack(comeBack) {
  if (!comeBack) return null;
  const text = String(comeBack.text || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!text) return null;
  return { text, date: String(comeBack.date || '').slice(0, 10), link: safeLink(comeBack.link) };
}

/** http(s) only, and nothing longer than a QR can carry comfortably. */
export function safeLink(link) {
  const raw = String(link || '').trim().slice(0, 300);
  if (!raw) return '';
  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
  } catch {
    // No scheme typed is the common case — "thecrown.co.uk/whats-on" is what
    // somebody copies off a card. Assume https and check that, rather than
    // throwing away a link that was nearly right.
    try {
      const url = new URL('https://' + raw);
      return url.hostname.includes('.') ? url.href : '';
    } catch {
      return '';
    }
  }
}

/**
 * What a screen is told about it — built field by field, like every other
 * payload in the engine, so a field added to the state later cannot ride out
 * to a projector because somebody spread an object.
 *
 * One shape for both games and every role: it is a line and a link, and there
 * is nothing sensitive in it. The DATE is not sent — it is already inside the
 * sentence, and two representations of one fact is how they end up disagreeing.
 */
export function comeBackView(comeBack) {
  if (!comeBack || !comeBack.text) return null;
  return { text: String(comeBack.text), link: String(comeBack.link || '') };
}

/** "19th", "1st", "22nd" — how a person says a date out loud. */
export function ordinalDay(day) {
  const n = Number(day);
  if (!Number.isFinite(n)) return '';
  // 11th, 12th and 13th are the exceptions every naive version gets wrong.
  const teens = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teens ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' })[n % 10] || 'th';
  return `${n}${suffix}`;
}

/**
 * The next night at this venue, AFTER tonight.
 *
 * Tonight is deliberately excluded: `upcoming()` counts from today, and the
 * night being played is the one everybody is sitting in.
 */
export function nextNightAt({ venue, venues = [], bookings = [], now = Date.now() } = {}) {
  const want = String(venue || '').trim().toLowerCase();
  if (!want) return null;
  const tonight = nightKey(now);
  return upcoming({ venues, bookings, now })
    .find((n) => n.date > tonight && String(n.venue || '').trim().toLowerCase() === want) || null;
}

/** "Back here Thursday 19th" — a date said the way it is said on a mic. */
export function comeBackText(date) {
  const [y, m, d] = String(date || '').split('-').map(Number);
  if (!y || !m || !d) return '';
  // Noon, so no timezone can shift the day — the same guard the diary uses.
  const when = new Date(y, m - 1, d, 12);
  return `Back here ${when.toLocaleDateString('en-GB', { weekday: 'long' })} ${ordinalDay(d)}`;
}

/**
 * What the last slide should say tonight, or nothing at all.
 *
 * @returns {{text: string, date: string, link: string} | null}
 */
export function comeBackFor({ venue, venues = [], bookings = [], now = Date.now() } = {}) {
  const record = venues.find(
    (v) => String(v && v.name || '').trim().toLowerCase() === String(venue || '').trim().toLowerCase());
  const link = String(record && record.link || '').trim();
  const next = nextNightAt({ venue, venues, bookings, now });

  /*
   * A LINK ON ITS OWN IS STILL WORTH A SLIDE, but a date is what makes it one.
   * A venue with a link and no usual night gets "Find us at…" rather than
   * nothing — that is a pub with an events page and an irregular quiz, which
   * is a real arrangement. Neither means no slide.
   */
  if (!next && !link) return null;
  return {
    text: next ? comeBackText(next.date) : 'See what else is on',
    date: next ? next.date : '',
    link,
  };
}
