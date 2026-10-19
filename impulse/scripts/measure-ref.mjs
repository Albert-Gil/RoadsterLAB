// Prints numeric surface tables of the reference STL in scene coordinates (m).
import { readFileSync } from 'node:fs';

const stlPath = process.argv[2] || process.env.IMPULSE_REF_STL;
if (!stlPath) { console.error('Pass a reference STL path or set IMPULSE_REF_STL.'); process.exit(1); }
const buf = readFileSync(stlPath);
const n = buf.readUInt32LE(80);
const min = [-100.440, -43.360, 0], max = [100.430, 43.435, 50];
const cx = (min[0] + max[0]) / 2, cy = (min[1] + max[1]) / 2;
const s = 4.72 / (max[0] - min[0]);
const pts = [];
for (let t = 0; t < n; t++) {
  const o = 84 + t * 50 + 12;
  const v = [];
  for (let k = 0; k < 3; k++) v.push([-(buf.readFloatLE(o + k * 12) - cx) * s, buf.readFloatLE(o + k * 12 + 8) * s, (buf.readFloatLE(o + k * 12 + 4) - cy) * s]);
  pts.push(v[0], v[1], v[2]);
  for (let k = 0; k < 3; k++) {
    const a = v[k], b = v[(k + 1) % 3];
    const len = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    const m = Math.min(6, Math.floor(len / 0.01));
    for (let j = 1; j < m; j++) { const u = j / m; pts.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]); }
  }
}
const wheels = [[1.42, 0.335], [-1.50, 0.335]];
const inWheel = p => Math.abs(p[2]) > 0.55 && wheels.some(([wx, wy]) => Math.hypot(p[0] - wx, p[1] - wy) < 0.385);

const f = v => (v === -Infinity || v === Infinity ? '  -  ' : v.toFixed(2).padStart(5));

console.log('SIDE: x | top surface y at |z| = 0 .15 .3 .45 .6 .7 .8 .88 .94 | min y (|z|<.5) | max|z| overall (no wheels)');
const zs = [0, 0.15, 0.3, 0.45, 0.6, 0.7, 0.8, 0.88, 0.94];
for (let x = 2.44; x >= -2.44; x -= 0.06) {
  const near = pts.filter(p => Math.abs(p[0] - x) < 0.012);
  const row = zs.map(z => near.filter(p => Math.abs(Math.abs(p[2]) - z) < 0.02 && !inWheel(p)).reduce((m, p) => Math.max(m, p[1]), -Infinity));
  const yb = near.filter(p => Math.abs(p[2]) < 0.5).reduce((m, p) => Math.min(m, p[1]), Infinity);
  const zm = near.filter(p => !inWheel(p)).reduce((m, p) => Math.max(m, Math.abs(p[2])), -Infinity);
  console.log(f(x), '|', row.map(f).join(' '), '|', f(yb), '|', f(zm));
}

console.log('\nPLAN: x | max|z| (no wheels) at y = .15 .25 .35 .45 .55 .65 .75 .85 .95 1.05 1.12');
const ys = [0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.95, 1.05, 1.12];
for (let x = 2.44; x >= -2.44; x -= 0.06) {
  const near = pts.filter(p => Math.abs(p[0] - x) < 0.012 && !inWheel(p));
  const row = ys.map(y => near.filter(p => Math.abs(p[1] - y) < 0.025).reduce((m, p) => Math.max(m, Math.abs(p[2])), -Infinity));
  console.log(f(x), '|', row.map(f).join(' '));
}
