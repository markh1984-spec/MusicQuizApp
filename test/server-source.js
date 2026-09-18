/**
 * ANYTHING READING THE SERVER AS TEXT READS ALL OF IT.
 *
 * `server.js` is a shell now: the routes live in `src/http/get-*.js` and
 * `write-*.js`, the helpers beside them. Forty tests read the server as a
 * string — to check a route is gated, that a field is named on the way out,
 * that a claim in a comment is fired — and a grep aimed at the shell alone
 * proves nothing, which is this repo's oldest lesson wearing another hat
 * (`test/console-source.js` exists for exactly this). So they all go
 * through here: the shell first, then every module in `src/http/` in the
 * order the shell lists them, so "X is matched before Y" still means what it
 * meant when the two sat in one function.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTTP = path.join(ROOT, 'src', 'http');

/** Every server module, shell first, then in the shell's own import order. */
export function serverFiles() {
  const shell = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const listed = [...shell.matchAll(/from '\.\/src\/http\/([a-z-]+)\.js'/g)].map((m) => m[1]);
  const all = fs.readdirSync(HTTP).filter((f) => f.endsWith('.js')).map((f) => f.slice(0, -3));
  // Modules the shell does not import directly (helpers reached through
  // others) still count — after the listed ones, alphabetically.
  const order = [...listed, ...all.filter((n) => !listed.includes(n)).sort()];
  return [{ name: 'server.js', src: shell }, ...order.map((name) => ({ name: `src/http/${name}.js`, src: fs.readFileSync(path.join(HTTP, `${name}.js`), 'utf8') }))];
}

/** All of it joined, for a grep that does not care which module it is in. */
export function serverSource() {
  return serverFiles().map((f) => f.src).join('\n');
}
