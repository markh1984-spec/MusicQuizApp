/**
 * A BACKUP THAT GOES LATE AND THEN FAILS IS SAID OUT LOUD — and one that goes
 * late and then lands stays silent.
 *
 * `within()` stops a request waiting for its backup after `BACKUP_WAIT_MS` and
 * answers `{ late: true }`; `saidSo()` rightly stays quiet on that, because the
 * write is still running and usually lands. But nobody looked at the original
 * promise again: a write that went late at three seconds and then FAILED was
 * never reported, so during a GitHub hang no failed night, venue or login
 * backup reached the Help tab — O21 of the 23 September 2026 launch-path
 * sweep, and the exact silence `saidSo()` was written to end.
 *
 * The stub is slowed past the budget so every write is late (a local write is
 * instant and the timeout branch would never run), and the first server's
 * stub refuses writes as well. The line looked for names the INVOICE BOOK:
 * the join-code book is pushed without `within()` and is said either way.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { onAnEmptyDisk, wait } from './helpers/empty-disk.mjs';

const SLOW = { BACKUP_WAIT_MS: '20', GH_STUB_DELAY_MS: '60' };

async function saveAVenueAndReadTheRecorder({ post, get }) {
  const saved = await post('/api/invoices/customers', { name: 'The Late Arms' });
  assert.equal(saved.status, 200, 'a venue must still save when its backup is slow');
  // The write lands (or fails) well after the request answered — give it time.
  let text = '';
  for (let i = 0; i < 40; i += 1) {
    await wait(100);
    const rec = await (await get('/api/flight')).json().catch(() => ({}));
    text = String((rec && rec.text) || '');
    if (/the invoice book was NOT backed up/.test(text)) break;
  }
  return text;
}

test('a backup that goes late and then FAILS is said out loud', async () => {
  const refuse = path.join(os.tmpdir(), `late-backup-refuse-${process.pid}-${Date.now()}`);
  fs.writeFileSync(refuse, '');
  try {
    await onAnEmptyDisk(async (tools) => {
      const text = await saveAVenueAndReadTheRecorder(tools);
      assert.match(text, /the invoice book was NOT backed up/,
        `a late write that then failed was never reported; the recorder says: ${text.split('\n').filter((l) => /backup/.test(l)).join(' | ').slice(0, 300)}`);
    }, { env: { ...SLOW, GH_STUB_REFUSE: refuse }, seedRepo: () => {} });
  } finally {
    fs.rmSync(refuse, { force: true });
  }
});

test('a backup that goes late and then LANDS is not cried wolf about', async () => {
  await onAnEmptyDisk(async (tools) => {
    const text = await saveAVenueAndReadTheRecorder(tools);
    assert.doesNotMatch(text, /the invoice book was NOT backed up/,
      `a late write that landed was reported as a failure: ${text.split('\n').filter((l) => /backup/.test(l)).join(' | ').slice(0, 300)}`);
  }, { env: SLOW, seedRepo: () => {} });
});
