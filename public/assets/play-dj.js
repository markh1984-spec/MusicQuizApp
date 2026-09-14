/**
 * THE PHONE, ON A DJ SET — a camera, then a box to ask for a song.
 *
 * ---
 *
 * **THE PHOTOGRAPH IS THE TICKET, AND THAT IS THE WHOLE PRODUCT.** *"People
 * upload their photos, and then that unlocks the ability for them to give
 * requests."* So the two controls are drawn in that order and the second one
 * is drawn **before** it works — the reason a control is off goes ON the
 * control, which is this app's own rule and matters more here than anywhere:
 * a request box that appeared out of nothing once a photo landed would be a
 * feature nobody discovers, because nobody sends a photograph to a screen in
 * the hope that something else turns up.
 *
 * **A REQUEST IS NEVER ON THE BIG SCREEN.** Rule 1, and its sharpest case in
 * the app — see `screenView()` in `src/dj.js`. Nothing in this file is
 * duplicated to the projector, and the phone only ever shows its OWN
 * requests, which is what the payload carries.
 *
 * **SPOTIFY IS THE FAST PATH AND TYPING IS THE FLOOR.** His DJ software reads
 * off the TITLE rather than a Spotify id, so a typed request is a first-class
 * one and not a degraded one — which is also what keeps the whole feature
 * working in a venue whose wifi cannot reach Spotify, or on a night the token
 * has expired. The search says out loud when it is unavailable rather than
 * returning an empty list, the `fellBack` rule from `import-intro.js`.
 *
 * **THE PAGE IS REBUILT ON EVERY STATE PUSH**, so nothing in here may hold
 * state in the markup: what has been typed and what came back from a search
 * live in module bindings, exactly as the bingo card's fold does.
 */

import { esc, node, postJson, roomCode } from './client.js';

/**
 * WHO THIS PHONE IS, handed in by `play.js` rather than read back out of
 * `localStorage` here. A second copy of the storage key is a second copy of
 * the rule, and this repo's own answer to that is always fewer copies.
 */
let me = null;

/** What the box has in it, across the rebuilds a state push causes. */
let typed = { q: '', artist: '', title: '' };
let found = [];
let searchState = 'idle'; // idle | looking | none | off | error
let manual = false;
let saying = '';

/** How many results a thumb can get through without scrolling past the box. */
const SHOW_TRACKS = 5;

/**
 * A FINGERPRINT OF WHAT IT DRAWS, NEVER ONE FIELD OF IT.
 *
 * `screenKey()` decides whether `play.js` rebuilds this screen or leaves it
 * alone, and a key naming one field lets everything else change unseen — four
 * sightings of that in this repo, all silent. So it carries the unlock, how
 * many requests are left, and every request's id AND whether it has been
 * played, which is the one thing about an existing row that changes.
 */
export function djKey(s) {
  const mine = (s.mine || []).map((r) => `${r.id}${r.played ? 'P' : ''}`).join(',');
  return `dj:${s.phase}:${s.unlocked ? 'on' : 'off'}:${s.left}:${mine}`;
}

/** The head of the phone — no score on a DJ set, so it says where you are. */
export function djHead(s) {
  if (!s.unlocked) return { score: '📷', rank: 'send a photo' };
  return { score: String(s.left), rank: s.left === 1 ? 'request left' : 'requests left' };
}

export function buildDj(s, { openCamera, player }) {
  me = player;
  /*
   * THERE IS NO HEADING, AND THAT IS THE SECOND VERSION.
   *
   * The first drew a pill over the team name — which printed the name TWICE,
   * the header an inch above already carrying it, and shouted a three-word
   * label in capitals because `.pill` uppercases: *capitals are for emphasis,
   * not for labelling*. Both caught by taking the screenshot.
   *
   * What it would have said — that requests are open — is the card below
   * saying it already, in the one place that can also say why they are not.
   * So the lead is gone rather than reworded: **a page with an answer to
   * every question is a page nobody can scan.**
   */
  const el = node(`
    <div class="dj-phone">
      <div class="dj-slot dj-slot-camera"></div>
      <div class="dj-slot dj-slot-ask"></div>
      <div class="dj-slot dj-slot-mine"></div>
    </div>`);

  el.querySelector('.dj-slot-camera').replaceChildren(cameraCard(s, openCamera));
  el.querySelector('.dj-slot-ask').replaceChildren(askCard(s));
  const mine = mineCard(s);
  if (mine) el.querySelector('.dj-slot-mine').replaceChildren(mine);
  return el;
}

/* ------------------------------------------------------------ the camera */

function cameraCard(s, openCamera) {
  /*
   * IT STAYS ON THE SCREEN AFTER IT HAS WORKED, and that is deliberate — the
   * photo wall is the other half of the night, and a camera that vanished the
   * moment it had done its job would take the wall with it. The WORDS change;
   * the control does not move.
   *
   * **AND THE SECOND STATE PROMISES NOTHING.** A photograph is the GATE, not
   * a currency: `unlocked()` asks whether there has ever been one, and the
   * three is a cap on requests WAITING, freed as the DJ plays them. So the
   * words here are about the big screen and nothing else — *"send another for
   * more requests"* would be a promise the engine does not keep.
   */
  const first = !s.unlocked;
  const card = node(`
    <div class="dj-card dj-camera${first ? ' dj-camera-first' : ''}">
      <div class="dj-card-what">
        <b>${first ? 'Send a photo to ask for a song' : 'Send another photo'}</b>
        <span class="tiny">${first
          ? 'It goes straight up on the big screen — then the box below opens.'
          : 'It goes up on the big screen.'}</span>
      </div>
      <button class="dj-shoot" type="button">📷 ${first ? 'Take a photo' : 'Camera'}</button>
    </div>`);
  card.querySelector('.dj-shoot').addEventListener('click', openCamera);
  return card;
}

/* ------------------------------------------------------------ the request */

function askCard(s) {
  /*
   * PRESENT AND INERT BEFORE THE FIRST PHOTOGRAPH, never absent — *a control
   * never appears out of nothing*, and here the inert state is the pitch.
   * Both reasons a box is shut say so ON the box: no photo yet, and three
   * asked for already.
   */
  const locked = !s.unlocked;
  const spent = !locked && s.left <= 0;
  const off = s.phase === 'finished';
  const why = off ? 'The DJ has finished taking requests.'
    : locked ? 'Send a photo first and this opens.'
      : spent ? 'That’s three waiting with the DJ. When one gets played, you can ask for another.' : '';

  const card = node(`
    <div class="dj-card dj-ask${why ? ' is-off' : ''}">
      <div class="dj-card-what">
        <b>Ask for a song</b>
        ${why ? `<span class="tiny dj-why">${esc(why)}</span>` : ''}
      </div>
      <div class="dj-ask-body"></div>
    </div>`);

  const body = card.querySelector('.dj-ask-body');
  if (why) return card;

  body.replaceChildren(manual ? manualBox() : searchBox());
  return card;
}

function searchBox() {
  const box = node(`
    <div class="dj-search">
      <div class="dj-row">
        <input class="dj-q" type="search" enterkeyhint="search" autocomplete="off"
          placeholder="Artist or song" value="${esc(typed.q)}">
        <button class="dj-go" type="button">Search</button>
      </div>
      <div class="dj-results"></div>
      <button class="dj-swap linky" type="button">Can’t find it? Type it instead</button>
    </div>`);

  const input = box.querySelector('.dj-q');
  const results = box.querySelector('.dj-results');

  const paint = () => {
    if (saying) {
      results.replaceChildren(node(`<p class="tiny dj-say">${esc(saying)}</p>`));
      return;
    }
    if (searchState === 'looking') {
      results.replaceChildren(node('<p class="tiny dj-say">Looking…</p>'));
      return;
    }
    if (searchState === 'off') {
      // SAID OUT LOUD. A silent empty list reads as "your song is not on
      // Spotify", which would be a lie about the venue's wifi.
      results.replaceChildren(node(`<p class="tiny dj-say">Search is not available just now —
        <b>type it in</b> below and the DJ will still get it.</p>`));
      return;
    }
    if (searchState === 'none') {
      results.replaceChildren(node('<p class="tiny dj-say">Nothing found. Try fewer words, or type it in.</p>'));
      return;
    }
    if (!found.length) { results.replaceChildren(); return; }
    const list = node('<div class="dj-tracks"></div>');
    for (const t of found.slice(0, SHOW_TRACKS)) {
      const row = node(`
        <button class="dj-track" type="button">
          <span class="dj-track-title">${esc(t.title)}</span>
          <span class="dj-track-artist tiny">${esc(t.artist)}${t.year ? ` · ${esc(String(t.year))}` : ''}</span>
        </button>`);
      row.addEventListener('click', () => send({ artist: t.artist, title: t.title, source: 'spotify' }, row));
      list.appendChild(row);
    }
    results.replaceChildren(list);
  };

  const look = async () => {
    const q = input.value.trim();
    typed.q = q;
    saying = '';
    if (!q) { found = []; searchState = 'idle'; paint(); return; }
    searchState = 'looking';
    paint();
    const out = await postJson('/api/dj/search', { ...who(), q }).catch(() => null);
    if (!out || !out.ok) { searchState = 'error'; saying = 'Search did not work. Type it in instead.'; paint(); return; }
    if (out.configured === false) { found = []; searchState = 'off'; paint(); return; }
    found = out.tracks || [];
    searchState = found.length ? 'idle' : 'none';
    paint();
  };

  box.querySelector('.dj-go').addEventListener('click', look);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); look(); } });
  input.addEventListener('input', () => { typed.q = input.value; });
  box.querySelector('.dj-swap').addEventListener('click', () => {
    manual = true;
    box.replaceWith(manualBox());
  });

  paint();
  return box;
}

function manualBox() {
  const box = node(`
    <div class="dj-manual">
      <input class="dj-title" type="text" placeholder="Song" autocomplete="off" value="${esc(typed.title)}">
      <input class="dj-artist" type="text" placeholder="Artist (if you know it)" autocomplete="off" value="${esc(typed.artist)}">
      <button class="dj-send" type="button">Ask for it</button>
      <p class="tiny dj-say"></p>
      <button class="dj-swap linky" type="button">Search Spotify instead</button>
    </div>`);

  const title = box.querySelector('.dj-title');
  const artist = box.querySelector('.dj-artist');
  title.addEventListener('input', () => { typed.title = title.value; });
  artist.addEventListener('input', () => { typed.artist = artist.value; });
  if (saying) box.querySelector('.dj-say').textContent = saying;

  box.querySelector('.dj-send').addEventListener('click', (e) => {
    send({ artist: artist.value, title: title.value, source: 'typed' }, e.currentTarget, box.querySelector('.dj-say'));
  });
  box.querySelector('.dj-swap').addEventListener('click', () => {
    manual = false;
    saying = '';
    box.replaceWith(searchBox());
  });
  return box;
}

/* --------------------------------------------------------------- sending */

/*
 * AND THE JOIN CODE RIDES WITH IT. `roomForPhone()` falls back to the HOUSE
 * room when nothing names one, so a request sent without it at somebody
 * else's set would land in the owner's room — the same reasoning that puts
 * the code on `/api/join`.
 */
function who() {
  return { playerId: me && me.id, token: me && me.token, joinCode: roomCode() || undefined };
}

/**
 * A REQUEST THAT DID NOT SEND PUTS THE BUTTON BACK.
 *
 * The same rule `paintUnlocked()` exists for on the answering path, and the
 * same cost if it is missed: a phone that has been told it asked for
 * something, and has not.
 */
async function send(want, btn, sayEl) {
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Sending…';
  const out = await postJson('/api/dj/request', { ...who(), ...want }).catch(() => null);
  if (out && out.ok) {
    /*
     * AND THE BOX IS EMPTIED HERE, NOT LEFT TO THE REBUILD.
     *
     * The first version cleared `typed` and trusted the state push to redraw
     * from it — and the push had already arrived and rebuilt by the time the
     * POST resolved, so the song stayed sitting in the field with the
     * request underneath it, reading as if it had not sent. The RACE is the
     * point: the server's push and this reply are two answers to one act and
     * neither is reliably second.
     */
    typed = { q: '', artist: '', title: '' };
    found = [];
    searchState = 'idle';
    saying = '';
    for (const el of document.querySelectorAll('.dj-title, .dj-artist, .dj-q')) el.value = '';
    const results = document.querySelector('.dj-results');
    if (results) results.replaceChildren();
    return;
  }
  saying = refusal(out && out.reason);
  btn.disabled = false;
  btn.textContent = label;
  if (sayEl) sayEl.textContent = saying;
  else {
    const near = btn.closest('.dj-search')?.querySelector('.dj-results');
    if (near) near.replaceChildren(node(`<p class="tiny dj-say">${esc(saying)}</p>`));
  }
}

function refusal(reason) {
  return {
    locked: 'Send a photo first.',
    enough: 'That’s three waiting with the DJ already.',
    empty: 'Put a song title in first.',
    over: 'The DJ has finished taking requests.',
    full: 'The DJ has plenty to be going on with.',
    not_you: 'This phone lost its place — pull down to reload.',
  }[reason] || 'It did not send. Try again.';
}

/* ------------------------------------------------------- what you asked for */

function mineCard(s) {
  const mine = s.mine || [];
  if (!mine.length) return null;
  const card = node(`
    <div class="dj-card dj-mine">
      <div class="dj-card-what"><b>What you asked for</b></div>
      <div class="dj-mine-list"></div>
    </div>`);
  const list = card.querySelector('.dj-mine-list');
  for (const r of mine) {
    /*
     * PLAYED IS SAID AND NOT MUCH ELSE IS. There is deliberately no queue
     * position and no "3 ahead of you": the DJ plays what fits the floor, so
     * a number would be a promise the app cannot keep, and somebody watching
     * it not move is somebody who came to dance and is reading their phone.
     */
    list.appendChild(node(`
      <div class="dj-mine-row${r.played ? ' is-played' : ''}">
        <span class="dj-mine-what">
          <b>${esc(r.title)}</b>${r.artist ? `<span class="tiny"> ${esc(r.artist)}</span>` : ''}
        </span>
        <span class="dj-mine-state tiny">${r.played ? '✓ played' : 'with the DJ'}</span>
      </div>`));
  }
  return card;
}
