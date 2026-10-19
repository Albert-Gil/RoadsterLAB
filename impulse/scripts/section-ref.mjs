// Plots STL (and optionally procedural car) sections on measurement grids.
// Usage: node scripts/section-ref.mjs [outDir] [stlPath] [--car]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync, crc32 } from 'node:zlib';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const withCar = process.argv.includes('--car');
const outDir = args[0] || join(tmpdir(), 'impulse-ref');
const stlPath = args[1] || process.env.IMPULSE_REF_STL;
if (!stlPath) { console.error('Pass a reference STL path or set IMPULSE_REF_STL.'); process.exit(1); }
mkdirSync(outDir, { recursive: true });

function loadStl() {
  const buf = readFileSync(stlPath);
  const n = buf.readUInt32LE(80);
  const min = [-100.440, -43.360, 0], max = [100.430, 43.435, 50];
  const cx = (min[0] + max[0]) / 2, cy = (min[1] + max[1]) / 2;
  const s = 4.72 / (max[0] - min[0]);
  const p = new Float32Array(n * 9);
  for (let t = 0; t < n; t++) {
    const o = 84 + t * 50 + 12;
    for (let v = 0; v < 3; v++) {
      const x = buf.readFloatLE(o + v * 12), y = buf.readFloatLE(o + v * 12 + 4), z = buf.readFloatLE(o + v * 12 + 8);
      p[t * 9 + v * 3] = -(x - cx) * s;
      p[t * 9 + v * 3 + 1] = z * s;
      p[t * 9 + v * 3 + 2] = (y - cy) * s;
    }
  }
  return p;
}

function slice(P, axis, value) {
  const out = [];
  for (let t = 0; t < P.length; t += 9) {
    const a0 = P[t + axis], a1 = P[t + 3 + axis], a2 = P[t + 6 + axis];
    if ((a0 < value && a1 < value && a2 < value) || (a0 > value && a1 > value && a2 > value)) continue;
    const v = [[P[t], P[t + 1], P[t + 2]], [P[t + 3], P[t + 4], P[t + 5]], [P[t + 6], P[t + 7], P[t + 8]]];
    for (let e = 0; e < 3; e++) {
      const a = v[e], b = v[(e + 1) % 3];
      if ((a[axis] - value) * (b[axis] - value) > 0 || a[axis] === b[axis]) continue;
      const u = (value - a[axis]) / (b[axis] - a[axis]);
      const q = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
      out.push(q);
    }
  }
  return out;
}

function png(file, img, w, h) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; Buffer.from(img.buffer, y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1); }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}

const FONT = {
  '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111', '4': '101101111001001',
  '5': '111100111001111', '6': '111100111101111', '7': '111001001001001', '8': '111101111101111', '9': '111101111001111',
  '.': '000000000000010', '-': '000000111000000', 'x': '000101010101000', 'y': '101101010010010', 'z': '111001010100111', '=': '000111000111000'
};

class Canvas {
  constructor(w, h) { this.w = w; this.h = h; this.img = new Uint8Array(w * h * 3).fill(18); }
  px(x, y, c, a = 1) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 3;
    for (let k = 0; k < 3; k++) this.img[i + k] = Math.round(this.img[i + k] * (1 - a) + c[k] * a);
  }
  text(x0, y0, s, c) {
    let x = x0;
    for (const ch of s) {
      const g = FONT[ch];
      if (g) for (let r = 0; r < 5; r++) for (let cc = 0; cc < 3; cc++) if (g[r * 3 + cc] === '1') this.px(x + cc, y0 + r, c);
      x += 4;
    }
  }
}

// Panel: maps world (u,v) range to a pixel rect with a 0.1 m grid.
function panel(cv, rect, uRange, vRange, label) {
  const [x0, y0, w, h] = rect;
  const sx = w / (uRange[1] - uRange[0]), sy = h / (vRange[1] - vRange[0]);
  const map = (u, v) => [x0 + (u - uRange[0]) * sx, y0 + h - (v - vRange[0]) * sy];
  for (let k = Math.ceil(uRange[0] * 10); k <= uRange[1] * 10; k++) {
    const [px] = map(k / 10, 0);
    for (let y = y0; y < y0 + h; y++) cv.px(px, y, k % 5 === 0 ? [200, 90, 70] : [50, 90, 75], k % 5 === 0 ? 0.8 : 0.6);
    if (k % 5 === 0) cv.text(px + 2, y0 + h - 7, (k / 10).toFixed(1), [230, 180, 110]);
  }
  for (let k = Math.ceil(vRange[0] * 10); k <= vRange[1] * 10; k++) {
    const [, py] = map(0, k / 10);
    for (let x = x0; x < x0 + w; x++) cv.px(x, py, k % 5 === 0 ? [200, 90, 70] : [50, 90, 75], k % 5 === 0 ? 0.8 : 0.6);
    if (k % 5 === 0) cv.text(x0 + 2, py + 2, (k / 10).toFixed(1), [230, 180, 110]);
  }
  cv.text(x0 + 4, y0 + 4, label, [240, 240, 240]);
  return map;
}

const P = loadStl();
let C = null;
if (withCar) {
  const mod = await import(new URL('../src/scene.js', import.meta.url).href + '?t=' + Date.now());
  const parts = mod.carParts();
  const total = parts.reduce((s, p) => s + p.p.length, 0);
  C = new Float32Array(total);
  let o = 0;
  for (const part of parts) { C.set(part.p, o); o += part.p.length; }
}

function sectionSheet(file, axis, stations, uAxis, vAxis, uRange, vRange, ppm, cols, label) {
  const pw = Math.round((uRange[1] - uRange[0]) * ppm), ph = Math.round((vRange[1] - vRange[0]) * ppm);
  const rows = Math.ceil(stations.length / cols);
  const cv = new Canvas(cols * (pw + 6), rows * (ph + 6));
  stations.forEach((s, i) => {
    const rect = [(i % cols) * (pw + 6), Math.floor(i / cols) * (ph + 6), pw, ph];
    const map = panel(cv, rect, uRange, vRange, `${label}=${s.toFixed(2)}`);
    for (const q of slice(P, axis, s)) {
      const [x, y] = map(q[uAxis], q[vAxis]);
      if (x >= rect[0] && x < rect[0] + pw && y >= rect[1] && y < rect[1] + ph) cv.px(x, y, [235, 235, 235]);
    }
    if (C) for (const q of slice(C, axis, s)) {
      const [x, y] = map(q[uAxis], q[vAxis]);
      if (x >= rect[0] && x < rect[0] + pw && y >= rect[1] && y < rect[1] + ph) { cv.px(x, y, [255, 90, 60]); cv.px(x + 1, y, [255, 90, 60]); }
    }
  });
  png(join(outDir, file), cv.img, cv.w, cv.h);
  console.log(join(outDir, file));
}

const tag = C ? '-cmp' : '';
sectionSheet(`xsec-front${tag}.png`, 0, [2.36, 2.32, 2.28, 2.24, 2.20, 2.12, 2.04, 1.95, 1.85, 1.75, 1.62, 1.50], 2, 1, [0, 1.05], [0, 1.25], 170, 6, 'x');
sectionSheet(`xsec-mid${tag}.png`, 0, [1.30, 1.15, 1.00, 0.85, 0.70, 0.50, 0.25, 0.00, -0.30, -0.60, -0.90, -1.15], 2, 1, [0, 1.05], [0, 1.25], 170, 6, 'x');
sectionSheet(`xsec-rear${tag}.png`, 0, [-1.30, -1.50, -1.70, -1.85, -1.95, -2.02, -2.08, -2.14, -2.20, -2.26, -2.32, -2.38], 2, 1, [0, 1.05], [0, 1.25], 170, 6, 'x');
sectionSheet(`zsec${tag}.png`, 2, [0.0, 0.25, 0.45, 0.60, 0.72, 0.82, 0.90, 0.96], 0, 1, [-2.45, 2.45], [0, 1.25], 220, 2, 'z');
sectionSheet(`ysec${tag}.png`, 1, [0.14, 0.22, 0.32, 0.42, 0.52, 0.62, 0.72, 0.82, 0.92, 1.02, 1.10, 1.16], 0, 2, [-2.45, 2.45], [0, 1.05], 200, 2, 'y');
