/**
 * Photo filters.
 *
 * Done as plain pixel maths rather than canvas `filter` or CSS. Two reasons,
 * both about the room rather than the code:
 *
 *   1. These run on whatever phone a stranger happens to own. `ctx.filter` is
 *      missing or half-implemented on older iOS, and a filter that silently
 *      does nothing on a third of the room is worse than not offering it.
 *
 *   2. The preview and the uploaded file go through the SAME function here, so
 *      what somebody chose is exactly what lands on the projector. Previewing
 *      with CSS and baking with something else is how those drift apart.
 *
 * Every filter is a straight per-pixel map, so they cost about a millisecond
 * on a scaled-down photo and need nothing installed.
 */

const clamp = (n) => (n < 0 ? 0 : n > 255 ? 255 : n);

/** Perceptual brightness — the green channel carries most of what we see. */
const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

export const FILTERS = [
  {
    id: 'none',
    label: 'As shot',
    apply: (d) => d,
  },
  {
    id: 'mono',
    label: 'Black & white',
    apply: (d) => {
      for (let i = 0; i < d.length; i += 4) {
        const v = clamp(luma(d[i], d[i + 1], d[i + 2]));
        d[i] = d[i + 1] = d[i + 2] = v;
      }
      return d;
    },
  },
  {
    id: 'vivid',
    label: 'Vivid',
    apply: (d) => {
      for (let i = 0; i < d.length; i += 4) {
        const l = luma(d[i], d[i + 1], d[i + 2]);
        // Push every channel away from its own brightness, then lift contrast.
        d[i] = clamp((d[i] - l) * 1.55 + l * 1.06);
        d[i + 1] = clamp((d[i + 1] - l) * 1.55 + l * 1.06);
        d[i + 2] = clamp((d[i + 2] - l) * 1.55 + l * 1.06);
      }
      return d;
    },
  },
  {
    id: 'warm',
    label: 'Golden',
    apply: (d) => {
      for (let i = 0; i < d.length; i += 4) {
        d[i] = clamp(d[i] * 1.12 + 14);
        d[i + 1] = clamp(d[i + 1] * 1.02 + 6);
        d[i + 2] = clamp(d[i + 2] * 0.88);
      }
      return d;
    },
  },
  {
    id: 'eighties',
    label: 'Eighties',
    apply: (d) => {
      // A duotone between deep blue-purple and hot pink, which is the app's
      // own palette — photos land on the screen looking like they belong.
      for (let i = 0; i < d.length; i += 4) {
        const t = luma(d[i], d[i + 1], d[i + 2]) / 255;
        d[i] = clamp(26 + t * (255 - 26));
        d[i + 1] = clamp(12 + t * (46 - 12));
        d[i + 2] = clamp(74 + t * (136 - 74));
      }
      return d;
    },
  },
  {
    id: 'faded',
    label: 'Faded',
    apply: (d) => {
      for (let i = 0; i < d.length; i += 4) {
        // Lifted blacks and pulled-in whites: the washed-out film look.
        d[i] = clamp(d[i] * 0.82 + 38);
        d[i + 1] = clamp(d[i + 1] * 0.82 + 36);
        d[i + 2] = clamp(d[i + 2] * 0.84 + 42);
      }
      return d;
    },
  },
  {
    id: 'night',
    label: 'Night out',
    apply: (d) => {
      // Crushed, contrasty and cool — flatters a dark pub, where most of
      // these are taken.
      for (let i = 0; i < d.length; i += 4) {
        d[i] = clamp((d[i] - 128) * 1.35 + 118);
        d[i + 1] = clamp((d[i + 1] - 128) * 1.35 + 122);
        d[i + 2] = clamp((d[i + 2] - 128) * 1.4 + 138);
      }
      return d;
    },
  },
];

export function filterById(id) {
  return FILTERS.find((f) => f.id === id) || FILTERS[0];
}

/**
 * Draw a source image into a canvas at a sensible size with a filter baked in.
 *
 * The resize is not cosmetic. A modern phone photo is 4000px and several
 * megabytes; on pub wifi that is a upload that fails and a punter who gives
 * up. Scaled to 1280 it is a couple of hundred kilobytes and lands instantly,
 * and it is still more than a projector can show.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {CanvasImageSource} source
 * @param {string} filterId
 * @param {number} maxSide
 */
/**
 * The photo onto a canvas, cropped SQUARE.
 *
 * A phone hands back a tall portrait frame, and a portrait photo is the WORSE
 * shape on a projector: held to the same height it is far narrower, so it
 * takes up less of the screen than a square does. A square also matches the
 * polaroid it is shown in, and it makes the strip along the bottom of the big
 * screen a tidy row rather than a ragged one.
 *
 * The crop is not centred on a portrait photo. Faces sit in the UPPER half of
 * a phone photo almost every time, so a centred crop takes the tops of heads
 * off; this keeps a fifth of the spare height at the bottom and the rest at
 * the top. The preview and the upload both come through here, so what somebody
 * lines up is what the room gets — the same reason this function is shared.
 */
export function drawFiltered(canvas, source, filterId, maxSide = 1280, { square = true, flip = false } = {}) {
  const sw = source.naturalWidth || source.videoWidth || source.width;
  const sh = source.naturalHeight || source.videoHeight || source.height;
  let sx = 0;
  let sy = 0;
  let cw = sw;
  let ch = sh;
  if (square) {
    cw = ch = Math.min(sw, sh);
    sx = (sw - cw) / 2;
    sy = sh > sw ? (sh - ch) * 0.2 : (sh - ch) / 2;
  }
  const scale = Math.min(1, maxSide / Math.max(cw, ch));
  const w = Math.max(1, Math.round(cw * scale));
  const h = Math.max(1, Math.round(ch * scale));

  const filter = filterById(filterId);
  /*
   * `willReadFrequently` ONLY when something is going to read the pixels.
   *
   * It asks the browser for a SOFTWARE canvas, which is right for a filter
   * that walks every pixel and badly wrong for anything else — it takes the
   * GPU out of `drawImage`. With the colour grading gone from the panel, the
   * preview never reads back, and it was repainting a 1280px canvas in
   * software on every frame of a drag.
   */
  const reads = filter.id !== 'none';
  const ctx = canvas.getContext('2d', reads ? { willReadFrequently: true } : undefined);
  // Only resize when it actually changed: assigning width or height clears the
  // canvas and reallocates it, which is the expensive part of a repaint.
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  } else {
    ctx.clearRect(0, 0, w, h);
  }
  /*
   * MIRRORED, IF ASKED.
   *
   * iOS shows a mirrored preview while you frame a selfie and then saves the
   * photo un-mirrored, so what comes back through the file input is flipped
   * relative to what the person was looking at. We never see which camera was
   * used and there is no reliable way to find out, so this is a control rather
   * than a detection — the same reasoning as dragging props by hand instead of
   * face-detecting: no download, no guessing, works on every handset.
   *
   * It belongs INSIDE this function because the preview draws at 900 and the
   * upload draws again at 1080 from the same source, and this file exists so
   * those two cannot drift. A flip applied at one call site and not the other
   * is a photo that looks right on the phone and wrong six feet wide.
   */
  if (flip) {
    ctx.save();
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(source, sx, sy, cw, ch, 0, 0, w, h);
  if (flip) ctx.restore();
  if (!reads) return canvas;

  const image = ctx.getImageData(0, 0, w, h);
  filter.apply(image.data);
  ctx.putImageData(image, 0, 0);
  return canvas;
}

/**
 * The canvas as a JPEG blob, which is what actually gets sent.
 *
 * 0.85 is HIGHER than it was, and that is deliberate. Three things pull on
 * this number and they turn out to agree: it has to send fast on pub wifi, it
 * is stored for ever because Past gigs is the point, and it has to be worth
 * posting to Instagram afterwards as a promo.
 *
 * The square 1080 crop already halves the pixels, so the saving can be spent
 * on quality instead of pocketed — and quality is the one that matters for the
 * third job, because INSTAGRAM RE-ENCODES EVERYTHING. Start it low and its own
 * pass compounds on top, which on a dark pub photo is where mush comes from.
 */
export function toJpeg(canvas, quality = 0.85) {
  return new Promise((resolve) => {
    if (canvas.toBlob) canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
    else {
      // Very old Safari. Slower and uses more memory, but it works.
      const parts = canvas.toDataURL('image/jpeg', quality).split(',');
      const bin = atob(parts[1]);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      resolve(new Blob([bytes], { type: 'image/jpeg' }));
    }
  });
}

/**
 * DID A CAMERA TAKE THIS, OR WAS IT PICKED FROM THE GALLERY — asked for
 * directly, so the public gallery can hold only what somebody actually
 * photographed that night, while the big screen keeps taking anything: *"if
 * people upload photos for a bit of a laugh on the night, I don't
 * necessarily want those going into the gallery, but them appearing on the
 * screen can be fun."*
 *
 * **HAS TO RUN ON THE RAW FILE, BEFORE THE CANVAS.** `sendBtn`'s own upload
 * redraws everything into a fresh JPEG (`drawFiltered`/`toJpeg` above), and a
 * canvas round trip strips every byte of EXIF on the way through — so by the
 * time a photo reaches the server there is nothing left to inspect. The one
 * moment the original file still carries its own metadata is right after the
 * file input's `change` event, before `createImageBitmap` ever touches it.
 *
 * **A CAMERA JPEG CARRIES A `Make` TAG; almost nothing else does.** A phone's
 * own camera app writes EXIF with the manufacturer's name in it every time.
 * A screenshot has no EXIF at all — and is nearly always PNG in the first
 * place, which this refuses outright. A photo forwarded through WhatsApp,
 * Instagram or Messages very often has its EXIF stripped by that app before
 * it ever reaches a camera roll — which means this can under-count (a real
 * photo, once shared, reading as "not a camera"), but it will not
 * over-count: nothing manufactures a `Make` tag that was never there. That
 * asymmetry is why the host still gets to see and override it rather than
 * this deciding alone — see `.past-cam` in `console-gigs.js`.
 *
 * **A BEST-EFFORT READ, NEVER A THROW.** A corrupt or truncated file, a
 * format this does not recognise, a JPEG some other tool re-wrote its
 * markers in an unexpected order — every one of those falls through to
 * `false` rather than blocking the upload the guess was never meant to gate.
 *
 * @param {Blob} file
 * @returns {Promise<boolean>}
 */
export async function looksCameraTaken(file) {
  try {
    // EXIF sits in the first JPEG segment and that segment is capped at 64KB
    // by the format itself, so there is never a reason to read further.
    const head = new Uint8Array(await file.slice(0, 65536).arrayBuffer());
    if (head.length < 4 || head[0] !== 0xff || head[1] !== 0xd8) return false; // not a JPEG at all
    let at = 2;
    while (at + 4 <= head.length) {
      if (head[at] !== 0xff) return false; // not a marker where one was expected
      const marker = head[at + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { at += 2; continue; } // no length field
      if (marker === 0xda) return false; // start of the image data — no more markers, so no EXIF was found
      const len = (head[at + 2] << 8) | head[at + 3];
      if (len < 2 || at + 2 + len > head.length) return false;
      if (marker === 0xe1) return readsExifMake(head, at + 4, at + 2 + len);
      at += 2 + len;
    }
    return false;
  } catch {
    return false;
  }
}

/** IFD0 of an EXIF APP1 segment, looking only for tag 0x010F (Make). */
function readsExifMake(buf, start, end) {
  if (end - start < 14 || String.fromCharCode(...buf.subarray(start, start + 4)) !== 'Exif') return false;
  const tiff = start + 6; // past "Exif\0\0"
  const little = buf[tiff] === 0x49 && buf[tiff + 1] === 0x49;
  const big = buf[tiff] === 0x4d && buf[tiff + 1] === 0x4d;
  if (!little && !big) return false;
  const u16 = (o) => (little ? buf[o] | (buf[o + 1] << 8) : (buf[o] << 8) | buf[o + 1]);
  const u32 = (o) => (little
    ? (buf[o] | (buf[o + 1] << 8) | (buf[o + 2] << 16) | (buf[o + 3] << 24)) >>> 0
    : ((buf[o] << 24) | (buf[o + 1] << 16) | (buf[o + 2] << 8) | buf[o + 3]) >>> 0);
  if (u16(tiff + 2) !== 0x002a) return false;
  const ifd0 = tiff + u32(tiff + 4);
  if (ifd0 + 2 > end) return false;
  const count = u16(ifd0);
  for (let i = 0; i < count; i++) {
    const entry = ifd0 + 2 + i * 12;
    if (entry + 12 > end) return false;
    if (u16(entry) === 0x010f) return true; // Make
  }
  return false;
}
