/**
 * The console's shared state — the bindings more than one module WRITES.
 *
 * An ES import is a read-only view of its module's binding, so a `let` that
 * two files assign to cannot live in either of them. Those are here, each with
 * a setter; everything else stays with the one module that writes it. Reads
 * need no setter — a live binding reads fine from anywhere, which is why the
 * ~350 read sites across the console did not have to change.
 *
 * This module imports nothing. It is the one leaf in the console's graph, so
 * state can never be caught half-initialised by an import cycle.
 */

export let library = null;
/**
 * What this account is allowed to do.
 *
 * Fetched once at boot and used to decide which tabs exist. The enforcement is
 * entirely server-side — this only decides what to draw, so a fiddled copy in
 * a browser gets a tab that answers 403.
 */
export let me = null;
/**
 * What the last job said, kept outside the panel that said it.
 *
 * A finished import or generation calls load(), which rebuilds the whole page
 * from the library — and took the result with it. You pressed Import, watched
 * it work, and were left looking at an empty form with no word either way. The
 * pack WAS there, in the grid below, but nothing said so.
 *
 * So the result is held here and drawn at the top on every render. It stays up
 * until you dismiss it or start another job, which is right for something you
 * might walk away from mid-generation.
 */
export let lastDone = null;

// Whether this app has any accounts. Asked once at boot rather than on every
// render, because `render` is synchronous — it runs on every state change and
// an await in it would make the whole page repaint asynchronously for a
// question nobody asks twice.
export let accountsExist = true;

/*
 * The pack being dragged, if any. Module level because a drag crosses two
 * elements and `dataTransfer` cannot be read during `dragover` — the one
 * moment the bar needs to know whether what is over it is a pack.
 */
export let packDrag = null;

/**
 * A VENUE being dragged up to Tonight, from the Venues tab.
 *
 * Same gesture as a pack and the same target, because they are the two facts
 * that place a night: which room, and what is being played in it. The venue
 * picker in the head stays exactly as it was — drag is the mouse's way and
 * that is the thumb's, and HTML5 drag events do not fire on touch at all.
 *
 * ADVERTS ARE DELIBERATELY NOT DRAGGABLE. Slides belong to a VENUE by design
 * (`src/adverts.js` — *"your Tuesday pizza deal goes up between every round,
 * every week"*), so dropping the venue in brings its adverts with it and
 * there is nothing left to drag. And a slide is chosen LIVE on the control
 * view between rounds, not at launch, so there is no "tonight's advert" to
 * drop into without inventing one. What was actually awkward — the picker
 * offering every venue's slides mid-gig — is fixed where it happens, in
 * `host.js`, by putting tonight's venue first.
 */
export let venueDrag = null;

/**
 * A SHOW being dragged up to Tonight — the whole evening at once.
 *
 * The third thing that can be dropped on the bar, after a pack and a venue,
 * and it is the one that makes the other two optional: *"we're frankensteining
 * nights instead of having a nights section — you build a night in advance and
 * then just drag it in onto the launch console."*
 */
export let showDrag = null;

/**
 * WHAT IS ON THE WORKSHOP BENCH — a pack id and its kind, or null.
 *
 * The Console's half of this is Tonight; this is the Workshop's, asked for in
 * the same breath: *"the workshop needs a section at the top identical in size
 * to the launch section in the console — I can then drag quiz packs there to
 * edit them as a QM, or start a fresh one."*
 *
 * **ONE pack, not a list, and that is the difference between the two doors.**
 * Tonight composes an evening out of several packs, so it holds a running
 * order; the bench is for working on ONE thing, and a bench with six slots
 * would be inviting a job nobody does. `TODO.md` called this before either
 * was built: a list where the job is composition, one where it is editing.
 *
 * On the device, because the thing you were half way through editing is still
 * the thing you were half way through editing after a reload — which is the
 * whole reason a bench beats a button.
 */
export const BENCH_STORE = 'musicquiz.bench';
export let bench = (() => {
  try { return JSON.parse(localStorage.getItem(BENCH_STORE) || 'null'); } catch { return null; }
})();

/**
 * THE NIGHT ON THE POST GIG BENCH — a night key, or null.
 *
 * Same shape as the Workshop's, because it is the same idea behind a different
 * door: *"I think I need a bench in the post gig bit as well."* Its cargo is a
 * NIGHT rather than a pack, which is the thing every job on that door is about
 * — bill it, show it to the venue, put it on the gallery.
 *
 * **A key rather than the night object.** The archive is re-read on every
 * visit to that tab, so holding the record would mean holding a copy that goes
 * stale the moment a prize is claimed or a photo is deleted. The key is looked
 * up against what was just fetched, exactly like the Workshop bench looks its
 * pack up against the shelf.
 */
export const NIGHT_BENCH_STORE = 'musicquiz.nightbench';
export let nightBench = localStorage.getItem(NIGHT_BENCH_STORE) || '';
/** Every night Past gigs last fetched, so the bench can find its one. */
export let gigsSeen = [];

export let nightDrag = null;

/**
 * A DATE HANDED FROM THE CALENDAR TO THE INVOICES TAB.
 *
 * Held here rather than passed, because the two are different tabs and the
 * only thing between them is `render()`. The invoices tab consumes it once,
 * after its own book has loaded — which is also what resolves the venue NAME
 * to a customer id, so the calendar never has to fetch the invoice book to
 * offer the button.
 */
export let pendingInvoice = null;

export let book = null;   // { settings, customers, invoices, summary, backupReady }

/**
 * The setters, and why they exist rather than a state object.
 *
 * `import { library }` is a live READ of this module's binding — assigning to
 * it from another file is a syntax error. Only the writes had to change, which
 * is why there are thirteen of these and not three hundred: every read site in
 * the console still says `library` and still sees the current value.
 */
export function setLibrary(v) { library = v; }
export function setMe(v) { me = v; }
export function setLastDone(v) { lastDone = v; }
export function setAccountsExist(v) { accountsExist = v; }
export function setBench(v) { bench = v; }
export function setNightBench(v) { nightBench = v; }
export function setGigsSeen(v) { gigsSeen = v; }
export function setPackDrag(v) { packDrag = v; }
export function setVenueDrag(v) { venueDrag = v; }
export function setShowDrag(v) { showDrag = v; }
export function setNightDrag(v) { nightDrag = v; }
export function setPendingInvoice(v) { pendingInvoice = v; }
export function setBook(v) { book = v; }
