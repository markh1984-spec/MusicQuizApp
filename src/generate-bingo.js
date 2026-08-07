/**
 * One button: theme in, playable bingo game out.
 *
 * The whole chain:
 *
 *   1. Claude writes a candidate track list for the theme, and is TOLD what
 *      you have played recently so it does not suggest it.
 *   2. Anything that slipped through is filtered out against the history file,
 *      because a model asked not to repeat itself will still occasionally
 *      repeat itself.
 *   3. Each track is looked up on Spotify, so what ends up in the pack is what
 *      your DJ app can actually play — not a title Claude invented.
 *   4. A private Spotify playlist is created and filled, in play order.
 *   5. The bingo pack is written to disk, and every track is recorded in the
 *      history so the next generation avoids them.
 *
 * Steps 3 and 4 are skipped if Spotify is not set up, so the rest still works.
 */

import { filterRecent, recordUsed, recentTracks, trackKey } from './history.js';
import { normaliseBingoPack, validateBingoPack } from './bingo.js';
import { saveBingoPack } from './library.js';
import { spotifyConfigured, findTrack, createPlaylist } from './spotify.js';
import { cleanTheme, bingoTitleFor, themeSlug } from './theme.js';
// The same idea of a good bingo track that the browser brief is built from, so
// the two cannot drift apart.
import { rulesBlock } from './bingo-rules.js';

const MODEL = 'claude-sonnet-5';
const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

/**
 * Ask Claude for a track list.
 *
 * It is asked for extra tracks on purpose: some will be filtered as repeats
 * and some will not be findable on Spotify, and coming up short would mean
 * cards with blank squares.
 */
async function askClaude({ theme, wanted, avoid, apiKey, model = MODEL }) {
  const avoidList = avoid.length
    ? `\n\nDO NOT include any of these — they have been played recently:\n${avoid.map((t) => `- ${t.title} — ${t.artist}`).join('\n')}`
    : '';

  const prompt = `Choose ${wanted} songs for a music bingo game in a British pub.

Theme: ${theme}

What makes a good music bingo track:
${rulesBlock()}${avoidList}

Reply with JSON and nothing else, no markdown fence:

{"tracks":[{"title":"Billie Jean","artist":"Michael Jackson"}]}`;

  const res = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model,
      // Sixty-odd tracks is a long reply, and a reply that runs out of room
      // mid-track is not JSON at all. Plenty of headroom is free — unused
      // tokens cost nothing.
      max_tokens: 8000,
      // Thinking OFF, and this is the important line.
      //
      // On this model thinking is on unless you say otherwise, it is billed
      // against the same max_tokens as the reply, and its text comes back
      // empty by default. So the first attempt spent the whole budget
      // thinking and returned nothing at all — a blank error on a theme that
      // had worked minutes before. Naming forty pub songs does not need it.
      thinking: { type: 'disabled' },
      output_config: { effort: 'low' },
      // No assistant prefill here, tempting as it is: this model refuses a
      // conversation that does not end with a user message. Keeping the reply
      // readable is readTracks()'s job instead.
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`Claude said ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const reply = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
  const tracks = readTracks(reply);

  if (!tracks.length) {
    // Say what actually came back. "Did not return usable JSON" on its own
    // leaves you guessing at midnight with a room booked.
    const why = data.stop_reason === 'max_tokens'
      ? 'the reply was cut off before it finished'
      : `it stopped because "${data.stop_reason}"`;
    throw new Error(`Claude did not return a usable track list — ${why}. It began: ${reply.slice(0, 160)}`);
  }
  return tracks;
}

/**
 * Read the track list out of whatever came back.
 *
 * Tries the whole thing as JSON first, and falls back to picking out the
 * individual track objects. That fallback is what makes a reply that ran out
 * of room still worth having: fifty-five complete tracks and a fifty-sixth cut
 * in half is not valid JSON, but it is still fifty-five tracks, and we only
 * needed forty.
 */
export function readTracks(text) {
  const cleaned = String(text || '').trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '');

  try {
    const parsed = JSON.parse(cleaned);
    const list = Array.isArray(parsed) ? parsed : parsed.tracks;
    if (Array.isArray(list)) return list.filter((t) => t && t.title).map(tidy);
  } catch { /* fall through and salvage what is there */ }

  const found = [];
  for (const match of cleaned.matchAll(/\{[^{}]*\}/g)) {
    try {
      const t = JSON.parse(match[0]);
      if (t && t.title) found.push(tidy(t));
    } catch { /* a half-written one at the end, which is exactly the case this is for */ }
  }
  return found;
}

function tidy(t) {
  return { title: String(t.title).trim(), artist: String(t.artist || '').trim() };
}

/**
 * @param {object} opts
 * @param {object} opts.config          the app config (needs dataDir, bingoDir)
 * @param {string} opts.theme           e.g. "1990s indie", "Harry Potter soundtrack"
 * @param {number} [opts.trackCount]    how many end up in the pack
 * @param {number} [opts.cardSize]      3, 4 or 5
 * @param {number} [opts.avoidMonths]   how far back the no-repeats rule reaches
 * @param {string} [opts.id]            filename to write
 * @param {boolean} [opts.spotify]      make a playlist (default: if configured)
 * @param {function(string): void} [opts.log]
 */
export async function generateBingoPack({
  config,
  theme,
  trackCount = 40,
  cardSize = 4,
  avoidMonths = 3,
  id,
  title,
  spotify,
  model,
  log = () => {},
  now = () => Date.now(),
}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Set ANTHROPIC_API_KEY to generate track lists');

  const useSpotify = spotify === undefined ? spotifyConfigured() : Boolean(spotify);
  const subject = cleanTheme(theme);
  const packId = id || themeSlug(theme);
  const packTitle = title || bingoTitleFor(theme);

  // ---- 1. what is off limits
  const avoid = recentTracks(config.dataDir, avoidMonths, now());
  log(`${avoid.length} track${avoid.length === 1 ? '' : 's'} off limits (played in the last ${avoidMonths} months)`);

  // ---- 2. ask for more than we need, then filter
  const overAsk = Math.min(100, Math.round(trackCount * 1.6));
  log(`asking Claude for ${overAsk} candidates…`);
  const candidates = await askClaude({ theme: subject, wanted: overAsk, avoid, apiKey, model });
  log(`  got ${candidates.length}`);

  const { kept, dropped } = filterRecent(config.dataDir, candidates, avoidMonths, now());
  if (dropped.length) log(`  dropped ${dropped.length} (${dropped.filter((d) => d.reason === 'played recently').length} played recently)`);

  // ---- 3. resolve against Spotify so the pack matches what you can play
  let resolved = kept;
  let playlist = null;

  if (useSpotify) {
    log('looking each one up on Spotify…');
    resolved = [];
    for (const track of kept) {
      if (resolved.length >= trackCount) break;
      try {
        const found = await findTrack(track.title, track.artist);
        if (!found) {
          log(`  not on Spotify, skipped: ${track.title} — ${track.artist}`);
          continue;
        }
        // Trust Spotify's spelling over the model's.
        resolved.push({ title: found.title, artist: found.artist, year: found.year ? Number(found.year) : undefined, spotifyUri: found.uri, spotifyId: found.id });
      } catch (err) {
        log(`  lookup failed for ${track.title}: ${err.message}`);
      }
    }
    // Spotify's own titles can collide after normalising ("Africa" twice).
    const seen = new Set();
    resolved = resolved.filter((t) => {
      const key = trackKey(t);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    log(`  ${resolved.length} playable tracks`);
  } else {
    resolved = kept.slice(0, trackCount);
    log('Spotify is not set up — writing the pack without a playlist');
  }

  const minimum = cardSize * cardSize;
  if (resolved.length < minimum) {
    throw new Error(
      `Only ${resolved.length} usable tracks, and a ${cardSize}x${cardSize} card needs at least ${minimum}. ` +
      `Try a broader theme, or a shorter no-repeat window than ${avoidMonths} months.`,
    );
  }
  resolved = resolved.slice(0, trackCount);

  // ---- 4. the playlist your DJ app plays from
  //
  // Optional, and treated as optional. It used to throw, which threw away the
  // whole generation with it — sixty-odd candidates and forty Spotify lookups
  // lost because the last and least important step failed. The pack is the
  // night; the playlist is a convenience.
  let playlistError = null;
  if (useSpotify) {
    log('creating the Spotify playlist…');
    try {
      playlist = await createPlaylist({
        name: packTitle,
        description: `Music bingo — ${subject}. Generated ${new Date(now()).toLocaleDateString('en-GB')}.`,
        uris: resolved.map((t) => t.spotifyUri).filter(Boolean),
      });
      log(`  ${playlist.url}`);
    } catch (err) {
      playlistError = err.message;
      log(`  could not make the playlist: ${err.message}`);
      log('  carrying on and saving the pack — you can build the playlist by hand from the call sheet');
    }
  }

  // ---- 5. write the pack and remember what we used
  const pack = normaliseBingoPack({
    id: packId,
    title: packTitle,
    subtitle: `${resolved.length} tracks. Tap them as you hear them.`,
    cardSize,
    createdAt: new Date(now()).toISOString(),
    notes: [
      `Generated for "${subject}".`,
      playlist ? `Spotify playlist: ${playlist.url}` : 'No Spotify playlist — play these from wherever you like.',
      'Not yet reviewed — have a look before the gig.',
    ].join(' '),
    tracks: resolved,
    ...(playlist ? { spotifyPlaylist: { id: playlist.id, url: playlist.url, uri: playlist.uri } } : {}),
  }, packId);

  // normaliseBingoPack drops fields it does not know about, so put the ones
  // that matter back.
  pack.tracks = pack.tracks.map((t, i) => ({ ...t, ...(resolved[i]?.spotifyUri ? { spotifyUri: resolved[i].spotifyUri } : {}) }));
  if (playlist) pack.spotifyPlaylist = { id: playlist.id, url: playlist.url, uri: playlist.uri };

  const problems = validateBingoPack(pack);
  if (problems.length) throw new Error('Generated pack is not valid: ' + problems.join('; '));

  saveBingoPack(config.bingoDir, pack.id, pack);
  recordUsed(config.dataDir, pack.tracks, { packId: pack.id, at: now() });
  log(`saved ${pack.id}.json with ${pack.tracks.length} tracks`);

  return { pack, playlist, playlistError, dropped, candidates: candidates.length };
}


