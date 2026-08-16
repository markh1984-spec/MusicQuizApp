/**
 * WHAT A SHOW PLAYS, IN ORDER — the one reader, shared by the server and the
 * browser.
 *
 * A show is an EVENING: a quiz, then the bingo after it, at a venue. That is
 * `items`. But a show held ONE game for its first commit, so records exist —
 * including on the host's own live disk — with `kind` and `packId` at the top
 * level and no list at all.
 *
 * **BOTH SHAPES HAVE TO READ, AND EXACTLY ONE PIECE OF CODE MAY DECIDE HOW.**
 * The server validates and stores; the console draws the parts on a card, in
 * the editor, and when a show is dropped onto Tonight. That is five callers
 * across two runtimes, and a private copy in each is five chances for the
 * console to disagree with the launch about what a night contains — which is
 * the console-and-projector disagreement this codebase keeps recording, one
 * step earlier.
 *
 * So it lives here, in `public/assets/`, like `plans.js`, `schemes.js` and
 * `diary.js` — browser files the server imports because the rule inside them
 * has to be the same rule on both sides. It deliberately has no imports of its
 * own, so a browser can load it directly and Node can too.
 *
 * **THERE IS NO MIGRATION STEP AND THERE MUST NOT BE ONE.** A rewrite over
 * everybody's shows file is a one-shot script that either runs or does not,
 * on a free tier whose disk is wiped on every deploy — where reading both
 * shapes is a function that cannot half-run. The old shape stops appearing on
 * its own, as shows are re-saved.
 */

/**
 * @param {object} show  a show, in either shape
 * @returns {Array<{kind: string, packId: string, order?: Array}>}
 *          what it plays, in the order the room gets it. Empty when it names
 *          nothing at all, which is a thing `normalise()` refuses to store but
 *          which a hand-edited file can still contain.
 */
export function itemsOf(show = {}) {
  if (Array.isArray(show.items) && show.items.length) return show.items;
  if (!show.packId) return [];
  return [{
    kind: show.kind || 'quiz',
    packId: show.packId,
    ...(show.order && show.order.length ? { order: show.order } : {}),
  }];
}

/**
 * A one-line summary of an evening, for a card or a button.
 *
 * Takes a `title` function rather than reading a library, because the server
 * and the browser hold what a pack is called in different places — and this
 * file must not learn about either of them.
 */
export function showLine(show, title) {
  const parts = itemsOf(show).map((item) => title(item.kind, item.packId));
  return parts.join(', then ');
}
