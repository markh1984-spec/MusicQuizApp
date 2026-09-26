/**
 * A NAME USED THAT NOTHING DECLARES — found without running the file.
 *
 * `node --check` cannot see a ReferenceError that waits for a request, and
 * `restoreStats()` in `src/http/helpers.js` carried one for a month:
 * `statsFile`, deleted in one commit and still written to in another, caught
 * by its own `try` and logged, so the play counts never came back on an
 * empty disk. The old guard only flagged a name some OTHER module exported —
 * a name nobody declares anywhere is the fault, and it was outside it.
 *
 * Deliberately small: every comment, string, regex literal and the TEXT of
 * every template literal is dropped (the `${…}` expressions are kept, they
 * are code); every declaration a file can make is collected — `const`/`let`/
 * `var` patterns, function and arrow parameters, `catch`, `for…of`, classes
 * and their methods, imports — and whatever bare identifier is left must be
 * a JavaScript or Node global. Anything else is a ReferenceError waiting for
 * the line to run.
 *
 * A false positive here is fixed by teaching it a declaration shape, never
 * by adding the name to the global list.
 */

const KEYWORDS = new Set(('break case catch class const continue debugger default delete do else export extends '
  + 'finally for function if import in instanceof let new return super switch this throw try typeof var void '
  + 'while with yield await async of static get set as from true false null undefined arguments').split(' '));

const GLOBALS = new Set(('globalThis console process Buffer JSON Math Date Number String Boolean Object Array '
  + 'Promise Set Map WeakMap WeakSet Symbol Error TypeError RangeError SyntaxError RegExp Function BigInt '
  + 'Infinity NaN parseInt parseFloat isFinite isNaN encodeURIComponent decodeURIComponent encodeURI decodeURI '
  + 'escape unescape setTimeout setInterval clearTimeout clearInterval setImmediate clearImmediate queueMicrotask '
  + 'structuredClone fetch Response Request Headers URL URLSearchParams AbortController AbortSignal TextEncoder '
  + 'TextDecoder Uint8Array Uint16Array Uint32Array Int8Array Int16Array Int32Array Float32Array Float64Array '
  + 'ArrayBuffer DataView Blob FormData crypto atob btoa performance Proxy Reflect Intl Atomics SharedArrayBuffer '
  + 'WebAssembly Iterator AggregateError EvalError URIError FinalizationRegistry WeakRef require module exports '
  + '__dirname __filename').split(' '));

const IDENT = /[A-Za-z_$][\w$]*/y;

/**
 * The source with everything that is not code taken out. Strings become `""`,
 * regex literals `/x/`, template text goes and its `${…}` expressions stay.
 */
export function codeOnly(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  // What the last emitted non-space character was, to tell a regex from a
  // division: `/` after `)`, `]` or a name divides; after anything else it
  // opens a literal.
  const lastCode = () => out.replace(/\s+$/, '').slice(-1);
  const lastWord = () => (out.match(/([A-Za-z_$][\w$]*)\s*$/) || [])[1] || '';
  const regexMayStart = () => {
    const c = lastCode();
    if (!c) return true;
    if (/[\w$)\]]/.test(c)) {
      return /^(?:return|typeof|case|in|of|else|do|void|delete|throw|new|yield|await|instanceof)$/.test(lastWord());
    }
    return true;
  };
  const skipString = (q) => {
    i += 1;
    while (i < n && src[i] !== q) { if (src[i] === '\\') i += 1; i += 1; }
    i += 1;
    out += '""';
  };
  const skipRegex = () => {
    i += 1;
    let inClass = false;
    while (i < n) {
      const c = src[i];
      if (c === '\\') { i += 2; continue; }
      if (c === '[') inClass = true;
      else if (c === ']') inClass = false;
      else if (c === '/' && !inClass) break;
      else if (c === '\n') break;
      i += 1;
    }
    i += 1;
    while (i < n && /[a-z]/.test(src[i])) i += 1;
    out += ' /0/ ';
  };
  const template = () => {
    i += 1;
    out += '""';
    while (i < n) {
      const c = src[i];
      if (c === '\\') { i += 2; continue; }
      if (c === '`') { i += 1; return; }
      if (c === '$' && src[i + 1] === '{') {
        i += 2;
        out += '(';
        expression();
        out += ')';
        continue;
      }
      i += 1;
    }
  };
  // Inside `${ … }`: ordinary code until the brace that closes it, which may
  // hold strings, nested templates and braces of its own.
  const expression = () => {
    let depth = 0;
    while (i < n) {
      const c = src[i];
      if (c === '}' && depth === 0) { i += 1; return; }
      if (step()) continue;
      if (c === '{') depth += 1;
      else if (c === '}') depth -= 1;
      out += c;
      i += 1;
    }
  };
  // One comment, string, regex or template, if one starts here. True when it ate something.
  const step = () => {
    const c = src[i];
    const d = src[i + 1];
    if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') i += 1; return true; }
    if (c === '/' && d === '*') { const end = src.indexOf('*/', i + 2); i = end < 0 ? n : end + 2; out += ' '; return true; }
    if (c === "'" || c === '"') { skipString(c); return true; }
    if (c === '`') { template(); return true; }
    if (c === '/' && regexMayStart()) { skipRegex(); return true; }
    return false;
  };
  while (i < n) {
    if (step()) continue;
    out += src[i];
    i += 1;
  }
  return out;
}

/** The names a binding pattern declares: `a`, `{ a, b: c = 1, ...d }`, `[a, [b]]`. */
function patternNames(text, into) {
  const s = text.trim();
  if (!s) return;
  if (s[0] === '{' || s[0] === '[') {
    const close = s[0] === '{' ? '}' : ']';
    const inner = s.slice(1, s.lastIndexOf(close));
    for (const part of splitTop(inner)) {
      const p = part.trim();
      if (!p) continue;
      if (p.startsWith('...')) { patternNames(p.slice(3), into); continue; }
      const colon = topIndex(p, ':');
      const eq = topIndex(p, '=');
      if (s[0] === '{' && colon >= 0 && (eq < 0 || colon < eq)) {
        patternNames(p.slice(colon + 1, eq >= 0 ? eq : undefined), into);
      } else {
        patternNames(eq >= 0 ? p.slice(0, eq) : p, into);
      }
    }
    return;
  }
  const eq = topIndex(s, '=');
  const name = (eq >= 0 ? s.slice(0, eq) : s).trim().replace(/^\.\.\./, '');
  const m = name.match(/^[A-Za-z_$][\w$]*/);
  if (m) into.add(m[0]);
}

/** Split on commas outside any bracket. */
function splitTop(text) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if ('([{'.includes(c)) depth += 1;
    else if (')]}'.includes(c)) depth -= 1;
    else if (c === ',' && depth === 0) { parts.push(text.slice(start, i)); start = i + 1; }
  }
  parts.push(text.slice(start));
  return parts;
}

/** The index of `ch` at bracket depth zero, or -1. `=` never matches `=>`, `==` or `>=`. */
function topIndex(text, ch) {
  let depth = 0;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if ('([{'.includes(c)) depth += 1;
    else if (')]}'.includes(c)) depth -= 1;
    else if (c === ch && depth === 0) {
      if (ch === '=' && (text[i + 1] === '>' || text[i + 1] === '=' || text[i - 1] === '=' || text[i - 1] === '!' || text[i - 1] === '<' || text[i - 1] === '>')) continue;
      return i;
    }
  }
  return -1;
}

/** From an opening bracket, the index of the one that closes it. */
function closing(code, open) {
  const pair = { '(': ')', '[': ']', '{': '}' };
  const want = pair[code[open]];
  let depth = 0;
  for (let i = open; i < code.length; i += 1) {
    if (code[i] === code[open]) depth += 1;
    else if (code[i] === want) { depth -= 1; if (!depth) return i; }
  }
  return -1;
}

/** Every name a file declares, at any depth. */
export function declaredNames(code) {
  const names = new Set();
  // const/let/var — up to the `=` (or `of`/`in` in a for-head, or the end).
  for (const m of code.matchAll(/\b(?:const|let|var)\s+/g)) {
    const from = m.index + m[0].length;
    let i = from;
    let depth = 0;
    for (; i < code.length; i += 1) {
      const c = code[i];
      if ('([{'.includes(c)) depth += 1;
      else if (')]}'.includes(c)) { if (depth === 0) break; depth -= 1; }
      else if (depth === 0 && (c === ';' || c === '\n' && !/^\s*[[{]/.test(code.slice(from, i)))) break;
      else if (depth === 0 && c === '=' && code[i + 1] !== '=' && code[i + 1] !== '>') break;
      else if (depth === 0 && /\s(?:of|in)\s/.test(code.slice(Math.max(from, i - 4), i + 1))) { i -= 3; break; }
    }
    patternNames(code.slice(from, i), names);
  }
  // function name(params) — declarations and expressions.
  for (const m of code.matchAll(/\bfunction\s*([A-Za-z_$][\w$]*)?\s*\(/g)) {
    if (m[1]) names.add(m[1]);
    const open = m.index + m[0].length - 1;
    const end = closing(code, open);
    if (end > open) for (const p of splitTop(code.slice(open + 1, end))) patternNames(p, names);
  }
  // (params) => and name =>
  for (const m of code.matchAll(/=>/g)) {
    let j = m.index - 1;
    while (j >= 0 && /\s/.test(code[j])) j -= 1;
    if (code[j] === ')') {
      let depth = 0;
      let k = j;
      for (; k >= 0; k -= 1) {
        if (code[k] === ')') depth += 1;
        else if (code[k] === '(') { depth -= 1; if (!depth) break; }
      }
      if (k >= 0) for (const p of splitTop(code.slice(k + 1, j))) patternNames(p, names);
    } else {
      const word = (code.slice(0, j + 1).match(/[A-Za-z_$][\w$]*$/) || [])[0];
      if (word) names.add(word);
    }
  }
  // Methods and accessors: `name(params) {` at the start of a line or after `{` or
  // `,` inside a literal — a definition, not a call.
  for (const m of code.matchAll(/(?:^|[{,])\s*(?:static\s+|async\s+|get\s+|set\s+|\*\s*)*([A-Za-z_$][\w$]*)\s*\(/gm)) {
    const open = m.index + m[0].length - 1;
    const end = closing(code, open);
    if (end < 0 || !/^\s*\{/.test(code.slice(end + 1))) continue;
    if (/^(?:if|for|while|switch|catch|function|return|await|typeof)$/.test(m[1])) continue;
    names.add(m[1]);
    for (const p of splitTop(code.slice(open + 1, end))) patternNames(p, names);
  }
  for (const m of code.matchAll(/\bcatch\s*\(([^)]*)\)/g)) patternNames(m[1], names);
  for (const m of code.matchAll(/\bclass\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  // Anywhere on a line, not only at its start: two imports share a line in places.
  for (const m of code.matchAll(/(?<![\w$.])import\s+(?:\*\s+as\s+)?([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  for (const m of code.matchAll(/(?<![\w$.])import\s+(?:[A-Za-z_$][\w$]*\s*,\s*)?\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) { const name = part.trim().split(/\s+as\s+/).pop(); if (name) names.add(name); }
  }
  return names;
}

/** Every bare identifier read as a value, with object keys and properties left out. */
export function usedNames(code) {
  const used = new Set();
  const re = /(?<![\w$.#])[A-Za-z_$][\w$]*/g;
  // An import is a declaration, read by `declaredNames()`; its `a as b` is not a read of `a`.
  const body = code.replace(/(?<![\w$.])import\s[^;]*;/g, ' ');
  for (const m of body.matchAll(re)) {
    const name = m[0];
    if (KEYWORDS.has(name)) continue;
    const before = body.slice(0, m.index).replace(/\s+$/, '').slice(-1);
    const after = body.slice(m.index + name.length).match(/^\s*(\S)/);
    const next = after ? after[1] : '';
    // `{ key: value }` and `, key: value` — a property name, not a read. A
    // ternary's middle operand follows `?`, never `{` or `,`, so this is exact.
    if (next === ':' && (before === '{' || before === ',')) continue;
    // `import.meta`, `new.target`.
    if (next === '.' && (name === 'import' || name === 'new')) continue;
    used.add(name);
  }
  return used;
}

/** The names a file reads and never declares, imports or gets from the runtime. */
export function undeclaredNames(src) {
  const code = codeOnly(src);
  const declared = declaredNames(code);
  return [...usedNames(code)].filter((n) => !declared.has(n) && !GLOBALS.has(n)).sort();
}
