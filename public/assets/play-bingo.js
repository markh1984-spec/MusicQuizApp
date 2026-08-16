/**
 * The player's bingo card.
 *
 * The card comes from the server, already made, tied to this phone. There is
 * no card-generating code on this page at all — nothing to poke at, nothing to
 * refresh into a better card. Reloading just fetches the same one back.
 */

import { esc, node, postJson, roomCode } from './client.js';
import { arcadeCard, wireArcade } from './lobby-menu.js';
import { voucherCard } from './voucher-card.js';

let marking = new Set(); // squares tapped but not yet confirmed by the server

export function bingoKey(s) {
  /*
   * THE VOUCHER IS IN THE KEY, or it never draws.
   *
   * `paintCard()` updates a screen that is already built; only a changed key
   * rebuilds it. A code is minted at the instant somebody wins, which also
   * moves the phase — but the phase moves back on `playOn()` while the voucher
   * stays, and a code redeemed at the bar changes nothing else at all. The
   * quiz side had exactly this bug: the server had the voucher, a reload
   * showed the QR, and a live push did not.
   */
  const won = s.voucher ? `:v${s.voucher.code}${s.voucher.redeemedAt ? ':spent' : ''}` : '';
  return `bingo:${s.phase}:${s.round}:${s.target}:${s.stage ? s.stage.index : 0}${won}`;
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
      <div class="bingo-grid cols-${cols}${strip}" style="grid-template-columns:repeat(${cols}, 1fr)" id="bingoGrid"></div>
      <button class="btn bingo-call" id="bingoCall" disabled>BINGO!</button>
      <!-- THE CODE THEY SHOW AT THE BAR, drawn by the QUIZ'S OWN function.
           Not a second card: a bingo voucher and a quiz voucher are the same
           thing, so the same markup, the same QR and the same wording — a bar
           that has learned to scan one has learned to scan both. The payload
           uses the same field name for exactly this reason.
           ABOVE nothing and BELOW the button, because the card is what the
           player is using while the round runs; the voucher only exists once
           they have won something, and then it is the thing they get up with. -->
      ${voucherCard(s)}
    </div>`);

  el.querySelector('#bingoCall').addEventListener('click', () => claim(el));
  paintCard(el, s, me);
  return el;
}

export function updateBingo(s, me) {
  const el = document.querySelector('.bingo-wrap');
  if (el) paintCard(el, s, me);
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
    button.disabled = !s.canClaim;
    button.textContent = s.canClaim ? 'BINGO!' : `Mark ${lineWording(s).replace(/^Get /, '')} first`;
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
    if (result.valid) {
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
