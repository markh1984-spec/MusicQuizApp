/**
 * The quiz server.
 *
 * One small always-on Node process. No framework, no build step, no database:
 * quiz packs are JSON files, live state is one JSON file, and the realtime
 * channel is server-sent events. Fewer moving parts is the whole point —
 * every dependency is something that can break on a Wednesday night.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config, paths, hostKey } from './src/config.js';
import { Engine, PHASES } from './src/engine.js';
import { Store } from './src/store.js';
import { Hub } from './src/sse.js';
import { listQuizzes, loadQuiz, saveQuiz, deleteQuiz, validateQuiz, normaliseQuiz } from './src/quizzes.js';
import { toSvg } from './src/qrcode.js';

const HOST_KEY = hostKey();
const store = new Store(paths.state);
const hub = new Hub();

// ---------------------------------------------------------------- boot state

/** Pick a quiz to run: the configured one, the saved one, or the first found. */
function pickQuiz(savedQuizId) {
  const available = listQuizzes(config.quizDir).filter((q) => !q.broken);
  const wanted = config.defaultQuizId || savedQuizId || (available[0] && available[0].id);
  if (!wanted) {
    console.error(`[quiz] no quiz packs found in ${config.quizDir}`);
    return { id: 'empty', title: 'No quiz loaded', rounds: [] };
  }
  try {
    return loadQuiz(config.quizDir, wanted);
  } catch (err) {
    console.error(`[quiz] could not load "${wanted}": ${err.message}`);
    return { id: 'empty', title: 'No quiz loaded', rounds: [] };
  }
}

const saved = store.load();
const quiz = pickQuiz(saved && saved.quizId);
// A saved state only makes sense against the quiz it was recorded for.
const restoredState = saved && saved.quizId === quiz.id ? saved : null;
if (restoredState) {
  console.log(`[quiz] restored a quiz in progress: ${Object.keys(restoredState.players || {}).length} players, phase ${restoredState.phase}`);
}

const engine = new Engine({
  quiz,
  state: restoredState,
  onChange: () => {
    store.save(engine.state);
    pushState();
    armAutoReveal();
  },
});

// ------------------------------------------------------------- the clock

/**
 * The server owns the clock, so the server also decides when time is up. One
 * timer per question, re-armed whenever anything changes (including after a
 * restart, so a crash mid-question still ends that question on time).
 */
let autoRevealTimer = null;
function armAutoReveal() {
  if (autoRevealTimer) {
    clearTimeout(autoRevealTimer);
    autoRevealTimer = null;
  }
  if (engine.state.phase !== PHASES.QUESTION) return;
  const left = engine.msRemaining();
  if (left === null) return;
  autoRevealTimer = setTimeout(() => {
    autoRevealTimer = null;
    if (engine.state.phase === PHASES.QUESTION && engine.isExpired()) engine.reveal();
  }, Math.max(0, left) + 50); // a beat of slack so a last-instant answer lands
  if (autoRevealTimer.unref) autoRevealTimer.unref();
}
armAutoReveal();

// ------------------------------------------------------------- broadcasting

function viewFor(client) {
  if (client.role === 'host') return engine.hostView();
  if (client.role === 'player') return engine.playerView(client.playerId);
  return engine.screenView();
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
  if (route === '/health') return sendJson(res, 200, { ok: true, phase: engine.state.phase }), true;

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
    if (playerId) engine.touch(playerId);
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
    return sendJson(res, 200, { quizzes: listQuizzes(config.quizDir), loaded: engine.quiz.id }), true;
  }
  if (route.startsWith('/api/quiz/')) {
    if (!isHost(req, url)) return sendJson(res, 401, { error: 'Wrong host key' }), true;
    const id = decodeURIComponent(route.slice('/api/quiz/'.length));
    try {
      return sendJson(res, 200, loadQuiz(config.quizDir, id)), true;
    } catch (err) {
      return sendJson(res, 404, { error: err.message }), true;
    }
  }
  if (route === '/api/results.json') {
    if (!isHost(req, url)) return sendJson(res, 401, { error: 'Wrong host key' }), true;
    return sendJson(res, 200, engine.results()), true;
  }
  if (route === '/api/results.csv') {
    if (!isHost(req, url)) return sendJson(res, 401, { error: 'Wrong host key' }), true;
    const rows = [['Position', 'Team', 'Score', 'Correct', 'Answered']];
    for (const p of engine.results().leaderboard) {
      rows.push([p.position, p.name, p.score, p.correctCount, p.answeredCount]);
    }
    const csv = rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
    return send(res, 200, csv, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="quiz-results.csv"`,
    }), true;
  }

  return false;
}

function csvCell(value) {
  const s = String(value ?? '');
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

async function handleWrite(req, res, url, route) {
  // ---- players (open to anyone with the join link)
  if (route === '/api/join' && req.method === 'POST') {
    const body = await readJson(req);
    const player = engine.join({ playerId: body.playerId, name: body.name });
    return sendJson(res, 200, { id: player.id, name: player.name, score: player.score }), true;
  }

  if (route === '/api/answer' && req.method === 'POST') {
    const body = await readJson(req);
    const result = engine.answer({ playerId: body.playerId, optionIndex: body.optionIndex });
    // 200 either way: the phone shows its own feedback, and a rejected answer
    // is a normal thing (too late, already answered), not an error.
    return sendJson(res, 200, result), true;
  }

  // ---- everything below is the host
  if (!isHost(req, url)) return sendJson(res, 401, { error: 'Wrong host key' }), true;

  if (route.startsWith('/api/host/') && req.method === 'POST') {
    const action = route.slice('/api/host/'.length);
    const body = await readJson(req);
    const ok = runHostAction(action, body);
    if (ok === undefined) return sendJson(res, 404, { error: 'Unknown action: ' + action }), true;
    return sendJson(res, 200, { ok, view: engine.hostView() }), true;
  }

  // ---- the editor
  if (route.startsWith('/api/quiz/')) {
    const id = decodeURIComponent(route.slice('/api/quiz/'.length));
    if (req.method === 'PUT') {
      const body = await readJson(req, 4 * 1024 * 1024);
      const problems = validateQuiz(body);
      if (problems.length) return sendJson(res, 400, { error: 'Quiz is not valid', problems }), true;
      saveQuiz(config.quizDir, id, body);
      // If the running quiz was the one just edited, pick up the changes live.
      if (engine.quiz.id === id) {
        engine.quiz = loadQuiz(config.quizDir, id);
        engine.clampPointers();
        engine.changed();
      }
      return sendJson(res, 200, { ok: true }), true;
    }
    if (req.method === 'DELETE') {
      if (engine.quiz.id === id) return sendJson(res, 400, { error: 'That quiz is currently loaded.' }), true;
      deleteQuiz(config.quizDir, id);
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

  return false;
}

/** Every button on the control view maps to one of these. */
function runHostAction(action, body) {
  switch (action) {
    case 'start': return engine.start();
    case 'next': return engine.next();
    case 'back': return engine.back();
    case 'reveal': return engine.reveal();
    case 'skip': return engine.skipQuestion();
    case 'redo': return engine.redoQuestion();
    case 'goto': return engine.goTo(Number(body.roundIndex), Number(body.questionIndex));
    case 'removePlayer': return engine.removePlayer(String(body.playerId));
    case 'renamePlayer': return engine.renamePlayer(String(body.playerId), String(body.name));
    case 'adjustScore': return engine.adjustScore(String(body.playerId), Number(body.delta));
    case 'resetScores': return engine.resetScores();
    case 'resetAll': return engine.resetAll();
    case 'loadQuiz': {
      const next = loadQuiz(config.quizDir, String(body.quizId));
      engine.quiz = next;
      engine.state = Engine.freshState(next);
      engine.changed();
      return true;
    }
    default: return undefined;
  }
}

// ------------------------------------------------------------------ startup

server.listen(config.port, () => {
  const local = `http://localhost:${config.port}`;
  console.log('');
  console.log('  ┌───────────────────────────────────────────────┐');
  console.log('  │  Music Quiz is running                        │');
  console.log('  └───────────────────────────────────────────────┘');
  console.log('');
  console.log(`  Big screen   ${local}/screen`);
  console.log(`  Players      ${local}/play`);
  console.log(`  Your control ${local}/host?key=${HOST_KEY}`);
  console.log(`  Editor       ${local}/editor?key=${HOST_KEY}`);
  console.log('');
  console.log(`  Quiz loaded: ${engine.quiz.title} (${engine.quiz.rounds.length} rounds)`);
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

export { server, engine };
