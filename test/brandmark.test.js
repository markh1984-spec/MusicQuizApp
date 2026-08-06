/**
 * The logo, and the fact that there is only one of it.
 *
 * The record in the top left of every screen and the icon in the browser tab
 * are the same drawing, served from the same file. Two copies is a logo that
 * gets changed in one place and not the other, and nobody notices for a month.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { recordMark, faviconSvg } from '../public/assets/brandmark.js';

/*
 * The tab icon and the logo on the page are ONE drawing.
 *
 * Two copies of a logo is a logo that gets changed in one place and not the
 * other, and nobody notices for a month. The server serves what the browser
 * draws, from the same file.
 */
test('the favicon is the same record as the one on the page', () => {
  const onPage = recordMark({ size: 30, id: 'bm1' });
  const inTab = faviconSvg();

  // Same shape: same circles, in the same places.
  const circles = (svg) => [...svg.matchAll(/<circle[^>]*cx="([\d.]+)"[^>]*cy="([\d.]+)"[^>]*r="([\d.]+)"/g)]
    .map((m) => m.slice(1).join(','));
  assert.deepEqual(circles(inTab), circles(onPage));

  // Same colours.
  const stops = (svg) => [...svg.matchAll(/stop-color="(#[0-9a-f]{6})"/g)].map((m) => m[1]);
  assert.deepEqual(stops(inTab), stops(onPage));
  assert.deepEqual(stops(inTab), ['#ff2e88', '#ff8a3d', '#ffd23f']);
});

test('the favicon is a standalone svg a browser can fetch', () => {
  const svg = faviconSvg();
  // Without the namespace it is markup, not an image, and a browser served it
  // as a file shows nothing at all.
  assert.match(svg, /<svg[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  // No width or height, so it scales to whatever size is asked for.
  assert.equal(/<svg[^>]*\swidth=/.test(svg), false);
  assert.match(svg, /viewBox="0 0 40 40"/);
});

test('two marks on one page do not share a gradient id', () => {
  // They would fight: the second definition wins and the first turns flat.
  const a = recordMark({ size: 30, id: 'bm1' });
  const b = recordMark({ size: 30, id: 'bm2' });
  assert.match(a, /id="bm1"/);
  assert.match(a, /url\(#bm1\)/);
  assert.match(b, /url\(#bm2\)/);
});
