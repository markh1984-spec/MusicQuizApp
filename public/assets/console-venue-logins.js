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
import { STAFF_GAMES } from './staff-games.js';

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

/*
 * WHEN THEY ACTUALLY USE IT — the host, 2 October 2026: *"a little panel that
 * tells me when evie or tabby actually login."* The sign-in and the last time
 * the page was opened, which matters more: a session lasts thirty days.
 */
function when(iso) {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return '';
  const clock = t.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const day = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const ago = Math.round((day(new Date()) - day(t)) / 86_400_000);
  if (ago === 0) return `today ${clock}`;
  if (ago === 1) return `yesterday ${clock}`;
  return `${t.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}, ${clock}`;
}

function activity(l) {
  if (!l.lastSignIn) return 'Not signed in yet';
  const looked = l.lastSeen && l.lastSeen !== l.lastSignIn ? ` · last looked ${when(l.lastSeen)}` : '';
  return `Signed in ${when(l.lastSignIn)}${looked}`;
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
    ? logins.map((l) => `<div class="vl-row" data-id="${esc(l.id)}">
          <span class="vl-who"><span class="vl-name">${esc(l.username)}</span>
            <span class="tiny vl-when">${esc(activity(l))}</span></span>
          <span class="vl-acts"><select class="vl-game" aria-label="Game on ${esc(l.username)}'s page">
            <option value="">No game</option>${STAFF_GAMES.map((g) => `<option value="${g.id}"${l.game === g.id ? ' selected' : ''}>${esc(g.name)}</option>`).join('')}</select>
          <input class="vl-hero" type="text" maxlength="20" value="${esc(l.hero || '')}" placeholder="Character's name"
            aria-label="What ${esc(l.username)}'s character is called" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"
            ${l.game ? '' : 'disabled title="Pick a game first"'}>
          <button class="minor vl-new" type="button">New password</button>
          <button class="minor danger vl-off" type="button">Remove</button></span></div>`).join('')
    : '<div class="tiny">No logins for this pub yet.</div>'}</div>
      <form class="vl-add">
        <input class="vl-user" type="text" placeholder="Username, e.g. Tabby" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="30" aria-label="Username">
        <input class="vl-pass" type="text" placeholder="Their password, 8 or more" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="200" aria-label="Their password">
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

  // A NEW PASSWORD, set by the host — opens a box under the name.
  for (const btn of slot.querySelectorAll('.vl-new')) {
    btn.addEventListener('click', () => {
      const row = btn.closest('.vl-row');
      if (row.nextElementSibling && row.nextElementSibling.classList.contains('vl-set')) { row.nextElementSibling.remove(); return; }
      const name = row.querySelector('.vl-name').textContent;
      const box = node(`<form class="vl-add vl-set">
          <input type="text" placeholder="New password for ${esc(name)}, 8 or more" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="200" aria-label="New password for ${esc(name)}">
          <button class="minor" type="submit">Set it</button></form>`);
      box.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const said = slot.querySelector('.vl-said');
        try {
          const r = await fetch(`/api/venue-logins/${encodeURIComponent(row.dataset.id)}/password`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: box.querySelector('input').value }),
          });
          const got = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(got.error || 'That would not change — try again.');
          box.remove();
          said.textContent = `New password set for ${name}. They are signed out everywhere until they use it.`;
        } catch (err) {
          said.textContent = err.message;
        }
      });
      row.after(box);
      box.querySelector('input').focus();
    });
  }

  // A GAME ON ONE LOGIN — the host's gift, per person (`staff-games.js`).
  for (const pick of slot.querySelectorAll('.vl-game')) {
    pick.addEventListener('change', async () => {
      const row = pick.closest('.vl-row');
      const name = row.querySelector('.vl-name').textContent;
      const game = STAFF_GAMES.find((g) => g.id === pick.value);
      pick.disabled = true;
      try {
        const r = await fetch(`/api/venue-logins/${encodeURIComponent(row.dataset.id)}/game`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ game: pick.value }),
        });
        if (!r.ok) throw new Error('That would not change — try again.');
        const login = logins.find((l) => l.id === row.dataset.id);
        if (login) { if (game) login.game = game.id; else delete login.game; }
        paint(slot, venueId, logins, game ? `${name} has a Play ${game.name} button on their page now.` : `No game on ${name}'s page now.`);
      } catch (err) {
        pick.disabled = false;
        slot.querySelector('.vl-said').textContent = err.message;
      }
    });
  }

  // WHAT THEIR CHARACTER IS CALLED — kept exactly as typed ("StEvie"), which is
  // why the box takes no autocorrect: a phone would make it "Stevie".
  for (const box of slot.querySelectorAll('.vl-hero')) {
    box.addEventListener('change', async () => {
      const row = box.closest('.vl-row');
      const name = row.querySelector('.vl-name').textContent;
      try {
        const r = await fetch(`/api/venue-logins/${encodeURIComponent(row.dataset.id)}/game`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hero: box.value }),
        });
        const got = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(got.error || 'That would not change — try again.');
        const login = logins.find((l) => l.id === row.dataset.id);
        if (login) { if (got.hero) login.hero = got.hero; else delete login.hero; }
        paint(slot, venueId, logins, got.hero ? `${name}'s character is called ${got.hero}.` : `${name}'s character has no name now.`);
      } catch (err) {
        slot.querySelector('.vl-said').textContent = err.message;
      }
    });
  }

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
