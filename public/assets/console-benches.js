/**
 * THE TWO DOOR BENCHES — Workshop's pack and Post gig's night.
 *
 * ---
 *
 * **MOVED OUT OF `console.js` BY LINE NUMBER, on 29 August 2026.** The shell
 * had grown back past its 2,000-line budget when the Post gig bench gained a
 * rail, and the budget's own instruction is the right one: *take a seam out of
 * it*. These two are a seam rather than an arbitrary cut — they are the same
 * object twice, one holding a pack and one holding a night, they share
 * `wireBenchFold()` and the two storage keys, and neither is the shell's job.
 * Not one function body was retyped.
 *
 * **THEY IMPORT FROM `console.js`**, which is the established pattern here —
 * `console-community.js` and `console-gigs.js` already do, and it is safe
 * because everything taken is either a hoisted function declaration or a
 * `const` evaluated while `console.js` initialises, long before the boot call
 * at the end of it. What must never happen is a module importing from a page
 * that has its own top-level listeners; `console.js` is the console's page, so
 * this is the one direction that works.
 *
 * ---
 *
 * **POST GIG'S BAY IS A RAIL AND WHAT IT PICKED** — `bayRail()`, the same
 * component the Community door draws, asked for in those words: *"content
 * taking up the bulk to the right, controls on the left."*
 *
 * **THE WORKSHOP'S IS NOT, AND HAD ONE FOR A FORTNIGHT BY MISTAKE.** Its shelf
 * below is already the picker, so a rail beside the bench was a second answer
 * to one question — see the note where it was taken out.
 *
 * **THE DRAG SURVIVED THE RAIL, on both.** It was already on the panel rather
 * than on a slot inside it, so nothing had to be rewired — and the empty
 * state keeps its drop zone, because a quizmaster with nothing filed has an
 * empty rail and still needs telling what the panel is for.
 */

import { esc, node } from './client.js';
import { bayColumns, bayRail } from './console-bay.js';
import {
  BENCH_STORE, NIGHT_BENCH_STORE, bench, gigsSeen, nightBench, nightDrag, packDrag,
  setBench, setGigsSeen, setNightBench, setNightDrag, setPackDrag, setShelfRoundDrag,
  shelfRoundDrag,
} from './console-state.js';
import { can, keyed, linkTo, packWord } from './console.js';
import { FEATURES } from './plans.js';
import { fillNightDetail } from './console-gigs.js';
import { packActionsMarkup, preview, wirePackActions } from './console-packs.js';
import { editPopover } from './console-editor-popover.js';
import { shelfFor } from './console-shows.js';
import { dragging, putNightOnBench, putOnBench } from './console-tonight.js';
import { packLookAttrs, shortTitle, isBreakoutPack } from './pack-look.js';

/**
 * THE WORKSHOP BENCH — the door's own section at the top, in the same place
 * and of the same weight as Tonight.
 *
 * *"I can then drag quiz packs there to edit them as a QM, or start a fresh
 * one — that's what that section is there to do."*
 *
 * **IT MIRRORS TONIGHT DELIBERATELY**: the same head line, the same dashed
 * drop area, the same one primary button at the bottom. Two doors that behave
 * the same way are one thing to learn rather than two, which is the whole
 * reason the shell exists — and it is why the drop zone is built from
 * `.lb-tile` and `.lb-drop`, the classes Tonight already uses, rather than a
 * second set that would drift.
 *
 * **THE PRIMARY IS GREEN, NOT THE ACCOUNT GRADIENT.** One filled gradient per
 * screen means "the night", and there is no night behind this door; making
 * something new is the green role. So the Console has exactly one Launch and
 * the Workshop has exactly one Write a new one, and neither can be mistaken
 * for the other in a dark pub.
 *
 * **A pack on the bench is NOT opened automatically.** Dropping is choosing,
 * pressing is doing — the same promise every other drop in this app makes.
 */
const WORK_BENCH_OPEN_STORE = 'musicquiz.workbenchopen';
const NIGHT_BENCH_OPEN_STORE = 'musicquiz.nightbenchopen';

/**
 * A SIMPLE FOLD, shared by the Workshop and Post gig benches — asked for as
 * *"all three benches need consistent functionality — hide/expand"*, Tonight
 * already having one. Same classes as Tonight's own `.lb-fold` (so it is one
 * visual language, not three), but not its per-element TUCKING — that exists
 * because Tonight has several named sub-sections (venue picker, mode switch,
 * running order) that each need their own fold behaviour. These two benches
 * hold one thing each, so one body wrapper hidden or shown whole is the
 * whole mechanism.
 *
 * Read from localStorage on every call rather than held in a module
 * variable — both benches rebuild their whole panel from scratch on every
 * redraw (`draw()` in `nightBenchPanel()`, `render()` on the workshop door),
 * so state that lived only in a closure would reset itself the moment
 * anything else on the page changed.
 */
function wireBenchFold(el, storeKey) {
  let open = localStorage.getItem(storeKey) !== '0';
  const fold = el.querySelector('.lb-fold');
  const body = el.querySelector('.bench-fold-body');
  const paint = () => {
    fold.setAttribute('aria-expanded', open ? 'true' : 'false');
    fold.querySelector('.lb-fold-word').textContent = open ? 'Hide' : 'Show';
    if (body) body.hidden = !open;
  };
  fold.addEventListener('click', () => {
    open = !open;
    localStorage.setItem(storeKey, open ? '1' : '0');
    paint();
  });
  paint();
}

export function workBench() {
  const on = bench ? shelfFor(bench.kind).find((p) => p.id === bench.id) : null;
  // A pack that has been deleted since it was put on the bench leaves quietly
  // rather than drawing a tile for something that is not there.
  if (bench && !on) { setBench(null); localStorage.removeItem(BENCH_STORE); }

  const look = on ? packLookAttrs(on, bench.kind === 'quiz' && isBreakoutPack(on) ? 'breakout' : bench.kind) : null;

  /*
   * WHOSE PACK IS ON THE BENCH — asked for directly: *"the workshop needs to
   * distinguish between packs that I made for the QM and packs the QM made for
   * himself."*
   *
   * `mine` is set by `own-packs.js`: true for a pack in this account's own
   * folder, false for one out of the catalogue. That single flag is the whole
   * distinction and it already decides what may be DONE to a pack — which is
   * exactly why the Workshop is the door that has to say it. A quizmaster who
   * cannot tell the two apart finds out by editing a Quizporium pack for twenty
   * minutes and being refused on Save.
   *
   * The words are the ones this app already settled on: **My packs** and
   * **Quizporium packs**. Never "yours and the catalogue" — "the catalogue"
   * describes where the code keeps it, not who wrote it or why it costs money.
   */
  const isMine = Boolean(on && on.mine);
  // The owner maintains what the owner distributes, so a catalogue pack is his
  // to edit and nobody else's. `can()` rather than a hat or an account kind:
  // the entitlement is the thing the SERVER will actually check on Save.
  const theirsToEdit = Boolean(on) && (isMine || can(FEATURES.CATALOGUE));

  const el = node(`
    <div class="panel launchbar bench bay-scroller">
      <div class="lb-head">
        <div class="lb-what">
          <span class="bench-where">On the bench</span>
          <span class="tiny lb-shut-what">${on ? esc(shortTitle(on.title)) : 'Nothing yet'}</span>
          <!-- IT RIDES IN THE HEAD, so it is still true when the bench is
               folded to a line - which is the state it spends most of its
               time in. A badge, because that is what this app's one-word
               facts wear: PAID, YOURS, BRONZE. -->
          ${on ? `<span class="bench-whose ${isMine ? 'is-mine' : ''}">${isMine ? 'Yours' : 'Quizporium'}</span>` : ''}
        </div>
        <div class="lb-right">
          <button class="lb-fold" type="button" aria-expanded="true"><span class="lb-fold-word"></span></button>
        </div>
      </div>
      <!-- THE SLOT ON THE LEFT, WHAT YOU DO WITH IT ON THE RIGHT.
           Reported as *"I don't want a tiny button taking up a whole row"* -
           and that was the fault: one small green button stretched across a
           panel, under a drop zone half its width. A button's width should say
           how big the action is, and "write a new one" is not a full-width
           decision the way Launch is. Two columns put the buttons beside the
           thing they act on and let each one be its own size. -->
      <div class="bench-body">
        <div class="bench-slot">
          ${on ? `
            <div class="lb-tile is-pack ${look.cls}" style="${look.style}" title="${esc(on.title)}">
              ${packWord(look)}
              <button class="lb-tile-off bench-off" type="button" aria-label="Take it off the bench">&times;</button>
              <b class="lb-tile-name">${esc(shortTitle(on.title))}</b>
              <span class="tiny lb-tile-sub">${esc(bench.kind === 'bingo' ? 'bingo' : 'quiz')}</span>
            </div>` : `
            <div class="lb-drop bench-drop">
              <span class="lb-drop-plus">+</span>
              <span>Pick one below</span>
            </div>`}
        </div>
        <div class="bench-do">
          ${on ? `
            <!-- PRESENT AND INERT ON SOMEBODY ELSE'S PACK, WITH THE REASON ON
                 THE BUTTON. It used to open the editor whoever was looking:
                 every question was editable, and Save then answered *"There is
                 already a pack called ... in the catalogue. Give yours a
                 different name"* - an error about an id, on a screen with no
                 way to change one, after the work was already done. A control
                 that reports success it did not have is this repo's commonest
                 fault; this is its twin, a control that promises one. -->
            <button class="go bench-go role-make" type="button" ${theirsToEdit ? '' : 'disabled'}
              >${theirsToEdit ? 'Edit the questions' : 'Quizporium keeps this one up to date'}</button>
            <button class="minor bench-read" type="button">Read it through</button>
            <a class="minor bench-tonight" href="${esc(linkTo(`/console?tonightPack=${encodeURIComponent(on.id)}&tonightKind=${bench.kind}`))}">Take it to Tonight</a>
            <p class="tiny">${theirsToEdit ? `Saved as you go. Take it off when you are done with it.
              Set it up on Tonight and press <b>Keep this as a show</b> to save the
              whole evening — the venue, the prizes, the order — not just this pack.`
    : `This one is written and maintained for you, so a fix reaches every copy
              at once — there is nothing here to keep in step. Read it through, take
              it to Tonight, or write your own from the shelf below.`}</p>`
    : `
            <a class="go bench-go role-make" href="${esc(linkTo('/editor'))}">Write a new one</a>
            <p class="tiny">Or pick one from the shelf below to edit, rename
              or read something you already have.</p>`}
        </div>
        <!-- RENAME, DELETE, PICTURES, PLAYLIST, A COPY TO KEEP — everything a
             pack card itself used to open a caret to reach, before a tap
             started putting the pack here instead. bench-pack-actions is its
             own class rather than the Post gig bench's bench-actions, which
             already means "one row of buttons flexed to fit" — reusing it
             here would fight pack-actions' own grid for the same property,
             the exact label collision this app keeps a rule against.
             grid-column: 1 / -1 in the stylesheet is what spans it under both
             columns of the slot-and-buttons row above. -->
        ${on ? `<div class="bench-pack-actions">${packActionsMarkup(bench.kind, on)}</div>` : ''}
      </div>
    </div>`);

  /*
   * NO RAIL ON THIS BENCH — and it had one for a fortnight, which was the
   * mistake.
   *
   * Reported plainly: *"the workshop bench is literally only meant to be for
   * whatever you drag to it to be currently worked on — not sure why there is
   * a dropdown list of different things, they're selected from the bottom,
   * dragged or clicked to the top and then edited when there."*
   *
   * **HE IS RIGHT, AND IT IS THE LABEL COLLISION THIS FILE KEEPS A RULE
   * AGAINST.** The shelf below IS the picker — search it, drag a card up, or
   * tap one — and a rail beside the bench is a second answer to that one
   * question, sitting on the door where the first answer is already the whole
   * bottom half of the page. Worse, the two disagreed about what they held:
   * the rail listed every pack and the shelf showed six, so the duplicate was
   * the better list, which is backwards.
   *
   * **THE RAIL RULE IS NOT REVERSED, ITS SCOPE IS.** `bayRail()` is right on
   * Post gig and Community, where the bay is *"a narrow list of what you could
   * be looking at, and the one you picked filling the rest"* and there is no
   * second picker. The Workshop's bay is a WORKBENCH: one pack, and what you
   * do to it. **Do not put a rail back on it.**
   */
  el.querySelector('.bench-body').classList.add('bench-fold-body');

  el.querySelector('.bench-off')?.addEventListener('click', () => putOnBench(null));
  el.querySelector('.bench-read')?.addEventListener('click', () => preview(bench.kind, on));
  if (on) el.querySelector('.bench-go')?.addEventListener('click', () => editPopover(bench.kind, on));
  if (on) wirePackActions(el, bench.kind, on);
  wireBenchFold(el, WORK_BENCH_OPEN_STORE);

  /*
   * THE SAME DROP GESTURE AS TONIGHT, on the same kind of target — and it
   * takes a BINGO pack as readily as a quiz, because the editor does.
   */
  /*
   * AND A ROUND IN THE HAND BENCHES ITS PACK — the second channel this target
   * has to answer.
   *
   * Reported as *"drag and drop isn't working for the image rounds"*, and it
   * was not: an Image Rounds card and a pack card's round tick both set
   * `shelfRoundDrag`, never `packDrag`, because on the Console what you are
   * holding really is one round. This handler asked for `packDrag` alone, so
   * the drop never fired at all — no error, no movement, the panel not even
   * lighting up.
   *
   * **THE PAYLOAD IS NOT CHANGED TO SUIT THE TARGET.** Making a round card
   * carry a PACK on this door would be a descriptor that lies about what is in
   * your hand, which this file already has a rule against. The target learns
   * the second channel instead, and answers it the way the TAP already does:
   * a round cannot be edited on its own, so the bench takes its pack. **A tap
   * and a drag may not come to mean different things.**
   */
  const benchDrag = () => {
    if (packDrag) return { id: packDrag.id, kind: packDrag.kind };
    if (shelfRoundDrag) return { id: shelfRoundDrag.packId, kind: 'quiz' };
    return null;
  };
  el.addEventListener('dragover', (ev) => {
    if (!benchDrag()) return;
    ev.preventDefault();
    // `copy` on both channels: a round tick and an Image Rounds card each start
    // with `effectAllowed = 'copy'`, and a `dropEffect` the source did not
    // allow makes the browser treat this target as REFUSING — no `drop` at all.
    ev.dataTransfer.dropEffect = 'copy';
    el.classList.add('drop-here');
  });
  el.addEventListener('dragleave', (ev) => {
    if (!el.contains(ev.relatedTarget)) el.classList.remove('drop-here');
  });
  el.addEventListener('drop', (ev) => {
    const dropped = benchDrag();
    if (!dropped) return;
    ev.preventDefault();
    el.classList.remove('drop-here');
    setPackDrag(null);
    setShelfRoundDrag(null);
    dragging(false);
    putOnBench(shelfFor(dropped.kind).find((p) => p.id === dropped.id), dropped.kind);
  });
  return el;
}

/**
 * THE POST GIG BENCH — one night, and everything you do about it.
 *
 * *"I think I need a bench in the post gig bit as well."* Its cargo is a NIGHT,
 * which is what every job behind that door is about: bill it, show the venue,
 * put it on the gallery.
 *
 * **THE DETAIL LIVES HERE NOW, NOT IN A SECOND PLACE.** This used to be a
 * small tile with three buttons that clicked THROUGH to a row in the list
 * below — "Open its photos" found `.gig[data-night]` and pressed its head for
 * you. Past gigs then grew its own bay showing that same detail a second
 * time, and the host's own reading of the result was right: two places
 * showing the same thing is less visible than one, not more. So the bench
 * now builds the detail itself — `fillNightDetail()`, the exact function
 * Past gigs used to keep in its own bay — and Past gigs is a picker only:
 * choose a night there, see everything about it here.
 *
 * **IT FETCHES ITS OWN NIGHT RATHER THAN WAITING FOR THE LIST.** Past gigs
 * reads the archive when it renders, and this panel is built before that
 * finishes — so on a fresh load the bench would have nothing to look its
 * remembered night up in. Redrawing the whole page when the list arrives was
 * the obvious fix and is a LOOP: the render rebuilds Past gigs, which
 * fetches, which renders. It refills itself in place instead, which touches
 * nothing else.
 */
export function nightBenchPanel() {
  const el = node('<div class="panel launchbar bench night-bench bay-scroller"></div>');

  /*
   * THE NIGHTS, DOWN THE LEFT — *"content taking up the bulk to the right,
   * controls on the left. How can we utilise this for all of the sections?"*
   *
   * The bench already held ONE night and everything you do about it; what it
   * had no answer for was picking a different one without going down to the
   * list and dragging. The rail is that answer, and it is the same rail the
   * Community door draws — `bayRail()`, one definition, so three doors cannot
   * grow three ideas of what "pick one of these" looks like.
   *
   * **GROUPED BY PUB, THEN THE NIGHTS FROM THERE** — asked for in those words.
   * A pub keeps date order (the one you played at last is first, like every
   * other list of venues here) and its nights keep theirs.
   *
   * **THE DRAG STAYS.** It is on the panel itself rather than on a slot, so it
   * survives the rail arriving — and the empty state's drop zone stays too,
   * because a quizmaster with no filed nights has an empty rail and needs to
   * be told what this panel is for.
   */
  const railRows = () => {
    const byPub = new Map();
    for (const n of gigsSeen) {
      const name = n.venue || 'No venue on these';
      const key = name.trim().toLowerCase();
      if (!byPub.has(key)) byPub.set(key, { name, nights: [] });
      byPub.get(key).nights.push(n);
    }
    const rows = [];
    for (const pub of byPub.values()) {
      for (const n of pub.nights) {
        const d = new Date(n.night + 'T12:00:00');
        rows.push({
          key: n.night,
          group: pub.name,
          name: Number.isNaN(d.getTime()) ? n.night
            : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
          note: [n.unbilled ? 'Not billed' : '', n.hasPhotos ? 'Photos' : ''].filter(Boolean).join(' · '),
        });
      }
    }
    return rows;
  };

  const draw = async (night) => {
    const when = night ? new Date(night.night + 'T12:00:00') : null;
    const head = node(`
      <div>
        <div class="lb-head">
          <div class="lb-what">
            <span class="bench-where">On the bench</span>
            <span class="tiny lb-shut-what">${night
    ? esc(`${when.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}${night.venue ? ` · ${night.venue}` : ''}`)
    : 'Nothing yet'}</span>
          </div>
          <!-- reward-off, not lb-tile-off — that one is position: absolute,
               meant to sit inside an lb-tile chip it is positioned relative
               to. Bare in this grid head it had no such ancestor and escaped
               to the corner of the whole page. lb-right is the head's own
               third column, same as the launch bar's fold — both live in it
               together, same as Tonight's mode switch and its own fold. -->
          <div class="lb-right">
            ${night ? '<button class="reward-off bench-off" type="button" aria-label="Take it off the bench">&times;</button>' : ''}
            <button class="lb-fold" type="button" aria-expanded="true"><span class="lb-fold-word"></span></button>
          </div>
        </div>
      </div>`);

    const side = night ? node('<div class="bench-detail"></div>') : node(`
      <div class="bench-body">
        <div class="bench-slot">
          <div class="lb-drop bench-drop">
            <span class="lb-drop-plus">+</span>
            <span>Pick one on the left</span>
          </div>
        </div>
        <div class="bench-do">
          <p class="tiny">Or pick one on the left, and the invoice, the
            photographs and whether the venue can show it off are all in one
            place, right here.</p>
        </div>
      </div>`);

    const cols = bayColumns(
      bayRail({
        items: railRows(),
        picked: night ? night.night : '',
        railId: 'nights',
        // The rail is the last few; Past gigs underneath is the whole archive,
        // with its venue cards, headcounts and search on it.
        more: 'Older nights are in Past gigs below.',
        onFold: () => draw(night),
        onPick: (key) => putNightOnBench(key),
        empty: 'Nothing filed yet.',
      }),
      side,
    );
    cols.classList.add('bench-fold-body');
    el.replaceChildren(head, cols);

    el.querySelector('.bench-off')?.addEventListener('click', () => putNightOnBench(''));
    wireBenchFold(el, NIGHT_BENCH_OPEN_STORE);
    if (night) await fillNightDetail(side, night);
  };

  const found = () => gigsSeen.find((n) => n.night === nightBench) || null;
  draw(nightBench ? found() : null);
  /*
   * THE LIST IS FETCHED FOR THE RAIL, not only to look one night up — so the
   * condition is now "nothing seen yet" rather than "a night is on the bench
   * and I cannot find it". Without that the rail is empty on a fresh load
   * until Past gigs happens to be the tab you are on, which is a picker that
   * only works once you have been somewhere else first.
   */
  if (!gigsSeen.length || (nightBench && !found())) {
    (async () => {
      try {
        const data = await (await fetch(keyed('/api/past-gigs'))).json();
        setGigsSeen(data.nights || []);
        const mine = found();
        // Filed under a night that is no longer there — it leaves quietly
        // rather than drawing a tile for something that has gone.
        if (!mine) { setNightBench(''); localStorage.removeItem(NIGHT_BENCH_STORE); }
        draw(mine);
      } catch { /* the list below will say so; the bench stays empty */ }
    })();
  }

  /*
   * DRAG WIRING STAYS OUTSIDE `draw()`, added ONCE — `el` itself is never
   * replaced, only its children, so listeners added inside `draw()` would
   * stack up a fresh copy on every redraw.
   */
  el.addEventListener('dragover', (ev) => {
    if (!nightDrag) return;
    ev.preventDefault();
    ev.dataTransfer.dropEffect = 'copy';
    el.classList.add('drop-here');
  });
  el.addEventListener('dragleave', (ev) => {
    if (!el.contains(ev.relatedTarget)) el.classList.remove('drop-here');
  });
  el.addEventListener('drop', (ev) => {
    if (!nightDrag) return;
    ev.preventDefault();
    el.classList.remove('drop-here');
    const key = nightDrag;
    setNightDrag(null);
    dragging(false);
    putNightOnBench(key);
  });
  return el;
}

