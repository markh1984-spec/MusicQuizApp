/**
 * THE CONSOLE IS TWELVE FILES NOW, so anything that reads it as TEXT has to
 * read all of them.
 *
 * `console.js` was 11,100 lines and was split by line number on 16 August
 * 2026. Five checks in this suite grep the console for a control, a constant
 * or a balanced tag, and every one of them was pointed at that single file —
 * so after the split each would have gone on reading a file that no longer
 * holds the thing it is about. Three of them failed loudly, which was lucky:
 * a grep that finds nothing can just as easily be written to pass.
 *
 * That is this repo's oldest lesson wearing yet another hat — **a test that
 * never runs the artefact proves nothing about it**, and a test that reads the
 * wrong file proves less than that. Reading the whole set is the fix, and it
 * is also what stops the next split from breaking them.
 */
import fs from 'node:fs';

const DIR = new URL('../public/assets/', import.meta.url);

/** Every file the console is built from, named, in a stable order. */
export function consoleFiles() {
  return fs.readdirSync(DIR)
    .filter((f) => /^console(-[a-z-]+)?\.js$/.test(f))
    .sort()
    .map((name) => ({ name, src: fs.readFileSync(new URL(name, DIR), 'utf8') }));
}

/** All of it joined, for a grep that does not care which module it is in. */
export function consoleSource() {
  return consoleFiles().map((f) => f.src).join('\n');
}
