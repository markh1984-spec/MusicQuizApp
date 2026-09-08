#!/usr/bin/env node
/**
 * WHICH PACKS ARE THE STANDARD SHAPE, AND WHAT EACH ONE IS SHORT OF.
 *
 * The standard is `STANDARD_ROUNDS` in `src/quizzes.js` — 20 general
 * knowledge, 10 pictures, 10 intros — and it is reported rather than enforced:
 * a pack half-written on a Monday is a normal state to be in, and a rule that
 * refused to save one would make the standard an obstacle to reaching it.
 *
 * Counts by TYPE across the whole pack rather than per round, because twenty
 * general knowledge questions split into two rounds of ten is the same night,
 * and half this library is written that way.
 *
 *   node scripts/pack-shapes.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { shapeGaps, isStandardShape, STANDARD_ROUNDS } from '../src/quizzes.js';

const DIR = process.env.QUIZ_DIR || 'quizzes';
const packs = fs.readdirSync(DIR).filter((f) => f.endsWith('.json'))
  .map((f) => ({ f, q: JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) }));

// A one-round pack is a COMPONENT and is not held to the shape of a night —
// that is the Music Rounds shelf, and its whole point is to be one round.
const nights = packs.filter(({ q }) => (q.rounds || []).length > 1);
const rounds = packs.length - nights.length;

console.log(`The standard: ${STANDARD_ROUNDS.map((r) => `${r.count} ${r.type}`).join(', ')}\n`);
let short = 0;
const owed = {};
for (const { q } of nights.sort((a, b) => a.q.title.localeCompare(b.q.title))) {
  const gaps = shapeGaps(q);
  if (isStandardShape(q)) { console.log(`  ok    ${q.title}`); continue; }
  short += 1;
  for (const g of gaps) owed[g.type] = (owed[g.type] || 0) + (g.want - g.have);
  console.log(`  SHORT ${q.title}`);
  console.log(`        ${gaps.map((g) => `${g.type} ${g.have}/${g.want}`).join(' · ')}`);
}
console.log(`\n${nights.length - short} of ${nights.length} quiz packs are the full shape.`);
if (short) {
  console.log(`Still to write: ${Object.entries(owed).map(([t, n]) => `${n} ${t}`).join(', ')}.`);
}
console.log(`(${rounds} one-round packs are components and are not counted.)`);
