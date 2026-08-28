/**
 * WHAT A TEAM NAME LOOKS LIKE ONCE IT LEAVES THE ROOM.
 *
 * Asked for on 25 August 2026, off a screenshot of a live league table with a
 * racial slur sitting tenth in it: *"I don't mind there being swearing or
 * risque stuff in the venue itself, but when it comes to quiz leagues and
 * people seeing from an external source I need to have a certain filter."*
 *
 * ---
 *
 * **THIS DOES NOT REVERSE "NO PROFANITY FILTER ON TEAM NAMES". IT SCOPES IT.**
 * That decision is about the ROOM — a rude name goes on the projector as
 * typed, because the projector is a pub on a Wednesday and the people reading
 * it are the people who wrote it. Nothing here touches that: the big screen,
 * the phones, the control view and the console all still show exactly what was
 * typed, and `cleanTeamName()` in the engine is unchanged.
 *
 * **THE FILTER IS AT THE DOOR, not in the room.** It applies to the two
 * places a name leaves the venue and lands in front of somebody who was never
 * there: the public league page, and the report a landlord may forward to a
 * brewery. The distinction is not squeamishness — it is that the app's name is
 * on those, and a slur under somebody's brand on a public web page is a
 * different object from the same word on a pub wall for two hours.
 *
 * **IDENTITY IS UNTOUCHED.** `teamKey()` still groups by the real name, so a
 * masked team keeps its points, its position and its history. This is a VIEW,
 * exactly like the two-screens rule: the same record, said differently
 * depending on who is looking.
 *
 * ---
 *
 * **IT ERRS STRICT, AND THAT IS THE WHOLE CALIBRATION.** The two failure
 * modes are not equal:
 *
 * - a FALSE POSITIVE hides one team's name on one page, the console says so,
 *   and the team is still in the table on the right points;
 * - a FALSE NEGATIVE is a slur on a public page with the quizmaster's name at
 *   the top of it, found by a customer.
 *
 * One is a nuisance and the other is the thing this exists to prevent, so
 * where they conflict this hides.
 *
 * **BUT NOT SO STRICT THAT IT EATS REAL WORDS.** The classic failure of a
 * naive filter is a substring match — which hides Scunthorpe, Penistone,
 * Lightwater, "assassin", "classic" and "Dickens". So ordinary profanity is
 * matched on WHOLE WORDS only, against a normalised form. A team called
 * "Cockermouth Crew" publishes fine.
 *
 * **THE SEVERE LIST IS MATCHED HARDER, on purpose.** Slurs are worth a false
 * positive in a way "bloody" is not, and they are also what people disguise —
 * so those are checked again against a form with every space and symbol
 * stripped out, which catches `n i g g a`, `n-i-g-g-a` and `n1gg4`. That
 * second pass is deliberately not applied to the ordinary list, or it would
 * hide half of Britain's place names.
 */

/**
 * The normalisations, in the order they run.
 *
 * Leetspeak first, because it is a substitution rather than a removal — doing
 * it after the punctuation strip would turn "5" into "s" inside a name that
 * legitimately contains a number, which is a different word.
 */
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's', '!': 'i', '|': 'l', '+': 't' };

/** Lowercased, accents folded, leet undone, runs of one letter collapsed. */
function normalise(name) {
  return String(name || '')
    .toLowerCase()
    // Accents folded, so "nïgga" and "shït" do not walk straight past.
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[013457 8@$!|+]/g, (c) => (c === ' ' ? ' ' : LEET[c] ?? c))
    // Anything that is not a letter becomes a space, so punctuation cannot
    // hide inside a word and "f.u.c.k" is still four letters in a row.
    .replace(/[^a-z]+/g, ' ')
    // "fuuuuck" and "niggggga" are the same word as far as this is concerned.
    .replace(/(.)\1{2,}/g, '$1$1')
    .trim();
}

/**
 * WORDS THAT ARE HIDDEN ANYWHERE THEY APPEAR, however they are spelled.
 *
 * Slurs, and only slurs: the terms whose presence on a public page under the
 * app's name is not a matter of taste. Checked against the fully stripped
 * form, so spacing and punctuation between the letters does not get past.
 *
 * Kept deliberately short. Every entry here buys a stricter match and
 * therefore a higher chance of hiding an innocent name, so the bar for adding
 * one is "this must never be published", not "this is rude".
 */
const SEVERE = [
  'nigger', 'nigga', 'niger', 'faggot', 'fagot', 'tranny', 'retard',
  'paki', 'chink', 'spastic', 'wetback', 'coon', 'kike', 'gook',
  'raghead', 'towelhead', 'gyppo', 'pikey', 'nonce', 'paedo', 'pedo',
];

/**
 * WORDS THAT ARE HIDDEN WHEN THEY STAND ALONE.
 *
 * Ordinary profanity, matched on whole words only so that place names and
 * innocent longer words survive — which is the difference between a filter
 * and a nuisance.
 */
const ORDINARY = [
  'fuck', 'fucker', 'fucking', 'fucks', 'motherfucker', 'clusterfuck',
  'shit', 'shite', 'shitting', 'bullshit', 'shithead',
  'cunt', 'cunts', 'twat', 'wanker', 'wank', 'wanking',
  'bastard', 'bollocks', 'bellend', 'knobhead', 'dickhead', 'prick',
  'arsehole', 'asshole', 'arse', 'ass', 'anal', 'anus',
  'cock', 'cocks', 'dick', 'dicks', 'penis', 'vagina', 'minge', 'fanny',
  'tits', 'titties', 'boobs', 'bloody', 'bugger', 'bellends',
  'slut', 'slag', 'whore', 'hoe', 'skank', 'jizz', 'cum', 'spunk',
  'piss', 'pissed', 'pisser', 'turd', 'crap', 'wtf', 'stfu', 'bitch', 'bitches',
  'rape', 'rapist', 'nazi', 'hitler', 'isis',
];

const SEVERE_SET = new Set(SEVERE);
const ORDINARY_SET = new Set(ORDINARY);

/**
 * Would this name be shown to somebody who was not in the room?
 *
 * @param {string} name  as typed on the night
 * @returns {boolean}
 */
function listed(word) {
  if (!word) return false;
  if (ORDINARY_SET.has(word) || SEVERE_SET.has(word)) return true;
  /*
   * A TRAILING "S" IS THE SAME WORD. Listing every plural doubles the list and
   * still misses one — "Wankers" walked straight past the first version. Safe
   * because the match is on whole words either way: "Bass Players" tests
   * "bas", "Glass Half Full" tests "glas", and neither is on any list.
   */
  return word.endsWith('s') && (ORDINARY_SET.has(word.slice(0, -1)) || SEVERE_SET.has(word.slice(0, -1)));
}

export function isCleanForPublic(name) {
  const words = normalise(name);
  if (!words) return true;
  const parts = words.split(' ').filter(Boolean);

  // 1. Whole words, ordinary or severe. This is what keeps "Scunthorpe" and
  //    "Cockermouth" publishable while "Shit Happens" is not.
  for (const word of parts) {
    if (listed(word)) return false;
  }

  /*
   * 1b. ADJACENT PAIRS, JOINED — "Bell End", "Dick Head", "Bull Shit". Two
   *     innocent words either side of a space are the oldest way round a word
   *     list, and joining only NEIGHBOURING pairs is safe where joining the
   *     whole name is not: "Scunthorpe" is one word and never forms a pair,
   *     so it cannot be caught this way.
   *
   *     **The known cost, accepted knowingly: "The Pen Is Mightier" joins to
   *     a listed word and is hidden.** That is the strict-erring trade this
   *     file is calibrated on — a hidden name is a nuisance the console
   *     reports, and the alternative is the word it exists to stop.
   */
  for (let i = 0; i < parts.length - 1; i++) {
    if (listed(parts[i] + parts[i + 1])) return false;
  }

  /*
   * 2. The severe list again, against a form with the spaces taken out —
   *    so `n i g g a`, `n-i-g-g-a` and `N.I.G.G.A` are all one word by the
   *    time they get here. Only the severe list, or this pass would hide
   *    "Class Act" for containing a rude substring.
   */
  const solid = words.replace(/ /g, '');
  for (const bad of SEVERE) {
    if (solid.includes(bad)) return false;
  }
  return true;
}

/** What a hidden name is shown as. Says what happened rather than pretending. */
export const HIDDEN_LABEL = 'Name hidden';

/**
 * The name to print on a page somebody outside the room can see.
 *
 * **MASKED, NEVER DROPPED.** Taking the row out would move everybody below it
 * up a place and make the table lie about the season — and the team itself
 * would simply vanish, which is a worse answer than a visible row they can
 * still find themselves in by their points. The position and the points are
 * the table's job; the name is the only thing at issue.
 */
export function publicName(name) {
  return isCleanForPublic(name) ? String(name || '') : HIDDEN_LABEL;
}

/**
 * A whole league table, said the way a stranger may see it.
 *
 * One function so the public page and the landlord's report cannot drift into
 * two different ideas of what is publishable — the same reason one function
 * builds the table itself.
 */
export function publicTable(rows = []) {
  return rows.map((row) => (isCleanForPublic(row.name)
    ? row
    : { ...row, name: HIDDEN_LABEL, nameHidden: true }));
}
