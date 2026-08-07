/**
 * The owner console.
 *
 * Deliberately not the quiz console with extra buttons. This account runs no
 * nights — it manages the people who do, and writes the packs they buy. Keeping
 * it a separate page means the subscriber list can never be one mis-tap away
 * from the Next button during somebody's gig.
 */

import { esc, node, brandMark } from './client.js';
import { ADDONS, PLANS } from './plans.js';

const mainEl = document.getElementById('main');
const whoEl = document.getElementById('whoami');

let me = null;
let subscribers = [];

async function api(path, options) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 401) { location.href = '/login?next=/owner'; throw new Error('Sign in'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

async function boot() {
  const who = await api('/api/me');
  if (!who.signedIn) { location.href = '/login?next=/owner'; return; }
  me = who.account;

  const brand = await api('/api/brand');
  document.getElementById('brandSlot').innerHTML =
    `${brandMark(26)}<span class="brand-name">${esc(brand.name)}</span>`;
  whoEl.textContent = me.role === 'owner' ? `Owner — ${me.email}` : `Signed in as ${me.email}`;

  if (me.role !== 'owner') {
    mainEl.replaceChildren(node(`
      <div class="problems">
        <strong>This is the owner console.</strong>
        Your account runs quiz nights — <a href="/console">that way</a>.
      </div>`));
    return;
  }
  await load();
}

async function load() {
  const data = await api('/api/owner/accounts');
  subscribers = data.accounts || [];
  draw(data);
}

function draw(data) {
  const parts = [];

  if (!data.backupReady) {
    parts.push(node(`
      <div class="pv-warn pv-broken" style="margin-bottom:14px">
        <b class="pv-warn-head">Accounts are not being backed up</b>
        <div class="tiny" style="margin-top:6px">
          This server has no permanent disk, so every account and every password
          disappears on the next redeploy. Set <b>PHOTO_REPO</b> to a <b>private</b>
          repository on Render. It has to be private: this file holds email
          addresses and password hashes.
        </div>
      </div>`));
  }

  parts.push(node(`
    <div class="game-section">
      <div class="game-head">
        <div>
          <h2>Quizmasters</h2>
          <div class="tiny">${subscribers.length} account${subscribers.length === 1 ? '' : 's'} ·
            ${subscribers.filter((a) => a.status === 'active' || a.status === 'trialing').length} paying ·
            ${subscribers.filter((a) => a.comped).length} comped</div>
        </div>
        <div class="row"><button class="go add">Add a quizmaster</button></div>
      </div>
      <div class="subs"></div>
    </div>`));

  const list = parts[parts.length - 1].querySelector('.subs');
  if (!subscribers.length) {
    list.appendChild(node('<div class="tiny">Nobody yet. Your own quizmaster account goes here too.</div>'));
  }
  for (const account of subscribers) list.appendChild(subscriberRow(account));
  parts[parts.length - 1].querySelector('.add').addEventListener('click', addSubscriber);

  mainEl.replaceChildren(...parts);
}

const STATUS_LABEL = {
  trialing: 'Trial', active: 'Paying', past_due: 'Payment failed', cancelled: 'Closed',
};

function subscriberRow(account) {
  const row = node(`
    <div class="inv-row status-${account.status === 'active' || account.status === 'trialing' ? 'paid' : ''}">
      <div class="inv-main">
        <div class="inv-top">
          <b>${esc(account.name || account.email)}</b>
          <span class="inv-who">${esc(account.email)}</span>
          <span class="inv-status">${esc(account.comped ? 'Comped' : STATUS_LABEL[account.status] || account.status)}</span>
          ${account.supportOpen ? '<span class="inv-status" style="background:rgba(255,210,63,.2);color:var(--gold)">Support open</span>' : ''}
        </div>
        <div class="tiny">
          ${esc(PLANS.basic.label)}${account.addons.length ? ' + ' + account.addons.map((a) => esc(ADDONS[a] ? ADDONS[a].label : a)).join(' + ') : ''}
        </div>
      </div>
      <div class="inv-actions">
        ${Object.values(ADDONS).map((a) => `
          <button class="minor addon ${account.addons.includes(a.id) ? 'on' : ''}" data-addon="${a.id}"
                  title="${esc(a.blurb)}">${esc(a.label)}</button>`).join('')}
        <button class="minor comp">${account.comped ? 'Charge them' : 'Comp'}</button>
        <button class="minor danger close">Close</button>
      </div>
    </div>`);

  const save = async (patch) => {
    try {
      const data = await api(`/api/owner/accounts/${encodeURIComponent(account.id)}`, {
        method: 'PUT', body: JSON.stringify(patch),
      });
      subscribers = data.accounts;
      draw({ accounts: subscribers, backupReady: true });
    } catch (err) {
      alert(err.message);
    }
  };

  for (const button of row.querySelectorAll('.addon')) {
    button.addEventListener('click', () => {
      const id = button.dataset.addon;
      const addons = account.addons.includes(id)
        ? account.addons.filter((a) => a !== id)
        : [...account.addons, id];
      save({ addons });
    });
  }
  row.querySelector('.comp').addEventListener('click', () => save({ comped: !account.comped }));
  row.querySelector('.close').addEventListener('click', async () => {
    if (!confirm(`Close ${account.email}?\n\nThey are signed out and cannot run a night. Nothing is deleted — their packs and invoices are kept in case they come back.`)) return;
    try {
      const data = await api(`/api/owner/accounts/${encodeURIComponent(account.id)}`, { method: 'DELETE' });
      subscribers = data.accounts;
      draw({ accounts: subscribers, backupReady: true });
    } catch (err) {
      alert(err.message);
    }
  });
  return row;
}

async function addSubscriber() {
  const email = prompt('Their email address?');
  if (!email) return;
  const name = prompt('Their name?') || '';
  // Suggested rather than demanded: a password you invent for somebody is one
  // they will write down, so make it a decent one and let them change it.
  const suggested = suggestPassword();
  const password = prompt(`First password?\n\nThey can change it once they are in.`, suggested);
  if (!password) return;
  try {
    const data = await api('/api/owner/accounts', {
      method: 'POST',
      body: JSON.stringify({ email, name, password, status: 'trialing' }),
    });
    subscribers = data.accounts;
    draw({ accounts: subscribers, backupReady: data.backedUp });
    alert(`Done.\n\nSend them:\n\n  ${location.origin}/login\n  ${email}\n  ${password}\n\nThis password is not stored anywhere you can read it again, so copy it now.`);
  } catch (err) {
    alert(err.message);
  }
}

/** Four ordinary words. Long, memorable, and nothing to write on a laptop lid. */
function suggestPassword() {
  const words = ['amber', 'jukebox', 'marble', 'thistle', 'rocket', 'velvet', 'harbour', 'copper',
    'meadow', 'lantern', 'compass', 'walnut', 'ribbon', 'anchor', 'saffron', 'pebble'];
  const pick = () => words[Math.floor(Math.random() * words.length)];
  return `${pick()}-${pick()}-${pick()}-${pick()}`;
}

boot().catch((err) => {
  mainEl.replaceChildren(node(`<div class="problems"><strong>Could not load:</strong> ${esc(err.message)}</div>`));
});
