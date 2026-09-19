/**
 * THE SERVER IS A SHELL AND A DIRECTORY OF MODULES, AND THIS IS WHAT KEEPS IT ONE.
 *
 * `server.js` was 9,700 lines; it is now the singletons' context, a shell
 * that tries each route family in order, and the boot tail. Every rule here
 * was learned on the console split (`test/console-split.test.js`) and
 * costs nothing to keep:
 *
 *  1. `context.js` imports nothing from `src/http/` — it is the leaf every
 *     module reads its singletons from, so nothing can read a binding in its
 *     temporal dead zone while the graph is still loading.
 *  2. No module assigns to a name it imports. An ES import is read-only and
 *     the assignment throws when the LINE runs, not when the file loads.
 *  3. Every route family the shell lists exists, and every family module is
 *     listed — named, never counted.
 *  4. A module that uses a name another module exports either defines it
 *     or imports it. `node --check` cannot see a ReferenceError that waits
 *     for a request; the first cut had three, all on routes the suite
 *     happened to press.
 *  5. Line budgets, so the shell stays a shell and no module grows back into
 *     the file it came from.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { serverFiles } from './server-source.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = serverFiles();
const byName = Object.fromEntries(files.map((f) => [f.name, f.src]));
const modules = files.filter((f) => f.name.startsWith('src/http/'));

const withoutComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
const withoutStrings = (src) => src.replace(/'(?:[^'\\\n]|\\.)*'/g, "''").replace(/"(?:[^"\\\n]|\\.)*"/g, '""');
const DECL = /^(?:export )?(?:async function|function|class)\s+([A-Za-z_$][\w$]*)|^(?:export )?(?:const|let)\s+([A-Za-z_$][\w$]*)/gm;
const declared = (src) => new Set([...src.matchAll(DECL)].map((m) => m[1] || m[2]));
const exportedBy = (src) => {
  const names = declared(src);
  const clause = src.match(/^export \{ (.*?) \};/m);
  if (clause) for (const n of clause[1].split(',')) names.add(n.trim());
  return names;
};
const importedBy = (src) => {
  const names = new Set();
  for (const m of src.matchAll(/^import \{ ([^}]*) \} from/gm)) for (const n of m[1].split(',')) names.add(n.trim().split(' as ').pop());
  for (const m of src.matchAll(/^import (\w+)(?:, \{[^}]*\})? from/gm)) names.add(m[1]);
  for (const m of src.matchAll(/^import \* as (\w+) from/gm)) names.add(m[1]);
  return names;
};

test('context.js imports nothing from src/http — it is the leaf', () => {
  const ctx = byName['src/http/context.js'];
  assert.ok(ctx, 'src/http/context.js is missing');
  assert.equal(/from '\.\/[a-z-]+\.js'/.test(withoutComments(ctx)), false, 'context.js imports a sibling; it must stay the leaf every module reads');
});

test('no module assigns to a name it imports', () => {
  for (const f of files) {
    const code = withoutComments(f.src);
    // A name also declared locally somewhere in the file (`let rooms = 0`
    // as a counter inside a function) shadows the import legally, and a
    // text check cannot tell that scope's writes from the import's. Skipped.
    const shadowed = new Set([...code.matchAll(/^\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]));
    for (const name of importedBy(f.src)) {
      if (shadowed.has(name)) continue;
      // A local `let rooms = 0` inside a function shadows the import legally;
      // a bare `rooms = x` writes to it and throws. Only the second is a fault.
      const re = new RegExp(`(^|[^\\w$.])${name}\\s*(=[^=]|\\+=|-=|\\+\\+|--)`, 'gm');
      const writes = [...code.matchAll(re)].filter((m) => !/(?:const|let|var|of|in)\s*$/.test(code.slice(Math.max(0, m.index - 12), m.index + (m[1] ? 1 : 0))));
      assert.deepEqual(writes.map((m) => m[0].trim()), [], `${f.name} assigns to imported "${name}" — an import is read-only and this throws when the line runs`);
    }
  }
});

test('every route family the shell lists exists, and every family module is listed', () => {
  const shell = byName['server.js'];
  const listed = new Set([...shell.matchAll(/from '\.\/src\/http\/((?:get|write)-[a-z-]+)\.js'/g)].map((m) => m[1]));
  const onDisk = new Set(modules.map((f) => f.name.replace('src/http/', '').replace(/\.js$/, '')).filter((n) => /^(get|write)-/.test(n)));
  assert.deepEqual([...listed].sort(), [...onDisk].sort(), 'the shell and src/http/ disagree about which route families exist');
  const get = shell.match(/const GET_ROUTES = \[(.*?)\];/s)[1].split(',').map((s) => s.trim()).filter(Boolean);
  const write = shell.match(/const WRITE_ROUTES = \[(.*?)\];/s)[1].split(',').map((s) => s.trim()).filter(Boolean);
  for (const fn of [...get, ...write]) {
    assert.ok(modules.some((f) => new RegExp(`^export async function ${fn}\\(`, 'm').test(f.src)), `${fn} is in the shell's list but no module exports it`);
  }
  assert.equal(write[0], 'writeStripe', 'the Stripe webhook must be tried first — it needs the raw bytes');
});

test('a module that uses a module-level name defines it or imports it', () => {
  const exported = Object.fromEntries(files.map((f) => [f.name, exportedBy(f.src)]));
  const all = new Set(files.flatMap((f) => [...exported[f.name]]));
  const TOKEN = /(?<![\w$.])[A-Za-z_$][\w$]*/g;
  for (const f of files) {
    const code = withoutStrings(withoutComments(f.src)).replace(/\.\.\./g, ' ');
    const used = new Set(code.match(TOKEN) || []);
    const have = new Set([...exported[f.name], ...importedBy(f.src)]);
    const missing = [...used].filter((n) => all.has(n) && !have.has(n));
    assert.deepEqual(missing, [], `${f.name} uses ${missing.join(', ')} without importing or defining it — a ReferenceError waiting for a request`);
  }
});

test('the shell stays a shell and no module grows back into server.js', () => {
  const lines = (src) => src.split('\n').length;
  assert.ok(lines(byName['server.js']) <= 320, `server.js is ${lines(byName['server.js'])} lines; it is the shell, the routes live in src/http/`);
  // 1565 since 19 Sept 2026: `galleryRoomOf()`, the one answer to which room a
  // photograph is filed in, which `fileAway()` had its own wrong copy of.
  const BUDGET = { 'src/http/helpers.js': 1565, 'src/http/identity.js': 900, 'src/http/write-host.js': 650, 'src/http/get-gallery.js': 600 };
  for (const f of modules) {
    const cap = BUDGET[f.name] || 560;
    assert.ok(lines(f.src) <= cap, `${f.name} is ${lines(f.src)} lines, over its ${cap}; split it rather than raise this`);
  }
});

test('the three helpers lifted out of the handlers are where the families expect them', () => {
  const identity = byName['src/http/identity.js'];
  for (const fn of ['offerRoomId', 'refuseBreached', 'postALink']) {
    assert.match(identity, new RegExp(`^export (?:async )?function ${fn}\\(`, 'm'), `${fn} left identity.js`);
  }
  for (const f of modules) {
    assert.equal(/^  (?:async )?function /m.test(withoutComments(f.src)), false, `${f.name} declares a function inside a route family; the next family cannot see it`);
  }
});
