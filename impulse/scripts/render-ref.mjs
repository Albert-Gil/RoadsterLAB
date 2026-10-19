// Offline software rasterizer for comparing the procedural car with the reference STL.
// Usage: node scripts/render-ref.mjs <stl|car|both> [outDir] [stlPath]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync, crc32 } from 'node:zlib';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const positional = process.argv.slice(2).filter(a => !a.startsWith('--'));
const which = positional[0] || 'both';
const outDir = positional[1] || join(tmpdir(), 'impulse-ref');
const stlPath = positional[2] || process.env.IMPULSE_REF_STL;
mkdirSync(outDir, { recursive: true });

function loadStl() {
  if (!stlPath) { console.error('Pass a reference STL path or set IMPULSE_REF_STL.'); process.exit(1); }
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
  return [{ p, n: null, color: [0.78, 0.79, 0.78] }];
}

async function loadCar() {
  const mod = await import(new URL('../src/scene.js', import.meta.url).href + '?t=' + Date.now());
  return mod.carParts().map(part => ({ p: Float32Array.from(part.p), n: part.n ? Float32Array.from(part.n) : null, color: part.color.slice(0, 3), emit: part.emit || 0 }));
}

const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function camera(view) {
  if (view.ortho) {
    const { right, up, center, ppm, w, h } = view;
    const fwd = cross(up, right);
    return {
      w, h, fwd,
      project(v) {
        const d = [v[0] - center[0], v[1] - center[1], v[2] - center[2]];
        return [w / 2 + dot(d, right) * ppm, h / 2 - dot(d, up) * ppm, 100 + dot(d, fwd)];
      },
      viewDir() { return fwd; }
    };
  }
  const { eye, target, fov, w, h } = view;
  const f = norm([target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]]);
  const r = norm(cross(f, [0, 1, 0]));
  const u = cross(r, f);
  const k = (h / 2) / Math.tan(fov / 2);
  return {
    w, h, fwd: f,
    project(v) {
      const d = [v[0] - eye[0], v[1] - eye[1], v[2] - eye[2]];
      const z = dot(d, f);
      return [w / 2 + dot(d, r) * k / z, h / 2 - dot(d, u) * k / z, z];
    },
    viewDir(v) { return norm([v[0] - eye[0], v[1] - eye[1], v[2] - eye[2]]); }
  };
}

function render(groups, view) {
  const cam = camera(view);
  const { w, h } = cam;
  const zb = new Float32Array(w * h).fill(Infinity);
  const img = new Uint8Array(w * h * 3);
  for (let i = 0; i < w * h; i++) { img[i * 3] = 22; img[i * 3 + 1] = 26; img[i * 3 + 2] = 25; }
  const key = norm([0.35, 0.85, 0.4]), fill = norm([-0.5, 0.3, -0.6]);
  for (const g of groups) {
    const P = g.p, N = g.n;
    for (let t = 0; t < P.length; t += 9) {
      const a = [P[t], P[t + 1], P[t + 2]], b = [P[t + 3], P[t + 4], P[t + 5]], c = [P[t + 6], P[t + 7], P[t + 8]];
      const A = cam.project(a), B = cam.project(b), C = cam.project(c);
      if (A[2] <= 0.01 || B[2] <= 0.01 || C[2] <= 0.01) continue;
      const fn = norm(cross([b[0] - a[0], b[1] - a[1], b[2] - a[2]], [c[0] - a[0], c[1] - a[1], c[2] - a[2]]));
      const nv = N ? [[N[t], N[t + 1], N[t + 2]], [N[t + 3], N[t + 4], N[t + 5]], [N[t + 6], N[t + 7], N[t + 8]]] : [fn, fn, fn];
      const minX = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0]))), maxX = Math.min(w - 1, Math.ceil(Math.max(A[0], B[0], C[0])));
      const minY = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1]))), maxY = Math.min(h - 1, Math.ceil(Math.max(A[1], B[1], C[1])));
      if (minX > maxX || minY > maxY) continue;
      const area = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]);
      if (Math.abs(area) < 1e-9) {
        const px = Math.round(A[0]), py = Math.round(A[1]);
        if (px >= 0 && py >= 0 && px < w && py < h && A[2] < zb[py * w + px]) shade(px, py, A[2], nv[0], a);
        continue;
      }
      for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5, py = y + 0.5;
        const w0 = ((B[0] - px) * (C[1] - py) - (B[1] - py) * (C[0] - px)) / area;
        const w1 = ((C[0] - px) * (A[1] - py) - (C[1] - py) * (A[0] - px)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < -1e-4 || w1 < -1e-4 || w2 < -1e-4) continue;
        const z = w0 * A[2] + w1 * B[2] + w2 * C[2];
        if (z >= zb[y * w + x]) continue;
        const n = norm([w0 * nv[0][0] + w1 * nv[1][0] + w2 * nv[2][0], w0 * nv[0][1] + w1 * nv[1][1] + w2 * nv[2][1], w0 * nv[0][2] + w1 * nv[1][2] + w2 * nv[2][2]]);
        shade(x, y, z, n, [w0 * a[0] + w1 * b[0] + w2 * c[0], w0 * a[1] + w1 * b[1] + w2 * c[1], w0 * a[2] + w1 * b[2] + w2 * c[2]]);
      }
    }
    function shade(x, y, z, n, world) {
      const vd = cam.viewDir(world);
      if (dot(n, vd) > 0) n = [-n[0], -n[1], -n[2]];
      if (view.normals) {
        zb[y * w + x] = z;
        img[(y * w + x) * 3] = Math.round((n[0] * 0.5 + 0.5) * 255);
        img[(y * w + x) * 3 + 1] = Math.round((n[1] * 0.5 + 0.5) * 255);
        img[(y * w + x) * 3 + 2] = Math.round((n[2] * 0.5 + 0.5) * 255);
        return;
      }
      const l = 0.16 + 0.18 * (n[1] * 0.5 + 0.5) + 0.72 * Math.max(0, dot(n, key)) + 0.18 * Math.max(0, dot(n, fill));
      const hv = norm([key[0] - vd[0], key[1] - vd[1], key[2] - vd[2]]);
      const spec = Math.pow(Math.max(0, dot(n, hv)), 40) * 0.12;
      const e = g.emit || 0;
      zb[y * w + x] = z;
      for (let k = 0; k < 3; k++) img[(y * w + x) * 3 + k] = Math.max(0, Math.min(255, Math.round((g.color[k] * (l + e) + spec) * 255)));
    }
  }
  return img;
}

const FONT = {
  '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111', '4': '101101111001001',
  '5': '111100111001111', '6': '111100111101111', '7': '111001001001001', '8': '111101111101111', '9': '111101111001111',
  '.': '000000000000010', '-': '000000111000000'
};
function text(img, w, h, x0, y0, s, col) {
  let x = x0;
  for (const ch of s) {
    const g = FONT[ch];
    if (g) for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (g[r * 3 + c] === '1') {
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        const px = x + c * 2 + dx, py = y0 + r * 2 + dy;
        if (px >= 0 && py >= 0 && px < w && py < h) img.set(col, (py * w + px) * 3);
      }
    }
    x += 8;
  }
}

function grid(img, view) {
  const { w, h, ppm, center, right, up } = view;
  const ax = right.findIndex(v => Math.abs(v) > 0.5), ay = up.findIndex(v => Math.abs(v) > 0.5);
  const sx = Math.sign(right[ax]), sy = Math.sign(up[ay]);
  const blend = (i, col, a) => { for (let k = 0; k < 3; k++) img[i * 3 + k] = Math.round(img[i * 3 + k] * (1 - a) + col[k] * a); };
  for (let px = 0; px < w; px++) {
    const world = center[ax] + sx * (px + 0.5 - w / 2) / ppm;
    const prev = center[ax] + sx * (px - 0.5 - w / 2) / ppm;
    const cell = Math.floor(world * 10), cellPrev = Math.floor(prev * 10);
    if (cell === cellPrev) continue;
    const v = Math.max(cell, cellPrev);
    const major = v % 5 === 0;
    for (let py = 0; py < h; py++) blend(py * w + px, major ? [240, 120, 90] : [90, 160, 130], major ? 0.45 : 0.22);
    if (major) text(img, w, h, px + 2, h - 12, (v / 10).toFixed(1), [250, 200, 120]);
  }
  for (let py = 0; py < h; py++) {
    const world = center[ay] - sy * (py + 0.5 - h / 2) / ppm;
    const prev = center[ay] - sy * (py - 0.5 - h / 2) / ppm;
    const cell = Math.floor(world * 10), cellPrev = Math.floor(prev * 10);
    if (cell === cellPrev) continue;
    const v = Math.max(cell, cellPrev);
    const major = v % 5 === 0;
    for (let px = 0; px < w; px++) blend(py * w + px, major ? [240, 120, 90] : [90, 160, 130], major ? 0.45 : 0.22);
    if (major) text(img, w, h, 2, py + 2, (v / 10).toFixed(1), [250, 200, 120]);
  }
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
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))]));
}

const ppm = 250;
const zoom = 420;
const detailViews = {
  nsideF: { ortho: true, normals: true, right: [1, 0, 0], up: [0, 1, 0], center: [1.45, 0.62, 0], ppm: zoom, w: 900, h: 520 },
  nsideR: { ortho: true, normals: true, right: [1, 0, 0], up: [0, 1, 0], center: [-1.45, 0.62, 0], ppm: zoom, w: 900, h: 520 },
  nfront: { ortho: true, normals: true, right: [0, 0, -1], up: [0, 1, 0], center: [0, 0.62, 0], ppm: 400, w: 860, h: 520 },
  nrear: { ortho: true, normals: true, right: [0, 0, 1], up: [0, 1, 0], center: [0, 0.62, 0], ppm: 400, w: 860, h: 520 },
  ntopF: { ortho: true, normals: true, right: [1, 0, 0], up: [0, 0, -1], center: [1.45, 0, 0], ppm: 400, w: 900, h: 840 },
  ntopR: { ortho: true, normals: true, right: [1, 0, 0], up: [0, 0, -1], center: [-1.3, 0, 0], ppm: 400, w: 900, h: 840 },
  zq34: { eye: [4.6, 1.3, 2.6], target: [1.5, 0.45, 0.2], fov: 0.5, w: 1100, h: 620 },
  nglass: { ortho: true, normals: true, right: [1, 0, 0], up: [0, 1, 0], center: [0.1, 0.9, 0], ppm: 420, w: 1000, h: 400 },
  nnose: { ortho: true, normals: true, right: [1, 0, 0], up: [0, 1, 0], center: [2.05, 0.4, 0], ppm: 900, w: 700, h: 560 }
};
const views = process.argv.includes('--detail') ? detailViews : {
  side: { ortho: true, right: [1, 0, 0], up: [0, 1, 0], center: [0, 0.62, 0], ppm, w: 1250, h: 360 },
  top: { ortho: true, right: [1, 0, 0], up: [0, 0, -1], center: [0, 0, 0], ppm, w: 1250, h: 560 },
  front: { ortho: true, right: [0, 0, -1], up: [0, 1, 0], center: [0, 0.62, 0], ppm, w: 600, h: 360 },
  rear: { ortho: true, right: [0, 0, 1], up: [0, 1, 0], center: [0, 0.62, 0], ppm, w: 600, h: 360 },
  q34: { eye: [5.6, 1.9, 3.9], target: [0.1, 0.5, 0], fov: 0.5, w: 1100, h: 620 },
  qrear: { eye: [-5.4, 1.7, 3.6], target: [-0.1, 0.55, 0], fov: 0.5, w: 1100, h: 620 },
  qtop: { eye: [5.2, 4.6, 0.6], target: [0.3, 0.4, 0], fov: 0.5, w: 1100, h: 620 }
};

const sources = [];
if (which === 'stl' || which === 'both') sources.push(['stl', loadStl()]);
if (which === 'car' || which === 'both') sources.push(['car', await loadCar()]);
for (const [name, groups] of sources) {
  for (const [vn, view] of Object.entries(views)) {
    const img = render(groups, view);
    if (view.ortho) grid(img, view);
    const file = join(outDir, `${name}-${vn}.png`);
    png(file, img, view.w, view.h);
    console.log(file);
  }
}
