/**
 * What makes a good music bingo track, for the IN-APP generator only.
 *
 * This used to write a whole brief for pasting into Claude in a browser,
 * carrying the no-repeats list with it. That is gone, and deliberately so:
 * Claude now reads `data/track-history.json` off this repository itself and
 * keeps the house rules in its own skill. Two copies of a rule is how a rule
 * quietly stops applying, and the copy that mattered — what NOT to pick — is
 * better fetched than pasted, because a paste is a snapshot.
 *
 * What is left is the prompt for `generate-bingo.js`, the fallback for when
 * there is no browser to hand. It does not have to match Claude's own rules
 * word for word; it is not the thing that curates.
 */

/**
 * What makes a good music bingo track. Shared, so it cannot drift.
 *
 * The chorus rule is the one people get wrong: the host plays one chorus and
 * moves on, so a song recognisable only from a long intro or a riff is a poor
 * pick however famous it is.
 */
export function trackRules() {
  // One entry per rule, wrapped for reading. Kept as whole rules rather than
  // lines so the bullets cannot end up on the wrong line when one is reworded.
  return [
    'Recognisable within a few seconds to a room that is half-listening and drinking.',
    'THE CHORUS is what gets played. The host plays one chorus and moves on, so a\nsong that is only recognisable from a long intro, a riff, or an instrumental\nsection is a poor choice however famous it is. The chorus has to land on its\nown, and ideally be singable.',
    'Well known in the UK specifically — think what fills a floor in Essex or Kent.',
    'A spread across the theme rather than six songs by the same artist. Two by one\nartist at the very most.',
    'Real songs with the exact title as released. Do not invent anything, and do not\nguess at a title you are unsure of.',
  ];
}

/** The rules as a bullet list, the shape both prompts want. */
export function rulesBlock() {
  return trackRules()
    .map((rule) => `- ${rule.split('\n').join('\n  ')}`)
    .join('\n');
}
