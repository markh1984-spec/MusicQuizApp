/**
 * WRITE ROUTES — bingo-packs. Moved whole out of `handleWrite()` in server.js;
 * the body is unchanged, it is one of the functions the shell tries in order.
 */
import { config, deleteBingoPack, deleteFile, forgetAll, githubConfigured, normaliseBingoPack, saveBingoPack, validateBingoPack } from './context.js';
import { readJson, sendJson } from './plumbing.js';
import { backUp, packInUse } from './helpers.js';

export async function writeBingoPacks(req, res, url, route) {
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
    if (packInUse('bingo', id)) {
      return sendJson(res, 400, { error: 'That pack is loaded in a game right now. Launch something else first.' }), true;
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
  return false;
}
