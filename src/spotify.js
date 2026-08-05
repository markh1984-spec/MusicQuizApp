/**
 * Spotify, for building the playlist your DJ app will play from.
 *
 * The app needs its own Spotify credentials — it cannot borrow yours from an
 * app you are already logged into. Three values, set once:
 *
 *   SPOTIFY_CLIENT_ID
 *   SPOTIFY_CLIENT_SECRET
 *   SPOTIFY_REFRESH_TOKEN
 *
 * The first two come from making a free app at developer.spotify.com. The
 * third comes from running `node scripts/spotify-login.mjs`, which walks you
 * through it once and prints the token to paste in.
 *
 * Creating a playlist has to be done as YOU (a playlist belongs to a person),
 * which is why this uses a refresh token rather than the simpler
 * client-credentials flow. That is also why it is a one-time setup rather
 * than something you do per gig.
 */

const ACCOUNTS = 'https://accounts.spotify.com';
const API = 'https://api.spotify.com/v1';

/**
 * The scopes the app needs, and no more than that.
 *
 * The two "read" ones are what let it import a playlist you already made — in
 * the Spotify app, or by asking Claude in your browser. Without them a private
 * playlist comes back as "not found", which is a confusing way for Spotify to
 * say "you did not ask for permission".
 *
 * If you set Spotify up before importing existed, re-run
 * `npm run spotify:login` to pick these up.
 */
export const SCOPES = [
  'playlist-modify-private',
  'playlist-modify-public',
  'playlist-read-private',
  'playlist-read-collaborative',
];

export function spotifyConfigured() {
  return Boolean(
    process.env.SPOTIFY_CLIENT_ID &&
    process.env.SPOTIFY_CLIENT_SECRET &&
    process.env.SPOTIFY_REFRESH_TOKEN,
  );
}

export function missingSpotifyConfig() {
  return ['SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET', 'SPOTIFY_REFRESH_TOKEN']
    .filter((name) => !process.env[name]);
}

let cachedToken = null; // { token, expiresAt }

/** Swap the long-lived refresh token for a short-lived access token. */
export async function accessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.token;

  const missing = missingSpotifyConfig();
  if (missing.length) throw new Error(`Spotify is not set up. Missing: ${missing.join(', ')}`);

  const basic = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`,
  ).toString('base64');

  const res = await fetch(`${ACCOUNTS}/api/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: process.env.SPOTIFY_REFRESH_TOKEN,
    }),
  });

  if (!res.ok) {
    throw new Error(`Spotify refused the refresh token (${res.status}). Run scripts/spotify-login.mjs again.`);
  }
  const data = await res.json();
  cachedToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in || 3600) * 1000 };
  return cachedToken.token;
}

async function api(path, options = {}) {
  const token = await accessToken();
  const res = await fetch(API + path, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  // Spotify asks you to back off rather than hammering it.
  if (res.status === 429) {
    const wait = Number(res.headers.get('retry-after') || 2);
    await new Promise((r) => setTimeout(r, (wait + 1) * 1000));
    return api(path, options);
  }
  if (!res.ok) {
    throw new Error(`Spotify ${options.method || 'GET'} ${path} failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
  return res.status === 204 ? null : res.json();
}

export async function me() {
  return api('/me');
}

/**
 * Find a track. Tries the precise field search first, then a plain one, so a
 * slightly-off artist name still resolves rather than silently dropping a
 * song from the night.
 */
export async function findTrack(title, artist, market = 'GB') {
  const attempts = [
    `track:${quote(title)} artist:${quote(artist)}`,
    `${title} ${artist}`,
    title,
  ];

  for (const q of attempts) {
    const data = await api(`/search?${new URLSearchParams({ q, type: 'track', limit: '5', market })}`);
    const items = data?.tracks?.items || [];
    if (!items.length) continue;

    // Prefer a result whose artist actually matches what we asked for.
    const wanted = simplify(artist);
    const match = items.find((t) => t.artists.some((a) => simplify(a.name).includes(wanted) || wanted.includes(simplify(a.name))));
    const chosen = match || items[0];
    return {
      uri: chosen.uri,
      id: chosen.id,
      title: chosen.name,
      artist: chosen.artists.map((a) => a.name).join(', '),
      year: (chosen.album?.release_date || '').slice(0, 4),
      exact: Boolean(match),
    };
  }
  return null;
}

function quote(s) {
  return `"${String(s).replace(/"/g, '')}"`;
}

function simplify(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Make a playlist and fill it. Private by default — it is a working playlist
 * for a gig, not something to publish.
 */
export async function createPlaylist({ name, description = '', uris = [], isPublic = false }) {
  const user = await me();
  const playlist = await api(`/users/${encodeURIComponent(user.id)}/playlists`, {
    method: 'POST',
    body: JSON.stringify({ name, description, public: isPublic }),
  });

  // The API takes 100 at a time.
  for (let i = 0; i < uris.length; i += 100) {
    await api(`/playlists/${playlist.id}/tracks`, {
      method: 'POST',
      body: JSON.stringify({ uris: uris.slice(i, i + 100) }),
    });
  }

  return {
    id: playlist.id,
    name: playlist.name,
    url: playlist.external_urls?.spotify || `https://open.spotify.com/playlist/${playlist.id}`,
    uri: playlist.uri,
    trackCount: uris.length,
  };
}

/** Pull the id out of anything Spotify hands you for a playlist. */
export function playlistId(input) {
  const s = String(input || '').trim();
  const uri = s.match(/^spotify:playlist:([A-Za-z0-9]+)/);
  if (uri) return uri[1];
  const url = s.match(/playlist\/([A-Za-z0-9]+)/);
  if (url) return url[1];
  if (/^[A-Za-z0-9]{20,}$/.test(s)) return s;
  return null;
}

/**
 * Read a playlist you already made — in the Spotify app, or by asking Claude
 * in your browser to build one. Lets an existing way of working feed straight
 * into a bingo pack rather than being redone here.
 */
export async function playlistTracks(input) {
  const id = playlistId(input);
  if (!id) throw new Error('That does not look like a Spotify playlist link');

  let meta;
  try {
    meta = await api(`/playlists/${id}?fields=name,external_urls,uri`);
  } catch (err) {
    if (/\(404\)/.test(err.message)) {
      throw new Error(
        'Spotify says that playlist does not exist. If it is private, re-run '
        + '`npm run spotify:login` — reading private playlists needs a permission '
        + 'that older setups did not ask for.',
      );
    }
    throw err;
  }
  const tracks = [];
  let url = `/playlists/${id}/tracks?limit=100&fields=next,items(track(id,uri,name,artists(name),album(release_date)))`;

  while (url) {
    const page = await api(url);
    for (const item of page.items || []) {
      const t = item.track;
      if (!t || !t.id) continue; // local files and removed tracks have no id
      tracks.push({
        title: t.name,
        artist: (t.artists || []).map((a) => a.name).join(', '),
        year: Number((t.album?.release_date || '').slice(0, 4)) || undefined,
        spotifyUri: t.uri,
      });
    }
    // The next link comes back absolute; we only want the path.
    url = page.next ? page.next.replace('https://api.spotify.com/v1', '') : null;
  }

  return {
    name: meta.name,
    url: meta.external_urls?.spotify || '',
    uri: meta.uri,
    tracks,
  };
}

/** Build the URL you send yourself to authorise the app, once. */
export function authoriseUrl(clientId, redirectUri, state = 'musicquiz') {
  return `${ACCOUNTS}/authorize?${new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: SCOPES.join(' '),
    state,
  })}`;
}

/** Swap the one-time code from that redirect for a lasting refresh token. */
export async function exchangeCode(clientId, clientSecret, code, redirectUri) {
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch(`${ACCOUNTS}/api/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
  });
  if (!res.ok) throw new Error(`Spotify said ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}
