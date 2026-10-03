/**
 * WALKIES ON A PHONE — the sheet, the park and the dog. The rules are
 * `walkies.js`; read its header for why the dog is ours.
 *
 * **ONE TAP JUMPS, ANYWHERE ON THE PICTURE** — and space or the up arrow on a
 * laptop. The first tap starts the walk; after a crash the next tap waits a
 * moment, so the tap that was meant as a jump does not throw away the score
 * screen. **The best score is kept on the phone**, under the login's name.
 * **A frame delta never moves the dog** — fixed steps from a capped
 * accumulator, as every game here does.
 */
import { esc, node } from './client.js';
import { nameTag } from './toy-tag.js';
import { DOG, LEAD, WALK_LENGTH, jump, metresLeft, newWalk, score, step, walkerHeight } from './walkies.js';

const DT = 1 / 60;
/** Where the dog runs, metres from the left — room behind it for the walker. */
const SEE_BEHIND = 2.3;

/* ---- the drawings, all of them ours ---- */

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/**
 * A German Shepherd and Husky cross, facing right — the host's call for
 * Tabby (3 October 2026): the shepherd's dark saddle over tan, the husky's
 * white face mask, ice-blue eyes and a bushy tail curled over the back, and
 * the upright ears they both have. `x, y` is where its paws meet the ground.
 */
const COAT = { tan: '#c98f52', saddle: '#2e2d33', cream: '#f3ece0', leg: '#d4a26a', mask: '#3a3940', eye: '#8fd3f4' };

function drawDog(g, x, y, u, t, running, inAir) {
  const at = (dx, dy) => [x + dx * u, y - dy * u];
  const blob = (dx, dy, rx, ry, colour) => {
    g.fillStyle = colour;
    g.beginPath();
    g.ellipse(x + dx * u, y - dy * u, rx * u, ry * u, 0, 0, Math.PI * 2);
    g.fill();
  };
  const leg = (lx, phase, colour) => {
    const swing = inAir ? 0.12 : running ? Math.sin(t * 18 + phase) * 0.14 : 0;
    g.strokeStyle = colour;
    g.lineWidth = 0.13 * u;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(...at(lx, 0.38));
    g.lineTo(...at(lx + swing, inAir ? 0.12 : 0.04));
    g.stroke();
  };
  // the far legs a shade darker, so four read as four
  leg(0.42, Math.PI, '#b8854f'); leg(0.92, 0, '#b8854f');
  // the tail: a husky's bushy curl over the back, dark above, white beneath
  const wag = Math.sin(t * 12) * 0.08;
  g.lineCap = 'round';
  g.strokeStyle = COAT.saddle;
  g.lineWidth = 0.2 * u;
  g.beginPath();
  g.moveTo(...at(0.22, 0.62));
  g.bezierCurveTo(...at(-0.05, 0.85 + wag), ...at(0.05, 1.12 + wag), ...at(0.38, 1.0 + wag));
  g.stroke();
  g.strokeStyle = COAT.cream;
  g.lineWidth = 0.09 * u;
  g.beginPath();
  g.moveTo(...at(0.16, 0.72));
  g.bezierCurveTo(...at(0.0, 0.86 + wag), ...at(0.08, 1.04 + wag), ...at(0.34, 0.96 + wag));
  g.stroke();
  // body: tan, the dark saddle across the back, a cream belly and chest
  g.fillStyle = COAT.tan;
  roundRect(g, x + 0.12 * u, y - 0.8 * u, 0.98 * u, 0.46 * u, 0.21 * u);
  g.fill();
  g.fillStyle = COAT.saddle;
  roundRect(g, x + 0.18 * u, y - 0.82 * u, 0.7 * u, 0.24 * u, 0.12 * u);
  g.fill();
  blob(0.62, 0.38, 0.3, 0.07, COAT.cream);
  blob(0.98, 0.52, 0.15, 0.17, COAT.cream);
  leg(0.32, 0, COAT.leg); leg(0.82, Math.PI, COAT.leg);
  // the head: the dark cap and the white mask, a longer shepherd's muzzle
  blob(1.06, 0.95, 0.25, 0.24, COAT.mask);
  blob(1.1, 0.88, 0.2, 0.15, COAT.cream);
  g.fillStyle = COAT.cream;
  roundRect(g, x + 1.12 * u, y - 0.95 * u, 0.36 * u, 0.15 * u, 0.07 * u);
  g.fill();
  g.fillStyle = COAT.mask;
  roundRect(g, x + 1.14 * u, y - 1.02 * u, 0.24 * u, 0.08 * u, 0.04 * u);
  g.fill();
  g.fillStyle = '#1d1b20';
  g.beginPath();
  g.arc(...at(1.47, 0.89), 0.06 * u, 0, Math.PI * 2);
  g.fill();
  // ice-blue eye, white brow spot over it
  blob(1.11, 1.06, 0.045, 0.035, COAT.cream);
  blob(1.12, 0.99, 0.05, 0.05, COAT.eye);
  blob(1.13, 0.99, 0.022, 0.022, '#1d1b20');
  // two upright ears, tilted back a touch in the air
  const tilt = inAir ? 0.06 : running ? Math.sin(t * 18) * 0.015 : 0;
  for (const [ex, colour] of [[0.92, '#26252b'], [1.04, COAT.mask]]) {
    g.fillStyle = colour;
    g.beginPath();
    g.moveTo(...at(ex, 1.1));
    g.lineTo(...at(ex + 0.07 - tilt, 1.42));
    g.lineTo(...at(ex + 0.15, 1.1));
    g.closePath();
    g.fill();
  }
  g.fillStyle = '#e8c9b4';
  g.beginPath();
  g.moveTo(...at(1.08, 1.13));
  g.lineTo(...at(1.11 - tilt, 1.33));
  g.lineTo(...at(1.15, 1.13));
  g.closePath();
  g.fill();
  // red collar and a gold tag
  g.fillStyle = '#e0403a';
  g.fillRect(x + 0.9 * u, y - 0.82 * u, 0.1 * u, 0.24 * u);
  g.fillStyle = '#f2c23a';
  g.beginPath();
  g.arc(...at(0.96, 0.56), 0.05 * u, 0, Math.PI * 2);
  g.fill();
}

/**
 * The person on the other end of the lead, facing right: a ponytail, a purple
 * hoodie, jeans and trainers. Their name is the login's own, on a tag above.
 * `cx, y` is the middle of their feet on the ground. Answers where the hand is.
 */
function drawWalker(g, cx, y, u, t, running, inAir) {
  const at = (dx, dy) => [cx + dx * u, y - dy * u];
  const stroke = (colour, width, from, to) => {
    g.strokeStyle = colour;
    g.lineWidth = width * u;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(...at(...from));
    g.lineTo(...at(...to));
    g.stroke();
  };
  const swing = inAir ? 0.16 : running ? Math.sin(t * 13) * 0.2 : 0;
  // legs and trainers, the far one a shade darker
  stroke('#2a4068', 0.14, [0, 0.82], [-swing, inAir ? 0.16 : 0.06]);
  stroke('#34507e', 0.14, [0, 0.82], [swing, inAir ? 0.2 : 0.06]);
  for (const [fx, fy] of [[-swing, inAir ? 0.12 : 0.03], [swing, inAir ? 0.16 : 0.03]]) {
    g.fillStyle = '#f4f4f6';
    g.beginPath();
    g.ellipse(cx + (fx + 0.06) * u, y - fy * u, 0.11 * u, 0.05 * u, 0, 0, Math.PI * 2);
    g.fill();
  }
  // the far arm swinging, the hoodie, the near arm out to the lead
  stroke('#5f3ba8', 0.11, [0, 1.22], [-0.12 - swing * 0.4, 0.98]);
  g.fillStyle = '#7a4fd0';
  roundRect(g, cx - 0.17 * u, y - 1.32 * u, 0.34 * u, 0.54 * u, 0.12 * u);
  g.fill();
  stroke('#7a4fd0', 0.11, [0.06, 1.22], [0.3, 1.02]);
  g.fillStyle = '#f1c8a0';
  g.beginPath();
  g.arc(...at(0.32, 1.02), 0.05 * u, 0, Math.PI * 2);
  g.fill();
  // head, hair and a bouncing ponytail
  g.beginPath();
  g.arc(...at(0.03, 1.46), 0.14 * u, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#6b4024';
  g.beginPath();
  g.arc(...at(0.0, 1.5), 0.145 * u, Math.PI * 0.95, Math.PI * 2.05);
  g.fill();
  const bob = running ? Math.sin(t * 13) * 0.04 : 0;
  g.beginPath();
  g.ellipse(cx - 0.17 * u, y - (1.38 + bob) * u, 0.07 * u, 0.15 * u, 0.5, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#2a1d14';
  g.beginPath();
  g.arc(...at(0.1, 1.46), 0.02 * u, 0, Math.PI * 2);
  g.fill();
  return at(0.32, 1.02);
}

/** Text that fits a width: the size is stepped down until it does. */
function fitText(g, text, x, y, maxW, size, weight = 800) {
  let px = size;
  do { g.font = `${weight} ${px}px system-ui, sans-serif`; px -= 1; } while (g.measureText(text).width > maxW && px > 11);
  g.fillText(text, x, y);
}

/**
 * A ROAD SIGN BY THE PATH, every hundred metres — brown, like the signs to
 * places you visit, and big enough to read going past: *"500 metres to The
 * Station Tap"* (the host, 3 October 2026). `sx` is its left post.
 */
function drawSign(g, sx, gy, u, text) {
  const px = Math.max(15, Math.round(0.36 * u));
  g.font = `700 ${px}px system-ui, sans-serif`;
  const w = g.measureText(text).width + px * 1.4;
  const h = px * 2;
  const top = gy - 2.25 * u - h;  // above the walker's and the dog's name tags
  g.fillStyle = '#8a8f98';
  g.fillRect(sx + w * 0.18, top + h - 2, 0.1 * u, gy - top - h + 2);
  g.fillRect(sx + w * 0.78, top + h - 2, 0.1 * u, gy - top - h + 2);
  g.fillStyle = '#7a4a22';
  roundRect(g, sx, top, w, h, 0.1 * u);
  g.fill();
  g.strokeStyle = '#ffffff';
  g.lineWidth = 2;
  roundRect(g, sx + 4, top + 4, w - 8, h - 8, 0.07 * u);
  g.stroke();
  g.fillStyle = '#ffffff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, sx + w / 2, top + h / 2 + 1);
}

/** The arch at the end of the walk, the place's name across the top. */
function drawArch(g, sx, gy, u, name) {
  const span = 2.6 * u;
  g.fillStyle = '#2f6b3a';
  g.fillRect(sx, gy - 2.4 * u, 0.16 * u, 2.4 * u);
  g.fillRect(sx + span, gy - 2.4 * u, 0.16 * u, 2.4 * u);
  g.fillStyle = '#f2c23a';
  roundRect(g, sx - 0.25 * u, gy - 2.95 * u, span + 0.66 * u, 0.6 * u, 0.12 * u);
  g.fill();
  g.fillStyle = '#2a1d14';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  fitText(g, name, sx + span / 2 + 0.08 * u, gy - 2.64 * u, span + 0.5 * u, Math.round(0.32 * u));
}

function drawThing(g, o, sx, gy, u) {
  const w = o.w * u;
  const h = o.h * u;
  if (o.kind === 'bin') {
    g.fillStyle = '#2f7d4a';
    roundRect(g, sx + 0.05 * u, gy - h + 0.12 * u, w - 0.1 * u, h - 0.12 * u, 0.06 * u);
    g.fill();
    g.fillStyle = '#245f38';
    g.fillRect(sx, gy - h, w, 0.14 * u);
    g.fillStyle = '#1b1b1b';
    g.beginPath();
    g.arc(sx + 0.18 * u, gy - 0.06 * u, 0.07 * u, 0, Math.PI * 2);
    g.fill();
  } else if (o.kind === 'bench') {
    g.fillStyle = '#3a3a3e';
    g.fillRect(sx + 0.1 * u, gy - h * 0.6, 0.1 * u, h * 0.6);
    g.fillRect(sx + w - 0.2 * u, gy - h * 0.6, 0.1 * u, h * 0.6);
    g.fillStyle = '#a5703f';
    for (const k of [0.62, 0.78]) g.fillRect(sx, gy - h * k - 0.08 * u, w, 0.1 * u);
    g.fillRect(sx, gy - h, w, 0.1 * u);
  } else if (o.kind === 'puddle') {
    g.fillStyle = '#5aa7d8';
    g.beginPath();
    g.ellipse(sx + w / 2, gy - 0.02 * u, w / 2, 0.12 * u, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255, 255, 255, 0.55)';
    g.fillRect(sx + w * 0.3, gy - 0.07 * u, w * 0.25, 0.03 * u);
  } else if (o.kind === 'cat') {
    // A grumpy grey cat, sitting very still, not moving for anybody.
    g.fillStyle = '#7d7f88';
    g.beginPath();
    g.ellipse(sx + w * 0.45, gy - h * 0.32, w * 0.36, h * 0.32, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(sx + w * 0.38, gy - h * 0.72, w * 0.24, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(sx + w * 0.2, gy - h * 0.8); g.lineTo(sx + w * 0.24, gy - h); g.lineTo(sx + w * 0.34, gy - h * 0.88);
    g.moveTo(sx + w * 0.42, gy - h * 0.88); g.lineTo(sx + w * 0.52, gy - h); g.lineTo(sx + w * 0.56, gy - h * 0.8);
    g.fill();
    g.strokeStyle = '#7d7f88';
    g.lineWidth = 0.08 * u;
    g.beginPath();
    g.moveTo(sx + w * 0.75, gy - h * 0.15);
    g.quadraticCurveTo(sx + w, gy - h * 0.2, sx + w * 0.9, gy - h * 0.55);
    g.stroke();
    g.fillStyle = '#f2c23a';
    g.fillRect(sx + w * 0.26, gy - h * 0.76, w * 0.08, h * 0.05);
    g.fillRect(sx + w * 0.42, gy - h * 0.76, w * 0.08, h * 0.05);
  }
}

/**
 * A bone. BIGGER THAN IT WAS, WITH A DARK EDGE AND A GOLD GLOW — the host:
 * *"make it so the bones are more obvious"*; white on a pale sky was nearly
 * invisible. `glow` is off for the little one in the score box.
 */
function drawBone(g, cx, cy, u, glow = true) {
  if (glow) {
    const halo = g.createRadialGradient(cx, cy, 0, cx, cy, 0.55 * u);
    halo.addColorStop(0, 'rgba(255, 214, 64, 0.55)');
    halo.addColorStop(1, 'rgba(255, 214, 64, 0)');
    g.fillStyle = halo;
    g.beginPath();
    g.arc(cx, cy, 0.55 * u, 0, Math.PI * 2);
    g.fill();
  }
  const shape = () => {
    g.beginPath();
    g.rect(cx - 0.3 * u, cy - 0.08 * u, 0.6 * u, 0.16 * u);
    for (const [dx, dy] of [[-0.3, -0.09], [-0.3, 0.09], [0.3, -0.09], [0.3, 0.09]]) {
      g.moveTo(cx + dx * u + 0.12 * u, cy + dy * u);
      g.arc(cx + dx * u, cy + dy * u, 0.12 * u, 0, Math.PI * 2);
    }
  };
  g.lineJoin = 'round';
  g.strokeStyle = '#5a3a1a';
  g.lineWidth = Math.max(2, 0.07 * u);
  shape();
  g.stroke();
  g.fillStyle = '#fffaf0';
  shape();
  g.fill();
}

export function openWalkies({ who = 'you', hero = '' } = {}) {
  // The walker is the login: their own username on the tag, never one written here.
  const walker = who === 'you' ? '' : String(who);
  if (document.querySelector('.toy-sheet')) return null;
  const key = `musicquiz.walkies.${String(who).toLowerCase()}`;
  let best = 0;
  try { best = Number(localStorage.getItem(key)) || 0; } catch { /* a private window starts from nought */ }
  let walk = newWalk(Math.floor(Math.random() * 1e9));
  let pops = [];
  let endedAt = 0;

  const sheet = node(`<div class="toy-sheet" role="dialog" aria-label="Walkies${hero ? `, playing as ${esc(hero)}` : ''}">
      <div class="toy-top"><b class="toy-name">Walkies</b>
        <button class="gal-save toy-close" type="button">Close</button>
        <span class="tiny toy-said" role="status">Tap to jump. Tap again in the air for one more hop.</span></div>
      <canvas class="toy-canvas" aria-label="The park"></canvas>
    </div>`);
  const canvas = sheet.querySelector('canvas');
  const g = canvas.getContext('2d');
  const said = sheet.querySelector('.toy-said');

  let cssW = 0;
  let cssH = 0;
  let u = 40;
  function fit() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cssW = canvas.clientWidth;
    cssH = canvas.clientHeight;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // About ten and a half metres across: the walker behind, still half a
    // second's warning at full pelt in front, and a dog big enough to see.
    u = Math.max(30, Math.min(cssW / 10.5, cssH / 6));
  }

  function draw() {
    const gy = Math.round(cssH * 0.66);
    const left = walk.x - SEE_BEHIND;
    const sky = g.createLinearGradient(0, 0, 0, gy);
    sky.addColorStop(0, '#7cc6f0');
    sky.addColorStop(1, '#d6f1fc');
    g.fillStyle = sky;
    g.fillRect(0, 0, cssW, gy);
    // clouds, far hills, then near trees, each sliding at its own pace
    g.fillStyle = 'rgba(255, 255, 255, 0.85)';
    const cloudGap = 9;
    const drift = left * 0.1 + walk.t * 0.15;
    for (let k = Math.floor(drift / cloudGap) - 1; k * cloudGap < drift + cssW / u + cloudGap; k++) {
      const cx = (k * cloudGap - drift) * u;
      const cy = gy * (0.18 + ((k * 37) % 5) * 0.08);
      for (const [dx, dy, r] of [[0, 0, 0.5], [0.55, 0.12, 0.38], [-0.5, 0.15, 0.34]]) {
        g.beginPath();
        g.arc(cx + dx * u, cy + dy * u, r * u, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.fillStyle = '#9fd18a';
    g.beginPath();
    g.moveTo(0, gy);
    for (let sx = 0; sx <= cssW; sx += 8) {
      const wx = (sx / u + left * 0.2);
      g.lineTo(sx, gy - (1.2 + Math.sin(wx * 0.45) * 0.5 + Math.sin(wx * 1.3) * 0.2) * u);
    }
    g.lineTo(cssW, gy);
    g.fill();
    const treeGap = 6;
    const near = left * 0.5;
    for (let k = Math.floor(near / treeGap) - 1; k * treeGap < near + cssW / u + treeGap; k++) {
      const sx = (k * treeGap - near) * u;
      g.fillStyle = '#7a5532';
      g.fillRect(sx - 0.08 * u, gy - 1.3 * u, 0.16 * u, 1.3 * u);
      g.fillStyle = k % 2 ? '#4f9d45' : '#5cad4f';
      g.beginPath();
      g.arc(sx, gy - 1.6 * u, 0.6 * u, 0, Math.PI * 2);
      g.fill();
    }
    // the grass, and the path the dog runs along
    g.fillStyle = '#6cbf4f';
    g.fillRect(0, gy, cssW, cssH - gy);
    g.fillStyle = '#e3cf9a';
    g.fillRect(0, gy, cssW, 0.35 * u);
    g.fillStyle = '#5aa843';
    g.fillRect(0, gy - 0.05 * u, cssW, 0.08 * u);
    // tufts and flowers in the grass, going by at the dog's own speed
    const tuftGap = 1.7;
    for (let k = Math.floor(left / tuftGap) - 1; k * tuftGap < left + cssW / u + tuftGap; k++) {
      const sx = (k * tuftGap - left) * u;
      const row = gy + (0.7 + ((k * 13) % 7) * 0.32) * u;
      if (row > cssH - 6) continue;
      g.fillStyle = '#58ab3f';
      g.fillRect(sx, row - 0.16 * u, 0.05 * u, 0.16 * u);
      g.fillRect(sx + 0.09 * u, row - 0.22 * u, 0.05 * u, 0.22 * u);
      g.fillRect(sx + 0.18 * u, row - 0.14 * u, 0.05 * u, 0.14 * u);
      if (k % 3 === 0) {
        g.fillStyle = ['#ffffff', '#ffd23f', '#ff7aa8'][Math.abs(k) % 3];
        g.beginPath();
        g.arc(sx + 0.5 * u, row - 0.1 * u, 0.07 * u, 0, Math.PI * 2);
        g.fill();
      }
    }

    // the signposts every hundred metres, and the arch at the end
    for (let at = 100; at < WALK_LENGTH; at += 100) {
      const sx = (at - left) * u;
      if (sx > -12 * u && sx < cssW + u) drawSign(g, sx, gy, u, `${WALK_LENGTH - at} metres to ${walk.to}`);
    }
    const archX = (WALK_LENGTH + 0.2 - left) * u;
    if (archX < cssW + u && archX > -4 * u) drawArch(g, archX, gy, u, walk.to);
    for (const b of walk.treats) {
      const sx = (b.x - left) * u;
      if (sx < -u || sx > cssW + u) continue;
      drawBone(g, sx, gy - (b.h + Math.sin(walk.t * 5 + b.x) * 0.06) * u, u);
    }
    for (const o of walk.things) {
      const sx = (o.x - left) * u;
      if (sx + o.w * u < 0 || sx > cssW) continue;
      drawThing(g, o, sx, gy, u);
      if (o.name) nameTag(g, o.name, sx + (o.w * u) / 2, gy - (o.h + 0.12) * u, cssW);
    }
    // THE WALKER, ON THE LEAD — feet where the dog's were (`walkerHeight`).
    const moving = walk.started && !walk.over;
    const wh = walkerHeight(walk);
    const wx = (SEE_BEHIND - LEAD + 0.52) * u;
    const hand = drawWalker(g, wx, gy - wh * u, u, walk.t, moving, wh > 0.02);
    const collar = [(SEE_BEHIND + 0.95) * u, gy - (walk.h + 0.7) * u];
    g.strokeStyle = '#1f6fb2';
    g.lineWidth = Math.max(2, 0.04 * u);
    g.beginPath();
    g.moveTo(...hand);
    g.quadraticCurveTo((hand[0] + collar[0]) / 2, Math.max(hand[1], collar[1]) + 0.25 * u, ...collar);
    g.stroke();
    drawDog(g, SEE_BEHIND * u, gy - walk.h * u, u, walk.t, moving, !walk.onGround);
    nameTag(g, walker, wx, gy - (wh + 1.68) * u, cssW);
    nameTag(g, hero, (SEE_BEHIND + 1.1) * u, gy - (walk.h + 1.5) * u, cssW);
    // +10 FLOATS UP OFF EVERY BONE THE DOG GETS, so what a bone is worth is
    // said at the moment it is earned.
    const now = performance.now();
    pops = pops.filter((pp) => now - pp.at < 900);
    for (const pp of pops) {
      const k = (now - pp.at) / 900;
      g.globalAlpha = 1 - k * k;
      g.font = `800 ${Math.round(0.5 * u)}px system-ui, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineWidth = 4;
      g.strokeStyle = '#3a2410';
      const py = gy - (pp.h + k * 1.2) * u;
      g.strokeText('+10', (SEE_BEHIND + 2.4) * u, py);
      g.fillStyle = '#ffd23f';
      g.fillText('+10', (SEE_BEHIND + 2.4) * u, py);
      g.globalAlpha = 1;
    }

    // bones and metres top left; the SCORE top right, in gold, with the best under it
    g.fillStyle = 'rgba(8, 8, 14, 0.55)';
    roundRect(g, 10, 10, 150, 34, 10);
    g.fill();
    drawBone(g, 31, 27, 40, false);
    g.fillStyle = '#ffffff';
    g.font = '700 16px system-ui, sans-serif';
    g.textBaseline = 'middle';
    g.textAlign = 'left';
    g.fillText(`${walk.bones}   ${Math.floor(walk.x)} m`, 52, 28);
    g.textAlign = 'right';
    g.fillStyle = 'rgba(8, 8, 14, 0.55)';
    g.font = '800 20px system-ui, sans-serif';
    const scoreText = `Score ${score(walk)}`;
    const sw = g.measureText(scoreText).width;
    roundRect(g, cssW - sw - 34, 10, sw + 24, 34, 10);
    g.fill();
    g.fillStyle = '#ffd23f';
    g.fillText(scoreText, cssW - 22, 28);
    g.fillStyle = '#ffffff';
    g.font = '600 13px system-ui, sans-serif';
    g.fillText(`Best ${best}`, cssW - 22, 58);
    // where this walk is going, and how far is left
    g.textAlign = 'left';
    g.fillStyle = 'rgba(8, 8, 14, 0.55)';
    g.font = '600 13px system-ui, sans-serif';
    const toLine = `To ${walk.to}: ${metresLeft(walk)} m`;
    roundRect(g, 10, 50, g.measureText(toLine).width + 20, 26, 9);
    g.fill();
    g.fillStyle = '#ffffff';
    g.fillText(toLine, 20, 64);

    if (!walk.started || walk.over) {
      const top = cssH * 0.22;
      g.fillStyle = 'rgba(8, 8, 14, 0.62)';
      g.fillRect(0, top, cssW, 156);
      g.textAlign = 'center';
      g.fillStyle = '#ffffff';
      const title = !walk.started ? `Walkies to ${walk.to}` : walk.arrived ? `You made it to ${walk.to}!` : `Woof! ${score(walk)}`;
      fitText(g, title, cssW / 2, top + 36, cssW - 24, 26);
      g.font = '600 16px system-ui, sans-serif';
      const second = !walk.started ? `${WALK_LENGTH} metres — jump everything on the way`
        : walk.arrived ? `${score(walk)} points`
          : walk.hit && walk.hit.name ? `Ran into ${walk.hit.name}, ${metresLeft(walk)} metres short of ${walk.to}`
            : `${metresLeft(walk)} metres short of ${walk.to}`;
      fitText(g, second, cssW / 2, top + 70, cssW - 24, 16, 600);
      // HOW THE SCORE WAS MADE, in gold: a bone is ten, and getting there a hundred.
      const metres = Math.floor(Math.min(walk.x, WALK_LENGTH));
      const sum = !walk.started ? 'Bones are 10 each · getting there is 100'
        : `${metres} m + ${walk.bones} ${walk.bones === 1 ? 'bone' : 'bones'} × 10${walk.arrived ? ' + 100 for getting there' : ''} = ${score(walk)}`;
      g.fillStyle = '#ffd23f';
      fitText(g, sum, cssW / 2, top + 100, cssW - 24, 15, 700);
      g.fillStyle = '#ffffff';
      const ready = !walk.over || performance.now() - endedAt > 700;
      g.font = '600 15px system-ui, sans-serif';
      g.fillText(walk.over ? (ready ? 'Tap to go again' : '') : 'Tap to start', cssW / 2, top + 134);
    }
  }

  function press() {
    if (walk.over) {
      if (performance.now() - endedAt < 700) return;
      walk = newWalk(Math.floor(Math.random() * 1e9), { notTo: walk.to });
      pops = [];
    }
    jump(walk);
  }

  canvas.addEventListener('pointerdown', (ev) => { ev.preventDefault(); press(); });
  const onKey = (ev) => {
    if (ev.key === 'Escape') return close();
    if (ev.key === ' ' || ev.key === 'ArrowUp' || ev.key === 'w') { ev.preventDefault(); press(); }
  };
  document.addEventListener('keydown', onKey);

  let running = true;
  let last = performance.now();
  let acc = 0;
  const frame = (now) => {
    if (!running) return;
    acc = Math.min(0.25, acc + (now - last) / 1000);
    last = now;
    while (acc >= DT) {
      const was = walk.over;
      const bonesBefore = walk.bones;
      step(walk, DT);
      if (walk.bones > bonesBefore) pops.push({ at: performance.now(), h: walk.h + 0.9 }); // in front of the dog, clear of its name
      if (walk.over && !was) {
        endedAt = performance.now();
        const got = score(walk);
        const good = `Good dog${hero ? `, ${hero}` : ''}.`;
        const there = walk.arrived ? `Made it to ${walk.to}! ` : '';
        if (got > best) {
          best = got;
          try { localStorage.setItem(key, String(best)); } catch { /* the phone forgets */ }
          said.textContent = `${there}A new best: ${got}. ${good}`;
        } else said.textContent = `${there}${got} — best is ${best}.`;
      }
      acc -= DT;
    }
    draw();
    requestAnimationFrame(frame);
  };

  // Measured whenever the box changes — Blockyard's lesson: a canvas sized
  // for the old box is stretched into the new one.
  const sizer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => fit()) : null;
  const onResize = () => fit();
  window.addEventListener('resize', onResize);
  function close() {
    running = false;
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', onResize);
    if (sizer) sizer.disconnect();
    sheet.remove();
  }
  sheet.querySelector('.toy-close').addEventListener('click', close);

  document.body.appendChild(sheet);
  fit();
  if (sizer) sizer.observe(canvas);
  requestAnimationFrame((t) => { last = t; frame(t); });
  return { close, state: () => walk, dogWidth: DOG.w };
}
