/**
 * The logo, and the fact that there is only one of it.
 *
 * The mark in the top left of every screen and the icon in the browser tab are
 * the same drawing, served from the same file. Two copies is a logo that gets
 * changed in one place and not the other, and nobody notices for a month.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { quizMark, faviconSvg } from '../public/assets/brandmark.js';

/*
 * The tab icon and the logo on the page are ONE drawing.
 *
 * Two copies of a logo is a logo that gets changed in one place and not the
 * other, and nobody notices for a month. The server serves what the browser
 * draws, from the same file.
 */
test('the favicon is the same mark as the one on the page', () => {
  const onPage = quizMark({ size: 30, id: 'bm1' });
  const inTab = faviconSvg();

  // Same shape: the head, the question, the collar, the cradle and the base in
  // the same places. Compared as the whole drawing minus the bits that are
  // ALLOWED to differ — the size, the gradient id, and WEIGHT, which is both
  // the stroke widths and the radius of the question's dot, since a dot is
  // drawn rather than stroked but is part of the same thickening.
  const shape = (svg) => svg
    .replace(/ (?:width|height)="[^"]*"/g, '')
    .replace(/(?:fill|stroke)="url\(#[^)]*\)"|id="[^"]*"/g, '')
    .replace(/stroke-width="[^"]*"/g, '')
    .replace(/<circle([^>]*?)\sr="[^"]*"/g, '<circle$1');
  assert.equal(shape(inTab), shape(onPage));

  /*
   * Same colours — and each stop is now a variable with a hard-coded fallback,
   * because the disc wears the quizmaster's own two colours (see schemes.js).
   *
   * THE FALLBACK IS THE POINT OF THIS ASSERTION. The favicon is served as a
   * standalone document with no stylesheet, so `--hot` does not exist there at
   * all; drop the fallback and the tab icon goes transparent, which is not a
   * bug anybody would connect back to a colour picker.
   */
  const stops = (svg) => [...svg.matchAll(/stop-color:\s*var\((--[\w-]+),\s*(#[0-9a-f]{6})\)/g)]
    .map((m) => `${m[1]}|${m[2]}`);
  assert.deepEqual(stops(inTab), stops(onPage));
  assert.deepEqual(stops(inTab), ['--hot|#ff2e88', '--hot-2|#ff8a3d', '--mark-3|#ffd23f']);
});

/*
 * Every stop falls back to the palette :root already had, so a page that has
 * not been told a scheme yet — and the favicon, which never will be — draws
 * exactly the record this app has always had.
 */
test('with no scheme at all the mark keeps the original palette', () => {
  const svg = quizMark({ size: 30 });
  for (const hex of ['#ff2e88', '#ff8a3d', '#ffd23f']) {
    assert.ok(svg.includes(hex), `the mark lost its ${hex} fallback`);
  }
});

test('the favicon is a standalone svg a browser can fetch', () => {
  const svg = faviconSvg();
  // Without the namespace it is markup, not an image, and a browser served it
  // as a file shows nothing at all.
  assert.match(svg, /<svg[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  // No width or height, so it scales to whatever size is asked for.
  assert.equal(/<svg[^>]*\swidth=/.test(svg), false);
  assert.match(svg, /viewBox="0 0 48 48"/);
});

test('two marks on one page do not share a gradient id', () => {
  // They would fight: the second definition wins and the first turns flat.
  const a = quizMark({ size: 30, id: 'bm1' });
  const b = quizMark({ size: 30, id: 'bm2' });
  assert.match(a, /id="bm1"/);
  assert.match(a, /url\(#bm1\)/);
  assert.match(b, /url\(#bm2\)/);
});
