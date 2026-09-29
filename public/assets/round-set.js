/**
 * A ROUND'S OWN SETTINGS FOR TONIGHT — its seconds, and a picture round's
 * reveal — shared by the SERVER and the launch bar, like `break-parts.js`.
 *
 * The host, 29 September 2026: *"each round should carry its own settings but
 * there should be defaults so you're only changing them if you need to."*
 * The settings row stays the default; a round that says nothing plays as it
 * always did.
 *
 * **CARRIED ON THE ROUND'S REFERENCE** — `{ packId, round, questionSeconds,
 * reveal }` in the running order — because that reference is the one place a
 * round is named on its way to the room. The launch, a saved show and the
 * crash recovery (`state.order`) all carry it with no second copy, and
 * `composeQuiz()` puts it on the round it builds, where the engine already
 * reads a round's own `questionSeconds` and `reveal`.
 *
 * **A ROUND'S OWN CLOCK NO LONGER PAYS MORE** — speed points scale to the
 * clock (`speedPoints()` in `src/scoring.js`), which is what made seconds per
 * round fair to offer.
 */

/** The clocks the bar offers. Any 5–120 is honoured; these are the choices. */
export const ROUND_SECONDS = [10, 15, 20, 25, 30, 45, 60];

/**
 * The reveals a picture round may take — `REVEAL_MODES` in `src/quizzes.js`
 * plus `mix`, which a pack may say too. A test holds the two lists together.
 */
export const ROUND_REVEALS = ['zoom', 'pixelate', 'blur', 'tiles', 'mix'];

/** What each reveal is called on the bar. */
export const REVEAL_WORDS = { zoom: 'Zoom', pixelate: 'Pixelate', blur: 'Blur', tiles: 'Tiles', mix: 'Mix' };

/**
 * Only a real clock and a real reveal survive — it arrives from a browser.
 * 5–120 is the launch route's own clamp on the night's seconds.
 */
export function cleanRoundSet(entry) {
  const out = {};
  const secs = Math.round(Number(entry && entry.questionSeconds));
  if (secs >= 5 && secs <= 120) out.questionSeconds = secs;
  const reveal = String((entry && entry.reveal) || '').toLowerCase();
  if (ROUND_REVEALS.includes(reveal)) out.reveal = reveal;
  return out;
}

/** Keyed by pack AND round index, never by title — the rule `lbOff` follows. */
export const roundKey = (packId, round) => `${packId}#${round}`;

/**
 * Round references with tonight's settings on them. The bar's map is the
 * truth: a setting taken off is taken off, so what a reference already
 * carried is dropped before the map's is added.
 */
export function withRoundSet(order, set) {
  const map = set && typeof set === 'object' ? set : {};
  return (Array.isArray(order) ? order : []).map((entry) => {
    const { questionSeconds: _s, reveal: _r, ...rest } = entry || {};
    return { ...rest, ...cleanRoundSet(map[roundKey(rest.packId, rest.round)]) };
  });
}
