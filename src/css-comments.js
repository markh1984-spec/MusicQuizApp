/**
 * THE STYLESHEET GOES OUT WITHOUT ITS COMMENTS — and the file keeps them.
 *
 * `style.css` is mostly reasoning: 628 KB on disk, 279 KB of it rules. Every
 * phone in the room fetches it after every deploy (its ETag changes), so the
 * comments were most of what a pub's wifi carried for it — 177 KB brotli'd
 * against 47 KB. They are the documentation for whoever edits the file and
 * worth nothing to a browser, so they come off on the way OUT, in memory,
 * and the file on disk is never touched. **No build step**: this is the
 * server reading a file and sending less of it.
 *
 * A comment is cut only where nothing can change by cutting it:
 *
 * - **a string is copied as it is**, so `content: "/*"` survives;
 * - **a comment GLUED between two tokens is left in.** CSS drops a comment
 *   before it reads the tokens either side, so `0/＊＊/auto` is two values
 *   where `0auto` would be one, and `.a/＊＊/.b` would become `.a .b` with a
 *   space put in. There are none in the stylesheet today; this is the
 *   guarantee if one ever arrives.
 *
 * Then trailing spaces and the blank lines a cut leaves behind go too.
 */
const SPACE = /\s/;
// Characters that end or start a token on their own, so a comment touching
// one of them can never fuse the tokens either side.
const STOPS = /[{};,:>+~()[\]]/;

export function stripCssComments(css) {
  let out = '';
  let i = 0;
  while (i < css.length) {
    const c = css[i];
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < css.length && css[j] !== c) {
        if (css[j] === '\\') j += 1;
        j += 1;
      }
      out += css.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (c === '/' && css[i + 1] === '*') {
      const close = css.indexOf('*/', i + 2);
      const end = close < 0 ? css.length : close + 2;
      const before = out[out.length - 1] || ' ';
      const after = css[end] || ' ';
      const glued = !SPACE.test(before) && !SPACE.test(after) && !STOPS.test(before) && !STOPS.test(after);
      if (glued) out += css.slice(i, end);
      i = end;
      continue;
    }
    out += c;
    i += 1;
  }
  return out.replace(/[ \t]+$/gm, '').replace(/\n{2,}/g, '\n');
}
