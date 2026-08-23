/**
 * A DROPDOWN THAT IS NARROW SHUT AND WIDE OPEN.
 *
 * ---
 *
 * Asked for on 23 August 2026, about the launch bar: *"the venue dropdown box
 * and all dropdown boxes on the bay must popover… 'look — the usual' needs to
 * only be as wide as the pre-filled value, popovers can pop out wider but we
 * need to save space."*
 *
 * That is the whole feature in one sentence, and a native `<select>` cannot do
 * it. A browser sizes the open list to the CONTROL, so a select narrow enough
 * to fit "The usual" opens a list that clips "Halloween — in season now". The
 * bar was paying for its longest option five times over, on every night,
 * whether or not anybody opened anything.
 *
 * ---
 *
 * **THE NATIVE `<select>` STAYS IN THE DOM AND STAYS THE TRUTH.** This draws a
 * button and a menu beside it and does nothing else: every `.value` read,
 * every `innerHTML = options(…)` rebuild and every `change` listener in the
 * console goes on working untouched, and the LAUNCH still reads exactly what
 * it always read.
 *
 * That is deliberate rather than lazy. This bar is the protected surface — the
 * path from "the room is sitting down" to "the quiz is running" — and swapping
 * five controls it reads for a hand-written component would put every one of
 * those reads at risk for a layout change. A skin over the real control cannot
 * lose a value, because it never holds one.
 *
 * **SO IT HAS TO BE REPAINTED WHEN THE SELECT CHANGES UNDERNEATH IT.** Code
 * elsewhere sets `.value` and rebuilds `.innerHTML` directly, and neither
 * fires an event — `refreshPicks()` is called wherever the settings are
 * repainted, which is the one seam they all already pass through.
 *
 * **A FACE SHOWS THE SHORT NAME, THE MENU SHOWS THE WHOLE THING.** An option
 * may carry `data-short`; without one the face uses the option's own text.
 * That split is what buys the space: "Maze Mouth" shut, "👻 Maze Mouth — a
 * maze chase" open.
 */

import { esc, node } from './client.js';

/** Every open menu shuts when anything else opens, or the bar fills with them. */
let openMenu = null;

function shut() {
  if (!openMenu) return;
  openMenu.menu.hidden = true;
  openMenu.face.setAttribute('aria-expanded', 'false');
  openMenu = null;
}

/*
 * ONE LISTENER FOR THE WHOLE PAGE, not one per picker. The bar is rebuilt on
 * every state push — which during a lobby is every time somebody joins — so a
 * listener added per picker per render is a leak that grows with the room.
 */
if (typeof document !== 'undefined' && !document.body?.dataset.pickWired) {
  if (document.body) document.body.dataset.pickWired = '1';
  document.addEventListener('click', (ev) => {
    if (openMenu && !openMenu.root.contains(ev.target)) shut();
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && openMenu) { openMenu.face.focus(); shut(); }
  });
}

/** What the closed button says for the option that is chosen. */
function faceWords(select) {
  const opt = select.options[select.selectedIndex];
  if (!opt) return '';
  return opt.dataset.short || opt.textContent.trim();
}

function paintOne(root) {
  const select = root.querySelector('select');
  const face = root.querySelector('.pick-face');
  const menu = root.querySelector('.pick-menu');
  if (!select || !face || !menu) return;
  face.querySelector('.pick-word').textContent = faceWords(select);
  face.disabled = select.disabled;
  menu.replaceChildren(...[...select.options].map((opt, at) => {
    const row = node(`
      <button class="pick-opt ${at === select.selectedIndex ? 'is-on' : ''}" type="button"
        role="option" aria-selected="${at === select.selectedIndex}"
        ${opt.disabled ? 'disabled' : ''}>${esc(opt.textContent.trim())}</button>`);
    row.addEventListener('click', () => {
      if (opt.disabled) return;
      select.value = opt.value;
      /*
       * A REAL `change`, because that is what every listener on this bar is
       * already waiting for. Setting `.value` from script fires nothing, so
       * without this the picker would look like it worked and the launch
       * would send the value from before.
       */
      select.dispatchEvent(new Event('change', { bubbles: true }));
      shut();
      paintOne(root);
      face.focus();
    });
    return row;
  }));
}

/**
 * Give one `<select>` a popover face. Idempotent — a second call repaints
 * rather than building a second one, because the bar re-renders constantly.
 */
function enhance(select) {
  if (select.closest('.pick')) { paintOne(select.closest('.pick')); return; }
  const root = node('<div class="pick"></div>');
  select.parentNode.insertBefore(root, select);
  root.appendChild(select);
  const face = node(`
    <button class="pick-face" type="button" aria-haspopup="listbox" aria-expanded="false">
      <span class="pick-word"></span>
      <span class="pick-caret" aria-hidden="true"></span>
    </button>`);
  const menu = node('<div class="pick-menu" role="listbox" hidden></div>');
  root.append(face, menu);
  face.addEventListener('click', (ev) => {
    ev.stopPropagation();
    const wasOpen = openMenu && openMenu.root === root;
    shut();
    if (wasOpen) return;
    menu.hidden = false;
    face.setAttribute('aria-expanded', 'true');
    openMenu = { root, face, menu };
    /*
     * WHICH WAY IT OPENS IS MEASURED, not assumed. The rightmost picker on
     * the bar is a few pixels from the edge of the panel, and a menu wider
     * than its button — which is the entire point of this — would otherwise
     * hang off the side of the console.
     */
    menu.classList.remove('to-left');
    const box = menu.getBoundingClientRect();
    if (box.right > document.documentElement.clientWidth - 8) menu.classList.add('to-left');
  });
  paintOne(root);
}

/**
 * Turn every `<select data-pop>` under `root` into one of these, and bring
 * any that already exist back into step with their select.
 */
export function refreshPicks(root) {
  if (!root) return;
  for (const select of root.querySelectorAll('select[data-pop]')) enhance(select);
}
