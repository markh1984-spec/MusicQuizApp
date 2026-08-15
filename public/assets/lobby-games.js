/**
 * THE LOBBY GAMES — the list, and which tier holds which.
 *
 * Plain data, read by the SERVER (to validate what a console sent and write it
 * into the game state) and by the BROWSER (to draw the picker and to load the
 * right module). One list, the same way `LOOKS` is one list — two copies of
 * this would be a console offering a game the server then refused, silently,
 * at the moment somebody pressed Launch.
 *
 * **No `import` of any actual game here.** This file has to be safe for the
 * server to read, and it is loaded on every console page; the modules
 * themselves are pulled in only when somebody presses the button, which is the
 * whole reason nobody who never plays pays for a game on pub wifi.
 *
 * ---
 *
 * **THE TIER GATES HOW MANY GAMES, NOT WHETHER THERE IS ONE.** The host's own
 * line: *"bronze just gets 2 games and silver/gold get more"*. So the two that
 * shipped are Bronze's and are also the two defaults — one per game type — and
 * anything added afterwards is what a higher tier buys.
 *
 * **Do not sell the game itself away from the bottom tier**, however tempting
 * a clean on/off gate looks. Its biggest value is not entertainment: a phone
 * with a game on it stays in the FOREGROUND, so sixty connections do not all
 * have to come back at the moment the join gate is busiest. That is a
 * RELIABILITY feature dressed as a toy, and selling reliability to the top
 * tier only makes a Wednesday worse for the people paying least.
 */

import { tierRank } from './plans.js';

/**
 * `blurb` is deliberately three or four words. It is read inside a `<select>`
 * on a console that is measured at 320px, and a sentence there is a sentence
 * nobody sees the end of — the picker says what a game IS, and how to play it
 * is on the game itself.
 *
 * THE ORDER IS THE LADDER — Bronze's two, then Silver's, then Gold's. The
 * picker draws them in this order and the locked ones stay in place, so what
 * a tier buys reads down the list rather than having to be worked out from
 * the labels.
 *
 * `defaultFor` is the game type this one is handed to when nobody has chosen —
 * `quiz`, `bingo`, or absent for the extras. Every game type must have exactly
 * one default, or a night falls through to a card with no game behind it.
 */
export const LOBBY_GAMES = [
  {
    id: 'maze',
    name: 'Maze Mouth',
    how: 'Tap where you want to go',
    blurb: 'a maze chase',
    tier: 'bronze',
    defaultFor: 'quiz',
    canvas: { w: 600, h: 600, klass: '' },
  },
  {
    id: 'rally',
    name: 'Rally',
    how: 'Slide your thumb along the bottom',
    blurb: 'bat and ball',
    tier: 'bronze',
    defaultFor: 'bingo',
    // 2:3, the court's own proportions and roughly a phone held upright.
    // `.tall` is where the height is bounded — see the note in style.css.
    canvas: { w: 600, h: 900, klass: 'tall' },
  },
  {
    id: 'tailback',
    name: 'Tailback',
    how: 'Tap where you want to go',
    blurb: 'a growing tail',
    tier: 'silver',
    canvas: { w: 600, h: 600, klass: '' },
  },
  {
    id: 'quickdraw',
    name: 'Quick Draw',
    how: 'Shoot the outlaws, never the sheriff',
    blurb: 'a western shoot-out',
    tier: 'gold',
    // 2:3 — two holes across and three down, which is a phone held upright.
    canvas: { w: 600, h: 900, klass: 'tall' },
  },
];

export const DEFAULT_LOBBY_GAME = 'maze';

/** One by id, or undefined. */
export function lobbyGameById(id) {
  return LOBBY_GAMES.find((g) => g.id === String(id || ''));
}

/**
 * WHICH GAME A NIGHT GETS — what was chosen if it is a real game this account
 * may have, otherwise the default for the kind of night it is.
 *
 * **The same function answers it on the server and on the phone**, which is
 * what stops the console's idea of tonight's game drifting from the one the
 * room is actually handed. `tier` is optional: pass it where the answer has to
 * respect what somebody is paying for (the launch), and leave it out where the
 * choice has already been made and only has to be honoured (the phone).
 */
export function lobbyGameFor(kind, chosen = '', tier = '') {
  const want = lobbyGameById(chosen);
  if (want && (!tier || heldAt(want, tier))) return want;
  return LOBBY_GAMES.find((g) => g.defaultFor === kind)
    || lobbyGameById(DEFAULT_LOBBY_GAME);
}

/** Is this game inside that tier? The owner holds everything. */
export function heldAt(game, tier) {
  if (!game) return false;
  if (tier === 'owner') return true;
  return tierRank(tier) >= tierRank(game.tier);
}

/**
 * The list as a picker wants it — every game, in order, each saying whether
 * this tier holds it.
 *
 * **The ones above the tier are RETURNED, not filtered out.** Somebody who
 * cannot have a game should still know it exists: on this ladder the locked
 * ones are the whole argument for moving up, and it is the same subtle upsell
 * the Adverts tab already uses.
 */
export function lobbyGameChoices(tier) {
  return LOBBY_GAMES.map((g) => ({ ...g, held: heldAt(g, tier) }));
}
