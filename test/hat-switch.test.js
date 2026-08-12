/**
 * WHO SEES THE HAT SWITCH.
 *
 * Stated by the host as a hard rule: it is on every one of HIS accounts for
 * ever, and it must never appear on anybody else's. That second half is the
 * one worth a test — it is a leak, not a layout preference. A real quizmaster
 * who could see Owner | Quizmaster would be looking at a control that says
 * somebody else's account exists and is reachable from theirs.
 *
 * The refusals need no DOM: `hatSwitch` returns null before it builds
 * anything. The positive cases are checked in a browser (see the menu work),
 * because building the switch needs a document and stubbing one would be a
 * test of the stub.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

const { hatSwitch, menuRights } = await import('../public/assets/client.js');

const quizmaster = (extra = {}) => ({
  signedIn: true,
  account: { id: 'rob', role: 'quizmaster', entitlements: { features: ['quiz.run', 'bingo.run', 'packs.own'] } },
  actingAs: false,
  bootstrap: false,
  alsoSignedIn: null,
  ...extra,
});

test('a real quizmaster is never shown the hat switch', () => {
  assert.equal(hatSwitch(quizmaster()), null);
});

test('nor is somebody signed out, or a payload with nothing in it', () => {
  assert.equal(hatSwitch({ signedIn: false }), null);
  assert.equal(hatSwitch(null), null);
  assert.equal(hatSwitch({}), null);
});

test('nor a quizmaster whose payload claims a tier preview', () => {
  // `previewTier` and `tiers` are drawing hints. Neither is an identity, and
  // neither may conjure a switch onto an account that has nothing to switch to.
  assert.equal(hatSwitch(quizmaster({ previewTier: 'gold', tiers: [{ id: 'gold', label: 'Gold' }] })), null);
});

test('THE HOST KEY ALONE IS NOT AN OWNER', () => {
  // On the key the server answers as the bootstrap identity, whose role is
  // "quizmaster". Without an owner cookie underneath there is no second hat to
  // switch to, so the switch stays away — it appears only when the same
  // browser is also signed in as the owner. That ordering is load-bearing: it
  // is what stops the key becoming a way into an account.
  assert.equal(hatSwitch({ signedIn: true, bootstrap: true, account: { role: 'quizmaster' }, alsoSignedIn: null }), null);
  assert.equal(
    hatSwitch({ signedIn: true, bootstrap: true, account: { role: 'quizmaster' }, alsoSignedIn: { role: 'quizmaster' } }),
    null,
    'and a second quizmaster underneath is still not an owner',
  );
});

/* ------------------------------------------------------------------------
 * The MENU is the other half: general to every quizmaster, and it carries the
 * Owner door only for the owner — including while they are wearing the
 * quizmaster hat, which is the case that went missing.
 */

test('a quizmaster gets the menu, without the Owner door', () => {
  assert.deepEqual(menuRights(quizmaster()), {
    control: true, packs: true, acting: false, owner: false,
  });
});

test('THE OWNER KEEPS THE OWNER DOOR WHILE WEARING THE QUIZMASTER HAT', () => {
  // The whole point of the hat is that your role becomes quizmaster, so a
  // check on `role` alone hides the way back on the one account that needs it.
  const acting = quizmaster({ actingAs: true });
  assert.equal(menuRights(acting).owner, true);
  assert.equal(menuRights(acting).acting, true, 'and it knows to take the hat off on the way through');
  assert.equal(menuRights(acting).control, true, 'and can still run a night, because that is what the hat is for');
});

test('and on the host key, where the owner is the cookie underneath', () => {
  const keyed = { signedIn: true, bootstrap: true, account: { role: 'quizmaster', entitlements: { features: [] } }, alsoSignedIn: { role: 'owner' } };
  assert.equal(menuRights(keyed).owner, true);
});

test('an owner runs no nights, so the Control door is not theirs', () => {
  const owner = { signedIn: true, account: { role: 'owner', entitlements: { features: ['owner.catalogue'] } } };
  const rights = menuRights(owner);
  assert.equal(rights.owner, true);
  assert.equal(rights.packs, true);
  assert.equal(rights.control, false, 'a door that 403s is worse than no door');
});

/*
 * THE KEY TO PUT IN A LINK IS NOT THE KEY TO SEND, and getting those two the
 * wrong way round is silent.
 *
 * Links carry the key only when this visit arrived with one, so a REMEMBERED
 * key does not paint itself into the address bar. A REQUEST is the opposite:
 * the server has to be told who is asking, so it takes the real key, remembered
 * included. Sent with the link key, `/api/me` went out bare whenever the key
 * had been remembered rather than typed — the server answered "nobody is
 * signed in", and the menu collapsed to a single Console chip on the one page
 * you drive a gig from. Nothing errored; it just quietly stopped being a menu.
 */
test('the control view asks /api/me with the REAL key, not the link key', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../public/assets/host.js', import.meta.url), 'utf8');
  const call = src.slice(src.indexOf("fetch(hostKey ? `/api/me"), src.indexOf('.catch(', src.indexOf('/api/me')));
  assert.ok(call.includes('/api/me'), 'the control view still asks who it is');
  assert.ok(call.includes('hostKey'), '/api/me must be asked with hostKey — the remembered key counts');
  assert.ok(!call.includes('navKey'), 'navKey is for LINKS; sending it means asking as nobody');
});

test('a signed-out payload gets no doors at all', () => {
  assert.deepEqual(menuRights({ signedIn: false }), {
    control: false, packs: false, acting: false, owner: false,
  });
  assert.deepEqual(menuRights(null), { control: false, packs: false, acting: false, owner: false });
});
