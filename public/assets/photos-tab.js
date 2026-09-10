/* ================================================================== PHOTOS
 *
 * Everything the room sent, foldered by night — and getting it out.
 *
 * **This is the OWNER'S tab, and it was asked for that way.** It used to sit on
 * the console, where every quizmaster saw it. A quizmaster's own record of
 * their nights and the pictures from them is Past gigs, read only; the switch
 * and the bin for a photo that should not be on the projector are on the
 * control view, which is where they are needed with a mic in one hand. What is
 * left here is the morning-after job — file the lot away, bin the duds, share
 * the rest — which is Mark's own workflow on Mark's own room.
 *
 * The job it does is the one KaraFun does badly: getting a night's photos from
 * where they were taken to Instagram without them sitting in an inbox. So the
 * two things it has to do well are BIN a dud and SHARE a good one, and both are
 * one tap.
 *
 * Sharing uses the browser's own share sheet, which on a phone puts Instagram
 * in the list directly — nothing has to go via the camera roll. On a laptop
 * there is no share sheet, so it falls back to a download.
 *
 * Its own file rather than a section of owner.js because it is a self-contained
 * tab with three routes of its own, and owner.js is already the longest page in
 * the app.
 */

import { esc, node, binIcon } from './client.js';

async function post(path, body = {}) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json().catch(() => ({}));
}

export function photosSection() {
  const el = node(`
    <div class="game-section">
      <div class="game-head">
        <div>
          <h2>Photos</h2>
          <div class="tiny status">Loading…</div>
        </div>
        <div class="row">
          <button class="minor file-rest" hidden>File the rest away</button>
          <button class="minor danger clear-all" hidden>Clear all</button>
        </div>
      </div>
      <div class="nights"></div>
    </div>`);

  const status = el.querySelector('.status');
  const nightsEl = el.querySelector('.nights');
  const fileBtn = el.querySelector('.file-rest');
  const clearBtn = el.querySelector('.clear-all');

  const refresh = async () => {
    let data;
    try {
      const res = await fetch('/api/owner/photos');
      data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load them');
    } catch (err) {
      status.textContent = err.message;
      return;
    }

    // The one thing worth being loud about: on the free tier the server's disk
    // is wiped on every restart, so an unfiled photo is one restart from gone.
    if (!data.repoReady || data.repoProblem) {
      // Say which variable, not just that something is wrong. On a host whose
      // settings page has a project level and a service level that look the
      // same, "I set it" and "the app can see it" are different things.
      const seen = data.seen || {};
      const detail = data.repoProblem
        ? `<b style="color:var(--bad)">${esc(data.repoProblem)}</b>`
        : `The app cannot see <b>${esc((data.missing || []).join(' or '))}</b>.`;
      status.innerHTML = `<b style="color:var(--gold)">These are temporary.</b> ${detail}
        <br><span class="tiny">What this app can actually see right now:
        PHOTO_REPO ${seen.PHOTO_REPO ? '✓ set' : '✗ not set'} ·
        PHOTO_TOKEN ${seen.PHOTO_TOKEN ? '✓ set' : '✗ not set'} ·
        GITHUB_TOKEN ${seen.GITHUB_TOKEN ? '✓ set' : '✗ not set'} ·
        branch ${esc(String(seen.PHOTO_BRANCH || ''))}.
        Set them on the <b>service</b> page (/web/srv-…), not the project page —
        see TODO.md part 7f.</span>`;
    } else if (data.unfiled) {
      status.innerHTML = `${data.count} photo${data.count === 1 ? '' : 's'} ·
        <b style="color:var(--gold)">${data.unfiled} not filed away yet</b> ·
        going to ${esc(data.repo)}`;
    } else if (!data.count) {
      // "0 photos, all filed" is true and says nothing. Before the first one
      // arrives, what you want to know is that it is pointed at the right
      // place and working.
      status.innerHTML = `<b style="color:var(--good)">Ready.</b>
        Photos will be filed to ${esc(data.repo)} as they arrive.`;
    } else {
      status.innerHTML = `${data.count} photo${data.count === 1 ? '' : 's'} ·
        <b style="color:var(--good)">all filed to ${esc(data.repo)}</b>`;
    }

    fileBtn.hidden = !(data.repoReady && data.unfiled);
    clearBtn.hidden = !data.count;

    if (!data.count) {
      nightsEl.replaceChildren(node('<div class="tiny">Nothing yet. They arrive as the room sends them.</div>'));
      return;
    }
    nightsEl.replaceChildren(...data.nights.map((n) => nightBlock(n, refresh)));
  };

  fileBtn.addEventListener('click', async () => {
    fileBtn.disabled = true;
    fileBtn.textContent = 'Filing…';
    const res = await post('/api/owner/photos/file');
    fileBtn.disabled = false;
    fileBtn.textContent = 'File the rest away';
    if (res.failed) alert(`${res.filed} filed, ${res.failed} could not be. Check the token can write to the photo repo.`);
    refresh();
  });

  clearBtn.addEventListener('click', async () => {
    if (!confirm('Delete every photo from this server?\n\nOnes already filed away stay in the repository.')) return;
    await post('/api/owner/photos/clear');
    refresh();
  });

  refresh();
  return el;
}

function nightBlock(night, refresh) {
  const when = new Date(night.night + 'T12:00:00');
  const label = when.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const el = node(`
    <div class="night">
      <div class="night-head">
        <h3>${esc(label)}</h3>
        <span class="tiny">${night.photos.length} photo${night.photos.length === 1 ? '' : 's'}</span>
        <button class="minor share-night">Share the lot</button>
      </div>
      <div class="night-grid"></div>
    </div>`);

  const grid = el.querySelector('.night-grid');
  for (const p of night.photos) {
    const fig = node(`
      <figure class="cphoto ${p.filed ? 'filed' : ''}">
        <img src="${esc(p.url)}" alt="" loading="lazy">
        <figcaption>${esc(p.teamName || '')}</figcaption>
        <div class="cphoto-acts">
          <button class="share" title="Share this one">Share</button>
          <button class="bin" title="Delete it">${binIcon(15)} Bin</button>
        </div>
      </figure>`);

    fig.querySelector('.share').addEventListener('click', () => sharePhotos([p]));
    fig.querySelector('.bin').addEventListener('click', async () => {
      if (!confirm(`Bin this photo${p.teamName ? ` from ${p.teamName}` : ''}?`)) return;
      await post('/api/owner/photos/remove', { id: p.id });
      refresh();
    });
    grid.appendChild(fig);
  }

  el.querySelector('.share-night').addEventListener('click', () => sharePhotos(night.photos));
  return el;
}

/**
 * Hand photos to the phone's own share sheet, where Instagram is waiting.
 *
 * This is the whole point of the tab: no inbox, no camera roll, no laptop.
 * Falls back to downloading on anything without a share sheet, which is every
 * desktop browser.
 */
async function sharePhotos(list) {
  const files = [];
  for (const p of list) {
    try {
      const res = await fetch(p.url);
      const blob = await res.blob();
      files.push(new File([blob], p.file || `${p.id}.jpg`, { type: blob.type || 'image/jpeg' }));
    } catch {
      /* skip one that will not load rather than failing the lot */
    }
  }
  if (!files.length) return alert('Could not read those photos.');

  if (navigator.canShare && navigator.canShare({ files })) {
    try {
      await navigator.share({ files, title: 'Quiz night' });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return; // they changed their mind
    }
  }

  // No share sheet — download instead, which is what a laptop wants anyway.
  for (const file of files) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}

/* ============================================================= PROP USE
 *
 * WHICH PROPS ARE EARNING THEIR PLACE — the delete list, worst first.
 *
 * Asked for directly: *"track which ones just don't get used, because if
 * people don't like those icons then they're bloat and they need to go, and
 * then we can replace them with other ones."*
 *
 * **THE COLUMN THAT DECIDES IS THE RATE, NEVER THE COUNT.** The tray is
 * weighted towards popular props, so a raw count of uses measures how often
 * something was OFFERED at least as much as whether anybody wanted it — and
 * deleting artwork on that is irreversible. `src/prop-use.js` counts both
 * halves for exactly this table.
 *
 * **AND "NOT ENOUGH YET" IS PRINTED AS ITSELF, never as 0%** — a prop shown
 * three times and used none is not evidence of anything, and a table that
 * renders it as 0% at the top of a delete list gets a good drawing binned.
 *
 * Here rather than on the Money tab because it is about the photographs, and
 * this is the photographs' page.
 */
export function propUsePanel() {
  const el = node(`
    <div class="panel">
      <h3>Which props people reach for</h3>
      <div class="tiny status">Loading…</div>
      <div class="own-rows prop-rows" style="margin-top:10px"></div>
    </div>`);

  const rows = el.querySelector('.prop-rows');
  const status = el.querySelector('.status');

  fetch('/api/owner/prop-use').then((r) => r.json()).then((data) => {
    const props = (data && data.props) || [];
    if (!props.length) { status.textContent = 'No props to report on.'; return; }

    const judged = props.filter((p) => p.enough);
    const waiting = props.length - judged.length;
    status.textContent = judged.length
      ? `${judged.length} of ${props.length} have been shown enough to judge`
        + `${waiting ? ` · ${waiting} still gathering` : ''}. Worst first.`
      /*
       * THE EMPTY STATE SAYS WHAT TO DO, which here is "nothing yet" — and it
       * says WHY, because a table that is blank for a fortnight otherwise
       * reads as a feature that does not work.
       */
      : `Nothing has been shown ${data.enough} times yet, so there is nothing`
        + ' safe to judge. Come back after a few nights.';

    rows.replaceChildren(...props.map((p) => node(`
      <div class="own-row">
        <div class="own-row-main">
          <b>${esc(p.label)}</b>
          ${p.seasonal ? ' <span class="tiny">seasonal</span>' : ''}
          <span class="tiny">shown ${p.shown} · used ${p.used}</span>
        </div>
        <div class="own-row-num">${p.enough
    ? `<b>${Math.round(p.rate * 100)}%</b>`
    : '<span class="tiny">not enough yet</span>'}</div>
      </div>`)));
  }).catch(() => { status.textContent = 'Could not read the prop tally.'; });

  return el;
}
