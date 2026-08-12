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
    <path d="M18 10C8 18 7 42 14 58c5 12 15 12 17 2C33 48 29 20 18 10z" fill="#fff" stroke="#fff" stroke-width="11" stroke-linejoin="round"/>
    <path d="M82 10c10 8 11 32 4 48-5 12-15 12-17 2-2-12 2-40 13-50z" fill="#fff" stroke="#fff" stroke-width="11" stroke-linejoin="round"/>
    <path d="M18 10C8 18 7 42 14 58c5 12 15 12 17 2C33 48 29 20 18 10z" fill="#7a4a22"/>
    <path d="M21 20c-6 6-7 24-2 36 3 7 8 7 9 1 1-8-1-28-7-37z" fill="#c08a4e"/>
    <path d="M82 10c10 8 11 32 4 48-5 12-15 12-17 2-2-12 2-40 13-50z" fill="#7a4a22"/>
    <path d="M79 20c6 6 7 24 2 36-3 7-8 7-9 1-1-8 1-28 7-37z" fill="#c08a4e"/>
    <path d="M18 10C8 18 7 42 14 58c5 12 15 12 17 2C33 48 29 20 18 10z" fill="none" stroke="#43260f" stroke-width="5" stroke-linejoin="round"/>
    <path d="M82 10c10 8 11 32 4 48-5 12-15 12-17 2-2-12 2-40 13-50z" fill="none" stroke="#43260f" stroke-width="5" stroke-linejoin="round"/>`,
  'clown-nose': `
    <circle cx="50" cy="50" r="38" fill="#fff" stroke="#fff" stroke-width="11"/>
    <circle cx="50" cy="50" r="38" fill="#e8123c"/>
    <ellipse cx="63" cy="66" rx="29" ry="21" fill="#a10c29" opacity=".5" transform="rotate(-30 63 66)"/>
    <ellipse cx="36" cy="34" rx="13" ry="9" fill="#fff" opacity=".9" transform="rotate(-30 36 34)"/>
    <circle cx="50" cy="50" r="38" fill="none" stroke="#7d0a20" stroke-width="5"/>`,
  'sunglasses': `
    <rect x="11" y="28" width="78" height="10" rx="4" fill="#fff" stroke="#fff" stroke-width="11"/>
    <path d="M13 35h33c0 18-7 29-17 29s-16-11-16-29z" fill="#fff" stroke="#fff" stroke-width="11" stroke-linejoin="round"/>
    <path d="M54 35h33c0 18-6 29-16 29s-17-11-17-29z" fill="#fff" stroke="#fff" stroke-width="11" stroke-linejoin="round"/>
    <path d="M13 35h33c0 18-7 29-17 29s-16-11-16-29z" fill="#20202c"/>
    <path d="M54 35h33c0 18-6 29-16 29s-17-11-17-29z" fill="#20202c"/>
    <path d="M18 39h22c0 12-4 19-11 19s-11-7-11-19zM59 39h22c0 12-4 19-11 19s-11-7-11-19z" fill="#2b6cff" opacity=".5"/>
    <path d="M21 40h8l-5 12h-5zM62 40h8l-5 12h-5z" fill="#fff" opacity=".55"/>
    <path d="M13 35h33c0 18-7 29-17 29s-16-11-16-29z" fill="none" stroke="#0b0b12" stroke-width="5" stroke-linejoin="round"/>
    <path d="M54 35h33c0 18-6 29-16 29s-17-11-17-29z" fill="none" stroke="#0b0b12" stroke-width="5" stroke-linejoin="round"/>
    <rect x="11" y="28" width="78" height="10" rx="4" fill="#20202c" stroke="#0b0b12" stroke-width="5"/>`,
  'moustache': `
    <path d="M50 46c6-8 14-13 23-13 10 0 18 6 18 15 0 10-9 17-20 17-9 0-17-4-21-10-4 6-12 10-21 10C18 65 9 58 9 48c0-9 8-15 18-15 9 0 17 5 23 13z" fill="#fff" stroke="#fff" stroke-width="11" stroke-linejoin="round"/>
    <path d="M50 46c6-8 14-13 23-13 10 0 18 6 18 15 0 10-9 17-20 17-9 0-17-4-21-10-4 6-12 10-21 10C18 65 9 58 9 48c0-9 8-15 18-15 9 0 17 5 23 13z" fill="#3a2716"/>
    <path d="M50 46c-5-6-11-10-18-10-6 0-12 3-14 8 5-3 11-3 16 0 6 3 11 6 16 2z" fill="#5b3f24"/>
    <path d="M50 46c5-6 11-10 18-10 6 0 12 3 14 8-5-3-11-3-16 0-6 3-11 6-16 2z" fill="#5b3f24"/>
    <path d="M50 46c6-8 14-13 23-13 10 0 18 6 18 15 0 10-9 17-20 17-9 0-17-4-21-10-4 6-12 10-21 10C18 65 9 58 9 48c0-9 8-15 18-15 9 0 17 5 23 13z" fill="none" stroke="#1d1209" stroke-width="5" stroke-linejoin="round"/>`,
  // INSET FROM THE EDGE. The die-cut border adds about five units all round, so
  // a shape drawn to the viewBox edge loses its border to the crop — the
  // pompom was sitting at cy=11 with an 11-wide white stroke and came out
  // sliced flat. Every prop wants six units of headroom now.
  'party-hat': `
    <path d="M50 24 82 88H18z" fill="#fff" stroke="#fff" stroke-width="12" stroke-linejoin="round"/>
    <circle cx="50" cy="16" r="9" fill="#fff" stroke="#fff" stroke-width="10"/>
    <path d="M50 24 82 88H18z" fill="#ff2e88"/>
    <path d="M43.2 36h13.6l6.3 13H36.9z" fill="#ffd23f"/>
    <path d="M34.5 54h31l6.3 13H28.2z" fill="#4bd8ff"/>
    <path d="M23.8 76h52.4L82 88H18z" fill="#5fd35f"/>
    <path d="M50 24 64 52 46 62z" fill="#fff" opacity=".25"/>
    <path d="M50 24 82 88H18z" fill="none" stroke="#1e1e28" stroke-width="5" stroke-linejoin="round"/>
    <circle cx="50" cy="16" r="9" fill="#ffd23f" stroke="#1e1e28" stroke-width="4"/>`,
  'crown': `
    <path d="M13 72 9 28l22 17L50 17l19 28 22-17-4 44zM13 72h74v13H13z" fill="#fff" stroke="#fff" stroke-width="12" stroke-linejoin="round"/>
    <path d="M13 72 9 28l22 17L50 17l19 28 22-17-4 44z" fill="#ffd23f"/>
    <path d="M13 72 9 28l22 17L50 17v55z" fill="#ffe382"/>
    <path d="M13 72h74v13H13z" fill="#e0a800"/>
    <circle cx="50" cy="46" r="6.5" fill="#e8123c"/>
    <circle cx="25" cy="53" r="4.5" fill="#2b6cff"/>
    <circle cx="75" cy="53" r="4.5" fill="#2b6cff"/>
    <path d="M13 72 9 28l22 17L50 17l19 28 22-17-4 44zM13 72h74v13H13z" fill="none" stroke="#8a6200" stroke-width="5" stroke-linejoin="round"/>`,
  'devil-horns': `
    <path d="M12 76C6 52 12 24 30 10c2 16-4 26-4 42 0 10 2 18 4 24z" fill="#fff" stroke="#fff" stroke-width="11" stroke-linejoin="round"/>
    <path d="M88 76c6-24 0-52-18-66-2 16 4 26 4 42 0 10-2 18-4 24z" fill="#fff" stroke="#fff" stroke-width="11" stroke-linejoin="round"/>
    <path d="M12 76C6 52 12 24 30 10c2 16-4 26-4 42 0 10 2 18 4 24z" fill="#e8123c"/>
    <path d="M20 66c-4-18-1-36 9-48-1 12-4 22-4 34 0 6 1 11 2 15z" fill="#ff5470"/>
    <path d="M88 76c6-24 0-52-18-66-2 16 4 26 4 42 0 10-2 18-4 24z" fill="#e8123c"/>
    <path d="M80 66c4-18 1-36-9-48 1 12 4 22 4 34 0 6-1 11-2 15z" fill="#ff5470"/>
    <path d="M12 76C6 52 12 24 30 10c2 16-4 26-4 42 0 10 2 18 4 24z" fill="none" stroke="#7d0a20" stroke-width="5" stroke-linejoin="round"/>
    <path d="M88 76c6-24 0-52-18-66-2 16 4 26 4 42 0 10-2 18-4 24z" fill="none" stroke="#7d0a20" stroke-width="5" stroke-linejoin="round"/>`,
  'hearts': `
    <path d="M34 64S12 50 12 34a12 12 0 0 1 22-7 12 12 0 0 1 22 7c0 16-22 30-22 30z" fill="#fff" stroke="#fff" stroke-width="11" stroke-linejoin="round"/>
    <path d="M72 90S56 80 56 68a9 9 0 0 1 16-5 9 9 0 0 1 16 5c0 12-16 22-16 22z" fill="#fff" stroke="#fff" stroke-width="11" stroke-linejoin="round"/>
    <path d="M34 64S12 50 12 34a12 12 0 0 1 22-7 12 12 0 0 1 22 7c0 16-22 30-22 30z" fill="#ff2e88"/>
    <path d="M24 30c-5 0-9 4-9 9 0 7 5 14 11 20-3-8-4-16-2-22 1-4 1-7 0-7z" fill="#ff7ab8"/>
    <path d="M34 64S12 50 12 34a12 12 0 0 1 22-7 12 12 0 0 1 22 7c0 16-22 30-22 30z" fill="none" stroke="#a80b53" stroke-width="5" stroke-linejoin="round"/>
    <path d="M72 90S56 80 56 68a9 9 0 0 1 16-5 9 9 0 0 1 16 5c0 12-16 22-16 22z" fill="#ff6bd6"/>
    <path d="M72 90S56 80 56 68a9 9 0 0 1 16-5 9 9 0 0 1 16 5c0 12-16 22-16 22z" fill="none" stroke="#b0338f" stroke-width="5" stroke-linejoin="round"/>`,
  'tache-glasses': `
    <path d="M10 22h80v8h-7c0 13-7 21-16 21-8 0-13-6-14-13h-6c-1 7-6 13-14 13-9 0-16-8-16-21h-7z" fill="#fff" stroke="#fff" stroke-width="11" stroke-linejoin="round"/>
    <path d="M50 76c5-6 12-10 20-10 8 0 15 5 15 11 0 8-8 13-17 13-8 0-13-3-18-8-5 5-10 8-18 8-9 0-17-5-17-13 0-6 7-11 15-11 8 0 15 4 20 10z" fill="#fff" stroke="#fff" stroke-width="11" stroke-linejoin="round"/>
    <path d="M50 76c5-6 12-10 20-10 8 0 15 5 15 11 0 8-8 13-17 13-8 0-13-3-18-8-5 5-10 8-18 8-9 0-17-5-17-13 0-6 7-11 15-11 8 0 15 4 20 10z" fill="#3a2716"/>
    <path d="M50 76c-4-5-10-8-16-8-6 0-11 2-13 6 4-2 10-2 15 1 5 2 10 4 14 1z" fill="#5b3f24"/>
    <path d="M50 76c4-5 10-8 16-8 6 0 11 2 13 6-4-2-10-2-15 1-5 2-10 4-14 1z" fill="#5b3f24"/>
    <path d="M50 76c5-6 12-10 20-10 8 0 15 5 15 11 0 8-8 13-17 13-8 0-13-3-18-8-5 5-10 8-18 8-9 0-17-5-17-13 0-6 7-11 15-11 8 0 15 4 20 10z" fill="none" stroke="#1d1209" stroke-width="5" stroke-linejoin="round"/>
    <path d="M10 22h80v8h-7c0 13-7 21-16 21-8 0-13-6-14-13h-6c-1 7-6 13-14 13-9 0-16-8-16-21h-7z" fill="#20202c"/>
    <path d="M21 32h8l-4 10h-5z" fill="#fff" opacity=".5"/>
    <path d="M61 32h8l-4 10h-5z" fill="#fff" opacity=".5"/>
    <path d="M10 22h80v8h-7c0 13-7 21-16 21-8 0-13-6-14-13h-6c-1 7-6 13-14 13-9 0-16-8-16-21h-7z" fill="none" stroke="#0b0b12" stroke-width="5" stroke-linejoin="round"/>`,
  // The pupils point in DIFFERENT directions on purpose — two eyes agreeing
  // with each other is a face, and two that do not is the joke.
  // The pupils point in DIFFERENT directions on purpose — two eyes agreeing
  // with each other is a face, and two that do not is the joke. No eyebrows:
  // the reference sheet added a pair, but they turn this from something you
  // can stick anywhere into a face of its own.
  'googly-eyes': `
    <circle cx="29" cy="50" r="22" fill="#fff" stroke="#fff" stroke-width="11"/>
    <circle cx="71" cy="50" r="22" fill="#fff" stroke="#fff" stroke-width="11"/>
    <circle cx="29" cy="50" r="22" fill="#fff"/>
    <circle cx="71" cy="50" r="22" fill="#fff"/>
    <ellipse cx="34" cy="58" rx="16" ry="10" fill="#dfe3ec" opacity=".7"/>
    <ellipse cx="76" cy="58" rx="16" ry="10" fill="#dfe3ec" opacity=".7"/>
    <circle cx="23" cy="57" r="10" fill="#1e1e28"/>
    <circle cx="77" cy="43" r="10" fill="#1e1e28"/>
    <circle cx="19" cy="53" r="3.3" fill="#fff"/>
    <circle cx="73" cy="39" r="3.3" fill="#fff"/>
    <circle cx="29" cy="50" r="22" fill="none" stroke="#1e1e28" stroke-width="5"/>
    <circle cx="71" cy="50" r="22" fill="none" stroke="#1e1e28" stroke-width="5"/>`,
  'eyepatch': `
    <path d="M12 26 88 17" stroke="#fff" stroke-width="17" fill="none" stroke-linecap="round"/>
    <ellipse cx="50" cy="58" rx="30" ry="26" fill="#fff" stroke="#fff" stroke-width="11"/>
    <path d="M12 26 88 17" stroke="#2b2b38" stroke-width="9" fill="none" stroke-linecap="round"/>
    <ellipse cx="50" cy="58" rx="30" ry="26" fill="#20202c"/>
    <ellipse cx="40" cy="48" rx="10" ry="6" fill="#4a4a5e" transform="rotate(-25 40 48)"/>
    <ellipse cx="50" cy="58" rx="30" ry="26" fill="none" stroke="#0b0b12" stroke-width="5"/>`,
  'top-hat': `
    <ellipse cx="50" cy="80" rx="43" ry="10" fill="#fff" stroke="#fff" stroke-width="11"/>
    <path d="M27 18h46v64H27z" fill="#fff" stroke="#fff" stroke-width="11" stroke-linejoin="round"/>
    <ellipse cx="50" cy="80" rx="43" ry="10" fill="#20202c"/>
    <path d="M27 18h46v62H27z" fill="#20202c"/>
    <path d="M27 18h13v62H27z" fill="#33334a"/>
    <path d="M27 56h46v13H27z" fill="#e8123c"/>
    <path d="M27 56h13v13H27z" fill="#ff5470"/>
    <ellipse cx="50" cy="18" rx="23" ry="6" fill="#3d3d57"/>
    <ellipse cx="50" cy="80" rx="43" ry="10" fill="none" stroke="#0b0b12" stroke-width="5"/>
    <path d="M27 18h46v62H27z" fill="none" stroke="#0b0b12" stroke-width="5" stroke-linejoin="round"/>`,
  'cowboy-hat': `
    <path d="M8 68c14-11 28-7 42-7s28-4 42 7c-11 12-27 17-42 17S19 80 8 68z" fill="#fff" stroke="#fff" stroke-width="11" stroke-linejoin="round"/>
    <path d="M31 64c-3-24 6-46 19-46s22 22 19 46c-11 5-27 5-38 0z" fill="#fff" stroke="#fff" stroke-width="11" stroke-linejoin="round"/>
    <path d="M31 64c-3-24 6-46 19-46s22 22 19 46c-11 5-27 5-38 0z" fill="#b07a3c"/>
    <path d="M31 64c-3-24 6-46 19-46-8 8-12 26-11 47z" fill="#c99358"/>
    <path d="M8 68c14-11 28-7 42-7s28-4 42 7c-11 12-27 17-42 17S19 80 8 68z" fill="#8a5a2b"/>
    <path d="M8 68c14-11 28-7 42-7-14 3-25 9-30 19-5-3-9-7-12-12z" fill="#a06b33"/>
    <path d="M29 56c13 6 29 6 42 0l2 9c-14 6-32 6-46 0z" fill="#5c3a1a"/>
    <path d="M31 64c-3-24 6-46 19-46s22 22 19 46" fill="none" stroke="#4a2d10" stroke-width="5" stroke-linejoin="round"/>
    <path d="M8 68c14-11 28-7 42-7s28-4 42 7c-11 12-27 17-42 17S19 80 8 68z" fill="none" stroke="#4a2d10" stroke-width="5" stroke-linejoin="round"/>`,
  'bunny-ears': `
    <path d="M34 92C24 70 18 40 24 19c3-11 12-11 15 0 5 22 5 52 2 73z" fill="#fff" stroke="#fff" stroke-width="11" stroke-linejoin="round"/>
    <path d="M66 92c10-22 16-52 10-73-3-11-12-11-15 0-5 22-5 52-2 73z" fill="#fff" stroke="#fff" stroke-width="11" stroke-linejoin="round"/>
    <path d="M34 92C24 70 18 40 24 19c3-11 12-11 15 0 5 22 5 52 2 73z" fill="#f7f7fb"/>
    <path d="M33 80c-6-17-9-38-5-53 2-8 6-8 8 0 3 16 3 38 0 53z" fill="#ff9ec7"/>
    <path d="M66 92c10-22 16-52 10-73-3-11-12-11-15 0-5 22-5 52-2 73z" fill="#f7f7fb"/>
    <path d="M67 80c6-17 9-38 5-53-2-8-6-8-8 0-3 16-3 38 0 53z" fill="#ff9ec7"/>
    <path d="M34 92C24 70 18 40 24 19c3-11 12-11 15 0 5 22 5 52 2 73z" fill="none" stroke="#7a7a8c" stroke-width="5" stroke-linejoin="round"/>
    <path d="M66 92c10-22 16-52 10-73-3-11-12-11-15 0-5 22-5 52-2 73z" fill="none" stroke="#7a7a8c" stroke-width="5" stroke-linejoin="round"/>`,
  // A GAP DOWN THE MIDDLE. The first version had the two triangles meeting at
  // the centre, which reads as a bow tie rather than as ears.
  'cat-ears': `
    <path d="M10 82 25 12l23 60z" fill="#fff" stroke="#fff" stroke-width="12" stroke-linejoin="round"/>
    <path d="M90 82 75 12 52 72z" fill="#fff" stroke="#fff" stroke-width="12" stroke-linejoin="round"/>
    <path d="M10 82 25 12l23 60z" fill="#3a3a48"/>
    <path d="M10 82 25 12l6 16-11 54z" fill="#52526a"/>
    <path d="M20 70 26 34l13 33z" fill="#ff9ec7"/>
    <path d="M90 82 75 12 52 72z" fill="#3a3a48"/>
    <path d="M90 82 75 12l-6 16 11 54z" fill="#2c2c38"/>
    <path d="M80 70 74 34 61 67z" fill="#ff9ec7"/>
    <path d="M10 82 25 12l23 60z" fill="none" stroke="#1b1b24" stroke-width="5" stroke-linejoin="round"/>
    <path d="M90 82 75 12 52 72z" fill="none" stroke="#1b1b24" stroke-width="5" stroke-linejoin="round"/>`,
  'unicorn-horn': `
    <path d="M50 8 66 88H34z" fill="#fff" stroke="#fff" stroke-width="12" stroke-linejoin="round"/>
    <path d="M50 8 66 88H34z" fill="#ffd23f"/>
    <path d="M50 8 66 88H50z" fill="#e8a800"/>
    <path d="M40 70h20M43 54h14M46 38h8" stroke="#c98d00" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M50 8 66 88H34z" fill="none" stroke="#96690a" stroke-width="5" stroke-linejoin="round"/>`,
  'beard': `
    <path d="M14 14s11 9 36 9 36-9 36-9c4 24 0 44-11 56-8 8-16 11-25 11s-17-3-25-11C14 58 10 38 14 14z" fill="#fff" stroke="#fff" stroke-width="12" stroke-linejoin="round"/>
    <path d="M14 14s11 9 36 9 36-9 36-9c4 24 0 44-11 56-8 8-16 11-25 11s-17-3-25-11C14 58 10 38 14 14z" fill="#5a3a1e"/>
    <path d="M14 14s11 9 36 9v67c-9 0-17-3-25-11C14 58 10 38 14 14z" fill="#6f4a28"/>
    <path d="M34 23c10 2 22 2 32 0 2 16 0 30-8 38-4 4-8 6-8 6s-4-2-8-6c-8-8-10-22-8-38z" fill="#3f2712"/>
    <path d="M14 14s11 9 36 9 36-9 36-9c4 24 0 44-11 56-8 8-16 11-25 11s-17-3-25-11C14 58 10 38 14 14z" fill="none" stroke="#2c1a08" stroke-width="5" stroke-linejoin="round"/>`,
  'halo': `
    <ellipse cx="50" cy="50" rx="38" ry="15" fill="none" stroke="#fff" stroke-width="21"/>
    <ellipse cx="50" cy="50" rx="38" ry="15" fill="none" stroke="#c98d00" stroke-width="13"/>
    <ellipse cx="50" cy="50" rx="38" ry="15" fill="none" stroke="#ffd23f" stroke-width="9"/>
    <path d="M18 44c6-7 18-11 32-11" fill="none" stroke="#fff6c9" stroke-width="4" stroke-linecap="round"/>`,
  'clown-hair': `
    <circle cx="24" cy="37" r="14" fill="#fff" stroke="#fff" stroke-width="11"/>
    <circle cx="33" cy="22" r="11" fill="#fff" stroke="#fff" stroke-width="11"/>
    <circle cx="20" cy="56" r="12" fill="#fff" stroke="#fff" stroke-width="11"/>
    <circle cx="76" cy="37" r="14" fill="#fff" stroke="#fff" stroke-width="11"/>
    <circle cx="67" cy="22" r="11" fill="#fff" stroke="#fff" stroke-width="11"/>
    <circle cx="80" cy="56" r="12" fill="#fff" stroke="#fff" stroke-width="11"/>
    <circle cx="24" cy="37" r="14" fill="#e8123c" stroke="#8f0a24" stroke-width="4"/>
    <circle cx="33" cy="22" r="11" fill="#ff3d5a" stroke="#8f0a24" stroke-width="4"/>
    <circle cx="20" cy="56" r="12" fill="#ff3d5a" stroke="#8f0a24" stroke-width="4"/>
    <circle cx="27" cy="46" r="11" fill="#e8123c" stroke="#8f0a24" stroke-width="4"/>
    <circle cx="76" cy="37" r="14" fill="#e8123c" stroke="#8f0a24" stroke-width="4"/>
    <circle cx="67" cy="22" r="11" fill="#ff3d5a" stroke="#8f0a24" stroke-width="4"/>
    <circle cx="80" cy="56" r="12" fill="#ff3d5a" stroke="#8f0a24" stroke-width="4"/>
    <circle cx="73" cy="46" r="11" fill="#e8123c" stroke="#8f0a24" stroke-width="4"/>`,
  'buck-teeth': `
    <path d="M20 10h60v12H20z" fill="#fff" stroke="#fff" stroke-width="11" stroke-linejoin="round"/>
    <path d="M29 22h42v42a10 10 0 0 1-10 10H39a10 10 0 0 1-10-10z" fill="#fff" stroke="#fff" stroke-width="11" stroke-linejoin="round"/>
    <path d="M20 10h60v12H20z" fill="#d4677f"/>
    <path d="M20 10h60v5H20z" fill="#e88ba0"/>
    <path d="M29 22h42v42a10 10 0 0 1-10 10H39a10 10 0 0 1-10-10z" fill="#fff"/>
    <path d="M29 22h20v52H39a10 10 0 0 1-10-10z" fill="#f0f0f6"/>
    <path d="M50 22v52" stroke="#c9c9d6" stroke-width="4"/>
    <path d="M29 22h42v42a10 10 0 0 1-10 10H39a10 10 0 0 1-10-10z" fill="none" stroke="#8d8da0" stroke-width="5" stroke-linejoin="round"/>
    <path d="M20 10h60v12H20z" fill="none" stroke="#8f3f55" stroke-width="5" stroke-linejoin="round"/>`,
  'pig-snout': `
    <ellipse cx="50" cy="50" rx="38" ry="30" fill="#fff" stroke="#fff" stroke-width="11"/>
    <ellipse cx="50" cy="50" rx="38" ry="30" fill="#ffa8c4"/>
    <ellipse cx="50" cy="42" rx="30" ry="17" fill="#ffc0d5"/>
    <ellipse cx="36" cy="50" rx="8" ry="12" fill="#c25a7c"/>
    <ellipse cx="64" cy="50" rx="8" ry="12" fill="#c25a7c"/>
    <ellipse cx="50" cy="50" rx="38" ry="30" fill="none" stroke="#a3436a" stroke-width="5"/>`,
  'monobrow': `
    <path d="M9 62c6-21 23-33 41-33s35 12 41 33c-12-14-26-20-41-20S21 48 9 62z" fill="#fff" stroke="#fff" stroke-width="12" stroke-linejoin="round"/>
    <path d="M9 62c6-21 23-33 41-33s35 12 41 33c-12-14-26-20-41-20S21 48 9 62z" fill="#3a2716"/>
    <path d="M9 62c6-21 23-33 41-33-16 3-29 12-37 26z" fill="#5b3f24"/>
    <path d="M9 62c6-21 23-33 41-33s35 12 41 33c-12-14-26-20-41-20S21 48 9 62z" fill="none" stroke="#1d1209" stroke-width="5" stroke-linejoin="round"/>`,
  'tongue': `
    <path d="M50 8c21 0 32 13 32 32 0 23-13 52-32 52S18 63 18 40C18 21 29 8 50 8z" fill="#fff" stroke="#fff" stroke-width="12" stroke-linejoin="round"/>
    <path d="M50 8c21 0 32 13 32 32 0 23-13 52-32 52S18 63 18 40C18 21 29 8 50 8z" fill="#e8506e"/>
    <path d="M50 8c-21 0-32 13-32 32 0 12 4 26 9 37 0-30 4-56 23-69z" fill="#f2778e"/>
    <path d="M50 40c7 0 11 6 11 14 0 11-5 28-11 28s-11-17-11-28c0-8 4-14 11-14z" fill="#c23a56"/>
    <path d="M50 8c21 0 32 13 32 32 0 23-13 52-32 52S18 63 18 40C18 21 29 8 50 8z" fill="none" stroke="#992a45" stroke-width="5" stroke-linejoin="round"/>`,
  'love-glasses': `
    <rect x="9" y="28" width="82" height="8" rx="4" fill="#fff" stroke="#fff" stroke-width="11"/>
    <path d="M28 74S9 60 9 45a10 10 0 0 1 19-6 10 10 0 0 1 19 6c0 15-19 29-19 29z" fill="#fff" stroke="#fff" stroke-width="11" stroke-linejoin="round"/>
    <path d="M72 74S53 60 53 45a10 10 0 0 1 19-6 10 10 0 0 1 19 6c0 15-19 29-19 29z" fill="#fff" stroke="#fff" stroke-width="11" stroke-linejoin="round"/>
    <path d="M28 74S9 60 9 45a10 10 0 0 1 19-6 10 10 0 0 1 19 6c0 15-19 29-19 29z" fill="#ff2e88"/>
    <path d="M72 74S53 60 53 45a10 10 0 0 1 19-6 10 10 0 0 1 19 6c0 15-19 29-19 29z" fill="#ff2e88"/>
    <path d="M19 41c-4 0-7 3-7 7 0 5 3 11 7 16-2-8-2-15-1-19 1-3 1-4 1-4zM63 41c-4 0-7 3-7 7 0 5 3 11 7 16-2-8-2-15-1-19 1-3 1-4 1-4z" fill="#ff7ab8"/>
    <path d="M28 74S9 60 9 45a10 10 0 0 1 19-6 10 10 0 0 1 19 6c0 15-19 29-19 29z" fill="none" stroke="#a80b53" stroke-width="5" stroke-linejoin="round"/>
    <path d="M72 74S53 60 53 45a10 10 0 0 1 19-6 10 10 0 0 1 19 6c0 15-19 29-19 29z" fill="none" stroke="#a80b53" stroke-width="5" stroke-linejoin="round"/>
    <rect x="9" y="28" width="82" height="8" rx="4" fill="#ff2e88" stroke="#a80b53" stroke-width="5"/>`,
  // A side-swept fringe over one eye, which is the whole silhouette — the flat
  // black is broken with a plum streak so it does not read as a dark blob.
  'emo-fringe': `
    <path d="M11 46C11 22 28 8 50 8s39 14 39 38v10c-4-10-10-16-18-19-6 14-20 24-38 26-9 1-17 6-21 13z" fill="#fff" stroke="#fff" stroke-width="12" stroke-linejoin="round"/>
    <path d="M15 68C9 54 11 32 22 20c-2 16 2 28 12 36 8 6 6 18-4 22-8 3-12-2-15-10z" fill="#fff" stroke="#fff" stroke-width="12" stroke-linejoin="round"/>
    <path d="M11 46C11 22 28 8 50 8s39 14 39 38v10c-4-10-10-16-18-19-6 14-20 24-38 26-9 1-17 6-21 13z" fill="#17161c"/>
    <path d="M15 68C9 54 11 32 22 20c-2 16 2 28 12 36 8 6 6 18-4 22-8 3-12-2-15-10z" fill="#221f2a"/>
    <path d="M31 24c-8 8-11 21-8 32l-9-3c-3-13 1-25 10-33z" fill="#7b2d63"/>
    <path d="M54 12c14 2 24 10 29 22-8-8-18-13-31-14z" fill="#33313d"/>
    <path d="M11 46C11 22 28 8 50 8s39 14 39 38v10c-4-10-10-16-18-19-6 14-20 24-38 26-9 1-17 6-21 13z" fill="none" stroke="#0a090d" stroke-width="5" stroke-linejoin="round"/>
    <path d="M15 68C9 54 11 32 22 20c-2 16 2 28 12 36 8 6 6 18-4 22-8 3-12-2-15-10z" fill="none" stroke="#0a090d" stroke-width="5" stroke-linejoin="round"/>`,
  'stupid-up': `
    <path d="M34 22 24 17 14 31l12 12 4-5v49h40V38l4 5 12-12-10-14-10 5c-3 5-9 8-16 8s-13-3-16-8z" fill="#fff" stroke="#fff" stroke-width="12" stroke-linejoin="round"/>
    <path d="M34 22 24 17 14 31l12 12 4-5v49h40V38l4 5 12-12-10-14-10 5c-3 5-9 8-16 8s-13-3-16-8z" fill="#f4f4f8"/>
    <path d="M30 38v49h20V30c-7-1-13-4-16-8l-10 5-10 14 12 12z" fill="#fff"/>
    <path d="M34 22 24 17 14 31l12 12 4-5v49h40V38l4 5 12-12-10-14-10 5c-3 5-9 8-16 8s-13-3-16-8z" fill="none" stroke="#20202c" stroke-width="5" stroke-linejoin="round"/>
    <g fill="#20202c" font-family="Helvetica,Arial,sans-serif" font-weight="bold" text-anchor="middle">
      <text x="50" y="70" font-size="11" textLength="34" lengthAdjust="spacingAndGlyphs">I'M WITH</text>
      <text x="50" y="83" font-size="13" textLength="34" lengthAdjust="spacingAndGlyphs">STUPID</text>
    </g>
    <path d="M50 40 59 51h-5v6h-8v-6h-5z" fill="#e8123c" stroke="#8f0a24" stroke-width="3" stroke-linejoin="round"/>`,
  'stupid-left': `
    <path d="M34 22 24 17 14 31l12 12 4-5v49h40V38l4 5 12-12-10-14-10 5c-3 5-9 8-16 8s-13-3-16-8z" fill="#fff" stroke="#fff" stroke-width="12" stroke-linejoin="round"/>
    <path d="M34 22 24 17 14 31l12 12 4-5v49h40V38l4 5 12-12-10-14-10 5c-3 5-9 8-16 8s-13-3-16-8z" fill="#f4f4f8"/>
    <path d="M30 38v49h20V30c-7-1-13-4-16-8l-10 5-10 14 12 12z" fill="#fff"/>
    <path d="M34 22 24 17 14 31l12 12 4-5v49h40V38l4 5 12-12-10-14-10 5c-3 5-9 8-16 8s-13-3-16-8z" fill="none" stroke="#20202c" stroke-width="5" stroke-linejoin="round"/>
    <g fill="#20202c" font-family="Helvetica,Arial,sans-serif" font-weight="bold" text-anchor="middle">
      <text x="50" y="52" font-size="10" textLength="34" lengthAdjust="spacingAndGlyphs">I'M WITH</text>
      <text x="50" y="82" font-size="12" textLength="34" lengthAdjust="spacingAndGlyphs">STUPID</text>
    </g>
    <path d="M36 63 45 58v3h17v4H45v3z" fill="#e8123c" stroke="#8f0a24" stroke-width="3" stroke-linejoin="round"/>`,
  'stupid-right': `
    <path d="M34 22 24 17 14 31l12 12 4-5v49h40V38l4 5 12-12-10-14-10 5c-3 5-9 8-16 8s-13-3-16-8z" fill="#fff" stroke="#fff" stroke-width="12" stroke-linejoin="round"/>
    <path d="M34 22 24 17 14 31l12 12 4-5v49h40V38l4 5 12-12-10-14-10 5c-3 5-9 8-16 8s-13-3-16-8z" fill="#f4f4f8"/>
    <path d="M30 38v49h20V30c-7-1-13-4-16-8l-10 5-10 14 12 12z" fill="#fff"/>
    <path d="M34 22 24 17 14 31l12 12 4-5v49h40V38l4 5 12-12-10-14-10 5c-3 5-9 8-16 8s-13-3-16-8z" fill="none" stroke="#20202c" stroke-width="5" stroke-linejoin="round"/>
    <g fill="#20202c" font-family="Helvetica,Arial,sans-serif" font-weight="bold" text-anchor="middle">
      <text x="50" y="52" font-size="10" textLength="34" lengthAdjust="spacingAndGlyphs">I'M WITH</text>
      <text x="50" y="82" font-size="12" textLength="34" lengthAdjust="spacingAndGlyphs">STUPID</text>
    </g>
    <path d="M64 63 55 58v3H38v4h17v3z" fill="#e8123c" stroke="#8f0a24" stroke-width="3" stroke-linejoin="round"/>`,
  'stupid-both': `
    <path d="M34 22 24 17 14 31l12 12 4-5v49h40V38l4 5 12-12-10-14-10 5c-3 5-9 8-16 8s-13-3-16-8z" fill="#fff" stroke="#fff" stroke-width="12" stroke-linejoin="round"/>
    <path d="M34 22 24 17 14 31l12 12 4-5v49h40V38l4 5 12-12-10-14-10 5c-3 5-9 8-16 8s-13-3-16-8z" fill="#f4f4f8"/>
    <path d="M30 38v49h20V30c-7-1-13-4-16-8l-10 5-10 14 12 12z" fill="#fff"/>
    <path d="M34 22 24 17 14 31l12 12 4-5v49h40V38l4 5 12-12-10-14-10 5c-3 5-9 8-16 8s-13-3-16-8z" fill="none" stroke="#20202c" stroke-width="5" stroke-linejoin="round"/>
    <g fill="#20202c" font-family="Helvetica,Arial,sans-serif" font-weight="bold" text-anchor="middle">
      <text x="50" y="52" font-size="10" textLength="34" lengthAdjust="spacingAndGlyphs">I'M WITH</text>
      <text x="50" y="82" font-size="12" textLength="34" lengthAdjust="spacingAndGlyphs">STUPID</text>
    </g>
    <path d="M35 63 43 58v3h14v-3l8 5-8 5v-3H43v3z" fill="#e8123c" stroke="#8f0a24" stroke-width="3" stroke-linejoin="round"/>`,
  'traffic-cone': `
    <path d="M50 10 76 80H24z" fill="#fff" stroke="#fff" stroke-width="12" stroke-linejoin="round"/>
    <path d="M14 80h72v12H14z" fill="#fff" stroke="#fff" stroke-width="11"/>
    <path d="M50 10 76 80H24z" fill="#ff6a1a"/>
    <path d="M50 10 76 80H50z" fill="#e05a10"/>
    <path d="M36 48h28l5 14H31z" fill="#f7f7fb"/>
    <path d="M14 80h72v12H14z" fill="#e05a10"/>
    <path d="M50 10 76 80H24z" fill="none" stroke="#96400a" stroke-width="5" stroke-linejoin="round"/>
    <path d="M14 80h72v12H14z" fill="none" stroke="#96400a" stroke-width="5" stroke-linejoin="round"/>`,
  'lightning-bolt': `
    <path d="M60 10 20 56h22l-6 34 38-52H54z" fill="#fff" stroke="#fff" stroke-width="13" stroke-linejoin="round"/>
    <path d="M60 10 20 56h22l-6 34 38-52H54z" fill="#e8123c"/>
    <path d="M60 10 20 56h22l-6 34 12-40-14 2z" fill="#ff5470"/>
    <path d="M60 10 20 56h22l-6 34 38-52H54z" fill="none" stroke="#2b6cff" stroke-width="6" stroke-linejoin="round"/>`,
  'headphones': `
    <path d="M14 64V50a36 36 0 0 1 72 0v14" fill="none" stroke="#fff" stroke-width="23" stroke-linecap="round"/>
    <rect x="6" y="54" width="22" height="36" rx="10" fill="#fff" stroke="#fff" stroke-width="11"/>
    <rect x="72" y="54" width="22" height="36" rx="10" fill="#fff" stroke="#fff" stroke-width="11"/>
    <path d="M14 64V50a36 36 0 0 1 72 0v14" fill="none" stroke="#2a2a3a" stroke-width="12" stroke-linecap="round"/>
    <path d="M18 58V50a32 32 0 0 1 14-26" fill="none" stroke="#4a4a63" stroke-width="5" stroke-linecap="round"/>
    <rect x="6" y="54" width="22" height="36" rx="10" fill="#e8123c" stroke="#8f0a24" stroke-width="5"/>
    <rect x="72" y="54" width="22" height="36" rx="10" fill="#e8123c" stroke="#8f0a24" stroke-width="5"/>
    <rect x="10" y="59" width="7" height="18" rx="3.5" fill="#ff5470"/>
    <rect x="76" y="59" width="7" height="18" rx="3.5" fill="#ff5470"/>`,
  'elvis': `
    <path d="M14 50C12 24 29 8 52 8c18 0 30 8 34 20-10-7-23-7-31 0-7-11-25-9-31 4-3 8-4 13-10 18z" fill="#fff" stroke="#fff" stroke-width="12" stroke-linejoin="round"/>
    <path d="M15 48c-2 15 0 27 4 35l11-3c-5-10-7-22-5-32z" fill="#fff" stroke="#fff" stroke-width="11" stroke-linejoin="round"/>
    <path d="M85 48c2 15 0 27-4 35l-11-3c5-10 7-22 5-32z" fill="#fff" stroke="#fff" stroke-width="11" stroke-linejoin="round"/>
    <path d="M15 48c-2 15 0 27 4 35l11-3c-5-10-7-22-5-32z" fill="#1c1c2a"/>
    <path d="M85 48c2 15 0 27-4 35l-11-3c5-10 7-22 5-32z" fill="#1c1c2a"/>
    <path d="M14 50C12 24 29 8 52 8c18 0 30 8 34 20-10-7-23-7-31 0-7-11-25-9-31 4-3 8-4 13-10 18z" fill="#1c1c2a"/>
    <path d="M52 8c18 0 30 8 34 20-8-6-18-7-27-4-4-9-11-14-19-15 4-1 8-1 12-1z" fill="#3a3a52"/>
    <path d="M14 50C12 24 29 8 52 8c18 0 30 8 34 20-10-7-23-7-31 0-7-11-25-9-31 4-3 8-4 13-10 18z" fill="none" stroke="#08080f" stroke-width="5" stroke-linejoin="round"/>
    <path d="M15 48c-2 15 0 27 4 35l11-3c-5-10-7-22-5-32z" fill="none" stroke="#08080f" stroke-width="5" stroke-linejoin="round"/>
    <path d="M85 48c2 15 0 27-4 35l-11-3c5-10 7-22 5-32z" fill="none" stroke="#08080f" stroke-width="5" stroke-linejoin="round"/>`,
  'judge-wig': `
    <path d="M22 34C22 18 34 9 50 9s28 9 28 25c0 11-2 19-6 25H28c-4-6-6-14-6-25z" fill="#fff" stroke="#fff" stroke-width="12" stroke-linejoin="round"/>
    <path d="M21 56c-6 12-6 26-2 36l16-4c-5-10-5-22 0-32zM79 56c6 12 6 26 2 36l-16-4c5-10 5-22 0-32z" fill="#fff" stroke="#fff" stroke-width="12" stroke-linejoin="round"/>
    <path d="M22 34C22 18 34 9 50 9s28 9 28 25c0 11-2 19-6 25H28c-4-6-6-14-6-25z" fill="#f4f4f8"/>
    <path d="M22 34C22 18 34 9 50 9c-11 4-17 13-17 25 0 11 1 19 4 25h-9c-4-6-6-14-6-25z" fill="#fff"/>
    <path d="M21 56c-6 12-6 26-2 36l16-4c-5-10-5-22 0-32zM79 56c6 12 6 26 2 36l-16-4c5-10 5-22 0-32z" fill="#f4f4f8"/>
    <path d="M31 22h38M28 34h44M32 47h36" stroke="#c9c9d8" stroke-width="4" stroke-linecap="round"/>
    <path d="M24 66h10M66 66h10M24 78h10M66 78h10" stroke="#c9c9d8" stroke-width="4" stroke-linecap="round"/>
    <path d="M22 34C22 18 34 9 50 9s28 9 28 25c0 11-2 19-6 25H28c-4-6-6-14-6-25z" fill="none" stroke="#8d8da0" stroke-width="5" stroke-linejoin="round"/>
    <path d="M21 56c-6 12-6 26-2 36l16-4c-5-10-5-22 0-32zM79 56c6 12 6 26 2 36l-16-4c5-10 5-22 0-32z" fill="none" stroke="#8d8da0" stroke-width="5" stroke-linejoin="round"/>`,
  // NOT #8b91a6 — that was the tile's own fill, so the helmet vanished into it
  // and the tile read as two horns and nothing else. A prop must not be the
  // colour of the thing it is drawn on; the gradient behind them now makes
  // that hard to do twice, but the fix is still to pick a different colour.
  'viking-helmet': `
    <path d="M34 61C19 59 7 41 11 14c5 17 15 30 30 34z" fill="#fff" stroke="#fff" stroke-width="11" stroke-linejoin="round"/>
    <path d="M66 61c15-2 29-20 25-47-5 17-15 30-30 34z" fill="#fff" stroke="#fff" stroke-width="11" stroke-linejoin="round"/>
    <path d="M20 64c0-23 13-38 30-38s30 15 30 38zM13 64h74v13H13z" fill="#fff" stroke="#fff" stroke-width="11" stroke-linejoin="round"/>
    <path d="M34 61C19 59 7 41 11 14c5 17 15 30 30 34z" fill="#f3ead8"/>
    <path d="M32 57C20 53 11 39 12 21c5 14 14 25 26 30z" fill="#d8c9ab"/>
    <path d="M66 61c15-2 29-20 25-47-5 17-15 30-30 34z" fill="#f3ead8"/>
    <path d="M68 57c12-4 22-18 21-36-5 14-14 25-26 30z" fill="#d8c9ab"/>
    <path d="M34 61C19 59 7 41 11 14c5 17 15 30 30 34z" fill="none" stroke="#4a4438" stroke-width="5" stroke-linejoin="round"/>
    <path d="M66 61c15-2 29-20 25-47-5 17-15 30-30 34z" fill="none" stroke="#4a4438" stroke-width="5" stroke-linejoin="round"/>
    <path d="M20 64c0-23 13-38 30-38s30 15 30 38z" fill="#c3ccdb"/>
    <path d="M50 26c-17 0-30 15-30 38h13c0-23 7-35 17-38z" fill="#dde3ec"/>
    <path d="M13 64h74v13H13z" fill="#98a3b8"/>
    <path d="M44 30h12v47H44z" fill="#98a3b8"/>
    <circle cx="28" cy="57" r="3.2" fill="#6f7b90"/>
    <circle cx="72" cy="57" r="3.2" fill="#6f7b90"/>
    <circle cx="50" cy="38" r="3.2" fill="#6f7b90"/>
    <path d="M20 64c0-23 13-38 30-38s30 15 30 38zM13 64h74v13H13zM44 30h12v47H44z" fill="none" stroke="#3f4653" stroke-width="5" stroke-linejoin="round"/>`,
  'propeller-beanie': `
    <path d="M22 66a28 28 0 0 1 56 0zM18 66h64v11H18z" fill="#fff" stroke="#fff" stroke-width="12" stroke-linejoin="round"/>
    <path d="M50 18 22 9v16zM50 18l28-9v16z" fill="#fff" stroke="#fff" stroke-width="11" stroke-linejoin="round"/>
    <path d="M50 18 22 9v16z" fill="#ffd23f"/>
    <path d="M50 18l28-9v16z" fill="#e8a800"/>
    <path d="M50 36V20" stroke="#8f0a24" stroke-width="7" stroke-linecap="round"/>
    <path d="M22 66a28 28 0 0 1 56 0z" fill="#2b6cff"/>
    <path d="M50 38a28 28 0 0 0-28 28h14c0-14 6-25 14-28z" fill="#5c93ff"/>
    <path d="M18 66h64v11H18z" fill="#1e4fbf"/>
    <path d="M22 66a28 28 0 0 1 56 0zM18 66h64v11H18z" fill="none" stroke="#12328c" stroke-width="5" stroke-linejoin="round"/>
    <path d="M50 18 22 9v16zM50 18l28-9v16z" fill="none" stroke="#96690a" stroke-width="4" stroke-linejoin="round"/>
    <circle cx="50" cy="18" r="6" fill="#e8123c" stroke="#8f0a24" stroke-width="4"/>`,
  'flat-cap': `
    <path d="M20 58c0-21 13-33 30-33s30 12 30 33zM10 58h80c0 9-7 13-17 13H27c-10 0-17-4-17-13z" fill="#fff" stroke="#fff" stroke-width="12" stroke-linejoin="round"/>
    <path d="M20 58c0-21 13-33 30-33s30 12 30 33z" fill="#6b6250"/>
    <path d="M50 25c-17 0-30 12-30 33h16c0-19 5-30 14-33z" fill="#857b64"/>
    <path d="M10 58h80c0 9-7 13-17 13H27c-10 0-17-4-17-13z" fill="#57503f"/>
    <path d="M20 58c0-21 13-33 30-33s30 12 30 33zM10 58h80c0 9-7 13-17 13H27c-10 0-17-4-17-13z" fill="none" stroke="#33301f" stroke-width="5" stroke-linejoin="round"/>`,
  'antlers': `
    <path d="M42 90C36 68 28 51 17 41c-6-5-1-14 7-10 10 5 17 17 22 31M23 45 14 36M31 33 26 19" fill="none" stroke="#fff" stroke-width="19" stroke-linecap="round"/>
    <path d="M58 90c6-22 14-39 25-49 6-5 1-14-7-10-10 5-17 17-22 31M77 45l9-9M69 33l5-14" fill="none" stroke="#fff" stroke-width="19" stroke-linecap="round"/>
    <path d="M42 90C36 68 28 51 17 41c-6-5-1-14 7-10 10 5 17 17 22 31M23 45 14 36M31 33 26 19" fill="none" stroke="#5e3718" stroke-width="10" stroke-linecap="round"/>
    <path d="M58 90c6-22 14-39 25-49 6-5 1-14-7-10-10 5-17 17-22 31M77 45l9-9M69 33l5-14" fill="none" stroke="#5e3718" stroke-width="10" stroke-linecap="round"/>
    <path d="M42 90C36 68 28 51 17 41c-6-5-1-14 7-10 10 5 17 17 22 31" fill="none" stroke="#9a6535" stroke-width="4" stroke-linecap="round"/>
    <path d="M58 90c6-22 14-39 25-49 6-5 1-14-7-10-10 5-17 17-22 31" fill="none" stroke="#9a6535" stroke-width="4" stroke-linecap="round"/>`,

  // ---- seasonal. Shown only while that LOOK is on the game — see STICKERS.
  'skull': `
    <path d="M50 8c21 0 33 14 33 34 0 12-5 20-12 25v12c0 4-3 7-7 7H36c-4 0-7-3-7-7V67c-7-5-12-13-12-25C17 22 29 8 50 8z" fill="#fff" stroke="#fff" stroke-width="12" stroke-linejoin="round"/>
    <path d="M50 8c21 0 33 14 33 34 0 12-5 20-12 25v12c0 4-3 7-7 7H36c-4 0-7-3-7-7V67c-7-5-12-13-12-25C17 22 29 8 50 8z" fill="#f2f2f7"/>
    <path d="M50 8c-21 0-33 14-33 34 0 12 5 20 12 25v12c0 4 3 7 7 7h9V8z" fill="#fff"/>
    <circle cx="36" cy="42" r="10" fill="#20202c"/>
    <circle cx="64" cy="42" r="10" fill="#20202c"/>
    <path d="M50 54 44 66h12z" fill="#20202c"/>
    <path d="M39 74v11M50 74v11M61 74v11" stroke="#20202c" stroke-width="4"/>
    <path d="M50 8c21 0 33 14 33 34 0 12-5 20-12 25v12c0 4-3 7-7 7H36c-4 0-7-3-7-7V67c-7-5-12-13-12-25C17 22 29 8 50 8z" fill="none" stroke="#8d8da0" stroke-width="5" stroke-linejoin="round"/>`,
  'ghost': `
    <path d="M22 90V44a28 28 0 0 1 56 0v46l-9-8-9 8-9-8-9 8z" fill="#fff" stroke="#fff" stroke-width="12" stroke-linejoin="round"/>
    <path d="M22 90V44a28 28 0 0 1 56 0v46l-9-8-9 8-9-8-9 8z" fill="#f2f2f7"/>
    <path d="M22 90V44a28 28 0 0 1 28-28v72l-9-8-9 8-9 8z" fill="#fff"/>
    <circle cx="39" cy="42" r="6" fill="#20202c"/>
    <circle cx="61" cy="42" r="6" fill="#20202c"/>
    <ellipse cx="50" cy="60" rx="7" ry="9" fill="#20202c"/>
    <path d="M22 90V44a28 28 0 0 1 56 0v46l-9-8-9 8-9-8-9 8z" fill="none" stroke="#8d8da0" stroke-width="5" stroke-linejoin="round"/>`,
  'bat': `
    <path d="M40 44C29 30 16 26 8 30c5 4 6 10 4 15 8-2 15 2 19 8zM60 44c11-14 24-18 32-14-5 4-6 10-4 15-8-2-15 2-19 8z" fill="#fff" stroke="#fff" stroke-width="12" stroke-linejoin="round"/>
    <ellipse cx="50" cy="50" rx="11" ry="13" fill="#fff" stroke="#fff" stroke-width="11"/>
    <path d="M44 32l-4-12 10 7 10-7-4 12z" fill="#fff" stroke="#fff" stroke-width="11" stroke-linejoin="round"/>
    <path d="M40 44C29 30 16 26 8 30c5 4 6 10 4 15 8-2 15 2 19 8zM60 44c11-14 24-18 32-14-5 4-6 10-4 15-8-2-15 2-19 8z" fill="#2b2b38"/>
    <ellipse cx="50" cy="50" rx="11" ry="13" fill="#2b2b38"/>
    <path d="M44 32l-4-12 10 7 10-7-4 12z" fill="#2b2b38"/>
    <circle cx="45" cy="47" r="2.6" fill="#e8123c"/>
    <circle cx="55" cy="47" r="2.6" fill="#e8123c"/>
    <path d="M40 44C29 30 16 26 8 30c5 4 6 10 4 15 8-2 15 2 19 8zM60 44c11-14 24-18 32-14-5 4-6 10-4 15-8-2-15 2-19 8z" fill="none" stroke="#0b0b12" stroke-width="5" stroke-linejoin="round"/>
    <ellipse cx="50" cy="50" rx="11" ry="13" fill="none" stroke="#0b0b12" stroke-width="5"/>`,
  'pumpkin': `
    <ellipse cx="50" cy="58" rx="38" ry="31" fill="#fff" stroke="#fff" stroke-width="12"/>
    <path d="M50 27V14c8-4 14-1 16 3" fill="none" stroke="#fff" stroke-width="16" stroke-linecap="round"/>
    <path d="M50 27V14c8-4 14-1 16 3" fill="none" stroke="#4a7a2a" stroke-width="8" stroke-linecap="round"/>
    <ellipse cx="50" cy="58" rx="38" ry="31" fill="#ff6a1a"/>
    <path d="M50 27c-21 0-38 14-38 31s17 31 38 31z" fill="#ff8442"/>
    <path d="M30 48 43 43 34 58zM70 48 57 43 66 58z" fill="#5c2400"/>
    <path d="M30 68c9 9 31 9 40 0-4 11-36 11-40 0z" fill="#5c2400"/>
    <ellipse cx="50" cy="58" rx="38" ry="31" fill="none" stroke="#96400a" stroke-width="5"/>`,
  'santa-hat': `
    <path d="M16 64C16 38 32 19 55 19c15 0 25 8 29 18l-8 27z" fill="#fff" stroke="#fff" stroke-width="12" stroke-linejoin="round"/>
    <path d="M12 64h72v15H12z" fill="#fff" stroke="#fff" stroke-width="11"/>
    <circle cx="82" cy="36" r="11" fill="#fff" stroke="#fff" stroke-width="11"/>
    <path d="M16 64C16 38 32 19 55 19c15 0 25 8 29 18l-8 27z" fill="#e8123c"/>
    <path d="M16 64C16 38 32 19 55 19c-14 8-24 25-27 45z" fill="#ff5470"/>
    <path d="M16 64C16 38 32 19 55 19c15 0 25 8 29 18l-8 27z" fill="none" stroke="#7d0a20" stroke-width="5" stroke-linejoin="round"/>
    <circle cx="82" cy="36" r="11" fill="#f7f7fb" stroke="#b9b9c8" stroke-width="4"/>
    <path d="M12 64h72v15H12z" fill="#f7f7fb" stroke="#b9b9c8" stroke-width="5" stroke-linejoin="round"/>`,
  'santa-beard': `
    <path d="M14 14s11 9 36 9 36-9 36-9c4 24 0 44-11 56-8 8-16 11-25 11s-17-3-25-11C14 58 10 38 14 14z" fill="#fff" stroke="#fff" stroke-width="12" stroke-linejoin="round"/>
    <path d="M14 14s11 9 36 9 36-9 36-9c4 24 0 44-11 56-8 8-16 11-25 11s-17-3-25-11C14 58 10 38 14 14z" fill="#f4f4f8"/>
    <path d="M14 14s11 9 36 9v67c-9 0-17-3-25-11C14 58 10 38 14 14z" fill="#fff"/>
    <path d="M32 23c11 3 25 3 36 0-2 7-15 11-18 11s-16-4-18-11z" fill="#dcdce8"/>
    <path d="M14 14s11 9 36 9 36-9 36-9c4 24 0 44-11 56-8 8-16 11-25 11s-17-3-25-11C14 58 10 38 14 14z" fill="none" stroke="#9d9db0" stroke-width="5" stroke-linejoin="round"/>`,
  'elf-ears': `
    <path d="M27 84C15 74 9 54 13 34c2-10 10-12 16-4 9 12 11 34 6 54z" fill="#fff" stroke="#fff" stroke-width="12" stroke-linejoin="round"/>
    <path d="M73 84c12-10 18-30 14-50-2-10-10-12-16-4-9 12-11 34-6 54z" fill="#fff" stroke="#fff" stroke-width="12" stroke-linejoin="round"/>
    <path d="M27 84C15 74 9 54 13 34c2-10 10-12 16-4 9 12 11 34 6 54z" fill="#f0c9a8"/>
    <path d="M73 84c12-10 18-30 14-50-2-10-10-12-16-4-9 12-11 34-6 54z" fill="#f0c9a8"/>
    <path d="M26 70c-6-8-8-22-6-32 1-6 5-7 8-2 5 9 5 25 1 34z" fill="#d9a97f"/>
    <path d="M74 70c6-8 8-22 6-32-1-6-5-7-8-2-5 9-5 25-1 34z" fill="#d9a97f"/>
    <path d="M27 84C15 74 9 54 13 34c2-10 10-12 16-4 9 12 11 34 6 54z" fill="none" stroke="#a3714a" stroke-width="5" stroke-linejoin="round"/>
    <path d="M73 84c12-10 18-30 14-50-2-10-10-12-16-4-9 12-11 34-6 54z" fill="none" stroke="#a3714a" stroke-width="5" stroke-linejoin="round"/>`,
  'kiss-lips': `
    <path d="M12 32c11-11 30-9 38 4 8-13 27-15 38-4-4 24-21 42-38 46C33 74 16 56 12 32z" fill="#fff" stroke="#fff" stroke-width="12" stroke-linejoin="round"/>
    <path d="M12 32c11-11 30-9 38 4 8-13 27-15 38-4-4 24-21 42-38 46C33 74 16 56 12 32z" fill="#e8123c"/>
    <path d="M15 35c14 7 56 7 70 0-2 7-6 12-10 17-15 6-35 6-50 0-4-5-8-10-10-17z" fill="#ff6b8a"/>
    <path d="M24 30c7-4 17-3 22 4-8-1-16-2-22-4z" fill="#ff96ab"/>
    <path d="M12 32c11-11 30-9 38 4 8-13 27-15 38-4-4 24-21 42-38 46C33 74 16 56 12 32z" fill="none" stroke="#7d0a20" stroke-width="5" stroke-linejoin="round"/>`,
  'cupid-arrow': `
    <path d="M10 62 90 38" stroke="#fff" stroke-width="19" fill="none" stroke-linecap="round"/>
    <path d="M92 38 72 28l4 11-9 8z" fill="#fff" stroke="#fff" stroke-width="12" stroke-linejoin="round"/>
    <path d="M8 62 26 54l-2 14z" fill="#fff" stroke="#fff" stroke-width="12" stroke-linejoin="round"/>
    <path d="M10 62 90 38" stroke="#8a5a2b" stroke-width="8" fill="none" stroke-linecap="round"/>
    <path d="M92 38 72 28l4 11-9 8z" fill="#c8c8d0" stroke="#7c7c8e" stroke-width="4" stroke-linejoin="round"/>
    <path d="M8 62 26 54l-2 14z" fill="#e8123c" stroke="#7d0a20" stroke-width="4" stroke-linejoin="round"/>`,
  'snorkel': `
    <path d="M18 34h54c6 0 10 4 10 10v14c0 8-6 14-14 14H32c-8 0-14-6-14-14z" fill="#fff" stroke="#fff" stroke-width="12" stroke-linejoin="round"/>
    <path d="M80 46c8 0 10-7 10-15V13" fill="none" stroke="#fff" stroke-width="19" stroke-linecap="round"/>
    <path d="M80 46c8 0 10-7 10-15V13" fill="none" stroke="#ffd23f" stroke-width="9" stroke-linecap="round"/>
    <path d="M18 34h54c6 0 10 4 10 10v14c0 8-6 14-14 14H32c-8 0-14-6-14-14z" fill="#7db8ff" opacity=".75"/>
    <path d="M24 40h22l-10 26h-4c-8 0-14-6-14-14z" fill="#fff" opacity=".45"/>
    <path d="M18 34h54c6 0 10 4 10 10v14c0 8-6 14-14 14H32c-8 0-14-6-14-14z" fill="none" stroke="#20202c" stroke-width="5" stroke-linejoin="round"/>`,
  /*
   * FLAGS, for a tournament night or Eurovision.
   *
   * Simplified on purpose and honestly so: these are drawn at about fifty
   * pixels on a tile and then stuck on a face, so a faithful Portuguese
   * armillary sphere or a Welsh dragon in full would come out as a smudge.
   * What has to survive is the LAYOUT and the COLOURS, which is what anybody
   * reads a flag by at that size.
   */
  'flag-england': `
    <rect x="7" y="25" width="86" height="54" rx="3" fill="#fff" stroke="#fff" stroke-width="12"/>
    <rect x="7" y="25" width="86" height="54" fill="#f2f2f7"/>
    <path d="M44 25h12v54H44zM7 47h86v11H7z" fill="#e8123c"/>
    <path d="M7 25h28L17 79H7z" fill="#fff" opacity=".16"/>
    <rect x="7" y="25" width="86" height="54" rx="3" fill="none" stroke="#20202c" stroke-width="5"/>`,
  'flag-scotland': `
    <rect x="7" y="25" width="86" height="54" rx="3" fill="#fff" stroke="#fff" stroke-width="12"/>
    <rect x="7" y="25" width="86" height="54" fill="#1157a8"/>
    <path d="M7 25 93 79M93 25 7 79" stroke="#f2f2f7" stroke-width="13"/>
    <path d="M7 25h28L17 79H7z" fill="#fff" opacity=".16"/>
    <rect x="7" y="25" width="86" height="54" rx="3" fill="none" stroke="#20202c" stroke-width="5"/>`,
  'flag-wales': `
    <rect x="7" y="25" width="86" height="54" rx="3" fill="#fff" stroke="#fff" stroke-width="12"/>
    <rect x="7" y="25" width="86" height="27" fill="#f2f2f7"/>
    <rect x="7" y="52" width="86" height="27" fill="#00963f"/>
    <path d="M30 57c-4-4-2-9 3-10 3-1 5 1 7-2 3-4 8-4 12-1 4 3 8 2 11 0l4 5-6 3 5 3-7 2 3 5-8-1 1 5-7-3-3 4-4-4-5 3 1-6-7 1z" fill="#e8123c"/>
    <path d="M7 25h28L17 79H7z" fill="#fff" opacity=".16"/>
    <rect x="7" y="25" width="86" height="54" rx="3" fill="none" stroke="#20202c" stroke-width="5"/>`,
  'flag-unionjack': `
    <rect x="7" y="25" width="86" height="54" rx="3" fill="#fff" stroke="#fff" stroke-width="12"/>
    <rect x="7" y="25" width="86" height="54" fill="#1157a8"/>
    <path d="M7 25 93 79M93 25 7 79" stroke="#f2f2f7" stroke-width="14"/>
    <path d="M7 25 93 79M93 25 7 79" stroke="#e8123c" stroke-width="6"/>
    <path d="M50 25v54M7 52h86" stroke="#f2f2f7" stroke-width="19"/>
    <path d="M50 25v54M7 52h86" stroke="#e8123c" stroke-width="10"/>
    <path d="M7 25h28L17 79H7z" fill="#fff" opacity=".16"/>
    <rect x="7" y="25" width="86" height="54" rx="3" fill="none" stroke="#20202c" stroke-width="5"/>`,
  'flag-ireland': `
    <rect x="7" y="25" width="86" height="54" rx="3" fill="#fff" stroke="#fff" stroke-width="12"/>
    <rect x="7" y="25" width="29" height="54" fill="#169b62"/>
    <rect x="36" y="25" width="29" height="54" fill="#f2f2f7"/>
    <rect x="64" y="25" width="29" height="54" fill="#ff883e"/>
    <path d="M7 25h28L17 79H7z" fill="#fff" opacity=".16"/>
    <rect x="7" y="25" width="86" height="54" rx="3" fill="none" stroke="#20202c" stroke-width="5"/>`,
  'flag-france': `
    <rect x="7" y="25" width="86" height="54" rx="3" fill="#fff" stroke="#fff" stroke-width="12"/>
    <rect x="7" y="25" width="29" height="54" fill="#0055a4"/>
    <rect x="36" y="25" width="29" height="54" fill="#f2f2f7"/>
    <rect x="64" y="25" width="29" height="54" fill="#ef4135"/>
    <path d="M7 25h28L17 79H7z" fill="#fff" opacity=".16"/>
    <rect x="7" y="25" width="86" height="54" rx="3" fill="none" stroke="#20202c" stroke-width="5"/>`,
  'flag-germany': `
    <rect x="7" y="25" width="86" height="54" rx="3" fill="#fff" stroke="#fff" stroke-width="12"/>
    <rect x="7" y="25" width="86" height="18" fill="#20202c"/>
    <rect x="7" y="43" width="86" height="18" fill="#dd0000"/>
    <rect x="7" y="61" width="86" height="18" fill="#ffce00"/>
    <path d="M7 25h28L17 79H7z" fill="#fff" opacity=".16"/>
    <rect x="7" y="25" width="86" height="54" rx="3" fill="none" stroke="#20202c" stroke-width="5"/>`,
  'flag-italy': `
    <rect x="7" y="25" width="86" height="54" rx="3" fill="#fff" stroke="#fff" stroke-width="12"/>
    <rect x="7" y="25" width="29" height="54" fill="#009246"/>
    <rect x="36" y="25" width="29" height="54" fill="#f2f2f7"/>
    <rect x="64" y="25" width="29" height="54" fill="#ce2b37"/>
    <path d="M7 25h28L17 79H7z" fill="#fff" opacity=".16"/>
    <rect x="7" y="25" width="86" height="54" rx="3" fill="none" stroke="#20202c" stroke-width="5"/>`,
  'flag-spain': `
    <rect x="7" y="25" width="86" height="54" rx="3" fill="#fff" stroke="#fff" stroke-width="12"/>
    <rect x="7" y="25" width="86" height="14" fill="#aa151b"/>
    <rect x="7" y="39" width="86" height="26" fill="#f1bf00"/>
    <rect x="7" y="65" width="86" height="14" fill="#aa151b"/>
    <path d="M7 25h28L17 79H7z" fill="#fff" opacity=".16"/>
    <rect x="7" y="25" width="86" height="54" rx="3" fill="none" stroke="#20202c" stroke-width="5"/>`,
  'flag-portugal': `
    <rect x="7" y="25" width="86" height="54" rx="3" fill="#fff" stroke="#fff" stroke-width="12"/>
    <rect x="7" y="25" width="34" height="54" fill="#046a38"/>
    <rect x="41" y="25" width="52" height="54" fill="#da291c"/>
    <circle cx="41" cy="52" r="13" fill="#f1bf00"/>
    <circle cx="41" cy="52" r="7" fill="#f2f2f7"/>
    <path d="M7 25h28L17 79H7z" fill="#fff" opacity=".16"/>
    <rect x="7" y="25" width="86" height="54" rx="3" fill="none" stroke="#20202c" stroke-width="5"/>`,
  'flag-netherlands': `
    <rect x="7" y="25" width="86" height="54" rx="3" fill="#fff" stroke="#fff" stroke-width="12"/>
    <rect x="7" y="25" width="86" height="18" fill="#ae1c28"/>
    <rect x="7" y="43" width="86" height="18" fill="#f2f2f7"/>
    <rect x="7" y="61" width="86" height="18" fill="#21468b"/>
    <path d="M7 25h28L17 79H7z" fill="#fff" opacity=".16"/>
    <rect x="7" y="25" width="86" height="54" rx="3" fill="none" stroke="#20202c" stroke-width="5"/>`,
  'flag-sweden': `
    <rect x="7" y="25" width="86" height="54" rx="3" fill="#fff" stroke="#fff" stroke-width="12"/>
    <rect x="7" y="25" width="86" height="54" fill="#006aa7"/>
    <path d="M7 47h86v11H7zM32 25h12v54H32z" fill="#fecc00"/>
    <path d="M7 25h28L17 79H7z" fill="#fff" opacity=".16"/>
    <rect x="7" y="25" width="86" height="54" rx="3" fill="none" stroke="#20202c" stroke-width="5"/>`,
  'flag-ukraine': `
    <rect x="7" y="25" width="86" height="54" rx="3" fill="#fff" stroke="#fff" stroke-width="12"/>
    <rect x="7" y="25" width="86" height="27" fill="#0057b7"/>
    <rect x="7" y="52" width="86" height="27" fill="#ffd700"/>
    <path d="M7 25h28L17 79H7z" fill="#fff" opacity=".16"/>
    <rect x="7" y="25" width="86" height="54" rx="3" fill="none" stroke="#20202c" stroke-width="5"/>`,
  'flag-brazil': `
    <rect x="7" y="25" width="86" height="54" rx="3" fill="#fff" stroke="#fff" stroke-width="12"/>
    <rect x="7" y="25" width="86" height="54" fill="#009b3a"/>
    <path d="M50 29 89 52 50 75 11 52z" fill="#fedf00"/>
    <circle cx="50" cy="52" r="14" fill="#002776"/>
    <path d="M7 25h28L17 79H7z" fill="#fff" opacity=".16"/>
    <rect x="7" y="25" width="86" height="54" rx="3" fill="none" stroke="#20202c" stroke-width="5"/>`,
  'flower-crown': `
    <path d="M8 68c14-17 32-25 42-25s28 8 42 25z" fill="#fff" stroke="#fff" stroke-width="12" stroke-linejoin="round"/>
    <path d="M8 68c14-17 32-25 42-25s28 8 42 25z" fill="#4a7a2a"/>
    <path d="M8 68c14-17 32-25 42-25-16 4-30 12-38 25z" fill="#69a83e"/>
    <path d="M8 68c14-17 32-25 42-25s28 8 42 25z" fill="none" stroke="#2c4a17" stroke-width="5" stroke-linejoin="round"/>
    <circle cx="19" cy="57" r="11" fill="#ff2e88" stroke="#a80b53" stroke-width="4"/><circle cx="19" cy="57" r="4" fill="#ffd23f"/>
    <circle cx="41" cy="45" r="12" fill="#ffd23f" stroke="#a37000" stroke-width="4"/><circle cx="41" cy="45" r="4" fill="#e8123c"/>
    <circle cx="65" cy="47" r="11" fill="#ff6bd6" stroke="#a02f83" stroke-width="4"/><circle cx="65" cy="47" r="4" fill="#ffd23f"/>
    <circle cx="85" cy="59" r="10" fill="#4bd8ff" stroke="#1d7fa0" stroke-width="4"/><circle cx="85" cy="59" r="4" fill="#ffd23f"/>`,
};

export const STICKERS = [
  /*
   * ORDER IS DELIBERATE at the front. The first row is what somebody sees
   * before they scroll, so it holds the two that get the biggest laugh rather
   * than whatever happened to be written first.
   */
  { id: 'googly-eyes', label: 'Googly eyes' },
  { id: 'emo-fringe', label: 'Emo fringe' },
  { id: 'dog-ears', label: 'Dog ears' },
  { id: 'clown-nose', label: 'Clown nose' },
  { id: 'sunglasses', label: 'Shades' },
  { id: 'moustache', label: 'Moustache' },
  { id: 'party-hat', label: 'Party hat' },
  { id: 'crown', label: 'Crown' },
  { id: 'devil-horns', label: 'Horns' },
  { id: 'hearts', label: 'Hearts' },
  { id: 'tache-glasses', label: 'Disguise' },
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
  { id: 'stupid-up', label: 'Stupid up' },
  { id: 'stupid-left', label: 'Stupid left' },
  { id: 'stupid-right', label: 'Stupid right' },
  { id: 'stupid-both', label: 'Stupid both' },
  { id: 'traffic-cone', label: 'Traffic cone' },
  { id: 'lightning-bolt', label: 'Lightning' },
  { id: 'headphones', label: 'Headphones' },
  { id: 'elvis', label: 'Quiff' },
  { id: 'judge-wig', label: 'Judge wig' },
  { id: 'viking-helmet', label: 'Viking' },
  { id: 'propeller-beanie', label: 'Propeller' },
  { id: 'flat-cap', label: 'Flat cap' },
  { id: 'antlers', label: 'Antlers' },

  /*
   * SEASONAL, and tied to the LOOK rather than to the date.
   *
   * The look is already the app's answer to "what kind of night is this": it is
   * chosen at launch, it lives in the game state, and it is what paints the
   * projector and every phone. So the props come off the same switch and the
   * three cannot disagree.
   *
   * A DATE would break that. An ordinary quiz on 30 October would put skulls in
   * the tray while the projector was still pink and orange — two features with
   * different opinions about what night it is — and a Halloween booking that
   * landed on 2 November would get none at all. There is no case a date helps
   * that the look does not already cover: if they picked Halloween they wanted
   * a Halloween night, and if they did not, they did not.
   */
  { id: 'skull', label: 'Skull', look: 'halloween' },
  { id: 'ghost', label: 'Ghost', look: 'halloween' },
  { id: 'bat', label: 'Bat', look: 'halloween' },
  { id: 'pumpkin', label: 'Pumpkin', look: 'halloween' },
  { id: 'santa-hat', label: 'Santa hat', look: 'christmas' },
  { id: 'santa-beard', label: 'Santa beard', look: 'christmas' },
  { id: 'elf-ears', label: 'Elf ears', look: 'christmas' },
  { id: 'kiss-lips', label: 'Big kiss', look: 'valentines' },
  { id: 'cupid-arrow', label: 'Cupid', look: 'valentines' },
  { id: 'snorkel', label: 'Snorkel', look: 'summer' },
  { id: 'flower-crown', label: 'Flower crown', look: 'summer' },

  /*
   * The flags belong to TWO looks, which is why `look` may be a list. A
   * tournament night and Eurovision want the same twelve; a second copy of
   * each under another id would be twelve more drawings to keep in step.
   *
   * The set is chosen for a room in Essex rather than for completeness: the
   * home nations first, then the countries a British crowd actually shouts
   * for. Adding one is a drawing and a line — but every one added is another
   * tile in a tray somebody has to scan, so add them when a night needs one.
   */
  { id: 'flag-england', label: 'England', look: ['international', 'eurovision'] },
  { id: 'flag-scotland', label: 'Scotland', look: ['international', 'eurovision'] },
  { id: 'flag-wales', label: 'Wales', look: ['international', 'eurovision'] },
  { id: 'flag-unionjack', label: 'Union Jack', look: ['international', 'eurovision'] },
  { id: 'flag-ireland', label: 'Ireland', look: ['international', 'eurovision'] },
  { id: 'flag-france', label: 'France', look: ['international', 'eurovision'] },
  { id: 'flag-germany', label: 'Germany', look: ['international', 'eurovision'] },
  { id: 'flag-italy', label: 'Italy', look: ['international', 'eurovision'] },
  { id: 'flag-spain', label: 'Spain', look: ['international', 'eurovision'] },
  { id: 'flag-portugal', label: 'Portugal', look: ['international', 'eurovision'] },
  { id: 'flag-netherlands', label: 'Netherlands', look: ['international', 'eurovision'] },
  { id: 'flag-sweden', label: 'Sweden', look: ['international', 'eurovision'] },
  { id: 'flag-ukraine', label: 'Ukraine', look: ['international', 'eurovision'] },
  { id: 'flag-brazil', label: 'Brazil', look: 'international' },
];

/**
 * The props for tonight: this look's own, then the ones that always apply.
 *
 * `look` on a prop may be a LIST, because the flags belong to both Eurovision
 * and a tournament night — the same twelve flags, two different evenings — and
 * a second copy of each under another id is twelve more drawings to keep in
 * step with these.
 */
export function stickersFor(look) {
  const wants = (s) => s.look && [].concat(s.look).includes(look);
  return {
    seasonal: STICKERS.filter(wants),
    always: STICKERS.filter((s) => !s.look),
  };
}

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
    // In PIXELS, not fractions — the box is square on the canvas, and a
    // fraction of the width is not a fraction of the height on a portrait
    // photo. Turned back by the prop's own angle so a rotated prop is still
    // grabbed where it looks, rather than through an upright box it no longer
    // fills.
    const px = (x - item.x) * canvas.width;
    const py = (y - item.y) * canvas.height;
    const a = -(item.angle || 0);
    const rx = px * Math.cos(a) - py * Math.sin(a);
    const ry = px * Math.sin(a) + py * Math.cos(a);
    if (Math.abs(rx) <= side / 2 && Math.abs(ry) <= side / 2) return item;
  }
  return null;
}
