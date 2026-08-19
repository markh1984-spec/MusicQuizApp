/**
 * EDITING HAPPENS IN A POPOVER, AND THE DRAFT IS NEVER LOST.
 *
 * Asked for on 16 August 2026 against the Workshop bench: *"both of these
 * functions should open a popover where you can edit this — if you
 * accidentally click off or if there is a crash it should keep your work
 * saved to the latest version."*
 *
 * THE ONE DECISION IN IT IS WHAT "SAVED" MEANS. Saving to the PACK as you
 * type is the obvious reading and it is dangerous: `reloadPackEverywhere()`
 * pushes a saved pack into any game currently running it, so autosaving a
 * half-typed question would put it on a projector between rounds — rule 11
 * working exactly as designed, aimed at the wrong thing.
 *
 * So: a DRAFT kept in localStorage as you type, written to the pack only on
 * an explicit Save. Keyed PER PACK (`kind:id`), or switching packs and coming
 * back would hand you the wrong unsaved changes — which is worse than losing
 * them, because it looks like your work and you would save it.
 *
 * Closing costs nothing, deliberately no confirm: the draft is already on
 * disk (localStorage) the moment you typed it, so clicking off simply closes.
 * A confirm on every stray click is the control that trains people to
 * dismiss confirms — the same reasoning `preview()`'s guarded close exists
 * for, applied the other way once there is nothing left to lose.
 *
 * The editing UI itself — every round, every question — is shared with the
 * whole-page editor at `/editor`, in `pack-editor.js`, so there are not two
 * copies of it to keep in step.
 */

import { esc, node } from './client.js';
import { renderPack } from './pack-editor.js';
import { can, hostKey, keyed, load } from './console.js';
import { FEATURES } from './plans.js';

const DRAFT_KEY = (kind, id) => `musicquiz.packdraft.${kind}.${id}`;

function loadDraft(kind, id) {
  try {
    const raw = localStorage.getItem(DRAFT_KEY(kind, id));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveDraft(kind, id, quiz) {
  try {
    localStorage.setItem(DRAFT_KEY(kind, id), JSON.stringify({ quiz, at: Date.now() }));
  } catch { /* a full or blocked localStorage costs the draft, never the edit itself */ }
}

function clearDraft(kind, id) {
  try { localStorage.removeItem(DRAFT_KEY(kind, id)); } catch { /* nothing to clear, nothing to fail */ }
}

/** "3 minutes ago", roughly — this is a courtesy on a resume prompt, not a clock anybody relies on. */
function agoWords(at) {
  const mins = Math.round((Date.now() - at) / 60000);
  if (mins < 1) return 'moments ago';
  if (mins === 1) return 'a minute ago';
  if (mins < 60) return `${mins} minutes ago`;
  const hours = Math.round(mins / 60);
  return hours === 1 ? 'an hour ago' : `${hours} hours ago`;
}

export async function editPopover(kind, pack) {
  const overlay = node(`
    <div class="overlay">
      <div class="sheet sheet-editor">
        <div class="sheet-head">
          <div style="min-width:0;flex:1 1 auto">
            <input class="sheet-title" id="epTitle" value="${esc(pack.title)}" title="Click to rename">
            <div class="tiny" id="epSub">Loading…</div>
          </div>
          <div class="sheet-actions">
            <button class="role-make" id="epSave" hidden>Save</button>
            <button class="minor" id="epClose">Close</button>
          </div>
        </div>
        <div class="sheet-body" id="epBody"></div>
      </div>
    </div>`);
  document.body.appendChild(overlay);

  const onKey = (e) => {
    if (e.key === 'Escape') close();
    // Ctrl/Cmd-S saves, because everybody tries it — same as the whole-page editor.
    if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); if (!saveBtn.hidden) doSave(); }
  };
  const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); };
  overlay.querySelector('#epClose').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', onKey);

  const body = overlay.querySelector('#epBody');
  const sub = overlay.querySelector('#epSub');
  const saveBtn = overlay.querySelector('#epSave');
  const titleInput = overlay.querySelector('#epTitle');

  let ownPack = false;
  let problems = [];
  const catalogueWrite = can(FEATURES.CATALOGUE);
  const saveTo = () => (ownPack || !catalogueWrite) ? `/api/mine/${kind}` : `/api/${kind}/${encodeURIComponent(pack.id)}`;
  const saveMethod = () => (ownPack || !catalogueWrite) ? 'POST' : 'PUT';

  const ctx = {
    quiz: null,
    kind,
    problems: [],
    playState: {},
    change: (fn) => { fn(); markDirty(); },
    render: () => draw(),
  };

  function markDirty() {
    saveDraft(kind, pack.id, ctx.quiz);
    saveBtn.hidden = false;
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save';
    sub.textContent = 'Unsaved changes — kept here even if you close this or the page crashes.';
  }

  function draw() {
    const y = body.scrollTop;
    ctx.problems = problems;
    const parts = [];
    if (problems.length) {
      parts.push(node(`
        <div class="problems">
          <strong>${problems.length} thing${problems.length === 1 ? '' : 's'} to fix before this is playable:</strong>
          <ul>${problems.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
        </div>`));
    }
    body.replaceChildren(...parts);
    renderPack(ctx, body);
    body.scrollTop = y;
  }

  titleInput.addEventListener('input', () => {
    if (ctx.quiz) { ctx.quiz.title = titleInput.value; markDirty(); }
  });

  async function doSave() {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    try {
      const res = await fetch(keyed(saveTo()), {
        method: saveMethod(),
        headers: { 'Content-Type': 'application/json', 'X-Host-Key': hostKey },
        body: JSON.stringify(ctx.quiz),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // The server validates too, and the same "on screen right now" guard
        // editor.js has applies here — a pack playing to a room this second
        // asks rather than refuses.
        if (data.error === 'onScreenNow') {
          const live = data.live || {};
          const where = `round ${(live.roundIndex || 0) + 1}, question ${(live.questionIndex || 0) + 1}`;
          if (confirm(`That is the question on screen RIGHT NOW — ${where}, in front of a room playing it.\n\nSaving changes it mid-question, and the answer key with it.\n\nSave anyway?`)) {
            const retry = await fetch(keyed(saveTo()), {
              method: saveMethod(),
              headers: { 'Content-Type': 'application/json', 'X-Host-Key': hostKey },
              body: JSON.stringify({ ...ctx.quiz, confirmLive: true }),
            });
            const retryData = await retry.json().catch(() => ({}));
            if (!retry.ok) throw Object.assign(new Error(retryData.error || 'Could not save'), { data: retryData });
            return finishSave(retryData);
          }
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save';
          return;
        }
        throw Object.assign(new Error(data.error || 'Could not save'), { data });
      }
      finishSave(data);
    } catch (err) {
      if (err.data && err.data.problems) {
        problems = err.data.problems;
        draw();
        body.scrollTop = 0;
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
      } else {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
        alert(err.message);
      }
    }
  }

  function finishSave(data) {
    problems = [];
    clearDraft(kind, pack.id);
    saveBtn.hidden = true;
    sub.textContent = data.backedUp ? 'Saved and backed up.' : 'Saved here only — not backed up.';
    draw();
    load();
  }

  saveBtn.addEventListener('click', doSave);

  try {
    const res = await fetch(keyed(`/api/${kind}/${encodeURIComponent(pack.id)}`));
    if (!res.ok) throw new Error('Could not open it');
    const fresh = await res.json();
    ownPack = Boolean(fresh.mine);
    delete fresh.mine;

    const draft = loadDraft(kind, pack.id);
    if (draft && draft.quiz) {
      const resumeRow = node(`
        <div class="problems" style="border-color:var(--hot)">
          <strong>You have unsaved changes from ${esc(agoWords(draft.at))}.</strong>
          <div class="row" style="margin-top:8px;gap:8px">
            <button class="role-make" id="epResume">Continue editing that</button>
            <button class="minor" id="epFresh">Start fresh from the saved pack</button>
          </div>
        </div>`);
      body.replaceChildren(resumeRow);
      sub.textContent = 'Draft found — choose which one to open.';
      await new Promise((resolveChoice) => {
        resumeRow.querySelector('#epResume').addEventListener('click', () => {
          ctx.quiz = draft.quiz;
          titleInput.value = draft.quiz.title;
          markDirty();
          draw();
          resolveChoice();
        });
        resumeRow.querySelector('#epFresh').addEventListener('click', () => {
          clearDraft(kind, pack.id);
          ctx.quiz = fresh;
          sub.textContent = '';
          draw();
          resolveChoice();
        });
      });
    } else {
      ctx.quiz = fresh;
      sub.textContent = '';
      draw();
    }
  } catch (err) {
    sub.textContent = '';
    body.replaceChildren(node(`<div class="tiny" style="color:var(--bad)">${esc(err.message)}</div>`));
  }
}
