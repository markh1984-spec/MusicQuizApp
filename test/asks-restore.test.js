/**
 * WHAT THE ROOM ASKED FOR COMES BACK FROM THE BACKUP — every field of it.
 *
 * `backUpAsks()` pushed each room's `room-asks.json` to the private repo and
 * nothing ever read it again: on an empty disk the Quiz requests tab was
 * blank, and a vote the room cast last Thursday was gone with nothing said.
 * A yellow of the 23 September 2026 launch-path sweep, and the same half-
 * built mechanism the accounts and the invoice book once were.
 *
 * Restored ONCE per room per boot, only into an EMPTY store, like the others
 * — and the rows are taken WHOLE. The whitelist trap this repo has recorded
 * six times is a restore that names fields: a field added later is read
 * back, dropped, and saved as dropped on every deploy. So a row here carries
 * a field nobody has invented yet, and it has to survive the round trip.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { onAnEmptyDisk, readJson, writeJson } from './helpers/empty-disk.mjs';

const ASKS = {
  asks: [
    { id: 'a1', ideaId: 'reggae', text: 'A reggae round', by: 'p1', name: 'Table One', night: '2026-09-17', venue: 'The Crown', at: 1700000000001, kept: false, extra: 'a field from the future' },
    { id: 'a2', text: 'Motown', by: 'p2', name: 'Table Two', night: '2026-09-17', venue: 'The Crown', at: 1700000000002, kept: true, keptAt: 1700000000003 },
  ],
};

test('a room\'s asks come back on an empty disk, whole, before the tab reads them', async () => {
  await onAnEmptyDisk(async ({ data, roomId, get }) => {
    const asks = await (await get('/api/asks')).json();
    assert.ok((asks.asked || []).some((g) => g.text === 'A reggae round'), `the pending ask did not come back: ${JSON.stringify(asks)}`);
    assert.ok((asks.kept || []).some((g) => g.text === 'Motown'), `the kept ask did not come back: ${JSON.stringify(asks)}`);
    const onDisk = readJson(path.join(data, 'rooms', roomId, 'room-asks.json'));
    const row = ((onDisk && onDisk.asks) || []).find((a) => a.id === 'a1');
    assert.ok(row, 'the restored file is not where the room reads it');
    assert.equal(row.extra, 'a field from the future', 'the restore names fields and dropped one — the whitelist trap');
    assert.deepEqual(onDisk.asks, ASKS.asks, 'the rows did not survive the round trip whole');
  }, {
    seedRepo: (repo, roomId) => writeJson(path.join(repo, 'rooms', roomId, 'room-asks.json'), ASKS),
  });
});
