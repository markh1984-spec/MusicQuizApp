/**
 * A SPLIT FILE AND ITS INDEX HAVE TO AGREE, AND NOTHING ELSE CHECKS THAT.
 *
 * `docs/business.md` was 169,962 bytes with **89% of it under a single
 * heading** — every new idea had landed under whatever heading was last, so
 * the quizmaster directory (66,747 bytes on its own), venue accounts and
 * karaoke were all filed as *"Asked for, not yet specced"*. It split into
 * `docs/business/` with an index left behind.
 *
 * The failure that split introduces is quiet in both directions:
 *
 * - **an index entry with no file** reads as though the detail exists and can
 *   be checked, which is worse than never having mentioned it;
 * - **a file nothing points at** is work nobody will ever open. That is the
 *   same fault as the projector's arcade board and the gallery route — built,
 *   correct, and unreachable.
 *
 * Splitting it also found something worth keeping in mind whenever a doc is
 * tidied: **two sections marked `✅ BUILT` were not.** *"The pack shop — ✅ THE
 * WINDOW IS BUILT, the money is not"* still holds the PayPal plan ids, the
 * webhook, and a live instruction that Gold must be marked unavailable when it
 * ships. A marker in a heading describes the heading, not the section — so a
 * delete gets READ, never matched on a marker.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../', import.meta.url);

/** An index file and the directory it indexes, checked both ways. */
const PAIRS = [
  { index: 'docs/business.md', dir: 'docs/business/' },
  { index: 'TODO.md', dir: 'todo/' },
];

for (const { index, dir } of PAIRS) {
  test(`${index} and ${dir} agree about what exists`, () => {
    const src = fs.readFileSync(new URL(index, root), 'utf8');
    const onDisk = fs.readdirSync(new URL(dir, root)).filter((f) => f.endsWith('.md'));
    assert.ok(onDisk.length, `${dir} is empty — did an area get folded back in?`);

    const linked = new Set(onDisk.filter((f) => src.includes(f)));
    const orphans = onDisk.filter((f) => !linked.has(f));
    assert.deepEqual(orphans, [],
      `these files are named nowhere in ${index}, so nothing will open them: ${orphans.join(', ')}`);

    const dead = [...src.matchAll(new RegExp(`\\]\\(${dir.replace('docs/', '')}([\\w-]+\\.md)\\)`, 'g'))]
      .map((m) => m[1])
      .filter((f) => !onDisk.includes(f));
    assert.deepEqual(dead, [], `${index} links to files that are not in ${dir}: ${dead.join(', ')}`);
  });
}

/**
 * Nothing in docs/ has become a bucket again. Deliberately loose — these are
 * opened by the one session that needs them, so the cost is occasional. What
 * it catches is the shape business.md was in: one file swallowing every new
 * idea until its name stopped describing its contents.
 */
test('no docs/ file has become a bucket', () => {
  const BUDGET = 100_000;
  const walk = (rel) => fs.readdirSync(new URL(rel, root), { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(`${rel}${e.name}/`) : e.name.endsWith('.md') ? [`${rel}${e.name}`] : []));

  for (const f of walk('docs/')) {
    const bytes = fs.statSync(new URL(f, root)).size;
    assert.ok(bytes <= BUDGET,
      `${f} is ${bytes} bytes, over ${BUDGET}. That is how business.md reached 170KB with `
      + '89% of it under one heading. Split it by SUBJECT and leave an index — and put a new '
      + 'section under the heading it belongs to rather than under whichever one is last.');
  }
});
