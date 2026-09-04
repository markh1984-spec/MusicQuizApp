/**
 * The player's bingo card.
 *
 * The card comes from the server, already made, tied to this phone. There is
 * no card-generating code on this page at all — nothing to poke at, nothing to
 * refresh into a better card. Reloading just fetches the same one back.
 */

import { esc, node, postJson, roomCode } from './client.js';
import { arcadeCard, wireArcade } from './lobby-menu.js';

let marking = new Set(); // squares tapped but not yet confirmed by the server

export function bingoKey(s) {
  return `bingo:${s.phase}:${s.round}:${s.target}:${s.stage ? s.stage.index : 0}`;
}

/**
 * What counts as a line, in words, for the phone holding the card.
 *
 * On a square card "a full line" is unambiguous — any row, column or diagonal,
 * all the same length. On a strip it is not: somebody looking at three across
 * and eight down will read "a line" as the three, mark them, and shout. So the
 * strip says which way it runs and how many, and that is the difference
 * between a false alarm and a win.
 */
function lineWording(s) {
  const cols = s.cardCols || s.cardSize || 4;
  const rows = s.cardRows || s.cardSize || 4;
  const needs = s.stage ? s.stage.needs : 1;
  const which = rows === cols ? 'line' : (rows > cols ? `column — ${rows} down` : `row — ${cols} across`);
  if (needs === 'full') return 'Get a full house';
  return needs > 1 ? `Get ${needs} full ${rows === cols ? 'lines' : which + 's'}` : `Get a full ${which}`;
}

export function renderBingo(s, me) {
  if (s.phase === 'lobby') {
    /*
     * SOMETHING TO DO WHILE THEY WAIT — Rally, on a bingo night.
     *
     * The host's own split: Maze Mouth before a quiz, tennis before the bingo,
     * so a bingo night has a character of its own rather than being the quiz
     * with different content. The card and the wiring are shared with the
     * quiz's waiting screen (`lobby-menu.js`); all that differs is which
     * module gets imported when the button is pressed, and the phone works
     * that out from `s.game`.
     *
     * **AND IT IS THE ONLY THING ON THIS SCREEN THAT MOVES.** The bingo lobby
     * is three lines of reassurance about a card that has not appeared yet,
     * which is the emptiest screen in the app and the one people leave — and a
     * phone that leaves is an SSE connection that has to come back at the
     * moment sixty of them would. The game is the reliability half of this
     * feature, not the toy half.
     */
    const el = node(`
      <div style="display:grid;gap:14px;text-align:center">
        <div class="pill" style="justify-self:center;font-size:13px">You're in</div>
        <h1 class="grad-text">${esc(s.you ? s.you.name : '')}</h1>
        <p>Your card is ready. It appears the moment the first song plays.</p>
        <p class="muted" style="font-size:14px">This card is yours for the whole round — it will not change.</p>
        <div class="wait-menu">${arcadeCard(s)}</div>
      </div>`);
    wireArcade(el, s, (score) => postJson('/api/arcade', {
      playerId: me.id, token: me.token, joinCode: roomCode(), score,
    }).catch(() => {}));
    return el;
  }

  // Columns, not "size": a card can be a strip — 3 across and 8 down, the
  // shape of a paper bingo ticket and of the phone it is on.
  const cols = s.cardCols || s.cardSize || 4;
  const rows = s.cardRows || s.cardSize || 4;
  // Taller than it is wide, so the squares have to be rows rather than boxes.
  const strip = rows > cols ? ' strip' : '';
  const el = node(`
    <div class="bingo-wrap">
      <div class="bingo-status" id="bingoStatus"></div>
      <div class="bingo-vouchers" id="bingoVouchers"></div>
      <div class="bingo-grid cols-${cols}${strip}" style="grid-template-columns:repeat(${cols}, 1fr)" id="bingoGrid"></div>
      <button class="btn bingo-call" id="bingoCall" disabled>BINGO!</button>
    </div>`);

  el.querySelector('#bingoCall').addEventListener('click', () => claim(el));
  paintCard(el, s, me);
  paintVouchers(el, s);
  return el;
}

export function updateBingo(s, me) {
  const el = document.querySelector('.bingo-wrap');
  if (!el) return;
  paintCard(el, s, me);
  paintVouchers(el, s);
}

// Redrawn only when the vouchers actually change — a state push happens on
// every square anyone in the room marks, and rebuilding a QR image that many
// times a second is wasted work on a phone.
let lastVouchersSeen = '';

function paintVouchers(root, s) {
  const box = root.querySelector('#bingoVouchers');
  if (!box) return;
  const list = s.vouchers || [];
  const seen = JSON.stringify(list);
  if (seen === lastVouchersSeen) return;
  lastVouchersSeen = seen;
  box.replaceChildren(...list.map((v) => node(voucherCard(v))));
}

/**
 * One prize, one card — same shape as the quiz's own voucher (`voucherCard()`
 * in `play.js`), deliberately re-drawn here rather than imported: `play.js`
 * is a whole page with its own boot code at module scope, and importing from
 * it would run that boot code on this page too — the exact trap CLAUDE.md
 * already records for `editor.js`. The markup is presentation and small
 * enough that two copies is the safer choice.
 *
 * BINGO HANDS OUT SEVERAL OF THESE IN ONE NIGHT — a line, then a full house —
 * so this draws ONE voucher rather than reading `s.voucher` the way the
 * quiz's page does; the caller loops over `s.vouchers`.
 */
function voucherCard(v) {
  const code = roomCode();
  const target = `${location.origin}/v?c=${encodeURIComponent(v.code)}${code ? `&g=${encodeURIComponent(code)}` : ''}`;
  if (v.redeemedAt) {
    return `
      <div class="win-card win-spent">
        ${v.logo ? `<img class="win-logo" alt="${esc(v.venue || '')}" src="${esc(v.logo)}" onerror="this.remove()">` : ''}
        <div class="sub">Collected</div>
        <div class="win-what">${esc(v.reward)}</div>
        <p class="tiny">Already redeemed. If that is wrong, ask the quizmaster.</p>
      </div>`;
  }
  const logo = v.logo
    ? `<img class="win-logo" alt="${esc(v.venue || '')}" src="${esc(v.logo)}" onerror="this.remove()">`
    : '';
  return `
    <div class="win-card place-${v.place || 1}">
      ${logo}
      <div class="sub">You got it</div>
      <div class="win-what">${esc(v.reward)}</div>
      <img class="win-qr" alt="Show this at the bar"
        src="/qr.svg?text=${encodeURIComponent(target)}&dark=%230b0b12&light=%23ffffff">
      <div class="win-code">${esc(v.code)}</div>
      <p class="tiny">Show this at the bar. They scan it, you get it. It only works once.</p>
    </div>`;
}

function paintCard(root, s, me) {
  const grid = root.querySelector('#bingoGrid');
  const card = s.card || [];

  // Build the squares once, then only update their state, so tapping never
  // rebuilds the grid under the player's thumb.
  if (grid.children.length !== card.length) {
    grid.replaceChildren(...card.map((square) => {
      const cell = node(`
        <button class="bingo-cell" data-i="${square.index}">
          <span class="bt">${esc(square.title)}</span>
          <span class="ba">${esc(square.artist || '')}</span>
          <span class="btick">✓</span>
        </button>`);
      cell.addEventListener('click', () => toggle(cell, square.index, me));
      return cell;
    }));
  }

  for (const square of card) {
    const cell = grid.children[square.index];
    if (!cell) continue;
    const marked = marking.has(square.index) ? true : square.marked;
    cell.classList.toggle('marked', marked);
    // A square they marked that you have genuinely played is confirmed. One
    // they marked that you have not is shown as unconfirmed, so a team that
    // taps the wrong thing can see it before they shout.
    cell.classList.toggle('confirmed', marked && square.called);
    cell.classList.toggle('unconfirmed', marked && !square.called);
  }

  const status = root.querySelector('#bingoStatus');
  if (status) {
    const away = s.you ? s.you.squaresAway : null;
    // What they have already won stays on screen beside what is being played
    // for now, so somebody who took the first prize can still see how close
    // they are to the next one.
    const already = (s.yourPrizes || []).length
      ? `<span class="yours">You have won ${esc(s.yourPrizes.join(' and '))}</span>`
      : '';
    if (s.won) {
      status.innerHTML = '<span class="won">You got it. Well done.</span>';
    } else if (s.stage && s.stage.needs === 'full') {
      status.innerHTML = `<span>Playing for a <b>full house</b></span><span class="away">${away} to go</span>${already}`;
    } else {
      status.innerHTML = `<span>${esc(lineWording(s))}</span><span class="away ${away === 1 ? 'hot' : ''}">${
        away === 0 ? 'Press BINGO!' : `${away} to go`
      }</span>${already}`;
    }
  }

  const button = root.querySelector('#bingoCall');
  if (button) {
    /*
     * ONE PRIZE EACH — the reason goes ON the button, never in place of it.
     * `standDown` means they hold a prize and somebody else does not, so the
     * next one is not theirs to take. Present and inert: a control that
     * vanished at the exact moment somebody had just won would read as the
     * app breaking, and one that stays but says nothing gets pressed again,
     * louder.
     *
     * **IT DOES NOT SAY "you have already won", WHICH IS THE POINT.** Asked
     * for in those words: *"I don't want them to be told 'you've already
     * won'."* The line above this already prints what they hold
     * (`yourPrizes`), so repeating it on the button was the app telling
     * somebody off for winning. **"Playing on" is what a bingo hall says**,
     * it is true, and it reads as the night carrying on rather than as a
     * refusal aimed at them.
     */
    button.disabled = s.standDown || !s.canClaim;
    button.textContent = s.standDown
      ? 'Playing on'
      : (s.canClaim ? 'BINGO!' : `Mark ${lineWording(s).replace(/^Get /, '')} first`);
  }
}

async function toggle(cell, index, me) {
  // Paint it straight away — a phone that waits for the network feels broken.
  const wasMarked = cell.classList.contains('marked');
  cell.classList.toggle('marked', !wasMarked);
  if (!wasMarked) marking.add(index); else marking.delete(index);
  if (navigator.vibrate) navigator.vibrate(12);

  try {
    await postJson('/api/mark', { playerId: me.id, token: me.token, index, marked: !wasMarked, joinCode: roomCode() });
  } catch {
    // The next state push is the truth; put it back for now.
    cell.classList.toggle('marked', wasMarked);
  } finally {
    marking.delete(index);
  }
}

async function claim(root) {
  const button = root.querySelector('#bingoCall');
  const me = JSON.parse(localStorage.getItem('musicquiz.player') || '{}');
  button.disabled = true;
  try {
    const result = await postJson('/api/claim', { playerId: me.id, token: me.token, joinCode: roomCode() });
    if (result.valid && result.prize === false) {
      /*
       * Their card WAS right — the prize passed to somebody who has not had
       * one. **It says the PRIZE is gone, never that THEY have already won**:
       * *"I don't want them to be told 'you've already won'."* Same fact,
       * and the difference is whether the sentence is about the prize or
       * about them. Green, because their call was correct.
       */
      flash(root, 'Correct — that one has gone', true);
    } else if (result.valid) {
      flash(root, 'BINGO — that is a line', true);
    } else {
      // Not a telling-off: they may have misheard, and a false alarm is part
      // of the night. But be clear about why.
      flash(root, 'Not yet — one of those has not been played', false);
      button.disabled = false;
    }
  } catch {
    button.disabled = false;
  }
}

function flash(root, message, good) {
  const el = node(`<div class="bingo-flash ${good ? 'good' : 'bad'}">${esc(message)}</div>`);
  root.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}
