/**
 * THE SELF-TEST — the server plays a night against itself at every boot.
 *
 * Every push is a deploy, and the gig on 17 September 2026 was lost to a
 * server that came up looking fine and could not launch. The Monday build
 * proves the code before it goes; this proves the INSTANCE after it has
 * arrived: the packs are on this disk, the engine builds, a launch takes, two
 * phones join, a question goes up, an answer lands, the reveal comes, and the
 * three views say what they should — the host's carrying the answer and the
 * projector's not (rule 1). Then it asks its own port for the pages a night
 * needs. Twenty steps, under a second, and the verdict is on `/health` and in
 * the flight recorder, so *"is the server all right?"* has an answer before
 * anybody has to find out in front of a room.
 *
 * IT PLAYS IN A THROWAWAY ROOM ON A THROWAWAY DISK. A `Session` of its own,
 * in a temporary directory, with no push, no archive and no room in
 * `rooms` — so it cannot touch a night, file a gig, mint a voucher or wake a
 * projector. It never goes near a real room's state file; that is the whole
 * reason it is safe to run on a box with a quiz already on it.
 *
 * NOTHING HERE MAY THROW OUT. A self-test that takes the server down is the
 * outage it exists to warn about, so every step is caught and the failure is
 * the RESULT, not an exception.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Session } from './session.js';
import { Store } from './store.js';
import { listQuizzes } from './quizzes.js';

let last = null;

/** The most recent verdict, for `/health` and the Help tab. */
export function selfTestResult() {
  return last;
}

/**
 * Run it. `port` is optional: with one, the HTTP half asks the real server
 * for its pages; without, only the engine half runs (the unit test).
 */
export async function runSelfTest({ config, port = 0, fetchImpl = globalThis.fetch, now = () => Date.now() } = {}) {
  const started = now();
  const steps = [];
  const step = (name, fn) => {
    try {
      const note = fn();
      steps.push({ name, ok: true, ...(note ? { note: String(note) } : {}) });
      return true;
    } catch (err) {
      steps.push({ name, ok: false, error: String(err && err.message || err) });
      return false;
    }
  };
  const must = (cond, why) => { if (!cond) throw new Error(why); };

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'quizporium-selftest-'));
  let session = null;
  let phoneA = null;
  let phoneB = null;
  let pack = null;

  try {
    step('engine builds', () => {
      session = new Session({
        config: { ...config, dataDir: tmp },
        store: new Store(path.join(tmp, 'state.json')),
        onPush: () => {},
        onArchive: () => {},
        now,
        roomId: 'selftest',
        paths: { archive: path.join(tmp, 'archive') },
      });
      session.boot();
      must(session.engine, 'no engine after boot');
    })
    && step('a quiz pack is on this disk', () => {
      const packs = listQuizzes(config.quizDir).filter((p) => (p.questions || p.questionCount || 0) > 0 || (p.rounds || []).length);
      must(packs.length, `no quiz packs in ${config.quizDir}`);
      pack = packs[0];
      return `${packs.length} packs, trying "${pack.title || pack.id}"`;
    })
    && step('launch takes', () => {
      session.launch('quiz', pack.id, { rewards: ['A self-test prize'] });
      must(session.kind === 'quiz', `kind is ${session.kind}`);
      must(session.engine.state.launched !== false, 'launched is false after launch');
      must(session.engine.state.phase === 'lobby', `phase after launch is ${session.engine.state.phase}`);
    })
    && step('two phones join', () => {
      phoneA = session.engine.join({ name: 'Self test A' });
      phoneB = session.engine.join({ name: 'Self test B' });
      must(phoneA && phoneA.id && phoneA.token, 'phone A got no id or token');
      must(phoneB && phoneB.id && phoneB.token, 'phone B got no id or token');
      must(phoneA.id !== phoneB.id, 'both phones got one id');
    })
    && step('the night starts', () => {
      const ok = session.run('start');
      must(ok !== false && ok !== undefined, `start answered ${JSON.stringify(ok)}`);
      must(session.engine.state.phase !== 'lobby', 'still in the lobby after start');
    })
    && step('a question goes up', () => {
      let presses = 0;
      while (session.engine.state.phase !== 'question' && presses < 8) { session.run('next'); presses += 1; }
      must(session.engine.state.phase === 'question', `phase is ${session.engine.state.phase} after ${presses} presses`);
      return `after ${presses + 1} presses`;
    })
    && step('an answer lands', () => {
      const res = session.runPlayerAction('answer', { playerId: phoneA.id, token: phoneA.token, optionIndex: 0 });
      must(res && res.ok, `answer refused: ${JSON.stringify(res)}`);
      const wrong = session.runPlayerAction('answer', { playerId: phoneB.id, token: 'not-the-token', optionIndex: 0 });
      must(wrong && wrong.ok === false && wrong.reason === 'not_yours', `a wrong token was not refused: ${JSON.stringify(wrong)}`);
    })
    && step('the host sees the answer and the projector does not', () => {
      // Mid-question: the answer key is on the host's screen and nowhere else
      // (rule 1). At the reveal the projector is TOLD the answer, so this has
      // to be asked before the reveal, not after.
      const host = session.hostView();
      must(host && host.question && typeof host.question.correctIndex === 'number' && host.question.correctIndex >= 0, 'host view has no correctIndex');
      const screen = JSON.stringify(session.screenView());
      must(!screen.includes('correctIndex') && !screen.includes('"token"'), 'the projector payload carries a secret mid-question');
      const phone = JSON.stringify(session.playerView(phoneA.id));
      must(!phone.includes('correctIndex') && !phone.includes('"prompt"'), 'the phone payload carries the key or the question text');
    })
    && step('the reveal comes', () => {
      session.run('reveal');
      must(session.engine.state.phase === 'reveal', `phase is ${session.engine.state.phase}`);
      const phone = session.playerView(phoneA.id);
      must(phone && phone.phase === 'reveal', `the phone thinks it is ${phone && phone.phase}`);
    })
    && step('the state survives a reload', () => {
      session.store.flush();
      const again = new Session({
        config: { ...config, dataDir: tmp },
        store: new Store(path.join(tmp, 'state.json')),
        onPush: () => {}, onArchive: () => {}, now, roomId: 'selftest',
        paths: { archive: path.join(tmp, 'archive') },
      });
      again.boot();
      must(again.engine.state.phase === 'reveal', `came back at ${again.engine.state.phase}`);
      must(again.engine.state.players && again.engine.state.players[phoneA.id], 'phone A was lost across the reload');
    });

    if (port) {
      for (const route of ['/console', '/play', '/screen', '/api/state?role=screen', '/health']) {
        // eslint-disable-next-line no-await-in-loop
        await stepAsync(steps, `GET ${route}`, async () => {
          const res = await fetchImpl(`http://127.0.0.1:${port}${route}`, { signal: AbortSignal.timeout(5000) });
          must(res.status === 200, `answered ${res.status}`);
          const text = await res.text();
          must(text.length > 0, 'answered nothing');
        });
      }
    }
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* a temp dir, and nothing depends on it */ }
  }

  const failed = steps.filter((s) => !s.ok);
  last = {
    ok: failed.length === 0,
    at: started,
    ms: now() - started,
    steps: steps.length,
    failed: failed.map((s) => `${s.name}: ${s.error}`),
    detail: steps,
  };
  return last;
}

async function stepAsync(steps, name, fn) {
  try {
    await fn();
    steps.push({ name, ok: true });
  } catch (err) {
    steps.push({ name, ok: false, error: String(err && err.message || err) });
  }
}
