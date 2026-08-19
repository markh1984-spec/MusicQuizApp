/** The pack shelf — the grid, a pack card, the pictures, and the launch call. */

import { esc, node, postJson, dragRow, gripIcon, moveWithin } from './client.js';
import { askForPackPanel, shopSection } from './console-account.js';
import { generate, streamGeneration } from './console-generate.js';
import { tonightsVenue, whenish } from './console-gigs.js';
import { field, money, sheet } from './console-invoices.js';
import { renderBingoPreview, renderQuizPreview } from './console-preview.js';
import { library, me, setPackDrag } from './console-state.js';
import { addToTonight, dragging, night, playedAt } from './console-tonight.js';
import { PACK_SHELF, can, canPin, doorNow, goTo, hostKey, isPinned, keyed, linkTo, load, packWord, pinIcon, pinRank, pinnedPacks, render, reorderPins, showDone, togglePin } from './console.js';
import { tonight } from './diary.js';
import { lobbyGameChoices, lobbyGameFor } from './lobby-games.js';
import { inSeason } from './looks.js';
import { packLookAttrs, shortTitle, titleSize } from './pack-look.js';
import { FEATURES, findTier } from './plans.js';

/*
 * Finding a pack when there are eighty of them.
 *
 * A search box and a compact toggle. Both are about the same problem: the grid
 * was fine at eight packs and is unusable at eighty, and eighty is where this
 * is going the moment packs are something to sell.
 *
 * SEARCH LOOKS INSIDE THE PACK, not just at its title. "Madonna" should find
 * the Madonna quiz AND the 80s pack with three Madonna questions in it, because
 * the second is what you actually cannot find any other way — and it is the
 * thing you want when a venue asks for a Madonna round.
 *
 * COMPACT is remembered, per tab, because it is a preference about how you
 * work rather than about this visit.
 */
const DENSE_STORE = 'musicquiz.compactpacks';
let packQuery = { quiz: '', bingo: '' };

/**
 * What one pack costs, said the way a price is said.
 *
 * `money()` on this page is the INVOICE formatter — it prints £3.00, because an
 * invoice line with a bare £3 on it looks like somebody forgot the pence. A
 * shop price is the other way round: £3.00 reads as a form, £3 reads as a
 * price. Same number, different job, so it gets its own two lines rather than
 * an option on the other one.
 *
 * Read off the library payload, never written out here, so the card and the
 * server cannot disagree about what a purchase would charge.
 */
/**
 * Is this pack topical, and has it gone off?
 *
 * A DATE rather than a `topical: true` flag, and that is the whole point: a
 * boolean says a pack is dated but not whether it is STALE, and stale is the
 * only part anybody needs telling about. A pack with no date is evergreen.
 *
 * Read in the browser as well as on the server because the console has to sort
 * and label on it, and a second copy of the rule is exactly what `freshness()`
 * in quizzes.js exists to prevent — so the shape is identical and this one only
 * ever draws.
 */
export function freshness(pack) {
  const until = Date.parse(pack.freshUntil || '');
  if (!Number.isFinite(until)) return { topical: false, expired: false, until: null };
  return { topical: true, expired: Date.now() > until, until };
}

/** "for the week of 12 August", the way somebody would say it out loud. */
export function freshLabel(pack) {
  const { topical, expired, until } = freshness(pack);
  if (!topical) return '';
  const when = new Date(until).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
  return expired ? `Was current to ${when}` : `Current until ${when}`;
}

export function packPrice() {
  const pence = Number((library && library.packPence) || 0) || 300;
  return pence % 100 ? `£${(pence / 100).toFixed(2)}` : `£${pence / 100}`;
}

/**
 * YOUR PINNED SIX, IN ORDER — drag to rearrange.
 *
 * `pinRank()` already sorts the shelf on POSITION within `prefs.pinnedPacks`,
 * not merely on membership — that half was fixed. What never existed is a way
 * to SET that position by hand; the only tool was unpinning and repinning in
 * the order you wanted, which is real but nobody would call it arranging.
 *
 * **Its own small list, not the shelf's cards made draggable.** A pack card
 * is already a drag SOURCE — dragged up to Tonight — and a second, different
 * drag purpose on the same element is two drag operations competing for one
 * `dragstart`, which native HTML5 drag resolves by picking whichever
 * draggable ancestor is closest, not by which one you meant. A short list of
 * names has no such conflict and reuses `dragRow()`/`moveWithin()` from the
 * editor exactly as they are.
 *
 * **Silent with nothing to arrange.** Reordering nought or one pack is not a
 * feature, and a permanently-empty control is furniture — the same judgement
 * that keeps `advertsForVenue()` quiet for a venue with no slides.
 *
 * @returns {HTMLElement|null}
 */
function pinnedArranger(kind, packs) {
  if (!canPin()) return null;
  const idsThisKind = new Set(packs.map((p) => p.id));
  const byId = new Map(packs.map((p) => [p.id, p]));
  const otherIds = pinnedPacks().filter((id) => !idsThisKind.has(id));
  let pins = pinnedPacks().filter((id) => idsThisKind.has(id) && byId.has(id));
  if (pins.length < 2) return null;

  const el = node(`
    <div class="pin-arranger">
      <div class="tiny pin-arranger-tag">Your six, in order — drag to rearrange</div>
      <div class="pin-arranger-rows"></div>
    </div>`);
  const rows = el.querySelector('.pin-arranger-rows');

  const save = async (order) => {
    const before = pins;
    pins = order;
    try {
      await reorderPins(pins, otherIds);
    } catch (err) {
      pins = before;
      draw();
      alert(err.message || 'Could not save that order.');
    }
  };

  const draw = () => {
    rows.replaceChildren(...pins.map((id, i) => {
      const pack = byId.get(id);
      const row = node(`
        <div class="pin-row">
          <span class="drag-grip" draggable="true" title="Drag to reorder">${gripIcon()}</span>
          <span class="pin-row-title">${esc(shortTitle(pack.title))}</span>
          <button class="minor pin-row-off" type="button" aria-label="Unpin ${esc(pack.title)}">&times;</button>
        </div>`);
      dragRow(row, { i }, () => true, (from, to, above) => {
        const order = [...pins];
        moveWithin(order, from.i, to.i, above);
        /*
         * `save()` is ASYNC BUT NOT AWAITED HERE, and the order matters
         * because of it: its first line, `pins = order`, runs synchronously
         * the moment it is called — before the function reaches its `await`
         * — so calling `save()` before `draw()` means `draw()` already sees
         * the new order. Called the other way round, as this line first was,
         * the drop visually did nothing until the next full page render:
         * `draw()` read the OLD `pins`, because nothing had reassigned it
         * yet. Found by dragging a row and watching it silently snap back.
         */
        save(order);
        draw();
      });
      // togglePin() already removes it from prefs.pinnedPacks and re-renders
      // the whole page — the same call the shelf's own pin button makes.
      // Nothing extra to do here; a second write would race it.
      row.querySelector('.pin-row-off').addEventListener('click', () => togglePin(id, row.querySelector('.pin-row-off')));
      return row;
    }));
  };
  draw();
  return el;
}

export function gameSection(kind, title, blurb, packs, editLabel = 'Edit') {
  const door = doorNow();
  const dense = localStorage.getItem(DENSE_STORE) === '1';
  const query = packQuery[kind] || '';

  const el = node(`
    <div class="game-section">
      <!--
           ON THE CONSOLE DOOR THERE IS NOTHING HERE BUT THE SEARCH BOX.

           *"Nothing is between the console and the packs — remove everything
           else."* So the heading, the blurb, Compact, My packs and the way to
           the workshop are all Workshop-door furniture now. Between the launch
           bar and the cards there is one control, and it is the one that
           reaches the packs the six do not show.

           **SEARCH STAYS AND HAS TO.** See all was removed at the same
           instruction, so typing is now the ONLY way to reach the seventh pack
           onwards. Taking the box away as well would strand every pack outside
           the recommended six.
      -->
      <div class="game-head ${door === 'console' ? 'head-bare' : ''}">
        ${door === 'console' ? '' : `<div>
          <h2 class="pack-head">Recommended</h2>
          <div class="tiny">${esc(blurb)}</div>
        </div>`}
        <div class="pack-tools">
          <input class="pack-search" type="search" placeholder="Search ${(packs || []).filter((p) => !p.locked).length}…"
                 value="${esc(query)}" aria-label="Search packs">
          ${door === 'console' ? '' : `
          <button class="minor pack-dense" title="${dense ? 'Show the full cards' : 'Squeeze more on screen'}"
                  aria-pressed="${dense}">${dense ? 'Cards' : 'Compact'}</button>
          ${can(FEATURES.CATALOGUE) || can(FEATURES.OWN_PACKS) ? `<a class="minor" href="${linkTo('/editor')}">${esc(editLabel)}</a>` : ''}`}
        </div>
      </div>
      ${door === 'console' ? '' : `<div class="row pack-way-row">
        ${can(FEATURES.CATALOGUE) || can(FEATURES.OWN_PACKS) || can(FEATURES.GENERATE)
    ? `<p class="tiny pack-way"><a href="${linkTo('/editor')}">Write, buy or edit packs →</a></p>` : ''}
      </div>`}
      <div class="pin-arranger-slot"></div>
      <div class="pack-grid ${dense ? 'dense' : ''}"></div>
      <!-- THE SHOP IS NOT HERE ANY MORE. It is its own tab behind My account
           - see shopSection(). A shop under the shelf put something to spend
           money on at the bottom of the page somebody opens to work, and it
           sat a whole tab away from the tiers, which are the other way to get
           the same packs. -->
      <div class="ask-slot"></div>
    </div>`);

  /*
   * "There is nothing here for the night I have booked."
   *
   * It goes UNDER the shop, because that is the moment the want actually
   * arrives: you have scrolled the catalogue, you have scrolled the shelf, and
   * neither has the thing. Putting it in the suggestion box on another tab
   * would mean remembering it later, which is exactly what that box exists to
   * avoid needing.
   */
  /*
   * ASK FOR A PACK IS WORKSHOP FURNITURE, like everything else that makes or
   * requests one. It was appended here rather than through `tab.generator()`,
   * so the gate that moved the writing panels off the Console door missed it
   * entirely — and it went on rendering there, under the packs, after the
   * change that was supposed to remove it. Found by a browser listing what was
   * actually on the page, not by reading the diff.
   */
  if (door !== 'console') el.querySelector('.ask-slot').appendChild(askForPackPanel(kind));

  /*
   * CHOOSING THE SIX — drag-to-arrange, in the Workshop only.
   *
   * `IT BELONGS IN THE WORKSHOP, NOT THE CONSOLE` — todo/console.md. The pin
   * itself already works from the shelf below; what was missing is an ORDER
   * you can set by hand rather than by unpinning and repinning in sequence.
   */
  if (door === 'workshop') {
    const arranger = pinnedArranger(kind, packs || []);
    if (arranger) el.querySelector('.pin-arranger-slot').appendChild(arranger);
  }

  const grid = el.querySelector('.pack-grid');
  const search = el.querySelector('.pack-search');

  /*
   * Yours first, then the shop, with a heading between them.
   *
   * One mixed grid was the first attempt and it is wrong: a padlocked card
   * three rows down among ones you can launch reads as a fault in your account
   * rather than as something for sale. Separated, the shop is a shelf you
   * choose to look at, and the packs you can actually run tonight are all
   * above it — which is what somebody opening this page ten minutes before a
   * gig is looking for.
   */
  /*
   * ONE PACK IS OPEN AT A TIME, and the rest are just names.
   *
   * Asked for after the first weeks of real use: *"we don't need all the
   * options for launch on every pack in the list — just the selected one, the
   * rest can be compacted into a card with their name only."* He is right, and
   * it is the third design rule doing the work: the common job on this tab is
   * FIND TONIGHT'S PACK AND PRESS LAUNCH, and nine cards each carrying four
   * dropdowns, a prize line, five buttons and a Launch is a wall you read
   * rather than a shelf you scan.
   *
   * The settings are per-night decisions about ONE pack, so they belong to the
   * one you have chosen and nowhere else. Closed, a card is its name and a line
   * of what it is — which is what you choose BY.
   *
   * `repaint` is handed to each card so opening one can redraw the grid
   * without the whole page reloading. `load()` would work and is far heavier:
   * it refetches the library, and on a tab whose whole point is being quick
   * that is a visible stutter for a purely local change.
   */
  const paint = () => {
    const found = matchPacks(packs || [], packQuery[kind]);
    grid.replaceChildren();

    if (!packs || !packs.length) {
      grid.appendChild(node('<div class="tiny">Nothing saved yet — build one above.</div>'));
      return;
    }
    if (!found.length) {
      grid.appendChild(node(`<div class="tiny">Nothing matches “${esc(packQuery[kind])}”.</div>`));
      return;
    }

    /*
     * Fresh topical packs first, expired ones last.
     *
     * A "week that just went past" pack is only worth anything this week, so
     * it belongs at the top while it is — and an expired one in the middle of
     * the grid in November is somebody scrolling past six dead packs to find
     * the quiz they wanted. It is NOT hidden: a pack that vanished would read
     * as lost work, and last month's news round is a perfectly good thing to
     * run on purpose.
     */
    const shelf = (p) => (freshness(p).expired ? 2 : freshness(p).topical ? 0 : 1);
    /*
     * PINNED FIRST, then the pack this room is least likely to have heard.
     *
     * A pin is somebody saying "this one, keep it where I can reach it", and
     * the app's own ordering guessing better than that would make the pin a
     * suggestion rather than a decision. Under the pins it is the same rule
     * `quickPicks()` uses on the launch bar — a dated pack first because it is
     * the only thing on the shelf worth less tomorrow, expired ones last, and
     * never-played before long-ago. That ranking is not decoration once only
     * SIX are shown: it decides what you can reach.
     */
    const inOrder = [...found].sort((a, b) => (pinRank(a.id) - pinRank(b.id))
      || (shelf(a) - shelf(b))
      || (playedAt(a.lastPlayedAt) - playedAt(b.lastPlayedAt)));
    // Only what they can RUN. What is for sale is a room of its own now.
    const yours = inOrder.filter((p) => !p.locked);

    if (!yours.length) {
      grid.appendChild(node(`<div class="tiny">None of the ones you have match “${esc(packQuery[kind])}”.</div>`));
    }

    /*
     * SIX ON DISPLAY, AND THE REST BEHIND THE SEARCH BOX.
     *
     * Asked for in these words: *"the section needs 6 on display in total and
     * to hide the other packs behind a search function… these sections are
     * designed to quick launch a night as quickly as possible."*
     *
     * **AND THE REASON IS THE DRAG, not tidiness** — the host's own earlier
     * framing, which is what makes six the right number rather than an
     * arbitrary one: *"6 is perfect because it's not just about crowding but
     * also what can be seen to be dragged and dropped."* A drag needs the card
     * AND the slot on screen together. One row directly under the Tonight bar
     * is what makes that possible; a second row is already a scroll away from
     * the thing you are dragging into.
     *
     * **THE SIX ARE A WINDOW, AND ONLY THEIR CONTENTS CHANGE.** At rest they
     * are the ranking above; while searching they are the top six matches.
     * Search scans everything and shows six — so a pack you searched for is
     * exactly as reachable as one the app suggested, which is the entire
     * point. Results appearing in a longer list further down the page would
     * put the thing you were looking for out of reach of the slot you want it
     * in.
     *
     * **See all** is the way to everything, and it is a plain outlined button
     * rather than a second gradient: the one "press this" on this tab is
     * Launch.
     */
    /*
     * SIX, AND NOTHING THAT EXPANDS. Asked for directly: *"only show 6 and no
     * options to expand or see more — the link is fine but only one link."*
     *
     * The See all button is gone rather than hidden. **The way to the other
     * seventeen is the search box**, which is the same answer as before minus
     * a control that put a second row back on the one page whose whole job is
     * to stay one row. A shelf with an expander is a shelf that is sometimes
     * two rows, and "sometimes" is what makes a drag target unlearnable.
     */
    const shown = yours.slice(0, PACK_SHELF);
    // The heading follows the state — see the note where it is drawn. Set here
    // rather than in the template because `paint()` runs again on every search
    // keystroke and every See all, and the head is not rebuilt with the grid.
    const headEl = el.querySelector('.pack-head');
    if (headEl) {
      /*
       * READ THE QUERY AGAIN HERE, do not use the one from the closure.
       *
       * `gameSection()` captures `query` once when the section is built;
       * `paint()` runs again on every keystroke. So the captured value is
       * always the query the section was BUILT with — an empty string on
       * arrival — and the heading only ever changed for See all. Typing
       * "metal" filtered the cards to two and left the heading saying
       * "Recommended" over them, which is the exact lie the rename existed to
       * stop.
       */
      const typing = (packQuery[kind] || '').trim();
      headEl.textContent = typing ? 'Your library' : 'Recommended';
    }
    for (const pack of shown) grid.appendChild(packCard(kind, pack, paint));
  };

  // Redrawn in place rather than through render(), so the box keeps focus and
  // the caret does not jump to the end after every letter.
  search.addEventListener('input', () => { packQuery[kind] = search.value; paint(); });

  /*
   * GUARDED, because the button is not drawn on the Console door.
   *
   * It was not, and that took the console down — the markup was made
   * conditional and the wiring left unconditional, so `querySelector` returned
   * null, `addEventListener` threw, and the whole page rendered as "could not
   * load" for every quizmaster on the one door a night is launched from.
   *
   * **THE CLASS OF FAULT: a template that varies and wiring that does not.**
   * Every `querySelector` in a function whose markup differs by door has to
   * assume the element may be absent — there is no test that can see this,
   * because it is valid JavaScript operating on markup that is only decided at
   * render time. A browser opening the page is the only thing that finds it.
   */
  el.querySelector('.pack-dense')?.addEventListener('click', () => {
    localStorage.setItem(DENSE_STORE, dense ? '0' : '1');
    render();
  });

  paint();
  return el;
}

/**
 * Which packs match what was typed.
 *
 * Every word has to appear SOMEWHERE in the pack — title, id, round names,
 * question text, answers, artists, track titles — so "abba disco" finds the
 * disco pack with Abba on it rather than nothing at all. Words rather than the
 * whole phrase, because nobody types a title in the order it was saved.
 */
function matchPacks(packs, query) {
  const words = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return packs;
  return packs.filter((pack) => {
    const hay = searchText(pack);
    return words.every((w) => hay.includes(w));
  });
}

/*
 * `pack.search` is built SERVER-SIDE — every question, answer, artist and track
 * title, deduplicated down to words. The console only ever receives a summary
 * of a pack, so without it a search could match a title and nothing else, and
 * "which pack has the Wham question in it" is precisely the search you cannot
 * do any other way. See `searchBlob` in src/quizzes.js.
 */
function searchText(pack) {
  return `${pack.title || ''} ${pack.id || ''} ${pack.search || ''}`.toLowerCase();
}

function hasPictureRound(pack) {
  return (pack.rounds || []).some((r) => r.type === 'image');
}

/**
 * Round 2 artwork, from the console.
 *
 * Two buttons rather than one, because they are not the same decision.
 * Placeholders are free and instant and exist so the round is rehearsable;
 * real portraits cost money per press. The panel says which questions still
 * have a stand-in before you spend anything, and never quietly replaces a
 * real picture — one you have already paid for, or redrawn by hand, has to be
 * asked for again explicitly.
 *
 * The style and the quality are both here rather than on the pack, because
 * both are decisions about what you are willing to spend today. Changing the
 * style re-reads the plan, so "as a superhero" says out loud that it is a
 * fresh set of ten and what that costs — a picture library is only shared
 * within a style.
 */
function picturePanel(pack) {
  const el = node(`
    <div class="panel pics">
      <div class="tiny status">Checking what round 2 has…</div>
      <div class="row pic-opts" style="margin-top:8px">
        <label class="tiny">Style
          <select class="style"></select>
        </label>
        <label class="tiny">Quality
          <select class="quality"></select>
        </label>
      </div>
      <div class="tiny style-hint"></div>
      <div class="row" style="margin-top:8px">
        <button class="minor draw">Draw stand-ins</button>
        <button class="role-make make">Make real portraits</button>
        <label class="tiny redo"><input type="checkbox" class="force"> replace ones already there</label>
      </div>
      <div class="tiny note"></div>
      <details class="pic-lib" hidden>
        <summary class="tiny"></summary>
        <div class="lib-names"></div>
      </details>
      <pre class="gen-log" hidden></pre>
    </div>`);

  const status = el.querySelector('.status');
  const note = el.querySelector('.note');
  const logEl = el.querySelector('.gen-log');
  const makeBtn = el.querySelector('.make');
  const drawBtn = el.querySelector('.draw');
  const styleSel = el.querySelector('.style');
  const qualitySel = el.querySelector('.quality');
  const styleHint = el.querySelector('.style-hint');

  // Roughly what OpenAI charges for one 1024x1024, in pence. Only ever used to
  // put a figure in front of the host before he presses a button that spends
  // money — so it is deliberately on the high side of what it might be.
  // The prices come from the server, which reads them off the ledger's own
  // table. There was a second copy of them here, so the quote before the press
  // and the record after it could disagree — which is the one thing the price
  // table's own comment says it exists to prevent. This is only the fallback
  // for a payload from an older server.
  let pence = { low: 1, medium: 4, high: 14 };
  let supplier = '';
  let filled = false;

  const refresh = async () => {
    try {
      const chosen = styleSel.value ? `?style=${encodeURIComponent(styleSel.value)}` : '';
      const res = await fetch(keyed(`/api/images/${encodeURIComponent(pack.id)}${chosen}`));
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Could not read it');

      if (!filled) {
        filled = true;
        styleSel.innerHTML = d.styles
          .map((st) => `<option value="${esc(st.id)}"${st.id === d.style ? ' selected' : ''}>${esc(st.label)}</option>`).join('');
        qualitySel.innerHTML = d.qualities
          .map((q) => `<option value="${esc(q)}"${q === d.defaultQuality ? ' selected' : ''}>${esc(q)}</option>`).join('');
      }
      const picked = d.styles.find((st) => st.id === styleSel.value);
      styleHint.textContent = picked ? picked.hint : '';

      const bits = [`${d.total} picture${d.total === 1 ? '' : 's'} in round 2`];
      if (d.real) bits.push(`${d.real} real`);
      if (d.placeholder) bits.push(`${d.placeholder} stand-in${d.placeholder === 1 ? '' : 's'}`);
      if (d.missing) bits.push(`${d.missing} with nothing yet`);
      status.textContent = bits.join(' · ');

      if (d.pence) pence = d.pence;
      supplier = { google: 'Google', openai: 'OpenAI' }[d.art] || '';
      if (!d.art) {
        makeBtn.disabled = true;
        note.textContent = 'Set GOOGLE_API_KEY to make real portraits. Stand-ins work without it.';
        note.style.color = 'var(--gold)';
      } else {
        makeBtn.disabled = false;
        // The plan, not the pack: what this press costs given what the shared
        // library already holds. "6 already drawn" is the whole point of the
        // library, so it is the first thing on the line.
        const { reused, toDraw } = d.plan;
        const cost = (toDraw * (pence[qualitySel.value || d.defaultQuality] ?? 0)) / 100;
        const parts = [];
        if (reused) parts.push(`${reused} already in the library, free`);
        parts.push(toDraw
          ? `${toDraw} to draw — about ${cost < 0.1 ? `${Math.round(cost * 100)}p` : `£${cost.toFixed(2)}`}`
          : 'nothing left to draw');
        note.textContent = parts.join(' · ') + (toDraw ? '' : '. Tick the box to redo any.');
        note.style.color = '';
      }

      /*
       * Everybody already drawn, folded away behind a caret.
       *
       * The filename IS the index — the key is the answer text — so "Michael
       * Jackson" and "Michael Jackson (Jacko)" are two people as far as the app
       * is concerned, and you pay for both. Nothing catches that and a fuzzy
       * warning would be worse than the problem: it cannot tell "The Jacksons"
       * from "Michael Jackson", and the remedy for a true positive is editing
       * an answer a player sees rather than a filename.
       *
       * So it just shows the list, sorted, where two near-identical names end
       * up next to each other and the eye does the rest. Shut by default,
       * because on the common press this is not what you came for.
       */
      const lib = d.library || [];
      const box = el.querySelector('.pic-lib');
      box.hidden = !lib.length;
      if (lib.length) {
        const drawn = lib.filter((r) => r.real).length;
        box.querySelector('summary').textContent =
          `The library — ${drawn} ${drawn === 1 ? 'person' : 'people'} drawn, free to reuse`;
        box.querySelector('.lib-names').replaceChildren(...lib.map((r) => node(
          `<span class="lib-name ${r.real ? '' : 'stand-in'}" title="${esc(r.file)}">${esc(r.slug)}</span>`)));
      }
    } catch (err) {
      status.textContent = err.message;
    }
  };
  refresh();
  styleSel.addEventListener('change', refresh);
  qualitySel.addEventListener('change', refresh);

  const run = async (provider, button) => {
    const force = el.querySelector('.force').checked;
    const real = provider !== 'placeholder';
    if (real && !confirm(`Generate with ${supplier || 'the picture service'} at ${qualitySel.value} quality? ${note.textContent}`)) return;
    for (const b of [makeBtn, drawBtn]) b.disabled = true;
    button.textContent = real ? 'Making…' : 'Drawing…';
    logEl.hidden = false;
    logEl.textContent = '';
    const say = (line) => { logEl.textContent += line + '\n'; logEl.scrollTop = logEl.scrollHeight; };

    try {
      const { done, error } = await streamGeneration('/api/generate/images', {
        quizId: pack.id, provider, force,
        style: styleSel.value, quality: qualitySel.value,
      }, say);
      if (error) say('\n' + error);
      else if (done) {
        say(`\n${done.made} made, ${done.reused} from the library${done.failed ? `, ${done.failed} failed` : ''}.`);
        if (!done.backedUp && done.made) say('These are on this server only — generate at home and commit them to keep them.');
      }
    } catch (err) {
      say('\n' + err.message);
    }
    for (const b of [makeBtn, drawBtn]) b.disabled = false;
    makeBtn.textContent = 'Make real portraits';
    drawBtn.textContent = 'Draw stand-ins';
    refresh();
  };

  // "real" rather than a supplier name: which one gets billed is the server's
  // decision, from which key is set. See /api/generate/images.
  makeBtn.addEventListener('click', () => run('real', makeBtn));
  drawBtn.addEventListener('click', () => run('placeholder', drawBtn));
  return el;
}

function hasIntroRound(pack) {
  return (pack.rounds || []).some((r) => r.type === 'intro');
}

/**
 * The Spotify playlist for a "name that intro" round.
 *
 * Its own button rather than only a step inside generation, because you can
 * easily have an intro round before you have a Spotify login — and because a
 * playlist deleted by accident should not mean regenerating the quiz and
 * getting a different set of questions.
 *
 * Building it also writes Spotify's own spelling and a track link back onto
 * each cue, so the control view can offer a tap to open the track instead of
 * leaving you searching for it with a room waiting.
 */
function playlistPanel(pack) {
  const gen = library.generation || {};
  const el = node(`
    <div class="panel pics">
      <div class="tiny status">Builds a Spotify playlist in question order — track one is question one.</div>
      <div class="row" style="margin-top:8px">
        <button class="role-make build">Make the playlist</button>
      </div>
      <div class="tiny note"></div>
      <details class="pic-lib" hidden>
        <summary class="tiny"></summary>
        <div class="lib-names"></div>
      </details>
      <pre class="gen-log" hidden></pre>
    </div>`);

  const note = el.querySelector('.note');
  const button = el.querySelector('.build');
  const logEl = el.querySelector('.gen-log');

  if (!gen.spotify) {
    button.disabled = true;
    note.style.color = 'var(--gold)';
    note.textContent = `Spotify is not set up — run \`npm run spotify:login\`. Missing: ${(gen.spotifyMissing || []).join(', ')}`;
  } else {
    note.textContent = 'Spotify cannot make folders through its API, so every playlist is named the same way and they sort together — drag them into a folder in one go.';
  }

  button.addEventListener('click', async () => {
    button.disabled = true;
    button.textContent = 'Building…';
    logEl.hidden = false;
    logEl.textContent = '';
    const say = (line) => { logEl.textContent += line + '\n'; logEl.scrollTop = logEl.scrollHeight; };
    try {
      const { done, error } = await streamGeneration('/api/playlist/intro', { quizId: pack.id }, say);
      if (error) say('\n' + error);
      else if (done) {
        for (const p of done.playlists) {
          say(`\n${p.round}: ${p.url}${p.missing ? ` (${p.missing} not found on Spotify)` : ''}`);
        }
        if (!done.playlists.length) say('\nNo playlist made.');
        /*
         * Hold the result above everything BEFORE reloading.
         *
         * `load()` rebuilds the page from the library, which tears down this
         * card and takes the panel — and the link it just printed — with it.
         * From the outside that is a button that says "Building…" and then
         * closes, with nothing to show for a playlist that was in fact made.
         * Exactly the fault the generators had, and the same fix.
         */
        const failed = done.failed || [];
        for (const f of failed) say(`\n${f.round}: ${f.error}`);
        /*
         * Say WHICH round failed and WHY. "No playlist made" on its own was
         * the same message for a Spotify permission being refused and for a
         * quiz whose tracks are all misspelt — and those want completely
         * different things doing about them.
         */
        const built = done.playlists.length
          ? `<b>Playlist built.</b> ${done.playlists.map((p) => `<a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.round)}</a>${p.missing ? ` <span class="tiny">(${p.missing} not found on Spotify)</span>` : ''}`).join(' · ')}`
          : '';
        const broke = failed.length
          ? `<b>Could not build ${failed.length === 1 ? 'it' : 'them'}.</b> ${failed.map((f) => `${esc(f.round)} — ${esc(f.error)}`).join(' · ')}`
          : '';
        showDone(built && !broke ? 'good' : broke ? 'bad' : 'warn',
          [built, broke].filter(Boolean).join('<br>')
            || '<b>No playlist made.</b> This quiz has no intro round with tracks on it.');
        await load();
      }
    } catch (err) {
      say('\n' + err.message);
    }
    button.disabled = false;
    button.textContent = 'Make the playlist';
  });

  return el;
}

/**
 * The card shapes this pack has enough tracks for, ready to launch with.
 *
 * The shape belongs to the NIGHT, not to the pack: the same forty-two songs are
 * a quick game on a 3x3 and a long one on a strip, and which you want depends
 * on how much of the evening is left — something you know when you press
 * Launch, not when you filed the songs weeks ago. So it is chosen here, and
 * never written back to the file.
 *
 * Shapes the list cannot fill are left out rather than shown and refused.
 */
export function shapeOptions(pack) {
  const shapes = (library && library.cardShapes) || [];
  const fits = shapes.filter((s) => pack.trackCount >= s.minimum);
  const usable = fits.length ? fits : shapes.slice(0, 1);
  // The pack's own shape is the default, if it is one of the ones on offer.
  const own = usable.find((s) => s.rows === pack.cardRows && s.cols === pack.cardCols)
    || usable.find((s) => s.rows === s.cols && s.rows === pack.cardSize)
    || usable[usable.length - 1];
  // "line of 8" is the number that actually decides how long the game runs —
  // on a square it is the side, on a strip it is the long way.
  return usable.map((s) => `<option value='{"rows":${s.rows},"cols":${s.cols}}' ${s === own ? 'selected' : ''}>${esc(s.label)} — line of ${Math.max(s.rows, s.cols)}</option>`).join('');
}

/**
 * How it looks tonight.
 *
 * The pack carries a default — a Halloween quiz should look like one without
 * being asked — and this overrides it for this evening only, the same as the
 * card shape and the number of prizes. Nothing about how a round plays changes;
 * it is a palette and some drawn shapes down the sides.
 */
/**
 * The look picker, with the time of year marked.
 *
 * A quizmaster running a Halloween quiz on the 30th of October should not have
 * to hunt down a list for the Halloween look — so the one that suits today is
 * SAID ("in season now") and moved to the top, directly under "The usual".
 *
 * IT IS NEVER SELECTED FOR THEM. The pack's own look still wins, and a
 * corporate booking in late October is not quietly given skulls because the
 * calendar said so. The date suggests; the person who knows the room decides.
 */
/**
 * The lobby games, for the picker under Set it up.
 *
 * Locked ones are `disabled` and say which tier they are on, rather than being
 * filtered out — the subtle upsell the Adverts tab already uses. The default
 * for THIS kind of night is the one selected, so somebody who never opens this
 * gets exactly what they got before the picker existed.
 */
export function lobbyGameOptions(kind) {
  const tier = (me && me.entitlements && me.entitlements.tier) || '';
  const fallback = lobbyGameFor(kind, '').id;
  return lobbyGameChoices(tier).map((g) => {
    const label = g.held ? `${g.name} — ${g.blurb}` : `${g.name} — ${(findTier(g.tier) || {}).label || g.tier} and up`;
    return `<option value="${esc(g.id)}" ${g.held ? '' : 'disabled'} ${g.id === fallback ? 'selected' : ''}>${esc(label)}</option>`;
  }).join('');
}

export function lookOptions(pack) {
  const looks = library.looks || [];
  const current = pack.look || 'default';
  const now = new Date();
  const timely = looks.find((l) => inSeason(l, now));
  const order = timely
    ? [...looks.filter((l) => l.id === 'default'), timely, ...looks.filter((l) => l.id !== 'default' && l.id !== timely.id)]
    : looks;
  return order
    .map((l) => {
      const mark = timely && l.id === timely.id ? ' — in season now' : '';
      return `<option value="${esc(l.id)}" ${l.id === current ? 'selected' : ''} title="${esc(l.blurb || '')}">${esc(l.label)}${mark}</option>`;
    })
    .join('');
}

export function venueBox() {
  /*
   * A REAL DROPDOWN once there are venues, and a plain box when there are not.
   *
   * It was an `<input list=…>`, which is both at once and therefore looks like
   * neither: a datalist draws no chevron, so the field said "type something"
   * while quietly holding a list nobody could see. The GUI rules already
   * settle it — the chevron on its block of gradient is *the affordance that
   * says this opens* — so a control that opens has to look like one.
   *
   * Both lists behind it: venues you have SET UP and venues you have PLAYED. A
   * venue added on the Venues tab has hosted nothing yet, so reading only the
   * archive would offer back nothing on the one occasion somebody had just
   * gone to the trouble of adding it.
   *
   * "Somewhere else" is last and swaps in a text box, because a one-off venue
   * must not need a record made for it first — that is the promise the night's
   * free-text `venue` was built on and it has not changed.
   */
  const played = (library && library.venues) || [];
  const setUp = ((library && library.venueRecords) || []).map((v) => v.name);
  const seen = [...new Set([...setUp, ...played].filter(Boolean))];
  if (!seen.length) {
    return '<input class="venue-pick venue-free" type="text" maxlength="60" autocomplete="off" placeholder="The Dog and Duck">';
  }
  /*
   * TONIGHT'S IS ALREADY CHOSEN, rather than the picker starting blank.
   *
   * The venue whose usual night is today, or the one you played last — see
   * `tonightsVenue()`. This is the same answer the quick-launch buttons use,
   * from the same function, so the fast path and the deliberate one cannot
   * disagree about where you are.
   *
   * Safe to preselect precisely because it is VISIBLE: the dropdown shows the
   * name and the prize line directly underneath says what that venue puts up,
   * so a wrong one is one glance away rather than a surprise at the final
   * scores. Changing it is what the picker was always for. And the fallback
   * is unchanged — no venues, no history, nothing selected.
   */
  const tonight = tonightsVenue();
  const pick = tonight && seen.find((v) => v.toLowerCase() === tonight.name.toLowerCase());
  return `
    <select class="venue-select">
      <option value="" ${pick ? '' : 'selected'}>Where is it?</option>
      ${seen.map((v) => `<option value="${esc(v)}" ${v === pick ? 'selected' : ''}>${esc(v)}</option>`).join('')}
      <option value="__other">Somewhere else…</option>
    </select>
    <input class="venue-pick venue-free" type="text" maxlength="60" autocomplete="off"
           placeholder="The Dog and Duck" hidden>`;
}

/**
 * Which venue was chosen, whichever control said so.
 *
 * One reader, because two call sites already ask and a launch that read the
 * wrong control would file a night under nothing at all.
 */
export function wireVenue(el) {
  /*
   * "Somewhere else" swaps the dropdown for a text box.
   *
   * A one-off venue must not need a record made for it first — that is the
   * promise the night's free-text `venue` was built on. This lived inside the
   * prize wiring until the prizes moved onto the venue itself, so it has a
   * function of its own now rather than being a passenger in one.
   */
  const select = el.querySelector('.venue-select');
  const free = el.querySelector('.venue-free');
  const line = el.querySelector('.prize-line');

  /*
   * WHAT TONIGHT IS PLAYING FOR, BEFORE THE PRESS.
   *
   * The prizes are read off the venue record by the SERVER at launch, which is
   * right — one source of truth — but it meant nothing on this card said what
   * they were, or that there were none. The first real night ended with no
   * voucher and no explanation: the venue had not matched, so there were no
   * prizes, and an app that says nothing looks exactly like an app that is
   * working.
   *
   * So it is stated here, read-only, at the only moment it can still be
   * changed. **And it says when there are NONE**, because nothing on screen is
   * indistinguishable from not having looked.
   */
  const paintPrizes = () => {
    if (!line) return;
    const name = venueFrom(el);
    if (!name) { line.hidden = true; return; }
    line.hidden = false;
    const record = (library.venueRecords || [])
      .find((v) => v.name.toLowerCase() === name.toLowerCase());
    const prizes = ((record && record.rewards) || []).map((r) => String(r || '').trim());
    while (prizes.length && !prizes[prizes.length - 1]) prizes.pop();
    if (!prizes.length) {
      /*
       * A venue typed as free text can never match a record, so it can never
       * carry prizes — worth saying here rather than leaving somebody to find
       * out at the final scores.
       */
      line.className = 'prize-line none';
      line.innerHTML = record
        ? `No prizes tonight — set them on ${goTo('workshop', 'venues', 'the Venues tab')}.`
        : 'No prizes tonight — this venue is not on your Venues tab.';
      return;
    }
    line.className = 'prize-line';
    line.innerHTML = 'Playing for: '
      + prizes.map((r, i) => `<b class="prize-place p${i + 1}">${['1st', '2nd', '3rd'][i]}</b> ${esc(r)}`).join(' · ');
  };

  if (select) {
    select.addEventListener('change', () => {
      const other = select.value === '__other';
      if (free) {
        free.hidden = !other;
        if (other) free.focus();
      }
      paintPrizes();
    });
  }
  if (free) free.addEventListener('input', paintPrizes);
  paintPrizes();
}

export function venueFrom(el) {
  const select = el.querySelector('.venue-select');
  const free = el.querySelector('.venue-free');
  if (!select) return (free && free.value.trim()) || '';
  if (select.value === '__other') return (free && free.value.trim()) || '';
  return select.value.trim();
}

function whereOptions() {
  return `
    <option value="room" selected>In the room</option>
    <option value="online">Online — the question goes on their phones</option>`;
}

/**
 * One phone each, or several phones to a team.
 *
 * Beside Where and Look, and the same kind of decision: the room that turns up
 * tonight is either a set of individuals or a set of tables, and the pack has
 * no idea which.
 *
 * **Teams are scored on the AVERAGE**, which is the whole reason it works
 * without pens: six chancers cannot out-score two people who know their stuff,
 * because a member who answers nothing is a zero in the mean. That is worth
 * saying on the control itself rather than leaving to be discovered on a
 * scoreboard in front of a room.
 */
export function playingOptions() {
  return `
    <option value="solo" selected>One phone each</option>
    <option value="teams">Teams — several phones, scores averaged</option>`;
}

/** Can this account actually RUN this game? An owner writes packs, never plays. */
const canRun = (kind) => can(kind === 'bingo' ? FEATURES.BINGO : FEATURES.QUIZ);

/**
 * WHICH PACK IS OPEN, per tab, remembered outside the render.
 *
 * Module level for the same reason the control view keeps its open answer
 * panels there: this grid is rebuilt whenever anything on the page changes —
 * a save, a launch, a rename — and a selection stored inside the render would
 * close itself the moment you touched the card you had just opened.
 *
 * Keyed by TAB, so opening a bingo pack does not close the quiz you were
 * looking at, and each tab comes back where you left it.
 */
const openPack = new Map();

export function packCard(kind, pack, repaint = () => {}) {
  /*
   * A quizmaster READS a pack and LAUNCHES it, and that is the arrangement —
   * the packs are written to a house style and sold. Renaming, deleting,
   * drawing the portraits and building the playlist all write to the shared
   * catalogue, so they are the owner's alone and the server refuses them.
   * Drawing them anyway is how you get a Delete button that says 403.
   *
   * A pack they WROTE is the other way round entirely. It is theirs, so they
   * rename it, edit it, delete it and take a copy of it away — and the OWNER is
   * the one with nothing to press, because it is not in the catalogue and not
   * the owner's to touch. So the question is never "who is looking", it is
   * "whose pack is this", asked per card.
   */
  /*
   * A pack they do not hold: a shop card, and NOTHING else.
   *
   * Returned early rather than threaded through the ordinary card as a pile of
   * conditionals — every control below this line is something a locked pack
   * must not have, and "hide eight buttons" is how one of them survives a
   * refactor and starts returning 403s. It carries no Read either: the server
   * refuses that now, and a button that refuses is worse than no button.
   */
  if (pack.locked) return shopCard(kind, pack);

  const ownPack = Boolean(pack.mine);
  const mine = ownPack ? can(FEATURES.OWN_PACKS) : can(FEATURES.CATALOGUE);
  // Portraits cost the owner money at OpenAI and the playlist step writes to
  // the owner's own Spotify account, so both stay the owner's whoever wrote
  // the pack.
  const ownersJob = can(FEATURES.CATALOGUE);

  const roundCount = (pack.rounds || []).length;
  const detail = kind === 'quiz'
    ? `${pack.questionCount} question${pack.questionCount === 1 ? '' : 's'} · ${roundCount} round${roundCount === 1 ? '' : 's'}`
    : `${pack.trackCount} track${pack.trackCount === 1 ? '' : 's'}`;

  const played = pack.playCount
    ? `Played ${pack.playCount} time${pack.playCount === 1 ? '' : 's'}${pack.lastPlayedAt ? ` · last ${whenish(pack.lastPlayedAt)}` : ''}`
    : 'Never played';

  const open = openPack.get(kind) === pack.id;

  /*
   * WHAT A CLOSED CARD KEEPS, and it is not quite "the name only".
   *
   * The ask was a card with the name on it. The size and when it was last
   * played stay, in one small line, because they are what you CHOOSE by:
   * "never played" and "last played 3 days ago" is how you avoid running the
   * same quiz at the same venue two weeks running, and it is the exact signal
   * the quick-launch priority is built out of. Dropping them would make the
   * grid tidier and the choice harder, which is the wrong trade on the tab
   * whose job is choosing.
   *
   * WARNINGS ALWAYS STAY, open or closed. A broken pack, a question to fix and
   * an expired topical one are read once at a moment that matters, and the
   * house style makes those the exception to being short. A pack that looked
   * fine closed and turned out to be broken when opened would be the app
   * saying nothing again.
   */
  /*
   * ITS OWN COLOUR, FROM ITS OWN SUBJECT — see `pack-look.js`. A wash behind
   * the card, never a fill: `broken` is still the only red on this shelf that
   * means anything, and it is still on the border where it always was.
   */
  const look = packLookAttrs(pack, kind);
  const el = node(`
    <div class="pack-card ${open ? 'open' : 'shut'} ${look.cls} ${pack.broken ? 'broken' : ''} ${ownPack ? 'own' : ''} ${freshness(pack).expired ? 'stale' : ''}"
      style="${look.style}"
      draggable="${pack.broken ? 'false' : 'true'}" data-pack="${esc(pack.id)}" data-kind="${esc(kind)}">
      ${packWord(look)}
      ${pack.broken || !canPin() ? '' : `<button class="pack-pin ${isPinned(pack.id) ? 'on' : ''}" type="button"
        aria-pressed="${isPinned(pack.id) ? 'true' : 'false'}"
        aria-label="${isPinned(pack.id) ? 'Unpin' : 'Pin'} ${esc(pack.title)}">${pinIcon()}</button>`}
      <!-- THE DRAWN TITLE IS TRIMMED; the tooltip carries the real one, so the
           full name is always one hover away and nothing is lost. Search,
           the editor and the archive all still see the stored title - see
           shortTitle() in pack-look.js. -->
      <button class="pack-title ${titleSize(shortTitle(pack.title))}"
        title="${open ? 'Close it' : esc(pack.title)}"
        aria-expanded="${open ? 'true' : 'false'}">${esc(shortTitle(pack.title))}</button>
      ${ownPack ? '<div class="pack-yours" title="You wrote this one. Nobody else can read it.">Yours</div>' : ''}
      <div class="tiny">${esc(detail)} · ${esc(played)}</div>
      ${freshLabel(pack) ? `<div class="tiny fresh ${freshness(pack).expired ? 'gone' : ''}">${esc(freshLabel(pack))}</div>` : ''}
      ${pack.broken ? `<div class="tiny" style="color:var(--bad)">Broken: ${esc(pack.broken)}</div>` : ''}
      ${pack.problems ? `<div class="tiny" style="color:var(--bad)">${pack.problems} thing${pack.problems === 1 ? '' : 's'} to fix</div>` : ''}
      ${!open ? '' : `
      <!--
        TONIGHT'S SETTINGS ARE NOT ON A PACK CARD ANY MORE, AND NEITHER IS
        LAUNCH.

        Reported in five words - *"this whole expandable section is pointless
        now"* - and it is the plainest case of the rule this file keeps
        recording. Every field that was here (cards, prizes, look, while they
        wait, game sound, where, playing, venue) is a decision about TONIGHT,
        and Tonight now owns all of them: the bar carries the venue and the
        in-the-room switch, and Tonight's settings is its own tab. Two controls
        for one field is how a night gets launched with the setting the other
        one was showing.

        What is left is what a card is actually FOR: reading the pack,
        renaming it, deleting it, drawing its portraits, building its playlist.
        Those are facts about the PACK rather than about an evening, which is
        the same test that decides Account against Settings.
      -->
      <div class="pack-actions">
        <button class="pack-read" title="Read it through">Read</button>
        ${mine ? `<button class="pack-rename" ${pack.broken ? 'disabled' : ''} title="Change what it is called">Rename</button>` : ''}
        ${pack.playlist ? `<a class="pack-spotify" href="${esc(pack.playlist)}" target="_blank" rel="noopener" title="Open it in Spotify">Playlist</a>` : ''}
        ${ownPack ? '<button class="pack-save" title="Download it as a file you keep">Download</button>' : ''}
        ${ownersJob && hasPictureRound(pack) ? '<button class="pack-pics" title="Make the round 2 portraits">Pictures</button>' : ''}
        ${ownersJob && hasIntroRound(pack) ? (pack.playlist
          // Once one exists, the green button beside this one is already called
          // Playlist — two buttons with the same word on one card is a card you
          // have to try to understand. This one says what it does instead, and
          // its tooltip is honest that Spotify gets a second playlist rather
          // than an updated one.
          ? '<button class="pack-playlist" title="Build it again. Spotify gets a NEW playlist — the existing one is left alone.">Rebuild</button>'
          // AND BEFORE ONE EXISTS IT SAYS "MAKE", NOT "PLAYLIST".
          //
          // The two never appear together — the green link only exists once
          // there is something to open — so this read as one word meaning two
          // opposite things a week apart: press Playlist on Monday and you
          // build one, press it on Friday and you are in Spotify. A collision
          // separated in time is still a collision, and it is the worse kind
          // because nothing on screen shows you both at once.
          //
          // A verb also puts it in the same family as "Make real portraits"
          // beside it, which is the other thing on this row that makes
          // something rather than opening something.
          : '<button class="pack-playlist" title="Build the Spotify playlist for the intro round">Make playlist</button>') : ''}
        ${mine ? '<button class="pack-del" title="Delete this pack">Delete</button>' : ''}
      </div>
      <div class="pics-slot"></div>
      `}
    </div>`);

  /*
   * DRAG IT UP TO TONIGHT.
   *
   * The console is driven from the laptop that is plugged into the projector,
   * so a mouse is the input this serves — and dragging a pack onto the launch
   * section is the gesture somebody reaches for once the section is a place
   * rather than a button. The card's own Launch stays exactly as it was: this
   * is a second way to choose, not a replacement for the way that works on a
   * phone, where drag events do not fire at all.
   *
   * It carries the pack ID and the GAME, because a bingo pack dropped on a bar
   * that is set to Music Quiz has to switch the bar over rather than be
   * silently ignored.
   */
  el.addEventListener('dragstart', (ev) => {
    if (pack.broken) return;
    /*
     * WHERE IT WAS PICKED UP FROM, kept so it can be seen to LAND somewhere.
     * A rectangle taken now rather than looked up on drop: by then the shelf
     * may have re-rendered and the card may not be where it was.
     */
    const box = el.getBoundingClientRect();
    setPackDrag({ id: pack.id, kind, title: pack.title, from: { x: box.left, y: box.top, w: box.width, h: box.height } });
    ev.dataTransfer.effectAllowed = 'copy';
    ev.dataTransfer.setData('text/plain', pack.title);
    el.classList.add('is-dragging');
    // Pin Tonight to the top for the length of the drag — see `dragging()`.
    dragging(true);
  });
  el.addEventListener('dragend', () => {
    setPackDrag(null);
    dragging(false);
    el.classList.remove('is-dragging');
    document.querySelector('.launchbar')?.classList.remove('drop-here');
  });

  /*
   * The title OPENS the card; Read is in the row below.
   *
   * It used to open the read-through, which was the only thing it could
   * sensibly do when every card was already fully open. Now the first thing
   * you want from a pack is "set tonight up and launch it", so that is what
   * the biggest target on the card does. Read is one tap further in, on the
   * card you have already chosen, which is when you actually want to read it.
   */
  /*
   * `stopPropagation` on the CLICK and the MOUSEDOWN both — the card is a drag
   * source, so without the second one a press on the pin starts dragging the
   * pack instead of pinning it. That is the same trap the round ticks hit in
   * Tonight, recorded there for the same reason.
   */
  const pinBtn = el.querySelector('.pack-pin');
  if (pinBtn) {
    pinBtn.addEventListener('mousedown', (ev) => ev.stopPropagation());
    pinBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      togglePin(pack.id, pinBtn);
    });
  }
  /*
   * ON THE CONSOLE DOOR A TAP PUTS THE PACK IN TONIGHT; in the Workshop it
   * opens the card.
   *
   * Once the settings and Launch came off, a Console card had nothing left to
   * open — the actions behind it (Read, Rename, Delete, Pictures, Playlist)
   * are all Workshop work. A caret that expands to an empty panel is the
   * "control that needs explaining" fault, so the tap does the thing you
   * came to do instead.
   *
   * Through the SAME path a drop uses, so a tap and a drag cannot come to mean
   * different things — and it is the way round for touch, where drag events
   * are never delivered at all. The same arrangement the Shows tab and the
   * Venues shelf already use.
   */
  el.querySelector('.pack-title').addEventListener('click', () => {
    if (doorNow() === 'console') { addToTonight(pack, kind); return; }
    if (open) openPack.delete(kind);
    else openPack.set(kind, pack.id);
    repaint();
  });

  /*
   * How many actions this card ended up with, so the stylesheet can lay them
   * out in an even block rather than leaving a ragged last row.
   *
   * A card carries between one and five of these depending on what the pack
   * is and who is looking, and "as many as fit per row" put four out as three
   * and a lonely one — which reads as a button that has come loose rather than
   * as a row. Counting them here is the only place that knows.
   */
  const actions = el.querySelector('.pack-actions');
  if (actions) actions.dataset.count = actions.children.length;

  const openIt = () => preview(kind, pack);
  const toggle = (build) => {
    const slot = el.querySelector('.pics-slot');
    const already = slot.dataset.which === build.name;
    slot.replaceChildren();
    slot.dataset.which = already ? '' : build.name;
    if (!already) slot.appendChild(build(pack));
  };
  el.querySelector('.pack-pics')?.addEventListener('click', () => toggle(picturePanel));
  el.querySelector('.pack-playlist')?.addEventListener('click', () => toggle(playlistPanel));
  // NOT the title — that opens and closes the card now. Wiring both here is
  // how you get a tap that opens the read-through AND collapses the card
  // underneath it, which reads as the page jumping.
  el.querySelector('.pack-read')?.addEventListener('click', openIt);

  /*
   * Take a copy away.
   *
   * On their own packs only, and it is not a nicety: this is their work. It is
   * the one thing that makes "kept on somebody else's server" acceptable —
   * whatever happens to the app, to the backup or to the subscription, the file
   * is a file and they can hold it. It is also how a pack moves between
   * accounts, which is the honest answer to "what if I leave".
   */
  el.querySelector('.pack-save')?.addEventListener('click', async () => {
    try {
      const res = await fetch(keyed(`/api/${kind}/` + encodeURIComponent(pack.id)), { headers: { 'X-Host-Key': hostKey } });
      if (!res.ok) throw new Error('Could not read that pack');
      const full = await res.json();
      delete full.reviewWarnings;
      delete full.problems;
      delete full.mine;
      const blob = new Blob([JSON.stringify(full, null, 2) + '\n'], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${pack.id}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch (err) {
      alert('Could not download it: ' + err.message);
    }
  });

  /*
   * How many prizes, and what each one is.
   *
   * It depends on the card: a 3-across strip has only three lines, so two line
   * prizes and a full house is all it can carry, and offering four would be
   * offering one nobody could win. So the list is rebuilt whenever the shape
   * changes rather than written out once.
   */
  /*
   * NOTHING TO WIRE FOR THE SETTINGS ANY MORE — the card no longer draws them.
   *
   * The whole `shapePick` / `prizePick` / `wireVenue` block went with the
   * markup rather than being left behind guarded, which is the point: a
   * `querySelector` whose element is gone is the exact fault that took this
   * console down twice, and the fix is to delete the pair together. Tonight's
   * settings tab owns these now and has its own copy of the prize painting.
   */

  /*
   * Rename without opening the pack.
   *
   * The title is the only thing you ever want to change from out here — a pack
   * called "1980s Music Bingo" is fine until the night you run two of them.
   *
   * The id is deliberately left alone. It is what the play counts, the song
   * history and the backup file are all keyed on, so renaming the file to
   * match would quietly orphan all three. What the pack is called and what it
   * is filed under are different things.
   */
  el.querySelector('.pack-rename')?.addEventListener('click', async () => {
    const answer = prompt('What should this be called?', pack.title);
    if (answer === null) return;
    const title = answer.trim();
    if (!title || title === pack.title) return;

    const button = el.querySelector('.pack-rename');
    button.disabled = true;
    button.textContent = 'Saving…';
    try {
      const url = keyed(`/api/${kind}/` + encodeURIComponent(pack.id));
      const res = await fetch(url, { headers: { 'X-Host-Key': hostKey } });
      if (!res.ok) throw new Error('Could not read that pack');
      const full = await res.json();
      delete full.reviewWarnings;   // added by the server when reading, not part of the pack
      delete full.mine;             // likewise: which library it came from, not part of it
      full.title = title;

      // One of theirs goes back to their own library, never to the catalogue —
      // two prefixes, because a path test cannot tell which library a pack id
      // belongs to. See the note on /api/mine in server.js.
      const saved = ownPack
        ? await fetch(keyed(`/api/mine/${kind}`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Host-Key': hostKey },
          body: JSON.stringify(full),
        })
        : await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-Host-Key': hostKey },
          body: JSON.stringify(full),
        });
      const data = await saved.json().catch(() => ({}));
      if (!saved.ok) throw new Error((data.problems || []).join('; ') || data.error || 'Could not save it');
      await load();
    } catch (err) {
      alert(`Could not rename it: ${err.message}`);
      button.disabled = false;
      button.textContent = 'Rename';
    }
  });

  el.querySelector('.pack-del')?.addEventListener('click', async () => {
    if (!confirm(`Delete "${pack.title}"?\n\nThis removes it from your library for good.`)) return;
    const button = el.querySelector('.pack-del');
    button.disabled = true;
    button.textContent = 'Deleting…';
    try {
      const base = ownPack ? `/api/mine/${kind}/` : `/api/${kind}/`;
      const res = await fetch(keyed(base + encodeURIComponent(pack.id)), {
        method: 'DELETE',
        headers: { 'X-Host-Key': hostKey },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not delete it');
      await load();
    } catch (err) {
      button.disabled = false;
      button.textContent = 'Delete';
      alert(err.message);
    }
  });

  /*
   * AND NO LAUNCH HANDLER, because there is no Launch on a pack card.
   *
   * Tonight is the one place a night starts now. That is a change to the
   * PROTECTED SURFACE and was made deliberately rather than as a tidy-up: the
   * guarantee was never "a Launch button on every card", it was that launching
   * is one predictable move away — and dragging or tapping a pack into Tonight
   * and pressing the one big button is that move, on the one bar this file
   * says must never change shape under a thumb.
   *
   * The expired-topical warning went with it and is not lost: `doLaunch` is
   * still the single way out, and the launch bar asks the same question.
   */  return el;
}

/**
 * Actually launch — the ONE path, whichever button was pressed.
 *
 * There are two ways in now (a pack card, and the launch bar at the top) and
 * there must not be two ways OUT, or the 409-and-confirm dance gets fixed in
 * one of them and quietly rots in the other.
 */
export async function doLaunch(kind, packId, { shape = null, prizes = 0, look = '', lobbyGame = '', lobbySound = true, online = false, teamPlay = false, venue = '', order = null }, button) {
    const send = (replace) => postJson(
      '/api/host/launch',
      {
        game: kind, packId, shape, prizes, look, lobbyGame, lobbySound, online, teamPlay, venue,
        /*
         * TONIGHT'S RUNNING ORDER, and only when there IS one.
         *
         * An ordinary launch sends no `order` at all rather than sending the
         * chosen pack's own rounds spelled out — which would be the same night
         * by a longer road, through code that did not exist last week, on the
         * protected path. The server composes only when it is given something,
         * so a night nobody has rearranged goes down exactly the route it
         * always did.
         */
        ...(order && order.length ? { order } : {}),
        ...(replace ? { replace: true } : {}),
      },
      { 'X-Host-Key': hostKey },
    );
    /*
     * PUT THE BUTTON BACK AS IT WAS, not as the word "Launch".
     *
     * The three launch buttons do not say the same thing: a pack card's says
     * "Launch", the launch bar's says "Launch <title>", and a quick pick is
     * two spans — the pack's name and why it is being offered. Writing the
     * literal string back turned a quick pick into a bare **Launch** with no
     * indication of what it runs, sitting next to another one that still said.
     *
     * And it happens at the worst possible moment: the only way to get here
     * is the 409 — two devices on one login, a night already running, which is
     * exactly when somebody is under pressure and reading fast.
     *
     * So the markup is kept and restored. `innerHTML` rather than a clone
     * because the click handler is bound to the button itself and only its
     * contents are being replaced.
     *
     * **"Launching…" is set HERE and nowhere else**, which is the half that
     * makes it work: the three call sites each used to write it themselves,
     * so by the time this function ran the original label was already gone and
     * there was nothing left to put back. One place that changes the button is
     * also one place that can change it back.
     */
    const wasHtml = button.innerHTML;
    button.disabled = true;
    button.textContent = 'Launching…';
    const back = () => {
      button.disabled = false;
      button.innerHTML = wasHtml;
    };

    /*
     * **The SERVER decides whether a night is in progress, not this page.**
     *
     * This used to check `library.running`, which is a snapshot taken when the
     * console was loaded. That works for one person on one device and is blind
     * to the case that actually costs somebody their night: two people on one
     * login, where this console was opened before the other one launched. It
     * reported nothing running and went straight ahead.
     *
     * Same lesson as the tier lever — a guard that only exists in the browser
     * is decoration. The server answers with what is live right now, and this
     * asks once, deliberately, with the game and the player count in the
     * question.
     */
    try {
      await send(false);
      location.href = linkTo('/host');
    } catch (err) {
      if (err.status === 409 && err.data && err.data.replace) {
        if (!confirm(`${err.data.error}\n\nEnd it and launch this instead?`)) return back();
        try {
          await send(true);
          location.href = linkTo('/host');
        } catch (second) {
          back();
          alert('Could not launch: ' + second.message);
        }
        return;
      }
      back();
      alert('Could not launch: ' + err.message);
    }
}

/**
 * A pack on the shelf rather than in the library.
 *
 * It shows the title, how big it is and what it costs — and deliberately not a
 * word of what is inside. That is enforced on the SERVER, which strips the
 * search blob and the playlist link out of a locked summary before it is sent,
 * because a padlock drawn over a payload that still contained every question
 * and answer would be decoration rather than a lever.
 *
 * **Buy takes no money yet and says so plainly.** There is no payment flow
 * wired up, and a button that looked like it charged you and then did nothing
 * is a worse first impression than an honest one. This is here so the shop can
 * be LOOKED at before a processor is committed to — whether it reads as fair
 * or as grabby is a judgement about wording and layout, and it is much cheaper
 * to change now than after the money is plumbed in.
 */
function shopCard(kind, pack) {
  const roundCount = (pack.rounds || []).length;
  const detail = kind === 'quiz'
    ? `${pack.questionCount} question${pack.questionCount === 1 ? '' : 's'} · ${roundCount} round${roundCount === 1 ? '' : 's'}`
    : `${pack.trackCount} track${pack.trackCount === 1 ? '' : 's'}`;

  /*
   * A dated pack says so on the shelf, and that is the one thing the shop
   * window genuinely needs to tell you.
   *
   * Every other locked card is worth the same in a month's time; a topical one
   * is worth the most this week and nothing much after it. Leaving that off
   * makes the strongest card in the shop look like the weakest — an unfamiliar
   * title with no theme anybody recognises.
   */
  const { topical, expired } = freshness(pack);

  const el = node(`
    <div class="pack-card locked">
      <div class="pack-title">${esc(pack.title)}</div>
      <div class="tiny">${esc(detail)}</div>
      ${topical ? `<div class="tiny fresh ${expired ? 'gone' : ''}">${esc(freshLabel(pack))}</div>` : ''}
      <!-- GREEN, because money is green everywhere in this app — the same
           language as "paying" on an account and "makes something" on a
           button. It is a marker rather than a control: the whole card is
           already about buying, and a price you can press as well as a Buy
           button underneath it is two controls for one job. -->
      <div class="shop-price">${esc(packPrice())}</div>
      <button class="go buy">Buy it</button>
    </div>`);

  el.querySelector('.buy').addEventListener('click', () => {
    alert(`There is no way to pay yet.\n\n"${pack.title}" would be ${packPrice()}, and it would be in your library straight away — same as the ones you already have.\n\nOr Silver includes every pack in the catalogue and each new one as it is written — the tiers are on My Account.\n\nThis is here so the shop can be looked at before the payments are wired up.`);
  });
  return el;
}

/**
 * Read a pack through without leaving the console.
 *
 * The point is answering "is this any good?" in the thirty seconds before you
 * decide to run it — so the correct answer is obvious at a glance, and there is
 * a summary at the top flagging the things that make a quiz feel cheap: the
 * answer always being in the same slot, or a round with no interesting facts to
 * read out.
 */
export async function preview(kind, pack) {
  // Reading a pack through is everybody's; changing a word in it is not.
  const mine = can(FEATURES.CATALOGUE);
  const overlay = node(`
    <div class="overlay">
      <div class="sheet">
        <div class="sheet-head">
          <div style="min-width:0;flex:1 1 auto">
            <input class="sheet-title" id="sheetTitle" value="${esc(pack.title)}" title="${mine ? 'Click to rename' : 'These packs are read-only'}" ${mine ? '' : 'readonly'}>
            <div class="tiny" id="sheetSub">Loading…</div>
          </div>
          <div class="sheet-actions">
            <button class="role-make" id="sheetSave" hidden>Save</button>
            ${mine ? `<a class="minor" href="${linkTo('/editor')}">Edit questions</a>` : ''}
            <button class="minor" id="sheetClose">Close</button>
          </div>
        </div>
        <div class="sheet-body" id="sheetBody"></div>
      </div>
    </div>`);

  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector('#sheetClose').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  const onKey = (e) => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } };
  document.addEventListener('keydown', onKey);

  const body = overlay.querySelector('#sheetBody');
  const sub = overlay.querySelector('#sheetSub');
  const saveBtn = overlay.querySelector('#sheetSave');
  const titleInput = overlay.querySelector('#sheetTitle');

  // Renaming happens here rather than in the editor, because reading a pack
  // through is when you notice a round is called the wrong thing.
  let loaded = null;
  let dirty = false;
  // Redrawn rather than left as it was after a save, so the summary line at the
  // top stops saying "press Save" once you have. Keeping the scroll matters:
  // this is a list you read down, and being thrown back to the top after
  // renaming a round in the middle of it is the sort of small rudeness that
  // makes you stop using a panel.
  const drawPreview = () => {
    const y = body.scrollTop;
    if (kind === 'bingo') renderBingoPreview(body, sub, loaded, markDirty);
    else renderQuizPreview(body, sub, loaded, markDirty);
    body.scrollTop = y;
  };
  const markDirty = () => {
    dirty = true;
    saveBtn.hidden = false;
    saveBtn.textContent = 'Save';
    saveBtn.disabled = false;
  };

  titleInput.addEventListener('input', () => {
    if (loaded) { loaded.title = titleInput.value; markDirty(); }
  });

  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    try {
      const res = await fetch(keyed(`/api/${kind}/` + encodeURIComponent(pack.id)), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Host-Key': hostKey },
        body: JSON.stringify(loaded),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save');
      dirty = false;
      saveBtn.textContent = data.backedUp ? 'Saved and backed up' : 'Saved here only';
      drawPreview();
      await load();
    } catch (err) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save';
      alert(err.message);
    }
  });

  // Do not let a click outside quietly bin a rename.
  const guardedClose = () => {
    if (dirty && !confirm('You have unsaved changes. Close anyway?')) return;
    close();
  };
  overlay.querySelector('#sheetClose').removeEventListener('click', close);
  overlay.querySelector('#sheetClose').addEventListener('click', guardedClose);

  try {
    const res = await fetch(keyed(`/api/${kind}/` + encodeURIComponent(pack.id)));
    if (!res.ok) throw new Error('Could not open it');
    loaded = await res.json();
    drawPreview();
  } catch (err) {
    sub.textContent = '';
    body.replaceChildren(node(`<div class="tiny" style="color:var(--bad)">${esc(err.message)}</div>`));
  }
}
