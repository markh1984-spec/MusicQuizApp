/**
 * WHAT HAPPENS IN THE GAPS — one dial per pack, in the pack's own corner.
 *
 * ---
 *
 * **THIS WAS A STRIP OF CHIPS UNDER THE RUNNING ORDER AND IT IS NOT ANY
 * MORE.** The strip was reported the day after it shipped, off a screenshot:
 * *"'doors' and 'after round 1' both fill the same function, don't really
 * need both — and the after round 1 needs to perhaps be a little dropdown on
 * a per slot basis, as it's defining what happens at the end of that slot."*
 *
 * Both halves of that were right, and one of them was righter than it looked:
 *
 * - **The duplication was real.** Doors sat in the head and the round gaps sat
 *   in a strip, drawn by the same `chip()` from the same plan — one control in
 *   two places, which is exactly the label collision this project's own sweep
 *   mode exists to catch. Neither copy was beside the thing it acted on.
 * - **"On the slot" is the right instinct with one correction**, which is
 *   worth keeping because it decides the shape: a gap is not at the END of a
 *   slot. A two-round quiz owns the gap INSIDE it (after round one) as well as
 *   the one at its end, so a control that means "the end of this slot" can
 *   only ever address the last gap a pack has. What a tile's corner can
 *   honestly own is *every gap this pack creates*, which is what it does.
 *
 * **THE SHAPE CAME FROM MEASURING THE TILE, not from choosing between
 * drawings.** A tile is 179 x 76, its round ticks are 22px along the
 * bottom-left, and a four-round pack leaves exactly 58px clear in the
 * bottom-right corner. That is one 44px control — the touch floor every other
 * control on this bar is already held to — and it is never two, at any
 * spacing. So the corner gets ONE dial and the second axis had to go
 * somewhere else, which is the whole reason the big screen became a
 * night-level picker in the settings row.
 *
 * **A DIAL RATHER THAN A MENU, asked for in those words**: *"it could just be
 * a symbol you click to cycle through an internal menu — a photo symbol, then
 * a maze mouth symbol, then an infinity symbol (they get every option)."* Four
 * states on a scale, one tap each, no menu to open and shut in a dark pub.
 * What makes that safe here rather than the usual cycling-control trap is that
 * every state is a real answer: there is no invalid position to land on while
 * you spin past it, and the worst a mis-tap costs is one more tap.
 */
import { esc, node } from './client.js';
import {
  PHONE, breakFor, breakSlots,
} from './break-parts.js';

/** What each phone setting looks like on the dial, and reads as out loud. */
export const PHONE_SAYS = {
  [PHONE.BOTH]: { icon: '📷🕹️', words: 'Photos and the game' },
  [PHONE.PHOTOS]: { icon: '📷', words: 'Photos only' },
  [PHONE.GAME]: { icon: '🕹️', words: 'The game only' },
  /*
   * 📵 RATHER THAN A DOT, and the dot is why this comment exists. Asked
   * outright on 24 August 2026 — *"what does this mean? the . ?"* — which is
   * this project's own test failing: if a control needs explaining, the
   * control is wrong.
   *
   * The other three states are PICTURES of what the phones get. "Nothing" had
   * no picture, so it got punctuation, and punctuation on a button reads as a
   * control that failed to load rather than as a state. The no-phones sign is
   * the one symbol that says "nothing on the phones" without a caption.
   */
  [PHONE.NOTHING]: { icon: '📵', words: 'Nothing' },
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
 * THE ORDER THE DIAL GOES ROUND, and it is not the order the enum declares.
 *
 * It starts where a round board already is (photos), then adds the game, then
 * both, then nothing — each step giving the phones MORE than the last until
 * the last one takes it all away. A dial whose steps are not on a scale is a
 * dial you have to memorise; this one you can reason about after one press.
 */
const PHONE_CYCLE = [PHONE.PHOTOS, PHONE.GAME, PHONE.BOTH, PHONE.NOTHING];

/**
 * A GAP SET BY CYCLING A SYMBOL, ON THE THING THE GAP FOLLOWS.
 *
 * ---
 *
 * Asked for on 23 August 2026, and it replaces the strip of chips that used
 * to sit under the running order: *"it could just be a symbol you click to
 * cycle through an internal menu — there's a photo symbol and you click and
 * it becomes a maze mouth symbol and you click again and it shows an infinity
 * symbol (they get every option). This would live in the bottom right of the
 * pack ONCE LOADED."*
 *
 * **THE SIZE OF THE TILE IS WHAT DECIDES THE SHAPE, and it was measured
 * before any of this was written.** A tile is 179 x 76, its round dots are
 * 22px along the bottom-left, and a four-round pack leaves exactly **58px**
 * clear in the bottom-right corner. One 44px control — the touch floor this
 * bar already holds every other control to — fits in that with room to spare.
 * Two never would, at any spacing. So the corner gets ONE dial, and anything
 * needing a second axis has to live somewhere else.
 *
 * **WHICH IS WHY THE DIAL IS THE PHONES AND THE BIG SCREEN IS A NIGHT-LEVEL
 * PICKER.** Those are the two halves a break has, and only one of them fits
 * on a tile. The phones are the right half to put there: what a phone offers
 * genuinely differs pack by pack — a game before the bingo, photos between
 * quiz rounds — whereas "show my adverts in the gaps" is a decision about the
 * evening and the venue paying for it, which is what the settings row is for.
 *
 * **IT SETS EVERY GAP THE PACK OWNS AT ONCE**, which is the honest consequence
 * of one control per tile rather than a limitation hidden behind it. A pack's
 * own gaps are the boards between its rounds, and wanting photos after round
 * one but a game after round two is not a thing anybody has asked for. What it
 * does NOT touch is another pack's gaps, or the doors.
 *
 * @param {object} opts
 * @param {string[]} opts.ids  every break id this dial owns
 * @param {object} opts.plan   the night's break plan
 * @param {function} opts.onSet `(ids, phone)` — write it to all of them
 * @param {string} opts.what   what it is setting, for the tooltip and label
 */
export function gapDial({ ids, plan, onSet, what = 'the breaks' }) {
  const live = (ids || []).filter(Boolean);
  if (!live.length) return null;
  /*
   * READ FROM THE FIRST GAP IT OWNS. They can only disagree on a plan saved
   * before this control existed, when each gap was set on its own — and a
   * dial that refused to draw for that case would leave an old night with no
   * way to change it at all. Showing the first and writing all of them brings
   * it back into step on the first press.
   */
  const now = breakFor(plan, live[0]).phone;
  const said = PHONE_SAYS[now] || PHONE_SAYS[PHONE.PHOTOS];
  const changed = live.some((id) => plan && plan[id]);
  const el = node(`
    <button class="gap-dial ${changed ? 'is-set' : ''}" type="button"
      title="On their phones in ${esc(what)}: ${esc(said.words)}. Click to change."
      aria-label="On their phones in ${esc(what)}: ${esc(said.words)}">
      <span class="gap-dial-icon" aria-hidden="true">${said.icon}</span>
    </button>`);
  el.addEventListener('mousedown', (ev) => ev.stopPropagation());
  el.addEventListener('click', (ev) => {
    /*
     * BOTH, as the round ticks beside it already do. The tile is draggable
     * and it sits inside the tile, so without the mousedown a press on the
     * dial picks the pack up instead, and without the click stopping here the
     * tap falls through to the tile and re-picks the pack underneath.
     */
    ev.stopPropagation();
    ev.preventDefault();
    const at = PHONE_CYCLE.indexOf(now);
    onSet(live, PHONE_CYCLE[(at + 1) % PHONE_CYCLE.length]);
  });
  return el;
}

/**
 * EVERY GAP THAT HAS A BIG SCREEN TO DECIDE ABOUT — which is every one except
 * a lobby. The join code owns a lobby's screen and nothing may dim it, so
 * there is no choice to offer rather than a choice with one safe answer.
 */
export function gapsWithScreen(segments) {
  return breaksOf(segments).filter((b) => b.kind !== 'lobby').map((b) => b.id);
}

/** Which gaps belong to one part of the night. */
export function gapsOfPart(segments, at, { skipDoors = true } = {}) {
  return breaksOf(segments)
    .filter((b) => b.part === at)
    .filter((b) => !(skipDoors && b.id === 'p0:lobby'))
    .map((b) => b.id);
}

/**
 * WHICH GAPS ONE PACK CREATES — what a tile's dial actually owns.
 *
 * **A TILE IS NOT A PART, and assuming it was left half the row without a
 * dial.** Several quiz packs on an ordinary night are welded into ONE quiz by
 * `composeQuiz()`, so a two-pack night has one part — which meant tile 1's
 * dial silently owned every gap in the evening, including the ones pack 2's
 * rounds create, and tile 2 had no dial at all. Nothing threw and nothing
 * looked broken; the second tile just had an empty corner.
 *
 * A part's rounds are `order`, in order, and the gap `p{n}:r{i}` is the board
 * AFTER round `i` — so the gap belongs to whichever pack contributed that
 * round. That is exactly the promise the dial makes, and it holds however the
 * night is put together: a composed quiz, a mixed row, or a saved show.
 *
 * A bingo pack has no rounds and cannot be broken up, so the gap it owns is
 * the one BEFORE it — its own lobby.
 */
export function gapsOfPack(segments, packId, at) {
  const parts = Array.isArray(segments) ? segments : [];
  const want = String(packId || '');
  const live = new Set(breaksOf(parts).map((b) => b.id));
  const out = [];
  parts.forEach((part, n) => {
    if (part.kind === 'bingo') {
      // Its own lobby — but never the very first, which is the doors and has
      // a dial of its own in the head.
      if (String(part.packId || '') === want && n > 0) out.push(`p${n}:lobby`);
      return;
    }
    (part.order || []).forEach((round, i) => {
      if (String(round.packId || '') !== want) return;
      const id = `p${n}:r${i}`;
      // `breaksOf` has already dropped the last board of the last part — that
      // one is the final, not a gap — so asking it is how this stays true
      // without repeating the rule.
      if (live.has(id)) out.push(id);
    });
  });
  /*
   * A QUIZ PART WITH NO `order` AT ALL falls back to the part it is, which is
   * what a saved show built before the mixed row existed looks like. Better a
   * dial covering the whole part than a tile with no control on it.
   */
  if (!out.length && Number.isInteger(at)) return gapsOfPart(parts, at);
  return out;
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
