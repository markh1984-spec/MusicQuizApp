/**
 * THE BAY IS A RAIL AND WHAT IT PICKED — the shape every door's bay now takes.
 *
 * ---
 *
 * Asked for on 29 August 2026, off a screenshot of the Community door's league
 * bay: *"The way this is presented is perfect — content taking up the bulk to
 * the right, controls on the left. How can we utilise this for all of the
 * sections?"*
 *
 * **IT IS ONE SENTENCE AND IT FITS EVERY DOOR: a narrow list of what you could
 * be looking at, and the one you picked filling the rest.** Workshop's list is
 * your packs, Post gig's is your nights, Community's is your venues. Each door
 * already had exactly that idea and each had built its own version of it — a
 * pack tile you drag onto, a night you drag up, a venue you scroll to find.
 * Three answers to one question is the label collision this project keeps
 * catching, and it is why this file exists rather than a third rail.
 *
 * **THE CONSOLE DOOR IS THE ONE EXCEPTION, DELIBERATELY.** Its bay is the
 * launch bar, which is on the protected surface and is the REFERENCE every
 * other bay is sized against. It is not a list of things to look at — it is
 * the one thing you came to do. Do not give it a rail.
 *
 * ---
 *
 * **THE RAIL IS THE TAB COLUMN, ONE REGION HIGHER**, and that is the point
 * rather than a coincidence: same 190px, same stack, same lit left edge. Two
 * different ways of saying "pick one of these" on one screen is exactly the
 * fault this app has a rule against, so the second one is the first one.
 *
 * **A RAIL PICKS; IT NEVER ACTS.** Nothing in here deletes, publishes or
 * launches. Those live under the thing they act on — see the Community door's
 * own note. A rail row is a destination, so the worst a mis-tap can do is show
 * you something else.
 *
 * **AND THE WHOLE PAGE REPAINTS ON A PICK.** The bay and the tab body are
 * built by two different calls inside one `render()`, and the tab body's
 * controls act on whatever the rail is pointing at — so repainting only the
 * bay would leave a publish button aimed at the pub before it.
 */

import { esc, node } from './client.js';

/**
 * One rail.
 *
 * @param {object}   o
 * @param {Array}    o.items   `{ key, name, note, style?, cls? }` per row.
 *   `style`/`cls` are for a pack's own colours — see `packLookAttrs()`; a row
 *   with neither is a plain row, which is what a night and a venue are.
 * @param {string}   o.picked  the key that is lit
 * @param {Function} o.onPick  called with the key
 * @param {string} [o.empty]   what to say when there is nothing to pick
 */
export function bayRail({ items = [], picked = '', onPick = () => {}, empty = '' }) {
  const rail = node('<div class="bay-rail" role="tablist"></div>');
  if (!items.length) {
    if (empty) rail.appendChild(node(`<div class="tiny bay-rail-none">${esc(empty)}</div>`));
    return rail;
  }
  let group = '';
  for (const item of items) {
    /*
     * COMPARTMENTALISED BY PUB, AND THEN THE NIGHTS FROM THERE — asked for in
     * those words. A heading rather than a second level of clicking: a rail
     * whose rows have to be opened before they can be picked makes the common
     * job two taps to save one line of text, which is the wrong way round.
     */
    if (item.group && item.group !== group) {
      group = item.group;
      rail.appendChild(node(`<div class="tiny bay-rail-group">${esc(group)}</div>`));
    }
    const btn = node(`
      <button class="bay-pick ${item.key === picked ? 'on' : ''} ${esc(item.cls || '')}"
              type="button" role="tab" aria-selected="${item.key === picked}"
              style="${esc(item.style || '')}" title="${esc(item.name)}">
        <span class="bay-pick-name">${esc(item.name)}</span>
        ${item.note ? `<span class="tiny bay-pick-note">${esc(item.note)}</span>` : ''}
      </button>`);
    btn.addEventListener('click', () => onPick(item.key));
    rail.appendChild(btn);
  }
  return rail;
}

/**
 * The rail and the thing, as the bay's two columns.
 *
 * One column below 900px, where there is no fixed frame and the rail goes
 * above what it picked — the same collapse the tab column takes, for the same
 * reason.
 */
export function bayColumns(rail, side) {
  const wrap = node('<div class="baycols"></div>');
  const right = node('<div class="bay-side"></div>');
  right.append(...(Array.isArray(side) ? side : [side]));
  wrap.append(rail, right);
  return wrap;
}

/**
 * A bay's own heading — the name of the thing showing, and one line under it.
 *
 * Drawn here rather than in each door, for the reason `tabBody()` draws the
 * tab's heading in one place: a heading each is the arrangement that let four
 * of them go missing.
 */
export function bayHead(what, note = '') {
  return node(`
    <div class="bay-head">
      <b>${esc(what)}</b>
      ${note ? `<span class="tiny">${esc(note)}</span>` : ''}
    </div>`);
}
