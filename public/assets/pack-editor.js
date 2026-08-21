/**
 * The pack-editing render tree — every round, every question, every field.
 *
 * Split out of `editor.js` on 19 August 2026 so the same code could be reused
 * by a popover editor on the console, without a second copy that could drift
 * from the one people actually rely on. Nothing here changed in behaviour —
 * every function moved with its body untouched, only its data source did:
 * where it used to read and write module-level `quiz`/`kind`/`problems` and
 * call bare `render()`/`change()`, it now takes a `ctx` object carrying the
 * same things, so two callers (a whole page, a popover) can each hold their
 * own state without colliding.
 *
 * `ctx` shape:
 *   { quiz, kind, problems, playState, change(fn), render() }
 * `quiz`/`problems`/`playState` are read fresh off `ctx` on every call rather
 * than captured once, so a caller can replace `ctx.quiz` (loading a different
 * pack, or swapping in a restored draft) without this module needing to know.
 */

import { esc, node, gripIcon, dragRow, moveWithin } from './client.js';
import { cueOffsetSays } from './cue.js';

export const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
export const ROUND_TYPES = [
  ['text', 'Text — general knowledge'],
  ['image', 'Picture — whose face is this?'],
  ['intro', 'Intro — you play the track'],
  ['multi', 'Pick them all — several right answers'],
  ['alphabet', 'First letter — they get a keyboard'],
  ['breakout', 'Breakout — a laugh, nothing scored'],
];

/**
 * How a picture question gives itself away.
 *
 * `mix` rotates through the four by position, so a round of ten is not ten of
 * the same effect. They all run on the same curve, so which one you pick does
 * not change how many points are on offer — see REVEAL_MODES in
 * `src/quizzes.js` before changing that.
 */
export const REVEALS = [
  ['zoom', 'Zoom out — pulls back from a close crop'],
  ['pixelate', 'Pixelate — resolves out of big blocks'],
  ['blur', 'Blur — comes into focus'],
  ['tiles', 'Tiles — panels come away a few at a time'],
  ['mix', 'Mix — a different one each question'],
];

/** Is this the question a room is looking at this second? */
function isLive(ctx, ri, qi) {
  const live = ctx.playState && ctx.playState.live;
  return Boolean(live && live.roundIndex === ri && live.questionIndex === qi);
}

// ------------------------------------------------------------ bingo packs

/*
 * NO LOOK CONTROL IN EITHER HEADER, ANY MORE — asked for directly, on 21
 * August 2026: the editor's copy only ever set a fallback default, and
 * Tonight's own Look picker already fully overrides it at launch every time
 * (`console-tonight.js`, `.look-pick` in `tonightSettingsPanel()`) — the same
 * pattern prizes already use, and it never needed a second control in the
 * pack editor either. Two controls for one field is how a night gets
 * launched with the setting the other one was showing, which is the exact
 * fault Tonight itself was built to close. The pack keeps whatever `look` it
 * already has on disk; nothing here ever writes to it again.
 */

export function bingoHeader(ctx) {
  const quiz = ctx.quiz;
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

  el.querySelector('#bTitle').addEventListener('input', (e) => ctx.change(() => { ctx.quiz.title = e.target.value; }));
  el.querySelector('#bSubtitle').addEventListener('input', (e) => ctx.change(() => { ctx.quiz.subtitle = e.target.value; }));
  el.querySelector('#bSize').addEventListener('change', (e) => ctx.change(() => { ctx.quiz.cardSize = Number(e.target.value); ctx.render(); }));
  return el;
}

/**
 * The track list. A ${n}×${n} card needs at least n² tracks and really wants
 * half again, so the count is shown against what the card size demands rather
 * than left for you to work out.
 */
export function trackListBlock(ctx) {
  const quiz = ctx.quiz;
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

    row.querySelector('.ttitle').addEventListener('input', (e) => ctx.change(() => { track.title = e.target.value; }));
    row.querySelector('.tartist').addEventListener('input', (e) => ctx.change(() => { track.artist = e.target.value; }));
    row.querySelector('.up').addEventListener('click', () => ctx.change(() => { swap(quiz.tracks, i, i - 1); ctx.render(); }));
    row.querySelector('.down').addEventListener('click', () => ctx.change(() => { swap(quiz.tracks, i, i + 1); ctx.render(); }));
    row.querySelector('.del').addEventListener('click', () => ctx.change(() => { quiz.tracks.splice(i, 1); ctx.render(); }));
    list.appendChild(row);
  });

  el.querySelector('#addTrack').addEventListener('click', () => ctx.change(() => {
    quiz.tracks.push({ id: 't' + (quiz.tracks.length + 1), title: '', artist: '' });
    ctx.render();
  }));
  return el;
}

export function quizHeader(ctx) {
  const quiz = ctx.quiz;
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

  el.querySelector('#quizTitle').addEventListener('input', (e) => ctx.change(() => { ctx.quiz.title = e.target.value; }));
  el.querySelector('#quizSubtitle').addEventListener('input', (e) => ctx.change(() => { ctx.quiz.subtitle = e.target.value; }));
  el.querySelector('#quizSeconds').addEventListener('input', (e) => ctx.change(() => { ctx.quiz.questionSeconds = Number(e.target.value) || 20; }));
  return el;
}

/**
 * DRAG AND DROP, on the console's own terms.
 *
 * The host drives this from the laptop that is plugged into the projector, so
 * a mouse is the input this has to serve. The arrow buttons STAY: HTML5 drag
 * events do not fire on touch at all, and a control that simply does not
 * exist on a phone is worse than one that is merely slower.
 */
export function roundBlock(ctx, round, ri) {
  const quiz = ctx.quiz;
  const el = node(`
    <div class="round-block">
      <div class="round-head">
        <span class="drag-grip" draggable="true" title="Drag to move this round">${gripIcon()}</span>
        <span class="type-tag">Round ${ri + 1}</span>
        <input class="title" value="${esc(round.title)}" placeholder="Round title">
        <select class="rtype">
          ${ROUND_TYPES.map(([v, label]) => `<option value="${v}" ${round.type === v ? 'selected' : ''}>${esc(label)}</option>`).join('')}
        </select>
        ${round.type === 'image' ? `
          <select class="rreveal" title="How every picture in this round gives itself away. A question can override it.">
            ${REVEALS.map(([v, label]) => `<option value="${v}" ${(round.reveal || 'zoom') === v ? 'selected' : ''}>${esc(label)}</option>`).join('')}
          </select>` : ''}
        <button class="small danger delete-round">Delete round</button>
      </div>
    </div>`);

  el.querySelector('.title').addEventListener('input', (e) => ctx.change(() => { round.title = e.target.value; }));
  el.querySelector('.rreveal')?.addEventListener('change', (e) => ctx.change(() => {
    round.reveal = e.target.value;
    ctx.render();
  }));
  el.querySelector('.rtype').addEventListener('change', (e) => ctx.change(() => {
    round.type = e.target.value;
    // Switching to or from pick-them-all changes how many options a question
    // has, so the questions have to be reshaped rather than left at four with
    // two boxes missing. Nothing typed is thrown away — going the other way
    // just stops showing E and F, and they come back if you switch back.
    for (const q of round.questions) reshapeForType(q, round.type);
    ctx.render();
  }));
  el.querySelector('.delete-round').addEventListener('click', () => {
    if (confirm(`Delete "${round.title}" and all ${round.questions.length} of its questions?`)) {
      ctx.change(() => { quiz.rounds.splice(ri, 1); ctx.render(); });
    }
  });

  /*
   * A ROUND takes another ROUND. A question dropped on a round's head lands at
   * the END of it, which is what makes moving a question between rounds
   * possible at all — an empty round has no question to aim at.
   *
   * THE HEAD IS THE TARGET, not the whole block — a round block is mostly
   * question cards, and those reject a round being dropped on them.
   */
  dragRow(el.querySelector('.round-head'), { kind: 'round', ri },
    (from) => from.kind === 'round' || from.kind === 'question',
    (from, to, above) => ctx.change(() => {
      if (from.kind === 'round') {
        if (from.ri === to.ri) return;
        moveWithin(quiz.rounds, from.ri, to.ri, above);
      } else {
        const source = quiz.rounds[from.ri];
        const [q] = source.questions.splice(from.qi, 1);
        const target = quiz.rounds[to.ri];
        reshapeForType(q, target.type);
        target.questions.push(q);
      }
      ctx.render();
    }));

  round.questions.forEach((q, qi) => el.appendChild(questionCard(ctx, round, q, ri, qi)));

  const add = node('<div class="qcard" style="border-radius:0 0 14px 14px"><button class="small">Add a question to this round</button></div>');
  add.querySelector('button').addEventListener('click', () => ctx.change(() => {
    round.questions.push(blankQuestion(round.type, `${round.id}q${round.questions.length + 1}`));
    ctx.render();
  }));
  el.appendChild(add);
  return el;
}

export function questionCard(ctx, round, q, ri, qi) {
  const quiz = ctx.quiz;
  const problems = ctx.problems || [];
  const flagged = problems.some((p) => p.startsWith(`Round ${ri + 1} question ${qi + 1}:`));
  /*
   * ON A SCREEN, RIGHT NOW. The one place red is right here: changing this
   * question changes it in front of a room mid-clock, and the answer key with
   * it. Every other question in the pack is safe to correct.
   */
  const onScreen = isLive(ctx, ri, qi);
  const el = node(`
    <div class="qcard ${flagged ? 'flagged' : ''} ${onScreen ? 'on-screen-now' : ''}">
      ${onScreen ? '<div class="on-screen-flag">On a screen right now — a room is looking at this</div>' : ''}
      <div class="qtop">
        <span class="drag-grip" draggable="true" title="Drag to move this question">${gripIcon()}</span>
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

  el.querySelector('.prompt').addEventListener('input', (e) => ctx.change(() => { q.prompt = e.target.value; }));
  el.querySelector('.answerNote').addEventListener('input', (e) => ctx.change(() => { q.answerNote = e.target.value; }));
  el.querySelector('.note').addEventListener('input', (e) => ctx.change(() => { q.note = e.target.value; }));

  dragRow(el, { kind: 'question', ri, qi }, (from) => from.kind === 'question',
    (from, to, above) => ctx.change(() => {
      const source = quiz.rounds[from.ri];
      const target = quiz.rounds[to.ri];
      if (from.ri === to.ri) {
        if (from.qi === to.qi) return;
        moveWithin(source.questions, from.qi, to.qi, above);
      } else {
        const [moved] = source.questions.splice(from.qi, 1);
        reshapeForType(moved, target.type);
        target.questions.splice(to.qi + (above ? 0 : 1), 0, moved);
      }
      ctx.render();
    }));

  el.querySelector('.up').addEventListener('click', () => ctx.change(() => { swap(round.questions, qi, qi - 1); ctx.render(); }));
  el.querySelector('.down').addEventListener('click', () => ctx.change(() => { swap(round.questions, qi, qi + 1); ctx.render(); }));
  el.querySelector('.dup').addEventListener('click', () => ctx.change(() => {
    round.questions.splice(qi + 1, 0, { ...structuredClone(q), id: q.id + '-copy' });
    ctx.render();
  }));
  el.querySelector('.del').addEventListener('click', () => {
    if (confirm('Delete this question?')) ctx.change(() => { round.questions.splice(qi, 1); ctx.render(); });
  });

  const opts = el.querySelector('.opts');

  /*
   * The first-letter round has no options at all — one answer, written out the
   * way it will be read aloud, and the letter follows from it.
   */
  if (round.type === 'alphabet') {
    const letterOf = (a) => (String(a || '').trim().match(/[a-z]/i) || [''])[0].toUpperCase();
    const article = /^(the|a|an)\s+/i;
    const row = node(`
      <div class="opt-row is-correct">
        <label class="alpha-letter">${esc(letterOf(q.answer) || '?')}</label>
        <input type="text" value="${esc(q.answer || '')}" placeholder="The answer, in full — the host reads this out">
      </div>
      `);
    const warn = node(`<div class="tiny" style="margin-top:6px"></div>`);
    const sayLetter = () => {
      const answer = String(q.answer || '').trim();
      row.querySelector('.alpha-letter').textContent = letterOf(answer) || '?';
      warn.style.color = '';
      if (!answer) warn.textContent = 'No answer yet, so there is no letter to be right about.';
      else if (!letterOf(answer)) { warn.style.color = 'var(--bad)'; warn.textContent = 'That does not start with a letter.'; }
      else if (article.test(answer)) {
        warn.style.color = 'var(--bad)';
        warn.textContent = `Drop the "${answer.split(/\s+/)[0]}" — half the room would press ${letterOf(answer)} and half ${letterOf(answer.replace(article, ''))}, and both would be right.`;
      } else warn.textContent = `They have to press ${letterOf(answer)}. Spelling does not count.`;
    };
    row.querySelector('input').addEventListener('input', (e) => ctx.change(() => {
      q.answer = e.target.value;
      sayLetter();
    }));
    sayLetter();
    opts.append(row, warn);
    return el;
  }

  /*
   * A breakout question is a prompt and nothing else — there is no answer to
   * check against, which is the whole point of the round. See TODO.md,
   * "BREAKOUT GAMES".
   */
  if (round.type === 'breakout') {
    opts.append(node(`<div class="tiny" style="opacity:.7">No right answer — the room types whatever they like and you read the funny ones out.</div>`));
    return el;
  }

  const isMulti = round.type === 'multi';
  const count = isMulti ? 6 : 4;
  if (isMulti && !Array.isArray(q.correctIndexes)) q.correctIndexes = [];

  const isRight = (i) => (isMulti ? q.correctIndexes.includes(i) : q.correctIndex === i);

  for (let i = 0; i < count; i++) {
    const row = node(`
      <div class="opt-row ${isRight(i) ? 'is-correct' : ''}">
        <label>
          <input type="${isMulti ? 'checkbox' : 'radio'}" name="correct-${ri}-${qi}" ${isRight(i) ? 'checked' : ''}>
          ${LETTERS[i]}
        </label>
        <input type="text" value="${esc(q.options[i] ?? '')}" placeholder="Option ${LETTERS[i]}">
      </div>`);
    row.querySelector('input[type="radio"], input[type="checkbox"]').addEventListener('change', (e) => ctx.change(() => {
      if (!isMulti) {
        q.correctIndex = i;
      } else if (e.target.checked) {
        q.correctIndexes = [...new Set([...q.correctIndexes, i])].sort((a, b) => a - b);
      } else {
        q.correctIndexes = q.correctIndexes.filter((n) => n !== i);
      }
      ctx.render();
    }));
    row.querySelector('input[type="text"]').addEventListener('input', (e) => ctx.change(() => {
      q.options[i] = e.target.value;
    }));
    opts.appendChild(row);
  }

  if (isMulti) {
    const n = q.correctIndexes.length;
    opts.appendChild(node(`<div class="tiny" style="margin-top:6px;color:${n >= 2 ? 'var(--ink-dim)' : 'var(--bad)'}">
      ${n < 2 ? 'Tick at least two — that is what makes it a pick-them-all question.' : `The room is told to lock in ${n}.`}
    </div>`));
  }

  const extras = el.querySelector('.extras');
  if (round.type === 'image') extras.appendChild(imageFields(ctx, q, round));
  if (round.type === 'intro') extras.appendChild(cueFields(ctx, q));

  return el;
}

export function imageFields(ctx, q, round) {
  const inherited = REVEALS.find(([v]) => v === (round.reveal || 'zoom'));
  const effective = q.reveal || round.reveal || 'zoom';
  const zooms = effective === 'zoom' || effective === 'mix';
  const el = node(`
    <div class="extra-fields" style="margin-top:11px">
      <label>Image file (in /images)
        <input type="text" class="image" value="${esc(q.image || '')}" placeholder="eighties/madonna.png">
      </label>
      <label>How it gives itself away
        <select class="reveal">
          <option value="">Whatever the round says — ${esc((inherited ? inherited[1] : 'zoom').split(' — ')[0])}</option>
          ${REVEALS.filter(([v]) => v !== 'mix').map(([v, label]) => `<option value="${v}" ${q.reveal === v ? 'selected' : ''}>${esc(label)}</option>`).join('')}
        </select>
      </label>
      ${zooms ? `<label>Starting zoom
        <input type="number" class="zoomFrom" min="1" max="12" step="0.5" value="${q.zoomFrom ?? 6}">
      </label>` : ''}
      <label>Prompt for the image generator
        <input type="text" class="imagePrompt" value="${esc(q.imagePrompt || '')}" placeholder="Optional — used by generate-images.mjs">
      </label>
    </div>`);
  el.querySelector('.image').addEventListener('input', (e) => ctx.change(() => { q.image = e.target.value; }));
  el.querySelector('.reveal').addEventListener('change', (e) => ctx.change(() => {
    if (e.target.value) q.reveal = e.target.value;
    else delete q.reveal;
    ctx.render();
  }));
  el.querySelector('.zoomFrom')?.addEventListener('input', (e) => ctx.change(() => { q.zoomFrom = Number(e.target.value); }));
  el.querySelector('.imagePrompt').addEventListener('input', (e) => ctx.change(() => { q.imagePrompt = e.target.value; }));
  return el;
}

/*
 * "Skip the dead air" is a SCORING control. The clock starts with the
 * question, so two seconds of fade-in costs the whole room two seconds of
 * score on a question they may well have known. See cue.js.
 */
export function cueFields(ctx, q) {
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
      <label>Skip the dead air
        <input type="text" class="cfrom" value="${esc(q.cue.from || '')}" placeholder="0:00">
        <span class="tiny cfrom-says">${esc(cueOffsetSays(q.cue.from))}</span>
      </label>
      <label>How to play it
        <input type="text" class="chint" value="${esc(q.cue.hint || '')}" placeholder="Let the intro run about 8 seconds">
      </label>
    </div>`);
  el.querySelector('.ctitle').addEventListener('input', (e) => ctx.change(() => { q.cue.title = e.target.value; }));
  el.querySelector('.cartist').addEventListener('input', (e) => ctx.change(() => { q.cue.artist = e.target.value; }));
  el.querySelector('.cfrom').addEventListener('input', (e) => ctx.change(() => {
    q.cue.from = e.target.value;
    // Repainted in place rather than by re-rendering the question: this fires
    // on every keystroke, and a render would take the focus out of the box.
    el.querySelector('.cfrom-says').textContent = cueOffsetSays(q.cue.from);
  }));
  el.querySelector('.chint').addEventListener('input', (e) => ctx.change(() => { q.cue.hint = e.target.value; }));
  return el;
}

/**
 * Make an existing question fit a round type it has just been moved into.
 * Deliberately additive: switching away keeps what was typed, so switching
 * back restores it.
 */
export function reshapeForType(q, type) {
  if (type === 'alphabet') {
    if (!q.answer) q.answer = (q.options || [])[q.correctIndex] || '';
    return;
  }
  // Nothing to reshape — a breakout question is just the prompt every round
  // type already has, and there is no answer key to build one out of.
  if (type === 'breakout') return;
  if (!Array.isArray(q.options)) q.options = [];
  if (type === 'multi') {
    while (q.options.length < 6) q.options.push('');
    if (!Array.isArray(q.correctIndexes) || !q.correctIndexes.length) {
      q.correctIndexes = Number.isInteger(q.correctIndex) ? [q.correctIndex] : [];
    }
  } else if (Array.isArray(q.correctIndexes) && q.correctIndexes.length) {
    const first = q.correctIndexes.find((i) => i < 4);
    if (first !== undefined) q.correctIndex = first;
  }
}

export function blankQuestion(type, id) {
  if (type === 'alphabet') return { id, prompt: '', answer: '' };
  if (type === 'breakout') return { id, prompt: '' };
  if (type === 'multi') {
    return { id, prompt: '', options: ['', '', '', '', '', ''], correctIndex: 0, correctIndexes: [] };
  }
  const q = { id, prompt: '', options: ['', '', '', ''], correctIndex: 0 };
  if (type === 'image') q.image = '';
  if (type === 'intro') q.cue = { title: '', artist: '', from: '', hint: '' };
  return q;
}

export function swap(list, a, b) {
  if (b < 0 || b >= list.length) return;
  [list[a], list[b]] = [list[b], list[a]];
}

/**
 * Everything above the round list — the pack's own header — plus every round
 * in it, appended to `into`. The "Add a round" button included. This is the
 * one entry point both editor.js and the popover call.
 */
export function renderPack(ctx, into) {
  const quiz = ctx.quiz;
  if (ctx.kind === 'bingo') {
    into.appendChild(bingoHeader(ctx));
    into.appendChild(trackListBlock(ctx));
    return;
  }
  into.appendChild(quizHeader(ctx));
  quiz.rounds.forEach((round, ri) => into.appendChild(roundBlock(ctx, round, ri)));

  const addRound = node('<button style="margin-top:8px">Add a round</button>');
  addRound.addEventListener('click', () => ctx.change(() => {
    quiz.rounds.push({
      id: 'r' + (quiz.rounds.length + 1),
      type: 'text',
      title: `Round ${quiz.rounds.length + 1}`,
      blurb: '',
      questions: [blankQuestion('text', `r${quiz.rounds.length + 1}q1`)],
    });
    ctx.render();
  }));
  into.appendChild(addRound);
}
