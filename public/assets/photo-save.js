/**
 * SAVING A PHOTOGRAPH OFF THE GALLERY, WITH WHOSE NIGHT IT WAS ON IT.
 *
 * ---
 *
 * Asked for as *"would be kinda cool to allow venues to download photos from
 * their own nights for use on socials?"* — and the first thing to say is that
 * they already could. A published gallery is a web page with `<img>` on it, so
 * a landlord has always been one long-press away from a photograph. **What was
 * missing was not permission, it was the quizmaster's name on the copy that
 * ends up on the pub's Facebook page.**
 *
 * That makes this a rule-4 feature rather than a convenience one: the pub does
 * the posting and the marketing lands on the person who ran the night. A save
 * button with nothing on the file would have been the convenience half alone.
 *
 * **NO NEW GATE, BECAUSE THERE IS NOTHING NEW TO GATE.** The photo route
 * already refuses an unpublished night and re-checks `showsOnGallery()` for
 * itself; this reads a picture the browser has already been given. A gate here
 * would be theatre over a URL anybody can type, which is the shape of lie this
 * repo has a rule against.
 *
 * **IT IS DRAWN IN THE BROWSER, NOT ON THE SERVER.** Stamping server-side means
 * decoding and re-encoding a JPEG, which with no dependencies means writing a
 * JPEG codec. The canvas is already how this app does pixel work — the picture
 * round's reveals, the photo props, the venue logo — and here it costs the
 * server nothing at all, which is the rule a gallery is already held to: **paid
 * for once, not per photo and not per visitor.**
 *
 * **THE SHARE SHEET FIRST, THE DOWNLOAD SECOND.** On a phone a `download`
 * attribute opens the picture in a tab and leaves somebody to long-press it
 * again — which is the thing this was meant to replace. `navigator.share()`
 * with a file gives iOS its own *Save Image*, and it is how invoices already
 * leave this app. The anchor stays as the laptop's path and the fallback.
 */

import { quizMark } from './brandmark.js';

/**
 * WHAT THE FILE IS CALLED, AND IT IS NOT THE STORED NAME.
 *
 * A photo on disk is named for the room and the moment it arrived, which is
 * meaningless in a downloads folder and says more about the app's internals
 * than anybody needs. This says the pub, the night and which one — the three
 * things somebody sorting through forty of them next Tuesday actually wants.
 *
 * Lowercased, stripped to letters, digits and hyphens: a venue is typed
 * freehand, so it can hold anything, and a filename is one of the few places
 * in this app where a slash is not merely ugly.
 */
export function saveName(venue, night, at, appName = '') {
  const slug = (s) => String(s || '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const parts = [slug(appName), slug(venue), slug(night), String(Number(at) + 1)]
    .filter(Boolean);
  // Never empty, never just a number: a bare "3.jpg" in a downloads folder is
  // the same problem as the stored name, wearing a friendlier face.
  return `${parts.length > 1 ? parts.join('-') : `photo-${parts.join('-') || '1'}`}.jpg`;
}

/**
 * HOW BIG THE MARK IS, AND WHY IT IS NOT A FIXED NUMBER.
 *
 * These photographs arrive from whatever phone was in the room, so the same
 * pixel size is a shout on one and invisible on the next. It scales with the
 * SHORT side — the long one is just how the phone was held — and is clamped at
 * both ends: too small survives nothing, and too large is a quizmaster putting
 * his own name over somebody's face, which is the opposite of what a pub wants
 * to post.
 */
export function markSize(w, h) {
  return Math.max(13, Math.min(44, Math.round(Math.min(w, h) / 26)));
}

/*
 * The mark as a loaded `<img>`, or null if it will not.
 *
 * **IT IS A PROMISE, AND THAT IS NOT A STYLE CHOICE.** The first version set
 * `src` and returned the element, then the drawing checked `complete` — which
 * on a first save is ALWAYS false, because nothing had awaited it. So the plate
 * and the words appeared and **the logo never did**, on every first save, for
 * everybody; the degrade-rather-than-die branch below quietly became the only
 * branch. Found by looking at the saved file rather than at the code.
 *
 * Cached, because one save of eighteen photographs should not decode the same
 * drawing eighteen times.
 */
let markImg = null;
function loadMark() {
  if (markImg) return markImg;
  let svg = '';
  try {
    svg = quizMark({ size: 96 });
    /*
     * THE QUIZMASTER'S OWN TWO COLOURS, PUSHED IN AS A STYLE.
     *
     * `quizMark()` writes `var(--hot, <hex>)` into its gradient stops, and the
     * fallback is deliberate — it is served as `/favicon.svg`, a standalone
     * document with no stylesheet. A data URI is standalone in exactly the same
     * way, so without this the mark on a photograph would come out in the
     * app's default colours rather than theirs. It is set on the ROOT, where a
     * custom property inherits down to the stops.
     */
    const css = getComputedStyle(document.documentElement);
    const hot = css.getPropertyValue('--hot').trim();
    const hot2 = css.getPropertyValue('--hot-2').trim();
    if (hot && hot2) {
      svg = svg.replace('<svg ', `<svg style="--hot:${hot};--hot-2:${hot2}" `);
    }
  } catch {
    return null;
  }
  const img = new Image();
  markImg = new Promise((resolve) => {
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    // A drawing that will not arrive must not hold a save open for ever: the
    // photograph without the mark is a worse outcome than the photograph with
    // it, and no photograph at all is worse than both.
    setTimeout(() => resolve(img.complete && img.naturalWidth ? img : null), 4000);
    img.src = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  });
  return markImg;
}

/**
 * THE MARK ITSELF — bottom right, on a plate, and small.
 *
 * **A PLATE RATHER THAN BARE TEXT**, because a photograph of a pub is whatever
 * colour the pub is: white words vanish against a ceiling light and black ones
 * against a dark corner. A dark plate under them is the only version that
 * cannot come out unreadable, and it is what every camera app does.
 *
 * **AND IT DOES NOT CARRY THE SOUND ARCS.** `waves` stays off — the mark is
 * drawn here bigger than anywhere else in the app, which is the first time that
 * decision has been live, and turning them on because there is finally room is
 * exactly the kind of change this file's rules exist to stop. One drawing.
 */
export function stampMark(ctx, w, h, words, mark = null) {
  const s = markSize(w, h);
  const pad = Math.round(s * 0.62);
  const gap = Math.round(s * 0.45);
  const icon = Math.round(s * 1.25);
  const edge = Math.round(s * 0.9);

  ctx.save();
  ctx.font = `600 ${s}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  ctx.textBaseline = 'middle';
  const text = String(words || '').trim();
  const tw = text ? Math.ceil(ctx.measureText(text).width) : 0;

  // `complete` AND a width: a broken data URI is `complete` too, and drawing
  // one throws. A photograph that saves without the mark is a worse outcome
  // than one that saves with it, so every step here degrades rather than dies.
  const drawable = Boolean(mark && mark.complete && mark.naturalWidth);
  const boxW = pad * 2 + (drawable ? icon + gap : 0) + tw;
  const boxH = Math.round(s * 2);
  const x = w - edge - boxW;
  const y = h - edge - boxH;

  ctx.fillStyle = 'rgba(8, 8, 14, 0.46)';
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, boxW, boxH, Math.round(s * 0.55));
    ctx.fill();
  } else {
    // An older browser gets a square plate rather than no plate. Nothing is
    // square in this app by decision, and a missing watermark breaks a rule
    // that matters more than that one does.
    ctx.fillRect(x, y, boxW, boxH);
  }

  if (drawable) {
    try {
      ctx.drawImage(mark, x + pad, y + (boxH - icon) / 2, icon, icon);
    } catch { /* the plate and the words are the part that has to survive */ }
  }
  if (text) {
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, x + pad + (drawable ? icon + gap : 0), y + boxH / 2 + 1);
  }
  ctx.restore();
}

/** The photograph at its own size, with the mark on it, as a JPEG blob. */
async function stamped(img, words) {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  // AWAITED, never fired-and-checked — see `loadMark()`.
  stampMark(ctx, w, h, words, await loadMark());
  return new Promise((resolve) => {
    // 0.92 rather than the 0.85 an upload uses: this one is going onto a
    // Facebook page that will compress it again, and the two stack.
    if (canvas.toBlob) canvas.toBlob(resolve, 'image/jpeg', 0.92);
    else resolve(null);
  });
}

/**
 * Save the photograph at `src`.
 *
 * **IT LOADS ITS OWN COPY rather than reading the element on the page.** The
 * grid's pictures are `loading="lazy"` and the big one may still be arriving,
 * so a canvas built from whatever the DOM happens to hold is a race that
 * produces a blank file some of the time and nothing to explain it. A second
 * `Image` on the same URL is the browser cache, not a second download.
 *
 * Resolves to `true` when something left; `false` means say so out loud.
 */
export async function savePhoto(src, { words = '', filename = 'photo.jpg' } = {}) {
  const img = new Image();
  // Same origin, so nothing taints the canvas — but stated, because the day
  // photographs move to object storage this is the line that has to change.
  img.crossOrigin = 'anonymous';
  const ready = new Promise((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('That photo would not load.'));
  });
  img.src = src;
  await ready;

  const blob = await stamped(img, words);
  if (!blob) return false;

  const file = new File([blob], filename, { type: 'image/jpeg' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return true;
    } catch (err) {
      // Somebody closing the share sheet is not a failure and must not raise
      // an error at them. Anything else falls through to the download.
      if (err && err.name === 'AbortError') return true;
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Long enough for the click to have been taken, then the memory goes back:
  // eighteen full-size photographs held as object URLs is a tab that dies.
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return true;
}
