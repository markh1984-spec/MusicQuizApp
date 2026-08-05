/**
 * The player's phone.
 *
 * Two things matter more than anything else here:
 *
 *  - RECONNECTING MUST NOT LOSE YOUR SCORE. The player id lives in
 *    localStorage, so a locked phone, a refresh, a dropped signal or a closed
 *    tab all come back to the same team with the same points. Rejoining is
 *    just posting the id we already have.
 *
 *  - THE QUESTION TEXT IS NOT HERE. Only the four options are. The question is
 *    on the big screen, which keeps the room looking up rather than down, and
 *    makes googling an answer that bit harder.
 */

import { esc, node, ServerClock, Live, postJson, brandMark } from './client.js';
import { renderBingo, updateBingo, bingoKey } from './play-bingo.js';

const STORE_KEY = 'musicquiz.player';

const bodyEl = document.getElementById('body');
const headEl = document.getElementById('head');
const teamNameEl = document.getElementById('teamName');
const teamScoreEl = document.getElementById('teamScore');
const teamRankEl = document.getElementById('teamRank');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');

const clock = new ServerClock();
const LETTERS = ['A', 'B', 'C', 'D'];

let me = loadMe();
let state = null;
let currentKey = null;
let live = null;
let pendingChoice = null; // shown immediately, before the server confirms

/** Your name on the players' phones too — they are looking at it all night. */
function paintBrand(name) {
  const slot = document.getElementById('brandSlot');
  if (!slot || !name || slot.dataset.done) return;
  slot.innerHTML = `${brandMark(22)}<span class="brand-name">${esc(name)}</span>`;
  slot.dataset.done = '1';
  document.title = name;
}

function loadMe() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveMe(player) {
  me = player;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(player));
  } catch {
    /* private browsing: they will just have to keep the tab open */
  }
}

// -------------------------------------------------------------------- join

function showJoin(message = '') {
  currentKey = 'join';
  headEl.hidden = true;
  bodyEl.replaceChildren(node(`
    <div style="display:grid;gap:16px">
      <h1 class="grad-text">Join the quiz</h1>
      <p>Pick a team name. It goes on the big screen, so make it a good one.</p>
      ${message ? `<p style="color:var(--bad);font-weight:700">${esc(message)}</p>` : ''}
      <input type="text" id="nameInput" placeholder="Your team name" maxlength="28"
             autocomplete="off" autocapitalize="words" enterkeyhint="go" value="${esc((me && me.name) || '')}">
      <button class="btn" id="joinBtn">Join</button>
    </div>
  `));

  const input = document.getElementById('nameInput');
  const button = document.getElementById('joinBtn');
  const go = async () => {
    const name = input.value.trim();
    if (!name) { input.focus(); return; }
    button.disabled = true;
    button.textContent = 'Joining…';
    try {
      const player = await postJson('/api/join', { playerId: me && me.id, name });
      saveMe(player);
      startLive();
    } catch (err) {
      button.disabled = false;
      button.textContent = 'Join';
      showJoin('Could not join: ' + err.message);
    }
  };
  button.addEventListener('click', go);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
}

/**
 * Put ourselves back after the server forgot the game.
 *
 * Backed off rather than fired on every state push: if the rejoin itself is
 * failing, hammering it sixty phones at a time is the last thing a struggling
 * server needs. Only gives up and asks for a team name after several goes,
 * because a name typed once should not have to be typed again.
 */
let rejoinAt = 0;
let rejoinTries = 0;

async function silentRejoin() {
  if (!me || !me.id) { showJoin(); return; }
  const now = Date.now();
  if (now < rejoinAt) return;
  rejoinAt = now + Math.min(8000, 500 * 2 ** rejoinTries);
  rejoinTries++;

  try {
    const player = await postJson('/api/join', { playerId: me.id, name: me.name });
    const changedId = player.id !== me.id;
    saveMe(player);
    rejoinTries = 0;
    rejoinAt = 0;
    // The stream carries our id in its URL, so a new one means a new stream.
    if (changedId) startLive();
  } catch {
    if (rejoinTries > 6) {
      rejoinTries = 0;
      showJoin('Lost the connection to the quiz. Tap Join to come back in.');
    }
  }
}

// ------------------------------------------------------------------ screens

function draw(next) {
  state = next;
  clock.sync(state.serverNow);
  paintBrand(state.brand);

  // The host removed this team: drop the stored id and start again.
  if (state.kicked) {
    localStorage.removeItem(STORE_KEY);
    me = null;
    if (live && live.source) live.source.close();
    showJoin('You were removed from the quiz. Join again below.');
    return;
  }

  // The server does not know us, and nobody removed us — so it lost its memory
  // of the game: a restart, a redeploy, or a fresh game launched over the top.
  // Quietly join again with the same id and name. Whatever is on screen stays
  // there while that happens, because being thrown back to "pick a team name"
  // mid-question is exactly what this is here to prevent.
  if (state.rejoin) {
    silentRejoin();
    return;
  }

  if (state.you) {
    headEl.hidden = false;
    teamNameEl.textContent = state.you.name;
    if (state.game === 'bingo') {
      // No score in bingo — what matters is how close you are.
      teamScoreEl.textContent = state.you.squaresAway === 0 ? '✓' : state.you.squaresAway;
      teamRankEl.textContent = state.you.squaresAway === 0 ? 'line complete' : 'squares to go';
    } else {
      teamScoreEl.textContent = state.you.score.toLocaleString('en-GB');
      teamRankEl.textContent = state.you.position
        ? `${ordinal(state.you.position)} of ${state.you.playerCount}`
        : '';
    }
  }

  const key = screenKey(state);
  if (key !== currentKey) {
    currentKey = key;
    pendingChoice = null;
    bodyEl.replaceChildren(buildScreen(state));
  } else {
    updateScreen(state);
  }
}

function screenKey(s) {
  if (s.game === 'bingo') return bingoKey(s);
  if (s.phase === 'question' || s.phase === 'reveal') return `q:${s.roundIndex}:${s.questionIndex}:${s.phase}`;
  return `${s.phase}:${s.roundIndex}`;
}

function buildScreen(s) {
  if (s.game === 'bingo') return renderBingo(s, me);
  switch (s.phase) {
    case 'question': return buildAnswers(s);
    case 'reveal': return buildReveal(s);
    case 'round_board':
    case 'final': return buildBoard(s);
    case 'round_intro': return buildWaiting(s, `Round ${s.roundIndex + 1}`, s.roundTitle, 'Eyes on the big screen.');
    default: return buildWaiting(s, "You're in", s.you ? s.you.name : '', 'Hang tight — the quiz starts shortly.');
  }
}

function buildWaiting(s, kicker, title, sub) {
  return node(`
    <div style="display:grid;gap:14px;text-align:center">
      <div class="pill" style="justify-self:center;font-size:13px">${esc(kicker)}</div>
      <h1 class="grad-text">${esc(title)}</h1>
      <p>${esc(sub)}</p>
    </div>
  `);
}

function buildAnswers(s) {
  const options = s.options || [];
  const el = node(`
    <div style="display:flex;flex-direction:column;gap:16px;flex:1 1 auto">
      <div class="timer">
        <div class="bar"><span id="pTimerBar"></span></div>
        <div class="num" id="pTimerNum">--</div>
      </div>
      <div class="muted" id="pHint" style="font-size:15px;text-align:center">Question ${s.questionIndex + 1} of ${s.questionCount} — read it on the big screen</div>
      <div class="answers" id="answers">
        ${options.map((opt, i) => `
          <button class="answer-btn" data-i="${i}">
            <span class="letter">${LETTERS[i]}</span>
            <span class="text">${esc(opt)}</span>
          </button>`).join('')}
      </div>
    </div>
  `);

  el.querySelectorAll('.answer-btn').forEach((btn) => {
    btn.addEventListener('click', () => choose(Number(btn.dataset.i)));
  });
  return el;
}

async function choose(optionIndex) {
  if (pendingChoice !== null || (state.yourAnswer && state.yourAnswer.optionIndex !== undefined)) return;
  pendingChoice = optionIndex;
  paintChoice(optionIndex);
  if (navigator.vibrate) navigator.vibrate(18);
  try {
    await postJson('/api/answer', { playerId: me.id, optionIndex });
  } catch {
    // The state push is the source of truth; if the answer did not land the
    // buttons come back live on the next update.
    pendingChoice = null;
  }
}

function paintChoice(index) {
  document.querySelectorAll('.answer-btn').forEach((btn) => {
    const i = Number(btn.dataset.i);
    btn.disabled = true;
    btn.classList.toggle('chosen', i === index);
    btn.classList.toggle('faded', i !== index);
  });
  const hint = document.getElementById('pHint');
  if (hint) hint.textContent = 'Locked in. No changing your mind.';
}

function updateScreen(s) {
  if (s.game === 'bingo') return updateBingo(s, me);
  if (s.phase === 'question') {
    const chosen = s.yourAnswer ? s.yourAnswer.optionIndex : pendingChoice;
    if (chosen !== null && chosen !== undefined) paintChoice(chosen);
  }
}

function buildReveal(s) {
  const r = s.reveal || {};
  const mine = s.yourAnswer;
  const answered = mine && mine.optionIndex !== undefined;
  const correct = answered && mine.correct;

  const resultCard = !answered
    ? `<div class="result">
         <div class="big">Too slow</div>
         <div class="sub">The answer was <strong>${esc(r.correctText || '')}</strong></div>
       </div>`
    : correct
      ? `<div class="result good">
           <div class="big">Correct</div>
           <div class="pts">+${mine.points}</div>
           <div class="sub">${mine.seconds.toFixed(1)} seconds</div>
           ${mine.isFirstCorrect ? '<div class="bonus">First correct — +100 bonus</div>' : ''}
         </div>`
      : `<div class="result bad">
           <div class="big">Not this time</div>
           <div class="sub">The answer was <strong>${esc(r.correctText || '')}</strong></div>
         </div>`;

  const fastest = r.fastest
    ? `<div class="mini-row"><span class="pos">⚡</span><span>${esc(r.fastest.name)}</span><span class="score">${r.fastest.seconds.toFixed(1)}s</span></div>`
    : '';

  return node(`
    <div style="display:grid;gap:16px">
      ${resultCard}
      ${fastest ? `<div><div class="muted" style="font-size:13px;margin-bottom:6px">Fastest finger</div>${fastest}</div>` : ''}
    </div>
  `);
}

function buildBoard(s) {
  const rows = s.leaderboard || [];
  const isFinal = s.phase === 'final';
  const youId = s.you ? s.you.id : '';
  const winner = rows[0];

  return node(`
    <div style="display:grid;gap:16px">
      <h2>${isFinal ? 'Final scores' : `After round ${s.roundIndex + 1}`}</h2>
      ${isFinal && winner ? `<div class="result good"><div class="sub">Winner</div><div class="big">${esc(winner.name)}</div><div class="pts">${winner.score.toLocaleString('en-GB')}</div></div>` : ''}
      <div class="mini-board">
        ${rows.map((p) => `
          <div class="mini-row ${p.id === youId ? 'you' : ''}">
            <span class="pos">${p.position}</span>
            <span>${esc(p.name)}</span>
            <span class="score">${p.score.toLocaleString('en-GB')}</span>
          </div>`).join('')}
      </div>
      ${s.you && !rows.some((p) => p.id === youId)
        ? `<div class="mini-row you"><span class="pos">${s.you.position || '—'}</span><span>${esc(s.you.name)}</span><span class="score">${s.you.score.toLocaleString('en-GB')}</span></div>`
        : ''}
    </div>
  `);
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ------------------------------------------------------------------- timer

function tick() {
  requestAnimationFrame(tick);
  if (!state || !state.clock || state.phase !== 'question') return;
  const bar = document.getElementById('pTimerBar');
  const num = document.getElementById('pTimerNum');
  if (!bar || !num) return;
  const { startedAt, endsAt } = state.clock;
  const total = endsAt - startedAt;
  const left = Math.max(0, endsAt - clock.now());
  bar.style.transform = `scaleX(${(total > 0 ? left / total : 0).toFixed(4)})`;
  num.textContent = String(Math.ceil(left / 1000));
  num.classList.toggle('urgent', left <= 5000);
}
requestAnimationFrame(tick);

// -------------------------------------------------------------------- boot

function setStatus(status) {
  const online = status === 'online';
  statusDot.classList.toggle('off', !online);
  statusText.textContent = online ? 'Connected' : 'Reconnecting…';
}

function startLive() {
  live = new Live(`/api/stream?role=player&playerId=${encodeURIComponent(me.id)}`, {
    onState: draw,
    onStatus: setStatus,
  });
}

/**
 * On load, if we already have an id, quietly rejoin with it. That covers the
 * refresh, the locked phone and the dropped connection in one go, and it also
 * lets somebody who wandered in late join partway through.
 */
async function boot() {
  fetch('/api/brand').then((r) => r.json()).then((d) => paintBrand(d.name)).catch(() => {});

  if (me && me.id) {
    try {
      const player = await postJson('/api/join', { playerId: me.id, name: me.name });
      saveMe(player);
      startLive();
      return;
    } catch {
      /* fall through to the join screen */
    }
  }
  showJoin();
  setStatus('offline');
  statusText.textContent = 'Not joined yet';
}
boot();
