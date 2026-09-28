/**
 * THE PROP TALLY IS WRITTEN WHERE IT IS READ BACK FROM.
 *
 * `backUpPropUse()` pushed `data/prop-use.json` to the PUBLIC app repository —
 * the "Update prop use [skip render]" commits — while `restoreFromBackup()`
 * read it back from the PRIVATE one. A read and a write that disagree about
 * the store is invisible: every deploy the tally came back from a file the
 * writer never touched, and the numbers that decide which drawings to delete
 * never reached the threshold they were built for. A yellow of the 23
 * September 2026 launch-path sweep. It is owner data, so the private repo,
 * both ways.
 *
 * The stub logs which repository took each write; `PROP_PUSH_MS` is the seam
 * so the coalesced push is watched rather than waited a minute for.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { onAnEmptyDisk, wait, writeJson } from './helpers/empty-disk.mjs';

const ONE_PIXEL = Buffer.from('/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64');

test('a prop tally comes back from the private repo at boot, and a new use is pushed to the same repo', async () => {
  const log = path.join(os.tmpdir(), `prop-tally-log-${process.pid}-${Date.now()}`);
  try {
    await onAnEmptyDisk(async ({ host, get }) => {
      // The read half: the seeded tally is on the owner's table after the boot.
      const table = await (await fetch(`${(await get('/health')).url.replace('/health', '')}/api/owner/prop-use?key=empty-disk-key`)).json();
      const row = (table.props || []).find((p) => p.id === 'shirt-1d');
      assert.ok(row && row.shown === 60 && row.used === 12, `the tally did not come back from the backup: ${JSON.stringify(row)}`);

      // The write half: a photograph with a prop on it, and the push it coalesces.
      const launched = await host('launch', { game: 'quiz', packId: '1980s-pop-music', replace: true });
      assert.equal(launched.status, 200);
      const base = (await get('/health')).url.replace('/health', '');
      const lib = await (await get('/api/library')).json();
      const code = lib.running && lib.running.joinCode;
      const joined = await (await fetch(`${base}/api/join`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Propped', joinCode: code }) })).json();
      assert.ok(joined.id, 'no player joined');
      const sent = await fetch(`${base}/api/photo?playerId=${encodeURIComponent(joined.id)}&g=${code}&filter=none&shown=shirt-1d,shirt-bmth&used=shirt-1d`, { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: ONE_PIXEL });
      assert.equal(sent.status, 200, `the photo was refused: ${await sent.text()}`);
      let lines = '';
      for (let i = 0; i < 40; i += 1) {
        await wait(100);
        lines = fs.existsSync(log) ? fs.readFileSync(log, 'utf8') : '';
        if (/^PUT \S+ data\/prop-use\.json$/m.test(lines)) break;
      }
      const put = lines.split('\n').find((l) => /^PUT \S+ data\/prop-use\.json$/.test(l)) || '';
      assert.ok(put, `the tally was never pushed; the stub saw: ${lines.split('\n').filter(Boolean).join(' | ').slice(0, 300)}`);
      assert.equal(put, 'PUT someone/photos data/prop-use.json', `the tally went to a repository the restore never reads: ${put}`);
    }, {
      env: { GH_STUB_LOG: log, PROP_PUSH_MS: '100', GITHUB_REPO: 'someone/app', GITHUB_TOKEN: 'stub' },
      seedRepo: (repo) => writeJson(path.join(repo, 'data', 'prop-use.json'), { props: { 'shirt-1d': { shown: 60, used: 12 } } }),
    });
  } finally {
    fs.rmSync(log, { force: true });
  }
});
