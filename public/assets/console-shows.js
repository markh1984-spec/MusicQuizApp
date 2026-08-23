/**
 * Prepare a night — an evening saved: what is played, in order, and where.
 * Shown to a quizmaster as "Prepare a night"; the code, the data field and
 * the file names underneath all still say `show`/`shows` — a rename of the
 * DISPLAYED word only, not of the internal one. See the `id: 'shows'` entry
 * in `console.js` for why.
 */

import { binIcon, esc, node, postJson } from './client.js';
import { library, setShowDrag } from './console-state.js';
import { dragging, loadShow, night } from './console-tonight.js';
import { doorNow, goTo, hostKey, keyed, load, render } from './console.js';
import { itemsOf } from './show-parts.js';

export const shelfFor = (kind) => ((kind === 'bingo' ? library.bingo : library.quizzes) || []);

/**
 * What a pack is CALLED, from its id.
 *
 * A show stores ids and never titles — see `shows.js` — so every screen that
 * names one has to look it up, and a pack that has gone has to be named as an
 * id rather than as a blank. That last part is the point: "there is no pack
 * called eighties any more" is a sentence somebody can act on, and an empty
 * space is not.
 */
export function packTitle(kind, id) {
  const pack = shelfFor(kind).find((p) => p.id === id);
  return pack ? (pack.title || id) : id;
}

/**
 * WHAT A SHOW PLAYS, AND IN WHAT ORDER — the editor, in the Workshop only.
 *
 * Built because the first version of a show held ONE game, and the host killed
 * that in a sentence: *"you need to be able to save a show with all of the
 * rounds, venue info… say you want to swap out the music bingo after, you need
 * to be able to do that independent of removing the venue or other rounds."*
 *
 * **THE VENUE, THE PRIZES AND THE LOOK ARE NOT IN HERE, and that is the whole
 * requirement rather than an omission.** They live on the show, so swapping
 * the bingo cannot touch them — there is no arrangement of this panel that
 * could lose them, because they are not in the object being edited.
 *
 * **A DROPDOWN PER PART RATHER THAN A DRAG.** Swapping one is choosing a
 * different pack, which is what a select is for; and this app's own rule is
 * that HTML5 drag never fires on touch, so a drag-only editor would not exist
 * on the device half this console is driven from. The arrows do the ordering
 * for the same reason.
 */
function showPartsEditor(show, onSaved) {
  const el = node('<div class="parts-edit"></div>');
  let items = itemsOf(show).map((i) => ({ ...i }));

  const save = async (next) => {
    items = next;
    try {
      /*
       * THE WHOLE SHOW GOES BACK, with only `items` changed. Sending just the
       * parts would make this route two shapes — one that replaces a show and
       * one that patches it — and the second is where a field quietly gets
       * dropped. The venue and the settings ride along untouched.
       */
      await postJson('/api/shows', { ...show, items }, { 'X-Host-Key': hostKey });
      await load();
      onSaved();
    } catch (err) {
      alert(err.message || 'Could not save that.');
    }
  };

  const draw = () => {
    el.replaceChildren(node(`
      <div>
        <ol class="parts-list">
          ${items.map((item, i) => {
    const shelf = shelfFor(item.kind).filter((p) => !p.locked);
    const missing = !shelf.some((p) => p.id === item.packId);
    return `
            <li class="parts-row" data-at="${i}">
              <span class="show-dot ${item.kind === 'bingo' ? 'is-bingo' : 'is-quiz'}"></span>
              <select class="parts-pick" aria-label="Which ${item.kind === 'bingo' ? 'bingo game' : 'quiz'}">
                ${missing ? `<option value="" selected>${esc(item.packId)} — gone</option>` : ''}
                ${shelf.map((p) => `<option value="${esc(p.id)}" ${
      p.id === item.packId ? 'selected' : ''}>${esc(p.title || p.id)}</option>`).join('')}
              </select>
              <span class="parts-moves">
                <button class="minor parts-up" type="button" ${i === 0 ? 'disabled' : ''}
                  aria-label="Play this earlier">&uarr;</button>
                <button class="minor parts-down" type="button" ${i === items.length - 1 ? 'disabled' : ''}
                  aria-label="Play this later">&darr;</button>
                <button class="minor danger parts-off" type="button" ${items.length < 2 ? 'disabled' : ''}
                  aria-label="Take this out">&times;</button>
              </span>
              ${item.order ? `<span class="tiny parts-note">${item.order.length} round${
      item.order.length === 1 ? '' : 's'}, as you set it up</span>` : ''}
            </li>`;
  }).join('')}
        </ol>
        <div class="parts-add">
          ${['quiz', 'bingo'].map((kind) => (shelfFor(kind).filter((p) => !p.locked).length
    ? `<button class="minor parts-new" type="button" data-kind="${kind}">Add ${
      kind === 'bingo' ? 'a bingo game' : 'a quiz'}</button>` : '')).join('')}
        </div>
        <p class="tiny">The venue, the prizes and the look belong to the night, so
          changing what it plays leaves them alone.</p>
      </div>`));

    for (const row of el.querySelectorAll('.parts-row')) {
      const at = Number(row.dataset.at);
      row.querySelector('.parts-pick').addEventListener('change', (ev) => {
        if (!ev.target.value) return;
        /*
         * A NEW PACK MEANS A NEW RUNNING ORDER, so the old one is dropped
         * rather than carried over. Round 3 of the quiz you just swapped out
         * is not round 3 of this one, and keeping the indexes would play a
         * night nobody chose — silently, because the numbers still fit.
         */
        const next = items.map((it, i) => (i === at ? { kind: it.kind, packId: ev.target.value } : it));
        save(next);
      });
      const swap = (with_) => {
        const next = items.slice();
        [next[at], next[with_]] = [next[with_], next[at]];
        save(next);
      };
      row.querySelector('.parts-up').addEventListener('click', () => swap(at - 1));
      row.querySelector('.parts-down').addEventListener('click', () => swap(at + 1));
      row.querySelector('.parts-off').addEventListener('click', () => {
        save(items.filter((_, i) => i !== at));
      });
    }
    for (const add of el.querySelectorAll('.parts-new')) {
      add.addEventListener('click', () => {
        const kind = add.dataset.kind;
        const first = shelfFor(kind).filter((p) => !p.locked)[0];
        if (!first) return;
        save([...items, { kind, packId: first.id }]);
      });
    }
  };
  draw();
  return el;
}

/**
 * PREPARE A NIGHT — the shelf of evenings built in advance.
 *
 * Two doors, one function, exactly like Venues: on the Console it is a shelf
 * you drag off and nothing else, and in the Workshop it is where you rename
 * and throw away. Building happens on Tonight itself — see *Save for another
 * night*, on the launch bar — because everything a saved night holds is
 * already set up there, and a second composer is a second thing that could
 * disagree with the launch.
 */
export function showsSection() {
  const el = node('<div></div>');
  const draw = () => {
    const shows = library.shows || [];
    const findOnly = doorNow() === 'console';
    /*
     * ONE HEADING, NOT TWO — same fault, same fix as Venues. `tabBody()`
     * already draws the shared gradient tab-head on every door but Console,
     * so this panel's own `<h2>` only needs to appear where that one does
     * not, or Workshop said the tab's own name twice in a row.
     *
     * **THE CONCEPT EXPLAINER SHOWS ON WORKSHOP ALWAYS, EMPTY OR NOT** —
     * corrected after this tab (then called "Shows") was mistaken for Past
     * gigs, a different door entirely. It used to hide on an empty shelf on
     * the theory that it repeated the empty-state line below, which was
     * backwards: the empty-state line only says HOW to make one, this says
     * WHAT one IS, and the moment you most need telling what one is is the
     * first time you open the tab and find nothing in it — precisely when
     * this was being hidden. The tab itself was renamed in the same pass,
     * from a noun ("Shows") to the action it actually is.
     */
    const empty = !shows.length;
    el.replaceChildren(node(`
      <div class="game-section">
        <div class="game-head">
          <div>
            ${findOnly ? '<h2>Prepare a night</h2>' : `<div class="tiny">A whole evening kept as one thing —
              the packs, which rounds are on, the venue and its prizes, the look and
              the lobby game. Set a night up on Tonight and press
              <b>Save for another night</b>.</div>`}
          </div>
        </div>
        <div class="show-list">
          ${empty ? `<div class="tiny">Nothing prepared yet. Set a night up in
            ${goTo('console', 'quiz', 'Tonight')} and press <b>Save for another night</b>.</div>`
    : shows.map((show) => {
      const broken = (show.problems || []).length;
      const items = itemsOf(show);
      const bits = [
        show.venue || 'No venue',
        show.online ? 'Online' : 'In the room',
      ];
      return `
            <div class="show-card ${broken ? 'broken' : ''}" data-id="${esc(show.id)}" draggable="true">
              <div class="show-top">
                <span class="show-name">${esc(show.name)}</span>
                ${items.length > 1 ? `<span class="show-kind is-both">${items.length} parts</span>`
    : `<span class="show-kind ${items[0].kind === 'bingo' ? 'is-bingo' : 'is-quiz'}">${
      items[0].kind === 'bingo' ? 'Bingo' : 'Quiz'}</span>`}
              </div>
              <!-- WHAT IT PLAYS, IN ORDER, ON THE CARD ITSELF. A show is an
                   EVENING — a quiz and then the bingo — so a card that named
                   only the first thing would be describing half of it. The
                   numbers are the order the room gets them in. -->
              <ol class="show-parts">
                ${items.map((item) => `
                  <li class="show-part">
                    <span class="show-dot ${item.kind === 'bingo' ? 'is-bingo' : 'is-quiz'}"></span>
                    <span class="show-part-name">${esc(packTitle(item.kind, item.packId))}</span>
                    ${item.order ? `<span class="tiny show-part-n">${item.order.length}</span>` : ''}
                  </li>`).join('')}
              </ol>
              <div class="tiny show-gist">${esc(bits.join(' · '))}</div>
              ${broken ? `<div class="tiny show-wrong">${esc(show.problems.join(' '))}</div>` : ''}
              ${findOnly ? '' : `
                <div class="show-tools">
                  <button class="minor show-edit" type="button">What it plays</button>
                  <button class="minor show-rename" type="button">Rename</button>
                  <button class="minor danger show-del" type="button">${binIcon()} Delete</button>
                </div>
                <div class="show-parts-edit" hidden></div>`}
            </div>`;
    }).join('')}
        </div>
      </div>`));

    for (const card of el.querySelectorAll('.show-card')) {
      const show = shows.find((s) => s.id === card.dataset.id);
      if (!show) continue;
      /*
       * DRAG THE WHOLE EVENING UP TO TONIGHT. Same gesture as a pack and a
       * venue, same target — and the tap below is the way round it, because
       * HTML5 drag events are never delivered on touch and half this app is
       * driven from a phone.
       */
      card.addEventListener('dragstart', (ev) => {
        setShowDrag(show);
        ev.dataTransfer.effectAllowed = 'copy';
        ev.dataTransfer.setData('text/plain', show.name);
        card.classList.add('is-dragging');
        dragging(true);
      });
      card.addEventListener('dragend', () => {
        setShowDrag(null);
        card.classList.remove('is-dragging');
        dragging(false);
        document.querySelector('.launchbar')?.classList.remove('drop-here');
      });
      card.addEventListener('click', (ev) => {
        if (ev.target.closest('button')) return;
        loadShow(show);
      });

      /*
       * WHAT IT PLAYS, opened in place under the card. In the Workshop only —
       * on the Console door a show is a thing to pick up, and an editor there
       * would be the workshop creeping back onto the launch page, which is
       * the exact fault the doors were built to fix.
       */
      const partsSlot = card.querySelector('.show-parts-edit');
      card.querySelector('.show-edit')?.addEventListener('click', () => {
        if (!partsSlot.hidden) { partsSlot.hidden = true; partsSlot.replaceChildren(); return; }
        partsSlot.hidden = false;
        partsSlot.replaceChildren(showPartsEditor(show, () => render()));
      });
      // A card being edited must not also be a drag source: a select and a
      // pair of arrows inside a draggable box means every attempt to open the
      // dropdown picks the card up instead.
      partsSlot?.addEventListener('mousedown', (ev) => ev.stopPropagation());

      card.querySelector('.show-rename')?.addEventListener('click', async () => {
        const name = prompt('What is this called?', show.name);
        if (name === null || !name.trim() || name.trim() === show.name) return;
        try {
          /*
           * A rename is a save under a NEW id, so the old one has to go — the
           * id comes from the name, which is what keeps a show findable by
           * what it is called rather than by when it was made.
           */
          await postJson('/api/shows', { ...show, id: undefined, name: name.trim() }, { 'X-Host-Key': hostKey });
          await fetch(keyed(`/api/shows/${encodeURIComponent(show.id)}`), {
            method: 'DELETE', headers: { 'X-Host-Key': hostKey },
          });
          await load();
          render();
        } catch (err) {
          alert(err.message || 'Could not rename that.');
        }
      });

      card.querySelector('.show-del')?.addEventListener('click', async () => {
        if (!confirm(`Delete "${show.name}"?\n\nThe packs stay where they are — this only throws away the arrangement.`)) return;
        try {
          const res = await fetch(keyed(`/api/shows/${encodeURIComponent(show.id)}`), {
            method: 'DELETE', headers: { 'X-Host-Key': hostKey },
          });
          if (!res.ok) throw new Error((await res.json()).error || 'Could not delete that.');
          await load();
          render();
        } catch (err) {
          alert(err.message || 'Could not delete that.');
        }
      });
    }
  };
  draw();
  return el;
}
