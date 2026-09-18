/**
 * THE BAR STAFF'S CAMERA — a page that is nothing but a camera and the pile.
 *
 * ---
 *
 * Asked for on 16 September 2026: *"what would be really good as well is if,
 * say, one of the bar staff could also get access to this. So they can take
 * photos, I can take photos, people can upload their own photos, and then they
 * all go into one like shared bucket."*
 *
 * **IT IS NOT A LOGIN AND IT IS NOT A PLAYER, AND THOSE ARE THE TWO THINGS IT
 * COULD HAVE BEEN.** A seat on the quizmaster's account is a paid thing, a
 * password somebody behind a bar has to remember, and it would hand them the
 * whole console — including the answer key, which is rule 1. Joining the room
 * as a player is free and already possible, and it puts the bar on the
 * leaderboard and on the projector. So this is a third thing: a page with no
 * identity at all, which is what `/wall` and `/v` and `/play` already are.
 *
 * **THE JOIN CODE IS THE HANDLE, AND IT IS THE SAME ONE THE ROOM ALREADY
 * HAS.** Chosen deliberately over a revocable staff key: the code already
 * survives a deploy (`data/room-codes.json`, backed up, which is why a printed
 * QR keeps working), so this needs no new store and has nothing to lose. What
 * a revocable key would buy is the ability to shut one person out — and
 * anybody holding the code can already upload by joining the room, so it would
 * be shutting a door beside an open one.
 *
 * **IT SHOWS WHAT IS ALREADY UP, AND THAT IS THE WHOLE INTERFACE BESIDES THE
 * BUTTON.** Somebody working a room needs to know whether the last one landed
 * and whether the shot they are about to take has been taken. It is also the
 * honest version of *the reason a control is off goes on the control*: with
 * photographs switched off, this page says so rather than accepting one into a
 * store nothing reads.
 *
 * **NO NEW ROLE ON THE WIRE — it opens a `role=wall` stream.** `wallView()` is
 * already exactly *is the camera open, and what has landed*, already built
 * field by field, and already swept by the second screen's own guard. A
 * `role=snap` would be a fourth payload to keep in step with rule 1 for no
 * field this page does not already get.
 */

import {
  esc, node, Live, brandMark, brandWords, roomParam, roomCode,
} from './client.js';
import { paintScheme } from './schemes.js';
import { openCameraSheet } from './camera-sheet.js';

const cardEl = document.getElementById('card');

let built = false;
let brandDone = false;
let said = '';
let busy = false;
/*
 * TONIGHT'S LOOK, held from the last payload.
 *
 * The props tray is dressed for the season the room is dressed for — the
 * quizmaster picked one look and the bar's camera has no business offering a
 * different one. It rides on the `role=wall` state this page already opens, so
 * nothing new is on the wire.
 */
let look = '';

/** How many of the night's photographs this page shows back. */
const SHOWN = 12;

/*
 * WHAT THE LAST PRESS DID, IN A MODULE BINDING RATHER THAN THE MARKUP.
 *
 * The strip below repaints whenever anything lands in the room — including the
 * photograph this page just sent — so a line written into the element would be
 * wiped by the very success it was reporting. The control view's own camera
 * hit this first; same fix, same reason.
 */
function say(words) {
  said = words;
  const el = document.getElementById('snapSaid');
  if (el) el.textContent = words;
}

function build() {
  cardEl.replaceChildren(node(`
    <div class="snap-box">
      <h1 class="grad-text">Send a photo to the screen</h1>
      <p class="sub">It goes straight up on the big screen with everybody else's.</p>
      <label class="big snap-take">
        Take a photo
        <input type="file" accept="image/*" capture="environment" hidden>
      </label>
      <label class="snap-pick">
        Choose one you already took
        <input type="file" accept="image/*" hidden>
      </label>
      <div class="tiny snap-said" id="snapSaid">${esc(said)}</div>
      <div class="snap-shots" id="snapShots"></div>
    </div>`));

  const input = cardEl.querySelector('.snap-take input');
  const label = cardEl.querySelector('.snap-take');
  /*
   * AND A WAY IN FROM THE CAMERA ROLL — asked for directly: *"I sometimes take
   * photos from my phone out of habit and I want a place to upload from my
   * photos app if I forgot to use the QR code."*
   *
   * **`capture="environment"` IS A ONE-WAY DOOR.** It is the right first press
   * for somebody carrying glasses — straight into the camera, no picker in the
   * way — and that decision stands. What it also does is make the camera the
   * ONLY way in: an input carrying it never offers the library, so a photo
   * taken thirty seconds earlier on the ordinary Camera app could not be sent
   * at all.
   *
   * **THIS IS NOT THE "second choose-a-photo button" THAT WAS TURNED DOWN.**
   * That one was *inside the sheet*, a tap between the shutter and the screen.
   * This is beside the shutter on the page before it, so the camera path is
   * the same number of presses it has always been.
   *
   * **ONE AT A TIME, AND THAT IS THE POINT RATHER THAN A LIMIT.** Both ways in
   * run the SAME sheet, so a picked photograph gets the props, the mirror and
   * the 1080 square exactly as a taken one does — and the props are per
   * photograph, so `multiple` here would mean either a queue of sheets or
   * silently dropping the tray. Bulk with no props already exists in the
   * console (*Add your own photos*), filed against a NAMED past night, which
   * is the other half of this and the one to use on a Monday.
   */
  const pick = cardEl.querySelector('.snap-pick input');
  const pickLabel = cardEl.querySelector('.snap-pick');

  /*
   * AND THE PROPS COME WITH IT — the whole point of this change.
   *
   * Asked for as *"the camera photo upload thingy doesn't have sticker options
   * when the camera QR code comes from the community bit — can I have the
   * googly eyes etc. functionality in both pls"*. This page used to post the
   * shrunk file straight off, so the bar could put a photograph on the screen
   * and nothing on it, while every phone in the room had a tray of forty-two.
   *
   * **THE SHUTTER STAYS ON THIS PAGE AND THE SHEET OPENS WITH THE PHOTO
   * ALREADY IN IT.** `capture="environment"` puts somebody straight into their
   * camera, which is the right first press for a person carrying glasses, and
   * a second "choose a photo" button inside the sheet would be a tap between
   * the shutter and the screen. The file is handed to `openCameraSheet()`,
   * which runs its own load path on it — one decode, one EXIF read, shared
   * with `/play`.
   *
   * `shrinkPhoto()` is gone from this path rather than kept beside it: the
   * sheet redraws at 1080 square through `drawFiltered`, so a second sizing
   * here would be two answers to one question and the bar's photographs would
   * be the only ones on the wall that were not square.
   */
  const take = (from, lit) => {
    const files = [...(from.files || [])];
    from.value = '';
    if (!files.length || busy) return;
    busy = true;
    lit.classList.add('is-busy');
    say('');
    openCameraSheet({
      look,
      heading: 'Send up a photo',
      // Word for word what a player's phone says — see `play.js` for why it is
      // two sentences and why the promotion line has to be on the sheet. Both
      // cameras feed one bucket, so both say what happens to what lands in it.
      warn: 'Keep it decent. Photos may be used to promote the night.',
      file: files[0],
      async send({ blob, camera, shown, used }) {
        const tally = `&shown=${encodeURIComponent(shown.join(','))}&used=${encodeURIComponent(used.join(','))}`;
        const res = await fetch(`/api/snap?camera=${camera ? '1' : '0'}${tally}${roomParam()}`, {
          method: 'POST',
          headers: { 'Content-Type': 'image/jpeg' },
          body: blob,
        });
        const out = await res.json().catch(() => ({}));
        if (!out.ok) throw new Error(WHY_NOT[out.reason] || 'That one did not go. Try again.');
        say('Sent — it is on the screen.');
      },
      done: () => `
        <div style="text-align:center;padding:22px 6px">
          <div style="font-size:44px">\u{1F389}</div>
          <b>It is on the screen</b>
          <p class="tiny">Have a look up.</p>
        </div>`,
    });
    /*
     * FREED WHEN THE SHEET IS OPEN, NOT WHEN THE PHOTOGRAPH LANDS.
     *
     * `busy` exists to stop two files being picked at once off this one input.
     * The sheet owns everything after that — it has its own Send, its own
     * disabled state and its own error line — so holding the shutter locked
     * until an upload finished would leave the button dead behind a sheet
     * somebody had already closed.
     */
    busy = false;
    lit.classList.remove('is-busy');
  };

  // Two ways in, ONE handler — the sheet, the sizing, the prop tally and the
  // refusal wording are all decisions, and two copies is one that gets fixed.
  input.addEventListener('change', () => take(input, label));
  pick.addEventListener('change', () => take(pick, pickLabel));
  built = true;
}

/** What the server refuses for, in words somebody behind a bar can act on. */
const WHY_NOT = {
  off: 'Photos are switched off in there at the moment.',
  too_big: 'That photo is too big, even scaled down.',
  not_an_image: 'That file is not a photo.',
  empty: 'That file was empty.',
  no_room: 'That link has no room on it — ask for it again.',
  could_not_save: 'Could not save that one.',
};

/**
 * THE PILE, NEWEST FIRST — rebuilt only where it changed, the wall's own
 * discipline. Replacing it wholesale would reload every picture over a pub's
 * wifi each time anybody in the room sent one.
 */
function paintShots(items) {
  const shots = document.getElementById('snapShots');
  if (!shots) return;
  const want = items.slice(0, SHOWN);
  const have = new Map([...shots.children].map((c) => [c.dataset.id, c]));
  const wantedIds = new Set(want.map((p) => p.id));
  for (const [id, el] of have) if (!wantedIds.has(id)) el.remove();

  want.forEach((p, i) => {
    let el = have.get(p.id);
    if (!el) {
      el = node(`
        <figure class="snap-shot" data-id="${esc(p.id)}">
          <img src="${esc(p.url)}" alt="" loading="lazy">
        </figure>`);
    }
    if (shots.children[i] !== el) shots.insertBefore(el, shots.children[i] || null);
  });

  if (!want.length && !shots.querySelector('.snap-empty')) {
    shots.replaceChildren(node('<div class="snap-empty tiny">Nothing up yet tonight.</div>'));
  }
}

/**
 * Photographs are switched off in the room, so this page says so instead of
 * offering a button the server will refuse. *The reason a control is off goes
 * on the control* — here the control is the whole page.
 */
function paintShut() {
  cardEl.replaceChildren(node(`
    <div class="snap-box snap-shut">
      <h1 class="grad-text">Photos are switched off</h1>
      <p class="sub">The quizmaster has them turned off at the moment. This page
        fills itself in when they go back on.</p>
    </div>`));
  built = false;
}

function draw(s) {
  if (s.brand && !brandDone) {
    brandDone = true;
    document.getElementById('brandSlot').innerHTML = `${brandMark(22)}${brandWords(s.brand, s.appName || '')}`;
    document.title = `${s.brand} — Send a photo`;
  }
  paintScheme(s.scheme);
  if (s.look) look = s.look;

  if (!s.open) { paintShut(); return; }
  if (!built) build();
  paintShots(s.photos || []);
}

// -------------------------------------------------------------------- boot

/*
 * NO CODE AT ALL IS NOT A WORKING PAGE HERE, and it says so rather than
 * quietly landing on the house room. `/wall` can fall back because a spare
 * laptop with no code is the owner's own projector; this link is always handed
 * to somebody, so a missing code means it was handed over broken.
 */
if (!roomCode()) {
  cardEl.replaceChildren(node(`
    <div class="snap-box snap-shut">
      <h1 class="grad-text">This link is missing its room</h1>
      <p class="sub">Ask the quizmaster to show you the code again.</p>
    </div>`));
} else {
  new Live(`/api/stream?role=wall${roomParam()}`, { onState: draw });
}
