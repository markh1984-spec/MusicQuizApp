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
 * HOW MANY OF A GROUP'S ROWS THE RAIL SHOWS BEFORE IT STOPS.
 *
 * *"Perhaps the last 4 nights, with older nights accessible in the venues
 * section below?"* Four is the number asked for and it is a good one: the rail
 * is for **the night you are thinking about**, which is almost always one of
 * the last few, and the tab body below already has the whole archive with
 * search and headcounts on it. A rail that tries to be the archive stops being
 * a picker.
 */
const GROUP_CAP = 4;

/**
 * WHICH GROUPS ARE OPEN, remembered across renders.
 *
 * Module-level because the bay is rebuilt on every state push — which during a
 * lobby is every time somebody joins — so a fold kept inside the render would
 * shut itself the moment the next phone arrived. That is the same fault the
 * who-picked-what panel records, and the same fix.
 *
 * **KEYED BY RAIL AND GROUP, never by group alone.** Two doors can hold a
 * group of the same name — "The Crown" is a pub on Post gig and a pub on
 * Community — and one key would make opening it on one door open it on the
 * other, which is a fold that appears to have a mind of its own.
 */
const openGroups = new Map();

/**
 * One rail.
 *
 * @param {object}   o
 * @param {Array}    o.items   `{ key, name, note, group?, style?, cls? }` per
 *   row. `style`/`cls` are for a pack's own colours — see `packLookAttrs()`; a
 *   row with neither is a plain row, which is what a night and a venue are.
 * @param {string}   o.picked  the key that is lit
 * @param {Function} o.onPick  called with the key
 * @param {string} [o.empty]   what to say when there is nothing to pick
 * @param {string} [o.railId]  which rail this is, for remembering its folds
 * @param {string} [o.more]    the line under a group that has more than it shows
 * @param {Function} [o.onFold]  redraw, after a group is opened or shut
 */
export function bayRail({
  items = [], picked = '', onPick = () => {}, empty = '', railId = '', more = '',
  onFold = () => {},
}) {
  const rail = node('<div class="bay-rail" role="tablist"></div>');
  if (!items.length) {
    if (empty) rail.appendChild(node(`<div class="tiny bay-rail-none">${esc(empty)}</div>`));
    return rail;
  }

  const row = (item) => {
    const btn = node(`
      <button class="bay-pick ${item.key === picked ? 'on' : ''} ${esc(item.cls || '')}"
              type="button" role="tab" aria-selected="${item.key === picked}"
              style="${esc(item.style || '')}">
        <span class="bay-pick-name">${esc(item.name)}</span>
        ${item.note ? `<span class="tiny bay-pick-note">${esc(item.note)}</span>` : ''}
      </button>`);
    btn.addEventListener('click', () => onPick(item.key));
    return btn;
  };

  /*
   * GROUPED FIRST, in the order the caller gave them — the caller has already
   * decided that a pub's nights sit together and which pub comes first, and
   * re-sorting here would be a second opinion about it.
   */
  const groups = [];
  const byName = new Map();
  for (const item of items) {
    const name = item.group || '';
    if (!byName.has(name)) { byName.set(name, { name, rows: [] }); groups.push(byName.get(name)); }
    byName.get(name).rows.push(item);
  }

  /*
   * A GROUP OPENS BY DEFAULT WHEN NOTHING IS PICKED — the FIRST one, and only
   * it. Every fold shut is a rail with nothing to pick in it, which is the
   * two-taps-to-save-a-line fault this app has a rule against, and it lands on
   * exactly the moment somebody arrives with nothing on the bench. One list
   * open and the rest folded is compact AND usable.
   */
  const anyPicked = items.some((i) => i.key === picked);

  for (const [index, group] of groups.entries()) {
    // Ungrouped rows are just rows — the league rail is every venue, and there
    // is nothing above a venue to fold it into.
    if (!group.name) { for (const item of group.rows) rail.appendChild(row(item)); continue; }

    /*
     * WHAT IS REMEMBERED WINS, ALWAYS — and the first version of this had it
     * the other way round, which made the control DEAD in the commonest case.
     *
     * It forced a group open whenever it held the picked row, so that a pick
     * made from the tab body could never light a row inside a shut fold. The
     * reasoning was sound and the trade was wrong: once you have opened a
     * night, the group holding it is the one you are looking at, so pressing
     * its heading set the flag, re-rendered, and the override put it straight
     * back. Reported as *"the section needs to collapse on click and expand on
     * click"* — it did neither, and nothing threw.
     *
     * **A CONTROL THAT DOES NOTHING WHEN PRESSED IS WORSE THAN THE PROBLEM IT
     * WAS AVOIDING.** So `holdsPicked` is a DEFAULT now rather than an
     * override, and the case it was guarding is answered by SHOWING rather
     * than forcing: a shut group that holds what you are looking at wears the
     * lit edge itself, so the rail still says where you are. Nothing is lost
     * either way, because the thing you picked is filling the bay beside it.
     *
     * With one group there is nothing to choose between, so it opens: a lone
     * fold hiding the only list on the page is a control with no job.
     */
    const key = `${railId}::${group.name}`;
    const holdsPicked = group.rows.some((r) => r.key === picked);
    const byDefault = holdsPicked || groups.length === 1 || (!anyPicked && index === 0);
    const isOpen = openGroups.has(key) ? openGroups.get(key) : byDefault;

    /*
     * NO `title`, ANYWHERE IN THE RAIL. A native tooltip is an unstyled box
     * that lands over the rows underneath — visible in the screenshot that
     * reported this — and it was only there because the name was being
     * ellipsised. Letting the name WRAP instead removes the need and the
     * tooltip together: a pub is worth two lines, and it is the one thing on
     * the row somebody is reading.
     */
    const head = node(`
      <button class="bay-rail-group ${isOpen ? 'on' : ''} ${!isOpen && holdsPicked ? 'holds-picked' : ''}"
              type="button" aria-expanded="${isOpen}">
        <span class="bay-rail-caret" aria-hidden="true"></span>
        <span class="bay-rail-what">${esc(group.name)}</span>
        <span class="tiny bay-rail-count">${group.rows.length}</span>
      </button>`);
    /*
     * THE COUNT STAYS ON THE HEADING WHETHER IT IS OPEN OR SHUT. Shut, it is
     * the only thing saying there is anything in there; open, it is what says
     * how many are NOT being shown once the cap bites.
     */
    // Redrawn by whoever owns the bay — the rail is handed the way back rather
    // than reaching for one, so it stays a leaf that imports nothing but the
    // shared helpers. The same rule `breakPlumbing()` follows.
    head.addEventListener('click', () => { openGroups.set(key, !isOpen); onFold(); });
    rail.appendChild(head);
    if (!isOpen) continue;

    const shown = group.rows.slice(0, GROUP_CAP);
    /*
     * AND THE ONE YOU ARE LOOKING AT IS ALWAYS DRAWN, even past the cap.
     * Otherwise opening an older night from the list below lights a row the
     * rail has decided not to show, which is the fold problem again one level
     * down.
     */
    if (holdsPicked && !shown.some((r) => r.key === picked)) {
      shown[shown.length - 1] = group.rows.find((r) => r.key === picked);
    }
    for (const item of shown) rail.appendChild(row(item));
    if (group.rows.length > shown.length && more) {
      rail.appendChild(node(`<div class="tiny bay-rail-more">${esc(more)}</div>`));
    }
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
