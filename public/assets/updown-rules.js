/**
 * UP OR DOWN — the rules, shared by the server, the projector and the phone.
 *
 * Picked by the host on 9 October 2026 off five ideas for a drink game between
 * rounds: *"up or down sounds good"*. A card is on the big screen; every phone
 * says whether the next one is HIGHER or LOWER; wrong guesses are out; the
 * last one standing gets a drink.
 *
 * **ITS OWN NAME, AND ONLY ITS OWN.** Higher-or-lower is a parlour game older
 * than anybody's television format, and the format NAMES are somebody else's
 * — this app is SOLD, so it is *Up or Down*, with no host catchphrase and no
 * giant cards on a stage.
 *
 * **THE WIFI DOES NOT DECIDE IT.** One tap per card, with seconds to make it,
 * and the server stamps the deadline (rule 2) — the one drink game here where a
 * slow phone loses nothing.
 */
import { DECK, RANKS } from './deck.js';
import { seeded } from './seeded.js';

/** How long the room has to say higher or lower — long enough to argue about it. */
export const VOTE_MS = 12000;
/** Two phones at least: one person guessing is not a game, it is a quiz of one. */
export const MIN_PLAYERS = 2;

/** A card's rank as a number, Ace LOW — the order everybody grew up with. */
export function rankOf(card) {
  const rank = String(card && card.rank !== undefined ? card.rank : String(card || '').slice(0, -1));
  return RANKS.indexOf(rank) + 1;
}

/** Was the next card 'higher', 'lower', or the 'same' rank? */
export function compare(card, next) {
  const a = rankOf(card); const b = rankOf(next);
  if (b > a) return 'higher';
  if (b < a) return 'lower';
  return 'same';
}

/** A shuffled deck from one seed — the same on every restart. */
export function shuffled(seed) {
  const rand = seeded(seed);
  const order = DECK.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/** The card at a position in a shuffled order, as the deck holds it. */
export const cardAt = (order, at) => DECK[order[at]];

/**
 * UP OR DOWN AS A GAME OF THE NIGHT — the "pack" a running order names.
 * No file, like the deck and Pub Prix: there is nothing to write or own.
 */
export function upDownPack() {
  return {
    id: 'up-or-down',
    kind: 'updown',
    title: 'Up or Down',
    subtitle: 'Higher or lower? Wrong guesses are out — the last one standing gets a drink.',
  };
}
