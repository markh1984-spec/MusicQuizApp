/**
 * A face for everybody, whether or not they sent a photo.
 *
 * The big screen puts the fastest finger's face up on the reveal. Most of the
 * room will never open the camera, so without this the feature would work for
 * about one player in ten and look broken for the rest — a slot that is
 * sometimes a person and sometimes a gap reads as a fault, not as a feature.
 *
 * So everybody has one from the moment they join, drawn from their own team
 * name. No upload, nothing to set up, nothing to go wrong on pub wifi.
 *
 * **Deterministic, and that is the point.** The same name always draws the same
 * face, so "the green one with the moustache" is that team all night — on the
 * reveal, after a restart, on a projector that reconnected. A random face each
 * time would be worse than none, because the room would think it meant
 * something.
 *
 * **Drawn, never emoji** — the same rule as the bin icon, the seasonal shapes
 * and the photo props. Some phones and some projectors render a face as
 * something else entirely, and this one is six feet wide.
 *
 * Deliberately a cartoon and not an attempt at anybody: it sits next to real
 * photographs of real people in the room, and it must never read as a guess at
 * what somebody looks like.
 */

/**
 * A small, stable hash of the name.
 *
 * Written out rather than reaching for anything, and kept to 32 bits so the
 * arithmetic is exact — the whole value of this file is that the same name
 * gives the same face on every device in the building.
 */
function seedOf(name) {
  let n = 2166136261;
  for (const ch of String(name)) {
    n ^= ch.codePointAt(0);
    n = Math.imul(n, 16777619) >>> 0;
  }
  return n || 7;
}

/** A deterministic 0..1 from the seed and a slot number. */
function pick(seed, slot) {
  const x = Math.sin((seed % 100000) * (slot + 1) * 0.618) * 10000;
  return x - Math.floor(x);
}

const SKINS = ['#f0c9a4', '#e0a875', '#c68642', '#8d5524', '#5c3317', '#ffdbb4'];
const HAIRS = ['#2a1d12', '#5a3418', '#a8703c', '#d9b26a', '#c0c0c8', '#e8123c', '#2b6cff', '#1a1a22'];
const BACKS = ['#2b6cff', '#e8123c', '#ff2e88', '#00b884', '#ff8a3d', '#8b5cf6', '#14b8c4', '#d4a017'];

/**
 * The face, as an SVG string on a 100x100 grid.
 *
 * Every feature is chosen off its own slot of the seed, so two names that
 * happen to share a hair colour still differ everywhere else. With eight backs,
 * six skins, eight hairs and several each of the rest there is no realistic
 * chance of a collision in a room of three hundred — and even then it is a
 * decoration, not a name badge, and the name is written beside it.
 */
export function avatarSvg(name, { size = 240 } = {}) {
  const seed = seedOf(name);
  const at = (slot, list) => list[Math.floor(pick(seed, slot) * list.length) % list.length];

  const back = at(1, BACKS);
  const skin = at(2, SKINS);
  const hair = at(3, HAIRS);
  const style = Math.floor(pick(seed, 4) * 5);      // hair shape
  const eyes = Math.floor(pick(seed, 5) * 4);
  const mouth = Math.floor(pick(seed, 6) * 4);
  const extra = Math.floor(pick(seed, 7) * 5);      // glasses, moustache, or nothing

  const hairShapes = [
    `<path d="M18 44c0-20 14-30 32-30s32 10 32 30c0-6-4-12-10-14-6 6-16 8-26 6-8-2-14-6-18-10-6 4-10 10-10 18z" fill="${hair}"/>`,
    `<path d="M16 46C16 22 30 12 50 12s34 10 34 34c0 4-4 4-4 0 0-14-10-22-30-22s-30 8-30 22c0 4-4 4-4 0z" fill="${hair}"/>`,
    `<path d="M20 42c2-18 14-28 30-28s28 10 30 28c1 8-3 10-4 4-2-10-6-16-12-14-4 8-24 12-32 4-4 4-6 8-7 14-1 6-6 4-5-8z" fill="${hair}"/>
     <ellipse cx="24" cy="52" rx="7" ry="12" fill="${hair}"/><ellipse cx="76" cy="52" rx="7" ry="12" fill="${hair}"/>`,
    `<path d="M22 40c4-16 14-26 28-26s24 10 28 26c-8-8-16-12-28-12s-20 4-28 12z" fill="${hair}"/>`,
    `<path d="M50 10c18 0 30 12 30 30h-6c0-16-10-24-24-24s-24 8-24 24h-6c0-18 12-30 30-30z" fill="${hair}"/>`,
  ];
  const eyeShapes = [
    `<circle cx="38" cy="50" r="4.5" fill="#1a1a22"/><circle cx="62" cy="50" r="4.5" fill="#1a1a22"/>`,
    `<ellipse cx="38" cy="50" rx="5" ry="6.5" fill="#fff"/><ellipse cx="62" cy="50" rx="5" ry="6.5" fill="#fff"/>
     <circle cx="38" cy="51" r="3" fill="#1a1a22"/><circle cx="62" cy="51" r="3" fill="#1a1a22"/>`,
    `<path d="M32 50q6-6 12 0" stroke="#1a1a22" stroke-width="3.5" fill="none" stroke-linecap="round"/>
     <path d="M56 50q6-6 12 0" stroke="#1a1a22" stroke-width="3.5" fill="none" stroke-linecap="round"/>`,
    `<circle cx="38" cy="50" r="5.5" fill="#fff"/><circle cx="62" cy="50" r="5.5" fill="#fff"/>
     <circle cx="39" cy="50" r="2.6" fill="#1a1a22"/><circle cx="63" cy="50" r="2.6" fill="#1a1a22"/>`,
  ];
  const mouthShapes = [
    `<path d="M40 68q10 10 20 0" stroke="#8a3324" stroke-width="4" fill="none" stroke-linecap="round"/>`,
    `<ellipse cx="50" cy="69" rx="8" ry="6" fill="#8a3324"/>`,
    `<path d="M40 70h20" stroke="#8a3324" stroke-width="4" stroke-linecap="round"/>`,
    `<path d="M38 66q12 14 24 0q-12 5-24 0z" fill="#8a3324"/>`,
  ];
  const extras = [
    '',
    '',
    `<path d="M26 48h20v10H26zM54 48h20v10H54zM46 52h8" stroke="#1a1a22" stroke-width="3" fill="none"/>`,
    `<path d="M50 64c3-4 8-6 13-6 5 0 9 3 9 6 0 4-5 6-10 6-5 0-9-2-12-5-3 3-7 5-12 5-5 0-10-2-10-6 0-3 4-6 9-6 5 0 10 2 13 6z" fill="${hair}"/>`,
    `<path d="M50 12 58 4l4 10z" fill="#ffd23f"/>`,
  ];

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-label="${escapeXml(name)}">
  <rect width="100" height="100" rx="14" fill="${back}"/>
  <circle cx="50" cy="92" r="34" fill="rgba(0,0,0,0.18)"/>
  <ellipse cx="50" cy="54" rx="30" ry="34" fill="${skin}"/>
  <ellipse cx="20" cy="56" rx="4" ry="6" fill="${skin}"/>
  <ellipse cx="80" cy="56" rx="4" ry="6" fill="${skin}"/>
  ${hairShapes[style]}
  ${eyeShapes[eyes]}
  ${mouthShapes[mouth]}
  ${extras[extra]}
</svg>`;
}

/** The same face as a data URL, for an `<img src>`. */
export function avatarUrl(name, opts) {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(avatarSvg(name, opts));
}

/**
 * The face to put beside somebody's name: their own photo, or a drawn one.
 *
 * Their most recent picture from tonight, because people send several and the
 * latest is the one they meant. Falls back to the drawn face, so **there is
 * always something** — a slot that is sometimes a person and sometimes a gap
 * reads as a fault rather than as a feature, and most of the room never opens
 * the camera.
 *
 * **Matched on identity, NEVER on the name.** Two teams picking the same name
 * is a thing that happens on a real night — there is deliberately no name
 * filter — and the wrong person's photograph six feet wide is not a small
 * mistake. A photo with no key attached matches nobody rather than falling
 * back to the name.
 *
 * **The key is `faceKey`, not the player id, and that is a security fix rather
 * than a rename.** A player id is a bearer credential — there is no login for
 * a phone, so holding the id is enough to answer as that player or rename
 * them — and this payload goes to anyone with the join code, which is printed
 * on the projector. Publishing the fastest finger's id meant the person
 * winning was the person the room could sabotage. `faceKey` is derived one way
 * from the id: it matches just as well and gives nothing back.
 *
 * Lives here rather than in `screen.js` so it can be tested without a browser.
 */
export function faceFor(photos, { faceKey = '', name = '' } = {}) {
  let best = null;
  for (const p of photos || []) {
    if (!p || !p.faceKey || !faceKey || p.faceKey !== faceKey) continue;
    if (!best || (p.at || 0) > (best.at || 0)) best = p;
  }
  return best && best.url ? best.url : avatarUrl(name);
}

function escapeXml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]
  ));
}
