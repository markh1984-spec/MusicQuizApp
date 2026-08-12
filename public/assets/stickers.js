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
    <circle cx="50" cy="50" r="38" fill="#fff" stroke="#fff" stroke-width="11"/>
    <circle cx="50" cy="50" r="38" fill="#e8123c"/>
    <ellipse cx="63" cy="66" rx="29" ry="21" fill="#a10c29" opacity=".5" transform="rotate(-30 63 66)"/>
    <ellipse cx="36" cy="34" rx="13" ry="9" fill="#fff" opacity=".9" transform="rotate(-30 36 34)"/>
    <circle cx="50" cy="50" r="38" fill="none" stroke="#7d0a20" stroke-width="5"/>`,
  'sunglasses': `
    <path d="M4 30h92v10H88c0 18-9 28-22 28-11 0-17-7-19-18h-6c-2 11-8 18-19 18-13 0-22-10-22-28H4z" fill="#141420"/>
    <path d="M14 40h26c0 12-5 18-13 18s-13-6-13-18zM60 40h26c0 12-5 18-13 18s-13-6-13-18z" fill="#2b6cff" opacity=".5"/>`,
  'moustache': `
    <path d="M50 44c6-8 16-14 27-14 12 0 21 7 21 16 0 11-11 18-24 18-10 0-18-4-24-11-6 7-14 11-24 11C13 64 2 57 2 46c0-9 9-16 21-16 11 0 21 6 27 14z" fill="#2a1d12"/>`,
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
  // A side-swept fringe over one eye, which is the whole silhouette — the flat
  // black is broken with a plum streak so it does not read as a dark blob.
  'emo-fringe': `
    <path d="M8 44C8 20 26 6 50 6s42 14 42 38v10c-4-10-10-16-18-19-6 14-20 24-38 26-10 1-18 6-22 14z" fill="#17161c"/>
    <path d="M12 66C6 52 8 30 20 18c-2 16 2 28 12 36 8 6 6 18-4 22-8 3-13-2-16-10z" fill="#221f2a"/>
    <path d="M30 22c-8 8-11 22-8 34l-9-3c-3-14 1-27 10-35z" fill="#7b2d63"/>`,
  'traffic-cone': `
    <path d="M50 6 78 84H22z" fill="#ff6a1a"/>
    <path d="M34 50h32l5 14H29z" fill="#f2f2f7"/>
    <path d="M12 84h76v10H12z" fill="#e05a10"/>`,
  'lightning-bolt': `
    <path d="M60 4 18 54h24l-8 42 44-58H54z" fill="#e8123c"/>
    <path d="M60 4 18 54h24l-8 42 44-58H54z" fill="none" stroke="#2b6cff" stroke-width="5"/>`,
  'headphones': `
    <path d="M12 64V50a38 38 0 0 1 76 0v14" fill="none" stroke="#2a2a3a" stroke-width="11"/>
    <rect x="2" y="56" width="24" height="36" rx="10" fill="#e8123c"/>
    <rect x="74" y="56" width="24" height="36" rx="10" fill="#e8123c"/>`,
  'elvis': `
    <path d="M12 48C10 22 28 4 52 4c18 0 30 8 34 20-10-7-23-7-31 0-7-11-25-9-31 4-3 8-5 14-12 20z" fill="#1c1c2a"/>
    <path d="M14 46c-2 15 0 27 4 35l11-3c-5-10-7-22-5-32z" fill="#1c1c2a"/>
    <path d="M86 46c2 15 0 27-4 35l-11-3c5-10 7-22 5-32z" fill="#1c1c2a"/>`,
  'judge-wig': `
    <path d="M20 30C20 13 33 3 50 3s30 10 30 27c0 11-2 19-6 25H26c-4-6-6-14-6-25z" fill="#f2f2f7"/>
    <path d="M18 54c-6 12-6 27-2 37l17-4c-5-10-5-23 0-33zM82 54c6 12 6 27 2 37l-17-4c5-10 5-23 0-33z" fill="#f2f2f7"/>
    <path d="M30 21h40M27 34h46M31 46h38" stroke="#d3d3de" stroke-width="4"/>`,
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
    <path d="M20 64a30 30 0 0 1 60 0z" fill="#2b6cff"/>
    <path d="M16 64h68v10H16z" fill="#1e4fbf"/>
    <path d="M50 34V20" stroke="#e8123c" stroke-width="6"/>
    <path d="M50 16 18 6v16zM50 16l32-10v16z" fill="#ffd23f"/>
    <circle cx="50" cy="16" r="6" fill="#e8123c"/>`,
  'flat-cap': `
    <path d="M18 58c0-21 13-33 32-33s32 12 32 33z" fill="#6b6250"/>
    <path d="M6 58h88c0 9-7 13-17 13H23c-10 0-17-4-17-13z" fill="#57503f"/>`,
  'antlers': `
    <path d="M42 92C36 68 27 49 14 39c-7-5-2-15 7-11 11 6 19 18 25 33" fill="none" stroke="#7a4a22" stroke-width="8" stroke-linecap="round"/>
    <path d="M21 43 6 32M30 30 24 13" stroke="#7a4a22" stroke-width="7" stroke-linecap="round"/>
    <path d="M58 92c6-24 15-43 28-53 7-5 2-15-7-11-11 6-19 18-25 33" fill="none" stroke="#7a4a22" stroke-width="8" stroke-linecap="round"/>
    <path d="M79 43 94 32M70 30l6-17" stroke="#7a4a22" stroke-width="7" stroke-linecap="round"/>`,

  // ---- seasonal. Shown only while that LOOK is on the game — see STICKERS.
  'skull': `
    <path d="M50 5c22 0 34 15 34 35 0 12-5 21-12 26v13c0 4-3 7-7 7H35c-4 0-7-3-7-7V66c-7-5-12-14-12-26C16 20 28 5 50 5z" fill="#f2f2f7"/>
    <circle cx="35" cy="42" r="10" fill="#141420"/>
    <circle cx="65" cy="42" r="10" fill="#141420"/>
    <path d="M50 54 43 67h14z" fill="#141420"/>
    <path d="M38 74v12M50 74v12M62 74v12" stroke="#141420" stroke-width="4"/>`,
  'ghost': `
    <path d="M20 94V44a30 30 0 0 1 60 0v50l-10-9-10 9-10-9-10 9z" fill="#f2f2f7"/>
    <circle cx="39" cy="42" r="6" fill="#141420"/>
    <circle cx="61" cy="42" r="6" fill="#141420"/>
    <ellipse cx="50" cy="60" rx="7" ry="9" fill="#141420"/>`,
  'bat': `
    <ellipse cx="50" cy="50" rx="11" ry="13" fill="#141420"/>
    <path d="M44 30l-5-14 11 8 11-8-5 14z" fill="#141420"/>
    <path d="M40 44C29 29 15 25 3 30c7 4 9 11 7 17 9-2 16 2 20 9zM60 44c11-15 25-19 37-14-7 4-9 11-7 17-9-2-16 2-20 9z" fill="#141420"/>`,
  'pumpkin': `
    <ellipse cx="50" cy="60" rx="41" ry="34" fill="#ff6a1a"/>
    <path d="M50 26V12c9-4 15-1 17 3" stroke="#4a7a2a" stroke-width="7" fill="none" stroke-linecap="round"/>
    <path d="M29 49 43 44 34 60z" fill="#3a1a00"/>
    <path d="M71 49 57 44 66 60z" fill="#3a1a00"/>
    <path d="M29 70c9 9 33 9 42 0-4 11-38 11-42 0z" fill="#3a1a00"/>`,
  'santa-hat': `
    <path d="M12 66C12 37 29 17 54 17c16 0 27 8 31 19l-9 30z" fill="#e8123c"/>
    <path d="M8 66h74v15H8z" fill="#f2f2f7"/>
    <circle cx="85" cy="35" r="12" fill="#f2f2f7"/>`,
  'santa-beard': `
    <path d="M13 15s12 11 37 11 37-11 37-11c4 29 0 55-12 69-8 10-16 12-25 12s-17-2-25-12C13 70 9 44 13 15z" fill="#f2f2f7"/>
    <path d="M31 24c11 3 27 3 38 0-2 7-15 11-19 11s-17-4-19-11z" fill="#dfdfe9"/>`,
  'elf-ears': `
    <path d="M26 86C13 75 7 54 11 33c2-10 10-12 16-4 9 13 11 36 6 57z" fill="#f0c9a8"/>
    <path d="M74 86c13-11 19-32 15-53-2-10-10-12-16-4-9 13-11 36-6 57z" fill="#f0c9a8"/>
    <path d="M24 70c-6-9-8-23-6-33 1-6 5-7 8-2 5 9 5 25 1 35z" fill="#d9a97f"/>
    <path d="M76 70c6-9 8-23 6-33-1-6-5-7-8-2-5 9-5 25-1 35z" fill="#d9a97f"/>`,
  'kiss-lips': `
    <path d="M8 30c11-11 32-9 42 4 10-13 31-15 42-4-4 26-23 45-42 49C31 75 12 56 8 30z" fill="#e8123c"/>
    <path d="M11 33c15 7 63 7 78 0-2 7-6 13-11 18-17 6-39 6-56 0-5-5-9-11-11-18z" fill="#ff6b8a"/>`,
  'cupid-arrow': `
    <path d="M6 64 94 36" stroke="#8a5a2b" stroke-width="7" stroke-linecap="round"/>
    <path d="M96 36 74 26l4 12-9 9z" fill="#c8c8d0"/>
    <path d="M4 64 24 55l-2 14z" fill="#e8123c"/>`,
  'snorkel': `
    <path d="M16 34h56c6 0 10 4 10 10v14c0 8-6 14-14 14H30c-8 0-14-6-14-14z" fill="#2b6cff" opacity=".55"/>
    <path d="M16 34h56c6 0 10 4 10 10v14c0 8-6 14-14 14H30c-8 0-14-6-14-14z" fill="none" stroke="#141420" stroke-width="5"/>
    <path d="M82 46c9 0 11-7 11-15V8" fill="none" stroke="#ffd23f" stroke-width="9" stroke-linecap="round"/>`,
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
    <rect x="6" y="24" width="88" height="56" fill="#f2f2f7"/>
    <path d="M44 24h12v56H44zM6 46h88v12H6z" fill="#e8123c"/>
    <rect x="6" y="24" width="88" height="56" fill="none" stroke="#c8c8d0" stroke-width="2"/>`,
  'flag-scotland': `
    <rect x="6" y="24" width="88" height="56" fill="#1157a8"/>
    <path d="M6 24 94 80M94 24 6 80" stroke="#f2f2f7" stroke-width="12"/>`,
  'flag-wales': `
    <rect x="6" y="24" width="88" height="28" fill="#f2f2f7"/>
    <rect x="6" y="52" width="88" height="28" fill="#00963f"/>
    <path d="M28 58c-4-4-2-10 3-11 3-1 5 1 7-2 3-4 9-4 13-1 4 3 9 2 12 0l4 5-6 3 5 3-7 2 3 5-9-1 1 6-7-4-3 5-4-5-6 3 1-6-7 1z" fill="#e8123c"/>`,
  'flag-unionjack': `
    <rect x="6" y="24" width="88" height="56" fill="#1157a8"/>
    <path d="M6 24 94 80M94 24 6 80" stroke="#f2f2f7" stroke-width="14"/>
    <path d="M6 24 94 80M94 24 6 80" stroke="#e8123c" stroke-width="6"/>
    <path d="M50 24v56M6 52h88" stroke="#f2f2f7" stroke-width="20"/>
    <path d="M50 24v56M6 52h88" stroke="#e8123c" stroke-width="11"/>`,
  'flag-ireland': `
    <rect x="6" y="24" width="30" height="56" fill="#169b62"/>
    <rect x="36" y="24" width="29" height="56" fill="#f2f2f7"/>
    <rect x="65" y="24" width="29" height="56" fill="#ff883e"/>`,
  'flag-france': `
    <rect x="6" y="24" width="30" height="56" fill="#0055a4"/>
    <rect x="36" y="24" width="29" height="56" fill="#f2f2f7"/>
    <rect x="65" y="24" width="29" height="56" fill="#ef4135"/>`,
  'flag-germany': `
    <rect x="6" y="24" width="88" height="19" fill="#141420"/>
    <rect x="6" y="43" width="88" height="18" fill="#dd0000"/>
    <rect x="6" y="61" width="88" height="19" fill="#ffce00"/>`,
  'flag-italy': `
    <rect x="6" y="24" width="30" height="56" fill="#009246"/>
    <rect x="36" y="24" width="29" height="56" fill="#f2f2f7"/>
    <rect x="65" y="24" width="29" height="56" fill="#ce2b37"/>`,
  'flag-spain': `
    <rect x="6" y="24" width="88" height="14" fill="#aa151b"/>
    <rect x="6" y="38" width="88" height="28" fill="#f1bf00"/>
    <rect x="6" y="66" width="88" height="14" fill="#aa151b"/>`,
  'flag-portugal': `
    <rect x="6" y="24" width="35" height="56" fill="#046a38"/>
    <rect x="41" y="24" width="53" height="56" fill="#da291c"/>
    <circle cx="41" cy="52" r="13" fill="#f1bf00"/>
    <circle cx="41" cy="52" r="7" fill="#f2f2f7"/>`,
  'flag-netherlands': `
    <rect x="6" y="24" width="88" height="19" fill="#ae1c28"/>
    <rect x="6" y="43" width="88" height="18" fill="#f2f2f7"/>
    <rect x="6" y="61" width="88" height="19" fill="#21468b"/>`,
  'flag-sweden': `
    <rect x="6" y="24" width="88" height="56" fill="#006aa7"/>
    <path d="M6 46h88v12H6zM32 24h12v56H32z" fill="#fecc00"/>`,
  'flag-ukraine': `
    <rect x="6" y="24" width="88" height="28" fill="#0057b7"/>
    <rect x="6" y="52" width="88" height="28" fill="#ffd700"/>`,
  'flag-brazil': `
    <rect x="6" y="24" width="88" height="56" fill="#009b3a"/>
    <path d="M50 28 90 52 50 76 10 52z" fill="#fedf00"/>
    <circle cx="50" cy="52" r="14" fill="#002776"/>`,
  'flower-crown': `
    <path d="M5 68c14-17 33-25 45-25s31 8 45 25z" fill="#4a7a2a"/>
    <circle cx="17" cy="57" r="11" fill="#ff2e88"/><circle cx="17" cy="57" r="4" fill="#ffd23f"/>
    <circle cx="41" cy="45" r="12" fill="#ffd23f"/><circle cx="41" cy="45" r="4" fill="#e8123c"/>
    <circle cx="67" cy="47" r="11" fill="#ff6bd6"/><circle cx="67" cy="47" r="4" fill="#ffd23f"/>
    <circle cx="88" cy="59" r="10" fill="#4bd8ff"/><circle cx="88" cy="59" r="4" fill="#ffd23f"/>`,
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
