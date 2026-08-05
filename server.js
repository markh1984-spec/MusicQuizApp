/**
 * The game server.
 *
 * One small always-on Node process. No framework, no build step, no database:
 * game packs are JSON files, live state is one JSON file, and the realtime
 * channel is server-sent events. Fewer moving parts is the whole point —
 * every dependency is something that can break on a Wednesday night.
 *
 * It runs one game at a time — a music quiz or music bingo — chosen from the
 * console. The Session object hides which, so everything below this point
 * works the same either way.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

import { config, paths, hostKey } from './src/config.js';
import { Store } from './src/store.js';
import { Hub } from './src/sse.js';
import { Session } from './src/session.js';
import { saveQuiz, deleteQuiz, validateQuiz, normaliseQuiz, loadQuiz, reviewWarnings } from './src/quizzes.js';
import { validateBingoPack, normaliseBingoPack } from './src/bingo.js';
import { fullLibrary, listArchive, loadArchived, saveBingoPack, loadBingoPack, deleteBingoPack } from './src/library.js';
import { generateBingoPack } from './src/generate-bingo.js';
import { generateQuizPack } from './src/generate-quiz.js';
import { recentTracks, forgetAll } from './src/history.js';
import { spotifyConfigured, missingSpotifyConfig } from './src/spotify.js';
import { githubConfigured, missingGithubConfig, putFile, deleteFile, checkAccess } from './src/github.js';
import { toSvg } from './src/qrcode.js';

const HOST_KEY = hostKey();
const store = new Store(paths.state);
const hub = new Hub();

const session = new Session({ config, store, onPush: () => pushState() }).boot();

/**
 * Whether the GitHub backup actually works, not just whether it is configured.
 * Checked at most every five minutes so the console can say "token rejected"
 * up front rather than letting you find out after generating a quiz.
 */
let backupCheck = { at: 0, result: null };
async function backupStatus() {
  if (!githubConfigured()) return { ok: false, error: 'not set up' };
  if (backupCheck.result && Date.now() - backupCheck.at < 5 * 60 * 1000) return backupCheck.result;
  const result = await checkAccess();
  backupCheck = { at: Date.now(), result };
  return result;
}

// ------------------------------------------------------------- broadcasting

function viewFor(client) {
  if (client.role === 'host') return session.hostView();
  if (client.role === 'player') return session.playerView(client.playerId);
  return session.screenView();
}

let pushQueued = false;
function pushState() {
  // Coalesce: sixty phones answering at once is one broadcast, not sixty.
  if (pushQueued) return;
  pushQueued = true;
  queueMicrotask(() => {
    pushQueued = false;
    hub.broadcast('state', viewFor);
  });
}

// ----------------------------------------------------------------- helpers

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}

function sendJson(res, status, data) {
  send(res, status, JSON.stringify(data), { 'Content-Type': 'application/json; charset=utf-8' });
}

async function readJson(req, limitBytes = 1024 * 1024) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > limitBytes) throw new Error('Body too large');
    chunks.push(chunk);
  }
  if (!total) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

/** The address the QR code should point at. */
function publicOrigin(req) {
  if (config.publicUrl) return config.publicUrl.replace(/\/+$/, '');
  const proto = (req.headers['x-forwarded-proto'] || '').split(',')[0].trim() || 'http';
  const host = (req.headers['x-forwarded-host'] || req.headers.host || `localhost:${config.port}`).split(',')[0].trim();
  return `${proto}://${host}`;
}

/** The control view and the editor are behind a key. Everything else is open. */
function isHost(req, url) {
  const supplied = req.headers['x-host-key'] || url.searchParams.get('key') || '';
  return timingSafeEqual(String(supplied), HOST_KEY);
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

function serveFile(res, baseDir, relPath, { cache = false } = {}) {
  // Resolve and then check we are still inside the directory we meant.
  const full = path.resolve(baseDir, '.' + path.posix.normalize('/' + relPath));
  if (!full.startsWith(path.resolve(baseDir))) return send(res, 403, 'Forbidden');
  fs.readFile(full, (err, data) => {
    if (err) return send(res, 404, 'Not found');
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(full).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': cache ? 'public, max-age=3600' : 'no-cache',
    });
    res.end(data);
  });
}

// ------------------------------------------------------------------ routing

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const route = url.pathname;

  try {
    if (req.method === 'GET' || req.method === 'HEAD') {
      if (await handleGet(req, res, url, route)) return;
    } else if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
      if (await handleWrite(req, res, url, route)) return;
    }
    send(res, 404, 'Not found');
  } catch (err) {
    console.error('[http]', req.method, route, err.message);
    if (!res.headersSent) sendJson(res, 500, { error: err.message });
    else res.end();
  }
});

async function handleGet(req, res, url, route) {
  // ---- pages
  if (route === '/' ) {
    send(res, 302, '', { Location: '/screen' });
    return true;
  }
  if (route === '/screen') return serveFile(res, config.publicDir, 'screen.html'), true;
  if (route === '/play') return serveFile(res, config.publicDir, 'play.html'), true;
  if (route === '/host') return serveFile(res, config.publicDir, 'host.html'), true;
  if (route === '/editor') return serveFile(res, config.publicDir, 'editor.html'), true;
  if (route === '/console') return serveFile(res, config.publicDir, 'console.html'), true;
  if (route === '/health') return sendJson(res, 200, { ok: true, game: session.kind, phase: session.engine.state.phase }), true;

  // ---- static
  if (route.startsWith('/assets/')) {
    return serveFile(res, config.publicDir, route), true;
  }
  if (route.startsWith('/quiz-images/')) {
    const rel = decodeURIComponent(route.slice('/quiz-images/'.length));
    // If the real artwork is not there yet, fall back to a placeholder of the
    // same name. That way a quiz pack can name its final .png files from the
    // start and still be rehearsable before any images have been made.
    const swap = rel.replace(/\.(png|jpg|jpeg|webp)$/i, '.svg');
    const exists = fs.existsSync(path.join(config.imageDir, rel));
    return serveFile(res, config.imageDir, exists ? rel : swap, { cache: true }), true;
  }

  // ---- the join QR
  if (route === '/join-qr.svg') {
    const target = `${publicOrigin(req)}/play`;
    send(res, 200, toSvg(target, { margin: 2, dark: '#0b0b12', light: '#ffffff' }), {
      'Content-Type': 'image/svg+xml; charset=utf-8',
    });
    return true;
  }
  // A general-purpose QR, ready for the Instagram code on the lobby screen.
  if (route === '/qr.svg') {
    const text = url.searchParams.get('text') || publicOrigin(req);
    send(res, 200, toSvg(text, { margin: 2, dark: url.searchParams.get('dark') || '#0b0b12', light: url.searchParams.get('light') || '#ffffff' }), {
      'Content-Type': 'image/svg+xml; charset=utf-8',
    });
    return true;
  }

  // ---- realtime
  if (route === '/api/stream') {
    const role = url.searchParams.get('role') || 'screen';
    if (role === 'host' && !isHost(req, url)) return sendJson(res, 401, { error: 'Wrong host key' }), true;
    const playerId = url.searchParams.get('playerId') || null;
    if (playerId) session.engine.touch(playerId);
    const client = hub.add(res, { role, playerId });
    hub.send(client, 'state', viewFor(client));
    return true;
  }

  // ---- info
  if (route === '/api/join-url') {
    return sendJson(res, 200, { url: `${publicOrigin(req)}/play` }), true;
  }
  if (route === '/api/state') {
    const role = url.searchParams.get('role') || 'screen';
    if (role === 'host' && !isHost(req, url)) return sendJson(res, 401, { error: 'Wrong host key' }), true;
    return sendJson(res, 200, viewFor({ role, playerId: url.searchParams.get('playerId') })), true;
  }

  // ---- host-only reads
  if (route === '/api/quizzes') {
    if (!isHost(req, url)) return sendJson(res, 401, { error: 'Wrong host key' }), true;
    return sendJson(res, 200, { quizzes: fullLibrary(config).quizzes, loaded: session.pack.id }), true;
  }
  // The console's library: every quiz and every bingo pack you have saved.
  if (route === '/api/library') {
    if (!isHost(req, url)) return sendJson(res, 401, { error: 'Wrong host key' }), true;
    const library = fullLibrary(config);
    const backup = await backupStatus();
    return sendJson(res, 200, {
      ...library,
      running: { game: session.kind, packId: session.pack.id, title: session.pack.title, phase: session.engine.state.phase, playerCount: session.engine.playerList().length },
      archive: listArchive(config.dataDir),
      generation: {
        claude: Boolean(process.env.ANTHROPIC_API_KEY),
        spotify: spotifyConfigured(),
        spotifyMissing: missingSpotifyConfig(),
        recentCount: recentTracks(config.dataDir, 3).length,
        backup: backup.ok,
        backupConfigured: githubConfigured(),
        backupError: backup.ok ? null : backup.error,
        backupRepo: backup.repo || null,
        backupMissing: missingGithubConfig(),
      },
    }), true;
  }
  if (route.startsWith('/api/bingo/')) {
    if (!isHost(req, url)) return sendJson(res, 401, { error: 'Wrong host key' }), true;
    const id = decodeURIComponent(route.slice('/api/bingo/'.length));
    try {
      return sendJson(res, 200, normaliseBingoPack(loadBingoPack(config.bingoDir, id), id)), true;
    } catch (err) {
      return sendJson(res, 404, { error: err.message }), true;
    }
  }
  // What the generator is currently refusing to reuse.
  if (route === '/api/history') {
    if (!isHost(req, url)) return sendJson(res, 401, { error: 'Wrong host key' }), true;
    const months = Number(url.searchParams.get('months')) || 3;
    return sendJson(res, 200, { months, tracks: recentTracks(config.dataDir, months) }), true;
  }
  if (route.startsWith('/api/archive/')) {
    if (!isHost(req, url)) return sendJson(res, 401, { error: 'Wrong host key' }), true;
    const id = decodeURIComponent(route.slice('/api/archive/'.length));
    try {
      return sendJson(res, 200, loadArchived(config.dataDir, id)), true;
    } catch (err) {
      return sendJson(res, 404, { error: err.message }), true;
    }
  }
  if (route.startsWith('/api/quiz/')) {
    if (!isHost(req, url)) return sendJson(res, 401, { error: 'Wrong host key' }), true;
    const id = decodeURIComponent(route.slice('/api/quiz/'.length));
    try {
      const quiz = loadQuiz(config.quizDir, id);
      return sendJson(res, 200, { ...quiz, reviewWarnings: reviewWarnings(quiz) }), true;
    } catch (err) {
      return sendJson(res, 404, { error: err.message }), true;
    }
  }
  if (route === '/api/results.json') {
    if (!isHost(req, url)) return sendJson(res, 401, { error: 'Wrong host key' }), true;
    return sendJson(res, 200, session.results()), true;
  }
  if (route === '/api/results.csv') {
    if (!isHost(req, url)) return sendJson(res, 401, { error: 'Wrong host key' }), true;
    const results = session.results();
    const rows = session.kind === 'bingo'
      ? [['Team', 'Squares away', 'False calls', 'Won'], ...results.leaderboard.map((p) => [p.name, p.away, p.falseCalls, p.won ? 'yes' : ''])]
      : [['Position', 'Team', 'Score', 'Correct', 'Answered'], ...results.leaderboard.map((p) => [p.position, p.name, p.score, p.correctCount, p.answeredCount])];
    const csv = rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
    return send(res, 200, csv, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="quiz-results.csv"`,
    }), true;
  }

  return false;
}

/**
 * File a pack into the repository so it survives a restart.
 *
 * Never throws and never blocks what you were doing — a failed backup is
 * reported and moved on from, because losing the pack you just made because
 * the backup failed would be daft.
 */
async function backUp(relPath, contents, message, log = () => {}) {
  if (!githubConfigured()) {
    log(`not backed up — GitHub backup is not set up, so this will be lost when the app restarts`);
    return { ok: false };
  }
  const result = await putFile(relPath, contents, message);
  log(result.ok
    ? `backed up to GitHub — this one is permanent`
    : `saved here, but NOT backed up: ${result.error}`);
  return result;
}

function csvCell(value) {
  const s = String(value ?? '');
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

async function handleWrite(req, res, url, route) {
  // ---- players (open to anyone with the join link)
  if (route === '/api/join' && req.method === 'POST') {
    const body = await readJson(req);
    const player = session.engine.join({ playerId: body.playerId, name: body.name });
    return sendJson(res, 200, { id: player.id, name: player.name, score: player.score ?? 0, game: session.kind }), true;
  }

  // What a phone is allowed to do: answer a question, or mark a bingo square
  // and call house. Nothing else, and nothing that could hand out a new card.
  if (['/api/answer', '/api/mark', '/api/claim'].includes(route) && req.method === 'POST') {
    const body = await readJson(req);
    const action = route.slice('/api/'.length);
    const result = session.runPlayerAction(action, body);
    // 200 either way: the phone shows its own feedback, and a rejected action
    // is a normal thing (too late, already answered), not an error.
    return sendJson(res, 200, result), true;
  }

  // ---- everything below is the host
  if (!isHost(req, url)) return sendJson(res, 401, { error: 'Wrong host key' }), true;

  if (route.startsWith('/api/host/') && req.method === 'POST') {
    const action = route.slice('/api/host/'.length);
    const body = await readJson(req);

    // Launching a different game is the one action that replaces the engine.
    if (action === 'launch') {
      try {
        const started = session.launch(String(body.game || 'quiz'), String(body.packId));
        return sendJson(res, 200, { ok: true, started, view: session.hostView() }), true;
      } catch (err) {
        return sendJson(res, 400, { error: err.message }), true;
      }
    }

    const ok = session.run(action, body);
    if (ok === undefined) return sendJson(res, 404, { error: 'Unknown action: ' + action }), true;
    return sendJson(res, 200, { ok, view: session.hostView() }), true;
  }

  // ---- the editor
  // Check a quiz without saving it, so problems can be seen mid-edit.
  if (route === '/api/quiz/__validate' && req.method === 'POST') {
    const body = await readJson(req, 4 * 1024 * 1024);
    return sendJson(res, 200, { problems: validateQuiz(normaliseQuiz(body, body.id)) }), true;
  }

  if (route.startsWith('/api/quiz/')) {
    const id = decodeURIComponent(route.slice('/api/quiz/'.length));
    if (req.method === 'PUT') {
      const body = await readJson(req, 4 * 1024 * 1024);
      const problems = validateQuiz(body);
      if (problems.length) return sendJson(res, 400, { error: 'Quiz is not valid', problems }), true;
      saveQuiz(config.quizDir, id, body);
      // If the running quiz was the one just edited, pick up the changes live.
      if (session.kind === 'quiz' && session.pack.id === id) {
        session.pack = loadQuiz(config.quizDir, id);
        session.engine.quiz = session.pack;
        session.engine.clampPointers();
        session.engine.changed();
      }
      const backup = await backUp(`quizzes/${id}.json`, JSON.stringify(normaliseQuiz(body, id), null, 2) + '\n', `Edit quiz: ${body.title || id}`);
      return sendJson(res, 200, { ok: true, backedUp: backup.ok, backupError: backup.error }), true;
    }
    if (req.method === 'DELETE') {
      if (session.kind === 'quiz' && session.pack.id === id) {
        return sendJson(res, 400, { error: 'That quiz is currently loaded.' }), true;
      }
      deleteQuiz(config.quizDir, id);
      if (githubConfigured()) await deleteFile(`quizzes/${id}.json`, `Delete quiz: ${id}`);
      return sendJson(res, 200, { ok: true }), true;
    }
  }

  if (route === '/api/quiz' && req.method === 'POST') {
    const body = await readJson(req, 4 * 1024 * 1024);
    const quizToSave = normaliseQuiz(body, body.id);
    const problems = validateQuiz(quizToSave);
    if (problems.length) return sendJson(res, 400, { error: 'Quiz is not valid', problems }), true;
    saveQuiz(config.quizDir, quizToSave.id, quizToSave);
    return sendJson(res, 200, { ok: true, id: quizToSave.id }), true;
  }

  // ---- one button: theme in, playable bingo game out.
  // Generation takes a while (Claude, then a Spotify lookup per track), so
  // this streams progress lines as it goes rather than leaving the console
  // staring at a spinner with no idea whether it is working.
  if (route === '/api/generate/bingo' && req.method === 'POST') {
    const body = await readJson(req);
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    });
    const log = (line) => { try { res.write(line + '\n'); } catch { /* client left */ } };
    try {
      const result = await generateBingoPack({
        config,
        theme: String(body.theme || '').slice(0, 200),
        trackCount: Math.min(90, Math.max(9, Number(body.trackCount) || 40)),
        cardSize: [3, 4, 5].includes(Number(body.cardSize)) ? Number(body.cardSize) : 4,
        avoidMonths: Math.min(24, Math.max(0, Number(body.avoidMonths ?? 3))),
        log,
      });
      const backup = await backUp(
        `bingo/${result.pack.id}.json`,
        JSON.stringify(result.pack, null, 2) + '\n',
        `Add bingo pack: ${result.pack.title}`,
        log,
      );
      // The song history matters as much as the pack — without it the
      // no-repeats rule quietly forgets everything on the next restart.
      try {
        const historyFile = path.join(config.dataDir, 'track-history.json');
        if (fs.existsSync(historyFile)) {
          await backUp('data/track-history.json', fs.readFileSync(historyFile, 'utf8'), 'Update song history', () => {});
          log('song history backed up too');
        }
      } catch (err) {
        log('could not back up the song history: ' + err.message);
      }
      log('DONE ' + JSON.stringify({
        id: result.pack.id,
        title: result.pack.title,
        trackCount: result.pack.tracks.length,
        playlist: result.playlist ? result.playlist.url : null,
        backedUp: backup.ok,
      }));
    } catch (err) {
      log('ERROR ' + err.message);
    }
    res.end();
    return true;
  }

  // Same shape as the bingo generator: streams progress while it works,
  // because three rounds of Claude takes the best part of a minute.
  if (route === '/api/generate/quiz' && req.method === 'POST') {
    const body = await readJson(req);
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    });
    const log = (line) => { try { res.write(line + '\n'); } catch { /* client left */ } };
    try {
      const rounds = Array.isArray(body.rounds) && body.rounds.length
        ? body.rounds.filter((r) => ['text', 'image', 'intro'].includes(r))
        : ['text', 'image', 'intro'];
      const result = await generateQuizPack({
        config,
        theme: String(body.theme || '').slice(0, 200),
        rounds,
        perRound: Math.min(20, Math.max(3, Number(body.perRound) || 10)),
        hard: Boolean(body.hard),
        // Always checked. The console deliberately offers no way to skip it —
        // an option that only ever makes the questions worse is a footgun on a
        // panel used in a hurry.
        check: true,
        log,
      });
      const backup = await backUp(
        `quizzes/${result.quiz.id}.json`,
        JSON.stringify(result.quiz, null, 2) + '\n',
        `Add quiz: ${result.quiz.title}`,
        log,
      );
      log('DONE ' + JSON.stringify({
        id: result.quiz.id,
        title: result.quiz.title,
        rounds: result.quiz.rounds.length,
        questionCount: result.quiz.rounds.reduce((n, r) => n + r.questions.length, 0),
        problems: result.problems,
        needsImages: result.needsImages,
        backedUp: backup.ok,
        checked: result.checked,
        rejected: result.rejected.length,
      }));
    } catch (err) {
      log('ERROR ' + err.message);
    }
    res.end();
    return true;
  }

  if (route === '/api/history/forget' && req.method === 'POST') {
    forgetAll(config.dataDir);
    return sendJson(res, 200, { ok: true }), true;
  }

  // ---- bingo packs, same shape as the quiz endpoints
  if (route === '/api/bingo/__validate' && req.method === 'POST') {
    const body = await readJson(req, 4 * 1024 * 1024);
    return sendJson(res, 200, { problems: validateBingoPack(normaliseBingoPack(body, body.id)) }), true;
  }

  if (route.startsWith('/api/bingo/') && req.method === 'DELETE') {
    const id = decodeURIComponent(route.slice('/api/bingo/'.length));
    if (session.kind === 'bingo' && session.pack.id === id) {
      return sendJson(res, 400, { error: 'That pack is currently loaded. Launch something else first.' }), true;
    }
    try {
      deleteBingoPack(config.bingoDir, id);
      if (githubConfigured()) await deleteFile(`bingo/${id}.json`, `Delete bingo pack: ${id}`);
      return sendJson(res, 200, { ok: true }), true;
    } catch (err) {
      return sendJson(res, 404, { error: err.message }), true;
    }
  }

  if (route.startsWith('/api/bingo/') && req.method === 'PUT') {
    const id = decodeURIComponent(route.slice('/api/bingo/'.length));
    const body = await readJson(req, 4 * 1024 * 1024);
    const pack = normaliseBingoPack(body, id);
    const problems = validateBingoPack(pack);
    if (problems.length) return sendJson(res, 400, { error: 'Bingo pack is not valid', problems }), true;
    saveBingoPack(config.bingoDir, id, pack);
    const backup = await backUp(`bingo/${id}.json`, JSON.stringify(pack, null, 2) + '\n', `Edit bingo pack: ${pack.title || id}`);
    return sendJson(res, 200, { ok: true, backedUp: backup.ok, backupError: backup.error }), true;
  }

  if (route === '/api/bingo' && req.method === 'POST') {
    const body = await readJson(req, 4 * 1024 * 1024);
    const pack = normaliseBingoPack(body, body.id);
    const problems = validateBingoPack(pack);
    if (problems.length) return sendJson(res, 400, { error: 'Bingo pack is not valid', problems }), true;
    saveBingoPack(config.bingoDir, pack.id, pack);
    return sendJson(res, 200, { ok: true, id: pack.id }), true;
  }

  return false;
}

// ------------------------------------------------------------------ startup

server.listen(config.port, () => {
  const local = `http://localhost:${config.port}`;
  console.log('');
  console.log('  ┌───────────────────────────────────────────────┐');
  console.log('  │  Music Quiz & Bingo is running                │');
  console.log('  └───────────────────────────────────────────────┘');
  console.log('');
  console.log(`  Big screen   ${local}/screen`);
  console.log(`  Players      ${local}/play`);
  console.log(`  Your control ${local}/host?key=${HOST_KEY}`);
  console.log(`  Editor       ${local}/editor?key=${HOST_KEY}`);
  console.log('');
  console.log(`  Console      ${local}/console?key=${HOST_KEY}`);
  console.log('');
  console.log(`  Loaded:      ${session.pack.title} (${session.kind})`);
  console.log(`  Host key:    ${HOST_KEY}`);
  console.log('');
});

/** Save on the way out, so even a deliberate restart loses nothing. */
function shutdown(signal) {
  console.log(`\n[server] ${signal} — saving state and closing`);
  store.flush();
  hub.closeAll();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (err) => {
  // Never take the quiz down over one bad request. Log it and carry on.
  console.error('[server] uncaught:', err);
  store.flush();
});

export { server, session };
