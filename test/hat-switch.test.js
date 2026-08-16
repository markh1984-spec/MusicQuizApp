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

const { hatSwitch, menuRights, navMenu } = await import('../public/assets/client.js');

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
  // The door is the hat switch rather than a menu chip (below), but this is
  // what tells the rest of the topbar that there IS an owner underneath.
  const acting = quizmaster({ actingAs: true });
  assert.equal(menuRights(acting).owner, true);
  assert.equal(menuRights(acting).acting, true, 'and it knows the hat is already on');
  assert.equal(menuRights(acting).control, true, 'and can still run a night, because that is what the hat is for');
});

/*
 * THE MENU IS THE SAME FOR EVERYBODY — the host's own call, after seeing his
 * own console carry the word "Owner" twice on one bar: once as a menu chip and
 * once as half the hat switch four inches away.
 *
 * Two controls with one word on them is how you end up using the worse one out
 * of habit. The switch keeps it because it is the SIGN as well as the switch.
 * So the menu is now three doors that do not depend on who is reading it, and
 * this test fails if an Owner chip ever comes back for anybody.
 */
test('NO IDENTITY GETS AN OWNER DOOR ON THE MENU', () => {
  const everybody = {
    'a plain quizmaster': menuRights(quizmaster()),
    'the owner wearing the hat': menuRights(quizmaster({ actingAs: true })),
    'the owner as themselves': menuRights({ signedIn: true, account: { role: 'owner', entitlements: { features: ['owner.catalogue'] } } }),
    'the host key with an owner underneath': menuRights({ signedIn: true, bootstrap: true, account: { role: 'quizmaster', entitlements: { features: [] } }, alsoSignedIn: { role: 'owner' } }),
    'nobody at all': menuRights(null),
  };
  for (const [who, rights] of Object.entries(everybody)) {
    const html = navMenu(rights);
    assert.ok(!/>Owner</.test(html), `${who} must not be offered an Owner chip`);
    assert.ok(!html.includes('/owner'), `${who} must not be linked to the owner page from the menu`);
  }
});

test('and the doors are in the same order whoever is reading', () => {
  /*
   * THE DOORS ARE MOMENTS NOW, NOT TOOLS — Console · Workshop · Post gig,
   * ordered by the gig: during it, before it, after it. They replaced Console
   * · Control · Packs, which named the software's parts rather than the
   * quizmaster's evening.
   *
   * **My account is the fourth and it is deliberately outside that sequence**,
   * which is why it is on the end rather than in it: the first three are
   * moments of a night, and your calendar, your subscription, the shop and the
   * support box are not steps in an evening at all.
   *
   * The RULE being guarded is unchanged and is the one that matters: the same
   * doors in the same order whoever is reading, because a menu that reorders
   * itself is not a menu.
   */
  const DOORS = ['Console', 'Workshop', 'Post gig', 'My account'];
  const labels = (rights) => (navMenu(rights).match(/>([^<]+)</g) || []).map((s) => s.slice(1, -1));
  assert.deepEqual(labels(menuRights(quizmaster())), DOORS);
  assert.deepEqual(labels(menuRights(quizmaster({ actingAs: true }))), DOORS);
});

test('AN OWNER PRESSING CONSOLE PUTS THE QUIZMASTER HAT ON', () => {
  /*
   * Control used to carry this and Control is no longer a door — driving a
   * quiz is something you do DURING, so it lives inside Console now. The
   * behaviour had to move with it: an owner pressing the night door is asking
   * for their own console, and they have one, behind the hat. Making them find
   * the switch first is a step that exists only because of how the code is
   * arranged.
   *
   * If this ever stops holding, an owner presses Console and lands on a page
   * with nothing of theirs on it.
   */
  const html = navMenu(menuRights({ signedIn: true, tiers: ['bronze'], account: { role: 'owner', entitlements: { features: ['owner.catalogue'] } } }));
  assert.match(html, /href="\/console"[^>]*data-hat="on"/);
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
