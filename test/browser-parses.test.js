/**
 * EVERY FILE THE BROWSER LOADS MUST AT LEAST PARSE.
 *
 * Written on 15 August 2026, ten minutes after a stray backtick inside an HTML
 * comment took the whole console down.
 *
 * The comment was inside the template literal `launchBar()` builds its markup
 * from, so the backtick ended the string early and `console.js` became a syntax
 * error — which means `/console` did not load AT ALL, for every quizmaster, on
 * the page the night is launched from. **The full suite passed.** It always
 * would: every file under `public/` is a DOM module that no test imports, so
 * the browser half of this app has never been executed by anything in here.
 *
 * That is the same fault this repo already learned the expensive way with the
 * launch route — *a test that never runs the artefact proves nothing about it*
 * — and `test/launch-route.test.js` is its answer for the server. This is the
 * answer for the browser, and it is deliberately the WEAKEST possible one:
 *
 * **Parsing is not working.** A file that parses can still be nonsense, and
 * this will never know. What it does catch is the entire class of fault where
 * the file cannot even be loaded — a stray backtick, an unclosed brace, a bad
 * import — which is the class that takes a page down completely rather than
 * making one control misbehave. Those are worth catching in seven seconds
 * instead of in a browser, or in a pub.
 *
 * Cheap on purpose. A slow suite is one people stop running before a gig.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const PUBLIC = join(ROOT, 'public');

/** Every .js under public/, at any depth. */
function scripts(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...scripts(full));
    else if (name.endsWith('.js')) out.push(full);
  }
  return out;
}

test('EVERY BROWSER MODULE PARSES', () => {
  const files = scripts(PUBLIC);
  // If this ever comes out at zero the test has quietly stopped testing
  // anything, which is the failure mode this repo keeps finding in its own
  // guards. Better to fail loudly than to pass vacuously.
  assert.ok(files.length > 20, `only found ${files.length} browser scripts — has public/ moved?`);

  const broken = [];
  for (const file of files) {
    try {
      execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    } catch (err) {
      broken.push(`${file.slice(ROOT.length)}: ${String(err.stderr || err).split('\n').find((l) => l.includes('Error')) || 'did not parse'}`);
    }
  }
  assert.deepEqual(broken, [], `these would not load in a browser:\n${broken.join('\n')}`);
});

/**
 * AND THE ONE THAT ACTUALLY BIT: a backtick inside the markup templates.
 *
 * `--check` above catches this too, so this is not covering a gap — it is here
 * to name the fault when it happens. A bare "missing ) after argument list"
 * pointing at line 4,000 of a 6,000-line file sends you hunting; "there is a
 * backtick inside an HTML comment" is the actual answer.
 *
 * Only comments are checked, because a backtick in ordinary code is ordinary
 * code — nested templates are everywhere in these files and are perfectly
 * legal. It is specifically prose, written inside markup, that has no business
 * carrying one.
 */
test('no HTML comment inside the markup carries a backtick', async () => {
  const { readFileSync } = await import('node:fs');
  const bad = [];
  for (const file of scripts(PUBLIC)) {
    const src = readFileSync(file, 'utf8');
    for (const [, comment] of src.matchAll(/<!--([\s\S]*?)-->/g)) {
      if (comment.includes('`')) {
        const line = src.slice(0, src.indexOf(comment)).split('\n').length;
        bad.push(`${file.slice(ROOT.length)}:${line} — a backtick in an HTML comment ends the template literal it sits in`);
      }
    }
  }
  assert.deepEqual(bad, [], bad.join('\n'));
});
