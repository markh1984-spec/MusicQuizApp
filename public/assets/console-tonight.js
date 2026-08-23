/** TONIGHT — the launch bar, what is running, and the settings for one night. */

import { breakStrip, prunePlan } from './console-breaks.js';
import { esc, node, postJson } from './client.js';
import { saidTime } from './console-diary.js';
import { tonightsVenue } from './console-gigs.js';
import { invoiceApi, openInvoiceForm, share } from './console-invoices.js';
import { doLaunch, doLaunchOrder, freshLabel, freshness, lobbyGameOptions, lookOptions, playingOptions, shapeOptions } from './console-packs.js';
import { packTitle, shelfFor } from './console-shows.js';
import {
  addBingoSlot, addQuizPackSlot, isMixed, moveRoundToSlot, segmentsFromSlots, slotsFromSimple,
} from './console-tonight-mix.js';
import { renderSlots } from './console-tonight-mix-ui.js';
import { BENCH_STORE, NIGHT_BENCH_STORE, bench, library, nightBench, packDrag, setBench, setBook, setLibrary, setNightBench, setPackDrag, setShelfRoundDrag, setShowDrag, setVenueDrag, shelfRoundDrag, showDrag, venueDrag } from './console-state.js';
import { nowNextRows } from './console-venues.js';
import { TABS, can, goTo, hostKey, keyInUrl, keyed, linkTo, load, packWord, render, renderKeepingPlace, screenLink, showDone } from './console.js';
import { clashTonight, nightKey, tonight, upcoming } from './diary.js';
import { packLookAttrs, shortTitle, isBreakoutPack } from './pack-look.js';
import { FEATURES } from './plans.js';
import { itemsOf } from './show-parts.js';

/*
 * Remembered OUTSIDE the render, because this panel is rebuilt on every
 * state push — which during a lobby is every time a phone joins. A pack
 * chosen inside the function would be thrown away by the next person to
 * type their team name.
 */
let currentPack = null;

/**
 * TONIGHT'S SETTINGS, HELD RATHER THAN READ OFF THE SCREEN.
 *
 * They used to live only as `<select>` values inside the launch bar, and the
 * launch handler read them out of the DOM at the moment it fired. That broke
 * the moment the controls moved to a tab of their own — the tab might not be
 * rendered when Launch was pressed — and they have since moved BACK onto the
 * bar, but the object stayed, because it turned out to be the better
 * arrangement regardless of where the controls live.
 *
 * **A setting that lives in one place and is read from there** cannot be lost
 * by a re-render, cannot disagree with a second copy, and is what lets a
 * saved show (`loadShow()`) write every field directly with no DOM round
 * trip at all.
 *
 * **Empty means "as it was".** A blank look is the pack's own, a blank game is
 * the default for that game type, `shape: null` leaves the pack's own card
 * shape alone, and `questionSeconds: 0` leaves the pack's own pace alone —
 * so a night launched without opening the settings at all takes exactly the
 * route it always did.
 */
export const night = {
  look: '',
  questionSeconds: 0,
  lobbyGame: '',
  lobbySound: true,
  teamPlay: false,
  shape: null,
  prizes: 0,
  /*
   * WHAT HAPPENS IN THE GAPS — `{ [breakId]: { phone, screen } }`, sparse.
   *
   * Empty means "as it was" like every other field here: every break takes
   * its default, and the defaults are what this app did before breaks
   * existed. It belongs on `night` rather than in a variable of its own for
   * the reason the comment above gives — a saved show restores these fields
   * directly, with no DOM to read them back off.
   */
  breaks: {},
};

/**
 * WHICH BREAK'S PANEL IS OPEN — module level, outside the render.
 *
 * The same reason the control view's answer panels and `lbPicked` are: this
 * bar is repainted whenever anything on the page changes, and a selection
 * stored inside the render would shut itself the moment you touched the very
 * thing you had just opened.
 */
let lbBreakOpen = '';

/*
 * IS THE WHOLE SECTION OPEN, and it is remembered on the DEVICE rather than in
 * a variable.
 *
 * The host's own sequence, and it is the reason this is not just a toggle:
 * *"I get to the venue, the launch thing is right there. I don't need it yet —
 * the venue wants me to change the prizes, so I collapse it, go to the Venues
 * tab and do my thing. Then when I am ready to launch I open it again."* So
 * the state has to survive changing TAB, which re-renders the whole page, and
 * it has to survive coming back to the console later.
 *
 * `localStorage` for the same reason the compact pack grid uses it: this is a
 * preference about how somebody works, not about this visit. Open is the
 * default, because the section exists to be the first thing you see.
 */
const TONIGHT_STORE = 'musicquiz.tonightopen';
let tonightOpen = localStorage.getItem(TONIGHT_STORE) !== '0';

/*
 * WHICH VENUE, once somebody has said.
 *
 * `null` means "nobody has chosen", which is not the same as "nowhere" — it is
 * what lets the app keep offering tonight's own answer (`tonightsVenue()`)
 * while a pick, once made, sticks through every re-render. It is deliberately
 * NOT remembered on the device like the fold state: the venue is a fact about
 * one evening, and a remembered one would file next Tuesday's night under last
 * Thursday's pub.
 */
let lbVenue = null;
let lbVenueOpen = false;

/*
 * IN THE ROOM, OR ONLINE — up in the head, beside the venue.
 *
 * It was a dropdown behind Set it up, filed with the look and the card shape,
 * and it is not the same kind of decision as those. Getting the look wrong
 * costs a night some colours; getting THIS wrong sends the question to sixty
 * phones in a pub, which breaks rule 8 in front of a paying room and cannot be
 * undone mid-question. A setting whose wrong value ruins the night belongs
 * where it is READ, not where it is hunted for.
 *
 * A two-state switch rather than a `<select>`, and that is the app's own shape
 * for "is this on" — the hat in the top right and every feature row use it, so
 * it is recognised rather than read. It is also the one control here with
 * exactly two answers; a dropdown for two answers hides one of them.
 *
 * NOT remembered on the device, the same reasoning as the venue: online is a
 * fact about one evening, and a remembered one would put a pub's question on
 * sixty phones because of a Zoom quiz three weeks ago. Off is the default and
 * off is almost every night.
 */
let lbOnline = false;

/**
 * THE EXTRA PACKS IN TONIGHT — pack ids beyond the first, or an empty list.
 *
 * The night is `currentPack` followed by these. Holding only the EXTRAS is
 * what keeps an ordinary night ordinary: one pack means this is empty, which
 * means `doLaunch` sends no running order at all and the server takes exactly
 * the route it took last week. A composed night only exists once somebody has
 * deliberately dropped a second pack in.
 *
 * Pack IDS and nothing else — no titles, no rounds, no questions. What gets
 * played is read off the packs on disk at launch, so a question corrected at
 * nine o'clock is in the night that starts at nine fifteen. Copying rounds in
 * here would be the one thing rule 11 exists to prevent: a second copy, in a
 * browser tab, going quietly stale.
 */
let lbExtra = [];

/**
 * THE MIXED ROW — `null` for every ordinary night, exactly like `lbExtra`
 * being empty. Set the moment a bingo pack joins the row or a round is split
 * apart from its siblings (`console-tonight-mix.js`'s own `slots`), and from
 * then on `paintOrder()`/Launch read THIS instead of `lbExtra`/`lbOff` — two
 * data shapes for two different nights, never bent into one. Cleared
 * wherever `lbExtra`/`lbOff` themselves are, so a night thrown away by
 * `dropPack(0)` or a fresh pack pick does not leave a stale mixed plan
 * behind for the next one.
 */
let lbSlots = null;

/**
 * WHICH PACK IN THE BAY IS BEING SET UP — an index into the row as drawn.
 *
 * Asked for directly: *"I need the packs clickable when in the bay, and when
 * you click a pack the settings for THAT PACK appear below."* So a tap on a
 * tile is a SELECTION rather than an action — nothing about the night
 * changes, the settings row underneath simply starts talking about that pack
 * instead. Deliberately not a per-tile control: the shape and prize
 * `<select>`s that used to sit inside a bingo tile clipped their own text at
 * 146px and covered the area a drag starts from.
 *
 * **OUTSIDE THE RENDER**, like `currentPack` and for the same reason: this
 * panel is rebuilt on every state push, so a selection held inside the
 * function would be thrown away by the next phone to join. It indexes the row
 * AS DRAWN — `lbSlots` in mixed mode, `lbPacks()` otherwise — and both are
 * bounds-checked on read rather than reset on every change, so a pack removed
 * from under it falls back to nothing picked instead of throwing.
 */
let lbPicked = 0;

/**
 * ROUNDS SWITCHED OFF — a Set of `packId:roundIndex`.
 *
 * The host's own design, and it replaced dragging rounds between packs:
 * *"have the rounds in the quiz pack with a green tick each, and to turn one
 * off you click the green tick and it turns into a cross — removes the need
 * to drag and drop sections of a quiz pack."*
 *
 * He is right, and the reason is bigger than tidiness. **A round-level drag is
 * a laptop-only gesture**: HTML5 drag events are never delivered on touch, so
 * that half of the feature did not exist on a phone at all — and this file's
 * own rule has the console measured at 320px. A tick is a tap, so the same
 * job now works on both, with no second way of doing it to keep in step.
 *
 * Keyed by pack AND index rather than by round title: two packs can have a
 * round called "Round one", and a title is a thing somebody renames.
 */
let lbOff = new Set();

/** Which round chip is being dragged within the strip, if any. */
let roundDrag = null;

/**
 * How many rounds one night may be built from.
 *
 * **The SERVER is the authority** — `MAX_ROUNDS` in `src/running-order.js`,
 * which refuses anything longer whatever this page thinks. This copy exists
 * only so the strip can say no before somebody drags a fourth pack in and
 * finds out at Launch, in a venue. A test asserts the two agree, because a
 * limit stated in two places is a limit that disagrees with itself within a
 * month — the same reason `plans.js` and `looks.js` are shared rather than
 * copied. They cannot be shared here: `running-order.js` imports the quiz
 * validator, which is server-only.
 */
const MAX_NIGHT_ROUNDS = 12;
/** True while the CHOSEN pack is being dragged out of the section. */
let offDrag = false;

/**
 * A SHOW WAITING TO BE PUT INTO THE BAR, applied on the next render.
 *
 * It cannot be applied where it is picked up. Everything the bar is made of —
 * the game dropdown, the pack shelf, `pick()`, the repaints — lives inside the
 * closure `launchBar()` builds, and the Shows tab is a different function
 * entirely. Handing the show over as a module-level intention and letting the
 * bar apply it while it builds itself is the same arrangement `lbExtra` and
 * `lbOff` already use, and it means there is exactly one place that knows how
 * to turn a saved night back into a bar.
 */
let showWanted = null;

/**
 * WHICH SHOW IS UP, AND WHICH PART OF IT — `{ show, at }`, or null.
 *
 * A show is an EVENING and the launch bar plays one part of it, so something
 * has to remember that the bingo follows the quiz. Held here rather than in
 * the bar's closure for the same reason `showWanted` is: it has to survive the
 * re-render that every state push causes.
 *
 * **Cleared by choosing a pack by hand**, in `pick()` — the moment somebody
 * drags a different pack in, this is not that show's evening any more, and a
 * "Then: the bingo" line left over from a show nobody is running is the
 * console describing a night that is not happening.
 */
let showRunning = null;

/**
 * A VENUE CHOSEN FROM SOMEWHERE THAT IS NOT THE BAR, applied on the next
 * render — the same arrangement `showWanted` uses, and for the same reason.
 *
 * `chooseVenue()` lives inside `launchBar()`'s closure because it needs the
 * picker, the repaints and `switchIfFree`. The Venues tab is a different
 * function, so it hands the name over as an intention rather than reaching in.
 * One way a venue is set, whichever control set it.
 */
let venueWanted = null;

/**
 * A PACK CHOSEN FROM A CARD, applied on the next render.
 *
 * Third of the same kind after `showWanted` and `venueWanted`, and the reason
 * is unchanged: `addPackToNight()` lives inside `launchBar()`'s closure, where
 * the shelf, the game dropdown and the repaints are. Handing the intention
 * over means a tap goes down exactly the road a drop goes down, rather than a
 * second implementation that can drift from it.
 */
let packWanted = null;

/**
 * A SINGLE ROUND SOMEBODY TAPPED ON THE SHELF, waiting for the bar to be
 * built — the round-sized twin of `packWanted`, and it exists for the same
 * reason: the click happens in `console-packs.js`, which cannot reach into
 * `launchBar()`'s closure, so the request is left here and picked up on the
 * re-render.
 */
let roundWanted = null;

/**
 * WHICH GAME THE BAR IS ON, remembered across renders.
 *
 * **This is a bug fix and the bug was a silent broken Launch.** The game kind
 * lived only as the value of the `<select class="lb-game">` inside the bar —
 * and `render()` rebuilds that select from scratch, so it came back on its
 * first option, which is always the quiz. Anything that re-rendered (changing
 * tab, a phone joining, any state push) therefore reset the bar to "quiz"
 * while a BINGO pack was still chosen.
 *
 * What that did is the worst shape a fault can take on this bar: `startOn()`
 * asks whether the chosen pack is still on the current shelf, the bingo pack
 * was not on the quiz shelf, so Launch was never re-bound — and the button sat
 * there enabled, gradient-filled, correctly reading **"Launch MBC 3"**, doing
 * absolutely nothing when pressed. No error, no console message, nothing to
 * see. Found by a browser agent walking the exact steps a host takes before a
 * bingo night: pick the pack, open Tonight's settings, press Launch.
 *
 * **The rule it breaks is one this file already states**: a setting that lives
 * only in the DOM is lost by a re-render. That is why `night` was moved out of
 * the launch bar's `<select>`s; this was the same fault in the one control
 * that decides which shelf everything else reads from.
 */
let lbGame = '';

/**
 * PUT ONE ROUND INTO TONIGHT — the TAP that the drag never had.
 *
 * **The drag worked and the tap did nothing, which is why it was reported as
 * "the drag and drop feature per round doesn't seem to be functional".** A
 * shelf round dot carried `mousedown`, `dragstart` and `dragend` and no
 * `click` at all — so the first thing anybody tries produced silence, and on
 * a touchscreen there was no way in whatsoever, because HTML5 drag events do
 * not fire on touch AT ALL.
 *
 * That is this repo's own rule broken in the one place it was never applied:
 * *"the taps and the arrow buttons STAY — drag is the fast way and every drag
 * has a way round it."* Every other drag on this page already had its tap.
 *
 * Same path as the drop, so the two cannot come to mean different things.
 */
export function addRoundToTonight(packId, round) {
  if (!packId) return;
  roundWanted = { packId, round: Number(round) || 0 };
  tonightOpen = true;
  localStorage.setItem(TONIGHT_STORE, '1');
  renderKeepingPlace();
}

/** Put a pack into Tonight from anywhere on the page. */
export function addToTonight(pack, kind) {
  if (!pack) return;
  packWanted = { id: pack.id, kind };
  tonightOpen = true;
  localStorage.setItem(TONIGHT_STORE, '1');
  renderKeepingPlace();
}

/**
 * THE SAME THING, HANDED OVER IN THE URL rather than called from a click on
 * this page — for a pack arriving from the WORKSHOP BENCH, which is a
 * different door and therefore a real navigation, not a re-render.
 * `addToTonight()` cannot be called directly for that: it ends in
 * `renderKeepingPlace()`, and this runs at module load, before `load()` has
 * fetched anything for the fresh page to render — the same boot-order fault
 * a night arriving in `?night=` already avoids the same way. Set the state
 * only; `launchBar()`'s own existing `if (packWanted)` check (the same one
 * `addToTonight()` feeds) picks it up on the page's first real paint.
 */
export function wantPackFromUrl(id, kind) {
  packWanted = { id, kind };
  tonightOpen = true;
  localStorage.setItem(TONIGHT_STORE, '1');
}

export function putNightOnBench(key) {
  setNightBench(key || '');
  if (nightBench) localStorage.setItem(NIGHT_BENCH_STORE, nightBench);
  else localStorage.removeItem(NIGHT_BENCH_STORE);
  renderKeepingPlace();
}

/**
 * Put a PACK on the Workshop bench, or take it off with `putOnBench(null)`.
 * Reachable by dragging a card up, or by a plain tap on one — see the tap
 * handler on `.pack-title` in `console-packs.js`.
 */
export function putOnBench(pack, kind) {
  setBench(pack ? { id: pack.id, kind } : null);
  if (bench) localStorage.setItem(BENCH_STORE, JSON.stringify(bench));
  else localStorage.removeItem(BENCH_STORE);
  renderKeepingPlace();
}

/** Choose tonight's venue from anywhere on the page. */
export function chooseVenueFromTab(name) {
  if (!name) return;
  venueWanted = String(name);
  renderKeepingPlace();
}

/**
 * Put a whole evening back into Tonight.
 *
 * Deliberately not a launch: it fills the bar in and leaves the finger on the
 * button, which is the same promise every other route into Tonight makes.
 */
export function loadShow(show) {
  /*
   * WHAT IS MISSING IS SAID HERE, NOT INSIDE THE BAR.
   *
   * `applyShow()` runs while `launchBar()` is building itself — and `render()`
   * evaluates `doneBanner()` BEFORE `launchBar()`, so a message raised in
   * there would not appear until the render after next. The check belongs on
   * this side of the render regardless: this is the moment somebody asked for
   * the night, so it is the moment to tell them a pack has gone.
   */
  /*
   * EVERY PART IS CHECKED, not just the one the bar will open with — a show
   * whose bingo has been deleted is broken even though its quiz is fine, and
   * finding that out at half ten with the quiz already finished is exactly
   * what building a night in advance is meant to prevent.
   */
  const gone = [];
  for (const item of itemsOf(show)) {
    const shelf = shelfFor(item.kind);
    const ids = (item.order && item.order.length)
      ? [...new Set(item.order.map((r) => r.packId))]
      : [String(item.packId || '')];
    for (const id of ids) if (!shelf.some((p) => p.id === id) && !gone.includes(id)) gone.push(id);
  }
  const ids = itemsOf(show).map((i) => i.packId);
  if (gone.length && gone.length === ids.length) {
    // Nothing of it is left, so the bar is not touched — emptying what was
    // already set up would be a second fault on top of the first.
    showDone('bad', `<strong>${esc(show.name)}</strong> cannot be loaded: ${
      gone.length === 1 ? `there is no pack called ${esc(gone[0])} any more`
        : 'none of its packs are on your shelf any more'}.`);
    render();
    return;
  }
  if (gone.length) {
    showDone('bad', `<strong>${esc(show.name)}</strong> is missing ${
      gone.length === 1 ? `one pack (${esc(gone[0])})` : `${gone.length} packs`
    }, so it has loaded without ${gone.length === 1 ? 'it' : 'them'}. `
      + 'Check the running order before you launch.');
  }
  showWanted = show;
  tonightOpen = true;
  localStorage.setItem(TONIGHT_STORE, '1');
  renderKeepingPlace();
}

/**
 * TONIGHT GOES STICKY WHILE SOMETHING IS BEING DRAGGED.
 *
 * The section lives at the top of the tab and a venue card can be most of a
 * page below it. HTML5 drag has no dependable auto-scroll, so without this the
 * gesture is "pick the card up, discover the target is off-screen, give up" —
 * which on a trackpad is worse again. Pinned to the top for the length of the
 * drag, the target is always where the cursor can reach it.
 *
 * **THE FIST DURING AN ACTUAL DRAG IS A BEST-EFFORT, NOT A PROMISE.** Asked
 * directly: *"when the grabby hand grabs a pack, it goes back to being a
 * regular mouse pointer?"* — yes, and that is a real browser limitation, not
 * a bug: the moment a native HTML5 drag begins (not just the mouse held
 * down), every browser takes cursor rendering away from the page and shows
 * its own default for as long as the drag lasts. `style.css`'s own
 * `:active`/`.dragging` rule still shows the fist correctly in the moment
 * BETWEEN pressing down and the drag actually starting; only the drag
 * itself cannot be styled reliably. An inline `style.cursor` on `<body>` is
 * sometimes honoured where a CSS class is not, offered to the host as
 * exactly that caveat and chosen anyway: try it, knowing it may do nothing.
 */
const DRAGGING_CURSOR = 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'32\' height=\'32\' viewBox=\'0 0 32 32\'%3E%3Cg stroke=\'%233a2a16\' stroke-width=\'1.2\' stroke-linejoin=\'round\' stroke-linecap=\'round\'%3E%3Cpath d=\'M8.8 21.2 L24.4 21.2 L27 26 Q23.53 27.9 20.07 25.7 Q16.6 27.9 13.13 25.7 Q9.67 27.9 6.2 26 Z\' fill=\'%23e6d5ad\'/%3E%3Cpath d=\'M7.4 23.1 L25.8 23.1\' stroke=\'%23b8923f\' stroke-width=\'1.15\'/%3E%3Cpath d=\'M9.6 15.2 Q6.4 15.6 6.1 18 Q5.9 20.3 8.6 20.6 L10.8 20.6 Z\' fill=\'%23eddfbc\'/%3E%3Cpath d=\'M8.8 21.2 L8.8 14.4 Q8.8 10.9 10.7 10.7 Q12.5 10.5 12.7 11.9 Q12.9 10.2 14.7 10.2 Q16.4 10.2 16.6 11.7 Q16.8 10 18.6 10.1 Q20.2 10.2 20.4 11.7 Q20.7 10.4 22.3 10.7 Q24.4 11.2 24.4 14.2 L24.4 21.2 Z\' fill=\'%23f6ecd6\'/%3E%3Cpath d=\'M12.7 12.6 L12.7 14.8 M16.6 12.4 L16.6 14.9 M20.4 12.6 L20.4 14.8\' stroke=\'%23c9b183\' stroke-width=\'0.95\' fill=\'none\'/%3E%3C/g%3E%3C/svg%3E") 16 15, grabbing';

export function dragging(on) {
  if (on) pinTonightWhereItIs();
  document.body.classList.toggle('is-dragging-card', Boolean(on));
  if (on) document.body.style.setProperty('cursor', DRAGGING_CURSOR, 'important');
  else document.body.style.removeProperty('cursor');
}

/**
 * AND IT PINS WHERE IT ALREADY IS, RATHER THAN JUMPING TO THE TOP.
 *
 * Reported from a real console with a screenshot either side of the gesture:
 * *"still acting weird when you grab a pack"* — the whole Tonight panel moved
 * about ninety pixels down the instant a card was picked up.
 *
 * The cause is what the pinning is for. Going sticky at `--topbar-h` only
 * moves an element that has ALREADY scrolled past that line — and it always
 * has, because you scroll DOWN to reach the library you are dragging from. So
 * the fix for "the target is off-screen" created "the target moves the moment
 * you aim at it", which is worse: the drop tiles slide out from under the
 * cursor at the one moment the cursor is committed to them.
 *
 * **A sticky top can be NEGATIVE, which is the whole trick.** Pinning at the
 * panel's current offset freezes it exactly where the eye last saw it — it
 * still cannot scroll away for the rest of the drag, which is all the pinning
 * was ever for, and it does not move a pixel to do it.
 *
 * Three cases and all of them fall out of one clamp:
 *
 *  - **partly scrolled under the topbar** (the common one): pin at the current
 *    offset, so nothing moves;
 *  - **fully below the topbar**: `--topbar-h` is already the smaller number, so
 *    it pins there and does not move either — sticky does nothing until you
 *    scroll;
 *  - **scrolled so far up that the drop tiles are gone**: pinning where it is
 *    would leave nothing to aim at, so it comes down just far enough to put the
 *    tiles under the topbar. That is the one case where moving is the point,
 *    and it is the case the original rule was written for.
 *
 * Measured rather than assumed, because the topbar WRAPS on a phone — a written
 * out number is a panel pinned behind the logo at 390px.
 */
function pinTonightWhereItIs() {
  const bar = document.querySelector('.launchbar');
  if (!bar) return;
  const topbar = document.querySelector('.topbar');
  const topbarH = topbar ? topbar.getBoundingClientRect().height : 56;
  const barTop = bar.getBoundingClientRect().top;

  /*
   * The drop tiles are the thing that has to stay reachable; the venue row and
   * the describer line above them are worth losing to keep them.
   *
   * **ENOUGH OF THE ROW, NOT ALL OF IT** — and the first version asked for all
   * of it, which measured as a 13px shift at 1280 and 33px at 390. Insisting
   * the tiles be fully clear of the topbar makes the safe zone narrower than
   * the scroll somebody actually does to reach their library, so the panel
   * still twitched on the common gesture. A tile is 76px tall and 44 of them
   * is a target nobody misses, so the top of the row is allowed to slide under
   * the bar and the panel holds still across the whole range that matters.
   */
  const tiles = bar.querySelector('.lb-tiles');
  let floor = topbarH;
  if (tiles) {
    const box = tiles.getBoundingClientRect();
    // Never more than the row is tall — on a phone a tile is 58px, and an
    // allowance bigger than the thing it is measuring would let the whole row
    // disappear.
    const mayHide = Math.max(0, box.height - Math.min(KEEP_OF_DROP_ROW, box.height));
    floor = topbarH - (box.top - barTop) - mayHide;
  }

  bar.style.setProperty('--lb-pin', `${Math.max(Math.min(barTop, topbarH), floor)}px`);
}

/** How much of the drop row has to stay under the topbar — see above. */
const KEEP_OF_DROP_ROW = 44;

/*
 * A DRAG THAT ENDS ANYWHERE AT ALL UN-PINS TONIGHT.
 *
 * `dragging(false)` is called by each drop handler, which is right when a drop
 * lands somewhere we own — and does nothing for a drag abandoned over the
 * page, dropped on the browser chrome, or cancelled with Escape. The panel
 * then stayed pinned and overlapping the page underneath it, which is half of
 * what the post-drag screenshot showed.
 *
 * `dragend` always fires on the source, whatever happened to the drop, so it
 * is the one event that can promise this. Once, on the window, rather than per
 * card: the cards are rebuilt on every render and a listener each would be a
 * new one every time anybody joined.
 */
window.addEventListener('dragend', () => {
  dragging(false);
  setPackDrag(null);
  setShelfRoundDrag(null);
  setVenueDrag(null);
});

export function launchBar() {
  // An owner runs no nights, so there is nothing here for them — same reason
  // the running panel hides itself.
  if (!can(FEATURES.QUIZ) && !can(FEATURES.BINGO)) return node('<div></div>');

  // Only the games this account can actually run, so the dropdown never offers
  // something that would be refused. It is a dropdown rather than two boxes
  // because a third game is a matter of time — see LAUNCHERS in session.js.
  const games = TABS
    .filter((t) => t.packs && t.needs && can(t.needs))
    .map((t) => ({ id: t.id, label: t.label, packs: (t.packs() || []).filter((p) => !p.locked && !p.broken) }))
    .filter((g) => g.packs.length);
  if (!games.length) return node('<div></div>');

  const el = node(`
    <div class="panel launchbar">
      <div class="lb-head">
        <!-- WHERE, at the top, because it decides the prizes, the voucher and
             what the night is filed under — and it used to be visible only on
             a button label. -->
        <!-- ONE CELL, both facts. They are two spans in a single grid child
             rather than two children, or the grid has four items in three
             columns the moment the shut line appears and the way back in
             drops onto a row of its own. -->
        <div class="lb-what">
          <!-- THE VENUE IS THE CONTROL, not a caption. It decides the prizes,
               the voucher and what the night is filed under, so it belongs at
               the top where it is read — and it has to be changeable there,
               because covering somebody else's night is a thirty-second job
               that used to mean opening Set it up and hunting a dropdown. -->
          <button class="lb-where" type="button" aria-expanded="false"></button>
          <!-- SHUT, IT IS STILL A SENTENCE. A collapsed panel that says only
               "Tonight" makes you open it to find out what it is set to,
               which is the tap this is meant to save. -->
          <span class="tiny lb-shut-what" hidden></span>
        </div>
        <!-- SAVE SITS UP HERE, BESIDE THE VENUE — asked for directly: *"save
             button also needs to be next to the venue so its obvious what
             that is for"*. It was floating between the tiles and Launch with
             a note nobody could parse, in the one strip of the bar that
             belongs to no question at all.

             THIS ROW IS THE NIGHT ITSELF — where it is, whether it is in a
             room or online, and whether the panel is open. Keeping a night is
             the fourth question of that kind, and this is the only row that
             had space for it.

             **AND THE LABEL HAS TO OUTRANK THE ADJACENCY**, because the venue
             is the one thing a saved night deliberately does NOT keep: a show
             is a template, and a stale pub on it is somebody refused a drink.
             Sat next to the venue picker, "Save" alone would say the opposite
             of what it does — so the words stay "for another night", which is
             the fact that matters, and the tooltip says the rest. -->
        <div class="set-keep">
          <button class="minor set-save" type="button"
            title="Keeps the packs and every setting on this bar — but never the venue, so you can run the same night anywhere">Save for another night</button>
        </div>
        <!-- WHERE THEY ARE, beside the fold rather than on a row of its own.
             Two pills at the right-hand end: what kind of night it is, and
             whether the panel is open. Moved there on the host's own reading
             — on its own line it was a third row in a bar that is meant to be
             glanceable, and it is one of the two facts that place a night, so
             it belongs beside the other one rather than under it.
             "Venue" rather than "In the room": the word matches the control
             directly to its left, which names the venue, so the pair reads as
             one question with two answers. -->
        <div class="lb-right">
          <div class="lb-mode">
            <span class="hat-switch lb-mode-switch" data-on="0">
              <button class="hat-half live" type="button" data-online="0">Venue</button>
              <button class="hat-half" type="button" data-online="1">Online</button>
            </span>
          </div>
          <button class="lb-fold" type="button" aria-expanded="true">
            <span class="lb-fold-word"></span>
          </button>
        </div>
      </div>
      <!-- SEARCHABLE, because a quizmaster with fifteen residencies scrolling a
           dropdown in a dark pub is the thing this replaces. It draws from the
           Venues tab and from where you have actually played, and it keeps the
           way out for a pub that is not on either list — that is the promise a
           night's free-text venue was built on. -->
      <div class="lb-venues" hidden>
        <input class="lb-venue-search" type="search" autocomplete="off" placeholder="Search your venues…">
        <div class="lb-venue-list"></div>
        <div class="lb-venue-foot">
          <button class="minor lb-venue-other" type="button">Somewhere else…</button>
          <!-- THROUGH THE WORKSHOP DOOR, because that is where the add form
               is now: the Console's Venues tab is a shelf you drag off, and
               a link to a form that is not there is worse than no link. -->
          <a class="minor lb-venue-add" href="?door=workshop&amp;tab=venues${
  keyInUrl ? `&amp;key=${encodeURIComponent(keyInUrl)}` : ''}">Add a venue</a>
        </div>
      </div>
      <!-- WHAT IS ACTUALLY ON THE PROJECTOR, which is a different question
           from what the box is set to. Reported from a real night: the two
           disagreed and nothing said which was which.
           A STOP SITS BESIDE IT — asked for directly, off a screenshot of this
           exact line. It reads the projector's own state (aNightIsOn), not
           whether the box happens to have a title in it, and it is the SAME
           call as the running panel's own Stop button, through the one shared
           stopRunningNight() — never a second copy of that confirm wording. -->
      <div class="lb-live-row" hidden>
        <span class="tiny lb-live"></span>
        <!-- UNLAUNCH, AND IT SITS AGAINST THE SENTENCE IT UNDOES — reported
             off a screenshot: it said "Stop" and sat at the far right of the
             bar, an inch of empty space away from the line naming what it
             would stop. At that distance it reads as a control over the whole
             panel, which is the one thing it must not be mistaken for on a
             gig night. "Unlaunch" because it is the exact opposite of the
             button underneath it, and a word somebody can pair with Launch
             without being told. -->
        <button class="minor danger lb-unlaunch" type="button"
          title="Take it off the big screen and go back to waiting">Unlaunch</button>
      </div>
      <!-- WHAT COMES AFTER THIS, when a show with more than one part is up.
           A show is an EVENING and the bar plays one part of it, so without
           this line the second half exists only in somebody's memory — which
           is the thing building a night in advance is meant to replace.
           A button that LOADS rather than launches: the bingo starts when the
           quiz has finished and the prizes are handed out, and only the person
           on the mic knows when that is. -->
      <div class="lb-then" hidden>
        <span class="tiny lb-then-what"></span>
        <button class="minor lb-then-go" type="button">Load it</button>
      </div>
      <!-- THE PICKER IS BEHIND THE DROP ZONE NOW, not standing in front of it.
           The bar used to open with a game dropdown, a search box and a pack
           already chosen for you — three controls answering a question that
           dragging a pack up answers in one gesture. It is still here because
           HTML5 drag does not fire on touch AT ALL, so a drag-only bar is a
           dead panel on a phone: tapping the dotted cutout opens this. -->
      <div class="lb-find" hidden>
        ${games.length > 1 ? `<select class="lb-game">
          ${games.map((g) => `<option value="${esc(g.id)}">${esc(g.label)}</option>`).join('')}
        </select>` : ''}
        <div class="lb-search">
          <input class="lb-text" type="search" autocomplete="off" placeholder="Start typing a pack name…">
          <div class="lb-hits" hidden></div>
        </div>
      </div>
      <div class="tiny lb-why" hidden></div>
      <!-- THE TWO SMALL BUTTONS SHARE A ROW. Launch keeps the full width
           under them: it is the one "press this" on the section, and a
           primary button squeezed in beside two minor ones stops looking
           like one. -->
      <!-- THE RUNNER-UP PACK. "Set it up" used to share this row and then
           moved to its own tab; the settings are back on the bar itself now
           (see .lb-set below), so what is left here is one chip answering
           "not this one". -->
      <div class="lb-row">
        <div class="lb-alt" hidden></div>
      </div>
      <!-- THE WHOLE NIGHT'S OWN SETTINGS, ABOVE THE PACKS — asked for
           directly: *"settings that only apply to the night as a whole can
           sit above the packs and the pack specific settings can be
           below?"* Yes, and the split is what makes the second half
           possible at all: once one row means "this evening" and the other
           means "this pack", a pack-specific control has somewhere honest
           to live and does not have to be crammed into a 146px tile.

           Everything here is true of the evening whichever packs are in
           it, so it never changes when a pack is picked: the look, what
           phones do in the lobby, whether that makes noise, and whether a
           team shares a phone. Seconds per question is here rather than
           below because the LAUNCH only carries one — doLaunchOrder()
           sends it once for the whole running order, so a per-pack control
           would promise something the server cannot keep. -->
      <div class="lb-set lb-set-night">
        <label class="pack-shape">Look
          <select class="look-pick"></select>
        </label>
        <label class="pack-shape" title="Blank leaves each quiz at its own pace.">Seconds per question
          <input type="number" class="seconds-pick" min="5" max="120" placeholder="20">
        </label>
        <label class="pack-shape pack-shape-wide">While they wait
          <select class="game-pick"></select>
        </label>
        <label class="pack-shape">Game sound
          <select class="sound-pick">
            <option value="on">On</option>
            <option value="off">Off</option>
          </select>
        </label>
        <label class="pack-shape">Playing
          <select class="play-pick">${playingOptions()}</select>
        </label>
      </div>
      <!-- TONIGHT'S RUNNING ORDER — the place packs are dropped and where
           they appear, asked for in those words. Along the bottom rather than
           off to the right: this bar is already three stacked rows and a
           fourth column would make the one "press this" on the section share
           its line with a list. It sits directly ABOVE Launch because it is
           what Launch is about to run. -->
      <div class="lb-order" hidden></div>
      <div class="lb-chosen" hidden></div>
      <!-- AND THE PICKED PACK'S OWN, DIRECTLY UNDER IT — the other half of
           the same request: *"I need the packs clickable when in the bay,
           and when you click a pack the settings for THAT PACK appear
           below."*

           **THIS REPLACES THE CONTROLS THAT USED TO LIVE INSIDE THE TILE.**
           A bingo tile carried its own shape and prize dropdowns, two
           native selects inside a 146px square — they clipped their own
           option text mid-word ("2 — a line, t"), they covered the half of
           the tile a drag needs to start from, and there was no room for a
           third if one were ever added. One row underneath is the same
           controls with room to read, and it scales: a fourth pack-specific
           setting costs nothing here and had nowhere to go before.

           It names WHICH pack it is setting, because with six tiles above
           it an unlabelled row is a row you have to remember the context
           of. Present and inert with nothing picked, like Launch. -->
      <div class="lb-set lb-set-pack">
        <span class="tiny lb-set-for"></span>
        <label class="pack-shape lb-set-card">Card
          <select class="shape-pick" disabled></select>
        </label>
        <label class="pack-shape lb-set-prizes">Prizes
          <select class="prize-pick" disabled></select>
        </label>
      </div>
      <!-- KEEP THE WHOLE EVENING — the way a saved night is built, and it
           is deliberately not a second composer. Everything it holds is
           already on this bar: the packs, which rounds are on, the look,
           the lobby game, the prizes — but NOT the venue, which is the one
           field never true twice (see tonightAsShow). Building it again in the
           Workshop would be a second surface that could disagree with the
           launch, on the one thing that must not — so it is made by
           setting a night up here and keeping it, and the "Prepare a
           night" tab (still "show"/"shows" in the code and the data
           underneath — a display rename only, see console.js) is where
           you take one back off the shelf. -->
      <!-- THE LABEL ANSWERS THE QUESTION — "Keep this ready" was asked about
           twice ("what does keep this ready mean?"), which is this file's own
           rule failing out loud: a control that needs explaining is the wrong
           control. A tooltip was tried first and did not fix it, because a
           tooltip is not read at a glance and is not there at all on a phone.
           It says what it DOES now, and names where it goes. -->
      <!-- LAUNCH IS ALWAYS HERE, hollow until there is something to launch.
           It used to be created and destroyed with the chosen pack, so the
           bar changed height the moment anything was dragged in or out and
           everything below it jumped — reported as clunky, and it is the same
           fault as a row that reflows under your hand. Hollow it also says
           what it is waiting for, which an absent button cannot. -->
      <button class="go lb-go" type="button" disabled>Drag a pack in to launch</button>
    </div>`);

  const gamePick = el.querySelector('.lb-game');
  const text = el.querySelector('.lb-text');
  const hits = el.querySelector('.lb-hits');
  const alt = el.querySelector('.lb-alt');
  const whyEl = el.querySelector('.lb-why');
  const where = el.querySelector('.lb-where');
  const venues = el.querySelector('.lb-venues');
  const venueList = el.querySelector('.lb-venue-list');
  const venueSearch = el.querySelector('.lb-venue-search');
  const liveRow = el.querySelector('.lb-live-row');
  const liveEl = el.querySelector('.lb-live');
  const unlaunchBtn = el.querySelector('.lb-unlaunch');
  const shapePick = el.querySelector('.shape-pick');
  const prizePick = el.querySelector('.prize-pick');
  const cardRow = el.querySelector('.lb-set-card');
  const prizesRow = el.querySelector('.lb-set-prizes');
  const packSetRow = el.querySelector('.lb-set-pack');
  const setForEl = el.querySelector('.lb-set-for');
  const lookPick = el.querySelector('.look-pick');
  const secondsPick = el.querySelector('.seconds-pick');
  const lobbyGamePick = el.querySelector('.game-pick');
  const soundPick = el.querySelector('.sound-pick');
  const playPick = el.querySelector('.play-pick');
  const setSave = el.querySelector('.set-save');
  const thenEl = el.querySelector('.lb-then');
  /**
   * THEN: the next part of tonight's show.
   *
   * Hidden whenever there is nothing after this one, which is every ordinary
   * night — a pack dragged in by hand has no show behind it, so the line does
   * not exist rather than saying "nothing next".
   */
  function paintThen() {
    const items = showRunning ? itemsOf(showRunning.show) : [];
    const next = items[(showRunning ? showRunning.at : 0) + 1];
    thenEl.hidden = !next;
    if (!next) return;
    thenEl.querySelector('.lb-then-what').textContent
      = `Then: ${packTitle(next.kind, next.packId)}`;
  }
  el.querySelector('.lb-then-go').addEventListener('click', () => {
    if (!showRunning) return;
    applyShow(showRunning.show, showRunning.at + 1);
    paintThen();
    paintOrder();
    startOn();
  });
  // Called through an arrow rather than passed directly: both of these are
  // `const`s declared further down, so handing the function over here reads
  // them before they exist. By the time anybody clicks, they do.
  where.addEventListener('click', () => toggleVenues());
  venueSearch.addEventListener('input', () => paintVenueList());
  /*
   * SOMEWHERE ELSE, kept — a one-off venue must not need a record made for it
   * first, which is the promise the night's free-text venue was built on. It
   * asks rather than swapping in a box, because this picker is a sheet you are
   * already inside and a prompt is one tap where a fourth control is furniture.
   */
  el.querySelector('.lb-venue-other').addEventListener('click', () => {
    const typed = prompt('Where are you tonight?', venueNow() || '');
    if (typed === null) return;
    chooseVenue(typed.trim());
  });
  const fold = el.querySelector('.lb-fold');
  const shutWhat = el.querySelector('.lb-shut-what');
  const modeRow = el.querySelector('.lb-mode');
  const modeSwitch = modeRow.querySelector('.lb-mode-switch');
  /*
   * ONLINE SAYS WHAT IT WILL DO; the room says nothing.
   *
   * The whole risk here is switching it on by accident and putting the
   * question on sixty phones in a pub, so the ON side states the consequence
   * in the words that matter — and the OFF side, which is almost every night,
   * stays silent rather than explaining the normal case back to somebody.
   */
  function paintMode() {
    modeSwitch.dataset.on = lbOnline ? '1' : '0';
    for (const half of modeSwitch.querySelectorAll('.hat-half')) {
      half.classList.toggle('live', (half.dataset.online === '1') === lbOnline);
    }
  }
  for (const half of modeSwitch.querySelectorAll('.hat-half')) {
    half.addEventListener('click', () => {
      const want = half.dataset.online === '1';
      if (want === lbOnline) return;
      lbOnline = want;
      paintMode();
      paintFold();
    });
  }
  const chosen = el.querySelector('.lb-chosen');
  /*
   * RESTORE THE REMEMBERED GAME BEFORE ANYTHING READS THE SHELF — see
   * `lbGame`. Without this the select comes back on its first option after
   * every render and a bingo night quietly loses its Launch.
   */
  if (gamePick && lbGame && games.some((g) => g.id === lbGame)) gamePick.value = lbGame;
  const gameOf = () => games.find((g) => g.id === (gamePick ? gamePick.value : games[0].id)) || games[0];

  /*
   * TWO PACKS AND NO TYPING, for the quizmaster who is late.
   *
   * A search box does nothing until you type, and somebody walking in with the
   * room already sitting down does not want to type — they want to see the
   * thing and hit it. So the empty state of this panel is up to two packs
   * ready to go, and it disappears the moment you start typing, because at
   * that point you are browsing and they are in the way.
   *
   * A PRIORITY LIST RATHER THAN TWO FIXED SLOTS, and that is the bit that
   * matters: topical packs are what GOLD is, so a Bronze or Silver quizmaster
   * has none at all and a "this month's" slot would be permanently empty for
   * most of the ladder. Filling two slots from an order degrades on its own —
   * Gold gets the dated one and a fresh one, everybody else gets two fresh
   * ones, and nobody sees a gap where a feature they do not hold would be.
   *
   * NO SETTINGS ON THESE BUTTONS. Look, card shape and prizes are what the
   * pack card is for; a dropdown on the panic control defeats the panic
   * control. It launches on the pack's own defaults.
   */
  function quickPicks(packs) {
    const out = [];
    /*
     * 1. The dated one, soonest to expire — because it is the only pack on the
     *    shelf that is worth LESS tomorrow. An expired one is never offered
     *    here: a "week that just went past" quiz run three months late is the
     *    exact hazard `freshUntil` exists to flag, and doing it by accident on
     *    the fast path is the worst possible way to do it. It stays in the
     *    library with its warning, where launching it is a decision.
     */
    const dated = packs
      .filter((p) => { const f = freshness(p); return f.topical && !f.expired; })
      .sort((a, b) => freshness(a).until - freshness(b).until);
    if (dated[0]) out.push({ pack: dated[0], why: freshLabel(dated[0]) });

    /*
     * 2. The one THIS ROOM is least likely to have heard — never played here
     *    first, then longest ago here.
     *
     * **It used to be the diary at large**, and the comment here admitted
     * why: *"the app cannot know which venue tonight is (a night does not
     * carry one yet), so 'not played recently' is the closest honest answer
     * to 'will not be a repeat'."* A night carries a venue now, so the real
     * question is answerable — see `heardHere()`. With no venue picked it
     * still falls back to exactly the old behaviour.
     */
    const rest = packs
      .filter((p) => !out.some((o) => o.pack.id === p.id))
      .filter((p) => !freshness(p).expired)
      .sort((a, b) => heardHere(a) - heardHere(b));
    for (const p of rest) {
      if (out.length >= 2) break;
      out.push({ pack: p, why: whyFresh(p) });
    }
    return out;
  }

  /*
   * WHOSE NIGHT IT IS, said at the top of the section.
   *
   * `tonightsVenue()` is the same answer the venue picker inside the settings
   * starts on, from the same function — so the line at the top and the box
   * that decides it can never disagree. It says when there is NO answer as
   * well, because a night filed under nothing plays for no prizes and hands
   * out no vouchers, and an app that says nothing looks exactly like an app
   * that is working.
   */
  /** Where tonight is: what somebody chose, or the app's own best answer. */
  // The shared one — see `venueTonight()`. The bar and the pack shelf must
  // agree about where tonight is, or they rank on two different venues.
  const venueNow = () => venueTonight();

  /*
   * WHAT THIS VENUE PUTS UP, under the picker and not inside Set it up.
   *
   * It moved with the venue it describes: a prize line three taps away from
   * the name it belongs to is a line nobody reads, and the whole reason it
   * exists is that the first real night ended with no voucher and nothing on
   * screen having said so.
   */

  const paintWhere = () => {
    const chosenName = lbVenue !== null ? lbVenue : '';
    if (chosenName) {
      // Somebody has said where they are, so the app stops explaining itself.
      where.textContent = chosenName;
      where.classList.remove('lb-warn');
      return;
    }
    if (lbVenue === '') {
      where.textContent = 'Nowhere in particular';
      where.classList.remove('lb-warn');
      return;
    }
    const v = tonightsVenue();
    if (v) {
      /*
       * THE NAME, WITHOUT THE REASON. It read "The Station Tap, Wokingham —
       * where you played last", which is the app explaining its own working
       * on the line somebody is trying to read a venue off. The reason
       * mattered when this was a guess you had to audit; it is a starting
       * point you change in one tap, and the tail made a long pub name longer
       * than the bar.
       */
      where.textContent = v.name;
      where.classList.remove('lb-warn');
      return;
    }
    /*
     * TWO ANSWERS FOR ONE NIGHT ARE SAID OUT LOUD, not left as a blank.
     *
     * Two venues can both claim tonight — two residencies on a Thursday, or
     * two dates typed into the diary — and there is nothing here that could
     * tell them apart, so nothing is chosen. That much is right. What was
     * wrong is that it looked identical to having no venues at all, on the one
     * field that decides the prizes, the voucher and what the night is filed
     * under. Naming both is what turns it into a decision somebody can make in
     * one tap.
     */
    const clash = clashTonight({
      venues: library.venueRecords || [],
      bookings: library.bookings || [],
    });
    where.classList.toggle('lb-warn', clash.length > 1);
    where.textContent = clash.length > 1
      ? `${clash.join(' and ')} both claim tonight — pick one`
      : 'No venue — pick one';
  };

  /*
   * THE PICKER. Venues you have SET UP and venues you have PLAYED, in one
   * list — a venue added on the Venues tab has hosted nothing yet, and one
   * played before venues existed was never added, so either list alone leaves
   * somebody hunting for a pub they know is there.
   */
  const paintVenueList = () => {
    const q = (venueSearch.value || '').trim().toLowerCase();
    const setUp = (library.venueRecords || []).map((v) => v.name);
    const played = library.venues || [];
    const seen = [];
    for (const name of [...setUp, ...played]) {
      const clean = String(name || '').trim();
      if (!clean || seen.some((n) => n.toLowerCase() === clean.toLowerCase())) continue;
      seen.push(clean);
    }
    const list = q ? seen.filter((n) => n.toLowerCase().includes(q)) : seen;
    venueList.replaceChildren(...(list.length ? list.map((name) => {
      const row = node(`<button class="lb-venue-hit" type="button">${esc(name)}</button>`);
      row.addEventListener('click', () => chooseVenue(name));
      return row;
    }) : [node(`<div class="tiny">${seen.length
      ? `Nothing matches “${esc(venueSearch.value.trim())}”.`
      : `No venues yet — add one on ${goTo('workshop', 'venues', 'the Venues tab')}.`}</div>`)]));
  };

  /*
   * CHANGING THE VENUE RE-RESOLVES A NIGHT THAT IS UP BUT EMPTY.
   *
   * The fault this closes was introduced the moment picking a pack started
   * launching it, and it is silent — which is what makes it worth the code.
   * The prizes, the voucher and the come-back slide are read off the venue AT
   * LAUNCH and copied into the game state, exactly like the look and the card
   * shape. So the sequence somebody would actually use — drag the pack in,
   * notice the venue is last week's, drag the right one in — launched the
   * night under the wrong pub and then left it there. The bar said The Dog &
   * Duck; the winner's phone would have shown the Sheep & Hound's voucher.
   *
   * Fixing it forwards rather than blocking the launch: relaunch quietly, so
   * the running night picks the venue's own prizes up. Safe for exactly the
   * same reason the auto-launch is — `switchIfFree` goes through the server's
   * ordinary guard, so the instant a single team has joined this does nothing
   * at all and the choice simply applies to the next launch.
   *
   * Only when the pack is unchanged and already up. If nothing is running
   * there is nothing to re-resolve, and Launch will read the new venue anyway.
   */
  function chooseVenue(name) {
    lbVenue = String(name || '');
    lbVenueOpen = false;
    venues.hidden = true;
    where.setAttribute('aria-expanded', 'false');
    paintWhere();
    /*
     * AND THE LINE UNDER THE TILES, which reads the venue too — its prizes,
     * whether tonight is its usual night, what time it starts. It was never
     * repainted here, so picking a venue updated the button and left that
     * line describing the one before it; caught live, with the picker
     * reading "The Station Tap" over a line still saying "No venue yet".
     *
     * Latent before and load-bearing now: that line is the ONLY place those
     * facts appear, since the venue there stopped being a second picker of
     * its own. `paintOrder()` is what rebuilds it — see `infoLine()`.
     */
    paintOrder();
    const running = (library && library.running) || {};
    if (currentPack && running.packId === currentPack.id) {
      switchIfFree(currentPack, gameOf().id);
    }
    /*
     * AND THE SHELF BELOW, which is now RANKED on this answer.
     *
     * `heardHere()` asks what THIS venue has already been played, so changing
     * the venue changes which six packs are on display and what each of their
     * lines says. Repainting the bar alone left a grid ordered for the pub
     * before it — and silently: nothing throws, every card is real, and the
     * only tell is a pack you ran here last week sitting at the front.
     *
     * A whole render rather than a repaint because the grid is built by
     * `console-packs.js`, not by anything in this closure — the same call
     * `chooseVenueFromTab()` has always made for the same reason. The scroll
     * is held (`renderKeepingPlace`), and the picker has already shut, so
     * there is nothing on screen to lose.
     */
    renderKeepingPlace();
  }

  const toggleVenues = () => {
    lbVenueOpen = !lbVenueOpen;
    venues.hidden = !lbVenueOpen;
    where.setAttribute('aria-expanded', lbVenueOpen ? 'true' : 'false');
    if (lbVenueOpen) { paintVenueList(); venueSearch.focus(); }
  };

  /*
   * THE OTHER PACK WORTH OFFERING, as a chip rather than a second big button.
   *
   * There used to be two shortcut cards, both wearing the account's gradient,
   * which is two "press this" buttons on one screen — and the second one was
   * never the one you wanted more than half the time. The first pick is
   * already in the box; this is the runner-up, one tap away, and it looks like
   * what it is.
   */
  const paintAlt = () => {
    /*
     * "Typing" cannot be "the box has something in it" any more — the box
     * ARRIVES holding tonight's pack. It means the box no longer says what is
     * chosen, which is the moment somebody is browsing and a suggestion is in
     * the way.
     */
    const typed = text.value.trim();
    const browsing = Boolean(typed) && typed !== (currentPack && currentPack.title);
    const picks = quickPicks(gameOf().packs);
    const second = picks[1];
    const showing = !browsing && second && second.pack.id !== (currentPack && currentPack.id);
    alt.hidden = !showing;
    alt.replaceChildren(...(showing ? [(() => {
      const chip = node(`<button class="minor lb-alt-go" type="button">or ${esc(second.pack.title)}</button>`);
      chip.addEventListener('click', () => pick(second.pack));
      return chip;
    })()] : []));
  };

  /*
   * Matches on the TITLE only, unlike the pack-tab search which looks inside
   * the questions. Different job: that one is "find me a pack with Madonna in
   * it", this one is "I know what it is called, get me there". Searching the
   * contents here would put four packs under "198" because one of them has a
   * question about 1984.
   */
  const paintHits = () => {
    const q = text.value.trim().toLowerCase();
    const list = q ? gameOf().packs.filter((p) => (p.title || '').toLowerCase().includes(q)).slice(0, 6) : [];
    hits.hidden = !list.length;
    hits.replaceChildren(...list.map((p) => {
      const row = node(`<button class="lb-hit" type="button">${esc(p.title)}</button>`);
      row.addEventListener('click', () => pick(p));
      return row;
    }));
  };

  /*
   * WHICH PACK IS CHOSEN, remembered outside the render.
   *
   * Module-level for the same reason `openPack` is: this panel is rebuilt on
   * every state push, and a choice stored inside the function would be thrown
   * away the moment a phone joined.
   */
  /*
   * PICKING A PACK PUTS IT ON THE BIG SCREEN — when nothing would be lost.
   *
   * The host's own complaint, from a real night: *"the quiz in the launch bit
   * after I pressed launch didn't say what the big screen said"*, and then the
   * conclusion — *"changing quiz packs should change the console and the big
   * screen."* He is right that the two disagreeing is the fault. The console
   * and the projector should agree every time it is possible for them to.
   *
   * **BUT PICKING IS NOT LAUNCHING WHEN THERE IS A NIGHT TO LOSE.** A tap on
   * a search result that silently ends a running quiz and wipes every score
   * would be the most dangerous control in the app, on the protected path, in
   * a dark pub. So the rule is: switch instantly when it costs nothing, stage
   * it when it would cost somebody their night.
   *
   * **THE SERVER DECIDES WHICH, NOT THIS PAGE.** It is the ordinary launch
   * call without `replace` — which already answers 409 when a night is in
   * progress, with the game and the player count in it, and that guard is the
   * one this codebase has already learned cannot live in the browser. So
   * there is no new rule here and no second definition of "in progress" to
   * drift: a 200 means it was free to switch, a 409 means it was not.
   *
   * **A 409 is SILENT here** — no dialog. Pressing Launch is what asks that
   * question, and it still does, with the same warning it always gave. All a
   * 409 means at this point is that the choice stays staged and the red line
   * under the box tells you the projector is showing something else, which is
   * exactly the state that line exists for.
   *
   * Nothing is set up on a quiet switch — no look, no card shape, no prizes,
   * no venue. It is the pack going up on an idle projector, and everything
   * else is what the settings row and Launch are for.
   */
  async function switchIfFree(pack, kind) {
    try {
      await postJson('/api/host/launch',
        { game: kind, packId: pack.id, venue: venueNow(), online: lbOnline },
        { 'X-Host-Key': hostKey });
      /*
       * It went up. Ask the SERVER what is running rather than assuming it
       * worked — the line under this box exists precisely because the console
       * and the projector can disagree, so filling it in from our own
       * optimism would be the original fault wearing a new hat.
       */
      const res = await fetch(keyed('/api/library'));
      if (res.ok) setLibrary(await res.json());
      paintLive();
    } catch {
      // 409 (a night is running) or anything else: the choice stays staged and
      // paintLive says so. Never a dialog — Launch is where that is asked.
      paintLive();
    }
  }

  function pick(pack, { quiet = false, keepOrder = false } = {}) {
    const switching = !quiet && currentPack?.id !== pack.id;
    /*
     * CHOOSING A DIFFERENT PACK STARTS THE NIGHT AGAIN.
     *
     * Picking one out of the box or dropping it on the bar is somebody saying
     * "we are playing THIS" — so a running order built round the last pack has
     * to go, or you would launch a night whose name says one thing and whose
     * rounds are mostly another. Adding to an order is the strip's job and it
     * is a different gesture, which is the whole reason the two are split.
     *
     * **UNLESS `keepOrder` SAYS THIS IS A REORDER, NOT A NEW PICK.**
     * `movePack()` promotes a different pack to slot 1 by calling this — the
     * SAME pack identity change this block exists to catch, for a reason
     * this block must not act on. It had already computed the reordered
     * `lbExtra` itself; without `keepOrder` this silently overwrote it with
     * `[]`, so dragging pack A to sit after pack B deleted A outright. Found
     * live: two packs in, drag one past the other, one pack left.
     */
    if (!keepOrder && currentPack && currentPack.id !== pack.id) {
      lbExtra = [];
      lbOff = new Set();
      lbSlots = null;
      /*
       * AND IT IS NOT THAT SHOW'S EVENING ANY MORE. Choosing a different pack
       * by hand is somebody saying "we are playing THIS", so a "Then: the
       * bingo" line left over from a show nobody is running would be the
       * console describing a night that is not happening — the same fault as
       * the bar naming a different quiz from the projector.
       */
      showRunning = null;
    }
    currentPack = pack;
    text.value = pack.title;
    /*
     * WHY THIS ONE, kept from the shortcut buttons it replaces. "Never played"
     * and "Last played in March" are what make an offered pack trustworthy —
     * without it the box just asserts a title and you have to go and check
     * whether the room heard it a fortnight ago.
     */
    if (liveEl) paintLive();
    const why = (quickPicks(gameOf().packs).find((q) => q.pack.id === pack.id) || {}).why
      || whyFresh(pack);
    whyEl.textContent = why;
    hits.hidden = true;
    const kind = gameOf().id;
    const bingo = kind === 'bingo';
    chosen.hidden = false;
    // ONE root element. `node()` returns the first child, so a template with a
    // sibling after it silently loses the sibling — which here was the Launch
    // button, the only thing on the panel that does anything.
    /*
     * `chosen` USED TO HOLD A FOLD OF SETTINGS ("Set it up"), which moved to
     * its own tab and has since moved AGAIN — onto the bar itself, as the
     * always-visible `.lb-set` row rather than a fold anybody had to open.
     * *"Not sure what the point of the Set it up bit on the console is"* was
     * the report that started that history: the point was never the
     * settings, it was them hanging off a control that came and went with
     * whether a pack was chosen. `chosen` itself is now empty — nothing left
     * needs a place to fold into — and is kept only because other code still
     * toggles its `hidden` attribute.
     */
    chosen.replaceChildren(node('<div></div>'));

    /*
     * SET IT UP is shut by default and REMEMBERED once opened.
     *
     * Shut, because the common job is "this pack, this pub, go" and a wall of
     * dropdowns in front of it is the panic control defeating itself. Open, it
     * stays open — a quizmaster setting up a bingo night touches three of
     * these in a row, and this panel is rebuilt every time somebody joins.
     */
    // The toggle lives in the row above and outlives this render; only the
    // panel it opens is rebuilt here, so it is re-pointed rather than rewired.
    // It is never hidden — see the comment on `.lb-row` — only switched on.

    // The same prize list the pack card builds, from the shape actually picked.


    goBtn.onclick = async (ev) => {
      const button = ev.currentTarget;
      /*
       * THE BIG SCREEN OPENS ON THE PRESS, and it has to happen HERE.
       *
       * Launching and then walking to the laptop to open the projector by hand
       * is two jobs where the host does one, and the second is done in a dark
       * pub with a room already looking at the wall.
       *
       * **SYNCHRONOUSLY, BEFORE THE AWAIT.** A browser only allows a popup
       * inside the gesture that asked for it; one opened after the launch
       * resolves is a blocked popup and a notification bar, which is worse
       * than no feature because it looks broken. That is the whole reason this
       * cannot live inside `doLaunch()` beside the request.
       *
       * **A NAMED TARGET, so a second launch REUSES the tab** rather than
       * stacking projector windows across an evening.
       *
       * **AND NOTHING CLOSES IT IF THE LAUNCH IS REFUSED**, which took a wrong
       * turn first. The instinct is to tidy the window away on a 409 — but
       * `screenLink()` points at the ROOM, not at the game, so a declined
       * launch leaves the projector showing the night that is still running.
       * That is not a stale window, it is the correct one. Closing it would
       * also shut a projector the host had already opened themselves, since a
       * named target cannot tell you whether it was there a moment ago.
       */
      window.open(screenLink(), 'quizscreen');
      // Once `lbSlots` exists it is the truth for what launches, whether or
      // not it still counts as "mixed" — `currentPack`/`lbExtra` stopped
      // being updated the moment mixed mode was entered.
      const segments = runningShowSegments() || (lbSlots ? segmentsFromSlots(lbSlots) : null);
      if (segments) {
        await doLaunchOrder(segments, {
          look: night.look,
          questionSeconds: night.questionSeconds,
          lobbyGame: night.lobbyGame,
          lobbySound: night.lobbySound,
          online: lbOnline,
          teamPlay: night.teamPlay,
          venue: venueNow(),
          /*
           * PRUNED AGAINST THE SEGMENTS BEING SENT, not against whatever the
           * strip last drew. They are the same list in practice; sending a
           * plan that names a break these segments do not have would be a
           * setting with nowhere to land, and the server would drop it
           * silently rather than say so.
           */
          breaks: prunePlan(night.breaks, segments),
        }, button);
        return;
      }
      await doLaunch(kind, pack.id, {
        // FROM `night`, not from the DOM — see the note where it is declared.
        // The controls are on this same bar now, but reading the one shared
        // object rather than five live selects is still the simpler contract,
        // and it is what survives a saved show restoring these fields directly
        // (`loadShow()`) without a DOM element to read them back off.
        shape: night.shape,
        prizes: night.prizes,
        look: night.look,
        questionSeconds: night.questionSeconds,
        lobbyGame: night.lobbyGame,
        lobbySound: night.lobbySound,
        // ONE source for whether tonight is online — the switch in the head,
        // which is the only place it can be set now.
        online: lbOnline,
        teamPlay: night.teamPlay,
        // ONE source for where tonight is — the picker at the top, which is
        // the only place it can be set now. Two controls for one field is how
        // a night gets filed under the pub you were at last week.
        venue: venueNow(),
        // Empty unless a second pack has actually been dropped in — see
        // `lbExtra`. An ordinary night sends nothing at all and takes exactly
        // the route it always did.
        order: nightOrder(),
        // See the running-order branch above: pruned against the night as it
        // is, so nothing is sent that names a gap this night does not have.
        breaks: prunePlan(night.breaks, segmentsNow()),
      }, button);
    };

    paintOrder();

    // A DELIBERATE CHOICE puts it up; a re-render does not. `startOn()` calls
    // `pick` on every state push to keep the box filled, and that must never
    // launch anything — hence both the `quiet` flag and the id comparison.
    if (switching) switchIfFree(pack, kind);
  }

  const onType = () => { paintHits(); paintAlt(); };
  text.addEventListener('input', onType);
  /*
   * The box arrives holding tonight's pack, so tapping it to search would
   * otherwise mean deleting a title first. Selecting it means the first thing
   * typed replaces it, which is what somebody expects of a box that is already
   * full.
   */
  text.addEventListener('focus', () => { text.select(); paintHits(); });
  // Enter takes the top match, because a keyboard is faster than a thumb and
  // somebody in a hurry will press it.
  text.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter') return;
    const first = hits.querySelector('.lb-hit');
    if (first) { ev.preventDefault(); first.click(); }
  });
  gamePick?.addEventListener('change', () => {
    // A different game means a different shelf, so whatever was chosen is not
    // on it any more. Start again on that game's own best pick — and a running
    // order built out of quiz rounds means nothing on the bingo shelf.
    lbGame = gamePick.value;
    currentPack = null;
    lbExtra = [];
    lbSlots = null;
    chosen.hidden = true;
    text.value = '';
    startOn();
  });

  /*
   * ARRIVE READY, which is the whole point of the section.
   *
   * The panel used to open on an empty search box and two shortcut buttons —
   * so the fully-featured path began with typing. It now starts on the pack
   * this room is least likely to have heard (`quickPicks`, unchanged), with
   * the venue and the settings already filled in behind it. One press.
   *
   * A room with no packs at all falls through to the empty box, which is what
   * it always was.
   */
  function startOn() {
    paintWhere();
    /*
     * A CHOICE STICKS. THE APP ONLY CHOOSES WHEN NOBODY HAS.
     *
     * This used to re-pick on every render, and `render()` runs on every state
     * push — so the bar quietly changed its mind whenever anything happened.
     * The worst version of that was reported from a real night: **launch a
     * pack, and the launched pack now has a play time, so `quickPicks` sorts
     * it away and the bar starts offering a DIFFERENT quiz from the one on the
     * big screen.** The console and the projector disagreed, with nothing
     * saying which was right.
     *
     * So the auto-pick is the empty state and nothing else: it fills the box
     * when there is no choice yet, or when the choice is not on this game's
     * shelf (changing game, or a pack that has since been deleted).
     */
    const shelf = gameOf().packs;
    const stillThere = currentPack && shelf.some((p) => p.id === currentPack.id);
    // QUIET: this runs on every state push, and a re-render is not somebody
    // choosing a pack. Without it the bar would relaunch the projector every
    // time a phone joined.
    if (stillThere) { pick(currentPack, { quiet: true }); }
    else {
      /*
       * WITH NOTHING CHOSEN, IT STARTS ON WHAT IS ON THE BIG SCREEN.
       *
       * This is the other half of the same report, and it is the half a page
       * reload produced: the box was filled from `quickPicks`, whose order
       * changes the moment a pack is launched (it now has a play time and
       * sorts away) — so coming back to the console after launching showed a
       * DIFFERENT quiz from the one the room was looking at. Panel said one
       * thing, projector said another, and pressing the big button would have
       * replaced a running night with a pack nobody chose.
       *
       * The running pack is the honest default: it is what the screen says,
       * it is almost always what you want to relaunch or carry on with, and
       * anything else is one tap away in the box.
       */
      /*
       * NOTHING IS CHOSEN FOR YOU ANY MORE, and that reverses the paragraph
       * above rather than contradicting it. All of that was the cost of the
       * bar guessing: it guessed, the guess went stale as soon as a pack was
       * launched, and the console and the projector ended up naming different
       * quizzes on a real night. The answer was to make the guess cleverer.
       *
       * Dragging a pack up is faster than reading a guess and correcting it,
       * so the guess is gone — *"don't need the autoloaded pack in the launch
       * bit now since dragging a pack is so fast"*. **A bar that chooses
       * nothing cannot choose wrongly**, which retires that whole class of
       * fault rather than managing it. What is on the big screen is still
       * SAID, by `paintLive()` below, which is the half that was actually
       * wanted: a statement of fact rather than a suggestion that competes
       * with one.
       */
      chosen.hidden = true;
    }
    paintOrder();
    paintLive();
    paintFold();
  }

  /*
   * WHAT THE BIG SCREEN IS SHOWING, said on the console — always.
   *
   * The host's report, after a night: *"the quiz in the launch bit after I
   * pressed launch didn't say what the big screen said — they need to be
   * consistent, always."* The chooser is a chooser: it says what the NEXT
   * press would start, which is not the same question as what is on the
   * projector right now, and the two are only ever the same by luck.
   *
   * So the running pack is stated in its own line, off `library.running` —
   * the server's own view of the loaded session, so it cannot drift — and it
   * goes GOLD when it differs from what is in the box, which is the moment
   * somebody is about to be surprised.
   */
  function paintLive() {
    const running = (library && library.running) || {};
    const title = String(running.title || '');
    if (!title) { liveRow.hidden = true; return; }
    liveRow.hidden = false;
    /*
     * IF THE LINE IS SHOWING, SO IS THE STOP — asked for twice, the second
     * time with a screenshot of this line reading in RED (the projector
     * showing one quiz while the bar was set to another) and no way to clear
     * it: *"can I have a little button next to the text saying what's on the
     * screen to unlaunch it?"*
     *
     * It was gated on `aNightIsOn()` — the stricter test the running panel
     * uses, which is false while a game sits in the lobby with nobody joined.
     * That hid the button at exactly the moment it is most wanted: something
     * IS on the projector (this line only exists when it is) and the person
     * reading it wants it gone. The running panel keeps the stricter test for
     * its own Stop, and that is right for a panel that is about a night in
     * progress; this button is about the SCREEN, and the screen is showing
     * something whenever there is a title to name.
     */
    unlaunchBtn.hidden = false;
    /*
     * NOTHING CHOSEN IS NOT A DISAGREEMENT.
     *
     * This was `!currentPack || currentPack.title !== title`, which was right
     * while the bar auto-picked a pack — there was always something in the box
     * to compare. Now the bar starts EMPTY, so `currentPack` is null on every
     * arrival and the red drift warning fired on a console that had not been
     * touched, about a difference that did not exist. A warning that is on by
     * default is a warning nobody reads by the second week, which would cost
     * exactly the fault it was added to catch.
     *
     * Chosen nothing, the line still SAYS what is on the projector — that is
     * information somebody wants — it simply says it quietly.
     */
    const packDiffers = Boolean(currentPack) && currentPack.title !== title;
    /*
     * THE VENUE CAN DRIFT TOO, and it is the more dangerous of the two.
     *
     * Once a team has joined, the bar can no longer re-resolve the running
     * night — that is the guard doing its job. But the bar would then show the
     * new venue's PRIZES while the room is being shown the old venue's, which
     * is precisely the console-and-projector disagreement this section exists
     * to end, wearing a different hat. A wrong pack name is embarrassing; a
     * wrong prize is somebody at the bar being refused a drink.
     *
     * So it is named. Only when a venue has actually been chosen — with none
     * picked the bar is showing the night's own answer and there is nothing to
     * disagree about.
     */
    const runVenue = String(running.venue || '').trim();
    const barVenue = String(lbVenue == null ? runVenue : lbVenue).trim();
    const venueDiffers = Boolean(lbVenue != null && barVenue.toLowerCase() !== runVenue.toLowerCase());
    liveEl.classList.toggle('lb-warn', packDiffers || venueDiffers);
    liveEl.textContent = !currentPack
      ? `On the big screen now: ${title}`
      : packDiffers
        ? `On the big screen now: ${title}`
      : venueDiffers
        ? `On the big screen now — this one, but filed under ${runVenue || 'nowhere'}. Launch again to move it.`
        : 'On the big screen now — this one';
  }

  unlaunchBtn.addEventListener('click', (ev) => stopRunningNight(ev.currentTarget));

  /*
   * TONIGHT'S SETTINGS, PAINTED FRESH whenever the pack changes — the same
   * "read state, redraw" shape as `paintLive()`, moved here from a tab that
   * used to be rebuilt from scratch on every visit. This bar is not rebuilt
   * that often, so the parts that depend on WHICH pack is chosen have to be
   * repainted by hand at every place `currentPack` changes.
   *
   * CARD, PRIZES, SECONDS AND WHILE THEY WAIT are the only pack-dependent
   * ones — Look's own OPTIONS change too, because a pack can carry its own
   * default. Sound and Playing are facts about the NIGHT regardless of the
   * pack, so they are wired once below rather than repainted here — a
   * control that cannot change has nothing for a repaint to do.
   */
  function paintSettings() {
    const pack = currentPack;
    /*
     * MIXED MODE HAS TO BE ASKED SEPARATELY, because `lbSlots` is where a
     * bingo interlude actually lives once the tiled row takes over — the
     * moment it exists, `currentPack` is only slot 1 and may not even be
     * bingo itself, exactly the case that made Card and Prizes read as
     * "Bingo only" beside a bingo tile with its OWN working shape and prize
     * dropdowns two inches below. Reported live, off a screenshot.
     */
    const mixed = Boolean(lbSlots);
    const hasBingo = mixed ? lbSlots.some((s) => s && s.kind === 'bingo') : Boolean(pack && !(pack.rounds || []).length);
    const hasQuiz = mixed ? lbSlots.some((s) => s && s.kind === 'quiz') : !hasBingo;

    /*
     * THE ROW BELOW BELONGS TO WHICHEVER PACK IS PICKED, and picking one is
     * a tap on its tile. Card and Prizes are the only pack-specific settings
     * there are today — Seconds is night-wide because the launch only
     * carries one — so the row is a bingo pack's two controls, named.
     *
     * `pickedPack()` reads the row AS DRAWN, so the same index means the
     * same tile in both modes, and it is bounds-checked rather than reset:
     * removing pack 3 while it was picked leaves nothing picked instead of
     * silently moving the row onto whatever slid into that position.
     */
    const picked = pickedPack();
    const pickedIsBingo = Boolean(picked) && picked.kind === 'bingo';
    if (setForEl) {
      setForEl.textContent = !picked
        ? (packsInBay() ? 'Tap a pack above to set it up' : '')
        : pickedIsBingo
          ? shortTitle(picked.pack.title)
          : `${shortTitle(picked.pack.title)} — rounds are the dots on the pack`;
    }
    // The whole row stands down when there is nothing in the bay at all:
    // with no packs there is no pack to be specific about, and an empty
    // labelled row above Launch is furniture. Once anything is in, it stays
    // present — inert and saying so — like every other control on this bar.
    if (packSetRow) packSetRow.hidden = !packsInBay();
    if (cardRow) cardRow.hidden = !pickedIsBingo;
    if (prizesRow) prizesRow.hidden = !pickedIsBingo;
    if (shapePick && prizePick) {
      shapePick.disabled = !pickedIsBingo;
      prizePick.disabled = !pickedIsBingo;
      if (pickedIsBingo) {
        shapePick.innerHTML = shapeOptions(picked.pack);
        const shape = pickedShape(picked);
        if (shape) shapePick.value = JSON.stringify({ rows: shape.rows, cols: shape.cols });
        paintPrizes();
      }
    }
    // Seconds per question is night-wide but only MEANS anything when there
    // is a quiz in the night at all — inert on an evening of pure bingo.
    if (secondsPick) secondsPick.disabled = !hasQuiz;

    // The pack can carry its own look, so the OPTIONS themselves have to be
    // rebuilt — a blank `night.look` means "leave the pack's own alone",
    // exactly as it did on the tab, so it only overrides when set.
    if (lookPick) {
      lookPick.innerHTML = lookOptions(pack || {});
      if (night.look) lookPick.value = night.look;
    }
    if (lobbyGamePick) {
      // What plays in the LOBBY follows the FIRST thing tonight plays, not
      // "is there any bingo anywhere" — a quiz opening a mixed night wants
      // Maze Mouth in the lobby even with a bingo interlude waiting after it.
      const firstKind = mixed ? ((lbSlots.find(Boolean) || {}).kind || 'quiz') : (hasBingo ? 'bingo' : 'quiz');
      lobbyGamePick.innerHTML = lobbyGameOptions(firstKind);
      if (night.lobbyGame) lobbyGamePick.value = night.lobbyGame;
    }

    if (setSave) {
      // Mirrors the exact check `paintMixedOrder()` uses for the Launch
      // button itself — "anything to keep" and "anything to launch" have to
      // agree, or one control offers a night the other says does not exist.
      const hasNight = mixed ? segmentsFromSlots(lbSlots).length > 0 : Boolean(pack);
      setSave.disabled = !hasNight;
      /*
       * THE REASON GOES ON THE BUTTON, NOT BESIDE IT — reported in exactly
       * those terms: *"not sure what 'nothing in tonight to keep yet'
       * means"*. It was a sentence about the app's own state, floating next
       * to a greyed-out control, describing a condition rather than telling
       * anybody what to do about it. Two faults at once: it named "Tonight"
       * as though that were a place you might have put something, and it
       * said what was missing rather than what to do.
       *
       * A disabled button that says what it wants is the same shape Launch
       * already uses ("Drag a pack in to launch") — one control, one
       * sentence, and no second line to read.
       */
      setSave.textContent = hasNight ? 'Save for another night' : 'Add a pack to save this night';
    }
  }

  /** Is there anything in the bay at all, either shape of night. */
  function packsInBay() {
    return lbSlots ? lbSlots.some(Boolean) : lbPacks().length > 0;
  }

  /**
   * WHICH PACK THE SETTINGS ROW IS TALKING ABOUT — resolved from `lbPicked`
   * against the row as it is actually drawn, so one index means one tile in
   * both shapes of night.
   *
   * Returns `{ pack, kind, at, slot }`, or null when nothing is picked or
   * the picked position is empty. **Bounds-checked rather than reset**: a
   * pack removed from under the selection leaves the row saying nothing,
   * which is honest, instead of silently re-pointing at whatever moved into
   * that slot — the same reasoning `paintLive()` uses for not filling a gap
   * with an optimistic guess.
   */
  function pickedPack() {
    if (lbSlots) {
      const slot = lbSlots[lbPicked];
      if (!slot) return null;
      const pack = anyPack(slot.packId);
      return pack ? { pack, kind: slot.kind, at: lbPicked, slot } : null;
    }
    const pack = lbPacks()[lbPicked];
    if (!pack) return null;
    return { pack, kind: (pack.rounds || []).length ? 'quiz' : 'bingo', at: lbPicked, slot: null };
  }

  /**
   * The shape this picked pack is currently set to — its SLOT's own in mixed
   * mode, the night-wide one otherwise. Two storage places because that is
   * what the launch already reads: a mixed running order sends a shape per
   * bingo segment, an ordinary night sends one for the whole game.
   */
  function pickedShape(picked) {
    if (!picked) return null;
    return picked.slot ? picked.slot.shape : night.shape;
  }

  /** Write a shape and prize count back to wherever this pack keeps them. */
  function setPickedBingo(picked, { shape, prizes }) {
    if (!picked) return;
    if (picked.slot) {
      const next = lbSlots.slice();
      next[picked.at] = { ...picked.slot, ...(shape ? { shape } : {}), ...(prizes != null ? { prizes } : {}) };
      lbSlots = next;
      return;
    }
    if (shape) night.shape = shape;
    if (prizes != null) night.prizes = prizes;
  }

  /** The prize plans for whichever shape is currently picked. */
  function paintPrizes() {
    if (!shapePick || !prizePick || shapePick.disabled) return;
    let want;
    try { want = JSON.parse(shapePick.value); } catch { return; }
    const found = ((library && library.cardShapes) || [])
      .find((sh) => sh.rows === want.rows && sh.cols === want.cols);
    if (!found) return;
    prizePick.innerHTML = found.plans
      .map((plan, i) => `<option value="${i + 1}">${i + 1} — ${esc(plan.join(', then '))}</option>`).join('');
    const picked = pickedPack();
    const has = picked && picked.slot ? picked.slot.prizes : night.prizes;
    if (has) prizePick.value = String(has);
  }
  shapePick?.addEventListener('change', () => {
    const picked = pickedPack();
    if (!picked) return;
    // The plans depend on the shape, so a shape change always re-derives
    // them and then re-reads the count off the list it just built — picking
    // a 3×3 while "4 prizes" was set must not keep a number that shape has
    // no plan for.
    setPickedBingo(picked, { shape: JSON.parse(shapePick.value) });
    paintPrizes();
    setPickedBingo(pickedPack(), { prizes: Number(prizePick?.value) || 0 });
    // The tile shows its own shape, so it has to be redrawn with it.
    if (lbSlots) paintOrder();
  });
  prizePick?.addEventListener('change', () => {
    setPickedBingo(pickedPack(), { prizes: Number(prizePick.value) || 0 });
    if (lbSlots) paintOrder();
  });
  lookPick?.addEventListener('change', (ev) => { night.look = ev.target.value; });
  lobbyGamePick?.addEventListener('change', (ev) => { night.lobbyGame = ev.target.value; });

  // SOUND AND PLAYING ARE NOT PACK-DEPENDENT, so they are set from `night`
  // once here rather than on every `paintSettings()` — same as Seconds'
  // own VALUE (only its disabled state is pack-dependent).
  if (secondsPick) secondsPick.value = night.questionSeconds || '';
  if (soundPick) soundPick.value = night.lobbySound ? 'on' : 'off';
  if (playPick) playPick.value = night.teamPlay ? 'teams' : 'solo';
  secondsPick?.addEventListener('input', (ev) => {
    const n = Math.max(5, Math.min(120, Number(ev.target.value) || 0));
    night.questionSeconds = ev.target.value === '' ? 0 : n;
  });
  soundPick?.addEventListener('change', (ev) => { night.lobbySound = ev.target.value !== 'off'; });
  playPick?.addEventListener('change', (ev) => { night.teamPlay = ev.target.value === 'teams'; });

  /*
   * KEEPING TONIGHT AS A SHOW — present and inert rather than absent when
   * there is nothing to keep, same as Launch itself: `paintSettings()` sets
   * the disabled state and the reason above.
   */
  setSave?.addEventListener('click', async () => {
    const draft = tonightAsShow('');
    if (!draft) return;
    /*
     * THE NAME IS SUGGESTED, NEVER IMPOSED — and it names what the night
     * PLAYS now rather than where it was saved. It used to suggest "Thursday
     * at The Crown", which stopped making sense the moment the venue stopped
     * being saved: a name pointing at a pub the show will not load is worse
     * than a plain one. The packs are what is actually being kept, so they
     * are what it offers.
     */
    const parts = lbSlots
      ? [...new Set(lbSlots.filter(Boolean).map((s) => (anyPack(s.packId) || {}).title).filter(Boolean))]
      : lbPacks().map((p) => p.title);
    const suggestion = parts.length > 1
      ? `${shortTitle(parts[0])} + ${parts.length - 1} more`
      : (parts[0] || currentPack.title || 'Tonight');
    const name = prompt('What is this called?', suggestion);
    if (name === null) return;
    if (!name.trim()) return;
    setSave.disabled = true;
    const wasHtml = setSave.innerHTML;
    setSave.textContent = 'Keeping…';
    try {
      const res = await postJson('/api/shows', tonightAsShow(name.trim()), { 'X-Host-Key': hostKey });
      await load();
      showDone('good', `<strong>${esc(res.show.name)}</strong> is on your Prepare a night tab. `
        + 'Drag it onto Tonight whenever you want this evening back.');
      render();
    } catch (err) {
      setSave.disabled = false;
      setSave.innerHTML = wasHtml;
      alert(err.message || 'Could not keep that.');
    }
  });

  /*
   * OPEN OR A THIN LINE, and the line still says what it is set to.
   *
   * Collapsed it is one row — "Tonight · The Crown · The 1980s Pop Quiz" and a
   * chevron — which is findable from anywhere on the page and one tap from
   * launching. Everything below the head is hidden rather than removed, so
   * reopening it is instant and nothing has to be rebuilt or re-chosen.
   *
   * THE WHOLE HEAD IS THE TARGET when it is shut. A thin bar with one small
   * chevron on the end of it is a thing you miss with a thumb in a dark pub;
   * shut, the entire row opens it.
   */
  function paintFold() {
    el.classList.toggle('shut', !tonightOpen);
    fold.setAttribute('aria-expanded', tonightOpen ? 'true' : 'false');
    /*
     * HIDE / SHOW — one pair, both describing the same act on the same thing.
     * It said "Hide" open and "Launch a night" shut, which are answers to two
     * different questions: one is what the button does to the panel, the other
     * is what the panel is for. A control that changes its own meaning when
     * pressed is a control you have to read twice.
     */
    el.querySelector('.lb-fold-word').textContent = tonightOpen ? 'Hide' : 'Show';
    /*
     * The mode switch is NOT in this list any more: it lives in the head row
     * now, beside the fold, so folding the panel must not take it with it —
     * which is the whole reason it was worth moving. Shut, the one setting
     * that can put a question on sixty phones in a pub is still on screen and
     * still changeable.
     */
    for (const part of [el.querySelector('.lb-find'), whyEl, el.querySelector('.lb-row'),
      chosen, venues, liveEl, orderEl]) {
      if (part) part.classList.toggle('lb-tucked', !tonightOpen);
    }
    shutWhat.hidden = tonightOpen;
    /*
     * SHUT, THE LINE STILL SAYS IT IS ONLINE — and that is most of why the
     * switch was worth moving. Folded away is exactly the state somebody
     * launches from without opening the panel, so the one setting that can put
     * a question on sixty phones in a pub has to survive the fold.
     *
     * Only when it is ON. Adding "In the room" to every shut line would print
     * the normal case on a row that has to stay one row, and a label that is
     * always there is a label nobody reads.
     */
    shutWhat.textContent = [lbOnline ? 'Online' : '', currentPack ? currentPack.title : '']
      .filter(Boolean).join(' · ');
  }

  /*
   * THE SECTION TAKES A PACK, and gives it back.
   *
   * Drop one on Tonight and it becomes tonight's pack, whichever game it
   * belongs to — a bingo pack dropped on a bar set to Music Quiz switches the
   * bar over rather than being quietly refused.
   *
   * AND DRAGGING THE CHOSEN PACK OFF TAKES IT OUT OF THE SECTION AND NOWHERE
   * ELSE. The host's own words: *"say you drag the wrong quiz pack, you can
   * just drag it off again quickly and easily."* It is a CHOICE being undone,
   * not a delete — the pack is untouched on disk and still on its shelf — so
   * the bar simply falls back to offering what is on the big screen, which is
   * the same empty state it arrives in.
   */
  /*
   * IT ACCEPTS A DROP WHILE SHUT, and springs open on the way.
   *
   * Collapsed, this is one thin row — which is exactly the state somebody is
   * in when they arrive at a venue and start setting the night up, so a target
   * that only worked when open would be missing at the moment it is wanted.
   * Opening on hover also gives the drop somewhere to land that is big enough
   * to aim at.
   */
  /**
   * OPEN FOR THE DRAG, THEN GIVE THE FOLD BACK.
   *
   * Asked for on 15 August 2026: *"we should be able to drag a pack to the
   * launch console collapsed and it keeps its collapse."* It used to unfold
   * the bar and LEAVE it unfolded, writing that into `localStorage` as though
   * the host had pressed Show — so a bar you had deliberately folded down to
   * one line was open again after every drop, and stayed open next time you
   * came back.
   *
   * The opening itself is still right and has to stay: collapsed, this is one
   * thin row, and a drop target that small is missing at exactly the moment it
   * is wanted. **What was wrong was keeping it.** So the fold is remembered
   * before the drag and restored when the drag ends — the target is big while
   * you are aiming at it, and the bar is however you left it afterwards.
   *
   * **THE REMEMBERED SETTING IS NOT TOUCHED WHILE DRAGGING**, only the live
   * one. A drag is not somebody pressing Show, and it should not be able to
   * change what the console looks like tomorrow.
   */
  let foldBeforeDrag = null;
  const openForDrop = () => {
    if (tonightOpen) return;
    if (foldBeforeDrag === null) foldBeforeDrag = tonightOpen;
    tonightOpen = true;
    paintFold();
  };
  const giveTheFoldBack = () => {
    if (foldBeforeDrag === null) return;
    tonightOpen = foldBeforeDrag;
    foldBeforeDrag = null;
    paintFold();
  };
  /*
   * ============================================================ THE STRIP
   *
   * TONIGHT'S RUNNING ORDER: the rounds that will be played, in order, and
   * the place a pack is dropped to add its own.
   *
   * **DROPPING ON THE STRIP ADDS; DROPPING ANYWHERE ELSE IN TONIGHT
   * REPLACES.** One rule, and it is the one somebody would guess: the strip
   * is the night, so a pack landing in it joins the night, and a pack landing
   * on the bar is the bar's own "what are we playing" answered again. Without
   * the split there is no way to say "no, THAT one instead" once an order has
   * been built, which is the more common mistake of the two.
   */
  const orderEl = el.querySelector('.lb-order');
  const goBtn = el.querySelector('.lb-go');

  /** The rounds a pack contributes, as the strip stores them. */
  const roundsOf = (pack) => (pack && pack.rounds ? pack.rounds : [])
    .map((_, i) => ({ packId: pack.id, round: i }));

  /** A pack off the shelf by id. Never stored — see `lbExtra`. */
  const packOf = (id) => (gameOf().packs || []).find((p) => p.id === id);
  /** A pack off a NAMED shelf, whichever one is active — the mixed row needs
      to find a bingo pack while quiz is picked, and vice versa. */
  const packOnShelf = (kind, id) => ((games.find((g) => g.id === kind) || {}).packs || []).find((p) => p.id === id);
  /** Any pack anywhere in the mixed row, for `renderSlots()`'s own lookups. */
  const anyPack = (id) => games.flatMap((g) => g.packs || []).find((p) => p.id === id);

  /** Tonight, in order: the chosen pack and anything dropped in after it. */
  const lbPacks = () => [currentPack, ...lbExtra.map(packOf)].filter(Boolean);

  /**
   * The running order to send, or null for an ordinary night.
   *
   * Null on one pack, deliberately: a night that is one pack played as
   * written is the night this app has always run, and spelling its own rounds
   * out would be the same evening by a longer road, through code that did not
   * exist last week, on the protected path.
   */
  const offKey = (packId, round) => `${packId}:${round}`;
  const isOff = (packId, round) => lbOff.has(offKey(packId, round));

  /** Tonight's rounds, in order, with the switched-off ones left out. */
  const activeRounds = () => lbPacks().flatMap(roundsOf).filter((r) => !isOff(r.packId, r.round));

  /**
   * DOES TONIGHT EVEN HAVE ROUNDS TO SWITCH OFF?
   *
   * **A BINGO PACK HAS NO ROUNDS ON DISK, and that is by design** — it is a
   * title and a track list, and the rounds are a thing that happens while it
   * is being played. So `roundsOf()` rightly returns nothing for one, and the
   * round count is not a measure of whether there is anything to launch.
   *
   * Read as one, it was: dragging any bingo pack onto Tonight disabled Launch
   * for ever, saying *"Every round is switched off"* about a pack that has
   * none to switch. Nothing threw and the pack card's own Launch still worked,
   * so it only showed up on the drag path — which is the one CLAUDE.md added
   * most recently and the one nobody had pressed in a browser.
   */
  const hasRounds = () => lbPacks().some((p) => p && p.rounds && p.rounds.length);

  function nightOrder() {
    const packs = lbPacks();
    const rounds = activeRounds();
    /*
     * NULL FOR AN ORDINARY NIGHT — one pack, played as written. That is the
     * night this app has always run, and spelling its own rounds out would be
     * the same evening by a longer road, through code that did not exist last
     * week, on the protected path.
     *
     * The moment a round is switched OFF it stops being that night, even with
     * one pack — which is why this asks whether anything is off rather than
     * only counting packs.
     */
    if (packs.length < 2 && rounds.length === roundsOf(packs[0]).length) return null;
    return rounds;
  }

  /**
   * Switch a round off, or back on.
   *
   * **THE LAST ONE CANNOT BE SWITCHED OFF.** A night with no rounds is not a
   * night, the server refuses it, and being refused at Launch — in a venue,
   * with a room in front of you — is the wrong place to find out.
   */
  function toggleRound(packId, round) {
    /*
     * ANY ROUND CAN BE SWITCHED OFF, INCLUDING THE LAST ONE.
     *
     * This used to refuse the last tick, which was a special case guarding
     * something real — the server will not launch a night with no rounds — in
     * the wrong place. The host's own fix: *"the launch console should just
     * treat a pack with all red crosses as an empty pack."*
     *
     * That is better for two reasons. A tick that will not toggle is a control
     * that ignores you, and this file's rule is that nothing on screen should
     * need explaining. And the constraint already had a home: Launch is hollow
     * when there is nothing to launch, so "every round is off" is simply
     * another way of having nothing — said in the one place that was built to
     * say it, rather than by a tap that does nothing.
     *
     * A pack with every round crossed off is an empty pack: it sits there
     * dimmed, contributes nothing, and one tap brings it back. Nobody has to
     * drag it out and find it again.
     */
    const key = offKey(packId, round);
    if (lbOff.has(key)) lbOff.delete(key);
    else lbOff.add(key);
    paintOrder();
  }

  /** Take a pack out. Taking the FIRST one out clears the night. */
  function dropPack(at) {
    if (at === 0) {
      currentPack = null;
      lbExtra = [];
      lbOff = new Set();
      lbSlots = null;
      chosen.hidden = true;
      /*
       * AND SET IT UP GOES BACK TO SLEEP WITH IT. `pick()` switches that
       * button on and nothing switched it off, so clearing the night left a
       * control offering to configure a night that no longer existed — it
       * opened a panel with nothing in it to set. A fresh page load has it
       * disabled, so the two states of "nothing chosen" disagreed depending on
       * how you got there, which is the leftover-state fault this file keeps
       * recording in other forms.
       *
       * Disabled rather than hidden, so the row does not change height on the
       * way out any more than it does on the way in.
       */
      paintOrder();
      paintLive();
      return;
    }
    lbExtra.splice(at - 1, 1);
    paintOrder();
  }

  /** Reorder. Moving something into first place makes it the night's pack. */
  function movePack(from, to) {
    const ids = lbPacks().map((p) => p.id);
    const [moved] = ids.splice(from, 1);
    // The source is already out of the list, so an index after it has shifted
    // down by one — the off-by-one that makes a drag "not move" when you drop
    // it one place along.
    ids.splice(from < to ? to - 1 : to, 0, moved);
    const first = packOf(ids[0]);
    lbExtra = ids.slice(1);
    // `keepOrder`: this IS the reordered `lbExtra`, just computed above — a
    // reorder promoting a different pack to first is not a fresh pick, and
    // must not be wiped by `pick()`'s own "different pack starts again" rule.
    if (first && (!currentPack || currentPack.id !== first.id)) pick(first, { keepOrder: true });
    else paintOrder();
  }

  /**
   * THE BAR STARTS EMPTY AND FILLS UP.
   *
   * Asked for directly once the drag existed: *"don't need the autoloaded
   * pack in the launch bit now since dragging a pack is so fast"*, and the
   * same for the game dropdown and the search box. He is right, and the
   * reason is worth writing down because it reverses an earlier decision in
   * this same file. **The auto-pick existed to answer "what are we playing"
   * before you had said** — three controls and a guess, on the panel that is
   * meant to be the fast one. Dragging a pack up answers it in one gesture
   * and cannot be wrong, so the guess stopped earning its place the moment
   * the gesture landed.
   *
   * It also removes the fault this file already records at length: the bar
   * re-picking itself on every state push, and the console and the projector
   * ending up naming different quizzes on a real night. A bar that chooses
   * nothing cannot choose wrongly.
   *
   * **THE EMPTY STATE IS THE CONTROL**, not a message about a missing one —
   * *"it needs to just be empty with those little dotted cutouts until stuff
   * is dragged up and it fills the space"*. So the cutout is a real button:
   * a drop target for a mouse and, because HTML5 drag does not fire on touch
   * at all, the way in on a phone.
   */
  /**
   * TONIGHT AS A ROW OF SQUARES.
   *
   * Asked for once the drag existed: *"can we make the packs square shaped so
   * they drop in the console and there's like 3 cut out squares to drop them
   * into? perhaps a couple of other squares that give other info like venue,
   * time, prizes or whatever."*
   *
   * **The unit is a PACK, not a round**, and that is the change this made.
   * The first build listed every round as a chip, which is the truthful view
   * of what gets played and the wrong one to hand somebody five minutes
   * before a gig: twelve chips is a list you read, three squares is a night
   * you see. Rounds are still what the server composes — a square simply
   * stands for all of its pack's.
   *
   * **THE EMPTY SLOTS ARE PART OF THE PICTURE.** Every square is always
   * drawn, filled or not, so the bar has the same shape whether the night is
   * set up or not — and an empty one is a dotted cutout that says what to do
   * with it. A row that grows a box each time you drop something reflows the
   * whole bar under your hand.
   *
   * **THE INFO SQUARES ARE READ, NOT PRESSED** (except the venue, which was
   * already a control). They restate the three facts a night is filed under —
   * where, when, what it plays for — at a glance, in the place the decision is
   * made. Nothing is duplicated: each one is a view of something set
   * elsewhere, and the venue tile drives the same `chooseVenue` the head does.
   */
  /**
   * SIX, ASKED FOR ON 15 AUGUST 2026 — *"need 6 pack slots imo"*.
   *
   * It was three, with a note in TODO.md saying not to make it four or five:
   * *"three is a quiz, a bingo and one spare, which is the shape of the host's
   * own Thursday."* **That reasoning was about PACKS and the night has since
   * stopped being made of packs** — it is a running order of elements, and a
   * quiz split either side of a breakout is three items on its own before a
   * bingo game is anywhere near it. Six is two of those nights.
   *
   * The old worry still stands and is answered by the WIDTH rather than the
   * count: a row that needs reordering and scrolling is the thing to avoid, so
   * the tiles came down to 160px, which puts six on one row of a laptop inside
   * the same space three used to take at 200.
   */
  const PACK_SLOTS = 6;

  /**
   * THE SHELF SHOWS THE GAP. A pack that is in tonight is drawn as an outline
   * of itself in the library, so the card has visibly LEFT rather than been
   * copied — which is what makes the flight read as a move. It is only a
   * look: the pack is untouched on disk and taking it out of the night puts
   * the card straight back.
   */
  function paintInTonight() {
    const ids = new Set(lbPacks().map((p) => p.id));
    for (const card of document.querySelectorAll('.pack-card[data-pack]')) {
      card.classList.toggle('in-tonight', ids.has(card.dataset.pack));
    }
  }

  /*
   * THE MIXED ROW TAKES OVER THE WHOLE PANEL the moment `lbSlots` exists —
   * one renderer at a time, never two disagreeing about what is in slot 2.
   * `renderSlots()` (`console-tonight-mix-ui.js`) draws the tiles; this
   * still owns the info line and the Launch button, exactly as below.
   */
  function paintMixedOrder() {
    orderEl.hidden = false;
    const row = renderSlots(lbSlots, {
      packOf: anyPack,
      onChange: (next) => { lbSlots = next; paintOrder(); },
      dragging,
      getPackDrag: () => packDrag,
      clearPackDrag: () => setPackDrag(null),
      getShelfRoundDrag: () => shelfRoundDrag,
      clearShelfRoundDrag: () => setShelfRoundDrag(null),
      maxSlots: PACK_SLOTS,
      picked: lbPicked,
      onPick: (at) => { lbPicked = at; paintOrder(); },
    });
    orderEl.replaceChildren(row, ...[breakStripNow()].filter(Boolean), infoLine());
    const parts = segmentsFromSlots(lbSlots).length;
    goBtn.disabled = !parts;
    goBtn.textContent = parts ? `Launch tonight — ${parts} part${parts === 1 ? '' : 's'}` : 'Drag a pack in to launch';
    paintInTonight();
  }

  /**
   * TONIGHT AS MORE THAN ONE GAME — quiz, then a bingo interlude, then quiz
   * again, one running score across the interruption. Built from a SAVED
   * SHOW rather than a new composer, because the show editor already lets a
   * host add a bingo game between two quizzes (`showPartsEditor` in
   * `console-shows.js`) — a second way to build the same list would be a
   * second thing that could disagree with it.
   *
   * Only when we are sat on PART ZERO of a show with more than one part:
   * every later part is reached through the control view's own "Continue"
   * button and `/api/host/advanceOrder`, never through this bar again.
   *
   * A part with no `order` of its own (added to the show after the fact,
   * never opened on Tonight to have rounds ticked off) plays EVERY round —
   * `roundsOf()` is the same helper the ordinary strip uses for exactly
   * that shape of pack.
   */
  function runningShowSegments() {
    if (!showRunning || showRunning.at !== 0) return null;
    const items = itemsOf(showRunning.show);
    if (items.length < 2) return null;
    const segments = items.map((item) => {
      if (item.kind === 'bingo') {
        return { kind: 'bingo', packId: item.packId, shape: night.shape, prizes: night.prizes };
      }
      const order = (item.order && item.order.length)
        ? item.order
        : roundsOf((library.quizzes || []).find((p) => p.id === item.packId));
      return { kind: 'quiz', order };
    });
    if (segments.some((s) => (s.kind === 'bingo' ? !s.packId : !s.order.length))) return null;
    return segments;
  }

  /**
   * TONIGHT'S PARTS, THE WAY LAUNCH WILL SEND THEM — one definition, used by
   * the break strip and by nothing else that could disagree with it.
   *
   * A simple night has no segment list of its own, so it is put through
   * `slotsFromSimple()` and then the SAME `segmentsFromSlots()` the mixed row
   * uses. That is deliberately the same pair of functions that convert a
   * simple night into a mixed one when a round is first dragged out — so the
   * strip cannot count a night one way while the launch builds it another,
   * which is the whole class of bug the mixed row already had to be rescued
   * from once.
   */
  function segmentsNow() {
    const show = runningShowSegments();
    if (show) return show;
    const slots = lbSlots || slotsFromSimple({ currentPack, lbExtra, lbOff, packOf });
    return segmentsFromSlots(slots);
  }

  /**
   * THE BREAK STRIP, under the tiles — see `console-breaks.js`.
   *
   * **PRUNED ON EVERY PAINT.** Switch a round off and the break after it
   * stops existing; its entry would otherwise sit in the plan invisibly and
   * come back to life the day the round was switched on again, saying
   * something set weeks ago that nobody can see. Pruning here rather than
   * only at launch means what is stored is always what is on screen.
   */
  function breakStripNow() {
    const segments = segmentsNow();
    night.breaks = prunePlan(night.breaks, segments);
    return breakStrip({
      segments,
      plan: night.breaks,
      open: lbBreakOpen,
      onOpen: (id) => { lbBreakOpen = id; paintOrder(); },
      onSet: (id, set) => {
        if (!id) { lbBreakOpen = ''; paintOrder(); return; }
        night.breaks = { ...night.breaks, [id]: set };
        paintOrder();
      },
    });
  }

  function paintOrder() {
    // ONE PLACE, covering both branches below — every `lbSlots` mutation
    // (a bingo pack dropped into the mixed row, a round dragged between
    // slots, a tile swapped or removed) runs through `renderSlots()`'s own
    // `onChange`, which calls only this function. Repainting the settings
    // row from inside every one of those call sites individually is exactly
    // the kind of scattered duplication that misses one; this is the seam
    // they already all pass through.
    paintSettings();
    if (lbSlots) { paintMixedOrder(); return; }
    orderEl.hidden = false;
    const packs = lbPacks();
    const tiles = [];

    packs.forEach((pack, at) => {
      const rounds = (pack.rounds || []).length;
      /*
       * THE PACK CARRIES ITS COLOUR INTO THE HOLE. Same function as the shelf,
       * so a pack cannot look like one thing on the card and another in the
       * slot — which is the whole payoff for making the two the same shape.
       * With three slots filled it also says what is in each one without
       * reading three titles.
       */
      // The KIND comes from the pack itself rather than from the tab you are
      // on: Tonight can hold a quiz and a bingo game at once, so the tab would
      // paint the wrong edge on one of them.
      const look = packLookAttrs(pack, rounds ? (isBreakoutPack(pack) ? 'breakout' : 'quiz') : 'bingo');
      const tile = node(`
        <div class="lb-tile is-pack ${look.cls} ${at === lbPicked ? 'is-picked' : ''} ${rounds && (pack.rounds || []).every((_, i) => isOff(pack.id, i)) ? 'is-spent' : ''}" style="${look.style}" draggable="true" title="${esc(pack.title)}">
          ${packWord(look)}
          <button class="lb-tile-off" type="button" aria-label="Take this pack out">&times;</button>
          <span class="lb-tile-n">${at + 1}</span>
          <!-- Trimmed here too, or the same pack reads differently on the shelf
               and in the hole it is dragged into - which is the one thing the
               shared look function exists to prevent. The tooltip above still
               carries the full name. -->
          <b class="lb-tile-name">${esc(shortTitle(pack.title))}</b>
          ${rounds
    ? `<div class="lb-rounds">${(pack.rounds || []).map((r, i) => `
          <button class="lb-rd ${isOff(pack.id, i) ? 'off' : 'on'}" type="button"
            data-round="${i}" title="${esc(r.title || `Round ${i + 1}`)}"
            aria-label="${esc(r.title || `Round ${i + 1}`)} — ${isOff(pack.id, i) ? 'off' : 'on'}">
            ${isOff(pack.id, i) ? '&times;' : '&check;'}
          </button>`).join('')}</div>`
    : '<span class="tiny lb-tile-sub">bingo</span>'}
        </div>`);
      /*
       * A TICK PER ROUND, and turning one off is a tap on it. The count it
       * replaces said "3 rounds", which is the same information with nothing
       * you can do about it — these say which three and let you drop one.
       *
       * `stopPropagation` on the mousedown as well as the click: the tile
       * itself is draggable, and without it a press on a tick starts dragging
       * the pack instead of switching a round off.
       */
      for (const dot of tile.querySelectorAll('.lb-rd')) {
        dot.addEventListener('mousedown', (ev) => ev.stopPropagation());
        dot.addEventListener('click', (ev) => {
          ev.stopPropagation();
          toggleRound(pack.id, Number(dot.dataset.round));
        });
      }
      tile.querySelector('.lb-tile-off').addEventListener('click', (ev) => {
        ev.stopPropagation();
        dropPack(at);
      });
      // A tap picks this pack for the settings row underneath — same gesture
      // and same meaning as the mixed row's own tiles, so the two shapes of
      // night behave identically. The × and the round ticks stop the event
      // themselves, so what is left to pick is the face of the tile.
      tile.addEventListener('click', () => { lbPicked = at; paintOrder(); });
      // Reordering, same shape as the editor's: which HALF of the target the
      // cursor is in decides before or after, or a list can only ever be
      // reordered one way and the last position is unreachable.
      tile.addEventListener('dragstart', (ev) => {
        roundDrag = at;
        ev.dataTransfer.effectAllowed = 'move';
        ev.dataTransfer.setData('text/plain', String(at));
        tile.classList.add('is-lifting');
      });
      tile.addEventListener('dragend', (ev) => {
        tile.classList.remove('is-lifting');
        /*
         * DRAGGED BACK OUT. A pack lifted off the row and let go anywhere
         * outside the section leaves the night — the same gesture the chosen
         * pack box has always had, now on the object it belongs to. It reads
         * as putting it back on the shelf, which is exactly what the library
         * card does at the same moment: the dashed "In tonight" outline goes
         * and the card is solid again.
         *
         * `elementFromPoint` rather than `dropEffect`, which browsers disagree
         * about — this is the same check the box already uses, so the two
         * cannot behave differently.
         */
        const inside = el.contains(document.elementFromPoint(ev.clientX, ev.clientY));
        roundDrag = null;
        if (!inside) dropPack(at);
      });
      tile.addEventListener('dragover', (ev) => {
        if (roundDrag === null) return;
        ev.preventDefault(); ev.stopPropagation();
        const box = tile.getBoundingClientRect();
        const after = ev.clientX > box.left + box.width / 2;
        tile.classList.toggle('drop-after', after);
        tile.classList.toggle('drop-before', !after);
      });
      tile.addEventListener('dragleave', () => tile.classList.remove('drop-before', 'drop-after'));
      tile.addEventListener('drop', (ev) => {
        if (roundDrag === null) return;
        ev.preventDefault(); ev.stopPropagation();
        const after = tile.classList.contains('drop-after');
        tile.classList.remove('drop-before', 'drop-after');
        movePack(roundDrag, at + (after ? 1 : 0));
        roundDrag = null;
      });
      tiles.push(tile);
    });

    /*
     * THE ROW IS ALWAYS THE FULL SIX, whatever is in it — reported directly:
     * *"I need 6 regardless of what's in the bay."*
     *
     * **THE BINGO RESTRICTION IS GONE, and it was stale rather than wrong.**
     * It read *"a bingo night gets exactly one"*, and that was true when a
     * bingo pack could not be composed with anything — a track list has no
     * rounds on disk, so extra slots were invitations to do something that
     * could not be done. Since quiz → bingo → quiz landed, a bingo game is
     * one PART of an evening like any other, and the row refusing a second
     * one was the clutter rule pointed at the wrong thing: it was hiding a
     * control that now works.
     */
    const composes = gameOf().id === 'quiz';
    const slots = Math.max(PACK_SLOTS - packs.length, 0);
    for (let i = 0; i < slots; i++) {
      /*
       * THE SLOTS ARE NUMBERED, asked for directly — "add pack 1 pack 2 pack
       * 3". It matters more than it looks: the filled tiles already carry a
       * position badge, so unnumbered slots made the row read 1, 2, then three
       * identical boxes, and where the next one would land was a guess. Now
       * the row counts straight across whether a square is full or empty.
       *
       * The FIRST slot of an empty night teaches the gesture instead —
       * nothing else on the page suggests a pack card can be picked up, and
       * that is the one moment somebody needs telling. Every other slot says
       * what it is.
       */
      const n = packs.length + i + 1;
      // The teaching label is for the FIRST slot of an empty night only —
      // it used to be every slot on a bingo shelf, which was fine when a
      // bingo night had exactly one slot and reads as six identical
      // instructions now that it has six.
      const label = packs.length || i > 0
        ? `Add pack ${n}`
        : (composes ? 'Drag pack 1 here' : 'Drag a bingo game here');
      const empty = node(`
        <button class="lb-tile lb-drop" type="button">
          <span class="lb-tile-n is-empty">${n}</span>
          <span class="lb-drop-plus" aria-hidden="true">+</span>
          <span class="tiny">${esc(label)}</span>
        </button>`);
      empty.addEventListener('click', () => {
        /*
         * TAPPING OPENS THE PICKER. The drag is the fast path on the laptop
         * this console is driven from; this is the one that exists on a phone,
         * where a drag event is never delivered at all. Same list, same
         * `pick()`, so the two cannot drift.
         */
        const find = el.querySelector('.lb-find');
        find.hidden = !find.hidden;
        if (!find.hidden) text.focus();
      });
      tiles.push(empty);
    }

    /*
     * TWO ROWS, NOT ONE GRID.
     *
     * The packs and the three facts were one `auto-fit` grid, so they wrapped
     * INTO each other: "Where" ended up sitting on the end of the pack row and
     * "Playing for" dropped to a line of its own underneath pack 1. They are
     * different kinds of thing — the packs are the night, the facts are what
     * is true about it — and a row that mixes them at one width and separates
     * them at another is the layout deciding something the content should.
     *
     * Their own grids also let each be sized for what it holds: three facts
     * always fit one row, and the packs wrap among themselves when there are
     * four.
     */
    const row = node('<div class="lb-tiles"></div>');
    row.append(...tiles);
    orderEl.replaceChildren(row, ...[breakStripNow()].filter(Boolean), infoLine());
    paintGo(packs);
    paintInTonight();
  }

  /**
   * THE BUTTON HAS TO NAME WHAT IT WILL ACTUALLY LAUNCH.
   *
   * It says "Launch <title>", built from the pack `pick()` was given — which
   * is right for a night that is one pack and a lie the moment a second one
   * is dropped in: two packs in the row above and one pack's name on the
   * button. That is the console-and-projector disagreement this bar exists to
   * end, in miniature and one step earlier, and it is the version somebody
   * would actually press without reading.
   *
   * Composed, it names the EVENING and how long it is, which is the honest
   * summary and the same thing the projector will be filed under —
   * `composeQuiz()` titles a mixed night for the evening too, so the button,
   * the archive and the big screen all say one thing.
   */
  function paintGo(packs) {
    /*
     * HOLLOW UNTIL IT CAN LAUNCH — asked for directly after the appearing and
     * disappearing button was reported as clunky. It is the same fault as a
     * grid that reflows under your hand: the bar changed height the instant
     * anything was dragged in or out, and everything below it jumped.
     *
     * Disabled AND saying what it wants, rather than merely greyed: a control
     * that is off without saying why is the thing this file keeps recording.
     */
    const rounds = activeRounds().length;
    /*
     * HOLLOW WHEN THERE IS NOTHING TO LAUNCH, and that now covers two ways of
     * having nothing: no pack at all, and a pack with every round switched
     * off. Both are said here rather than by a control that refuses to move,
     * and each says WHICH it is — a button that is off without saying why is
     * the fault this file keeps recording.
     */
    // "Nothing to launch" is two different things, and a pack with no rounds
    // AT ALL is neither of them — see `hasRounds()`.
    const emptied = hasRounds() && !rounds;
    goBtn.disabled = !packs.length || emptied;
    if (!packs.length) {
      goBtn.textContent = 'Drag a pack in to launch';
      return;
    }
    if (emptied) {
      goBtn.textContent = 'Every round is switched off';
      return;
    }
    if (packs.length < 2) {
      // It has to name what will actually be PLAYED — "Launch The 1980s Pop
      // Music Quiz" over a pack with two of its three rounds switched off is
      // the console and the projector disagreeing before the night has even
      // started.
      goBtn.textContent = rounds === roundsOf(packs[0]).length
        ? `Launch ${packs[0].title}`
        : `Launch ${packs[0].title} — ${rounds} round${rounds === 1 ? '' : 's'}`;
      return;
    }
    goBtn.textContent = `Launch tonight — ${packs.length} packs, ${rounds} round${rounds === 1 ? '' : 's'}`;
  }

  /**
   * ONE LINE THAT SAYS EVERYTHING ELSE — where, when, and what for.
   *
   * ALL THREE ARE READ, none is a control: the venue is picked once, at the
   * head of the bar. Two controls for one field is how a night gets launched
   * with the setting the other one was showing.
   *
   * It was three squares the same size as the pack slots above, which said
   * they were the same KIND of thing: something you drag onto. They are not —
   * they are three short facts somebody READS, and dressed as targets they
   * took as much room as the targets while doing none of the work.
   *
   * Tonight sits at the top of EVERY tab, so its height is charged to every
   * page in the console. Slots, a line, a button — that is the whole section,
   * and it now fits in a glance rather than a scroll.
   *
   * **THE VENUE STAYS A BUTTON.** It is the only way into the venue picker
   * from here, and CLAUDE.md is explicit that the venue is chosen in one place
   * and nowhere else. Losing it to a tidy-up would take the choice with it.
   */
  function infoLine() {
    const name = venueNow();
    const record = (library.venueRecords || [])
      .find((v) => (v.name || '').toLowerCase() === String(name).toLowerCase());
    const prizes = ((record && record.rewards) || []).map((r) => String(r || '').trim()).filter(Boolean);

    // What time tonight starts, if the diary says. A residency carries none —
    // the venue's arrangement lives in no record here — so this is silent
    // rather than inventing one.
    const on = upcoming({
      venues: library.venueRecords || [],
      bookings: library.bookings || [],
      weeks: 1,
    }).find((n) => n.date === nightKey() && (!name || n.venue.toLowerCase() === String(name).toLowerCase()));

    const prizeSaid = prizes.length
      ? `${prizes[0]}${prizes.length > 1 ? ` +${prizes.length - 1}` : ''}`
      : 'no prizes';

    /*
     * THE VENUE HERE IS A FACT, NOT A SECOND WAY TO CHANGE IT — reported
     * directly: *"there's two places to select venue."* There were, and this
     * was the other one. The picker at the top of the bar is the single
     * control now, and it looks like one (see `.lb-where`), so a second
     * entrance mid-sentence is the "two controls for one field" fault this
     * file already records for the venue itself.
     *
     * It also removes a real collision: as a button this carried an invisible
     * 15px-tall tap overlay above and below itself, which reached into the
     * lines either side of it.
     */
    return node(`
      <div class="lb-say">
        <b class="lb-say-venue">${esc(name || 'No venue yet')}</b>
        <span class="lb-say-bit">${esc(record && record.usualNight ? 'your usual night' : (name ? 'one-off' : 'sets the prizes'))}</span>
        <span class="lb-say-bit">${esc(on && on.time ? `starts ${saidTime(on.time)}` : 'start when you like')}</span>
        <span class="lb-say-bit">${esc(`for ${prizeSaid}`)}</span>
      </div>`);
  }

  /*
   * A PACK — OR NOW A SINGLE ROUND — DROPPED ON THE STRIP JOINS THE NIGHT.
   *
   * `stopPropagation` on both, or the section's own handler underneath would
   * also fire and REPLACE the night with the pack that was just added to it.
   *
   * IN MIXED MODE, A DROP LANDING EXACTLY ON ONE TILE IS HANDLED THERE
   * FIRST, not here — `renderSlots()`'s own per-tile `drop` clears
   * `shelfRoundDrag`/`packDrag` before this listener ever runs, since a
   * child's handler runs before the bubbled event reaches this one. So this
   * one only ever fires for a genuine near-miss (nothing under the cursor
   * claimed it), never a double-add on top of a precise tile drop.
   */
  orderEl.addEventListener('dragover', (ev) => {
    if (!packDrag && !shelfRoundDrag) return;
    ev.preventDefault();
    ev.stopPropagation();
    ev.dataTransfer.dropEffect = 'copy';
    orderEl.classList.add('drop-here');
  });
  orderEl.addEventListener('dragleave', (ev) => {
    if (!orderEl.contains(ev.relatedTarget)) orderEl.classList.remove('drop-here');
  });
  /**
   * A PACK JOINS THE NIGHT IN THE NEXT FREE SLOT — from wherever it was dropped.
   *
   * **This is one function because it used to be two, and they disagreed.**
   * Dropping ON the slots appended to the running order; dropping anywhere ELSE
   * on the section — a drag that stopped an inch short, which is most of them —
   * went through `pick()`, and `pick()` starts a new night: it clears `lbExtra`
   * and `lbOff`, so a mis-aimed drop silently threw away every other pack the
   * host had lined up and replaced the evening with the one card they were
   * holding. Reported as *"it clears the console and just applies the new
   * one"*, and it is the worst class of bug this bar can have — the damage is
   * invisible until Launch, and the thing destroyed is the setup work.
   *
   * **A drop on the section is a drop on the night.** There is no part of this
   * panel where letting go should mean something different, which is exactly
   * why the two paths were never going to stay in step.
   */
  function addPackToNight(from, kind = gameOf().id) {
    if (!from) return;
    /*
     * THE FIRST PACK IS THE NIGHT; the rest are added to it. With nothing
     * chosen there is no Launch button and no settings yet — `pick()` builds
     * both — so the first drop goes through the ordinary path and only the
     * second one composes. That also means a night made of one pack is a
     * completely ordinary night, sending no running order at all.
     */
    if (!currentPack) {
      /*
       * `pick()` derives its own kind from `gameOf()` — the picker's OWN
       * selection — rather than trusting what it is handed, so a bingo pack
       * dropped straight onto the tiles while the picker was still on quiz
       * launched as a quiz with a bingo pack's id and 400'd. Every OTHER
       * entry point (the outer section's own drop, `packWanted`) already
       * syncs the picker first for exactly this reason; this one has to too.
       */
      if (gamePick && kind && gamePick.value !== kind) {
        gamePick.value = kind;
        lbGame = kind;
      }
      pick(from);
      return;
    }
    /*
     * BINGO JOINING AN EXISTING NIGHT — OR A ROUND ALREADY SPLIT APART — IS
     * THE MIXED ROW, not `lbExtra`. Once `lbSlots` exists every later add
     * goes this way too, quiz or bingo, so the night never has to decide
     * between two systems mid-build. `slotsFromSimple()` is only ever called
     * ONCE, the moment there was nothing to convert from.
     */
    if (kind === 'bingo' || lbSlots) {
      if (!lbSlots) lbSlots = slotsFromSimple({ currentPack, lbExtra, lbOff, packOf });
      lbSlots = kind === 'bingo' ? addBingoSlot(lbSlots, from) : addQuizPackSlot(lbSlots, from);
      paintOrder();
      return;
    }
    // The same pack twice is a mis-drop rather than an intention — a night
    // does not play the same ten questions in rounds two and four.
    if (lbPacks().some((p) => p.id === from.id)) { paintOrder(); return; }
    if (lbPacks().length >= PACK_SLOTS) {
      alert(`There are only ${PACK_SLOTS} slots. Take one out to add another.`);
      return;
    }
    const rounds = activeRounds().length + (from.rounds || []).length;
    if (rounds > MAX_NIGHT_ROUNDS) {
      alert(`A night can have at most ${MAX_NIGHT_ROUNDS} rounds — that would make ${rounds}.`);
      return;
    }
    lbExtra.push(from.id);
    paintOrder();
  }

  /**
   * A SINGLE ROUND, DROPPED SOMEWHERE ON THE STRIP RATHER THAN ON ONE
   * PARTICULAR TILE — added onto the end. Landing exactly on a tile goes
   * through `renderSlots()`'s own drop target instead, which places it
   * exactly where it was aimed; this is the fallback for a drag that stopped
   * an inch short, the same reasoning `addPackToNight` above already gives
   * for a whole pack.
   *
   * Never the whole pack it came from — with nothing chosen yet this is what
   * STARTS the night, so `pick()` runs first for its title, its venue
   * defaults and its Launch button (the same "nothing chosen yet" branch
   * `addPackToNight` takes), and `lbSlots` is then set directly to just the
   * one round rather than through `slotsFromSimple()` — which would bring
   * in every OTHER round of that pack too, the opposite of what dragging one
   * round on its own is asking for.
   */
  function addRoundToNight(round) {
    if (!round) return;
    const pack = anyPack(round.packId);
    if (!pack) return;
    if (!currentPack) {
      if (gamePick && gamePick.value !== 'quiz') { gamePick.value = 'quiz'; lbGame = 'quiz'; }
      pick(pack);
      lbSlots = [{ kind: 'quiz', packId: pack.id, rounds: [round.round] }];
      paintOrder();
      return;
    }
    if (!lbSlots) lbSlots = slotsFromSimple({ currentPack, lbExtra, lbOff, packOf: anyPack });
    lbSlots = moveRoundToSlot(lbSlots, { packId: round.packId, round: round.round }, lbSlots.length);
    paintOrder();
  }

  orderEl.addEventListener('drop', (ev) => {
    if (!packDrag && !shelfRoundDrag) return;
    ev.preventDefault();
    ev.stopPropagation();
    orderEl.classList.remove('drop-here');
    if (shelfRoundDrag) {
      const round = shelfRoundDrag;
      setShelfRoundDrag(null);
      dragging(false);
      addRoundToNight(round);
      giveTheFoldBack();
      return;
    }
    const dropped = packDrag;
    setPackDrag(null);
    dragging(false);
    addPackToNight(packOnShelf(dropped.kind, dropped.id), dropped.kind);
    // However you left it — see `openForDrop`. The bar opened to be aimed at,
    // not to stay open.
    giveTheFoldBack();
  });

  el.addEventListener('dragover', (ev) => {
    if (!packDrag && !shelfRoundDrag && !venueDrag && !showDrag) return;
    ev.preventDefault();
    ev.dataTransfer.dropEffect = 'copy';
    el.classList.add('drop-here');
    openForDrop();
  });
  el.addEventListener('dragleave', (ev) => {
    // Only when the cursor has actually left the section, not when it crosses
    // from one child of it to another — which fires dragleave on the way.
    if (!el.contains(ev.relatedTarget)) {
      el.classList.remove('drop-here');
      // Carried the card away again — put the fold back. Coming back re-opens
      // it through `dragover`, so this cannot strand a folded bar mid-gesture.
      giveTheFoldBack();
    }
  });
  el.addEventListener('drop', (ev) => {
    if (!packDrag && !shelfRoundDrag && !venueDrag && !showDrag) return;
    ev.preventDefault();
    el.classList.remove('drop-here');
    openForDrop();

    /*
     * A SINGLE ROUND, DROPPED NEAR THE BAR BUT OUTSIDE THE STRIP ITSELF —
     * `orderEl`'s own drop already handles a landing on the tiles or the
     * strip round them; this is the same near-miss fallback `addPackToNight`
     * already gets below.
     */
    if (shelfRoundDrag) {
      const round = shelfRoundDrag;
      setShelfRoundDrag(null);
      dragging(false);
      giveTheFoldBack();
      addRoundToNight(round);
      return;
    }

    /*
     * A WHOLE EVENING DROPPED IN. It goes through `loadShow`, which is the
     * same path the Shows tab's own tap uses — one way for a show to reach the
     * bar, so a drag and a tap cannot come to mean different things. It
     * re-renders, so nothing below here may run afterwards.
     */
    if (showDrag) {
      const show = showDrag;
      setShowDrag(null);
      dragging(false);
      giveTheFoldBack();
      loadShow(show);
      return;
    }

    /*
     * A VENUE DROPPED IN GOES THROUGH `chooseVenue`, which is the same path
     * the picker in the head uses — one way for a venue to be set, so the two
     * cannot end up meaning different things.
     */
    if (venueDrag) {
      const name = venueDrag.name;
      setVenueDrag(null);
      dragging(false);
      giveTheFoldBack();
      if (name) chooseVenue(name);
      return;
    }

    const dropped = packDrag;
    setPackDrag(null);
    dragging(false);
    /*
     * A pack from the other game switches the picker first — but ONLY when
     * there is nothing playing yet. Once a night is under way, a different
     * kind joins it through the mixed row instead (`addPackToNight` below),
     * which is the whole point of this feature: a night that changes kind
     * partway is exactly what quiz -> bingo -> quiz needs, not something to
     * still be refused.
     */
    if (!currentPack && gamePick && dropped.kind && gamePick.value !== dropped.kind) {
      gamePick.value = dropped.kind;
      lbGame = dropped.kind;
    }
    /*
     * THE SAME PATH AS A DROP ON THE SLOTS — see `addPackToNight`. This used to
     * call `pick()` directly, which is what made a drag that stopped short wipe
     * the running order.
     */
    addPackToNight(packOnShelf(dropped.kind, dropped.id), dropped.kind);
    giveTheFoldBack();
  });

  /*
   * TAKING IT BACK OUT. The chosen pack is itself draggable, and a drag that
   * ends anywhere outside the section clears the choice. Nothing is deleted:
   * `currentPack = null` is the state the bar arrives in, so it goes straight
   * back to offering what is on the big screen.
   */
  text.setAttribute('draggable', 'true');
  text.addEventListener('dragstart', (ev) => {
    if (!currentPack) { ev.preventDefault(); return; }
    offDrag = true;
    ev.dataTransfer.effectAllowed = 'move';
    ev.dataTransfer.setData('text/plain', currentPack.title);
  });
  text.addEventListener('dragend', (ev) => {
    if (!offDrag) return;
    offDrag = false;
    // Dropped back on the section itself? Then nothing was asked for.
    if (el.contains(document.elementFromPoint(ev.clientX, ev.clientY))) return;
    currentPack = null;
    text.value = '';
    chosen.hidden = true;
    whyEl.textContent = '';
    paintLive();
    paintSettings();
    paintAlt();
  });

  const toggleFold = () => {
    tonightOpen = !tonightOpen;
    localStorage.setItem(TONIGHT_STORE, tonightOpen ? '1' : '0');
    paintFold();
  };
  fold.addEventListener('click', (ev) => { ev.stopPropagation(); toggleFold(); });
  el.querySelector('.lb-head').addEventListener('click', () => { if (!tonightOpen) toggleFold(); });

  /**
   * A SAVED NIGHT GOES BACK INTO THE BAR — every field of it, in one move.
   *
   * **A show is a saved launch**, so this is the exact inverse of the object
   * `doLaunch` sends: the packs, which rounds are on, where, in the room or
   * online, and every setting. Nothing is left for somebody to remember, which
   * is the whole reason to build a night in advance.
   *
   * **THE RUNNING ORDER IS REBUILT INTO THE TWO THINGS THE BAR ACTUALLY
   * HOLDS**, rather than stored a third way: the packs become `lbExtra` and
   * everything the order leaves out becomes `lbOff`. That mapping is exact,
   * because `nightOrder()` derives the order from those two and nothing else —
   * and it means a loaded show can be edited with the same ticks and drags as
   * a night built by hand, which a separate "a show is loaded" mode would not.
   *
   * **IT NEVER LAUNCHES.** `startOn()` runs immediately after this and calls
   * `pick(currentPack, { quiet: true })`, and quiet is what stops a re-render
   * putting something on the projector. Dropping a show in fills the bar and
   * leaves the finger on the button — the same promise dragging a pack makes.
   *
   * **A PACK THAT HAS GONE IS SAID, NOT SKIPPED.** Silently launching four
   * rounds of a five-round night you built last week is the fault
   * `composeQuiz()` already refuses to commit at the server; saying so here is
   * the same refusal, days earlier, where it can still be fixed.
   */
  function applyShow(show, at = 0) {
    showWanted = null;
    /*
     * ONE PART AT A TIME, and the bar SAYS what follows.
     *
     * A show is an evening — a quiz, then the bingo — but the launch bar runs
     * one game, because the engine does: `session.launch()` builds one game
     * and the projector shows one game. So the bar opens on the part you are
     * about to play and `paintThen()` names the next one, with a button that
     * loads it when the first is done.
     *
     * **THAT IS THE HONEST SHAPE RATHER THAN A COMPROMISE.** A combo night's
     * bingo starts when the quiz has finished, the scores are up and the
     * prizes are handed out — which is a moment only the person on the mic
     * can identify. Auto-advancing would take that decision off them, in
     * front of a room, on the protected path.
     */
    const item = itemsOf(show)[at];
    if (!item) return;
    showRunning = { show, at };
    if (gamePick && item.kind && gamePick.value !== item.kind) gamePick.value = item.kind;
    if (item.kind) lbGame = item.kind;
    const shelf = gameOf().packs;
    const ids = (item.order && item.order.length)
      ? [...new Set(item.order.map((r) => r.packId))]
      : [String(item.packId || '')];
    /*
     * A PACK THAT HAS GONE IS DROPPED SILENTLY HERE, because `loadShow()` has
     * already said so in a banner above the bar. It has to be said on that
     * side of the render — `render()` builds `doneBanner()` before it builds
     * this — and saying it twice would be worse than saying it once.
     */
    const here = ids.filter((id) => shelf.some((p) => p.id === id));
    if (!here.length) return;
    currentPack = shelf.find((p) => p.id === here[0]);
    lbExtra = here.slice(1);
    lbOff = new Set();
    lbSlots = null;
    if (item.order && item.order.length) {
      const on = new Set(item.order.map((r) => offKey(r.packId, r.round)));
      for (const pack of lbPacks()) {
        for (const r of roundsOf(pack)) {
          if (!on.has(offKey(r.packId, r.round))) lbOff.add(offKey(r.packId, r.round));
        }
      }
    }
    /*
     * THE VENUE IS LEFT OPEN, whatever the show carries — see the note on
     * `tonightAsShow()`. Loading a saved night leaves `lbVenue` alone, so
     * tonight's own answer (the diary, or a venue already picked) still
     * stands, and a show saved before this change cannot drag last month's
     * pub in with it. This is the READING half of "the venue is never
     * saved"; both halves are needed, or an old show would still restore one.
     */
    lbOnline = Boolean(show.online);
    night.look = String(show.look || '');
    night.lobbyGame = String(show.lobbyGame || '');
    // Both halves default to ON wherever the field could be absent — the same
    // rule the lobby sound follows everywhere else.
    night.lobbySound = show.lobbySound !== false;
    night.teamPlay = Boolean(show.teamPlay);
    night.shape = (show.shape && show.shape.rows && show.shape.cols)
      ? { rows: Number(show.shape.rows), cols: Number(show.shape.cols) } : null;
    night.prizes = Math.max(0, Math.min(5, Number(show.prizes) || 0));
    /*
     * WHAT HAPPENS IN THE GAPS — restored, and it is one of the things a show
     * is FOR. A break plan is exactly the sort of decision worth making days
     * early at a laptop rather than ten minutes before a gig, which is what
     * the whole feature exists for.
     *
     * It restores UNPRUNED and `paintOrder()` prunes it a moment later against
     * the parts the show actually loaded — so a show whose pack has lost a
     * round drops that break rather than carrying a setting for a gap that
     * cannot happen.
     */
    night.breaks = (show.breaks && typeof show.breaks === 'object') ? { ...show.breaks } : {};
    lbBreakOpen = '';
  }
  if (showWanted) applyShow(showWanted);
  if (packWanted) {
    const want = packWanted;
    packWanted = null;
    // Switches the picker only when starting fresh — see the drop handler's
    // own note on why a night already under way goes through the mixed row.
    if (!currentPack && gamePick && want.kind && gamePick.value !== want.kind) {
      gamePick.value = want.kind;
      lbGame = want.kind;
    }
    addPackToNight(packOnShelf(want.kind, want.id), want.kind);
  }
  /*
   * AFTER the pack, never before: a tap on a round of a pack that is not in
   * the bay yet has to find the pack on the shelf, and `addRoundToNight()`
   * does that for itself — but if both were ever wanted at once, the pack
   * has to land first or the round would be moved out of a slot that does
   * not exist.
   */
  if (roundWanted) {
    const want = roundWanted;
    roundWanted = null;
    addRoundToNight(want);
  }
  if (venueWanted) { const name = venueWanted; venueWanted = null; chooseVenue(name); }

  paintMode();
  startOn();
  paintThen();
  return el;
}

/**
 * TONIGHT AS A SHOW — the object that would be saved if you pressed Save now.
 *
 * Read off the SAME module-level state the launch reads, deliberately, so a
 * saved show and the night that would have been launched cannot differ. It is
 * the one thing that would make this feature worse than useless: a show that
 * plays something other than what was on the bar when you saved it.
 *
 * `order` is null for an ordinary one-pack night, exactly as at launch, and
 * `normalise()` on the server drops it — so a plain night saved as a show
 * launches down the road it always did rather than through the composer.
 *
 * **THE VENUE IS DELIBERATELY NOT SAVED, and that reverses an earlier
 * decision.** It used to ride along with everything else, on the reasoning
 * that a show is a whole evening and the venue is part of one. The host
 * killed that with the case it never survives: *"saving everything INCLUDING
 * the venue is pointless, there's no way you'd want to run the same quiz at
 * the same venue again — but if it could be saved and the venue left open
 * that would be useful."*
 *
 * He is right, and it is the difference between a RECORD and a TEMPLATE. A
 * saved night is reached for precisely when you are somewhere new and want a
 * running order that worked; carrying the old venue in means the first thing
 * it does on landing is file tonight under last month's pub, and the prizes
 * and the voucher follow the venue — so a wrong one is somebody refused a
 * drink at the bar, which this file already records as the expensive half of
 * a venue mix-up.
 *
 * **Nothing has to be migrated.** Shows saved before this still carry a
 * `venue` field; `applyShow()` simply stops reading it, so an old one loads
 * with the venue left open exactly like a new one.
 */
function tonightAsShow(name) {
  if (!currentPack) return null;
  const packs = [currentPack.id, ...lbExtra];
  const kind = (library.bingo || []).some((p) => p.id === currentPack.id) ? 'bingo' : 'quiz';
  const rounds = [];
  for (const id of packs) {
    const pack = [...(library.quizzes || []), ...(library.bingo || [])].find((p) => p.id === id);
    (pack && pack.rounds ? pack.rounds : []).forEach((_, i) => {
      if (!lbOff.has(`${id}:${i}`)) rounds.push({ packId: id, round: i });
    });
  }
  const plain = packs.length < 2 && !lbOff.size;
  return {
    name,
    kind,
    packId: currentPack.id,
    ...(plain || kind === 'bingo' ? {} : { order: rounds }),
    // NO VENUE — see the note above. A saved night is a running order to
    // reuse somewhere else, and the venue is the one field that is never
    // true twice.
    online: lbOnline,
    look: night.look,
    lobbyGame: night.lobbyGame,
    lobbySound: night.lobbySound,
    teamPlay: night.teamPlay,
    shape: night.shape,
    prizes: night.prizes,
    // Saved with the prizes and the look, and for the same reason: these are
    // facts about the EVENING, which is what a show is. The venue is still
    // deliberately not here — see the note above.
    breaks: night.breaks,
  };
}

/**
 * "March", "last year" — short enough to sit on a button.
 *
 * Deliberately vague past a few months: the question this answers is "have
 * they heard it recently", and to a decimal place that is not a question
 * anybody asks.
 */
/**
 * When a pack was last played, as a NUMBER, whatever was written down.
 *
 * `library.js` stores `lastPlayedAt` as epoch milliseconds and this file was
 * reading it with `Date.parse`, which takes a STRING — `Date.parse(1786…)` is
 * NaN. Two things fell out of that and neither showed up as an error:
 *
 * - the quick-launch chip read **"Last played"** with nothing after it, on
 *   every pack that had actually been played;
 * - and worse, the whole quick-pick PRIORITY was inert. `Date.parse(…) || 0`
 *   made every pack sort as 0, so "never played first, then longest ago"
 *   never happened and the pack you ran last night could be the first thing
 *   offered. The list still looked perfectly plausible, which is why it
 *   survived.
 *
 * One reader, used by both, so they cannot disagree again. It takes a string
 * too, because a pack file written before the counts were numbers may still
 * carry one and quietly dropping it would put an old pack at the front of a
 * list that means "least likely to have been heard".
 */
export function playedAt(at) {
  if (typeof at === 'number') return Number.isFinite(at) ? at : 0;
  const then = Date.parse(at || '');
  return Number.isFinite(then) ? then : 0;
}

/**
 * WHERE TONIGHT IS, readable from outside `launchBar()`'s closure.
 *
 * The bar's own `venueNow()` is inside that closure because it needs the
 * picker; this is the same answer for everybody else — the pack shelf, which
 * has to rank on it (see `heardHere()` below). One function, so the shelf and
 * the bar can never disagree about which venue tonight is.
 */
export function venueTonight() {
  return lbVenue !== null ? lbVenue : ((tonightsVenue() || {}).name || '');
}

/**
 * EVERY KEY TONIGHT'S VENUE ANSWERS TO in `playedByVenue` — its id AND its
 * name, because a night can have been filed under either.
 *
 * **Both, deliberately, and it is the same split `venueHeadcounts()` was
 * already bitten by**: a venue picked off the Venues list is filed under
 * `id:xyz` and the same pub typed freehand is filed under `the crown`. Every
 * night from before venue ids existed is in the second group, and that is
 * most of anybody's history — so asking under one key alone would report a
 * pack as never heard here on exactly the venue it has been run at for a
 * year. `src/heard.js` files a night under both; this asks under both.
 *
 * The id goes FIRST, so a renamed pub still finds the nights it ran under
 * its old name.
 */
function venueKeysNow() {
  const name = String(venueTonight() || '').trim();
  if (!name) return [];
  const rec = (library.venueRecords || [])
    .find((v) => String(v.name || '').toLowerCase() === name.toLowerCase());
  const keys = [];
  if (rec && rec.id) keys.push(`id:${rec.id}`);
  keys.push(name.toLowerCase());
  return keys;
}

/**
 * WHEN THIS VENUE LAST HEARD THIS PACK — the number the shelf ranks on.
 *
 * Asked for directly: *"if you've done a quiz at venue A and not at venue B
 * recently then this needs to be factored in."* A pack run at The Crown on
 * Tuesday is completely fresh at The Station Tap on Thursday, and ranking on
 * the global date buried it at both.
 *
 * **WITH NO VENUE CHOSEN IT FALLS BACK TO THE GLOBAL DATE**, which is the
 * honest answer rather than a guess: nothing is known about where tonight is,
 * so "have I run this lately" is the best question left. That is also exactly
 * what the ranking did before this existed, so a night with no venue behaves
 * as it always has.
 */
export function heardHere(pack) {
  const keys = venueKeysNow();
  if (!keys.length) return playedAt(pack.lastPlayedAt);
  const index = library.playedByVenue || {};
  // The LATEST across the keys this venue answers to: a pub run under a name
  // for a year and off the book since is one room, not two.
  const at = Math.max(0, ...keys.map((k) => Number((index[k] || {})[pack.id]) || 0));
  /*
   * NEVER PLAYED HERE READS AS NEVER PLAYED, FULL STOP — 0, not the global
   * date. That is the whole feature: a pack this room has not heard should
   * rank alongside one nobody has heard anywhere, however often it has been
   * run down the road.
   */
  return playedAt(at || 0);
}

/** Whether the answer above is about THIS venue rather than the diary at large. */
export function heardHereIsLocal() {
  return venueKeysNow().length > 0;
}

/**
 * WHY A PACK IS BEING OFFERED, in the same terms it was RANKED on.
 *
 * The word "here" is doing real work: once the order is per venue, a line
 * saying "Never played" over a pack you ran at another pub last week is
 * simply wrong, and the reader has no way to tell which question was asked.
 * This app has been bitten before by an order and its own explanation
 * drifting apart — the launch bar's whole live-drift line exists for that —
 * so the two come from one place.
 */
export function whyFresh(pack) {
  const local = heardHereIsLocal();
  const at = heardHere(pack);
  if (!at) return local ? 'Never played here' : 'Never played';
  return local ? `Last played here ${whenShort(at)}` : `Last played ${whenShort(at)}`;
}

function whenShort(at) {
  const then = playedAt(at);
  if (!then) return '';
  const days = Math.floor((Date.now() - then) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 365) return new Date(then).toLocaleDateString('en-GB', { month: 'long' });
  return 'over a year ago';
}

/*
 * A LOADED PACK IS NOT A NIGHT.
 *
 * A session always has a pack — `boot()` falls back to one so the projector is
 * never blank — so the console said "Now: The 1980s Pop Music Quiz (0 in)" in
 * the topbar and drew a panel underneath saying "Loaded, nobody playing", with
 * a Stop button, over a quiz the account had never launched. On a
 * quizmaster's very first sign-in that is the first thing they read.
 *
 * A night is on once it is LIVE, or once somebody has joined. Before that the
 * launch bar has the top of the page to itself, which is also what a first
 * sign-in should be about. One test, used by the topbar and the panel, or the
 * two of them disagree about whether anything is happening.
 */
export function aNightIsOn(running) {
  return Boolean(running) && (running.phase !== 'lobby' || running.playerCount > 0);
}

/**
 * STOP WHATEVER IS RUNNING — shared by the running panel's own Stop button
 * and the launch bar's own quick stop beside the live-drift warning, so the
 * two cannot end up with different confirm wording or a different call.
 * Reads `library.running` fresh rather than taking it as a parameter, since
 * that is what both callers already agree on.
 */
async function stopRunningNight(button) {
  const running = (library && library.running) || {};
  const n = running.playerCount;
  const alsoKicks = n
    ? `\n\n${n} ${n === 1 ? 'phone is' : 'phones are'} in, and will have to scan and join again.`
    : '';
  if (!confirm(`Stop "${running.title}"?\n\nScores and cards are cleared and it goes back to waiting.${alsoKicks}`)) return;
  button.disabled = true;
  const was = button.textContent;
  button.textContent = 'Stopping…';
  try {
    await postJson('/api/host/resetAll', {}, { 'X-Host-Key': hostKey });
    await load();
  } catch (err) {
    alert(`Could not stop it: ${err.message}`);
    button.disabled = false;
    button.textContent = was;
  }
}

export function runningPanel(running) {
  if (!aNightIsOn(running)) return node('<div></div>');
  // An owner runs no nights, so there is no night of theirs to show or stop.
  // Their room is the house one, and driving it from here would be a Stop
  // button over a game somebody else is in the middle of.
  if (!can(FEATURES.QUIZ) && !can(FEATURES.BINGO)) return node('<div></div>');
  const live = running.phase !== 'lobby' && running.phase !== 'finished';
  const what = running.game === 'bingo' ? 'Music bingo' : 'Music quiz';
  const who = `${running.playerCount} playing`;
  const el = node(`
    <div class="panel running ${live ? 'live' : ''}">
      <h3>${live ? 'Running now' : 'Loaded, nobody playing'}</h3>
      <div class="running-row">
        <div>
          <div class="running-title">${esc(running.title)}</div>
          <div class="tiny">${esc(what)} — ${who}</div>
          ${running.at ? `<div class="running-at">${esc(running.at)}</div>` : ''}
          ${nowNextRows(running)}
        </div>
        <div class="running-links">
          <a class="go control-link" href="${linkTo('/host')}">${live ? 'Take control' : 'Open the controls'}</a>
          <a class="minor" href="${screenLink()}" target="_blank" rel="noopener">Big screen</a>
          ${running.finished ? '<button class="minor invoice-it" title="Bill for this one">Invoice this</button>' : ''}
          <button class="minor danger stop-running" title="Clear it and go back to waiting">Stop</button>
        </div>
      </div>
      ${running.finished ? `
        <!-- THE END OF THE NIGHT, AS A STEP RATHER THAN A HOPE.
             Asked for on 17 August 2026: "you finish the night on the console,
             do your well dones and thank yous, and the console prompts you to
             check the photos as the very next step".
             It replaces an argument about AUTO-publishing the gallery, and it
             is the better answer. Publishing at the final scores would have
             gone out before the night's last photographs arrived — uploads are
             not phase-gated and the winner announcement is peak photo time —
             and it would have removed the safeguard that matters most: the
             publish control sits under the photographs so that nobody
             publishes a night without having just looked at what is in it.
             This keeps the looking and makes the app ASK for it. -->
        <div class="night-done">
          <div>
            <b>That's the night done.</b>
            <div class="tiny">Check the photos before you pack up — it is the last
              moment anybody is still around to ask about one.</div>
          </div>
          <button class="go see-photos" type="button">Check the photos</button>
        </div>` : ''}
    </div>`);

  /*
   * Straight to tonight's own photographs, on the Post gig door.
   *
   * The night goes on that door's BENCH — the mechanism it already has for
   * "the night I am working on" — and the key is the 6am roll-over one, the
   * same as `nightOfGig()` and the photos themselves, so a quiz that finished
   * at half past midnight lands on the night it belongs to rather than on
   * tomorrow with no photos under it.
   */
  el.querySelector('.see-photos')?.addEventListener('click', () => {
    const key = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString().slice(0, 10);
    putNightOnBench(key);
    location.href = linkTo('/console?door=post&tab=past');
  });

  /*
   * Bill for the night that has just finished, from where you already are.
   *
   * It appears only once a game has actually ended, and it fills the venue and
   * the date in from the night itself — so the usual case is picking the
   * customer, checking a number you already agreed weeks ago, and pressing
   * send. This is the whole point of the feature: at half eleven, an invoice
   * that needs ten minutes of typing is an invoice that gets sent on Sunday, or
   * not at all.
   */
  el.querySelector('.invoice-it')?.addEventListener('click', async () => {
    try {
      setBook(await invoiceApi('/api/invoices'));
    } catch (err) {
      alert('Could not open the invoices: ' + err.message);
      return;
    }
    openInvoiceForm({
      event: { title: running.game === 'bingo' ? 'Music bingo night' : 'Music quiz night', date: new Date().toISOString().slice(0, 10) },
      description: running.game === 'bingo' ? 'Music bingo night' : 'Music quiz night',
    }, () => load());
  });

  /*
   * Stop whatever is running, from here.
   *
   * The control view can end a game, but you have to know that and go there.
   * From the console the only way out was to launch something else over the
   * top of it, which is a odd way to say "I am finished with this one".
   *
   * It clears scores, cards and players and leaves the pack loaded and
   * waiting — the same state as just after a launch. Nothing is deleted.
   */
  el.querySelector('.stop-running')?.addEventListener('click', (ev) => stopRunningNight(ev.currentTarget));

  return el;
}

/** "Thursday". Only ever used to suggest a name — nothing is filed by it. */
