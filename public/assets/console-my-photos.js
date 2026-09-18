/**
 * ADD YOUR OWN PHOTOGRAPHS TO A NIGHT — the quizmaster's, not the room's.
 *
 * A LEAF, and it was taken out of `console-community.js` when that file hit
 * its line budget. It has no page and no state of its own: the caller hands it
 * a night, says whether it is drawing in a bay head or in a panel, and gets
 * told when something landed. Past gigs can have it whenever somebody asks for
 * it there, which it could not while it lived inside the Community door.
 *
 * **`wallShots` DID NOT COME WITH IT.** That binding is the Community door's
 * cache of the photo wall, and a leaf reaching back into the page that imports
 * it is the import cycle this repo keeps recording. The caller passes
 * `onAdded` and drops its own wall — which is also the honest shape, because
 * a second door would have a different thing to forget.
 */

import { node, esc } from './client.js';
import { shrinkPhoto } from './filters.js';
import { keyed } from './console.js';


/**
 * THE QUIZMASTER'S OWN PHOTOGRAPHS OF THE ROOM.
 *
 * Asked for on 29 August 2026: *"would be good to be able to add room photos
 * to the gallery that everyone sees, that I take from my own phone?"*
 *
 * **THE ROOM'S CAMERA IS SIXTY PHONES POINTED AT EACH OTHER.** What a venue
 * wants to be shown is the place FULL — the bar three deep, forty heads
 * looking at a projector — and that is a picture only the person at the front
 * takes. Every photo the gallery has ever held came in through a player's
 * phone, so the one shot that actually sells the night was the one with no way
 * in.
 *
 * **IT IS FILED AGAINST THE NIGHT IN THE URL, never against today.** The
 * room's own photo store dates a picture by the clock when it lands, so
 * anything sent on the Friday would file itself under the Friday. Naming the
 * night is what lets him do this in the car park, or on the Monday.
 *
 * **SCALED DOWN HERE, BEFORE IT IS SENT.** A modern phone photograph is five
 * to eight megabytes and the route caps at three — and this is a quizmaster on
 * pub wifi, which is the connection this app protects above all others.
 * `square: false`, unlike a player's photo: a picture of a room is a room, and
 * cropping it to a square for a wall of thumbnails would throw away the half
 * that shows how full it was.
 *
 * **ONE AT A TIME, IN ORDER, with the count going up as they land.** Firing
 * six at once is six GitHub writes racing on one folder, and a progress line
 * that only moves at the end reads as a page that has hung.
 */
/*
 * **AND IT SITS IN THE BAY HEAD NOW, NOT IN THE TAB BODY** — *"if that already
 * exists can we put it in a more obvious place."*
 *
 * It was in the night's row in the list UNDERNEATH, which is a different
 * region of the page from the photographs it adds to: to find it you had to
 * scroll past the bay you were looking at, find the open night in the list and
 * look inside it. Perfectly placed by the rule and perfectly invisible.
 *
 * **THIS IS A STATED EXCEPTION TO *the bottom is controls, the top displays
 * the thing*, and it is the rail lamp's exception again.** What kept that one
 * honest was that the lamp also PICKED — the photographs landed in the bay as
 * it acted, so nothing happened out of sight. The same holds here: the head is
 * the open night's own identity line, and what this button adds appears in the
 * bay directly under it. **One control, beside the one link.** A second action
 * up there starts a collection, and then the rule has gone rather than bent.
 *
 * `compact` is how: in the head it is a button the size of the live link with
 * its own progress in its label, because a separate status line in a baseline
 * flex row would drop the head onto two lines the moment it said anything.
 */
export function myPhotos(night, { compact = false, onAdded = () => {}, why = '' } = {}) {
  /*
   * **PRESENT AND INERT, NEVER ABSENT** — the rule this app already sets for
   * Launch and for *Keep this as a show*, both of which were built appearing
   * and disappearing and both of which were reported as clunky in the same
   * words: *a control that comes and goes is one you cannot learn the position
   * of.*
   *
   * It was missed here, and the report was the plainest kind — a screenshot of
   * the wall with *"where is it? couldn't find it?"* on it. The wall is what
   * this tab OPENS on, so the first thing anybody sees is the one view with no
   * control in it, and the way to make it appear is to pick a night in a rail
   * that gives no hint it is the way in.
   *
   * So the head carries the button either way, and **the reason it is off goes
   * ON it** rather than floating beside it — the other half of the same rule.
   */
  if (why) {
    const off = node(`<span class="mine-pick is-head is-off" aria-disabled="true"
      title="${esc(why)}">${esc(why)}</span>`);
    return off;
  }
  const wrap = compact
    ? node(`
      <label class="mine-pick is-head">
        Add photos
        <input type="file" accept="image/*" multiple hidden>
      </label>`)
    : node(`
      <div class="mine-add">
        <label class="minor mine-pick">
          Add your own photos
          <input type="file" accept="image/*" multiple hidden>
        </label>
        <span class="tiny mine-said">Yours go on the gallery — they are what sells the night.</span>
      </div>`);
  const input = wrap.querySelector('input');
  const label = compact ? wrap : wrap.querySelector('.mine-pick');
  /*
   * THE LABEL IS THE STATUS LINE IN THE HEAD. `firstChild` is the text node —
   * replacing the whole label would take the file input out with it, and a
   * control that eats its own input on the first press is a control that works
   * exactly once.
   */
  const rest = compact ? 'Add photos' : '';
  const said = compact
    ? { set textContent(words) { label.firstChild.nodeValue = ` ${words || rest} `; } }
    : wrap.querySelector('.mine-said');

  input.addEventListener('change', async () => {
    const files = [...(input.files || [])];
    input.value = '';
    if (!files.length) return;
    label.classList.add('is-busy');
    let done = 0;
    for (const file of files) {
      said.textContent = `Sending ${done + 1} of ${files.length}…`;
      try {
        const blob = await shrink(file);
        const res = await fetch(keyed(`/api/past-photo/${encodeURIComponent(night.night)}`), {
          method: 'POST',
          headers: { 'Content-Type': 'image/jpeg' },
          body: blob,
        });
        const out = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(out.error || 'Could not add that one.');
        done += 1;
      } catch (err) {
        said.textContent = err.message;
        label.classList.remove('is-busy');
        return;
      }
    }
    said.textContent = `${done} added.`;
    label.classList.remove('is-busy');
    // In the head the label IS the status, so it has to go back to saying what
    // it does — otherwise the control is named "3 added" for the rest of the
    // evening. The wordy form keeps its own line and needs no timer.
    if (compact) setTimeout(() => { said.textContent = rest; }, 3000);
    /*
     * THE WALL IS STALE NOW, so it is dropped rather than left showing the
     * night as it was a moment ago — the one thing worse than a slow wall is
     * one that does not have the picture you just watched it accept.
     */
    onAdded();
  });
  return wrap;
}

/**
 * A phone photograph, down to something a pub's wifi can carry.
 *
 * `shrinkPhoto()` in `filters.js` holds the numbers now — the quizmaster's own
 * camera on the control view wants the identical ones, and this app's oldest
 * lesson is that two copies is one that gets a number changed.
 */
function shrink(file) {
  return shrinkPhoto(file);
}
