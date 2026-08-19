/** Venues — the rooms you play, their prizes, their logo and their adverts. */

import { esc, node, postJson } from './client.js';
import { field, invoiceApi, sheet } from './console-invoices.js';
import { headcountBlock, leagueBlock } from './console-gigs.js';
import { library, setVenueDrag } from './console-state.js';
import { chooseVenueFromTab, dragging, night } from './console-tonight.js';
import { can, doorNow, goTo, hostKey, keyed, load } from './console.js';
import { WEEKDAY_LABELS, tonight } from './diary.js';
import { FEATURES } from './plans.js';

/**
 * WHICH VENUE IS OPEN, remembered outside the render.
 *
 * Module level for the same reason `openPack` is: this list is redrawn after
 * every save, and a selection stored inside `draw()` would close the card you
 * had just opened the moment you typed a prize into it.
 */
let openVenue = '';
let venueQuery = '';

/**
 * SHRINK A LOGO IN THE BROWSER, before it is ever sent.
 *
 * A venue's logo arrives as whatever they had — a 3MB PNG off their website is
 * the normal case. It is stored as a data URL on the venue record, which is
 * what makes it need no upload endpoint, no file store and no new backup path;
 * and that is only affordable while it is SMALL, because the record travels in
 * every console payload.
 *
 * So the browser does the work: draw it onto a canvas no bigger than 128px on
 * its longest side and read it back. The same approach `filters.js` already
 * uses for photos, and for the same reason — no dependency, and it works on
 * the phones this app actually meets.
 *
 * PNG rather than JPEG: a logo is flat colour with hard edges, which JPEG
 * turns to soup at small sizes, and transparency has to survive or a
 * transparent PNG comes back with a black square behind it.
 *
 * It refuses rather than silently sending something too big — the server caps
 * it too and would drop it, and a logo that vanishes without a word is worse
 * than one that says why.
 */
/* Shared with src/invoices.js, which caps it on the way in. */
const MAX_REWARDS = 20;

const LOGO_PX = 128;
const MAX_LOGO_BYTES = 64 * 1024;
/*
 * An advert picture is going on a PROJECTOR rather than a phone, so it gets a
 * bigger allowance — but still a capped one, because the slide's image travels
 * in the screen payload for as long as the advert is up. It is only ever shown
 * between rounds, when nothing is pushing state every second, which is what
 * makes a few hundred kilobytes affordable here and not on a question.
 */
const ADVERT_PX = 900;
const MAX_ADVERT_BYTES = 300 * 1024;

/**
 * One shrink, two sizes.
 *
 * PNG when the source is a PNG, JPEG otherwise, and that is not fussiness: an
 * advert slide sits on a DARK background, so a graphic with transparency
 * flattened onto white would arrive as a white box six feet wide. Photographs
 * are the common case for a venue's slide and JPEG is right for those.
 */
function shrinkImage(file, { px, maxBytes, tooBig }) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('That does not look like an image.'));
      img.onload = () => {
        const scale = Math.min(1, px / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        // No fill, so transparency survives where the format keeps it.
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const png = String(file.type || '').includes('png');
        const out = png ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.82);
        if (out.length > maxBytes) { reject(new Error(tooBig)); return; }
        resolve(out);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

const shrinkLogo = (file) => shrinkImage(file, {
  px: LOGO_PX, maxBytes: MAX_LOGO_BYTES,
  tooBig: 'That logo is too detailed to store. A simpler or smaller one will work.',
});

const shrinkAdvertImage = (file) => shrinkImage(file, {
  px: ADVERT_PX, maxBytes: MAX_ADVERT_BYTES,
  tooBig: 'That picture is too big to put on the screen. A smaller one will work.',
});

/**
 * THEIR ADVERTS, on the venue's own card — as a DOOR, never a second editor.
 *
 * Asked for directly: *"the venues need to have adverts in the venues tab as
 * well because those adverts are gonna be venue specific."* Right, and the
 * shape matters — two places that EDIT one thing is how they end up
 * disagreeing, which is the same fault that took the venue picker out of Set
 * it up. So this says what the venue has and takes you to the one editor.
 *
 * Silent when the venue has none rather than showing an empty box with an
 * invitation in it: most venues have no slides, and a permanent "no adverts
 * yet" on every card is a wall you scroll past.
 *
 * Matched on the venue NAME, lowercased, which is how a slide set records
 * which venue it belongs to — the same key `venuesUsed` and the headcounts
 * already use, so a venue typed in two cases is still one venue.
 */
function advertsForVenue(name) {
  if (!can(FEATURES.ADVERTS)) return '';
  const key = String(name || '').trim().toLowerCase();
  if (!key) return '';
  const sets = (library.adverts || []).filter(
    (a) => String(a.venue || '').trim().toLowerCase() === key);
  if (!sets.length) return '';
  const slides = sets.flatMap((a) => a.slides || []);
  return `
    <div class="venue-ads">
      <div class="venue-ads-tag">Their adverts</div>
      ${slides.slice(0, 4).map((sl) => `
        <div class="tiny venue-ads-line">${esc(sl.heading || '(no heading)')}</div>`).join('')}
      ${slides.length > 4 ? `<div class="tiny venue-ads-line">and ${slides.length - 4} more</div>` : ''}
      <a class="minor" href="?tab=adverts&amp;set=${encodeURIComponent(sets[0].id)}">Edit their slides</a>
    </div>`;
}

/**
 * "1st", "2nd", "3rd", "11th", "21st" — for a prize list of any length.
 *
 * Written out rather than a lookup because a venue may put up twenty, and the
 * three that used to be hard-coded were a lookup table with exactly three
 * entries in it.
 */
function placeLabel(n) {
  const v = n % 100;
  const suffix = (v >= 11 && v <= 13) ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] || 'th');
  return `${n}${suffix}`;
}

export function venuesSection() {
  const el = node('<div></div>');
  const draw = () => {
    const all = library.venueRecords || [];
    /*
     * SEARCH AND COLLAPSE, for the same reason the pack grid got them: a
     * quizmaster with fifteen residencies had fifteen cards each carrying a
     * usual-night dropdown and three prize boxes, which is a wall you scroll
     * rather than a list you use. Closed, a venue is its name and the two
     * facts you scan for — which night it has you, and what it puts up.
     *
     * The search matches the NAME only. A venue list is short enough that
     * matching anything else would only ever surprise somebody — unlike the
     * pack search, which looks inside the questions because "the one with
     * Madonna in it" is a real way to look for a quiz.
     */
    const q = venueQuery.trim().toLowerCase();
    const venues = q ? all.filter((v) => (v.name || '').toLowerCase().includes(q)) : all;
    /*
     * THE SAME TAB IS TWO DIFFERENT THINGS BEHIND THE TWO DOORS, and on the
     * Console it is ONE thing: find tonight's pub and drag it up to Tonight.
     *
     * Asked for in those words — *"this is now just a section for finding the
     * right venue and dragging it to the launch, the rest is done in
     * workshop"* — and it is the door rule doing its job rather than a new
     * idea. A venue's prizes, its usual night, its logo, where to send the
     * room and its advert slides are all things you set up once and then do
     * not touch for months; none of them is a thing to be doing ten minutes
     * before a gig, which is the only moment this door is open.
     *
     * So the Console gets the NAME, the one line you scan for, and the drag.
     * The explainer goes with them: it explains the editing, and there is no
     * editing here to explain.
     */
    const findOnly = doorNow() === 'console';
    el.replaceChildren(node(`
      <div class="panel">
        <h3>Venues</h3>
        ${findOnly ? '' : `<div class="tiny">Set the prizes here and they fill themselves in when you
          launch a night at this venue. Give a venue its usual night and the
          launch bar knows whose night tonight is — and the big screen ends the
          night with “Back here Thursday 20th”, worked out from it. The billing
          details for the same venues are on ${goTo('post', 'invoices', 'the Invoices tab')}.</div>`}
        ${all.length > 4 ? `
          <div class="venue-tools">
            <input class="pack-search venue-search" type="search" placeholder="Search ${all.length}…"
              value="${esc(venueQuery)}" aria-label="Search venues">
          </div>` : ''}
        <div class="venue-list">
          ${!all.length ? `<div class="tiny">No venues yet. ${
  findOnly ? `Add one in ${goTo('workshop', 'venues', 'the Workshop')}.`
    : `Add one below, or on ${goTo('post', 'invoices', 'the Invoices tab')}.`}</div>`
    : !venues.length ? `<div class="tiny">Nothing matches “${esc(venueQuery)}”.</div>`
      : venues.map((v) => {
        // Never open behind the Console door: a card there is a thing to pick
        // up, and only a shut card is draggable.
        const open = !findOnly && openVenue === v.id;
        const night = (WEEKDAY_LABELS.find(([id]) => id === v.usualNight) || [])[1] || '';
        const prizes = (v.rewards || []).filter(Boolean);
        return `
            <div class="venue-card ${open ? 'open' : 'shut'}" data-id="${esc(v.id)}">
              <div class="venue-top">
                ${findOnly
    // A SPAN RATHER THAN A BUTTON, and the caret goes with it. A control that
    // looks pressable and does nothing is worse than no control — and the
    // caret was the thing saying "this opens", on the one door where it does
    // not.
    ? `<span class="venue-name flat">${esc(v.name)}</span>`
    : `<button class="venue-name" aria-expanded="${open ? 'true' : 'false'}">${esc(v.name)}</button>`}
                ${open ? '<button class="minor danger v-del">Remove</button>' : ''}
              </div>
              ${open ? '' : `<div class="tiny venue-gist">${
  esc([night || 'No usual night', prizes.length ? prizes[0] : 'No prizes set'].join(' · '))}</div>`}
              ${!open ? '' : `
              <label class="venue-night">Usual night
                <select class="v-night">
                  <option value="">No usual night</option>
                  ${WEEKDAY_LABELS.map(([id, label]) => `
                    <option value="${id}" ${v.usualNight === id ? 'selected' : ''}>${esc(label)}</option>`).join('')}
                </select>
              </label>
              <!--
                WHERE TO SEND THE ROOM at the end of the night, as a QR on the
                last slide. Labelled by the JOB rather than by the field —
                "Link" would need a sentence under it explaining what it is
                for, and a control that needs explaining is the wrong control.
              -->
              <label class="venue-night venue-link">Where to send them
                <input class="v-link" type="url" inputmode="url" maxlength="300"
                  value="${esc(v.link || '')}" placeholder="thecrown.co.uk/whats-on">
              </label>
              <!-- THE VENUE'S OWN LOGO, for the winner's voucher. Beside the
                   prizes because it is the same kind of thing: the venue's
                   standing arrangement rather than a decision about tonight.
                   Its blurb says WHERE it appears, because a picture upload
                   with no stated destination is a control nobody trusts. -->
              <div class="venue-logo-row">
                <span class="venue-logo-what">
                  <b>Their logo</b><br>
                  <!-- IT SAYS YOU CAN PHOTOGRAPH IT, because you always could
                       and nothing said so: accept=image/* offers Take
                       Photo alongside the library on every phone. The host's
                       own case is the one worth naming — a new venue that
                       cannot be bothered to send artwork, and a picture of the
                       front of the pub does the job until they do. It is also
                       TRUE in a way a generated wordmark would not be, which
                       is why there is no auto-filled placeholder: a logo the
                       pub never approved, printed on a credential, is worse
                       than a clean card with no picture on it. -->
                  <span class="tiny">Goes on the winner&rsquo;s phone, above the code,
                    so the voucher looks like the pub&rsquo;s own. No artwork yet?
                    Photograph the front of the pub &mdash; it does the job until
                    they send you something better.</span>
                </span>
                <span class="venue-logo-side">
                  ${v.logo ? `<img class="venue-logo-pic" alt="" src="${esc(v.logo)}">` : ''}
                  <label class="minor venue-logo-pick">${v.logo ? 'Change' : 'Add or take one'}
                    <input class="v-logo" type="file" accept="image/*" hidden>
                  </label>
                  ${v.logo ? '<button class="minor danger v-logo-off">Remove</button>' : ''}
                </span>
              </div>
              ${advertsForVenue(v.name)}
              <!-- AS MANY PRIZES AS THE VENUE ACTUALLY PUTS UP.
                   It was three fixed boxes, because a pub quiz pays first,
                   second and third — the common case mistaken for the rule.
                   A charity night hands out a table of them and a quiet
                   Tuesday puts up one, so the list is whatever length it needs
                   with a row added and taken away by hand.
                   A venue with none still shows ONE empty box: nought boxes
                   and an "Add a prize" button makes you press something before
                   you can type, on the field this card exists for. -->
              <div class="venue-prizes">
                ${(((v.rewards || []).length ? v.rewards : ['']).map((prize, i) => `
                  <label class="reward-row" data-place="${i + 1}">
                    <span class="reward-place">${esc(placeLabel(i + 1))}</span>
                    <input class="v-reward" data-i="${i}" type="text" maxlength="80"
                      value="${esc(prize || '')}"
                      placeholder="${i === 0 ? 'A free drink at the bar' : 'Nothing for this place'}">
                    <button class="reward-off" type="button" aria-label="Remove this prize">&times;</button>
                  </label>`)).join('')}
              </div>
              <button class="minor v-reward-add" type="button">Add a prize</button>
              <button class="minor v-save" hidden>Save it</button>
              ${can(FEATURES.PAST_GIGS) ? headcountBlock(v.name) : ''}
              ${can(FEATURES.LEAGUE) ? leagueBlock(v.name) : ''}`}
            </div>`;
      }).join('')}
        </div>
        ${findOnly ? '' : `
        <div class="venue-add">
          <input class="venue-new" type="text" maxlength="60" placeholder="The Station Tap, Wokingham">
          <button class="role-make venue-add-go">Add a venue</button>
        </div>`}
      </div>`));

    // Save only appears once something has changed, so a page of venues is not
    // a page of buttons waiting to be pressed for no reason.
    /*
     * The search box, and the name that opens a card.
     *
     * `venueQuery` and `openVenue` are module-level, so both survive the
     * redraw that every save triggers — the same reason the pack grid keeps
     * its selection outside the render.
     */
    const search = el.querySelector('.venue-search');
    if (search) {
      search.addEventListener('input', () => {
        venueQuery = search.value;
        draw();
        // Redrawn from scratch, so the box the thumb is in has to be found
        // again and the caret put back at the end of what was typed.
        const again = el.querySelector('.venue-search');
        if (again) { again.focus(); again.setSelectionRange(again.value.length, again.value.length); }
      });
    }

    for (const card of el.querySelectorAll('.venue-card')) {
      // `?.` because behind the Console door the name is a span with nothing to
      // open — the same class of null this file has been caught by twice, where
      // markup goes and the lookup for it stays.
      card.querySelector('button.venue-name')?.addEventListener('click', () => {
        openVenue = openVenue === card.dataset.id ? '' : card.dataset.id;
        draw();
      });
      /*
       * AND ON THE CONSOLE DOOR, TAPPING THE CARD IS WHAT PICKS THE VENUE.
       *
       * Reported in four words — *"don't think I'll be drag and dropping from
       * that section"* — and the honest reading is that the card did NOTHING
       * when it was tapped. It was made drag-only when this became a shelf,
       * which is a laptop-only gesture: **HTML5 drag events are never
       * delivered on touch**, so on the device this console is most often
       * driven from, the Venues tab had no way to choose a venue at all.
       *
       * That is this file's oldest rule about drag arriving in a new place —
       * the round ticks replaced dragging rounds between packs for exactly the
       * same reason, and every other drag in the app already has a way round
       * it. Drag is the fast way; the tap is the way.
       *
       * Through `chooseVenue()`, which is the same path the drop and the
       * picker in the head both use, so there is one way a venue is set.
       */
      if (findOnly) {
        card.addEventListener('click', () => {
          const record = venues.find((v) => v.id === card.dataset.id);
          if (record) chooseVenueFromTab(record.name);
        });
      }
      /*
       * DRAG A VENUE UP TO TONIGHT. Same gesture as a pack card, same target.
       *
       * Only a SHUT card is draggable: an open one is full of prize boxes and
       * a usual-night dropdown, and `draggable` on their container stops you
       * selecting a word to retype it — the same reason a pack card is dragged
       * by a grip rather than by the whole card.
       */
      const shut = card.classList.contains('shut');
      card.draggable = shut;
      if (shut) {
        const record = venues.find((v) => v.id === card.dataset.id) || {};
        card.addEventListener('dragstart', (ev) => {
          setVenueDrag({ id: card.dataset.id, name: record.name || '' });
          ev.dataTransfer.effectAllowed = 'copy';
          ev.dataTransfer.setData('text/plain', record.name || '');
          card.classList.add('is-dragging');
          dragging(true);
        });
        card.addEventListener('dragend', () => {
          setVenueDrag(null);
          card.classList.remove('is-dragging');
          dragging(false);
          document.querySelector('.launchbar')?.classList.remove('drop-here');
        });
      }
      const save = card.querySelector('.v-save');
      // A shut card has no controls to wire — its name and its one line are
      // the whole of it.
      if (!save) continue;
      for (const box of card.querySelectorAll('.v-reward, .v-night, .v-link')) {
        box.addEventListener('input', () => { save.hidden = false; });
        box.addEventListener('change', () => { save.hidden = false; });
      }
      /*
       * ADDING AND REMOVING A PRIZE, in the page rather than by re-rendering.
       *
       * The card is redrawn from the RECORD, so a redraw here would throw away
       * everything typed since the last save — and adding a fourth prize is
       * exactly the moment somebody has three unsaved boxes in front of them.
       * The rows are renumbered afterwards, or removing the second leaves a
       * list reading 1st, 3rd, 4th.
       */
      const prizes = card.querySelector('.venue-prizes');
      const renumber = () => {
        [...prizes.querySelectorAll('.reward-row')].forEach((row, i) => {
          row.dataset.place = String(i + 1);
          row.querySelector('.reward-place').textContent = placeLabel(i + 1);
          row.querySelector('.v-reward').dataset.i = String(i);
        });
      };
      prizes.addEventListener('click', (ev) => {
        const off = ev.target.closest('.reward-off');
        if (!off) return;
        // Never nought rows: the last one empties rather than disappearing, so
        // the card cannot end up with nothing to type in.
        if (prizes.querySelectorAll('.reward-row').length <= 1) {
          prizes.querySelector('.v-reward').value = '';
        } else {
          off.closest('.reward-row').remove();
          renumber();
        }
        save.hidden = false;
      });
      card.querySelector('.v-reward-add')?.addEventListener('click', () => {
        const rows = prizes.querySelectorAll('.reward-row').length;
        if (rows >= MAX_REWARDS) return;
        const at = rows + 1;
        const row = node(`
          <label class="reward-row" data-place="${at}">
            <span class="reward-place">${esc(placeLabel(at))}</span>
            <input class="v-reward" data-i="${at - 1}" type="text" maxlength="80"
              placeholder="Nothing for this place">
            <button class="reward-off" type="button" aria-label="Remove this prize">&times;</button>
          </label>`);
        prizes.appendChild(row);
        const box = row.querySelector('.v-reward');
        box.addEventListener('input', () => { save.hidden = false; });
        box.focus();
        save.hidden = false;
      });
      /*
       * The logo saves ON ITS OWN rather than waiting for "Save it".
       *
       * Picking a file is a finished act — there is nothing to type afterwards
       * and nothing to get right — so making somebody press a second button
       * for it is a step that only exists to be forgotten. The prizes and the
       * usual night are different: those are typed, and a save button is what
       * says the typing has landed.
       */
      const logoPick = card.querySelector('.v-logo');
      const saveLogo = async (logo) => {
        try {
          await invoiceApi(`/api/invoices/customers/${encodeURIComponent(card.dataset.id)}/rewards`, {
            method: 'PUT',
            // ONLY the logo. `setVenueDetails` writes what it is sent, so this
            // cannot touch prizes somebody is halfway through editing.
            body: JSON.stringify({ logo }),
          });
          await load();
        } catch (err) {
          alert(err.message || 'Could not save that.');
        }
      };
      logoPick?.addEventListener('change', async () => {
        const file = logoPick.files && logoPick.files[0];
        if (!file) return;
        try {
          await saveLogo(await shrinkLogo(file));
        } catch (err) {
          alert(err.message || 'Could not use that image.');
        }
      });
      card.querySelector('.v-logo-off')?.addEventListener('click', () => saveLogo(''));
      save.addEventListener('click', async () => {
        save.disabled = true;
        save.textContent = 'Saving…';
        const id = card.dataset.id;
        /*
         * Trailing blanks are dropped: an empty row somebody added and did not
         * fill in is not a prize, and storing it would put a nameless 4th place
         * on the lobby slide. A blank in the MIDDLE is kept, because "nothing
         * for second, something for third" is a real arrangement — the same
         * rule `rewardList()` in the engine already follows.
         */
        const rewards = [...card.querySelectorAll('.v-reward')].map((b) => b.value.trim());
        while (rewards.length && !rewards[rewards.length - 1]) rewards.pop();
        const usualNight = card.querySelector('.v-night').value;
        const link = card.querySelector('.v-link').value.trim();
        try {
          await invoiceApi(`/api/invoices/customers/${encodeURIComponent(id)}/rewards`, {
            method: 'PUT',
            // All three every time from THIS card, which is safe because the
            // card was drawn from the record — `setVenueDetails` only writes
            // what it is sent, and what it is sent here is what is on screen.
            body: JSON.stringify({ rewards, usualNight, link }),
          });
          await load();
        } catch (err) {
          save.disabled = false;
          save.textContent = 'Save it';
          alert(err.message || 'Could not save that.');
        }
      });
      card.querySelector('.v-del')?.addEventListener('click', async () => {
        if (!confirm('Remove this venue? Invoices already sent keep their own copy.')) return;
        await invoiceApi(`/api/invoices/customers/${encodeURIComponent(card.dataset.id)}`, { method: 'DELETE' });
        await load();
      });
    }

    // Absent behind the Console door — adding a venue is Workshop work.
    const add = el.querySelector('.venue-add-go');
    add?.addEventListener('click', async () => {
      const name = el.querySelector('.venue-new').value.trim();
      if (!name) return;
      add.disabled = true;
      try {
        await invoiceApi('/api/invoices/customers', { method: 'POST', body: JSON.stringify({ name, rewards: [] }) });
        await load();
      } catch (err) {
        add.disabled = false;
        alert(err.message || 'Could not add that.');
      }
    });
  };
  draw();
  return el;
}

/**
 * GIGS — what is coming, then what has been.
 *
 * Coming up FIRST, because it is the one you act on: a night you have not run
 * yet can still be moved, cancelled or prepared for, where a night you have
 * run is a record. Past gigs is also the half somebody scrolls at length when
 * they are showing a venue their work, and a long list belongs under a short
 * one rather than over it.
 */

/**
 * WHAT THE GENERATOR REFUSES TO REPEAT — and the only way to clear it.
 *
 * `src/history.js` remembers every track the bingo generator has ever used, so
 * a room never gets the same song twice in three months. `/api/history/forget`
 * empties it and has existed since that was written **with no button anywhere
 * in the app** — found by walking every route against every caller in the
 * browser code. A function nothing can reach is a function that does not
 * exist.
 *
 * It matters after a year or two rather than on day one: the list grows, the
 * generator starts dropping more and more as "played recently", and eventually
 * a fresh venue or a new season wants a clean slate. Until now the only way
 * was to delete a file on the server.
 *
 * **THE OWNER'S ONLY, because the memory is GLOBAL** — one file for the whole
 * app, not one per room, since the generator is the owner's and runs on the
 * owner's bill. A quizmaster clearing it would be clearing everybody's.
 *
 * Behind a confirm that says what is lost, because the cost is real and
 * invisible: nothing looks different afterwards, and the next few packs
 * quietly start repeating songs a room heard last month.
 */

/**
 * WHAT IS ON THE SCREEN, AND WHAT IS NEXT.
 *
 * The running panel already said where the night had got to. This says what
 * the room is looking at and what pressing onwards would put in front of them
 * — a different question, and the one you want answered before you walk back
 * to the laptop.
 *
 * Quiz only: bingo's next track is picked off a call sheet by hand, so there
 * is nothing to predict and a guess would be worse than silence. The server
 * sends `null` for it and this draws nothing.
 *
 * The question and the answer are here because this is the HOST'S own page —
 * the same reason the control view carries them. Rule 1 is about the projector
 * and a player's phone.
 */
export function nowNextRows(running) {
  const at = running.onScreen;
  if (!at || !at.now) return '';
  const row = (tag, label, text) => `
    <div class="nn-row">
      <span class="nn-tag">${tag}</span>
      <span class="nn-what"><b>${esc(label)}</b>${text ? `<br><span class="tiny">${esc(text)}</span>` : ''}</span>
    </div>`;
  return `<div class="now-next">
    ${row('Now', at.now, at.nowText)}
    ${at.next ? row('Next', at.next, at.nextText) : ''}
  </div>`;
}

export function forgetPanel() {
  const el = node(`
    <div class="panel">
      <h3>Songs it will not repeat</h3>
      <div class="tiny">Every track the generator has used is remembered, so no room
        hears the same song twice in three months. Clearing it starts that memory
        again \u2014 useful for a new venue or a new year, and nothing else changes.</div>
      <button class="minor danger forget-go">Clear the memory</button>
      <div class="tiny forget-said"></div>
    </div>`);
  const said = el.querySelector('.forget-said');
  el.querySelector('.forget-go').addEventListener('click', async (ev) => {
    if (!confirm('Clear what the generator remembers?\n\nEvery track becomes fair game again, '
      + 'so a room could hear a song it heard last month. This cannot be undone.')) return;
    const btn = ev.currentTarget;
    btn.disabled = true;
    try {
      await postJson('/api/history/forget', {}, { 'X-Host-Key': hostKey });
      said.textContent = 'Cleared. The next pack can use anything.';
    } catch (err) {
      said.style.color = 'var(--bad)';
      said.textContent = err.message || 'Could not clear it.';
    }
    btn.disabled = false;
  });
  return el;
}

/* ================================================================= ADVERTS
 *
 * Slides for between rounds. This is a revenue feature, not decoration: the
 * host sells himself to venues on shifting their pizzas and their gig tickets,
 * so a set belongs to a VENUE and gets reused every week rather than being
 * written fresh each night.
 *
 * Kept deliberately plain — a heading, a line of words, an optional QR — because
 * a slide has to be readable from the back of a pub in three seconds, and
 * because he will be typing these in between other jobs.
 */
export function advertsSection(sets) {
  /*
   * WHOEVER IS ON THIS TAB MAY WRITE ON IT — and for a while nobody could.
   *
   * This was `can(FEATURES.CATALOGUE)`, which is the OWNER, under a comment
   * saying advert sets were shared between quizmasters and therefore unsafe to
   * let anybody else edit. **That stopped being true and the gate never
   * moved.** The server writes to `advertRoom.paths.adverts` — the room's own
   * folder — with no owner check on the route, and restores them per room on
   * boot. So the sets were scoped and the button was not.
   *
   * What that added up to is the fault this codebase keeps recording in other
   * forms: **a tab with no way in.** Adverts is a Silver feature, it appears on
   * the tab bar for exactly the people it is sold to, and every one of them
   * saw a page they could read and not write — with nothing on screen saying
   * why, because the reason had stopped existing.
   *
   * The tab itself needs `FEATURES.ADVERTS` to render at all, so anybody who
   * can see this holds it. There is no second question to ask.
   */
  const mine = true;
  const el = node(`
    <div class="game-section">
      <div class="game-head">
        <div>
          <h2>Advert slides</h2>
          <!-- "One set per venue" read as ONE ADVERT per venue, and the host
               asked what happens if a pub wants to advertise twice across
               three rounds. They already can — a set holds as many slides as
               you like and the picker on the control view chooses which goes
               up, as often as you like. The words were describing the STORAGE
               rather than what you can do with it. -->
          <div class="tiny">A set of slides per venue — as many as you like. Put any of them up
            between rounds from your control view, as often as the night needs.</div>
        </div>
        <div class="row">
          <!-- WHAT A VENUE ACTUALLY SENDS is a picture of their offer — a
               poster, a photo of the specials board, the flyer for a band.
               Asked for as "import from a file… they might get emailed it
               over". So the file IS the slide: pick one and it arrives as a
               slide with the picture already on it, waiting for a heading.
               Not a JSON importer: nobody is emailed one of those. -->
          ${mine ? '<label class="minor import-ad">Bring in a picture<input class="ad-file" type="file" accept="image/*" multiple hidden></label>' : ''}
          ${mine ? '<button class="role-make new-set">New set</button>' : ''}
        </div>
      </div>
      <div class="pack-grid"></div>
    </div>`);

  el.querySelector('.new-set')?.addEventListener('click', () => editAdvertSet(null));

  /*
   * A picture, or several, becoming slides.
   *
   * It opens the editor on a NEW set rather than saving one behind your back:
   * a slide with a picture and no words is refused by the validator anyway
   * (`validateAdvertPack` — a slide has to say something), and more to the
   * point the words are the half a venue is paying for. So the file gets you
   * past the fiddly part and leaves you at the keyboard.
   *
   * Shrunk on the way in like every other picture here, so a 4MB photo off
   * somebody's phone does not end up in the screen payload.
   */
  const filePick = el.querySelector('.ad-file');
  filePick?.addEventListener('change', async () => {
    const files = [...(filePick.files || [])];
    if (!files.length) return;
    const slides = [];
    for (const file of files) {
      try {
        slides.push({ id: 's' + (slides.length + 1), heading: '', body: '', say: '',
          image: await shrinkAdvertImage(file) });
      } catch (err) {
        alert(`${file.name}: ${err.message || 'could not be used'}`);
      }
    }
    filePick.value = '';
    if (slides.length) editAdvertSet(null, { slides });
  });

  const grid = el.querySelector('.pack-grid');
  if (!sets.length) {
    grid.appendChild(node(`
      <div class="tiny">Nothing yet. A set might be "The Crown" with a slide for the
      Tuesday pizza deal and one for the band on the 28th, with a QR to tickets.</div>`));
    return el;
  }

  for (const set of sets) {
    const card = node(`
      <div class="pack-card ${set.broken ? 'broken' : ''}">
        <button class="pack-title">${esc(set.title)}</button>
        <div class="tiny">${esc(set.venue || 'No venue set')}</div>
        <div class="tiny played">${set.slideCount} slide${set.slideCount === 1 ? '' : 's'}</div>
        ${set.broken ? `<div class="tiny" style="color:var(--bad)">Broken: ${esc(set.broken)}</div>` : ''}
        <div class="pack-actions">
          <!-- ORDINARY, not the night. It wore the "go" class — the account's gradient —
               which by the five roles means Launch and Take control, and
               editing a slide set is not that. Delete beside it is already
               outlined and "New set" above is green for "makes something", so
               this was the only one borrowing a meaning it does not have. -->
          <button class="minor edit">Edit</button>
          ${mine ? '<button class="pack-del">Delete</button>' : ''}
        </div>
      </div>`);
    const open = () => editAdvertSet(set.id);
    card.querySelector('.pack-title').addEventListener('click', open);
    card.querySelector('.edit').addEventListener('click', open);
    card.querySelector('.pack-del')?.addEventListener('click', async () => {
      if (!confirm(`Delete "${set.title}" and its ${set.slideCount} slide${set.slideCount === 1 ? '' : 's'}?`)) return;
      await fetch(keyed('/api/advert/' + encodeURIComponent(set.id)), {
        method: 'DELETE', headers: { 'X-Host-Key': hostKey },
      });
      await load();
    });
    grid.appendChild(card);
  }
  return el;
}

export function editAdvertSet(id, seed = null) {
  const overlay = node(`
    <div class="sheet-overlay">
      <div class="sheet">
        <div class="sheet-head">
          <div>
            <input class="sheet-title" id="adTitle" placeholder="What to call this set">
            <input class="tiny ad-venue-in" id="adVenue" placeholder="Venue — e.g. The Crown, Chelmsford">
          </div>
          <div class="row">
            <button class="role-make" id="adSave">Save</button>
            <button class="minor" id="adClose">Close</button>
          </div>
        </div>
        <div class="sheet-body" id="adBody"></div>
      </div>
    </div>`);
  document.body.appendChild(overlay);

  const body = overlay.querySelector('#adBody');
  const close = () => overlay.remove();
  overlay.querySelector('#adClose').addEventListener('click', close);

  // Seeded when the set is being started FROM files — see the picture import
  // on the adverts tab. Everything else about the sheet is identical, so there
  // is one editor rather than a second one for imports.
  let pack = { id: '', title: '', venue: '', slides: [], ...(seed || {}) };
  // The opens ride in on the SAME fetch as the pack (see the route in
  // server.js) but are held apart from it — `opens` is not a pack field and
  // must never reach the PUT that saves one; `normaliseAdvertPack` would drop
  // it anyway, but keeping it out of `pack` is the honest version of that.
  let opens = {};

  const draw = () => {
    overlay.querySelector('#adTitle').value = pack.title;
    overlay.querySelector('#adVenue').value = pack.venue;
    const parts = pack.slides.map((slide, i) => slideEditor(slide, i, pack, draw, opens));
    const add = node('<button class="minor" style="margin-top:12px">Add a slide</button>');
    add.addEventListener('click', () => {
      pack.slides.push({ id: 's' + (pack.slides.length + 1), heading: '', body: '', say: '' });
      draw();
    });
    parts.push(add);
    body.replaceChildren(...parts);
  };

  overlay.querySelector('#adTitle').addEventListener('input', (e) => { pack.title = e.target.value; });
  overlay.querySelector('#adVenue').addEventListener('input', (e) => { pack.venue = e.target.value; });

  overlay.querySelector('#adSave').addEventListener('click', async () => {
    const btn = overlay.querySelector('#adSave');
    btn.disabled = true;
    btn.textContent = 'Saving…';
    // A new set gets its filename from the venue, or the title if there is no
    // venue — the same way a quiz is named after its theme.
    const slug = (pack.id || pack.venue || pack.title || 'adverts')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'adverts';
    try {
      const res = await fetch(keyed('/api/advert/' + encodeURIComponent(slug)), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Host-Key': hostKey },
        body: JSON.stringify({ ...pack, id: slug }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data.problems || [data.error]).join('\n'));
      close();
      await load();
    } catch (err) {
      alert(err.message);
      btn.disabled = false;
      btn.textContent = 'Save';
    }
  });

  if (!id) { pack.title = 'New advert set'; draw(); return; }
  fetch(keyed('/api/advert/' + encodeURIComponent(id)))
    .then((r) => r.json())
    .then((loaded) => { const { opens: op, ...rest } = loaded; pack = rest; opens = op || {}; draw(); })
    .catch(() => { body.replaceChildren(node('<div class="tiny">Could not open it.</div>')); });
}

/**
 * "41 opens, 12 on the 14th" — read back on the slide it belongs to, rather
 * than a second panel to keep in step with the code that earns it.
 *
 * Silent until there is a code to count, and silent again until anybody has
 * actually scanned it — a slide with a fresh code and no opens yet is not a
 * failure to report on.
 */
function opensLine(slide, opens) {
  if (!slide.offerCode) return '';
  const stat = (opens || {})[slide.id];
  if (!stat || !stat.total) return '<div class="tiny ad-opens">No opens yet.</div>';
  const last = stat.lastNight
    ? `, ${stat.lastNight.count} on ${new Date(stat.lastNight.day + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}`
    : '';
  return `<div class="tiny ad-opens">${stat.total} open${stat.total === 1 ? '' : 's'}${last}</div>`;
}

function slideEditor(slide, i, pack, redraw, opens = {}) {
  const el = node(`
    <div class="ad-slide">
      <div class="ad-slide-head">
        <b>Slide ${i + 1}</b>
        <button class="minor danger small ad-del">Delete</button>
      </div>
      <label class="tiny">On the screen, big</label>
      <input class="ad-h" maxlength="60" placeholder="PIZZA — 2 FOR 1 TONIGHT" value="${esc(slide.heading || '')}">
      <label class="tiny">Underneath, smaller</label>
      <input class="ad-b" maxlength="160" placeholder="Kitchen open till 10. Ask at the bar." value="${esc(slide.body || '')}">
      <!-- A PICTURE FOR THE SLIDE. The projector has always been able to draw
           one — screen.js has an advert has-image layout — and there has
           never been a way to add one, so the only route was hand-editing the
           JSON. This is finishing a half-built path rather than adding one.
           Shrunk in the browser to 900px, like the venue logo, because it
           rides in the screen payload while the slide is up. -->
      <label class="tiny">A picture for the slide — a photo of the food, the band, the offer</label>
      <div class="ad-pic-row">
        ${slide.image ? `<img class="ad-pic" alt="" src="${esc(slide.image)}">` : ''}
        <label class="minor ad-pic-pick">${slide.image ? 'Change' : 'Add or take one'}
          <input class="ad-img" type="file" accept="image/*" hidden>
        </label>
        ${slide.image ? '<button class="minor danger ad-pic-off">Remove</button>' : ''}
      </div>
      <label class="tiny">A link to put a QR code on the slide — tickets, a booking page</label>
      <input class="ad-l" placeholder="https://..." value="${esc(slide.link || '')}">
      <input class="ad-ll" maxlength="40" placeholder="What the QR is for — e.g. Tickets for the 28th" value="${esc(slide.linkLabel || '')}">
      <!--
        A CODE, SAID AT THE BAR, IS WHAT MAKES THE QR COUNTABLE — src/offers.js.
        With one, the QR points at this app's own offer page instead of the
        link above, records the open, and shows the code and the link on
        that page. Without one, the QR keeps pointing straight at the link,
        exactly as every slide already did — nothing here breaks a slide
        that has never used a code.
      -->
      <label class="tiny">A code to say at the bar — makes the QR countable, and works
        without a phone at all</label>
      <input class="ad-code" maxlength="24" placeholder="QUIZ40" value="${esc(slide.offerCode || '')}">
      <input class="ad-when" maxlength="80" placeholder="When it is valid — e.g. Tuesdays in August" value="${esc(slide.offerWhen || '')}">
      ${opensLine(slide, opens)}
      <label class="tiny">Your line for the mic — never goes on the screen</label>
      <input class="ad-say" maxlength="160" placeholder="Mention the pizza deal while this is up" value="${esc(slide.say || '')}">
    </div>`);

  const bind = (sel, key) => el.querySelector(sel).addEventListener('input', (e) => { slide[key] = e.target.value; });
  /*
   * The picture saves onto the slide OBJECT, like every other field here — the
   * set is written as a whole when you press Save, so there is nothing to
   * upload separately and nothing to leave half-done.
   */
  const pick = el.querySelector('.ad-img');
  pick?.addEventListener('change', async () => {
    const file = pick.files && pick.files[0];
    if (!file) return;
    try {
      slide.image = await shrinkAdvertImage(file);
      redraw();
    } catch (err) {
      alert(err.message || 'Could not use that image.');
    }
  });
  el.querySelector('.ad-pic-off')?.addEventListener('click', () => {
    delete slide.image;
    redraw();
  });

  bind('.ad-h', 'heading');
  bind('.ad-b', 'body');
  bind('.ad-l', 'link');
  bind('.ad-ll', 'linkLabel');
  bind('.ad-code', 'offerCode');
  bind('.ad-when', 'offerWhen');
  bind('.ad-say', 'say');

  el.querySelector('.ad-del').addEventListener('click', () => {
    pack.slides.splice(i, 1);
    redraw();
  });
  return el;
}

/* ==========================================================================
 * Invoicing.
 *
 * The night ends, the room empties, and the thing most likely not to happen is
 * the invoice — because by then it is half eleven and everything is in the car.
 * So this sits one tap from the end of a game and fills itself in.
 *
 * Sending it is deliberately the phone's own share sheet rather than the app
 * emailing it: it goes out from your address, so replies come to you and it
 * does not land in a spam folder addressed from nobody. The app's job is to
 * keep the record of who was invoiced and who has paid, which it does whether
 * you send it from here, from a laptop, or not at all.
 */
