/**
 * THE CAMERA SHEET — the photo, the props, and the button that sends it.
 *
 * ---
 *
 * **IT IS HERE BECAUSE IT IS ON TWO PAGES NOW.** Asked for on 16 September
 * 2026: *"the camera photo upload thingy doesn't have sticker options when the
 * camera QR code comes from the community bit — can I have the googly eyes etc.
 * functionality in both pls"*. It lived in `play.js` and `/snap` had a bare
 * file input beside it, so the bar's camera could put a photograph on the
 * screen and nothing on it.
 *
 * **A LEAF WITH NO PAGE OF ITS OWN, which is the rule rather than a
 * preference.** *A page module may not be imported by another page* — importing
 * from `play.js` would run `play.js`'s own boot code on `/snap`, which is
 * exactly how the console once hung on "Loading your library…" for every
 * account with `node --check` seeing nothing. So this file has no listeners at
 * the top level, touches no element it was not handed, and knows nothing about
 * either page.
 *
 * **WHAT IT DOES NOT KNOW IS THE WHOLE DESIGN.** It has no game state, no
 * player, no room and no route: the caller passes a `look`, a `send()` and a
 * `done()`. `/play` posts to `/api/photo` with a player id and says whether the
 * projector is carrying photographs right now; `/snap` posts to `/api/snap`
 * with no identity at all. Neither of those questions belongs to a drag
 * handler, and a `kind` branch in here would be *a kind test written when there
 * were two pages* — this repo's most-repeated bug, four sightings deep.
 *
 * **THE MOVE WAS MECHANICAL AND THE MARKUP TRAVELLED UNCHANGED**, including
 * the two `<div>`s and the `<label>` the camera sheet genuinely leaves open.
 * CLAUDE.md records that as *deliberately not fixed blind* — re-nesting a
 * screen nobody has reported a problem with is how you cause the next fault —
 * and a move is not the moment to change it. `scripts/props-on-a-photo.mjs`
 * was written BEFORE this file existed and drives the real pointer gestures on
 * both pages, because nothing in the repo had ever run one line of it.
 */

import { esc, node } from './client.js';
import { drawFiltered, toJpeg, looksCameraTaken } from './filters.js';
import { stickersFor, stickerSvg, drawStickers, stickerAt, placed, preloadStickers, trayOrder, withRecent } from './stickers.js';

/** What they reached for last time, on this handset. See stickers.js. */
const RECENT_KEY = 'musicquiz.props';

/*
 * HOW OFTEN EACH PROP GETS REACHED FOR, fetched once and held.
 *
 * In a module binding rather than inside the render, because the camera sheet
 * is rebuilt on every state push — which during a break is every time somebody
 * joins. Fetching per rebuild would be a request per phone per push, and
 * re-rolling the tray per rebuild would reshuffle it under a thumb mid-scroll.
 */
let propWeights = null;
let propWeightsAsked = false;

/** The tray as it was actually offered, so `shown` is the truth and not a guess. */
let trayShown = [];
/** Everything reached for since this sheet opened, whether or not it stayed on. */
const trayUsed = new Set();

function recentProps() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]').filter((x) => typeof x === 'string'); } catch { return []; }
}

/** One prop, reached for: remembered on this phone and counted for the owner. */
function reachedFor(id) {
  trayUsed.add(id);
  rememberProp(id);
}

function rememberProp(id) {
  try {
    const next = [id, ...recentProps().filter((x) => x !== id)].slice(0, 8);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch { /* a private window, and it simply does not remember */ }
}

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

/*
 * Pick or take a photo, put props on it, send it to the projector.
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
export function openCameraSheet({
  look,
  heading,
  warn,
  pickLabel = 'Take or choose a photo',
  capture = false,
  file = null,
  ready = () => true,
  send,
  done,
}) {
  const sheet = node(`
    <div class="cam-overlay">
      <div class="cam-sheet">
        <div class="cam-head">
          <b>${esc(heading)}</b>
          <button class="cam-close" title="Close">✕</button>
        </div>
        <!-- WHERE IT ACTUALLY ENDS UP, said at the moment the photo is handed
             over rather than in a policy nobody opens. This used to name only
             the big screen, which was complete until the public gallery
             shipped and then quietly was not: a night can be published, and
             the person holding the phone is the one who should hear that
             first. Naming WHO decides matters as much as naming the page —
             the quizmaster publishes, so nothing goes public by itself. -->
        <p class="tiny cam-warn">${esc(warn)}</p>
        <label class="cam-pick">
          <input type="file" accept="image/*"${capture ? ' capture="environment"' : ''} hidden>
          <span>${esc(pickLabel)}</span>
        </label>
        <div class="cam-stage" hidden>
          <div class="cam-frame">
            <canvas class="cam-canvas"></canvas>
          </div>
          <!-- FLIP BELONGS TO THE PHOTO, NOT TO THE PROPS.
               It spent a version in the props heading beside Undo, which reads
               as a corner it was pushed into — because the two do different
               jobs to different things: Undo takes off a prop, this mirrors the
               picture underneath them. Directly under the photo it is next to
               what it changes, and it is the only thing in its row so there is
               nothing to mistake it for.

               NOT overlaid on the photo itself, tempting as that is: the canvas
               carries the drag handlers for the props, and a button sitting on
               it would swallow the gesture. -->
          <div class="cam-photo-tools">
            <button class="cam-flip">Flip it</button>
          </div>
          <!-- SEND SITS UNDER THE PHOTO, above everything else.
               It was last on the sheet, so finishing a photo meant scrolling
               back past three dozen tiles to find the button — the same fault
               that put the hint above the tray rather than below it. Here it
               is always next to the thing it sends, whatever you have just
               added. -->
          <button class="cam-send">Send it up</button>
          <!-- ONE UNDO, AND IT IS NOT HERE. It used to be in this row too,
               which meant querySelector('.cam-undo') found this one first —
               and this row is hidden on an ordinary night, so the only wired
               Undo lived inside a hidden box while the one below was never
               unhidden. There was NO UNDO AT ALL on a normal night, on the
               feature the props exist for, and nothing threw.

               Exactly the fault the .cam-props:not(.cam-props-season) selector
               below records: the seasonal row carries the same classes as the
               main one because it wants the same layout, so a bare selector
               matches the wrong one. Undo takes off the last prop whichever
               tray it came from, so one is all there was ever a job for. -->
          <div class="cam-looks-head cam-season-head" hidden>
            <span class="cam-season-name"></span>
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
  /*
   * MIRRORED OR NOT, and it is a button rather than something worked out.
   *
   * iOS mirrors the live preview while you frame a selfie and then saves the
   * photo the other way round, so the picture that arrives is flipped relative
   * to what the person was looking at. A photo comes in through a plain file
   * input — the phone's own camera app takes it — so we are never told which
   * lens was used and cannot reliably find out.
   *
   * So: one control, no detection. Same reasoning as dragging the props by
   * hand rather than face-detecting, and it fixes the other case too — a back
   * camera pointed at a mirror, which is how half the group photos in a pub
   * get taken.
   */
  let flipped = false;
  // The props on the photo, in the order they were added. Positions are
  // fractions of the picture, never pixels — see stickers.js.
  let stuckOn = [];
  // Whether the ORIGINAL file looked like it came straight off a camera —
  // read once, from the raw file, before the canvas redraw below strips
  // every byte of EXIF it might have carried. See looksCameraTaken().
  let cameraLikely = false;

  const repaint = () => {
    if (!source) return;
    // A smaller canvas than the upload's. The preview is a few hundred CSS
    // pixels wide, and every extra pixel here is redrawn on every frame of a
    // drag. The upload renders again at 1280 from the same source, so nothing
    // the room sees is lost.
    drawFiltered(canvas, source, PLAIN, 900, { flip: flipped });
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
  /*
   * THE TRAY ROTATES, AND IT IS ROLLED HERE — ONCE, WHERE THE SHEET IS BUILT.
   *
   * Forty-two props on an ordinary night and four above the fold on a 320px
   * phone, so nine rows in ten were only ever seen by somebody scrolling for
   * the fun of it: *"some might be getting underused because they're probably
   * not appearing."*
   *
   * Weighted towards what people actually reach for, which is only safe
   * because the server counts how often a prop was SHOWN as well — so
   * popularity is a RATE and the weighting cannot starve the very props the
   * counting exists to judge. See `src/prop-use.js`.
   *
   * **THE SEASONAL ROW IS NOT ROTATED.** It is a handful of props on the one
   * night they belong to, all of them already above the fold — there is
   * nothing to surface and shuffling it would only make it hard to find the
   * skull you saw a minute ago.
   *
   * **AND WHAT THEY REACHED FOR LAST TIME LEADS** — the favourites, derived
   * rather than pinned: no fourth gesture on a tile that is a quarter of a
   * 320px screen, and it works on somebody's FIRST night.
   */
  if (!propWeightsAsked) {
    propWeightsAsked = true;
    fetch('/api/prop-weights')
      .then((r) => r.json())
      .then((d) => { propWeights = (d && d.weights) || {}; })
      // A tray that cannot reach the server is an honest shuffle rather than a
      // broken sheet — the weighting is a nicety and the props are the feature.
      .catch(() => { propWeights = {}; });
  }
  const rotated = withRecent(trayOrder(always, propWeights || {}), recentProps());
  trayShown = [...seasonal, ...rotated].map((s) => s.id);
  for (const s of [...seasonal, ...rotated]) {
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
      // REACHED FOR — counted here rather than at the upload, so a prop tried
      // and taken off again still counts as one somebody wanted. The question
      // is what people go for, not what survived the edit.
      reachedFor(s.id);
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
      reachedFor(s.id);
      stuckOn.push(placed(s.id));
      if (navigator.vibrate) navigator.vibrate(12);
      repaint();
      e.preventDefault();
    });
    tray.appendChild(chip);
  }

  /*
   * The props are NOT mirrored with the photo, and that is deliberate rather
   * than an oversight: they are drawn on afterwards, in canvas coordinates, so
   * a flip after placing a nose would otherwise move the nose to the other
   * cheek. Flipping the picture under them leaves everything where it was put
   * — and the three shirt props have words on them, which a mirror would print
   * backwards.
   */
  const flipBtn = sheet.querySelector('.cam-flip');
  flipBtn.addEventListener('click', () => {
    flipped = !flipped;
    flipBtn.classList.toggle('on', flipped);
    repaint();
  });

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
  const take = async (picked) => {
    if (!picked) return;
    const file = picked;
    status.textContent = 'Loading…';
    // ON THE RAW FILE, before anything below touches it — the canvas redraw
    // that builds what actually gets sent strips every byte of EXIF, so this
    // is the one moment there is anything left to read. See looksCameraTaken().
    cameraLikely = await looksCameraTaken(file);
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
  };
  input.addEventListener('change', () => take(input.files && input.files[0]));

  sendBtn.addEventListener('click', async () => {
    if (!source || !ready()) return;
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
      drawFiltered(canvas, source, PLAIN, 1080, { flip: flipped });
      await drawStickers(canvas, stuckOn);
      const blob = await toJpeg(canvas);
      /*
       * WHAT THE TRAY OFFERED AND WHAT GOT REACHED FOR, on the request that
       * was already going — a phone in a pub should not make a second one to
       * tell the server something this could carry. See `src/prop-use.js` for
       * why both halves are needed and neither is a log.
       *
       * Handed to the CALLER rather than built into a URL here: the two pages
       * post to different routes, and a query string assembled in this file
       * would be this module knowing about both of them.
       */
      await send({
        blob,
        filter: PLAIN,
        camera: cameraLikely,
        shown: [...trayShown],
        used: [...trayUsed],
      });
      sheet.querySelector('.cam-sheet').replaceChildren(node(done({ camera: cameraLikely })));
      setTimeout(close, 1800);
    } catch (err) {
      status.textContent = err.message;
      sendBtn.disabled = false;
      sendBtn.textContent = 'Send it up';
    }
  });

  document.body.appendChild(sheet);
  /*
   * A PHOTOGRAPH ALREADY IN HAND SKIPS THE PICKER, AND GOES DOWN THE SAME
   * PATH.
   *
   * `/snap` is opened by somebody who pressed *Take a photo* on a page that
   * has already put them in their phone's camera — so a second "choose a
   * photo" button here would be one more tap between the shutter and the
   * screen, for a person carrying glasses. Handed in as `file`, it runs
   * `take()` exactly as the input's own change would: one load path, so the
   * EXIF read and the off-thread decode cannot drift between the two pages.
   */
  if (file) take(file);
  return { sheet, close };
}
