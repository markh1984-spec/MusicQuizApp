/**
 * GALLERY LOGINS — `src/gallery-logins.js`. A pub's staff, one book of their
 * own, a username and a password the quizmaster sets.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GalleryLogins, cleanUsername } from '../src/gallery-logins.js';

const book = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gallery-logins-'));
  return { b: new GalleryLogins(path.join(dir, 'gallery-logins.json')), dir };
};
const PUB = { roomId: 'room-1', venueId: 'v-tap', venue: 'The Station Tap, Wokingham' };

test('a login is a username and a password, and signs in with either case of the name', async () => {
  const { b } = book();
  const made = b.create({ ...PUB, username: 'Tabby', password: 'a long enough one' });
  assert.equal(made.username, 'Tabby');
  assert.equal(made.hash, undefined, 'the hash never leaves');
  const s = await b.signIn('tabby', 'a long enough one');
  assert.ok(s && s.token);
  assert.equal(b.who(s.token).venue, PUB.venue);
  assert.equal(await b.signIn('Tabby', 'the wrong one'), null);
  assert.equal(await b.signIn('Nobody', 'a long enough one'), null);
});

test('the book is written to disk and read back, and a session is stored only as a fingerprint', async () => {
  const { b } = book();
  b.create({ ...PUB, username: 'Evie', password: 'a long enough one' });
  const s = await b.signIn('Evie', 'a long enough one');
  const raw = fs.readFileSync(b.file, 'utf8');
  assert.ok(!raw.includes(s.token), 'the token itself is not on disk');
  assert.ok(!raw.includes('a long enough one'));
  const again = new GalleryLogins(b.file);
  assert.equal(again.who(s.token).username, 'Evie');
});

test('usernames are unique, sensible and never an email', () => {
  const { b } = book();
  b.create({ ...PUB, username: 'Tabby', password: 'a long enough one' });
  assert.throws(() => b.create({ ...PUB, username: 'TABBY', password: 'another long one' }), /already a login called/);
  assert.throws(() => cleanUsername('tabby@pub.com'), /letters, numbers/);
  assert.throws(() => cleanUsername('T'), /2 to 30/);
  assert.equal(cleanUsername('  Evie  W '), 'Evie W');
  assert.throws(() => b.create({ ...PUB, username: 'Shorty', password: 'short' }), /at least 8/);
});

test('changing a password needs the current one, and signs every OTHER session out', async () => {
  const { b } = book();
  b.create({ ...PUB, username: 'Tabby', password: 'the first password' });
  const phone = await b.signIn('Tabby', 'the first password');
  const laptop = await b.signIn('Tabby', 'the first password');
  await assert.rejects(() => b.changePassword(phone.token, 'not it', 'the second password'), /current password/);
  await b.changePassword(phone.token, 'the first password', 'the second password');
  assert.ok(b.who(phone.token), 'the one that changed it stays in');
  assert.equal(b.who(laptop.token), null, 'everywhere else is signed out');
  assert.equal(await b.signIn('Tabby', 'the first password'), null);
  assert.ok(await b.signIn('Tabby', 'the second password'));
});

test('removing a login ends its sessions, and only the room that made it can', async () => {
  const { b } = book();
  const made = b.create({ ...PUB, username: 'Evie', password: 'a long enough one' });
  const s = await b.signIn('Evie', 'a long enough one');
  assert.equal(b.remove(made.id, 'somebody-else'), false);
  assert.ok(b.who(s.token));
  assert.equal(b.remove(made.id, PUB.roomId), true);
  assert.equal(b.who(s.token), null);
});

test('a backup only ever restores into an empty book', () => {
  const { b } = book();
  const text = (() => { const o = book().b; o.create({ ...PUB, username: 'Evie', password: 'a long enough one' }); return o.serialise(); })();
  assert.equal(b.restore(text).ok, true);
  assert.equal(b.list(PUB.roomId).length, 1);
  b.create({ ...PUB, username: 'Tabby', password: 'a long enough one' });
  assert.equal(b.restore(text).ok, false, 'a book with logins in it wins over the backup');
});

test('a sign-in and a visit are written down, a visit at most every ten minutes', async () => {
  let now = Date.parse('2026-10-02T14:00:00Z');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gallery-logins-'));
  const b = new GalleryLogins(path.join(dir, 'g.json'), { now: () => now });
  const made = b.create({ ...PUB, username: 'Tabby', password: 'a long enough one' });
  assert.equal(made.lastSignIn, undefined, 'never signed in yet');
  const s = await b.signIn('Tabby', 'a long enough one');
  assert.equal(b.list(PUB.roomId)[0].lastSignIn, '2026-10-02T14:00:00.000Z');
  now += 5 * 60_000;
  assert.equal(b.seen(b.who(s.token)), false, 'five minutes on is not written');
  now += 6 * 60_000;
  assert.equal(b.seen(b.who(s.token)), true);
  assert.equal(b.list(PUB.roomId)[0].lastSeen, '2026-10-02T14:11:00.000Z');
  assert.equal(b.list(PUB.roomId)[0].hash, undefined);
});

test('the quizmaster sets a new password, and whoever had the old one is out', async () => {
  const { b } = book();
  const made = b.create({ ...PUB, username: 'Tabby', password: 'the first password' });
  const s = await b.signIn('Tabby', 'the first password');
  assert.equal(b.setPassword(made.id, 'somebody-else', 'the second password'), false);
  assert.throws(() => b.setPassword(made.id, PUB.roomId, 'short'), /at least 8/);
  assert.equal(b.setPassword(made.id, PUB.roomId, 'the second password'), true);
  assert.equal(b.who(s.token), null, 'signed out everywhere');
  assert.equal(await b.signIn('Tabby', 'the first password'), null);
  assert.ok(await b.signIn('Tabby', 'the second password'));
});

test('a game is chosen per login, by the room that made it, and absent unless chosen', () => {
  const { b } = book();
  const evie = b.create({ ...PUB, username: 'Evie', password: 'a long enough one' });
  const tabby = b.create({ ...PUB, username: 'Tabby', password: 'a long enough one' });
  assert.equal(evie.game, undefined);
  assert.equal(b.setGame(evie.id, 'another-room', 'blockyard'), false, 'another room cannot reach her');
  assert.ok(b.setGame(evie.id, PUB.roomId, 'blockyard'));
  assert.ok(b.setGame(tabby.id, PUB.roomId, 'walkies'));
  const list = b.list(PUB.roomId);
  assert.equal(list.find((l) => l.id === evie.id).game, 'blockyard');
  assert.equal(list.find((l) => l.id === tabby.id).game, 'walkies');
  assert.throws(() => b.setGame(evie.id, PUB.roomId, 'space-invaders'), /no game called that/);
  assert.equal(b.find(evie.id).game, 'blockyard', 'a refused id changes nothing');
  assert.equal(new GalleryLogins(b.file).find(tabby.id).game, 'walkies', 'kept on disk');
  assert.ok(b.setGame(evie.id, PUB.roomId, ''));
  assert.equal('game' in b.find(evie.id), false, 'none is absent, not empty');
});

test('a character\'s name is kept exactly as typed, capitals and all, and nonsense is refused', () => {
  const { b } = book();
  const evie = b.create({ ...PUB, username: 'Evie', password: 'a long enough one' });
  assert.ok(b.setHero(evie.id, PUB.roomId, '  StEvie  '));
  assert.equal(b.list(PUB.roomId)[0].hero, 'StEvie', 'the capital E survives');
  assert.throws(() => b.setHero(evie.id, PUB.roomId, '<script>'), /letters, numbers/);
  assert.throws(() => b.setHero(evie.id, PUB.roomId, 'x'.repeat(21)), /20 characters/);
  assert.equal(b.setHero(evie.id, 'another-room', 'Nope'), false);
  assert.ok(b.setHero(evie.id, PUB.roomId, ''));
  assert.equal('hero' in b.find(evie.id), false);
});
