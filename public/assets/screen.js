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

import { esc, node, ServerClock, Live, brandMark } from './client.js';
import { bingoCard, bingoTopbar } from './screen-bingo.js';

const cardEl = document.getElementById('card');
const quizTitleEl = document.getElementById('quizTitle');
const roundPillEl = document.getElementById('roundPill');
const playerPillEl = document.getElementById('playerPill');
const connWarnEl = document.getElementById('connWarn');

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
  round_intro: { key: (s) => `intro:${s.roundIndex}`, render: renderRoundIntro },
  question: { key: (s) => `q:${s.roundIndex}:${s.questionIndex}`, render: renderQuestion, update: updateQuestion },
  reveal: { key: (s) => `q:${s.roundIndex}:${s.questionIndex}`, render: renderQuestion, update: updateQuestion },
  round_board: { key: (s) => `board:${s.roundIndex}`, render: renderBoard },
  final: { key: () => 'final', render: renderWinner },
};

function draw(next) {
  state = next;
  clock.sync(state.serverNow);

  // The brand sits in the corner all night; the quiz title sits next to it.
  if (state.brand && !document.getElementById('brandSlot').dataset.done) {
    const slot = document.getElementById('brandSlot');
    slot.innerHTML = `${brandMark(26)}<span class="brand-name">${esc(state.brand)}</span>`;
    slot.dataset.done = '1';
    document.title = `${state.brand} — Big Screen`;
  }
  quizTitleEl.textContent = state.quizTitle || state.title || 'Music Quiz';
  playerPillEl.textContent = `${state.playerCount} ${state.playerCount === 1 ? 'team' : 'teams'}`;

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
        : `Round ${state.roundIndex + 1} of ${state.roundCount}`;

  // The scoreboard is shown over whatever the quiz is doing, without moving
  // it. Picked here rather than as a phase so there is nothing to undo.
  const card = state.advert && state.advert.heading !== undefined
    ? cards.advert
    : state.scoreboard
      ? cards.scoreboard
      : isBingo ? bingoCard(state) : (cards[state.phase] || cards.lobby);
  const key = card.key(state);
  if (key !== currentKey) {
    currentKey = key;
    cardEl.replaceChildren(card.render(state, joinUrl));
  } else if (card.update) {
    card.update(state);
  }

  paintPhotos(state);
  paintJoinCorner(state);
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
  const wanted = Boolean(joinUrl)
    && !NO_JOIN_CORNER.has(s.phase)
    && !s.scoreboard
    && !(s.advert && s.advert.heading !== undefined);

  let el = document.getElementById('joinCorner');
  if (!wanted) {
    if (el) el.remove();
    return;
  }
  if (el) return;
  el = node(`
    <div class="join-corner" id="joinCorner">
      <img src="/join-qr.svg" alt="Scan to join">
      <div class="join-corner-words">
        <b>Just arrived?</b>
        <span>${esc(joinUrl)}</span>
      </div>
    </div>`);
  document.querySelector('.stage').appendChild(el);
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
      ${more > 0 ? `<div class="muted" style="font-size:2.2vh;margin-top:1.6vh">and ${more} more team${more === 1 ? '' : 's'} — everyone can see their own position on their phone</div>` : ''}
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
function renderAdvert(s) {
  const a = s.advert || {};
  const hasQr = Boolean(a.link);
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
            <img src="/qr.svg?text=${encodeURIComponent(a.link)}" alt="Scan for more">
            <div class="ad-qr-label">${esc(a.linkLabel || 'Scan me')}</div>
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
  const r = s.rules || { scoring: [], how: [] };
  // The whole right half is the code. This is the slide that is up while the
  // room is still filling, so it is worth more here than anywhere else — and
  // half a projector of QR reads from the back of a pub. The rules go left.
  const join = joinUrl
    ? `<div class="rules-join">
         <div class="qr-panel">
           <img src="/join-qr.svg" alt="Scan to join the quiz">
           <div class="url">${esc(joinUrl)}</div>
         </div>
         <div class="rules-join-head">Not in yet? Point your camera at this</div>
       </div>`
    : '';
  return node(`
    <div class="rules${join ? ' has-join' : ''}">
      <div class="rules-split">
        <div class="rules-left">
          <h1 class="grad-text">How it works</h1>
          <div class="rules-grid">
            <div class="rules-how">
              <ol>
                ${(r.how || []).map((line) => `<li>${esc(line)}</li>`).join('')}
              </ol>
            </div>
            <div class="rules-score">
              <div class="rules-score-head">Points</div>
              ${(r.scoring || []).map((row) => `
                <div class="rules-score-row">
                  <span class="big">${esc(row.big)}</span>
                  <span class="what">${esc(row.text)}</span>
                </div>`).join('')}
              ${r.fastest ? `<div class="rules-note">${esc(r.fastest)}</div>` : ''}
            </div>
          </div>
        </div>
        ${join}
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
            <li><span class="n">2</span><span>Type in a team name</span></li>
            <li><span class="n">3</span><span>Wait for the first question</span></li>
          </ol>
        </div>
        <div class="qr-panel">
          <img src="/join-qr.svg" alt="Scan to join the quiz">
          <div class="url" id="joinUrl">${esc(joinUrl)}</div>
        </div>
      </div>
      <div class="player-strip" id="playerStrip"></div>
    </div>
  `);
  return el;
}

function updateLobby(s) {
  const strip = document.getElementById('playerStrip');
  if (!strip) return;
  const wanted = (s.lobby && s.lobby.players) || [];
  const have = new Set([...strip.children].map((c) => c.dataset.id));
  for (const p of wanted) {
    if (!have.has(p.id)) {
      strip.prepend(node(`<div class="player-chip" data-id="${esc(p.id)}">${esc(p.name)}</div>`));
    }
  }
  const wantedIds = new Set(wanted.map((p) => p.id));
  for (const child of [...strip.children]) {
    if (!wantedIds.has(child.dataset.id)) child.remove();
  }
  const urlEl = document.getElementById('joinUrl');
  if (urlEl && joinUrl) urlEl.textContent = joinUrl;
}

// -------------------------------------------------------------- round intro

function renderRoundIntro(s) {
  const intro = s.roundIntro || {};
  const typeLabel = { text: 'General knowledge', image: 'Whose face is this?', intro: 'Name that intro', multi: 'Pick them all' }[intro.type] || '';
  return node(`
    <div class="round-intro">
      <div class="kicker">Round ${s.roundIndex + 1}</div>
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
      <div class="options" id="options">
        ${(q.options || []).map((opt, i) => `
          <div class="option" data-i="${i}">
            <span class="letter">${LETTERS[i]}</span>
            <span class="text">${esc(opt)}</span>
            <span class="tally" data-tally="${i}"></span>
          </div>
        `).join('')}
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
    return `
      <div class="zoom-stage">
        <div class="zoom-frame" id="zoomFrame">
          <img class="zoom-img" id="zoomImg" src="${esc(q.image)}" alt="Mystery musician"
               onerror="this.closest('.zoom-frame').classList.add('no-image')">
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
  return '';
}

function updateQuestion(s) {
  const q = s.question || {};
  const revealing = s.phase === 'reveal';

  // Answers-in counter, which builds tension without giving anything away.
  const counter = document.getElementById('answeredCount');
  if (counter) {
    counter.textContent = revealing ? '' : `${s.answeredCount || 0} of ${s.playerCount} answered`;
  }

  // Zoom: pull back over the life of the question so early guesses score more.
  const img = document.getElementById('zoomImg');
  if (img && s.clock) {
    const total = s.clock.endsAt - s.clock.startedAt;
    const elapsed = Math.min(total, Math.max(0, clock.now() - s.clock.startedAt));
    const t = total > 0 ? elapsed / total : 1;
    const from = q.zoomFrom ?? 6;
    const to = q.zoomTo ?? 1;
    const scale = revealing ? to : from + (to - from) * easeOut(t);
    img.style.transform = `scale(${scale.toFixed(3)})`;
    img.style.transformOrigin = `${q.zoomOriginX ?? 50}% ${q.zoomOriginY ?? 40}%`;
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
  }
}

function renderRevealBanner(s) {
  const fastest = s.reveal.fastest;
  if (!fastest) {
    return node(`
      <div class="reveal-banner">
        <div>
          <div class="label">Nobody got it</div>
          <div class="who">${esc(s.reveal.correctText)}</div>
        </div>
      </div>`);
  }
  return node(`
    <div class="reveal-banner">
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

function renderBoard(s) {
  const all = s.leaderboard || [];
  const rows = all.slice(0, 10);
  const more = all.length - rows.length;
  return node(`
    <div class="board">
      <h1 class="grad-text">After round ${s.roundIndex + 1}</h1>
      <div class="board-rows">
        ${rows.length ? rows.map((p, i) => boardRow(p, i)).join('') : '<div class="muted" style="font-size:3vh">No scores yet.</div>'}
      </div>
      ${more > 0 ? `<div class="muted" style="font-size:2.2vh;margin-top:1.6vh">and ${more} more team${more === 1 ? '' : 's'} — everyone can see their own position on their phone</div>` : ''}
    </div>
  `);
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

function renderWinner(s) {
  const board = s.leaderboard || [];
  const winner = board[0];
  if (!winner) {
    return node('<div class="winner"><h1>No scores</h1></div>');
  }
  const alsoFirst = board.filter((p) => p.position === 1);
  const runners = board.filter((p) => p.position !== 1).slice(0, 3);
  return node(`
    <div class="winner">
      <div class="kicker">${alsoFirst.length > 1 ? 'It is a tie' : 'Tonight&rsquo;s winner'}</div>
      <h1 class="grad-text">${alsoFirst.map((p) => esc(p.name)).join(' &amp; ')}</h1>
      <div class="score">${winner.score.toLocaleString('en-GB')} points</div>
      ${runners.length ? `<div class="runners">${runners.map((p) => `<span>${p.position}. ${esc(p.name)} — ${p.score.toLocaleString('en-GB')}</span>`).join('')}</div>` : ''}
    </div>
  `);
}

// ------------------------------------------------------------------- timer

/**
 * The countdown is redrawn every frame from the server's end time, not counted
 * down locally, so it cannot drift away from what the server believes.
 */
function tick() {
  requestAnimationFrame(tick);
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

fetch('/api/join-url')
  .then((r) => r.json())
  .then((d) => {
    joinUrl = (d.url || '').replace(/^https?:\/\//, '');
    const el = document.getElementById('joinUrl');
    if (el) el.textContent = joinUrl;
  })
  .catch(() => {});

new Live('/api/stream?role=screen', {
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
