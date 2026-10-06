/**
 * THE STYLESHEET GOES OUT WITHOUT ITS COMMENTS — `src/css-comments.js`, and
 * `serveFile()` sending it. The cut must change nothing a browser reads, and
 * the file on disk keeps every word.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripCssComments } from '../src/css-comments.js';
import { withServer } from './helpers/live-server.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CSS = fs.readFileSync(path.join(ROOT, 'public/assets/style.css'), 'utf8');

test('a comment goes, a string that looks like one stays', () => {
  assert.equal(stripCssComments('a { color: red; } /* why */\nb { x: 1 }'), 'a { color: red; }\nb { x: 1 }');
  assert.equal(stripCssComments('.q::before { content: "/* not a comment */"; }'), '.q::before { content: "/* not a comment */"; }');
  assert.equal(stripCssComments(".q::before { content: '\\'/*'; }"), ".q::before { content: '\\'/*'; }");
});

test('a comment GLUED between two tokens is left alone — cutting it would fuse them', () => {
  assert.equal(stripCssComments('a { margin: 0/**/auto; }'), 'a { margin: 0/**/auto; }');
  assert.equal(stripCssComments('.a/**/.b { x: 1 }'), '.a/**/.b { x: 1 }');
  assert.equal(stripCssComments('a { margin: 0 /* gap */ auto; }'), 'a { margin: 0  auto; }');
});

test('the real stylesheet: every rule survives and no comment does', () => {
  const out = stripCssComments(CSS);
  assert.ok(out.length < CSS.length * 0.6, `${out.length} of ${CSS.length}`);
  const count = (s, ch) => s.split(ch).length - 1;
  assert.equal(count(out, '{'), count(CSS.replace(/\/\*[\s\S]*?\*\//g, ''), '{'));
  assert.equal(count(out, '}'), count(out, '{'), 'braces balance');
  assert.doesNotMatch(out.replace(/"[^"]*"|'[^']*'/g, ''), /\/\*/);
});

test('served without its comments, with a tag the browser can check, and the next ask is a 304', async () => {
  await withServer(async (base) => {
    const r = await fetch(`${base}/assets/style.css`);
    assert.equal(r.status, 200);
    const body = await r.text();
    assert.equal(body, stripCssComments(CSS));
    const tag = r.headers.get('etag');
    assert.match(tag, /-c"$/);
    const again = await fetch(`${base}/assets/style.css`, { headers: { 'If-None-Match': tag } });
    assert.equal(again.status, 304);
    // And a script is untouched — this is the stylesheet's alone.
    const js = await (await fetch(`${base}/assets/client.js`)).text();
    assert.equal(js, fs.readFileSync(path.join(ROOT, 'public/assets/client.js'), 'utf8'));
  });
});
