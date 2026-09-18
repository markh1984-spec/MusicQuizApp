/**
 * A PROMISE THAT REJECTS WITH NOBODY LISTENING MUST NOT TAKE THE QUIZ DOWN.
 *
 * `server.js` has an `uncaughtException` handler and no `unhandledRejection`
 * one, and that is enough — but only because of a Node default: in `throw`
 * mode a rejection nobody caught is raised as an uncaught exception, which
 * the handler swallows. Two things could silently undo that, and this test
 * holds both: the start script growing a `--unhandled-rejections=strict`
 * flag (strict bypasses the handler and exits), and a Node upgrade changing
 * the default. The second is proved by RUNNING it on the Node in use.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('the start script does not set a rejection mode that bypasses the handler', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.equal(/unhandled-rejections/.test(pkg.scripts.start), false,
    'npm start sets --unhandled-rejections; strict mode exits past the uncaughtException handler');
});

test('on this Node, an uncaughtException handler survives an unhandled rejection', () => {
  const script = `
    process.on('uncaughtException', (e) => { console.log('caught:' + e.message); });
    Promise.reject(new Error('probe'));
    setTimeout(() => console.log('alive'), 30);
  `;
  const out = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8' });
  assert.equal(out.status, 0, `process exited ${out.status}: ${out.stderr}`);
  assert.match(out.stdout, /caught:probe/, 'the rejection did not reach the uncaughtException handler');
  assert.match(out.stdout, /alive/, 'the process did not carry on after the rejection');
});

test('server.js keeps the uncaughtException handler that does that job', () => {
  const src = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
  assert.match(src, /process\.on\('uncaughtException'/, 'the handler is gone');
});
