/**
 * THE MIXED ROW, DRAWN — the DOM half of `console-tonight-mix.js`. Split out
 * because that file is pure data on purpose (so its logic tests under plain
 * Node like `plans.test.js` already does), and this one needs `library`
 * (for `cardShapes`) and `packWord()`/`packLookAttrs()` — real browser
 * modules that read `localStorage` at load and cannot be imported outside
 * one.
 */

import { esc, node, gripIcon, bestBingoShape } from './client.js';
import { packWord } from './console.js';
import { library } from './console-state.js';
import { packLookAttrs, shortTitle, isBreakoutPack, roundGlyph, roundWord } from './pack-look.js';
import {
  DEFAULT_BINGO_PRIZES, addBingoSlot, addQuizPackSlot, hasPack, homeSlotIndex, moveRoundToSlot, swapSlots,
  offRoundsFor, removeSlot, toggleRoundOff,
} from './console-tonight-mix.js';

/**
 * The card shape a bingo slot would use if it has not been given its own —
 * the BEST FIT for this pack's track count, same `bestBingoShape()`
 * `console-packs.js`'s `shapeOptions()` uses, so an interlude dropped into
 * Tonight starts on the same shape the ordinary Set-it-up picker would have
 * defaulted to, not whatever the pack happened to be generated with.
 */
function packOwnShape(pack) {
  const shapes = library.cardShapes || [];
  const found = bestBingoShape(shapes, pack.trackCount);
  return found ? { rows: found.rows, cols: found.cols } : { rows: 4, cols: 4 };
}

/**
 * DRAW THE MIXED ROW — one tile per slot, rounds as individually draggable
 * numbered dots, a bingo tile carrying its OWN prize/shape controls.
 *
 * A pure DOM-builder taking everything it needs rather than importing it —
 * `dragging`/`getPackDrag`/`clearPackDrag` are the console's own body-class
 * toggle and shelf-drag state, owned by `console-tonight.js`, handed in the
 * same way `showPartsEditor()` takes `onSaved` rather than reaching for
 * `render()` itself.
 */
export function renderSlots(slots, {
  packOf, onChange, dragging, getPackDrag, clearPackDrag,
  getShelfRoundDrag = () => null, clearShelfRoundDrag = () => {}, maxSlots = 6,
  picked = -1, onPick = () => {},
}) {
  const el = node('<div class="lb-tiles"></div>');
  let roundDrag = null; // { packId, round } while a round dot is being lifted
  let slotDrag = null; // index of the tile being dragged for reordering

  /*
   * EVERY SLOT, ALWAYS — reported directly: *"when you add a quiz and then a
   * music bingo you STILL get restricted slots — I need 6 regardless of what's
   * in the bay."* This used to draw only what was filled plus one, which reads
   * as a limit that grows as you use it: two packs in and the row said three,
   * so a night that wanted five looked impossible until you had built four of
   * it. The ordinary row's own slot count was widened the same way and for the
   * same reason.
   */
  /*
   * …AND IT GROWS A WHOLE ROW AT A TIME, now that a pack arrives as one tile
   * per round. Six fixed slots was right when a tile was a whole pack; a
   * four-round quiz plus a bingo game plus a three-round quiz is eight tiles,
   * and a row that stopped at six would make that night look impossible.
   *
   * **BOTH OF HIS RULES ARE KEPT, and they pull opposite ways.** *"I need 6
   * regardless of what's in the bay"* — so an empty bay still shows six, never
   * "filled plus one", which reads as a limit that grows as you use it. And
   * *as little clutter as possible* — so it does not jump to twelve dashed
   * boxes the moment the first round lands. Filling out to the next multiple
   * of six does both: six until a night needs more, then twelve, and the grid
   * is already six columns so the second row needs no new CSS.
   */
  const ROW = 6;
  const filled = slots.filter(Boolean).length;
  const want = Math.min(maxSlots, Math.max(ROW, Math.ceil((filled + 1) / ROW) * ROW));
  const shown = Array.from({ length: Math.max(want, slots.length) }, (_, i) => slots[i] || null);

  const commit = (next) => onChange(next.length > maxSlots ? next.slice(0, maxSlots) : next);

  /*
   * `dragging(false)` IS CALLED HERE, ON DROP, NOT LEFT TO `dragend` —
   * `console-tonight.js`'s own comment on the window `dragend` listener says
   * "`dragend` always fires on the source, whatever happened to the drop",
   * which is true right up until the drop handler is the thing that removes
   * the source from the document. `commit()` runs `onChange` synchronously,
   * which rebuilds the WHOLE row via `replaceChildren` — so a tile or round
   * dot dragged onto another tile IN THIS ROW is detached from the page
   * before the browser gets to dispatch `dragend` on it, and a dragend whose
   * source node is no longer in the document does not fire at all. The body
   * stayed marked `is-dragging-card` for good, which pins the launch bar
   * `position: sticky` at whatever offset the drag happened to start at —
   * so tiles read as vanishing under the topbar on an ordinary scroll, and
   * every drag after the first one was fighting a bar that no longer moved
   * with the page. Calling it explicitly, before the DOM is rebuilt, costs
   * nothing when `dragend` does still fire (it is a plain toggle) and fixes
   * it when it does not.
   */
  /**
   * WOULD A ROUND ACTUALLY LAND HERE?
   *
   * An EMPTY slot takes any round. A FILLED one takes a round only from its
   * own quiz pack — `moveRoundToSlot()` refuses a bingo game or a different
   * pack outright, because a slot is one pack's rounds or one bingo game and
   * never a mix of two.
   *
   * **The highlight has to ask the same question the drop does**, or a tile
   * lights up, takes the release and does nothing — which is worse than one
   * that never lit, because it promised.
   */
  function takesRound(at, round) {
    if (!round) return false;
    const here = slots[at];
    if (!here) return true;
    return here.kind === 'quiz' && here.packId === round.packId;
  }

  function wireDropTarget(tile, at) {
    tile.addEventListener('dragover', (ev) => {
      const fromShelf = getPackDrag();
      const round = roundDrag || getShelfRoundDrag();
      if (!round && !fromShelf) return;
      ev.preventDefault();
      ev.stopPropagation();
      if (round) {
        // AND THE LIGHT SAYS WHICH — see `takesRound`.
        const takes = takesRound(at, round);
        /*
         * ONLY EVER `'none'`, AND ONLY TO REFUSE. A positive `dropEffect` the
         * source did not allow makes the browser treat this target as
         * refusing, and no `drop` fires at all — and the sources here do not
         * agree: a pack card and a shelf round dot are `'copy'`, a Tonight
         * round chip is `'move'`. Left alone the browser picks a compatible
         * one for whichever it is.
         */
        if (!takes) ev.dataTransfer.dropEffect = 'none';
        tile.classList.toggle('drop-here', takes);
        return;
      }
      /*
       * A PACK ALREADY IN THE NIGHT IS REFUSED, AND THE LIGHT SAYS SO.
       *
       * It was refused before this too — silently, because
       * `addQuizPackSlot()` finds no unplaced rounds and hands the list back
       * unchanged — while the slot still lit up and promised. **That is what
       * *"I can't drag into slot 2 as an empty slot"* actually was**: the pack
       * being dragged was already somewhere in the row, and nothing said so.
       */
      const takesPack = !hasPack(slots, fromShelf.id);
      if (!takesPack) ev.dataTransfer.dropEffect = 'none';
      tile.classList.toggle('drop-here', takesPack);
    });
    tile.addEventListener('dragleave', () => tile.classList.remove('drop-here'));
    tile.addEventListener('drop', (ev) => {
      tile.classList.remove('drop-here');
      if (roundDrag !== null) {
        ev.preventDefault();
        ev.stopPropagation();
        const moved = roundDrag;
        const takes = takesRound(at, moved);
        roundDrag = null;
        dragging(false);
        // Refused rather than mixed — and STOPPED, or it bubbles to the row
        // and the round lands somewhere the pointer never was.
        if (takes) commit(moveRoundToSlot(slots, moved, at));
        return;
      }
      /*
       * A ROUND OFF THE SHELF — never placed anywhere yet, so
       * `moveRoundToSlot`'s own "clear it from wherever else it sat" pass is
       * a no-op and it just lands at `at`. Same refusal as a Tonight-internal
       * round move: a slot already holding a DIFFERENT pack, or a bingo game,
       * is left alone rather than mixed.
       */
      const shelfRound = getShelfRoundDrag();
      if (shelfRound) {
        ev.preventDefault();
        ev.stopPropagation();
        const takes = takesRound(at, shelfRound);
        clearShelfRoundDrag();
        dragging(false);
        if (takes) commit(moveRoundToSlot(slots, shelfRound, at));
        return;
      }
      const fromShelf = getPackDrag();
      if (!fromShelf) return;
      ev.preventDefault();
      clearPackDrag();
      dragging(false);
      const pack = packOf(fromShelf.id);
      if (!pack) return;
      // `at` — the slot this was actually dropped on. It used to append and
      // ignore the target, so a bingo let go over slot 2 turned up in slot 4.
      commit(fromShelf.kind === 'bingo'
        ? addBingoSlot(slots, pack, { at })
        : addQuizPackSlot(slots, pack, at));
    });
  }

  /*
   * A NUMBERED TILE IS A SLOT, NOT A LIST ITEM — so dragging one onto another
   * SWAPS them and leaves everything else where it was. The earlier
   * insert-and-shift (`moveSlot`, still what the ordinary Tonight row and the
   * pack editor's own round/question lists use) reads as the same thing when
   * the two tiles are adjacent, because a shift of one and a swap are the
   * same move there — and as something else entirely once they are not:
   * dragging tile 1 onto tile 3 shifted every slot between them along by
   * one, so tile 3 got what tile 1 held but tile 1 got what tile 2 held, not
   * tile 3's own pack. Reported live: *"pack 1 goes to tile 3, tile 3 goes to
   * tile 2 and tile 2 goes to tile 1."* A swap has no "before" or "after" to
   * land on, so the half-of-the-tile check goes with it.
   */
  function wireSlotDrag(tile, at) {
    /*
     * THE PACK LIFTS FROM ITS GRIP AND NOWHERE ELSE, same as the ordinary
     * row's tile — asked for on 24 August 2026, and the two renderers have to
     * agree or a night behaves differently depending on whether a bingo game
     * happens to be in it.
     *
     * A press on a round chip already started THAT drag rather than the
     * tile's, because the chip is `draggable` itself. This is the other half:
     * a press on the tile's FACE now starts nothing at all, so the grip in the
     * head means what it draws.
     */
    let liftFrom = null;
    tile.addEventListener('mousedown', (ev) => { liftFrom = ev.target; });
    tile.addEventListener('dragstart', (ev) => {
      if (!liftFrom || !liftFrom.closest('.lb-tile-head')) { ev.preventDefault(); return; }
      slotDrag = at;
      ev.dataTransfer.effectAllowed = 'move';
      ev.dataTransfer.setData('text/plain', String(at));
      tile.classList.add('is-lifting');
      dragging(true);
    });
    tile.addEventListener('dragend', () => {
      tile.classList.remove('is-lifting');
      slotDrag = null;
      dragging(false);
    });
    /*
     * A ROUND OVER THIS TILE IS `wireDropTarget`'S JOB, not this one's — every
     * tile, full or empty, gets both wirings, and putting the round branch
     * here as well meant two `dragover` listeners racing to set the same
     * class. The one registered LAST won, which is how a bingo tile came to
     * light up for a round it would then refuse.
     */
    tile.addEventListener('dragover', (ev) => {
      if (roundDrag !== null || getShelfRoundDrag()) return;
      if (slotDrag === null || slotDrag === at) return;
      ev.preventDefault();
      tile.classList.add('drop-here');
    });
    tile.addEventListener('dragleave', () => tile.classList.remove('drop-here'));
    tile.addEventListener('drop', (ev) => {
      if (roundDrag !== null || getShelfRoundDrag()) return;
      if (slotDrag === null || slotDrag === at) return;
      ev.preventDefault();
      tile.classList.remove('drop-here');
      const from = slotDrag;
      slotDrag = null;
      dragging(false);
      commit(swapSlots(slots, from, at));
    });
  }

  function wireRoundDots(tile, slot) {
    for (const dot of tile.querySelectorAll('.mix-rd')) {
      const round = Number(dot.dataset.round);
      // Stop the tile's OWN drag starting under a press meant for the dot.
      dot.addEventListener('mousedown', (ev) => ev.stopPropagation());
      /*
       * TAP TOGGLES ON/OFF — the fallback for a phone, where HTML5 drag
       * never fires at all. An OFF dot (`.mix-rd.off`) is not draggable, so
       * only the ON ones reach `dragstart` below; a click on either one
       * always toggles, same meaning `lbOff`'s tick already has.
       */
      dot.addEventListener('click', () => commit(toggleRoundOff(slots, { packId: slot.packId, round })));
      if (dot.classList.contains('off')) continue;
      dot.addEventListener('dragstart', (ev) => {
        ev.stopPropagation();
        roundDrag = { packId: slot.packId, round };
        ev.dataTransfer.effectAllowed = 'move';
        ev.dataTransfer.setData('text/plain', String(round));
        dot.classList.add('is-lifting');
        dragging(true);
      });
      dot.addEventListener('dragend', () => {
        dot.classList.remove('is-lifting');
        roundDrag = null;
        dragging(false);
      });
    }
  }

  /*
   * OFF rounds — this pack's own, not placed in ANY slot — are drawn ONLY in
   * its HOME slot (the first one naming it), dimmed red, tap to bring back.
   * Every other slot of the same pack shows just what it actually holds, or
   * a round pulled out to slot 3 would appear to still be draggable FROM
   * slot 1 as well.
   */
  function roundDots(slot, at) {
    const pack = packOf(slot.packId);
    const names = (pack && pack.rounds) || [];
    const label = (r) => esc((names[r] && names[r].title) || `Round ${r + 1}`);
    const on = slot.rounds.map((r) => `
      <button class="mix-rd" type="button" draggable="true" data-round="${r}"
        title="${label(r)} — drag to move it, tap to take it out of tonight"
        aria-label="${label(r)}">${r + 1}</button>`);
    const isHome = pack && at === homeSlotIndex(slots, slot.packId);
    const off = isHome
      ? offRoundsFor(slots, slot.packId, (pack.rounds || []).length).map((r) => `
        <button class="mix-rd off" type="button" data-round="${r}"
          title="${label(r)} — out of tonight, tap to bring it back"
          aria-label="${label(r)} — off">${r + 1}</button>`)
      : [];
    return `<div class="lb-rounds">${[...on, ...off].join('')}</div>`;
  }

  /*
   * WHAT THIS BINGO GAME IS SET TO, AS TEXT — the two `<select>`s that used
   * to live here moved to the settings row under the tiles, because at 146px
   * they clipped their own option text mid-word and covered the part of the
   * tile a drag starts from. The tile still SAYS what it is set to, which is
   * the half that was worth having up here: you can read six tiles at a
   * glance and only tap the one you want to change.
   */
  function bingoSaid(slot, pack) {
    const shape = slot.shape || packOwnShape(pack);
    const n = slot.prizes || DEFAULT_BINGO_PRIZES;
    return `<div class="mix-bingo-said tiny">${esc(`${shape.rows}×${shape.cols}`)} · ${n} prize${n === 1 ? '' : 's'}</div>`;
  }

  /*
   * AN EMPTY SLOT IS A DROP TARGET, NOT A BUTTON — and it used to say it was.
   *
   * It carried `role="button"` and `tabindex="0"`, so it was announced as a
   * control and could be tabbed to and pressed with Enter — and pressing it
   * did nothing at all, on a mouse, a keyboard and by construction on a
   * touchscreen, because a slot has no tap action to have. The rule this file
   * already follows is that a tile lights up ONLY where the drop will be
   * taken, precisely so a control never promises something it will not do;
   * announcing an inert square as a button is that promise made in words.
   *
   * The way a slot is filled without a drag is unchanged and is on the PACK
   * CARD: tapping one puts it in the next free slot, which is the half that
   * works on a phone where HTML5 drag never fires at all.
   *
   * The label goes on the element instead, so a screen reader still says what
   * the square is for rather than nothing.
   */
  function emptyTile(at) {
    const tile = node(`
      <div class="lb-tile mix-drop" aria-label="Slot ${at + 1} — drop a round or a pack here"
           title="Drop a round or a pack here">
        <span class="lb-tile-n is-empty">${at + 1}</span>
        <span class="lb-drop-plus" aria-hidden="true">+</span>
      </div>`);
    wireDropTarget(tile, at);
    return tile;
  }

  /*
   * A GRIP NEXT TO THE NAME, ON EVERY TILE — a bingo tile's own shape/prize
   * `<select>`s cover almost its whole lower half, and a native `<select>`
   * intercepts a mousedown for its own dropdown before any HTML5 drag can
   * begin; no `stopPropagation` reaches that, so nothing under the title was
   * ever going to be draggable on one. Given every tile the same handle
   * rather than only the ones that need it, so there is one rule instead of
   * "quiz tiles grab anywhere, bingo tiles grab here" — and put in the name's
   * own row, in normal flow, rather than floated over the top of the tile,
   * so it never has to guess how much blank space a two-line title left.
   */
  /*
   * WHAT A TILE IS CALLED — and the tile now names the ROUND, with the pack
   * underneath in smaller type.
   *
   * A pack arrives burst into one tile per round, so a row of tiles all
   * reading "1980s Pop" says nothing about the order of the evening, which is
   * the one thing this row exists to show. The round is the heading and the
   * pack is the note; a slot still holding more than one round (two dropped
   * onto each other) keeps the pack's name and its round ticks, because there
   * the pack IS what the tile is.
   */
  function roundName(pack, i) {
    const round = (pack.rounds || [])[i];
    const written = String((round && round.title) || '').trim();
    /*
     * THE "ROUND ONE — " IS TRIMMED OFF, for the same reason `shortTitle()`
     * trims a trailing "Quiz" from a pack: the tile already says which
     * position it is by WHERE IT IS in the row, and the packs on disk name
     * their rounds "Round One — 1980s Pop Music". Left whole, a three-round
     * pack drew three tiles reading "Round One —…", "Round Two —…", "Round
     * Three —…" with the only distinguishing half clipped off the end —
     * measured at the real 167px tile, which is why it was caught.
     *
     * Falls back to what was written, then to the position, so a round titled
     * only "Round Two" still says something rather than going blank — the same
     * fallback `shortTitle()` makes when its trim empties a name.
     */
    const trimmed = written.replace(/^round\s+\S+\s*[—–-]\s*/i, '').trim();
    return trimmed || written || `Round ${i + 1}`;
  }

  /**
   * WHAT KIND OF ROUND THIS IS, IN WORDS — reported off a live bar: *"there
   * are three greens there and they're all different rounds? Or perhaps have
   * a little header at the top to say what they are?"*
   *
   * **NOT A COLOUR, AND THAT IS THIS FILE'S OLDEST RULE ARRIVING FROM A NEW
   * DIRECTION.** The tile's edge already means the KIND OF PACK — quiz green,
   * bingo purple, breakout its own — which is the one thing a mixed night has
   * to say at a glance, and repainting it per round type takes that away
   * exactly when it matters most. Green, pink and purple are each already
   * spoken for elsewhere too. So the type is said in WORDS, which is also
   * what the host offered himself.
   *
   * **AND IT TAKES THE SUB'S LINE RATHER THAN A THIRD ONE.** A tile is 90px
   * and the two rows on it are full. What the sub was drawing on the reported
   * screen was the pack name FOUR TIMES — one pack burst into four rounds —
   * which is the same emptiness the tile's own rule already names: *a row of
   * tiles all reading "1980s Pop" says nothing about the order of the
   * evening.* So the pack name is kept only where it TELLS TWO TILES APART,
   * which is a night holding more than one pack. The tooltip carries it
   * always.
   */
  function typeLine(pack, i) {
    const round = (pack.rounds || [])[i];
    const type = round && round.type;
    if (!type) return '';
    const packs = new Set(slots.filter((s) => s && s.packId).map((s) => s.packId));
    const also = packs.size > 1 ? ` \u00b7 ${esc(shortTitle(pack.title))}` : '';
    return `<div class="lb-tile-sub"><span aria-hidden="true">${roundGlyph(type, i + 1)}</span> ${esc(roundWord(type))}${also}</div>`;
  }

  function filledTile(slot, at) {
    const isBingo = slot.kind === 'bingo';
    const pack = packOf(slot.packId) || { id: slot.packId, title: slot.packId, trackCount: 40, cardSize: 4 };
    const look = packLookAttrs(pack, isBingo ? 'bingo' : isBreakoutPack(pack) ? 'breakout' : 'quiz');
    const one = !isBingo && slot.rounds.length === 1;
    const name = one ? roundName(pack, slot.rounds[0]) : shortTitle(pack.title);
    const tile = node(`
      <div class="lb-tile is-pack ${look.cls} ${at === picked ? 'is-picked' : ''}" style="${look.style}" draggable="true" title="${esc(one ? `${name} — ${pack.title}` : pack.title)}">
        ${packWord(look)}
        <button class="lb-tile-off" type="button" aria-label="Take this out">&times;</button>
        <span class="lb-tile-n">${at + 1}</span>
        <div class="lb-tile-head">
          <span class="drag-grip" aria-hidden="true" title="Drag to move this round">${gripIcon()}</span>
          <b class="lb-tile-name">${esc(name)}</b>
        </div>
        ${isBingo ? bingoSaid(slot, pack) : one ? typeLine(pack, slot.rounds[0]) : roundDots(slot, at)}
      </div>`);

    tile.querySelector('.lb-tile-off').addEventListener('mousedown', (ev) => ev.stopPropagation());
    tile.querySelector('.lb-tile-off').addEventListener('click', (ev) => {
      ev.stopPropagation();
      commit(removeSlot(slots, at));
    });
    /*
     * A TAP ON THE TILE PICKS IT — the settings row underneath then talks
     * about this pack. Everything on the tile that DOES something (the ×,
     * a round dot) stops the event itself, so picking is what is left: the
     * whole face of the tile, which is the easiest possible target in a
     * dark pub, and it never changes the night by accident.
     */
    tile.addEventListener('click', () => onPick(at));
    wireSlotDrag(tile, at);
    wireDropTarget(tile, at);
    if (!isBingo) wireRoundDots(tile, slot);
    return tile;
  }

  shown.forEach((slot, at) => el.appendChild(slot ? filledTile(slot, at) : emptyTile(at)));
  return el;
}
