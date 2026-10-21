# RoadsterLAB — Interactive Vehicle Physics

A dependency-free interactive engineering experiment: longitudinal launch, fan-assisted attachment, sliding and falling, a vertical cold-gas hop, and a grip-limited steering comparison. Original procedural WebGL vehicle, pressure-vessel cutaway, force vectors, timeline, telemetry, three-car comparisons, repeated launches, CSV export and shareable parameter presets.

**Watch / Try:** [Live lab](https://albert-gil.github.io/RoadsterLAB/?demo=1) · [Capture mode](https://albert-gil.github.io/RoadsterLAB/?demo=1&capture=1)

Built with Node 24, zero npm dependencies, RK4 gas/flight integration, analytic Invert/Turn segments, and native WebGL. All vehicle numbers are illustrative assumptions — not calibrated Tesla specifications.

The root [GitHub README](../README.md) is the current consolidated physics and usage guide.
This document also retains implementation notes and earlier milestone records.

## Run locally

Requires Node.js 24 or later. No package installation or external runtime resources.

```sh
node scripts/build.mjs
node scripts/serve.mjs
```

Open http://127.0.0.1:4173. Alternatively, open `dist/roadsterlab.html` directly in a browser; it embeds all code and styles and needs no server. Run verification with:

```sh
node --experimental-strip-types --test tests/*.test.*
```

## Source map

- `src/physics.ts`: pure SI-based simulation engine; typed parameters and results.
- `src/scene.js`: native WebGL renderer with analytic sunrise reflections, directional lighting, soft contact shadows, and an original procedural vehicle. The body is lofted from designed character lines with creased panels; glass, pillars, door gaps, vents, light bars and skirts are exact projected panel cuts. Proportions were checked offline against photos and a reference STL, which the app never loads.
- `src/scenery.js`: decorative Starbase-inspired rocket, lattice tower, tanks, hangars, dunes and tidal channel. Original static geometry is batched by material, with a procedural sunrise sky and terrain detail. Scenery stays in world coordinates during Launch; the sky follows the camera. No image textures, third-party runtime assets or dependencies are required. Linear-light material shading, soft projected shadows and filmic display mapping are artistic optical approximations. This is an artistic setting, not a site reconstruction; scenery does not change vehicle forces, friction, terrain interaction or collisions.
- `scripts/render-ref.mjs`, `scripts/section-ref.mjs`, `scripts/measure-ref.mjs`: optional offline renders, sections and measurements for comparing `carParts()` with a local reference STL.
- `src/app.js`: application state, controls, playback, telemetry and CSV export.
- `src/turn.js`: comparison colors, grip/trajectory plots, road mesh and deterministic impact state.
- `src/invert.js`: dynamic Invert plots, world-pose reconstruction and cosmetic impact state.
- `src/audio.js`: recorded Web Audio layers with default-on startup; see `docs/AUDIO.md`.
- `src/style.css`: responsive interface and reduced-motion preference support.
- `tests/physics.test.ts`: conservation, limiting cases and time-step convergence.
- `scripts/build.mjs`: emits browser JavaScript with Node's TypeScript stripping.

## Model

All numerical vehicle inputs are illustrative assumptions, **not verified Tesla specifications**. There is no calibration to Tesla's claimed acceleration. No external telemetry is collected or transmitted. All simulation occurs locally in the browser.

### Launch

Newton's second law combines rear tire force, gas thrust, quadratic drag and rolling resistance. Tire force is the minimum of a 42 kN wheel-force cap, electrical power available divided by velocity, and a rear-axle friction limit. Axle loads follow quasi-static pitch equilibrium including thrust height. The initial gas mass and all hardware are retained across comparison cases to isolate the effect of enabling subsystems.

The assumed fan curve intersects an orifice seal-leakage curve. A 4 m² sealed area converts pressure difference to load. Fan power is deducted from the electrical power cap. Fans are pre-spun before the run. Aerodynamic downforce and drag use fixed illustrative area-coefficient products.

The tank is rigid and well mixed. Its energy balance is
\(d(mu)/dt=\dot Q-\dot m h_0\), with the user-selected imposed-reservoir heat law
\(\dot Q=UA(T_{source}-T_{gas})\). Positive heat enters the gas; negative heat leaves.
**Vessel heat exchange** in Parameters exposes conductance (0–2000 W/K, default
250 W/K) and source temperature (250–350 K, default 293 K). Zero conductance is the
adiabatic limit. Heat continues during closed-valve coast, changing pressure and
temperature without changing inventory. There is no separate finite wall thermal
store; the source reservoir is assumed constant and its heat is separate from
vehicle electrical work. Repeat launches preserve the actual warmed/cooled gas.

Properties now come from a **thermodynamically consistent direct Peng–Robinson
approximation**. `src/air-table.js` retains its historical API/filename but contains
no independently interpolated property grid. Generate it with
`node scripts/bake-air-table.mjs` from `scripts/air-eos-template.js`. Pressure,
u/h/s, heat capacities and sound speed use the same EOS; h = u + p/rho is enforced.
Sound speed has no ideal-gas fallback. The conservative supported single-phase
domain is **140–2000 K** and **0.01–1176.6 kg/m³**; nonpositive stability derivatives
or unavailable nozzle states are rejected. `OUT OF TABLE` is the retained legacy
status label for an unsupported thermodynamic state. This pseudo-fluid EOS is
an engineering approximation, not the NIST/Lemmon reference formulation. Below
200 K, ideal heat capacity uses an explicit constant-cp continuation of its 200 K
value; this approximation is disclosed rather than extending the fitted polynomial.

The nozzle is a **converging** isentropic real-gas surrogate, with discharge
coefficient 0.9 and coincident throat/exit areas. A supported sonic state is required
for choking. Unchoked exit pressure equals ambient; choked exit pressure can exceed
ambient and its pressure thrust is retained:
\(F=\dot m v_e+(p_e-p_a)A_e\), \(h_0=h_e+v_e^2/2\).
Exit pressure, temperature, velocity, Mach and choking status are exported; nozzle
plots show only active flow. No divergent expansion ratio, regulator, line-pressure
loss, boundary layer, two-phase jet, shock/plume interaction or calibrated thrust
loss model is included. No schematic flow is claimed as CFD.

At 400 barg / 600 L / 293 K, the revised EOS gives about **252.0 kg** of air. Stored
gas is added to the dry mass; vessel structural mass is still not sized separately.
Fan/tire and geometric inputs remain illustrative. Load-sensitive tires, suspension
and dynamic Launch pitch remain omitted. Negative front contact load terminates
the supported Launch model. No vehicle result is calibrated to a Tesla claim.

### Quick test: thrust delivery

In **Hop**, choose **Smooth valve / bell nozzle**, then press Play. The **Thrust
 delivery** controls are in the optional Parameters panel (below the scene on phones). Try one change
at a time: opening time 0 vs 0.06 s, feed loss 0 vs 8%, expansion 1 vs 1.15×.
The vessel analysis shows live valve travel, nozzle-feed pressure and exit speed;
the valve disk and nozzle schematic follow the same sampled state.

These are deliberately lightweight options. Opening follows a smooth prescribed
ramp, repeated for ascent and landing ignition, with immediate closure. Feed
pressure is p_ambient + (p_tank-p_ambient)*(1-loss/100); throttling preserves
enthalpy before isentropic nozzle expansion. Expansion ratio is exit/throat area
(1-1.5). Supported choked expansion conserves throat mass flow; a bell requiring
sub-ambient pressure uses an explicit separated/throat-only approximation.
Unchoked delivery retains the converging surrogate. Cold/unsupported expansion
stops explicitly. This is not a feed-line transient or shock/separation solver.
Defaults 0 s / 0% / 1× retain previous trajectories. Settings are shared/exported;
CSV also includes actual opening, command, inlet pressure and separation flag.

### Invert

Invert uses a **rotating platform**. Set **Starting angle**, **Final angle** and
**Rotation duration** in Parameters, then press **Rotate platform**. The default
is 0° → 180° in 4 s, followed by a 2 s final-angle hold. Pause, scrub and rewind
reconstruct the same solved motion. Equal angles give a stationary 6 s test.
**Whole rig** frames the trajectory; **Track vehicle** follows the car.

A prescribed quintic motion starts and stops with zero angular velocity and
acceleration: θ = θ₀ + (θ₁−θ₀)(10z³−15z⁴+6z⁵), z = clamp(t/T, 0, 1).
The external rig actuator supplies/removes mechanical work. Its electrical power
is not modeled and does not count against the vehicle fan budget. Fan suction
still respects the vehicle electrical cap; gas mass stays unchanged, with temperature
and pressure following the configured heat exchange.

The car is a point COM for translation, with constrained pitch while supported.
With deck coordinate q, COM offset h = 0.65 m, angular speed ω and acceleration α:

\[
N=F_{fan}+m(g\cos\theta+q\alpha+2\dot q\omega-h\omega^2),
\qquad \ddot q=h\alpha+q\omega^2-g\sin\theta+F_{friction}/m.
\]

Locked tires use one Coulomb coefficient: static friction balances tangential
demand up to μN; sliding friction opposes relative motion at magnitude μN.
Rotation therefore changes both attachment and sliding, rather than only the
rendered angle. COM velocity includes the deck's angular motion at detachment.

The illustrative deck is 8 m long and 3.1 m wide, with its pivot 5.5 m above ground.
A 4.7 × 1.3 m rectangular body proxy breaks its seal at first overhang
(|q| = 1.65 m), immediately disabling fan suction and draw. Contact may continue
without suction while normal reaction remains positive. Full clearance or loss
of normal reaction causes detachment. There is no seal recovery or reattachment.
Partial-overhang contact omits tipping moments and does not establish edge stability.

Detached COM translation is ballistic and body angular velocity is retained from
the moving platform. Pitch advances at that angular rate under zero external
torque. Supported pitch remains guided; edge tipping/contact moment feasibility
is not yet solved. A separating-axis body/deck proxy test stops at first secondary
deck contact (1 micrometre numerical tolerance), reporting DECK CONTACT LIMIT and
UNRESOLVED instead of allowing penetration or inventing a ground impact. Collision
response, free-flight aerodynamic torque and structural crashes remain unsupported.
First supported ground contact stops physics, retaining incoming COM speed.
Wreck iff that speed strictly exceeds the adjustable threshold (default 5 m/s);
equality is intact. Damage and debris are cosmetic, not a structural rating.

Rotating runs use RK4 at at most 2 ms with bracketed seal, detachment, relative-stop
and ground-contact events. Both force limits are retained at contact transitions.
Changing the timestep is checked for convergence. Equal-angle runs retain analytic
constant-acceleration segments and exact event times. A rotating run ends at first
impact or two seconds after the prescribed rotation; remaining motion is explicitly
unresolved. Friction loss, external rig work on the COM and fan electrical work are
tracked separately. Rig work includes body rotational kinetic energy using an illustrative uniform
4.7 × 1.3 m rectangle inertia. Deck inertia/motor efficiency remain unmodeled.

Default 0° → 180° / 4 s / fan 80% remains supported at the final angle; some relative
sliding occurs during rotation. With fan off it detaches near 1.726 s and reaches secondary deck contact near
1.727 s. That run now stops as unresolved: the earlier 8.22 m/s ground-impact
prediction was based on an unsupported path through the deck and is superseded.

The pre-run prediction uses the same trajectory as playback. Plots include platform
angle, displacement, clearance, speed and contact loads. Links retain both angles,
rotation duration and camera. CSV includes SI body/platform angles, angular speed,
world velocity, contact, forces, fan electrical work, rig/configuration and outcome.

### Hop

Four balanced underbody cold-gas thrusters drive a vertical-only flight. The nozzle
slider retains the legacy **bank area**: total effective area is twice that input,
and each of four nozzles receives one quarter of the total. At the default 10 cm²
bank setting, total area is 20 cm² and each nozzle is 5 cm². Changing the number
of visible nozzles does not multiply flow, thrust or stored gas.

The solver integrates altitude, signed vertical velocity, gas mass and specific
internal energy with RK4 (default 2 ms):

\[
\dot y=v_y,\qquad \dot v_y=\frac{F}{m_{dry}+m_g}-g,\qquad
\dot m_g=-\dot m_{out},\qquad
\dot u=\frac{(u-h_0)\dot m_{out}+\dot Q}{m_g}.
\]

The common real-air tank/nozzle model supplies pressure, temperature, mass flow,
stagnation enthalpy and thrust throughout the ascent and optional landing burn.
Pulse closure is an exact integration boundary. A bracketed ground-crossing solve
finds touchdown inside the final step; the model ends there. No contact impulse,
suspension, attitude stabilization, structural failure or horizontal dynamics are solved.
A 120 s guard and property-envelope stops remain explicit, with no invented landing.

**Landing burn** is off by default. Parameters offers **Off**, **Automatic**, and
**Manual** modes. The prominent prediction above the vehicle shows intact, wrecked,
no lift-off, or unresolved **before playback**. It uses the completed trajectory
from the same solver and the selected cosmetic wreck threshold. Pending or invalid
inputs clear the previous prediction; unsupported runs never claim a safe landing.

**Automatic** mode forecasts the remaining
blowdown after ascent using the same real-air tank, nozzle area, gas mass and
internal energy. A 10 ms RK4 forecast builds the full-valve force/mass history;
the actual flight still integrates at 2 ms. The planner searches coast and
full-burn ignition times, then refines the landing-speed result. It selects a
late feasible burn for the requested speed, or a best-effort burn from the
searched family if the target cannot be reached. This is a one-dimensional
coast/full-burn forecast, not a proof of global optimality or a flight controller
for a real vehicle.

Once ignition is due, maximum available thrust brakes the descent. Close to the
target, a bounded mean valve duty follows
`F_command = m * (g + (v_down - v_target) / 0.025 s)`.
Duty is clipped to [0, 1] and scales thrust and flow together. The controller
remains descent-only, with no ascent braking or attitude control. Gas is never
refilled or reheated at ignition. No physical pressure regulator or valve
actuator dynamics are modeled.

**Parameters -> More variables** exposes:

| Setting | Default | Effect |
|---|---:|---|
| Target touchdown speed | 1.5 m/s | Requested downward speed at contact; supported range 0.25-5 m/s |
| Ignition lead | 0.020 s | Starts feasible burns ahead of their nominal forecast time; range 0-0.2 s |
| Illustrative wreck threshold | 5 m/s | Outcome rule only; does not change flight physics |

A large ignition lead can spend more gas holding the descent speed and worsen
landing. Lead is applied to feasible plans; reserve-limited plans use their
forecast best-effort timing. A very low target can also exceed available reserve.
The result panel separates the target, achieved speed, forecast feasibility,
valve command and wreck outcome. An intact landing can still miss a stricter
speed target.

The forecast retains a 20 ms full-valve numerical reserve before its gas-model,
pressure or 60 s forecast horizon. At this limit the controller explicitly closes
the valve; supported ballistic flight can continue with the held tank state.
Actual solver property failures still stop as OUT OF TABLE. Forecast limits are
not permission to extrapolate beyond the supported EOS domain.

Try **Landing burn / balanced hop** in the Flight preset menu: a 0.35 s ascent
pulse reaches about **6.73 m**, then lands near **1.50 m/s** with default hardware.
The 0.2 s short-hop burn lands near 1.50 m/s too. The longer standard 0.65 s hop
remains reserve-limited: best-effort braking gives approximately **8.03 m/s**, above
the default wreck threshold. These are calculated illustrative outputs, not
Tesla performance predictions. Parameters are never silently changed to force a
successful landing.

**Manual** mode exposes ignition time (T+0-120 s), duration (0-5 s), and mean valve
command (0-100%). The window is fixed: ignition waits for descent, but its end does
not move if descent starts late. Once ignited, it holds the chosen command until
the window ends, contact occurs, or the gas-model/pressure safety limit closes it.
An early burn can propel the car upward again; the full-flight camera and plots
include these rebound peaks. Automatic target and ignition lead do not tune a
manual burn. A zero duration or command disables the pulse.

During descent, **Fire manual burn now** moves this single window to the current
playback time, using its configured duration and command. This also works while
paused. Calculation briefly pauses playback, preserves the clock and pre-ignition
history, updates the prediction, then resumes if it was playing. Rewind before
ignition to try another timing. The schedule is used unless overridden, so the
pre-run prediction explicitly states the assumed window; it cannot predict a
future button press. Timing and valve settings survive shared links and CSV export.

The **Manual landing / timed example** preset uses a 0.35 s ascent, T+2.21 s ignition,
1 s window and 100% command. It predicts approximately **0.97 m/s**, intact at the
default 5 m/s threshold. Moving ignition to T+2.50 s predicts about **11.10 m/s**,
wrecked. These results apply to that illustrative setup and use the remaining tank,
without refilling at ignition. Manual defaults are timing examples, not an adaptive
controller or a promise of success with other parameters.

Both sides of valve-command discontinuities are retained at identical sample
timestamps. Playback selects the right side; plots show vertical transitions;
CSV integration retains the left-limit discharge. The last positive-flow contact
sample is marked PRE-TOUCHDOWN, followed by the closed-valve TOUCHDOWN sample.
CSV also includes valve duty, target, ignition lead, forecast feasibility and the
controller version (`blowdown-lookahead-v1` or `manual-window-v1`). Manual exports
also record scheduled start, duration, command, actual ignition and cutoff.

The adjustable **wreck threshold** is under Advanced assumptions (default **5 m/s**).
A touchdown wrecks only when incoming speed strictly exceeds the threshold;
equality is intact. This rule changes outcome/visuals without changing the trajectory.
Impact kinetic energy uses dry mass plus remaining gas and is only an engineering
indicator. Flattening, displaced wheels, fragments and dust are cosmetic. Scrubbing
to touchdown reconstructs the settled wreck; live playback adds a brief display-only
effect. Numerical CSV ends at physical touchdown and includes the threshold, outcome,
landing-burn configuration, ignition time and full thermodynamic sample state.

**Flight envelope** frames the whole run; **Track vehicle** follows altitude;
**Inspect thrusters** looks underneath and explicitly hides the ground for inspection.
All use true metre-scale motion, without height compression or clamping. Altitude,
signed velocity, acceleration and vessel plots share the same samples, inspection
clock and keyboard scrubbing. Apex, pulse end, landing ignition and touchdown markers
link directly to playback. Four plumes follow actual modeled discharge, including
renewed flow during braking; no flow means no plume. These effects are schematic,
not CFD.


### Turn (M7)

Turn compares **two independent runs**, without and with the fan. Both carry the
same hardware and unchanged gas inventory and receive the same constant speed
and front-wheel steering command. They share one finite left-hand corner. There
is no driver correction and no collision between the two comparison cars.

**Use it:** select Turn, open Parameters, and try **Fan makes the corner**, **Both clear**,
**Both run wide**, or **Too little steering**. Speed is shown in km/h and angles in
degrees; solver state and numerical CSV use m/s and radians. Positive steering
turns left. **Road radius**, **road corner sweep**, and **road width** are separate
Advanced assumptions; changing steering never redraws the road to fit the car.
Follow selected keeps the vehicle readable; Corner overview shows the whole road.
The top-view trajectory plot, force/grip plots and event buttons share playback.

This is a **steady-state, grip-capped kinematic bicycle surrogate**, not a dynamic
tire-slip or yaw-stability solver. With illustrative wheelbase \(L=2.8\) m and
rear-axle-to-CG distance \(l_r=1.45\) m, the command requests

\[
\beta_{req}=\tan^{-1}\left(\frac{l_r}{L}\tan\delta\right),\qquad
\kappa_{req}=\frac{\tan\delta\cos\beta_{req}}{L}.
\]

Here \(\delta\) is the front-wheel angle and \(\beta\) is the geometric bicycle
angle between body heading and CG velocity; it is not a solved transient tire
slip angle. At constant speed \(V\), the requested lateral force is
\(F_{lat,req}=mV^2|\kappa_{req}|\). The moving mass includes the retained air.
The level-road normal load and steady driving requirement are

\[
N=mg+F_{fan}+\tfrac12\rho C_L A V^2,\qquad
F_{drive}=\tfrac12\rho C_D A V^2+0.012N.
\]

The illustrative area-coefficient products are 0.65 m² downforce and 0.58 m² drag,
with ambient density 1.225 kg/m³. A vehicle-level **combined friction circle**
reserves tire force for driving before allocating the remaining lateral force:

\[
F_{lat,max}=\sqrt{\max(0,(\mu N)^2-F_{drive}^2)},\qquad
\kappa=\operatorname{sign}(\kappa_{req})\min\left(|\kappa_{req}|,
\frac{F_{lat,max}}{mV^2}\right).
\]

Demand above capacity therefore gives a **wider turn**. This is a disclosed
understeer approximation, not a simulation of nonlinear front/rear slip, oversteer,
load-sensitive tires, transient load transfer, suspension, tire heating or rollover.
The ratio plot shows **requested** force/capacity; actual force never exceeds the
modeled circle. An undefined ratio is blank in CSV with a validity flag, rather
than an invented large number.

Fan and drive power share the electrical budget:
\(P_{fan}+VF_{drive}\le P_{cap}\). If necessary, the fan command is reduced by a
bounded search that also accounts for its added rolling resistance. If the base
drive power or tire grip cannot maintain speed, the run reports **SPEED HOLD LIMIT**
at its initial state; it does not claim a valid constant-speed trajectory.
No cold-gas thrust is used and the tank does not discharge.

For fixed inputs, curvature is constant. Closed-form circular/straight segments
sample the planar motion, with course \(\phi=V\kappa t\):

\[
\dot x=V\cos\phi,\qquad \dot z=-V\sin\phi,\qquad
\dot\phi=V\kappa,\qquad
\psi=\phi-\sin^{-1}(l_r\kappa).
\]

The world uses +x forward and +z right. The initial course is zero and the body is
already oriented for the steady turn; entry/steering transients are omitted. The
front-wheel display follows the command, while effective curvature may saturate.
The constant-speed controller is an idealization and continues through runoff.

The default road has a **40 m centreline radius, 90-degree sweep and 10 m width**.
Inner and outer painted edges are finite polygon segments, shared by renderer and
solver. A **4.7 by 2.06 m oriented vehicle envelope** detects the first lane departure
using separating-axis tests and conservative advancement (1e-7 m geometric tolerance),
independent of the output sampling interval. This records an event, without stopping
or damaging the car. The same speed, steering and grip-capped curvature continue
onto the surrounding grass. Grass is visual: terrain traction, fan seal loss,
braking and recovery steering are not modeled.

The whole body must clear the end-gate tangent plane to finish the corner.
A car that previously left the lane retains the **LEFT LANE** outcome, even if it
re-enters. Runs missing the gate continue until **min(30 s, nominal corner time + 2 s)**;
without a departure or a supported exit, the outcome stays unresolved. There are
no solid barriers or Turn wreck effects. Comparison cars never collide with each other.

| Preset | Speed / front steering | Calculated outcome with default road |
|---|---|---|
| Fan makes the corner | 100 km/h / 4 degrees | No fan: leaves outer edge at 1.07 s, continues to 2.75 s; fan: clear at 2.35 s |
| Both clear | 60 km/h / 4 degrees | Both clear about 3.91 s; trajectories coincide |
| Both run wide | 160 km/h / 4 degrees | Leave outer edge at 0.43 s / 0.61 s; continue to 2.59 s / 1.78 s |
| Too little steering | 100 km/h / 2 degrees | Both leave the lane despite spare grip; the commanded curve misses the road |
| Same run / fan off | 100 km/h / 4 degrees, fan off | Exact same trajectory in both cases |

These are calculated illustrative outputs, not Tesla performance predictions.
When car poses overlap, the scene shows the selected case; it never adds a
fictitious lane offset. Both numerical traces and map markers remain independent.
Each marker stops at its own physical endpoint. Late plot readouts are labeled at
run end/exit. Shared links retain SI steering/speed, road geometry, camera and focus;
comparison CSV includes both finite traces, configuration, model version, forces,
power, electrical work, sealed-tank thermal state, lane departure time/side, exit time and outcome.


## Sources

- NASA mass-flow choking: https://www.grc.nasa.gov/www/k-12/airplane/mflchk.html
- NASA thrust equation: https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/rocket-thrust-equation/
- NIST/Lemmon dry-air reference formulation (benchmark target; not the implemented PR approximation): https://www.nist.gov/publications/thermodynamic-properties-air-and-mixtures-nitrogen-argon-and-oxygen-60-2000-k-pressures
- Vehicle inspiration: https://www.tesla.com/roadster

## Demonstration sequence

Open the [live demo](https://albert-gil.github.io/RoadsterLAB/?demo=1) or `?demo=1&capture=1` for a full-bleed recording layout.

1. Start in Launch with the default assumptions. The demo link enables Ghosts and plays at 1×; the speed button cycles 1×, 0.25× and 0.5×.
2. Rewind, enable Cutaway and Forces, replay the tank discharge.
3. Finish the run and choose “Launch again, same tank.” Compare the new 0–60 prediction.
4. In Invert, compare Inverted hold, Slide/lose-seal/fall, and No suction presets. Release the car; inspect seal loss, detachment, ground contact and synchronized forces. Try Track vehicle, event scrubbing and the advanced wreck threshold.
5. In Hop, compare Short pulse and Landing burn / short hop; inspect altitude, signed velocity, vessel state and touchdown outcome. Use Track vehicle for detail and Inspect thrusters for all four nozzles.

Keep the independent-simulation caption visible. Post kit and captions: [`share/SHARE.md`](share/SHARE.md).

Keyboard: Space plays or pauses; `[` / `]` scrub; with the canvas focused, arrow keys orbit and `+` / `-` zoom. Pinch or the on-canvas ± buttons zoom on touch devices.

## Verification

Physics: `node --experimental-strip-types --test tests/*.test.*` (see the current test-run count), covering table envelope and inverses, real-gas fill below ideal inventory, \((m,u)\) blowdown energy, nozzle flow, timestep, assist ranking, fan electrical budget, CONTACT LIMIT abort, `sampleAt`, Invert analytic loads, Hop blowdown and convergence, gauge/absolute pressure conversion with legacy links, 400 barg corners, and `gasValidity` / OUT OF TABLE flags.

Browser QA (2026-10-18, local `http://127.0.0.1:4173`): desktop ~766px and 390px mobile emulation. Exercised Launch playback, cutaway, ghosts, 0–100 km/h note, Invert angle sweep with frozen gas inventory and contact vectors, Hop remount, zoom controls, rewind on a narrow layout, and WebGL `getError() === 0`. Passing numerical tests still do not validate Tesla data.

## Next milestones

Live lab: https://albert-gil.github.io/RoadsterLAB/?demo=1

- Regulated gas delivery and wall heat transfer (deferred).
- Hop planar attitude dynamics and structural contact/impact dynamics remain deferred. Optional vertical landing braking and cosmetic touchdown damage are implemented locally.
- M3 Launch comparison delivered; verification record in `../MILESTONE-3-PLAN.md`.


## Local testing and sound

From the repository root, run `cd impulse`, `npm run build`, then `npm run dev`.
Open http://127.0.0.1:4173 in your browser. No dependency installation is required;
Node.js 24 or newer is required. Rebuild and refresh after editing source. Stop the
server with Ctrl+C. Alternatively, open `impulse/dist/roadsterlab.html` directly;
sharing requires the hosted or local-server version.

Sound defaults to on, starting automatically when allowed or with the first user
interaction when autoplay is blocked. Explicit mute is remembered. Music
continues across pauses and mode changes; effects follow the selected car.
**Parameters → Sound settings** provides independent music/effects volumes; zero
mutes either. Both buses silence in the background. See the current
[Simulation-Driven Audio System](../README.md#simulation-driven-audio-system) and
[technical audio guide](docs/AUDIO.md). The user has confirmed Creator-plan ownership/licensing rights; the audio-specific
deployment block is cleared. The update has not been published.

Regression checks: `node --experimental-strip-types --test tests/*.test.*`
(or `npm test` where npm is configured normally). Manual acceptance: compare all three Launch modes;
pause, scrub, rewind and mute; repeat with the same tank, share that second run
and compare its results in a new tab; refill without changing parameters. Test
Invert forces at 0, 90 and 180 degrees and mobile repeat/refill controls. For Hop,
try 1200 kg / 350 barg / 600 L / 10 cm² / 1 s and check apex and touchdown.
With the current default thermal settings this gives about 46.8 m apex and 6.61 s
flight; this ballistic case has a severe touchdown, not a successful landing.
Hop uses true metre-scale altitude with camera framing and
a 120-second numerical guard explicitly labeled if reached. The force legend
labels scene suction; the Invert capacity chart labels its separate friction curve.

Local edits do not update GitHub Pages until committed and pushed through the
existing deployment workflow.


## Milestone 1: revised defaults and pressure convention

New sessions use 1x playback, 600 L storage and **400 barg** at 293 K. This is
401.01325 bara / 40,101,325 Pa absolute at the fixed 1.01325 bar ambient pressure.
The input slider is gauge pressure (still explores up to 650 barg); vessel telemetry, plots and CSV pressure are
absolute (bara in the UI, Pa in CSV). Config.pressure remains bar absolute.
New shared URLs identify pressureUnit=barg; old URLs without a unit retain their
absolute-pressure interpretation, including preserved starting gas states (`gasMass` / `gasTemp` / optional `gasU`).
The live solver uses the tabulated real-air model; it does not validate tank mass, hardware feasibility or Tesla performance.
Scenario identity is pearl/slate (electric), cyan (fan), orange-red (thrust).
See ../MILESTONES.md for the redesign roadmap. No public deployment is part of M1.


## Milestone 2: scene and analysis layout

The vehicle scene, telemetry strip and playback controls are now separate regions.
Experiment navigation sits above the scene; Parameters jumps to the inline experiment workspace.
Telemetry becomes a two-column grid on narrow screens. Existing analysis plots
are larger and force delivery automatically scales to the run maximum. The planned
three-scenario position/velocity/acceleration plots and hover inspection belong to M3.
Materials use adjusted paint response, broad studio highlights and cool edge light;
these are visual shading effects, not a physically validated optical rendering.


## Audit corrections and verified foundation (2026-10-19)

The tank outflow energy is stagnation enthalpy h0 = h_exit + v_exit²/2;
using exit static enthalpy alone omits jet kinetic energy. Sample.he retains its
existing field name and now means stagnation enthalpy in J/kg. The conservation
regression independently obtains h0 from the tank properties, rather than reusing
that sample field. Enthalpy/internal-energy reference offsets can be negative.

The air-table baker now bisects constant-pressure density in the correct direction
when evaluating cp. Nozzle caching uses exact inputs; pressure/temperature bins
no longer make answers depend on call order. This increases compute cost: the next
Launch milestone includes background computation to keep parameter changes smooth.
Hop keeps tank properties after valve closure. Unsupported integration steps stop
at the last supported state with an explicit property-limit status; displayed
samples and exports must be finite. Invalid pressure queries no longer silently
switch to an ideal-gas equation. Legacy URLs missing gasU reconstruct it from mass
and temperature; inconsistent old energies are reconciled to those physical inputs.

Standalone modules now keep their private variables isolated. The build checks the
assembled artifact's syntax, and CI runs every test file, including air properties,
bundle syntax and renderer-uniform setup. Renderer setup initializes shadow-array,
fog and lane uniforms on every experiment; positive fog scale prevents a dark scene.

M1 uses the latest repository defaults (400 barg, 600 L, 1x), with an input range
through 650 barg. The original 650-barg default was revised to 400 barg in the
committed real-air work before this repair. M2 is technically reverified; further
visual polish and final user approval remain part of the roadmap. M3 now supplies three-car lanes, connected camera controls, kinematic plots and
inspection interactions; see the M3 section below.


## Milestone 3 — parallel launch comparison

Launch now computes all three counterfactual configurations in a background worker.
The same hardware, dry mass and initial gas state apply to each car. Track overview
and elevated side view retain true simulated separation; Focus car provides a closer
view of the selected telemetry/audio subject. Auto frame can be disabled. Visibility
checkboxes only hide the car and plot trace; they do not change the calculations.

Position, velocity and acceleration panels share time and use matching colors/line
styles. Hover inspects without moving playback; click/drag or focus a plot and use
arrow keys to scrub and pause. Shift+arrow changes time by 0.25 s; Home/End select
0/6 s. Moving dots follow inspection time, with a separate live playback cursor.
Acceleration can be displayed in g or m/s². Boost intervals and 0–60 mph events are
annotated. Unsupported runs stop their traces and explicitly label later inspection.

Parameters offers default, low-grip and delayed-boost presets. Selecting a focus does
not recalculate physics. Repeat starts all three configurations from the focused car's
final tank state; refill restores the initial fill. New shared links preserve this
state, view, visibility and focus. Legacy mass/temperature-only links are supported.

Comparison CSV contains all supported samples from every scenario, independent of
visibility, with SI-unit columns, model version, configuration JSON and initial tank
state. Focused run CSV retains the compact per-run export. Pending calculations keep
the last installed result visibly marked; stale responses cannot overwrite newer inputs.
The local server uses module workers; the offline HTML includes a Blob worker with
identical physics. No dependency installation is needed. This milestone has 47
regression checks across air properties, physics, worker parity/control, render setup,
true lane separation, plotting domains, sharing and bundle syntax.

Review limits: physical iOS Safari and real-device profiling remain outstanding. The
full regression run and focused additions pass; manual browser checks cover desktop
and 390px layouts, normal and standalone modes, scrubbing, camera/focus/visibility,
repeat, links, units, downloaded CSV and property-limit handling. M4 Blowdown/sound
is implemented below. Publishing remains a separate user decision.

Playback uses elapsed wall time at the selected speed; a slow render frame does not
change the simulated rate. Backgrounding the page pauses playback and silences audio.
Reduced-motion preference disables automatic demo start and camera transitions.


## Milestone 4 - connected vessel analysis and sound

The dedicated vessel console follows the focused car and the shared playback clock.
It displays pressure in bara (with a barg readout), temperature in K / Celsius and
remaining air mass in kg. Reference-fill percentage refers to a fresh fill at the
current configured pressure/volume; consumed mass refers to the current run. Repeat
launch therefore starts below 100% without losing its previous gas temperature.

State view provides aligned pressure, temperature and remaining-mass plots. Delivery
view provides mass flow in kg/s and gas thrust in kN. Hover inspection links these
plots to the kinematic inspector without moving playback; click/drag or arrow keys
scrub the simulation. Home/End follow the current experiment duration, including Hop
runs longer or shorter than six seconds. Flow-on/off markers come from stored samples
and are limited by sample timing; unsupported runs receive a separate stop marker.
A commanded open valve at ambient pressure is distinguished from actual discharge.

The schematic always shows gas occupying the full fixed volume. Particle opacity
represents inventory and color represents gas temperature on a fixed 293-to-143 K
cooling scale; temperatures outside that color range saturate. This is not a particle
simulation, wall-temperature prediction or tank structural model. The car cutaway
uses the same color scale and its overlay shows pressure, temperature and mass.

Sound is synthesized and opt-in. Motor pitch follows speed and motor level follows
tire-force load. Jet noise changes with both modeled mass flow and thrust. Parameters has
a master-volume slider (35% default); the setting survives experiment changes in the
current session. Pause, mute and backgrounding silence the sources. Gain transitions
are smoothed and the output is compressed. Audio is a perceptual illustration, not
an acoustic model or a Tesla recording.

Verification: all 52 regression tests pass, including discharge markers, units,
blowdown/coast state, Hop time mapping, audio lifecycle, worker parity and standalone
bundle checks. Desktop and 390px layouts, repeat/refill, no-flow electric focus,
cutaway linkage, keyboard scrubbing, state/delivery switching and standalone startup
were exercised in the browser without console errors. Physical iOS Safari and the
subjective audio mix still need real-device review. This is the historical M4 verification record; see MILESTONES.md for current Hop work.


## Current Hop verification (M5-M5c, local)

All 76 regression tests pass, including pressure-aware planning, valve-event integration,
manual timing/duty, rebound peaks, pre-run prediction, conservation, timestep
refinement, target/lead tuning and served/standalone worker parity.
Desktop and 390px browser checks cover true-scale cameras, four thrusters, signed
plots, burn ignition, intact/wreck/no-lift outcomes, scrubbing/rewind, presets,
sharing/reload and vessel state. Valve boundaries retain both limits at duplicate timestamps; all numerical exports remain finite. WebGL reports error 0. See `../MILESTONES.md` for the complete record and
remaining physical-device/visual review limits. These changes are local; the public
GitHub Pages version has not been updated.

## Current Invert verification (M6, local)

All **85 regression tests** pass, including analytic contact/fall limits, frictional
energy loss, electrical work, unchanged gas inventory, exact events, strict impact
classification, sample-spacing invariance, renderer transforms and worker parity.
Desktop and 390px browser review covers release presets, predictions, motion,
contact-force removal, cutaway, cameras, impact/rewind, event scrubbing, sharing,
finite CSV and the standalone bundle. WebGL reports error 0; no console errors
observed. Launch comparison and manual Hop also received smoke checks.

M6 retains fixed pitch and a rectangular ground-contact proxy; no edge tipping,
tumbling or structural crash dynamics are modeled. Physical iOS Safari and final
visual/audio review remain outstanding. See `../MILESTONES.md` for the complete
record. M7 Turn is next. These changes have not been published.


## Current Turn verification (M7, local)

All **96 regression tests** pass. Ten focused Turn tests cover success/failure
presets, bicycle geometry, constant speed, the combined grip and electrical budgets,
unchanged tank inventory, steering/road independence, body-envelope lane departure/exit,
sample-interval invariance, continuous runoff, finite corners/exports and
invalid input handling. Renderer transforms/uniforms and served/standalone worker
parity also pass. Build and browser JavaScript syntax checks pass.

Mobile review at 390x844 covers predictions, presets, playback, independent stops,
rewind, selected-case switching, trajectory pointer/keyboard scrubbing and shared
input reload, with no horizontal overflow or nonfinite paths. The revised standalone CSV has 2,553 finite rows, including 843 no-fan samples
after lane departure, and unchanged gas state. Desktop and 390x844 runoff checks
show continued motion, no damage, and WebGL error 0. Detailed
browser/standalone review and remaining limits are recorded in `../MILESTONES.md`.
M8 integration and its remaining final-review checks are recorded below. No publication performed.


## M8 integration and local review

M8 introduced a keyboard-accessible modal Tune drawer. M9 replaces that drawer
with the inline parameter workspace described below. Model documentation still
pauses playback.
Arrow keys / Home / End select experiment and powertrain choices. Global **Space**
plays or pauses, and **[ / ]** scrub; typing in controls and operating plot sliders
keep their native keys. Focus the vehicle for arrow-key orbit, **+ / -** zoom and
**0** to reset its selected camera. Rewind uses the same camera reset in all four
experiments. Keyboard controls are also listed below each experiment's playback bar.

Switching tabs preserves the repeated-Launch starting tank and run number.
**Refill tank & reset** explicitly restores the fill. Selecting defaults/presets or
changing fill pressure/volume still changes the configured setup. Launch focus now
updates both the main plots and the secondary force chart.

Paused scenes stop drawing until a camera interaction, resize, computed result or
playback needs a new frame. Running physics is unchanged; the same deterministic
samples drive animation, telemetry and exports. The final playback frame always
flushes telemetry before idling. Plot event captions use two rows without overlap;
every event line remains, with its full title and the separate event buttons.
Numeric plot outputs do not repeatedly announce every playback update to screen readers.

All 98 regression tests pass, including new crowded-caption and camera-reset checks.
Build/syntax, desktop/mobile and standalone review evidence is recorded in
`../MILESTONES.md`. Physical iOS Safari, screen-reader/device testing, subjective
sound mix and final user visual approval remain outstanding. Nothing is published
by this integration pass.


## Parameter workspace and M9 review

**Parameters** is hidden by default. A large labeled button beside Launch/Replay
and a top-bar button toggle a nonmodal side panel on desktop. On phones it opens
below the scene and scrolls into view. Close with **×**, the top-bar toggle or Escape;
focus returns to the opener. Opening pauses playback; Replay closes the panel and
returns to the vehicle. Presets keep the open panel and restore focus. The experiment
button and timeline now sit immediately below the scene, before telemetry.
The workspace explains where to start, offers complete example setups, and places a
short explanation next to every input. Sliders and editable numeric values stay in
sync; arrow keys adjust sliders in their displayed increments. Numeric fields retain
normal left/right caret navigation and support up/down adjustment.

| Experiment | Start here | Then explore |
|---|---|---|
| Launch | Tire grip | Fan command and starting gauge pressure; timing, power and tank controls are under More variables. |
| Invert | Starting/final angles and rotation duration | Fan command and tire grip; rotation changes contact loads and seal loss removes suction. |
| Hop | Ascent pulse duration | Starting pressure and landing-burn mode. Manual scheduling appears in manual mode; target/lead appear under More variables only in automatic mode. |
| Turn | Commanded speed | Fan command and front-wheel steering. Tire grip, leakage and independent road geometry are under More variables. |

Each experiment remembers its own settings and preset within the current session.
Switching tabs restores those values. Sharing captures the active experiment, not
the other stored setups. Loading a preset replaces that experiment's complete setup;
changing a value marks it custom. Hop/Invert/Turn edits do not refill a repeated
Launch tank. Launch fill changes and its explicit refill action still set a new fill.

Changing a value pauses playback and recalculates at the same simulation time (clamped
if the new run is shorter). This lets you compare the same moment. **Replay with these
values** resets to zero, brings the vehicle into view, and plays the new run. The result
panel uses the full solver outcome before playback. It shows the previous calculation
and differences, identifies multiple rapid edits together, and clears while pending or
invalid. A rounded small change is distinct from an unchanged result. Turn departure
and successful-exit times are different events and are not subtracted from each other.

M9's available local checks cover desktop/narrow layouts, keyboard operation, input
validation, parameter effects, settings retention, sharing, standalone and finite
exports. Sampled tuning text contrast is at least 7.39:1 against the panel background.
All 102 regression tests pass. This is not a complete accessibility or physical-device
certification. Physical iOS Safari, hardware touch/pinch, actual screen-reader use,
subjective sound and final aesthetic approval remain open in `docs/M9-REVIEW.md`.
No publication is included in this pass.


### Physics repair verification note

The earlier real-air/table and fixed-pitch review records describe historical
versions. The current direct-PR, thermal and Invert-contact revision is documented
in `docs/PHYSICS-REPAIR.md`. Its validity limits and illustrative defaults supersede
the older numerical examples. No publication is included.


### Vehicle and camera visual pass — 20 October 2026

Paint, glass and machined wheels now respond to a procedural studio environment,
with cool fill light, long reflection strips and restrained warm highlights.
Asphalt and grass have subtle variation. Ground shadows follow each car's heading;
Hop pad and Turn asphalt receive them too. Turn edge accents are flat painted marks,
with no barrier or collision response. Hop has clearer pad corner markings.
Cold-gas plumes now use narrow white cores and expanding, turbulent translucent
clouds, inspired by the supplied visual references. Their presence and intensity
follow delivered thrust and mass flow. Hop adds a low spreading cloud when the
illustrative jet envelope reaches the pad; its tracking camera includes more space
beneath the car. These are deterministic presentation effects, not predictions of
condensation, jet dimensions, fluid velocity or ground interaction. Cutoff clears
the effect immediately. See [PLUME-REVIEW.md](docs/PLUME-REVIEW.md).

Launch **Focus car** isolates the selected car; **Track overview** and **Side view**
retain the comparison. Lower camera angles and 800 ms smooth transitions use the
shortest orbit. These changes do not alter solver trajectories or damage thresholds.
Lighting, shadows and exhaust remain visual approximations, not ray tracing or CFD.

Verification: dependency-free build and JavaScript syntax pass; 120/120 regression
tests pass. Local desktop (1280 × 900) and phone-size (390 × 844) browser checks cover
framing, playback/scrubbing, camera changes, cutaway and all four experiment renders,
with no WebGL errors or phone horizontal overflow. Physical phone testing remains
open. Images: `docs/visual-launch-focus.png` and `docs/visual-mobile.png`.


### Guided showcase

The Turn chapter uses a 120° corner. Its camera starts close to both cars and
smoothly pulls back as the corner develops, keeping the no-fan runoff visible.
The normal Turn experiment retains its editable sweep and has a closer Corner
overview. Camera reveal is presentation state and never changes the trajectories.

Choose **Showcase** in the top bar for a 36-second tour: Launch → Hop → Invert →
Turn. All four example setups are calculated before the tour starts. Chapters have
an opening hold, solver-driven playback and a final hold; camera changes and
captions explain the comparison. Numbers come from the same calculated results as
the parameter workspace. Tour time is presentation time; **T+** is simulation time.

- **Pause tour / Play tour** controls playback. The timeline scrubs the whole tour
  and pauses; chapter buttons jump directly to each experiment.
- **Replay tour** restarts after the last chapter. **Exit tour** or **Escape**
  returns to your saved experiment, paused at its original simulation time.
- Your parameters, camera selection/orbit, comparison visibility, cutaway state
  and repeated-launch tank inventory are restored. The tour uses independent
  example fills and does not consume your current tank or rewrite your shared URL.
- Switching away from the page pauses the tour. Reduced-motion preferences start
  it paused and remove camera transitions. The tour is silent and does not record
  or upload a video; use your screen recorder to capture it.

The scene and captions adapt to desktop and portrait phone layouts. A dependency-free
standalone build includes the same tour. This is an illustrative portfolio
presentation, with the same model assumptions and limitations as the interactive lab.


### Parameter and cutaway interaction fixes

Parameter sliders snap to their displayed keyboard increments (for example tire
friction 0.05, fan command 1%, pulse duration 0.05 s and pressure 1 barg). Editable
numeric fields still accept precise values. Recalculation retains the result grid
and replaces values with `--`; its heading, comparison notes and replay controls
keep their space, so the panel does not collapse while the worker runs.

The pressure-vessel callout is projected from the same body transform as the
cutaway cylinders. It follows Launch separation, Hop altitude, Invert rotation,
Turn heading, camera orbit and zoom, and hides if its anchor leaves the frame.

The current sample-based audio system supersedes the historical synthesized
wreck/jet implementation. Supported WRECKED Hop/Invert ground contact plays a
minor/major recording according to a documented perceptual speed split. Intact
landings, Turn runoff, unresolved limits and scrubbing never trigger collisions.
All lifecycle behavior, full mode allocations and asset provenance are documented
in [AUDIO.md](docs/AUDIO.md). The pearl/lagoon/crimson vehicle and graphite/teal UI
palette remain unchanged.
