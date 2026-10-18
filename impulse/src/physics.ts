/** SI throughout. All vehicle parameters are illustrative, not Tesla specifications. */
export const G = 9.80665, R = 287.05, GAMMA = 1.4, CV = R / (GAMMA - 1), CP = CV + R, ATM = 101325;
export type Experiment = 'launch' | 'invert' | 'hop';
export type Config = { mass: number; power: number; grip: number; fan: number; pressure: number; volume: number; nozzle: number; boostAt: number; leak: number; angle: number; pulse: number };
export const DEFAULTS: Config = { mass: 1800, power: 900, grip: 1.3, fan: 80, pressure: 200, volume: 200, nozzle: 10, boostAt: 0, leak: 20, angle: 180, pulse: .65 };
export type GasState = { mass: number; temp: number };
/** energy is electrical work ∫(F_tire v + P_fan) dt in joules, not tank internal energy U = m Cv T. */
export type Sample = { t: number; x: number; v: number; a: number; pressure: number; temp: number; gas: number; thrust: number; tire: number; downforce: number; flow: number; energy: number; limit: string; y: number; vy: number };
export type Run = { samples: Sample[]; sixty: number | null; hundred: number | null; finalGas: GasState; used: number; status: string; peakHeight: number; landingSpeed: number | null };
export function initialGas(c: Config): GasState { return { mass: c.pressure * 1e5 * (c.volume / 1000) / (R * 293), temp: 293 }; }
export function pressureOf(c: Config, gas: GasState) { return gas.mass * R * gas.temp / (c.volume / 1000); }
export function nozzleFlow(p: number, temp: number, area: number) {
  if (p <= ATM || temp <= 1 || area <= 0) return { flow: 0, thrust: 0 };
  const ratio = ATM / p, critical = Math.pow(2 / (GAMMA + 1), GAMMA / (GAMMA - 1));
  let flow: number, exitP: number, exitV: number;
  if (ratio <= critical) {
    flow = .9 * area * p * Math.sqrt(GAMMA / (R * temp)) * Math.pow(2 / (GAMMA + 1), (GAMMA + 1) / (2 * (GAMMA - 1)));
    exitP = p * critical; exitV = Math.sqrt(GAMMA * R * temp * 2 / (GAMMA + 1));
  } else {
    flow = .9 * area * p * Math.sqrt(2 * GAMMA / (R * temp * (GAMMA - 1)) * (Math.pow(ratio, 2 / GAMMA) - Math.pow(ratio, (GAMMA + 1) / GAMMA)));
    exitP = ATM; exitV = Math.sqrt(2 * CP * temp * (1 - Math.pow(ratio, (GAMMA - 1) / GAMMA)));
  }
  return { flow, thrust: flow * exitV + (exitP - ATM) * area };
}
export function fanModel(c: Config) {
  const u = c.fan / 100, area = .015 + c.leak / 100 * .12, stall = 11000, qFree = 18;
  const dp = stall * u * u / (1 + stall * Math.pow(.65 * area, 2) * 2 / (1.225 * qFree * qFree));
  const q = .65 * area * Math.sqrt(2 * dp / 1.225);
  return { downforce: dp * 4, power: dp * q / .7, dp, q };
}
// Rear-drive quasi-static load balance: Nr=(W*lf+Df*xf+m*a*h-Ft*ht+D*hd)/L.
// Solve the tire-limited branch algebraically to avoid an acceleration iteration.
function forces(c: Config, s: number[], t: number, mode: number) {
  const [, v, gas, temp, fanForce] = s, mass = c.mass + gas;
  const nozzle = mode === 2 && t >= c.boostAt && t < c.boostAt + 2 ? nozzleFlow(gas * R * temp / (c.volume / 1000), temp, c.nozzle * 1e-4) : { flow: 0, thrust: 0 };
  const f = mode > 0 ? fanModel(c) : { downforce: 0, power: 0, dp: 0, q: 0 };
  const drag = .5 * 1.225 * .58 * v * v, aero = .5 * 1.225 * .65 * v * v;
  const normal = mass * G + fanForce + aero, rolling = v > .01 ? .012 * normal : 0;
  const L = 2.8, h = .42, lf = 1.5, ht = .5, hd = .6;
  const base = (mass * G * lf + (fanForce + aero) * 1.45 + h * (nozzle.thrust - drag - rolling) - nozzle.thrust * ht + drag * hd) / L;
  const traction = Math.max(0, c.grip * base / (1 - c.grip * h / L));
  const power = Math.max(0, c.power * 1000 - f.power), motor = Math.min(42000, power / Math.max(v, .1));
  const tire = Math.min(motor, traction), a = (tire + nozzle.thrust - drag - rolling) / mass;
  const rear = base + tire * h / L;
  return { ...nozzle, a, tire, downforce: fanForce + aero, target: f.downforce, electric: tire * v + f.power, limit: normal - rear < 0 ? 'CONTACT LIMIT' : traction < motor ? 'TRACTION LIMITED' : v * 42000 > power ? 'POWER LIMITED' : 'TORQUE LIMITED' };
}
function rk4(s: number[], t: number, dt: number, deriv: (s: number[], t: number) => number[]) {
  const a = deriv(s, t), b = deriv(s.map((v, i) => v + a[i] * dt / 2), t + dt / 2), d = deriv(s.map((v, i) => v + b[i] * dt / 2), t + dt / 2), e = deriv(s.map((v, i) => v + d[i] * dt), t + dt);
  return s.map((v, i) => v + dt / 6 * (a[i] + 2 * b[i] + 2 * d[i] + e[i]));
}
export function simulateLaunch(c: Config, mode = 2, start = initialGas(c), dt = .002): Run {
  let s = [0, 0, start.mass, start.temp, mode > 0 ? fanModel(c).downforce : 0, 0], t = 0, sixty: number | null = null, hundred: number | null = null;
  const samples: Sample[] = []; let status = 'COMPLETE';
  const derivative = (s: number[], t: number) => { const f = forces(c, s, t, mode); return [s[1], f.a, -f.flow, -(GAMMA - 1) * s[3] * f.flow / Math.max(s[2], .001), (f.target - s[4]) / .12, f.electric]; };
  for (let i = 0; t < 6 + dt / 2; i++) {
    const f = forces(c, s, t, mode);
    if (i % Math.max(1, Math.round(.01 / dt)) === 0) samples.push({ t, x: s[0], v: s[1], a: f.a, gas: s[2], temp: s[3], pressure: s[2] * R * s[3] / (c.volume / 1000), thrust: f.thrust, tire: f.tire, downforce: f.downforce, flow: f.flow, energy: s[5], limit: f.limit, y: 0, vy: 0 });
    if (f.limit === 'CONTACT LIMIT') { status = 'CONTACT LIMIT'; break; }
    let step = Math.min(dt, 6 - t); if (step < 1e-9) break;
    for (const event of [c.boostAt, c.boostAt + 2]) if (t < event - 1e-9 && t + step > event) step = event - t;
    const next = rk4(s, t, step, derivative);
    if (sixty === null && next[1] >= 26.8224) sixty = t + step * (26.8224 - s[1]) / (next[1] - s[1]);
    if (hundred === null && next[1] >= 100 / 3.6) hundred = t + step * (100 / 3.6 - s[1]) / (next[1] - s[1]);
    s = next; t += step;
  }
  return { samples, sixty, hundred, finalGas: { mass: s[2], temp: s[3] }, used: start.mass - s[2], status, peakHeight: 0, landingSpeed: null };
}
export function invertState(c: Config) {
  const fan = fanModel(c), weight = (c.mass + initialGas(c).mass) * G, rad = c.angle * Math.PI / 180;
  const normal = fan.downforce + weight * Math.cos(rad), demand = Math.abs(weight * Math.sin(rad)), available = c.grip * Math.max(0, normal);
  return { ...fan, normal, demand, available, weight, status: normal <= 0 ? 'CONTACT LOST' : demand > available ? 'SLIDING' : 'ATTACHED', margin: normal / weight };
}
export function simulateHop(c: Config): Run {
  // Vertical-only demonstration. Two equivalent downward nozzle banks; no attitude claim.
  const start = initialGas(c); let s = [0, 0, start.mass, start.temp], t = 0, airborne = false, peakHeight = 0, landingSpeed: number | null = null;
  const samples: Sample[] = [], dt = .002;
  function flow(s: number[], t: number) { return t < c.pulse ? nozzleFlow(s[2] * R * s[3] / (c.volume / 1000), s[3], c.nozzle * 2e-4) : { flow: 0, thrust: 0 }; }
  const deriv = (s: number[], t: number) => { const n = flow(s, t), a = n.thrust / (c.mass + s[2]) - G; return [s[1], s[0] <= 0 && s[1] <= 0 ? Math.max(0, a) : a, -n.flow, -(GAMMA - 1) * s[3] * n.flow / s[2]]; };
  for (let i = 0; t < 6; i++) {
    const n = flow(s, t); peakHeight = Math.max(peakHeight, s[0]);
    if (i % 5 === 0) samples.push({ t, x: 0, v: Math.abs(s[1]), a: deriv(s,t)[1], pressure: s[2] * R * s[3] / (c.volume / 1000), temp: s[3], gas: s[2], thrust: n.thrust, tire: 0, downforce: 0, flow: n.flow, energy: 0, limit: t < c.pulse ? 'THRUST PULSE' : 'BALLISTIC COAST', y: Math.max(0, s[0]), vy: s[1] });
    const next = rk4(s, t, dt, deriv);
    if (next[0] > .001) airborne = true;
    if (airborne && next[0] <= 0) { const fraction = s[0] / (s[0] - next[0]); landingSpeed = Math.abs(s[1] + fraction * (next[1] - s[1])); t += fraction * dt; s = s.map((x,j) => x + fraction * (next[j]-x)); s[0] = 0; samples.push({ ...samples[samples.length - 1], t, y: 0, vy: s[1], v: Math.abs(s[1]), gas: s[2], temp: s[3], pressure: s[2]*R*s[3]/(c.volume/1000), thrust: 0, flow: 0, limit: 'TOUCHDOWN' }); break; }
    s = next; t += dt;
  }
  return { samples, sixty: null, hundred: null, finalGas: { mass: s[2], temp: s[3] }, used: start.mass-s[2], status: !airborne ? 'INSUFFICIENT LIFT' : landingSpeed === null ? 'IN FLIGHT' : 'TOUCHDOWN', peakHeight, landingSpeed };
}
export function sampleAt(run: Run, t: number): Sample {
  const a = run.samples; let lo = 0, hi = a.length - 1;
  while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (a[mid].t <= t) lo = mid; else hi = mid - 1; }
  const left = a[lo], right = a[Math.min(lo + 1, a.length - 1)]; const k = right.t > left.t ? Math.max(0, Math.min(1, (t-left.t)/(right.t-left.t))) : 0;
  const out = { ...left }; for (const key of Object.keys(left) as (keyof Sample)[]) if (key !== 'limit') (out[key] as number) = (left[key] as number) + k * ((right[key] as number) - (left[key] as number)); return out;
}
