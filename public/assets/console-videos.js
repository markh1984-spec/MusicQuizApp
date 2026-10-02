/**
 * A NIGHT'S VIDEOS ON THE CONSOLE — under its photographs, on Post gig and
 * Community alike (`nightPhotos()` hands over the body it drew into).
 *
 * Each plays where it sits, says the day it will be cleared if nobody keeps it
 * (thirty days after the night — `src/videos.js`), and carries a star to keep
 * it for good and a bin. **The star is the keep**: the host's own "this one is
 * worth keeping", the same word the photographs use for the ones that matter.
 * The bin takes two presses — a video has no Undo.
 *
 * Absent rather than empty: a night with no videos, or a server with no store,
 * draws nothing at all.
 *
 * Handed a body, a night and the console's `keyed()`; reads the library for the
 * venue's frame and next night, as the photographs' save does.
 */
import { binIcon, esc, node, starIcon } from './client.js';
import { openVideoSheet } from './video-sheet.js';
import { library, me } from './console-state.js';
import { venueFrame } from './console-photo-export.js';
import { storyLine } from './story-line.js';

const dayWords = (iso) => {
  const [y, m, d] = String(iso || '').split('-').map(Number);
  return y ? new Date(y, m - 1, d, 12).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';
};

export async function videosInto(body, night, { keyed = (u) => u } = {}) {
  // What a save is drawn with — the same three the photographs' sheet uses.
  const venue = night.venue || '';
  const words = String((me && (me.brand || me.name)) || '');
  const line = storyLine(venue, { venues: library.venueRecords || [], bookings: library.bookings || [] });
  const overlay = () => venueFrame(venue, library.venueRecords || []);
  let data;
  try {
    const res = await fetch(keyed(`/api/videos/${encodeURIComponent(night.night)}`));
    data = await res.json();
    if (!res.ok) return;
  } catch {
    return;
  }
  const list = (data && data.videos) || [];
  if (!list.length) return;
  const box = node(`<section class="cvideos"><h5 class="cphoto-group">Videos <span>${list.length}</span></h5><div class="cvideo-strip"></div></section>`);
  const strip = box.querySelector('.cvideo-strip');
  const paint = (v) => {
    const tile = node(`<figure class="cvideo" data-name="${esc(v.name)}">
        <video preload="metadata" playsinline controls src="${esc(keyed(v.url))}"></video>
        <figcaption>
          <span class="tiny cvideo-when">${v.kept ? 'Kept' : `Goes on ${esc(dayWords(v.goesOn))} unless kept`}</span>
          <span class="cvideo-acts">
            <button class="cvideo-save gal-save" type="button">Save for Instagram</button>
            <button class="cvideo-keep ${v.kept ? 'is-on' : ''}" type="button" aria-pressed="${v.kept ? 'true' : 'false'}"
              title="${v.kept ? 'Kept for good — press to let it go after thirty days' : 'Keep this one for good'}" aria-label="Keep this video">${starIcon(14)}</button>
            <button class="cvideo-bin" type="button" aria-label="Delete this video" title="Delete this video">${binIcon(15)}</button>
          </span>
        </figcaption>
      </figure>`);
    const keep = tile.querySelector('.cvideo-keep');
    keep.addEventListener('click', async () => {
      const want = !v.kept;
      keep.disabled = true;
      try {
        const r = await fetch(keyed('/api/videos/keep'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ night: night.night, name: v.name, keep: want }) });
        if (r.ok) { v.kept = want ? 'star' : ''; tile.replaceWith(paint(v)); return; }
      } catch { /* the star stays as it was */ }
      keep.disabled = false;
    });
    const bin = tile.querySelector('.cvideo-bin');
    bin.addEventListener('click', async () => {
      if (!bin.dataset.armed) {
        bin.dataset.armed = '1';
        bin.classList.add('armed');
        bin.title = 'Press again to delete it';
        setTimeout(() => { delete bin.dataset.armed; bin.classList.remove('armed'); bin.title = 'Delete this video'; }, 3000);
        return;
      }
      const r = await fetch(keyed(`/api/videos/${encodeURIComponent(night.night)}/${encodeURIComponent(v.name)}`), { method: 'DELETE' }).catch(() => null);
      if (r && r.ok) {
        tile.remove();
        if (!strip.children.length) box.remove();
      }
    });
    tile.querySelector('.cvideo-save').addEventListener('click', () => openVideoSheet({
      src: keyed(v.url), words, line, overlay, venue, night: night.night, share: false,
      // A save is a use: it keeps the clip for good, like a pub's save does.
      onSaved: async () => {
        if (v.kept) return;
        const r = await fetch(keyed('/api/videos/keep'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ night: night.night, name: v.name, keep: true, how: 'saved' }) }).catch(() => null);
        if (r && r.ok) { v.kept = 'saved'; tile.replaceWith(paint(v)); }
      },
    }));
    return tile;
  };
  for (const v of list) strip.appendChild(paint(v));
  body.appendChild(box);
}
