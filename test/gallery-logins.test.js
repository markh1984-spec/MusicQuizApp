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
