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

import { esc, node, ServerClock, Live } from './client.js';

const cardEl = document.getElementById('card');
const quizTitleEl = document.getElementById('quizTitle');
const roundPillEl = document.getElementById('roundPill');
const playerPillEl = document.getElementById('playerPill');
const connWarnEl = document.getElementById('connWarn');

const clock = new ServerClock();
let state = null;
let currentKey = null;
let joinUrl = '';

const LETTERS = ['A', 'B', 'C', 'D'];

// --------------------------------------------------------------- card registry

const cards = {
  lobby: { key: () => 'lobby', render: renderLobby, update: updateLobby },
  round_intro: { key: (s) => `intro:${s.roundIndex}`, render: renderRoundIntro },
  question: { key: (s) => `q:${s.roundIndex}:${s.questionIndex}`, render: renderQuestion, update: updateQuestion },
  reveal: { key: (s) => `q:${s.roundIndex}:${s.questionIndex}`, render: renderQuestion, update: updateQuestion },
  round_board: { key: (s) => `board:${s.roundIndex}`, render: renderBoard },
  final: { key: () => 'final', render: renderWinner },
};

function draw(next) {
  state = next;
  clock.sync(state.serverNow);

  quizTitleEl.textContent = state.quizTitle || 'Music Quiz';
  playerPillEl.textContent = `${state.playerCount} ${state.playerCount === 1 ? 'team' : 'teams'}`;
  roundPillEl.textContent = state.phase === 'lobby'
    ? 'Join now'
    : state.phase === 'final'
      ? 'Results'
      : `Round ${state.roundIndex + 1} of ${state.roundCount}`;

  const card = cards[state.phase] || cards.lobby;
  const key = card.key(state);
  if (key !== currentKey) {
    currentKey = key;
    cardEl.replaceChildren(card.render(state));
  } else if (card.update) {
    card.update(state);
  }
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
  const typeLabel = { text: 'General knowledge', image: 'Whose face is this?', intro: 'Name that intro' }[intro.type] || '';
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

  const el = node(`
    <div class="question" style="display:flex;flex-direction:column;height:100%">
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
      <div class="zoom-frame" id="zoomFrame">
        <img class="zoom-img" id="zoomImg" src="${esc(q.image)}" alt="Mystery musician">
        <div class="zoom-caption">${esc(q.imageCaption || '')}</div>
      </div>`;
  }
  if (s.roundType === 'intro') {
    return `<div class="intro-visual" id="introVisual">${Array.from({ length: 28 }, (_, i) => `<i style="--i:${i}"></i>`).join('')}</div>`;
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
    const from = q.zoomFrom ?? 7;
    const to = q.zoomTo ?? 1;
    const scale = revealing ? to : from + (to - from) * easeOut(t);
    img.style.transform = `scale(${scale.toFixed(3)})`;
    img.style.transformOrigin = `${q.zoomOriginX ?? 50}% ${q.zoomOriginY ?? 40}%`;
  }

  const optionEls = [...document.querySelectorAll('.option')];
  if (revealing && s.reveal) {
    for (const el of optionEls) {
      const i = Number(el.dataset.i);
      el.classList.toggle('correct', i === s.reveal.correctIndex);
      el.classList.toggle('dimmed', i !== s.reveal.correctIndex);
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
  const rows = (s.leaderboard || []).slice(0, 10);
  return node(`
    <div class="board">
      <h1 class="grad-text">After round ${s.roundIndex + 1}</h1>
      <div class="board-rows">
        ${rows.length ? rows.map((p, i) => boardRow(p, i)).join('') : '<div class="muted" style="font-size:3vh">No scores yet.</div>'}
      </div>
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
