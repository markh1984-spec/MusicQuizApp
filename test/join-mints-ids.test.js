/**
 * THE SERVER MINTS PLAYER IDS. A PHONE NEVER CHOOSES ITS OWN.
 *
 * `Engine.join()` honours a supplied id for a NEW player — it has to, because
 * `seedCarriedPlayers()` re-seats a whole room across a part boundary under
 * the ids the phones already hold. But that door was open to the phones too:
 * `POST /api/join` with `playerId: "RoboRobCraftedId01"` and no token was
 * accepted, id and all (launch-path sweep, 23 September 2026). An id a phone
 * picks is an id a phone can pick AGAIN — a second tab, a second card on a
 * bingo night, a guessable handle where every honest one is sixteen random
 * bytes.
 *
 * So the door — `Session.joinPlayer()`, the one route a phone joins through —
 * strips an id that names nobody it knows. A phone that can prove who it is
 * keeps its id; a stranded one (a restart that lost the room) gets a fresh
 * one, which `silentRejoin()` has always coped with. Over real HTTP, on both
 * engines, because the route is shared and the fix is in one place.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { withServer } from './helpers/live-server.mjs';

const KEY = 'mint-ids-key';
const H = { 'Content-Type': 'application/json', 'X-Host-Key': KEY };
const CRAFTED = 'RoboRobCraftedId01';

test('A NEW JOIN GETS AN ID THE SERVER MINTED — never one the phone chose', async () => {
  await withServer(async (base) => {
    const join = (body) => fetch(`${base}/api/join`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }).then(async (r) => ({ status: r.status, body: await r.json() }));
    const state = (id) => fetch(`${base}/api/state?role=player&playerId=${encodeURIComponent(id)}`).then((r) => r.json());

    const crafted = await join({ name: 'Robo', playerId: CRAFTED });
    assert.equal(crafted.status, 200);
    assert.notEqual(crafted.body.id, CRAFTED, 'a phone picked its own player id and the server took it');
    assert.ok(crafted.body.token, 'and it still gets a token');
    assert.equal((await state(CRAFTED)).rejoin, true, 'the chosen id names nobody');

    // A phone that can prove who it is keeps its id.
    const back = await join({ name: 'Robo', playerId: crafted.body.id, token: crafted.body.token });
    assert.equal(back.body.id, crafted.body.id, 'an honest rejoin lost its seat');

    // A stranded id — one this server never issued, no matching token — is a
    // NEW player and gets a fresh id rather than the one it turned up with.
    const stranded = await join({ name: 'Ghost', playerId: `${crafted.body.id}x`, token: 'gone' });
    assert.equal(stranded.status, 200);
    assert.notEqual(stranded.body.id, `${crafted.body.id}x`);

    // And on a bingo night the same door, the same rule — one place, both engines.
    const lib = await fetch(`${base}/api/library`, { headers: H }).then((r) => r.json());
    const bingo = (lib.bingo || lib.bingoPacks || [])[0];
    const launched = await fetch(`${base}/api/host/launch`, {
      method: 'POST', headers: H, body: JSON.stringify({ game: 'bingo', packId: bingo.id, replace: true }),
    });
    assert.equal(launched.status, 200);
    const card = await join({ name: 'Dealer', playerId: CRAFTED });
    assert.notEqual(card.body.id, CRAFTED, 'a bingo card under an id the phone chose');
  }, { hostKey: KEY });
});
