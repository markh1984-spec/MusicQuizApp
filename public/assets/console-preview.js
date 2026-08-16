/** Reading a pack — the preview of a quiz or a bingo game, and its warnings. */

import { balanceAnswers } from './balance.js';
import { esc, node } from './client.js';
import { library } from './console-state.js';
import { can, hostKey, keyed } from './console.js';
import { FEATURES } from './plans.js';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const ROUND_LABELS = {
  text: 'General knowledge',
  image: 'Whose face is this?',
  intro: 'Name that intro',
  multi: 'Pick them all',
  alphabet: 'First letter only',
};
const REVEAL_LABELS = {
  zoom: 'zooms out',
  pixelate: 'pixelates',
  blur: 'comes into focus',
  tiles: 'tiles come away',
  mix: 'a different effect each question',
};

/** The letter an alphabet answer turns on. Mirrors answerLetter in src/quizzes.js. */
function firstLetter(answer) {
  const found = String(answer || '').trim().match(/[a-z]/i);
  return found ? found[0].toUpperCase() : '';
}

/**
 * The flags, with a way to tick each one off.
 *
 * Reading twenty of these is a job, and a job you can lose your place in. So a
 * checked flag drops out of the list into a folded-away pile at the bottom,
 * leaving only what you have not looked at yet — and it stays checked next
 * time, because it is saved on the question rather than in this browser.
 *
 * They are never removed outright: a flag you dismissed by mistake, or one on
 * a question you later rewrote, has to be gettable back.
 */
function warningPanel(quiz, warnings) {
  const el = node(`
    <div class="pv-warn">
      <b class="pv-warn-head"></b>
      <ul class="pv-flags"></ul>
      <div class="pv-cleared" hidden>
        <button class="pv-cleared-toggle" type="button"></button>
        <ul class="pv-flags done" hidden></ul>
      </div>
      <div class="tiny" style="margin-top:8px">These are hunches, not errors — the app cannot tell whether a fact is true. Read them and decide.</div>
    </div>`);

  const head = el.querySelector('.pv-warn-head');
  const openList = el.querySelector('.pv-flags');
  const clearedBox = el.querySelector('.pv-cleared');
  const clearedToggle = el.querySelector('.pv-cleared-toggle');
  const clearedList = el.querySelector('.pv-flags.done');
  let showCleared = false;

  const draw = () => {
    const open = warnings.filter((w) => !w.cleared);
    const done = warnings.filter((w) => w.cleared);

    head.textContent = open.length
      ? `${open.length} thing${open.length === 1 ? '' : 's'} worth a second look`
      : 'All checked — nothing left to look at';
    head.classList.toggle('all-clear', open.length === 0);
    el.classList.toggle('all-clear', open.length === 0);

    openList.replaceChildren(...open.map((w) => row(w, false)));
    clearedBox.hidden = done.length === 0;
    clearedToggle.textContent = `${showCleared ? 'Hide' : 'Show'} ${done.length} you have checked`;
    clearedList.hidden = !showCleared;
    clearedList.replaceChildren(...done.map((w) => row(w, true)));
  };

  const row = (w, done) => {
    // A tick is written into the pack itself, so it is the owner's — a
    // quizmaster reads the hunches and reports anything wrong from the
    // control view instead.
    const li = node(`
      <li class="pv-flag ${done ? 'done' : ''}">
        <span class="pv-flag-text">${esc(w.text)}</span>
        ${can(FEATURES.CATALOGUE) ? `<button class="pv-tick" type="button">${done ? 'Undo' : 'Checked'}</button>` : ''}
      </li>`);
    const button = li.querySelector('.pv-tick');
    button?.addEventListener('click', async () => {
      button.disabled = true;
      const wanted = !w.cleared;
      try {
        const res = await fetch(keyed(`/api/quiz/${encodeURIComponent(quiz.id)}/checked`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Host-Key': hostKey },
          body: JSON.stringify({ questionId: w.questionId, warning: w.id, checked: wanted }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Could not save that');
        // Trust the server's list over the local one — it has just written it.
        if (Array.isArray(data.warnings)) {
          const fresh = new Map(data.warnings.map((x) => [`${x.questionId}|${x.id}`, x.cleared]));
          for (const other of warnings) {
            const state = fresh.get(`${other.questionId}|${other.id}`);
            if (state !== undefined) other.cleared = state;
          }
        } else {
          w.cleared = wanted;
        }
        draw();
      } catch (err) {
        button.disabled = false;
        alert(err.message);
      }
    });
    return li;
  };

  clearedToggle.addEventListener('click', () => { showCleared = !showCleared; draw(); });
  draw();
  return el;
}

export function renderQuizPreview(body, sub, quiz, markDirty = () => {}) {
  const all = quiz.rounds.flatMap((r) => r.questions);
  // A first-letter question has no options and no letter to lean on, so it is
  // left out of this entirely — counted in, it would water the lean down and
  // stop a genuinely lopsided pack being flagged.
  const lettered = all.filter((q) => (q.options || []).length);
  // Long enough for the widest round in the pack: four for most, six for a
  // pick-them-all round.
  const spread = new Array(Math.max(4, ...lettered.map((q) => q.options.length))).fill(0);
  // A pick-them-all question has several right answers, so it contributes to
  // several slots — otherwise the "answers land A x3 B x1" line would treat
  // one of them as the answer and call the round lopsided when it is not.
  for (const q of lettered) {
    const right = q.correctIndexes && q.correctIndexes.length ? q.correctIndexes : [q.correctIndex];
    for (const i of right) if (spread[i] !== undefined) spread[i]++;
  }
  // Four is the fewest that can lean; below that "A x1 B x0 — lopsided" is
  // just arithmetic being rude about a question that has to be somewhere.
  const lopsided = lettered.length >= 4 && spread.some((n) => n > lettered.length * 0.5);
  const noNotes = all.filter((q) => !q.answerNote).length;

  sub.innerHTML = `${all.length} questions across ${quiz.rounds.length} round${quiz.rounds.length === 1 ? '' : 's'}
    ${lettered.length ? `· answers land ${spread.map((n, i) => `${LETTERS[i]}&times;${n}`).join(' ')}` : ''}
    ${lopsided ? '<b style="color:var(--gold)"> — lopsided</b>' : ''}
    ${noNotes ? ` · ${noNotes} with no fact to read out` : ''}`;
  // Rearranging the options rewrites the pack, so it is the owner's — the
  // complaint about a lopsided quiz still shows, it just has nothing to press.
  if (can(FEATURES.CATALOGUE)) sub.appendChild(evenerButton(body, sub, quiz, markDirty, lopsided));

  const parts = [];

  // The questions most likely to cause an argument, listed first so they are
  // the ones you actually look at.
  // Real errors first: these stop the quiz being played and stop the editor
  // saving, so they come above the hunches and read differently. Without this
  // the only sign was an alert saying "Quiz is not valid" with no clue which
  // question was at fault.
  const problems = quiz.problems || [];
  if (problems.length) {
    parts.push(node(`
      <div class="pv-warn pv-broken">
        <b class="pv-warn-head">${problems.length} thing${problems.length === 1 ? '' : 's'} to fix before this can be played</b>
        <ul class="pv-flags">
          ${problems.map((p) => `<li class="pv-flag"><span class="pv-flag-text">${esc(p)}</span></li>`).join('')}
        </ul>
        <div class="tiny" style="margin-top:8px">Fix ${problems.length === 1 ? 'this' : 'these'} in the editor. Ticking the notes below still works meanwhile.</div>
      </div>`));
  }

  const warnings = quiz.reviewWarnings || [];
  if (warnings.length) parts.push(warningPanel(quiz, warnings));
  for (const round of quiz.rounds) {
    const head = node(`
      <div class="pv-round">
        <div class="pv-round-head">
          <input class="pv-round-name" value="${esc(round.title)}" title="Click to rename this round">
          <span class="tiny">${esc(ROUND_LABELS[round.type] || round.type)}${
            // Which effect the pictures use, because it is set in the editor
            // and there is otherwise nowhere that says so at a glance.
            round.type === 'image' ? ` · ${esc(REVEAL_LABELS[round.reveal || 'zoom'] || round.reveal)}` : ''}</span>
        </div>
        ${round.spotifyPlaylist ? `<a class="pv-playlist" href="${esc(round.spotifyPlaylist.url)}" target="_blank" rel="noopener">Spotify playlist for this round</a>` : ''}
      </div>`);
    head.querySelector('.pv-round-name').addEventListener('input', (e) => {
      round.title = e.target.value;
      markDirty();
    });
    parts.push(head);

    round.questions.forEach((q, i) => {
      parts.push(node(`
        <div class="pv-q">
          <div class="pv-prompt"><span class="pv-num">${i + 1}</span>${esc(q.prompt)}</div>
          ${pictureFor(round, q)}
          <div class="pv-opts">
            ${round.type === 'alphabet'
              // No options to read through — the whole answer key is the answer
              // and the letter it turns on, so show exactly that.
              ? `<div class="pv-opt right"><span class="pv-letter">${esc(firstLetter(q.answer) || '?')}</span>${esc(q.answer || '')}</div>`
              : (q.options || []).map((o, oi) => `
                  <div class="pv-opt ${(q.correctIndexes && q.correctIndexes.length ? q.correctIndexes : [q.correctIndex]).includes(oi) ? 'right' : ''}">
                    <span class="pv-letter">${LETTERS[oi]}</span>${esc(o)}
                  </div>`).join('')}
          </div>
          ${q.cue ? `<div class="pv-cue">Play: <b>${esc(q.cue.title)}</b> — ${esc(q.cue.artist)}${q.cue.hint ? ` · ${esc(q.cue.hint)}` : ''}</div>` : ''}
          ${q.answerNote ? `<div class="pv-note">${esc(q.answerNote)}</div>` : ''}
          ${q.note ? `<div class="pv-note">Your note: ${esc(q.note)}</div>` : ''}
        </div>`));
    });
  }
  body.replaceChildren(...parts);
}

/**
 * THE PICTURE, on the read-through.
 *
 * A picture round cannot be checked by reading it. The whole question is
 * "whose face is this", so four names with no face above them tells you
 * nothing about the only part that can be wrong — and the drawing is the half
 * made by a different supplier, costing money, that occasionally comes back as
 * somebody else entirely.
 *
 * **It does not try to say whether the picture is real or a placeholder**, and
 * that is deliberate rather than lazy: `/quiz-images/` falls back to an SVG of
 * the same name when the artwork has not been made, so the URL is identical
 * either way and any guess here would be a guess. The Pictures panel on the
 * pack card is where that question is answered properly — it counts them — and
 * a placeholder is obvious on sight anyway, being a lettered card rather than
 * a face.
 *
 * Small, with a link to the full size: judging a likeness at 120px is not
 * judging it.
 */
function pictureFor(round, q) {
  if (round.type !== 'image' || !q.image) return '';
  const src = `/quiz-images/${q.image}`;
  return `
    <div class="pv-pic">
      <a href="${esc(src)}" target="_blank" rel="noopener" title="Open it full size">
        <img class="pv-pic-img" src="${esc(src)}" alt="" loading="lazy"
          onerror="this.closest('.pv-pic').innerHTML='&lt;div class=&quot;pv-pic-none&quot;&gt;No picture for this one yet.&lt;/div&gt;'">
      </a>
    </div>`;
}

/**
 * The button that does something about a lopsided quiz.
 *
 * The read-through has always said "answers land A x15 B x10 — lopsided" and
 * then left you looking at it: the only way to move an answer was to open the
 * editor and retype four options in a different order, twenty times.
 *
 * It rearranges here and leaves Save lit rather than writing straight away, so
 * you can look at what it did, press it again if you do not like the look of
 * it, and close without saving if you would rather it had not.
 *
 * NOT while that quiz is live in front of a room. Saving a quiz reloads it in
 * the running game, so this would swap the options under sixty people who are
 * mid-question — the answer would still be right, but on a different letter to
 * the one on the projector when they read it. It is offered again the moment
 * the game is over.
 */
function evenerButton(body, sub, quiz, markDirty, lopsided) {
  const running = (library && library.running) || null;
  const live = running && running.game === 'quiz' && running.packId === quiz.id
    && running.phase !== 'lobby' && running.phase !== 'finished';

  if (live) {
    return node('<span class="pv-even off" title="Saving a quiz reloads it in the running game">Even out the answers — not while this one is live</span>');
  }

  const button = node(`<button class="pv-even ${lopsided ? 'urge' : ''}" type="button">Even out the answers</button>`);
  button.addEventListener('click', () => {
    const moved = balanceAnswers(quiz);
    if (!moved) {
      button.textContent = 'Nothing to move';
      return;
    }
    markDirty();
    renderQuizPreview(body, sub, quiz, markDirty);
    // Say what happened where the eye already is — the spread line one line up
    // has just changed, and this explains why.
    const again = sub.querySelector('.pv-even');
    if (again) again.textContent = `Moved ${moved} — press Save`;
  });
  return button;
}

export function renderBingoPreview(body, sub, pack, markDirty = () => {}) {
  const size = pack.cardSize || 4;
  sub.innerHTML = `${pack.tracks.length} tracks · ${size}&times;${size} card
    ${pack.spotifyPlaylist ? ` · <a href="${esc(pack.spotifyPlaylist.url)}" target="_blank" rel="noopener">Spotify playlist</a>` : ''}`;

  body.replaceChildren(node(`
    <div class="pv-tracks">
      ${pack.tracks.map((t, i) => `
        <div class="pv-track">
          <span class="pv-num">${i + 1}</span>
          <span class="pv-tt">${esc(t.title)}</span>
          <span class="pv-ta">${esc(t.artist || '')}</span>
        </div>`).join('')}
    </div>`));
}

/* =============================================================== PAST GIGS
 *
 * Everything you have run: the date, what you played, how many were in and the
 * photographs from that night.
 *
 * **It is a record of somebody's WORK rather than a feature of the game**, and
 * that is what it is for. A quizmaster pitching for a Thursday at a new venue
 * gets asked what they have done; one page with two years of nights, the packs
 * and the pictures answers it. Both halves were already being written down —
 * the archive when a game ends, the photos as they arrive — and neither was
 * being shown to anybody.
 *
 * **Read only, deliberately.** No bin, no download, no share sheet. Getting
 * pictures out and onto social media is the owner's own tab on the owner's own
 * page; a photo that should not be on the projector is binned from the control
 * view, with a mic in your hand, which is when that actually matters. This is
 * the shelf you look along.
 *
 * The photos come from the private repository through the server, one night at
 * a time and only when a night is opened — a page that fetched every picture of
 * every gig would be several hundred requests to draw a list of dates.
 */
/**
 * THE VENUES YOU PLAY, and what they put up.
 *
 * This is the invoice book's customer list seen from the gig-night side. One
 * record, edited in two places for two jobs: here it is the name and the
 * prizes, on the Invoices tab it is the address and the fee. Two lists of one
 * real-world thing would disagree within a month, which is why this is not a
 * store of its own.
 *
 * Deliberately small. Everything a venue needs for a NIGHT is the name and
 * what they are putting behind the bar — the postal address belongs on an
 * invoice and has no business on a page opened ten minutes before a quiz.
 */
