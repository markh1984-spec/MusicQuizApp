#!/usr/bin/env node
/**
 * THE MONDAY BUILD — every guard, one verdict, before anything goes live.
 *
 * The release train, in one command. Nothing is pushed to the branch Render
 * watches except on a Monday, and only after this has printed SAFE TO DEPLOY:
 * the live app becomes a version that was tested as a WHOLE, not a stream of
 * pushes each tested on its own. It exists because "run the guards before a
 * push" was a rule people remembered, and a rule people remember is one that
 * gets skipped on the day it matters — it was, on 15 August 2026, and Launch
 * went live broken for every game with 1,150 unit tests green.
 *
 * WHAT IT RUNS, in order, and the order is the protected surface first:
 *
 *   1. `npm test`                        — the unit suite, no network
 *   2. `pub-unchanged.mjs <deployed>`    — every payload a projector and a
 *                                          phone receive, against the commit
 *                                          that is LIVE (`origin/MusicQuizApp`),
 *                                          not HEAD, which on a clean tree can
 *                                          only ever print IDENTICAL
 *   3. the browser and HTTP guards named in CLAUDE.md's Checks list that walk
 *      a night: launch, join, answer, prizes, a deploy's leftover room, GitHub
 *      down, every game type, the drags, the frame, the controls
 *
 * `--full` adds the slow and the cosmetic ones (dead-controls is 25 minutes
 * on its own). `--only <name>` runs one. Every guard's output goes to a log
 * file so a failure can be read without re-running it; the console shows one
 * line per guard.
 *
 * NAMED, NOT COUNTED. A guard is on the list by name so that a new one has to
 * be added deliberately and a deleted one fails loudly — the same rule as the
 * console-source list. `test/gig-build.test.js` checks every name exists.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const full = args.includes('--full');
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const deployed = args.includes('--against') ? args[args.indexOf('--against') + 1] : 'origin/MusicQuizApp';

/** The guards, in the order they run. `core` runs every Monday; the rest with --full. */
export const GUARDS = [
  // ---- the protected surface: launch, join, answer, next/reveal/back, recovery
  { name: 'gig-path',              core: true,  why: 'the whole gig path, in a real browser' },
  { name: 'after-a-deploy',        core: true,  why: 'the room a deploy leaves behind — can the host still launch?' },
  { name: 'github-down',           core: true,  why: 'GitHub gone quiet — does a night still run?' },
  { name: 'every-game',            core: true,  why: 'every game and round type, end to end' },
  { name: 'prizes-fuzz',           core: true,  why: 'every prize count, word and tie, both games' },
  { name: 'bingo-prizes',          core: true,  why: 'does a bingo prize reach who won it?' },
  { name: 'bingo-round-ends',      core: true,  why: 'is the whole room told the prizes have gone?' },
  { name: 'card-bingo',            core: true,  why: 'does a deck reach a room, and can a phone mark it?' },
  { name: 'drinks-in-your-pocket', core: true,  why: 'is a drink they won ever off their phone?' },
  { name: 'drinks-keep',           core: true,  why: 'is the drink still there next week?' },
  { name: 'no-prizes-no-launch',   core: true,  why: 'can a night launch with nobody to pay?' },
  { name: 'typed-prizes-reach-the-room', core: true, why: 'what the prize table says it pays is what the room plays for' },
  { name: 'bar-reaches-the-room',  core: true,  why: "does the bar's card reach the room?" },
  { name: 'reaches-the-wall',      core: true,  why: 'does a correction reach the projector?' },
  { name: 'phone-holds-up',        core: true,  why: 'what a phone does when a request fails' },
  { name: 'drag-check',            core: true,  why: "Tonight's drags, with a real browser drag" },
  { name: 'tonight-resolves',      core: true,  why: 'does the bar offer real games, and find every pack?' },
  { name: 'console-frame',         core: true,  why: 'is every Console control reachable?' },
  { name: 'console-controls',      core: true,  why: 'and does pressing one do what it says?' },
  { name: 'two-screens',           core: true,  why: 'two outputs, a real account, quiz -> bingo' },
  { name: 'a-word-in-your-ear',    core: true,  why: 'does a message reach one phone and no other?' },
  { name: 'ready-light',           core: true,  why: 'does the launch bar\'s ready line go green, and back?' },
  { name: 'two-devices',           core: true,  why: 'two control views, one quiz — does a press land once?' },
  { name: 'host-controls',         core: true,  why: 'is every control on the control view alive, at every phase?' },
  { name: 'wifi-blip',             core: true,  why: 'the wifi drops on each screen in turn — does it come back right?' },
  { name: 'long-night',            core: true,  why: 'sixty phones, forty questions — memory, streams and push latency' },
  { name: 'flight-recorder',       core: true,  why: 'does a broken night write itself down, and can the host copy it?' },
  /*
   * CORE, THOUGH IT TOUCHES NO ROOM. `data/` is wiped on every deploy and there
   * is no disk, so the backup IS the data — and the night this guard was written
   * for is the one where six weeks of gigs, venues, prizes and overlays turned
   * out to be stored nowhere while every screen looked right. A build that says
   * SAFE TO DEPLOY without it is answering a narrower question than the host is
   * asking. It takes about twenty seconds.
   */
  { name: 'a-night-survives-a-deploy', core: true, why: 'the venue, the night and its frame — after the disk is taken away' },
  { name: 'deploy-with-a-disk',      core: true,  why: 'the night that was running comes back WITH the disk — and the host can still replace it' },
  { name: 'photo-screen',            core: false, why: 'photos only, no quiz — the second screen on a karaoke night' },
  // ---- the rest of the app: run with --full
  { name: 'community-bay',         core: false, why: 'does the Community bay still fit the frame?' },
  { name: 'pages-scroll',          core: false, why: 'can a person actually scroll each page?' },
  { name: 'final-fits',            core: false, why: 'is the last slide of the night all on screen?' },
  { name: 'advert-on-the-wall',    core: false, why: 'does a corrected slide reach the room?' },
  { name: 'lobby-games-play',      core: false, why: 'do the five games draw, run and score?' },
  { name: 'soundboard',            core: false, why: "do the host's sounds actually make a noise?" },
  { name: 'buy-your-own-rung',     core: false, why: 'can somebody who wants to pay actually pay?' },
  { name: 'owner-money',           core: false, why: 'is the money tab telling the truth?' },
  { name: 'buy-a-pack',            core: false, why: 'can somebody buy one pack for £3?' },
  { name: 'dj-set',                core: false, why: 'a DJ set — and is the queue off the wall?' },
  { name: 'sign-in-link',          core: false, why: 'forgot your password — can you get in?' },
  { name: 'photo-to-socials',      core: false, why: 'can a pub save a photo, with your name on?' },
  { name: 'photo-to-start',        core: false, why: 'is the photo ask real, and the skip?' },
  { name: 'rude-photo',            core: true, why: 'is a rude photo flagged, sorted to the front and marked?' },
  { name: 'venue-frame',           core: true, why: 'does the venue frame replace the app mark, not sit under it?' },
  { name: 'gallery-frame',         core: true,  why: 'is the venue frame on the public gallery, on screen and in the save?' },
  { name: 'photos-in-a-bucket',    core: false, why: 'the gallery off an object store — and does the bin mean it?' },
  { name: 'star-means-public',     core: false, why: 'does starring publish it, and does the socials post kit work?' },
  { name: 'second-screen',         core: false, why: 'the second display: the code and the photos' },
  { name: 'second-laptop',         core: false, why: 'the wall on a spare laptop' },
  { name: 'funniest-photo',        core: false, why: "does the room's vote reach a drink?" },
  { name: 'bar-staff-camera',      core: false, why: 'the camera code — same bucket, and nothing else' },
  { name: 'props-on-a-photo',      core: false, why: 'do the googly eyes go on, on BOTH cameras?' },
  { name: 'turn-a-photo',          core: false, why: 'a rotated photo stays rotated' },
  { name: 'photo-sweep',           core: false, why: 'does binning the reds leave the greens alone?' },
  { name: 'post-gig-venue',        core: false, why: 'a filed night can be told where it was' },
  { name: 'pack-repeats',          core: false, why: 'does one night ask the same thing twice?' },
  { name: 'dead-controls',         core: false, why: 'anything inert? (slow)', args: ['--door', 'console'] },
];

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) await main();

async function main() {
  const logDir = path.join(ROOT, 'data', 'gig-build');
  fs.mkdirSync(logDir, { recursive: true });
  const started = Date.now();
  const results = [];
  const line = (ok, name, ms, note = '') => console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name.padEnd(24)} ${String(Math.round(ms / 1000)).padStart(4)}s${note ? `  ${note}` : ''}`);

  console.log(`\nTHE MONDAY BUILD — ${new Date().toISOString().slice(0, 16).replace('T', ' ')}\n`);

  const steps = [];
  if (!only) {
    steps.push({ name: 'npm test', run: () => sh('npm', ['test']) });
    steps.push({ name: `pub-unchanged vs ${deployed}`, run: async () => {
      // Compare against what is LIVE. Fetch first, so the ref is today's.
      await sh('git', ['fetch', 'origin', 'MusicQuizApp']).catch(() => {});
      return sh(process.execPath, ['scripts/pub-unchanged.mjs', deployed]);
    } });
  }
  for (const g of GUARDS) {
    if (only ? g.name !== only : (!g.core && !full)) continue;
    steps.push({ name: g.name, run: () => sh(process.execPath, [`scripts/${g.name}.mjs`, ...(g.args || [])]) });
  }

  for (const step of steps) {
    const t0 = Date.now();
    const out = await step.run();
    const ms = Date.now() - t0;
    const log = path.join(logDir, `${step.name.replace(/[^a-z0-9-]+/gi, '-')}.log`);
    fs.writeFileSync(log, out.text);
    const ok = out.code === 0;
    results.push({ name: step.name, ok, ms });
    line(ok, step.name, ms, ok ? '' : `exit ${out.code} — ${path.relative(ROOT, log)}`);
  }

  const failed = results.filter((r) => !r.ok);
  const mins = Math.round((Date.now() - started) / 60000);
  console.log('');
  if (failed.length) {
    console.log(`DO NOT DEPLOY — ${failed.length} of ${results.length} failed in ${mins} min: ${failed.map((f) => f.name).join(', ')}`);
    process.exit(1);
  }
  console.log(`SAFE TO DEPLOY — ${results.length} passed in ${mins} min. Push MusicQuizApp; Render deploys it.`);
}

/** Run a command, capture everything, never throw — a guard that crashes is a failure. */
function sh(cmd, argv) {
  return new Promise((resolve) => {
    const child = spawn(cmd, argv, { cwd: ROOT, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let text = '';
    const timer = setTimeout(() => { text += '\n[gig-build] TIMED OUT after 40 minutes\n'; child.kill('SIGKILL'); }, 40 * 60_000);
    child.stdout.on('data', (d) => { text += d; });
    child.stderr.on('data', (d) => { text += d; });
    child.on('close', (code) => { clearTimeout(timer); resolve({ code: code ?? 1, text }); });
    child.on('error', (err) => { clearTimeout(timer); resolve({ code: 1, text: text + String(err) }); });
  });
}
