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
 * **A QUESTION MARK INSIDE A MICROPHONE.**
 *
 * The mic is the host — this app runs general knowledge, first-letter, picture
 * and bingo rounds as well as music, so a note or a record on its own said one
 * thing about a night that is many. The question mark is what every one of
 * those rounds actually is.
 *
 * Three things were arrived at by getting them wrong first, and all three are
 * load-bearing:
 *
 * **The question mark's tail sweeps INWARD to a centred stem.** The first
 * version dropped the tail straight down off the end of the arc, which is not
 * what a "?" does — it reads as a hook with a leg. The stem and the dot share
 * a centre line under the middle of the hook, and getting that line right is
 * most of what makes the glyph legible at all.
 *
 * **The head needs a COLLAR.** A capsule floating above an arc reads as an egg
 * in a bowl. The short neck joining head to cradle is the single detail that
 * makes the eye see a microphone, and it costs three pixels.
 *
 * **The question fills the head rather than sitting in it.** When the mic was
 * big and the glyph small, the question was the first thing to disappear as it
 * shrank — which is backwards, because the question is the half that says what
 * the app does.
 */

/**
 * @param {object} [opts]
 * @param {number} [opts.size]   pixel size for the <svg> tag; omit for a bare
 *                               scalable one, which is what a favicon wants
 * @param {string} [opts.id]     gradient id — must be unique on a page, because
 *                               two marks sharing one would fight
 * @param {boolean} [opts.bold]  fatter strokes, for when it is drawn tiny
 * @param {boolean} [opts.waves] sound coming off it. Off by default: the app
 *                               never draws this mark above 30px, and at that
 *                               size the arcs are noise rather than character.
 * @param {string} [opts.cls]
 */
export function quizMark({ size = 0, id = 'bm', bold = false, waves = false, cls = '' } = {}) {
  // At 16 pixels a thin stroke on a 48 viewBox is a fraction of a pixel and
  // turns to mush, so the small version gets heavier lines. Same drawing.
  const rule = bold ? 4 : 3.2;
  const post = bold ? 4.4 : 3.6;
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

  // The mark sits left of centre when it has sound coming off it, so the WHOLE
  // drawing stays centred in its box rather than the mic doing.
  const cx = waves ? 19 : 24;
  const qw = bold ? 3.4 : 2.9;
  const dot = bold ? 2.5 : 2.2;

  const arc = (from, r, w, dir) =>
    `<path d="M${cx + 16 + from} ${r === 10 ? 12 : 7}a${r} ${r} 0 0 1 0 ${r === 10 ? 14 : 24}"
       fill="none" stroke="url(#${id})" stroke-width="${w}" stroke-linecap="round"/>${dir}`;

  return `<svg xmlns="http://www.w3.org/2000/svg"${dims} viewBox="0 0 48 48"${cls ? ` class="${cls}"` : ''} aria-hidden="true">
  <defs>
    <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
      ${stop('0%', '--hot', '#ff2e88')}
      ${stop('55%', '--hot-2', '#ff8a3d')}
      ${stop('100%', '--mark-3', '#ffd23f')}
    </linearGradient>
  </defs>
  <!-- the grille head -->
  <rect x="${cx - 10.5}" y="1" width="21" height="27" rx="10.5" fill="url(#${id})"/>
  <!-- the question, filling it. Drawn in its own 24x34 box and scaled in, so
       one glyph serves every size and cannot drift between them. -->
  <g transform="translate(${cx - 8} 3.4) scale(0.62)">
    <path d="M4.8 8.6a7.2 7.2 0 1 1 14.4 0c0 4.5-3.3 5.7-5.5 8-1.1 1.1-1.7 2.3-1.7 4v1.9"
          fill="none" stroke="${cut}" stroke-width="${qw / 0.62}"
          stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="12" cy="29.4" r="${dot / 0.62}" fill="${cut}"/>
  </g>
  <!-- the collar. Without it the head is an egg in a bowl. -->
  <rect x="${cx - 3.5}" y="28.5" width="7" height="4" rx="1.6" fill="url(#${id})"/>
  <!-- cradle, post and a base with some weight -->
  <path d="M${cx - 15} 22.5a15 15 0 0 0 30 0" fill="none" stroke="url(#${id})"
        stroke-width="${rule}" stroke-linecap="round"/>
  <path d="M${cx} 37.5v5" stroke="url(#${id})" stroke-width="${post}" stroke-linecap="round"/>
  <rect x="${cx - 10}" y="42.5" width="20" height="4.6" rx="2.3" fill="url(#${id})"/>
  ${waves ? arc(0, 10, bold ? 3.6 : 2.9, '') + arc(5, 15.5, bold ? 3.2 : 2.6, '') : ''}
</svg>`;
}

/** The tab icon: the same mark, bolder so it survives being 16 pixels wide. */
export function faviconSvg() {
  return quizMark({ id: 'fav', bold: true });
}
