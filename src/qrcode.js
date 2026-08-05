/**
 * A small QR code encoder, written out in full so the app has no dependencies.
 *
 * Scope: byte mode, error correction level M (recovers ~15% damage — the right
 * trade-off for a code projected onto a screen), versions 1 to 10, which is
 * up to 213 characters. A join URL is nowhere near that.
 *
 * Output is a boolean matrix; `toSvg()` turns it into an SVG string. SVG
 * rather than a PNG so it stays razor sharp when it fills a projector.
 *
 * There is a test that checks the matrix this produces is identical, module
 * for module, to the one a reference encoder produces. If that passes, phones
 * will read it.
 */

// ---------------------------------------------------------------- constants

// Per version (1-10) at error correction level M:
// [ec codewords per block, blocks in group 1, data codewords in group 1,
//   blocks in group 2, data codewords in group 2]
const EC_TABLE_M = {
  1: [10, 1, 16, 0, 0],
  2: [16, 1, 28, 0, 0],
  3: [26, 1, 44, 0, 0],
  4: [18, 2, 32, 0, 0],
  5: [24, 2, 43, 0, 0],
  6: [16, 4, 27, 0, 0],
  7: [18, 4, 31, 0, 0],
  8: [22, 2, 38, 2, 39],
  9: [22, 3, 36, 2, 37],
  10: [26, 4, 43, 1, 44],
};

// Where the alignment patterns sit, per version.
const ALIGNMENT_POSITIONS = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 50],
};

// 18-bit version information, versions 7 and up.
const VERSION_INFO = {
  7: 0x07c94,
  8: 0x085bc,
  9: 0x09a99,
  10: 0x0a4d3,
};

// 15-bit format information for level M, one per mask pattern.
const FORMAT_INFO_M = [0x5412, 0x5125, 0x5e7c, 0x5b4b, 0x45f9, 0x40ce, 0x4f97, 0x4aa0];

const MASK_FUNCTIONS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

// ------------------------------------------------------------ galois fields

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(function buildTables() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d; // the QR generator polynomial
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

/** The generator polynomial for `degree` error correction codewords. */
function generatorPoly(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], GF_EXP[i]);
    }
    poly = next;
  }
  return poly;
}

/** Reed-Solomon error correction codewords for one block. */
function ecCodewords(data, count) {
  const gen = generatorPoly(count);
  const remainder = new Array(count).fill(0);
  for (const byte of data) {
    const factor = byte ^ remainder[0];
    remainder.shift();
    remainder.push(0);
    for (let i = 0; i < count; i++) {
      remainder[i] ^= gfMul(gen[i + 1], factor);
    }
  }
  return remainder;
}

// ------------------------------------------------------------------ encoder

function dataCodewordCount(version) {
  const [, g1Blocks, g1Words, g2Blocks, g2Words] = EC_TABLE_M[version];
  return g1Blocks * g1Words + g2Blocks * g2Words;
}

function chooseVersion(byteLength) {
  for (let v = 1; v <= 10; v++) {
    const countBits = v < 10 ? 8 : 16;
    const capacityBits = dataCodewordCount(v) * 8 - 4 - countBits;
    if (byteLength * 8 <= capacityBits) return v;
  }
  throw new Error(`Too much data for this QR encoder: ${byteLength} bytes (limit 213)`);
}

function buildDataCodewords(bytes, version) {
  const bits = [];
  const push = (value, length) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >> i) & 1);
  };

  push(0b0100, 4); // byte mode
  push(bytes.length, version < 10 ? 8 : 16);
  for (const b of bytes) push(b, 8);

  const capacityBits = dataCodewordCount(version) * 8;
  // Terminator, up to four zero bits.
  push(0, Math.min(4, capacityBits - bits.length));
  // Pad to a whole byte.
  while (bits.length % 8 !== 0) bits.push(0);

  const codewords = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    codewords.push(byte);
  }
  // Fill the rest with the two specified pad bytes, alternating.
  const pad = [0xec, 0x11];
  let p = 0;
  while (codewords.length < capacityBits / 8) codewords.push(pad[p++ % 2]);
  return codewords;
}

/** Split into blocks, add error correction, then interleave as the spec says. */
function interleave(dataCodewords, version) {
  const [ecCount, g1Blocks, g1Words, g2Blocks, g2Words] = EC_TABLE_M[version];
  const blocks = [];
  let offset = 0;
  for (let i = 0; i < g1Blocks; i++) {
    blocks.push(dataCodewords.slice(offset, offset + g1Words));
    offset += g1Words;
  }
  for (let i = 0; i < g2Blocks; i++) {
    blocks.push(dataCodewords.slice(offset, offset + g2Words));
    offset += g2Words;
  }
  const ecBlocks = blocks.map((b) => ecCodewords(b, ecCount));

  const out = [];
  const maxData = Math.max(...blocks.map((b) => b.length));
  for (let i = 0; i < maxData; i++) {
    for (const block of blocks) if (i < block.length) out.push(block[i]);
  }
  for (let i = 0; i < ecCount; i++) {
    for (const block of ecBlocks) out.push(block[i]);
  }
  return out;
}

// ------------------------------------------------------------ module layout

function emptyMatrix(size) {
  return Array.from({ length: size }, () => new Array(size).fill(null));
}

function placeFinder(matrix, row, col) {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const rr = row + r;
      const cc = col + c;
      if (rr < 0 || rr >= matrix.length || cc < 0 || cc >= matrix.length) continue;
      const onEdge = r === 0 || r === 6 || c === 0 || c === 6;
      const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      const inside = r >= 0 && r <= 6 && c >= 0 && c <= 6;
      matrix[rr][cc] = inside && (onEdge || inCore);
    }
  }
}

function placeAlignment(matrix, version) {
  const positions = ALIGNMENT_POSITIONS[version];
  for (const r of positions) {
    for (const c of positions) {
      // Skip the three corners, where the finder patterns already are.
      if (matrix[r][c] !== null) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const edge = Math.max(Math.abs(dr), Math.abs(dc));
          matrix[r + dr][c + dc] = edge !== 1;
        }
      }
    }
  }
}

function placeTiming(matrix) {
  for (let i = 8; i < matrix.length - 8; i++) {
    const on = i % 2 === 0;
    if (matrix[6][i] === null) matrix[6][i] = on;
    if (matrix[i][6] === null) matrix[i][6] = on;
  }
}

/** Reserve the format and version areas so data placement skips them. */
function reserveInfoAreas(matrix, version) {
  const size = matrix.length;
  for (let i = 0; i < 9; i++) {
    if (matrix[8][i] === null) matrix[8][i] = false;
    if (matrix[i][8] === null) matrix[i][8] = false;
  }
  for (let i = 0; i < 8; i++) {
    if (matrix[8][size - 1 - i] === null) matrix[8][size - 1 - i] = false;
    if (matrix[size - 1 - i][8] === null) matrix[size - 1 - i][8] = false;
  }
  matrix[size - 8][8] = true; // the always-dark module

  if (version >= 7) {
    for (let i = 0; i < 18; i++) {
      const r = Math.floor(i / 3);
      const c = size - 11 + (i % 3);
      matrix[r][c] = false;
      matrix[c][r] = false;
    }
  }
}

/** Walk the zigzag, two columns at a time, right to left, filling data bits. */
function placeData(matrix, codewords) {
  const size = matrix.length;
  let bitIndex = 0;
  const totalBits = codewords.length * 8;
  const nextBit = () => {
    if (bitIndex >= totalBits) return false; // remainder bits are zero
    const bit = (codewords[bitIndex >> 3] >> (7 - (bitIndex & 7))) & 1;
    bitIndex++;
    return bit === 1;
  };

  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5; // the vertical timing column is skipped
    for (let step = 0; step < size; step++) {
      const row = upward ? size - 1 - step : step;
      for (const col of [right, right - 1]) {
        if (matrix[row][col] === null) matrix[row][col] = nextBit();
      }
    }
    upward = !upward;
  }
}

function writeFormatInfo(matrix, maskIndex) {
  const size = matrix.length;
  const bits = FORMAT_INFO_M[maskIndex];
  // The 15 bits go in twice, least significant bit first. Copy one runs down
  // column 8 past the top-left finder; copy two runs along row 8 from the
  // right-hand edge. Both skip the timing row/column at index 6.
  for (let i = 0; i < 15; i++) {
    const on = ((bits >> i) & 1) === 1;

    if (i < 6) matrix[i][8] = on;
    else if (i < 8) matrix[i + 1][8] = on;
    else matrix[size - 15 + i][8] = on;

    if (i < 8) matrix[8][size - 1 - i] = on;
    else if (i === 8) matrix[8][7] = on;
    else matrix[8][14 - i] = on;
  }
  matrix[size - 8][8] = true; // the always-dark module
}

function writeVersionInfo(matrix, version) {
  if (version < 7) return;
  const size = matrix.length;
  const bits = VERSION_INFO[version];
  for (let i = 0; i < 18; i++) {
    const on = ((bits >> i) & 1) === 1;
    const r = Math.floor(i / 3);
    const c = size - 11 + (i % 3);
    matrix[r][c] = on;
    matrix[c][r] = on;
  }
}

/** Which modules are structure rather than data — masking must leave them be. */
function functionMask(version) {
  const size = version * 4 + 17;
  const m = emptyMatrix(size);
  placeFinder(m, 0, 0);
  placeFinder(m, 0, size - 7);
  placeFinder(m, size - 7, 0);
  placeAlignment(m, version);
  placeTiming(m);
  reserveInfoAreas(m, version);
  return m.map((row) => row.map((v) => v !== null));
}

// ------------------------------------------------------------------ masking

function applyMask(matrix, isFunction, maskIndex) {
  const fn = MASK_FUNCTIONS[maskIndex];
  const out = matrix.map((row) => row.slice());
  for (let r = 0; r < out.length; r++) {
    for (let c = 0; c < out.length; c++) {
      if (!isFunction[r][c] && fn(r, c)) out[r][c] = !out[r][c];
    }
  }
  return out;
}

/** The four penalty rules from the spec; lowest total wins. */
function penalty(matrix) {
  const size = matrix.length;
  let score = 0;

  // Rule 1: runs of five or more of the same colour, in rows and columns.
  for (const transposed of [false, true]) {
    for (let a = 0; a < size; a++) {
      let run = 1;
      let prev = transposed ? matrix[0][a] : matrix[a][0];
      for (let b = 1; b < size; b++) {
        const value = transposed ? matrix[b][a] : matrix[a][b];
        if (value === prev) {
          run++;
        } else {
          if (run >= 5) score += run - 2;
          prev = value;
          run = 1;
        }
      }
      if (run >= 5) score += run - 2;
    }
  }

  // Rule 2: every 2x2 block of one colour.
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = matrix[r][c];
      if (v === matrix[r][c + 1] && v === matrix[r + 1][c] && v === matrix[r + 1][c + 1]) score += 3;
    }
  }

  // Rule 3: the finder-lookalike pattern, which confuses scanners.
  const patternA = [true, false, true, true, true, false, true, false, false, false, false];
  const patternB = [false, false, false, false, true, false, true, true, true, false, true];
  const matches = (get, start) => {
    const window = [];
    for (let i = 0; i < 11; i++) window.push(get(start + i));
    return (
      window.every((v, i) => v === patternA[i]) || window.every((v, i) => v === patternB[i])
    );
  };
  for (let a = 0; a < size; a++) {
    for (let b = 0; b <= size - 11; b++) {
      if (matches((i) => matrix[a][i], b)) score += 40;
      if (matches((i) => matrix[i][a], b)) score += 40;
    }
  }

  // Rule 4: how far off a 50/50 light/dark balance the whole code is.
  let dark = 0;
  for (const row of matrix) for (const v of row) if (v) dark++;
  const percent = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(percent - 50) / 5) * 10;

  return score;
}

// ------------------------------------------------------------- public entry

/**
 * Encode text as a QR matrix.
 * @param {string} text
 * @returns {{matrix: boolean[][], size: number, version: number, mask: number}}
 */
export function encodeQr(text) {
  const bytes = Array.from(new TextEncoder().encode(String(text)));
  const version = chooseVersion(bytes.length);
  const size = version * 4 + 17;

  const codewords = interleave(buildDataCodewords(bytes, version), version);

  const base = emptyMatrix(size);
  placeFinder(base, 0, 0);
  placeFinder(base, 0, size - 7);
  placeFinder(base, size - 7, 0);
  placeAlignment(base, version);
  placeTiming(base);
  reserveInfoAreas(base, version);
  const isFunction = functionMask(version);
  placeData(base, codewords);

  let best = null;
  for (let mask = 0; mask < 8; mask++) {
    const candidate = applyMask(base, isFunction, mask);
    writeFormatInfo(candidate, mask);
    writeVersionInfo(candidate, version);
    const score = penalty(candidate);
    if (!best || score < best.score) best = { matrix: candidate, score, mask };
  }

  return { matrix: best.matrix, size, version, mask: best.mask };
}

/**
 * QR as an SVG string. One path for every dark module, which keeps the file
 * small and lets it scale to any projector without going fuzzy.
 *
 * @param {string} text
 * @param {object} [opts]
 * @param {number} [opts.margin] quiet zone in modules (4 is the spec minimum)
 * @param {string} [opts.dark]
 * @param {string} [opts.light]
 */
export function toSvg(text, { margin = 4, dark = '#000000', light = '#ffffff' } = {}) {
  const { matrix, size } = encodeQr(text);
  const total = size + margin * 2;
  const parts = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r][c]) parts.push(`M${c + margin} ${r + margin}h1v1h-1z`);
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" ` +
    `shape-rendering="crispEdges" role="img" aria-label="QR code to join the quiz">` +
    `<rect width="${total}" height="${total}" fill="${light}"/>` +
    `<path fill="${dark}" d="${parts.join('')}"/>` +
    `</svg>`
  );
}
