/**
 * A `/*` INSIDE A STRING IS TEXT, NOT A COMMENT OPENER.
 *
 * `withoutComments()` was two regexes, and the block one ran from any `/*` to
 * the next `*​/` — so a string holding `/*` (a glob, a URL, a pattern) opened a
 * "comment" that swallowed every line down to the next real one. Every grep
 * built on it then searched a file with its middle cut out, and a grep that
 * finds nothing can just as easily be written to pass. `test/scope.js`
 * already walks strings, templates and regex literals for the server; the
 * stripper walks the same way now and keeps them whole, because a route
 * named in a fetch is a real use.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { withoutComments } from './console-source.js';

test('a /* inside a string does not swallow the code after it', () => {
  const src = [
    "const glob = '/*';",
    'function stillHere() { return 1; }',
    '/* a real comment, which is what the string above used to open */',
    'const after = stillHere();',
    'const url = "https://example.com/x"; // trailing note',
    'const tpl = `a ${glob} b /* not a comment */ c`;',
    'const re = /\\/\\*/;',
    '// a whole-line note',
    'const last = 2;',
  ].join('\n');
  const out = withoutComments(src);
  assert.match(out, /stillHere\(\) \{ return 1; \}/, 'the line after the string was thrown away');
  assert.match(out, /const after = stillHere\(\);/, 'code after the real comment was lost');
  assert.match(out, /"https:\/\/example\.com\/x"/, 'a URL string was treated as a comment');
  assert.match(out, /`a \$\{glob\} b \/\* not a comment \*\/ c`/, 'a template literal was not kept whole');
  assert.match(out, /const re = \/\\\/\\\*\/;/, 'a regex literal was not kept whole');
  assert.match(out, /const last = 2;/);
  assert.doesNotMatch(out, /a real comment/, 'a real block comment survived');
  assert.doesNotMatch(out, /trailing note/, 'a trailing line comment survived');
  assert.doesNotMatch(out, /whole-line note/, 'a whole-line comment survived');
});

test('a comment holding a quote does not open a string', () => {
  const src = "// it's fine\nconst a = 1; /* \"quoted\" */\nconst b = 'kept';";
  const out = withoutComments(src);
  assert.match(out, /const a = 1;/);
  assert.match(out, /const b = 'kept';/);
  assert.doesNotMatch(out, /quoted|it's fine/);
});
