/**
 * THE INSTAGRAM EXPORT — a photograph with the venue's own frame on it.
 *
 * *"I upload, say, 90 photos. I pick the best four or the best three… those
 * three are then also taken onto the Instagram."* This is that press: the
 * pub's overlay over the picture, the app's mark on top, out through the share
 * sheet.
 *
 * **A LEAF WITH NO PAGE OF ITS OWN**, like `photo-save.js` and
 * `camera-sheet.js`. It holds no state, fetches what it needs on the press and
 * is handed the night it is acting on — so importing it cannot run another
 * page's boot code, which is the fault `console-packs.js` reaching into
 * `editor.js` once caused.
 *
 * **IT IS HERE RATHER THAN ON THE PUBLIC GALLERY, AND THE REASON IS THE
 * ROUTE.** The overlay lives behind `/api/invoices/customers/<id>/overlay`,
 * scoped to the signed-in quizmaster's own invoice book — a visitor saving a
 * picture off `/gallery` cannot reach it and must not be able to. Putting the
 * framed export on the console needs no new public route and no new gate, and
 * it is where the person doing the picking already is. **The public page keeps
 * the plain watermark it has always had.**
 *
 * **THE STORED PHOTOGRAPH IS NEVER TOUCHED.** The frame is drawn at SAVE time
 * in the browser, exactly as the watermark beside it already was, so the
 * original in the private repo stays clean and a venue that redesigns its
 * artwork changes every future export rather than needing the night uploading
 * again.
 */

import { node } from './client.js';
import { me } from './console-state.js';
import { savePhoto, saveName } from './photo-save.js';
import { invoiceApi } from './console-invoices.js';

/**
 * The venue's frame, or an empty string.
 *
 * **FETCHED ON THE PRESS, never with the grid.** It is up to 512KB and most
 * nights nobody exports anything, so paying for it on every render would be a
 * photograph's worth of traffic to draw a button.
 *
 * Matched on the NAME, because a filed night carries the pub it was played at
 * rather than an invoice-book id — the same join `heardHere()` makes, and the
 * same reason `sameVenue()` exists. A night with no venue on it, or a pub with
 * no artwork uploaded, quietly gets no frame.
 */
export async function venueFrame(venueName, records) {
  const want = String(venueName || '').trim().toLowerCase();
  if (!want) return '';
  const rec = (records || []).find(
    (v) => String(v.name || '').trim().toLowerCase() === want && v.hasOverlay,
  );
  if (!rec) return '';
  try {
    const got = await invoiceApi(`/api/invoices/customers/${encodeURIComponent(rec.id)}/overlay`);
    return (got && got.overlay) || '';
  } catch {
    // A frame that will not fetch costs the FRAME, never the photograph.
    return '';
  }
}

/**
 * Hang the save control inside an opened photograph.
 *
 * **ON THE BIG PICTURE ONLY, never one per tile** — the rule `photo-save.js`
 * already carries, and for the same reason: ninety save buttons on a grid is
 * ninety chances to press the wrong one.
 *
 * **IT TAKES THE URL ALREADY KEYED.** A photograph's own route re-checks who
 * is asking, so a bare `/api/photo/...` loads in an `<img>` on the page (the
 * browser sends the cookie) and then FAILS inside `savePhoto`, which builds
 * its own `Image` with `crossOrigin = 'anonymous'` and therefore sends
 * nothing. The picture on screen is fine and the save throws — caught in a
 * real browser and by nothing else.
 */
export function framedSaveInto(into, url, night, records) {
  const saver = node('<span class="gal-save community-save" role="button" tabindex="0">'
    + 'Save with the venue frame</span>');
  const venue = (night && night.venue) || '';

  const save = async (ev) => {
    // The picture itself closes on a click; the button inside it must not.
    ev.stopPropagation();
    if (saver.dataset.busy) return;
    saver.dataset.busy = '1';
    saver.textContent = 'Saving…';
    let overlay = '';
    try {
      overlay = await venueFrame(venue, records);
    } catch { /* unframed beats nothing */ }
    /*
     * IT SAYS WHICH IT DID. A photograph that saves without the frame looks
     * identical to one that saved with a frame nobody set up, and the second
     * is a thing to go and fix on the Venues tab — so the button names it
     * rather than leaving somebody to wonder why Instagram looks plain.
     */
    saver.textContent = overlay ? 'Saving with the frame…' : 'Saving — no frame on this pub…';
    try {
      const went = await savePhoto(url, {
        words: String((me && (me.brand || me.name)) || ''),
        filename: saveName(venue, (night && night.night) || '', 0, ''),
        overlay,
      });
      /*
       * `savePhoto` answers FALSE when nothing actually left — a share sheet
       * somebody dismissed, or a browser that can do neither. Saying "Saved"
       * there is this repo's commonest fault: a control reporting a success it
       * did not have.
       */
      saver.textContent = went === false ? 'Nothing was saved' : 'Saved';
    } catch {
      saver.textContent = 'That would not save — try again';
    }
    setTimeout(() => {
      saver.textContent = 'Save with the venue frame';
      delete saver.dataset.busy;
    }, 2600);
  };

  saver.addEventListener('click', save);
  saver.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') save(ev);
  });
  into.appendChild(saver);
  return saver;
}

