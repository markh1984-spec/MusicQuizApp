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
/*
 * Drop `--ignore` and the value after it; whatever is left is the ref.
 *
 * **This silently ignored the ref unless `--ignore` was also passed.** With no
 * `--ignore`, `ignoreAt` is -1, so `i !== ignoreAt + 1` reads as `i !== 0` and
 * threw away argument zero — the commit you named. Every
 * `pub-unchanged.mjs <commit>` run in this repo's history compared against
 * HEAD~1 instead, and said so in a line nobody reads twice because it looks
 * like a confirmation.
 */
const ref = args.filter((a, i) => (ignoreAt === -1 ? true : i !== ignoreAt && i !== ignoreAt + 1))[0] || 'HEAD~1';

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

    /*
     * THE LOBBY, BEFORE ANYTHING STARTS — and it was missing entirely.
     *
     * `compare()` was first called AFTER `a.start()`, so every payload this
     * script has ever checked was from a game already under way: the join
     * code, the QR, the prize line, the player strip, the countdown and the
     * lobby game were all outside the one guard this repo runs before a gig
     * week. That is the screen a room looks at while sixty people are joining,
     * which is the busiest moment of the night.
     *
     * Found by adding a field to the lobby player payload and being told the
     * payloads were identical — the fourth time this script has answered
     * confidently about something it was not looking at.
     */
    compare('lobby');
    a.start();
    b.start();
    compare('start');
    for (let step = 0; step < 400 && a.state.phase !== 'final'; step++) {
      a.next();
      b.next();
      compare(`${a.state.phase} r${a.state.roundIndex}q${a.state.questionIndex}`);
      if (a.state.phase !== 'question') continue;
      /*
       * Somebody fast, somebody slow, somebody who never answers — so the
       * tally, the fastest finger and the scoring are all exercised.
       *
       * **THAT WAS A LIE FOR AS LONG AS THIS SCRIPT HAS EXISTED.** `answer()`
       * takes an OBJECT and this called it positionally — `a.answer(id, 0)` —
       * so every answer was refused as `unknown_player` and dropped in
       * silence. Every "after the fast answer" comparison was a question with
       * nobody having answered it, which put the tally, the fastest finger,
       * who-picked-what and the whole of the scoring outside the one check
       * this repo runs before a gig week. Found by making a deliberate change
       * to a player's mid-question payload and being told it was identical.
       *
       * So the result is ASSERTED rather than ignored. A guard that quietly
       * tests nothing is worse than no guard, because it is believed.
       *
       * The picks are worked out from the OLD engine and given to both, so
       * the two answer identically rather than each choosing for itself. They
       * have to be worked out at all because "option 0" is not a thing that
       * works on every round: a pick-them-all question is refused unless it
       * gets exactly the number it asked for, and an alphabet question has
       * twenty-six options put back by `optionsFor`.
       */
      const picksFor = (wantCorrect) => {
        const q = a.question();
        const round = a.round();
        const right = [...a.correctSet(q, round)];
        const count = a.optionsFor(q, round).length;
        const wrong = [];
        for (let i = 0; i < count && wrong.length < right.length; i++) {
          if (!right.includes(i)) wrong.push(i);
        }
        // A question where everything is correct has no wrong answer to give;
        // being right twice is better than not answering at all.
        const chosen = wantCorrect || wrong.length < right.length ? right : wrong;
        return round.type === 'multi' ? { optionIndexes: chosen } : { optionIndex: chosen[0] };
      };
      const answered = (id, pick) => {
        for (const engine of [a, b]) {
          const result = engine.answer({ playerId: id, ...pick });
          if (!result.ok && result.reason !== 'already_answered') {
            throw new Error(`the guard could not answer (${result.reason}) — it is testing nothing`);
          }
        }
      };
      // One right and one wrong, so the bonus, the fastest finger, the tally
      // and the part marks are all on the compared payloads.
      t += 4000;
      answered(ids[0], picksFor(true));
      compare('after the fast answer');
      t += 7000;
      answered(ids[1], picksFor(false));
      compare('after the slow answer');
      t += 3000;
    }
  }

  console.log(`\n${checks} payload comparisons across ${packs.length} packs`);
  if (!diffs.length) {
    console.log('IDENTICAL — a pub night is byte-for-byte what it was.');
  } else {
    failed = 1;
    /*
     * WHICH FIELD, not the first 300 characters of two long payloads.
     *
     * The old output printed both JSON strings truncated — and a payload's
     * first 300 characters are almost always identical, so a real difference
     * showed as two lines that looked the same. On the one tool you run the
     * night before a gig, "something changed, work out what" is most of the
     * job left undone. Naming the paths turns the answer into a claim
     * somebody can check: "you.score and you.position, on a phone,
     * mid-question" is what an additive change is supposed to look like.
     */
    const paths = new Map();
    for (const d of diffs) {
      for (const path of wherever(JSON.parse(d.was), JSON.parse(d.now))) {
        if (!paths.has(path)) paths.set(path, { count: 0, roles: new Set(), example: null });
        const seen = paths.get(path);
        seen.count += 1;
        seen.roles.add(d.role.split(':')[0]);
        if (!seen.example) seen.example = d;
      }
    }
    console.log('\nWHAT CHANGED');
    for (const [path, seen] of [...paths].sort((x, y) => y[1].count - x[1].count).slice(0, 12)) {
      console.log(`  ${path} — ${seen.count} payload${seen.count === 1 ? '' : 's'}, seen by: ${[...seen.roles].join(', ')}`);
    }
    for (const d of diffs.slice(0, 3)) {
      console.log(`\nDIFF  ${d.file} @ ${d.where} [${d.role}]`);
      for (const path of wherever(JSON.parse(d.was), JSON.parse(d.now)).slice(0, 6)) {
        console.log(`  ${path}`);
        console.log(`    was ${short(at(JSON.parse(d.was), path))}`);
        console.log(`    now ${short(at(JSON.parse(d.now), path))}`);
      }
    }
    console.log(`\n${diffs.length} differing payloads. A pub night has CHANGED.`);
  }
} finally {
  try { git('worktree', 'remove', '--force', work); } catch { /* best effort */ }
  rmSync(work, { recursive: true, force: true });
}
process.exit(failed);

/**
 * Every path at which two payloads disagree.
 *
 * Deliberately stops DESCENDING once it finds a difference — "you.score
 * changed" is the finding, and listing every leaf underneath a rearranged
 * object buries it. A missing field and a changed one read differently
 * because they want different things doing about them: one is a payload that
 * lost something a phone may be reading, the other is a value.
 */
function wherever(was, now, path = '') {
  if (JSON.stringify(was) === JSON.stringify(now)) return [];
  const both = was && now && typeof was === 'object' && typeof now === 'object'
    && Array.isArray(was) === Array.isArray(now);
  if (!both) return [path || '(the whole payload)'];
  const found = [];
  for (const key of new Set([...Object.keys(was), ...Object.keys(now)])) {
    const at = path ? `${path}.${key}` : key;
    if (!(key in was)) found.push(`${at}  (NEW)`);
    else if (!(key in now)) found.push(`${at}  (GONE)`);
    else found.push(...wherever(was[key], now[key], at));
  }
  return found;
}

/** Read a dotted path back out, for showing the two values. */
function at(payload, path) {
  const clean = path.replace(/\s+\(NEW\)|\s+\(GONE\)/, '');
  let here = payload;
  for (const key of clean.split('.')) {
    if (here == null || typeof here !== 'object') return undefined;
    here = here[key];
  }
  return here;
}

/** A value, short enough to sit on one line. */
function short(v) {
  const said = JSON.stringify(v);
  return said === undefined ? '(absent)' : said.length > 120 ? said.slice(0, 120) + '…' : said;
}
