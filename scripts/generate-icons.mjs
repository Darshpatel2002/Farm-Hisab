// Generates the PWA PNG icons from a simple vector-ish drawing.
// No image libraries required - writes minimal RGBA PNGs by hand.
// Run with: node scripts/generate-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

const BG = [36, 94, 43, 255];
const LEAF = [147, 205, 144, 255];
const STEM = [26, 62, 33, 255];

function crc32(buf) {
  let c;
  const table = crc32.table ?? (crc32.table = Array.from({ length: 256 }, (_, n) => {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  }));
  let crc = 0xffffffff;
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, pixels) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const px = pixels(x, y);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = px[0];
      raw[o + 1] = px[1];
      raw[o + 2] = px[2];
      raw[o + 3] = px[3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Rounded-square background + leaf shape + stem. */
function draw(size, { maskable }) {
  const r = maskable ? size / 2 : size * 0.22; // maskable icons need a full-bleed safe area
  const pad = maskable ? size * 0.12 : 0;
  return (x, y) => {
    if (!maskable) {
      const inCorner =
        (x < r && y < r && (x - r) ** 2 + (y - r) ** 2 > r * r) ||
        (x > size - r && y < r && (x - (size - r)) ** 2 + (y - r) ** 2 > r * r) ||
        (x < r && y > size - r && (x - r) ** 2 + (y - (size - r)) ** 2 > r * r) ||
        (x > size - r && y > size - r && (x - (size - r)) ** 2 + (y - (size - r)) ** 2 > r * r);
      if (inCorner) return [0, 0, 0, 0];
    }
    const cx = size / 2;
    const s = size - pad * 2;
    const nx = (x - cx) / s;
    const ny = (y - pad) / s;
    // Leaf: ellipse narrowing towards the top.
    const leafTop = 0.14;
    const leafBottom = 0.9;
    if (ny > leafTop && ny < leafBottom) {
      const t = (ny - leafTop) / (leafBottom - leafTop);
      const halfWidth = 0.34 * Math.sin(Math.PI * Math.min(t * 1.05, 1));
      if (Math.abs(nx) < halfWidth) {
        if (Math.abs(nx) < 0.022) return STEM; // central vein
        return LEAF;
      }
    }
    return BG;
  };
}

for (const [name, size, maskable] of [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-maskable-512.png', 512, true],
]) {
  writeFileSync(resolve(outDir, name), png(size, draw(size, { maskable })));
  console.log('wrote', name);
}
