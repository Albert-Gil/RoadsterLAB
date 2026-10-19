# IMPULSE — Roadster Physics Lab

A dependency-free interactive engineering experiment: longitudinal launch, fan-assisted surface contact, and a vertical cold-gas hop. Original procedural WebGL vehicle, pressure-vessel cutaway, force vectors, timeline, telemetry, ghost comparisons, repeated launches, CSV export and shareable parameter presets.

**Watch / Try:** [Live lab](https://albert-gil.github.io/TRoadster/?demo=1) · [Capture mode](https://albert-gil.github.io/TRoadster/?demo=1&capture=1)

Built with Node 24, zero npm dependencies, RK4 integration, and native WebGL. All vehicle numbers are illustrative assumptions — not calibrated Tesla specifications.

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
- `src/scene.js`: native WebGL renderer, Lambert lighting without environment reflections, and an original procedural vehicle. The body is lofted from designed character lines with creased panels; glass, pillars, door gaps, vents, light bars and skirts are exact projected panel cuts. Proportions were checked offline against photos and a reference STL, which the app never loads.
- `scripts/render-ref.mjs`, `scripts/section-ref.mjs`, `scripts/measure-ref.mjs`: optional offline renders, sections and measurements for comparing `carParts()` with a local reference STL.
- `src/app.js`: application state, controls, playback, telemetry and CSV export.
- `src/audio.js`: opt-in Web Audio sonification of simulated speed, tire load and thrust.
- `src/style.css`: responsive interface and reduced-motion preference support.
- `tests/physics.test.ts`: conservation, limiting cases and time-step convergence.
- `scripts/build.mjs`: emits browser JavaScript with Node's TypeScript stripping.

## Model

All numerical vehicle inputs are illustrative assumptions, **not verified Tesla specifications**. There is no calibration to Tesla's claimed acceleration. No external telemetry is collected or transmitted. All simulation occurs locally in the browser.

### Launch

Newton's second law combines rear tire force, gas thrust, quadratic drag and rolling resistance. Tire force is the minimum of a 42 kN wheel-force cap, electrical power available divided by velocity, and a rear-axle friction limit. Axle loads follow quasi-static pitch equilibrium including thrust height. The initial gas mass and all hardware are retained across comparison cases to isolate the effect of enabling subsystems.

The assumed fan curve intersects an orifice seal-leakage curve. A 4 m² sealed area converts pressure difference to load. Fan power is deducted from the electrical power cap. Fans are pre-spun before the run. Aerodynamic downforce and drag use fixed illustrative area-coefficient products.

The tank is rigid, well mixed and adiabatic. Constant-property ideal air follows pV=mRT, dm/dt=-mdot and dT/dt=-(gamma-1)T*mdot/m. An equivalent converging nozzle supports both choked and unchoked flow. Thrust includes exhaust momentum and exit-pressure terms. The boost valve opens after the selected delay for two seconds. RK4 advances the model at 2 ms, with interpolated speed milestones. Fan and tank parameters are not reconstructed Tesla hardware.

**High-pressure gas deviates substantially from the ideal-gas model.** At the 650 barg default, pV=mRT gives about 464 kg of air in 600 L. Tabulated air data give a compressibility factor Z of about 1.32 at 500 bar and 300 K, and roughly 1.5 when extrapolated to 651 bara, so real air would hold roughly 30–50% less mass and support a correspondingly shorter thrust. The dry-mass input excludes the pressure-vessel structure; only the stored gas mass is added to the moving mass. Repeat launches cool the tank quickly (about 234 K after the first default launch and 191 K after the second); below 200 K the gas readout is flagged as outside the ideal-gas range, because tabulated Z departs from 1 by more than about 15% there at tank pressures above roughly 50 bar. Real-gas thermodynamics, regulator dynamics, wall heat transfer, load-sensitive tires, suspension and dynamic pitch are omitted. A negative front contact load terminates a run as outside the model envelope. Continued vehicle contact after such a condition is not simulated.

“Launch again” preserves mass and temperature at the end of the six-second run, resetting vehicle position and speed. There is no inferred recharge or thermal recovery time. “Refill” explicitly restores the initial inventory.

### Invert

The platform orientation is prescribed. N=Ffan+mg*cos(theta). Contact is lost for N<=0; sliding occurs when mg*abs(sin(theta)) exceeds mu*N. The display evaluates feasibility; it does not integrate falling or sliding dynamics. The vehicle remains in the prescribed pose even if the interface reports loss of contact.

### Hop

Two equivalent downward nozzle banks supply a timed vertical thrust pulse. After cutoff the vehicle follows ballistic motion. A touchdown event reports incoming speed; there is no impact simulation, stabilization or landing burn. The displayed altitude uses one constant scale per run, at most 0.55 times physical height (smaller for higher flights), shown above the scene; motion is never clamped. Runs stop at touchdown or at an explicitly labeled 120 s time limit. This is an initial vertical experiment, not a reproduction of the prototype's aerial maneuver.

## Sources

- NASA mass-flow choking: https://www.grc.nasa.gov/www/k-12/airplane/mflchk.html
- NASA thrust equation: https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/rocket-thrust-equation/
- Air compressibility factor table (Vasserman et al.): https://en.wikipedia.org/wiki/Compressibility_factor
- Vehicle inspiration: https://www.tesla.com/roadster

## Demonstration sequence

Open the [live demo](https://albert-gil.github.io/TRoadster/?demo=1) or `?demo=1&capture=1` for a full-bleed recording layout.

1. Start in Launch with the default assumptions. The demo link enables Ghosts and plays at 1×; the speed button cycles 1×, 0.25× and 0.5×.
2. Rewind, enable Cutaway and Forces, replay the tank discharge.
3. Finish the run and choose “Launch again, same tank.” Compare the new 0–60 prediction.
4. In Invert, choose “Sweep 0–180°” or drag the angle slider. Play maps six seconds onto platform angle; the tank is not discharged. Reduce fan command while inverted to reveal the contact boundary. Force vectors show contact N, suction, and tangential demand.
5. In Hop, run the pulse and observe the peak height and unpowered touchdown speed.

Keep the independent-simulation caption visible. Post kit and captions: [`share/SHARE.md`](share/SHARE.md).

Keyboard: Space plays or pauses; `[` / `]` scrub; with the canvas focused, arrow keys orbit and `+` / `-` zoom. Pinch or the on-canvas ± buttons zoom on touch devices.

## Verification

Physics: `node --experimental-strip-types --test tests/physics.test.ts` (23 tests), covering mass/adiabatic inventory, timestep, assist ranking, nozzle choke and unchoked pressure-thrust, fan electrical budget, CONTACT LIMIT abort, tank `U = m Cv T`, `sampleAt`, Invert analytic loads, Hop blowdown and convergence, Hop flights beyond six seconds, gauge/absolute pressure conversion with legacy links, 650 barg parameter corners, and the ideal-gas temperature flag boundary.

Browser QA (2026-10-18, local `http://127.0.0.1:4173`): desktop ~766px and 390px mobile emulation. Exercised Launch playback, cutaway, ghosts, 0–100 km/h note, Invert angle sweep with frozen gas inventory and contact vectors, Hop remount, zoom controls, rewind on a narrow layout, and WebGL `getError() === 0`. Passing numerical tests still do not validate Tesla data.

## Next milestones

Live lab: https://albert-gil.github.io/TRoadster/?demo=1

- Regulated gas delivery and real-gas lookup tables (deferred).
- Hop landing controller and planar attitude dynamics (deferred; keep current Hop/Invert disclosures until those models exist).


## Local testing and sound

From the repository root, run `cd impulse`, `npm run build`, then `npm run dev`.
Open http://127.0.0.1:4173 in your browser. No dependency installation is required;
Node.js 24 or newer is required. Rebuild and refresh after editing source. Stop the
server with Ctrl+C. Alternatively, open `impulse/dist/impulse.html` directly;
sharing requires the hosted or local-server version.

Click **Sound off** to enable synthesized audio, then launch. The electric motor
pitch follows vehicle speed and its level follows tire-force demand; filtered
noise follows cold-gas thrust. These are stylized effects, not recordings or an
acoustic Tesla model. Audio is muted by default, fades on pause/scrub/end, and is
muted while the page is hidden. Playback rate changes event duration, not the
speed-to-pitch mapping. Invert is silent. Browser/system volume controls the level.

Regression checks: `node --experimental-strip-types --test tests/physics.test.ts`
(or `npm test` where npm is configured normally). Manual acceptance: compare all three Launch modes;
pause, scrub, rewind and mute; repeat with the same tank, share that second run
and compare its results in a new tab; refill without changing parameters. Test
Invert forces at 0, 90 and 180 degrees and mobile repeat/refill controls. For Hop,
try 1200 kg / 350 bar / 600 L / 20 cm² / 1.5 s and check apex and touchdown.
Hop uses a constant altitude display scale per run (shown above the scene), with
a 120-second numerical guard explicitly labeled if reached. The force legend
labels scene suction; the Invert capacity chart labels its separate friction curve.

Local edits do not update GitHub Pages until committed and pushed through the
existing deployment workflow.


## Milestone 1: revised defaults and pressure convention

New sessions use 1x playback, 600 L storage and 650 barg at 293 K. This is
651.01325 bara / 65,101,325 Pa absolute at the fixed 1.01325 bar ambient pressure.
The input slider is gauge pressure; vessel telemetry, plots and CSV pressure are
absolute (bara in the UI, Pa in CSV). Config.pressure remains bar absolute.
New shared URLs identify pressureUnit=barg; old URLs without a unit retain their
absolute-pressure interpretation, including preserved starting gas states.
The ideal-gas adiabatic model remains an illustrative baseline at this pressure;
it does not validate tank mass, hardware feasibility or Tesla performance.
Scenario identity is pearl/slate (electric), cyan (fan), orange-red (thrust).
See ../MILESTONES.md for the redesign roadmap. No public deployment is part of M1.


## Milestone 2: scene and analysis layout

The vehicle scene, telemetry strip and playback controls are now separate regions.
Experiment navigation sits above the scene; Tune opens the parameter drawer.
Telemetry becomes a two-column grid on narrow screens. Existing analysis plots
are larger and force delivery automatically scales to the run maximum. The planned
three-scenario position/velocity/acceleration plots and hover inspection belong to M3.
Materials use adjusted paint response, broad studio highlights and cool edge light;
these are visual shading effects, not a physically validated optical rendering.
