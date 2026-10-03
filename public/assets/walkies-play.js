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
import { node } from './client.js';
import { DOG, jump, newWalk, score, step } from './walkies.js';

const DT = 1 / 60;
const SEE_BEHIND = 1.5;

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

/** A scruffy tan terrier with a red collar, facing right. `x, y` is where its paws meet the ground. */
function drawDog(g, x, y, u, t, running, inAir) {
  const leg = (lx, phase) => {
    const swing = inAir ? 0.12 : running ? Math.sin(t * 18 + phase) * 0.14 : 0;
    g.strokeStyle = '#a86d38';
    g.lineWidth = 0.13 * u;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(x + lx * u, y - 0.36 * u);
    g.lineTo(x + (lx + swing) * u, y - (inAir ? 0.12 : 0.04) * u);
    g.stroke();
  };
  leg(0.32, 0); leg(0.42, Math.PI); leg(0.82, Math.PI); leg(0.92, 0);
  // the tail, wagging
  const wag = Math.sin(t * 14) * 0.25;
  g.strokeStyle = '#c98a4b';
  g.lineWidth = 0.11 * u;
  g.beginPath();
  g.moveTo(x + 0.2 * u, y - 0.6 * u);
  g.quadraticCurveTo(x + 0.02 * u, y - (0.8 + wag) * u, x + (0.06 + wag * 0.4) * u, y - 1.0 * u);
  g.stroke();
  // body and chest
  g.fillStyle = '#c98a4b';
  roundRect(g, x + 0.15 * u, y - 0.78 * u, 0.9 * u, 0.44 * u, 0.2 * u);
  g.fill();
  g.fillStyle = '#f4ead8';
  roundRect(g, x + 0.72 * u, y - 0.62 * u, 0.3 * u, 0.28 * u, 0.12 * u);
  g.fill();
  // head, muzzle and nose
  g.fillStyle = '#c98a4b';
  g.beginPath();
  g.arc(x + 1.05 * u, y - 0.92 * u, 0.25 * u, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#f4ead8';
  roundRect(g, x + 1.12 * u, y - 0.9 * u, 0.3 * u, 0.17 * u, 0.08 * u);
  g.fill();
  g.fillStyle = '#2a1d14';
  g.beginPath();
  g.arc(x + 1.42 * u, y - 0.86 * u, 0.06 * u, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.arc(x + 1.1 * u, y - 1.0 * u, 0.04 * u, 0, Math.PI * 2);
  g.fill();
  // the floppy ear, flapping when it runs
  const flap = inAir ? -0.25 : running ? Math.sin(t * 18) * 0.12 : 0;
  g.fillStyle = '#8a5528';
  g.save();
  g.translate(x + 0.95 * u, y - 1.1 * u);
  g.rotate(0.5 + flap);
  roundRect(g, -0.07 * u, 0, 0.16 * u, 0.32 * u, 0.08 * u);
  g.fill();
  g.restore();
  // red collar and a gold tag
  g.fillStyle = '#e0403a';
  g.fillRect(x + 0.88 * u, y - 0.8 * u, 0.1 * u, 0.24 * u);
  g.fillStyle = '#f2c23a';
  g.beginPath();
  g.arc(x + 0.95 * u, y - 0.55 * u, 0.05 * u, 0, Math.PI * 2);
  g.fill();
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

function drawBone(g, cx, cy, u) {
  g.fillStyle = '#fbf6ea';
  g.strokeStyle = 'rgba(0, 0, 0, 0.18)';
  g.lineWidth = 1;
  const r = 0.09 * u;
  g.fillRect(cx - 0.22 * u, cy - 0.06 * u, 0.44 * u, 0.12 * u);
  for (const [dx, dy] of [[-0.22, -0.07], [-0.22, 0.07], [0.22, -0.07], [0.22, 0.07]]) {
    g.beginPath();
    g.arc(cx + dx * u, cy + dy * u, r, 0, Math.PI * 2);
    g.fill();
  }
}

export function openWalkies({ who = 'you' } = {}) {
  if (document.querySelector('.toy-sheet')) return null;
  const key = `musicquiz.walkies.${String(who).toLowerCase()}`;
  let best = 0;
  try { best = Number(localStorage.getItem(key)) || 0; } catch { /* a private window starts from nought */ }
  let walk = newWalk(Math.floor(Math.random() * 1e9));
  let endedAt = 0;

  const sheet = node(`<div class="toy-sheet" role="dialog" aria-label="Walkies">
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
    // About nine and a half metres across: still half a second's warning at
    // full pelt, and a dog big enough to see on a phone held upright.
    u = Math.max(30, Math.min(cssW / 9.5, cssH / 6));
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

    for (const b of walk.treats) {
      const sx = (b.x - left) * u;
      if (sx < -u || sx > cssW + u) continue;
      drawBone(g, sx, gy - (b.h + Math.sin(walk.t * 5 + b.x) * 0.06) * u, u);
    }
    for (const o of walk.things) {
      const sx = (o.x - left) * u;
      if (sx + o.w * u < 0 || sx > cssW) continue;
      drawThing(g, o, sx, gy, u);
    }
    drawDog(g, SEE_BEHIND * u, gy - walk.h * u, u, walk.t, walk.started && !walk.over, !walk.onGround);

    // the score, top left; the best, top right
    g.fillStyle = 'rgba(8, 8, 14, 0.55)';
    roundRect(g, 10, 10, 150, 34, 10);
    g.fill();
    drawBone(g, 30, 27, 44);
    g.fillStyle = '#ffffff';
    g.font = '700 16px system-ui, sans-serif';
    g.textBaseline = 'middle';
    g.textAlign = 'left';
    g.fillText(`${walk.bones}   ${Math.floor(walk.x)} m`, 48, 28);
    g.textAlign = 'right';
    g.fillText(`Best ${best}`, cssW - 14, 28);

    if (!walk.started || walk.over) {
      g.fillStyle = 'rgba(8, 8, 14, 0.6)';
      g.fillRect(0, cssH * 0.22, cssW, 110);
      g.textAlign = 'center';
      g.fillStyle = '#ffffff';
      g.font = '800 26px system-ui, sans-serif';
      g.fillText(walk.over ? `Woof! ${score(walk)}` : 'Walkies!', cssW / 2, cssH * 0.22 + 38);
      g.font = '600 16px system-ui, sans-serif';
      const ready = !walk.over || performance.now() - endedAt > 700;
      g.fillText(walk.over ? (ready ? 'Tap to go again' : '') : 'Tap to start', cssW / 2, cssH * 0.22 + 76);
    }
  }

  function press() {
    if (walk.over) {
      if (performance.now() - endedAt < 700) return;
      walk = newWalk(Math.floor(Math.random() * 1e9));
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
      step(walk, DT);
      if (walk.over && !was) {
        endedAt = performance.now();
        const got = score(walk);
        if (got > best) {
          best = got;
          try { localStorage.setItem(key, String(best)); } catch { /* the phone forgets */ }
          said.textContent = `A new best: ${got}. Good dog.`;
        } else said.textContent = `${got} — best is ${best}.`;
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
