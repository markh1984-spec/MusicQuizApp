#!/usr/bin/env node
/**
 * DID I JUST BREAK THE PUB NIGHT?
 *
 * Written while building online mode, to answer the host's own question —
 * *"can I just check that nothing you build now is going to make launching my
 * pub quiz night awkward tomorrow?"* — with evidence rather than reassurance.
 *
 * `npm test` says the tests still pass. This says something stronger and more
 * useful: that the actual BYTES a projector and a phone receive, at every
 * phase of every pack in the library, are the same as they were at some commit
 * you trust. It runs both versions of the engine side by side on one injected
 * clock, with the same teams answering the same options at the same seconds,
 * and deep-compares every view.
 *
 *   node scripts/pub-unchanged.mjs                 # against the last commit
 *   node scripts/pub-unchanged.mjs v1.2 --ignore online,teams
 *
 * `--ignore` names TOP-LEVEL fields that are allowed to be new, so a genuinely
 * additive change can be waved through while everything else stays pinned. Use
 * it sparingly and name the field: "there is one new field and it is called
 * `online`" is a claim somebody can check, where "some things changed" is not.
 *
 * It makes a temporary git worktree and removes it afterwards.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const ignoreAt = args.indexOf('--ignore');
const ignore = new Set(ignoreAt === -1 ? [] : (args[ignoreAt + 1] || '').split(',').map((s) => s.trim()).filter(Boolean));
const ref = args.filter((a, i) => a !== '--ignore' && i !== ignoreAt + 1)[0] || 'HEAD~1';

const here = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const git = (...a) => execFileSync('git', a, { cwd: here, encoding: 'utf8' }).trim();

const work = mkdtempSync(join(tmpdir(), 'pub-unchanged-'));
let failed = 0;
try {
  git('worktree', 'add', '-f', '--detach', work, ref);
  console.log(`Comparing against ${ref} (${git('rev-parse', '--short', ref)})`);
  if (ignore.size) console.log(`Allowing new top-level fields: ${[...ignore].join(', ')}`);

  const { Engine: Old } = await import(join(work, 'src/engine.js'));
  const { Engine: New } = await import(join(here, 'src/engine.js'));

  const dir = join(here, 'quizzes');
  const packs = readdirSync(dir).filter((f) => f.endsWith('.json'));
  const strip = (v) => {
    const c = { ...v };
    for (const k of ignore) delete c[k];
    return JSON.stringify(c);
  };

  let checks = 0;
  const diffs = [];

  for (const file of packs) {
    const quiz = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    let t = 1_700_000_000_000;
    const now = () => t;
    const a = new Old({ quiz, now });
    const b = new New({ quiz, now });

    const ids = [];
    for (const name of ['The Quizzly Bears', 'Les Quizerables', 'Norfolk & Chance']) {
      ids.push(a.join(name).id);
      b.join(name);
    }
    // join() mints a random id and a random token; we are comparing VIEWS, so
    // give both engines the same people rather than the same randomness.
    b.state.players = JSON.parse(JSON.stringify(a.state.players));

    const compare = (where) => {
      const roles = [
        ['screen', () => [a.screenView(), b.screenView()]],
        ['host', () => [a.hostView(), b.hostView()]],
        ...ids.map((id) => [`player:${id.slice(0, 4)}`, () => [a.playerView(id), b.playerView(id)]]),
      ];
      for (const [role, get] of roles) {
        const [x, y] = get();
        checks++;
        const sx = strip(x);
        const sy = strip(y);
        if (sx !== sy) diffs.push({ file, where, role, was: sx, now: sy });
      }
    };

    a.start();
    b.start();
    compare('start');
    for (let step = 0; step < 400 && a.state.phase !== 'final'; step++) {
      a.next();
      b.next();
      compare(`${a.state.phase} r${a.state.roundIndex}q${a.state.questionIndex}`);
      if (a.state.phase !== 'question') continue;
      // Somebody fast, somebody slow, somebody who never answers — so the
      // tally, the fastest finger and the scoring are all exercised.
      t += 4000; a.answer(ids[0], 0); b.answer(ids[0], 0);
      compare('after the fast answer');
      t += 7000; a.answer(ids[1], 1); b.answer(ids[1], 1);
      compare('after the slow answer');
      t += 3000;
    }
  }

  console.log(`\n${checks} payload comparisons across ${packs.length} packs`);
  if (!diffs.length) {
    console.log('IDENTICAL — a pub night is byte-for-byte what it was.');
  } else {
    failed = 1;
    for (const d of diffs.slice(0, 5)) {
      console.log(`\nDIFF  ${d.file} @ ${d.where} [${d.role}]`);
      console.log(`  was: ${d.was.slice(0, 300)}`);
      console.log(`  now: ${d.now.slice(0, 300)}`);
    }
    console.log(`\n${diffs.length} differing payloads. A pub night has CHANGED.`);
  }
} finally {
  try { git('worktree', 'remove', '--force', work); } catch { /* best effort */ }
  rmSync(work, { recursive: true, force: true });
}
process.exit(failed);
