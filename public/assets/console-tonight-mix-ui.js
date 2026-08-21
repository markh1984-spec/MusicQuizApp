/**
 * THE MIXED ROW, DRAWN — the DOM half of `console-tonight-mix.js`. Split out
 * because that file is pure data on purpose (so its logic tests under plain
 * Node like `plans.test.js` already does), and this one needs `library`
 * (for `cardShapes`) and `packWord()`/`packLookAttrs()` — real browser
 * modules that read `localStorage` at load and cannot be imported outside
 * one.
 */

import { esc, node, gripIcon } from './client.js';
import { packWord } from './console.js';
import { library } from './console-state.js';
import { packLookAttrs, shortTitle, isBreakoutPack } from './pack-look.js';
import {
  DEFAULT_BINGO_PRIZES, addBingoSlot, addQuizPackSlot, homeSlotIndex, moveRoundToSlot, swapSlots,
  offRoundsFor, removeSlot, toggleRoundOff,
} from './console-tonight-mix.js';

/** The card shape a pack would use if a bingo slot has not been given its own — same fallback chain `console-packs.js`'s `shapeOptions()` uses, kept here because that function does not hand its resolved default back out. */
function packOwnShape(pack) {
  const shapes = library.cardShapes || [];
  const found = shapes.find((s) => s.rows === pack.cardRows && s.cols === pack.cardCols)
    || shapes.find((s) => s.rows === s.cols && s.rows === pack.cardSize)
    || shapes[shapes.length - 1];
  return found ? { rows: found.rows, cols: found.cols } : { rows: 4, cols: 4 };
}

function shapeOptionsFor(pack, selected) {
  const shapes = (library.cardShapes || []).filter((s) => pack.trackCount >= s.minimum);
  const usable = shapes.length ? shapes : (library.cardShapes || []).slice(0, 1);
  return usable.map((s) => {
    const picked = selected.rows === s.rows && selected.cols === s.cols;
    return `<option value='{"rows":${s.rows},"cols":${s.cols}}' ${picked ? 'selected' : ''}>${esc(s.label)} — line of ${Math.max(s.rows, s.cols)}</option>`;
  }).join('');
}

function prizeOptionsFor(shape, selected) {
  const found = (library.cardShapes || []).find((s) => s.rows === shape.rows && s.cols === shape.cols);
  const plans = (found && found.plans) || [];
  return plans.map((plan, i) => `<option value="${i + 1}" ${i + 1 === selected ? 'selected' : ''}>${i + 1} — ${esc(plan.join(', then '))}</option>`).join('');
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
}) {
  const el = node('<div class="lb-tiles"></div>');
  let roundDrag = null; // { packId, round } while a round dot is being lifted
  let slotDrag = null; // index of the tile being dragged for reordering

  const shown = Array.from(
    { length: Math.min(maxSlots, Math.max(slots.length + 1, 1)) },
    (_, i) => slots[i] || null,
  );

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
  function wireDropTarget(tile, at) {
    tile.addEventListener('dragover', (ev) => {
      const fromShelf = getPackDrag();
      const shelfRound = getShelfRoundDrag();
      if (roundDrag === null && !fromShelf && !shelfRound) return;
      ev.preventDefault();
      tile.classList.add('drop-here');
    });
    tile.addEventListener('dragleave', () => tile.classList.remove('drop-here'));
    tile.addEventListener('drop', (ev) => {
      tile.classList.remove('drop-here');
      if (roundDrag !== null) {
        ev.preventDefault();
        const moved = roundDrag;
        roundDrag = null;
        dragging(false);
        commit(moveRoundToSlot(slots, moved, at));
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
        clearShelfRoundDrag();
        dragging(false);
        commit(moveRoundToSlot(slots, shelfRound, at));
        return;
      }
      const fromShelf = getPackDrag();
      if (!fromShelf) return;
      ev.preventDefault();
      clearPackDrag();
      dragging(false);
      const pack = packOf(fromShelf.id);
      if (!pack) return;
      commit(fromShelf.kind === 'bingo' ? addBingoSlot(slots, pack) : addQuizPackSlot(slots, pack));
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
    tile.addEventListener('dragstart', (ev) => {
      // A press on a round dot or a bingo control starts THAT drag, not the
      // whole tile — stopped at the dot/control's own mousedown, below.
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
    tile.addEventListener('dragover', (ev) => {
      if (slotDrag === null || slotDrag === at) return;
      ev.preventDefault();
      tile.classList.add('drop-here');
    });
    tile.addEventListener('dragleave', () => tile.classList.remove('drop-here'));
    tile.addEventListener('drop', (ev) => {
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

  function wireBingoControls(tile, slot, at) {
    const shapeSel = tile.querySelector('.mix-shape');
    const prizeSel = tile.querySelector('.mix-prizes');
    // A tap on the controls must not also pick the tile up.
    for (const box of [shapeSel, prizeSel]) box.addEventListener('mousedown', (ev) => ev.stopPropagation());
    shapeSel.addEventListener('change', () => {
      const shape = JSON.parse(shapeSel.value);
      const next = slots.slice();
      next[at] = { ...slot, shape, prizes: 1 };
      commit(next);
    });
    prizeSel.addEventListener('change', () => {
      const next = slots.slice();
      next[at] = { ...slot, prizes: Number(prizeSel.value) || 1 };
      commit(next);
    });
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

  function bingoControls(slot, pack) {
    const shape = slot.shape || packOwnShape(pack);
    return `<div class="mix-bingo-set" title="This interlude's own prizes and card shape">
      <select class="mix-shape">${shapeOptionsFor(pack, shape)}</select>
      <select class="mix-prizes">${prizeOptionsFor(shape, slot.prizes || DEFAULT_BINGO_PRIZES)}</select>
    </div>`;
  }

  function emptyTile(at) {
    const tile = node(`
      <div class="lb-tile mix-drop" tabindex="0" role="button" title="Drop a round or a pack here">
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
  function filledTile(slot, at) {
    const isBingo = slot.kind === 'bingo';
    const pack = packOf(slot.packId) || { id: slot.packId, title: slot.packId, trackCount: 40, cardSize: 4 };
    const look = packLookAttrs(pack, isBingo ? 'bingo' : isBreakoutPack(pack) ? 'breakout' : 'quiz');
    const tile = node(`
      <div class="lb-tile is-pack ${look.cls}" style="${look.style}" draggable="true" title="${esc(pack.title)}">
        ${packWord(look)}
        <button class="lb-tile-off" type="button" aria-label="Take this out">&times;</button>
        <span class="lb-tile-n">${at + 1}</span>
        <div class="lb-tile-head">
          <span class="drag-grip" aria-hidden="true" title="Drag to move this pack">${gripIcon()}</span>
          <b class="lb-tile-name">${esc(shortTitle(pack.title))}</b>
        </div>
        ${isBingo ? bingoControls(slot, pack) : roundDots(slot, at)}
      </div>`);

    tile.querySelector('.lb-tile-off').addEventListener('mousedown', (ev) => ev.stopPropagation());
    tile.querySelector('.lb-tile-off').addEventListener('click', () => commit(removeSlot(slots, at)));
    wireSlotDrag(tile, at);
    wireDropTarget(tile, at);
    if (isBingo) wireBingoControls(tile, slot, at);
    else wireRoundDots(tile, slot);
    return tile;
  }

  shown.forEach((slot, at) => el.appendChild(slot ? filledTile(slot, at) : emptyTile(at)));
  return el;
}
