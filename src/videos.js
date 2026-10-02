/**
 * VIDEO — fifteen seconds from a phone, kept beside the night's photographs.
 *
 * The host, 1–2 October 2026: video *"from phones"* (everyone's, through the
 * same QR codes), **recorded in the app** at 720p with a fifteen-second
 * countdown (`video-recorder.js`), so nothing big ever leaves a phone; kept in
 * the **object store only** — the private repository keeps every byte in its
 * history for ever, which is the wrong promise for a clip of the public; and
 * **deleted after thirty days unless it was used**: starred by the host, or
 * saved for Instagram by him or a pub's staff. Never on the big screen, until
 * he decides otherwise.
 *
 * Pure: names, shapes and dates. The routes are `src/http/videos.js`.
 */

/** A video's stored name: an id, `-cam` from the bar's camera, then `-vid`. */
export const VIDEO_NAME = /^[a-z0-9]+(-cam)?-vid\.(mp4|webm)$/i;

/**
 * Fifteen seconds at the recorder's 2.5 Mbps is about 5 MB. Sixteen is a
 * SAFETY number with room for a phone that ignores the bitrate it was asked
 * for — never the design, which is the countdown.
 */
export const MAX_VIDEO_BYTES = 16 * 1024 * 1024;

/** How long an unused video is kept, in days. */
export const KEEP_DAYS = 30;

export function isVideoName(name) {
  return VIDEO_NAME.test(String(name || ''));
}

/** What the bytes are, by their own header — never what the request says. */
export function sniffVideo(buffer) {
  if (!buffer || buffer.length < 12) return null;
  if (buffer.subarray(4, 8).toString('ascii') === 'ftyp') return 'video/mp4';
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) return 'video/webm';
  return null;
}

export function videoName(id, { house = false, type = 'video/mp4' } = {}) {
  const ext = type === 'video/webm' ? 'webm' : 'mp4';
  return `${String(id).toLowerCase().replace(/[^a-z0-9]/g, '')}${house ? '-cam' : ''}-vid.${ext}`;
}

/** The night a video belongs to is its folder; it goes KEEP_DAYS after it. */
export function goesOn(night, days = KEEP_DAYS) {
  const [y, m, d] = String(night || '').split('-').map(Number);
  if (!y || !m || !d) return null;
  const at = new Date(Date.UTC(y, m - 1, d + days));
  return at.toISOString().slice(0, 10);
}

/** Is this video due to go today? Kept ones never are. */
export function dueToGo(night, kept, today) {
  if (kept) return false;
  const when = goesOn(night);
  return Boolean(when) && String(today) >= when;
}

/** The key a video's keep-mark is stored under, in a room's `videos-kept.json`. */
export function keepKey(night, name) {
  return `${night}/${name}`;
}

/** The Content-Type a stored name is served with. */
export function videoType(name) {
  return /\.webm$/i.test(String(name)) ? 'video/webm' : 'video/mp4';
}

/**
 * Serve part of a buffer for a `Range` header — Safari will not play a video
 * from a server that cannot answer one. Returns null for a range it cannot
 * satisfy, `{ whole: true }` when there is none.
 */
export function rangeOf(header, size) {
  if (!header) return { whole: true };
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(header).trim());
  if (!m || (m[1] === '' && m[2] === '')) return null;
  let start;
  let end;
  if (m[1] === '') {
    start = Math.max(0, size - Number(m[2]));
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start > end || start >= size) return null;
  return { start, end };
}
