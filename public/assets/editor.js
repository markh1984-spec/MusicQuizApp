/**
 * The review editor.
 *
 * This exists because an AI howler in front of a paying room is the worst
 * outcome in the whole project. Every question gets read here before the gig:
 * fix the wording, move the correct answer, bin a question you do not like,
 * write your own.
 *
 * It reads and writes the same plain JSON files in /quizzes that the app runs
 * from — there is no separate database and no import step. What you save here
 * is exactly what plays tonight.
 */

import { esc, node, postJson, brandLink, paintNav, paintIdentity, menuRights } from './client.js';
import { renderPack, blankQuestion } from './pack-editor.js';
import { cueOffsetSays } from './cue.js';

const mainEl = document.getElementById('main');
const pickEl = document.getElementById('quizPick');
const saveEl = document.getElementById('save');
const checkEl = document.getElementById('check');
const dirtyEl = document.getElementById('dirtyFlag');

const hostKey = new URL(location.href).searchParams.get('key')
  || localStorage.getItem('musicquiz.hostkey')
  || '';

let quiz = null;      // the pack being edited, quiz or bingo
let kind = 'quiz';    // which of the two
let dirty = false;
let problems = [];
/*
 * Which library this pack belongs to, and which one a NEW pack would go in.
 *
 * The catalogue is the owner's; a quizmaster writes their own, which live in
 * their room's own folder and go to a different route — `/api/mine/*`. The two
 * cannot share a route, because the rule that keeps subscribers out of the
 * catalogue is a path test and a path cannot say which of two libraries a pack
 * id is in. See own-packs.js.
 *
 * Both default to "the catalogue", so the host key and anything that cannot
 * reach /api/me behave exactly as they always did.
 */
let ownPack = false;
let catalogue = true;

const isBingo = () => kind === 'bingo';
const apiBase = () => (isBingo() ? '/api/bingo' : '/api/quiz');
// Where a SAVE goes. Reading is one route for both — it resolves their own
// library first — but writing has to name which one.
const saveTo = () => (ownPack || !catalogue ? `/api/mine/${kind}` : `${apiBase()}/` + encodeURIComponent(quiz.id));
const saveMethod = () => (ownPack || !catalogue ? 'POST' : 'PUT');

// ------------------------------------------------------------------ loading

async function api(path, options = {}) {
  // The key is appended only when there IS one. A signed-in owner has a cookie
  // and needs no key, and `?key=` with nothing after it is not the same as no
  // key at all — it is a wrong key, which is a 401.
  const url = hostKey
    ? path + (path.includes('?') ? '&' : '?') + 'key=' + encodeURIComponent(hostKey)
    : path;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(hostKey ? { 'X-Host-Key': hostKey } : {}) },
    ...options,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (res.status === 401) {
    // Not signed in and no working key. A remembered key that has stopped
    // working should send you somewhere you can fix it rather than leaving you
    // on an error.
    localStorage.removeItem('musicquiz.hostkey');
    location.href = hostKey ? '/console' : '/login?next=/editor';
    throw new Error('Not signed in');
  }
  if (res.status === 403) {
    mainEl.replaceChildren(node(`<div class="problems"><strong>${esc(data.error || 'Not allowed.')}</strong>
      The packs in the catalogue are written for you and cannot be edited here. Quizzes you
      write yourself can — <a href="/console">back to the console</a>.</div>`));
    throw new Error(data.error || 'Not allowed');
  }
  if (!res.ok) throw Object.assign(new Error(data.error || res.statusText), { data });
  return data;
}

/**
 * One picker for everything you have saved, quizzes and bingo packs together,
 * because "the thing I want to edit" is not usefully split by game.
 */
async function loadQuizList(selectId) {
  // Who is looking, so a save knows which library it is writing to. Failing
  // this must not take the editor down — it falls back to the catalogue, which
  // is what the page did before there were two.
  let rights = { control: false, packs: true, owner: false };
  try {
    const me = await api('/api/me');
    const features = (me && me.account && me.account.entitlements && me.account.entitlements.features) || null;
    if (features) catalogue = features.includes('owner.catalogue');
    rights = menuRights(me);
    paintIdentity(me);
  } catch {
    catalogue = true;
  }
  const library = await api('/api/library');
  const slot = document.getElementById('brandSlot');
  const navKey = new URL(location.href).searchParams.get('key') || '';
  if (slot && library.brand) {
    slot.innerHTML = brandLink(library.brand, { key: navKey, size: 26, appName: library.appName || '' });
    document.title = `Editor — ${library.brand}`;
  }
  paintNav(document.getElementById('navSlot'), { current: 'packs', key: navKey, ...rights });
  const options = [];

  if (library.quizzes.length) {
    options.push(node('<optgroup label="Music quizzes"></optgroup>'));
    for (const q of library.quizzes) {
      options[options.length - 1].appendChild(node(
        `<option value="quiz:${esc(q.id)}">${esc(q.title)} — ${q.questionCount} questions${q.broken ? ' (BROKEN)' : ''}</option>`));
    }
  }
  if (library.bingo.length) {
    options.push(node('<optgroup label="Music bingo"></optgroup>'));
    for (const b of library.bingo) {
      options[options.length - 1].appendChild(node(
        `<option value="bingo:${esc(b.id)}">${esc(b.title)} — ${b.trackCount} tracks${b.broken ? ' (BROKEN)' : ''}</option>`));
    }
  }

  pickEl.replaceChildren(...options);

  /*
   * Open the pack that was ASKED for, not whichever happens to be first.
   *
   * `?quiz=…` and `?bingo=…` were being linked to from two places — the "Open
   * the editor" line on a finished generation, and Open on a reported question
   * — and read by neither. Both landed you on the top of the list, which after
   * generating a quiz is somebody else's pack with your work nowhere in sight.
   */
  const url = new URL(location.href);
  const wanted = selectId
    || (url.searchParams.get('quiz') ? `quiz:${url.searchParams.get('quiz')}` : '')
    || (url.searchParams.get('bingo') ? `bingo:${url.searchParams.get('bingo')}` : '');
  // Only if it is really in the list. A stale link should open the editor on
  // something rather than on nothing at all.
  if (wanted && [...pickEl.options].some((o) => o.value === wanted)) pickEl.value = wanted;
  if (pickEl.value) await openPack(pickEl.value);
}

async function openPack(value) {
  if (dirty && !confirm('You have unsaved changes. Throw them away?')) {
    pickEl.value = `${kind}:${quiz.id}`;
    return;
  }
  const [nextKind, id] = value.split(':');
  kind = nextKind;
  quiz = await api(`${apiBase()}/` + encodeURIComponent(id));
  // The server says which library it came out of, so an edit goes back where
  // it came from rather than wherever this page last guessed.
  ownPack = Boolean(quiz.mine);
  delete quiz.mine;
  problems = [];
  playState = { playing: 0, live: null, phase: '' };
  setDirty(false);
  render();
  // Ask about THIS pack now, and keep asking — a page open since seven
  // o'clock must not still be describing seven o'clock.
  watchPlaying();
}

function setDirty(value) {
  dirty = value;
  saveEl.disabled = !value;
  dirtyEl.textContent = value ? 'Unsaved changes' : '';
}

/** Any edit runs through here, so nothing can change without marking dirty. */
function change(fn) {
  fn();
  setDirty(true);
}

// ----------------------------------------------------------------- rendering

/*
 * WHO IS PLAYING THIS RIGHT NOW — polled, because a page can sit open for
 * hours and a warning that was true at seven o'clock is worse than none at
 * nine: it gets trusted. `{ playing, phase, live }`, refreshed on a timer and
 * again the moment the tab is looked at.
 *
 * It is only the SIGN. The guard that decides whether a save goes through
 * runs on the server at the moment of writing, where it cannot be stale.
 */
let playState = { playing: 0, live: null, phase: '' };
let playTimer = null;

async function pollPlaying() {
  if (!quiz || !quiz.id) return;
  try {
    const was = JSON.stringify(playState);
    // Its own fetch rather than `api()`: a poll that fails must leave the last
    // answer on screen, not sign somebody out of the page they are typing in.
    const path = `/api/playing/${kind}/` + encodeURIComponent(quiz.id);
    const res = await fetch(hostKey ? `${path}?key=${encodeURIComponent(hostKey)}` : path,
      { headers: hostKey ? { 'X-Host-Key': hostKey } : {} });
    if (!res.ok) return;
    playState = await res.json();
    // Only redraw when something actually changed — this runs every few
    // seconds and the page is full of text boxes somebody may be typing in.
    if (JSON.stringify(playState) !== was) render();
  } catch { /* a poll that fails simply leaves the last answer up */ }
}

function watchPlaying() {
  if (playTimer) clearInterval(playTimer);
  pollPlaying();
  playTimer = setInterval(pollPlaying, 8000);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) pollPlaying(); });

/**
 * The gold banner: somebody is playing this pack.
 *
 * Gold rather than red, deliberately — nothing is wrong and nothing is being
 * destroyed. It is the same treatment "not invoiced" and a venue clash get:
 * a fact you need before you decide, not a fault. The red is saved for the
 * one question that is actually on a screen, so that when red appears it
 * means something.
 */
function playingBanner() {
  if (!playState.playing) return null;
  const n = playState.playing;
  const live = playState.live;
  const where = live
    ? `They are on round ${live.roundIndex + 1}, question ${live.questionIndex + 1}.`
    : 'No question is on screen at the moment.';
  return node(`
    <div class="in-play">
      <strong>Being played right now${n > 1 ? ` by ${n} quizmasters` : ''}.</strong>
      ${esc(where)} Anything you save reaches them the moment you save it.
    </div>`);
}

/*
 * Everything past the banner and the problems list — the pack's own header,
 * every round, every question — is shared with the console's popover editor,
 * in `pack-editor.js`. `ctx` is built once, with getters, so it always reads
 * the CURRENT `quiz`/`kind`/`problems`/`playState` even though those are
 * plain module-level `let`s reassigned elsewhere (`openPack`, `pollPlaying`).
 */
const ctx = {
  get quiz() { return quiz; },
  set quiz(v) { quiz = v; },
  get kind() { return kind; },
  get problems() { return problems; },
  get playState() { return playState; },
  change,
  render,
};

function render() {
  if (!quiz) return;
  const parts = [];

  const banner = playingBanner();
  if (banner) parts.push(banner);

  if (problems.length) {
    parts.push(node(`
      <div class="problems">
        <strong>${problems.length} thing${problems.length === 1 ? '' : 's'} to fix before this quiz is playable:</strong>
        <ul>${problems.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
      </div>`));
  } else if (problems.checked) {
    parts.push(node('<div class="problems ok"><strong>All good. Nothing wrong with this quiz.</strong></div>'));
  }

  mainEl.replaceChildren(...parts);
  renderPack(ctx, mainEl);
}

// -------------------------------------------------------------------- saving

async function save(confirmLive = false) {
  try {
    const body = confirmLive ? { ...quiz, confirmLive: true } : quiz;
    const result = await api(saveTo(), { method: saveMethod(), body: JSON.stringify(body) });
    problems = [];
    problems.checked = true;
    setDirty(false);
    render();
    // Say whether it is permanent, because "Saved" on its own is misleading
    // when the server's filesystem is temporary.
    flash(result.backedUp ? 'Saved and backed up' : 'Saved here only — not backed up');
    /*
     * AND WHAT THE EDITED TRACKS NOW POINT AT.
     *
     * Editing a cue's words used to leave `spotifyUri` on the old recording,
     * so a corrected track read right and played the wrong song in front of a
     * room. The save re-resolves it now (`src/recue.js`) — but a SILENT
     * re-point is its own trap, because Spotify's search is a guess and
     * "Crazy" by anybody is four different records.
     *
     * So it says what it matched, and it stays on screen rather than flashing:
     * this is the one thing worth reading before the gig, and a 1.8-second
     * toast is not a way to check four tracks.
     */
    sayCues(result.cued);
  } catch (err) {
    /*
     * THE QUESTION IS ON A SCREEN RIGHT NOW, and the save changes it.
     *
     * Asked rather than refused: somebody telling the host a question is
     * wrong DURING a night is precisely why editing mid-night is allowed at
     * all. Everything else in the pack has already saved straight through —
     * this only fires for the question a room is looking at this second.
     *
     * The check ran on the SERVER at the moment of writing, so it cannot be
     * stale the way the banner at the top of this page can.
     */
    if (err.data && err.data.error === 'onScreenNow' && !confirmLive) {
      const live = err.data.live || {};
      const where = `round ${(live.roundIndex || 0) + 1}, question ${(live.questionIndex || 0) + 1}`;
      const asking = `That is the question on screen RIGHT NOW — ${where}, in front of a room that is playing it.\n\n`
        + `Saving changes it mid-question, and the answer key with it.\n\nSave anyway?`;
      if (confirm(asking)) return save(true);
      return;
    }
    // The server validates too, and refuses to write a broken quiz to disk.
    problems = err.data && err.data.problems ? err.data.problems : [err.message];
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

/** Check without saving, so you can see what is wrong mid-edit. */
async function check() {
  try {
    const res = await fetch(`${apiBase()}/__validate?key=` + encodeURIComponent(hostKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Host-Key': hostKey },
      body: JSON.stringify(quiz),
    });
    const data = await res.json();
    problems = data.problems || [];
    problems.checked = true;
    render();
    if (!problems.length) flash('All good');
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    flash('Could not check: ' + err.message);
  }
}

/**
 * What the save did to the intro cues, under the toolbar until dismissed.
 *
 * Silent when nothing was re-pointed, which is almost every save — a note that
 * appears on every save is a note nobody reads on the one that matters.
 */
function sayCues(cued) {
  document.querySelector('.cue-said')?.remove();
  if (!cued || (!cued.matched?.length && !cued.missed?.length && !cued.skipped)) return;

  const bits = [];
  if (cued.matched?.length) {
    bits.push(`<b>Re-pointed ${cued.matched.length} track${cued.matched.length === 1 ? '' : 's'}:</b> `
      + cued.matched.map((m) => esc(`${m.title} — ${m.artist}`)).join(' · ')
      + ' <span class="tiny">Check that is the recording you meant.</span>');
  }
  if (cued.missed?.length) {
    // Named, because this one costs silence on the night if it is not fixed.
    bits.push(`<b>Not found on Spotify:</b> `
      + cued.missed.map((m) => esc(`${m.title} — ${m.artist}`)).join(' · ')
      + ' <span class="tiny">These will not play from the app — the words still work if you play it yourself.</span>');
  }
  if (cued.skipped === 'no-spotify') {
    bits.push('<b>Spotify is not connected</b>, so the edited tracks were not looked up. '
      + '<span class="tiny">The cue still says what to play.</span>');
  }

  const el = node(`<div class="cue-said">${bits.join('<br>')}
    <button class="cue-said-x" type="button" aria-label="Dismiss">&times;</button></div>`);
  el.querySelector('.cue-said-x').addEventListener('click', () => el.remove());
  document.querySelector('main')?.prepend(el);
}

function flash(message) {
  const el = node(`<div class="saved-flash">${esc(message)}</div>`);
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1800);
}

// --------------------------------------------------------------------- boot

pickEl.addEventListener('change', () => openPack(pickEl.value));
saveEl.addEventListener('click', save);
checkEl.addEventListener('click', check);

document.getElementById('newQuiz').addEventListener('click', async () => {
  const title = prompt('What is this quiz called?', 'The 1990s Music Quiz');
  if (!title) return;
  const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'quiz';
  const fresh = {
    id, title, subtitle: '', questionSeconds: 20,
    rounds: [{ id: 'r1', type: 'text', title: 'Round One', blurb: '', questions: [blankQuestion('text', 'r1q1')] }],
  };
  try {
    kind = 'quiz';
    ownPack = !catalogue;
    await api(catalogue ? '/api/quiz' : '/api/mine/quiz', { method: 'POST', body: JSON.stringify(fresh) });
    await loadQuizList(id);
  } catch (err) {
    // A brand new quiz has empty questions, which the validator rightly
    // objects to — so hold it in the browser until it is worth saving.
    quiz = fresh;
    problems = (err.data && err.data.problems) || [];
    setDirty(true);
    render();
  }
});

/**
 * Download and upload.
 *
 * These matter more than they look. On a host like Render the filesystem is
 * wiped on every redeploy, so a quiz you tidied up on the live app would
 * vanish next time you push. Download it, drop it in /quizzes, commit it, and
 * it is safe. Upload is the same trip in reverse.
 */
document.getElementById('download').addEventListener('click', () => {
  if (!quiz) return;
  const blob = new Blob([JSON.stringify(quiz, null, 2) + '\n'], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${quiz.id}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  flash(`Saved ${quiz.id}.json — put it in your /quizzes folder`);
});

document.getElementById('upload').addEventListener('click', () => {
  document.getElementById('uploadInput').click();
});

document.getElementById('uploadInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const incoming = JSON.parse(await file.text());
    if (!incoming.rounds) throw new Error('That file is not a quiz pack.');
    quiz = incoming;
    quiz.id = quiz.id || file.name.replace(/\.json$/i, '');
    delete quiz.mine;
    // A file off somebody's laptop goes into THEIR library, not the catalogue.
    ownPack = !catalogue;
    problems = [];
    setDirty(true);
    render();
    flash('Loaded. Press Save to keep it.');
  } catch (err) {
    flash('Could not read that file: ' + err.message);
  }
  e.target.value = '';
});

// Do not let a closing tab quietly lose an afternoon of edits.
window.addEventListener('beforeunload', (e) => {
  if (dirty) { e.preventDefault(); e.returnValue = ''; }
});

// Ctrl/Cmd-S saves, because everybody tries it.
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); if (dirty) save(); }
});

/*
 * No key needed any more.
 *
 * The editor used to refuse outright without one, which was right when the key
 * was the only identity there was — and wrong the moment an owner could sign
 * in, because writing packs is the OWNER's job and they have no key. Same fix
 * the control view needed: ask the server and let it decide, rather than
 * deciding here on the strength of a string in the address bar.
 */
loadQuizList().catch((err) => {
  mainEl.replaceChildren(node(`<div class="problems"><strong>Could not load the quizzes:</strong> ${esc(err.message)}</div>`));
});
