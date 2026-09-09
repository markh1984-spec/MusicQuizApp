/**
 * IMAGE ROUNDS — A SHELF OF ROUNDS, DERIVED, NEVER A SECOND COPY OF THEM.
 *
 * ---
 *
 * Asked for as *"we'll need to add an image rounds tab methinks"*, and then
 * the model behind it, which is the part that decides how this is built:
 * *"in future when a quiz pack is made, it is theoretically just an
 * amalgamation of the other three in a single pack."*
 *
 * **THAT MODEL IS RIGHT AND IT IS WHY NOTHING HERE IS EXTRACTED INTO A FILE.**
 * Counted at the time: the library held twenty-four one-round packs — twenty
 * intro rounds and four text — and **not one image round**, because every
 * picture round in this app lives INSIDE one of the nine full quizzes. So a
 * tab listing one-round packs of type `image` would have been an empty shelf.
 *
 * The obvious fix is to copy those nine rounds out into nine new packs, and
 * **that is rule 11 running backwards**: a correction to the picture round of
 * the 2006 quiz would not reach the extracted copy, and the host's own
 * standing rule is *"if someone tells me a question is wrong it must update
 * the library and all copies everywhere."* One file per pack is the only
 * reason that rule holds without any syncing at all.
 *
 * **SO THE SHELF IS A VIEW.** A card here is a round of a pack that already
 * exists, found by walking the library, and it points at `packId` plus a round
 * INDEX — which is exactly what a Tonight slot has always held, and exactly
 * what the round ticks on a pack card already carry. Nothing is written,
 * nothing can go stale, and a correction to the quiz reaches this shelf in the
 * same instant it reaches everything else, because there is only ever the one
 * file.
 *
 * **AND IT IS A ROUND, SO IT TRAVELS THE ROUND CHANNEL.** A tap calls
 * `addRoundToTonight()` and a drag sets `shelfRoundDrag`, the same two the
 * shelf's round ticks use — never `packDrag`, whose `{ id, kind }` is resolved
 * by `packOf()` against `gameOf()`. A synthesised id like `2006#1` would
 * resolve to nothing there: the state would stay consistent and the reader
 * would be lost, which is the fault this repo has already had once and wrote
 * down as *a tab id is not a game kind*.
 *
 * **WHAT IS NOT BUILT, DELIBERATELY:** these are not products. A round on this
 * shelf cannot be renamed, deleted, sold or priced, because it is not a file —
 * *what is bought and sold is a QUIZ or a BINGO GAME, never a round*. If the
 * amalgamation model is ever taken all the way, the change is that a quiz pack
 * REFERENCES three round files rather than holding their questions, and this
 * shelf then lists real packs with no code change to what a card does.
 */

import { esc, node } from './client.js';
import { can, doorNow, packWord } from './console.js';
import { addRoundToTonight, dragging, putOnBench } from './console-tonight.js';
import { setShelfRoundDrag } from './console-state.js';
import { pictureLabel, picturePanel } from './console-packs.js';
import { FEATURES } from './plans.js';
import { packLookAttrs, roundGlyph, roundWord, shortTitle, titleSize } from './pack-look.js';

/**
 * Every round of a given TYPE across the packs a quizmaster holds.
 *
 * A locked pack is skipped — it is a shop card, and its rounds are no more
 * runnable than it is.
 */
export function roundsOfType(packs, type) {
  const out = [];
  for (const pack of packs || []) {
    if (pack.locked || pack.broken) continue;
    (pack.rounds || []).forEach((round, index) => {
      if (round.type === type) out.push({ pack, round, index });
    });
  }
  return out;
}

/**
 * THE PACK NAME LEADS AND THE ROUND FOLLOWS — the opposite of a Tonight tile,
 * and for the same reason.
 *
 * A tile has to tell one pack's rounds apart, so there the ROUND is the
 * distinguishing half. Here it is one round taken from each of several packs,
 * and every picture round in this library is called *"Whose Face Is This?"* —
 * rendered before it was argued, and three cards with identical names on them
 * is the shelf saying nothing at all. So the pack is the title and the round's
 * own name is the line under it, dropped when it only repeats.
 */
function roundName(round, index) {
  const raw = String(round.title || '').trim();
  const trimmed = raw.replace(/^round\s+(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s*[—–-]\s*/i, '').trim();
  return trimmed || raw || `Round ${index + 1}`;
}

/**
 * How much of this round is drawn.
 *
 * `pack.art` counts the PICTURE questions of the whole pack, which for a quiz
 * with one image round in it is this round exactly. It is absent unless the
 * library was read with an image directory — see `pictureLabel()`, and the
 * rule that the launch path must never ask for it — so silence is the honest
 * answer rather than a zero.
 */
function artLine(pack) {
  const art = pack.art;
  if (!art || !art.total) return '';
  if (art.real >= art.total) return `${art.total} drawn`;
  return `${art.real} of ${art.total} drawn`;
}

function roundCard(entry, type) {
  const { pack, round, index } = entry;
  const look = packLookAttrs(pack, 'quiz');
  /*
   * `questionCount`, NOT `questions.length` — the library payload is a SUMMARY
   * and a round in it carries a count and no questions at all. Reading the
   * array gave every card "0 questions", which is a number right about the
   * wrong question, and nothing threw.
   */
  const count = round.questionCount || 0;
  const art = artLine(pack);
  const name = shortTitle(pack.title);
  const sub = roundName(round, index);
  /*
   * AND A PICTURE ROUND CAN BE DRAWN FROM HERE — asked for as *"when I
   * generate a new quiz pack, if that can't be done here I need an empty pack
   * added to the image tab so I can generate it in there."*
   *
   * **THERE IS NOTHING TO ADD, BECAUSE THE ROUND IS ALREADY HERE.** A
   * generated quiz comes out WITH its picture round — `QUIZ_ROUNDS` ticks
   * `image` by default — so it is a card on this shelf the moment it is
   * written. What it does NOT come out with is the pictures: drawing costs
   * money at the supplier and waits to be asked for, which is a rule rather
   * than an oversight. So the gap was never a missing pack, it was that the
   * one control which draws them lived on the pack and this shelf could not
   * reach it. **An empty pack invented to hold them would be a second file
   * for a round that already exists, which is rule 11 running backwards.**
   *
   * **THE SAME PANEL, NOT A SECOND ONE** — `picturePanel()`, exported from
   * `console-packs.js`, so the styles, the quality, the stand-in/real split
   * and the price quoted before the press keep ONE definition.
   *
   * **THE OWNER'S, AND THE WORKSHOP'S.** Portraits are on the owner's bill
   * (`FEATURES.CATALOGUE`, the same gate the pack card uses), and drawing is
   * something you do BEFORE a night rather than while launching one — so it
   * is not offered on the Console door, where a tap means *put this in
   * Tonight*.
   */
  const drawable = type === 'image' && doorNow() !== 'console' && can(FEATURES.CATALOGUE);
  const pic = drawable ? pictureLabel(pack) : null;
  const el = node(`
    <div class="pack-card shut round-card ${look.cls}" style="${look.style}"
      draggable="true" data-pack="${esc(pack.id)}" data-round="${index}"
      title="${esc(sub)} — ${esc(pack.title)}">
      ${packWord(look)}
      <span class="round-card-glyph" aria-hidden="true">${roundGlyph(round.type, index + 1)}</span>
      <button class="pack-title ${titleSize(name)}" title="${esc(pack.title)}">${esc(name)}</button>
      <div class="tiny">${count} question${count === 1 ? '' : 's'}${art ? ` · ${esc(art)}` : ''}</div>
      ${drawable ? `<button class="round-pics${pic.wants ? ' wants' : ''}" type="button" title="${esc(pic.title)}">${esc(pic.label)}</button>` : ''}
    </div>`);

  /*
   * A TAP PLACES THE ROUND, and on the Workshop door it opens its PACK on the
   * bench — because a round is not a thing you can edit on its own. That is
   * the same split every pack card makes, and it is what stops this shelf
   * promising an editor it has nowhere to open.
   */
  el.querySelector('.pack-title').addEventListener('click', () => {
    if (doorNow() === 'console') addRoundToTonight(pack.id, index);
    else putOnBench(pack, 'quiz');
  });
  el.addEventListener('click', (ev) => {
    if (ev.target.closest('.pack-title')) return;
    if (ev.target.closest('.round-pics')) return;
    if (doorNow() === 'console') addRoundToTonight(pack.id, index);
    else putOnBench(pack, 'quiz');
  });

  /*
   * AND THE DRAG IS THE ROUND CHANNEL — `shelfRoundDrag`, never `packDrag`.
   * `effectAllowed` is `'copy'` to match what the round ticks send, or the
   * browser treats every Tonight slot as refusing and no `drop` fires at all.
   */
  el.addEventListener('dragstart', (ev) => {
    setShelfRoundDrag({ packId: pack.id, round: index, title: pack.title });
    ev.dataTransfer.effectAllowed = 'copy';
    ev.dataTransfer.setData('text/plain', roundName(round, index));
    el.classList.add('is-dragging');
    dragging(true);
  });
  el.addEventListener('dragend', () => {
    setShelfRoundDrag(null);
    dragging(false);
    el.classList.remove('is-dragging');
  });

  const pics = el.querySelector('.round-pics');
  if (pics) {
    // A press must not also place the round, and the mousedown would otherwise
    // start the card's own drag.
    pics.addEventListener('mousedown', (ev) => ev.stopPropagation());
    pics.addEventListener('click', (ev) => {
      ev.stopPropagation();
      /*
       * ONE OPEN AT A TIME, AND PRESSING IT AGAIN SHUTS IT. The panel hangs
       * under the GRID rather than inside a 146px poster, so two open at once
       * would be two money-spending controls stacked with nothing saying which
       * pack either belongs to.
       */
      const grid = el.closest('.pack-grid');
      const host = grid && grid.parentElement;
      if (!host) return;
      const open = host.querySelector('.pics-slot');
      const was = open && open.dataset.pack;
      if (open) open.remove();
      host.querySelectorAll('.round-pics.is-open').forEach((b) => b.classList.remove('is-open'));
      if (was === pack.id) return;
      const slot = node(`<div class="pics-slot" data-pack="${esc(pack.id)}"><div class="tiny pics-for">Round 2 pictures — ${esc(pack.title)}</div></div>`);
      slot.appendChild(picturePanel(pack));
      host.appendChild(slot);
      pics.classList.add('is-open');
      slot.scrollIntoView({ block: 'nearest' });
    });
  }
  return el;
}

/**
 * The tab body: a heading, a line, and the grid. Deliberately NOT
 * `gameSection()` — that draws pin buttons, a search box, a mode dropdown and
 * a way into the editor, and every one of those acts on a FILE. None of them
 * has anything to act on here.
 */
export function roundsSection(type, label, blurb, packs) {
  const found = roundsOfType(packs, type);
  const el = node(`
    <div class="game-section">
      <div class="game-head ${doorNow() === 'console' ? 'head-bare' : ''}">
        ${doorNow() === 'console' ? '' : `<div>
          <h2 class="pack-head">${esc(label)}</h2>
          <div class="tiny">${esc(blurb)}</div>
        </div>`}
      </div>
      <div class="pack-grid"></div>
    </div>`);
  const grid = el.querySelector('.pack-grid');
  if (!found.length) {
    /*
     * AND THE EMPTY STATE NAMES THE TYPE. It said "picture rounds" from the
     * day this shelf was Image Rounds alone, so the General Knowledge tab
     * would have told an empty library it held no PICTURES — the sentence a
     * shelf prints when it has nothing is the one place it has to be exactly
     * right about what it is looking for.
     */
    const word = roundWord(type).toLowerCase();
    grid.appendChild(node(`<div class="tiny">No ${esc(word)} rounds in your packs yet — a quiz with one in it will show its round here.</div>`));
    return el;
  }
  for (const entry of found) grid.appendChild(roundCard(entry, type));
  return el;
}
