/**
 * A MISS NEVER SAYS WHERE THE SERVER KEEPS ITS FILES.
 *
 * `/api/images/<id>` passed `err.message` straight back on a pack that is not
 * there — an ENOENT carrying the server's absolute path, the third sighting of
 * that class; its two neighbours carry comments about it (Part C of the
 * September sweeps, #22).
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { withServer } from './helpers/live-server.mjs';

test('asking for the pictures of a pack that is not there says so, and nothing about the disk', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/images/no-such-pack-here?key=live-test-key`);
    assert.equal(res.status, 404);
    const { error } = await res.json();
    assert.doesNotMatch(error, /ENOENT|\/|\\\\/, `the reply named a path: ${error}`);
    assert.match(error, /pack/i);
  });
});
