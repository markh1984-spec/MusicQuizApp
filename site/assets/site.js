/**
 * The only script on the site: draw the logo.
 *
 * `brandmark.js` is a COPY of the app's, and `test/brandmark.test.js` fails if
 * the two ever stop being byte-identical. Two copies of a logo is one that
 * gets changed in one place and not the other — the same rule that already
 * keeps the page and the favicon in step. It is copied rather than fetched
 * from the app because this site is deployed somewhere else on purpose: it
 * must not go blank, or slow, because a free-tier instance is asleep.
 */

import { quizMark } from './brandmark.js';

for (const slot of document.querySelectorAll('[data-mark]')) {
  const size = Number(slot.getAttribute('data-mark')) || 30;
  slot.innerHTML = quizMark({ size, id: `m${Math.random().toString(36).slice(2, 8)}` });
}
