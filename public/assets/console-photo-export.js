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
import { framedBlob, savePhoto, saveName } from './photo-save.js';
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


/**
 * SAVE THE NIGHT'S SHOWCASE — the three the public index already fans out.
 *
 * *"Per night I want to be able to choose three showcase photos that get the
 * overlay that I can then post to socials"*, and then the half that decides
 * the shape: *"it should be the same three showcase photos that are used for
 * this purpose."*
 *
 * **SO IT DOES NOT PICK ANYTHING.** The choosing already exists — the pin on
 * each photograph, capped at `MAX_PINS`, which is what `coverPhotos()` reads
 * to build the night's card on the gallery. A second "showcase" list here
 * would be a second answer to one question, and the two would part on the
 * first night somebody re-pinned. The server SENDS `cover`; this walks it.
 *
 * **ONE AT A TIME, AWAITED.** Three simultaneous canvases is three copies of a
 * 1080-square photograph plus the frame in memory on a laptop that is also
 * running a quiz, and a browser given three downloads in one tick drops two of
 * them. Slower and all three arrive.
 *
 * **IT COUNTS WHAT ACTUALLY LEFT**, never what it tried: `savePhoto()` answers
 * false when a share sheet was dismissed, and "Saved 3" over two files is this
 * repo's commonest fault wearing a number.
 */
/**
 * THE SHOWCASE, AS IT WILL POST — the three the night leads with, drawn with
 * the venue's frame and the mark, from the SAME drawing the export saves.
 *
 * Asked for after the star: *"can I also have a view where I can see the
 * three showcase photos with the overlay"*. A framed picture cannot be judged
 * from a thumbnail with a corner lamp on it, and the alternative was saving
 * three files to look at them. It redraws when a star changes
 * (`photo-pins-changed`, fired by the tile) — a preview that shows last
 * minute's three is worse than none.
 */
export function showcasePreviewInto(into, night, records, keyedUrl) {
  const strip = node(`<div class="showcase-strip">
    <div class="tiny showcase-said">The showcase, framed — what the gallery leads with and the export saves.</div>
    <div class="showcase-row"></div>
  </div>`);
  const row = strip.querySelector('.showcase-row');
  const said = strip.querySelector('.showcase-said');
  const words = String((me && (me.brand || me.name)) || '');
  let run = 0;

  const draw = async (cover) => {
    const mine = ++run;
    const names = (Array.isArray(cover) ? cover : []).filter(Boolean);
    if (!names.length) {
      row.replaceChildren();
      said.textContent = 'Star up to three photos and they show here, framed.';
      return;
    }
    let overlay = '';
    try { overlay = await venueFrame((night && night.venue) || '', records); } catch { /* unframed */ }
    if (mine !== run) return;
    said.textContent = overlay
      ? 'The showcase, framed — what the gallery leads with and the export saves.'
      : 'The showcase — no frame on this pub yet, so these post plain.';
    const pics = await Promise.all(names.map(async (name) => {
      try {
        const blob = await framedBlob(keyedUrl(`/past-photo/${encodeURIComponent(night.night)}/${encodeURIComponent(name)}`), { words, overlay });
        return blob ? URL.createObjectURL(blob) : '';
      } catch { return ''; }
    }));
    if (mine !== run) return;
    row.replaceChildren(...pics.filter(Boolean).map((src) => node(`<img class="showcase-pic" src="${src}" alt="">`)));
  };

  draw(night && night.cover);
  document.addEventListener('photo-pins-changed', async (ev) => {
    if (!strip.isConnected) return;
    if (ev.detail && ev.detail.night && ev.detail.night !== night.night) return;
    // The cover is decided on the SERVER (pins first, then a spread), so ask
    // it rather than guess which three a new star displaced.
    try {
      const res = await fetch(keyedUrl(`/api/past-gigs/${encodeURIComponent(night.night)}`));
      const data = res.ok ? await res.json() : null;
      if (data) draw(data.cover);
    } catch { /* the strip keeps what it had */ }
  });
  into.appendChild(strip);
  return strip;
}

/** The strip and the save button together — one call for the Community bay. */
export function showcaseInto(into, night, records, keyedUrl) {
  showcasePreviewInto(into, night, records, keyedUrl);
  return showcaseSaveInto(into, night, records, keyedUrl);
}

export function showcaseSaveInto(into, night, records, keyedUrl) {
  const cover = (night && Array.isArray(night.cover) ? night.cover : []).filter(Boolean);
  if (!cover.length) return null;
  const btn = node(`<button class="minor showcase-save" type="button">Save the showcase (${cover.length})</button>`);

  btn.addEventListener('click', async () => {
    if (btn.disabled) return;
    btn.disabled = true;
    const venue = (night && night.venue) || '';
    let overlay = '';
    try {
      overlay = await venueFrame(venue, records);
    } catch { /* unframed beats nothing */ }
    let went = 0;
    for (const [i, name] of cover.entries()) {
      btn.textContent = `Saving ${i + 1} of ${cover.length}…`;
      try {
        const ok = await savePhoto(keyedUrl(`/past-photo/${encodeURIComponent(night.night)}/${encodeURIComponent(name)}`), {
          words: String((me && (me.brand || me.name)) || ''),
          filename: saveName(venue, night.night || '', i, ''),
          overlay,
        });
        if (ok !== false) went += 1;
      } catch { /* one that will not save must not stop the other two */ }
    }
    btn.textContent = went === cover.length
      ? `Saved ${went}${overlay ? ' with the frame' : ' — no frame on this pub'}`
      : `Saved ${went} of ${cover.length}`;
    setTimeout(() => {
      btn.textContent = `Save the showcase (${cover.length})`;
      btn.disabled = false;
    }, 3200);
  });

  into.appendChild(btn);
  return btn;
}
