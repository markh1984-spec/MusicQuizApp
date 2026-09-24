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
 * first place. This file is only the DEAL: what each of tonight's games is
 * handed from the venue's standing list before anybody edits the table.
 *
 * ---
 *
 * AND THE DRINKS ARE ASSIGNED PER GAME, NOT PER NIGHT — set 23 September 2026:
 * *"I actually think then that drinks should be assigned per game and not per
 * night."* The deal used to SHARE the venue's one list down the night — the
 * quiz the first three, the next game the three after — and a card-bingo game
 * pays one prize a round, so its share was ONE: the second game of card bingo
 * found nothing on its list and its winner got nothing on their phone, with
 * nothing thrown. What the venue and the host agree the night costs is theirs
 * to decide, never the software's, so **EVERY GAME IS DEALT FROM THE TOP.**
 * The quiz's first place and the bingo's first line are both the venue's first
 * drink. **Do not put the sharing back to "save" drinks** — that is the host's
 * call on the night, and the typed table is where he makes it.
 *
 * THE DEAL IS BY WHAT A PART PAYS, NOT BY WHAT IT PAID. `pays` is known at
 * launch — the Winners setting for a quiz, the card's stopping points for a
 * bingo game — so the same night deals the same way every time, whoever ties
 * and whoever scores nothing.
 */

/**
 * Deal a venue's list to each of the night's parts — every one FROM THE TOP.
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
  return (Array.isArray(pays) ? pays : []).map((n) => {
    const want = Math.max(0, Math.floor(Number(n) || 0));
    // FROM THE TOP, every part — per game, never a share of the night.
    const mine = all.slice(0, want);
    while (mine.length && !mine[mine.length - 1]) mine.pop();
    return mine;
  });
}

/**
 * THE NIGHT'S DRINKS, AS A REMINDER — NEVER A LIMIT.
 *
 * *"Nights shouldn't even have drinks totals in code, it should only be there
 * to remind me what the total should be."* Nothing in this app counts, shares
 * or caps what a night hands out: every game is dealt from the top and pays
 * what it pays. This is the one place a night-wide number appears, and it is
 * a sentence under the prize table that stops nothing.
 *
 * IT MUST BE TRUE, which is why card bingo is said rather than counted: a
 * deck pays one drink a GAME and nobody knows at launch how many games there
 * will be, so any single total would be a number that undercounts in front of
 * the man agreeing it with a landlord. And it no longer compares the night to
 * the venue's list — per game, a list shorter than the night runs nobody dry,
 * so saying so would be a warning about nothing.
 *
 * @param {Array<{kind: string, list: string[]}>} parts  the table's parts
 * @returns {string} the reminder, or '' when nothing is set to be won
 */
export function nightReminder(parts) {
  const all = Array.isArray(parts) ? parts : [];
  const filled = (p) => (Array.isArray(p && p.list) ? p.list : [])
    .filter((r) => String(r || '').trim()).length;
  const fixed = all.filter((p) => p && p.kind !== 'cards').reduce((n, p) => n + filled(p), 0);
  const perGame = all.some((p) => p && p.kind === 'cards' && filled(p));
  // A round is a game (24 September 2026): a music bingo round past its list
  // pays the last drink again, so extra rounds are SAID rather than counted,
  // exactly as card bingo's games are.
  const extraRounds = all.some((p) => p && p.kind === 'bingo' && filled(p));
  if (!fixed && !perGame) return '';
  if (!fixed) return 'Tonight gives out one drink for every game of card bingo you play.';
  const also = [
    perGame ? 'one for every game of card bingo you play' : '',
    extraRounds ? 'one for every extra round of bingo' : '',
  ].filter(Boolean).join(' and ');
  return `Tonight gives out ${fixed} drink${fixed === 1 ? '' : 's'}${also ? `, plus ${also}` : ''}.`;
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

/*
 * ========================================================== WHICH LINES PAY
 *
 * A bingo prize is a STAGE: a number — how many complete lines it takes — or
 * `'full'`, a full house. The Prizes control has always chosen HOW MANY; since
 * 23 September 2026 the host also chooses WHICH: *"I select 3 and then select
 * lines 2, 3 and full house."*
 *
 * **HERE, BECAUSE BOTH SIDES HAVE TO GIVE THE SAME ANSWER.** The console draws
 * the choices and the server checks them at launch; two copies of "is this a
 * list a room can play" is one that gets fixed while the other launches. The
 * GEOMETRY — how many lines a card can hold — stays in `bingo.js` beside the
 * card, and is handed in as `maxLine`.
 */
export const FULL_HOUSE = 'full';

/** The stages nobody chose: a line, 2 lines, 3 … then a full house. */
export function defaultStages(count) {
  const n = Math.max(1, Math.floor(Number(count) || 1));
  return [...Array(n - 1).keys()].map((i) => i + 1).concat(FULL_HOUSE);
}

/** "a line", "3 lines", "a full house" — one wording, used on every screen. */
export function stageWord(stage) {
  if (stage === FULL_HOUSE) return 'a full house';
  return stage === 1 ? 'a line' : `${stage} lines`;
}

/** The ordinal the host says on the mic: prize 2 is "the second prize". */
const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];

/**
 * THE MAIN BUTTON AFTER A WIN — "Play on for the second prize — 2 lines".
 *
 * Asked for in those words: *"after the first bingo it should say 'play on
 * for the second prize' and then 'play on for the third prize' etc. but this
 * MUST be conditional on the amount of prizes selected at the start of the
 * game."* The COUNT is the launch's (`stage.total`, off the card's stopping
 * points or the Bingo prizes picker) and the ordinal is the NEXT prize's, so
 * the button says what the host is about to announce; the stage word rides
 * along after a dash, so what the room needs for it is on the same line.
 *
 * At the LAST stage there is nothing to play on for and this is `null` — the
 * caller draws Finish or Continue there. A deck has ONE stage, so it is null
 * from its first win: that is what keeps card bingo from offering a second
 * pint on one game.
 *
 * @param {{index: number, total: number, last: boolean}|null} stage  the host view's `stage`
 * @param {Array<{label: string}>|null} prizes  the host view's `prizes`, one per stage
 * @returns {string|null}
 */
export function playOnLabel(stage, prizes) {
  if (!stage || stage.last) return null;
  const next = Number(stage.index || 0) + 1;
  const total = Number(stage.total || 0);
  if (total && next >= total) return null;
  const ordinal = ORDINALS[next] || `${next + 1}th`;
  const needs = Array.isArray(prizes) && prizes[next] && prizes[next].label;
  return `Play on for the ${ordinal} prize${needs ? ` — ${needs}` : ''}`;
}

/**
 * THE LIST ITSELF IF A ROOM CAN PLAY IT, `null` IF NOT — and `null` means "use
 * the default", never "refuse the launch": a refusal there costs the night.
 *
 * - **exactly `count` of them, a full house LAST and only last** — the night
 *   ends on the whole card, as pub bingo does, and that was the correction
 *   when this was asked for (*"I meant full house actually not 5 lines"*);
 * - **the line counts strictly RISING**, or the second prize is already won by
 *   whoever took the first;
 * - **none above `maxLine`**, the most lines a card holds WITHOUT being a full
 *   house — past that a line prize and the full house are one prize twice.
 */
export function checkStages(list, count, maxLine) {
  const n = Math.floor(Number(count) || 0);
  if (!Array.isArray(list) || !n || list.length !== n || list[n - 1] !== FULL_HOUSE) return null;
  let last = 0;
  for (const lines of list.slice(0, -1)) {
    if (!Number.isInteger(lines) || lines <= last || lines > maxLine) return null;
    last = lines;
  }
  return list.slice();
}

/** The line counts line-prize `at` may be set to, leaving room either side of it. */
export function stageChoices(at, count, maxLine) {
  const lineRows = Math.floor(Number(count) || 0) - 1;
  const lo = at + 1;
  const hi = maxLine - (lineRows - 1 - at);
  return lo > hi ? [] : Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
}

/**
 * Put line-prize `at` on `lines` and move its neighbours only as far as they
 * must — later ones up, earlier ones down — so every choice the picker offers
 * lands on a list the room can play, and nothing else the host set is moved.
 */
export function moveStage(list, at, lines) {
  const next = list.slice();
  next[at] = lines;
  for (let i = at + 1; i < next.length - 1; i += 1) next[i] = Math.max(next[i], next[i - 1] + 1);
  for (let i = at - 1; i >= 0; i -= 1) next[i] = Math.min(next[i], next[i + 1] - 1);
  return next;
}
