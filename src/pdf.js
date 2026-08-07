/**
 * A very small PDF writer.
 *
 * Written out rather than installed, for the same reason `src/qrcode.js` is: a
 * dependency is something that can break on a gig night, and this needs to do
 * exactly one thing — put text and a few lines on a single sheet of A4.
 *
 * It uses the base-14 fonts (Helvetica), which every PDF reader has built in,
 * so there is no font file to embed and the output is a few kilobytes. Text is
 * WinAnsi-encoded, which matters for one character and one only: the pound
 * sign. Get that wrong and every invoice says "?350".
 *
 * What it deliberately cannot do: images, multiple pages, wrapping. An invoice
 * is a page of text and some rules. If it ever needs more than that, that is
 * the moment to think again rather than to grow this file.
 */

const A4 = { width: 595.28, height: 841.89 };

/** Points, from the top of the page — which is how a human thinks about it. */
export class Page {
  constructor() {
    this.ops = [];
    this.fonts = new Set(['F1']);
  }

  /**
   * @param {object} opts
   * @param {number} [opts.size]   points
   * @param {boolean} [opts.bold]
   * @param {string}  [opts.align] 'left' | 'right'
   * @param {number[]} [opts.rgb]  0-1 each
   */
  text(string, x, y, { size = 10, bold = false, align = 'left', rgb = [0, 0, 0] } = {}) {
    const value = String(string ?? '');
    if (!value) return this;
    const font = bold ? 'F2' : 'F1';
    this.fonts.add(font);
    const width = textWidth(value, size, bold);
    const left = align === 'right' ? x - width : x;
    this.ops.push(
      'BT',
      `${rgb.map(fixed).join(' ')} rg`,
      `/${font} ${fixed(size)} Tf`,
      `${fixed(left)} ${fixed(A4.height - y)} Td`,
      `(${escapeText(value)}) Tj`,
      'ET',
    );
    return this;
  }

  /** Several lines of text, one under the other. Returns the y it finished at. */
  lines(list, x, y, opts = {}) {
    const step = (opts.size || 10) * 1.35;
    let at = y;
    for (const line of list) {
      if (line) this.text(line, x, at, opts);
      at += step;
    }
    return at;
  }

  rule(x1, y, x2, { width = 0.6, rgb = [0.8, 0.8, 0.84] } = {}) {
    this.ops.push(
      `${rgb.map(fixed).join(' ')} RG`,
      `${fixed(width)} w`,
      `${fixed(x1)} ${fixed(A4.height - y)} m ${fixed(x2)} ${fixed(A4.height - y)} l S`,
    );
    return this;
  }

  box(x, y, w, h, { rgb = [0.96, 0.96, 0.98] } = {}) {
    this.ops.push(
      `${rgb.map(fixed).join(' ')} rg`,
      `${fixed(x)} ${fixed(A4.height - y - h)} ${fixed(w)} ${fixed(h)} re f`,
    );
    return this;
  }

  build() {
    return this.ops.join('\n');
  }
}

/**
 * Assemble the file.
 *
 * A PDF is a handful of numbered objects plus a table saying what byte each one
 * starts at. The table is why this is built as a list of strings and measured
 * as it goes rather than concatenated at the end.
 */
export function renderPdf(page, { title = 'Invoice' } = {}) {
  const content = page.build();
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${fixed(A4.width)} ${fixed(A4.height)}] `
      + '/Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${byteLength(content)} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    `<< /Title (${escapeText(title)}) /Producer (Mark's Music Madness) >>`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefAt = byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${objects.length} 0 R >>\n`
    + `startxref\n${xrefAt}\n%%EOF\n`;

  return Buffer.from(pdf, 'latin1');
}

/**
 * Helvetica's own widths, in thousandths of the point size.
 *
 * Only needed so a right-aligned number lands where it should. Everything
 * outside the table falls back to an average, which is fine for the handful of
 * characters that are not in it.
 */
const WIDTHS = {
  ' ': 278, '!': 278, '"': 355, '#': 556, '$': 556, '%': 889, '&': 667, "'": 191,
  '(': 333, ')': 333, '*': 389, '+': 584, ',': 278, '-': 333, '.': 278, '/': 278,
  '0': 556, '1': 556, '2': 556, '3': 556, '4': 556, '5': 556, '6': 556, '7': 556,
  '8': 556, '9': 556, ':': 278, ';': 278, '<': 584, '=': 584, '>': 584, '?': 556,
  '@': 1015, A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722,
  I: 278, J: 500, K: 667, L: 556, M: 833, N: 722, O: 778, P: 667, Q: 778,
  R: 722, S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
  '[': 278, '\\': 278, ']': 278, '^': 469, _: 556, '`': 333,
  a: 556, b: 556, c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222,
  j: 222, k: 500, l: 222, m: 833, n: 556, o: 556, p: 556, q: 556, r: 333,
  s: 500, t: 278, u: 556, v: 500, w: 722, x: 500, y: 500, z: 500,
  '{': 334, '|': 260, '}': 334, '~': 584, '£': 556, '—': 1000, '–': 556, '’': 222,
};
const BOLD_FACTOR = 1.07;

export function textWidth(string, size, bold = false) {
  let units = 0;
  for (const ch of String(string)) units += WIDTHS[ch] ?? 556;
  return (units / 1000) * size * (bold ? BOLD_FACTOR : 1);
}

/**
 * Cut a string to fit a column, with an ellipsis.
 *
 * There is no wrapping in here on purpose — a description that runs onto a
 * second line pushes the totals down the page and off the bottom, and a total
 * you cannot see is worse than a description you cannot read in full.
 */
export function fit(string, maxWidth, size, bold = false) {
  const value = String(string ?? '');
  if (textWidth(value, size, bold) <= maxWidth) return value;
  let cut = value;
  while (cut.length > 1 && textWidth(cut + '…', size, bold) > maxWidth) cut = cut.slice(0, -1);
  return cut.trimEnd() + '…';
}

/**
 * Only three characters have to be escaped inside a PDF string, and everything
 * outside WinAnsi has to become something that is inside it — otherwise a
 * smart quote pasted from an email turns the file into rubbish from that point
 * on.
 */
function escapeText(string) {
  return [...String(string)]
    .map((ch) => {
      if (ch === '\\') return '\\\\';
      if (ch === '(') return '\\(';
      if (ch === ')') return '\\)';
      const code = ch.codePointAt(0);
      if (code >= 32 && code <= 126) return ch;
      const winAnsi = WIN_ANSI[ch];
      if (winAnsi) return `\\${winAnsi.toString(8).padStart(3, '0')}`;
      if (code >= 160 && code <= 255) return `\\${code.toString(8).padStart(3, '0')}`;
      return '?';
    })
    .join('');
}

/** The handful of characters that actually turn up in an invoice. */
const WIN_ANSI = {
  '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94,
  '–': 0x96, '—': 0x97, '…': 0x85, '•': 0x95,
};

function fixed(n) {
  return (Math.round(Number(n) * 100) / 100).toString();
}

function byteLength(string) {
  return Buffer.byteLength(string, 'latin1');
}

export const PAGE = A4;
