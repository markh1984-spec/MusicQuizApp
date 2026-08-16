/**
 * TODO.md HAS A BYTE BUDGET, FOR THE SAME REASON CLAUDE.md DOES.
 *
 * `CLAUDE.md` says *read `TODO.md` first*, so in practice it is loaded by every
 * session just as surely as `CLAUDE.md` is — and it had reached **124,733
 * bytes**, about 33,000 tokens spent before any work started, on a file where
 * a session needs ONE entry.
 *
 * It got there the way these files always do: every new entry landed under
 * whatever heading was last, so a section called *"The photo gallery, and
 * print on demand"* had grown to 65KB and was holding the console doors, the
 * popover editor and the `launchBar()` split — none of which is a photograph.
 * **A file nobody is measuring drifts in what it CONTAINS as well as in how
 * big it is**, and the wrong heading is the more expensive of the two: it
 * makes the entry unfindable, which is exactly what `TODO.md` exists to
 * prevent.
 *
 * So the three big areas moved to `todo/`, each leaving its name and one line
 * behind, and the number has an assertion on it. **The budget is not sacred —
 * raise it when the live list genuinely has more live work in it.** But raise
 * it deliberately, in a diff that says so, rather than by appending.
 *
 * The per-area files are budgeted too, and more loosely: they are opened by
 * the one session that needs them, so their cost is occasional rather than
 * universal. A `todo/` file over its budget is a sign it has become a bucket,
 * like the gallery section did.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const size = (p) => fs.statSync(new URL(p, root)).size;

const BUDGET = 40_000;
const AREA_BUDGET = 45_000;

test('TODO.md STAYS INSIDE ITS BUDGET', () => {
  const bytes = size('TODO.md');
  assert.ok(
    bytes <= BUDGET,
    `TODO.md is ${bytes} bytes, over the ${BUDGET} budget by ${bytes - BUDGET}.\n`
    + 'Every session opens this file, so the whole of it is paid for before any work\n'
    + 'starts. Move a finished area out to todo/ leaving its name and one line, or\n'
    + 'delete what is done — a finished item is DELETED from this file, never ticked.',
  );
});

test('no todo/ area has become a bucket', () => {
  const dir = new URL('todo/', root);
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.md')) : [];
  assert.ok(files.length, 'todo/ has gone — did an area get folded back into TODO.md?');
  for (const f of files) {
    const bytes = size(`todo/${f}`);
    assert.ok(bytes <= AREA_BUDGET,
      `todo/${f} is ${bytes} bytes, over ${AREA_BUDGET}. That is how the gallery section `
      + 'got to 65KB: entries land under whatever heading is last until the name stops '
      + 'describing the contents. Split it by SUBJECT, not by size.');
  }
});

/**
 * NOTHING IN THE LIST MAY CLAIM TO BE DONE. A FINISHED ITEM IS DELETED.
 *
 * That rule is already written in `TODO.md` and in `CLAUDE.md`, and it has now
 * failed three times: four entries sat in `todo/marketing-app.md` marked
 * `✅ BUILT` or struck through, and `docs/business.md` was carrying three
 * finished sections when it was split. **A written rule that has failed three
 * times is a test that has not been written yet** — the same conclusion this
 * repo reached about the size of `CLAUDE.md`.
 *
 * The cost is not tidiness. A build plan left behind for a thing that already
 * exists is a TRAP: CLAUDE.md records one nearly causing the picture-drawing
 * step to be rebuilt, because the plan for it was still sitting in the list.
 *
 * **And the marker itself cannot be trusted, which is why the fix is deletion
 * rather than a tidier marker.** `business.md` had a section titled
 * *"The pack shop — ✅ THE WINDOW IS BUILT, the money is not"* whose body was
 * mostly unbuilt work: the PayPal plan ids, the webhook, and a live instruction
 * that Gold must be marked unavailable when it ships. A heading that says BUILT
 * describes the heading, not the section.
 *
 * So there are exactly two honest states, and this forces the choice:
 * **it is done, and the entry is gone — or it is not done, and the marker comes
 * off.** Naming what IS built inside the prose is fine; claiming it in the
 * heading is not.
 */
test('no entry in the list claims to be finished', () => {
  const files = ['TODO.md', ...fs.readdirSync(new URL('todo/', root))
    .filter((f) => f.endsWith('.md')).map((f) => `todo/${f}`)];

  const claims = [];
  for (const f of files) {
    fs.readFileSync(new URL(f, root), 'utf8').split('\n').forEach((line, i) => {
      if (!/^#{2,4} /.test(line)) return;
      // ✅ anywhere, a struck-through heading, or a trailing BUILT/FIXED/DONE.
      // Lower-case "the tab is built" inside a live entry is a description of
      // one part and stays — it is the CLAIM about the whole entry that goes.
      if (/✅|~~.+~~|[—-]\s*\*{0,2}(BUILT|FIXED|DONE)\*{0,2}\s*$/.test(line)) {
        claims.push(`${f}:${i + 1}  ${line.trim()}`);
      }
    });
  }

  assert.deepEqual(claims, [],
    'these entries say they are finished and are still in the list:\n'
    + `${claims.join('\n')}\n\n`
    + 'A finished item is DELETED, never ticked — its reasoning belongs in CLAUDE.md, and\n'
    + 'git history keeps the text. If it is NOT finished, take the marker off instead: a\n'
    + 'heading that says BUILT describes the heading, not the section, and one of those in\n'
    + 'docs/business.md was hiding the entire unbuilt money half of the pack shop.');
});

/**
 * Every area named in TODO.md exists, and every area file is named in TODO.md.
 * A pointer to a file that is not there is worse than no pointer, and a file
 * nothing points at is work nobody will find.
 */
test('TODO.md and todo/ agree about what exists', () => {
  const todo = fs.readFileSync(new URL('TODO.md', root), 'utf8');
  const linked = new Set([...todo.matchAll(/\(todo\/([a-z-]+\.md)\)/g)].map((m) => m[1]));
  const onDisk = new Set(fs.readdirSync(new URL('todo/', root)).filter((f) => f.endsWith('.md')));

  const missing = [...linked].filter((f) => !onDisk.has(f));
  assert.deepEqual(missing, [], `TODO.md links to todo/ files that are not there: ${missing.join(', ')}`);

  const orphans = [...onDisk].filter((f) => !linked.has(f));
  assert.deepEqual(orphans, [],
    `these todo/ areas are named nowhere in TODO.md, so nothing will ever open them: ${orphans.join(', ')}`);
});
