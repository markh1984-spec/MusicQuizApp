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

import { esc, node, postJson } from './client.js';

const LETTERS = ['A', 'B', 'C', 'D'];
const ROUND_TYPES = [
  ['text', 'Text — general knowledge'],
  ['image', 'Picture — whose face is this?'],
  ['intro', 'Intro — you play the track'],
];

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

const isBingo = () => kind === 'bingo';
const apiBase = () => (isBingo() ? '/api/bingo' : '/api/quiz');

// ------------------------------------------------------------------ loading

async function api(path, options = {}) {
  const res = await fetch(path + (path.includes('?') ? '&' : '?') + 'key=' + encodeURIComponent(hostKey), {
    headers: { 'Content-Type': 'application/json', 'X-Host-Key': hostKey },
    ...options,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw Object.assign(new Error(data.error || res.statusText), { data });
  return data;
}

/**
 * One picker for everything you have saved, quizzes and bingo packs together,
 * because "the thing I want to edit" is not usefully split by game.
 */
async function loadQuizList(selectId) {
  const library = await api('/api/library');
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
  if (selectId) pickEl.value = selectId;
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
  problems = [];
  setDirty(false);
  render();
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

function render() {
  if (!quiz) return;
  const parts = [];

  if (problems.length) {
    parts.push(node(`
      <div class="problems">
        <strong>${problems.length} thing${problems.length === 1 ? '' : 's'} to fix before this quiz is playable:</strong>
        <ul>${problems.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
      </div>`));
  } else if (problems.checked) {
    parts.push(node('<div class="problems ok"><strong>All good. Nothing wrong with this quiz.</strong></div>'));
  }

  if (isBingo()) {
    parts.push(bingoHeader());
    parts.push(trackListBlock());
    mainEl.replaceChildren(...parts);
    return;
  }

  parts.push(quizHeader());
  quiz.rounds.forEach((round, ri) => parts.push(roundBlock(round, ri)));

  const addRound = node('<button style="margin-top:8px">Add a round</button>');
  addRound.addEventListener('click', () => change(() => {
    quiz.rounds.push({
      id: 'r' + (quiz.rounds.length + 1),
      type: 'text',
      title: `Round ${quiz.rounds.length + 1}`,
      blurb: '',
      questions: [blankQuestion('text', `r${quiz.rounds.length + 1}q1`)],
    });
    render();
  }));
  parts.push(addRound);

  mainEl.replaceChildren(...parts);
}

// ------------------------------------------------------------ bingo packs

function bingoHeader() {
  const el = node(`
    <div class="round-block">
      <div class="round-head">
        <span class="type-tag">Bingo</span>
        <input class="title" id="bTitle" value="${esc(quiz.title)}" placeholder="Pack title">
        <label class="muted" style="font-size:13px">Card
          <select id="bSize" style="margin-left:6px">
            ${[3, 4, 5].map((n) => `<option value="${n}" ${quiz.cardSize === n ? 'selected' : ''}>${n}×${n}</option>`).join('')}
          </select>
        </label>
        <span class="muted" style="font-size:13px">File: ${esc(quiz.id)}.json</span>
      </div>
      <div class="qcard" style="border-radius:0 0 14px 14px">
        <label class="muted" style="font-size:12px;font-weight:700">Subtitle shown on the lobby screen</label>
        <input type="text" id="bSubtitle" value="${esc(quiz.subtitle || '')}" style="width:100%;margin:5px 0 10px">
        ${quiz.spotifyPlaylist ? `<div class="tiny">Spotify playlist: <a href="${esc(quiz.spotifyPlaylist.url)}" target="_blank" rel="noopener">open it</a></div>` : ''}
        ${quiz.notes ? `<div class="muted" style="font-size:12px;margin-top:6px">${esc(quiz.notes)}</div>` : ''}
      </div>
    </div>`);

  el.querySelector('#bTitle').addEventListener('input', (e) => change(() => { quiz.title = e.target.value; }));
  el.querySelector('#bSubtitle').addEventListener('input', (e) => change(() => { quiz.subtitle = e.target.value; }));
  el.querySelector('#bSize').addEventListener('change', (e) => change(() => { quiz.cardSize = Number(e.target.value); render(); }));
  return el;
}

/**
 * The track list. A ${n}×${n} card needs at least n² tracks and really wants
 * half again, so the count is shown against what the card size demands rather
 * than left for you to work out.
 */
function trackListBlock() {
  const size = quiz.cardSize || 4;
  const needed = size * size;
  const comfortable = Math.ceil(needed * 1.5);
  const have = quiz.tracks.length;

  const el = node(`
    <div class="round-block">
      <div class="round-head">
        <span class="type-tag">${have} tracks</span>
        <span style="font-weight:700;font-size:14px" class="${have < needed ? 'shortfall' : ''}">
          ${have < needed
            ? `Not enough — a ${size}×${size} card needs ${needed}`
            : have < comfortable
              ? `Playable, but ${comfortable}+ makes the cards more varied`
              : 'Plenty for varied cards'}
        </span>
        <button class="small" id="addTrack" style="margin-left:auto">Add a track</button>
      </div>
      <div class="qcard" style="border-radius:0 0 14px 14px">
        <div class="tracklist-edit" id="trackEdit"></div>
      </div>
    </div>`);

  const list = el.querySelector('#trackEdit');
  quiz.tracks.forEach((track, i) => {
    const row = node(`
      <div class="track-edit-row">
        <span class="tnum">${i + 1}</span>
        <input type="text" class="ttitle" value="${esc(track.title)}" placeholder="Track title">
        <input type="text" class="tartist" value="${esc(track.artist || '')}" placeholder="Artist">
        <button class="small up" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button class="small down" ${i === quiz.tracks.length - 1 ? 'disabled' : ''}>↓</button>
        <button class="small danger del">×</button>
      </div>`);

    row.querySelector('.ttitle').addEventListener('input', (e) => change(() => { track.title = e.target.value; }));
    row.querySelector('.tartist').addEventListener('input', (e) => change(() => { track.artist = e.target.value; }));
    row.querySelector('.up').addEventListener('click', () => change(() => { swap(quiz.tracks, i, i - 1); render(); }));
    row.querySelector('.down').addEventListener('click', () => change(() => { swap(quiz.tracks, i, i + 1); render(); }));
    row.querySelector('.del').addEventListener('click', () => change(() => { quiz.tracks.splice(i, 1); render(); }));
    list.appendChild(row);
  });

  el.querySelector('#addTrack').addEventListener('click', () => change(() => {
    quiz.tracks.push({ id: 't' + (quiz.tracks.length + 1), title: '', artist: '' });
    render();
  }));
  return el;
}

function quizHeader() {
  const el = node(`
    <div class="round-block">
      <div class="round-head">
        <input class="title" id="quizTitle" value="${esc(quiz.title)}" placeholder="Quiz title">
        <label class="muted" style="font-size:13px">Seconds per question
          <input type="number" id="quizSeconds" min="5" max="120" value="${quiz.questionSeconds}" style="width:70px;margin-left:6px">
        </label>
        <span class="muted" style="font-size:13px">File: ${esc(quiz.id)}.json</span>
      </div>
      <div class="qcard" style="border-radius:0 0 14px 14px">
        <label class="muted" style="font-size:12px;font-weight:700">Subtitle shown on the lobby screen</label>
        <input type="text" id="quizSubtitle" value="${esc(quiz.subtitle || '')}" style="width:100%;margin-top:5px">
      </div>
    </div>`);

  el.querySelector('#quizTitle').addEventListener('input', (e) => change(() => { quiz.title = e.target.value; }));
  el.querySelector('#quizSubtitle').addEventListener('input', (e) => change(() => { quiz.subtitle = e.target.value; }));
  el.querySelector('#quizSeconds').addEventListener('input', (e) => change(() => { quiz.questionSeconds = Number(e.target.value) || 20; }));
  return el;
}

function roundBlock(round, ri) {
  const el = node(`
    <div class="round-block">
      <div class="round-head">
        <span class="type-tag">Round ${ri + 1}</span>
        <input class="title" value="${esc(round.title)}" placeholder="Round title">
        <select class="rtype">
          ${ROUND_TYPES.map(([v, label]) => `<option value="${v}" ${round.type === v ? 'selected' : ''}>${esc(label)}</option>`).join('')}
        </select>
        <button class="small danger delete-round">Delete round</button>
      </div>
    </div>`);

  el.querySelector('.title').addEventListener('input', (e) => change(() => { round.title = e.target.value; }));
  el.querySelector('.rtype').addEventListener('change', (e) => change(() => { round.type = e.target.value; render(); }));
  el.querySelector('.delete-round').addEventListener('click', () => {
    if (confirm(`Delete "${round.title}" and all ${round.questions.length} of its questions?`)) {
      change(() => { quiz.rounds.splice(ri, 1); render(); });
    }
  });

  round.questions.forEach((q, qi) => el.appendChild(questionCard(round, q, ri, qi)));

  const add = node('<div class="qcard" style="border-radius:0 0 14px 14px"><button class="small">Add a question to this round</button></div>');
  add.querySelector('button').addEventListener('click', () => change(() => {
    round.questions.push(blankQuestion(round.type, `${round.id}q${round.questions.length + 1}`));
    render();
  }));
  el.appendChild(add);
  return el;
}

function questionCard(round, q, ri, qi) {
  const flagged = problems.some((p) => p.startsWith(`Round ${ri + 1} question ${qi + 1}:`));
  const el = node(`
    <div class="qcard ${flagged ? 'flagged' : ''}">
      <div class="qtop">
        <span class="qnum">Question ${qi + 1}</span>
        <div class="qtools">
          <button class="small up" ${qi === 0 ? 'disabled' : ''}>↑</button>
          <button class="small down" ${qi === round.questions.length - 1 ? 'disabled' : ''}>↓</button>
          <button class="small dup">Duplicate</button>
          <button class="small danger del">Delete</button>
        </div>
      </div>
      <textarea class="prompt" rows="2" placeholder="The question, as it appears on the big screen">${esc(q.prompt)}</textarea>
      <div class="opts"></div>
      <div class="extras"></div>
      <div class="extra-fields" style="margin-top:11px">
        <label>Fact to read out on the reveal
          <input type="text" class="answerNote" value="${esc(q.answerNote || '')}" placeholder="Optional">
        </label>
        <label>Note for you only
          <input type="text" class="note" value="${esc(q.note || '')}" placeholder="Optional">
        </label>
      </div>
    </div>`);

  el.querySelector('.prompt').addEventListener('input', (e) => change(() => { q.prompt = e.target.value; }));
  el.querySelector('.answerNote').addEventListener('input', (e) => change(() => { q.answerNote = e.target.value; }));
  el.querySelector('.note').addEventListener('input', (e) => change(() => { q.note = e.target.value; }));

  el.querySelector('.up').addEventListener('click', () => change(() => { swap(round.questions, qi, qi - 1); render(); }));
  el.querySelector('.down').addEventListener('click', () => change(() => { swap(round.questions, qi, qi + 1); render(); }));
  el.querySelector('.dup').addEventListener('click', () => change(() => {
    round.questions.splice(qi + 1, 0, { ...structuredClone(q), id: q.id + '-copy' });
    render();
  }));
  el.querySelector('.del').addEventListener('click', () => {
    if (confirm('Delete this question?')) change(() => { round.questions.splice(qi, 1); render(); });
  });

  // ---- the four options, with a radio for which one is right
  const opts = el.querySelector('.opts');
  for (let i = 0; i < 4; i++) {
    const row = node(`
      <div class="opt-row ${q.correctIndex === i ? 'is-correct' : ''}">
        <label>
          <input type="radio" name="correct-${ri}-${qi}" ${q.correctIndex === i ? 'checked' : ''}>
          ${LETTERS[i]}
        </label>
        <input type="text" value="${esc(q.options[i] ?? '')}" placeholder="Option ${LETTERS[i]}">
      </div>`);
    row.querySelector('input[type="radio"]').addEventListener('change', () => change(() => {
      q.correctIndex = i;
      render();
    }));
    row.querySelector('input[type="text"]').addEventListener('input', (e) => change(() => {
      q.options[i] = e.target.value;
    }));
    opts.appendChild(row);
  }

  // ---- fields that only some round types need
  const extras = el.querySelector('.extras');
  if (round.type === 'image') extras.appendChild(imageFields(q));
  if (round.type === 'intro') extras.appendChild(cueFields(q));

  return el;
}

function imageFields(q) {
  const el = node(`
    <div class="extra-fields" style="margin-top:11px">
      <label>Image file (in /images)
        <input type="text" class="image" value="${esc(q.image || '')}" placeholder="eighties/madonna.png">
      </label>
      <label>Starting zoom
        <input type="number" class="zoomFrom" min="1" max="12" step="0.5" value="${q.zoomFrom ?? 6}">
      </label>
      <label>Prompt for the image generator
        <input type="text" class="imagePrompt" value="${esc(q.imagePrompt || '')}" placeholder="Optional — used by generate-images.mjs">
      </label>
    </div>`);
  el.querySelector('.image').addEventListener('input', (e) => change(() => { q.image = e.target.value; }));
  el.querySelector('.zoomFrom').addEventListener('input', (e) => change(() => { q.zoomFrom = Number(e.target.value); }));
  el.querySelector('.imagePrompt').addEventListener('input', (e) => change(() => { q.imagePrompt = e.target.value; }));
  return el;
}

function cueFields(q) {
  if (!q.cue) q.cue = { title: '', artist: '', from: '', hint: '' };
  const el = node(`
    <div class="extra-fields cue" style="margin-top:11px">
      <div class="note">Your eyes only — this never goes near the big screen.</div>
      <label>Track title
        <input type="text" class="ctitle" value="${esc(q.cue.title || '')}">
      </label>
      <label>Artist
        <input type="text" class="cartist" value="${esc(q.cue.artist || '')}">
      </label>
      <label>Start from
        <input type="text" class="cfrom" value="${esc(q.cue.from || '')}" placeholder="0:00">
      </label>
      <label>How to play it
        <input type="text" class="chint" value="${esc(q.cue.hint || '')}" placeholder="Let the intro run about 8 seconds">
      </label>
    </div>`);
  el.querySelector('.ctitle').addEventListener('input', (e) => change(() => { q.cue.title = e.target.value; }));
  el.querySelector('.cartist').addEventListener('input', (e) => change(() => { q.cue.artist = e.target.value; }));
  el.querySelector('.cfrom').addEventListener('input', (e) => change(() => { q.cue.from = e.target.value; }));
  el.querySelector('.chint').addEventListener('input', (e) => change(() => { q.cue.hint = e.target.value; }));
  return el;
}

function blankQuestion(type, id) {
  const q = { id, prompt: '', options: ['', '', '', ''], correctIndex: 0 };
  if (type === 'image') q.image = '';
  if (type === 'intro') q.cue = { title: '', artist: '', from: '', hint: '' };
  return q;
}

function swap(list, a, b) {
  if (b < 0 || b >= list.length) return;
  [list[a], list[b]] = [list[b], list[a]];
}

// -------------------------------------------------------------------- saving

async function save() {
  try {
    await api(`${apiBase()}/` + encodeURIComponent(quiz.id), { method: 'PUT', body: JSON.stringify(quiz) });
    problems = [];
    problems.checked = true;
    setDirty(false);
    render();
    flash('Saved');
  } catch (err) {
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
    await api('/api/quiz', { method: 'POST', body: JSON.stringify(fresh) });
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

if (!hostKey) {
  mainEl.replaceChildren(node('<div class="problems"><strong>No host key.</strong> Open this page from the control view, or add ?key=… to the address.</div>'));
} else {
  loadQuizList().catch((err) => {
    mainEl.replaceChildren(node(`<div class="problems"><strong>Could not load the quizzes:</strong> ${esc(err.message)}</div>`));
  });
}
