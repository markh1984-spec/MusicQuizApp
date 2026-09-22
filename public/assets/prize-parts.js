/**
 * WHAT EACH GAME OF THE NIGHT PAYS.
 *
 * A model with no DOM in it, imported by the console AND by the server —
 * `show-parts.js` and `break-parts.js`'s arrangement, for the same reason:
 * the console draws the prize table and the server hands each part its list,
 * and the two may not disagree about what the night is playing for.
 *
 * ---
 *
 * THE VENUE'S LIST WAS WALKED THROUGH BY COUNTING VOUCHERS, AND THAT IS WHAT
 * WENT WRONG.
 *
 * Each part of a night pays its winners as it ends, so a quiz followed by the
 * bingo needed to know how far down the venue's six drinks the night had got.
 * That was `state.prizesBefore`, and it counted the vouchers actually MINTED
 * — which is not the number of places a part recognises:
 *
 *   - A TIE FOR FIRST IS PAID IN FULL, by decision. Two teams at 1st plus 2nd
 *     and 3rd is FOUR vouchers for three places, so the bingo started at the
 *     venue's FIFTH drink and the fourth was never given out.
 *   - A ROW SCORING ZERO IS SKIPPED, also by decision. A quiet room where two
 *     teams scored minted two, so the bingo started again at the THIRD drink
 *     and handed the same one out twice.
 *
 * Both silent, both in front of the room, and neither visible on the bar.
 *
 * *"I can keep track of how many prizes I've given out over 2-3 games no
 * problem at all and putting this into code seems overly restrictive"* — so
 * the counting is gone. Each part carries its OWN list and starts at its own
 * first place. This file is only the DEAL: how the venue's standing list is
 * spread across tonight's games to fill the table in before anybody edits it.
 *
 * THE DEAL IS BY WHAT A PART PAYS, NOT BY WHAT IT PAID. `pays` is known at
 * launch — the Winners setting for a quiz, the card's stopping points for a
 * bingo game — so the same night deals the same way every time, whoever ties
 * and whoever scores nothing.
 */

/**
 * Deal a venue's list across the night's parts.
 *
 * @param {string[]} list   the venue's prizes, in the order they go out
 * @param {number[]} pays   how many each part pays, in running order
 * @returns {string[][]}    one list per part
 *
 * A part whose share runs past the end of the list gets a SHORT list rather
 * than blanks — `rewardList()` drops trailing empties anyway, and a blank is
 * indistinguishable on the bar from a prize somebody has not typed yet.
 */
export function dealPrizes(list, pays) {
  const all = (Array.isArray(list) ? list : []).map((r) => String(r || '').trim());
  let at = 0;
  return (Array.isArray(pays) ? pays : []).map((n) => {
    const want = Math.max(0, Math.floor(Number(n) || 0));
    const mine = all.slice(at, at + want);
    at += want;
    while (mine.length && !mine[mine.length - 1]) mine.pop();
    return mine;
  });
}

/**
 * HOW MANY PRIZES ONE PART PAYS.
 *
 * The number the deal above spreads by, and the number of boxes the console's
 * prize table draws for that game — so the table CANNOT disagree with the
 * night. Set Winners to 2 and the quiz drops to two boxes; put the bingo on a
 * 3x3 and it drops to one.
 *
 * That is the whole point of deriving it rather than letting somebody type a
 * count: a 5x5 card running five stopping points beside three typed drinks is
 * exactly the night that ended with *"my quiz and bingo winners on thursday
 * didn't receive a QR code"* — stops four and five mint nothing, in silence.
 *
 * @param {object} part          `{ kind, prizes }` — a running-order segment or a Tonight slot
 * @param {object} opts
 * @param {number} opts.winners  how many places the quiz recognises tonight
 * @param {number} opts.bingo    how many stopping points this card pays, already resolved
 */
export function paysOf(part, { winners = 3, bingo = 0 } = {}) {
  const kind = (part && part.kind) || 'quiz';
  if (kind === 'quiz') return Math.max(1, Math.floor(Number(winners) || 3));
  /*
   * A DECK DEALS ONE HAND AND PAYS ONE PRIZE A ROUND — it has no card shape
   * and no stopping points, so neither the slot nor the shape table can
   * answer for it. Named rather than fallen into: a fifth game asking this
   * question should answer it for itself rather than inherit a deck's.
   */
  if (kind === 'cards') return 1;
  return Math.max(1, Math.floor(Number(part && part.prizes) || Number(bingo) || 1));
}
