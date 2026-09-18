/**
 * STATIC FILES — the MIME table and serveFile(). Moved whole from server.js.
 */
import { fs, path } from './context.js';
import { send } from './plumbing.js';

export const MIME = {
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
  /* The soundboard's recordings. `.mp3` alone, because it is the one format
     every browser this app runs on decodes — Safari included, which is what
     rules `.ogg` out. Without this the file is served as a download and
     `decodeAudioData` never sees it. */
  '.mp3': 'audio/mpeg',
};

/**
 * A static file, with something the browser can CHECK it against.
 *
 * `no-cache` on its own says "ask before you use this" — but with no validator
 * there is nothing to ask about, so anything in the middle (a carrier proxy, a
 * venue's wifi box) is free to hand back whatever it kept. That is how a phone
 * ends up with a new `play.js` and an old `style.css`, which is not a blank
 * page you would notice: it is half the app quietly not working. It happened
 * to the prop tray, where the tiles came back with no box and collapsed to
 * nothing.
 *
 * So every file carries an ETag built from its size and mtime. A deploy
 * changes both, so a stale copy can never validate; an unchanged one answers
 * 304 and costs a header rather than the file. There is no build step here to
 * put a hash in a filename, and this needs none.
 */
export function serveFile(res, baseDir, relPath, { cache = false } = {}) {
  // Resolve and then check we are still inside the directory we meant.
  const full = path.resolve(baseDir, '.' + path.posix.normalize('/' + relPath));
  if (!full.startsWith(path.resolve(baseDir))) return send(res, 403, 'Forbidden');
  fs.stat(full, (statErr, stat) => {
    if (statErr) return send(res, 404, 'Not found');
    const tag = `W/"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
    const headers = {
      'Content-Type': MIME[path.extname(full).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': cache ? 'public, max-age=3600' : 'no-cache',
      'ETag': tag,
      'Last-Modified': new Date(stat.mtimeMs).toUTCString(),
    };
    if (res.req && res.req.headers['if-none-match'] === tag) {
      res.writeHead(304, headers);
      return res.end();
    }
    fs.readFile(full, (err, data) => {
      if (err) return send(res, 404, 'Not found');
      res.writeHead(200, headers);
      res.end(data);
    });
  });
}

