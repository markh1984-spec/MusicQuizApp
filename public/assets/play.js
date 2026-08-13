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
import { drawFiltered, toJpeg } from './filters.js';
import { stickersFor, stickerSvg, drawStickers, stickerAt, placed, preloadStickers } from './stickers.js';
import { paintLook, DEFAULT_LOOK, LOOKS } from './looks.js';
import { paintScheme } from './schemes.js';
import { paintChatButton } from './chat.js';

const STORE_KEY = 'musicquiz.player';

/*
 * How long a thumb has to rest on a prop before it lifts.
 *
 * Long enough that a flick to scroll the sheet is never mistaken for it, short
 * enough that it does not feel like waiting. The phone's own drag-out-of-a-list
 * gesture sits around here, which is why nobody has to be told about it.
 */
const HOLD_MS = 200;

/*
 * How close together two taps on the same prop have to be to mean "take it
 * off". The same third of a second every phone uses, so it is already in
 * people's hands, and far enough apart that two deliberate separate taps are
 * never mistaken for it.
 */
const DOUBLE_TAP_MS = 320;


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

/**
 * "Hang on, the host is letting people in."
 *
 * Deliberately not an error and deliberately not a number: telling somebody
 * they are 47th in a queue makes them close the tab. It says what is happening
 * and that it is being handled, and then it fixes itself.
 */
/**
 * A scratch id for a phone that has not joined yet.
 *
 * Only ever used to count people at the door — see src/joins.js. A phone that
 * has actually joined has a real id and a token and never queues at all.
 */
const TRY_KEY = 'musicquiz.tryId';
function tryId() {
  try {
    let id = localStorage.getItem(TRY_KEY);
    if (!id) {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(TRY_KEY, id);
    }
    return id;
  } catch {
    return '';
  }
}

function showWaiting() {
  currentKey = 'waiting';
  headEl.hidden = true;
  bodyEl.replaceChildren(node(`
    <div style="display:grid;gap:14px;justify-items:center;text-align:center;padding:28px 8px">
      <div class="big" style="font-size:22px;font-weight:900">Just a moment</div>
      <div class="muted" style="font-size:16px;line-height:1.5">
        A lot of phones are joining at once.<br>The host is letting everybody in — this will go through on its own.
      </div>
    </div>`));
}

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
      const player = await postJson('/api/join', {
        playerId: me && me.id, token: me && me.token, name, joinCode: roomCode(),
        // Something stable per phone, so ten retries while the door is held
        // count as one person waiting rather than ten. The host reads that
        // number to tell a room from mischief, and an inflated one would push
        // them towards NOT letting a real room in.
        tryId: tryId(),
      });
      /*
       * Held at the door rather than refused.
       *
       * A lot of new phones are arriving at once and the host is being asked
       * whether it is a room or somebody messing about. Nothing has gone
       * wrong, so this does not read as an error — it keeps asking, quietly,
       * and goes straight in the moment the host taps. See src/joins.js.
       */
      if (player.waiting) {
        button.textContent = 'Waiting…';
        showWaiting();
        setTimeout(go, 3000);
        return;
      }
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
    // A phone that can prove who it is is never held, so this should not
    // happen — but if the token has gone it is a new join, and waiting quietly
    // beats showing somebody an error mid-quiz.
    if (player.waiting) return;
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
  // Tonight's look, from the game state — the same value that paints the
  // projector and this page, so the props cannot disagree with either.
  const look = (state && state.look) || DEFAULT_LOOK;
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
          <!-- SEND SITS UNDER THE PHOTO, above everything else.
               It was last on the sheet, so finishing a photo meant scrolling
               back past three dozen tiles to find the button — the same fault
               that put the hint above the tray rather than below it. Here it
               is always next to the thing it sends, whatever you have just
               added. -->
          <button class="cam-send">Send it up</button>
          <div class="cam-looks-head cam-season-head" hidden>
            <span class="cam-season-name"></span>
            <button class="cam-undo cam-undo-top" hidden>Undo</button>
          </div>
          <div class="cam-props cam-props-season" hidden></div>
          <!-- The heading and the four gestures are ONE CARD. Apart, the
               heading was a fifth floating thing above a block of chips —
               and a heading that does not sit on the thing it names is not
               doing its job. -->
          <div class="cam-guide">
          <div class="cam-looks-head">
            <span>Stick something on</span>
            <button class="cam-undo" hidden>Undo</button>
          </div>
          <!-- ABOVE the tray, not below it. It was underneath, which meant
               scrolling past three dozen tiles to find out what to do with
               them.

               FOUR CHUNKS RATHER THAN A SENTENCE, and each one stays whole.
               As one line of prose it broke wherever the phone happened to run
               out of room — "pinch to size" on one line and "and turn" on the
               next — which reads as a ragged paragraph rather than as a list of
               gestures. Wrapped as pieces it is even at any width and an
               instruction can never be split down the middle. -->
          <div class="cam-hint tiny">
            <span>Tap to add</span>
            <span>Hold to drag</span>
            <!-- A hard space in "and turn": inside a chip on a 320px phone
                 this is the one line that does not fit, and left to the
                 browser it breaks after "and" and leaves "turn" on its own. -->
            <span>Pinch to size and&nbsp;turn</span>
            <span>Double-tap to delete</span>
          </div>
          </div>
          <div class="cam-props"></div>
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
  // NOT `.cam-props` — the seasonal tray carries that class too (it wants the
  // same grid), so a bare selector matched the seasonal one and every prop was
  // appended into a container that stays hidden on an ordinary night. The tray
  // came up empty and nothing threw.
  const props = sheet.querySelector('.cam-props:not(.cam-props-season)');
  const undoBtn = sheet.querySelector('.cam-undo');
  const seasonHead = sheet.querySelector('.cam-season-head');
  const seasonProps = sheet.querySelector('.cam-props-season');
  const seasonName = sheet.querySelector('.cam-season-name');
  const sendBtn = sheet.querySelector('.cam-send');
  const status = sheet.querySelector('.cam-status');

  let source = null;
  /*
   * The photo is drawn through `drawFiltered` with no look on it.
   *
   * The COLOUR GRADING IS GONE — see CLAUDE.md. It was folded away behind
   * "change the colour instead" and it was still a second thing to find on a
   * panel whose whole job is the funny props. `drawFiltered(..., 'none')` is
   * kept as the draw path rather than replaced with a bare drawImage, because
   * it is the one place the sizing is worked out and the preview and the
   * upload go through the same function so they cannot drift.
   */
  const PLAIN = 'none';
  // The props on the photo, in the order they were added. Positions are
  // fractions of the picture, never pixels — see stickers.js.
  let stuckOn = [];

  const repaint = () => {
    if (!source) return;
    // A smaller canvas than the upload's. The preview is a few hundred CSS
    // pixels wide, and every extra pixel here is redrawn on every frame of a
    // drag. The upload renders again at 1280 from the same source, so nothing
    // the room sees is lost.
    drawFiltered(canvas, source, PLAIN, 900);
    // Awaited nowhere: the props are cached images after the first draw, so
    // this settles within a frame and dragging stays smooth.
    drawStickers(canvas, stuckOn);
    undoBtn.hidden = stuckOn.length === 0;
  };

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
  /*
   * TONIGHT'S look gets its own row, above the rest.
   *
   * `stickersFor()` splits them; the look comes off the game state, which is
   * the same switch that paints the projector and this phone, so a Halloween
   * night has skulls in the tray and an ordinary one does not. Nothing here
   * reads a date — see the note in stickers.js for why.
   */
  const { seasonal, always } = stickersFor(look);
  if (seasonal.length) {
    seasonHead.hidden = false;
    seasonProps.hidden = false;
    seasonName.textContent = (LOOKS.find((l) => l.id === look) || {}).label || 'Tonight';
  }
  for (const s of [...seasonal, ...always]) {
    const tray = s.look ? seasonProps : props;
    const chip = node(`
      <button class="cam-prop" data-id="${s.id}" title="${esc(s.label)}" aria-label="${esc(s.label)}">
        <span class="cam-prop-art">${stickerSvg(s.id)}</span>
        <span class="cam-prop-name">${esc(s.label)}</span>
      </button>`);
    /*
     * TAP TO PLACE, HOLD TO DRAG — and the hold is not a flourish, it is the
     * only way both gestures can exist.
     *
     * Dragging a prop UP onto the picture and scrolling the sheet DOWN to
     * reach the tray are the same movement of the same thumb. The first
     * version claimed the gesture outright (`touch-action: none`) and the tray
     * became unreachable: with three dozen tiles most of that area is tiles,
     * so there was nothing left to scroll with.
     *
     * So the tile does not claim anything until the thumb has been still for a
     * moment. A flick scrolls, exactly as it always did. Hold, feel the buzz,
     * and the prop lifts and follows you. It is what every phone already does
     * for dragging something out of a list, so there is nothing to learn.
     *
     * `touch-action: pan-y` is the other half: the browser is allowed to start
     * scrolling, and if it does we get a pointercancel and simply never lift.
     * Movement before the timer cancels it for the same reason.
     */
    let hold = 0;
    let from = null;
    const lift = (e) => {
      hold = 0;
      const prop = placed(s.id);
      stuckOn.push(prop);
      dragging = prop;
      pointers.set(e.pointerId, spotOf(e));
      try { chip.setPointerCapture(e.pointerId); } catch { /* already gone */ }
      if (navigator.vibrate) navigator.vibrate(18);
      repaint();
    };
    const drop = () => { clearTimeout(hold); hold = 0; from = null; };

    chip.addEventListener('pointerdown', (e) => {
      if (!source) return;
      from = { x: e.clientX, y: e.clientY, id: e.pointerId };
      hold = setTimeout(() => lift(e), HOLD_MS);
    });
    chip.addEventListener('pointermove', (e) => {
      // Moved before the hold landed: they are scrolling, so let go of it.
      if (!hold || !from || e.pointerId !== from.id) return;
      if (Math.hypot(e.clientX - from.x, e.clientY - from.y) > 10) drop();
    });
    chip.addEventListener('pointercancel', drop);
    chip.addEventListener('pointerup', (e) => {
      // Let go before the hold landed, without scrolling: that is a tap, and a
      // tap still puts it in the middle exactly as it always has.
      if (!hold) return;
      drop();
      stuckOn.push(placed(s.id));
      if (navigator.vibrate) navigator.vibrate(12);
      repaint();
      e.preventDefault();
    });
    tray.appendChild(chip);
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
  let twistFrom = 0;
  let angleFrom = 0;
  // Whether the finger actually travelled — a press that never moved is a tap,
  // and two of those on one prop takes it off.
  let shifted = false;
  let lastTap = { on: null, at: 0 };

  const spotOf = (e) => {
    const box = canvas.getBoundingClientRect();
    return { x: (e.clientX - box.left) / box.width, y: (e.clientY - box.top) / box.height };
  };
  /*
   * Two fingers, in real pixels rather than in fractions of the canvas.
   *
   * The pointers are stored as a fraction of the width and the height, which
   * are not the same number on a portrait photo — so an angle worked out from
   * them is skewed, and a twist would rotate faster sideways than up. Both the
   * distance and the angle are corrected back to the canvas's own aspect.
   */
  const pair = () => {
    const [a, b] = [...pointers.values()];
    return { dx: (b.x - a.x) * canvas.width, dy: (b.y - a.y) * canvas.height };
  };
  const gap = () => { const { dx, dy } = pair(); return Math.hypot(dx, dy); };
  const twist = () => { const { dx, dy } = pair(); return Math.atan2(dy, dx); };

  /*
   * THERE IS NO BIN, and there was one.
   *
   * A drop target has to live somewhere, and anywhere on the picture is a
   * corner of the picture you can no longer put a prop in. The square crop
   * made that obvious: the photo got smaller and the bottom right stopped
   * being spare, so props dragged down there were being thrown away.
   *
   * Double-tap does the same job from wherever the prop already is, costs no
   * screen at all, and is the gesture people reach for. `Take it off` stays
   * and is a different job: it removes the LAST one added, which is undoing
   * something you have just done rather than picking one out.
   */

  canvas.addEventListener('pointerdown', (e) => {
    if (!source) return;
    // A pointer that has already ended — a stray synthetic event, or a touch
    // the browser cancelled between down and here — cannot be captured, and an
    // exception at this point would kill the whole handler.
    try { canvas.setPointerCapture(e.pointerId); } catch { /* nothing to hold */ }
    const spot = spotOf(e);
    pointers.set(e.pointerId, spot);
    if (pointers.size === 1) {
      dragging = stickerAt(stuckOn, spot.x, spot.y, canvas);
      shifted = false;
      // Whatever you grab comes to the front, so the next drag gets the same one.
      if (dragging) {
        stuckOn = [...stuckOn.filter((s) => s !== dragging), dragging];
        repaint();
      }
    } else if (pointers.size === 2 && dragging) {
      pinchFrom = gap();
      sizeFrom = dragging.size;
      twistFrom = twist();
      angleFrom = dragging.angle || 0;
    }
  });

  /*
   * Move and release are on the WINDOW, not the canvas.
   *
   * A drag that starts on a tray tile has to keep working as the thumb travels
   * up onto the picture — two elements, one gesture. Listening on the window
   * means the drag belongs to the pointer rather than to whatever it happens to
   * be over, which is also what lets a prop be dragged off the edge of the
   * picture and back without the drag being dropped.
   */
  window.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    e.preventDefault();
    pointers.set(e.pointerId, spotOf(e));
    if (!dragging) return;

    shifted = true;

    if (pointers.size >= 2 && pinchFrom > 0) {
      // Size AND angle from the same two fingers, which is how every phone
      // already works — a prop is scaled and turned in one movement rather
      // than by finding a second control.
      const scale = gap() / pinchFrom;
      dragging.size = Math.max(0.06, Math.min(1.1, sizeFrom * scale));
      dragging.angle = angleFrom + (twist() - twistFrom);
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
    if (!pointers.has(e.pointerId)) return;
    if (dragging && !shifted) {
      /*
       * DOUBLE-TAP A PROP TO TAKE IT OFF.
       *
       * This is how you remove a CHOSEN prop, and it used to share the job
       * with a bin you dragged onto. A drop target has to live somewhere, and
       * anywhere on the picture is a corner you can no longer use — see the
       * note above the drag handlers.
       *
       * The button beside the heading is not the same job and no longer
       * pretends to be. It said "Take it off", which reads as "remove that
       * one" and actually removed the last one ADDED — so somebody wanting
       * rid of the moustache reached for the obvious control and lost the
       * crown instead. It says "Undo" now, which is what it does.
       *
       * A SINGLE tap deliberately does nothing. The host's photo grid used to
       * delete a picture on one tap with nothing on screen saying so, and that
       * is the fault this file already records. Two taps in a third of a
       * second, on the same prop, is an act rather than an accident.
       */
      const now = Date.now();
      if (lastTap.on === dragging && now - lastTap.at < DOUBLE_TAP_MS) {
        stuckOn = stuckOn.filter((s) => s !== dragging);
        if (navigator.vibrate) navigator.vibrate([8, 40, 8]);
        lastTap = { on: null, at: 0 };
      } else {
        lastTap = { on: dragging, at: now };
      }
    }
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchFrom = 0;
    if (pointers.size === 0) dragging = null;
    repaint();
  };
  window.addEventListener('pointerup', letGo);
  window.addEventListener('pointercancel', letGo);

  /*
   * Getting the photo on screen QUICKLY.
   *
   * A phone camera hands back a twelve-megapixel JPEG. Decoding that into an
   * `Image` happens on the main thread and takes seconds on an older handset —
   * which is the wait, not the camera. `createImageBitmap` decodes off-thread
   * AND downscales during the decode, so the expensive part never happens at
   * full size. It is the difference between a beat and a stare.
   *
   * `SOURCE_MAX` is a shade over the 1280 the upload sends, so nothing is lost
   * at the far end — everything downstream then works on a small bitmap rather
   * than on twelve megapixels.
   *
   * The old path is kept as a fallback for anything without it, and for a file
   * `createImageBitmap` will not take.
   */
  const SOURCE_MAX = 1400;
  const useIt = (bitmapOrImg) => {
    source = bitmapOrImg;
    stage.hidden = false;
    status.textContent = '';
    repaint();
  };
  const theSlowWay = (file) => {
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(img.src); useIt(img); };
    img.onerror = () => { status.textContent = 'That did not look like a photo.'; };
    img.src = URL.createObjectURL(file);
  };
  input.addEventListener('change', async () => {
    const file = input.files && input.files[0];
    if (!file) return;
    status.textContent = 'Loading…';
    if (!window.createImageBitmap) return theSlowWay(file);
    try {
      const probe = await createImageBitmap(file);
      const big = Math.max(probe.width, probe.height);
      if (big <= SOURCE_MAX) return useIt(probe);
      const scale = SOURCE_MAX / big;
      const small = await createImageBitmap(probe, {
        resizeWidth: Math.round(probe.width * scale),
        resizeHeight: Math.round(probe.height * scale),
        resizeQuality: 'high',
      });
      probe.close();
      useIt(small);
    } catch {
      theSlowWay(file);
    }
  });

  sendBtn.addEventListener('click', async () => {
    if (!source || !me) return;
    sendBtn.disabled = true;
    sendBtn.textContent = 'Sending…';
    status.textContent = '';
    try {
      /*
       * Redrawn at full size rather than sent as the preview: the preview
       * canvas is however big the phone is, and the projector deserves the
       * real thing. Same functions, so what they lined up is what goes up.
       *
       * 1080 SQUARE, which is the one number that satisfies all three things
       * pulling on it. It has to leave a phone quickly on pub wifi; it is kept
       * for ever, because the night archive is what Past gigs is; and it has
       * to be worth posting to INSTAGRAM later as a promo — whose own native
       * square is exactly 1080. Anything larger is downscaled by Instagram
       * anyway, so it would be bytes stored for ever that nobody ever sees.
       *
       * It is also more than a projector resolves at the 60vh a polaroid gets.
       */
      drawFiltered(canvas, source, PLAIN, 1080);
      await drawStickers(canvas, stuckOn);
      const blob = await toJpeg(canvas);
      const res = await fetch(`/api/photo?playerId=${encodeURIComponent(me.id)}&filter=${encodeURIComponent(PLAIN)}${roomParam()}`, {
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
  // Online only, and it survives every redraw for the same reason the camera
  // button does — it lives on the body rather than inside the page.
  paintChatButton(state, me);

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
  const el = node(`
    <div style="display:grid;gap:14px;text-align:center">
      <div class="pill" style="justify-self:center;font-size:var(--fs-note)">${esc(kicker)}</div>
      <h1 class="grad-text">${esc(title)}</h1>
      <p>${esc(sub)}</p>
      ${teamPicker(s)}
    </div>
  `);
  wireTeamPicker(el, s);
  return el;
}

/**
 * Who you are sitting with — between questions only.
 *
 * It goes on the WAITING screens (the lobby, and the gap between rounds)
 * rather than anywhere near the answers, for the reason the engine refuses a
 * mid-question switch: somebody watching the tally and hopping into whichever
 * team is doing well. It also means the busiest screen in the app — four
 * options and a clock — gains nothing at all.
 *
 * The list is names and sizes. There is no code to read out and nobody to ask:
 * you tap the one your table is called, or you start it. On a night with
 * nobody organised into anything yet, the box is the first thing you use.
 */
function teamPicker(s) {
  if (!s.teamPlay) return '';
  const teams = s.teams || [];
  const mine = s.yourTeam || null;
  const here = teams.find((t) => t.id === mine);
  return `
    <div class="team-pick">
      <div class="tiny team-pick-head">${here ? 'You are playing for' : 'Who are you playing with?'}</div>
      ${here ? `<div class="team-mine">${esc(here.name)}</div>` : ''}
      <div class="team-list">
        ${teams.map((t) => `
          <button class="team-opt ${t.id === mine ? 'here' : ''}" data-team="${esc(t.id)}">
            ${esc(t.name)}<span class="team-size">${t.size}</span>
          </button>`).join('')}
      </div>
      <form class="team-new">
        <input type="text" id="teamName" maxlength="28" autocomplete="off"
               enterkeyhint="go" placeholder="${teams.length ? 'Or start a new one' : 'Name your team'}">
        <button class="team-add" type="submit">Start</button>
      </form>
      ${here ? '<button class="team-leave tiny" data-team="">Play on my own instead</button>' : ''}
    </div>`;
}

function wireTeamPicker(el, s) {
  if (!s.teamPlay || !me) return;
  const send = (body) => postJson('/api/team', { playerId: me.id, token: me.token, joinCode: roomCode(), ...body })
    .catch(() => { /* the state push is the truth; a failed tap simply does nothing */ });
  for (const b of el.querySelectorAll('[data-team]')) {
    b.addEventListener('click', () => send({ teamId: b.dataset.team }));
  }
  el.querySelector('.team-new')?.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const input = el.querySelector('#teamName');
    const name = input.value.trim();
    if (!name) return;
    input.value = '';
    send({ name });
  });
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
      ${questionHead(s, 'tap the <b>first letter</b> of the answer')}
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

/**
 * The line above the options — and, ONLINE ONLY, the question itself.
 *
 * In a pub this is one small line saying which question you are on and telling
 * you to read it off the projector, because rule 8 keeps the words off the
 * phone deliberately. Online there is no projector: the host is sharing a
 * window in a video call at whatever size somebody's laptop chose, so a player
 * who cannot read the question here cannot play at all.
 *
 * `s.prompt` only arrives when the server says this is an online night (see
 * `playerView`), so a pub night produces exactly the line it always did — the
 * two modes are one branch rather than two renderers that can drift.
 *
 * `tail` is what the hint says after the question number, because the three
 * round shapes each want a different thing there.
 */
function questionHead(s, tail) {
  const counter = `Question ${s.questionIndex + 1} of ${s.questionCount}`;
  if (!s.prompt) {
    return `<div class="muted" id="pHint" style="font-size:var(--fs-ctl);text-align:center">${counter}${tail ? ` — ${tail}` : ' — read it on the big screen'}</div>`;
  }
  /*
   * `pHint` stays on the SMALL line, never on the question.
   *
   * `paintChoice` and `paintPicks` both do `pHint.textContent = 'Locked in.'`
   * when you answer — so putting that id on the question text would delete the
   * question off the screen the moment somebody tapped an option, on the one
   * mode where the phone is the only place it exists. Found by reading those
   * two functions rather than by running it, which on a 20-second question is
   * the only way anybody would have found it.
   */
  return `
    <div class="online-q">
      <div class="muted online-q-num" id="pHint">${counter}${tail ? ` — ${tail}` : ''}</div>
      <div class="online-q-text">${esc(s.prompt)}</div>
    </div>`;
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
      ${questionHead(s, '')}
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
      ${questionHead(s, `pick <b>${want}</b>`)}
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
  // The public handle rather than the id: the board carries keys now, because
  // it goes to every phone and used to publish everybody else's credential.
  const youKey = s.you ? s.you.key : '';
  const winner = rows[0];

  return node(`
    <div style="display:grid;gap:16px">
      <h2>${isFinal ? 'Final scores' : `After round ${s.roundIndex + 1}`}</h2>
      ${isFinal && winner ? `<div class="result good"><div class="sub">Winner</div><div class="big">${esc(winner.name)}</div><div class="pts">${winner.score.toLocaleString('en-GB')}</div></div>` : ''}
      ${voucherCard(s)}
      <div class="mini-board">
        ${rows.map((p) => `
          <div class="mini-row ${p.key === youKey ? 'you' : ''}">
            <span class="pos">${p.position}</span>
            <span>${esc(p.name)}</span>
            <span class="score">${p.score.toLocaleString('en-GB')}</span>
          </div>`).join('')}
      </div>
      ${s.you && !rows.some((p) => p.key === youKey)
        ? `<div class="mini-row you"><span class="pos">${s.you.position || '—'}</span><span>${esc(s.you.name)}</span><span class="score">${s.you.score.toLocaleString('en-GB')}</span></div>`
        : ''}
    </div>
  `);
}

/**
 * WHAT YOU WON, and how the bar gives it to you.
 *
 * Only ever on the winner's own phone — the server puts `voucher` in that one
 * player's payload and nobody else's, for the same reason the answer key is
 * host-only: the code is the credential, and the projector is pointed at a
 * room. On a team night everybody on the winning team gets the same card with
 * the same code, which is the point: one drink per team, not one each.
 *
 * The QR is the thing that matters and it is the biggest element, because the
 * whole interaction is "hold your phone up and let them scan it". The written
 * code is under it for when the bar's camera will not play or the wifi has
 * gone, which in a pub is often enough to be worth the two lines.
 *
 * The NAME is on it deliberately. It stops nothing technically — a screenshot
 * is a screenshot — but it works the way a paper voucher does: the bar can say
 * "you are not Quizteam Aguilera" without needing a system at all.
 */
function voucherCard(s) {
  const v = s.voucher;
  if (!v) return '';
  /*
   * `roomCode()` rather than a new field on the payload — the phone already
   * remembers which room it is in, next to its player id, and has since rooms
   * existed. The house room has no code and its link is the bare `/v?c=`, the
   * same shape `/play` has always had, so nothing special-cases it.
   */
  const code = roomCode();
  const target = `${location.origin}/v?c=${encodeURIComponent(v.code)}${
    code ? `&g=${encodeURIComponent(code)}` : ''}`;
  if (v.redeemedAt) {
    return `
      <div class="win-card win-spent">
        <div class="sub">Collected</div>
        <div class="win-what">${esc(v.reward)}</div>
        <p class="tiny">Already redeemed. If that is wrong, ask the quizmaster.</p>
      </div>`;
  }
  return `
    <div class="win-card">
      <div class="sub">You won</div>
      <div class="win-what">${esc(v.reward)}</div>
      <img class="win-qr" alt="Show this at the bar"
        src="/qr.svg?text=${encodeURIComponent(target)}&dark=%230b0b12&light=%23ffffff">
      <div class="win-code">${esc(v.code)}</div>
      <p class="tiny">Show this at the bar. They scan it, you get it. It only works once.</p>
    </div>`;
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
