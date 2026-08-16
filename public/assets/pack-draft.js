/**
 * WHAT SOMEBODY HAS TYPED INTO A PACK AND NOT SAVED YET, kept on the device.
 *
 * Asked for on 16 August 2026 against the Workshop bench: *"if you accidentally
 * click off or if there is a crash it should keep your work saved to the latest
 * version."*
 *
 * **THE ONE DECISION IN IT IS WHAT "SAVED" MEANS, and only one answer is safe.**
 * Autosaving to the PACK is the obvious reading and it is dangerous:
 * `reloadPackEverywhere()` in `server.js` pushes a saved pack into any game
 * currently running it, on purpose, because that is how a correction reaches a
 * quiz already on question four. So a half-typed question would land on a
 * projector between rounds — rule 11 working exactly as designed, aimed at the
 * wrong thing. **Nothing in this file touches a pack.** `save()` in
 * `editor.js` is the only thing that ever does, and only when somebody presses
 * a button.
 *
 * **KEYED PER PACK, NEVER ONE SCRATCH SLOT.** Editing the 80s quiz, switching
 * to Motown and coming back must not hand you the wrong unsaved changes — that
 * is a WORSE failure than losing them, because it looks like your work and you
 * would save it over the top of the real pack.
 *
 * **ITS OWN FILE BECAUSE TWO THINGS READ IT.** `editor.js` writes drafts and
 * offers them back; `console.js` asks whether the pack on the bench has one, so
 * the bench can say "you were part way through this" without pulling the whole
 * editor in on every console load. One definition of the key, in the same shape
 * as `show-parts.js` and `pack-look.js` — a shared reader rather than two
 * places agreeing about a string.
 */

const PREFIX = 'musicquiz.draft.';
/** Old enough that nobody is coming back to it, and the space is worth having. */
const KEEP_DAYS = 30;

/** The one place the shape of a draft key is decided. */
export const draftKeyFor = (kind, id) => `${PREFIX}${kind}.${id}`;

/**
 * The draft for one pack, or null.
 *
 * `{ v, at, kind, pack }`. Anything that will not parse, or that holds no pack,
 * is treated as nothing there — a corrupt draft must not be able to stop the
 * editor opening the real pack.
 */
export function readDraft(kind, id) {
  try {
    const raw = localStorage.getItem(draftKeyFor(kind, id));
    if (!raw) return null;
    const held = JSON.parse(raw);
    return held && held.pack && held.pack.id ? held : null;
  } catch { return null; }
}

/**
 * Keep one. Returns false when the browser refused — which the caller has to
 * SAY rather than swallow, because a promise to keep somebody's writing that
 * is quietly not being kept is the whole failure this feature exists to
 * prevent.
 */
export function writeDraft(kind, pack, at = Date.now()) {
  try {
    localStorage.setItem(draftKeyFor(kind, pack.id), JSON.stringify({ v: 1, at, kind, pack }));
    return true;
  } catch { return false; }
}

export function forgetDraft(kind, id) {
  try { localStorage.removeItem(draftKeyFor(kind, id)); } catch { /* nothing to remove */ }
}

/**
 * Drop drafts nobody is coming back to.
 *
 * A pack is tens of kilobytes and a browser's store is a few megabytes, so a
 * year of abandoned drafts would eventually be the thing that stops a real one
 * being written. Cheap, and only run when the editor is mounted.
 */
export function pruneDrafts(now = Date.now()) {
  const cutoff = now - KEEP_DAYS * 86400000;
  try {
    const stale = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(PREFIX)) continue;
      let at = 0;
      try { at = JSON.parse(localStorage.getItem(key) || '{}').at || 0; } catch { at = 0; }
      if (at < cutoff) stale.push(key);
    }
    for (const key of stale) localStorage.removeItem(key);
    return stale.length;
  } catch { return 0; }
}
