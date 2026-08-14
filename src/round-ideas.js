/**
 * THREE ROUNDS THE LIBRARY HAS NOT GOT, offered to the room to vote on.
 *
 * ---
 *
 * The host's own improvement on an open text box, and it is a better design
 * for a reason worth writing down: **nothing a stranger types ever reaches the
 * quizmaster.** The three options come from this list, on the server; a phone
 * sends back which one it picked and nothing else. So there is no moderation
 * question, no word filter to argue about, no "durrr I was bored", and nobody
 * has to read anything to find out whether it was worth reading.
 *
 * It is also better DATA. A box collects opinions of wildly different quality
 * from whoever could be bothered to type; three buttons collect a vote, and a
 * vote can be counted — *"fourteen of the twenty who answered wanted reggae"*
 * is a sentence that decides what to write next. Typing on a phone in a pub is
 * a wall most people will not climb; tapping one of three is not.
 *
 * ---
 *
 * **ONLY WHAT IS NOT ALREADY ON THE SHELF.** Offering a Madonna round to
 * somebody who owns the Madonna quiz wastes one of three slots and makes the
 * app look like it has not read its own library. Each idea carries the words
 * that would give it away in a pack title, and any idea whose words appear
 * there is dropped before the three are picked.
 *
 * **THE SAME THREE ALL NIGHT, and that is what makes it countable.** They are
 * chosen once, at launch, and written into the game state like the look and
 * the card shape — so every phone in the room votes on the same three, the
 * numbers add up to something, and a restart at half eleven brings back the
 * same question rather than a fresh one.
 *
 * **`random` is injected**, exactly like the prize draw's, because "it offered
 * three the library has not got" is not a thing you can assert against
 * `Math.random`.
 */

/**
 * The pool. Each is `{ id, label, words }` — `words` being what would appear
 * in a pack title if this were already covered.
 *
 * Deliberately BROAD and pub-shaped: a theme somebody in a room would
 * recognise and want, not a genre taxonomy. Nothing here is a person, because
 * a single artist is a narrower ask than a round and the picture round already
 * covers faces.
 */
export const ROUND_IDEAS = [
  { id: 'reggae', label: 'A reggae round', words: ['reggae', 'ska'] },
  { id: 'motown', label: 'A Motown round', words: ['motown', 'soul'] },
  { id: 'disco', label: 'A disco round', words: ['disco'] },
  { id: 'britpop', label: 'A Britpop round', words: ['britpop'] },
  { id: 'punk', label: 'A punk round', words: ['punk'] },
  { id: 'onehit', label: 'One-hit wonders', words: ['one-hit', 'one hit'] },
  { id: 'movies', label: 'Songs from films', words: ['film', 'movie', 'cinema'] },
  { id: 'telly', label: 'TV theme tunes', words: ['tv', 'telly', 'television', 'theme tune'] },
  { id: 'christmas', label: 'A Christmas round', words: ['christmas', 'xmas', 'festive'] },
  { id: 'eurovision', label: 'A Eurovision round', words: ['eurovision'] },
  { id: 'boybands', label: 'Boy bands', words: ['boy band', 'boyband'] },
  { id: 'girlgroups', label: 'Girl groups', words: ['girl group', 'girlband', 'girl band'] },
  { id: 'country', label: 'A country round', words: ['country'] },
  { id: 'rockanthems', label: 'Rock anthems', words: ['rock anthem', 'anthems'] },
  { id: 'dance90s', label: 'Nineties dance', words: ['dance', 'rave', 'club classics'] },
  { id: 'hiphop', label: 'A hip-hop round', words: ['hip-hop', 'hip hop', 'rap'] },
  { id: 'karaoke', label: 'Karaoke classics', words: ['karaoke'] },
  { id: 'duets', label: 'Famous duets', words: ['duet'] },
  { id: 'covers', label: 'Covers better than the original', words: ['cover'] },
  { id: 'summer', label: 'Songs of the summer', words: ['summer'] },
  { id: 'breakup', label: 'Break-up songs', words: ['break-up', 'breakup', 'heartbreak'] },
  { id: 'wedding', label: 'Wedding floor-fillers', words: ['wedding'] },
  { id: 'football', label: 'Football songs', words: ['football', 'world cup'] },
  { id: 'numberones', label: 'Number ones', words: ['number one', 'no.1', 'chart-toppers'] },
  { id: 'guiltypleasures', label: 'Guilty pleasures', words: ['guilty pleasure'] },
  { id: 'irish', label: 'Irish singalongs', words: ['irish', 'ireland'] },
  { id: 'musicals', label: 'Songs from musicals', words: ['musical'] },
  { id: 'sixties', label: 'A sixties round', words: ['1960', "60s", 'sixties'] },
  { id: 'seventies', label: 'A seventies round', words: ['1970', "70s", 'seventies'] },
  { id: 'eighties', label: 'An eighties round', words: ['1980', "80s", 'eighties'] },
  { id: 'nineties', label: 'A nineties round', words: ['1990', "90s", 'nineties'] },
  { id: 'noughties', label: 'A noughties round', words: ['2000', 'noughties'] },
  { id: 'twentytens', label: 'A 2010s round', words: ['2010', 'twenty-tens'] },
  { id: 'today', label: 'This year&rsquo;s charts', words: ['this year', 'current charts'] },
];

/** Is this idea already on the shelf, judging by the pack titles? */
export function alreadyHave(idea, titles = []) {
  const haystack = titles.map((t) => String(t || '').toLowerCase()).join(' | ');
  return (idea.words || []).some((w) => haystack.includes(String(w).toLowerCase()));
}

/**
 * Three the library has not got, or fewer if it has nearly everything.
 *
 * @param {Array<string>} titles   every pack title this room can run
 * @param {object} [opts]
 * @param {number} [opts.count]    how many to offer
 * @param {function(): number} [opts.random]  injected, so a test can pin it
 */
export function pickIdeas(titles = [], { count = 3, random = Math.random } = {}) {
  const open = ROUND_IDEAS.filter((idea) => !alreadyHave(idea, titles));
  const pool = [...open];
  const out = [];
  while (pool.length && out.length < count) {
    const at = Math.floor(random() * pool.length) % pool.length;
    out.push(pool.splice(at, 1)[0]);
  }
  return out.map(({ id, label }) => ({ id, label }));
}

/** The label for an id, so a vote can never carry text from a phone. */
export function ideaLabel(id) {
  const found = ROUND_IDEAS.find((i) => i.id === id);
  return found ? found.label : '';
}
