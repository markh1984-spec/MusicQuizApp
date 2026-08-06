/**
 * The house rules for picking bingo tracks — written once, used twice.
 *
 * The app can generate a round itself, but creating the Spotify playlist from
 * here is refused by Spotify (see TODO.md), and the playlist is the point: the
 * host plays out of djay Pro. Claude in the browser has a Spotify connector and
 * can build the playlist, so the working route is to ask it there and paste the
 * list back into the Import box.
 *
 * That only stays honest if it is asked the SAME questions — the same idea of
 * a good bingo track, and above all the same "do not use these, I have played
 * them recently" list. A brief typed fresh each time is a brief that quietly
 * drops the no-repeats rule, which is the one thing a regular at a Tuesday
 * night would actually notice.
 *
 * So both prompts are built from `trackRules()` here. Change what makes a good
 * track in one place and the in-app generator and the browser brief cannot
 * disagree.
 */

import { bingoTitleFor, cleanTheme } from './theme.js';

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

/** "- Billie Jean — Michael Jackson", one per line. */
export function avoidBlock(avoid) {
  return avoid.map((t) => `- ${t.title}${t.artist ? ` — ${t.artist}` : ''}`).join('\n');
}

/**
 * The whole thing to paste into Claude in a browser.
 *
 * It asks for two things in one go — the playlist and the list — and is fussy
 * about the second, because that text is going straight into the Import box.
 * The important line is the last one: what gets printed has to be what actually
 * went into the playlist. If a track could not be found and something was put
 * in its place, a pack built from the original list would call a song that is
 * not in the playlist, and on the night that is a square nobody can ever mark.
 *
 * @param {object} opts
 * @param {string} opts.theme
 * @param {number} [opts.count]        how many tracks
 * @param {Array}  [opts.avoid]        [{ title, artist }] played recently
 * @param {number} [opts.avoidMonths]  how far back that list goes
 */
export function bingoBrief({ theme, count = 40, avoid = [], avoidMonths = 3 }) {
  const name = bingoTitleFor(theme);
  const parts = [
    'I run live music bingo in British pubs. I need the tracks for a new round,',
    'and a Spotify playlist to play them from.',
    '',
    // The theme box gets typed into conversationally — "can I have a 90s dance
    // round please" — and pasting that verbatim reads like a forwarded message.
    `Theme: ${cleanTheme(theme)}`,
    `How many: ${count} tracks`,
    '',
    'What makes a good music bingo track:',
    rulesBlock(),
  ];

  if (avoid.length) {
    parts.push(
      '',
      `Do not use any of these ${avoid.length}. I have played them in the last ${avoidMonths} months,`,
      'and the whole point of the list below is that my regulars do not hear the',
      'same songs twice in a season:',
      avoidBlock(avoid),
    );
  }

  parts.push(
    '',
    'Please do two things, in this order:',
    '',
    `1. Build me a private Spotify playlist called "${name}", containing`,
    '   exactly those tracks, and give me the link.',
    '',
    '2. Then print the finished list on its own, one track per line, as',
    '   "Title — Artist", inside a single code block with nothing else in it —',
    '   no numbering, no headings, no commentary. That block gets pasted straight',
    '   into my app to build the bingo cards.',
    '',
    'It has to be the list that actually went into the playlist. If you could not',
    'find one of them on Spotify and put something else in, print the replacement,',
    'not the original — the cards and the playlist have to be the same songs or a',
    'square comes up that nobody in the room can ever mark.',
  );

  return parts.join('\n');
}
