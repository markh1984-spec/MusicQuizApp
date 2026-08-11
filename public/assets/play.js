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

import { esc, node, ServerClock, Live, postJson, brandMark, brandWords, roomCode, roomParam, rememberRoom } from './client.js';
import { renderBingo, updateBingo, bingoKey } from './play-bingo.js';
import { FILTERS, drawFiltered, toJpeg } from './filters.js';
import { STICKERS, stickerSvg, drawStickers, stickerAt, placed, preloadStickers } from './stickers.js';
import { paintLook, DEFAULT_LOOK } from './looks.js';
import { paintScheme } from './schemes.js';

const STORE_KEY = 'musicquiz.player';


const bodyEl = document.getElementById('body');
const headEl = document.getElementById('head');
const teamNameEl = document.getElementById('teamName');
const teamScoreEl = document.getElementById('teamScore');
const teamRankEl = document.getElementById('teamRank');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');

const clock = new ServerClock();
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

let me = loadMe();
let state = null;
let currentKey = null;
let live = null;
let pendingChoice = null; // shown immediately, before the server confirms

/** Your name on the players' phones too — they are looking at it all night. */
// The product half of the name, kept so the wordmark can be stacked. Set by
// whichever of /api/brand or the state payload arrives first.
let brandApp = '';
function paintBrand(name, appName) {
  if (appName) brandApp = appName;
  const slot = document.getElementById('brandSlot');
  if (!slot || !name || slot.dataset.done) return;
  slot.innerHTML = `${brandMark(22)}${brandWords(name, brandApp)}`;
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
      <p>Pick a name. It goes on the big screen, so make it a good one.</p>
      ${message ? `<p style="color:var(--bad);font-weight:700">${esc(message)}</p>` : ''}
      <input type="text" id="nameInput" placeholder="Your name" maxlength="28"
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
      const player = await postJson('/api/join', { playerId: me && me.id, token: me && me.token, name, joinCode: roomCode() });
      rememberRoom(player.joinCode);
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
    const player = await postJson('/api/join', { playerId: me.id, token: me.token, name: me.name, joinCode: roomCode() });
    rememberRoom(player.joinCode);
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

/* ------------------------------------------------------------------ camera
 *
 * Pick or take a photo, choose a look, send it to the projector.
 *
 * No approval queue anywhere in this — the host decided that early and for a
 * good reason: the fun is that it is theirs to do, and he would rather deal
 * with a rude photo over the mic than spend a quiz night as a moderator. So
 * the phone says plainly that it goes straight up, and there is no "waiting to
 * be approved" state to design because there is no approval.
 *
 * A plain file input rather than a live camera feed. It opens the phone's own
 * camera on every phone ever made, needs no permission prompt of our own, and
 * cannot get into the state where a borrowed Android shows a black rectangle
 * with a room watching.
 */
function openCamera() {
  const sheet = node(`
    <div class="cam-overlay">
      <div class="cam-sheet">
        <div class="cam-head">
          <b>Put a photo on the big screen</b>
          <button class="cam-close" title="Close">✕</button>
        </div>
        <p class="tiny cam-warn">It goes straight up, no approval. Keep it decent.</p>
        <label class="cam-pick">
          <input type="file" accept="image/*" hidden>
          <span>Take or choose a photo</span>
        </label>
        <div class="cam-stage" hidden>
          <div class="cam-frame">
            <canvas class="cam-canvas"></canvas>
          </div>
          <div class="cam-looks-head">
            <span>Stick something on</span>
            <button class="cam-undo" hidden>Take it off</button>
          </div>
          <div class="cam-props"></div>
          <div class="cam-hint tiny">Tap one, then drag it about. Pinch to make it bigger.</div>
          <details class="cam-colour">
            <summary>Change the colour instead</summary>
            <div class="cam-filters"></div>
          </details>
          <button class="cam-send">Send it up</button>
        </div>
        <div class="tiny cam-status"></div>
      </div>
    </div>`);

  const close = () => sheet.remove();
  sheet.querySelector('.cam-close').addEventListener('click', close);
  sheet.addEventListener('click', (e) => { if (e.target === sheet) close(); });

  const input = sheet.querySelector('input[type=file]');
  const stage = sheet.querySelector('.cam-stage');
  const canvas = sheet.querySelector('.cam-canvas');
  const chips = sheet.querySelector('.cam-filters');
  const props = sheet.querySelector('.cam-props');
  const undoBtn = sheet.querySelector('.cam-undo');
  const sendBtn = sheet.querySelector('.cam-send');
  const status = sheet.querySelector('.cam-status');

  let source = null;
  let chosen = 'none';
  // The props on the photo, in the order they were added. Positions are
  // fractions of the picture, never pixels — see stickers.js.
  let stuckOn = [];

  const repaint = () => {
    if (!source) return;
    drawFiltered(canvas, source, chosen);
    // Awaited nowhere: the props are cached images after the first draw, so
    // this settles within a frame and dragging stays smooth.
    drawStickers(canvas, stuckOn);
    for (const chip of chips.children) chip.classList.toggle('on', chip.dataset.id === chosen);
    undoBtn.hidden = stuckOn.length === 0;
  };

  /*
   * Every look, as a thumbnail of their own photo.
   *
   * It was a scrolling row of grey pills, and the host went through the whole
   * thing on his own phone without noticing it was there — three of the seven
   * were off the right-hand edge with nothing to say so. Now they all fit, and
   * each one shows what it does rather than naming it. Same maths as the big
   * preview and the upload, just drawn small, so nothing can drift.
   */
  const paintThumbs = () => {
    if (!source) return;
    for (const chip of chips.children) {
      drawFiltered(chip.querySelector('canvas'), source, chip.dataset.id, 120);
    }
  };

  for (const f of FILTERS) {
    const chip = node(`
      <button class="cam-chip" data-id="${f.id}">
        <canvas></canvas>
        <span>${esc(f.label)}</span>
      </button>`);
    chip.addEventListener('click', () => { chosen = f.id; repaint(); });
    chips.appendChild(chip);
  }

  /*
   * The props.
   *
   * Tap one and it lands in the middle of the picture, big enough to see;
   * then it is dragged where it belongs. There is no face detection and there
   * is not meant to be — putting the ears on wrong is most of the fun, and
   * every way of doing it properly either needs a download or does not work on
   * an iPhone. See stickers.js.
   */
  preloadStickers();
  for (const s of STICKERS) {
    const chip = node(`
      <button class="cam-prop" data-id="${s.id}" title="${esc(s.label)}" aria-label="${esc(s.label)}">
        ${stickerSvg(s.id)}
      </button>`);
    chip.addEventListener('click', async () => {
      stuckOn.push(placed(s.id));
      if (navigator.vibrate) navigator.vibrate(12);
      repaint();
    });
    props.appendChild(chip);
  }

  undoBtn.addEventListener('click', () => {
    stuckOn.pop();
    repaint();
  });

  /*
   * Dragging, and pinching to size.
   *
   * Pointer events rather than touch events, so the same code works on a phone,
   * a tablet and a laptop with a mouse — and so a second finger arriving is a
   * normal thing to handle rather than a different API.
   */
  const pointers = new Map();
  let dragging = null;
  let pinchFrom = 0;
  let sizeFrom = 0;

  const spotOf = (e) => {
    const box = canvas.getBoundingClientRect();
    return { x: (e.clientX - box.left) / box.width, y: (e.clientY - box.top) / box.height };
  };
  const gap = () => {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  canvas.addEventListener('pointerdown', (e) => {
    if (!source) return;
    canvas.setPointerCapture(e.pointerId);
    const spot = spotOf(e);
    pointers.set(e.pointerId, spot);
    if (pointers.size === 1) {
      dragging = stickerAt(stuckOn, spot.x, spot.y, canvas);
      // Whatever you grab comes to the front, so the next drag gets the same one.
      if (dragging) {
        stuckOn = [...stuckOn.filter((s) => s !== dragging), dragging];
        repaint();
      }
    } else if (pointers.size === 2 && dragging) {
      pinchFrom = gap();
      sizeFrom = dragging.size;
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    e.preventDefault();
    pointers.set(e.pointerId, spotOf(e));
    if (!dragging) return;

    if (pointers.size >= 2 && pinchFrom > 0) {
      const scale = gap() / pinchFrom;
      dragging.size = Math.max(0.06, Math.min(1.1, sizeFrom * scale));
    } else {
      const spot = spotOf(e);
      // Allowed slightly off the edge: half a pair of ears hanging off the top
      // of the picture is a normal thing to want.
      dragging.x = Math.max(-0.2, Math.min(1.2, spot.x));
      dragging.y = Math.max(-0.2, Math.min(1.2, spot.y));
    }
    repaint();
  });

  const letGo = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchFrom = 0;
    if (pointers.size === 0) dragging = null;
  };
  canvas.addEventListener('pointerup', letGo);
  canvas.addEventListener('pointercancel', letGo);

  input.addEventListener('change', () => {
    const file = input.files && input.files[0];
    if (!file) return;
    status.textContent = 'Loading…';
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      source = img;
      stage.hidden = false;
      status.textContent = '';
      repaint();
      paintThumbs();
    };
    img.onerror = () => { status.textContent = 'That did not look like a photo.'; };
    img.src = URL.createObjectURL(file);
  });

  sendBtn.addEventListener('click', async () => {
    if (!source || !me) return;
    sendBtn.disabled = true;
    sendBtn.textContent = 'Sending…';
    status.textContent = '';
    try {
      // Redrawn full size rather than sent as the preview: the preview canvas
      // is however big the phone is, and the projector deserves the real thing.
      // Same functions as the preview, so what they saw is what goes up.
      drawFiltered(canvas, source, chosen, 1280);
      await drawStickers(canvas, stuckOn);
      const blob = await toJpeg(canvas);
      const res = await fetch(`/api/photo?playerId=${encodeURIComponent(me.id)}&filter=${encodeURIComponent(chosen)}${roomParam()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'image/jpeg' },
        body: blob,
      });
      const data = await res.json().catch(() => ({}));
      if (!data.ok) throw new Error(reasonText(data.reason));
      sheet.querySelector('.cam-sheet').replaceChildren(node(`
        <div style="text-align:center;padding:22px 6px">
          <div style="font-size:44px">🎉</div>
          <b>It is on the screen</b>
          <p class="tiny">Have a look up.</p>
        </div>`));
      setTimeout(close, 1800);
    } catch (err) {
      status.textContent = err.message;
      sendBtn.disabled = false;
      sendBtn.textContent = 'Send it up';
    }
  });

  document.body.appendChild(sheet);
}

function reasonText(reason) {
  return {
    off: 'Photos are switched off just now.',
    too_big: 'That photo is too big — try another.',
    not_an_image: 'That did not look like a photo.',
    not_playing: 'Join the quiz first.',
    could_not_save: 'The server could not save it.',
  }[reason] || 'It did not send. Try again.';
}

// ------------------------------------------------------------------ screens

function draw(next) {
  state = next;
  clock.sync(state.serverNow);
  paintBrand(state.brand, state.appName);

  // The host removed this team: drop the stored id and start again.
  if (state.kicked) {
    localStorage.removeItem(STORE_KEY);
    me = null;
    if (live) { live.stop(); live = null; }
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

  paintCameraButton(state);

  /*
   * The same look as the projector, and this is not decoration on the phone —
   * it is the option colours. A player looks up, decides "the pink one, bottom
   * left", and looks back down. If the big screen went orange and the phone
   * stayed pink that mapping breaks, and the theme has cost them points.
   *
   * The shapes are much fainter here. There is no margin on a phone, and the
   * buttons matter more than the atmosphere.
   */
  const look = state.look || DEFAULT_LOOK;
  if (document.documentElement.dataset.look !== look) {
    document.documentElement.dataset.look = look;
  }
  // The quizmaster's own two colours, under the look. Taken from the payload,
  // so this phone wears the colours of the room it JOINED — the same rule the
  // look follows, and for the same reason: both screens or neither.
  paintScheme(state.scheme);
  paintLook(document.body, look, { count: 6, size: 34 });
}

/**
 * The camera button.
 *
 * Lives outside the body so it survives every redraw — the body is thrown away
 * and rebuilt on each phase change, and a button that vanished every question
 * would never get used.
 *
 * Hidden while a question is live. Twenty seconds with four options wants the
 * whole screen and the whole player, and anybody taking a photo during it is
 * losing the points they came for.
 */
function paintCameraButton(s) {
  const wanted = Boolean(s.photosOpen && s.you && s.phase !== 'question');
  let btn = document.getElementById('cameraBtn');
  if (!wanted) {
    if (btn) btn.remove();
    return;
  }
  if (btn) return;
  btn = node('<button class="camera-btn" id="cameraBtn" title="Put a photo on the big screen">📷</button>');
  btn.addEventListener('click', openCamera);
  // Fixed-position, so it goes on the body rather than inside the scrolling
  // wrap — the phone layout has no positioned container to hang it off.
  document.body.appendChild(btn);
}

function screenKey(s) {
  if (s.game === 'bingo') return bingoKey(s);
  if (s.phase === 'question' || s.phase === 'reveal') return `q:${s.roundIndex}:${s.questionIndex}:${s.phase}`;
  return `${s.phase}:${s.roundIndex}`;
}

function buildScreen(s) {
  // The camera button floats over the bottom right of the phone. On a bingo
  // card that put 58 pixels of button on top of a square — one nobody can tap,
  // and therefore a full house nobody can get. This tells the stylesheet to
  // move it down beside the BINGO button instead.
  document.body.classList.toggle('bingo-card', s.game === 'bingo' && s.phase !== 'lobby');
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

/**
 * The first-letter round: a keyboard and nothing else.
 *
 * Twenty-six keys rather than four answers, and the same rule as every other
 * round — one tap, locked in, no changing your mind. The point of the round is
 * that spelling does not matter, so there is nothing to type and nothing to get
 * wrong except the letter itself.
 *
 * A to Z, NOT QWERTY. Two reasons, and the second is the one that decided it:
 * the projector shows A to Z, and hunting a single letter is faster in the
 * order you already know it in — QWERTY is muscle memory for typing words, and
 * nobody is typing a word here.
 *
 * Five across, where the projector is nine. This is the one place the two
 * screens are deliberately a different shape, and it is a thumb problem: nine
 * keys across a 320px phone is 28 pixels each, well under what anybody can hit
 * in a dark pub against a clock. The order is the same, which is what actually
 * matters — a player looking for F is not matching a position on the big
 * screen, they already know which letter they want.
 */
const KEYBOARD = ['ABCDE', 'FGHIJ', 'KLMNO', 'PQRST', 'UVWXY', 'Z'];

function buildAlphabetAnswers(s) {
  const options = s.options || [];
  const at = (letter) => options.indexOf(letter);

  const el = node(`
    <div style="display:flex;flex-direction:column;gap:14px;flex:1 1 auto">
      <div class="timer">
        <div class="bar"><span id="pTimerBar"></span></div>
        <div class="num" id="pTimerNum">--</div>
      </div>
      <div class="muted" id="pHint" style="font-size:15px;text-align:center">
        Question ${s.questionIndex + 1} of ${s.questionCount} — tap the <b>first letter</b> of the answer
      </div>
      <div class="keyboard" id="answers">
        ${KEYBOARD.map((row) => `
          <div class="keyboard-row">
            ${[...row].map((letter) => `
              <button class="answer-btn key" data-i="${at(letter)}">${letter}</button>`).join('')}
          </div>`).join('')}
      </div>
      <div class="tiny" style="text-align:center;opacity:.7">Spelling does not count. Just the letter it starts with.</div>
    </div>
  `);

  el.querySelectorAll('.answer-btn').forEach((btn) => {
    btn.addEventListener('click', () => choose(Number(btn.dataset.i)));
  });
  return el;
}

function buildAnswers(s) {
  if (s.multi) return buildMultiAnswers(s);
  if (s.alphabet) return buildAlphabetAnswers(s);
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

/**
 * Pick-them-all: tap to select, tap again to change your mind, then lock in.
 *
 * Nothing is sent until Lock in is pressed, which is the whole difference from
 * every other round — the timing that scores you is the moment you commit, not
 * the moment you first tapped something. So selecting is free and reversible,
 * and there is one deliberate action that ends it.
 *
 * The Lock in button is the only place that says how many are still needed.
 * Putting a count somewhere else as well is one more thing to read in a dark
 * pub with a clock running.
 */
let picks = new Set();

function buildMultiAnswers(s) {
  const options = s.options || [];
  const want = s.pickCount || 2;
  picks = new Set();

  const el = node(`
    <div style="display:flex;flex-direction:column;gap:14px;flex:1 1 auto">
      <div class="timer">
        <div class="bar"><span id="pTimerBar"></span></div>
        <div class="num" id="pTimerNum">--</div>
      </div>
      <div class="muted" id="pHint" style="font-size:15px;text-align:center">
        Question ${s.questionIndex + 1} of ${s.questionCount} — pick <b>${want}</b>
      </div>
      <div class="answers multi" id="answers">
        ${options.map((opt, i) => `
          <button class="answer-btn pickable" data-i="${i}">
            <span class="letter">${LETTERS[i]}</span>
            <span class="text">${esc(opt)}</span>
            <span class="tick">✓</span>
          </button>`).join('')}
      </div>
      <button class="lock-btn" id="lockBtn" disabled>Pick ${want}</button>
    </div>
  `);

  const lock = el.querySelector('#lockBtn');
  const refresh = () => {
    for (const btn of el.querySelectorAll('.answer-btn')) {
      btn.classList.toggle('picked', picks.has(Number(btn.dataset.i)));
    }
    const left = want - picks.size;
    lock.disabled = left !== 0;
    lock.textContent = left === 0
      ? 'Lock it in'
      : left > 0 ? `Pick ${left} more` : `${-left} too many`;
  };

  el.querySelectorAll('.answer-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (pendingChoice !== null || answered(state)) return;
      const i = Number(btn.dataset.i);
      if (picks.has(i)) picks.delete(i);
      else if (picks.size < want) picks.add(i);
      else return; // full: they have to un-pick one first
      if (navigator.vibrate) navigator.vibrate(10);
      refresh();
    });
  });

  lock.addEventListener('click', () => lockIn([...picks]));
  refresh();
  return el;
}

function answered(s) {
  return Boolean(s && s.yourAnswer && s.yourAnswer.optionIndex !== undefined);
}

async function lockIn(optionIndexes) {
  if (pendingChoice !== null || answered(state)) return;
  pendingChoice = optionIndexes;
  paintLocked(optionIndexes);
  if (navigator.vibrate) navigator.vibrate(24);
  try {
    await postJson('/api/answer', { playerId: me.id, token: me.token, optionIndexes, joinCode: roomCode() });
  } catch {
    pendingChoice = null;
  }
}

function paintLocked(indexes) {
  const set = new Set(indexes);
  document.querySelectorAll('.answer-btn').forEach((btn) => {
    const i = Number(btn.dataset.i);
    btn.disabled = true;
    btn.classList.toggle('picked', set.has(i));
    btn.classList.toggle('chosen', set.has(i));
    btn.classList.toggle('faded', !set.has(i));
  });
  const lock = document.getElementById('lockBtn');
  if (lock) { lock.disabled = true; lock.textContent = 'Locked in'; }
  const hint = document.getElementById('pHint');
  if (hint) hint.textContent = 'Locked in. No changing your mind.';
}

async function choose(optionIndex) {
  if (pendingChoice !== null || (state.yourAnswer && state.yourAnswer.optionIndex !== undefined)) return;
  pendingChoice = optionIndex;
  paintChoice(optionIndex);
  if (navigator.vibrate) navigator.vibrate(18);
  try {
    await postJson('/api/answer', { playerId: me.id, token: me.token, optionIndex, joinCode: roomCode() });
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
  if (s.phase !== 'question') return;

  if (s.multi) {
    const locked = s.yourAnswer ? s.yourAnswer.optionIndexes : pendingChoice;
    if (Array.isArray(locked)) paintLocked(locked);
    return;
  }
  const chosen = s.yourAnswer ? s.yourAnswer.optionIndex : pendingChoice;
  if (chosen !== null && chosen !== undefined) paintChoice(chosen);
}

function buildReveal(s) {
  const r = s.reveal || {};
  // On the first-letter round the answer is what they want to hear, and the
  // letter is how they said it — so say both, in that order.
  if (r.correctLetter) r.correctText = `${r.correctText} — ${r.correctLetter}`;
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
           <div class="big">${mine.outOf > 1 ? 'All ' + mine.outOf : 'Correct'}</div>
           <div class="pts">+${mine.points}</div>
           <div class="sub">${mine.seconds.toFixed(1)} seconds</div>
           ${mine.isFirstCorrect ? '<div class="bonus">First correct — +100 bonus</div>' : ''}
         </div>`
      // Part marks deserve their own face. "Not this time" over a score of 180
      // reads as a bug, and "2 of 3" is the thing they want to know.
      : mine.gotRight > 0
        ? `<div class="result part">
             <div class="big">${mine.gotRight} of ${mine.outOf}</div>
             <div class="pts">+${mine.points}</div>
             <div class="sub">They were <strong>${esc(r.correctText || '')}</strong></div>
           </div>`
        : `<div class="result bad">
             <div class="big">Not this time</div>
             <div class="sub">The answer${(r.correctIndexes || []).length > 1 ? 's were' : ' was'} <strong>${esc(r.correctText || '')}</strong></div>
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
  // Retire the old one first. A live connection carries the player id in its
  // URL, so leaving a previous one running means a second stream still
  // claiming to be whoever we used to be.
  if (live) live.stop();
  live = new Live(`/api/stream?role=player&playerId=${encodeURIComponent(me.id)}${roomParam()}`, {
    onState: draw,
    onStatus: setStatus,
  });
}

/**
 * On load, if we already have an id, quietly rejoin with it. That covers the
 * refresh, the locked phone and the dropped connection in one go, and it also
 * lets somebody who wandered in late join partway through.
 */
/*
 * Tell the server when this phone leaves the app mid-question.
 *
 * Not a lock and not a penalty — you cannot stop a browser opening another tab,
 * and the phone in somebody's other hand is beyond anything running here. All
 * this does is give the host a count on his own screen, which he can act on or
 * ignore.
 *
 * Deliberately quiet about itself: nothing on the phone says it is happening,
 * because a warning would make the innocent 95% of the room feel policed to
 * catch the rest, and because announcing the check is how you teach people to
 * beat it. It is also why one instance means nothing — a call coming in looks
 * identical — so the server counts questions, not moments.
 */
function watchForWandering() {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;
    if (!me || !me.id) return;
    if (!state || state.phase !== 'question') return;
    // Fire and forget. It must never delay or break anything a player is
    // doing, and it is only ever a note.
    postJson('/api/wandered', { playerId: me.id, token: me.token, joinCode: roomCode() }).catch(() => {});
  });
}

async function boot() {
  // The room's name and colours before a single state push has arrived, so the
  // join screen is already the right quizmaster's rather than flashing the
  // house colours and changing under somebody's thumb. Carries the join code,
  // because at this point the phone knows which game it is heading for and the
  // server has no cookie to work it out from.
  fetch(`/api/brand${roomParam('?')}`).then((r) => r.json()).then((d) => {
    paintBrand(d.name, d.appName);
    paintScheme(d.scheme);
  }).catch(() => {});
  watchForWandering();

  if (me && me.id) {
    try {
      const player = await postJson('/api/join', { playerId: me.id, token: me.token, name: me.name, joinCode: roomCode() });
      rememberRoom(player.joinCode);
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
