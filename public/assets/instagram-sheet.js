/**
 * A PHOTO OPENED INTO ITS TWO INSTAGRAM SHAPES — the square post and the
 * Story, side by side, each with its own button. One sheet for every page
 * that saves a photo for socials: a pub's staff (`venue-photos.js`) and the
 * quizmaster's own console (`console-photo-export.js`).
 *
 * The host, 2 October 2026: *"each photo opened out into the instagram
 * story/square options on click, then just have a share button on each"*, and
 * then *"give my console the same side-by-side view too."*
 *
 * **BOTH ARE DRAWN HERE, frame and name on, so what is shown is exactly what
 * goes** — and the button sends those same bytes rather than drawing again
 * (`saveBlob()`), so a preview can never disagree with the file.
 *
 * **"SHARE" ONLY WHERE THERE IS A SHARE SHEET AND THE CALLER WANTS ONE.** The
 * console is the laptop and saves straight to Downloads (`share: false`); a
 * phone with a share sheet says Share; anything else says Download. A button
 * saying Share that downloaded would report something it did not do.
 *
 * A LEAF: no page of its own, no state between openings.
 */
import { node } from './client.js';
import { framedBlob, saveBlob, storyBlob } from './photo-save.js';

function canShareFiles() {
  try {
    return Boolean(navigator.canShare && navigator.canShare({ files: [new File([new Blob(['x'])], 'x.jpg', { type: 'image/jpeg' })] }));
  } catch {
    return false;
  }
}

/**
 * @param {object} o
 * @param {string} o.src        the photograph's URL (same origin)
 * @param {string} o.words      the quizmaster's name, for the mark
 * @param {string} o.line       the next quiz, under a Story (`story-line.js`)
 * @param {function} o.overlay  resolves to the venue's frame data URL, or ''
 * @param {string} o.filename   the square's file name; the Story's adds -story
 * @param {boolean} o.share     offer the share sheet where there is one
 */
export function openInstagramSheet({ src, words = '', line = '', overlay = async () => '', filename = 'photo.jpg', share = true }) {
  const verb = share && canShareFiles() ? 'Share' : 'Download';
  const sheet = node(`<div class="vp-big" role="dialog" aria-label="Save this photo for Instagram">
      <div class="vp-pair">
        <figure class="vp-opt vp-opt-square"><div class="vp-prev"><span class="muted">Making the square…</span></div>
          <figcaption>Instagram post — square</figcaption>
          <button class="gal-save vp-share" type="button" disabled>${verb}</button></figure>
        <figure class="vp-opt vp-opt-story"><div class="vp-prev"><span class="muted">Making the Story…</span></div>
          <figcaption>Instagram Story</figcaption>
          <button class="gal-save vp-share" type="button" disabled>${verb}</button></figure>
      </div>
      <button class="gal-save vp-close" type="button">Close</button>
    </div>`);
  const urls = [];
  const onKey = (ev) => { if (ev.key === 'Escape') close(); };
  const close = () => { sheet.remove(); urls.forEach((u) => URL.revokeObjectURL(u)); document.removeEventListener('keydown', onKey); };
  document.addEventListener('keydown', onKey);
  // A click lands on the sheet itself only between the pictures; anything
  // inside them must not bubble out to a page handler that closes a photo.
  sheet.addEventListener('click', (ev) => {
    ev.stopPropagation();
    if (ev.target === sheet || ev.target.closest('.vp-close')) close();
  });
  document.body.appendChild(sheet);

  const fill = async (fig, draw, name) => {
    const prev = fig.querySelector('.vp-prev');
    const btn = fig.querySelector('.vp-share');
    let blob;
    try {
      blob = await draw();
    } catch {
      blob = null;
    }
    if (!blob) { prev.replaceChildren(node('<span class="muted">That one would not draw — close and try again.</span>')); return; }
    const url = URL.createObjectURL(blob);
    urls.push(url);
    prev.replaceChildren(node(`<img alt="" src="${url}">`));
    btn.disabled = false;
    btn.addEventListener('click', async () => {
      if (btn.dataset.busy) return;
      btn.dataset.busy = '1';
      try {
        const went = await saveBlob(blob, name, verb === 'Share');
        btn.textContent = went === false ? 'Nothing was sent' : (verb === 'Share' ? 'Shared' : 'Saved');
      } catch {
        btn.textContent = 'That did not go — try again';
      }
      setTimeout(() => { btn.textContent = verb; delete btn.dataset.busy; }, 2400);
    });
  };
  Promise.resolve().then(overlay).catch(() => '').then((frame) => Promise.all([
    fill(sheet.querySelector('.vp-opt-square'), () => framedBlob(src, { words, overlay: frame || '' }), filename),
    fill(sheet.querySelector('.vp-opt-story'), () => storyBlob(src, { words, overlay: frame || '', line }), filename.replace(/\.jpg$/, '-story.jpg')),
  ]));
  return sheet;
}
