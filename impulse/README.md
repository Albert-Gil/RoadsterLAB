# IMPULSE — Roadster Physics Lab

A dependency-free interactive engineering experiment: longitudinal launch, fan-assisted surface contact, and a vertical cold-gas hop. Original procedural WebGL vehicle, pressure-vessel cutaway, force vectors, timeline, telemetry, ghost comparisons, repeated launches, CSV export and shareable parameter presets.

## Run locally

Requires Node.js 24 or later. No package installation or external runtime resources.

```sh
node scripts/build.mjs
node scripts/serve.mjs
```

Open http://127.0.0.1:4173. Alternatively, open `dist/impulse.html` directly in a browser; it embeds all code and styles and needs no server. Run verification with:

```sh
node --experimental-strip-types --test tests/physics.test.ts
```

## Source map

- `src/physics.ts`: pure SI-based simulation engine; typed parameters and results.
- `src/scene.js`: native WebGL renderer and original procedural geometry.
- `src/app.js`: application state, controls, playback, telemetry and CSV export.
- `src/style.css`: responsive interface and reduced-motion preference support.
- `tests/physics.test.ts`: conservation, limiting cases and time-step convergence.
- `scripts/build.mjs`: emits browser JavaScript with Node's TypeScript stripping.

## Model

All numerical vehicle inputs are illustrative assumptions, **not verified Tesla specifications**. There is no calibration to Tesla's claimed acceleration. No external telemetry is collected or transmitted. All simulation occurs locally in the browser.

### Launch

Newton's second law combines rear tire force, gas thrust, quadratic drag and rolling resistance. Tire force is the minimum of a 42 kN wheel-force cap, electrical power available divided by velocity, and a rear-axle friction limit. Axle loads follow quasi-static pitch equilibrium including thrust height. The initial gas mass and all hardware are retained across comparison cases to isolate the effect of enabling subsystems.

The assumed fan curve intersects an orifice seal-leakage curve. A 4 m² sealed area converts pressure difference to load. Fan power is deducted from the electrical power cap. Fans are pre-spun before the run. Aerodynamic downforce and drag use fixed illustrative area-coefficient products.

The tank is rigid, well mixed and adiabatic. Constant-property ideal air follows pV=mRT, dm/dt=-mdot and dT/dt=-(gamma-1)T*mdot/m. An equivalent converging nozzle supports both choked and unchoked flow. Thrust includes exhaust momentum and exit-pressure terms. The boost valve opens after the selected delay for two seconds. RK4 advances the model at 2 ms, with interpolated speed milestones. Fan and tank parameters are not reconstructed Tesla hardware.

**High-pressure gas can deviate substantially from the ideal-gas model.** Real-gas thermodynamics, regulator dynamics, wall heat transfer, load-sensitive tires, suspension and dynamic pitch are omitted. A negative front contact load terminates a run as outside the model envelope. Continued vehicle contact after such a condition is not simulated.

“Launch again” preserves mass and temperature at the end of the six-second run, resetting vehicle position and speed. There is no inferred recharge or thermal recovery time. “Refill” explicitly restores the initial inventory.

### Invert

The platform orientation is prescribed. N=Ffan+mg*cos(theta). Contact is lost for N<=0; sliding occurs when mg*abs(sin(theta)) exceeds mu*N. The display evaluates feasibility; it does not integrate falling or sliding dynamics. The vehicle remains in the prescribed pose even if the interface reports loss of contact.

### Hop

Two equivalent downward nozzle banks supply a timed vertical thrust pulse. After cutoff the vehicle follows ballistic motion. A touchdown event reports incoming speed; there is no impact simulation, stabilization or landing burn. The displayed altitude is compressed to 0.55 times physical height to keep the vehicle in frame. This is an initial vertical experiment, not a reproduction of the prototype's aerial maneuver.

## Sources

- NASA mass-flow choking: https://www.grc.nasa.gov/www/k-12/airplane/mflchk.html
- NASA thrust equation: https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/rocket-thrust-equation/
- Vehicle inspiration: https://www.tesla.com/roadster

## Demonstration sequence

1. Start in Launch with the default assumptions. Enable Ghosts and run at 0.5× speed.
2. Rewind, enable Cutaway and Forces, replay the tank discharge.
3. Finish the run and choose “Launch again, same tank.” Compare the new 0–60 prediction.
4. In Invert, choose “Sweep 0–180°” or drag the angle slider. Play maps six seconds onto platform angle; the tank is not discharged. Reduce fan command while inverted to reveal the contact boundary. Force vectors show contact N, suction, and tangential demand.
5. In Hop, run the pulse and observe the peak height and unpowered touchdown speed.

Capture the first three shots for a 20–30-second presentation. Keep the independent-simulation caption visible.

Keyboard: Space plays or pauses; `[` / `]` scrub; with the canvas focused, arrow keys orbit and `+` / `-` zoom. Pinch or the on-canvas ± buttons zoom on touch devices.

## Verification

Physics: `node --experimental-strip-types --test tests/physics.test.ts` (18 tests), covering mass/adiabatic inventory, timestep, assist ranking, nozzle choke and unchoked pressure-thrust, fan electrical budget, CONTACT LIMIT abort, tank `U = m Cv T`, `sampleAt`, Invert analytic loads, and Hop blowdown.

Browser QA (2026-10-18, local `http://127.0.0.1:4173`): desktop ~766px and 390px mobile emulation. Exercised Launch playback, cutaway, ghosts, 0–100 km/h note, Invert angle sweep with frozen gas inventory and contact vectors, Hop remount, zoom controls, rewind on a narrow layout, and WebGL `getError() === 0`. Passing numerical tests still do not validate Tesla data.

## Next milestones

After Launch + Blowdown is publicly shareable:

- Cinematic recording and a verified hosted portfolio URL.
- Regulated gas delivery and real-gas lookup tables (deferred).
- Hop landing controller and planar attitude dynamics (deferred; keep current Hop/Invert disclosures until those models exist).
