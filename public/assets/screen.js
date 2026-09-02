/**
 * The big screen.
 *
 * Structured as a set of swappable "cards" — one per phase — because the plan
 * is to slot more of them in later: an Instagram promo card between rounds, a
 * card that shows approved photos from the room, a venue branding card. A card
 * is just a function that builds DOM from the state payload, registered by name.
 *
 * Nothing here ever receives the answer key before the reveal: the server
 * simply does not put it in this payload.
 */

import { comeBackBand, esc, node, ServerClock, Live, brandMark, brandWords, roomCode, roomParam } from './client.js';
import { bingoCard, bingoTopbar } from './screen-bingo.js';
import { paintLook, DEFAULT_LOOK } from './looks.js';
import { paintScheme } from './schemes.js';
import { faceFor } from './avatar.js';
import { arcadeSlot, paintArcadeBoard } from './lobby-board.js';

const cardEl = document.getElementById('card');
const quizTitleEl = document.getElementById('quizTitle');
const roundPillEl = document.getElementById('roundPill');
const playerPillEl = document.getElementById('playerPill');
const connWarnEl = document.getElementById('connWarn');

/*
 * Which room this projector is showing.
 *
 * Taken from the page's own URL — `/screen?g=XXXX` — rather than from the
 * state payload, because the QR and the event stream are both needed before
 * any state has arrived. No code means the house game, which is what every
 * bookmark and printed card made before rooms existed says.
 */
const roomQuery = roomParam('?');
const joinQr = `/join-qr.svg${roomQuery}`;

const clock = new ServerClock();
let state = null;
let currentKey = null;
let joinUrl = '';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

// --------------------------------------------------------------- card registry

const cards = {
  lobby: { key: () => 'lobby', render: renderLobby, update: updateLobby },
  rules: { key: () => 'rules', render: renderRules },
  // A stable key: the card is built once when the scoreboard opens, and the
  // rows are refreshed in place. Keying on the version would rebuild it on
  // every state push and flash the projector every time anybody's phone
  // pinged.
  scoreboard: { key: () => 'scores', render: renderScoreboard, update: updateScoreboard },
  advert: { key: (s) => `ad:${s.advert && s.advert.heading}`, render: renderAdvert },
  photos: { key: () => 'photos', render: renderPhotosSlide },
  round_intro: { key: (s) => `intro:${s.roundIndex}`, render: renderRoundIntro },
  question: { key: (s) => `q:${s.roundIndex}:${s.questionIndex}`, render: renderQuestion, update: updateQuestion },
  reveal: { key: (s) => `q:${s.roundIndex}:${s.questionIndex}`, render: renderQuestion, update: updateQuestion },
  /*
   * The key carries WHAT THIS BREAK SHOWS as well as which round it is. The
   * card is built once and left alone — that is the point of a stable key,
   * and it is what stops the projector flashing every time a phone pings —
   * but a break's slides arriving or a plan changing has to rebuild it, and
   * `board:2` alone would never notice.
   */
  round_board: {
    key: (s) => `board:${s.roundIndex}:${Array.isArray(s.leaderboard) ? 1 : 0}:${(s.breakAdverts || []).length}`,
    render: renderBoard,
  },
  final: { key: () => 'final', render: renderWinner },
};

function draw(next) {
  state = next;
  clock.sync(state.serverNow);

  // The brand sits in the corner all night; the quiz title sits next to it.
  if (state.brand && !document.getElementById('brandSlot').dataset.done) {
    const slot = document.getElementById('brandSlot');
    slot.innerHTML = `${brandMark(26)}${brandWords(state.brand, state.appName || '')}`;
    slot.dataset.done = '1';
    document.title = `${state.brand} — Big Screen`;
  }
  quizTitleEl.textContent = state.quizTitle || state.title || 'Music Quiz';
  playerPillEl.textContent = `${state.playerCount} playing`;

  // Which game is running decides which set of cards to draw from. Everything
  // else on this page — the connection, the clock, the swap animation — is
  // shared, so a new game only has to bring its own cards.
  const isBingo = state.game === 'bingo';
  roundPillEl.textContent = isBingo
    ? bingoTopbar(state)
    : state.phase === 'lobby'
      ? 'Join now'
      : state.phase === 'final'
        ? 'Results'
        // A breakout round is delivered like any other but scores nothing,
        // so it is not one of the rounds the room is counting — it
        // announces itself rather than claiming a number. See TODO.md,
        // "THE COUNT IS WHAT SCORES".
        : state.roundType === 'breakout'
          ? 'Bonus round'
          : `Round ${state.scoreRoundNumber ?? state.roundIndex + 1} of ${state.scoreRoundCount ?? state.roundCount}`;

  // The scoreboard is shown over whatever the quiz is doing, without moving
  // it. Picked here rather than as a phase so there is nothing to undo.
  const card = state.advert && state.advert.heading !== undefined
    ? cards.advert
    : state.scoreboard
      ? cards.scoreboard
      // Tonight's photographs, over the final. The engine only ever sends this
      // at the FINAL and only while the host has it up, so no phase check is
      // repeated here — one decision, made where the state is.
      : state.photoSlide
        ? cards.photos
        : isBingo ? bingoCard(state) : (cards[state.phase] || cards.lobby);
  const key = card.key(state);
  if (key !== currentKey) {
    currentKey = key;
    // Every card change passes here, which is the only place a break's advert
    // cycle can be reliably stopped — see `stopBreakCycle()`.
    stopBreakCycle();
    cardEl.replaceChildren(card.render(state, joinUrl));
    // The final is the one card whose content can outgrow the screen — see
    // `fitWinner()`. A frame first, so the browser has laid it out.
    requestAnimationFrame(fitWinner);
  }
  /*
   * And update even on the FIRST paint, not only on later pushes.
   *
   * It used to be an `else if`, which meant a card was rendered empty and
   * filled in by whatever happened next. On the lobby that is the player strip:
   * a projector opened after people have already joined — or one reconnecting
   * after the laptop slept, which is the case that bites — showed an empty
   * strip and kept showing it until the next person joined. Same shape as the
   * join address never arriving on a rules slide, and the same fix: the card
   * marks the slot, and filling it in is a separate step that always runs.
   */
  if (card.update) card.update(state);

  paintPhotos(state);
  paintJoinCorner(state);
  paintJoinUrls();
  paintTheLook(state);
}

/**
 * Dress the night up: a palette and some drawn shapes down the side margins.
 *
 * The palette goes on the root element so it reaches everything at once,
 * including the cards that were built before the look was known. The shapes go
 * on the stage, like the photo strip and the join corner, so no card has to
 * know they exist — and they are rebuilt only when the look actually changes,
 * because this runs on every state push and a decoration that restarts its
 * animation each time somebody answers would twitch all night.
 */
function paintTheLook(s) {
  const look = s.look || DEFAULT_LOOK;
  if (document.documentElement.dataset.look !== look) {
    document.documentElement.dataset.look = look;
  }
  // Whose night this is, in colour. Under the look, which wins where the two
  // overlap — a themed night looks like the season, not like an account.
  paintScheme(s.scheme);
  paintLook(document.querySelector('.stage'), look);
}

/*
 * A new photo gets the middle of the screen for a few seconds.
 *
 * The strip along the bottom is the record of the night — it is where you look
 * to see everything that has been sent. But at 13vh a face is about the size of
 * a stamp on a projector, so a photo somebody has just taken arrives with no
 * moment at all, which is the opposite of the point. This gives it one: big,
 * centred, and gone again on its own.
 *
 * The same phase rule as the strip, so it can never land over a live question —
 * `paintPhotos` has already checked that before this is reached.
 *
 * Only ever ONE at a time. Three people sending at once should be three
 * moments in a row, not three pictures fighting over the middle of the screen,
 * so they queue.
 */
// How long a photo HOLDS before it starts going. The 520ms it takes to arrive
// is inside this, so it is a little over three seconds of sitting there being
// looked at, then most of a second fading. Longer than it was: the host said
// it was gone before the room had finished reacting to it.
const BIG_PHOTO_MS = 4400;
const bigQueue = [];
let bigShowing = false;
const seenPhotos = new Set();
let photosSeeded = false;

/*
 * HOW MUCH ROOM THE JOIN CODE ON SCREEN ACTUALLY NEEDS — measured, not
 * guessed. Reported live from a real night: a photo covered the QR code
 * while people were still joining.
 *
 * The fixed `padding-right: 17vw` this replaced was tuned against the ROUND
 * BOARD's small `#joinCorner` box and never checked against the LOBBY's own
 * code — `.qr-panel`, most of a whole grid column, several times wider — so
 * a photo shown during the lobby (which `PHOTO_PHASES` has always allowed)
 * sat centred across the WHOLE stage and painted straight over it. One
 * measurement, taken against whichever of the two is actually on screen,
 * covers both rather than needing a second tuned number that could drift
 * from the first the next time either layout changes.
 */
function photoClearance() {
  const stage = document.querySelector('.stage');
  const target = document.getElementById('joinCorner') || document.querySelector('.qr-panel');
  if (!stage || !target) return null;
  const clear = stage.getBoundingClientRect().right - target.getBoundingClientRect().left;
  return clear > 0 ? clear : null;
}

/**
 * Apply that measurement to a photo already on screen — called both when one
 * first appears and whenever the join code's own on/off state might have
 * changed underneath it (`paintJoinCorner()`), since a photo can outlast a
 * phase change.
 */
function applyPhotoClearance(el) {
  const clear = photoClearance();
  el.classList.toggle('beside-join', clear != null);
  if (clear == null) {
    el.style.removeProperty('--photo-clear');
    el.style.removeProperty('--photo-max-w');
    return;
  }
  // A gap between the photo and the code, not touching it — and 48px off
  // the figure's own frame padding either side, or the WHITE POLAROID
  // BORDER, not just the picture inside it, is what ends up overlapping.
  const margin = 24;
  const stage = document.querySelector('.stage');
  el.style.setProperty('--photo-clear', `${clear + margin}px`);
  el.style.setProperty('--photo-max-w', `${Math.max(200, stage.getBoundingClientRect().width - clear - margin - 48)}px`);
}

function showBigPhoto(p) {
  bigQueue.push(p);
  if (!bigShowing) nextBigPhoto();
}

function nextBigPhoto() {
  const p = bigQueue.shift();
  if (!p) { bigShowing = false; return; }
  bigShowing = true;

  const el = node(`
    <div class="photo-big" id="photoBig">
      <figure>
        <img src="${esc(p.url)}" alt="">
        ${p.teamName ? `<figcaption>${esc(p.teamName)}</figcaption>` : ''}
      </figure>
    </div>`);
  /*
   * A different angle every time, so a run of them reads as a pile of prints
   * dropped on a table rather than as a slideshow in a frame.
   *
   * IT NEVER LANDS NEAR STRAIGHT, which is the whole reason this is not one
   * `Math.random() * 12 - 6`. A plain range like that gives a photo half a
   * degree often enough, and half a degree does not read as scrapbook — it
   * reads as a projector nobody levelled, which is the one impression a tilt
   * must never give. So a side is picked and the angle is 2.5° to 7° off it:
   * always obviously deliberate, and never so far that the picture starts
   * losing height on a screen where filling the height is the point.
   *
   * The tilt is a custom property because the entry and exit keyframes have
   * to carry it through — animating `transform` without it snaps the photo
   * straight halfway through.
   */
  const lean = (2.5 + Math.random() * 4.5) * (Math.random() < 0.5 ? -1 : 1);
  el.style.setProperty('--tilt', lean.toFixed(2) + 'deg');
  /*
   * Move over for the join code if one is up — see `photoClearance()`.
   *
   * The photo used to be centred on the whole stage with a full-stage scrim
   * over everything, so for its four and a half seconds it painted across the
   * QR in the corner and the code could not be scanned — reported from a real
   * night, on the lobby and the round boards, which is precisely where photos
   * are allowed AND where somebody is still trying to get in.
   *
   * Asked at the moment the photo goes up rather than once at boot: the corner
   * comes and goes with the phase and a photo can arrive at any of them.
   */
  applyPhotoClearance(el);
  document.querySelector('.stage').appendChild(el);

  // Fade out on its own, then hand over to whoever is behind it in the queue.
  setTimeout(() => {
    el.classList.add('going');
    setTimeout(() => { el.remove(); nextBigPhoto(); }, 900);
  }, BIG_PHOTO_MS);
}

/**
 * Fill in the address under every code on the page.
 *
 * The QR image itself is drawn by the server at a fixed address, so it can go
 * on screen the moment a card is built. The written-out address cannot: it is
 * fetched at boot, and a slide can easily be up before that lands. So no card
 * waits for it — they mark the slot with data-join-url and this fills it in
 * whenever it turns up. Getting this wrong once meant a rules slide with an
 * empty half where the code should have been, on a screen the room is looking
 * at while it decides whether to bother joining.
 */
function paintJoinUrls() {
  if (!joinUrl) return;
  for (const el of document.querySelectorAll('[data-join-url]')) el.textContent = joinUrl;
}

/**
 * A small join code, on every screen where somebody could still walk in.
 *
 * The big QR is on the lobby, and it used to be the ONLY one — so the moment
 * the quiz started there was nothing on the projector telling a latecomer
 * where to go. That was true from the beginning; the rules slide simply made
 * it obvious by putting a big empty screen where a code ought to be.
 *
 * Not during a question or a reveal. Twenty seconds with four options wants
 * the whole projector, and a code in the corner is one more thing for the room
 * to look at instead of the answer. Not on the lobby or the rules either,
 * where the code is already half the screen, and not once the game is over.
 *
 * Lives outside the card, like the photo strip, so no card has to know.
 */
const NO_JOIN_CORNER = new Set(['lobby', 'rules', 'question', 'reveal', 'final', 'won', 'finished']);

function paintJoinCorner(s) {
  const wanted = !NO_JOIN_CORNER.has(s.phase)
    && !s.scoreboard
    && !(s.advert && s.advert.heading !== undefined);

  let el = document.getElementById('joinCorner');
  if (!wanted) {
    if (el) el.remove();
  } else if (!el) {
    el = node(`
      <div class="join-corner" id="joinCorner">
        <img src="${joinQr}" alt="Scan to join">
        <div class="join-corner-words">
          <b>Just arrived?</b>
          <span data-join-url></span>
        </div>
      </div>`);
    document.querySelector('.stage').appendChild(el);
  }

  /*
   * A photo already on screen follows the corner in and out.
   *
   * It lasts four and a half seconds and the phase can change underneath it —
   * a round board arriving puts the code up, the scoreboard takes it away.
   * Measured AFTER the corner above has settled into its final state (added,
   * removed, or left alone), never before — `photoClearance()` reads
   * `#joinCorner` straight off the DOM, and reading it mid-change would catch
   * whichever state was about to stop being true. On the lobby, where the
   * small corner is never shown at all, this instead finds the big
   * `.qr-panel` and clears space for that.
   */
  const big = document.getElementById('photoBig');
  if (big) applyPhotoClearance(big);
}

/**
 * The wall of photos from the room.
 *
 * Lives outside the card so it survives every phase change without each card
 * having to know it exists — the same reason the clock and the connection do.
 *
 * Only on the screens where the room is looking around rather than at a
 * question: the lobby while people arrive, and between rounds. Never during a
 * question, where twenty seconds of four options wants the whole projector and
 * a wall of faces is exactly the wrong thing to be looking at.
 *
 * Newest first, so a photo taken thirty seconds ago is the one on the left
 * where everybody is looking.
 */
const PHOTO_PHASES = new Set(['lobby', 'round_board', 'final', 'won', 'finished']);

function paintPhotos(s) {
  const items = s.photos || [];
  let strip = document.getElementById('photoStrip');
  const wanted = items.length > 0 && PHOTO_PHASES.has(s.phase);

  // The first paint of this page is not thirty new photos arriving at once.
  // Opening the big screen an hour in — or a projector reconnecting after the
  // laptop slept — would otherwise queue every picture of the night for its
  // own three and a half seconds in the middle of the screen, which is two
  // minutes of slideshow over whatever the quiz was doing. Note what is
  // already there, show none of it, and only a genuinely new arrival gets a
  // moment. Found by the sticker test: a third run had a queue three deep.
  if (!photosSeeded) {
    photosSeeded = true;
    for (const p of items) seenPhotos.add(p.id);
  }

  if (!wanted) {
    if (strip) strip.remove();
    return;
  }
  if (!strip) {
    strip = node('<div class="photo-strip" id="photoStrip"></div>');
    document.querySelector('.stage').appendChild(strip);
  }

  // Rebuild only what changed. A strip that re-renders wholesale on every
  // state push would flash on the projector every time anybody answered.
  const have = new Map([...strip.children].map((c) => [c.dataset.id, c]));
  const wantedIds = new Set(items.map((p) => p.id));
  for (const [id, el] of have) if (!wantedIds.has(id)) el.remove();

  items.forEach((p, i) => {
    let el = have.get(p.id);
    if (!el) {
      el = node(`
        <figure class="photo" data-id="${esc(p.id)}">
          <img src="${esc(p.url)}" alt="">
          ${p.teamName ? `<figcaption>${esc(p.teamName)}</figcaption>` : ''}
        </figure>`);
      // Brand new, so give it its moment in the middle of the screen first.
      // Tracked by id rather than by "the strip has not got one": the strip is
      // torn down whenever the phase has no room for it, and a photo does not
      // become new again because the scoreboard went up and came down.
      if (!seenPhotos.has(p.id)) {
        seenPhotos.add(p.id);
        showBigPhoto(p);
      }
    }
    // Keep them in order without disturbing ones already in place.
    if (strip.children[i] !== el) strip.insertBefore(el, strip.children[i] || null);
  });
}

/**
 * Mid-quiz scores, on demand.
 *
 * Deliberately the same rows as the round board, so the room reads it the same
 * way it has all night rather than learning a second layout. The heading says
 * where the quiz is, because "how are we doing" is really "how are we doing so
 * far" and a leaderboard with no position in it starts arguments.
 */
function renderScoreboard(s) {
  const all = s.leaderboard || [];
  const rows = all.slice(0, 10);
  const more = all.length - rows.length;
  const where = s.phase === 'reveal' || s.phase === 'question'
    ? `after ${s.questionIndex + 1} question${s.questionIndex === 0 ? '' : 's'} of round ${s.roundIndex + 1}`
    : 'so far';
  return node(`
    <div class="board">
      <h1 class="grad-text">How it stands</h1>
      <div class="board-sub">${esc(where)}</div>
      <div class="board-rows">
        ${rows.length ? rows.map((p, i) => boardRow(p, i)).join('') : '<div class="muted" style="font-size:3vh">No scores yet.</div>'}
      </div>
      ${more > 0 ? `<div class="muted" style="font-size:2.2vh;margin-top:1.6vh">and ${more} more — everyone can see their own position on their phone</div>` : ''}
    </div>
  `);
}

function updateScoreboard(s) {
  const rows = document.querySelector('.board-rows');
  if (!rows) return;
  const all = (s.leaderboard || []).slice(0, 10);
  rows.innerHTML = all.length
    ? all.map((p, i) => boardRow(p, i)).join('')
    : '<div class="muted" style="font-size:3vh">No scores yet.</div>';
}

/**
 * A venue's advertising slide.
 *
 * This one earns money, so it gets the whole screen rather than a corner: the
 * host sells himself to venues on shifting their pizzas and their gig tickets,
 * and a slide that looks like an afterthought is not worth selling.
 *
 * The QR is drawn by the server's own encoder, so a ticket link works with a
 * phone camera from the back of a room with no internet round trip.
 *
 * The host's line for the mic (`say`) is NOT here — that goes to the control
 * view only, like every other thing meant for the host and not the room.
 */
/**
 * TONIGHT'S PHOTOGRAPHS — the last slide of the night, and one big QR.
 *
 * **A SLIDE OF ITS OWN, BECAUSE THE FINAL HAD NO ROOM LEFT.** Measured at
 * 1280x720 and again at 1920x1080: the winner, the podium, fourth place, the
 * draw and the comeback band together come to 707px in a 674px card, and
 * `.winner` centres what it holds — so a night with both a draw and a comeback
 * was ALREADY losing "Tonight's winner" off the top and half the comeback QR
 * off the bottom, at every resolution, before anything was added. A fifth band
 * would have made a bad slide worse and given the code nowhere to be big.
 *
 * **THE QR IS THE POINT, so it gets the size a QR needs.** It is read from
 * across a pub by people holding a drink, which is a harder job than the join
 * code has at the start of the night — they are sitting down for that one.
 *
 * **IT SAYS THE PHOTOS MAY NOT BE THERE YET, and that is not a hedge.**
 * Publishing is deliberately something the quizmaster does afterwards, having
 * looked at what is in the pictures — so at the moment this slide is up, the
 * gallery is almost always still private. Promising them now and delivering in
 * the morning is the truth; "see them now" would be the app lying about its
 * own state, which is the rule the comeback slide already follows.
 */
function renderPhotosSlide(s) {
  const p = s.photoSlide || {};
  const link = String(p.link || '');
  // The projector knows its own origin; the state carries a path, so nothing
  // server-side has to know the host name. A QR needs the whole address.
  const full = link.startsWith('http') ? link : `${location.origin}${link}`;
  return node(`
    <div class="winner photos-slide">
      <div class="kicker">Tonight&rsquo;s photos</div>
      <h1 class="grad-text">${esc(p.venue || 'From the room')}</h1>
      <div class="comeback has-qr">
        <div class="cb-words">
          <div class="cb-line">Scan to see them all</div>
          <div class="cb-note">Up in the morning &mdash; the link keeps working</div>
        </div>
        <div class="cb-qr"><img src="/qr.svg?text=${encodeURIComponent(full)}" alt=""></div>
      </div>
    </div>`);
}

function renderAdvert(s) {
  const a = s.advert || {};
  /*
   * THE COUNTED PAGE WINS WHEN THERE IS AN OFFER CODE.
   *
   * `offerLink` is this app's own `/o/…`, which records the open before it
   * shows the offer — the count is what turns a slide from an act of faith
   * into something a landlord can be shown the morning after. Without a code
   * the QR points where it always did, at whatever the venue gave, because
   * every slide that exists today has only that.
   */
  const qrTarget = a.offerLink || a.link || '';
  const hasQr = Boolean(qrTarget);
  return node(`
    <div class="advert ${a.image ? 'has-image' : ''} ${hasQr ? 'has-qr' : ''}">
      ${a.venue ? `<div class="ad-venue">${esc(a.venue)}</div>` : ''}
      <div class="ad-body">
        <div class="ad-words">
          ${a.heading ? `<h1>${esc(a.heading)}</h1>` : ''}
          ${a.body ? `<p>${esc(a.body)}</p>` : ''}
        </div>
        ${a.image ? `<div class="ad-image"><img src="${esc(a.image)}" alt=""></div>` : ''}
        ${hasQr ? `
          <div class="ad-qr">
            <img src="/qr.svg?text=${encodeURIComponent(qrTarget)}" alt="Scan for more">
            <!-- THE CODE IN WORDS, not only in the grid. Bar staff can hear
                 "QUIZ40", half a room will never scan anything, and a phone
                 held up in a dark bar is a slower transaction than the
                 discount is worth. -->
            <div class="ad-qr-label">${a.offerCode ? esc(a.offerCode) : esc(a.linkLabel || 'Scan me')}</div>
          </div>` : ''}
      </div>
    </div>
  `);
}

/**
 * The rules, as the first slide of the night.
 *
 * The numbers come from the server, which reads them off the scoring code, so
 * this slide cannot end up promising something the app does not do. That
 * matters more than it sounds: a room will hold you to what the screen said.
 */
function renderRules(s) {
  const r = s.rules || { scoring: [] };
  // The whole right half is the code. This is the slide that is up while the
  // room is still filling, so it is worth more here than anywhere else — and
  // half a projector of QR reads from the back of a pub. The points go left.
  return node(`
    <div class="rules">
      <div class="rules-split">
        <div class="rules-left">
          <h1 class="grad-text">How it works</h1>
          <div class="rules-score">
            ${(r.scoring || []).map((row) => `
              <div class="rules-score-row">
                <span class="big">${esc(row.big)}<i>PTS</i></span>
                <span class="what">${esc(row.text)}</span>
              </div>`).join('')}
            ${r.fastest ? `<div class="rules-note">${esc(r.fastest)}</div>` : ''}
          </div>
        </div>
        <div class="rules-join">
          <div class="qr-panel">
            <img src="${joinQr}" alt="Scan to join the quiz">
            <div class="url" data-join-url></div>
          </div>
          <div class="rules-join-head">Not in yet? Point your camera at this</div>
        </div>
      </div>
    </div>
  `);
}

// ------------------------------------------------------------------- lobby

function renderLobby(s) {
  const el = node(`
    <div class="lobby" style="display:flex;flex-direction:column;height:100%">
      <div class="lobby-grid" style="flex:1 1 auto;min-height:0">
        <div>
          <h1 class="grad-text">${esc(s.quizTitle)}</h1>
          <div class="sub">Grab your phone. It takes ten seconds.</div>
          <ol class="join-steps">
            <li><span class="n">1</span><span>Point your camera at the code</span></li>
            <li><span class="n">2</span><span>Type in a name</span></li>
            <li><span class="n">3</span><span>Wait for the first question</span></li>
          </ol>
          <!-- BELOW the steps, not among them. Wedged between the subtitle and
               the list it read as a fourth instruction — and the order is the
               order of the jobs: joining comes first, settling down comes
               after. It gets a box of its own so it is an object rather than a
               stray line, and it is the thing somebody points at when they
               turn round and tell the next table. -->
          <div class="lobby-count" hidden></div>
          <!-- WHAT THEY ARE PLAYING FOR. The prize is why half the room
               bothers, and it used to be said once on the mic and then not
               seen again until the winner's phone lit up. Under the countdown
               because joining comes first — this is what makes somebody stay
               once they are in. -->
          ${(s.rewards || []).length ? `
            <div class="lobby-prize">
              <span class="lp-label">Playing for</span>
              ${s.rewards.map((r, i) => `
                <span class="lp-one"><b class="prize-place p${i + 1}">${['1st', '2nd', '3rd'][i] || `${i + 1}th`}</b> ${esc(r)}</span>`).join('')}
            </div>` : ''}
        </div>
        <div class="qr-panel">
          <img src="${joinQr}" alt="Scan to join the quiz">
          <div class="url" data-join-url>${esc(joinUrl)}</div>
          <!-- WHO IS WINNING AT MAZE MOUTH. Under the code and never over it:
               the QR is the one control that lets somebody into the game, and
               nothing in this app may dim it. Draws nothing until somebody
               has played. -->
          ${arcadeSlot()}
        </div>
      </div>
      <div class="player-strip" id="playerStrip"></div>
    </div>
  `);
  return el;
}

/**
 * THE COUNTDOWN, on the one screen the whole room can already see.
 *
 * The host puts the code up at ten to and kicks off at nine, and this is what
 * fills that gap — it gives the room something to settle to, and it is the
 * thing somebody points at when they tell the next table.
 *
 * **AT ZERO IT SAYS "ANY MOMENT NOW" AND STOPS.** A countdown is a promise, so
 * one that ran on into "4 minutes late" would be the app telling sixty people
 * the host is behind — which is the opposite of what this app is for. It never
 * names a wall-clock time either, for the same reason: 9:00 on a projector is
 * a commitment nobody agreed to.
 *
 * Drawn off the SERVER clock like every other timer here, so a phone and the
 * big screen can never disagree about how long is left.
 */
function paintStartsIn(s) {
  const box = document.querySelector('.lobby-count');
  if (!box) return;
  if (!s.startsAt) { box.hidden = true; return; }
  box.hidden = false;
  const left = Math.max(0, s.startsAt - clock.now());
  if (left <= 0) {
    box.className = 'lobby-count now';
    box.textContent = 'Any moment now…';
    return;
  }
  const secs = Math.ceil(left / 1000);
  const mins = Math.floor(secs / 60);
  box.className = `lobby-count ${secs <= 60 ? 'soon' : ''}`;
  box.innerHTML = secs <= 60
    // Under a minute it counts in seconds, because that is when it is worth
    // watching and when somebody turns round and says "it's starting".
    ? `Starting in <b>${secs}</b> second${secs === 1 ? '' : 's'}`
    : `Starting in <b>${mins + 1}</b> minute${mins + 1 === 1 ? '' : 's'}`;
}

function updateLobby(s) {
  paintStartsIn(s);
  paintArcadeBoard(s);
  const strip = document.getElementById('playerStrip');
  if (!strip) return;
  const wanted = (s.lobby && s.lobby.players) || [];
  const have = new Set([...strip.children].map((c) => c.dataset.id));
  for (const p of wanted) {
    if (!have.has(p.key)) {
      strip.prepend(node(`<div class="player-chip" data-id="${esc(p.key)}">${esc(p.name)}</div>`));
    }
  }
  const wantedIds = new Set(wanted.map((p) => p.key));
  for (const child of [...strip.children]) {
    if (!wantedIds.has(child.dataset.id)) child.remove();
  }
  paintJoinUrls();
}

// -------------------------------------------------------------- round intro

function renderRoundIntro(s) {
  const intro = s.roundIntro || {};
  const typeLabel = {
    text: 'General knowledge',
    image: 'Whose face is this?',
    intro: 'Name that intro',
    multi: 'Pick them all',
    alphabet: 'First letter only',
    breakout: 'Nothing scored — just for laughs',
  }[intro.type] || '';
  const kicker = intro.type === 'breakout'
    ? 'Bonus round'
    : `Round ${s.scoreRoundNumber ?? s.roundIndex + 1}`;
  return node(`
    <div class="round-intro">
      <div class="kicker">${esc(kicker)}</div>
      <h1 class="grad-text">${esc(intro.title || s.roundTitle)}</h1>
      <div class="blurb">${esc(intro.blurb || '')}</div>
      <div class="facts">
        <span class="pill">${intro.questionCount || 0} questions</span>
        <span class="pill">${intro.seconds || 20} seconds each</span>
        ${typeLabel ? `<span class="pill">${esc(typeLabel)}</span>` : ''}
      </div>
    </div>
  `);
}

// ---------------------------------------------------------------- question

function renderQuestion(s) {
  const q = s.question || { prompt: '', options: [] };
  const long = (q.prompt || '').length > 78;
  const media = renderQuestionMedia(s, q);

  // The round type becomes a class, and the stylesheet does the rest. A new
  // round type needs a media block above and a rule here; nothing else.
  const el = node(`
    <div class="question type-${esc(s.roundType || 'text')}" style="display:flex;flex-direction:column;height:100%">
      <div class="q-head">
        <span class="pill q-counter">Question ${s.questionIndex + 1} of ${s.questionCount}</span>
        <span class="answered-count" id="answeredCount"></span>
      </div>
      <div class="timer-wrap">
        <div class="timer-bar"><span id="timerBar"></span></div>
        <div class="timer-num" id="timerNum">--</div>
      </div>
      ${media}
      <h2 class="q-prompt ${long ? 'small' : ''}">${esc(q.prompt)}</h2>
      ${/* The answer in words, on the reveal, directly under the question it
            answers. It gets its own slot up here rather than going in with the
            fastest finger at the bottom, because down there it landed on top of
            the last row of letters — and on this round it is the single most
            important thing on the screen. */ ''}
      <div id="answerSlot"></div>
      <div class="options ${q.alphabet ? 'alphabet' : ''}" id="options">
        ${(q.options || []).map((opt, i) => q.alphabet
          // The option IS the letter, so there is no letter chip and no text
          // beside it — twenty-six tiles, and the room watches its own answer
          // fill up under each one.
          ? `<div class="option" data-i="${i}">
               <span class="text">${esc(opt)}</span>
               <span class="tally" data-tally="${i}"></span>
             </div>`
          : `<div class="option" data-i="${i}">
               <span class="letter">${LETTERS[i]}</span>
               <span class="text">${esc(opt)}</span>
               <span class="tally" data-tally="${i}"></span>
             </div>`).join('')}
      </div>
      <div id="revealSlot"></div>
    </div>
  `);
  return el;
}

/**
 * Round-type specific media. The picture round's zoom lives here; the intro
 * round shows a waveform placeholder and — crucially — never the track name,
 * because the host is reading this same screen for their cue.
 */
function renderQuestionMedia(s, q) {
  if (s.roundType === 'image' && q.image) {
    const mode = q.reveal || 'zoom';
    return `
      <div class="zoom-stage">
        <div class="zoom-frame reveal-${esc(mode)}" id="zoomFrame">
          <img class="zoom-img" id="zoomImg" src="${esc(q.image)}" alt="Mystery musician"
               onerror="this.closest('.zoom-frame').classList.add('no-image')">
          ${mode === 'pixelate' ? '<canvas class="pix-canvas" id="pixCanvas"></canvas>' : ''}
          ${mode === 'tiles' ? tileGrid(s) : ''}
          <div class="zoom-caption">${esc(q.imageCaption || '')}</div>
          <div class="zoom-missing">Picture missing — read this one out</div>
        </div>
      </div>`;
  }
  if (s.roundType === 'intro') {
    return `<div class="intro-visual" id="introVisual">${Array.from({ length: 28 }, (_, i) => `<i style="--i:${i}"></i>`).join('')}</div>`;
  }
  if (s.roundType === 'multi' && q.pickCount) {
    // The instruction, not the answer. How many is what makes the round
    // playable; which ones never reaches this screen.
    return `<div class="pick-banner">Lock in <b>${q.pickCount}</b> answers</div>`;
  }
  if (s.roundType === 'alphabet') {
    // The rule of the round, up where the room can see it. Half of them will
    // not have heard it said, and the whole point is that they can stop
    // worrying about spelling it.
    return '<div class="pick-banner">Tap the <b>first letter</b> of the answer — spelling does not count</div>';
  }
  if (s.roundType === 'breakout') {
    // No options to show — the room is typing whatever they like, on their
    // own phones, and the host reads the funniest ones out afterwards.
    return '<div class="pick-banner">Type your best answer — on your phone. Nothing is scored.</div>';
  }
  return '';
}

/* ---------------------------------------------------------- picture reveals
 *
 * Four ways for a portrait to give itself away, all on the SAME curve. That is
 * the part that matters and the part that is easy to break: you score more the
 * earlier you answer, so how fast a picture becomes guessable IS how many
 * points are on offer. A steady unpixelate would hold the face back until
 * second fifteen and quietly make that round worth half of a zoom round, for
 * the same crowd and the same question.
 *
 * All four are plain canvas or plain CSS. No `ctx.filter` — older iOS does not
 * implement it, and this is the same trap `filters.js` already exists to
 * avoid. Nothing here loads a library.
 */

// How hidden each one starts. Tuned by eye on a 1080p projector: enough that
// the face is genuinely unreadable at second nought, not so much that the
// first five seconds are wasted showing nothing.
const BLUR_FROM = 34;     // pixels of blur
const PIX_FROM = 11;      // how many pixels wide the picture is drawn at
const PIX_TO = 520;       // and by the end
const TILE_ROWS = 4;
const TILE_COLS = 6;

/**
 * The blind for the tiles reveal.
 *
 * The order tiles disappear in is shuffled, but shuffled the SAME WAY every
 * time for a given question — seeded off its position, not off Math.random.
 * A Redo mid-gig has to give the room the picture back the way they were half
 * way through seeing it, not a fresh scramble.
 */
function tileGrid(s) {
  const total = TILE_ROWS * TILE_COLS;
  const order = [...Array(total).keys()];
  let seed = (s.roundIndex + 1) * 7919 + (s.questionIndex + 1) * 104729;
  for (let i = total - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const j = seed % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return `<div class="tile-grid" id="tileGrid" style="--rows:${TILE_ROWS};--cols:${TILE_COLS}">
    ${order.map((o) => `<i data-order="${o}"></i>`).join('')}
  </div>`;
}

/**
 * @param {number} shown  0 = completely hidden, 1 = the whole picture
 */
function paintReveal(q, shown, revealing) {
  const frame = document.getElementById('zoomFrame');
  if (!frame) return;
  const img = document.getElementById('zoomImg');
  const mode = q.reveal || 'zoom';

  if (mode === 'zoom') {
    if (!img) return;
    const from = q.zoomFrom ?? 6;
    const to = q.zoomTo ?? 1;
    const scale = from + (to - from) * shown;
    img.style.transform = `scale(${scale.toFixed(3)})`;
    img.style.transformOrigin = `${q.zoomOriginX ?? 50}% ${q.zoomOriginY ?? 40}%`;
    return;
  }

  if (mode === 'blur') {
    if (!img) return;
    const blur = BLUR_FROM * (1 - shown);
    img.style.filter = blur > 0.4 ? `blur(${blur.toFixed(1)}px)` : 'none';
    // Blown up a touch while it is blurred, so the soft edge is off the side of
    // the frame rather than fading into the panel behind it.
    img.style.transform = `scale(${(1 + 0.09 * (1 - shown)).toFixed(3)})`;
    return;
  }

  if (mode === 'pixelate') {
    const canvas = document.getElementById('pixCanvas');
    if (!canvas || !img || !img.complete || !img.naturalWidth) return;
    // Drawn TINY and blown up by the browser, rather than blurred and sharpened
    // in code: one drawImage of at most a few hundred pixels a frame, which
    // costs nothing even on the laptop driving a projector all night.
    //
    // The resolution DOUBLES rather than climbing in equal steps, and that is
    // the whole difference between this being fair and not. Going from 11
    // pixels across to 22 gives away half the face; going from 260 to 520 gives
    // away nothing anybody can see. Ramped in equal steps the picture was
    // basically solved two seconds in — the same easeOut curve as the zoom, and
    // a far easier question, which is exactly the unfairness these modes are
    // meant to avoid.
    const across = Math.max(2, Math.round(PIX_FROM * Math.pow(PIX_TO / PIX_FROM, shown)));
    const down = Math.max(2, Math.round(across * (img.naturalHeight / img.naturalWidth)));
    if (canvas.width !== across) {
      canvas.width = across;
      canvas.height = down;
    }
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, across, down);
    // At the very end hand over to the real picture, so the reveal is the
    // photograph and not a very good impression of one.
    frame.classList.toggle('pix-done', revealing || shown > 0.995);
    return;
  }

  if (mode === 'tiles') {
    const grid = document.getElementById('tileGrid');
    if (!grid) return;
    const total = TILE_ROWS * TILE_COLS;
    const gone = revealing ? total : Math.floor(shown * total);
    // Only touched when the count actually changes: this runs every frame, and
    // toggling twenty-four classes sixty times a second for nothing is how a
    // projector starts dropping frames.
    if (grid.dataset.gone === String(gone)) return;
    grid.dataset.gone = String(gone);
    for (const tile of grid.children) {
      tile.classList.toggle('gone', Number(tile.dataset.order) < gone);
    }
  }
}

function updateQuestion(s) {
  const q = s.question || {};
  const revealing = s.phase === 'reveal';

  // Answers-in counter, which builds tension without giving anything away.
  const counter = document.getElementById('answeredCount');
  if (counter) {
    counter.textContent = revealing ? '' : `${s.answeredCount || 0} of ${s.playerCount} answered`;
  }

  // The picture gives itself away over the life of the question, so early
  // guesses score more. Which way it does that is `q.reveal`; how fast is the
  // same curve for all of them, because that curve is the difficulty.
  if (s.roundType === 'image' && s.clock) {
    const total = s.clock.endsAt - s.clock.startedAt;
    const elapsed = Math.min(total, Math.max(0, clock.now() - s.clock.startedAt));
    const t = total > 0 ? elapsed / total : 1;
    paintReveal(q, revealing ? 1 : easeOut(t), revealing);
  }

  const optionEls = [...document.querySelectorAll('.option')];
  if (revealing && s.reveal) {
    // One right answer or several — the same set either way, so nothing here
    // has to know which kind of round it is.
    const right = new Set(s.reveal.correctIndexes || [s.reveal.correctIndex]);
    for (const el of optionEls) {
      const i = Number(el.dataset.i);
      el.classList.toggle('correct', right.has(i));
      el.classList.toggle('dimmed', !right.has(i));
      const tallyEl = el.querySelector('[data-tally]');
      const tally = (s.reveal.tally || [])[i] || 0;
      if (tallyEl) tallyEl.textContent = tally ? `${tally}` : '';
    }
    // A lit-up letter is not an answer. On the first-letter round the room has
    // to be told what it actually was, in words, or the reveal says nothing.
    const said = document.getElementById('answerSlot');
    if (said && !said.firstElementChild && s.reveal.correctLetter) {
      said.appendChild(node(`
        <div class="answer-said">
          <span class="answer-letter">${esc(s.reveal.correctLetter)}</span>
          <span class="answer-words">${esc(s.reveal.correctText)}</span>
        </div>`));
    }
    const slot = document.getElementById('revealSlot');
    if (slot && !slot.firstElementChild) {
      slot.appendChild(renderRevealBanner(s));
    }
  } else {
    for (const el of optionEls) {
      el.classList.remove('correct', 'dimmed');
      const tallyEl = el.querySelector('[data-tally]');
      if (tallyEl) tallyEl.textContent = '';
    }
    const slot = document.getElementById('revealSlot');
    if (slot) slot.replaceChildren();
    const said = document.getElementById('answerSlot');
    if (said) said.replaceChildren();
  }
}

function renderRevealBanner(s) {
  const fastest = s.reveal.fastest;
  if (!fastest) {
    return node(`
      <div class="reveal-banner">
        <div>
          <div class="label">Nobody got it</div>
          ${/* Already spelled out above on the first-letter round. */ ''}
          ${s.reveal.correctLetter ? '' : `<div class="who">${esc(s.reveal.correctText)}</div>`}
        </div>
      </div>`);
  }
  return node(`
    <div class="reveal-banner">
      <img class="fastest-face" src="${esc(faceFor(s.photos, fastest))}" alt="">
      <div>
        <div class="label">Fastest finger</div>
        <div class="who">${esc(fastest.name)} — ${fastest.seconds.toFixed(1)}s</div>
      </div>
      <div class="pts">+${fastest.points}</div>
    </div>`);
}

function easeOut(t) {
  return 1 - Math.pow(1 - t, 2.2);
}

// -------------------------------------------------------------- leaderboard

/**
 * HOW LONG THE SCORES HOLD THE SCREEN BEFORE A SLIDE TAKES OVER, and how long
 * each slide then gets.
 *
 * Constants rather than settings, deliberately — this is the simplest version
 * that works, and a number that might want to be configurable is a constant
 * with a note saying so rather than a panel nobody asked for. Twenty seconds
 * is about as long as a room reads a scoreboard; twelve is longer than anyone
 * looks at a poster and short enough that three slides get round twice in an
 * ordinary break.
 */
const BREAK_SCORES_MS = 20000;
const BREAK_SLIDE_MS = 12000;

/**
 * THE CYCLE IS TORN DOWN WHERE EVERY CARD CHANGE PASSES, not where it starts.
 *
 * The phone learned this the expensive way: its lobby game was stopped inside
 * the function that BUILT the lobby, so a game still open when the quiz began
 * kept its loop running on a detached canvas for the rest of the night. The
 * same shape of bug is available here — a break's advert timer left running
 * into a question would swap the projector's card out from under a live
 * question — so the stop lives in `draw()`, which every card change goes
 * through, rather than in the render that starts it.
 */
let breakCycle = null;
function stopBreakCycle() {
  if (breakCycle) clearInterval(breakCycle);
  breakCycle = null;
}

function scoresCard(s) {
  const all = s.leaderboard || [];
  const rows = all.slice(0, 10);
  const more = all.length - rows.length;
  return `
    <div class="board">
      <h1 class="grad-text">${s.roundType === 'breakout' ? 'After the bonus round' : `After round ${s.scoreRoundNumber ?? s.roundIndex + 1}`}</h1>
      <div class="board-rows">
        ${rows.length ? rows.map((p, i) => boardRow(p, i)).join('') : '<div class="muted" style="font-size:3vh">No scores yet.</div>'}
      </div>
      ${more > 0 ? `<div class="muted" style="font-size:2.2vh;margin-top:1.6vh">and ${more} more — everyone can see their own position on their phone</div>` : ''}
    </div>`;
}

/**
 * THE ROUND BOARD — the scores, this venue's slides, both in turn, or nothing.
 *
 * Which of those it is was decided at launch and resolved by the server
 * (`src/breaks.js`): the scores arrive only when the break asked for them,
 * and `breakAdverts` only when it asked for those. **This reads what it was
 * sent rather than deciding for itself**, which is the same rule the phone
 * follows about `lobbyGame` — a projector working it out separately is how
 * the big screen and the console come to disagree.
 *
 * **THE DEFAULT PATH IS UNCHANGED.** A break nobody configured sends a
 * leaderboard and no slides, and this then draws exactly the markup it drew
 * before breaks existed.
 *
 * **NOTHING IS A REAL ANSWER**, asked for in those words. It is not the same
 * as showing neither by accident: a host who wants the room talking to each
 * other rather than reading a projector gets a quiet screen with the brand on
 * it, which is what the corner already carries all night.
 */
function renderBoard(s) {
  const hasScores = Array.isArray(s.leaderboard);
  const ads = Array.isArray(s.breakAdverts) ? s.breakAdverts : [];

  if (!hasScores && !ads.length) {
    return node(`
      <div class="board board-quiet">
        <h1 class="grad-text">${s.roundType === 'breakout' ? 'After the bonus round' : `After round ${s.scoreRoundNumber ?? s.roundIndex + 1}`}</h1>
      </div>`);
  }

  if (!ads.length) return node(scoresCard(s));

  const el = node('<div class="board-cycle"></div>');
  /*
   * THE SCORES GO FIRST WHEN THERE ARE ANY — the host's own choice, and the
   * right one for a paid slide: the room gets the thing it looked up FOR, and
   * the venue gets the screen once it has. A slide that arrives before the
   * scores is a slide people are waiting through.
   */
  const frames = (hasScores ? 1 : 0) + ads.length;
  let at = 0;
  const paint = () => {
    if (hasScores && at === 0) {
      el.replaceChildren(node(scoresCard(s)));
      return;
    }
    el.replaceChildren(renderAdvert({ ...s, advert: ads[hasScores ? at - 1 : at] }));
  };
  paint();
  /*
   * ONE INTERVAL, RE-ARMED — not a chain of `setTimeout`s, because the first
   * frame is longer than the rest and a chain of differing delays is a thing
   * that can be left half-scheduled when the card is replaced. Clearing one
   * handle is something `stopBreakCycle()` can do without knowing where in
   * the cycle it was.
   */
  const step = () => {
    at = (at + 1) % frames;
    paint();
    stopBreakCycle();
    breakCycle = setInterval(step, at === 0 && hasScores ? BREAK_SCORES_MS : BREAK_SLIDE_MS);
  };
  stopBreakCycle();
  breakCycle = setInterval(step, hasScores ? BREAK_SCORES_MS : BREAK_SLIDE_MS);
  return el;
}

function boardRow(p, i) {
  const topClass = p.position === 1 ? 'top1' : p.position === 2 ? 'top2' : p.position === 3 ? 'top3' : '';
  return `
    <div class="board-row ${topClass}" style="animation-delay:${i * 55}ms">
      <span class="pos">${p.position}</span>
      <span class="name">${esc(p.name)}</span>
      <span class="score">${p.score.toLocaleString('en-GB')}</span>
    </div>`;
}

/**
 * NOTHING ON THE FINAL MAY BE CUT OFF — the backstop, measured after it draws.
 *
 * **THE SLIDE WAS ALREADY CLIPPING, and nobody had reported it.** `.winner` is
 * a grid with `place-content: center` inside a fixed-height card, and
 * `body.screen` hides the overflow — so content taller than the card is cut at
 * BOTH ends at once. Measured against the real stylesheet:
 *
 * ```
 *                              1280x720   1920x1080   1024x768
 *   draw + comeback              72px        104px       75px
 *   draw + league + comeback    142px        212px      151px
 * ```
 *
 * What went was **"Tonight's winner"** off the top and the bottom of the
 * comeback band — with its QR sliced in half — off the foot. Proportional, so
 * every projector lost the same share.
 *
 * **TIGHTENING THE MARGINS WAS TRIED AND IS NOT A FIX**: it still clipped
 * 120px on a league night. That is a plaster the next feature undoes, which is
 * exactly what this function exists to stop happening a third time.
 *
 * **SO THE REAL FIX IS IN TWO PARTS AND THIS IS THE SECOND.** The draw and the
 * comeback sit SIDE BY SIDE now (`.endband`), which buys the height honestly
 * and loses nothing — on an ordinary 16:9 night that alone is enough and this
 * scales by 1.00, changing nothing. This is the guarantee underneath it: after
 * that, whatever is on the slide, it is shrunk just enough to fit rather than
 * cut.
 *
 * **IT MEASURES THE CHILDREN, NOT `scrollHeight`.** On a grid with
 * `place-content: center` scrollHeight CLAMPS to the container — so it
 * under-reports precisely when the content is too tall, which is the only
 * moment this is asked anything. The first version used it, computed 0.84
 * where 0.70 was needed, and still clipped.
 *
 * **`--fit` IS RESET TO 1 BEFORE MEASURING**, or each pass would measure a box
 * that is already shrunk and creep towards nothing.
 */
function fitWinner() {
  const w = cardEl.querySelector('.winner');
  if (!w) return;
  w.style.setProperty('--fit', '1');
  const room = cardEl.clientHeight;
  const kids = [...w.children];
  if (!room || !kids.length) return;
  const top = Math.min(...kids.map((n) => n.getBoundingClientRect().top));
  const bottom = Math.max(...kids.map((n) => n.getBoundingClientRect().bottom));
  const need = bottom - top;
  // Never GROW past 1: a sparse night must look exactly as it always has.
  w.style.setProperty('--fit', String(Math.min(1, room / Math.max(1, need))));
}

// A projector plugged into a different screen mid-evening is a real thing, and
// the room it has to fit into changes with it.
window.addEventListener('resize', () => requestAnimationFrame(fitWinner));

function renderWinner(s) {
  const board = s.leaderboard || [];
  const winner = board[0];
  if (!winner) {
    return node('<div class="winner"><h1>No scores</h1></div>');
  }
  const alsoFirst = board.filter((p) => p.position === 1);
  /*
   * THE PODIUM IS SECOND AND THIRD, and they SHARE the row — half each.
   *
   * They used to be three equal cards in a line, 2nd, 3rd and 4th, all the
   * same size — so the podium read as three also-rans of equal weight and
   * being second looked like being fourth. Second and third are placings
   * people tell their mates about; fourth is context.
   *
   * So the two of them take the whole width between them, which makes them
   * big enough to read from the back without touching the winner's own size:
   * first place stays 13vh and alone, because that is the result the night is
   * about.
   *
   * Capped at three cells for the tie case (two teams on 2nd and one on 3rd);
   * beyond that a column would be too thin to read, which is the one thing
   * this screen must not be.
   */
  const rest = board.filter((p) => p.position !== 1);
  const runners = rest.filter((p) => p.position <= 3).slice(0, 3);
  // Fourth, if the board has one. A LINE rather than a card: it is context,
  // not a placing, and giving it the podium's treatment is what cost second
  // and third theirs in the first place.
  const alsoRan = rest.filter((p) => p.position > 3).slice(0, 1);
  return node(`
    <div class="winner">
      <div class="kicker">${alsoFirst.length > 1 ? 'It is a tie' : 'Tonight&rsquo;s winner'}</div>
      <h1 class="grad-text">${alsoFirst.map((p) => esc(p.name)).join(' &amp; ')}</h1>
      <div class="score">${winner.score.toLocaleString('en-GB')} points</div>
      ${runners.length ? `<div class="runners">${runners.map((p) => `
        <div class="runner place-${p.position}">
          <span class="rplace">${p.position}</span>
          <span class="rname">${esc(p.name)}</span>
          <span class="rscore">${p.score.toLocaleString('en-GB')}</span>
        </div>`).join('')}</div>` : ''}
      ${alsoRan.length ? `<div class="alsoran">${alsoRan.map((p) => `
        <span>${p.position}. ${esc(p.name)} — ${p.score.toLocaleString('en-GB')}</span>`).join('')}</div>` : ''}
      ${leagueBand(s)}
      <div class="endband">
        ${s.luckyDip ? `
          <div class="dip">
            <div class="dip-label">And the draw goes to</div>
            <div class="dip-name">${esc(s.luckyDip.name)}</div>
            <div class="dip-note">drawn from ${s.luckyDip.outOf} still playing at the last question</div>
          </div>` : ''}
        ${comeBackBand(s)}
      </div>
    </div>
  `);
}

/**
 * THE LEAGUE, ON THE PROJECTOR, AT THE END OF THE NIGHT.
 *
 * The table is the reason the room comes back next week, and it only does that
 * job if the room SEES it — a card on the quizmaster's console is evidence for
 * a landlord, not a hook for sixty people who have just finished playing.
 *
 * **UNDER the winner, the podium and the draw, and above the comeback band.**
 * That order is the evening's own: who won tonight, who won something, where
 * the season stands, when we are back. It is the same rule the comeback slide
 * follows — nothing may sit over the result the room is waiting for.
 *
 * **Silent on a first night.** `session.js` only writes it once the venue has
 * more than one night in the season, because a "league" containing tonight
 * alone is just the scoreboard printed twice.
 *
 * Sized in `vh` like everything else on this screen: it is read from the back
 * of a dark pub, and five rows is what fits under a podium without pushing the
 * comeback band off the bottom.
 */
function leagueBand(s) {
  if (!s.league || !s.league.table || !s.league.table.length) return '';
  return `
    <div class="lgb">
      <div class="lgb-label">The league after tonight</div>
      <div class="lgb-rows">
        ${s.league.table.map((t) => `
          <div class="lgb-row${t.position === 1 ? ' lgb-top' : ''}">
            <span class="lgb-pos">${t.position}</span>
            <span class="lgb-name">${esc(t.name)}</span>
            <span class="lgb-pts">${t.points}</span>
          </div>`).join('')}
      </div>
      <div class="lgb-note">${s.league.teams} teams · ${s.league.nights} nights · best six finishes, plus one a night</div>
    </div>`;
}

// ------------------------------------------------------------------- timer

/**
 * The countdown is redrawn every frame from the server's end time, not counted
 * down locally, so it cannot drift away from what the server believes.
 */
function tick() {
  requestAnimationFrame(tick);
  /*
   * The lobby countdown ticks HERE, not on a state push.
   *
   * Nothing pushes while a lobby sits there with nobody joining, so a
   * countdown redrawn only on `updateLobby` would freeze at whatever it said
   * when the last person arrived — and then jump. Same loop as the question
   * timer and, like it, recomputed from the server's timestamp every frame
   * rather than counted down locally, so it cannot drift.
   */
  if (state && state.phase === 'lobby') paintStartsIn(state);
  if (!state || !state.clock) return;
  const bar = document.getElementById('timerBar');
  const num = document.getElementById('timerNum');
  if (!bar || !num) return;

  const { startedAt, endsAt } = state.clock;
  const total = endsAt - startedAt;
  const left = state.phase === 'reveal' ? 0 : Math.max(0, endsAt - clock.now());
  const fraction = total > 0 ? left / total : 0;

  bar.style.transform = `scaleX(${fraction.toFixed(4)})`;
  const seconds = Math.ceil(left / 1000);
  num.textContent = state.phase === 'reveal' ? '0' : String(seconds);
  num.classList.toggle('urgent', state.phase === 'question' && left <= 5000 && left > 0);

  if (state.phase === 'question') updateQuestion(state);
}
requestAnimationFrame(tick);

// -------------------------------------------------------------------- boot

fetch(`/api/join-url${roomQuery}`)
  .then((r) => r.json())
  .then((d) => {
    joinUrl = (d.url || '').replace(/^https?:\/\//, '');
    paintJoinUrls();
  })
  .catch(() => {});

new Live(`/api/stream?role=screen${roomParam()}`, {
  onState: draw,
  onStatus: (status) => connWarnEl.classList.toggle('hidden', status === 'online'),
});

/**
 * Keep the projector awake.
 *
 * A laptop that dims or sleeps during a long lobby takes the pub's screen with
 * it. This asks the browser to hold the display on for as long as this page is
 * open, and re-asks after the tab has been in the background (the lock is
 * dropped automatically when you switch away).
 *
 * It is not a substitute for turning off sleep in system settings, but it
 * covers the common case of nobody touching the laptop for twenty minutes
 * while the room fills up.
 */
if ('wakeLock' in navigator) {
  let lock = null;
  const hold = async () => {
    try {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => { lock = null; });
    } catch {
      /* denied, or the tab is not visible — nothing we can do */
    }
  };
  hold();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !lock) hold();
  });
}
