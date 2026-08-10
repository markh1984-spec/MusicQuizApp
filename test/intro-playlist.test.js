/**
 * A playlist that could not be built has to SAY WHY.
 *
 * `buildIntroPlaylists` catches a per-round problem and returns a null
 * playlist with the reason attached, so it never throws — which is right, one
 * bad round should not lose the others. But the route then reported only the
 * rounds that worked, and a Spotify 403 came back as `playlists: []`: a
 * success envelope with nothing in it, indistinguishable from a quiz whose
 * tracks are all misspelt. The console closed the panel and the only account
 * of what went wrong was a log line it had just torn down.
 *
 * The host spent an evening on that one. These pin the shape the browser is
 * handed, so a failure can never be silently filtered out again.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildIntroPlaylists } from '../src/generate-quiz.js';

/** What the route sends to the browser, kept in step with server.js. */
function payload(results) {
  return {
    playlists: results.filter((r) => r.playlist).map((r) => ({ round: r.round, url: r.playlist.url, missing: r.playlist.missing })),
    failed: results.filter((r) => !r.playlist).map((r) => ({
      round: r.round,
      error: r.error || 'none of its tracks could be found on Spotify',
    })),
  };
}

const realFetch = globalThis.fetch;
const realEnv = { ...process.env };
test.afterEach(() => {
  globalThis.fetch = realFetch;
  process.env = { ...realEnv };
});

function spotifyEnv() {
  process.env.SPOTIFY_CLIENT_ID = 'id';
  process.env.SPOTIFY_CLIENT_SECRET = 'secret';
  process.env.SPOTIFY_REFRESH_TOKEN = 'refresh';
}

function quizWithIntro() {
  return {
    title: 'The 2000s Metal Quiz',
    rounds: [{
      title: 'Name that intro',
      type: 'intro',
      questions: [{ prompt: 'Which track is this?', cue: { title: 'One', artist: 'Metallica' } }],
    }],
  };
}

/**
 * The exact failure the host hit: every track resolves, and Spotify then
 * refuses to create the playlist.
 */
test('a refused playlist reaches the browser with Spotify\'s reason on it', async () => {
  spotifyEnv();
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('/api/token')) {
      return { ok: true, status: 200, json: async () => ({ access_token: 't', expires_in: 3600, scope: 'playlist-modify-private' }) };
    }
    if (u.includes('/search')) {
      return { ok: true, status: 200, json: async () => ({ tracks: { items: [{ id: '1', uri: 'spotify:track:1', name: 'One', artists: [{ name: 'Metallica' }] }] } }) };
    }
    // Creating it is what gets refused.
    return { ok: false, status: 403, json: async () => ({}), text: async () => 'Forbidden' };
  };

  const quiz = quizWithIntro();
  const results = await buildIntroPlaylists({ quiz });
  const out = payload(results);

  assert.equal(out.playlists.length, 0, 'nothing was built');
  assert.equal(out.failed.length, 1, 'and the failure is NOT filtered away');
  assert.equal(out.failed[0].round, 'Name that intro');
  assert.match(out.failed[0].error, /403|forbidden/i, `the reason has to name the cause, got: ${out.failed[0].error}`);
});

/**
 * The other way to get no playlist, and it wants a completely different thing
 * doing about it — so it must not produce the same message.
 */
test('no tracks found is reported as its own reason, not as a refusal', async () => {
  spotifyEnv();
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('/api/token')) {
      return { ok: true, status: 200, json: async () => ({ access_token: 't', expires_in: 3600, scope: '' }) };
    }
    // Nothing matches.
    return { ok: true, status: 200, json: async () => ({ tracks: { items: [] } }) };
  };

  const results = await buildIntroPlaylists({ quiz: quizWithIntro() });
  const out = payload(results);

  assert.equal(out.playlists.length, 0);
  assert.equal(out.failed.length, 1);
  assert.match(out.failed[0].error, /could be found on Spotify/i);
  assert.doesNotMatch(out.failed[0].error, /403/);
});

test('a playlist that works still comes back with its url', async () => {
  spotifyEnv();
  globalThis.fetch = async (url, options = {}) => {
    const u = String(url);
    if (u.includes('/api/token')) {
      return { ok: true, status: 200, json: async () => ({ access_token: 't', expires_in: 3600, scope: 'playlist-modify-private' }) };
    }
    if (u.includes('/search')) {
      return { ok: true, status: 200, json: async () => ({ tracks: { items: [{ id: '1', uri: 'spotify:track:1', name: 'One', artists: [{ name: 'Metallica' }] }] } }) };
    }
    if (u.includes('/me') || u.includes('/users/')) {
      if ((options.method || 'GET') === 'GET') {
        return { ok: true, status: 200, json: async () => ({ id: 'djmarkstar' }) };
      }
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: 'pl1', uri: 'spotify:playlist:pl1', external_urls: { spotify: 'https://open.spotify.com/playlist/pl1' } }),
    };
  };

  const quiz = quizWithIntro();
  const results = await buildIntroPlaylists({ quiz });
  const out = payload(results);

  assert.equal(out.failed.length, 0);
  assert.equal(out.playlists.length, 1);
  assert.match(out.playlists[0].url, /playlist\/pl1/);
  // And it is written onto the round, which is what puts the green button on
  // the pack card and survives a restart.
  assert.equal(quiz.rounds[0].spotifyPlaylist.url, 'https://open.spotify.com/playlist/pl1');
});
