/**
 * A VIDEO OPENED INTO ITS TWO INSTAGRAM SHAPES — the photographs' sheet
 * (`instagram-sheet.js`), for a clip. Same two figures, same button words,
 * with ONE difference the clip forces: each shape has to be RE-RECORDED with
 * the frame and the name in it (`video-export.js`), which takes as long as the
 * clip — so each starts as "Make it" and says how long, rather than the sheet
 * silently freezing for thirty seconds on open.
 *
 * One at a time: two clips playing into two recorders at once is a laptop fan
 * and a phone that drops frames. A save is a USE — `onSaved()` keeps the clip
 * from the thirty-day clear-out.
 */
import { node } from './client.js';
import { saveBlob, saveName } from './photo-save.js';
import { canRemakeVideo, remakeVideo } from './video-export.js';

function canShareFiles() {
  try {
    return Boolean(navigator.canShare && navigator.canShare({ files: [new File([new Blob(['x'])], 'x.mp4', { type: 'video/mp4' })] }));
  } catch {
    return false;
  }
}

export function openVideoSheet({ src, words = '', line = '', overlay = async () => '', venue = '', night = '', share = true, onSaved = () => {} }) {
  const verb = share && canShareFiles() ? 'Share' : 'Download';
  const can = canRemakeVideo();
  const sheet = node(`<div class="vp-big" role="dialog" aria-label="Save this video for Instagram">
      <div class="vp-pair">
        <figure class="vp-opt vp-opt-square"><div class="vp-prev"><span class="muted">Square, with the frame — takes as long as the clip</span></div>
          <figcaption>Instagram post — square</figcaption>
          <button class="gal-save vp-make" type="button"${can ? '' : ' disabled'}>Make it</button></figure>
        <figure class="vp-opt vp-opt-story"><div class="vp-prev"><span class="muted">Story, with the frame and the next quiz — takes as long as the clip</span></div>
          <figcaption>Instagram Story</figcaption>
          <button class="gal-save vp-make" type="button"${can ? '' : ' disabled'}>Make it</button></figure>
      </div>
      ${can ? '' : '<p class="tiny">This browser cannot make a video. Try Chrome or Safari.</p>'}
      <button class="gal-save vp-close" type="button">Close</button>
    </div>`);
  const urls = [];
  let busy = false;
  const onKey = (ev) => { if (ev.key === 'Escape' && !busy) close(); };
  const close = () => { sheet.remove(); urls.forEach((u) => URL.revokeObjectURL(u)); document.removeEventListener('keydown', onKey); };
  document.addEventListener('keydown', onKey);
  sheet.addEventListener('click', (ev) => {
    ev.stopPropagation();
    if (busy) return;
    if (ev.target === sheet || ev.target.closest('.vp-close')) close();
  });
  document.body.appendChild(sheet);

  const base = saveName(venue, night, 0, '').replace(/\.jpg$/, '');
  const wire = (fig, shape) => {
    const prev = fig.querySelector('.vp-prev');
    const btn = fig.querySelector('.vp-make');
    let made = null;
    btn.addEventListener('click', async () => {
      if (made) {
        if (btn.dataset.busy) return;
        btn.dataset.busy = '1';
        const ext = made.type === 'video/webm' ? 'webm' : 'mp4';
        try {
          const went = await saveBlob(made.blob, `${base}-${shape === 'story' ? 'story-' : ''}video.${ext}`, verb === 'Share');
          btn.textContent = went === false ? 'Nothing was sent' : (verb === 'Share' ? 'Shared' : 'Saved');
          if (went !== false) onSaved();
        } catch {
          btn.textContent = 'That did not go — try again';
        }
        setTimeout(() => { btn.textContent = verb; delete btn.dataset.busy; }, 2400);
        return;
      }
      if (busy) return;
      busy = true;
      sheet.querySelectorAll('.vp-make').forEach((b) => { b.disabled = true; });
      btn.textContent = 'Making it… 0%';
      try {
        made = await remakeVideo({
          src, shape, words, line, overlay: await overlay().catch(() => ''),
          onProgress: (p) => { btn.textContent = `Making it… ${Math.round(p * 100)}%`; },
        });
        const url = URL.createObjectURL(made.blob);
        urls.push(url);
        prev.replaceChildren(node(`<video src="${url}" playsinline controls loop></video>`));
        btn.textContent = verb;
      } catch {
        prev.replaceChildren(node('<span class="muted">That would not make — close and try again.</span>'));
        btn.textContent = 'Make it';
      }
      busy = false;
      sheet.querySelectorAll('.vp-make').forEach((b) => { b.disabled = false; });
    });
  };
  wire(sheet.querySelector('.vp-opt-square'), 'square');
  wire(sheet.querySelector('.vp-opt-story'), 'story');
  return sheet;
}
