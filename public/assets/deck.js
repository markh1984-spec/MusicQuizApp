/**
 * FIFTY-TWO PLAYING CARDS — the whole of Card Bingo's "track list".
 *
 * ---
 *
 * Asked for directly: *"each person gets 13 playing cards and the console calls
 * one at a time until we have a winner"*, and then the half that decided the
 * architecture — ***"it's a separate game to music bingo"***.
 *
 * **IT IS A SEPARATE GAME AND THE SAME ENGINE, AND BOTH HALVES OF THAT MATTER.**
 * A deck is not a music pack: it is not on the bingo shelf, it is not called
 * Music Bingo, and it launches from its own tab. But its STATE is music bingo's
 * exactly — cards dealt at join, calls, marks, claims, prizes, vouchers, crash
 * recovery — so `LAUNCHERS.cards` builds a `BingoGame`, and not one rule in
 * `src/bingo.js` gets a second copy. Rule 6 (a card cannot be regenerated), the
 * one-prize-per-game rule, the held vouchers and the part-boundary carry all
 * arrive already true. A second engine would have been six rules to keep in
 * step and one of them silently drifting, which is the argument `src/arcade.js`
 * exists for.
 *
 * **THERE IS NO PACK FILE, DELIBERATELY** — the deck is generated here, the way
 * the DJ set's "pack" is a title. A deck is the same fifty-two cards for ever,
 * so a JSON file would be a thing to keep in step with nothing to keep it in
 * step with. It also means the deck never goes through `validateBingoPack()`,
 * which is what keeps that function — on the protected launch path — untouched.
 *
 * **THE CARD'S NAME IS ITS TITLE, WHICH IS WHY NOTHING IN THE PAYLOAD CHANGED.**
 * A square already draws `title`, so `A♠` lands on a phone with no new field on
 * any view, no whitelist edited (rule 1) and nothing for `pub-unchanged` to
 * report. What the phone needs beyond the words — is it red — is DERIVED from
 * the title by `isRed()` below rather than sent, so there is one definition of
 * a red suit and it is this file, read by the server and the browser alike.
 */

/** ♠ ♥ ♦ ♣ — the glyph is what a square shows, the word is what a host says. */
export const SUITS = [
  { key: 'spades', glyph: '♠', name: 'Spades', red: false },
  { key: 'hearts', glyph: '♥', name: 'Hearts', red: true },
  { key: 'diamonds', glyph: '♦', name: 'Diamonds', red: true },
  { key: 'clubs', glyph: '♣', name: 'Clubs', red: false },
];

/**
 * Ace low to King, in the order a hand is read.
 *
 * `10` is the only two-character rank and it is the reason the squares are
 * sized off it rather than off `A`: a face that fits twelve of the thirteen is
 * a face that clips one.
 */
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

/** How many cards are in one person's hand. Thirteen — a quarter of the deck. */
export const HAND = 13;

/**
 * The deck, in suit then rank order — which is the order the call sheet draws
 * and the order a hand is sorted into. Never shuffled here: `makeCard()` deals
 * and `drawNext()` calls, and both of those belong to the engine.
 */
export const DECK = SUITS.flatMap((suit) =>
  RANKS.map((rank) => ({
    id: `${suit.key[0]}${rank.toLowerCase()}`,
    title: `${rank}${suit.glyph}`,
    artist: '',
    rank,
    suit: suit.key,
  })));

/**
 * Is this card a red one?
 *
 * Read off the TITLE rather than a field, because the title is the only thing
 * that reaches a phone — see the note at the top. The glyph is the last
 * character of every card's name, so this holds for anything the engine hands
 * back, including a square rebuilt from a state file written months ago.
 */
export function isRed(title = '') {
  const glyph = String(title).slice(-1);
  return glyph === '♥' || glyph === '♦';
}

/** "Seven of Hearts" — what a host reads off the microphone, never a square. */
export function saidAloud(title = '') {
  const glyph = String(title).slice(-1);
  const suit = SUITS.find((s) => s.glyph === glyph);
  const rank = String(title).slice(0, -1);
  const word = { A: 'Ace', J: 'Jack', Q: 'Queen', K: 'King' }[rank] || rank;
  return suit ? `${word} of ${suit.name}` : String(title);
}

/**
 * The deck as a pack, which is all `LAUNCHERS.cards` needs to load.
 *
 * **THE SHAPE IS ONE ROW OF THIRTEEN, AND THAT IS NOT HOW IT IS DRAWN.**
 * Thirteen is prime, so a hand cannot be a grid — and the engine's own rule
 * says a card whose lines are different lengths is not a fair game, so a row of
 * 7 and a row of 6 must not be two lines. `{ rows: 1, cols: 13 }` gives
 * `cardLines()` exactly ONE line containing all thirteen squares, so the only
 * way to win is the full house and `maxPrizes()` answers 1 by itself.
 *
 * The phone then LAYS the same thirteen out seven over six, which is what was
 * asked for and is purely cosmetic: the server and every phone agree that one
 * line means all thirteen, so this is not the shape disagreement that once had
 * a 5x5's idea of a line running against a 4x4's.
 */
export function deckPack() {
  return {
    id: 'deck',
    kind: 'cards',
    title: 'Card Bingo',
    subtitle: 'Thirteen cards each. The console turns one at a time until somebody has the lot.',
    cardRows: 1,
    cardCols: HAND,
    // Dealt in suit-and-rank order — see `makeCard()` for why not at render.
    sortCard: true,
    tracks: DECK.map((c) => ({ ...c })),
  };
}
