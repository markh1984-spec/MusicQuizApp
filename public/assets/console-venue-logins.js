/**
 * GALLERY LOGINS ON A VENUE CARD — Community › Venues, under the photo frame.
 *
 * The host, 1 October 2026: Evie and Tabby at the Station Tap get *"their own
 * logins to be able to download photos … with the watermark"*, a username and
 * a password **he sets**, and they can change it. Their page is `/venue-photos`
 * and their book is `src/gallery-logins.js` — not the accounts book, so they
 * can reach nothing else.
 *
 * **ON COMMUNITY, BESIDE THE FRAME** — *everything to do with photos and
 * marketing belongs in community*. **ONLY ON THE HOST'S OWN ACCOUNT FOR NOW**
 * (*"just me for now"*): the server answers 403 to anybody else and the panel
 * takes itself off the card, so nobody sees a control that cannot work.
 *
 * A LEAF: it is handed an empty slot and fills it.
 */
import { esc, node, postJson } from './client.js';

export function venueLoginsInto(slot) {
  const venueId = slot.dataset.venue;
  (async () => {
    let got;
    try {
      const r = await fetch(`/api/venue-logins?venue=${encodeURIComponent(venueId)}`);
      if (r.status === 403) { slot.remove(); return; }
      got = await r.json();
    } catch {
      return;
    }
    paint(slot, venueId, got.logins || []);
  })();
}

function paint(slot, venueId, logins, said = '') {
  const address = `${location.origin}/venue-photos`;
  slot.replaceChildren(node(`
    <div class="venue-logins-in">
      <p><b>Gallery logins</b><br>
      <span class="tiny">Staff here sign in at <a href="${esc(address)}" target="_blank" rel="noopener">${esc(address)}</a>
        to save this pub's photos, square or Story, with your name on them. They see this pub's nights and
        nothing else, and can change their own password.</span></p>
      <div class="vl-list">${logins.length
    ? logins.map((l) => `<div class="vl-row" data-id="${esc(l.id)}"><span class="vl-name">${esc(l.username)}</span>
          <button class="minor danger vl-off" type="button">Remove</button></div>`).join('')
    : '<div class="tiny">No logins for this pub yet.</div>'}</div>
      <form class="vl-add">
        <input class="vl-user" type="text" placeholder="Username, e.g. Tabby" autocomplete="off" autocapitalize="none" maxlength="30" aria-label="Username">
        <input class="vl-pass" type="text" placeholder="Their password, 8 or more" autocomplete="off" autocapitalize="none" maxlength="200" aria-label="Their password">
        <button class="role-make" type="submit">Add login</button>
      </form>
      <div class="tiny vl-said" role="status">${esc(said)}</div>
    </div>`));

  const form = slot.querySelector('.vl-add');
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const btn = form.querySelector('button');
    btn.disabled = true;
    try {
      const done = await postJson('/api/venue-logins', {
        venueId,
        username: form.querySelector('.vl-user').value,
        password: form.querySelector('.vl-pass').value,
      });
      const list = await (await fetch(`/api/venue-logins?venue=${encodeURIComponent(venueId)}`)).json();
      paint(slot, venueId, list.logins || [], `Added ${done.login.username}.${done.backedUp ? '' : ' (Not backed up yet — it will be on the next change.)'}`);
    } catch (err) {
      slot.querySelector('.vl-said').textContent = err.message;
      btn.disabled = false;
    }
  });

  // Removing ends their sign-in everywhere, so it takes two presses.
  for (const off of slot.querySelectorAll('.vl-off')) {
    off.addEventListener('click', async () => {
      if (!off.dataset.armed) {
        off.dataset.armed = '1';
        off.textContent = 'Press again to remove';
        setTimeout(() => { delete off.dataset.armed; off.textContent = 'Remove'; }, 3000);
        return;
      }
      const id = off.closest('.vl-row').dataset.id;
      const name = off.closest('.vl-row').querySelector('.vl-name').textContent;
      try {
        await fetch(`/api/venue-logins/${encodeURIComponent(id)}`, { method: 'DELETE' }).then((r) => { if (!r.ok) throw new Error('That would not remove — try again.'); });
        paint(slot, venueId, logins.filter((l) => l.id !== id), `Removed ${name}. They are signed out.`);
      } catch (err) {
        slot.querySelector('.vl-said').textContent = err.message;
      }
    });
  }
}
