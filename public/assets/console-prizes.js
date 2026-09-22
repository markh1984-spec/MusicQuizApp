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
import { dealPrizes, paysOf } from './prize-parts.js';

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
  const shapePrizes = (part) => {
    const pack = packOf(part.packId);
    const best = pack ? bestBingoShape(cardShapes, pack.trackCount) : null;
    const shape = part.shape || (best ? { rows: best.rows, cols: best.cols } : null);
    const known = cardShapes.find((sh) => shape && sh.rows === shape.rows && sh.cols === shape.cols);
    return Number(known && known.prizes) || 1;
  };
  const raw = slots ? partsOfSlots(slots) : (picked ? [{
    kind: picked.kind === 'bingo' ? 'bingo' : picked.kind,
    at: -1,
    packId: picked.pack.id,
    prizes: night.prizes || 0,
    shape: night.shape || null,
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
  return parts.map((part, i) => ({
    ...part,
    list: Array.isArray(part.rewards) ? part.rewards : dealt[i],
    own: Array.isArray(part.rewards),
  }));
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
 * THE ONE LINE UNDER THE TABLE, and it is silent unless something is wrong.
 *
 * *Silence where there is nothing true to say* — a night whose prizes are
 * right gains nothing from being told so, and space is at a premium. What it
 * does say is the thing the host cannot see at a glance: how many drinks the
 * whole evening is about to hand out against what the venue has put up.
 */
export function prizeNote(parts, { venueName, venueList }) {
  const want = prizesTonight(parts).length;
  const have = (venueList || []).length;
  if (!have || want <= have) return '';
  return `That is ${want} prizes across the night and ${have} on ${venueName}'s list.`;
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
      const chips = Array.from({ length: n }, (_, at) => `<span class="lb-pz${
        list[at] ? '' : ' lb-pz-none'}"><i>${at + 1}</i>${
        esc(list[at] || 'Nothing set')}</span>`).join('');
      return `<span class="lb-pz-line"><b>${esc(partName(part))}</b>${chips}</span>`;
    }
    return `<div class="lb-pz-row" data-part="${i}">
        <span class="lb-pz-who">${esc(partName(part))}</span>
        ${Array.from({ length: n }, (_, at) => `<label class="lb-pz-box">
          <span>${esc(placeWord(at + 1))}</span>
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
