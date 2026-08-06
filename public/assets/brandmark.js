/**
 * The record. One drawing, used by the page and by the tab icon.
 *
 * It lives in its own file because BOTH sides need it: `client.js` puts it in
 * the top left of every screen, and `server.js` serves it as /favicon.svg. A
 * second copy in the server would be a logo that changes in one place and not
 * the other, which is exactly the kind of thing nobody notices for a month.
 *
 * Drawn rather than loaded, so it costs no request and stays sharp at any
 * size — the same reasoning as the bin icon and the QR encoder.
 */

/**
 * @param {object} [opts]
 * @param {number} [opts.size]   pixel size for the <svg> tag; omit for a bare
 *                               scalable one, which is what a favicon wants
 * @param {string} [opts.id]     gradient id — must be unique on a page, because
 *                               two marks sharing one would fight
 * @param {boolean} [opts.bold]  thicker grooves, for when it is drawn tiny
 * @param {string} [opts.cls]
 */
export function recordMark({ size = 0, id = 'bm', bold = false, cls = '' } = {}) {
  // At 16 pixels a 1.6-wide groove on a 40-wide viewBox is two thirds of a
  // pixel and turns to mush, so the small version gets heavier lines. It is
  // the same record either way: gradient disc, grooves, black centre.
  const groove = bold ? 2.6 : 1.6;
  const inner = bold ? 2 : 1.2;
  const dims = size ? ` width="${size}" height="${size}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg"${dims} viewBox="0 0 40 40"${cls ? ` class="${cls}"` : ''} aria-hidden="true">
  <defs>
    <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ff2e88"/>
      <stop offset="55%" stop-color="#ff8a3d"/>
      <stop offset="100%" stop-color="#ffd23f"/>
    </linearGradient>
  </defs>
  <circle cx="20" cy="20" r="19" fill="url(#${id})"/>
  <circle cx="20" cy="20" r="13" fill="none" stroke="rgba(0,0,0,0.22)" stroke-width="${groove}"/>
  <circle cx="20" cy="20" r="8.5" fill="none" stroke="rgba(0,0,0,0.18)" stroke-width="${inner}"/>
  <circle cx="20" cy="20" r="3.6" fill="#0a0a12"/>
</svg>`;
}

/** The tab icon: the same record, bolder so it survives being 16 pixels wide. */
export function faviconSvg() {
  return recordMark({ id: 'fav', bold: true });
}
