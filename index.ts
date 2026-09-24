/*!
 * qr-generator (ISO/IEC 18004) — Zero-dependency TypeScript QR Code generator
 *
 * Implements mode selection, Reed-Solomon error correction, module placement,
 * all 8 masks with penalty scoring, and format/version information.
 * Pure TypeScript with zero runtime dependencies.
 */

// ---------------------------------------------------------------------------
// Types & Interfaces
// ---------------------------------------------------------------------------

export type ErrorCorrectionLevel = "L" | "M" | "Q" | "H";
export type MaskPattern = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type Mode = "numeric" | "alphanumeric" | "byte";

export interface QRCodeOptions {
  errorCorrectionLevel?: ErrorCorrectionLevel;
  minVersion?: number;
  maxVersion?: number;
  maskPattern?: MaskPattern;
}

export interface QRCodeResult {
  version: number;
  size: number;
  errorCorrectionLevel: ErrorCorrectionLevel;
  maskPattern: MaskPattern;
  modules: boolean[][];
}

export interface RenderOptions {
  margin?: number;
  scale?: number;
  darkColor?: string;
  lightColor?: string;
}

export interface AsciiOptions {
  margin?: number;
}

// ---------------------------------------------------------------------------
// Error correction codeword / block table (ISO/IEC 18004 Annex, versions 1-40)
// Per version, per level [L, M, Q, H]:
//   [ecCodewordsPerBlock, group1Blocks, group1DataCodewords, group2Blocks, group2DataCodewords]
// ---------------------------------------------------------------------------

// prettier-ignore
const ECC_TABLE: readonly (readonly [number, number, number, number, number])[][] = [
  /* 1 */  [[7,1,19,0,0],[10,1,16,0,0],[13,1,13,0,0],[17,1,9,0,0]],
  /* 2 */  [[10,1,34,0,0],[16,1,28,0,0],[22,1,22,0,0],[28,1,16,0,0]],
  /* 3 */  [[15,1,55,0,0],[26,1,44,0,0],[18,2,17,0,0],[22,2,13,0,0]],
  /* 4 */  [[20,1,80,0,0],[18,2,32,0,0],[26,2,24,0,0],[16,4,9,0,0]],
  /* 5 */  [[26,1,108,0,0],[24,2,43,0,0],[18,2,15,2,16],[22,2,11,2,12]],
  /* 6 */  [[18,2,68,0,0],[16,4,27,0,0],[24,4,19,0,0],[28,4,15,0,0]],
  /* 7 */  [[20,2,78,0,0],[18,4,31,0,0],[18,2,14,4,15],[26,4,13,1,14]],
  /* 8 */  [[24,2,97,0,0],[22,2,38,2,39],[22,4,18,2,19],[26,4,14,2,15]],
  /* 9 */  [[30,2,116,0,0],[22,3,36,2,37],[20,4,16,4,17],[24,4,12,4,13]],
  /* 10 */ [[18,2,68,2,69],[26,4,43,1,44],[24,6,19,2,20],[28,6,15,2,16]],
  /* 11 */ [[20,4,81,0,0],[30,1,50,4,51],[28,4,22,4,23],[24,3,12,8,13]],
  /* 12 */ [[24,2,92,2,93],[22,6,36,2,37],[26,4,20,6,21],[28,7,14,4,15]],
  /* 13 */ [[26,4,107,0,0],[22,8,37,1,38],[24,8,20,4,21],[22,12,11,4,12]],
  /* 14 */ [[30,3,115,1,116],[24,4,40,5,41],[20,11,16,5,17],[24,11,12,5,13]],
  /* 15 */ [[22,5,87,1,88],[24,5,41,5,42],[30,5,24,7,25],[24,11,12,7,13]],
  /* 16 */ [[24,5,98,1,99],[28,7,45,3,46],[24,15,19,2,20],[30,3,15,13,16]],
  /* 17 */ [[28,1,107,5,108],[28,10,46,1,47],[28,1,22,15,23],[28,2,14,17,15]],
  /* 18 */ [[30,5,120,1,121],[26,9,43,4,44],[28,17,22,1,23],[28,2,14,19,15]],
  /* 19 */ [[28,3,113,4,114],[26,3,44,11,45],[26,17,21,4,22],[26,9,13,16,14]],
  /* 20 */ [[28,3,107,5,108],[26,3,41,13,42],[30,15,24,5,25],[28,15,15,10,16]],
  /* 21 */ [[28,4,116,4,117],[26,17,42,0,0],[28,17,22,6,23],[30,19,16,6,17]],
  /* 22 */ [[28,2,111,7,112],[28,17,46,0,0],[30,7,24,16,25],[24,34,13,0,0]],
  /* 23 */ [[30,4,121,5,122],[28,4,47,14,48],[30,11,24,14,25],[30,16,15,14,16]],
  /* 24 */ [[30,6,117,4,118],[28,6,45,14,46],[30,11,24,16,25],[30,30,16,2,17]],
  /* 25 */ [[26,8,106,4,107],[28,8,47,13,48],[30,7,24,22,25],[30,22,15,13,16]],
  /* 26 */ [[28,10,114,2,115],[28,19,46,4,47],[28,28,22,6,23],[30,33,16,4,17]],
  /* 27 */ [[30,8,122,4,123],[28,22,45,3,46],[30,8,23,26,24],[30,12,15,28,16]],
  /* 28 */ [[30,3,117,10,118],[28,3,45,23,46],[30,4,24,31,25],[30,11,15,31,16]],
  /* 29 */ [[30,7,116,7,117],[28,21,45,7,46],[30,1,23,37,24],[30,19,15,26,16]],
  /* 30 */ [[30,5,115,10,116],[28,19,47,10,48],[30,15,24,25,25],[30,23,15,25,16]],
  /* 31 */ [[30,13,115,3,116],[28,2,46,29,47],[30,42,24,1,25],[30,23,15,28,16]],
  /* 32 */ [[30,17,115,0,0],[28,10,46,23,47],[30,10,24,35,25],[30,19,15,35,16]],
  /* 33 */ [[30,17,115,1,116],[28,14,46,21,47],[30,29,24,19,25],[30,11,15,46,16]],
  /* 34 */ [[30,13,115,6,116],[28,14,46,23,47],[30,44,24,7,25],[30,59,16,1,17]],
  /* 35 */ [[30,12,121,7,122],[28,12,47,26,48],[30,39,24,14,25],[30,22,15,41,16]],
  /* 36 */ [[30,6,121,14,122],[28,6,47,34,48],[30,46,24,10,25],[30,2,15,64,16]],
  /* 37 */ [[30,17,122,4,123],[28,29,46,14,47],[30,49,24,10,25],[30,24,15,46,16]],
  /* 38 */ [[30,4,122,18,123],[28,13,46,32,47],[30,48,24,14,25],[30,42,15,32,16]],
  /* 39 */ [[30,20,117,4,118],[28,40,47,7,48],[30,43,24,22,25],[30,10,15,67,16]],
  /* 40 */ [[30,19,118,6,119],[28,18,47,31,48],[30,34,24,34,25],[30,20,15,61,16]],
];

const LEVEL_INDEX: Record<ErrorCorrectionLevel, number> = { L: 0, M: 1, Q: 2, H: 3 };
const LEVEL_FORMAT_BITS: Record<ErrorCorrectionLevel, number> = { L: 1, M: 0, Q: 3, H: 2 };

// Alignment pattern center coordinates per version (index 0 and 1 empty; version 1 has none).
// prettier-ignore
const ALIGNMENT_COORDS: readonly (readonly number[])[] = [
  [], [],
  [6,18],[6,22],[6,26],[6,30],[6,34],
  [6,22,38],[6,24,42],[6,26,46],[6,28,50],[6,30,54],[6,32,58],[6,34,62],
  [6,26,46,66],[6,26,48,70],[6,26,50,74],[6,30,54,78],[6,30,56,82],[6,30,58,86],[6,34,62,90],
  [6,28,50,72,94],[6,26,50,74,98],[6,30,54,78,102],[6,28,54,80,106],[6,32,58,84,110],[6,30,58,86,114],[6,34,62,90,118],
  [6,26,50,74,98,122],[6,30,54,78,102,126],[6,26,52,78,104,130],[6,30,56,82,108,134],[6,34,60,86,112,138],
  [6,30,58,86,114,142],[6,34,62,90,118,146],
  [6,30,54,78,102,126,150],[6,24,50,76,102,128,154],[6,28,54,80,106,132,158],[6,32,58,84,110,136,162],
  [6,26,54,82,110,138,166],[6,30,58,86,114,142,170],
];

// ---------------------------------------------------------------------------
// GF(256) arithmetic for Reed-Solomon error correction (primitive poly 0x11D)
// ---------------------------------------------------------------------------

const GF_EXP = new Uint8Array(256);
const GF_LOG = new Uint8Array(256);
(function initGaloisField(): void {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[(GF_LOG[a]! + GF_LOG[b]!) % 255]!;
}

/** Builds the Reed-Solomon generator polynomial of the given degree, coefficients highest-degree first. */
function rsGeneratorPolynomial(degree: number): number[] {
  let poly: number[] = [1];
  for (let i = 0; i < degree; i++) {
    const next: number[] = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j]!;
      next[j + 1] ^= gfMul(poly[j]!, GF_EXP[i]!);
    }
    poly = next;
  }
  return poly;
}

/** Computes Reed-Solomon error-correction codewords for one block of data codewords. */
function rsComputeRemainder(dataCodewords: number[], ecCount: number): number[] {
  const generator = rsGeneratorPolynomial(ecCount);
  const register: number[] = new Array(ecCount).fill(0);
  for (const dataByte of dataCodewords) {
    const factor = dataByte ^ register[0]!;
    register.shift();
    register.push(0);
    if (factor !== 0) {
      for (let i = 0; i < ecCount; i++) {
        register[i] ^= gfMul(generator[i + 1]!, factor);
      }
    }
  }
  return register;
}

// ---------------------------------------------------------------------------
// Bit buffer
// ---------------------------------------------------------------------------

export class BitBuffer {
  private bits: number[] = [];

  get length(): number {
    return this.bits.length;
  }

  pushBits(value: number, length: number): void {
    for (let i = length - 1; i >= 0; i--) {
      this.bits.push((value >>> i) & 1);
    }
  }

  pushBit(bit: number): void {
    this.bits.push(bit & 1);
  }

  toBytes(): number[] {
    const bytes: number[] = [];
    for (let i = 0; i < this.bits.length; i += 8) {
      let byte = 0;
      for (let j = 0; j < 8; j++) {
        byte = (byte << 1) | (this.bits[i + j] ?? 0);
      }
      bytes.push(byte);
    }
    return bytes;
  }

  getBits(): number[] {
    return this.bits;
  }
}

// ---------------------------------------------------------------------------
// Mode detection & segment bit-cost calculation
// ---------------------------------------------------------------------------

const MODE_INDICATOR: Record<Mode, number> = { numeric: 0b0001, alphanumeric: 0b0010, byte: 0b0100 };

const ALPHANUMERIC_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";
const ALPHANUMERIC_VALUES: Record<string, number> = {};
for (let i = 0; i < ALPHANUMERIC_CHARS.length; i++) {
  ALPHANUMERIC_VALUES[ALPHANUMERIC_CHARS[i]!] = i;
}

function isNumeric(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 48 || c > 57) return false;
  }
  return true;
}

function isAlphanumeric(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    if (!(text[i]! in ALPHANUMERIC_VALUES)) return false;
  }
  return true;
}

export function detectMode(text: string): Mode {
  if (text.length > 0 && isNumeric(text)) return "numeric";
  if (text.length > 0 && isAlphanumeric(text)) return "alphanumeric";
  return "byte";
}

function utf8Bytes(text: string): number[] {
  return Array.from(new TextEncoder().encode(text));
}

/** Character-count-indicator bit length for a given mode and version. */
function charCountBits(mode: Mode, version: number): number {
  if (version <= 9) return mode === "numeric" ? 10 : mode === "alphanumeric" ? 9 : 8;
  if (version <= 26) return mode === "numeric" ? 12 : mode === "alphanumeric" ? 11 : 16;
  return mode === "numeric" ? 14 : mode === "alphanumeric" ? 13 : 16;
}

/** Bits required to encode the payload (excluding mode indicator + char count indicator). */
function payloadBitLength(mode: Mode, charCount: number, byteLength: number): number {
  if (mode === "numeric") {
    const n = charCount;
    return 10 * Math.floor(n / 3) + (n % 3 === 2 ? 7 : n % 3 === 1 ? 4 : 0);
  }
  if (mode === "alphanumeric") {
    const n = charCount;
    return 11 * Math.floor(n / 2) + (n % 2 === 1 ? 6 : 0);
  }
  return 8 * byteLength;
}

// ---------------------------------------------------------------------------
// Capacity lookup (derived from ECC_TABLE)
// ---------------------------------------------------------------------------

function totalDataCodewords(version: number, level: ErrorCorrectionLevel): number {
  const row = ECC_TABLE[version - 1]![LEVEL_INDEX[level]]!;
  const [, g1blocks, g1data, g2blocks, g2data] = row;
  return g1blocks * g1data + g2blocks * g2data;
}

/** Picks the smallest version (within [minVersion,maxVersion]) whose capacity fits the payload. */
function selectVersion(
  mode: Mode,
  charCount: number,
  byteLength: number,
  level: ErrorCorrectionLevel,
  minVersion: number,
  maxVersion: number,
): number {
  for (let v = minVersion; v <= maxVersion; v++) {
    const capacityBits = totalDataCodewords(v, level) * 8;
    const needed = 4 + charCountBits(mode, v) + payloadBitLength(mode, charCount, byteLength);
    if (needed <= capacityBits) return v;
  }
  throw new Error(
    `Input too long to fit in a QR code at error correction level ${level} (up to version ${maxVersion}). ` +
      `Try a lower error correction level or shorter input.`,
  );
}

// ---------------------------------------------------------------------------
// Data codeword construction
// ---------------------------------------------------------------------------

function encodeSegment(buffer: BitBuffer, text: string, mode: Mode, version: number): void {
  buffer.pushBits(MODE_INDICATOR[mode], 4);

  if (mode === "numeric") {
    buffer.pushBits(text.length, charCountBits(mode, version));
    for (let i = 0; i < text.length; i += 3) {
      const group = text.slice(i, i + 3);
      const bits = group.length === 3 ? 10 : group.length === 2 ? 7 : 4;
      buffer.pushBits(parseInt(group, 10), bits);
    }
  } else if (mode === "alphanumeric") {
    buffer.pushBits(text.length, charCountBits(mode, version));
    for (let i = 0; i < text.length; i += 2) {
      if (i + 1 < text.length) {
        const value = ALPHANUMERIC_VALUES[text[i]!]! * 45 + ALPHANUMERIC_VALUES[text[i + 1]!]!;
        buffer.pushBits(value, 11);
      } else {
        buffer.pushBits(ALPHANUMERIC_VALUES[text[i]!]!, 6);
      }
    }
  } else {
    const bytes = utf8Bytes(text);
    buffer.pushBits(bytes.length, charCountBits(mode, version));
    for (const b of bytes) buffer.pushBits(b, 8);
  }
}

function buildDataCodewords(text: string, version: number, level: ErrorCorrectionLevel): number[] {
  const mode = detectMode(text);
  const buffer = new BitBuffer();
  encodeSegment(buffer, text, mode, version);

  const capacityBits = totalDataCodewords(version, level) * 8;

  // Terminator (up to 4 zero bits).
  const terminatorLength = Math.min(4, capacityBits - buffer.length);
  if (terminatorLength > 0) buffer.pushBits(0, terminatorLength);

  // Pad to a byte boundary.
  while (buffer.length % 8 !== 0) buffer.pushBit(0);

  // Pad with alternating bytes until capacity is filled.
  const padBytes = [0xec, 0x11];
  let padIndex = 0;
  while (buffer.length < capacityBits) {
    buffer.pushBits(padBytes[padIndex % 2]!, 8);
    padIndex++;
  }

  return buffer.toBytes();
}

/** Splits data codewords into blocks, computes RS codewords, and interleaves everything. */
function buildFinalCodewords(dataCodewords: number[], version: number, level: ErrorCorrectionLevel): number[] {
  const [ecCount, g1blocks, g1data, g2blocks, g2data] = ECC_TABLE[version - 1]![LEVEL_INDEX[level]]!;

  const dataBlocks: number[][] = [];
  const ecBlocks: number[][] = [];
  let offset = 0;
  for (let i = 0; i < g1blocks; i++) {
    const block = dataCodewords.slice(offset, offset + g1data);
    offset += g1data;
    dataBlocks.push(block);
    ecBlocks.push(rsComputeRemainder(block, ecCount));
  }
  for (let i = 0; i < g2blocks; i++) {
    const block = dataCodewords.slice(offset, offset + g2data);
    offset += g2data;
    dataBlocks.push(block);
    ecBlocks.push(rsComputeRemainder(block, ecCount));
  }

  const result: number[] = [];
  const maxDataLen = Math.max(g1data, g2data);
  for (let i = 0; i < maxDataLen; i++) {
    for (const block of dataBlocks) {
      if (i < block.length) result.push(block[i]!);
    }
  }
  for (let i = 0; i < ecCount; i++) {
    for (const block of ecBlocks) {
      result.push(block[i]!);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Matrix construction
// ---------------------------------------------------------------------------

export class Matrix {
  readonly size: number;
  readonly dark: boolean[][];
  readonly isFunction: boolean[][];

  constructor(size: number) {
    this.size = size;
    this.dark = Array.from({ length: size }, () => new Array(size).fill(false));
    this.isFunction = Array.from({ length: size }, () => new Array(size).fill(false));
  }

  setFunction(row: number, col: number, isDark: boolean): void {
    this.dark[row]![col] = isDark;
    this.isFunction[row]![col] = true;
  }

  drawFinderPattern(topRow: number, topCol: number): void {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = topRow + dr;
        const c = topCol + dc;
        if (r < 0 || r >= this.size || c < 0 || c >= this.size) continue;
        const inCore = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
        let isDark = false;
        if (inCore) {
          const ring = Math.max(Math.abs(dr - 3), Math.abs(dc - 3));
          isDark = ring === 3 || ring <= 1;
        }
        this.setFunction(r, c, isDark);
      }
    }
  }

  drawTimingPatterns(): void {
    for (let i = 8; i < this.size - 8; i++) {
      const isDark = i % 2 === 0;
      if (!this.isFunction[6]![i]) this.setFunction(6, i, isDark);
      if (!this.isFunction[i]![6]) this.setFunction(i, 6, isDark);
    }
  }

  drawAlignmentPatterns(version: number): void {
    const coords = ALIGNMENT_COORDS[version];
    if (!coords || coords.length === 0) return;
    for (const row of coords) {
      for (const col of coords) {
        // Skip positions that would collide with a finder pattern + separator.
        const nearTopLeft = row < 9 && col < 9;
        const nearTopRight = row < 9 && col > this.size - 9;
        const nearBottomLeft = row > this.size - 9 && col < 9;
        if (nearTopLeft || nearTopRight || nearBottomLeft) continue;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const ring = Math.max(Math.abs(dr), Math.abs(dc));
            this.setFunction(row + dr, col + dc, ring !== 1);
          }
        }
      }
    }
  }

  drawFunctionPatterns(version: number): void {
    this.drawFinderPattern(0, 0);
    this.drawFinderPattern(0, this.size - 7);
    this.drawFinderPattern(this.size - 7, 0);
    this.drawTimingPatterns();
    this.drawAlignmentPatterns(version);

    // Reserve format info areas (placeholder false; real bits written after mask selection).
    for (let i = 0; i <= 8; i++) {
      if (!this.isFunction[8]![i]) this.setFunction(8, i, false);
      if (!this.isFunction[i]![8]) this.setFunction(i, 8, false);
    }
    for (let i = 0; i < 8; i++) {
      this.setFunction(8, this.size - 1 - i, false);
      this.setFunction(this.size - 1 - i, 8, false);
    }

    // Dark module — always dark.
    this.setFunction(this.size - 8, 8, true);

    // Reserve version info areas for version >= 7.
    if (version >= 7) {
      for (let r = 0; r < 6; r++) {
        for (let c = 0; c < 3; c++) {
          this.setFunction(r, this.size - 11 + c, false);
          this.setFunction(this.size - 11 + c, r, false);
        }
      }
    }
  }

  /** Places data bits (MSB-first per codeword) into non-function modules using the zigzag scan. */
  placeData(codewords: number[]): void {
    const bits: number[] = [];
    for (const byte of codewords) {
      for (let i = 7; i >= 0; i--) bits.push((byte >>> i) & 1);
    }

    let bitIndex = 0;
    let dir = -1; // -1 = moving up, +1 = moving down
    let row = this.size - 1;
    for (let colRight = this.size - 1; colRight >= 1; colRight -= 2) {
      if (colRight === 6) colRight = 5; // skip vertical timing column
      for (;;) {
        for (let j = 0; j < 2; j++) {
          const col = colRight - j;
          if (!this.isFunction[row]![col]) {
            const bit = bitIndex < bits.length ? bits[bitIndex]! : 0;
            this.dark[row]![col] = bit === 1;
            bitIndex++;
          }
        }
        const next = row + dir;
        if (next < 0 || next >= this.size) {
          dir = -dir;
          break;
        }
        row = next;
      }
    }
  }

  maskCondition(mask: number, row: number, col: number): boolean {
    switch (mask) {
      case 0:
        return (row + col) % 2 === 0;
      case 1:
        return row % 2 === 0;
      case 2:
        return col % 3 === 0;
      case 3:
        return (row + col) % 3 === 0;
      case 4:
        return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0;
      case 5:
        return ((row * col) % 2) + ((row * col) % 3) === 0;
      case 6:
        return (((row * col) % 2) + ((row * col) % 3)) % 2 === 0;
      case 7:
        return (((row + col) % 2) + ((row * col) % 3)) % 2 === 0;
      default:
        throw new Error(`Invalid mask pattern ${mask}`);
    }
  }

  applyMask(mask: number): void {
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        if (this.isFunction[row]![col]) continue;
        if (this.maskCondition(mask, row, col)) {
          this.dark[row]![col] = !this.dark[row]![col];
        }
      }
    }
  }

  penaltyScore(): number {
    let penalty = 0;
    const n = this.size;

    // Rule 1: runs of 5+ same-color modules, per row and per column.
    for (let row = 0; row < n; row++) {
      let runLength = 1;
      for (let col = 1; col < n; col++) {
        if (this.dark[row]![col] === this.dark[row]![col - 1]) {
          runLength++;
        } else {
          if (runLength >= 5) penalty += 3 + (runLength - 5);
          runLength = 1;
        }
      }
      if (runLength >= 5) penalty += 3 + (runLength - 5);
    }
    for (let col = 0; col < n; col++) {
      let runLength = 1;
      for (let row = 1; row < n; row++) {
        if (this.dark[row]![col] === this.dark[row - 1]![col]) {
          runLength++;
        } else {
          if (runLength >= 5) penalty += 3 + (runLength - 5);
          runLength = 1;
        }
      }
      if (runLength >= 5) penalty += 3 + (runLength - 5);
    }

    // Rule 2: 2x2 blocks of the same color.
    for (let row = 0; row < n - 1; row++) {
      for (let col = 0; col < n - 1; col++) {
        const c = this.dark[row]![col];
        if (
          this.dark[row]![col + 1] === c &&
          this.dark[row + 1]![col] === c &&
          this.dark[row + 1]![col + 1] === c
        ) {
          penalty += 3;
        }
      }
    }

    // Rule 3: finder-like 1:1:3:1:1 patterns, with 4 light modules on one side.
    const patternA = [true, false, true, true, true, false, true, false, false, false, false];
    const patternB = [false, false, false, false, true, false, true, true, true, false, true];
    const matchesAt = (getModule: (k: number) => boolean): boolean => {
      for (let k = 0; k < 11; k++) {
        if (getModule(k) !== patternA[k]) break;
        if (k === 10) return true;
      }
      for (let k = 0; k < 11; k++) {
        if (getModule(k) !== patternB[k]) break;
        if (k === 10) return true;
      }
      return false;
    };
    for (let row = 0; row < n; row++) {
      for (let col = 0; col <= n - 11; col++) {
        if (matchesAt((k) => this.dark[row]![col + k]!)) penalty += 40;
      }
    }
    for (let col = 0; col < n; col++) {
      for (let row = 0; row <= n - 11; row++) {
        if (matchesAt((k) => this.dark[row + k]![col]!)) penalty += 40;
      }
    }

    // Rule 4: proportion of dark modules deviating from 50%.
    let darkCount = 0;
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        if (this.dark[row]![col]) darkCount++;
      }
    }
    const percentDark = (darkCount * 100) / (n * n);
    const deviation = Math.abs(percentDark - 50);
    penalty += Math.floor(deviation / 5) * 10;

    return penalty;
  }

  private getBit(value: number, i: number): boolean {
    return ((value >>> i) & 1) === 1;
  }

  drawFormatInfo(level: ErrorCorrectionLevel, mask: number): void {
    const data = (LEVEL_FORMAT_BITS[level] << 3) | mask;
    const remainder = bchRemainder(data, 0x537, 10);
    let bits = (data << 10) | remainder;
    bits ^= 0x5412;

    for (let i = 0; i <= 5; i++) this.setFunction(i, 8, this.getBit(bits, i));
    this.setFunction(7, 8, this.getBit(bits, 6));
    this.setFunction(8, 8, this.getBit(bits, 7));
    this.setFunction(8, 7, this.getBit(bits, 8));
    for (let i = 9; i < 15; i++) this.setFunction(8, 14 - i, this.getBit(bits, i));

    for (let i = 0; i < 8; i++) this.setFunction(8, this.size - 1 - i, this.getBit(bits, i));
    for (let i = 8; i < 15; i++) this.setFunction(this.size - 15 + i, 8, this.getBit(bits, i));
  }

  drawVersionInfo(version: number): void {
    if (version < 7) return;
    const remainder = bchRemainder(version, 0x1f25, 12);
    const bits = (version << 12) | remainder;

    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 3; c++) {
        const idx = r * 3 + c;
        this.setFunction(r, this.size - 11 + c, this.getBit(bits, idx));
        this.setFunction(this.size - 11 + c, r, this.getBit(bits, idx));
      }
    }
  }
}

/** Binary polynomial (BCH) division remainder, used for format/version info error correction. */
function bchRemainder(data: number, generator: number, ecBits: number): number {
  let value = data << ecBits;
  const generatorDegree = 32 - Math.clz32(generator) - 1;
  while (32 - Math.clz32(value) - 1 >= generatorDegree && value !== 0) {
    const shift = 32 - Math.clz32(value) - generatorDegree - 1;
    value ^= generator << shift;
  }
  return value;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generates a QR code matrix for the given text.
 * Automatically picks the smallest version that fits, the requested error
 * correction level (default "M"), and the lowest-penalty mask pattern.
 */
export function generateQRCode(text: string, options: QRCodeOptions = {}): QRCodeResult {
  const level: ErrorCorrectionLevel = options.errorCorrectionLevel ?? "M";
  const minVersion = options.minVersion ?? 1;
  const maxVersion = options.maxVersion ?? 40;
  if (minVersion < 1 || maxVersion > 40 || minVersion > maxVersion) {
    throw new Error("minVersion/maxVersion must be within 1-40 and minVersion <= maxVersion");
  }

  const mode = detectMode(text);
  const byteLength = mode === "byte" ? utf8Bytes(text).length : 0;
  const charCount = mode === "byte" ? byteLength : text.length;

  const version = selectVersion(mode, charCount, byteLength, level, minVersion, maxVersion);
  const dataCodewords = buildDataCodewords(text, version, level);
  const finalCodewords = buildFinalCodewords(dataCodewords, version, level);

  const size = 4 * version + 17;
  const matrix = new Matrix(size);
  matrix.drawFunctionPatterns(version);
  matrix.placeData(finalCodewords);

  let chosenMask = options.maskPattern;
  if (chosenMask === undefined) {
    let bestPenalty = Infinity;
    let bestMask = 0;
    for (let mask = 0; mask < 8; mask++) {
      matrix.applyMask(mask);
      const penalty = matrix.penaltyScore();
      matrix.applyMask(mask); // undo (masking twice restores original since it's an XOR)
      if (penalty < bestPenalty) {
        bestPenalty = penalty;
        bestMask = mask;
      }
    }
    chosenMask = bestMask as MaskPattern;
  }

  matrix.applyMask(chosenMask);
  matrix.drawFormatInfo(level, chosenMask);
  matrix.drawVersionInfo(version);

  return {
    version,
    size,
    errorCorrectionLevel: level,
    maskPattern: chosenMask,
    modules: matrix.dark,
  };
}

/**
 * Compatibility wrapper returning 2D binary matrix (1 for dark, 0 for light).
 */
export function generateQrMatrix(text: string, options: QRCodeOptions = {}): (0 | 1)[][] {
  const qr = generateQRCode(text, options);
  return qr.modules.map((row) => row.map((cell) => (cell ? 1 : 0)));
}

// ---------------------------------------------------------------------------
// Renderers
// ---------------------------------------------------------------------------

/** Renders a QR matrix to a self-contained SVG string. */
export function toSVG(qr: QRCodeResult, options: RenderOptions = {}): string {
  const margin = options.margin ?? 4;
  const scale = options.scale ?? 8;
  const dark = options.darkColor ?? "#000000";
  const light = options.lightColor ?? "#ffffff";

  const dimension = (qr.size + margin * 2) * scale;
  let path = "";
  for (let row = 0; row < qr.size; row++) {
    for (let col = 0; col < qr.size; col++) {
      if (qr.modules[row]![col]) {
        const x = (col + margin) * scale;
        const y = (row + margin) * scale;
        path += `M${x},${y}h${scale}v${scale}h${-scale}z`;
      }
    }
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dimension} ${dimension}" width="${dimension}" height="${dimension}" shape-rendering="crispEdges">` +
    `<rect width="100%" height="100%" fill="${light}"/>` +
    `<path d="${path}" fill="${dark}"/>` +
    `</svg>`
  );
}

/** Renders a QR matrix onto an existing <canvas> element (browser only). */
export function toCanvas(
  qr: QRCodeResult,
  canvas: HTMLCanvasElement,
  options: RenderOptions = {},
): void {
  const margin = options.margin ?? 4;
  const scale = options.scale ?? 8;
  const dark = options.darkColor ?? "#000000";
  const light = options.lightColor ?? "#ffffff";
  const dimension = (qr.size + margin * 2) * scale;

  canvas.width = dimension;
  canvas.height = dimension;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context not available");

  ctx.fillStyle = light;
  ctx.fillRect(0, 0, dimension, dimension);
  ctx.fillStyle = dark;
  for (let row = 0; row < qr.size; row++) {
    for (let col = 0; col < qr.size; col++) {
      if (qr.modules[row]![col]) {
        ctx.fillRect((col + margin) * scale, (row + margin) * scale, scale, scale);
      }
    }
  }
}

/** Renders a QR matrix as a PNG data URL (browser only; uses an offscreen canvas). */
export function toDataURL(qr: QRCodeResult, options: RenderOptions = {}): string {
  if (typeof document === "undefined" || !document.createElement) {
    throw new Error("toDataURL is only supported in browser environments with DOM Canvas support.");
  }
  const canvas = document.createElement("canvas");
  toCanvas(qr, canvas, options);
  return canvas.toDataURL("image/png");
}

/** Renders a QR matrix as two-row-per-line ASCII art, handy for terminal debugging. */
export function toASCII(qr: QRCodeResult, options: AsciiOptions = {}): string {
  const margin = options.margin ?? 2;
  const size = qr.size + margin * 2;
  const get = (row: number, col: number): boolean => {
    const r = row - margin;
    const c = col - margin;
    if (r < 0 || r >= qr.size || c < 0 || c >= qr.size) return false;
    return qr.modules[r]![c]!;
  };
  const lines: string[] = [];
  for (let row = 0; row < size; row += 2) {
    let line = "";
    for (let col = 0; col < size; col++) {
      const top = get(row, col);
      const bottom = get(row + 1, col);
      if (top && bottom) line += "█";
      else if (top && !bottom) line += "▀";
      else if (!top && bottom) line += "▄";
      else line += " ";
    }
    lines.push(line);
  }
  return lines.join("\n");
}
