/**
 * A quizmaster's own two colours.
 *
 * The app is pink into orange because that is what the first host liked. The
 * second one may not, and "it looks like somebody else's app" is a real reason
 * a subscriber does not put it on a projector with their name above it. So the
 * two dominant colours are a setting on the ACCOUNT, and every screen that
 * belongs to that quizmaster's night wears them.
 *
 * ---
 *
 * **A scheme is a BRAND. A look is a NIGHT. They are not the same thing and
 * they must not fight.**
 *
 * A scheme sets `--hot` and `--hot-2` — the buttons, the logo, the highlights,
 * the washes behind everything. It deliberately does NOT touch `--a` to `--f`,
 * the option colours, because those are how a player looks up, decides "the
 * pink one, bottom left", and looks back down. Those belong to `looks.js` and
 * to nobody else.
 *
 * A look wins where they overlap, and that is why the `[data-scheme]` blocks
 * come BEFORE the `[data-look]` blocks in `style.css` — same specificity, so
 * source order decides. Halloween is orange and black on everybody's account,
 * because a themed night is about the night rather than about whose it is.
 * There is a test for the ordering.
 *
 * ---
 *
 * **The palette changes on the projector AND the phones, or neither** — the
 * same rule looks have, for the same reason. Both pages take the scheme from
 * the ROOM, not from whoever is signed in on them, so a phone that joined
 * Rob's game is Rob's colours even if the owner is looking at the console in
 * the next tab.
 *
 * The colours themselves live in `style.css` under `[data-scheme="…"]`, so
 * there is one place to change one. A test checks the two lists agree — a
 * scheme with no palette would silently be the ordinary one under a new name.
 */

export const DEFAULT_SCHEME = 'sunset';

export const SCHEMES = [
  {
    id: 'sunset',
    label: 'Sunset',
    blurb: 'Hot pink into orange. The way it has always looked.',
  },
  {
    id: 'orchid',
    label: 'Orchid',
    blurb: 'Pink into deep purple. Softer, and still loud from the back.',
  },
  {
    id: 'lagoon',
    label: 'Lagoon',
    blurb: 'Turquoise into blue. The coolest of them.',
  },
  {
    id: 'ember',
    label: 'Ember',
    blurb: 'Red into amber. Warm, close to a pub light.',
  },
  {
    id: 'citrus',
    label: 'Citrus',
    blurb: 'Lime into gold. The brightest on a weak projector.',
  },
  {
    id: 'ultra',
    label: 'Ultraviolet',
    blurb: 'Violet into magenta. Nightclub, not pub.',
  },
];

/** A scheme by id, falling back to the ordinary one rather than to nothing. */
export function findScheme(id) {
  const found = SCHEMES.find((s) => s.id === String(id || ''));
  return found ? found.id : DEFAULT_SCHEME;
}

/**
 * Put a scheme on the page.
 *
 * Set on the root element, like `data-look`, so every rule in the stylesheet
 * sees it and nothing has to be re-rendered to pick it up. Guarded because
 * this is called on every state push and writing the same value back would
 * restart the CSS transitions on the washes each time somebody answers.
 */
export function paintScheme(scheme) {
  const id = findScheme(scheme);
  const root = document.documentElement;
  if (root.dataset.scheme !== id) root.dataset.scheme = id;
  return id;
}
