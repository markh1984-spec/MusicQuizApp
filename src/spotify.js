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

/** The scopes the app needs, and no more than that. */
export const SCOPES = ['playlist-modify-private', 'playlist-modify-public'];

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
