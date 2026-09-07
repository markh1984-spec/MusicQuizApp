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
 * you trust.
 *
 * IT IS TWO HALVES, and for a long time it was only the first:
 *
 *  1. **THE ENGINE.** Both versions of `engine.js` side by side on one
 *     injected clock, the same teams answering the same options at the same
 *     seconds, every view deep-compared. Every phase of every pack.
 *  2. **THE WIRE.** Both versions of the whole APP started for real and driven
 *     through one night over HTTP, so what is compared is what leaves the
 *     socket. **The first half cannot see `viewFor()` in `server.js` — the
 *     join code, the brand, the colours, the photo wall, `joinsWaiting`,
 *     `mayAdvert` — and cannot see `session.js` at all.** Measured: deleting
 *     `view.joinCode` from every payload left this saying IDENTICAL, and so
 *     did making `session.js` throw on import, so the app could not start.
 *     Both are caught now, and each was put back to check.
 *
 * One pack on the wire rather than all twelve, deliberately: the first half
 * already walks every phase of every pack, and the layer this half exists for
 * is the same layer whichever pack is loaded. Shallow, because a guard that
 * takes five minutes is a guard nobody runs on a gig day.
 *
 * It drives the HOUSE room, on the host key, so the join code it compares is
 * the empty one — the house room has no code by design. What is being checked
 * there is that the FIELD is still built and still reaches all three roles;
 * its value is minted per server and normalised either way.
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

import { execFileSync, spawn } from 'node:child_process';
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

/*
 * DECLARED UP HERE, ABOVE THE BLOCK THAT USES THEM.
 *
 * Function declarations hoist and a `const` does not — so with these sitting
 * beside the wire helpers at the foot of the file, `startApp()` reached a
 * `KEY` in its temporal dead zone and threw AFTER the engine half had already
 * printed IDENTICAL. This repo has a note about exactly that shape; it costs
 * nothing to obey it and a confusing five minutes not to.
 */
const KEY = 'pub-unchanged-key';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const here = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const git = (...a) => execFileSync('git', a, { cwd: here, encoding: 'utf8' }).trim();

const work = mkdtempSync(join(tmpdir(), 'pub-unchanged-'));
let failed = 0;
try {
  git('worktree', 'add', '-f', '--detach', work, ref);
  console.log(`Comparing against ${ref} (${git('rev-parse', '--short', ref)})`);
  if (ignore.size) console.log(`Allowing new top-level fields: ${[...ignore].join(', ')}`);

  const { Engine: Old, faceKey: oldFaceKey } = await import(join(work, 'src/engine.js'));
  const { Engine: New, faceKey: newFaceKey } = await import(join(here, 'src/engine.js'));

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

  /*
   * ---- AND THE OTHER HALF: WHAT THE SERVER ACTUALLY PUTS ON THE WIRE
   *
   * **Everything above imports `engine.js` and compares its views. That is not
   * what a projector receives**, and this script's own header claimed it was —
   * "the actual BYTES a projector and a phone receive". Between the engine and
   * the wire sits `viewFor()` in `server.js`, which adds the JOIN CODE, the
   * brand, the two colours, the photo wall, `joinsWaiting`, `mayAdvert` and
   * more; and underneath sits `session.js`, which decides which engine is even
   * running. None of it was compared.
   *
   * Measured: deleting `view.joinCode` from every payload left this script
   * saying IDENTICAL. So did making `session.js` throw on import, so the app
   * could not start at all. On the guard this repo names as the one to run
   * before a gig week.
   *
   * So the two servers are started for real and driven through the same night
   * over HTTP. It is deliberately ONE pack rather than all of them: the walk
   * above already covers every phase of every pack at the engine level, and
   * what this half is for is the layer between the engine and the socket,
   * which is the same layer for every pack. Shallow, like `launch-route.test`,
   * because a guard that takes five minutes is a guard nobody runs on a gig
   * day.
   *
   * WHAT IS NORMALISED, and why each one has to be: a join code is minted per
   * server, player ids and tokens are random per join, `gameSeed` is random
   * per launch, and any epoch timestamp differs by whatever the two runs took.
   * Everything else is compared exactly.
   */
  const wire = await compareOnTheWire({ here, work, ref, oldFaceKey, newFaceKey });
  checks += wire.checks;
  if (wire.diffs.length) {
    failed = 1;
    console.log('\nAND ON THE WIRE — what the server itself sends');
    for (const d of wire.diffs.slice(0, 6)) {
      console.log(`\nDIFF  ${d.where} [${d.role}]`);
      for (const path of wherever(d.was, d.now).slice(0, 8)) {
        console.log(`  ${path}`);
        console.log(`    was ${short(at(d.was, path))}`);
        console.log(`    now ${short(at(d.now, path))}`);
      }
    }
    console.log(`\n${wire.diffs.length} differing payloads off the real server.`);
  } else if (!diffs.length) {
    console.log(`…and ${wire.checks} of them off the two real servers, join code included.`);
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

// ------------------------------------------------ the wire, not the engine


/** One running app: its own port, its own data dir, torn down by `stop()`. */
async function startApp(root, port) {
  const data = mkdtempSync(join(tmpdir(), 'pub-wire-'));
  const child = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      DATA_DIR: data,
      // Never let a spawned app default to the repo's own adverts folder —
      // `offers.test.js` learned that by writing fixtures into it once.
      ADVERT_DIR: join(data, 'adverts'),
      HOST_KEY: KEY,
    },
    stdio: 'ignore',
  });
  const base = `http://127.0.0.1:${port}`;
  /*
   * AND IT HAS TO SAY SO WHEN THE APP WILL NOT START.
   *
   * The first version just looped and then made requests, so a tree whose
   * `server.js` throws on import — a missing import, a bad `session.js`, a
   * syntax error in anything it pulls in — came out as a wall of
   * `ECONNREFUSED` from whichever fetch happened first. That is a guard
   * failing for the right reason and reporting the wrong one, which is most of
   * the way to being ignored.
   */
  let up = false;
  for (let i = 0; i < 120 && !up; i += 1) {
    try { await fetch(base); up = true; } catch { await wait(100); }
  }
  if (!up) {
    child.kill('SIGKILL');
    rmSync(data, { recursive: true, force: true });
    throw new Error(`the app in ${root} never started — it cannot serve a pub night at all`);
  }
  return {
    base,
    stop() { child.kill('SIGKILL'); rmSync(data, { recursive: true, force: true }); },
    async get(path) { return (await fetch(`${base}${path}`)).json(); },
    async host(action, body = {}) {
      const res = await fetch(`${base}/api/host/${action}?key=${KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Host-Key': KEY },
        body: JSON.stringify(body),
      });
      return { status: res.status, body: await res.json().catch(() => ({})) };
    },
  };
}

/**
 * Everything that is random per run, replaced by a name.
 *
 * Nothing here is a value a phone reads for its MEANING — a join code is
 * whatever this server minted, a player id is whatever this join produced —
 * so pinning them would only ever report noise. Everything else is compared
 * exactly, which is the point.
 */
function steady(value, swaps) {
  const said = JSON.stringify(value);
  if (said === undefined) return said;
  let out = said;
  for (const [from, to] of swaps) {
    if (!from) continue;
    out = out.split(from).join(to);
  }
  // Any epoch millisecond — deadlines, `askedAt`, `startedAt`. Two runs are
  // never the same millisecond and nothing here means anything to a phone
  // except as a clock.
  out = out.replace(/(?<![\d."])1[7-9]\d{11}(?![\d"])/g, '"<TIME>"');
  // The lobby game's seed is minted per launch and is meant to be different
  // every night — that is the whole point of it. What matters is that it is
  // THERE and in the right payloads, which the key comparison still checks.
  out = out.replace(/"gameSeed":\s*\d+/g, '"gameSeed":"<SEED>"');
  return out;
}

/** Drive one app through a night, returning every payload it sent. */
async function driveNight(app, packId, faceKey) {
  const seen = [];
  const launched = await app.host('launch', { game: 'quiz', packId });
  if (launched.status !== 200) throw new Error(`launch answered ${launched.status}`);

  const code = (await app.get('/api/state?role=host&key=' + KEY)).joinCode || '';
  const players = [];
  for (const name of ['The Quizzly Bears', 'Les Quizerables', 'Norfolk & Chance']) {
    const res = await fetch(`${app.base}/api/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, joinCode: code }),
    });
    players.push(await res.json());
  }

  const snap = async (where) => {
    seen.push({ where, role: 'screen', view: await app.get(`/api/state?role=screen&g=${code}`) });
    seen.push({ where, role: 'host', view: await app.get(`/api/state?role=host&key=${KEY}`) });
    for (const [i, p] of players.entries()) {
      seen.push({
        where,
        role: `player:${i}`,
        view: await app.get(`/api/state?role=player&g=${code}&playerId=${encodeURIComponent(p.id || '')}`),
      });
    }
  };

  await snap('lobby');
  await app.host('start');
  await snap('start');
  for (let step = 0; step < 40; step += 1) {
    const before = await app.get(`/api/state?role=host&key=${KEY}`);
    if (before.phase === 'final') break;
    await app.host('next');
    const now = await app.get(`/api/state?role=host&key=${KEY}`);
    await snap(`${now.phase} r${now.roundIndex}q${now.questionIndex}`);
  }

  /*
   * THE FACE KEY IS DERIVED, NOT READ BACK — the join reply does not carry
   * one, and it is the handle every board and the photo wall use. Computed
   * with each tree's OWN `faceKey()`, so the two are named `<K0>` and `<K0>`
   * even if the derivation itself is what changed. If it HAS changed that is
   * a real difference and it will show up as the projector's board naming
   * different people, which is the thing worth catching.
   */
  const swaps = [
    [code, '<CODE>'],
    ...players.flatMap((p, i) => [
      [p.id, `<P${i}>`],
      [p.token, `<T${i}>`],
      [faceKey ? faceKey(p.id) : '', `<K${i}>`],
    ]),
  ].filter(([from]) => from);
  return { seen, swaps };
}

/**
 * The same night on both versions of the app, compared payload by payload.
 *
 * The pack is the FIRST in `quizzes/` by name so two runs pick the same one,
 * and both apps are given the same one by id rather than each choosing.
 */
async function compareOnTheWire({ here, work, ref, oldFaceKey, newFaceKey }) {
  const dir = join(here, 'quizzes');
  const packId = readdirSync(dir).filter((f) => f.endsWith('.json')).sort()[0].replace(/\.json$/, '');
  console.log(`\nOn the wire: launching "${packId}" on ${ref} and on this working tree`);

  const port = 4870 + (process.pid % 40);
  const out = { checks: 0, diffs: [] };
  /*
   * BOTH STARTS INSIDE THE `try`, or the first one leaks when the second
   * throws — which is precisely the case this is for: a working tree whose app
   * will not boot. A guard that leaves a server and a temp directory behind
   * every time it catches something is a guard that poisons its own next run,
   * the fault `save-a-night.mjs` spent eight hours proving.
   */
  let older = null;
  let newer = null;
  try {
    older = await startApp(work, port);
    newer = await startApp(here, port + 1);
    const a = await driveNight(older, packId, oldFaceKey);
    const b = await driveNight(newer, packId, newFaceKey);
    const n = Math.min(a.seen.length, b.seen.length);
    if (a.seen.length !== b.seen.length) {
      out.diffs.push({
        where: 'the walk itself', role: 'both',
        was: { payloads: a.seen.length }, now: { payloads: b.seen.length },
      });
    }
    for (let i = 0; i < n; i += 1) {
      const was = a.seen[i];
      const now = b.seen[i];
      out.checks += 1;
      const x = steady(was.view, a.swaps);
      const y = steady(now.view, b.swaps);
      // The ignore list works here too, and on the same terms: top-level only.
      const trim = (text) => {
        const o = JSON.parse(text);
        for (const k of ignore) delete o[k];
        return JSON.stringify(o);
      };
      if (trim(x) !== trim(y)) {
        out.diffs.push({ where: was.where, role: was.role, was: JSON.parse(trim(x)), now: JSON.parse(trim(y)) });
      }
    }
  } finally {
    older?.stop();
    newer?.stop();
  }
  return out;
}
