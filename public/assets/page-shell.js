/**
 * THE SHELL OF THE PUBLIC PAGES — the brand in the header and, where a page
 * has one, the FAQ. It was an inline `<script type="module">` on five pages,
 * and the Content-Security-Policy on every document is `script-src 'self'`,
 * which an inline script is not (O25, 23 September 2026 sweep). One file, so
 * five copies cannot drift; a page says which FAQ it wants on the slot.
 */
import { brandMark } from './client.js';
import { faqHtml } from './faq.js';

const brand = document.getElementById('brandSlot');
if (brand) brand.innerHTML = `${brandMark(28)}<span class="brand-name">Quizporium</span>`;
const faq = document.getElementById('faqSlot');
if (faq) faq.innerHTML = faqHtml(faq.dataset.faq === 'home' ? { onlyHome: true } : {});
