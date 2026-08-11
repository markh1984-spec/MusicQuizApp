/**
 * Turning a track list you already have into a bingo pack.
 *
 * There is more than one good way to end up with forty songs. You might have
 * built a playlist in Spotify over months, or asked Claude in your browser —
 * which has a Spotify connector and your own instructions, and may well do a
 * better job than a prompt in this app ever will.
 *
 * Neither of those should mean starting again here. So a pack can come from:
 *
 *   - a Spotify playlist link, read straight off your account
 *   - a pasted list, in more or less whatever shape you have it
 *
 * Imported tracks still go through the no-repeats history, so importing does
 * not quietly undo the rule that stops a regular hearing the same songs.
 */

import { normaliseBingoPack, validateBingoPack, minimumTracks } from './bingo.js';
import { saveBingoPack } from './library.js';
import { filterRecent, recordUsed, trackKey } from './history.js';
import { spotifyConfigured, playlistTracks, findTrack } from './spotify.js';
import { titleCase, themeSlug } from './theme.js';

/**
 * Read a pasted list.
 *
 * Forgiving on purpose — people paste numbered lists, bulleted lists, lists
 * copied out of a chat, lists with the artist first. The only thing it insists
 * on is one track per line.
 */
/** Split on the last match of a separator, or null if there is not one. */
function lastSplit(line, pattern) {
  let at = null;
  for (const m of line.matchAll(pattern)) at = m;
  if (!at) return null;
  return [line.slice(0, at.index), line.slice(at.index + at[0].length)];
}

export function parseTrackList(text) {
  const lines = String(text || '').split(/\r?\n/);
  const tracks = [];

  for (const raw of lines) {
    // Strip bullets, numbering and stray markdown.
    let line = raw
      .replace(/^\s*[-*•·]\s+/, '')
      .replace(/^\s*\d+[.)]\s+/, '')
      .replace(/\*\*/g, '')
      .replace(/^["'“”]|["'“”]$/g, '')
      .trim();
    if (!line) continue;
    // Skip anything that is obviously a heading rather than a track.
    if (/^#{1,6}\s/.test(line) || /^[A-Z][a-z]+ \d+:$/.test(line)) continue;

    // "Title — Artist", "Title - Artist", "Title by Artist".
    //
    // A dash wins over the word "by", and the LAST one wins over the first.
    // Both matter: "Stand by Me - Ben E. King" split on the "by" and came out
    // as "Stand" by "Me - Ben E. King", and "River Deep - Mountain High - Ike
    // & Tina Turner" would lose half its title to the first dash.
    const dash = lastSplit(line, /\s+(?:—|–|-{1,2})\s+/g);
    const split = dash || lastSplit(line, /\s+by\s+/gi);
    if (split) {
      const title = split[0].trim().replace(/^["'“”]|["'“”]$/g, '');
      const artist = split[1].trim().replace(/\s*\(\d{4}\)\s*$/, '').trim();
      if (title && artist) { tracks.push({ title, artist }); continue; }
    }
    tracks.push({ title: line, artist: '' });
  }

  return tracks;
}

/**
 * @param {object} opts
 * @param {object} opts.config
 * @param {string} [opts.playlistUrl]  a Spotify playlist link
 * @param {string} [opts.text]         or a pasted list
 * @param {string} [opts.title]        what to call the pack
 * @param {number} [opts.cardSize]
 * @param {number} [opts.avoidMonths]  0 to import everything regardless
 * @param {boolean} [opts.resolve]     look pasted tracks up on Spotify
 */
export async function importBingoPack({
  config,
  /*
   * Where the pack lands, and whether its tracks go into the no-repeats memory.
   *
   * Both default to the catalogue's, which is what importing has always meant.
   * A QUIZMASTER importing one of their own passes their own folder and
   * `remember: false`: the history is the owner's generator's memory of what it
   * has already used, and neither half of that is true of somebody else's pack.
   * Writing to it would make the owner's next generated pack avoid songs it has
   * never used, and reading from it would silently drop tracks out of a list a
   * subscriber pasted deliberately.
   */
  dir = null,
  remember = true,
  playlistUrl = '',
  text = '',
  title,
  cardSize = 4,
  avoidMonths = 0,
  resolve,
  log = () => {},
  now = () => Date.now(),
}) {
  let tracks = [];
  let sourceName = '';
  let playlist = null;

  if (playlistUrl.trim()) {
    if (!spotifyConfigured()) throw new Error('Spotify is not set up, so a playlist link cannot be read. Paste the track list instead.');
    log('reading the playlist from Spotify…');
    const found = await playlistTracks(playlistUrl);
    tracks = found.tracks;
    sourceName = found.name;
    playlist = { url: found.url, uri: found.uri };
    log(`  "${found.name}" — ${tracks.length} tracks`);
  } else if (text.trim()) {
    tracks = parseTrackList(text);
    log(`read ${tracks.length} tracks from the list you pasted`);
    if (!tracks.length) throw new Error('Could not find any tracks in that. One track per line.');

    // Looking them up gets Spotify's spelling and a uri, so the pack matches
    // what your DJ app will actually play.
    const shouldResolve = resolve === undefined ? spotifyConfigured() : Boolean(resolve);
    if (shouldResolve && spotifyConfigured()) {
      log('looking each one up on Spotify…');
      const out = [];
      for (const t of tracks) {
        try {
          const hit = await findTrack(t.title, t.artist);
          if (hit) {
            out.push({ title: hit.title, artist: hit.artist, year: Number(hit.year) || undefined, spotifyUri: hit.uri });
          } else {
            log(`  not on Spotify, keeping as typed: ${t.title}${t.artist ? ` — ${t.artist}` : ''}`);
            out.push(t);
          }
        } catch {
          out.push(t);
        }
      }
      tracks = out;
    }
  } else {
    throw new Error('Give it a playlist link or a pasted list');
  }

  // Same no-repeats rule as generating. Off by default for an import, because
  // you may be importing something you built deliberately.
  if (avoidMonths > 0) {
    const { kept, dropped } = filterRecent(config.dataDir, tracks, avoidMonths, now());
    if (dropped.length) log(`  dropped ${dropped.length} played in the last ${avoidMonths} months`);
    tracks = kept;
  } else {
    // Still remove duplicates within the list itself.
    const seen = new Set();
    tracks = tracks.filter((t) => {
      const key = trackKey(t);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // Check the real floor here rather than letting validation catch it later —
  // by then the message talks about the pack, when what you want to hear is
  // "the list you pasted is short".
  const minimum = minimumTracks(cardSize);
  if (tracks.length < minimum) {
    throw new Error(`Only ${tracks.length} usable tracks, and a ${cardSize}x${cardSize} card needs at least ${minimum} for cards to differ.`);
  }

  const packTitle = title || (sourceName ? titleCase(sourceName) : 'Imported Bingo');
  const packId = themeSlug(packTitle);

  const pack = normaliseBingoPack({
    id: packId,
    title: packTitle,
    subtitle: `${tracks.length} tracks. Tap them as you hear them.`,
    cardSize,
    createdAt: new Date(now()).toISOString(),
    notes: playlist
      ? `Imported from ${playlist.url}`
      : 'Imported from a pasted track list.',
    tracks,
  }, packId);

  // normaliseBingoPack keeps only the fields it knows about, so put the
  // Spotify links back on afterwards.
  pack.tracks = pack.tracks.map((t, i) => ({ ...t, ...(tracks[i]?.spotifyUri ? { spotifyUri: tracks[i].spotifyUri } : {}) }));
  if (playlist) pack.spotifyPlaylist = playlist;

  const problems = validateBingoPack(pack);
  if (problems.length) throw new Error('That did not make a valid pack: ' + problems.join('; '));

  saveBingoPack(dir || config.bingoDir, pack.id, pack);
  if (remember) recordUsed(config.dataDir, pack.tracks, { packId: pack.id, at: now() });
  log(`saved ${pack.id}.json with ${pack.tracks.length} tracks`);

  return { pack, playlist };
}
