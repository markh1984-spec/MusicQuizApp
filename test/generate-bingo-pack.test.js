/**
 * Generating a bingo pack, with the network stubbed out.
 *
 * The guarantee under test: a Spotify problem never costs you the pack. The
 * playlist is the last and least important step — sixty-odd candidates and
 * forty lookups have already been paid for by the time it runs — and it used
 * to throw the whole generation away when Spotify said no. It did exactly that
 * on the host, twice, on a night he was trying to set it up.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { generateBingoPack } from '../src/generate-bingo.js';
import { loadBingoPack } from '../src/library.js';

const TRACKS = [
  ['Billie Jean', 'Michael Jackson'], ['Take On Me', 'a-ha'], ['Blue Monday', 'New Order'],
  ['Africa', 'Toto'], ['Karma Chameleon', 'Culture Club'], ['Sweet Dreams', 'Eurythmics'],
  ['West End Girls', 'Pet Shop Boys'], ['Come On Eileen', 'Dexys'], ['Tainted Love', 'Soft Cell'],
  ['Girls Just Want to Have Fun', 'Cyndi Lauper'], ['Livin on a Prayer', 'Bon Jovi'],
  ['The Final Countdown', 'Europe'], ['Every Breath You Take', 'The Police'],
  ['Don\'t You', 'Simple Minds'], ['Wake Me Up', 'Wham!'], ['Relax', 'Frankie Goes to Hollywood'],
  ['Video Killed the Radio Star', 'The Buggles'], ['Vienna', 'Ultravox'],
  ['Under Pressure', 'Queen'], ['Love Shack', 'The B-52s'], ['Tempted', 'Squeeze'],
  ['Ghost Town', 'The Specials'], ['Rio', 'Duran Duran'], ['Gold', 'Spandau Ballet'],
  ['Never Gonna Give You Up', 'Rick Astley'], ['Fight for Your Right', 'Beastie Boys'],
];

/**
 * Stand in for both APIs at once.
 *
 * @param {object} opts
 * @param {boolean} [opts.playlistFails]  Spotify refuses to create the playlist
 */
function stubNetwork({ playlistFails = false } = {}) {
  const seen = { playlistAttempts: 0 };

  globalThis.fetch = async (url, options = {}) => {
    const href = String(url);
    const ok = (body) => ({ ok: true, status: 200, json: async () => body, text: async () => '' });

    // ---- Claude writes the candidate list
    if (href.includes('api.anthropic.com')) {
      const payload = { tracks: TRACKS.map(([title, artist]) => ({ title, artist })) };
      return ok({ content: [{ type: 'text', text: JSON.stringify(payload) }], stop_reason: 'end_turn' });
    }

    // ---- Spotify: token, then whoami, then a search per track, then the playlist
    if (href.includes('accounts.spotify.com')) {
      return ok({ access_token: 'stub-token', expires_in: 3600, scope: 'playlist-modify-private playlist-modify-public' });
    }
    if (href.endsWith('/v1/me')) return ok({ id: 'stubuser', display_name: 'Stub' });

    if (href.includes('/v1/search')) {
      const q = decodeURIComponent(new URL(href).searchParams.get('q') || '');
      const match = TRACKS.find(([title]) => q.toLowerCase().includes(title.toLowerCase()));
      if (!match) return ok({ tracks: { items: [] } });
      const [title, artist] = match;
      return ok({
        tracks: {
          items: [{
            uri: `spotify:track:${title.replace(/\W/g, '')}`,
            id: title.replace(/\W/g, ''),
            name: title,
            artists: [{ name: artist }],
            album: { release_date: '1983-01-01' },
          }],
        },
      });
    }

    if (href.includes('/playlists') && options.method === 'POST') {
      seen.playlistAttempts++;
      if (playlistFails) {
        return {
          ok: false,
          status: 403,
          text: async () => '{"error": {"status": 403, "message": "Forbidden"}}',
          json: async () => ({}),
        };
      }
      return ok({ id: 'pl1', name: 'stub', uri: 'spotify:playlist:pl1', external_urls: { spotify: 'https://open.spotify.com/playlist/pl1' } });
    }

    throw new Error(`unstubbed request: ${href}`);
  };

  return seen;
}

function withTempConfig(run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bingo-gen-'));
  const config = { dataDir: path.join(dir, 'data'), bingoDir: path.join(dir, 'bingo') };
  fs.mkdirSync(config.dataDir, { recursive: true });
  fs.mkdirSync(config.bingoDir, { recursive: true });

  const realFetch = globalThis.fetch;
  const env = { ...process.env };
  // A forgotten stub must fail loudly rather than quietly calling out to a real
  // API with a fake key.
  globalThis.fetch = async (url) => { throw new Error(`test tried to reach the network: ${url}`); };
  process.env.ANTHROPIC_API_KEY = 'stub';
  process.env.SPOTIFY_CLIENT_ID = 'stub';
  process.env.SPOTIFY_CLIENT_SECRET = 'stub';
  process.env.SPOTIFY_REFRESH_TOKEN = 'stub';

  return Promise.resolve(run(config)).finally(() => {
    globalThis.fetch = realFetch;
    process.env = env;
    fs.rmSync(dir, { recursive: true, force: true });
  });
}

test('a Spotify refusal does not cost you the pack', () => withTempConfig(async (config) => {
  const seen = stubNetwork({ playlistFails: true });

  const result = await generateBingoPack({
    config, theme: '1980s pop', trackCount: 24, cardSize: 4, avoidMonths: 0, log: () => {},
  });

  assert.equal(seen.playlistAttempts, 1, 'it did try');
  assert.equal(result.playlist, null, 'and there is no playlist');
  assert.match(result.playlistError, /refused to create the playlist/i, 'but it says why');

  // The bit that matters: the pack is on disk and playable.
  const saved = loadBingoPack(config.bingoDir, result.pack.id);
  assert.equal(saved.tracks.length, 24);
  assert.equal(saved.spotifyPlaylist, undefined);
}));

test('when Spotify behaves, the playlist is attached to the pack', () => withTempConfig(async (config) => {
  stubNetwork();

  const result = await generateBingoPack({
    config, theme: '1980s pop', trackCount: 24, cardSize: 4, avoidMonths: 0, log: () => {},
  });

  assert.equal(result.playlistError, null);
  const saved = loadBingoPack(config.bingoDir, result.pack.id);
  assert.equal(saved.spotifyPlaylist.url, 'https://open.spotify.com/playlist/pl1');
}));
