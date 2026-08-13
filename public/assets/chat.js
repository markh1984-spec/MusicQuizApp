/**
 * The chat sheet, on a player's phone. Online nights only.
 *
 * IT LIVES OUTSIDE THE BODY, like the camera button and for the same reason:
 * the body is thrown away and rebuilt on every phase change, and a sheet that
 * vanished every twenty seconds — taking the half-typed message with it —
 * would never get used twice.
 *
 * The rules about who may say what are the SERVER'S (see `src/chat.js`); this
 * mirrors them so the phone can say why a message will not go, rather than
 * letting somebody type a sentence and watch it bounce. The server is the gate
 * and this is the sign on it.
 */

import { esc, node, postJson, roomCode } from './client.js';

const MAIN = 'main';
const ORGANISERS = 'organisers';

/** The row of one-tap reactions, and what the main room runs on mid-question. */
const QUICK = ['😂', '😱', '🎉', '👏', '🤔', '😭', '🔥', '💀'];

const LABEL = {
  [MAIN]: 'Everyone',
  [ORGANISERS]: 'Organisers',
};
const roomLabel = (id) => LABEL[id] || (id.startsWith('team:') ? 'Your team' : id);

let open = false;
let room = MAIN;
const seen = new Map();    // roomId -> how many messages had been read
let lastState = null;
/*
 * WHO WE ARE, passed in rather than read off the state.
 *
 * The token is sent in exactly one place — that player's own join reply — and
 * is then held on the phone (rule 3). It is deliberately NOT in any state
 * payload, so this cannot pick it up from `s.you`: it has to be handed the
 * same `me` that answering uses.
 */
let me = null;

/** Every message we are allowed to see, oldest first. */
const messagesIn = (s, id) => (s.chat && s.chat[id]) || [];
const roomIds = (s) => Object.keys((s && s.chat) || {});

/** How many have arrived in rooms we are not looking at. */
function unread(s) {
  let n = 0;
  for (const id of roomIds(s)) {
    if (open && id === room) continue;
    n += Math.max(0, messagesIn(s, id).length - (seen.get(id) || 0));
  }
  return n;
}

/**
 * Emoji-only, mirrored from `isJustEmoji` on the server.
 *
 * Kept deliberately simple and generous: anything with a letter or a number in
 * it is words. The consequence of the two disagreeing is a message that looks
 * like it will send and does not, so the test is the same shape in both.
 */
const isJustEmoji = (text) => {
  const bare = String(text || '').replace(/\s/gu, '').replace(/[\u200d\ufe0e\ufe0f]/gu, '');
  return Boolean(bare) && !/[\p{L}\p{N}]/u.test(bare);
};

/** Is the clock running? Words are held back in the main room while it is. */
const questionLive = (s) => s.phase === 'question' && !(s.clock && s.clock.closed);
const gagged = (s) => questionLive(s) && room === MAIN;

// ---------------------------------------------------------------- the button

/**
 * The way in, beside the camera button.
 *
 * Unlike the camera, it stays up DURING a question — the whole point of the
 * main room mid-question is the groan when the picture goes up, and the
 * organisers' room is most needed exactly when something has gone wrong.
 */
export function paintChatButton(s, who) {
  lastState = s;
  me = who || me;
  const wanted = Boolean(s && s.online && s.you && roomIds(s).length);
  let btn = document.getElementById('chatBtn');
  if (!wanted) {
    if (btn) btn.remove();
    closeSheet();
    return;
  }
  if (!btn) {
    btn = node('<button class="chat-btn" id="chatBtn" title="Chat"><span class="chat-ic">💬</span><span class="chat-badge" hidden></span></button>');
    btn.addEventListener('click', () => (open ? closeSheet() : openSheet()));
    document.body.appendChild(btn);
  }
  const badge = btn.querySelector('.chat-badge');
  const n = unread(s);
  badge.hidden = !n;
  badge.textContent = n > 99 ? '99+' : String(n);
  if (open) redraw(s);
}

// ----------------------------------------------------------------- the sheet

function openSheet() {
  if (open) return;
  open = true;
  const el = node(`
    <div class="chat-sheet" id="chatSheet">
      <div class="chat-head">
        <div class="chat-tabs" id="chatTabs"></div>
        <button class="chat-x" id="chatX" aria-label="Close">✕</button>
      </div>
      <div class="chat-list" id="chatList"></div>
      <div class="chat-quick" id="chatQuick">
        ${QUICK.map((e) => `<button class="chat-emoji" data-e="${e}">${e}</button>`).join('')}
      </div>
      <form class="chat-say" id="chatSay">
        <input type="text" id="chatText" maxlength="240" autocomplete="off"
               enterkeyhint="send" placeholder="Say something">
        <button class="chat-send" type="submit">Send</button>
      </form>
      <div class="chat-why tiny" id="chatWhy" hidden></div>
    </div>`);
  document.body.appendChild(el);

  el.querySelector('#chatX').addEventListener('click', closeSheet);
  el.querySelector('#chatSay').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const input = el.querySelector('#chatText');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    send(text);
  });
  for (const b of el.querySelectorAll('.chat-emoji')) {
    b.addEventListener('click', () => send(b.dataset.e));
  }
  if (lastState) redraw(lastState);
}

function closeSheet() {
  open = false;
  document.getElementById('chatSheet')?.remove();
}

function redraw(s) {
  const sheet = document.getElementById('chatSheet');
  if (!sheet) return;
  const ids = roomIds(s);
  if (!ids.includes(room)) room = ids[0] || MAIN;

  // Tabs. One room means no tabs at all — a tab bar with one tab on it is a
  // control that cannot do anything, which is the fault this app keeps
  // recording.
  const tabs = sheet.querySelector('#chatTabs');
  tabs.innerHTML = ids.length > 1
    ? ids.map((id) => {
        const n = Math.max(0, messagesIn(s, id).length - (seen.get(id) || 0));
        return `<button class="chat-tab ${id === room ? 'here' : ''}" data-room="${esc(id)}">${esc(roomLabel(id))}${n && id !== room ? ` <span class="chat-dot">${n}</span>` : ''}</button>`;
      }).join('')
    : `<span class="chat-tab here">${esc(roomLabel(room))}</span>`;
  for (const t of tabs.querySelectorAll('.chat-tab[data-room]')) {
    t.addEventListener('click', () => { room = t.dataset.room; redraw(s); paintChatButton(s); });
  }

  // The messages. Only redrawn when the count changes, so a list somebody is
  // reading does not jump under their thumb on every state push — and during a
  // question there is one of those every time anybody answers.
  const list = sheet.querySelector('#chatList');
  const messages = messagesIn(s, room);
  if (list.dataset.count !== String(messages.length) || list.dataset.room !== room) {
    const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 40;
    list.dataset.count = String(messages.length);
    list.dataset.room = room;
    list.innerHTML = messages.length
      ? messages.map((m) => `
          <div class="chat-msg ${s.you && m.by === s.you.key ? 'mine' : ''}">
            <span class="chat-who">${esc(m.name)}</span>
            <span class="chat-text">${esc(m.text)}</span>
          </div>`).join('')
      : `<div class="chat-empty tiny">${room === ORGANISERS
          ? 'The back channel. Nobody playing can see this.'
          : 'Nothing yet. Say hello.'}</div>`;
    if (atBottom) list.scrollTop = list.scrollHeight;
  }
  seen.set(room, messages.length);

  /*
   * The one rule anybody notices, said plainly rather than enforced silently.
   *
   * A disabled box with no explanation reads as the app being broken; this
   * says what is happening and that it comes back, and the reactions stay live
   * so the room still makes a noise.
   */
  const why = sheet.querySelector('#chatWhy');
  const say = sheet.querySelector('#chatSay');
  const off = gagged(s);
  say.classList.toggle('off', off);
  sheet.querySelector('#chatText').disabled = off;
  sheet.querySelector('.chat-send').disabled = off;
  why.hidden = !off;
  why.textContent = 'Reactions only while a question is up — so nobody can post the answer. Words come back on the reveal.';
}

async function send(text) {
  if (!lastState || !me) return;
  if (gagged(lastState) && !isJustEmoji(text)) return;
  try {
    await postJson('/api/say', {
      playerId: me.id, token: me.token,
      room, text, joinCode: roomCode(),
    });
  } catch {
    // The state push is the source of truth. A message that did not land
    // simply never appears, which is the same as every other action here.
  }
}
