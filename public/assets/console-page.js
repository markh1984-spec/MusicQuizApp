/**
 * YOUR PUBLIC PAGE — the address, and what a venue reads when they get there.
 *
 * ---
 *
 * The page itself has existed since 20 August 2026 and **nothing in the console
 * ever gave out its address** — a publish lamp on the Photos rail put nights up
 * and left the quizmaster to work out where they had gone. A shareable link
 * nobody can find is the arcade-board fault again: a gate that works perfectly
 * with no handle on it.
 *
 * **THE ADDRESS IS ON THE PAGE, so it can be read out, copied, or put in a
 * bio** — the same shape as *Your room* beside it, which prints the play URL
 * rather than only linking it. One is where the players go, the other is where
 * a landlord goes; that adjacency is the reason this sits on My account.
 *
 * **TWO FIELDS, AND NOTHING IS DERIVED.** Not their sign-in address and not the
 * email on their invoices: publishing either would put an address they gave the
 * APP onto a page they never asked to carry it. Silence is the default, and a
 * quizmaster who types nothing simply has a page of photographs and numbers.
 *
 * **IT ECHOES WHAT THE SERVER UNDERSTOOD**, which is the intro round's rule —
 * `bookingLink()` in `src/gallery-about.js` refuses anything that is not http(s)
 * or an email address, and an unreadable link would otherwise be stored,
 * accepted, and silently missing from a page nobody is looking at.
 *
 * **A SEAM, TAKEN RATHER THAN A RAISE ON THE LINE CAP** — `console-account.js`
 * was one line under its budget, and the choice at that point is to shave
 * somebody's reasoning off an unrelated paragraph or to take a seam out.
 * `console-warnings.js` faced this exactly and went the same way.
 *
 * **IT IS A LEAF, AND HANDED WHAT IT NEEDS.** No `console-state.js` and no
 * `console.js`: the account, the prefs and the two fetch helpers all arrive as
 * arguments, so nothing here can assign to an imported binding or drag another
 * page's boot code in behind it.
 */

import { esc, node } from './client.js';

/**
 * @param {object} me       the signed-in account, as `/api/me` sends it
 * @param {object} prefs    what was TYPED — `library.prefs`
 * @param {function} keyed  path -> path carrying the host key
 * @param {string} hostKey  the key header, for a bootstrap session
 * @param {function} onSaved called with the server's `{ prefs, booking }`
 * @returns {Node|null}     null on the owner hat, which has no page of its own
 */
export function pagePanel({ me, prefs = {}, keyed, hostKey, onSaved = () => {} }) {
  /*
   * **SILENT ON THE OWNER HAT**, like the referral panel: a public page belongs
   * to a quizmaster, and the owner has his own quizmaster hat for it — the
   * plain `/gallery` is that hat's page, so the address here would be wrong for
   * the one identity that has no page of its own.
   */
  if (!me || me.role === 'owner') return null;
  /*
   * WHICH ADDRESS, ANSWERED BY THE SERVER — `ownAddress`, the same fact
   * `galleryAddress()` leans on. The plain `/gallery` resolves to ONE room, so
   * only the account it resolves to may be given the short form; everybody
   * else gets `?q=`, which always works. An address that looks nicer and shows
   * a stranger somebody else's photographs is the worst kind of wrong.
   */
  const path = me.ownAddress ? '/gallery' : `/gallery?q=${encodeURIComponent(me.id)}`;
  const el = node(`
    <div class="panel">
      <h3>Your public page</h3>
      <div class="tiny">Your nights, your numbers, and how to book you. No login —
        it is the link for a bio or a cold email.</div>
      <div class="tiny" style="margin-top:8px">
        <b>${esc(location.host + path)}</b>
        <a href="${esc(path)}" target="_blank" rel="noopener">open it</a></div>
      <div class="book-fields">
        <label class="tiny">One line about you
          <input type="text" class="book-words" maxlength="160"
            placeholder="Quiz nights across Berkshire — always a full room"
            value="${esc(prefs.booking || '')}"></label>
        <label class="tiny">How they book you
          <input type="text" class="book-link"
            placeholder="you@example.com, or your website"
            value="${esc(prefs.bookingLink || '')}"></label>
      </div>
      <div class="row" style="margin-top:10px;gap:8px;align-items:center">
        <button class="minor book-save">Save</button>
        <span class="tiny book-said"></span>
      </div>
    </div>`);

  const said = el.querySelector('.book-said');
  /*
   * WHAT THE PAGE WILL SHOW, in the server's own words. A link it could not
   * read is named as such rather than left blank — the fields still hold what
   * was typed, so there is something to correct.
   */
  const echo = (booking) => {
    const typed = el.querySelector('.book-link').value.trim();
    const link = booking && booking.link;
    said.style.color = '';
    if (typed && !link) {
      said.style.color = 'var(--bad)';
      said.textContent = 'Saved, but that link is not one the page can use — an email address or a website.';
      return;
    }
    said.textContent = link ? `Saved. Your page links to ${link}` : 'Saved.';
  };

  el.querySelector('.book-save').addEventListener('click', async () => {
    const btn = el.querySelector('.book-save');
    btn.disabled = true;
    said.style.color = '';
    said.textContent = 'Saving…';
    try {
      const res = await fetch(keyed('/api/me/prefs'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Host-Key': hostKey },
        body: JSON.stringify({
          booking: el.querySelector('.book-words').value,
          bookingLink: el.querySelector('.book-link').value,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save that');
      // The caller owns the shared state — both halves, or the next render
      // draws the old words back out of a stale library.
      onSaved(data);
      echo(data.booking);
    } catch (err) {
      said.style.color = 'var(--bad)';
      said.textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  });
  return el;
}
