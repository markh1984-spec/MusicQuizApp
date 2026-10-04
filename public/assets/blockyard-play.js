/**
 * BLOCKYARD ON A PHONE — the sheet, the picture and the taps. The rules are
 * `blockyard.js`; read its header for why the game is ours from the name down.
 *
 * **NO CONTROL PANEL — YOU TAP AND IT HAPPENS**, the lobby games' rule:
 * - a ZOMBIE tapped is bopped, whatever is in your hand — two bops and it is
 *   down for a while; a zombie's touch costs one of three lives;
 * - with the PICK chosen, tap a block within reach and it is dug into the bag;
 *   tap anywhere further off and the miner walks there;
 * - with a BLOCK chosen, tap an empty space within reach and it goes down —
 *   tap a block and it goes on top — and tap the miner's own feet to be lifted
 *   up one (tap anywhere on them), which is how you climb out of a hole.
 * A laptop gets the arrow keys and space as well, because the console's
 * screens are driven from one.
 *
 * **THE WORLD IS KEPT ON THE PHONE** (`localStorage`, under the login's own
 * name) — it is a toy, so losing it to a cleared browser costs a toy, and
 * keeping it there costs the server nothing. **A frame delta never moves the
 * miner** — a capped accumulator of fixed steps, as every game here does.
 */
import { esc, node } from './client.js';
import { heart, nameTag } from './toy-tag.js';
import {
  AIR, BLOCKS, BRICK, BEDROCK, COAL, EARTH, GEM, GLASS, GOLD, GRASS, H, LEAVES, LOG, PLANKS, RECIPES, SAND, STONE, W,
  LIVES, bop, dig, get, inReach, jump, load, make, makeWorld, newPlay, overlapsPlayer, place, revive, rng, save, spawn, tick,
} from './blockyard.js';

const DT = 1 / 60;
const SAID = {
  none: 'You have none of those — dig some up first.',
  full: 'Something is there already.',
  far: 'Too far away — get closer.',
  float: 'It needs something next to it to hold it up.',
  you: 'No room — you are standing there.',
  edge: 'That is the edge of the world.',
};

/* ---- the drawings: every block is an 8x8 picture of our own, scaled up ---- */

const PAINT = {
  [GRASS]: { base: '#8a5a35', dots: ['#6f4628', '#a06b42'], top: ['#5fbf3a', '#4ea42f'] },
  [EARTH]: { base: '#8a5a35', dots: ['#6f4628', '#a06b42'] },
  [STONE]: { base: '#8b8f96', dots: ['#73777e', '#a3a7ad'] },
  [LOG]: { base: '#8b6136', stripes: '#6e4a27' },
  [LEAVES]: { base: '#3f9a3a', dots: ['#2f7d2c', '#57b350'], holes: 6 },
  [SAND]: { base: '#e2cf8f', dots: ['#cdb877', '#efe0a8'] },
  [COAL]: { base: '#8b8f96', dots: ['#73777e', '#a3a7ad'], ore: '#1d1d22' },
  [GOLD]: { base: '#8b8f96', dots: ['#73777e', '#a3a7ad'], ore: '#f2c23a' },
  [GEM]: { base: '#8b8f96', dots: ['#73777e', '#a3a7ad'], ore: '#ff5fb2' },
  [PLANKS]: { base: '#c08a4f', boards: '#9c6d3a' },
  [GLASS]: { glass: true },
  [BRICK]: { base: '#b5523b', mortar: '#d9c9b0' },
  [BEDROCK]: { base: '#3a3a3e', dots: ['#232326', '#55555b'] },
};

function texture(id) {
  const c = document.createElement('canvas');
  c.width = 8;
  c.height = 8;
  const g = c.getContext('2d');
  const p = PAINT[id];
  const r = rng(id * 97 + 13);
  const px = (x, y, colour) => { g.fillStyle = colour; g.fillRect(x, y, 1, 1); };
  if (p.glass) {
    g.fillStyle = 'rgba(200, 232, 255, 0.22)';
    g.fillRect(0, 0, 8, 8);
    g.fillStyle = '#d8f0ff';
    g.fillRect(0, 0, 8, 1); g.fillRect(0, 7, 8, 1); g.fillRect(0, 0, 1, 8); g.fillRect(7, 0, 1, 8);
    px(2, 2, '#ffffff'); px(3, 3, '#ffffff'); px(5, 2, '#eaf7ff');
    return c;
  }
  g.fillStyle = p.base;
  g.fillRect(0, 0, 8, 8);
  if (p.dots) for (let i = 0; i < 14; i++) px(Math.floor(r() * 8), Math.floor(r() * 8), p.dots[i % p.dots.length]);
  if (p.stripes) for (const x of [1, 4, 6]) { g.fillStyle = p.stripes; g.fillRect(x, 0, 1, 8); }
  if (p.boards) {
    g.fillStyle = p.boards;
    g.fillRect(0, 3, 8, 1); g.fillRect(0, 7, 8, 1);
    px(5, 0, p.boards); px(5, 1, p.boards); px(5, 2, p.boards); px(2, 4, p.boards); px(2, 5, p.boards); px(2, 6, p.boards);
  }
  if (p.mortar) {
    g.fillStyle = p.mortar;
    g.fillRect(0, 3, 8, 1); g.fillRect(0, 7, 8, 1);
    for (let y = 0; y < 3; y++) { px(3, y, p.mortar); }
    for (let y = 4; y < 7; y++) { px(7, y, p.mortar); }
  }
  if (p.ore) for (const [x, y] of [[1, 1], [2, 1], [5, 3], [6, 3], [5, 4], [2, 5], [3, 6]]) px(x, y, p.ore);
  if (p.top) {
    g.fillStyle = p.top[0];
    g.fillRect(0, 0, 8, 2);
    for (const x of [0, 3, 6]) px(x, 2, p.top[1]);
    px(4, 1, p.top[1]);
  }
  if (p.holes) for (let i = 0; i < p.holes; i++) g.clearRect(Math.floor(r() * 8), Math.floor(r() * 8), 1, 1);
  return c;
}

/**
 * The miner, as the host asked for StEvie (3 October 2026): **a goth** — a
 * black hard hat with its lamp still lit, long dark brown hair, a pale face
 * with winged eyeliner, massive square glasses and dark lipstick, a black
 * top and a black choker, a
 * black skirt over purple striped tights, and chunky boots. Drawn here, on an
 * 8 x 15 grid — 1.9 blocks tall, near enough the 1.8 the rules use — and
 * nothing like anybody else's hero.
 */
const MINER_ROWS = 15;
function drawMiner(g, x, y, t, facing, lit) {
  const u = t / 8;
  const box = (gx, gy, gw, gh, colour) => { g.fillStyle = colour; g.fillRect(x + gx * u, y + gy * u, gw * u, gh * u); };
  g.save();
  if (facing < 0) { g.translate(x * 2 + 8 * u, 0); g.scale(-1, 1); }
  box(0, 3, 3, 7, '#3a2216');      // the long dark brown hair, down her back
  box(1, 0, 6, 2, '#1c1b21');      // the hat, black
  box(0, 2, 8, 1, '#2c2a33');      // its brim
  box(5, 1, 2, 1, lit ? '#fffbd0' : '#f5e27a'); // the lamp, still lit
  box(3, 3, 4, 3, '#f2e6e2');      // a pale face
  box(3, 3, 2, 1, '#3a2216');      // the fringe under the brim
  box(5, 4, 1, 1, '#121116');      // eye, lined
  box(6, 4, 1, 1, '#121116');      // and the wing of the eyeliner
  // MASSIVE SQUARE GLASSES (the host, 4 October 2026): a big tinted lens in a
  // thick black frame, sticking out past the face, and the arm back to the ear.
  box(3.9, 3.05, 3.6, 1.95, 'rgba(190, 225, 255, 0.35)');
  box(3.9, 3.05, 3.6, 0.35, '#111014');
  box(3.9, 4.65, 3.6, 0.35, '#111014');
  box(3.9, 3.05, 0.35, 1.95, '#111014');
  box(7.15, 3.05, 0.35, 1.95, '#111014');
  box(2.4, 3.7, 1.5, 0.3, '#111014');
  box(4.4, 3.45, 0.5, 0.25, 'rgba(255, 255, 255, 0.8)'); // a glint
  box(6, 5, 1, 1, '#4a1430');      // dark lipstick
  box(3, 6, 4, 1, '#121116');      // a black choker
  box(5, 6, 1, 1, '#c9ced6');      // its silver charm
  box(2, 7, 5, 3, '#1d1c22');      // black top
  box(7, 7, 1, 2, '#1d1c22');      // the near arm
  box(7, 9, 1, 1, '#f2e6e2');      // hand
  box(1, 10, 6, 2, '#26242b');     // black skirt
  box(2, 11, 4, 1, '#3a3640');     // its hem
  box(1, 12, 2, 1, '#6a2f86');     // striped tights
  box(5, 12, 2, 1, '#6a2f86');
  box(1, 13, 2, 2, '#121116');     // chunky boots
  box(5, 13, 2, 2, '#121116');
  box(2, 13, 1, 1, '#c9ced6');     // a buckle each
  box(6, 13, 1, 1, '#c9ced6');
  g.restore();
}

/**
 * A ZOMBIE, on the miner's own 8 x 15 grid: ashen skin, a torn red-brown
 * shirt, dark trousers, both arms out in front. A generic shambler, drawn
 * here; the names on their tags are the joke.
 */
function drawZombie(g, x, y, t, facing, frame) {
  const u = t / 8;
  const box = (gx, gy, gw, gh, colour) => { g.fillStyle = colour; g.fillRect(x + gx * u, y + gy * u, gw * u, gh * u); };
  const sway = Math.round(Math.sin(frame * 4) * 0.6);
  g.save();
  if (facing < 0) { g.translate(x * 2 + 8 * u, 0); g.scale(-1, 1); }
  box(2, 1, 5, 1, '#3b3326');          // scraggy hair
  box(2, 2, 5, 4, '#a3b39a');          // ashen face
  box(4, 3, 1, 1, '#2b2420');          // hollow eyes
  box(6, 3, 1, 1, '#2b2420');
  box(4, 5, 3, 1, '#5d4a44');          // a mouth hanging open
  box(2, 6, 5, 4, '#7a3b2e');          // a torn shirt
  box(3, 8, 1, 1, '#a3b39a');          // skin through the rip
  box(5, 9, 2, 1, '#5e2c22');
  box(6, 6 + sway, 4, 1, '#7a3b2e');   // both arms out in front
  box(9, 6 + sway, 1, 1, '#a3b39a');   // hands
  box(6, 7 - sway, 4, 1, '#6a3226');
  box(9, 7 - sway, 1, 1, '#a3b39a');
  box(2, 10, 5, 3, '#3c3c44');         // trousers
  box(4, 11, 1, 2, '#2e2e35');
  box(2, 13, 2, 2, '#2a2522');         // feet
  box(5, 13, 2, 2, '#2a2522');
  g.restore();
}

/** A small swatch of a block for the bag — the same 8x8 picture. */
function swatch(tex) {
  const c = document.createElement('canvas');
  c.width = 8;
  c.height = 8;
  c.className = 'by-swatch';
  c.getContext('2d').drawImage(tex, 0, 0);
  return c;
}

const PICK_ICON = '<svg class="by-swatch" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 5 Q8 0 14 5 L13 6 Q8 2.5 3 6 Z" fill="#c9ced6"/><rect x="7" y="4" width="2" height="11" rx="1" fill="#9c6d3a"/></svg>';

/**
 * Open the game over the page. `who` names the save, so two logins on one
 * phone keep two worlds.
 */
export function openBlockyard({ who = 'you', hero = '' } = {}) {
  if (document.querySelector('.toy-sheet')) return null;
  const key = `musicquiz.blockyard.${String(who).toLowerCase()}`;
  let state = null;
  try { state = load(localStorage.getItem(key) || ''); } catch { /* a private window plays a fresh world */ }
  if (!state) {
    const world = makeWorld(Math.floor(Math.random() * 1e9));
    state = { world, bag: {}, p: spawn(world) };
  }
  let { world, bag, p } = state;
  // THE ZOMBIES AND THE LIVES are a round of play, never saved: a world comes
  // back as it was left, and the zombies get up again somewhere new.
  let play = newPlay(world, p, world.seed || 1);
  let pops = [];
  const pop = (text, wx, wy, bad = false) => pops.push({ text, x: wx, y: wy, bad, at: performance.now() });
  const tex = {};
  for (const b of BLOCKS) if (b.id !== AIR) tex[b.id] = texture(b.id);

  const sheet = node(`<div class="toy-sheet" role="dialog" aria-label="Blockyard${hero ? `, playing as ${esc(hero)}` : ''}">
      <div class="toy-top"><b class="toy-name">Blockyard</b>
        <span class="tiny toy-said" role="status">Tap a block to dig it. Tap further off to walk.</span>
        <button class="gal-save by-make-btn" type="button" aria-expanded="false">Make</button>
        <button class="gal-save toy-close" type="button">Close</button></div>
      <div class="by-make" hidden></div>
      <canvas class="toy-canvas"></canvas>
      <div class="by-bar" role="toolbar" aria-label="What to use"></div>
    </div>`);
  const canvas = sheet.querySelector('canvas');
  const g = canvas.getContext('2d');
  const said = sheet.querySelector('.toy-said');
  const bar = sheet.querySelector('.by-bar');
  const makeBox = sheet.querySelector('.by-make');
  let tool = 'pick';
  let flash = null;
  let hover = null;
  let running = true;
  let saveTimer = null;

  const say = (text) => { said.textContent = text; };
  const keep = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { try { localStorage.setItem(key, save(world, bag, p)); } catch { /* full or private: the toy forgets */ } }, 400);
  };

  function paintBar() {
    const slots = [`<button class="by-slot${tool === 'pick' ? ' is-on' : ''}" type="button" data-tool="pick" aria-label="Dig" aria-pressed="${tool === 'pick'}">${PICK_ICON}<span class="by-n">Dig</span></button>`];
    bar.innerHTML = slots.join('');
    const have = BLOCKS.filter((b) => (bag[b.id] || 0) > 0);
    if (tool !== 'pick' && !(bag[tool] > 0)) tool = 'pick';
    for (const b of have) {
      const btn = node(`<button class="by-slot${tool === b.id ? ' is-on' : ''}" type="button" data-tool="${b.id}" aria-label="${b.name}, ${bag[b.id]}" aria-pressed="${tool === b.id}"><span class="by-n">${bag[b.id]}</span></button>`);
      btn.prepend(swatch(tex[b.id]));
      bar.appendChild(btn);
    }
    if (!have.length) bar.appendChild(node('<span class="tiny by-empty">Your bag is empty — dig something up.</span>'));
    bar.querySelector('.by-slot').classList.toggle('is-on', tool === 'pick');
    paintMake();
  }

  function paintMake() {
    makeBox.replaceChildren(...RECIPES.map((r) => {
      const btn = node(`<button class="gal-save by-recipe" type="button">${r.label}</button>`);
      btn.disabled = !((bag[r.from] || 0) >= r.need);
      btn.addEventListener('click', () => {
        if (make(bag, r.id)) { say(`Made ${r.count} ${BLOCKS[r.makes].name.toLowerCase()}.`); keep(); paintBar(); }
      });
      return btn;
    }), (() => {
      // A fresh world is two presses: the old one cannot be got back.
      const btn = node('<button class="gal-save by-new" type="button">New world</button>');
      btn.addEventListener('click', () => {
        if (!btn.dataset.armed) {
          btn.dataset.armed = '1';
          btn.textContent = 'Press again — this one goes';
          setTimeout(() => { delete btn.dataset.armed; btn.textContent = 'New world'; }, 3000);
          return;
        }
        world = makeWorld(Math.floor(Math.random() * 1e9));
        bag = {};
        p = spawn(world);
        play = newPlay(world, p, world.seed);
        tool = 'pick';
        keep();
        paintBar();
        say('A new world. Off you go.');
      });
      return btn;
    })());
  }

  bar.addEventListener('click', (ev) => {
    const slot = ev.target.closest('.by-slot');
    if (!slot) return;
    tool = slot.dataset.tool === 'pick' ? 'pick' : Number(slot.dataset.tool);
    say(tool === 'pick' ? 'Tap a block to dig it.' : `Tap a space to put ${BLOCKS[tool].name.toLowerCase()} down. Tap yourself to climb.`);
    paintBar();
  });
  sheet.querySelector('.by-make-btn').addEventListener('click', (ev) => {
    makeBox.hidden = !makeBox.hidden;
    ev.currentTarget.setAttribute('aria-expanded', String(!makeBox.hidden));
    paintMake();
  });

  /* ---- the view ---- */
  let cssW = 0;
  let cssH = 0;
  let T = 32;
  function fit() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cssW = canvas.clientWidth;
    cssH = canvas.clientHeight;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.imageSmoothingEnabled = false;
    T = Math.max(22, Math.min(48, Math.floor(Math.min(cssW / 15, cssH / 10))));
  }
  const camera = () => {
    const cx = Math.max(0, Math.min(W * T - cssW, p.x * T - cssW / 2));
    const cy = Math.max(-T * 4, Math.min(H * T - cssH, (p.y - 0.9) * T - cssH / 2));
    return { cx, cy };
  };

  function draw() {
    const { cx, cy } = camera();
    const sky = g.createLinearGradient(0, 0, 0, cssH);
    sky.addColorStop(0, '#76c3ef');
    sky.addColorStop(1, '#cdeefc');
    g.fillStyle = sky;
    g.fillRect(0, 0, cssW, cssH);
    const x0 = Math.max(0, Math.floor(cx / T));
    const x1 = Math.min(W - 1, Math.ceil((cx + cssW) / T));
    const y0 = Math.max(0, Math.floor(cy / T));
    const y1 = Math.min(H - 1, Math.ceil((cy + cssH) / T));
    const eyeX = p.x;
    const eyeY = p.y - 1.4;
    for (let x = x0; x <= x1; x++) {
      const ground = world.surface[x];
      // Behind anything dug out: the earth wall, so a hole reads as a hole.
      const back = Math.max(ground + 1, y0) * T - cy;
      g.fillStyle = '#3d2c20';
      g.fillRect(x * T - cx, back, T + 1, cssH - back + T);
      for (let y = y0; y <= y1; y++) {
        const id = get(world, x, y);
        const sx = x * T - cx;
        const sy = y * T - cy;
        if (id !== AIR) g.drawImage(tex[id], sx, sy, T, T);
        // DEEPER IS DARKER, and the hat lamp lifts it round the miner.
        const deep = y - ground - 3;
        if (deep > 0) {
          const near = Math.hypot(x + 0.5 - eyeX, y + 0.5 - eyeY);
          const a = Math.min(0.72, deep * 0.04) * Math.min(1, Math.max(0.15, (near - 1.5) / 5));
          g.fillStyle = `rgba(6, 4, 10, ${a.toFixed(3)})`;
          g.fillRect(sx, sy, T, T);
        }
      }
    }
    for (const z of play.zombies) {
      if (z.dead || Math.abs(z.x - p.x) * T > cssW) continue;
      drawZombie(g, (z.x - 0.5) * T - cx, (z.y - MINER_ROWS / 8) * T - cy, T, z.facing, play.t);
      // Close to StEvie, its tag goes up a row so the two names never overlap.
      const lift = Math.abs(z.x - p.x) < 2.8 && Math.abs(z.y - p.y) < 2 ? 30 : 0;
      nameTag(g, z.name, z.x * T - cx, (z.y - MINER_ROWS / 8) * T - cy - 4 - lift, cssW, { bright: true });
    }
    // AFTER A HIT STEVIE BLINKS for as long as nothing can hurt her.
    g.globalAlpha = play.t < play.safeUntil && Math.floor(play.t * 12) % 2 === 0 ? 0.35 : 1;
    drawMiner(g, (p.x - 0.5) * T - cx, (p.y - MINER_ROWS / 8) * T - cy, T, p.facing, p.y > world.surface[Math.floor(p.x)] + 3);
    g.globalAlpha = 1;
    nameTag(g, hero, p.x * T - cx, (p.y - MINER_ROWS / 8) * T - cy - 4, cssW);
    // words that float up off a bop or a hit
    const now = performance.now();
    pops = pops.filter((pp) => now - pp.at < 1200);
    for (const pp of pops) {
      const k = (now - pp.at) / 1200;
      g.globalAlpha = 1 - k * k;
      g.font = `800 ${Math.max(18, Math.round(0.6 * T))}px system-ui, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineWidth = 4;
      g.lineJoin = 'round';
      g.strokeStyle = '#2a1410';
      const px = Math.max(80, Math.min(cssW - 80, pp.x * T - cx));
      const py = (pp.y - k * 1.2) * T - cy;
      g.strokeText(pp.text, px, py);
      g.fillStyle = pp.bad ? '#ff6b6b' : '#ffffff';
      g.fillText(pp.text, px, py);
      g.globalAlpha = 1;
    }
    // THE LIVES, three hearts top left
    for (let i = 0; i < LIVES; i++) heart(g, 22 + i * 28, 22, 10, i < play.lives);
    if (play.down) {
      const top = cssH * 0.3;
      g.fillStyle = 'rgba(8, 8, 14, 0.7)';
      g.fillRect(0, top, cssW, 120);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = '#ffffff';
      g.font = '800 26px system-ui, sans-serif';
      g.fillText('Out of lives!', cssW / 2, top + 34);
      g.font = '600 16px system-ui, sans-serif';
      g.fillText(`${play.hurtBy} got ${hero || 'you'}.`, cssW / 2, top + 68);
      g.fillText('Tap to get up again — your world is still here', cssW / 2, top + 98, cssW - 24);
    }
    const mark = flash && flash.until > performance.now() ? flash : hover;
    if (mark) {
      g.lineWidth = 2;
      g.strokeStyle = mark.ok ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 90, 90, 0.85)';
      g.strokeRect(mark.x * T - cx + 1, mark.y * T - cy + 1, T - 2, T - 2);
    }
  }

  /* ---- taps ---- */
  const cellAt = (ev) => {
    const rect = canvas.getBoundingClientRect();
    const { cx, cy } = camera();
    return { x: Math.floor((ev.clientX - rect.left + cx) / T), y: Math.floor((ev.clientY - rect.top + cy) / T) };
  };
  const mark = (c, ok) => { flash = { ...c, ok, until: performance.now() + 350 }; };
  const walkTo = (c) => { p.targetX = Math.max(0.5, Math.min(W - 0.5, c.x + 0.5)); };

  function tap(c) {
    // DOWN, a tap gets StEvie up again: three lives, at the start.
    if (play.down) {
      revive(world, p, play);
      say('Back on your feet. Watch out for the zombies.');
      return;
    }
    // A ZOMBIE TAPPED IS BOPPED, whatever is in your hand — two bops and it
    // is down for a while.
    const z = play.zombies.find((zz) => !zz.dead && Math.abs(zz.x - (c.x + 0.5)) <= 0.9 && c.y >= Math.floor(zz.y - 2) && c.y <= Math.floor(zz.y));
    if (z) {
      const res = bop(play, p, z);
      if (res === 'down') { say(`${z.name} is down!`); pop(`Bopped ${z.name}!`, z.x, z.y - 2.4); return; }
      if (res === 'hit') { say(`Bopped ${z.name} — once more!`); pop('Bop!', z.x, z.y - 2.4); return; }
      walkTo(c);
      return;
    }
    const id = get(world, c.x, c.y);
    if (tool === 'pick') {
      if (id !== AIR && inReach(p, c.x, c.y)) {
        const got = dig(world, bag, p, c.x, c.y);
        if (got) { mark(c, true); say(`+1 ${BLOCKS[got].name.toLowerCase()}`); keep(); paintBar(); }
        else { mark(c, false); say('That one is too hard to dig.'); }
        return;
      }
      walkTo(c);
      return;
    }
    // A block tapped while building means "on top of this one" — and the
    // miner tapped anywhere means "under my feet": a thumb finds a whole
    // person far more easily than the one square their boots are in.
    let at = c;
    if (overlapsPlayer(p, c.x, c.y)) at = { x: Math.floor(p.x), y: Math.floor(p.y) - 1 };
    else if (id !== AIR && inReach(p, c.x, c.y - 1) && get(world, c.x, c.y - 1) === AIR) at = { x: c.x, y: c.y - 1 };
    if (get(world, at.x, at.y) === AIR && (inReach(p, at.x, at.y) || overlapsPlayer(p, at.x, at.y))) {
      const why = place(world, bag, p, at.x, at.y, tool);
      mark(at, !why);
      if (why) say(SAID[why] || 'That will not go there.');
      else { say(`${bag[tool] || 0} ${BLOCKS[tool].name.toLowerCase()} left.`); keep(); paintBar(); }
      return;
    }
    walkTo(c);
  }

  let down = null;
  canvas.addEventListener('pointerdown', (ev) => { down = { x: ev.clientX, y: ev.clientY, t: performance.now() }; });
  canvas.addEventListener('pointerup', (ev) => {
    if (!down) return;
    const moved = Math.hypot(ev.clientX - down.x, ev.clientY - down.y);
    down = null;
    if (moved < 14) tap(cellAt(ev));
  });
  canvas.addEventListener('pointermove', (ev) => {
    if (ev.pointerType !== 'mouse') return;
    const c = cellAt(ev);
    hover = { ...c, ok: inReach(p, c.x, c.y) };
  });
  canvas.addEventListener('pointerleave', () => { hover = null; });

  const onKey = (ev) => {
    if (ev.key === 'Escape' && ev.type === 'keydown') return close();
    const dir = { ArrowLeft: -1, a: -1, ArrowRight: 1, d: 1 }[ev.key];
    if (dir) { p.held = ev.type === 'keydown' ? dir : (p.held === dir ? 0 : p.held); ev.preventDefault(); }
    if (ev.type === 'keydown' && (ev.key === ' ' || ev.key === 'ArrowUp' || ev.key === 'w')) { jump(p); ev.preventDefault(); }
  };
  document.addEventListener('keydown', onKey);
  document.addEventListener('keyup', onKey);

  /* ---- the loop: fixed steps from a capped accumulator ---- */
  let last = performance.now();
  let acc = 0;
  let lastKept = { x: p.x, y: p.y };
  const frame = (now) => {
    if (!running) return;
    acc = Math.min(0.25, acc + (now - last) / 1000);
    last = now;
    while (acc >= DT) {
      const got = tick(world, p, play, DT);
      if (got) {
        if (play.down) say(`Out of lives — ${got.name} got you. Tap to get up again.`);
        else say(`Ouch! ${got.name} got you — ${play.lives} ${play.lives === 1 ? 'life' : 'lives'} left.`);
        pop(play.down ? 'Out of lives!' : `-1 life`, p.x, p.y - 2.4, true);
      }
      acc -= DT;
    }
    if (Math.abs(p.x - lastKept.x) + Math.abs(p.y - lastKept.y) > 3) { lastKept = { x: p.x, y: p.y }; keep(); }
    draw();
    requestAnimationFrame(frame);
  };

  // THE PICTURE IS MEASURED WHENEVER ITS BOX CHANGES, not once: the bar
  // filling in, the Make row opening or a phone turning all resize it, and a
  // canvas sized for the old box is stretched into the new one — every tap
  // then lands a row away from the block it was aimed at.
  const sizer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => fit()) : null;
  const onResize = () => fit();
  window.addEventListener('resize', onResize);
  function close() {
    running = false;
    clearTimeout(saveTimer);
    try { localStorage.setItem(key, save(world, bag, p)); } catch { /* the toy forgets */ }
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('keyup', onKey);
    window.removeEventListener('resize', onResize);
    if (sizer) sizer.disconnect();
    sheet.remove();
  }
  sheet.querySelector('.toy-close').addEventListener('click', close);

  document.body.appendChild(sheet);
  paintBar();
  fit();
  if (sizer) sizer.observe(canvas);
  requestAnimationFrame((t) => { last = t; frame(t); });
  return { close, state: () => ({ world, bag, p, play }) };
}
