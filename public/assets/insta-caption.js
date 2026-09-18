/**
 * THE CAPTION FOR A NIGHT'S SOCIALS POST — drafted, never sent.
 *
 * *"I want to use the showcase photos as the photos I post to Instagram, I
 * want a quick workflow for this purpose."*
 *
 * **THE BLANK PAGE IS WHERE THE TIME GOES, NOT THE SEND** — `reply-draft.js`'s
 * shape, which this file is a second instance of: the app prepares, the human
 * reads, the human posts. Nothing here talks to Instagram and nothing ever
 * should. There is no posting API for a personal account, and even if there
 * were, *do not build a send that skips the reading* — a caption naming the
 * wrong pub or the wrong headcount lands on the relationship the quizmaster is
 * paid to keep.
 *
 * **NOTHING NEW IS COLLECTED.** Every line is something the archive and the
 * diary already hold: the venue off the night, the headcount off its games,
 * the next date off `upcoming()` — the same projection the comeback slide and
 * the calendar read — and the address off `galleryPath()`.
 *
 * **SILENCE WHEN THERE IS NOTHING TRUE TO SAY**, which is the comeback band's
 * own rule. No venue, no venue line. No headcount, no number. Nothing in the
 * diary, no "back on" line — a caption that guessed a date would be worse than
 * one that did not mention it, because he will paste it without re-reading the
 * bit he did not ask for.
 *
 * **AND THE WINNING TEAM IS DELIBERATELY NOT IN IT.** Two reasons and either
 * would do. A team's name in a caption HE posts is a public naming they never
 * agreed to — the gallery's own league page masks names for exactly that, and
 * `clean-names.js` lives on the SERVER by design, so the browser has the real
 * name and no safe way to judge it. And a second copy of that word list in
 * here is the thing this repo refuses everywhere else. He is reading the
 * caption anyway: if he wants to name them, he knows them.
 *
 * A LEAF WITH NO PAGE OF ITS OWN — no DOM, no fetch, no state. `upcoming()`
 * is injected rather than imported so this stays testable in node.
 */

/** A pub's town, off the end of its name — "The Station Tap, Wokingham". */
export function townOf(venue) {
  const parts = String(venue || '').split(',');
  if (parts.length < 2) return '';
  return parts[parts.length - 1].trim();
}

/** `#wokingham` — letters and digits only, so a hashtag cannot break. */
function tag(words) {
  const clean = String(words || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  return clean ? `#${clean}` : '';
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** "Thursday 27th" — the comeback slide's wording, which he already uses. */
export function whenWords(date) {
  const at = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(at.getTime())) return '';
  const day = at.getUTCDate();
  const th = (day % 10 === 1 && day !== 11) ? 'st'
    : (day % 10 === 2 && day !== 12) ? 'nd'
      : (day % 10 === 3 && day !== 13) ? 'rd' : 'th';
  return `${WEEKDAYS[at.getUTCDay()]} ${day}${th}`;
}

/**
 * THE HEADCOUNT IS THE MAX ACROSS A NIGHT'S GAMES, NEVER THE SUM — the rule
 * `headcounts.js` already holds, because a quiz and the bingo after it are the
 * same forty people and adding them up doubles the room.
 */
export function playedOn(night) {
  return (night && Array.isArray(night.games) ? night.games : [])
    .reduce((most, g) => Math.max(most, Number(g && g.players) || 0), 0);
}

/**
 * The draft.
 *
 * @param {object}   night     a row off Past gigs — `{ night, venue, games }`
 * @param {string}   gallery   the night's public address, or '' if not published
 * @param {function} nextNight `() => ({ date, venue })[]` — `upcoming()`, injected
 */
export function captionFor({ night = {}, gallery = '', nextNight = () => [] } = {}) {
  const venue = String(night.venue || '').trim();
  const lines = [];

  lines.push(venue ? `Another one at ${venue} 🎤` : 'Another quiz night 🎤');

  const played = playedOn(night);
  if (played > 0) lines.push(`${played} playing.`);

  /*
   * THE NEXT ONE AT THIS PUB, not the next one anywhere — a caption under
   * photographs of The Station Tap saying "back Tuesday" about The Crown is
   * the kind of wrong that reads as carelessness to the venue in it.
   */
  if (venue) {
    const want = venue.toLowerCase();
    const next = (nextNight() || []).find((n) => String(n.venue || '').toLowerCase() === want);
    if (next && next.date > String(night.night || '')) {
      lines.push(`Back ${whenWords(next.date)} — same time, same place.`);
    }
  }

  if (gallery) lines.push(`All the photos: ${gallery}`);

  const tags = ['#pubquiz', '#quiznight', tag(townOf(venue))].filter(Boolean);
  lines.push(tags.join(' '));

  return lines.join('\n\n');
}
