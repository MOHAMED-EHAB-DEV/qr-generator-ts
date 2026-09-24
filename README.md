# @estajer/qr-generator

> Lightweight, zero-dependency QR Code generator written in 100% pure TypeScript. Full ISO/IEC 18004 specification compliant.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)]()

---

## Features

- **Zero Runtime Dependencies**: No native bindings, no third-party libraries.
- **Spec Compliant**: Implements ISO/IEC 18004 from scratch:
  - Versions 1 through 40.
  - Reed-Solomon error correction over $\text{GF}(2^8)$ (primitive polynomial `0x11D`).
  - Automatic encoding mode detection (`numeric`, `alphanumeric`, `byte` with UTF-8).
  - All 8 standard mask patterns with optimal penalty scoring.
  - Version info (BCH `18,6`) and format info (BCH `15,5`) error correction.
- **Multiple Renderers**:
  - **SVG string**: Universal (Node.js, Deno, Bun, SSR, Browser).
  - **Canvas element**: Direct rendering to `<canvas>`.
  - **PNG Data URL**: Ready for `<img src="...">` or downloads.
  - **ASCII art**: Fast CLI / terminal output.
  - **Raw Matrix**: 2D boolean or `0`/`1` binary matrix for custom renderers.
- **Type Safe**: Fully typed exports, strict null checks friendly.

---

## Installation

```bash
npm install qr-generator-ts
# or
pnpm add qr-generator-ts
# or
yarn add qr-generator-ts
```

Or copy `index.ts` directly into your project!

---

## Quick Start

### 1. Generate SVG (Universal: Node.js, Next.js SSR, Browser)

```typescript
import { generateQRCode, toSVG } from "qr-generator-ts";

const qr = generateQRCode("https://example.com", {
  errorCorrectionLevel: "H",
});

const svgString = toSVG(qr, {
  scale: 10,
  margin: 4,
  darkColor: "#0f172a",
  lightColor: "#ffffff",
});

console.log(svgString);
```

### 2. Render to `<canvas>` (Browser)

```typescript
import { generateQRCode, toCanvas } from "qr-generator-ts";

const qr = generateQRCode("Hello World");
const canvas = document.getElementById("qr-canvas") as HTMLCanvasElement;

toCanvas(qr, canvas, {
  scale: 8,
  margin: 4,
  darkColor: "#000000",
  lightColor: "#ffffff",
});
```

### 3. Generate PNG Data URL (Browser)

```typescript
import { generateQRCode, toDataURL } from "qr-generator-ts";

const qr = generateQRCode("https://github.com");
const dataUrl = toDataURL(qr, { scale: 8, margin: 4 });

const img = document.createElement("img");
img.src = dataUrl;
document.body.appendChild(img);
```

### 4. Terminal ASCII Preview

```typescript
import { generateQRCode, toASCII } from "qr-generator-ts";

const qr = generateQRCode("https://example.com");
console.log(toASCII(qr, { margin: 2 }));
```

### 5. Raw Binary Matrix

```typescript
import { generateQrMatrix } from "qr-generator-ts";

// Returns number[][] where 1 is dark and 0 is light
const matrix = generateQrMatrix("My Data");
console.log(matrix[0]); // [1, 1, 1, 1, 1, 1, 1, 0, ...]
```

---

## API Reference

### `generateQRCode(text: string, options?: QRCodeOptions): QRCodeResult`

Generates the QR code model, calculating optimal version, encoding mode, error correction, and mask pattern.

#### Options (`QRCodeOptions`)

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `errorCorrectionLevel` | `'L' \| 'M' \| 'Q' \| 'H'` | `'M'` | Error correction capacity: `L` (~7%), `M` (~15%), `Q` (~25%), `H` (~30%). |
| `minVersion` | `number` (1–40) | `1` | Smallest allowed QR version. |
| `maxVersion` | `number` (1–40) | `40` | Maximum allowed QR version. |
| `maskPattern` | `0 \| 1 \| 2 \| 3 \| 4 \| 5 \| 6 \| 7` | Auto | Overrides automatic mask evaluation. |

#### Return Value (`QRCodeResult`)

```typescript
interface QRCodeResult {
  version: number;               // QR version (1 - 40)
  size: number;                  // Grid size in modules (size = 4 * version + 17)
  errorCorrectionLevel: ErrorCorrectionLevel;
  maskPattern: MaskPattern;      // Selected mask (0 - 7)
  modules: boolean[][];          // modules[row][col] (true = dark, false = light)
}
```

---

### `toSVG(qr: QRCodeResult, options?: RenderOptions): string`

Renders the QR code as a scalable, self-contained SVG string.

```typescript
interface RenderOptions {
  margin?: number;       // Quiet zone margin in modules (default: 4)
  scale?: number;        // Pixel width/height per module (default: 8)
  darkColor?: string;    // CSS color for dark modules (default: "#000000")
  lightColor?: string;   // CSS color for background (default: "#ffffff")
}
```

---

### `toCanvas(qr: QRCodeResult, canvas: HTMLCanvasElement, options?: RenderOptions): void`

Renders directly onto an existing HTML Canvas context.

---

### `toDataURL(qr: QRCodeResult, options?: RenderOptions): string`

Generates an offscreen canvas and returns an `image/png` Data URL string. (Browser only)

---

### `toASCII(qr: QRCodeResult, options?: AsciiOptions): string`

Renders terminal art using unicode block characters (`█`, `▀`, `▄`, ` `) at two vertical modules per character.

```typescript
interface AsciiOptions {
  margin?: number; // Margin in modules (default: 2)
}
```

---

### `generateQrMatrix(text: string, options?: QRCodeOptions): (0 | 1)[][]`

Convenience function returning a 2D numeric array where dark modules are `1` and light modules are `0`.

---

## Error Correction Levels

| Level | Error Recovery | Use Case |
| :---: | :---: | :--- |
| **`L`** | ~7% | Clean digital displays, maximum storage capacity |
| **`M`** | ~15% | Standard default, good balance of size and resilience |
| **`Q`** | ~25% | Industrial environments, physical packaging |
| **`H`** | ~30% | Highest durability, logo embeds, worn or curved surfaces |

---

## License

[MIT](LICENSE)
