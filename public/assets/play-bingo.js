/**
 * The player's bingo card.
 *
 * The card comes from the server, already made, tied to this phone. There is
 * no card-generating code on this page at all — nothing to poke at, nothing to
 * refresh into a better card. Reloading just fetches the same one back.
 */

import { esc, node, postJson, roomCode, prizesShowing, prizesHead, photoVoteCard, wirePhotoVote } from './client.js';
import { arcadeCard, wireArcade } from './lobby-menu.js';
import { isRed } from './deck.js';
import { cardFaceSvg, ensureCardArt } from './card-face.js';

let marking = new Set(); // squares tapped but not yet confirmed by the server

export function bingoKey(s) {
  /*
   * AND THE VOTE IS IN THE FINGERPRINT — *a card key is a fingerprint of what
   * it draws, never one field of it.* The funniest-photo card is drawn above
   * the bingo card, so a key naming only the phase and the round says nothing
   * changed at the moment four photographs go up and the host asks the room
   * out loud to tap one.
   */
  const vote = s.photoVote ? (s.photoVote.open ? ':vote' : ':voted') : '';
  return `bingo:${s.phase}:${s.round}:${s.target}:${s.stage ? s.stage.index : 0}${vote}`;
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

/**
 * One vote for the funniest photograph, with the token on it (rule 3).
 *
 * A tiny factory rather than a bare function because this module is handed
 * `me` per call and has no module-level identity of its own — the same reason
 * `postArcadeScore` is passed IN to the shared lobby card.
 */
const votePoster = (me) => (photoId) => postJson('/api/photo-vote', {
  playerId: me.id, token: me.token, joinCode: roomCode(), photoId,
}).catch(() => {});

export function renderBingo(s, me) {
  /*
   * ASK FOR THE PICTURES AT THE LOBBY, NEVER AT THE FIRST CARD.
   *
   * `ensureCardArt()` answers instantly after the first call, so this is a
   * no-op on every push but one — and that one happens minutes before anybody
   * turns a card, which is the whole point. Asked for on the first card
   * instead, the projector would draw it with pips and only correct itself on
   * the NEXT press, which on a card game can be half a minute later.
   *
   * `game === 'cards'` rather than `playsACard()` deliberately: music bingo has
   * a card with SONGS on it and no artwork to fetch.
   */
  if (s.game === 'cards') ensureCardArt();


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
    /*
     * AND A DRINK ALREADY WON IS DRAWN HERE TOO. This screen had no vouchers
     * box and never called `paintVouchers()`, which cost nothing while a bingo
     * lobby could only ever come BEFORE anything was won. A running order
     * changed that: three games of card bingo, then the music bingo at ten —
     * and its lobby is the hour in between, where a pint won at eight was in
     * the payload (`carried`) and on no screen. *A held code is drawn at every
     * phase of a night.* `updateBingo()` looks for `.bingo-lobby` for the same
     * reason: the key names no vouchers, so a code arriving mid-lobby is a
     * repaint, not a rebuild.
     */
    const el = node(`
      <div class="bingo-lobby" style="display:grid;gap:14px;text-align:center">
        <div class="pill" style="justify-self:center;font-size:13px">You're in</div>
        <h1 class="grad-text">${esc(s.you ? s.you.name : '')}</h1>
        <p>Your card is ready. It appears the moment the first song plays.</p>
        <p class="muted" style="font-size:14px">This card is yours for the whole round — it will not change.</p>
        <div class="bingo-vouchers" id="bingoVouchers"></div>
        ${photoVoteCard(s)}
        <div class="wait-menu">${arcadeCard(s)}</div>
      </div>`);
    wireArcade(el, s, (score, game = '') => postJson('/api/arcade', {
      playerId: me.id, token: me.token, joinCode: roomCode(), score, game,
    }).catch(() => {}));
    wirePhotoVote(el, votePoster(me));
    paintVouchers(el, s);
    return el;
  }

  // Columns, not "size": a card can be a strip — 3 across and 8 down, the
  // shape of a paper bingo ticket and of the phone it is on.
  const cols = s.cardCols || s.cardSize || 4;
  const rows = s.cardRows || s.cardSize || 4;
  // Taller than it is wide, so the squares have to be rows rather than boxes.
  const strip = rows > cols ? ' strip' : '';
  /*
   * A HAND OF THIRTEEN IS LAID OUT SEVEN OVER SIX, WHICH IS NOT ITS SHAPE.
   *
   * The engine calls it one row of thirteen and that is what decides the game
   * — one line, all thirteen, a full house. Thirteen across a phone would be
   * 26px a card, so the stylesheet folds the same thirteen onto two rows with
   * the second offset by half a card, the way a hand sits in your fingers.
   * Nothing about what WINS moves: this is the only place the two differ, and
   * it is a wrap rather than a second opinion about where the lines are.
   */
  const hand = s.game === 'cards';
  const el = node(`
    <div class="bingo-wrap">
      <!-- THE FUNNIEST PHOTOGRAPH, ABOVE THE CARD. A bingo night's break is
           the same break a quiz has, and the card is not a question with a
           clock on it — nothing is taken away by a panel over the top of it
           for a minute. -->
      ${photoVoteCard(s)}
      <div class="bingo-status" id="bingoStatus"></div>
      <div class="bingo-vouchers" id="bingoVouchers"></div>
      <div class="bingo-grid ${hand ? 'hand' : `cols-${cols}${strip}`}"
        ${hand ? '' : `style="grid-template-columns:repeat(${cols}, 1fr)"`} id="bingoGrid"></div>
      <button class="btn bingo-call" id="bingoCall" disabled>BINGO!</button>
    </div>`);

  el.querySelector('#bingoCall').addEventListener('click', () => claim(el));
  wirePhotoVote(el, votePoster(me));
  paintCard(el, s, me);
  paintVouchers(el, s);
  return el;
}

export function updateBingo(s, me) {
  const el = document.querySelector('.bingo-wrap, .bingo-lobby');
  if (!el) return;
  // The lobby has no card yet; it has a prizes box, and that is what a
  // carried voucher arriving on a state push needs repainted.
  if (el.classList.contains('bingo-wrap')) paintCard(el, s, me);
  paintVouchers(el, s);
}

// Redrawn only when the vouchers actually change — a state push happens on
// every square anyone in the room marks, and rebuilding a QR image that many
// times a second is wasted work on a phone.
let lastVouchersSeen = '';

function paintVouchers(root, s) {
  const box = root.querySelector('#bingoVouchers');
  if (!box) return;
  /*
   * A FRESH BOX IS ALWAYS PAINTED. The key below is module-level so it
   * survives a REBUILD — and a rebuild hands this function a brand-new empty
   * box with the same list as before, which read as "nothing changed" and
   * left it empty. That is how a pint carried into the bingo lobby drew after
   * a reload and not on the push that got there. Emptiness is the tell.
   */
  if (!box.childElementCount) lastVouchersSeen = '';
  /*
   * A COLLECTED PRIZE IS GONE FROM THE PHONE — see `client.js`. On a bingo
   * card this matters most: the box sits ABOVE the grid, so a spent voucher
   * pushes the squares somebody is playing off the bottom of the screen.
   */
  const list = (s.vouchers || []).filter((v) => v && !v.redeemedAt);
  /*
   * THE BREAK IS PART OF THE KEY, or it never draws.
   *
   * This function returns early when the vouchers have not changed — and at
   * the end of a round they have NOT. **A card key is a fingerprint of what
   * it DRAWS, never one field of it** — the fifth sighting of that here.
   *
   * **AND IT IS INVISIBLE ON THE ONE PHONE ANYBODY WOULD TEST.** With the
   * fault reinstated in a real browser, the WINNER still saw the banner: the
   * prize they had just been handed changed the list in the same instant, so
   * the key moved anyway and the banner rode in on the back of it. Every
   * OTHER phone in the room — empty list before, empty list after, identical
   * key — drew nothing at all. So it works perfectly for one person and
   * fails for the sixty the moment is for, which is why it is checked from
   * outside: `node scripts/bingo-round-ends.mjs`.
   */
  /* The fold is part of the fingerprint too, or opening the section and then
     marking a square would shut it again on the repaint. */
  const seen = JSON.stringify([list, Boolean(s.prizesAllGone), prizesShowing()]);
  if (seen === lastVouchersSeen) return;
  lastVouchersSeen = seen;

  /*
   * ALL THE PRIZES ARE GONE — one moment the room reaches together.
   *
   * *"I'd prefer they all get them once the full house is claimed at the same
   * time, so there's an obvious break where they can all get their drinks at
   * the same time."*
   *
   * The banner is drawn for EVERYBODY, not only winners: a room where half
   * the phones say the round is over and the rest say nothing does not get up
   * together, which is the whole thing being asked for. A winner gets the
   * line about their own code; everybody else is simply told the round is
   * done, so nobody is left wondering whether to sit back down.
   */
  const done = Boolean(s.prizesAllGone);
  // Once the host has pressed Finish nothing follows, and "there is more to
  // come" was the last thing the room read on a night that had just ended.
  const finished = s.phase === 'finished';
  const banner = done
    ? [node(`<div class="bingo-allgone">
        <b>That's all the prizes gone.</b>
        <span>${list.length
    ? 'Show the code below at the bar.'
    : (finished ? 'Nothing for this one \u2014 thanks for playing.' : 'Nothing for this one \u2014 stay put, there is more to come.')}</span>
      </div>`)]
    : [];
  const prizes = list.length
    ? [node(`<div class="prizes${prizesShowing() ? '' : ' shut'}">
        ${prizesHead(list.length)}
        <div class="prizes-body">${list.map((v) => voucherCard(v)).join('')}</div>
      </div>`)]
    : [];
  box.replaceChildren(...banner, ...prizes);
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
  // The same question `buildBingo()` asks, so the two cannot disagree about
  // whether a square is a playing card or a song title.
  const hand = s.game === 'cards';
  const card = s.card || [];

  // Build the squares once, then only update their state, so tapping never
  // rebuilds the grid under the player's thumb.
  if (grid.children.length !== card.length) {
    grid.replaceChildren(...card.map((square) => {
      const cell = node(`
        <button class="bingo-cell${isRed(square.title) ? ' red' : ''}${hand ? ' isCard' : ''}" data-i="${square.index}">
          ${hand
            ? cardFaceSvg(square.title, { plain: true })
            : `<span class="bt">${esc(square.title)}</span>
          <span class="ba">${esc(square.artist || '')}</span>`}
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
    /*
     * AND WHERE THEIR CODE HAS GOT TO, because it no longer arrives with the
     * win. The codes are held until the end of the round now, so without this
     * line a winner sees nothing at all where a QR used to be — which is the
     * exact complaint that started this (*"my bingo winners didn't receive a
     * QR code"*) reproduced deliberately. Saying it is what makes the wait a
     * plan rather than a fault.
     *
     * It rides on the line that already names what they hold, so this adds a
     * clause and not a panel — and it goes the moment `prizesAllGone` turns
     * the codes on, when the banner below says the same thing better.
     */
    const already = (s.yourPrizes || []).length
      ? `<span class="yours">You have won ${esc(s.yourPrizes.join(' and '))}${
        s.prizesAllGone ? '' : ' — your code comes up at the end of the round'}</span>`
      : '';
    if (s.won) {
      /*
       * AND THE `won` BRANCH NEEDS IT MOST, which is where it was missed.
       * This replaces the whole status line, so the `already` clause built
       * above never reached the screen at the one moment it matters — the
       * beat straight after somebody wins, when they are looking for a QR
       * code that is now deliberately not there. Found by driving a real
       * browser: the payload was right and the sentence was not drawn.
       */
      status.innerHTML = `<span class="won">You got it. Well done.</span>${
        s.prizesAllGone ? '' : '<span class="yours">Your code comes up at the end of the round</span>'}`;
    } else if (s.stage && s.stage.needs === 'full') {
      status.innerHTML = `<span>Playing for a <b>full house</b></span><span class="away">${
        away === 0 && s.satOut ? 'Not this one' : `${away} to go`}</span>${already}`;
    } else {
      status.innerHTML = `<span>${esc(lineWording(s))}</span><span class="away ${away === 1 ? 'hot' : ''}">${
        away === 0 ? (s.satOut ? 'Not this one' : 'Press BINGO!') : `${away} to go`
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
    // Sat out by the host for this round (`sitOut()` in bingo.js): present and
    // inert, and about the round rather than the person.
    button.disabled = s.satOut || s.standDown || !s.canClaim;
    button.textContent = s.satOut
      ? 'Back in next round'
      : s.standDown
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
