/**
 * THE BREAK STRIP — what happens in each gap of tonight, drawn under the
 * running order it belongs to.
 *
 * ---
 *
 * Asked for on 23 August 2026, and the shape was chosen off three rendered
 * options: *"the breaks are drawn where they happen, in the running order"*,
 * over a pair of ordinary dropdowns and over an explicit list of every break.
 *
 * **THE REASON IT BEAT THE EXPLICIT LIST IS THAT IT CANNOT GO STALE.** The
 * host's own framing was "4 rounds and a bingo, so 5 breaks" — right for that
 * night, and a trap as a model. A round can be switched off on the launch bar,
 * a pack can gain one, a part can be dragged out. A stored list of five would
 * be wrong the first time any of that happened, silently, with every row still
 * looking real. This strip is DERIVED from the same segments Launch is about
 * to send, so it is arithmetic rather than a record, and the count on screen
 * is the count the night will have.
 *
 * **IT IS DRAWN UNDER THE TILES RATHER THAN BETWEEN THEM**, which is the one
 * place this departs from the picture that was chosen. The tiles are a
 * six-column grid and a gap element between them would have to be a seventh,
 * eighth, ninth column — and worse, a break lives between two ROUNDS, which
 * are dots inside a 146px tile with no room for anything between them. A row
 * directly underneath keeps everything the choice was actually about: same
 * order, same count, one chip per real gap, tap it to set it.
 *
 * **A CHIP SAYS WHAT IT IS SET TO, not what it could be.** Two glyphs and a
 * label, so a strip of six is read at a glance rather than opened six times —
 * the same job the pack tints do on the shelf. Only a break that has been
 * CHANGED is lit; the rest are quiet, because a strip where everything shouts
 * is a strip that says nothing.
 */

import { esc, node } from './client.js';
import {
  PHONE, SCREEN, breakFor, breakSlots,
} from './break-parts.js';

/** What a phone setting looks like on a chip, and reads as in the picker. */
const PHONE_SAYS = {
  [PHONE.BOTH]: { icon: '📷🕹️', words: 'Photos and the game' },
  [PHONE.PHOTOS]: { icon: '📷', words: 'Photos only' },
  [PHONE.GAME]: { icon: '🕹️', words: 'The game only' },
  [PHONE.NOTHING]: { icon: '·', words: 'Nothing' },
};

/**
 * And the screen's. **The lobby has no entry here on purpose** — its screen
 * belongs to the join code, which nothing in this app may dim, so a doors
 * chip sets the phones and says so.
 */
const SCREEN_SAYS = {
  [SCREEN.SCORES]: { icon: '🏆', words: 'The scores' },
  [SCREEN.SCORES_THEN_ADVERTS]: { icon: '🏆📺', words: 'Scores, then your adverts' },
  [SCREEN.ADVERTS]: { icon: '📺', words: 'Your adverts' },
  [SCREEN.NOTHING]: { icon: '·', words: 'Nothing' },
};

/**
 * HOW MANY ROUNDS A PART WILL ACTUALLY PLAY — switched-off ones excluded,
 * because a round that is not played has no board after it and therefore is
 * not a break.
 *
 * Reads the SEGMENT rather than the pack, for the reason this whole file
 * exists: the segment is what Launch sends, so counting anything else is
 * counting a different night.
 */
function roundsInSegment(segment) {
  if (!segment || segment.kind === 'bingo') return 0;
  return (segment.order || []).length;
}

/**
 * The breaks of the night as it is currently set up.
 *
 * @param {Array} segments what `segmentsFromSlots()` returns, or the simple
 *   night's equivalent — one entry per PART, in order.
 */
export function breaksOf(segments) {
  return breakSlots(segments || [], roundsInSegment);
}

/**
 * ONE CHIP, drawn from what the plan says this break does.
 *
 * `breakFor()` defaults anything unset, so a chip always says something true
 * rather than "not set" — there is no unset state on a projector, and a chip
 * that admitted one would be describing the UI rather than the night.
 */
function chip(slot, plan) {
  const set = breakFor(plan, slot.id);
  const isLobby = slot.kind === 'lobby';
  const changed = Boolean(plan && plan[slot.id]);
  const phone = PHONE_SAYS[set.phone] || PHONE_SAYS[PHONE.PHOTOS];
  const screen = SCREEN_SAYS[set.screen] || SCREEN_SAYS[SCREEN.SCORES];
  return node(`
    <button class="brk-chip ${changed ? 'is-set' : ''}" type="button" data-break="${esc(slot.id)}"
      aria-label="${esc(slot.label)} — phones: ${esc(phone.words)}${isLobby ? '' : `, screen: ${esc(screen.words)}`}">
      <span class="brk-icons" aria-hidden="true">${phone.icon}${isLobby ? '' : `<i>${screen.icon}</i>`}</span>
      <span class="brk-when">${esc(slot.label)}</span>
    </button>`);
}

/**
 * WHAT ONE BREAK DOES — the panel that opens under the strip.
 *
 * Ordinary dropdowns, because that is what every other decision about tonight
 * is: the GUI rules say a control's shape is decided by what it DOES, and
 * this is "choose", the same as the look and the card shape a row above.
 *
 * **IT NAMES THE BREAK IT IS SETTING**, exactly as the picked-pack settings
 * row does, because with six chips above it an unlabelled panel is a panel
 * you have to remember the context of.
 */
function setter(slot, plan, onSet) {
  const set = breakFor(plan, slot.id);
  const isLobby = slot.kind === 'lobby';
  const opts = (map, chosen) => Object.entries(map)
    .map(([value, said]) => `<option value="${esc(value)}" ${value === chosen ? 'selected' : ''}>${esc(said.words)}</option>`)
    .join('');
  const el = node(`
    <div class="lb-set lb-set-break">
      <span class="lb-set-for">${esc(slot.label)}</span>
      <label class="pack-shape">On their phones
        <select class="brk-phone">${opts(PHONE_SAYS, set.phone)}</select>
      </label>
      ${isLobby
    ? `<!-- THE DOORS HAVE NO SCREEN CHOICE. The join code is what the
             projector is for at that moment and nothing in this app may dim
             it — the same rule that keeps a big photo beside the code rather
             than over it. Said out loud rather than left as a missing
             control, because an absent dropdown reads as a bug. -->
        <span class="tiny brk-why">The big screen keeps the join code up.</span>`
    : `<label class="pack-shape">On the big screen
        <select class="brk-screen">${opts(SCREEN_SAYS, set.screen)}</select>
      </label>`}
      <button class="brk-done" type="button">Done</button>
    </div>`);
  const read = () => ({
    phone: el.querySelector('.brk-phone').value,
    screen: isLobby ? set.screen : el.querySelector('.brk-screen').value,
  });
  el.querySelector('.brk-phone').addEventListener('change', () => onSet(slot.id, read()));
  el.querySelector('.brk-screen')?.addEventListener('change', () => onSet(slot.id, read()));
  el.querySelector('.brk-done').addEventListener('click', () => onSet(null, null));
  return el;
}

/**
 * THE WHOLE STRIP.
 *
 * @param {object} opts
 * @param {Array}  opts.segments  the parts of tonight, as Launch will send them
 * @param {object} opts.plan      `{ [breakId]: { phone, screen } }`
 * @param {string} opts.open      which break's panel is open, or ''
 * @param {function} opts.onSet   `(breakId|null, set|null)` — null closes
 * @param {function} opts.onOpen  `(breakId)` — which chip was tapped
 */
export function breakStrip({ segments, plan, open, onSet, onOpen }) {
  const slots = breaksOf(segments);
  /*
   * NOTHING IN THE BAY MEANS NO STRIP. A night with no packs has no gaps, and
   * a row of chips describing breaks that do not exist yet is furniture on
   * the one panel whose job is getting a night started.
   */
  if (!slots.length) return null;
  const el = node(`
    <div class="brk-strip">
      <div class="brk-row"></div>
    </div>`);
  const row = el.querySelector('.brk-row');
  for (const slot of slots) {
    const c = chip(slot, plan);
    c.addEventListener('click', () => onOpen(slot.id === open ? '' : slot.id));
    row.appendChild(c);
  }
  const openSlot = slots.find((s) => s.id === open);
  if (openSlot) el.appendChild(setter(openSlot, plan, onSet));
  return el;
}

/**
 * A PLAN WITH BREAKS THAT NO LONGER EXIST TAKEN OUT.
 *
 * Switch a round off and the break after it stops happening; its entry would
 * otherwise sit in the plan for ever, invisible, and come back to life the day
 * the round was switched on again — saying something the host set weeks ago
 * and has no way to see. Run on the way OUT to the launch and on the way in
 * from a show, so what is sent is always describable by what is on screen.
 */
export function prunePlan(plan, segments) {
  const alive = new Set(breaksOf(segments).map((s) => s.id));
  const out = {};
  for (const [id, set] of Object.entries(plan || {})) {
    if (alive.has(id)) out[id] = set;
  }
  return out;
}
