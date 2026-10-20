# IMPULSE physics and assumptions review

**Historical audit:** the EOS validity, departure spin/deck recontact and vessel
heat changes are now described in [PHYSICS-REPAIR.md](PHYSICS-REPAIR.md).
The findings below record the pre-repair implementation; full planar contact
response and reference-EOS benchmarking remain open.

Reviewed 2026-10-19 against the current local source. This is a code/model audit,
primary-reference check and set of numerical probes. It is not experimental
validation of a vehicle, fan, nozzle, pressure vessel or crash outcome. No solver
behavior was changed during this review. Existing uncommitted work is preserved.

## Assessment

The mass/energy bookkeeping and deterministic playback architecture provide a
useful foundation. The largest uncertainty in ordinary demonstrations is the
assumed hardware/tire behavior and omitted vehicle degrees of freedom. Two
specific validity/contact failures should be repaired before publication.

All 106 existing regression tests pass (35.76 s). That establishes the current
covered invariants, not the accuracy of the assumed hardware or completeness of
the model. The probes below identify cases those tests do not cover.

## Priority findings

| Priority | Finding | Consequence | Recommended next change |
|---|---|---|---|
| P0 | Air validity accepts mechanically unstable cold states and can silently use ideal-gas fallbacks. | A finite result can be physically unsupported; pressure/density inversion can change branches. | Add explicit cell quality/phase validity, reject unsupported states, remove silent fallbacks, and benchmark against a reference air EOS. |
| P0 | Detached Invert body/deck proxies overlap in the default fan-off case. | The post-detachment trajectory passes through an interaction that the solver ignores. | Detect secondary contact and stop/flag that trajectory until a contact model supports it. |
| P1 | Invert drops inherited angular velocity and ignores torque/contact distribution. | Free flight orientation, tipping and contact timing cannot be predicted physically. | Add planar rigid-body pitch and axle/contact moment balance; preserve departure spin. |
| P1 | Fan pressure/flow/power and seal behavior are assumed, with almost constant geometry. | Large fan benefits in Launch, Turn and Invert are conditional on an unvalidated component. | Use traceable fan maps, gap-dependent leakage and plenum/spool dynamics; expose assumed ranges. |
| P1 | Tire capacity uses a constant coefficient times normal load. | Suction benefits scale too simply with added load; no slip dynamics or axle-specific combined saturation. | Add load-sensitive longitudinal/lateral tire curves and separate axle normal loads. |
| P1 | Turn caps geometric curvature instead of solving lateral and yaw dynamics. | It demonstrates a wider path, but does not predict actual drifting, understeer/oversteer or stability. | Use a dynamic single-track model with lateral velocity, yaw rate and saturated front/rear tire forces. |
| P2 | Hop assumes perfect balance, fixed level attitude and immediate mean valve duty. | Landing authority and precision are optimistic for hardware with misalignment, delay or thrust mismatch. | Add actuator delay/rate limits and sensitivity cases, then planar attitude dynamics. |
| P2 | Tank/wall/plumbing mass, packaging and heat transfer are omitted as separate configurable models. | Increasing pressure or volume lacks the corresponding hardware penalty; inter-burn pressure recovery is absent. | Add component mass/CG accounting and a lumped gas/wall thermal model. |
| P2 | Cosmetic speed threshold is the entire damage model. | “Intact” and “wrecked” are classifications, not structural predictions. | Keep speed/energy central; add explicitly assumed suspension/contact energy capacity if damage prediction is desired. |
| P2 | Launch valve event integration is less rigorous than Hop's held-command event handling. | Small step-dependent impulse and endpoint/export errors remain at valve changes. | Hold each valve state over its integration step and retain both event limits, as in Hop. |

P0 indicates a correctness/validity repair. P1/P2 indicate model development, not
an assertion that every current simplified result is numerically wrong.

## 1. Air table and nozzle

Source: `src/air-table.js`, `scripts/bake-air-table.mjs`, `nozzleFlow`,
`tankThermo`, `gasValidity` in `src/physics.ts`.

The tank integrates mass and specific internal energy with stagnation enthalpy
leaving the control volume. The nozzle accounts for choking/unchoking and pressure
thrust. This is a reasonable governing structure for a short adiabatic discharge.
The pressure contribution to thrust must remain; the nozzle is a converging-nozzle
surrogate, not an arbitrary optimized expansion nozzle. NASA describes the same
momentum-plus-pressure thrust structure [1].

However, the baker replaces some invalid Peng–Robinson nodes with ideal-gas values.
The runtime's `insideTable` checks only rectangular T/rho bounds; `propsAtTR`
checks finite values and positive pressure. Neither guarantees a stable gas phase.
`soundSpeed` substitutes sqrt(1.4*p/rho) when its real-fluid derivative calculation
fails, returning an apparently supported answer. The low-temperature polynomial
is also used below its annotated 200 K lower fit bound and needs validation there.

Reproduced cold-state failure:

| Probe | Result |
|---|---|
| Input | T = 120 K, rho = 200 kg/m³ |
| `propsAtTR` | p = 2.48944 MPa, `ok: true` |
| Centered pressure derivative at fixed T, delta rho = 0.01 kg/m³ | (dp/drho)_T = -1760.75 Pa/(kg/m³) |
| `rhoFromPT` of that same p and T | 338.96 kg/m³, `ok: true`, rather than recovering 200 kg/m³ |
| `soundSpeed` | 132.01 m/s, `ok: true` through fallback |
| `gasValidity` for mass = rho*0.6 m³, u from that state | `ok: true` |

Negative isothermal compressibility is not a supported stable single-phase state.
A positive pressure and a finite number are insufficient. A positive pressure
slope is necessary but is not a complete phase-stability test [2, 3]. This cold
probe is not the default launch tank trajectory; it demonstrates that the
advertised table rectangle is larger than the reliably supported physical domain.
No claim is made here that all normal runs enter this state.

Even along the default launch path, independent interpolation of p, u and h does
not preserve h = u + p/rho exactly. At the initial fill, the residual
(h-u-p/rho)/(p/rho) is about -0.518%. Interpolated pressure is about 0.835% above
the baker's own direct PR evaluation at the same T and rho. Selected later tank
states show roughly 0.46–0.66% identity residual and 0.59–0.93% pressure interpolation
difference. These percentages measure internal consistency/interpolation, not
error against experimental air. The current first-law integration tests can pass
while interpolated thermodynamic identities remain imperfect.

Recommended sequence:

1. Preserve a validity/quality mask when baking. Reject unstable, substituted or
   phase-ambiguous cells rather than interpolating across them. Remove silent
   ideal-gas substitutions from successful real-air answers.
2. Make density/temperature inversions respect the chosen stable branch and verify
   round trips, positivity and derivative consistency over the supported domain.
3. Benchmark p, rho, h/u differences, cp, entropy paths and sound speed against a
   published/reference dry-air EOS. NIST's air formulation includes equilibrium
   phase information and a defined uncertainty range [4, 5]. Reference accuracy
   cannot be transferred to the present PR approximation without comparison.
4. Bake a denser/adaptive, thermodynamically consistent table offline. Keep the
   browser dependency-free. Deriving properties from one thermodynamic potential
   is preferable to independently interpolating every property.
5. Add effective valve/line pressure losses and calibrated flow/thrust coefficients.
   The current Cd = 0.9 is assumed. Separate flow loss, thrust loss, throat area and
   exit area explicitly; do not blindly multiply away pressure thrust. NASA's
   component modeling reference distinguishes nonideal flow and thrust treatment [6].

## 2. Invert: translation is better developed than free-body rotation/contact

Source: `invertRotation`, `simulateInvert`, `simulateInvertFixed`, `INVERT_RIG`.

The rotating-frame COM equations include angular acceleration, centripetal and
Coriolis terms. Smooth quintic motion avoids commanded endpoint velocity and
acceleration jumps. Translation inherits deck motion at departure. Those features
should be retained.

The car is nevertheless a constrained-pitch COM surrogate. While supported, its
pitch is imposed without solving the moment needed to rotate a finite body or
checking front/rear reaction feasibility. After departure, pitch is frozen,
removing the inherited spin. A free rigid body under uniform gravity needs angular
momentum evolution as well as COM translation [7]. Partial-overhang support, abrupt
seal loss and omitted secondary deck collisions are additional limitations.

Quantitative default fan-off example:

- Detaches at 1.72596 s, body angle 67.17°.
- Deck angular velocity at departure: 1.41785 rad/s, about 81.24°/s.
- Over the current remaining 0.66333 s to ground impact, retaining that spin would
  produce about 53.9° of additional rotation, before any intervening collision.
  This is an illustration of omitted motion, not a corrected impact prediction.
- An independent oriented-rectangle separating-axis check uses the same 4.7 × 1.3 m
  body proxy and the rendered 8 × 0.24 m deck. At T+2.10 s every separating axis
  overlaps; the maximum signed separation is -0.767 m. The solver labels the car
  detached with zero contact forces through this proxy overlap. Proxy overlap does
  not establish exact mesh contact or structural response, but does establish that
  the simplified free-flight path is not a supported noncontact trajectory.

First repair: detect this secondary contact and explicitly stop/flag it. The next
physical upgrade should be a planar rigid body with x/y/pitch and their velocities,
front/rear unilateral contacts, bounded friction, suction center of pressure and
moments. Preserve angular velocity at release. Add contact response after its
first event; no full 3D suspension or structural crash solver is required initially.
The platform can retain its prescribed start/final-angle motion. Its motor remains
an external actuator, with torque/work reported separately from the vehicle battery.

## 3. Shared fan, seal and tire assumptions

Source: `fanModel`, `forces`, `invertFan`, `turnLoads`.

Default assumed fan behavior is 6.798 kPa underbody pressure difference over 4 m²:
27.19 kN suction, 2.671 m³/s flow and 25.93 kW fan draw at 70% efficiency. Suction
is 1.35 times the entire default car-plus-gas weight. This is why fan/tire data
matter more than small aerodynamic refinements in the current demonstrations.
These are model outputs from assumed curves, not measurements.

Fan/system-curve intersection and a pressure-flow-efficiency power relationship
are sensible starting points [8]. The missing evidence is the component map and
installation: duct losses, gap/perimeter leakage, road roughness, body heave/pitch,
fan response, efficiency map and seal leakage during partial overhang or grass.
Even nominal “zero leakage” retains the model's baseline 0.015 m² effective leak
area. Current leakage is a user percentage mapped to an assumed opening, not a
measured physical seal state. Separate user command from actual fan speed and
plenum pressure.

Tire limits are largely constant-mu Coulomb caps. There is no wheel rotational
state or tire slip-force curve in Launch, and no separate front/rear combined-slip
yaw balance in Turn. Added suction therefore buys capacity in direct proportion
to load. Real load-dependent tire parameterizations account for changing peak
friction and stiffness [9]; an uncalibrated complex tire formula alone would not
create accurate vehicle data.

A simple saturating slip-force law with a few exposed load-sensitive parameters,
axle loads and wheel inertia is a useful next step. Add tire measurements or
clearly assumed envelopes before using those results as performance predictions.

## 4. Turn: wider path, not a drift simulation

Source: `turnLoads`, `simulateTurn`, `turnLaneGap`.

The current model requests kinematic bicycle curvature and clips it to
F_lateral,max/(m*v²). It then computes a constant-curvature circle at fixed speed,
including after lane departure. It does not integrate lateral velocity or yaw
rate. In the default no-fan case, the commanded steering is 4° while the reported
effective geometric steering is about 2.69°. This is a transparent steady-state
surrogate for a wider turn, not a solution for a vehicle actually maintaining 4°
wheel angle while its front/rear tires saturate.

Recommended model: planar dynamic bicycle with longitudinal speed, lateral
velocity and yaw rate; front/rear tire slip angles and saturated force laws;
per-axle combined longitudinal/lateral capacity and load transfer. Established
single-track models resolve lateral and yaw motion using tire slip forces [10].

Keep the user's approved non-solid painted boundaries. On grass, keep momentum
and let the car run wide; change the surface grip, rolling drag and seal leakage
rather than creating a collision wall. The current grass is visual only and
retains the same tire/fan loads. Do not add artificial damping purely to make a
car finish the corner. Rollover and detailed suspension can remain later work.

## 5. Hop, landing control and impact classification

Source: `simulateHop`, `hopNozzles`, `planHopLanding`, `hopBurnProfile`,
`touchdownOutcome`.

Vertical translation and tank accounting are a useful ideal balanced-flight
experiment. Four nozzles share the same total area/inventory, and both automatic
and manual braking use the remaining gas. Event limits and finite ground contact
are stronger here than in Launch. Omitting drag is usually secondary for a short
low-speed hop; revisit it for the larger exploration cases.

Four perfectly balanced nozzles and fixed level attitude hide the difficult
stability problem. The controller has exact state and model knowledge, no sensor
latency, immediate mean duty-cycle force, no valve opening/rate limits and no
individual nozzle mismatch. The 0.025 s feedback response parameter is not a
verified hardware response or a 40 Hz controller update rate.

The manual 0.35 s ascent example gives these deterministic outcomes:

| Scheduled ignition | Touchdown speed | Existing illustrative classification |
|---|---|---|
| 2.19 s | 1.633 m/s | INTACT |
| 2.21 s | 1.377 m/s | INTACT |
| 2.23 s | 2.226 m/s | INTACT |

Those are timing sensitivity cases, not measured actuator uncertainty. They show
why hundredth-second nominal timing should not imply equivalent hardware precision.
Add valve delay/rate limits, thrust-scale/misalignment sensitivity and uncertain
state estimates. Then add planar pitch and nozzle torques. A full 6DOF attitude
controller is unnecessary for the first useful improvement.

The pre-run banner predicts the exact simplified simulation outcome. It is not a
confidence interval for a real landing. The current 5 m/s wreck threshold ignores
impact orientation, suspension travel, local contact velocity, mass/structure and
energy absorption. Prefer touchdown speed, energy and an explicitly illustrative
risk category. A spring/damper/energy-capacity contact surrogate can support an
educational severity estimate; it still would not establish a vehicle rating.

## 6. Vehicle hardware, thermal state and Launch

The default 400 barg / 600 L fill contains 250.53 kg of air; total modeled moving
mass is 2050.53 kg. The dry-mass input can stand for an assumed fixed hardware
package, but vessel/liner/plumbing/fan mass does not scale separately with pressure
or volume. Changing storage therefore pays for additional gas without a calculated
pressure-vessel mass/packaging penalty. Add explicit component masses, position/CG
and a volume envelope. Avoid presenting that estimate as a pressure-vessel design
or qualification.

Short adiabatic discharge is a defensible first approximation. Repeated launch
mass is preserved and no refill is invented. A gas/wall energy model with tunable
heat-transfer conductance and finite wall heat capacity would improve pressure
recovery between burns and during a longer coast. Validate the thermal time scale
rather than silently fitting it to a preferred launch time.

Launch also assumes instant maximum wheel force (42 kN cap), perfect traction
utilization, fixed geometry/coefficient products and no drivetrain efficiency loss,
wheel spin inertia, motor speed map or suspension transient. The common electrical
cap is used approximately as a wheel-mechanical budget after fan draw. Clarify
that ideal conversion assumption; a motor/inverter/gear efficiency map and wheel
rotation states would improve power and energy interpretation.

Freshly calculated default 0–60 mph times are 3.217 / 1.426 / 0.727 s for electric /
fan / thrust assistance, with initial thrust about 50.20 kN. These are internally
calculated outcomes of the assumptions, not Tesla claims. A constant-mu sensitivity
check changes the electric-only time from 4.241 s at mu=1.04 to 2.541 s at mu=1.56.
Those coefficient choices are illustrative perturbations, not a measured confidence
range. Adding assumed 100 / 200 kg hardware mass changes the default thrust-assisted
time to 0.760 / 0.793 s; those masses are not vessel mass estimates.

Numerical maintenance: Launch aligns valve-event step boundaries, but its RK stages
query a time-dependent open/closed command at endpoints. Hop instead holds the
command through each step and stores both event limits. Adopt the latter behavior
for Launch and strengthen impulse/export/event-convergence checks. This is a small
numerical correction, not the cause of the large unknown hardware sensitivity.

## Proposed engineering sequence

1. **Correctness repairs:** air stability/phase mask and no hidden fallbacks;
   inversion/identity/reference tests; Invert secondary-contact detection; explicit
   unsupported status. Preserve current playback/CSV/worker regression gates.
2. **Planar Invert:** angular momentum, feasible contact moments/axle loads,
   contact/seal transitions and then supported secondary-contact response.
3. **Shared fan/tire foundation:** fan maps and gap/plenum response, axle loads,
   load-sensitive slip forces and component mass assumptions with sensitivity views.
4. **Dynamic Turn:** lateral/yaw states and the shared tire model, followed by
   surface-dependent free grass runoff. No solid lane barriers.
5. **Landing realism:** valve dynamics and uncertainty envelopes; pitch/nozzle
   imbalance; suspension/contact severity; optional wall heat transfer.

Validation should include independent reference values and sensitivity ranges,
not only snapshots generated by the same solver. For every new degree of freedom,
add force/moment/energy checks and timestep refinement. Preserve the polished UI
and deterministic playback while clearly distinguishing assumptions, calculated
outputs, unsupported states and validated component data.

## Primary references

[1] NASA Glenn, Rocket Thrust Equations:
https://www.grc.nasa.gov/www/k-12/airplane/rktthsum.html

[2] CoolProp source, mechanical stability checks in flash routines:
https://coolprop.org/_static/doxygen/html/_flash_routines_8cpp_source.html

[3] CoolProp mixture stability and phase-split documentation:
https://coolprop.org/fluid_properties/Mixtures.html

[4] Lemmon et al., NIST dry-air reference equation of state (2000):
https://www.nist.gov/publications/thermodynamic-properties-air-and-mixtures-nitrogen-argon-and-oxygen-60-2000-k-pressures

[5] NIST REFPROP reference formulation and property capabilities:
https://www.nist.gov/srd/refprop

[6] NASA/TM—2016-219147, nozzle component modeling:
https://ntrs.nasa.gov/api/citations/20160012485/downloads/20160012485.pdf

[7] MIT OpenCourseWare, Angular Momentum and Motion of Rotating Rigid Bodies:
https://ocw.mit.edu/courses/2-003sc-engineering-dynamics-fall-2011/pages/angular-momentum-and-motion-of-rotating-rigid-bodies/

[8] AMCA, fan/system curves, affinity laws and fan power:
https://learning.amca.org/ecommerce/pages/amca-online-technical-seminar-fan-and-blower-applications-engineering-i

[9] MathWorks, load-dependent tire/road force parameterization:
https://www.mathworks.com/help/sdl/ref/tireroadinteractionmagicformula.html

[10] MathWorks, dynamic bicycle model:
https://www.mathworks.com/help/vdynblks/ref/bicyclemodel.html
