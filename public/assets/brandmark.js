/**
 * The mark. One drawing, used by the page and by the tab icon.
 *
 * It lives in its own file because BOTH sides need it: `client.js` puts it in
 * the top left of every screen, and `server.js` serves it as /favicon.svg. A
 * second copy in the server would be a logo that changes in one place and not
 * the other, which is exactly the kind of thing nobody notices for a month.
 *
 * Drawn rather than loaded, so it costs no request and stays sharp at any
 * size — the same reasoning as the bin icon and the QR encoder.
 *
 * ---
 *
 * **A MICROPHONE AND A NOTE, in a filled disc.** It was a vinyl record, which
 * said "music quiz" and nothing else — and the app runs general knowledge
 * rounds, first-letter rounds and bingo. A mic is the host; the note is what
 * the night is mostly about. Both, and it covers the lot.
 *
 * The disc is the load-bearing part of the composition and not decoration: at
 * 16 pixels in a browser tab, a solid coloured blob with something knocked out
 * of it is legible and an outline drawing is grey mush. So everything inside is
 * a HOLE in the disc rather than a line on top of it.
 *
 * The note is deliberately small and tucked into the corner. At a favicon size
 * it stops being a note and becomes a nick in the edge of the disc, which is
 * fine — what has to survive at 16px is the microphone.
 */

/**
 * @param {object} [opts]
 * @param {number} [opts.size]   pixel size for the <svg> tag; omit for a bare
 *                               scalable one, which is what a favicon wants
 * @param {string} [opts.id]     gradient id — must be unique on a page, because
 *                               two marks sharing one would fight
 * @param {boolean} [opts.bold]  fatter strokes, for when it is drawn tiny
 * @param {string} [opts.cls]
 */
export function quizMark({ size = 0, id = 'bm', bold = false, cls = '' } = {}) {
  // At 16 pixels a 1.6-wide stroke on a 40 viewBox is two thirds of a pixel and
  // turns to mush, so the small version gets heavier lines. Same drawing.
  const stem = bold ? 2.6 : 2;
  const cradle = bold ? 2.4 : 1.9;
  const dims = size ? ` width="${size}" height="${size}"` : '';

  /*
   * Each stop is a CSS custom property with a hard-coded fallback.
   *
   * `stop-color` as a plain attribute cannot hold a `var()`, so it goes in a
   * `style` instead — where a custom property does resolve, letting the mark
   * wear each quizmaster's own two colours. The hex is the FALLBACK and it is
   * doing real work: this same function is served as /favicon.svg, a standalone
   * document with no stylesheet and therefore no `--hot` at all, and a tab icon
   * that came out transparent is not a bug anybody would connect to a colour
   * picker.
   */
  const stop = (offset, v, fallback) =>
    `<stop offset="${offset}" style="stop-color: var(${v}, ${fallback})"/>`;

  // The colour of the holes. Not pure black: it sits on a near-black page and a
  // hair of blue keeps the mark from looking like a punched-out sticker.
  const cut = '#0d0b16';

  return `<svg xmlns="http://www.w3.org/2000/svg"${dims} viewBox="0 0 40 40"${cls ? ` class="${cls}"` : ''} aria-hidden="true">
  <defs>
    <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
      ${stop('0%', '--hot', '#ff2e88')}
      ${stop('55%', '--hot-2', '#ff8a3d')}
      ${stop('100%', '--mark-3', '#ffd23f')}
    </linearGradient>
  </defs>
  <circle cx="20" cy="20" r="19" fill="url(#${id})"/>
  <g fill="none" stroke="${cut}" stroke-width="${cradle}" stroke-linecap="round">
    <!-- the cradle the mic sits in, and its stand -->
    <path d="M11.4 18.6a6.9 6.9 0 0 0 13.8 0"/>
    <path d="M18.3 25.5v4.2" stroke-width="${stem}"/>
    <path d="M14.6 29.9h7.4" stroke-width="${stem}"/>
  </g>
  <!-- the mic itself: a capsule, knocked out of the disc -->
  <rect x="14.6" y="7.4" width="7.4" height="14.2" rx="3.7" fill="${cut}"/>
  <!-- and the note, tucked into the top right. It has to sit WHOLLY inside the
       disc: a flag clipped by the edge reads as a mistake rather than as a
       design, which is what the first attempt did. At favicon size it stops
       being a note and becomes a nick in the edge, which is the right thing
       for it to degrade into — what must survive at 16px is the microphone. -->
  <g fill="${cut}">
    <ellipse cx="26.4" cy="17.8" rx="2.9" ry="2.3" transform="rotate(-20 26.4 17.8)"/>
    <path d="M28.5 16.8v-6.4l4-1.3v2.3l-2.5 0.85v4.55z"/>
  </g>
</svg>`;
}

/** The tab icon: the same mark, bolder so it survives being 16 pixels wide. */
export function faviconSvg() {
  return quizMark({ id: 'fav', bold: true });
}
