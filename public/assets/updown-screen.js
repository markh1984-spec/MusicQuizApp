/**
 * UP OR DOWN ON THE PROJECTOR — the card to beat, the card face down, and who
 * is still standing.
 *
 * Sized in `vh` like every rule on the projector, and read from the back of a
 * dark pub. The cards are `card-face.js`'s drawings, the same ones card bingo
 * deals, so a seven of hearts looks like itself everywhere in the app.
 *
 * **HOW MANY HAVE SAID, NEVER WHICH WAY** — until the card turns. A split on
 * the wall while the clock runs is the back of the room copying the front;
 * after the turn the split IS the joke (*"twelve of you said higher…"*).
 *
 * **NO PLAYER ID (rule 3)** — the standing few are drawn by `faceKey`.
 */
import { esc, node } from './client.js';
import { faceFor } from './avatar.js';
import { cardFaceSvg, ensureCardArt } from './card-face.js';

let ticker = null;

/*
 * A CARD KEY IS A FINGERPRINT OF WHAT IT DRAWS (rule 9): the phase, which
 * card, who is left. The clock and the count of votes are painted in place by
 * `updateUpDown()`, so a vote never rebuilds the card under the room.
 */
export function upDownKey(s) {
  const u = s.updown;
  if (!u) return `updown:${s.phase}:none`;
  return `updown:${s.phase}:${u.id}:${u.turn}:${u.alive}:${u.winner ? u.winner.name : ''}`;
}

export function stopUpDown() {
  if (ticker) clearInterval(ticker);
  ticker = null;
}

const card = (title, cls = '') => `<div class="ud-card ${cls}">${cardFaceSvg(title)}</div>`;
const back = () => '<div class="ud-card ud-back" aria-label="The next card, face down"><span>?</span></div>';
const SAID = { higher: 'Higher!', lower: 'Lower!', same: 'A pair!' };

export function renderUpDown(s, now) {
  stopUpDown();
  ensureCardArt();
  const u = s.updown;
  if (!u) {
    return node(`
      <div class="ud-stage ud-waiting">
        <div class="kicker">Up or Down</div>
        <h1 class="grad-text">Higher or lower?</h1>
        <p class="ud-say">Wrong guesses are out. The last one standing gets a drink.</p>
        <p class="ud-count">${s.playerCount} ${s.playerCount === 1 ? 'phone' : 'phones'} in — join now</p>
      </div>`);
  }
  if (s.phase === 'done' || (s.phase === 'finished' && u.winner)) {
    const w = u.winner || { name: '' };
    return node(`
      <div class="winner ud-winner">
        <div class="kicker">Last one standing</div>
        <img class="race-winner-face" src="${esc(faceFor(s.photos || [], { faceKey: w.face || '', name: w.name }))}" alt="">
        <h1 class="grad-text">${esc(w.name)}</h1>
        <div class="score">Up or Down, in ${u.turn} ${u.turn === 1 ? 'card' : 'cards'}</div>
      </div>`);
  }
  const guessing = s.phase === 'guessing';
  const el = node(`
    <div class="ud-stage">
      <div class="ud-head">
        <div class="kicker">Up or Down · card ${u.turn}</div>
        <h1 class="ud-said ${guessing ? '' : `ud-${esc(u.said || '')}`}">${guessing ? 'Higher or lower?' : esc(SAID[u.said] || '')}</h1>
      </div>
      <div class="ud-cards">
        ${card(u.card)}
        <div class="ud-arrow" aria-hidden="true">${guessing ? '&#8597;' : u.said === 'lower' ? '&#8595;' : u.said === 'higher' ? '&#8593;' : '='}</div>
        ${guessing ? back() : card(u.next, 'ud-turned')}
      </div>
      <div class="ud-foot">${guessing ? `
        <span class="ud-clock" data-closes="${Number(u.closesAt) || 0}"></span>
        <span class="ud-count"><b class="ud-voted">${u.voted || 0}</b> of ${u.alive} have said</span>` : `
        <span class="ud-split">${u.up || 0} said higher · ${u.down || 0} said lower</span>
        <span class="ud-count">${u.pair ? 'Nobody goes out on a pair'
          : u.everyoneWrong ? 'Everybody got it wrong — so nobody goes out'
            : `${u.outCount || 0} out · <b>${u.alive}</b> still in`}</span>`}
      </div>
      ${u.standing ? `<div class="ud-standing">${u.standing.map((p) => `
        <span class="ud-who"><img src="${esc(faceFor(s.photos || [], { faceKey: p.face, name: p.name }))}" alt=""><span>${esc(p.name)}</span></span>`).join('')}</div>` : ''}
    </div>`);
  if (guessing) {
    const clockEl = el.querySelector('.ud-clock');
    const paint = () => {
      if (!clockEl.isConnected) { stopUpDown(); return; }
      const left = Math.max(0, Number(clockEl.dataset.closes) - now());
      clockEl.textContent = left > 0 ? String(Math.ceil(left / 1000)) : 'Time';
      clockEl.classList.toggle('urgent', left > 0 && left <= 3000);
    };
    paint();
    ticker = setInterval(paint, 200);
  }
  return el;
}

/** A state push on the same card: how many have said, painted in place. */
export function updateUpDown(s) {
  const u = s.updown;
  const v = document.querySelector('.ud-voted');
  if (u && v) v.textContent = String(u.voted || 0);
}
