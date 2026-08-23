/**
 * DID A CAMERA TAKE THIS — `looksCameraTaken()` in `public/assets/filters.js`,
 * pure enough (no DOM beyond `Blob`, which Node provides) to test directly
 * under plain Node, the same way `bingo-shape.test.js` tests its own browser
 * module. See the function's own doc comment for why this exists: the public
 * gallery should hold what somebody photographed, not whatever got uploaded
 * for a laugh, while the big screen keeps taking anything.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { looksCameraTaken } from '../public/assets/filters.js';

/** A minimal EXIF APP1 payload (little-endian TIFF), with or without a Make tag. */
function exifPayload({ withMake }) {
  const entries = withMake ? [{ tag: 0x010f, value: 'A' }] : [];
  const ifd0 = new Uint8Array(2 + entries.length * 12 + 4);
  const view = new DataView(ifd0.buffer);
  view.setUint16(0, entries.length, true);
  entries.forEach((e, i) => {
    const at = 2 + i * 12;
    view.setUint16(at, e.tag, true);
    view.setUint16(at + 2, 2, true); // ASCII
    view.setUint32(at + 4, 1, true);
    ifd0[at + 8] = e.value.charCodeAt(0);
  });
  const tiff = new Uint8Array(8);
  const tv = new DataView(tiff.buffer);
  tv.setUint8(0, 0x49); tv.setUint8(1, 0x49); // "II"
  tv.setUint16(2, 0x2a, true);
  tv.setUint32(4, 8, true); // IFD0 right after this 8-byte header
  const exif = new Uint8Array([0x45, 0x78, 0x69, 0x66, 0x00, 0x00]); // "Exif\0\0"
  return new Uint8Array([...exif, ...tiff, ...ifd0]);
}

function jpegWithApp1(app1Payload) {
  const bytes = [0xff, 0xd8]; // SOI
  if (app1Payload) {
    const len = app1Payload.length + 2;
    bytes.push(0xff, 0xe1, (len >> 8) & 0xff, len & 0xff, ...app1Payload);
  }
  bytes.push(0xff, 0xda, 0x00, 0x02); // start of scan — no more markers follow
  return new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' });
}

test('a JPEG with a Make tag in its EXIF reads as camera-taken', async () => {
  const blob = jpegWithApp1(exifPayload({ withMake: true }));
  assert.equal(await looksCameraTaken(blob), true);
});

test('a JPEG with EXIF but no Make tag does not', async () => {
  const blob = jpegWithApp1(exifPayload({ withMake: false }));
  assert.equal(await looksCameraTaken(blob), false);
});

test('a JPEG with no EXIF at all does not', async () => {
  const blob = jpegWithApp1(null);
  assert.equal(await looksCameraTaken(blob), false);
});

test('a PNG — what a screenshot almost always is — is refused outright', async () => {
  const png = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])]);
  assert.equal(await looksCameraTaken(png), false);
});

test('an empty or corrupt file never throws', async () => {
  assert.equal(await looksCameraTaken(new Blob([])), false);
  assert.equal(await looksCameraTaken(new Blob([new Uint8Array([0xff, 0xd8, 0xff])])), false);
});
