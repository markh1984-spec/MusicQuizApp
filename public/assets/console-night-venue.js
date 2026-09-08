/**
 * WHERE A PAST NIGHT WAS — said afterwards, when nobody typed it at launch.
 *
 * ---
 *
 * Asked for on 8 September 2026, off a Community rail with a batch of
 * photographs sitting under *"No venue on these"*: *"all of these were taken
 * at the same venue but the last ones have no venue attached?"*, and then, of
 * how to stop it recurring, *"let me set the venue on a past night"* and *"is
 * it possible to just make the photo set draggable to a venue?"*
 *
 * **BOTH WAYS IN LIVE HERE, so they cannot come to mean different things.**
 * The drag says it by moving a night under another pub's heading; the picker
 * says it in words under the photographs. One `saveNightVenue()` underneath
 * them is the same discipline the publish lamp already follows — one place
 * that answers what a press means, because the rail, the control and the
 * repaint all run at different moments.
 *
 * **IT IS A LEAF.** It knows about nights, venues and one route; the Community
 * door hands it the way to say something went wrong, rather than this file
 * reaching back into that one's state. An ES import is a read-only view, so a
 * module cannot write another's binding anyway — and a callback is the honest
 * version of what that rule is asking for.
 */

import { esc, node } from './client.js';
import { keyed, renderKeepingPlace } from './console.js';
import { library } from './console-state.js';

/**
 * THE ONE HEADING IN THE PHOTOS RAIL THAT IS NOT A PUB.
 *
 * Named rather than typed twice, because the drop handler has to be able to
 * tell it apart from a real venue — a night dropped onto it would be asking to
 * un-say where it was, and a string compared against a literal in one place
 * and a variable in another is how those two come to disagree.
 */
export const NO_VENUE = 'No venue on these';

/**
 * AND WHAT THE PICKER SAYS WHEN THERE IS NO PUB ON A NIGHT — the SAME words
 * `whyNoVenue()` prints under the row in the rail.
 *
 * It read *"Not said"*, which is two labels for one fact on one screen: the
 * rail's note four inches away already called it *"No venue set"*. That is the
 * rename this project's first rule asks for rather than an argument about
 * which phrase is nicer — and here it is one constant, so they cannot drift
 * apart again.
 */
const NO_VENUE_SET = 'No venue set';

/**
 * WHY A NIGHT HAS NO PUB ON IT — because FOUR different things put a row into
 * "No venue on these" and every one of them drew the same silent row.
 *
 * The host asked *"all of these were taken at the same venue but the last ones
 * have no venue attached?"*, and the honest answer was that the rail could not
 * tell him: a cross-room join miss, a night that never reached its final
 * scores, a launch with no venue picked and two venues on one date were
 * indistinguishable. The first is fixed at the route (`gigRoomsFor()`); the
 * other three are real states a host can act on, so the row says which.
 *
 * **"No results saved" IS POST GIG'S OWN WORDING**, not a second phrase for
 * one fact — `gigRowMarkup()` has printed it against an unfiled night for as
 * long as that door has existed.
 *
 * Silent whenever there is a venue, which is almost always.
 */
export function whyNoVenue(night) {
  if (night.venue) return '';
  // Two games at genuinely different venues: `mergeGigs()` blanks the venue
  // rather than misattribute the evening to whichever was typed first.
  if (night.venueMixed) return 'Two venues';
  // Nothing was ever filed for this date, so there is no record to carry a
  // venue — the night was stopped early, or it restarted before the end.
  if (!(night.games || []).length) return 'No results saved';
  // It was filed, and no venue was chosen when it launched. The bar
  // deliberately does not remember one between nights.
  return NO_VENUE_SET;
}

/**
 * WHERE A PAST NIGHT WAS — the tap half of the drag onto a pub heading.
 *
 * ---
 *
 * Asked for on 8 September 2026, off a rail with a batch of photographs under
 * *"No venue on these"*: *"let me set the venue on a past night"*.
 *
 * **IT IS NOT THE DRAG'S POOR RELATION, AND THERE ARE TWO REASONS.** HTML5
 * drag events never fire on touch, which is this app's standing rule for every
 * drag it has. And the rail only draws pubs that already have a photographed
 * night under them, so a venue you have never photographed at is not a heading
 * anybody can drop onto — this list is the book, so it has all of them.
 *
 * **CHOOSING IS THE DECISION; there is no Save beside it.** A second press
 * would be a second chance to get it wrong rather than a safeguard, and this
 * is a field, not a publish — pick the wrong pub and picking the right one is
 * the whole of the fix.
 *
 * **THE ROW IS CORRECTED IN PLACE RATHER THAN RE-FETCHED.** The night's venue
 * is the one field that changed, and re-reading the whole archive to learn
 * something we just typed is a request nobody needs — the same reasoning the
 * publish lamp already follows one function up.
 */
export function venuePicker(night) {
  const choices = venueChoices();
  const here = String(night.venue || '');
  const wrap = node(`
    <div class="night-venue">
      <label for="nightVenuePick">Where this was</label>
      <select id="nightVenuePick" class="night-venue-pick">
        <option value="">${esc(here || NO_VENUE_SET)}</option>
        ${choices
    .filter((v) => v.name.toLowerCase() !== here.toLowerCase())
    .map((v) => `<option value="${esc(v.id || v.name)}">${esc(v.name)}</option>`)
    .join('')}
      </select>
      <span class="tiny night-venue-said">${esc(choices.length
    ? 'It goes onto this night\u2019s record, and onto the gallery address.'
    : 'No venues yet \u2014 they arrive as you run nights and bill for them.')}</span>
    </div>`);
  const pick = wrap.querySelector('select');
  pick.addEventListener('change', () => {
    const want = choices.find((v) => (v.id || v.name) === pick.value);
    if (!want) return;
    saveNightVenue(night, want, wrap.querySelector('.night-venue-said'));
  });
  return wrap;
}

/**
 * EVERY PUB THIS QUIZMASTER HAS, FROM BOTH LISTS — the invoice book's
 * customers first, because those are the ones carrying an id.
 *
 * `venueKeyOf()` on the server prefers an id and falls back to the lowercased
 * name, so sending the id where there is one is what stops the same pub
 * splitting into two seasons on the league — the fault reported as *"The
 * Station Tap, Wokingham"* appearing twice. A venue that only exists in the
 * archive has no id to send and matches by name, exactly as it always has.
 */
export function venueChoices() {
  const out = [];
  const seen = new Set();
  for (const record of (library && library.venueRecords) || []) {
    const name = String(record.name || '').trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push({ id: String(record.id || ''), name });
  }
  for (const name of (library && library.venues) || []) {
    const clean = String(name || '').trim();
    if (!clean || seen.has(clean.toLowerCase())) continue;
    seen.add(clean.toLowerCase());
    out.push({ id: '', name: clean });
  }
  return out;
}

/**
 * SAY WHERE A NIGHT WAS, from either way in.
 *
 * One function because the drag and the picker must not be able to disagree
 * about what a pick means — the rule this file already follows for the publish
 * lamp, whose local truth and server truth are answered in one place.
 *
 * **A FAILED WRITE SAYS SO WHERE THE PRESS HAPPENED**, and leaves the night as
 * it was. Never an `alert`, and never a silent revert.
 */
export async function saveNightVenue(night, venue, said = null, onTrouble = () => {}) {
  if (said) said.textContent = 'Saving\u2026';
  try {
    const res = await fetch(keyed('/api/past-gigs/venue'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ night: night.night, venue: venue.name, venueId: venue.id || '' }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || 'Could not save that.');
    night.venue = venue.name;
    night.venueId = venue.id || '';
    // Two venues on one date was one of the four reasons a row had no pub on
    // it; naming one settles that too, and the note under the row is built
    // from these three fields.
    night.venueMixed = false;
    onTrouble('');
  } catch (err) {
    // Under the picker when there is one; otherwise in the rail, under the
    // row the drag landed on — which is where `pubTrouble` already draws.
    if (said) { said.textContent = err.message; return; }
    onTrouble(err.message);
  }
  // The rail regroups the night under its pub, and the bay head names it.
  renderKeepingPlace();
}

/**
 * A NIGHT LET GO OVER A PUB'S HEADING.
 *
 * The heading a night sits under IS its venue, so dropping it on another one
 * is the whole statement — there is nothing else to ask.
 *
 * **A HEADING THAT IS NOT A PUB TAKES NOTHING.** Dropping onto *"No venue on
 * these"* would be asking to un-say where a night was, which nobody wants and
 * which the rail already refuses to light up for.
 */
export function nightDroppedOnPub(night, group, onTrouble) {
  if (!night || group === NO_VENUE) return;
  // A pub already in the book brings its id, which is what stops one venue
  // splitting into two seasons on the league — see `venueChoices()`.
  const known = venueChoices().find((v) => v.name.toLowerCase() === group.toLowerCase());
  saveNightVenue(night, known || { id: '', name: group }, null, onTrouble);
}
