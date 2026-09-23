/**
 * WHAT THEY WIN — the prize table on the launch bar, per GAME.
 *
 * *"I want to offer prizes on a game basis and those prizes be given at the
 * end of the game regardless of what the venue prizes says... I can keep
 * track of how many prizes I've given out over 2-3 games no problem at all
 * and putting this into code seems overly restrictive."*
 *
 * He is right, and `prize-parts.js` records the failure that proves it: the
 * venue's one list used to be walked through by counting the vouchers a night
 * had MINTED, which is not the number of places a part recognises — so a tie
 * for first (paid in full, by decision) or a room where somebody scored
 * nothing moved every later game onto the wrong drink, in silence, in front
 * of the room.
 *
 * THE BOXES ARE THE COUNT, AND THAT IS THE POINT. A game draws one box per
 * prize it will actually pay — the Winners setting for a quiz, the card's
 * stopping points for a bingo game — so the table cannot disagree with the
 * night. A 5x5 card running five stops beside three typed drinks is exactly
 * the night that ended with *"my quiz and bingo winners on thursday didn't
 * receive a QR code"*: stops four and five mint nothing, because
 * `issueVoucher()` returns on a reward that is not there.
 *
 * SHUT IT IS THE LEDGER. The host keeps the count now, so the summary has to
 * be readable without pressing anything — a table you have to open is one
 * nobody checks at five to nine with the room filling up. *Narrow shut, wide
 * open*, the arrangement the venue sheet and the dropdown popovers already
 * use, and the reason this is not a tenth control on the settings row: that
 * row is nine controls and a tenth cost three of them their labels.
 *
 * A LEAF, with no page of its own — it takes the night and the slots as
 * arguments rather than reaching for `console-tonight.js`'s own bindings, the
 * same way `console-bay.js` and `camera-sheet.js` do. Writing is the caller's
 * job, because where a list is KEPT is a fact about the launch bar: a mixed
 * night keeps one per slot, an ordinary night one on the night.
 */
import { bestBingoShape, esc } from './client.js';
import { partsOfSlots } from './console-tonight-mix.js';
import { FULL_HOUSE, checkStages, dealPrizes, defaultStages, moveStage, nightReminder, paysOf, stageChoices, stageWord } from './prize-parts.js';

/*
 * CARD BINGO'S ONE BOX PAYS EVERY GAME, SO IT SAYS SO. A deck pays a prize a
 * round and a round past its list pays the last drink again (`rewardFor()` in
 * `bingo.js`), so "1st" over it read as first place in ONE game — the wrong
 * thing on the control where the host sets what every game of card bingo is
 * worth. Named per kind, like `UNIT` on a pack card.
 */
const boxWord = (part, at) => (part.kind === 'cards' ? 'Each game' : placeWord(at + 1));

/** "1st", "2nd", "3rd" — the same wording the venue card's own prize rows use. */
export function placeWord(n) {
  const v = n % 100;
  const suffix = (v >= 11 && v <= 13) ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] || 'th');
  return `${n}${suffix}`;
}

/** The venue's standing list, which is what the table starts from. */
export function venueRewards(venueName, venueRecords) {
  const named = String(venueName || '').trim().toLowerCase();
  if (!named) return [];
  const record = (venueRecords || [])
    .find((v) => String(v.name || '').trim().toLowerCase() === named);
  return ((record && record.rewards) || []).map((r) => String(r || '').trim()).filter(Boolean);
}

/** What a game is called on the table. */
function partName(part) {
  if (part.kind === 'quiz') return 'Quiz';
  if (part.kind === 'cards') return 'Card bingo';
  return 'Bingo';
}

/**
 * The games tonight has, each with what it pays and what it is paying WITH.
 *
 * A mixed night walks `partsOfSlots()` — the same merge the launch does, so a
 * four-round quiz is ONE game here rather than four. An ordinary night has no
 * slots at all and is one game, which is the shape it has always been.
 *
 * @param {object[]|null} slots      `lbSlots`, or null on an ordinary night
 * @param {object} night             the launch bar's own night settings
 * @param {object|null} picked       the picked pack, for the no-slots case
 * @param {function} packOf          id -> pack, off whichever shelf holds it
 * @param {object[]} cardShapes      `library.cardShapes`
 * @param {string[]} venueList       what the venue put up, in order
 */
export function prizeParts({ slots, night, picked, packOf, cardShapes = [], venueList = [] }) {
  const winners = Number(night.winners) || 3;
  /*
   * THE SHAPE THIS GAME WILL ACTUALLY BE PLAYED ON — its own if one has been
   * chosen, otherwise the one the bar would pick for the pack. The same
   * resolution `packOwnShape()` does on the tile and `BingoGame.shape` does at
   * launch: reading one and launching another is how a 5x5 card came to be
   * dealt a 4x4's share of the drinks.
   */
  const cardOf = (part) => {
    const pack = packOf(part.packId);
    const best = pack ? bestBingoShape(cardShapes, pack.trackCount) : null;
    const shape = part.shape || (best ? { rows: best.rows, cols: best.cols } : null);
    return cardShapes.find((sh) => shape && sh.rows === shape.rows && sh.cols === shape.cols) || null;
  };
  const shapePrizes = (part) => Number((cardOf(part) || {}).prizes) || 1;
  const raw = slots ? partsOfSlots(slots) : (picked ? [{
    kind: picked.kind === 'bingo' ? 'bingo' : picked.kind,
    at: -1,
    packId: picked.pack.id,
    prizes: night.prizes || 0,
    shape: night.shape || null,
    stages: Array.isArray(night.stages) ? night.stages : null,
    rewards: Array.isArray(night.rewards) ? night.rewards : null,
  }] : []);
  const parts = raw.map((part) => ({
    ...part,
    pays: paysOf(part, { winners, bingo: part.kind === 'quiz' ? 0 : shapePrizes(part) }),
  }));
  /*
   * AND WHAT IS NOT TYPED YET IS SHOWN AS THE VENUE WOULD DEAL IT — the same
   * deal `launchRunningOrder()` does on the server, off the same function, so
   * what the host reads here is what the room would get if they never opened
   * this at all.
   */
  const dealt = dealPrizes(venueList, parts.map((part) => part.pays));
  return parts.map((part, i) => {
    /*
     * WHICH LINES EACH PRIZE PAYS ON — music bingo alone: a deck is one line
     * of thirteen and a quiz pays places. `lines` is what the host chose if it
     * still fits this card and this count, otherwise the count's own plan —
     * THE SAME `checkStages()` THE LAUNCH RUNS, so the table can never show a
     * list the room will not be dealt. `maxLine` 0 means a server too old to
     * say, and the table then shows the plan and offers no choice.
     */
    const card = part.kind === 'bingo' ? cardOf(part) : null;
    const maxLine = card ? Number(card.maxLine) || 0 : 0;
    return {
      ...part,
      list: Array.isArray(part.rewards) ? part.rewards : dealt[i],
      own: Array.isArray(part.rewards),
      maxLine,
      lines: card ? (checkStages(part.stages, part.pays, maxLine) || defaultStages(part.pays)) : null,
    };
  });
}

/**
 * EVERY PRIZE TONIGHT WOULD ACTUALLY HAND OUT — what the launch gate and the
 * warning both ask about, now that a game can pay something the venue record
 * has never heard of. Flattened across the games, because the question is *is
 * there anybody to pay*, which is a fact about the evening.
 */
export function prizesTonight(parts) {
  return (parts || []).flatMap((part) => (part.list || []).filter(Boolean));
}

/*
 * THE ONE LINE UNDER THE TABLE — the night's drinks as a REMINDER, never a
 * limit. It used to speak only when the night wanted more than the venue's
 * list held, which was a real shortfall while one list was shared down the
 * night and is a warning about nothing now every game is dealt from the top.
 * The sentence is `nightReminder()` in `prize-parts.js`, where it is tested.
 * Callers still pass the venue as a second argument; it is no longer read.
 */
export function prizeNote(parts) {
  return nightReminder(parts);
}

/** Draw the table into `box` — shut it is the ledger, open it is the editor. */
export function prizeTableInto(box, parts, { open, venueName, venueList }) {
  if (!box) return;
  if (!parts.length) { box.hidden = true; box.innerHTML = ''; return; }
  box.hidden = false;
  const rows = parts.map((part, i) => {
    const n = part.pays;
    const list = part.list || [];
    if (!open) {
      /* A PLACE WITH NOTHING ON IT IS SAID, NOT LEFT BLANK — a gap in the
         ledger reads as the table not having loaded rather than as a prize
         nobody has typed. */
      // A bingo prize is named by what WINS it, which is what a pub calls it —
      // "the line", "the full house" — and what the host chose; a quiz's by
      // its place.
      const chips = Array.from({ length: n }, (_, at) => `<span class="lb-pz${
        list[at] ? '' : ' lb-pz-none'}"><i>${esc(part.lines ? stageWord(part.lines[at]) : (part.kind === 'cards' ? boxWord(part, at) : String(at + 1)))}</i>${
        esc(list[at] || 'Nothing set')}</span>`).join('');
      return `<span class="lb-pz-line"><b>${esc(partName(part))}</b>${chips}</span>`;
    }
    if (part.lines) {
      /*
       * A MUSIC BINGO ROW SAYS WHAT WINS EACH PRIZE, AND LETS YOU CHOOSE IT —
       * *"I select 3 and then select lines 2, 3 and full house."* The last is
       * always the full house and is SAID rather than offered: the night ends
       * on the whole card. A `<div>` rather than a `<label>`, because one label
       * around two controls sends a press on its padding to the first of them.
       */
      return `<div class="lb-pz-row" data-part="${i}">
        <span class="lb-pz-who">${esc(partName(part))}</span>
        ${Array.from({ length: n }, (_, at) => {
          const stage = part.lines[at];
          const choices = stage === FULL_HOUSE || !part.maxLine ? [] : stageChoices(at, n, part.maxLine);
          const head = choices.length
            ? `<select class="lb-pz-stage" data-part="${i}" data-at="${at}" aria-label="${esc(`What wins the ${placeWord(at + 1)} prize`)}">${
              choices.map((c) => `<option value="${c}"${c === stage ? ' selected' : ''}>${esc(stageWord(c))}</option>`).join('')}</select>`
            : `<span class="lb-pz-stage-said">${esc(stageWord(stage))}</span>`;
          return `<div class="lb-pz-box">
            ${head}
            <input class="lb-pz-in" data-part="${i}" data-at="${at}" type="text" maxlength="80"
              aria-label="${esc(`The prize for ${stageWord(stage)}`)}"
              value="${esc(list[at] || '')}" placeholder="Nothing for this one">
          </div>`;
        }).join('')}
      </div>`;
    }
    return `<div class="lb-pz-row" data-part="${i}">
        <span class="lb-pz-who">${esc(partName(part))}</span>
        ${Array.from({ length: n }, (_, at) => `<label class="lb-pz-box">
          <span>${esc(boxWord(part, at))}</span>
          <input class="lb-pz-in" data-part="${i}" data-at="${at}" type="text" maxlength="80"
            value="${esc(list[at] || '')}" placeholder="Nothing for this one">
        </label>`).join('')}
      </div>`;
  }).join('');
  box.innerHTML = `
    <button class="lb-pz-head" type="button" aria-expanded="${open ? 'true' : 'false'}">
      <span class="lb-pz-lab">What they win</span>
      <span class="lb-pz-car" aria-hidden="true">${open ? '▴' : '▾'}</span>
      ${open ? '' : rows}
    </button>
    ${open ? `<div class="lb-pz-panel">${rows}
      <div class="tiny lb-pz-note">${esc(prizeNote(parts, { venueName, venueList }))}</div>
    </div>` : ''}`;
}

/**
 * THE TABLE'S LISTENERS, BOUND ONCE ON THE LAUNCH BAR'S PANEL — moved here from
 * `launchBar()` on 23 September 2026, when adding the lines picker took that
 * file past its budget: everything below is about this table and nothing else.
 *
 * **THE HOOKS ARE THE BAR'S, and must stay the bar's.** Whether the table is
 * open is a module binding in `console-tonight.js`, and an ES import is a
 * read-only view — assigning to it here would throw WHEN THE LINE RUNS, not
 * when the file loads, which is the fault `console-state.js` exists to prevent.
 * So a press asks the bar to flip it (`onToggle`), and the bar repaints.
 */
export function bindPrizeTable(el, { partsNow, setPartRewards, setPartStages, onToggle, afterStages, noteText }) {
  /* DELEGATED, BOUND ONCE — `paintPrizeTable()` replaces the whole table on
     every settings change and every state push, so a listener per input would
     be re-bound on every phone that joins and leak with the room. Same reason
     the dropdown popovers share one document listener. */
  el.addEventListener('click', (e) => {
    /*
     * NO `el.contains()` CHECK, AND THAT IS THE BUG THIS ONCE HAD.
     *
     * Leaving a prize box fires `change`, which repaints the table — so by
     * the time the CLICK that caused the blur is dispatched, the head it
     * landed on has already been replaced and is detached from the document.
     * `el.contains()` then says no and this returned, silently: type a prize,
     * press the heading, nothing happens. A dead control that draws
     * perfectly, which is this repo's commonest fault and exactly what
     * driving it in a browser is for.
     *
     * The guard was never needed anyway — this listener is bound to the
     * panel, so anything reaching it came from inside the panel.
     */
    if (!e.target.closest('.lb-pz-head')) return;
    /*
     * THE BAR FLIPS THE FLAG AND DOES A FULL REPAINT, because shutting the
     * table is the moment Launch has to catch up — the gate asks whether
     * anybody can be paid, and what was just typed may be the answer. There is
     * no caret to lose: the table is going away.
     */
    onToggle();
  });
  /*
   * TYPING WRITES AND DOES NOT REPAINT — a repaint per keystroke rebuilds the
   * inputs and takes the caret with them, so you would type one letter a box.
   *
   * AND IT STORES THE WHOLE ROW, not the box that changed: what is on screen
   * is the venue's deal until somebody edits it, so pinning one box would
   * leave the rest following a deal that has since moved. What you can see is
   * what the night gets.
   */
  /*
   * WHICH LINES PAY — a CHOICE rather than typing, so it stores and puts the
   * neighbours right in place: `moveStage()` may move the prizes either side
   * to keep the list rising, and a row's choices never depend on its
   * neighbours, so each dropdown just takes its new value. **NOTHING IS
   * REPAINTED** — this is a `change` listener in the panel the note below
   * warns about, and it is safe for exactly the reason that note gives: the
   * table is never replaced under the pointer. `afterStages()` only rewrites
   * the settings row, so the Prizes dropdown names the lines chosen here.
   */
  el.addEventListener('change', (e) => {
    const pick = e.target.closest('.lb-pz-stage');
    if (!pick) return;
    const part = partsNow()[Number(pick.dataset.part)];
    if (!part || !part.lines) return;
    const next = moveStage(part.lines, Number(pick.dataset.at), Number(pick.value));
    setPartStages(part, next);
    for (const other of el.querySelectorAll(`.lb-pz-stage[data-part="${pick.dataset.part}"]`)) {
      other.value = String(next[Number(other.dataset.at)]);
    }
    afterStages();
  });
  el.addEventListener('input', (e) => {
    const box = e.target.closest('.lb-pz-in');
    if (!box) return;
    const part = partsNow()[Number(box.dataset.part)];
    if (!part) return;
    const list = [...el.querySelectorAll(`.lb-pz-in[data-part="${box.dataset.part}"]`)]
      .sort((a, b) => Number(a.dataset.at) - Number(b.dataset.at))
      .map((n) => n.value);
    setPartRewards(part, list);
    // The reason-line under the table counts what is typed, so it has to keep
    // up — and it holds no caret, so it is safe to rewrite mid-keystroke.
    const note = el.querySelector('.lb-pz-note');
    if (note) note.textContent = noteText();
  });
  /*
   * AND NOTHING REPAINTS ON BLUR. THIS IS LOAD-BEARING.
   *
   * There was a `change` listener here that called `paintOrder()`, on the
   * reasoning that leaving a box is the first moment a full repaint costs no
   * caret. It cost something far worse: `change` fires on BLUR, blur happens
   * on MOUSEDOWN, and the repaint replaces the table — so the element the
   * mouse went down on is detached before the mouse comes up, and the browser
   * dispatches NO CLICK AT ALL.
   *
   * Measured in a real browser: zero click events reached `document`. Every
   * control pressed straight after typing a prize was dead on the first
   * press, including LAUNCH, with nothing thrown and nothing in the console.
   * A test that the payload is right proves nothing about whether anybody
   * could press the button — this is that lesson, in the one place a gig
   * cannot afford it.
   *
   * So typing only stores, and the repaint happens when the table is SHUT,
   * which is a press that is not competing with a blur.
   */
}
