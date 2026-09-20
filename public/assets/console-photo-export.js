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

import { node, esc } from './client.js';
import { library, me } from './console-state.js';
import { captionFor } from './insta-caption.js';
import { upcoming } from './diary.js';
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
        // The console is a laptop — straight to Downloads, not the share sheet.
        share: false,
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
 * THE WHOLE POST KIT — the caption, one press that saves the three framed, and
 * a mark saying it has gone out.
 *
 * **IT DRAWS NO PREVIEW OF THE THREE, and that is a deliberate removal.** It
 * had one — the showcase strip, drawn framed, so the overlay could be judged
 * before posting — and the grid above then grew a *Showcase* band of its own.
 * *"There's a showcase bit at the top which makes the showcase bit at the
 * bottom defunct, and they disagree anyway."* Both halves are right: two
 * displays of one thing is the collision this app renames controls over, and
 * they genuinely parted — the band draws what is STARRED, the strip drew
 * `cover`, which `coverPhotos()` fans out to three whatever you starred. So
 * one star showed one tile up there and three framed pictures down here.
 *
 * **THE COST, ACCEPTED: the venue's frame is no longer previewed.** The save
 * still composites it, and the button says which pub had one. Put the strip
 * back only beside the band rather than below it, or this returns.
 *
 * *"I want to use the showcase photos as the photos I post to Instagram, I
 * want a quick workflow for this purpose."*
 *
 * **INSTAGRAM IS NOT POSTED TO FROM HERE AND NEVER WILL BE.** There is no
 * publishing API for a personal account — Meta's needs a Business or Creator
 * account, a linked Page and an app review — and the rule this app already
 * follows says it anyway: *do not build a send that skips the reading*. So
 * the shape is `reply-draft.js`'s, for the third time: **the app prepares,
 * the human reads, the human posts.**
 *
 * **ONE PRESS DOES BOTH HALVES**, because the two halves are useless apart:
 * three files in Downloads with no words, or words with no pictures. It puts
 * the caption on the clipboard and saves the three, so what is left is
 * dragging them into instagram.com and pressing paste. The caption is ABOVE
 * the button and editable — that is the reading, and it is the point.
 *
 * **THE CLIPBOARD CAN BE REFUSED AND THE PHOTOS STILL GO.** A browser can
 * decline a clipboard write; losing the caption is a paste away from fixed,
 * and a press that did nothing because of it would be the control-that-reports-
 * success fault wearing a permission prompt.
 *
 * @param {string} address the night's public gallery URL, or '' — passed IN
 *                         rather than built here: `galleryAddress()` lives in
 *                         `console-gigs.js`, which imports THIS file, and two
 *                         copies of one URL is a link that 404s in one place.
 */
export function showcaseInto(into, night, records, keyedUrl, address = '') {
  const kit = postKitInto(into, night, address);
  const save = showcaseSaveInto(into, night, records, keyedUrl, kit);
  postedInto(into, night, keyedUrl);
  return save;
}

/**
 * The caption, drafted and editable. Returns `{ copy() }` so the save button
 * can take the words with it — ONE press for the whole post.
 */
export function postKitInto(into, night, address = '') {
  const draft = captionFor({
    night,
    gallery: address,
    // The diary's own projection — residencies forward, one-offs typed, nights
    // off removed. Asking it rather than keeping a second idea of "next
    // Thursday" is what stops the caption and the calendar disagreeing.
    nextNight: () => upcoming({
      venues: (library && library.venueRecords) || [],
      bookings: (library && library.bookings) || [],
      weeks: 6,
    }),
  });
  const wrap = node(`<div class="insta-kit">
    <div class="tiny">The caption — read it, change it, it goes with the photos.</div>
    <textarea class="insta-cap" rows="8" spellcheck="true">${esc(draft)}</textarea>
  </div>`);
  const box = wrap.querySelector('.insta-cap');
  into.appendChild(wrap);
  return {
    words: () => box.value,
    copy: async () => {
      try {
        await navigator.clipboard.writeText(box.value);
        return true;
      } catch {
        /*
         * A REFUSED CLIPBOARD IS NOT A FAILED PRESS. Selecting the text is the
         * honest fallback — one ⌘C away, rather than a button that reports
         * nothing happening.
         */
        try { box.focus(); box.select(); } catch { /* nothing left to try */ }
        return false;
      }
    },
  };
}

/**
 * HAS THIS NIGHT GONE OUT? — a mark, never a gate.
 *
 * The half that costs a Monday is not the posting, it is remembering which
 * nights are still to do. Nothing reads this to refuse anything: a night
 * marked posted can be posted again, and one that is not is never nagged
 * about. **A feature that generates a QUEUE somebody has to work is expensive;
 * one that serves itself is cheap** — so the rail can say what is outstanding
 * and the pile shrinks on its own.
 */
export function postedInto(into, night, keyedUrl) {
  const row = node(`<div class="insta-posted">
    <button class="minor insta-done" type="button"></button>
    <a class="minor" href="https://www.instagram.com/" target="_blank" rel="noopener">Open Instagram</a>
  </div>`);
  const btn = row.querySelector('.insta-done');
  let on = Boolean(night && night.posted);
  const paint = () => {
    btn.classList.toggle('is-on', on);
    btn.textContent = on ? 'Posted ✓' : 'Mark as posted';
    btn.title = on
      ? 'You have posted this night. Click to take the mark off.'
      : 'Marks this night done, so the list can say which are still to post.';
    btn.setAttribute('aria-pressed', String(on));
  };
  paint();
  btn.addEventListener('click', async () => {
    // The same optimistic pattern as the lamps: flip now, settle on the reply,
    // and put it back with a reason rather than a silent revert.
    const was = on;
    on = !on;
    paint();
    try {
      const res = await fetch(keyedUrl('/api/past-gigs/posted'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ night: night.night, on }),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))).error) || 'Could not save that.');
      document.dispatchEvent(new CustomEvent('night-posted-changed', { detail: { night: night.night, on } }));
    } catch (err) {
      on = was;
      paint();
      btn.title = err.message;
    }
  });
  into.appendChild(row);
  return row;
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
export function showcaseSaveInto(into, night, records, keyedUrl, kit = null) {
  const cover = (night && Array.isArray(night.cover) ? night.cover : []).filter(Boolean);
  if (!cover.length) return null;
  const ready = kit ? `Copy the caption &amp; save the ${cover.length}` : `Save the showcase (${cover.length})`;
  const btn = node(`<button class="minor showcase-save" type="button">${ready}</button>`);

  btn.addEventListener('click', async () => {
    if (btn.disabled) return;
    btn.disabled = true;
    /*
     * THE CLIPBOARD FIRST, INSIDE THE GESTURE. A browser only allows a
     * clipboard write while it still believes a person is pressing something,
     * and three photographs later it does not.
     */
    const copied = kit ? await kit.copy() : null;
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
          // Straight to the Downloads folder, one after another — no share sheet.
          share: false,
        });
        if (ok !== false) went += 1;
      } catch { /* one that will not save must not stop the other two */ }
    }
    const words = copied === null ? '' : copied ? ' · caption copied' : ' · caption NOT copied, it is selected above';
    btn.textContent = went === cover.length
      ? `Downloaded ${went}${overlay ? ' with the frame' : ' — no frame on this pub'}${words}`
      : `Downloaded ${went} of ${cover.length}${words}`;
    setTimeout(() => {
      btn.innerHTML = ready;
      btn.disabled = false;
    }, 3200);
  });

  into.appendChild(btn);
  return btn;
}
