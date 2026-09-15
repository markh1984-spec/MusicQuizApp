/**
 * CUT A SHEET OF CARDS INTO ONE FILE PER CARD.
 *
 * ---
 *
 * An image generator asked for a deck hands back a SHEET — fifty-two cards in
 * a grid, one file. The app wants one file per card, named for the card. Doing
 * that by hand is fifty-two crops in an image editor, which is not a thing
 * anybody should do on a Monday, and it is the exact shape of job this repo
 * already has a rule about: **prefer the mechanical transform.**
 *
 * So this slices the grid. It is deliberately dumb about what is IN each cell —
 * it cannot read a card — so it takes the layout from you and prints what it
 * wrote, and you look at the contact sheet it leaves behind.
 *
 *     node scripts/cut-a-deck.mjs <sheet.png> --cols 11 --rows 4 \
 *       --order "sa,sa,s2,s3,s4,s6,s9,s10,sj,sq,sk|ca,..." --into asis
 *
 * `--order` is the grid read left to right, top to bottom, as card ids
 * (`sk` = King of Spades). A cell named `-` is skipped, which is how you drop
 * the ornate ace a generator puts in the first column, or a rank that came out
 * wrong. **Nothing is guessed**: a sheet with a missing 5 and two 3s on it is
 * normal, and a cutter that assumed A-to-K would silently file the 6 as a 5.
 *
 * `--into` is the folder, and it is the decision about the app's own index:
 *
 *   - `asis`  the card exactly as drawn, app adds nothing — for a sheet whose
 *             cards already have their own corner index. **The usual one.**
 *   - `full`  the whole card, with the app's big rank printed on top.
 *   - `mid`   just the middle of the card, on the app's own white one.
 *
 * **IT WRITES A CONTACT SHEET AND NAMES EVERY FILE**, because the one thing
 * that cannot be checked from here is whether cell 7 really is the nine of
 * spades. Look at `screenshots/deck-cut.png` before you trust it.
 *
 * **AND IT REFUSES TO OVERWRITE WITHOUT `--force`** — a second run with the
 * grid one column out would otherwise quietly replace a good deck with a
 * shifted one.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

import { DECK } from '../public/assets/deck.js';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const flag = (name, fallback = '') => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const has = (name) => argv.includes(`--${name}`);

const sheet = argv.find((a) => !a.startsWith('--') && argv[argv.indexOf(a) - 1] !== '--cols'
  && argv[argv.indexOf(a) - 1] !== '--rows' && argv[argv.indexOf(a) - 1] !== '--order'
  && argv[argv.indexOf(a) - 1] !== '--into' && argv[argv.indexOf(a) - 1] !== '--inset');

if (!sheet || !fs.existsSync(sheet)) {
  console.error('Give me the sheet: node scripts/cut-a-deck.mjs <sheet.png> --order "..."');
  process.exit(1);
}

const cols = Number(flag('cols', '11'));
const rows = Number(flag('rows', '4'));
/*
 * THE INSET IS WHY THIS IS NOT A ONE-LINER.
 *
 * A generated sheet has gaps between the cards and a margin round the outside,
 * and the cards are rarely on an exact grid. So each cell is cropped a little
 * INSIDE its share of the sheet — a percentage, because it scales with
 * whatever size the sheet came out at. Too little and every card carries a
 * slice of its neighbour; too much and the borders get shaved off.
 */
const inset = Number(flag('inset', '4')) / 100;
/*
 * WHERE THE GRID ACTUALLY IS, because a generated sheet has a MARGIN.
 *
 * Dividing the whole image by the column count assumes the cards start at
 * pixel zero, and they never do — a sheet comes back with a border, and the
 * error accumulates across the row until the last card is half its neighbour.
 * `--box x,y,w,h` names the rectangle the cards actually occupy. Left unset it
 * is the whole image, which is the old behaviour.
 *
 * It is a NUMBER rather than a detector on purpose: three attempts at finding
 * the card edges automatically were each fooled by the court cards, which are
 * bright where every other card is black. A human reading the contact sheet
 * and nudging four numbers takes a minute and cannot be confidently wrong.
 */
const box = flag('box', '').split(',').map(Number).filter((n) => !Number.isNaN(n));
const into = flag('into', 'asis');
const folder = { asis: 'asis', full: 'full', mid: '' }[into];
if (folder === undefined) {
  console.error(`--into must be asis, full or mid. Got "${into}".`);
  process.exit(1);
}

const ids = new Set(DECK.map((c) => c.id));
const order = flag('order', '').split(/[|,\s]+/).map((s) => s.trim()).filter(Boolean);
if (order.length !== cols * rows) {
  console.error(`--order has ${order.length} cells for a ${cols}x${rows} grid (${cols * rows}).`);
  console.error('Use "-" for a cell to skip, e.g. the ornate ace in the first column.');
  process.exit(1);
}
const unknown = order.filter((id) => id !== '-' && !ids.has(id));
if (unknown.length) {
  console.error(`Not cards: ${unknown.join(', ')}`);
  process.exit(1);
}
const dupes = order.filter((id, i) => id !== '-' && order.indexOf(id) !== i);
if (dupes.length) {
  console.error(`Named twice: ${[...new Set(dupes)].join(', ')} — the later one would win.`);
  process.exit(1);
}

const outDir = path.join(ROOT, 'public', 'assets', 'cards', folder);
fs.mkdirSync(outDir, { recursive: true });
const clashes = order.filter((id) => id !== '-'
  && ['png', 'webp', 'jpg', 'jpeg', 'svg'].some((e) => fs.existsSync(path.join(outDir, `${id}.${e}`))));
if (clashes.length && !has('force')) {
  console.error(`Already there: ${clashes.join(', ')}. Pass --force to replace them.`);
  process.exit(1);
}

const src = `data:image/${path.extname(sheet).slice(1).replace('jpg', 'jpeg')};base64,`
  + fs.readFileSync(sheet).toString('base64');

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<body style="margin:0"></body>');

const cut = await page.evaluate(async ({ src, cols, rows, inset, order, box }) => {
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = src; });
  const [bx, by, bw, bh] = box.length === 4 ? box : [0, 0, img.naturalWidth, img.naturalHeight];
  const cw = bw / cols;
  const ch = bh / rows;
  const dx = cw * inset;
  const dy = ch * inset;
  const out = [];
  for (let i = 0; i < order.length; i += 1) {
    if (order[i] === '-') continue;
    const c = document.createElement('canvas');
    c.width = Math.round(cw - dx * 2);
    c.height = Math.round(ch - dy * 2);
    c.getContext('2d').drawImage(
      img,
      Math.round(bx + (i % cols) * cw + dx), Math.round(by + Math.floor(i / cols) * ch + dy),
      c.width, c.height,
      0, 0, c.width, c.height,
    );
    out.push({ id: order[i], w: c.width, h: c.height, png: c.toDataURL('image/png').split(',')[1] });
  }
  return { sheet: { w: img.naturalWidth, h: img.naturalHeight }, cards: out };
}, { src, cols, rows, inset, order, box });

for (const card of cut.cards) {
  fs.writeFileSync(path.join(outDir, `${card.id}.png`), Buffer.from(card.png, 'base64'));
}

/*
 * A CONTACT SHEET, because the cutter cannot see what is on a card.
 *
 * Every failure mode here is silent and looks fine in a file listing: the grid
 * one column out, the inset shaving a border, a sheet whose ranks are not the
 * order you typed. The only check is a human looking at the pile with the
 * names written under it.
 */
await page.setViewportSize({ width: 1240, height: 60 + Math.ceil(cut.cards.length / 10) * 200 });
await page.evaluate(({ cards, dir }) => {
  document.body.style.cssText = 'margin:0;background:#15151f;font:12px system-ui;color:#8d8da0';
  document.body.innerHTML = `<div style="padding:16px">
    <div style="color:#fff;font:600 14px system-ui;margin:0 0 12px">
      ${cards.length} cards → ${dir}</div>
    <div style="display:grid;grid-template-columns:repeat(10,1fr);gap:10px">${cards.map((c) => `
      <div style="text-align:center">
        <img src="data:image/png;base64,${c.png}" style="width:100%;display:block;border-radius:6px">
        <div style="padding-top:4px">${c.id}</div>
      </div>`).join('')}</div></div>`;
}, { cards: cut.cards, dir: `public/assets/cards/${folder || ''}` });
fs.mkdirSync(path.join(ROOT, 'screenshots'), { recursive: true });
await page.screenshot({ path: path.join(ROOT, 'screenshots', 'deck-cut.png'), fullPage: true });
await browser.close();

console.log(`sheet ${cut.sheet.w}x${cut.sheet.h} — each card ${cut.cards[0].w}x${cut.cards[0].h}`);
if (cut.cards[0].w < 240) {
  console.log('  ** these are small. On a projector a card is 245px and up, so they will be soft.');
}
console.log(`wrote ${cut.cards.length}: ${cut.cards.map((c) => c.id).join(' ')}`);
const missing = DECK.map((c) => c.id).filter((id) => !order.includes(id));
if (missing.length) console.log(`still to come (${missing.length}): ${missing.join(' ')}`);
console.log('LOOK AT screenshots/deck-cut.png — nothing here can tell a 6 from a 9.');
