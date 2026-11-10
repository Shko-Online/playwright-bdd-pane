// Generates the extension and task icons (PNG) without external tools.
// A rounded tile with a report sheet and a check mark.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, pixel) {
  const SS = 4; // supersampling for anti-aliased edges
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const p = pixel((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size);
        r += p[0] * p[3]; g += p[1] * p[3]; b += p[2] * p[3]; a += p[3];
      }
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = a ? Math.round(r / a) : 0; raw[o + 1] = a ? Math.round(g / a) : 0; raw[o + 2] = a ? Math.round(b / a) : 0;
      raw[o + 3] = Math.round((a / (SS * SS)) * 255);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

const roundRect = (x, y, x0, y0, x1, y1, r) => {
  const cx = Math.min(Math.max(x, x0 + r), x1 - r), cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
};
const nearSegment = (x, y, ax, ay, bx, by, w) => {
  const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
  return (x - ax - t * (bx - ax)) ** 2 + (y - ay - t * (by - ay)) ** 2 <= w * w;
};

const TILE = [24, 98, 84], SHEET = [255, 255, 255], LINE = [176, 196, 192], CHECK = [46, 173, 92], NONE = [0, 0, 0, 0];
function icon(x, y) {
  if (!roundRect(x, y, 0.02, 0.02, 0.98, 0.98, 0.18)) return NONE;
  if (nearSegment(x, y, 0.46, 0.68, 0.56, 0.78, 0.055) || nearSegment(x, y, 0.56, 0.78, 0.78, 0.52, 0.055)) return [...CHECK, 1];
  if (roundRect(x, y, 0.24, 0.18, 0.7, 0.84, 0.05)) {
    for (const ly of [0.32, 0.44, 0.56]) if (y > ly - 0.025 && y < ly + 0.025 && x > 0.32 && x < (ly === 0.56 ? 0.46 : 0.62)) return [...LINE, 1];
    return [...SHEET, 1];
  }
  return [...TILE, 1];
}

fs.mkdirSync(path.join(root, 'images'), { recursive: true });
fs.writeFileSync(path.join(root, 'images', 'icon.png'), png(128, icon));
fs.writeFileSync(path.join(root, 'tasks', 'PublishPlaywrightBddReport', 'icon.png'), png(32, icon));
console.log('Icons written.');
