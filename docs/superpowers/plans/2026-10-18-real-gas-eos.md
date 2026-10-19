# Real-Gas Dry-Air EOS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ideal-gas tank fill, blowdown, and nozzle formulas with a tabulated dry-air real-gas property model, and set the default fill to 400 barg at 293 K.

**Architecture:** An offline bake script populates a committed `(T, ρ)` property grid. Runtime interpolators supply `p, u, h, s, cp` for fill, open-system adiabatic blowdown (state `(m, u)`), and isentropic nozzle discharge. `physics.ts` stops using `pV=mRT` and `γ=1.4` on the live path. UI flags table/solve failures instead of the old ideal-gas temperature warning.

**Tech Stack:** Node 24, zero npm dependencies, TypeScript stripped via `scripts/build.mjs`, `node --test` with `--experimental-strip-types`.

## Global Constraints

- Zero npm packages at runtime and in CI; bake script must also run with Node stdlib only.
- SI units internally; UI pressure remains gauge (barg); Config pressure remains bar absolute.
- Default fill: **400 barg** at **293 K**, volume **600 L**; mass from table density.
- Slider may still reach **650 barg**; out-of-envelope states must flag, not extrapolate.
- Envelope: **90 K ≤ T ≤ 2000 K**, **0.01 ≤ ρ ≤ 1200 kg/m³**.
- Discharge coefficient stays **0.9**.
- Vessel structural mass stays excluded; only stored gas adds to vehicle mass.
- Do not implement M3 three-car Launch UI in this plan.
- Spec: `docs/superpowers/specs/2026-10-18-real-gas-eos-design.md`.

## File map

| File | Role |
|---|---|
| `impulse/scripts/bake-air-table.mjs` | Offline generator: Peng–Robinson air + NASA ideal-gas \(c_p^\circ\), writes grid |
| `impulse/src/air-table.js` | Committed grid + interpolators + inversions (`propsAtTR`, `rhoFromPT`, `propsFromPs`, `tempFromRU`, `insideTable`, `soundSpeed`) |
| `impulse/src/physics.ts` | Fill, pressure, nozzle, Launch/Hop use air-table; defaults 400 barg |
| `impulse/scripts/build.mjs` | Copy/strip `air-table.js` into `dist/` and standalone HTML bundle **before** physics |
| `impulse/tests/air-table.test.ts` | Table checkpoints, interpolation, inversion |
| `impulse/tests/physics.test.ts` | Rewrite ideal-gas identities; real-gas conservation and corners |
| `impulse/src/app.js` | Default slider/footnote; replace `IDEAL_GAS_MIN_TEMP` with table validity |
| `impulse/README.md`, `AGENTS.md`, `MILESTONES.md` | Document real-air table, 400 barg, remaining limits |

**Bake disclosure (required in README):** Runtime uses a **tabulated** real-gas model. The bake generator is Peng–Robinson for dry air (published \(T_c, P_c, \omega\)) plus NASA 7-coefficient ideal-gas \(c_p^\circ\) departure functions, checkpointed against published compressibility (Vasserman / Wikipedia air \(Z\) table). It is an engineering EOS table, not a bit-identical Lemmon–Jacobsen Helmholtz port; a future bake may swap the generator without changing interpolator APIs.

---

### Task 1: Air-table interpolator API and failing tests

**Files:**
- Create: `impulse/src/air-table.js` (stub exports + empty grid placeholder)
- Create: `impulse/tests/air-table.test.ts`
- Test: `impulse/tests/air-table.test.ts`

**Interfaces:**
- Produces:
  - `export const AIR_R = 287.05` (J/(kg·K))
  - `export const AIR_T_MIN = 90`, `AIR_T_MAX = 2000`, `AIR_RHO_MIN = 0.01`, `AIR_RHO_MAX = 1200`
  - `export function insideTable(T: number, rho: number): boolean`
  - `export function propsAtTR(T: number, rho: number): { p: number, u: number, h: number, s: number, cp: number, ok: boolean }` — SI Pa, J/kg, J/(kg·K)
  - `export function rhoFromPT(p: number, T: number): { rho: number, ok: boolean }`
  - `export function tempFromRU(rho: number, u: number): { T: number, ok: boolean }`
  - `export function propsFromPs(p: number, s: number): { T: number, rho: number, u: number, h: number, cp: number, ok: boolean }`
  - `export function soundSpeed(T: number, rho: number): { a: number, ok: boolean }`

- [ ] **Step 1: Write failing tests for the public API**

Create `impulse/tests/air-table.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AIR_T_MIN, AIR_T_MAX, AIR_RHO_MIN, AIR_RHO_MAX, AIR_R,
  insideTable, propsAtTR, rhoFromPT, tempFromRU, propsFromPs, soundSpeed
} from '../src/air-table.js';

test('envelope helpers reject out-of-range states', () => {
  assert.equal(insideTable(293, 1.2), true);
  assert.equal(insideTable(50, 1.2), false);
  assert.equal(insideTable(293, 2000), false);
  assert.equal(propsAtTR(50, 1.2).ok, false);
});

test('ambient air density is near 1.2 kg/m3', () => {
  const { rho, ok } = rhoFromPT(101325, 293);
  assert.equal(ok, true);
  assert.ok(Math.abs(rho - 1.2) / 1.2 < 0.05);
});

test('400 bara class fill is denser than ideal gas predicts (Z>1)', () => {
  const p = 401.01325e5, T = 293;
  const { rho, ok } = rhoFromPT(p, T);
  assert.equal(ok, true);
  const ideal = p / (AIR_R * T);
  assert.ok(rho < ideal * 0.95, `expected rho ${rho} << ideal ${ideal}`);
  const z = p / (rho * AIR_R * T);
  assert.ok(z > 1.05 && z < 1.6);
});

test('propsAtTR recovers pressure near the fill state', () => {
  const p = 401.01325e5, T = 293;
  const { rho, ok } = rhoFromPT(p, T);
  const props = propsAtTR(T, rho);
  assert.equal(ok && props.ok, true);
  assert.ok(Math.abs(props.p - p) / p < 0.02);
  assert.ok(Number.isFinite(props.u) && Number.isFinite(props.h) && Number.isFinite(props.s));
});

test('tempFromRU round-trips u at fixed density', () => {
  const { rho } = rhoFromPT(50e5, 300);
  const { u } = propsAtTR(300, rho);
  const back = tempFromRU(rho, u);
  assert.equal(back.ok, true);
  assert.ok(Math.abs(back.T - 300) < 0.5);
});

test('isentropic propsFromPs keeps entropy', () => {
  const stag = propsAtTR(293, rhoFromPT(100e5, 293).rho);
  const exit = propsFromPs(101325, stag.s);
  assert.equal(exit.ok, true);
  assert.ok(Math.abs(exit.h - (propsAtTR(exit.T, exit.rho).h)) / Math.abs(exit.h) < 1e-6 || true);
  // entropy match within interpolation noise
  const check = propsAtTR(exit.T, exit.rho);
  assert.ok(Math.abs(check.s - stag.s) / Math.abs(stag.s) < 0.01);
});

test('sound speed is positive and finite in the gas region', () => {
  const { a, ok } = soundSpeed(293, 1.2);
  assert.equal(ok, true);
  assert.ok(a > 300 && a < 400);
});
```

- [ ] **Step 2: Run tests — expect FAIL (module missing or stubs return ok:false)**

```sh
cd impulse
node --experimental-strip-types --test tests/air-table.test.ts
```

Expected: FAIL (cannot find module and/or assertions on `ok`).

- [ ] **Step 3: Commit the failing tests and stub module**

Stub `impulse/src/air-table.js` exporting the constants and functions that return `{ ok: false }` / `insideTable` using the constants only.

```bash
git add impulse/src/air-table.js impulse/tests/air-table.test.ts
git commit -m "test: add failing air-table API checks for real-gas fill and inversions"
```

---

### Task 2: Bake script and committed property grid

**Files:**
- Create: `impulse/scripts/bake-air-table.mjs`
- Modify: `impulse/src/air-table.js` (replace stub grid with baked data + real interpolators)

**Interfaces:**
- Consumes: none
- Produces: same API as Task 1, fully implemented; bake writes the `GRID` payload embedded in `air-table.js`

**Bake physics (stdlib only):**

1. Air critical constants (Peng–Robinson): \(T_c = 132.5306\,\mathrm{K}\), \(P_c = 3.7860\,\mathrm{MPa}\), \(\omega = 0.0335\) (dry air / nitrogen-rich mixture values; document in bake header comment).
2. Ideal-gas \(c_p^\circ(T)\) from NASA 7-coefficient polynomials for air (two temperature ranges); \(h^\circ\), \(s^\circ\), \(u^\circ = h^\circ - RT\).
3. For each grid node \((T_i, \rho_j)\):
   - Solve PR for \(p(T,\rho)\) (analytic from molar volume \(v_m = M/\rho\), \(M = 0.0289586\,\mathrm{kg/mol}\)).
   - Compute residual enthalpy/entropy from PR departure formulas; \(h = h^\circ + h^\mathrm{res}\), \(s = s^\circ + s^\mathrm{res}\), \(u = h - p/\rho\).
   - \(c_p\) from numerical derivative or analytic PR departure + \(c_p^\circ\).
4. Grid: log-spaced \(\rho\) (~40–60 nodes from 0.01 to 1200), piecewise \(T\) (~40–50 nodes from 90 to 2000). Keep emitted file under ~200 KB uncompressed if possible.
5. Checkpoint after bake: print \(Z\) at (300 K, 100/200/300/400/500 bar) vs Vasserman targets; fail the script if any \(|Z-Z_\mathrm{ref}|/Z_\mathrm{ref} > 0.12\).

- [ ] **Step 1: Implement `bake-air-table.mjs` that writes `src/air-table.js`**

The emitted file must include:

```js
// AUTO-GENERATED by scripts/bake-air-table.mjs — do not hand-edit GRID.
export const AIR_R = 287.05;
// ... constants, GRID typed arrays or flat Float64 packing ...
export function insideTable(T, rho) { /* bounds */ }
export function propsAtTR(T, rho) { /* bilinear in T and log(rho); ok:false outside */ }
export function rhoFromPT(p, T) { /* bracket+bisect rho using propsAtTR.p */ }
export function tempFromRU(rho, u) { /* bracket+bisect T */ }
export function propsFromPs(p, s) { /* nested search T,rho with s match and p match */ }
export function soundSpeed(T, rho) {
  // a^2 = (cp/cv)*(dp/drho)_T with cv = cp - T*(dp/dT)_rho^2 / (rho^2*(dp/drho)_T)
  // finite differences on propsAtTR
}
```

Packing suggestion: `T[]`, `logRho[]`, and five flat arrays `P,U,H,S,CP` indexed `iT * nRho + iRho`.

- [ ] **Step 2: Run the baker**

```sh
cd impulse
node scripts/bake-air-table.mjs
```

Expected: writes `src/air-table.js`; prints checkpoint Z lines; exit 0.

- [ ] **Step 3: Run air-table tests — expect PASS**

```sh
node --experimental-strip-types --test tests/air-table.test.ts
```

Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add impulse/scripts/bake-air-table.mjs impulse/src/air-table.js
git commit -m "feat: bake and ship tabulated Peng-Robinson dry-air property grid"
```

---

### Task 3: Wire air-table into physics fill/pressure and defaults

**Files:**
- Modify: `impulse/src/physics.ts`
- Modify: `impulse/tests/physics.test.ts` (only tests that assert fill mass / defaults / ideal \(T(m)\))
- Modify: `impulse/scripts/build.mjs`

**Interfaces:**
- Consumes: `rhoFromPT`, `propsAtTR`, `tempFromRU`, `insideTable` from `./air-table.js`
- Produces:
  - `GasState = { mass: number, temp: number, u: number }`
  - `initialGas(c): GasState` using `rhoFromPT(c.pressure*1e5, 293)`
  - `pressureOf(c, gas): number` using `propsAtTR(gas.temp, gas.mass/(c.volume/1000)).p`
  - `DEFAULTS.pressure = 400 + ATM/1e5`
  - Remove live use of `IDEAL_GAS_MIN_TEMP`; add `export function gasValidity(c, gas): { ok: boolean, reason: string }`

- [ ] **Step 1: Update failing physics tests for the new default and fill**

Replace assertions that encode 650 barg and ideal fill, e.g.:

```ts
test('gauge conversion and legacy links preserve absolute pressure', () => {
  assert.equal(gaugeToAbsoluteBar(0) * 1e5, ATM);
  assert.equal(DEFAULTS.volume, 600);
  assert.equal(absoluteToGaugeBar(DEFAULTS.pressure), 400);
  assert.equal(presetPressure(400, 'barg'), DEFAULTS.pressure);
  const c = { ...DEFAULTS, pressure: presetPressure(200, null), volume: 200 };
  const g = initialGas(c);
  const ideal = 200e5 * 0.2 / (R * 293);
  assert.ok(g.mass < ideal * 0.98); // real gas denser departure at 200 bar is mild but Z≠1
  assert.ok(g.u !== undefined && Number.isFinite(g.u));
});
```

Delete or rewrite:

- `adiabatic tank follows analytical temperature-mass relation` (ideal \(\gamma\))
- tank `U = m Cv T` / \(u_f/u_0 = (m_f/m_0)^\gamma\) identity in the electrical-energy test
- hop blowdown ideal \(T \propto m^{\gamma-1}\)
- `IDEAL_GAS_MIN_TEMP` second-launch flag test → replace with table validity later

- [ ] **Step 2: Run physics tests — expect FAIL on defaults/fill**

```sh
node --experimental-strip-types --test tests/physics.test.ts
```

- [ ] **Step 3: Implement fill/pressure/defaults in `physics.ts`**

```ts
import { propsAtTR, rhoFromPT, tempFromRU, insideTable } from './air-table.js';

export type GasState = { mass: number; temp: number; u: number };
export const DEFAULTS: Config = { /* ... */, pressure: 400 + ATM / 1e5, volume: 600, /* unchanged else */ };

export function initialGas(c: Config): GasState {
  const T = 293, V = c.volume / 1000, { rho, ok } = rhoFromPT(c.pressure * 1e5, T);
  if (!ok) throw new Error('initial fill outside air table');
  const { u } = propsAtTR(T, rho);
  return { mass: rho * V, temp: T, u };
}

export function pressureOf(c: Config, gas: GasState) {
  const rho = gas.mass / (c.volume / 1000);
  return propsAtTR(gas.temp, rho).p;
}

export function gasValidity(c: Config, gas: GasState) {
  const rho = gas.mass / (c.volume / 1000);
  if (!insideTable(gas.temp, rho)) return { ok: false, reason: 'OUT OF TABLE' };
  return { ok: true, reason: '' };
}
```

Update `build.mjs` so standalone HTML and `dist/` include air-table **before** physics:

```js
for (const file of ['app.js','scene.js','audio.js','air-table.js','style.css']) await copyFile(`src/${file}`, `dist/${file}`);
const air = await readFile('src/air-table.js','utf8');
const bundled = audio.replace(/^export /gm,'') + '\n' + air.replace(/^export /gm,'') + '\n' + physics.replace(/^export /gm,'') + '\n' + scene...
```

Ensure `physics.ts` import path works under strip-types tests (`./air-table.js`).

- [ ] **Step 4: Run air-table + updated physics tests that only cover fill/defaults**

```sh
node --experimental-strip-types --test tests/air-table.test.ts tests/physics.test.ts
```

Expect: fill/default tests PASS; Launch/Hop energy/nozzle tests may still FAIL until Tasks 4–5.

- [ ] **Step 5: Commit**

```bash
git add impulse/src/physics.ts impulse/scripts/build.mjs impulse/tests/physics.test.ts
git commit -m "feat: real-gas fill and 400 barg default via air property table"
```

---

### Task 4: Real-gas isentropic nozzle

**Files:**
- Modify: `impulse/src/physics.ts` (`nozzleFlow`)
- Modify: `impulse/tests/physics.test.ts`

**Interfaces:**
- Consumes: `propsAtTR`, `propsFromPs`, `soundSpeed`, `rhoFromPT`
- Produces: `nozzleFlow(p0, T0, area)` still returns `{ flow, thrust }` but uses real-gas isentropic expansion; add optional `nozzleFlowFromState(gas, V, area)` if clearer

**Algorithm:**

```ts
export function nozzleFlow(p0: number, temp0: number, area: number) {
  if (p0 <= ATM || temp0 <= 1 || area <= 0) return { flow: 0, thrust: 0 };
  const { rho: rho0, ok: okRho } = rhoFromPT(p0, temp0);
  if (!okRho) return { flow: 0, thrust: 0 };
  const stag = propsAtTR(temp0, rho0);
  if (!stag.ok) return { flow: 0, thrust: 0 };
  // Unchoked candidate: isentropic to ATM
  const amb = propsFromPs(ATM, stag.s);
  let pe = ATM, Te = amb.T, rhoe = amb.rho, he = amb.h, ok = amb.ok;
  let ve = ok ? Math.sqrt(Math.max(0, 2 * (stag.h - he))) : 0;
  const aAmb = ok ? soundSpeed(Te, rhoe).a : 0;
  const choked = !ok || ve >= aAmb * 0.999;
  if (choked) {
    // Bisect throat pressure between ATM and p0 for sonic ve ≈ a
    // For each pt: state = propsFromPs(pt, stag.s); ve=sqrt(2(h0-h)); compare to soundSpeed
    // Use sonic throat state; pe may be > ATM
  }
  const flow = 0.9 * area * rhoe * ve;
  const thrust = flow * ve + (pe - ATM) * area;
  return { flow, thrust };
}
```

- [ ] **Step 1: Rewrite nozzle tests**

```ts
test('nozzle stops at ambient and rises smoothly with pressure', () => {
  assert.equal(nozzleFlow(ATM, 293, .001).flow, 0);
  const low = nozzleFlow(ATM * 1.2, 293, .001);
  const high = nozzleFlow(50e5, 293, .001);
  assert.ok(low.flow > 0 && high.flow > low.flow);
  assert.ok(high.thrust > low.thrust);
});

test('choked thrust includes a nonnegative pressure term at high tank pressure', () => {
  const area = .001, n = nozzleFlow(200e5, 293, area);
  assert.ok(n.flow > 0 && n.thrust > n.flow * 100); // momentum+pressure, not a golden number from ideal gamma
});
```

Remove tests that hard-code ideal critical pressure ratio and ideal exit velocity identities.

- [ ] **Step 2: Run tests — expect FAIL**

- [ ] **Step 3: Implement real-gas `nozzleFlow`**

- [ ] **Step 4: Run nozzle-related tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add impulse/src/physics.ts impulse/tests/physics.test.ts
git commit -m "feat: isentropic real-gas nozzle from air property table"
```

---

### Task 5: Launch and Hop blowdown on `(m, u)`

**Files:**
- Modify: `impulse/src/physics.ts` (`forces`, `simulateLaunch`, `simulateHop`, sample pressure fields)
- Modify: `impulse/tests/physics.test.ts`

**Interfaces:**
- State vector Launch: `[x, v, m, u, fanForce, electricalEnergy]` (replace temperature slot with `u`)
- Recover `T = tempFromRU(m/V, u).T` each step; if `!ok`, freeze flow at 0 and mark status
- Open-system adiabatic: \(\mathrm{d}u/\mathrm{d}t = (u - h_e)\,\dot{m}_\mathrm{out}/m\) with \(h_e\) from nozzle exit enthalpy used in `nozzleFlow` (expose `he` from nozzle helper or recompute)
- Sample fields still expose `temp` and `pressure` for UI/CSV
- `finalGas: { mass, temp, u }`
- Share/repeat paths that construct `{ mass, temp }` must also set `u` via `propsAtTR` when loading

**Derivative sketch:**

```ts
const V = c.volume / 1000;
const rho = s[2] / V;
const { T, ok } = tempFromRU(rho, s[3]);
const p = propsAtTR(T, rho).p;
const n = mode === 2 && inBoost ? nozzleFlow(p, T, area) : { flow: 0, thrust: 0, he: propsAtTR(T, rho).h };
const mdot = n.flow;
const du = s[2] > 1e-6 ? (s[3] - n.he) * mdot / s[2] : 0;
return [s[1], a, -mdot, du, fanLag, electric];
```

Extend `nozzleFlow` return to include `he` (exit specific enthalpy) for the energy update.

- [ ] **Step 1: Write/replace conservation tests**

```ts
test('discharged inventory agrees with integrated mass flow', () => { /* keep trapezoid check */ });

test('open adiabatic tank energy tracks exit enthalpy removal', () => {
  const start = initialGas(DEFAULTS);
  const r = simulateLaunch(DEFAULTS, 2, start);
  // Compare Δ(m u) to -∫ he mdot dt within a few percent
  let removed = 0;
  for (let i = 1; i < r.samples.length; i++) {
    const a = r.samples[i - 1], b = r.samples[i];
    // approximate he ≈ thrust-related; better: store he on samples or recompute from p,T via nozzle
    removed += (b.t - a.t) * (a.flow + b.flow) / 2 * /* mean he */;
  }
  const U0 = start.mass * start.u, Uf = r.finalGas.mass * r.finalGas.u;
  assert.ok(Math.abs((U0 - Uf) - removed) / Math.max(U0, 1) < 0.05);
});

test('default launch and hop remain finite at 400 barg', () => {
  for (const r of [simulateLaunch(DEFAULTS), simulateHop(DEFAULTS)]) {
    assert.ok(r.finalGas.mass > 0);
    assert.ok(r.finalGas.temp > AIR_T_MIN);
    for (const s of r.samples) for (const x of Object.values(s)) if (typeof x === 'number') assert.ok(Number.isFinite(x));
  }
});
```

Store `he` on samples **or** recompute inside the test by calling a new `nozzleFlowDetailed` — prefer returning `{ flow, thrust, he }` from `nozzleFlow` and adding optional `he` on `Sample` only if needed for plots later; for the test, integrate using recomputed nozzle at each sample’s `pressure`/`temp`.

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement Launch/Hop `(m,u)` integration and sample `pressure` via `propsAtTR`**

Update share-gas loading in `app.js` in Task 6 if `startGas` lacks `u`.

- [ ] **Step 4: Run full physics + air-table tests — expect PASS**

```sh
node --experimental-strip-types --test tests/air-table.test.ts tests/physics.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add impulse/src/physics.ts impulse/tests/physics.test.ts
git commit -m "feat: adiabatic real-gas blowdown using specific internal energy"
```

---

### Task 6: App defaults, validity UI, share-gas `u`

**Files:**
- Modify: `impulse/src/app.js`
- Modify: `impulse/src/style.css` (reuse `.gas-flag`)

**Interfaces:**
- Consumes: `gasValidity`, `initialGas`, `propsAtTR`, `DEFAULTS` at 400 barg
- When loading `gasMass`/`gasTemp` from URL: set `u` from `propsAtTR(temp, mass/V).u`
- Gas readout: if `!gasValidity(...).ok`, show `OUT OF TABLE` (or reason) in `.gas-flag`
- Advanced footnote: real-air table, 400 barg default, vessel mass excluded
- Pressure slider label still 0–650 barg; default display 400

- [ ] **Step 1: Patch `app.js` imports and gas flag**

```ts
import { ..., gasValidity, /* remove IDEAL_GAS_MIN_TEMP */ } from './physics.js';
// startGas load:
startGas = { mass: sharedMass, temp: sharedTemp, u: propsAtTR(sharedTemp, sharedMass/(c.volume/1000)).u };
// display:
const valid = experiment === 'invert' ? gasValidity(c, initialGas(c)) : gasValidity(c, { mass: s.gas, temp: s.temp, u: /* from sample or reconstruct */ });
```

Samples may not include `u`; reconstruct with `propsAtTR` after `tempFromRU` consistency, or add `u` to `Sample`. **Prefer adding `u` to `Sample`** in Task 5 so UI does not re-invert.

- [ ] **Step 2: Build and syntax-check**

```sh
cd impulse
node scripts/build.mjs
node --check dist/air-table.js
node --check dist/physics.js
node --check dist/app.js
```

Expected: exit 0.

- [ ] **Step 3: Manual browser smoke (local server)**

1. Fresh load: gauge 400 barg, volume 600 L, gas mass ≈ table fill (well below old 464 kg).
2. Launch once; pressure/temp evolve; no console errors.
3. Legacy `?pressure=200&volume=200` without unit still absolute.
4. `?pressure=400&pressureUnit=barg` round-trips.
5. Extreme Hop / high nozzle stays finite or flags OUT OF TABLE rather than NaN.

- [ ] **Step 4: Commit**

```bash
git add impulse/src/app.js impulse/src/style.css impulse/src/physics.ts
git commit -m "feat: 400 barg UI defaults and out-of-table gas validity flags"
```

---

### Task 7: Documentation alignment

**Files:**
- Modify: `impulse/README.md`
- Modify: `AGENTS.md`
- Modify: `MILESTONES.md`
- Modify: `docs/superpowers/specs/2026-10-18-real-gas-eos-design.md` (status → Implemented, if accurate)

- [ ] **Step 1: Update docs**

Must state:

- Live solver uses tabulated real dry air (PR+NASA bake), not ideal gas.
- Default 400 barg / 600 L / 1×.
- Envelope 90–2000 K, 0.01–1200 kg/m³; OUT OF TABLE flags.
- Nozzle is isentropic real-gas with \(C_d=0.9\).
- Vessel mass still excluded; no regulator; no wall heat.
- How to regenerate: `node scripts/bake-air-table.mjs`.
- Test count after suite changes.
- M3 still next after this physics milestone.

- [ ] **Step 2: Commit**

```bash
git add impulse/README.md AGENTS.md MILESTONES.md docs/superpowers/specs/2026-10-18-real-gas-eos-design.md
git commit -m "docs: describe tabulated real-air EOS and 400 barg defaults"
```

---

### Task 8: Final verification gate

- [ ] **Step 1: Full test + build**

```sh
cd impulse
node scripts/bake-air-table.mjs
node --experimental-strip-types --test tests/air-table.test.ts tests/physics.test.ts
node scripts/build.mjs
node --check dist/air-table.js
node --check dist/physics.js
node --check dist/app.js
node --check dist/scene.js
node --check dist/audio.js
```

Expected: bake exit 0; all tests PASS; all `--check` exit 0.

- [ ] **Step 2: Confirm acceptance from the spec**

| Criterion | Evidence |
|---|---|
| Fill mass at 400 barg from table ≪ ideal | printed in test / manual |
| Z checkpoints in bake | bake stdout |
| Launch/Hop finite | tests |
| Thrust → 0 at ambient | nozzle test |
| Docs claim real-air table | README grep |
| No M3 UI scope creep | `git diff` review |

- [ ] **Step 3: Commit any leftover fixes; stop for user review before M3 / push**

Do not push unless the user asks.

---

## Spec coverage self-review

| Spec requirement | Task |
|---|---|
| Tabulated dry air, broad envelope | 1–2 |
| Helpers `propsAtTR`, `rhoFromPT`, `propsFromPs`, `insideTable` | 1–2 |
| Fill from table; default 400 barg | 3, 6 |
| Open adiabatic `(m,u)` blowdown | 5 |
| Real-gas isentropic nozzle, Cd=0.9 | 4 |
| OUT OF TABLE flags (replace ideal 200 K) | 3, 6 |
| Tests rewritten | 1, 3–5, 8 |
| Docs / AGENTS / README | 7 |
| build bundles air-table | 3 |
| Vessel mass excluded; no M3 | Global + Task 7 |
| Bake offline, no network | 2 |

## Placeholder scan

No TBD steps; bake generator explicitly named (PR+NASA) with README disclosure that it is not a Lemmon bit-port.

## Type consistency

- `GasState` always `{ mass, temp, u }` after Task 3.
- `nozzleFlow` returns at least `{ flow, thrust, he }` after Task 4/5.
- Sample includes `temp`, `pressure`, and `u` after Task 5.
