#!/usr/bin/env node
// Generates the binary fixture assets (valid PNGs via pure Node zlib + CRC32).
// Run once; outputs are committed as static fixtures.
// The video (intro.mp4) is generated with ffmpeg and the woff2 font is a real OFL
// font downloaded from Fontsource CDN — see commands printed at the end.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ASSETS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'site', 'assets');

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

/** Creates a valid solid-color PNG. */
function makePng(width, height, [r, g, b]) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y += 1) {
    const row = y * (1 + width * 3);
    raw[row] = 0; // filter: none
    for (let x = 0; x < width; x += 1) {
      const px = row + 1 + x * 3;
      raw[px] = r;
      raw[px + 1] = g;
      raw[px + 2] = b;
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const outputs = [
  { rel: 'responsive-320.png', width: 320, height: 180, color: [59, 130, 246] },
  { rel: 'responsive-640.png', width: 640, height: 360, color: [16, 185, 129] },
  { rel: 'responsive-1280.png', width: 1280, height: 720, color: [245, 158, 11] },
  { rel: 'poster.png', width: 640, height: 360, color: [15, 23, 42] },
  { rel: 'espaço.png', width: 200, height: 200, color: [220, 38, 127] },
  { rel: path.join('img', 'bg.png'), width: 120, height: 120, color: [99, 102, 241] },
];

for (const { rel, width, height, color } of outputs) {
  const file = path.join(ASSETS, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, makePng(width, height, color));
  console.log(`PNG  ${rel} (${width}x${height})`);
}

console.log('\nPróximos passos (uma única vez):');
console.log('  ffmpeg -f lavfi -i testsrc=duration=1:size=320x240:rate=10 -pix_fmt yuv420p -movflags +faststart tests/fixture/site/assets/intro.mp4');
console.log('  curl -L -o tests/fixture/site/assets/fonts/inter.woff2 https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.woff2');
