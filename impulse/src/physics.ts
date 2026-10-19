/** SI throughout. All vehicle parameters are illustrative, not Tesla specifications. */
import { propsAtTR, rhoFromPT, tempFromRU, propsFromPs, soundSpeed, insideTable, AIR_T_MIN } from './air-table.js';
export const G = 9.80665, R = 287.05, GAMMA = 1.4, CV = R / (GAMMA - 1), CP = CV + R, ATM = 101325;
export { AIR_T_MIN };
/** Config pressure stays in bar absolute; UI/presets may use bar gauge. */
export function gaugeToAbsoluteBar(gauge: number) { return gauge + ATM / 1e5; }
export function absoluteToGaugeBar(absolute: number) { return absolute - ATM / 1e5; }
/** Unmarked legacy links store absolute bar. */
export function presetPressure(value: number, unit: string | null) { return unit === 'barg' ? gaugeToAbsoluteBar(value) : value; }
export type Experiment = 'launch' | 'invert' | 'hop';
export type Config = { mass: number; power: number; grip: number; fan: number; pressure: number; volume: number; nozzle: number; boostAt: number; leak: number; angle: number; pulse: number };
export const DEFAULTS: Config = { mass: 1800, power: 900, grip: 1.3, fan: 80, pressure: 400 + ATM / 1e5, volume: 600, nozzle: 10, boostAt: 0, leak: 20, angle: 180, pulse: .65 };
export type GasState = { mass: number; temp: number; u: number };
/** energy is electrical work ∫(F_tire v + P_fan) dt in joules, not tank internal energy. */
export type Sample = { t: number; x: number; v: number; a: number; pressure: number; temp: number; gas: number; u: number; thrust: number; tire: number; downforce: number; flow: number; he: number; energy: number; limit: string; y: number; vy: number };
export type Run = { samples: Sample[]; sixty: number | null; hundred: number | null; finalGas: GasState; used: number; status: string; peakHeight: number; landingSpeed: number | null };

export function initialGas(c: Config): GasState {
  const T = 293, V = c.volume / 1000, { rho, ok } = rhoFromPT(c.pressure * 1e5, T);
  if (!ok) throw new Error('initial fill outside air table');
  const { u, ok: okU } = propsAtTR(T, rho);
  if (!okU) throw new Error('initial fill properties unavailable');
  return { mass: rho * V, temp: T, u };
}
export function pressureOf(c: Config, gas: GasState) {
  const rho = gas.mass / (c.volume / 1000), pr = propsAtTR(gas.temp, rho);
  return pr.ok ? pr.p : gas.mass * R * gas.temp / (c.volume / 1000);
}
export function gasValidity(c: Config, gas: GasState) {
  const rho = gas.mass / (c.volume / 1000);
  if (!(gas.mass > 0) || !Number.isFinite(gas.u) || !Number.isFinite(gas.temp)) return { ok: false, reason: 'OUT OF TABLE' };
  if (!insideTable(gas.temp, rho)) return { ok: false, reason: 'OUT OF TABLE' };
  const pr = propsAtTR(gas.temp, rho);
  if (!pr.ok) return { ok: false, reason: 'OUT OF TABLE' };
  return { ok: true, reason: '' };
}
/** Ensure GasState has consistent u (e.g. share links that only store mass/temp). */
export function withInternalEnergy(c: Config, gas: { mass: number; temp: number; u?: number }): GasState {
  if (gas.u !== undefined && Number.isFinite(gas.u)) return { mass: gas.mass, temp: gas.temp, u: gas.u };
  const rho = gas.mass / (c.volume / 1000), pr = propsAtTR(gas.temp, rho);
  return { mass: gas.mass, temp: gas.temp, u: pr.ok ? pr.u : 0 };
}

type NozzleResult = { flow: number; thrust: number; he: number };
let nozzleCacheKey = '', nozzleCache: NozzleResult = { flow: 0, thrust: 0, he: 0 };

export function nozzleFlow(p0: number, temp0: number, area: number): NozzleResult {
  if (p0 <= ATM || temp0 <= 1 || area <= 0) return { flow: 0, thrust: 0, he: 0 };
  const cacheKey = `${(p0 / 2e5 | 0)}:${(temp0 | 0)}:${area}`;
  if (cacheKey === nozzleCacheKey) return nozzleCache;
  const { rho: rho0, ok: okRho } = rhoFromPT(p0, temp0);
  if (!okRho) return { flow: 0, thrust: 0, he: 0 };
  const stag = propsAtTR(temp0, rho0);
  if (!stag.ok) return { flow: 0, thrust: 0, he: 0 };

  const tryState = (pe: number) => {
    const Tseed = temp0 * Math.pow(pe / p0, 0.2857);
    const st = propsFromPs(pe, stag.s, Tseed);
    if (!st.ok) return null;
    const ve = Math.sqrt(Math.max(0, 2 * (stag.h - st.h)));
    const { a, ok: okA } = soundSpeed(st.T, st.rho);
    if (!okA) return null;
    return { ...st, pe, ve, a };
  };

  let throat = tryState(ATM);
  let choked = !throat || throat.ve >= throat.a * 0.999;
  if (choked) {
    // Failed pe states are below the isentrope table floor — raise the lower bound.
    // Warm-start near the ideal-gas critical pressure ratio.
    let lo = ATM, hi = p0, best = throat;
    const warm = Math.min(hi, Math.max(lo, p0 * 0.528));
    const warmSt = tryState(warm);
    if (warmSt) { best = warmSt; if (warmSt.ve > warmSt.a) lo = warm; else hi = warm; }
    for (let n = 0; n < 12; n++) {
      const mid = Math.sqrt(lo * hi);
      const st = tryState(mid);
      if (!st) { lo = mid; continue; }
      if (st.ve > st.a) lo = mid; else hi = mid;
      best = st;
    }
    throat = best;
  }
  if (!throat || !(throat.ve > 0) || !(throat.rho > 0)) {
    nozzleCacheKey = cacheKey;
    nozzleCache = { flow: 0, thrust: 0, he: stag.h };
    return nozzleCache;
  }
  const flow = .9 * area * throat.rho * throat.ve;
  const thrust = flow * throat.ve + (throat.pe - ATM) * area;
  nozzleCacheKey = cacheKey;
  nozzleCache = { flow, thrust, he: throat.h };
  return nozzleCache;
}

export function fanModel(c: Config) {
  const u = c.fan / 100, area = .015 + c.leak / 100 * .12, stall = 11000, qFree = 18;
  const dp = stall * u * u / (1 + stall * Math.pow(.65 * area, 2) * 2 / (1.225 * qFree * qFree));
  const q = .65 * area * Math.sqrt(2 * dp / 1.225);
  return { downforce: dp * 4, power: dp * q / .7, dp, q };
}

function tankThermo(c: Config, m: number, u: number) {
  const V = c.volume / 1000, rho = m / V;
  const { T, ok } = tempFromRU(rho, u);
  if (!ok) return { ok: false as const, T: NaN, p: NaN, rho };
  const pr = propsAtTR(T, rho);
  if (!pr.ok) return { ok: false as const, T, p: NaN, rho };
  return { ok: true as const, T, p: pr.p, rho };
}

function forces(c: Config, s: number[], t: number, mode: number) {
  const [, v, m, uInt, fanForce] = s, mass = c.mass + m;
  const th = tankThermo(c, m, uInt);
  const nozzle = mode === 2 && t >= c.boostAt && t < c.boostAt + 2 && th.ok
    ? nozzleFlow(th.p, th.T, c.nozzle * 1e-4)
    : { flow: 0, thrust: 0, he: th.ok ? propsAtTR(th.T, th.rho).h : 0 };
  const f = mode > 0 ? fanModel(c) : { downforce: 0, power: 0, dp: 0, q: 0 };
  const drag = .5 * 1.225 * .58 * v * v, aero = .5 * 1.225 * .65 * v * v;
  const normal = mass * G + fanForce + aero, rolling = v > .01 ? .012 * normal : 0;
  const L = 2.8, h = .42, lf = 1.5, ht = .5, hd = .6;
  const base = (mass * G * lf + (fanForce + aero) * 1.45 + h * (nozzle.thrust - drag - rolling) - nozzle.thrust * ht + drag * hd) / L;
  const traction = Math.max(0, c.grip * base / (1 - c.grip * h / L));
  const power = Math.max(0, c.power * 1000 - f.power), motor = Math.min(42000, power / Math.max(v, .1));
  const tire = Math.min(motor, traction), a = (tire + nozzle.thrust - drag - rolling) / mass;
  const rear = base + tire * h / L;
  const limit = !th.ok ? 'OUT OF TABLE' : normal - rear < 0 ? 'CONTACT LIMIT' : traction < motor ? 'TRACTION LIMITED' : v * 42000 > power ? 'POWER LIMITED' : 'TORQUE LIMITED';
  return { ...nozzle, a, tire, downforce: fanForce + aero, target: f.downforce, electric: tire * v + f.power, limit, T: th.T, p: th.p, thermoOk: th.ok };
}
function rk4(s: number[], t: number, dt: number, deriv: (s: number[], t: number) => number[]) {
  const a = deriv(s, t), b = deriv(s.map((v, i) => v + a[i] * dt / 2), t + dt / 2), d = deriv(s.map((v, i) => v + b[i] * dt / 2), t + dt / 2), e = deriv(s.map((v, i) => v + d[i] * dt), t + dt);
  return s.map((v, i) => v + dt / 6 * (a[i] + 2 * b[i] + 2 * d[i] + e[i]));
}
export function simulateLaunch(c: Config, mode = 2, start = initialGas(c), dt = .002): Run {
  const gas0 = withInternalEnergy(c, start);
  let s = [0, 0, gas0.mass, gas0.u, mode > 0 ? fanModel(c).downforce : 0, 0], t = 0, sixty: number | null = null, hundred: number | null = null;
  const samples: Sample[] = []; let status = 'COMPLETE';
  const derivative = (s: number[], t: number) => {
    const f = forces(c, s, t, mode);
    const mdot = f.thermoOk ? f.flow : 0;
    const du = s[2] > 1e-6 && f.thermoOk ? (s[3] - f.he) * mdot / s[2] : 0;
    return [s[1], f.a, -mdot, du, (f.target - s[4]) / .12, f.electric];
  };
  for (let i = 0; t < 6 + dt / 2; i++) {
    const f = forces(c, s, t, mode);
    if (i % Math.max(1, Math.round(.01 / dt)) === 0) samples.push({ t, x: s[0], v: s[1], a: f.a, gas: s[2], u: s[3], temp: f.T, pressure: f.p, thrust: f.thrust, tire: f.tire, downforce: f.downforce, flow: f.flow, he: f.he, energy: s[5], limit: f.limit, y: 0, vy: 0 });
    if (f.limit === 'CONTACT LIMIT' || f.limit === 'OUT OF TABLE') { status = f.limit; break; }
    let step = Math.min(dt, 6 - t); if (step < 1e-9) break;
    for (const event of [c.boostAt, c.boostAt + 2]) if (t < event - 1e-9 && t + step > event) step = event - t;
    const next = rk4(s, t, step, derivative);
    if (sixty === null && next[1] >= 26.8224) sixty = t + step * (26.8224 - s[1]) / (next[1] - s[1]);
    if (hundred === null && next[1] >= 100 / 3.6) hundred = t + step * (100 / 3.6 - s[1]) / (next[1] - s[1]);
    s = next; t += step;
  }
  const th = tankThermo(c, s[2], s[3]);
  return { samples, sixty, hundred, finalGas: { mass: s[2], temp: th.ok ? th.T : gas0.temp, u: s[3] }, used: gas0.mass - s[2], status, peakHeight: 0, landingSpeed: null };
}
export function invertState(c: Config) {
  const fan = fanModel(c), weight = (c.mass + initialGas(c).mass) * G, rad = c.angle * Math.PI / 180;
  const normal = fan.downforce + weight * Math.cos(rad), demand = Math.abs(weight * Math.sin(rad)), available = c.grip * Math.max(0, normal);
  return { ...fan, normal, demand, available, weight, status: normal <= 0 ? 'CONTACT LOST' : demand > available ? 'SLIDING' : 'ATTACHED', margin: normal / weight };
}
export function simulateHop(c: Config, dt = .002): Run {
  const start = initialGas(c); let s = [0, 0, start.mass, start.u], t = 0, airborne = false, peakHeight = 0, landingSpeed: number | null = null;
  const samples: Sample[] = [];
  function flow(s: number[], t: number) {
    if (t >= c.pulse) return { flow: 0, thrust: 0, he: 0, T: NaN, p: NaN, ok: true };
    const th = tankThermo(c, s[2], s[3]);
    if (!th.ok) return { flow: 0, thrust: 0, he: 0, T: th.T, p: th.p, ok: false };
    return { ...nozzleFlow(th.p, th.T, c.nozzle * 2e-4), T: th.T, p: th.p, ok: true };
  }
  const deriv = (s: number[], t: number) => {
    const n = flow(s, t), a = n.thrust / (c.mass + s[2]) - G;
    const mdot = n.ok ? n.flow : 0;
    const du = s[2] > 1e-6 && n.ok ? (s[3] - n.he) * mdot / s[2] : 0;
    return [s[1], s[0] <= 0 && s[1] <= 0 ? Math.max(0, a) : a, -mdot, du];
  };
  for (let i = 0; t < 120; i++) {
    const n = flow(s, t); peakHeight = Math.max(peakHeight, s[0]);
    const acc = deriv(s, t)[1];
    samples.push({ t, x: 0, v: Math.abs(s[1]), a: acc, pressure: n.p, temp: n.T, gas: s[2], u: s[3], thrust: n.thrust, tire: 0, downforce: 0, flow: n.flow, he: n.he, energy: 0, limit: !n.ok ? 'OUT OF TABLE' : t < c.pulse ? 'THRUST PULSE' : 'BALLISTIC COAST', y: Math.max(0, s[0]), vy: s[1] });
    if (!n.ok && t < c.pulse) break;
    const next = rk4(s, t, dt, deriv);
    if (next[0] > .001) airborne = true;
    if (airborne && next[0] <= 0) {
      const fraction = s[0] / (s[0] - next[0]); landingSpeed = Math.abs(s[1] + fraction * (next[1] - s[1])); t += fraction * dt;
      s = s.map((x, j) => x + fraction * (next[j] - x)); s[0] = 0;
      const th = tankThermo(c, s[2], s[3]);
      samples.push({ ...samples[samples.length - 1], t, y: 0, vy: s[1], v: Math.abs(s[1]), gas: s[2], u: s[3], temp: th.ok ? th.T : samples.at(-1)!.temp, pressure: th.ok ? th.p : samples.at(-1)!.pressure, thrust: 0, flow: 0, he: 0, limit: 'TOUCHDOWN' });
      break;
    }
    s = next; t += dt;
    if (!airborne && t >= c.pulse) break;
  }
  const th = tankThermo(c, s[2], s[3]);
  return { samples, sixty: null, hundred: null, finalGas: { mass: s[2], temp: th.ok ? th.T : start.temp, u: s[3] }, used: start.mass - s[2], status: !airborne ? 'INSUFFICIENT LIFT' : landingSpeed === null ? (samples.some(x => x.limit === 'OUT OF TABLE') ? 'OUT OF TABLE' : 'TIME LIMIT') : 'TOUCHDOWN', peakHeight, landingSpeed };
}
export function sampleAt(run: Run, t: number): Sample {
  const a = run.samples; let lo = 0, hi = a.length - 1;
  while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (a[mid].t <= t) lo = mid; else hi = mid - 1; }
  const left = a[lo], right = a[Math.min(lo + 1, a.length - 1)]; const k = right.t > left.t ? Math.max(0, Math.min(1, (t - left.t) / (right.t - left.t))) : 0;
  const out = { ...left }; for (const key of Object.keys(left) as (keyof Sample)[]) if (key !== 'limit') (out[key] as number) = (left[key] as number) + k * ((right[key] as number) - (left[key] as number)); return out;
}
