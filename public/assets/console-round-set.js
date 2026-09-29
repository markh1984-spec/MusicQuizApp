/**
 * "EACH ROUND" — a fold beside *What they win*: a round's own seconds, and a
 * picture round's reveal, for tonight.
 *
 * The host picked this on 29 September 2026 over a sheet on each tile: the
 * tiles already carry a grip, a name, a type line, a × and a dial, and a fold
 * shut by default costs nothing on a night nobody changes anything — which is
 * most of them (*"there should be defaults so you're only changing them if
 * you need to"*). **Shut it is the ledger** — it names only the rounds that
 * differ — **open it is the editor**, the prize table's own shape.
 *
 * **ITS OWN CLASSES FOR WHAT IT PRESSES** — `lb-rs-head` and `lb-rs-pick`,
 * never the prize table's `lb-pz-head`/`lb-pz-stage`: that table's listeners
 * are delegated on the whole bar and key on those two, so borrowing them would
 * open the prize table and write a round's clock into a prize's lines. The
 * LOOK is shared through the stylesheet's selector lists.
 *
 * A LEAF: it draws and it reports. The map lives on `night.roundSet` in
 * `console-tonight.js`, which owns it and the repaint.
 */
import { esc } from './client.js';
import { REVEAL_WORDS, ROUND_REVEALS, ROUND_SECONDS, roundKey } from './round-set.js';
import { roundTitle } from './pack-look.js';

/**
 * Tonight's quiz rounds in the order they are played, each with what it has
 * been set to and what it plays with nothing set.
 * @param {object[]} segments    `segmentsNow()` — the same list Launch sends
 * @param {object} set           `night.roundSet`
 * @param {function} packOf      id -> pack, library-wide
 * @param {number} nightSeconds  `night.questionSeconds`; 0 is the pack's own
 */
export function roundSetRows(segments, set, packOf, nightSeconds) {
  const rows = [];
  for (const seg of segments || []) {
    if (!seg || seg.kind !== 'quiz') continue;
    for (const entry of seg.order || []) {
      const pack = packOf(entry.packId) || {};
      const round = (pack.rounds || [])[entry.round] || {};
      const own = (set || {})[roundKey(entry.packId, entry.round)] || {};
      // What the round would play at with nothing set: a round authored with
      // its own clock keeps it over the night's (`Engine.questionSeconds()`).
      const base = Number(round.questionSeconds) || Number(nightSeconds) || Number(pack.questionSeconds) || 20;
      rows.push({
        key: roundKey(entry.packId, entry.round),
        n: rows.length + 1,
        name: roundTitle(round.title, Number(entry.round)),
        picture: round.type === 'image',
        seconds: Number(own.questionSeconds) || 0,
        reveal: own.reveal || '',
        secondsWord: round.questionSeconds ? `Pack's own (${base}s)` : `Night (${base}s)`,
        revealWord: `Pack's own (${REVEAL_WORDS[round.reveal] || 'Zoom'})`,
      });
    }
  }
  return rows;
}

/** Draw the fold into `box` — shut it is the ledger, open it is the editor. */
export function roundSetInto(box, rows, { open }) {
  if (!box) return;
  box.hidden = false;
  // PRESENT AND INERT with no quiz round in tonight, the reason on it — the
  // prize table's own rule, for the same reason: a control that appears out
  // of nothing moves Launch under the thumb.
  if (!rows.length) {
    box.innerHTML = `<button class="lb-rs-head" type="button" disabled aria-expanded="false">
      <span class="lb-pz-lab">Each round</span><span class="lb-pz-line tiny">Add a quiz round</span></button>`;
    return;
  }
  const differ = rows.filter((r) => r.seconds || r.reveal);
  const ledger = differ.length
    ? differ.map((r) => `<span class="lb-pz-line"><b>${r.n} ${esc(r.name)}</b>${
      r.seconds ? `<span class="lb-pz"><i>secs</i>${r.seconds}s</span>` : ''}${
      r.reveal ? `<span class="lb-pz"><i>reveal</i>${esc(REVEAL_WORDS[r.reveal] || r.reveal)}</span>` : ''}</span>`).join('')
    : '<span class="lb-pz-line"><span class="lb-pz lb-pz-none">every round as the night</span></span>';
  const pick = (what, r, word, choices, now) => `<select class="lb-rs-pick" data-key="${esc(r.key)}" data-what="${what}"
      aria-label="${esc(`${what === 'reveal' ? 'Reveal' : 'Seconds'} for round ${r.n}, ${r.name}`)}">
      <option value="">${esc(word)}</option>${choices.map(([value, label]) =>
        `<option value="${esc(String(value))}"${String(value) === String(now) ? ' selected' : ''}>${esc(label)}</option>`).join('')}
    </select>`;
  const table = rows.map((r) => `<div class="lb-pz-row">
      <span class="lb-pz-who">${r.n} ${esc(r.name)}</span>
      <label class="lb-pz-box"><span>Seconds</span>${pick('seconds', r, r.secondsWord, ROUND_SECONDS.map((s) => [s, `${s}s`]), r.seconds || '')}</label>
      ${r.picture ? `<label class="lb-pz-box"><span>Reveal</span>${pick('reveal', r, r.revealWord, ROUND_REVEALS.map((v) => [v, REVEAL_WORDS[v]]), r.reveal)}</label>` : ''}
    </div>`).join('');
  box.innerHTML = `
    <button class="lb-rs-head" type="button" aria-expanded="${open ? 'true' : 'false'}">
      <span class="lb-pz-lab">Each round</span>
      <span class="lb-pz-car" aria-hidden="true">${open ? '▴' : '▾'}</span>
      ${open ? '' : ledger}
    </button>
    ${open ? `<div class="lb-pz-panel">${table}
      <div class="tiny lb-pz-note">Nothing chosen plays the round as the night is set. Speed tops out at 200 points whatever the clock.</div>
    </div>` : ''}`;
}

/**
 * DELEGATED, BOUND ONCE on the bar — the fold is redrawn on every settings
 * change, so a listener per select would leak with the room.
 * **A CHOICE STORES AND REPAINTS NOTHING HERE** — the prize table's
 * load-bearing rule: a repaint on `change` can detach the control a
 * mousedown is on, and the browser then dispatches no click.
 */
export function bindRoundSet(el, { onToggle, onSet }) {
  el.addEventListener('click', (e) => {
    if (!e.target.closest('.lb-rs-head')) return;
    onToggle();
  });
  el.addEventListener('change', (e) => {
    const pick = e.target.closest('.lb-rs-pick');
    if (!pick) return;
    onSet(pick.dataset.key, pick.dataset.what, pick.value);
  });
}
