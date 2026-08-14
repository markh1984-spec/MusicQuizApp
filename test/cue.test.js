/**
 * Where an intro track starts playing.
 *
 * The thing actually being protected here is the SCORING. The twenty-second
 * clock starts with the question and the track starts with it, so dead air at
 * the front of a file is score taken off everybody for a reason that has
 * nothing to do with the question. That makes two properties matter more than
 * the parsing does:
 *
 *  - a number that cannot be read must come out as "play from the start",
 *    which is the behaviour from before this existed — never as a guess that
 *    skips into the middle of a song in front of a room;
 *  - every pack already on disk says "0:00", so nothing on disk may change.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

import { cueOffsetMs, cueOffsetSays, formatOffset, MAX_OFFSET_MS } from '../public/assets/cue.js';
import { playTrack } from '../src/spotify.js';

test('the ways a host would actually write it', () => {
  assert.equal(cueOffsetMs('0:00'), 0);
  assert.equal(cueOffsetMs('0:02'), 2000);
  assert.equal(cueOffsetMs('1:05'), 65000);
  assert.equal(cueOffsetMs('2'), 2000);
  assert.equal(cueOffsetMs('2s'), 2000);
  assert.equal(cueOffsetMs('2 secs'), 2000);
  assert.equal(cueOffsetMs('2.5'), 2500);
  assert.equal(cueOffsetMs('0:02.5'), 2500);
  assert.equal(cueOffsetMs(' 3 '), 3000);
  assert.equal(cueOffsetMs(3), 3000);
});

test('ANYTHING IT CANNOT READ PLAYS FROM THE START, never from a guess', () => {
  // null is the signal for "no offset at all", which is what the track did
  // before this feature existed. A typo must cost the old behaviour and never
  // a jump into the middle of a song.
  for (const bad of ['', '   ', 'the chorus', 'after the drums', '-2', '0:-2', 'abc', null, undefined, {}, []]) {
    assert.equal(cueOffsetMs(bad), null, `${JSON.stringify(bad)} should not read as a time`);
  }
});

test('sixty-plus seconds in the seconds half is a slip, so it is refused', () => {
  // "1:75" is somebody typing rather than intending 2:15. Obeying it would put
  // the track somewhere nobody asked for with nothing on screen saying so.
  assert.equal(cueOffsetMs('1:75'), null);
  assert.equal(cueOffsetMs('0:60'), null);
  assert.equal(cueOffsetMs('0:59'), 59000);
});

test('past ten minutes it is a typo, not an intro cue', () => {
  assert.equal(cueOffsetMs('9:59'), 599000);
  assert.equal(cueOffsetMs(String(MAX_OFFSET_MS / 1000)), MAX_OFFSET_MS);
  assert.equal(cueOffsetMs('11:00'), null);
  assert.equal(cueOffsetMs('99999'), null);
});

test('the echo says which of the three it is, so a typo reads as a typo', () => {
  // An empty box is the default and nobody is nagged about it.
  assert.equal(cueOffsetSays(''), '');
  assert.equal(cueOffsetSays(undefined), '');
  // Explicitly zero is not the same as unreadable, and they must not both be
  // silent — that is how an ignored offset looks accepted.
  assert.match(cueOffsetSays('0:00'), /very start/);
  assert.match(cueOffsetSays('the chorus'), /Not a time/);
  assert.match(cueOffsetSays('2'), /Skips the first 2 seconds/);
  assert.match(cueOffsetSays('0:01'), /Skips the first 1 second\b/);
});

test('half a second is not rounded away', () => {
  // Dead air is often under a second, and a box that showed "0 seconds" for
  // what was typed would look like it had ignored it.
  assert.equal(formatOffset(500), '0.5 seconds');
  assert.equal(formatOffset(1000), '1 second');
  assert.equal(formatOffset(2500), '2.5 seconds');
});

test('EVERY PACK ON DISK STILL PLAYS FROM THE TOP', () => {
  // The whole feature is safe to deploy mid-season because of this: every cue
  // written before it says "0:00", so no existing question moves. If a
  // generated pack ever arrives with an invented offset, this is what fails.
  let checked = 0;
  for (const file of readdirSync('quizzes').filter((f) => f.endsWith('.json'))) {
    const pack = JSON.parse(readFileSync(`quizzes/${file}`, 'utf8'));
    for (const round of pack.rounds || []) {
      for (const q of round.questions || []) {
        if (!q.cue) continue;
        checked += 1;
        assert.equal(cueOffsetMs(q.cue.from) || 0, 0,
          `${file} has an intro cue starting at ${q.cue.from} — check it was set by ear`);
      }
    }
  }
  assert.ok(checked > 0, 'no intro cues found to check');
});

/*
 * The other half, and the half that would have failed silently: the parsed
 * offset has to reach Spotify. A perfect parser wired to nothing is a field
 * that looks like it works and does not — the same fault as an edited cue
 * whose URI never gets repointed.
 */

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

/** Answers the token call, records the play call, and reports the body. */
function catchPlay() {
  const sent = {};
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).includes('/api/token')) {
      return { ok: true, status: 200, json: async () => ({ access_token: 't', expires_in: 3600, scope: 'user-modify-playback-state' }) };
    }
    sent.url = String(url);
    sent.body = JSON.parse(options.body);
    return { ok: true, status: 204 };
  };
  return sent;
}

test('the offset reaches Spotify as position_ms', async () => {
  spotifyEnv();
  const sent = catchPlay();
  const result = await playTrack('spotify:track:abc', { positionMs: cueOffsetMs('0:02') });
  assert.equal(result.ok, true);
  assert.equal(sent.body.position_ms, 2000);
  assert.deepEqual(sent.body.uris, ['spotify:track:abc']);
});

test('A QUESTION WITH NO OFFSET SENDS EXACTLY WHAT IT SENT BEFORE', async () => {
  // Every pack on disk is in this case, so this is the one that says the
  // change is invisible to tonight. `position_ms` must be ABSENT rather than
  // zero: a new field on every play call is a change to something that works.
  spotifyEnv();
  for (const from of ['0:00', '', 'the chorus', undefined]) {
    const sent = catchPlay();
    await playTrack('spotify:track:abc', { positionMs: cueOffsetMs(from) || 0 });
    assert.deepEqual(sent.body, { uris: ['spotify:track:abc'] }, `from=${JSON.stringify(from)}`);
  }
});
