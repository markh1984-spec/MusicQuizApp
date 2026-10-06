/**
 * HOW TO PLAY — a short card across the top of a game (the host, 6 October
 * 2026: *"a brief explainer at the top… that doesn't get in the way of the
 * games itself"*).
 *
 * **IT CANNOT GET IN THE WAY, by construction:** it takes no taps
 * (`pointer-events: none`), so a tap aimed at the game lands on the game even
 * while the card is up. It fades on the first tap, or by itself after a few
 * seconds, and a **Rules** button in the top bar brings it back. Shared by the
 * staff games and the arcade's lobby games, so all seven say it the same way.
 */
import { esc, node } from './client.js';

const SHOWS_FOR_MS = 10_000;

export function rulesCard(sheet, lines, { title = 'How to play' } = {}) {
  const canvas = sheet.querySelector('.toy-canvas, .arcade-canvas');
  const card = node(`<div class="toy-rules" role="note" aria-label="${esc(title)}">
      <b>${esc(title)}</b><ul>${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul></div>`);
  const btn = node('<button class="gal-save toy-rules-btn" type="button" aria-expanded="true">Rules</button>');
  const top = sheet.querySelector('.toy-top');
  const close = top.querySelector('.toy-close');
  top.insertBefore(btn, close);
  sheet.appendChild(card);

  let timer = null;
  const place = () => { card.style.top = `${(canvas ? canvas.offsetTop : top.offsetHeight) + 8}px`; };
  const hide = () => {
    clearTimeout(timer);
    card.classList.add('gone');
    btn.setAttribute('aria-expanded', 'false');
  };
  const show = () => {
    place();
    card.classList.remove('gone');
    btn.setAttribute('aria-expanded', 'true');
    clearTimeout(timer);
    timer = setTimeout(hide, SHOWS_FOR_MS);
    // The next tap on the game puts it away — and still reaches the game.
    if (canvas) canvas.addEventListener('pointerdown', hide, { once: true });
  };
  btn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    if (card.classList.contains('gone')) show(); else hide();
  });
  requestAnimationFrame(show);
  return { show, hide };
}
