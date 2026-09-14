/**
 * THE FRONT DOOR OF THE DJ SET — start it, and the two links you then need.
 *
 * ---
 *
 * **IT IS NOT ON THE CONSOLE'S GAME PICKER AND MUST NOT BE.** That picker
 * chooses what tonight's PACK is played as, and there is no DJ pack to play —
 * putting a third option there would also add one to the protected launch
 * path for a feature that has nothing to do with a pub quiz. `GAME_KINDS` and
 * `LAUNCHERS` are held in step by `test/engine-contract.test.js`'s sibling,
 * `game-kinds.test.js`, which names this as the one deliberate exception.
 *
 * **THE WHOLE PAGE IS THREE THINGS: start it, put it on the screen, drive
 * it.** A set has no packs to choose between, no rounds, no prizes and no
 * settings — so anything else here would be a control invented to fill a
 * page, which is the opposite of what this door is for.
 */

import { esc, node, postJson, brandMark } from './client.js';

/*
 * ── THE NAME IS A PLACEHOLDER AND IS MARKED AS ONE ────────────────────────
 *
 * The host has not named this yet. It is in ONE constant and drawn from here
 * everywhere, so naming it is one edit rather than a search — and it is
 * spelt out as a placeholder rather than left looking decided, which is the
 * rule the legal pages already run on: *a placeholder must stay MARKED or
 * nobody greps it.*
 *
 * PLACEHOLDER — rename when the host chooses.
 */
const APP_NAME = 'Requests';

const root = document.getElementById('djDoor');

/** The key off the URL, never out of storage — the remembered-key rule. */
const key = new URLSearchParams(location.search).get('key') || '';
const withKey = (path) => (key ? `${path}${path.includes('?') ? '&' : '?'}key=${encodeURIComponent(key)}` : path);

async function look() {
  const res = await fetch(withKey('/api/state?role=host'), {
    headers: key ? { 'X-Host-Key': key } : {},
  });
  if (res.status === 401) return { signIn: true };
  if (!res.ok) return { broken: true };
  return { state: await res.json() };
}

async function start(replace) {
  const res = await fetch('/api/dj/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(key ? { 'X-Host-Key': key } : {}) },
    body: JSON.stringify({ replace: Boolean(replace) }),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

function shell(inner) {
  root.replaceChildren(node(`
    <div class="dj-door">
      <div class="dj-door-brand">${brandMark(30)}<b>${esc(APP_NAME)}</b></div>
      ${inner}
    </div>`));
  return root.querySelector('.dj-door');
}

/*
 * SIGNING IN COMES BACK HERE, AND THAT IS THE WHOLE POINT OF `next`.
 *
 * The first version linked to a bare `/login`, which lands a quizmaster on
 * the console and the OWNER on `/owner` — so pressing *Sign in* on the DJ
 * door put you in the quiz app and never brought you back. Reported in those
 * words: *"that just signed me into my quiz app."*
 *
 * **It is a separate app to the person using it**, so every way in has to end
 * up here. `/login` already takes `?next=` and only ever honours a path on
 * this site, so this needs no second password form — a second place a
 * password is typed is the last thing this app should grow.
 */
const BACK_HERE = `/login?next=${encodeURIComponent('/dj')}`;

function drawSignIn() {
  shell(`
    <h1 class="ld-h2">Sign in first</h1>
    <p class="ld-section-lede">It runs on your own account, in your own room —
      the same one your quiz nights use. You will come straight back here.</p>
    <a class="ld-cta" href="${esc(BACK_HERE)}">Sign in</a>`);
}

function drawRunning(s) {
  const el = shell(`
    <h1 class="ld-h2">The set is on</h1>
    <p class="ld-section-lede">${s.joinCode
      ? `Your code is <b>${esc(s.joinCode)}</b>. Put the screen up and they can start sending.`
      : 'Put the screen up and they can start sending.'}</p>
    <div class="dj-door-links">
      <a class="ld-cta" href="/screen" target="_blank" rel="noopener">Open the screen</a>
      <a class="minor" href="${esc(withKey('/host'))}">Go to the desk</a>
    </div>
    <p class="tiny dj-door-note">${s.requests ? s.requests.length : 0} waiting ·
      ${s.playerCount} ${s.playerCount === 1 ? 'phone' : 'phones'} in</p>`);
  return el;
}

function drawStart(busy) {
  /*
   * WHAT IT WOULD END IS NAMED BEFORE IT ENDS IT — the launch rule this app
   * already follows. `inProgress()` on the server is what actually refuses;
   * this is the sentence that stops somebody finding out afterwards.
   */
  const el = shell(`
    <h1 class="ld-h2">Put a code on the screen</h1>
    <p class="ld-section-lede">They send a photo, it goes straight up — and then
      they can ask you for a song.</p>
    ${busy ? `<p class="tiny dj-door-warn">${esc(busy)} is running in your room.
      Starting a set ends it.</p>` : ''}
    <button class="ld-cta" id="djStart" type="button">${busy ? 'Start anyway' : 'Start the set'}</button>`);

  el.querySelector('#djStart').addEventListener('click', async (e) => {
    e.currentTarget.disabled = true;
    e.currentTarget.textContent = 'Starting…';
    const out = await start(Boolean(busy));
    if (out.status === 409) return draw();          // something started underneath us
    if (out.status === 401) return drawSignIn();
    if (out.status !== 200) {
      e.currentTarget.disabled = false;
      e.currentTarget.textContent = 'Start the set';
      const note = node('<p class="tiny dj-door-warn">It did not start. Try again.</p>');
      el.appendChild(note);
      return undefined;
    }
    return draw();
  });
  return el;
}

async function draw() {
  const seen = await look();
  if (seen.signIn) return drawSignIn();
  if (seen.broken) {
    shell('<h1 class="ld-h2">Not right now</h1><p class="ld-section-lede">Reload the page.</p>');
    return undefined;
  }
  const s = seen.state || {};
  if (s.game === 'dj' && s.phase !== 'finished') return drawRunning(s);
  /*
   * A ROOM ALWAYS HAS A GAME BUILT, so "something is running" is not the same
   * question as "a game exists" — it is whether anybody has JOINED one, which
   * is what `inProgress()` asks. Naming it here would mean asking the server
   * twice, so the page asks once and lets the 409 be the authority: the first
   * press is honest, and a refusal comes back as the warning above.
   */
  return drawStart((s.playerCount || 0) > 0 && s.game !== 'dj'
    ? (s.game === 'bingo' ? 'A bingo game' : 'A quiz') : '');
}

draw();
