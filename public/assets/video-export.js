/**
 * A VIDEO REMADE FOR INSTAGRAM — square or Story, with the venue's frame (or
 * the quizmaster's mark) and, on a Story, the next quiz, RECORDED INTO the
 * pictures. The host's call, 1 October 2026: the watermark *"baked in"*.
 *
 * There is no way to do that without re-recording, and no server tool is
 * allowed (no dependencies), so it is the browser's own: the clip plays into a
 * canvas that draws each frame with the frame on top, and the canvas — with
 * the clip's own sound routed in through Web Audio — is recorded. **It takes
 * as long as the clip**, which the sheet says while it works.
 *
 * The SAME geometry as the photographs: the square is the photograph's square
 * (`framedBox` in spirit — the clip fitted inside the frame's shape, the
 * app's ground behind it), the Story is `storyBlob()`'s poster, everything
 * inside Instagram's strips (`STORY`).
 */
import { STORY, frameImage, markImage, stampMark } from './photo-save.js';

const MOUNT = '#07070e';

function pickType() {
  const want = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp8,opus', 'video/webm'];
  for (const t of want) {
    try { if (window.MediaRecorder && MediaRecorder.isTypeSupported(t)) return t; } catch { /* keep looking */ }
  }
  return '';
}

export function canRemakeVideo() {
  return Boolean(window.MediaRecorder && HTMLCanvasElement.prototype.captureStream && pickType());
}

/** Fit (w, h) inside (bw, bh), centred: the clip is never cropped. */
function fit(w, h, bx, by, bw, bh) {
  const s = Math.min(bw / w, bh / h);
  const dw = Math.round(w * s);
  const dh = Math.round(h * s);
  return { x: bx + Math.round((bw - dw) / 2), y: by + Math.round((bh - dh) / 2), w: dw, h: dh };
}

/**
 * @param {object} o
 * @param {string} o.src                  the clip's URL (same origin)
 * @param {'square'|'story'} o.shape
 * @param {string} o.words                the quizmaster's name, for the mark
 * @param {string} o.overlay              the venue's frame data URL, or ''
 * @param {string} o.line                 the next quiz, under a Story
 * @param {function(number):void} [o.onProgress]  0..1 as it records
 * @returns {Promise<{blob: Blob, type: string}>}
 */
export async function remakeVideo({ src, shape = 'square', words = '', overlay = '', line = '', onProgress = () => {} }) {
  const type = pickType();
  if (!type) throw new Error('This browser cannot make a video.');
  const video = document.createElement('video');
  video.playsInline = true;
  video.crossOrigin = 'anonymous';
  video.preload = 'auto';
  video.src = src;
  await new Promise((resolve, reject) => {
    video.onloadeddata = resolve;
    video.onerror = () => reject(new Error('That video would not load.'));
  });
  const frame = overlay ? await frameImage(overlay) : null;
  const mark = frame ? null : await markImage();
  let hot = '#ff3d8b';
  let font = 'system-ui, sans-serif';
  try {
    hot = getComputedStyle(document.documentElement).getPropertyValue('--hot').trim() || hot;
    font = getComputedStyle(document.body).fontFamily || font;
  } catch { /* defaults draw */ }

  const story = shape === 'story';
  const canvas = document.createElement('canvas');
  canvas.width = story ? STORY.w : 1080;
  canvas.height = story ? STORY.h : 1080;
  const ctx = canvas.getContext('2d');
  // The square: where the clip and its frame go on either canvas.
  const sq = story ? { x: 60, y: STORY.safeTop + 20, size: 960 } : { x: 0, y: 0, size: 1080 };

  const draw = () => {
    if (story) {
      ctx.fillStyle = MOUNT;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const wash = ctx.createLinearGradient(0, 0, canvas.width * 0.6, canvas.height * 0.75);
      wash.addColorStop(0, hot);
      wash.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = MOUNT;
    ctx.fillRect(sq.x, sq.y, sq.size, sq.size);
    const box = fit(video.videoWidth || 16, video.videoHeight || 9, sq.x, sq.y, sq.size, sq.size);
    ctx.drawImage(video, box.x, box.y, box.w, box.h);
    if (frame) ctx.drawImage(frame, sq.x, sq.y, sq.size, sq.size);
    else {
      ctx.save();
      ctx.translate(sq.x, sq.y);
      stampMark(ctx, sq.size, sq.size, words, mark);
      ctx.restore();
    }
    if (story) {
      ctx.textAlign = 'center';
      let y = sq.y + sq.size + 130;
      ctx.fillStyle = hot;
      ctx.font = `800 92px ${font}`;
      ctx.fillText('Quiz night', canvas.width / 2, y, 980);
      if (line) {
        y += 90;
        ctx.fillStyle = '#ffffff';
        ctx.font = `600 56px ${font}`;
        ctx.fillText(line, canvas.width / 2, y, 980);
      }
      if (frame && words) {
        y += 80;
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = '#ffffff';
        ctx.font = `600 40px ${font}`;
        ctx.fillText(words, canvas.width / 2, y, 980);
        ctx.globalAlpha = 1;
      }
    }
  };

  // The clip's own sound, routed into the recording rather than the speaker.
  const tracks = [...canvas.captureStream(30).getVideoTracks()];
  let audio = null;
  try {
    audio = new (window.AudioContext || window.webkitAudioContext)();
    const out = audio.createMediaStreamDestination();
    audio.createMediaElementSource(video).connect(out);
    tracks.push(...out.stream.getAudioTracks());
  } catch { /* a silent video beats no video */ }

  const recorder = new MediaRecorder(new MediaStream(tracks), { mimeType: type, videoBitsPerSecond: 5_000_000, audioBitsPerSecond: 128_000 });
  const parts = [];
  recorder.ondataavailable = (ev) => { if (ev.data && ev.data.size) parts.push(ev.data); };
  const done = new Promise((resolve) => { recorder.onstop = resolve; });

  let running = true;
  const loop = () => {
    if (!running) return;
    draw();
    if (video.duration) onProgress(Math.min(1, video.currentTime / video.duration));
    requestAnimationFrame(loop);
  };
  draw();
  recorder.start(500);
  await video.play();
  loop();
  await new Promise((resolve) => { video.onended = resolve; });
  running = false;
  draw();
  recorder.stop();
  await done;
  if (audio) audio.close().catch(() => {});
  onProgress(1);
  const kind = (recorder.mimeType || type).split(';')[0];
  return { blob: new Blob(parts, { type: kind }), type: kind };
}
