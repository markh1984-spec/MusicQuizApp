/**
 * Props to stick on a photo: dog ears, a clown nose, a party hat.
 *
 * This is what "filters" was always meant to be. `filters.js` does colour
 * grading — black and white, warm, cold — which is a different thing entirely
 * and not the funny one.
 *
 * **No face detection anywhere in here, on purpose.** Real face tracking needs
 * either a model that is megabytes to download and heavy on an old phone, or
 * `FaceDetector`, which iOS Safari does not have. Both break "no dependencies"
 * and both fail on somebody's phone in a room. So the props are DRAGGED: tap
 * one, drag it where you want it, pinch to size it. It works on every phone
 * ever made, and people putting the ears on deliberately wrong is funnier than
 * a machine putting them on correctly.
 *
 * The shapes are drawn rather than emoji, same rule as the bin icon and the
 * seasonal looks: every phone renders an emoji differently and some of them
 * render a clown as something upsetting.
 */

/** 100x100 each, so one number scales them all. */
const ART = {
  'dog-ears': `
    <path d="M14 6C4 14 2 40 10 58c6 13 16 12 18 2C30 48 26 18 14 6z" fill="#7a4a22"/>
    <path d="M17 16C11 22 10 40 15 52c3 7 8 7 9 1 1-8-1-28-7-37z" fill="#a8703c"/>
    <path d="M86 6c10 8 12 34 4 52-6 13-16 12-18 2-2-12 2-42 14-54z" fill="#7a4a22"/>
    <path d="M83 16c6 6 7 24 2 36-3 7-8 7-9 1-1-8 1-28 7-37z" fill="#a8703c"/>`,
  'clown-nose': `
    <circle cx="50" cy="50" r="38" fill="#e8123c"/>
    <circle cx="50" cy="50" r="38" fill="none" stroke="#a10c29" stroke-width="4"/>
    <ellipse cx="37" cy="35" rx="12" ry="8" fill="#fff" opacity=".45" transform="rotate(-25 37 35)"/>`,
  'sunglasses': `
    <path d="M4 30h92v10H88c0 18-9 28-22 28-11 0-17-7-19-18h-6c-2 11-8 18-19 18-13 0-22-10-22-28H4z" fill="#141420"/>
    <path d="M14 40h26c0 12-5 18-13 18s-13-6-13-18zM60 40h26c0 12-5 18-13 18s-13-6-13-18z" fill="#2b6cff" opacity=".5"/>`,
  'moustache': `
    <path d="M50 44c6-8 16-14 27-14 12 0 21 7 21 16 0 11-11 18-24 18-10 0-18-4-24-11-6 7-14 11-24 11C13 64 2 57 2 46c0-9 9-16 21-16 11 0 21 6 27 14z" fill="#2a1d12"/>`,
  'party-hat': `
    <path d="M50 4 84 84H16z" fill="#ff2e88"/>
    <path d="M50 4 66 42 34 60z" fill="#ffd23f" opacity=".85"/>
    <path d="M16 84h68v8H16z" fill="#4bd8ff"/>
    <circle cx="50" cy="6" r="9" fill="#ffd23f"/>`,
  'crown': `
    <path d="M8 74 4 26l24 18L50 14l22 30 24-18-4 48z" fill="#ffd23f"/>
    <path d="M8 74h84v12H8z" fill="#e0a800"/>
    <circle cx="50" cy="46" r="7" fill="#e8123c"/>
    <circle cx="22" cy="54" r="5" fill="#2b6cff"/>
    <circle cx="78" cy="54" r="5" fill="#2b6cff"/>`,
  'devil-horns': `
    <path d="M8 76C2 52 8 24 26 10c2 16-4 26-4 42 0 10 2 18 4 24z" fill="#e8123c"/>
    <path d="M92 76c6-24 0-52-18-66-2 16 4 26 4 42 0 10-2 18-4 24z" fill="#e8123c"/>`,
  'hearts': `
    <path d="M32 62S10 48 10 32a12 12 0 0 1 22-7 12 12 0 0 1 22 7c0 16-22 30-22 30z" fill="#ff2e88"/>
    <path d="M72 88S56 78 56 66a9 9 0 0 1 16-5 9 9 0 0 1 16 5c0 12-16 22-16 22z" fill="#ff6bd6"/>`,
  'tache-glasses': `
    <path d="M6 22h88v8H86c0 14-7 22-17 22-9 0-14-6-15-14h-8c-1 8-6 14-15 14-10 0-17-8-17-22H6z" fill="#141420"/>
    <path d="M50 74c5-6 13-11 21-11 9 0 16 5 16 12 0 8-8 13-18 13-8 0-14-3-19-8-5 5-11 8-19 8-10 0-18-5-18-13 0-7 7-12 16-12 8 0 16 5 21 11z" fill="#2a1d12"/>`,
  // The pupils point in DIFFERENT directions on purpose — two eyes agreeing
  // with each other is a face, and two that do not is the joke.
  'googly-eyes': `
    <circle cx="29" cy="50" r="25" fill="#fff" stroke="#141420" stroke-width="4"/>
    <circle cx="71" cy="50" r="25" fill="#fff" stroke="#141420" stroke-width="4"/>
    <circle cx="22" cy="59" r="11" fill="#141420"/>
    <circle cx="78" cy="42" r="11" fill="#141420"/>`,
  'eyepatch': `
    <path d="M2 26 98 16" stroke="#141420" stroke-width="8" fill="none" stroke-linecap="round"/>
    <ellipse cx="50" cy="58" rx="31" ry="27" fill="#141420"/>
    <ellipse cx="40" cy="48" rx="9" ry="6" fill="#3a3a48" transform="rotate(-25 40 48)"/>`,
  'top-hat': `
    <ellipse cx="50" cy="80" rx="47" ry="11" fill="#141420"/>
    <path d="M26 16h48v66H26z" fill="#1c1c2a"/>
    <path d="M26 58h48v13H26z" fill="#e8123c"/>
    <ellipse cx="50" cy="16" rx="24" ry="6" fill="#2c2c3e"/>`,
  'cowboy-hat': `
    <path d="M2 68c14-11 30-7 48-7s34-4 48 7c-11 12-30 17-48 17S13 80 2 68z" fill="#8a5a2b"/>
    <path d="M30 64c-3-24 6-46 20-46s23 22 20 46c-12 5-28 5-40 0z" fill="#a06b33"/>
    <path d="M28 56c13 6 31 6 44 0l2 9c-15 6-33 6-48 0z" fill="#5c3a1a"/>`,
  'bunny-ears': `
    <path d="M33 94C23 71 17 40 23 18c3-12 13-12 16 0 5 23 5 54 2 76z" fill="#f2f2f7"/>
    <path d="M32 81c-6-17-9-39-5-55 2-8 6-8 8 0 3 16 3 39 0 55z" fill="#ff9ec7"/>
    <path d="M67 94c10-23 16-54 10-76-3-12-13-12-16 0-5 23-5 54-2 76z" fill="#f2f2f7"/>
    <path d="M68 81c6-17 9-39 5-55-2-8-6-8-8 0-3 16-3 39 0 55z" fill="#ff9ec7"/>`,
  // A GAP DOWN THE MIDDLE. The first version had the two triangles meeting at
  // the centre, which reads as a bow tie rather than as ears.
  'cat-ears': `
    <path d="M4 84 21 8l25 64z" fill="#3a3a48"/>
    <path d="M16 70 23 30l14 36z" fill="#ff9ec7"/>
    <path d="M96 84 79 8 54 72z" fill="#3a3a48"/>
    <path d="M84 70 77 30 63 66z" fill="#ff9ec7"/>`,
  'unicorn-horn': `
    <path d="M50 4 67 90H33z" fill="#ffd23f"/>
    <path d="M39 72h22M42 55h16M45 38h10" stroke="#e0a800" stroke-width="5" fill="none" stroke-linecap="round"/>`,
  'beard': `
    <path d="M13 16s11 9 37 9 37-9 37-9c4 27 0 52-12 66-8 10-17 13-25 13s-17-3-25-13C13 68 9 43 13 16z" fill="#5a3a1e"/>
    <path d="M34 25c9 2 23 2 32 0 3 19 0 36-8 46-4 6-8 8-8 8s-4-2-8-8c-8-10-11-27-8-46z" fill="#6f4a28"/>`,
  'halo': `
    <ellipse cx="50" cy="50" rx="42" ry="16" fill="none" stroke="#ffd23f" stroke-width="11"/>
    <ellipse cx="50" cy="50" rx="42" ry="16" fill="none" stroke="#fff3b0" stroke-width="4"/>`,
  'clown-hair': `
    <circle cx="16" cy="34" r="15" fill="#e8123c"/>
    <circle cx="28" cy="18" r="12" fill="#ff3d5a"/>
    <circle cx="10" cy="56" r="13" fill="#ff3d5a"/>
    <circle cx="24" cy="46" r="11" fill="#e8123c"/>
    <circle cx="84" cy="34" r="15" fill="#e8123c"/>
    <circle cx="72" cy="18" r="12" fill="#ff3d5a"/>
    <circle cx="90" cy="56" r="13" fill="#ff3d5a"/>
    <circle cx="76" cy="46" r="11" fill="#e8123c"/>`,
  'buck-teeth': `
    <path d="M18 8h64v12H18z" fill="#d4677f"/>
    <path d="M28 20h44v44a10 10 0 0 1-10 10H38a10 10 0 0 1-10-10z" fill="#fff"/>
    <path d="M50 20v54" stroke="#cfcfd8" stroke-width="4"/>
    <path d="M28 20h44v44a10 10 0 0 1-10 10H38a10 10 0 0 1-10-10z" fill="none" stroke="#cfcfd8" stroke-width="3"/>`,
  'pig-snout': `
    <ellipse cx="50" cy="50" rx="40" ry="32" fill="#ffa8c4"/>
    <ellipse cx="50" cy="50" rx="40" ry="32" fill="none" stroke="#e07a9c" stroke-width="4"/>
    <ellipse cx="36" cy="50" rx="8" ry="13" fill="#c25a7c"/>
    <ellipse cx="64" cy="50" rx="8" ry="13" fill="#c25a7c"/>`,
  'monobrow': `
    <path d="M4 62c6-22 24-34 46-34s40 12 46 34c-12-14-28-20-46-20S16 48 4 62z" fill="#2a1d12"/>`,
  'tongue': `
    <path d="M50 4c22 0 34 14 34 34 0 24-14 58-34 58S16 62 16 38C16 18 28 4 50 4z" fill="#e8506e"/>
    <path d="M50 40c8 0 12 6 12 14 0 12-6 30-12 30s-12-18-12-30c0-8 4-14 12-14z" fill="#c23a56"/>`,
  'love-glasses': `
    <path d="M2 30h96v7H2z" fill="#ff2e88"/>
    <path d="M27 72S7 58 7 42a11 11 0 0 1 20-6 11 11 0 0 1 20 6c0 16-20 30-20 30z" fill="#ff2e88"/>
    <path d="M73 72S53 58 53 42a11 11 0 0 1 20-6 11 11 0 0 1 20 6c0 16-20 30-20 30z" fill="#ff2e88"/>`,
};

export const STICKERS = [
  { id: 'dog-ears', label: 'Dog ears' },
  { id: 'clown-nose', label: 'Clown nose' },
  { id: 'sunglasses', label: 'Shades' },
  { id: 'moustache', label: 'Moustache' },
  { id: 'party-hat', label: 'Party hat' },
  { id: 'crown', label: 'Crown' },
  { id: 'devil-horns', label: 'Horns' },
  { id: 'hearts', label: 'Hearts' },
  { id: 'tache-glasses', label: 'Disguise' },
  { id: 'googly-eyes', label: 'Googly eyes' },
  { id: 'eyepatch', label: 'Eyepatch' },
  { id: 'top-hat', label: 'Top hat' },
  { id: 'cowboy-hat', label: 'Cowboy hat' },
  { id: 'bunny-ears', label: 'Bunny ears' },
  { id: 'cat-ears', label: 'Cat ears' },
  { id: 'unicorn-horn', label: 'Unicorn horn' },
  { id: 'beard', label: 'Beard' },
  { id: 'halo', label: 'Halo' },
  { id: 'clown-hair', label: 'Clown hair' },
  { id: 'buck-teeth', label: 'Buck teeth' },
  { id: 'pig-snout', label: 'Pig snout' },
  { id: 'monobrow', label: 'Monobrow' },
  { id: 'tongue', label: 'Tongue' },
  { id: 'love-glasses', label: 'Love hearts' },
];

export function stickerSvg(id) {
  const art = ART[id];
  if (!art) return '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">${art}</svg>`;
}

/**
 * The prop as an Image, ready to draw onto a canvas.
 *
 * A data: URL rather than a file, so nothing is fetched and — the part that
 * matters — the canvas is never tainted, which would stop the photo being
 * turned into a JPEG at all.
 *
 * Cached, because dragging one redraws every frame.
 */
const loaded = new Map();

export function stickerImage(id) {
  if (loaded.has(id)) return loaded.get(id);
  const promise = new Promise((resolve, reject) => {
    const svg = stickerSvg(id);
    if (!svg) return reject(new Error(`No sticker called ${id}`));
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not draw ${id}`));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
  loaded.set(id, promise);
  return promise;
}

/** Get every prop loaded before the sheet opens, so a tap is instant. */
export function preloadStickers() {
  return Promise.all(STICKERS.map((s) => stickerImage(s.id).catch(() => null)));
}

/**
 * Where a prop sits on a photo.
 *
 * Positions are stored as a FRACTION of the canvas, not in pixels, so the
 * preview on a 320px phone and the full-size image sent to the projector put
 * the nose in the same place. Getting that wrong is the classic version of this
 * bug: perfect on the phone, halfway down the neck on the big screen.
 */
export function placed(id, { x = 0.5, y = 0.5, size = 0.32, angle = 0 } = {}) {
  return { key: `${id}-${Math.random().toString(36).slice(2, 8)}`, id, x, y, size, angle };
}

/**
 * Draw the props onto a canvas that already has the photo on it.
 *
 * Used by the preview AND by the upload, so what they see is exactly what the
 * room gets — the same reason the colour filters share one function.
 */
export async function drawStickers(canvas, items) {
  if (!items || !items.length) return;
  const ctx = canvas.getContext('2d');
  for (const item of items) {
    let img;
    try {
      img = await stickerImage(item.id);
    } catch {
      continue; // a prop that will not draw is skipped, not a broken upload
    }
    const side = item.size * Math.min(canvas.width, canvas.height) * 2;
    ctx.save();
    ctx.translate(item.x * canvas.width, item.y * canvas.height);
    ctx.rotate(item.angle || 0);
    ctx.drawImage(img, -side / 2, -side / 2, side, side);
    ctx.restore();
  }
}

/**
 * Which prop is under a tap, topmost first.
 *
 * Topmost matters: props overlap, and the one you can see is the one you meant.
 */
export function stickerAt(items, x, y, canvas) {
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    const side = item.size * Math.min(canvas.width, canvas.height) * 2;
    const half = side / 2 / canvas.width;
    const halfY = side / 2 / canvas.height;
    if (Math.abs(x - item.x) <= half && Math.abs(y - item.y) <= halfY) return item;
  }
  return null;
}
