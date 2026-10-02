/**
 * THE APP'S OWN VIDEO RECORDER — fifteen seconds at 720p, then send.
 *
 * The host, 2 October 2026: video from everyone's phones, **recorded in the
 * app** so nothing big ever leaves a phone (*"can we limit the video image size
 * somehow"*). A phone's own camera records 20–60 MB a clip at full quality;
 * this asks for 1280x720 at about 2.5 Mbps, about 5 MB for the fifteen seconds,
 * and **stops itself at fifteen** — the countdown IS the limit.
 *
 * The photo camera is a plain file input on purpose (it opens the phone's own
 * camera everywhere, with no permission prompt of ours). Video cannot be: a
 * file input hands back whatever the camera app made, at whatever size. So
 * this is a live camera, and a phone that cannot do it (no `MediaRecorder`, or
 * the camera refused) is TOLD so, in words, never shown a black box.
 *
 * A LEAF, like `camera-sheet.js`: the caller passes `send(blob, type)` and owns
 * where it goes.
 */
import { node } from './client.js';

export const VIDEO_SECONDS = 15;

export function canRecordVideo() {
  return Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
}

/** The first container this phone can record — MP4 where it can, as Instagram wants. */
function pickType() {
  const want = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp8,opus', 'video/webm'];
  for (const t of want) {
    try { if (MediaRecorder.isTypeSupported(t)) return t; } catch { /* keep looking */ }
  }
  return '';
}

const SAID = {
  too_big: 'That clip is too big to send — try a shorter one.',
  off: 'Photos and videos are switched off right now.',
  no_store: 'Video is not switched on here yet.',
  not_playing: 'Join the quiz first, then send a video.',
  not_a_video: 'That did not record properly — try again.',
};

/**
 * @param {object} o
 * @param {function(Blob, string): Promise<{ok:boolean, reason?:string}>} o.send
 * @param {string} [o.title]
 * @param {string} [o.note]   one line under the title — where it ends up
 */
export function openVideoRecorder({ send, title = 'Send a video', note = '' }) {
  const sheet = node(`<div class="vr-sheet" role="dialog" aria-label="${title}">
      <div class="vr-head"><b>${title}</b><button class="vr-close" type="button" aria-label="Close">✕</button></div>
      ${note ? `<p class="tiny vr-note">${note}</p>` : ''}
      <div class="vr-stage"><video class="vr-live" playsinline muted autoplay></video>
        <video class="vr-back" playsinline controls hidden></video>
        <span class="vr-count" hidden></span></div>
      <p class="vr-said" role="status">Starting the camera…</p>
      <div class="vr-acts">
        <button class="gal-save vr-flip" type="button" disabled>Flip</button>
        <button class="vr-rec" type="button" disabled aria-label="Record up to ${VIDEO_SECONDS} seconds"><span></span></button>
        <button class="gal-save vr-send" type="button" hidden>Send</button>
        <button class="gal-save vr-again" type="button" hidden>Again</button>
      </div>
    </div>`);
  const live = sheet.querySelector('.vr-live');
  const back = sheet.querySelector('.vr-back');
  const count = sheet.querySelector('.vr-count');
  const said = sheet.querySelector('.vr-said');
  const rec = sheet.querySelector('.vr-rec');
  const flip = sheet.querySelector('.vr-flip');
  const sendBtn = sheet.querySelector('.vr-send');
  const again = sheet.querySelector('.vr-again');
  let stream = null;
  let recorder = null;
  let facing = 'environment';
  let clip = null;
  let tick = null;
  let stopAt = null;

  const stopStream = () => { if (stream) stream.getTracks().forEach((t) => t.stop()); stream = null; };
  const close = () => {
    clearInterval(tick);
    clearTimeout(stopAt);
    if (recorder && recorder.state === 'recording') { recorder.onstop = null; recorder.stop(); }
    stopStream();
    if (back.src) URL.revokeObjectURL(back.src);
    sheet.remove();
  };
  sheet.querySelector('.vr-close').addEventListener('click', close);

  const start = async () => {
    stopStream();
    if (!canRecordVideo() || !pickType()) {
      said.textContent = 'This phone cannot record video here — send a photo instead.';
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } },
        audio: true,
      });
    } catch {
      said.textContent = 'The camera or microphone was not allowed. Allow them for this site in your browser settings, or send a photo instead.';
      return;
    }
    live.srcObject = stream;
    live.hidden = false;
    back.hidden = true;
    said.textContent = `Up to ${VIDEO_SECONDS} seconds — it stops by itself.`;
    rec.disabled = false;
    flip.disabled = false;
  };

  const finish = () => {
    clearInterval(tick);
    clearTimeout(stopAt);
    if (recorder && recorder.state === 'recording') recorder.stop();
  };

  rec.addEventListener('click', () => {
    if (recorder && recorder.state === 'recording') { finish(); return; }
    if (!stream) return;
    const type = pickType();
    const parts = [];
    recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 2_500_000, audioBitsPerSecond: 96_000 });
    recorder.ondataavailable = (ev) => { if (ev.data && ev.data.size) parts.push(ev.data); };
    recorder.onstop = () => {
      const kind = (recorder.mimeType || type).split(';')[0];
      clip = { blob: new Blob(parts, { type: kind }), type: kind };
      stopStream();
      rec.classList.remove('on');
      rec.hidden = true;
      flip.hidden = true;
      count.hidden = true;
      live.hidden = true;
      back.src = URL.createObjectURL(clip.blob);
      back.hidden = false;
      back.play().catch(() => {});
      sendBtn.hidden = false;
      again.hidden = false;
      said.textContent = 'Happy with it? Send it, or record it again.';
    };
    recorder.start(1000);
    rec.classList.add('on');
    flip.disabled = true;
    let left = VIDEO_SECONDS;
    count.textContent = String(left);
    count.hidden = false;
    said.textContent = 'Recording — tap again to stop early.';
    tick = setInterval(() => { left -= 1; count.textContent = String(Math.max(0, left)); }, 1000);
    stopAt = setTimeout(finish, VIDEO_SECONDS * 1000);
  });

  flip.addEventListener('click', () => {
    facing = facing === 'environment' ? 'user' : 'environment';
    start();
  });

  again.addEventListener('click', () => {
    if (back.src) URL.revokeObjectURL(back.src);
    back.removeAttribute('src');
    clip = null;
    sendBtn.hidden = true;
    again.hidden = true;
    rec.hidden = false;
    flip.hidden = false;
    start();
  });

  sendBtn.addEventListener('click', async () => {
    if (!clip || sendBtn.disabled) return;
    sendBtn.disabled = true;
    again.disabled = true;
    said.textContent = 'Sending…';
    let got;
    try {
      got = await send(clip.blob, clip.type);
    } catch {
      got = { ok: false };
    }
    if (got && got.ok) {
      said.textContent = 'Sent — thank you!';
      setTimeout(close, 1400);
      return;
    }
    said.textContent = SAID[got && got.reason] || 'That did not send — check your signal and try again.';
    sendBtn.disabled = false;
    again.disabled = false;
  });

  document.body.appendChild(sheet);
  start();
  return { close };
}
