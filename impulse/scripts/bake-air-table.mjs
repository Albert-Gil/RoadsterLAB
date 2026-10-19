/**
 * Offline baker: Peng–Robinson dry air + NASA 7-coeff ideal-gas cp.
 * Writes impulse/src/air-table.js. Zero npm deps. SI throughout.
 *
 * Tc,Pc,ω: dry-air / N2-rich PR constants (engineering mixture).
 * Ideal-gas cp: NASA polynomials for Air (McBride/Gordon style).
 * Z checkpoints: Vasserman air compressibility (300 K isotherm).
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src', 'air-table.js');

const RU = 8.314462618; // J/(mol·K)
const M = 0.0289586; // kg/mol dry air
const R = RU / M; // 287.05-ish
const TC = 132.5306; // K
const PC = 3.786e6; // Pa
const OMEGA = 0.0335;
const KAPPA = 0.37464 + 1.54226 * OMEGA - 0.26992 * OMEGA * OMEGA;
const A0 = 0.45724 * (RU * RU * TC * TC) / PC;
const B = 0.07780 * (RU * TC) / PC;
const SQRT2 = Math.SQRT2;

// NASA 7-coeff for Air, cp/R = sum ai T^{i-1}; two ranges.
// Source: NASA Glenn thermodynamic database (Air), low/high polynomials.
const NASA_LOW = { // 200–1000 K
  a: [3.56839620, -1.49840650e-3, 4.91800570e-6, -4.84734570e-9, 1.65406090e-12],
  b: [-1.06234600e3, 3.71582920]
};
const NASA_HIGH = { // 1000–6000 K
  a: [3.08792717, 1.24597184e-3, -4.23718945e-7, 6.76105860e-11, -3.59323274e-15],
  b: [-9.78641600e2, 5.98005924]
};

function nasaPoly(T) {
  const p = T < 1000 ? NASA_LOW : NASA_HIGH;
  const [a1, a2, a3, a4, a5] = p.a, [a6, a7] = p.b;
  const cpR = a1 + a2 * T + a3 * T * T + a4 * T ** 3 + a5 * T ** 4;
  const hRT = a1 + a2 * T / 2 + a3 * T * T / 3 + a4 * T ** 3 / 4 + a5 * T ** 4 / 5 + a6 / T;
  const sR = a1 * Math.log(T) + a2 * T + a3 * T * T / 2 + a4 * T ** 3 / 3 + a5 * T ** 4 / 4 + a7;
  return { cp: cpR * RU / M, h: hRT * RU * T / M, s: sR * RU / M };
}

function alpha(T) {
  const tr = T / TC;
  const x = 1 + KAPPA * (1 - Math.sqrt(tr));
  return x * x;
}

function prPressure(T, rho) {
  const Vm = M / rho;
  const al = alpha(T);
  return RU * T / (Vm - B) - A0 * al / (Vm * (Vm + B) + B * (Vm - B));
}

function prZH(T, rho) {
  const p = prPressure(T, rho);
  const Vm = M / rho;
  const Z = p * Vm / (RU * T);
  const al = alpha(T);
  const A = A0 * al * p / (RU * RU * T * T);
  const Bb = B * p / (RU * T);
  const tr = T / TC;
  const dAdT_factor = 1 + KAPPA * Math.sqrt(tr / al); // used in enthalpy departure
  const lnArg = Math.log(Math.max(1e-30, (Z + (1 + SQRT2) * Bb) / (Z + (1 - SQRT2) * Bb)));
  const HR_RT = Z - 1 - (A / (2 * SQRT2 * Bb)) * dAdT_factor * lnArg;
  const SR_R = Math.log(Math.max(1e-30, Z - Bb)) - (A / (2 * SQRT2 * Bb)) * KAPPA * Math.sqrt(tr / al) * lnArg;
  const ig = nasaPoly(T);
  // Residual mass-specific; ideal entropy at 1 Pa reference adjusted via Z for density
  // Absolute s = s_ig(T,p0) - R ln(p/p0) + s_res; use p0=1e5 Pa and include compressibility via residual.
  const p0 = 1e5;
  const sIgP = ig.s - R * Math.log(p / p0);
  const h = ig.h + HR_RT * R * T;
  const s = sIgP + SR_R * R;
  const u = h - p / rho;
  // cp ≈ numerical
  const dT = Math.max(0.05, T * 1e-4);
  const h2 = (() => {
    const p2 = prPressure(T + dT, rho);
    const Vm2 = M / rho;
    const Z2 = p2 * Vm2 / (RU * (T + dT));
    const al2 = alpha(T + dT);
    const A2 = A0 * al2 * p2 / (RU * RU * (T + dT) ** 2);
    const Bb2 = B * p2 / (RU * (T + dT));
    const tr2 = (T + dT) / TC;
    const f2 = 1 + KAPPA * Math.sqrt(tr2 / al2);
    const ln2 = Math.log(Math.max(1e-30, (Z2 + (1 + SQRT2) * Bb2) / (Z2 + (1 - SQRT2) * Bb2)));
    const HR2 = Z2 - 1 - (A2 / (2 * SQRT2 * Bb2)) * f2 * ln2;
    return nasaPoly(T + dT).h + HR2 * R * (T + dT);
  })();
  // isochoric path cp is wrong; use enthalpy at constant p approximately via ideal+residual cp
  const cp = Math.max(500, (h2 - h) / dT + 200); // rough; refine with finite-diff at fixed p later in table use
  return { p, u, h, s, cp, Z };
}

// Better cp: (dh/dT)_p via nearby density that keeps p fixed
function propsAt(T, rho) {
  const base = prZH(T, rho);
  const dT = Math.max(0.1, T * 1e-4);
  // find rho2 at T+dT with same p
  let lo = rho * 0.5, hi = rho * 1.5;
  const target = base.p;
  for (let i = 0; i < 40; i++) {
    const mid = 0.5 * (lo + hi);
    const pm = prPressure(T + dT, mid);
    if (pm > target) lo = mid; else hi = mid;
  }
  const rho2 = 0.5 * (lo + hi);
  const h2 = prZH(T + dT, rho2).h;
  const dcp = (h2 - base.h) / dT;
  const cpIg = nasaPoly(T).cp;
  const cp = Number.isFinite(dcp) && dcp > 400 && dcp < 3000 ? dcp : cpIg;
  return { p: base.p, u: base.u, h: base.h, s: base.s, cp, Z: base.Z };
}

// Cap density so molar volume stays above PR covolume B (liquid-like roots are out of scope).
const T_MIN = 90, T_MAX = 2000, RHO_MIN = 0.01, RHO_MAX = Math.min(1200, 0.92 * M / B);
const nT = 48, nRho = 56;
console.log('RHO_MAX limited to', RHO_MAX.toFixed(2), 'kg/m3 (Vm>B)');
const Ts = [], logRhos = [];
for (let i = 0; i < nT; i++) {
  // denser below 400 K
  const u = i / (nT - 1);
  const t = u < 0.55 ? T_MIN + (400 - T_MIN) * (u / 0.55) : 400 + (T_MAX - 400) * ((u - 0.55) / 0.45);
  Ts.push(t);
}
for (let j = 0; j < nRho; j++) {
  const u = j / (nRho - 1);
  logRhos.push(Math.log(RHO_MIN) + u * (Math.log(RHO_MAX) - Math.log(RHO_MIN)));
}

const P = new Float64Array(nT * nRho);
const U = new Float64Array(nT * nRho);
const H = new Float64Array(nT * nRho);
const S = new Float64Array(nT * nRho);
const CP = new Float64Array(nT * nRho);

for (let i = 0; i < nT; i++) {
  for (let j = 0; j < nRho; j++) {
    const T = Ts[i], rho = Math.exp(logRhos[j]);
    const Vm = M / rho;
    let pr;
    if (Vm <= B * 1.05) {
      const ig = nasaPoly(T);
      pr = { p: rho * R * T, u: ig.h - R * T, h: ig.h, s: ig.s - R * Math.log(Math.max(1e-30, rho * R * T / 1e5)), cp: ig.cp };
    } else {
      try { pr = propsAt(T, rho); }
      catch { pr = { p: NaN, u: NaN, h: NaN, s: NaN, cp: NaN }; }
      if (!Number.isFinite(pr.p) || pr.p <= 0 || !Number.isFinite(pr.u) || !Number.isFinite(pr.h) || !Number.isFinite(pr.s) || !Number.isFinite(pr.cp)) {
        const ig = nasaPoly(T);
        pr = { p: Math.max(1, rho * R * T), u: ig.h - R * T, h: ig.h, s: ig.s - R * Math.log(Math.max(1e-30, rho * R * T / 1e5)), cp: Math.max(600, ig.cp) };
      }
    }
    const k = i * nRho + j;
    P[k] = pr.p; U[k] = pr.u; H[k] = pr.h; S[k] = pr.s; CP[k] = pr.cp;
  }
}

// Vasserman 300 K Z checkpoints (bar absolute → Pa)
const Z_REF = [
  [100e5, 1.0074],
  [200e5, 1.0326],
  [300e5, 1.1089],
  [400e5, 1.2073],
  [500e5, 1.3163]
];
let zFail = false;
console.log('Z checkpoints at 300 K (PR table vs Vasserman):');
for (const [p, zRef] of Z_REF) {
  // find rho by bisection on pressure
  let lo = RHO_MIN, hi = RHO_MAX;
  for (let n = 0; n < 60; n++) {
    const mid = Math.sqrt(lo * hi);
    const pm = propsAt(300, mid).p;
    if (pm < p) lo = mid; else hi = mid;
  }
  const rho = Math.sqrt(lo * hi);
  const z = p / (rho * R * 300);
  const err = Math.abs(z - zRef) / zRef;
  console.log(`  p=${(p / 1e5).toFixed(0)} bar  Z_pr=${z.toFixed(4)}  Z_ref=${zRef.toFixed(4)}  rel=${(err * 100).toFixed(1)}%`);
  if (err > 0.12) zFail = true;
}
if (zFail) {
  console.error('Z checkpoint failed (>12% error)');
  process.exit(1);
}

function pack(arr) {
  return Array.from(arr).map(x => Number(x.toPrecision(8))).join(',');
}

const src = `/** AUTO-GENERATED by scripts/bake-air-table.mjs — do not hand-edit GRID. SI units. */
export const AIR_R=${R};
export const AIR_T_MIN=${T_MIN}, AIR_T_MAX=${T_MAX}, AIR_RHO_MIN=${RHO_MIN}, AIR_RHO_MAX=${RHO_MAX};
const nT=${nT}, nRho=${nRho};
const Ts=Float64Array.from([${Ts.map(t => t.toPrecision(8)).join(',')}]);
const logRhos=Float64Array.from([${logRhos.map(x => x.toPrecision(8)).join(',')}]);
const P=Float64Array.from([${pack(P)}]);
const U=Float64Array.from([${pack(U)}]);
const H=Float64Array.from([${pack(H)}]);
const S=Float64Array.from([${pack(S)}]);
const CP=Float64Array.from([${pack(CP)}]);

export function insideTable(T,rho){
  return T>=AIR_T_MIN&&T<=AIR_T_MAX&&rho>=AIR_RHO_MIN&&rho<=AIR_RHO_MAX;
}
function bracket(arr,x){
  if(x<arr[0]||x>arr[arr.length-1])return null;
  let lo=0,hi=arr.length-1;
  while(hi-lo>1){const m=(lo+hi)>>1;if(arr[m]<=x)lo=m;else hi=m;}
  return [lo,hi,(x-arr[lo])/Math.max(1e-30,arr[hi]-arr[lo])];
}
function bil(field,i0,i1,j0,j1,ft,fr){
  const a=field[i0*nRho+j0],b=field[i0*nRho+j1],c=field[i1*nRho+j0],d=field[i1*nRho+j1];
  return (1-ft)*((1-fr)*a+fr*b)+ft*((1-fr)*c+fr*d);
}
export function propsAtTR(T,rho){
  if(!insideTable(T,rho))return{p:NaN,u:NaN,h:NaN,s:NaN,cp:NaN,ok:false};
  const bt=bracket(Ts,T),br=bracket(logRhos,Math.log(rho));
  if(!bt||!br)return{p:NaN,u:NaN,h:NaN,s:NaN,cp:NaN,ok:false};
  const[i0,i1,ft]=bt,[j0,j1,fr]=br;
  const p=bil(P,i0,i1,j0,j1,ft,fr),u=bil(U,i0,i1,j0,j1,ft,fr),h=bil(H,i0,i1,j0,j1,ft,fr),s=bil(S,i0,i1,j0,j1,ft,fr),cp=bil(CP,i0,i1,j0,j1,ft,fr);
  const ok=[p,u,h,s,cp].every(x=>Number.isFinite(x))&&p>0;
  return{p,u,h,s,cp,ok};
}
export function rhoFromPT(p,T){
  if(!(p>0)||T<AIR_T_MIN||T>AIR_T_MAX)return{rho:NaN,ok:false};
  let lo=AIR_RHO_MIN,hi=AIR_RHO_MAX;
  while(hi>lo*1.01&&!propsAtTR(T,hi).ok)hi*=0.95;
  const fLo=propsAtTR(T,lo),fHi=propsAtTR(T,hi);
  if(!fLo.ok||!fHi.ok)return{rho:NaN,ok:false};
  if(p<fLo.p||p>fHi.p)return{rho:NaN,ok:false};
  for(let n=0;n<70;n++){
    const mid=Math.exp(0.5*(Math.log(lo)+Math.log(hi)));
    const pm=propsAtTR(T,mid).p;
    if(!(pm>0))return{rho:NaN,ok:false};
    if(pm<p)lo=mid;else hi=mid;
  }
  const rho=Math.exp(0.5*(Math.log(lo)+Math.log(hi)));
  const check=propsAtTR(T,rho);
  if(!check.ok||Math.abs(check.p-p)/p>0.05)return{rho:NaN,ok:false};
  return{rho,ok:true};
}
export function tempFromRU(rho,u){
  if(rho<AIR_RHO_MIN||rho>AIR_RHO_MAX)return{T:NaN,ok:false};
  let lo=AIR_T_MIN,hi=AIR_T_MAX;
  for(let n=0;n<70;n++){
    const mid=0.5*(lo+hi);
    const um=propsAtTR(mid,rho).u;
    if(!(um===um))return{T:NaN,ok:false};
    if(um<u)lo=mid;else hi=mid;
  }
  const T=0.5*(lo+hi);
  const check=propsAtTR(T,rho);
  if(!check.ok||Math.abs(check.u-u)/Math.max(1,Math.abs(u))>0.05)return{T:NaN,ok:false};
  return{T,ok:true};
}
export function propsFromPs(p,s){
  if(!(p>0))return{T:NaN,rho:NaN,u:NaN,h:NaN,cp:NaN,ok:false};
  let best=null,bestErr=Infinity;
  for(let i=0;i<nT;i++){
    const T=Ts[i];
    const got=rhoFromPT(p,T);
    if(!got.ok)continue;
    const pr=propsAtTR(T,got.rho);
    if(!pr.ok)continue;
    const err=Math.abs(pr.s-s);
    if(err<bestErr){bestErr=err;best={T,rho:got.rho,...pr};}
  }
  // refine T by bisection on entropy at fixed p
  let lo=AIR_T_MIN,hi=AIR_T_MAX,okLo=false,okHi=false;
  for(let n=0;n<50;n++){
    const mid=0.5*(lo+hi);
    const got=rhoFromPT(p,mid);
    if(!got.ok){if(n<10){lo=mid;continue;}break;}
    const pr=propsAtTR(mid,got.rho);
    if(pr.s<s)lo=mid;else hi=mid;
    okLo=true;
  }
  if(!okLo&&!best)return{T:NaN,rho:NaN,u:NaN,h:NaN,cp:NaN,ok:false};
  const T=0.5*(lo+hi);
  const got=rhoFromPT(p,T);
  if(!got.ok){
    if(!best)return{T:NaN,rho:NaN,u:NaN,h:NaN,cp:NaN,ok:false};
    return{T:best.T,rho:best.rho,u:best.u,h:best.h,cp:best.cp,ok:Math.abs(best.s-s)/Math.max(1,Math.abs(s))<0.02};
  }
  const pr=propsAtTR(T,got.rho);
  const ok=pr.ok&&Math.abs(pr.s-s)/Math.max(1,Math.abs(s))<0.02;
  return{T,rho:got.rho,u:pr.u,h:pr.h,cp:pr.cp,ok};
}
export function soundSpeed(T,rho){
  const pr=propsAtTR(T,rho);
  if(!pr.ok)return{a:NaN,ok:false};
  const dRho=Math.max(1e-6,rho*1e-4),dT=Math.max(0.05,T*1e-4);
  const pR=propsAtTR(T,rho+dRho),pT=propsAtTR(T+dT,rho);
  if(!pR.ok||!pT.ok)return{a:NaN,ok:false};
  const dpdr= (pR.p-pr.p)/dRho;
  const dpdT= (pT.p-pr.p)/dT;
  const cv=pr.cp - T*(dpdT*dpdT)/(rho*rho*Math.max(1e-6,dpdr));
  if(!(cv>100)||!(dpdr>0))return{a:NaN,ok:false};
  const a=Math.sqrt(Math.max(0,(pr.cp/cv)*dpdr));
  return{a,ok:Number.isFinite(a)&&a>0};
}
`;

writeFileSync(OUT, src);
console.log('Wrote', OUT, `(${(src.length / 1024).toFixed(1)} KB source)`);
