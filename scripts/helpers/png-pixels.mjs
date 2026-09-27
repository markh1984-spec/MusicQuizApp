/**
 * READ THE PIXELS OUT OF A SCREENSHOT — a PNG decoder small enough to own.
 *
 * "In the document", "has a size" and "somebody can see it" are three
 * questions, and a fourth sits behind them for anything on the projector:
 * "can it be READ". A QR code under a 60% scrim is in the document, has a
 * size, hits `elementFromPoint()` — and a phone camera cannot scan it. The only
 * honest measure is the brightness of the rendered pixels, which means
 * decoding what Playwright's `screenshot()` hands back.
 *
 * Node's own `zlib` does the inflating; this does the rest — chunk walk,
 * the five scanline filters, 8-bit RGB and RGBA, no interlace — which is
 * exactly the shape Chromium writes and nothing more. It is a tool for the
 * guards and never a dependency of the app, which ships with none.
 */

import zlib from 'node:zlib';

const SIGNATURE = '89504e470d0a1a0a';

/** @returns {{ width: number, height: number, channels: number, data: Buffer }} */
export function decodePng(buf) {
  if (!Buffer.isBuffer(buf) || buf.subarray(0, 8).toString('hex') !== SIGNATURE) {
    throw new Error('png-pixels: not a PNG');
  }
  let pos = 8;
  let width = 0; let height = 0; let depth = 0; let colour = 0; let interlace = 0;
  const idat = [];
  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      depth = data[8]; colour = data[9]; interlace = data[12];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (depth !== 8 || interlace !== 0 || !(colour === 2 || colour === 6)) {
    throw new Error(`png-pixels: unsupported PNG (depth ${depth}, colour type ${colour}, interlace ${interlace})`);
  }
  const bpp = colour === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  const out = Buffer.alloc(width * height * bpp);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = Buffer.alloc(stride);
    for (let i = 0; i < stride; i += 1) {
      const a = i >= bpp ? cur[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      const x = line[i];
      let v;
      switch (filter) {
        case 0: v = x; break;
        case 1: v = x + a; break;
        case 2: v = x + b; break;
        case 3: v = x + ((a + b) >> 1); break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a); const pb = Math.abs(p - b); const pc = Math.abs(p - c);
          v = x + (pa <= pb && pa <= pc ? a : (pb <= pc ? b : c));
          break;
        }
        default: throw new Error(`png-pixels: bad scanline filter ${filter}`);
      }
      cur[i] = v & 255;
    }
    cur.copy(out, y * stride);
    prev = cur;
  }
  return { width, height, channels: bpp, data: out };
}

/**
 * The mean of (r+g+b)/3 over a region — 0 is black, 255 is white. The region
 * defaults to the whole image.
 */
export function meanBrightness(png, { x = 0, y = 0, w = png.width, h = png.height } = {}) {
  const { width, channels, data } = png;
  let sum = 0; let n = 0;
  const x0 = Math.max(0, Math.floor(x)); const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(width, Math.ceil(x + w)); const y1 = Math.min(png.height, Math.ceil(y + h));
  for (let yy = y0; yy < y1; yy += 1) {
    for (let xx = x0; xx < x1; xx += 1) {
      const at = (yy * width + xx) * channels;
      sum += (data[at] + data[at + 1] + data[at + 2]) / 3;
      n += 1;
    }
  }
  return n ? sum / n : 0;
}
