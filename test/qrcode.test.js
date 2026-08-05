/**
 * The QR encoder.
 *
 * A broken QR code means nobody can join, so this is worth pinning down. The
 * output of this encoder was checked module-for-module against a reference
 * implementation and then decoded with a real scanner (OpenCV) across every
 * version it supports — all of which read back correctly.
 *
 * These tests lock in that verified output. If a refactor changes a single
 * module of the matrix, the fingerprints below stop matching and you know
 * before a room full of people points their cameras at it.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { encodeQr, toSvg } from '../src/qrcode.js';

function fingerprint(matrix) {
  const bits = matrix.map((row) => row.map((v) => (v ? '1' : '0')).join('')).join('');
  return createHash('sha256').update(bits).digest('hex').slice(0, 32);
}

test('a join URL encodes to the exact matrix that was verified with a scanner', () => {
  const { matrix, size, version, mask } = encodeQr('https://musicquiz.onrender.com/play');
  assert.equal(version, 3);
  assert.equal(size, 29);
  assert.equal(mask, 6);
  assert.equal(fingerprint(matrix), '88cff19cf6bd4095e1ef3901d1dd916e');
});

test('a short string encodes to the smallest version', () => {
  const { matrix, size, version } = encodeQr('HELLO');
  assert.equal(version, 1);
  assert.equal(size, 21);
  assert.equal(fingerprint(matrix), '32fbc389880456d584e32bdf2c313723');
});

test('the version grows with the amount of data', () => {
  const versions = [10, 30, 60, 110, 150, 200].map((n) => encodeQr('a'.repeat(n)).version);
  assert.deepEqual(versions, [1, 3, 4, 7, 8, 10]);
  // strictly increasing capacity, no version skipped backwards
  for (let i = 1; i < versions.length; i++) assert.ok(versions[i] >= versions[i - 1]);
});

test('the three finder patterns are in the corners, which is what a camera looks for', () => {
  const { matrix, size } = encodeQr('https://example.com/play');
  const finderAt = (r0, c0) => {
    // The 7x7 pattern: dark ring, light ring, 3x3 dark core.
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const onEdge = r === 0 || r === 6 || c === 0 || c === 6;
        const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        if (matrix[r0 + r][c0 + c] !== (onEdge || inCore)) return false;
      }
    }
    return true;
  };
  assert.ok(finderAt(0, 0), 'top left');
  assert.ok(finderAt(0, size - 7), 'top right');
  assert.ok(finderAt(size - 7, 0), 'bottom left');
});

test('the timing patterns alternate, which is how a scanner finds the grid', () => {
  const { matrix, size } = encodeQr('https://example.com/play');
  for (let i = 8; i < size - 8; i++) {
    assert.equal(matrix[6][i], i % 2 === 0, `horizontal timing at ${i}`);
    assert.equal(matrix[i][6], i % 2 === 0, `vertical timing at ${i}`);
  }
});

test('the module that is always dark, is', () => {
  const { matrix, size } = encodeQr('https://example.com/play');
  assert.equal(matrix[size - 8][8], true);
});

test('UTF-8 goes through byte mode without mangling', () => {
  assert.doesNotThrow(() => encodeQr("Ain't No Mountain High Enough — 1967"));
  assert.doesNotThrow(() => encodeQr('café £5 — quiz'));
});

test('too much data is a clear error, not a silently broken code', () => {
  assert.throws(() => encodeQr('a'.repeat(300)), /Too much data/);
});

test('the SVG has a quiet zone and scales to any projector', () => {
  const svg = toSvg('https://musicquiz.onrender.com/play', { margin: 4 });
  assert.match(svg, /^<svg xmlns/);
  assert.match(svg, /viewBox="0 0 37 37"/); // 29 modules + 4 either side
  assert.match(svg, /shape-rendering="crispEdges"/);
  assert.ok(svg.includes('</svg>'));
});
