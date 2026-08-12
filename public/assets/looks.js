/**
 * Dressing the night up.
 *
 * A "look" is a palette and a handful of shapes. Halloween is skulls, ghosts
 * and bats over pumpkin orange; Valentine's is hearts over red and pink. It is
 * the same quiz underneath — nothing about how a round plays changes.
 *
 * Three rules, and they are all about not ruining a working screen for the sake
 * of a decoration:
 *
 *  1. **NOTHING GOES OVER THE MIDDLE.** The shapes live in the margins down the
 *     sides. A question with a clock running wants the whole of the middle of
 *     the projector, and a ghost drifting across an option is the one way this
 *     feature could actively lose somebody points.
 *
 *  2. **THE SHAPES ARE DRAWN, NEVER EMOJI.** Same reason the bin icon is drawn:
 *     every phone and every projector renders an emoji differently, and some of
 *     them render a skull as something cheerful. These are paths, so what you
 *     tested is what the room sees.
 *
 *  3. **THE PALETTE CHANGES ON BOTH SCREENS AT ONCE.** The option colours are
 *     how a player looks up, decides "the pink one, bottom left", and looks back
 *     down. If the projector went orange and the phone stayed pink that mapping
 *     breaks, which is worse than no theme at all. The palettes live in
 *     `style.css` under `[data-look="…"]`, which both pages carry.
 *
 * The palettes are in the stylesheet rather than here so there is one place to
 * change a colour. A test checks the two lists agree, because a look with no
 * palette would silently be the ordinary one wearing skulls.
 */

export const DEFAULT_LOOK = 'default';

export const LOOKS = [
  {
    id: 'default',
    label: 'The usual',
    blurb: 'Pink and orange, the way it normally looks.',
    motifs: [],
  },
  {
    id: 'halloween',
    label: 'Halloween',
    blurb: 'Skulls, ghosts and bats over pumpkin orange.',
    motifs: ['skull', 'ghost', 'bat', 'pumpkin'],
    season: { from: [10, 1], to: [11, 2] },
  },
  {
    id: 'valentines',
    label: "Valentine's",
    blurb: 'Hearts, in red and a lot of pink.',
    motifs: ['heart', 'heart-open', 'heart'],
    season: { from: [2, 1], to: [2, 15] },
  },
  {
    id: 'christmas',
    label: 'Christmas',
    blurb: 'Trees, snowflakes and baubles over green and red.',
    motifs: ['tree', 'snowflake', 'bauble', 'snowflake'],
    // Ends on Boxing Day, because New Year takes over from the 27th. Two
    // ranges covering one evening would make the picker's answer depend on
    // which happened to come first in this list.
    season: { from: [11, 20], to: [12, 26] },
  },
  {
    id: 'summer',
    label: 'Summer',
    blurb: 'Sun and palms, for a garden or a beach bar.',
    motifs: ['sun', 'palm', 'shades'],
    season: { from: [6, 1], to: [8, 31] },
  },
  {
    id: 'newyear',
    label: 'New Year',
    blurb: 'Fireworks and clocks, in gold and midnight blue.',
    motifs: ['firework', 'clock', 'star', 'firework'],
    // Starts the day after Boxing Day, which is why Christmas now ENDS on the
    // 26th — two ranges over the same evening would have the picker offering
    // whichever happened to be first in this list.
    season: { from: [12, 27], to: [1, 2] },
  },
  {
    id: 'easter',
    label: 'Easter',
    blurb: 'Eggs and daffodils, in pastel and spring green.',
    motifs: ['egg', 'bunny', 'chick', 'daffodil'],
    // A MOVING FEAST — see `easterSunday()`. Palm Sunday to Easter Monday.
    movable: 'easter',
  },
  {
    id: 'stpatricks',
    label: "St Patrick's",
    blurb: 'Shamrocks and pints, in green and gold.',
    motifs: ['shamrock', 'pint', 'horseshoe', 'shamrock'],
    season: { from: [3, 14], to: [3, 18] },
  },
  {
    id: 'bonfire',
    label: 'Bonfire Night',
    blurb: 'Fireworks and sparklers over a dark November sky.',
    motifs: ['firework', 'sparkler', 'star', 'firework'],
    // Starts the day after Halloween's range ends, for the same reason.
    season: { from: [11, 3], to: [11, 7] },
  },
];

/**
 * When Easter Sunday falls, by the anonymous Gregorian computus.
 *
 * Written out rather than approximated, because Easter moves by more than a
 * month — anywhere from 22 March to 25 April — and a fixed range would be
 * wrong most years. It is pure arithmetic with no table to go stale.
 */
export function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

export function findLook(id) {
  return LOOKS.find((l) => l.id === id) || LOOKS[0];
}

/**
 * Is this look the one for the time of year?
 *
 * ONLY EVER A HINT. It marks the picker and moves that option to the top of
 * the list; it never sets the look on its own. A corporate booking on the 30th
 * of October getting skulls because the app decided is exactly the surprise in
 * front of a room this codebase exists to avoid — so the date SUGGESTS and the
 * quizmaster still chooses.
 *
 * The date comes from the BROWSER on purpose, unlike anything that scores: it
 * is the quizmaster's own calendar that decides whether it is nearly Halloween,
 * not the server's idea of UTC.
 */
export function inSeason(look, now = new Date()) {
  if (look && look.movable === 'easter') {
    // Palm Sunday to Easter Monday: the week a room is already thinking about
    // it, and the Monday it is still off work.
    const easter = easterSunday(now.getUTCFullYear());
    const from = easter.getTime() - 7 * 86400000;
    const to = easter.getTime() + 1.5 * 86400000;
    const at = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 12);
    return at >= from && at <= to;
  }
  const season = look && look.season;
  if (!season) return false;
  const [fromM, fromD] = season.from;
  const [toM, toD] = season.to;
  const at = (now.getMonth() + 1) * 100 + now.getDate();
  const from = fromM * 100 + fromD;
  const to = toM * 100 + toD;
  // A range that ends before it starts has wrapped round the new year.
  return from <= to ? at >= from && at <= to : at >= from || at <= to;
}

/** The look that suits today, or nothing. Used to mark the picker. */
export function lookInSeason(now = new Date()) {
  return LOOKS.find((l) => inSeason(l, now)) || null;
}

/**
 * The shapes, as bold silhouettes on a 24x24 grid.
 *
 * Deliberately simple: they are drawn small, dim, and moving, so detail is
 * wasted and anything fussy turns to mush on a projector. `currentColor`
 * throughout, so one rule in the stylesheet tints the lot.
 */
const MOTIFS = {
  skull: `
    <path d="M12 1.6A8.4 8.4 0 0 0 3.6 10v3.3c0 1.3.8 2.4 2 2.9v2.6a1.6 1.6 0 0 0 1.6 1.6h1.5v-2.6h1.7v2.6h3.2v-2.6h1.7v2.6h1.5a1.6 1.6 0 0 0 1.6-1.6v-2.6c1.2-.5 2-1.6 2-2.9V10A8.4 8.4 0 0 0 12 1.6z"/>
    <circle cx="8.6" cy="10.4" r="2.3" fill="#000" opacity=".55"/>
    <circle cx="15.4" cy="10.4" r="2.3" fill="#000" opacity=".55"/>
    <path d="M12 12.6l1.4 2.6h-2.8z" fill="#000" opacity=".55"/>`,
  ghost: `
    <path d="M12 1.8A7.4 7.4 0 0 0 4.6 9.2v12l2.4-1.9 2.5 1.9 2.5-1.9 2.5 1.9 2.4-1.9V9.2A7.4 7.4 0 0 0 12 1.8z"/>
    <circle cx="9.3" cy="9" r="1.5" fill="#000" opacity=".55"/>
    <circle cx="14.7" cy="9" r="1.5" fill="#000" opacity=".55"/>`,
  bat: `
    <path d="M12 8.4c-1.3 0-2.2 1-2.2 2.2 0-2.4-2.3-4.6-4.8-4.6.9 1.2.7 2.6 0 3.5 1.9 0 2.4 1.6 2.4 3-1.4-.7-3.4.5-4.6 2.2 3-.6 4.8.6 6 2.4.8-1.7 2-2.4 3.2-2.4s2.4.7 3.2 2.4c1.2-1.8 3-3 6-2.4-1.2-1.7-3.2-2.9-4.6-2.2 0-1.4.5-3 2.4-3-.7-.9-.9-2.3 0-3.5-2.5 0-4.8 2.2-4.8 4.6 0-1.2-.9-2.2-2.2-2.2z"/>`,
  pumpkin: `
    <path d="M11.2 4.6c0-1.4.5-2.3 2-2.6l.3 1.5c-.6.2-.8.5-.8 1.1z"/>
    <ellipse cx="12" cy="14" rx="9" ry="7.4"/>
    <path d="M8.6 7.2c-1.6 1.8-1.6 11.6 0 13.4M15.4 7.2c1.6 1.8 1.6 11.6 0 13.4" fill="none" stroke="#000" stroke-opacity=".38" stroke-width="1.1"/>`,
  heart: `
    <path d="M12 21.4s-8.2-5.3-10.2-9.8A5.9 5.9 0 0 1 12 5.4a5.9 5.9 0 0 1 10.2 6.2c-2 4.5-10.2 9.8-10.2 9.8z"/>`,
  'heart-open': `
    <path d="M12 21.4s-8.2-5.3-10.2-9.8A5.9 5.9 0 0 1 12 5.4a5.9 5.9 0 0 1 10.2 6.2c-2 4.5-10.2 9.8-10.2 9.8z"
          fill="none" stroke="currentColor" stroke-width="1.8"/>`,
  tree: `
    <path d="M12 1.8 6.6 9h3L5.4 15.4h4.2L4.8 21h14.4l-4.8-5.6h4.2L14.4 9h3z"/>
    <rect x="10.7" y="20.6" width="2.6" height="2.6"/>`,
  snowflake: `
    <g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
      <path d="M12 2v20M3.3 7l17.4 10M20.7 7 3.3 17"/>
      <path d="M12 6.2 9.6 4M12 6.2 14.4 4M12 17.8 9.6 20M12 17.8l2.4 2.2"/>
      <path d="m6.6 8.6-3.2.2M17.4 15.4l3.2-.2M6.6 15.4l-3.2-.2M17.4 8.6l3.2.2"/>
    </g>`,
  bauble: `
    <rect x="10.6" y="1.8" width="2.8" height="2.6" rx="0.6"/>
    <path d="M9.4 4.4h5.2v1.8H9.4z"/>
    <circle cx="12" cy="14" r="7.8"/>
    <path d="M4.6 11.4h14.8M4.6 16.6h14.8" fill="none" stroke="#000" stroke-opacity=".33" stroke-width="1.2"/>`,
  sun: `
    <circle cx="12" cy="12" r="5.4"/>
    <g stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
      <path d="M12 1.6v3M12 19.4v3M1.6 12h3M19.4 12h3M4.7 4.7l2.1 2.1M17.2 17.2l2.1 2.1M19.3 4.7l-2.1 2.1M6.8 17.2l-2.1 2.1"/>
    </g>`,
  palm: `
    <path d="M11 9.4c.6 4 .3 8.4-1.4 12.6h3.2c.7-4.2.6-8.6-.2-12.6z"/>
    <path d="M12 8.4C9.6 5.6 6.2 5 3.4 7c2.6-.4 5.2.4 7 2.4zM12 8.4c2.4-2.8 5.8-3.4 8.6-1.4-2.6-.4-5.2.4-7 2.4zM12 8.4C11 5 8.6 2.8 5.6 2.8c2.2 1 3.8 3 4.4 5.6zM12 8.4c1-3.4 3.4-5.6 6.4-5.6-2.2 1-3.8 3-4.4 5.6z"/>`,
  shades: `
    <path d="M2.4 8.6h19.2v2.2h-2.2c0 3.4-1.8 5.6-4.4 5.6-2.2 0-3.4-1.4-3.8-3.6h-.4c-.4 2.2-1.6 3.6-3.8 3.6-2.6 0-4.4-2.2-4.4-5.6H2.4z"/>`,
  firework: `
    <g stroke="currentColor" stroke-width="1.7" stroke-linecap="round" fill="none">
      <path d="M12 2.2v5M12 16.8v5M2.2 12h5M16.8 12h5"/>
      <path d="m5.1 5.1 3.5 3.5M15.4 15.4l3.5 3.5M18.9 5.1l-3.5 3.5M8.6 15.4l-3.5 3.5"/>
    </g>
    <circle cx="12" cy="12" r="2.6"/>`,
  clock: `
    <circle cx="12" cy="12" r="9.4" fill="none" stroke="currentColor" stroke-width="1.8"/>
    <path d="M12 6.4V12l4 2.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`,
  star: `
    <path d="M12 1.8 14.9 9h7.3l-5.9 4.5 2.2 7.3L12 16.4l-6.5 4.4 2.2-7.3L1.8 9h7.3z"/>`,
  sparkler: `
    <path d="M9.4 21.6 7.8 20l7.4-7.4 1.6 1.6z"/>
    <g stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none">
      <path d="M17.6 3.2v4M17.6 12.4v-1.6M12.6 8.2h4M22.6 8.2h-1.8"/>
      <path d="m14.4 5 2 2M20.8 11.4l-1.2-1.2M20.8 5l-2 2M14.4 11.4l1.2-1.2"/>
    </g>
    <circle cx="17.6" cy="8.2" r="1.8"/>`,
  egg: `
    <path d="M12 2.2c4.2 0 7 5.4 7 10.2S16 21.8 12 21.8 5 17.2 5 12.4 7.8 2.2 12 2.2z"/>
    <path d="M5.6 10.4c4.4 2 8.4 2 12.8 0M5.2 15.2c4.6 2.2 9 2.2 13.6 0"
          fill="none" stroke="#000" stroke-opacity=".35" stroke-width="1.4"/>`,
  bunny: `
    <path d="M8.6 11.4C7 8.6 6.4 4.4 7.6 2.4c.8-1.4 2.2-1 2.6.6.6 2.4.6 6 .2 8.4zM15.4 11.4c1.6-2.8 2.2-7 1-9-.8-1.4-2.2-1-2.6.6-.6 2.4-.6 6-.2 8.4z"/>
    <circle cx="12" cy="16.4" r="5.4"/>
    <circle cx="9.9" cy="15.4" r="1" fill="#000" opacity=".5"/>
    <circle cx="14.1" cy="15.4" r="1" fill="#000" opacity=".5"/>`,
  chick: `
    <circle cx="12" cy="14" r="6.6"/>
    <circle cx="12" cy="7.2" r="4.2"/>
    <path d="M12 7.4 15.6 8.6 12 9.8z" fill="#000" opacity=".45"/>
    <circle cx="10.4" cy="6.4" r=".9" fill="#000" opacity=".5"/>`,
  daffodil: `
    <path d="M12 12.6c-2.6 0-4.6-1.4-4.6-3.2S9.4 6.2 12 6.2s4.6 1.4 4.6 3.2-2 3.2-4.6 3.2z" opacity=".9"/>
    <path d="M12 4.2c1.6 0 2.8 1 2.8 2.2S13.6 8.6 12 8.6 9.2 7.6 9.2 6.4 10.4 4.2 12 4.2zM6 7.6c1.2-1 2.8-1 3.6-.2s.4 2.2-.8 3-2.8 1-3.6.2-.4-2.2.8-3zM18 7.6c-1.2-1-2.8-1-3.6-.2s-.4 2.2.8 3 2.8 1 3.6.2.4-2.2-.8-3z"/>
    <ellipse cx="12" cy="10.6" rx="2.4" ry="2" fill="#000" opacity=".3"/>
    <path d="M11.2 12.6h1.6v9h-1.6z"/>`,
  shamrock: `
    <path d="M12 12.4c-1.8-1.6-4.6-1.4-5.4.4-.8 1.8 1 3.6 3 3.4 1.6-.2 2.4-2 2.4-3.8zM12 12.4c1.8-1.6 4.6-1.4 5.4.4.8 1.8-1 3.6-3 3.4-1.6-.2-2.4-2-2.4-3.8zM12 12.4c-1.6-1.8-1.4-4.6.4-5.4 1.8-.8 3.6 1 3.4 3-.2 1.6-2 2.4-3.8 2.4z"/>
    <path d="M11.4 13.4c-.4 3 .4 6 2.4 8.2-2.8-1.2-4-4.6-3.6-8.2z"/>`,
  pint: `
    <path d="M6.4 8.6h9.2v12.2a1.4 1.4 0 0 1-1.4 1.4H7.8a1.4 1.4 0 0 1-1.4-1.4z"/>
    <path d="M15.6 10.4h1.8a2.6 2.6 0 0 1 0 5.2h-1.8z" fill="none" stroke="currentColor" stroke-width="1.6"/>
    <path d="M6 5.6c.6-1.6 2-2 2.8-1.2.6-1.6 2.6-1.8 3.4-.4.8-1.2 2.6-1 3 .6.8-.2 1.6.4 1.6 1.4v3H6z"/>`,
  horseshoe: `
    <path d="M12 2.6c4.6 0 7.6 3.6 7.6 8.4 0 4-1.8 7.2-4 9.6l-2.4-2c1.8-1.8 3.2-4.4 3.2-7.4 0-3-1.6-5.2-4.4-5.2S7.6 8.2 7.6 11.2c0 3 1.4 5.6 3.2 7.4l-2.4 2c-2.2-2.4-4-5.6-4-9.6 0-4.8 3-8.4 7.6-8.4z"/>`,
};

/** One motif as a complete `<svg>`, ready to drop into a page. */
export function motifSvg(name, size = 40) {
  const shape = MOTIFS[name];
  if (!shape) return '';
  return `<svg class="motif-svg" viewBox="0 0 24 24" width="${size}" height="${size}"
    fill="currentColor" aria-hidden="true" focusable="false">${shape}</svg>`;
}

/**
 * Sprinkle the shapes down the two side margins, and nowhere else.
 *
 * The positions come from the INDEX rather than from `Math.random`, so the same
 * look is the same picture every time it goes up — a projector that rearranges
 * itself every time the phase changes reads as a fault, and a Redo mid-gig
 * should not redecorate the room.
 *
 * @param {HTMLElement} host   gets a `.look-layer` child, replaced each call
 * @param {string} lookId
 * @param {object} [opts]
 * @param {number} [opts.count]  how many, in total, across both sides
 * @param {number} [opts.size]   pixels
 */
export function paintLook(host, lookId, { count = 12, size = 76 } = {}) {
  if (!host) return;
  const look = findLook(lookId);
  const existing = host.querySelector('.look-layer');

  if (!look.motifs.length) {
    if (existing) existing.remove();
    return;
  }
  // Rebuilt only when the look actually changes: this is called on every state
  // push, and restarting a dozen CSS animations sixty times a night would make
  // the decoration twitch every time somebody answered.
  if (existing && existing.dataset.look === look.id) return;
  if (existing) existing.remove();

  const layer = document.createElement('div');
  layer.className = 'look-layer';
  layer.dataset.look = look.id;

  /*
   * Down the two margins, evenly, and out of both corners.
   *
   * Spaced along each side rather than scattered by an arithmetic trick — the
   * trick put four of them in a heap in the bottom left and left half the
   * screen bare, which reads as something having gone wrong rather than as
   * decoration. Even down the side, offset between the two sides so it is not
   * a pair of matching columns.
   *
   * The band is 8% to 88% of the height: at the very top a shape sits behind
   * the logo and the countdown, and at the very bottom it is half off screen.
   */
  const perSide = Math.ceil(count / 2);
  const gap = perSide > 1 ? 80 / (perSide - 1) : 0;

  for (let i = 0; i < count; i++) {
    // First half down the left, second half down the right — NOT alternating.
    // Alternating meant the side and the shape both stepped in twos, so a
    // four-shape look put trees and baubles down one side and nothing but
    // snowflakes down the other.
    const left = i < perSide;
    const nth = i % perSide;
    const motif = look.motifs[i % look.motifs.length];
    const down = 8 + nth * gap + (left ? 0 : gap / 2);
    const across = 1.2 + ((i * 23) % 5);
    const scale = 0.7 + ((i * 13) % 7) / 10;
    const item = document.createElement('span');
    item.className = `motif ${left ? 'left' : 'right'}`;
    item.style.cssText = [
      `top:${down}%`,
      `${left ? 'left' : 'right'}:${across}%`,
      `--scale:${scale.toFixed(2)}`,
      `--drift:${18 + (i % 5) * 4}s`,
      `--delay:-${i * 1.7}s`,
    ].join(';');
    item.innerHTML = motifSvg(motif, size);
    layer.appendChild(item);
  }

  host.appendChild(layer);
}
