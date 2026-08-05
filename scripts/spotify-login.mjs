#!/usr/bin/env node
/**
 * One-time Spotify setup.
 *
 * Run this once on your own laptop. It gives you a refresh token to paste
 * into your host's settings, and after that the app can build playlists on
 * its own forever.
 *
 *   node scripts/spotify-login.mjs
 *
 * Before running it you need a free Spotify app:
 *
 *   1. Go to https://developer.spotify.com/dashboard and log in with your
 *      normal Spotify account.
 *   2. "Create app". Name it anything — "Music Quiz" is fine.
 *   3. Redirect URI: put exactly   http://127.0.0.1:8888/callback
 *      Tick "Web API". Save.
 *   4. Open the app's Settings and copy the Client ID and Client Secret.
 */

import http from 'node:http';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

import { authoriseUrl, exchangeCode } from '../src/spotify.js';

const PORT = 8888;
const REDIRECT = `http://127.0.0.1:${PORT}/callback`;

const rl = readline.createInterface({ input, output });

console.log(`
Spotify setup
=============

If you have not made a Spotify app yet, do that first:

  1. https://developer.spotify.com/dashboard  →  Create app
  2. Redirect URI must be exactly:  ${REDIRECT}
  3. Tick "Web API", save, then open Settings to see your keys
`);

const clientId = (process.env.SPOTIFY_CLIENT_ID || await rl.question('Client ID: ')).trim();
const clientSecret = (process.env.SPOTIFY_CLIENT_SECRET || await rl.question('Client Secret: ')).trim();

if (!clientId || !clientSecret) {
  console.error('\nBoth are needed. Nothing has been changed.\n');
  process.exit(1);
}

const url = authoriseUrl(clientId, REDIRECT);

console.log(`
Now open this in your browser and click Agree:

${url}
`);

const code = await new Promise((resolve, reject) => {
  const server = http.createServer((req, res) => {
    const parsed = new URL(req.url, `http://127.0.0.1:${PORT}`);
    if (parsed.pathname !== '/callback') {
      res.writeHead(404).end('Not here');
      return;
    }
    const err = parsed.searchParams.get('error');
    const got = parsed.searchParams.get('code');

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><meta charset="utf-8">
      <body style="font-family:system-ui;background:#0b0b14;color:#f7f7fb;display:grid;place-items:center;height:100vh;margin:0">
      <div style="text-align:center">
        <h1 style="font-size:28px">${err ? 'Something went wrong' : 'Done — you can close this'}</h1>
        <p style="color:#a7a7c2">${err ? err : 'Back to your terminal for the token.'}</p>
      </div></body>`);

    server.close();
    if (err) reject(new Error(err)); else resolve(got);
  });

  server.listen(PORT, '127.0.0.1', () => console.log(`Waiting for Spotify to send you back…`));
  setTimeout(() => { server.close(); reject(new Error('Timed out after five minutes')); }, 300_000).unref();
});

const tokens = await exchangeCode(clientId, clientSecret, code, REDIRECT);

console.log(`
Setup complete.
===============

Put these three into your host's environment variables (on Render:
your service → Environment → Add Environment Variable), and into a .env
or your shell if you want to generate packs on this laptop too:

  SPOTIFY_CLIENT_ID=${clientId}
  SPOTIFY_CLIENT_SECRET=${clientSecret}
  SPOTIFY_REFRESH_TOKEN=${tokens.refresh_token}

Keep the secret and the refresh token private — between them they can edit
your Spotify library. They do not expire, so this is the only time you have
to do this.
`);

rl.close();
process.exit(0);
