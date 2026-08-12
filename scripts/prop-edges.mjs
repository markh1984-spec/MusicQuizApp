/**
 * Does any prop's artwork run off the edge of its own square?
 *
 * The props are drawn on a 100x100 grid and now carry a DIE-CUT WHITE BORDER,
 * which adds about five units all round. A shape drawn to the edge therefore
 * loses its border to the crop and comes out sliced flat — which is exactly
 * what happened to the party hat's pompom, and it is invisible in the source:
 * the numbers look fine, and the stroke is what overflows.
 *
 * Path extents cannot be worked out from the numbers either, because a curve's
 * control points sit outside the curve. So this RENDERS each prop and looks at
 * the actual pixels down all four sides.
 *
 * Run it after redrawing any prop:
 *     node scripts/prop-edges.mjs
 *
 * It needs a browser, which is why it is a script rather than a unit test —
 * `npm test` is deliberately dependency-free and offline.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
// The repo has no dependencies; Playwright lives with the runtime.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { STICKERS, stickerSvg } from '../public/assets/stickers.js';

/** How close to the edge counts as trouble. The white border is ~5 units. */
const MARGIN = 0;
const SIZE = 200;

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'props-'));
const page = path.join(dir, 'edge.html');
fs.writeFileSync(page, '<!doctype html><meta charset=utf-8>'
  + `<style>body{margin:0}div{width:${SIZE}px;height:${SIZE}px}</style>`
  + STICKERS.map(({ id }) => `<div data-id="${id}">`
      + stickerSvg(id).replace('width="100" height="100"', `width="${SIZE}" height="${SIZE}"`)
      + '</div>').join(''));

const browser = await chromium.launch();
const tab = await (await browser.newContext()).newPage();
await tab.goto('file://' + page, { waitUntil: 'domcontentloaded' });
await tab.waitForTimeout(400);

const bad = await tab.evaluate(async ({ size, margin }) => {
  const out = [];
  for (const div of document.querySelectorAll('div[data-id]')) {
    const blob = new Blob([div.querySelector('svg').outerHTML], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = await new Promise((done) => {
      const i = new Image();
      i.onload = () => done(i);
      i.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, size, size);
    const px = ctx.getImageData(0, 0, size, size).data;
    const lit = (x, y) => px[(y * size + x) * 4 + 3] > 12;
    const sides = new Set();
    for (let i = 0; i < size; i++) {
      for (let m = 0; m <= margin; m++) {
        if (lit(i, m)) sides.add('top');
        if (lit(i, size - 1 - m)) sides.add('bottom');
        if (lit(m, i)) sides.add('left');
        if (lit(size - 1 - m, i)) sides.add('right');
      }
    }
    if (sides.size) out.push(`${div.dataset.id}: ${[...sides].join(', ')}`);
    URL.revokeObjectURL(url);
  }
  return out;
}, { size: SIZE, margin: MARGIN });

await browser.close();
fs.rmSync(dir, { recursive: true, force: true });

if (!bad.length) {
  console.log('Every prop sits inside its square.');
} else {
  console.log('Artwork running off the edge — the die-cut border will be cropped:\n');
  for (const line of bad) console.log('  ' + line);
  console.log('\nThese are fine only while the prop has no white border. Inset them'
    + '\nby about six units before adding one.');
}
