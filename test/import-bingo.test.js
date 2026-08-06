/**
 * Importing a track list you already have.
 *
 * The parser is the part that has to be forgiving. A list can arrive numbered,
 * bulleted, in bold, with the year in brackets, or with "by" instead of a dash,
 * and none of those should mean retyping forty songs.
 *
 * The import itself is tested without touching Spotify — the network is not
 * something to depend on in a test suite, and the interesting logic (duplicates,
 * the no-repeats rule, the card-size floor) is all local anyway.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { parseTrackList, importBingoPack } from '../src/import-bingo.js';
import { recordUsed } from '../src/history.js';

function tempConfig() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mmm-import-'));
  const config = {
    dataDir: path.join(root, 'data'),
    bingoDir: path.join(root, 'bingo'),
    quizDir: path.join(root, 'quizzes'),
  };
  fs.mkdirSync(config.dataDir, { recursive: true });
  fs.mkdirSync(config.bingoDir, { recursive: true });
  return config;
}

/** Enough songs to fill a 4x4 card, named so duplicates are easy to spot. */
function songs(n, from = 1) {
  return Array.from({ length: n }, (_, i) => `Song ${from + i} — Artist ${from + i}`).join('\n');
}

test('a numbered list reads as tracks', () => {
  const tracks = parseTrackList(`
    1. Common People — Pulp
    2. Wonderwall — Oasis
    3) Design for Life - Manic Street Preachers
  `);
  assert.deepEqual(tracks, [
    { title: 'Common People', artist: 'Pulp' },
    { title: 'Wonderwall', artist: 'Oasis' },
    { title: 'Design for Life', artist: 'Manic Street Preachers' },
  ]);
});

test('a title containing "by" survives — a dash beats the word by', () => {
  // "Stand by Me - Ben E. King" came out as "Stand" by "Me - Ben E. King",
  // because the split looked for the word "by" before it looked for a dash.
  assert.deepEqual(parseTrackList('Stand by Me - Ben E. King'), [
    { title: 'Stand by Me', artist: 'Ben E. King' },
  ]);
  // With no dash at all, "by" is still how you split it.
  assert.deepEqual(parseTrackList('Stand by Me by Ben E. King'), [
    { title: 'Stand by Me', artist: 'Ben E. King' },
  ]);
});

test('a title with its own dash keeps all of itself', () => {
  assert.deepEqual(parseTrackList('River Deep - Mountain High - Ike & Tina Turner'), [
    { title: 'River Deep - Mountain High', artist: 'Ike & Tina Turner' },
  ]);
});

test('bullets, bold and quotes are stripped', () => {
  const tracks = parseTrackList([
    '- **Parklife** — Blur',
    '* "Girls & Boys" by Blur',
    '• Song 2 – Blur',
  ].join('\n'));
  assert.deepEqual(tracks.map((t) => t.title), ['Parklife', 'Girls & Boys', 'Song 2']);
  assert.deepEqual(new Set(tracks.map((t) => t.artist)), new Set(['Blur']));
});

test('a trailing year is not mistaken for part of the artist', () => {
  const [track] = parseTrackList('Bitter Sweet Symphony — The Verve (1997)');
  assert.equal(track.artist, 'The Verve');
});

test('a title with no artist still counts as a track', () => {
  const tracks = parseTrackList('Firestarter\nBlock Rockin’ Beats');
  assert.equal(tracks.length, 2);
  assert.equal(tracks[0].artist, '');
});

test('headings and blank lines are skipped', () => {
  const tracks = parseTrackList([
    '## Round 1',
    '',
    '1. Groove Is in the Heart — Deee-Lite',
    '   ',
  ].join('\n'));
  assert.equal(tracks.length, 1);
});

test('a hyphenated title survives — the split takes the last sensible break', () => {
  // "Nu-Metal" should not be read as title "Nu", artist "Metal".
  const [track] = parseTrackList('Dance Hall Days — Wang Chung');
  assert.equal(track.title, 'Dance Hall Days');
  assert.equal(track.artist, 'Wang Chung');
});

test('a pasted list becomes a saved pack', async () => {
  const config = tempConfig();
  const { pack } = await importBingoPack({
    config,
    text: songs(24),
    title: 'Test Night Bingo',
    resolve: false,
    now: () => Date.parse('2026-08-05T19:00:00Z'),
  });

  // The filename drops "bingo" — these already live in the bingo folder.
  assert.equal(pack.id, 'test-night');
  assert.equal(pack.title, 'Test Night Bingo');
  assert.equal(pack.tracks.length, 24);
  assert.ok(fs.existsSync(path.join(config.bingoDir, 'test-night.json')));
});

test('duplicates in the pasted list are dropped', async () => {
  const config = tempConfig();
  const { pack } = await importBingoPack({
    config,
    // The same song twice, spelled slightly differently.
    text: songs(24) + '\nSong 1 — Artist 1\nSong 1 (Remastered 2011) — Artist 1',
    resolve: false,
  });
  assert.equal(pack.tracks.length, 24);
});

test('a list that only just fills the card is refused, not accepted', async () => {
  // Sixteen tracks covers a 4x4 grid, but every card would hold the same
  // sixteen songs and the whole room would finish at once.
  const config = tempConfig();
  await assert.rejects(
    () => importBingoPack({ config, text: songs(16), resolve: false }),
    /at least 24 for cards to differ/,
  );
});

test('a smaller card needs fewer tracks', async () => {
  const config = tempConfig();
  const { pack } = await importBingoPack({ config, text: songs(14), cardSize: 3, resolve: false });
  assert.equal(pack.cardSize, 3);
  assert.equal(pack.tracks.length, 14);
});

test('the no-repeats rule applies to imports too, when asked for', async () => {
  const config = tempConfig();
  const at = Date.parse('2026-08-05T19:00:00Z');
  const lastMonth = at - 30 * 24 * 3600 * 1000;

  // Five of these went out at a gig last month.
  recordUsed(config.dataDir, parseTrackList(songs(5)), { packId: 'last-month', at: lastMonth });

  await assert.rejects(
    () => importBingoPack({ config, text: songs(24), avoidMonths: 3, resolve: false, now: () => at }),
    /Only 19 usable tracks/,
  );

  // With more to draw on, the recent five are the ones left out.
  const { pack } = await importBingoPack({
    config, text: songs(29), avoidMonths: 3, resolve: false, now: () => at,
  });
  assert.equal(pack.tracks.length, 24);
  assert.equal(pack.tracks.some((t) => t.title === 'Song 1'), false);
});

test('importing without the history rule keeps everything', async () => {
  const config = tempConfig();
  const at = Date.parse('2026-08-05T19:00:00Z');
  recordUsed(config.dataDir, parseTrackList(songs(5)), { packId: 'last-month', at: at - 1000 });

  const { pack } = await importBingoPack({ config, text: songs(24), resolve: false, now: () => at });
  assert.equal(pack.tracks.length, 24);
});

test('an imported pack is recorded as played, so the next import avoids it', async () => {
  const config = tempConfig();
  const at = Date.parse('2026-08-05T19:00:00Z');
  await importBingoPack({ config, text: songs(24), title: 'First', resolve: false, now: () => at });

  await assert.rejects(
    () => importBingoPack({
      config, text: songs(24), title: 'Second', avoidMonths: 3, resolve: false, now: () => at + 1000,
    }),
    /Only 0 usable tracks/,
  );
});

test('nothing to import is an error you can act on', async () => {
  const config = tempConfig();
  await assert.rejects(() => importBingoPack({ config }), /playlist link or a pasted list/);
  await assert.rejects(() => importBingoPack({ config, text: '   \n  \n' }), /playlist link or a pasted list/);
});

test('a list of nothing but headings says so', async () => {
  const config = tempConfig();
  await assert.rejects(
    () => importBingoPack({ config, text: '## Round 1\n### Round 2', resolve: false }),
    /Could not find any tracks/,
  );
});

test('a playlist link with no Spotify set up explains itself', async () => {
  const config = tempConfig();
  const saved = process.env.SPOTIFY_REFRESH_TOKEN;
  delete process.env.SPOTIFY_REFRESH_TOKEN;
  try {
    await assert.rejects(
      () => importBingoPack({ config, playlistUrl: 'https://open.spotify.com/playlist/abc123' }),
      /Spotify is not set up/,
    );
  } finally {
    if (saved !== undefined) process.env.SPOTIFY_REFRESH_TOKEN = saved;
  }
});
