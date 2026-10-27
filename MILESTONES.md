# IMPULSE development milestones

Status: M1/M2 technically reverified after the real-air audit repairs (2026-10-19). M3 is implemented locally and ready for visual review; see MILESTONE-3-PLAN.md. M4 is implemented locally with synchronized vessel state and sound controls. M5 and Hop extensions M5a-M5c are implemented locally after the user approved continuation (2026-10-19); verification is recorded below. M6 is implemented locally with a rotating-platform user revision; the original fixed-angle completion below is superseded by that revision. M7 Turn is implemented locally with a steady-state grip-capped bicycle comparison and continuous grass runoff; see its completion record and revision below. M8 integration is implemented locally. M9 adds the inline parameter workspace and local final-review checks; physical-device and user review remain. Visual approval remains with the user. No publication until user approval.
Each milestone must pass engineering checks, interaction checks and visual review.

| Milestone | Deliverables | Acceptance |
|---|---|---|
| M1 Foundations | 1x; 600 L; (later revised to 400 barg with real-gas table); absolute solver units; legacy share links; scenario colors | Conversion, inventory, corner cases and convergence pass; browser controls reflect defaults |
| M2 Interface and identity | Unobstructed scene; telemetry strip; tuning drawer; analysis area; improved materials, lighting and shadows | Desktop/mobile readable; user reviews visual direction |
| M3 Launch comparison | Three simultaneous cars; position, velocity, acceleration plots; hover, scrub, toggles; road markers | Plots and animation agree; consistent assumptions and meaningful separation |
| M4 Blowdown and sound | Tank cutaway; pressure, temperature, mass, flow, thrust; valve markers; refined audio and volume | Depletion explains thrust; repeat/refill and audio lifecycle work |
| M5 Hop | Height/velocity-driven animation; altitude ruler; trajectory/apex; tracking camera | No altitude clamp; parameter changes change trajectory; touchdown and no-lift cases work |
| M5a Four-corner Hop propulsion | Four visible underbody nozzles, one near each corner; balanced downward cold-gas plumes; parameter-driven intensity; inspection camera | Same total nozzle area and gas consumption; no jets with zero flow; four mounts/plumes verified across cameras and screen sizes |
| M5b Hop touchdown damage | Configurable illustrative wreck-speed threshold; interpolated touchdown classification; cosmetic crash/wreck sequence; replay/reset | Wreck iff pre-impact speed exceeds threshold; no-lift and solver-stop runs cannot invent impacts; deterministic scrubbing |
| M5c Optional Hop landing burn | On/off switch; descent-only braking using the remaining tank state; usable-pressure/thrust checks; same wreck criterion as M5b | No refill at ignition; mass/energy conserved; sufficient gas can soften landing; depleted/weak/late burns can still crash |
| M6 Invert | Attachment, sliding, detachment, gravity-driven fall, impact and wreck | Failure follows contact/friction; finite platform; seal loss removes suction; destruction explicitly cosmetic |
| M7 Turn | Constant commanded speed and steering angle; fan/leak inputs; limited-grip bicycle model; no-fan/fan comparison; grass runoff | Lane-departure events with continuous runoff; both-success/both-failure cases; overhead oblique camera and grip/trajectory plots |
| M8 Integration | Unified controls and cameras; responsive polish; performance; documentation | Numerical and browser checks; consistent units; user approves final experience |
| M9 Experience review | Guided inline parameters; same-time comparisons; desktop/mobile/keyboard and available final checks | Local checks pass; physical iOS, touch, screen-reader, sound and user aesthetic review remain open |

## Decisions
- Turn angle means front-wheel steering angle. Track corner sweep is separate.
- Scenario colors: electric pearl/slate, fan cyan, thrust orange-red; keep names and line styles too.
- Hop may use disclosed constant display scaling per run; never clamp motion.
- Hop/Invert wreck effects are cosmetic, not structural impact simulations.
- Hop extension order: finish/verify M5, then M5a (four-corner propulsion), M5b (touchdown damage), M5c (optional landing burn), then M6/M7/M8.
- The user approved continuation after the planning additions; M5-M5c are now implemented locally. Final visual approval remains open.
- Four Hop nozzles split the existing total effective area; adding emitters must not multiply thrust or stored gas.
- Landing burn consumes the same tank state used by the ascent pulse. Remaining mass alone does not guarantee usable pressure or sufficient braking thrust.
- Constant Turn speed is an idealized controller, maintained through visual grass runoff.
- Live solver uses tabulated real dry air; ideal-gas formulas are no longer the live path.
- First complete showcase is M3 + M4; do not expand scope to publishing yet. M3 proceeds from the corrected and reverified real-gas foundation.


## M2 verification
- Telemetry moved outside the WebGL viewport; tabs moved above the scene.
- Graphite layout, larger type and analysis cards, responsive telemetry grid.
- Paint roughness/specular response adjusted; softbox reflection and cool edge lighting added.
- Force plot scale now follows the run maximum, avoiding clipping at high pressure.
- Build and JavaScript syntax checks pass.
- Desktop and 390px browser checks: tuning drawer, scenario selection, playback,
  timeline scrubbing, Launch/Invert/Hop switching and capture mode; no console errors observed.
- Awaiting user feedback on visual direction. Three-way kinematic plots remain M3;
  this milestone enlarges the existing plots, it does not implement their planned interactions.


## Reverification of M1 and M2 — 2026-10-19

| Gate | Status / evidence |
|---|---|
| Current defaults | Browser: 400 barg, 600 L, 1x; pressure solver is absolute. Original 650-barg default was revised in the later real-gas commits. 650 barg remains supported and tested. |
| Pressure conventions | Gauge/absolute and legacy absolute-link regression tests pass. |
| Inventory and repeat | Mass and energy preserved between runs; browser verifies second-run state survives sharing/reload; refill restores initial state. |
| Table and energy | cp derivative, stagnation-enthalpy conservation, finite samples, timestep and range checks pass. |
| Scenario colors | Electric pearl/slate, fan cyan, thrust orange-red remain mapped to cars and comparison bars. |
| Scene and layout | Renderer repaired; desktop 1280x900 and narrow 390x844 inspected; telemetry outside viewport; no horizontal overflow on narrow layout. |
| Interactions | Tune/scenario switching, timeline, repeat/refill, Hop coast, Invert Forces, Capture, Sound opt-in and CSV download checked in browser. |
| Standalone | Bundle scope regression test and browser startup at /impulse.html pass. |
| Regression coverage | All test files included by npm test / CI; no NaN-accepting finite-value checks. Renderer uniform initialization has a CI test. |
| Remaining limitations | Physical iOS Safari and final aesthetic approval remain outstanding; existing ghost comparison and sparse plots are M3 work. |

M1/M2 now provide a technically checked foundation. This is not a validation against
Tesla hardware or a declaration that visual development is finished.

## Remaining sequence

1. M3: responsive computation, three real-scale launch lanes, cameras, synchronized x/v/a plots and inspection.
2. M4: connected tank cutaway, thermodynamic plots and sound refinement.
3. M5: Hop camera, altitude reference and signed-velocity/height analysis.
4. M5a-M5c: four-corner thrusters, Hop touchdown damage and an optional landing burn (implemented locally; see below).
5. M6: Invert sliding, falling and cosmetic impact destruction.
6. M7: turn/no-fan versus fan comparison, loss of grip and continuous off-lane runoff.
7. M8: integrated visual polish, accessibility, responsive/performance review and engineering documentation.


## M3 completion — 2026-10-19

Three-car Launch, worker computation, lane cameras, kinematic plots, inspection/scrubbing,
scenario focus/visibility, presets, metadata CSV and reproducible links are implemented.
Numerical and worker parity, stale-request behavior, exact scene separation and stopped
runs have regression coverage. Normal/standalone and desktop/mobile checks are recorded
in MILESTONE-3-PLAN.md. The overview deliberately shows smaller vehicles as physical
separation grows; select Focus car for detail. Final user visual review remains open.

Next implementation milestone: M5, trajectory-driven Hop presentation.


## M4 completion - 2026-10-19

- Dedicated connected vessel console: absolute pressure plus gauge readout, gas
  temperature in K / Celsius, remaining mass in kg and reference-fill percentage.
- Three state plots (P / T / mass), plus a flow / gas-thrust delivery view. Shared
  playback, linked hover inspection, pointer/keyboard scrubbing and observed-flow
  markers; unsupported solver stops are marked explicitly.
- Temperature-coded schematic and car cutaway; fixed-volume gas inventory is shown
  by particle opacity, never by a liquid fill level. Inspect car cutaway selects the
  focused car camera. Car overlay includes pressure, temperature and mass.
- Opt-in audio retains speed-driven motor pitch; gas noise follows flow and thrust.
  Tune provides a 0-100% master volume. Gain smoothing and compression limit abrupt
  changes. Pause/background/mute lifecycle has regression coverage.
- Full regression suite: 52 passing tests. Build and source/browser syntax checks
  pass. Desktop 1280x900, narrow 390x844, normal and standalone browser checks pass;
  readouts match plot samples at 1 s, repeat retains the depleted tank, electric-only
  focus has no discharge, and Hop plots end at touchdown (3.86 s by default).
- Physical iOS Safari, subjective sound quality and final aesthetic approval remain
  for real-device/user review. No publication performed.

Next: M5, Hop altitude/signed velocity presentation, trajectory/apex references,
tracking camera, no-lift/touchdown scenarios and parameter-driven motion review.

M4 preview: [Connected vessel console and state plots](impulse/docs/m4-vessel-preview.png).


## Hop extensions - specification approved for implementation on 2026-10-19

The user requested these extensions while M5 was underway, then approved continuation.
The specification below retains the M6-M8 numbering. M5-M5c are now implemented
locally; the completion and verification record follows this specification.

### M5a - Four-corner propulsion presentation

- Place a recognizable nozzle assembly near each corner of the underbody, with
  downward exhaust. Keep locations symmetric about the assumed centre of mass;
  fixed level attitude remains a disclosed simplification, not a flight controller.
- Define total effective Hop nozzle area once. The current solver uses two equivalent
  banks: A_total = 2 * A_bank. Four identical nozzles each receive A_total / 4;
  per-nozzle flow/thrust sums must recover the same modeled total. Preserve existing
  presets and label bank versus total area explicitly.
- Use four independent plume origins, with plume length/opacity driven by modeled
  per-nozzle flow and thrust. Use restrained translucent cold-gas effects. No flame
  is implied by compressed-air discharge. Plumes vanish at zero flow and after the
  simulation stops; no invented residual thrust.
- Verify visibility in Flight envelope, Track vehicle and cutaway/inspection views.
  Add an underbody inspection angle if needed to make the four mounts legible without
  drawing hidden hardware through opaque bodywork. Respect reduced-motion settings.
- Acceptance: four physically separated mounts and plumes, balanced net thrust,
  unchanged total force/inventory for unchanged inputs, and desktop/mobile review.
- Estimated effort: 0.5-1 focused development day, including visual review.

### M5b - Touchdown outcome and cosmetic wreck

- Add an adjustable wreck-speed threshold in advanced Hop controls. Proposed starting
  assumption: 5 m/s (18 km/h), explicitly an illustrative scenario rule, not a Tesla
  structural limit. Use the magnitude of interpolated pre-impact vertical velocity:
  wreck iff abs(v_touchdown_minus) > v_wreck. Equality does not trigger a wreck.
- Show touchdown speed, threshold and outcome together. Optional impact kinetic
  energy, 0.5 * (dry mass + remaining gas mass) * v_touchdown_minus^2, is an engineering
  indicator rather than an injury/structural-damage predictor.
- Trigger a short ground-contact dust/spark/debris sequence and a persistent damaged
  car state for failed landings. Avoid an unsupported explosion assumption. Landings
  below the threshold retain an intact car; no-lift and out-of-table stops never
  fabricate touchdown events.
- Physics ends at touchdown. Any post-impact visual tail is labeled/display-only,
  with no invented solver trajectory or contamination of numerical CSV. Scrubbing,
  replay, reset and parameter changes reconstruct/clear the cosmetic state reliably.
- Share/export metadata includes the threshold and outcome. Altering the threshold
  changes the classification and visuals, not the pre-impact flight trajectory.
- Acceptance: below/equal/above-threshold cases, no-lift, unsupported states,
  interpolation sensitivity, scrub/replay and mobile checks.
- Estimated effort: 1-2 focused development days, including effects and verification.

### M5c - Optional landing burn from the remaining gas

- Add a Landing burn on/off switch, off by default to retain the ballistic baseline.
  With it enabled, an automatic one-dimensional braking controller can open the same
  four thrusters during descent. Ascent and landing draw from one continuously
  evolving mass/internal-energy tank state; ignition never refills or reheats it.
- Check usable tank pressure against ambient and compute available thrust from the
  current real-gas nozzle model. Positive remaining mass does not imply usable
  propulsion. If maximum thrust is below weight, show insufficient braking authority;
  a burn may reduce impact speed without making a soft landing feasible.
- Use available net braking acceleration a_brake = F_max / m_total - g and a stopping
  distance estimate (v_down^2 - v_target^2) / (2*a_brake), with a small disclosed
  ignition margin, to initiate descent braking. Guard a_brake <= 0 and near-zero
  altitude; do not divide by vanishing acceleration or distance. Recompute as gas
  pressure/mass change. A bounded throttle or pulse command may target an illustrative
  touchdown speed (proposed 1.5 m/s), never exceeding current nozzle capability.
- Boundaries: no ascent braking, no thrust after contact, no negative mass, no thrust
  at exhausted pressure, no restart of an unsupported property state. Align valve
  events with numerical steps and interpolate ground contact. Stop at touchdown;
  do not imply hover, attitude control or guaranteed landing success.
- Keep the M5b wreck criterion active with the burn either on or off. Show powered
  braking, insufficient authority, exhausted pressure and touchdown clearly. Connect
  renewed plumes/audio, flow/thrust, P/T/mass and signed velocity to solver output.
- Acceptance: same initial-condition burn-off/on comparisons; sufficient braking;
  limited gas/pressure; T/W <= 1; late/ineffective braking; no lift; model-limit stops;
  mass/energy conservation; timestep convergence; deterministic replay/share/export.
- Estimated effort: 2-4 focused development days, including controller and numerical QA.

Recommended order: finish M5 verification -> M5a -> M5b -> M5c -> M6 -> M7 -> M8.
The three extensions total approximately 3.5-7 development days; polished crash effects
and user visual revisions may increase that effort. No publishing is included.


## Initial M5 / M5a / M5b / M5c completion - 2026-10-19

Implemented locally and ready for user visual review. No publication performed.

- M5: true metre-scale trajectory, signed velocity/acceleration plots, altitude
  references, interpolated apex, timeline/event buttons, full-envelope and tracking
  cameras, background Hop calculations and explicit no-lift/property/time stops.
- M5a: four separated underbody nozzle mounts and continuous tapered cold-gas
  plumes, with no cap/ring stack. Each receives one quarter of the unchanged total
  area. Flow and thrust drive intensity; zero flow and stopped runs have no plumes.
  Inspect thrusters offers an underside angle and explicitly hides the ground.
- M5b: illustrative 5 m/s default wreck threshold in Advanced assumptions; strict
  greater-than classification. Impact energy uses dry plus remaining gas mass.
  Live playback adds a 1.2 s cosmetic collapse/fragments/dust effect; scrubbing
  reconstructs the settled outcome. Reduced motion shows the settled state directly.
  Physics and CSV end at ground contact, without a structural crash model.
- M5c: landing burn is off by default. A descent controller uses current real-air
  nozzle capacity and the same mass/internal-energy tank after ascent. Target
  1.5 m/s; 15% stopping-distance reserve + 60 ms allowance + 0.1 m pad margin.
  Valve duty is bounded and scales mass flow and force together. Weak thrust,
  exhausted pressure and unsupported properties cannot invent a successful landing.
- Bank area remains compatible with old presets: total = 2 * bank input;
  four individual nozzles each have half a bank's area. This convention is explicit
  in Tune and README. Landing toggle/threshold/camera survive sharing and reload.
- Hop CSV includes signed trajectory and full thermodynamic state, configuration,
  ignition, threshold and outcome. Vessel plots mark renewed landing discharge.
  Compact event captions avoid crowding narrow plots; full event names remain in
  the event buttons. Preset remount clears stale Hop summaries before new results.

Verification:

- Full suite: 65 passing tests. Includes independent tank-outlet enthalpy/mass
  checks, no-refill ignition, exact ascent parity with burn off/on, nozzle sums,
  strict below/equal/above-threshold checks, no-lift/property-stop outcomes and
  timestep refinement. A final focused 8-test pass covers the plume/renderer
  changes, Hop and the regenerated standalone worker.
- Current short-hop example: 0.2 s pulse gives about 7.36 m/s ballistic impact;
  braking gives about 1.56 m/s and an intact threshold outcome. The standard 0.65 s
  hop still wrecks with braking (about 8.68 m/s). These are illustrative outputs.
- Actual served and bundled Blob worker results match the direct solver exactly.
  Build parses the full standalone script and worker; JavaScript syntax checks pass.
- Desktop 1280x900 and narrow 390x844 browser review: cameras, four mounts/plumes,
  phase and altitude/velocity synchronization, keyboard/event scrubbing, touchdown
  wreck, rewind, intact braking, no-lift, preset remounts, shares/reload and vessel
  discharge. No horizontal overflow or nonfinite SVG paths on the narrow layout.
- Standalone /impulse.html starts and performs the descent burn in a Blob worker;
  shader compilation succeeds, and the WebGL diagnostic reports error 0. The
  exported short-hop CSV has 871 rows, finite values and the intact landing outcome.
- Physical iOS Safari, subjective sound mix and final user aesthetic approval remain
  outstanding. Wreck deformation/debris and gas plumes are cosmetic, not structural
  dynamics or CFD. Invert remains prescribed-pose pending M6; Turn remains M7.

Next: M6, Invert sliding, detachment, gravity-driven falling and cosmetic impact.


## Landing-controller revision - 2026-10-19

The initial instantaneous stopping-distance rule was optimistic about declining
thrust. It has been replaced with `blowdown-lookahead-v1`:

- Predict the remaining full-valve real-air blowdown after ascent, including tank
  cooling, mass loss and changing thrust/weight. Search coast/full-burn timings;
  refine a feasible target landing, or use a forecast best-effort burn and state
  the reserve limitation explicitly. The search is one-dimensional and does not
  claim global optimality.
- Full available braking followed by bounded near-target descent-speed feedback;
  no refill at ignition, ascent braking, attitude control or hidden retuning.
- Advanced controls: target 0.25-5 m/s (default 1.5) and ignition lead 0-0.2 s
  (default 0.020). Excessive lead can waste reserve. Target met/missed is distinct
  from the cosmetic wreck rule.
- Future gas-model/pressure limits close the valve explicitly with a 20 ms
  full-valve numerical reserve. Supported ballistic flight continues without
  extrapolating properties; actual out-of-table solver states still stop.
- Preserve left/right valve limits at duplicate timestamps, including pre-contact
  flow followed by closed-valve contact. Right-side playback and conservative
  numerical exports now agree across discontinuities. CSV adds valve duty,
  controller target/lead, forecast feasibility and controller version.
- Balanced landing preset: 0.35 s ascent, approximately 6.73 m apex, 1.50 m/s
  touchdown. The standard 0.65 s ascent remains reserve-limited, with approximately
  8.03 m/s touchdown (previously about 8.68 m/s). These outputs are illustrative.
- 69 full-suite tests pass; new cases include forecast feasibility, stricter
  targets, timing lead, explicit gas-model closure, exact valve limits, no
  rebound/refill and independent conservation. The balanced case's integrated
  mass discrepancy is about 1.1e-6 relative and tank-energy discrepancy 5.4e-8.
  Shared served and standalone worker parity and timestep refinement pass.

Browser verification and remaining review limits are recorded with the local
handoff. No publication is part of this revision; M6 remains next.

Revision browser verification: served and standalone pages reach a tuned 1.75 m/s
landing and retain target/lead in shared links after reload; the limited-reserve
standard hop explicitly reports target missed and suggests a shorter ascent.
Desktop and 390x844 checks show no horizontal overflow or invalid SVG paths;
WebGL reports error 0 and no console errors were observed. The downloaded tuned
CSV has 1,699 finite rows, controller metadata and zero valve duty at contact.
Physical-device and subjective visual/audio review remain outstanding.

## Manual landing burn and pre-run prediction - 2026-10-19

- Hop now offers Off, Automatic and Manual burn modes. Existing numeric 0/1
  links retain their meaning; 2 selects manual. Manual ignition time, duration
  and mean valve command are shared/exported configuration. The pulse waits for
  descent inside its fixed window; once lit it may cause a rebound. Automatic
  target/lead never alter the manual command. Contact and explicit gas-model
  safety limits still close the valve, without refilling the ascent tank.
- Fire manual burn now reschedules the window at the current descent time,
  including paused scrubbing. Recalculation preserves pre-ignition history and
  the playback clock, resumes active playback, and updates the prediction.
- A banner above the vehicle predicts intact/wrecked, touchdown speed and the
  illustrative threshold before playback. It comes from the completed solver,
  states the assumed manual schedule, and clears during pending/invalid inputs.
  No-lift and unsupported runs have explicit outcomes rather than false success.
- Manual timed example: 0.35 s ascent, T+2.21 s ignition, 1 s window, 100% command
  yields about 1.38 m/s, intact. Moving ignition to T+2.50 s yields about 11.10 m/s,
  wrecked. An early burn can rebound; plots/events and scene bounds include all
  peaks and use the highest apex. Results remain illustrative vertical physics.
- All 76 regression tests pass: manual window edges/duty, conservation, no-refill
  history, disabled/missed windows, rebound peaks, prediction outcomes, finite CSV,
  invalid inputs, timestep refinement, and served/standalone worker parity. Build
  and browser-module syntax checks pass.
- Browser review covers pre-play intact/wreck predictions, mode/preset switching,
  manual inputs, paused and playing Fire now, resumed clock, rebound/cutoff events,
  touchdown, shared-link reload, invalid-input clearing, no-lift prediction, and
  390x844 layout without horizontal overflow
  or nonfinite SVG paths. A downloaded manual CSV has 2,309 finite rows, manual
  metadata and closed valve at contact. The standalone HTML predicts 1.38 m/s
  before playback and reaches the matching intact touchdown. WebGL reports 0;
  no console errors observed.

No publication is included. Physical-device review and final visual/audio approval
remain outstanding. M6 remains next.

## M6 completion - 2026-10-19

Implemented locally; ready for user visual review. No publication performed.

- Invert now releases the car from rest at a selected fixed angle. Playback and
  scrubbing advance physical time without changing the release angle. This replaces
  the former pose-feasibility sweep and avoids introducing unmodeled moving-platform
  inertia. The fan is pre-spun; locked tires use a single Coulomb friction coefficient.
- A finite 8 m deck at a 5.5 m pivot supports attachment and sliding. First body
  overhang breaks the seal and switches suction/electrical draw off. Upper-side
  gravity contact may persist without suction. Detachment removes normal reaction
  and tire friction; subsequent translation is ballistic. Ground impact can also
  occur during supported sliding. No seal recovery is assumed.
- Pitch remains constrained throughout. The partial-overhang contact surrogate
  omits tipping moments; it does not establish real edge stability. There is no
  tumbling, aerodynamic flight, secondary deck collision or structural impact model.
  Ground contact uses a disclosed 4.7 by 1.3 m body rectangle. Damage/debris are
  cosmetic; the strict greater-than speed rule is tunable and is not a rating.
- Constant-acceleration analytic segments give exact seal-loss, detachment and
  ground-contact times. The 2 ms interval samples the trajectory; it does not
  determine those events. Holds last 6 s, moving runs stop at first impact or an
  explicit 8 s limit. A time-limited run has no invented impact outcome.
- New release presets, pre-run outcome prediction, whole-rig/tracking cameras,
  contact-driven force vectors, synchronized motion/contact plots, event buttons,
  rewind and deterministic wreck reconstruction. Gas inventory stays unchanged.
  Sharing retains release inputs/camera; CSV includes SI state, forces, electrical
  work, contact, geometry and outcome. Preset remounts now close the Tune drawer
  correctly so it cannot cover playback controls.

Verification:

- All 85 tests pass, including eight focused Invert checks and a renderer transform
  check. Coverage includes static/ballistic limits, exact seal events and both force
  limits, gravity contact after seal loss, mechanical energy/friction, electrical
  budget, unchanged tank state, threshold equality, deterministic damage, finite
  corners/CSV, unresolved windows and sample-spacing invariance. Served and bundled
  Blob workers match the direct solver. Build and browser JavaScript syntax pass.
- Calculated examples: default inverted hold stays attached for 6 s; no-fan
  inverted fall reaches about 9.08 m/s at 0.926 s; 90-degree / 40% fan sliding loses
  its seal at 0.775 s and impacts at 6.90 m/s at 1.044 s. The 60-degree / fan-off /
  grip-0.4 case retains gravity contact after seal loss and impacts at 7.23 m/s.
- Desktop and 390x844 browser checks cover prediction, presets, playback, event
  and keyboard scrubbing, force removal, cutaway, cameras, impact and rewind,
  retained release angle, shared-link reload and adjustable outcome classification.
  No narrow horizontal overflow or nonfinite SVG paths observed. WebGL reports 0;
  no console errors observed. Launch comparison and manual Hop received smoke checks.
- The standalone HTML predicts and reaches the matching 6.90 m/s wreck. Downloaded
  Invert CSV has 557 finite rows, one unchanged gas state, zero suction after seal
  loss and zero clearance at first impact. It retains pre-impact deck reaction
  where the car hits the ground while still supported; no collision impulse is solved.
- Physical iOS Safari, subjective sound review and final user visual approval remain
  outstanding. These tests do not validate Tesla hardware or real crash behavior.

Next: M7, constant-speed steering/grip comparison and trajectory-driven barrier
impacts, followed by M8 integration. Publication still requires user approval.


## M7 initial completion - 2026-10-19 (barriers superseded by runoff revision below)

Implemented locally; ready for user visual review. No publication performed.

- Turn compares two independent runs with identical hardware, stored air, constant
  speed and front-wheel steering: no fan versus fan assisted. Road centreline radius,
  corner sweep and width are separate controls. Steering never changes the road.
- A steady-state bicycle requests curvature. A combined tire-friction circle reserves
  driving force before allocating lateral force. Demand above capacity caps curvature
  and makes the turn wider. This is an understeer surrogate, not a transient slip,
  yaw-stability, suspension, tire-heating or rollover model. Both cars start in the
  assumed steady turn; no entry/steering transient or driver correction is solved.
- Fan and drive load share the electrical budget, including the fan's added rolling
  resistance. Insufficient base power or drive grip reports SPEED HOLD LIMIT without
  an invented valid trajectory. Gas mass, temperature, energy and pressure stay fixed.
  Undefined grip ratios are blank in CSV with a validity flag.
- Renderer and solver share finite inner/outer rail segments. Oriented 4.7 by 2.06 m
  body-envelope contact uses separating-axis tests and conservative advancement,
  independent of output sampling. Exit requires the whole body to clear the gate.
  Each trace ends at its own first contact or exit, with explicit time/numerical limits.
- Barrier contact fails the corner; cosmetic wreck iff incoming speed strictly exceeds
  the configurable threshold. The controller stops at contact; no post-impact structural
  trajectory, collision impulse or rebound is claimed. Comparison cars do not collide
  with each other. Coincident poses show the selected car, without artificial offsets.
- Controls/presets, per-case outcome predictions, selected-car/overhead oblique cameras,
  steered front wheels, force vectors, cutaway, event scrubbing, a pointer/keyboard
  trajectory map, six synchronized grip/motion/work plots, sharing and comparison CSV.
  Close camera is the default for readable mobile vehicles. Map SVG height explicitly
  overrides global icon sizing. Impact/exit readouts retain endpoint labels and values.

Calculated examples (illustrative assumptions, not Tesla validation):

- 100 km/h / 4-degree steering / 40 m road radius: no fan reaches the outer barrier at
  about 1.066 s; fan assisted clears at 2.349 s. Requested/capacity ratios are about
  1.49 and 0.64 respectively; fan electrical draw is about 25.9 kW.
- 60 km/h: both clear at about 3.915 s with coincident trajectories.
- 160 km/h: both hit the outer barrier, at about 0.430 and 0.613 s.
- 100 km/h / 2-degree steering: both hit despite spare grip. With fan command zero,
  both comparison traces are exactly equal.

Verification:

- All 96 tests pass. Ten focused Turn tests cover bicycle/constant-speed limits,
  combined grip and shared power, unchanged tank state, independent road geometry,
  success/failure scenarios, body-envelope contact, whole-body exit, sampling invariance,
  strict cosmetic damage, fan/leak sensitivity, finite corners/CSV/mesh and invalid
  input handling. Invalid geometry is rejected before building rails. A focused
  renderer test checks world positions, barrier dimensions, mesh caching and uniforms.
  Served and bundled Blob workers exactly match direct solver results for all experiments.
- Build, browser JavaScript syntax and whitespace checks pass. Browser review covers
  390x844 and desktop layouts, predictions, presets, live playback, independent case
  stops, rewind, focus switching, map pointer/keyboard and event scrubbing, controls,
  shared SI-value reload and CSV. No horizontal overflow or nonfinite SVG paths observed.
- A tuned 105 km/h / 4.1-degree / 21% leakage share reloads those exact displayed inputs.
  Its downloaded CSV has 1,574 finite rows, both endpoints, SI configuration/model metadata,
  zero no-fan power and one unchanged tank state across both cases.
- Standalone HTML predicts and reaches the default no-fan impact / fan exit at the same
  times. WebGL reports error 0 and no console errors were observed. Desktop cutaway,
  force vectors and camera switching were exercised at mid-corner. Launch comparison,
  manual Hop (1.38 m/s intact prediction) and Invert hold received browser smoke checks.
  A final focused 14-test physics/renderer pass also succeeds.
- Physical iOS Safari, subjective sound review and final user visual approval remain
  outstanding. No transient tire model, real hardware validation or structural crash
  prediction is implied.

Next: M8 integration, responsive/performance polish and final visual/device review.
Publication still requires user approval.

## M7 user revision - continuous grass runoff

The user requested non-solid lane boundaries. Painted edges now replace the walls,
and a first body-envelope crossing records LEFT LANE without stopping the car.
Fixed speed, steering and capped curvature continue until the whole-body exit gate
or min(30 s, nominal corner time + 2 s). Earlier lane departures remain failed
corners; re-entry cannot erase them. No Turn damage/wreck threshold or debris.
Grass is visual only: terrain traction, fan seal loss and braking are omitted.

Default no-fan departure is at 1.066 s; its trajectory continues until 2.748 s,
about 17 m wider than the fan-assisted finish. The fan case clears at 2.349 s.
At 160 km/h both depart, then continue to 2.594 s / 1.780 s. Prediction, event
buttons, plots and CSV now report lane departure and run end rather than impacts.
The initial M7 browser/CSV figures above describe the superseded barrier version.

Runoff revision verification: all 96 regression tests pass, including served and
standalone worker parity; the final grass-shader change also passes the four
renderer tests and browser shader compilation. Desktop and 390x844 browser checks
cover default prediction, live playback, nonterminal departure/event scrubbing,
rewind, both-run-wide preset, camera/focus and no horizontal overflow. WebGL error
is 0, with no observed console errors. Standalone HTTP preview matches both default
endpoints. Its downloaded CSV has 2,553 finite rows (843 no-fan rows after departure),
matching lane departure/exit fields and one unchanged gas state. This supersedes
the initial M7 impact and CSV verification figures above. Physical iOS and final
user visual approval remain outstanding; nothing published.

## M8 integration - local technical completion, final review open

- Shared modal Tune behavior in ui.js: explicit close, Escape, focus wrapping,
  inactive background, keyboard-safe closed Advanced controls and listener cleanup
  across remounts. Presets return focus to Tune; experiment choices retain focus.
- Arrow/Home/End operation for experiment and powertrain choices. Global playback
  shortcuts respect editing controls and plot sliders. Visible keyboard help,
  readable timeline value text and focus rings; larger compact-layout targets.
  Numeric plot outputs no longer announce every playback update.
- Rewind and vehicle keyboard 0 keep the selected experiment camera. Tune and
  documentation pause playback. Launch inventory and run number survive ordinary
  experiment switches; explicit refill remains available. All Launch plots follow
  selected focus, including the secondary force chart.
- Paused WebGL drawing is demand driven. Camera/orbit/zoom, resize and computed
  results redraw; playback and finite camera/damage animations stay animated.
  Final playback telemetry is flushed before idling. Physics is unchanged.
- Event captions avoid overlap in two rows, including new Turn runoff labels;
  all event lines and full titles/buttons remain. Plot/map keyboard focus survives
  redraw. ui.js is included in served and isolated standalone builds.

Verification and limits are recorded after the final browser pass below.
No publication performed. Final visual approval remains with the user.

### M8 verification - 2026-10-19

- All 98 regression tests pass (final full run: about 45.6 s), including real-air
  invariants, all experiment solvers, served/direct/standalone parity, crowded
  plot captions and camera reset/redraw checks. Final build and app/ui/scene/plots
  JavaScript syntax checks pass; whitespace check passes. No physics equations changed.
- Desktop 1280x900 and narrow 390x844 browser review covers all four experiments:
  navigation, Tune close/Escape and bidirectional focus wrapping, radio/Home/End
  keys, input-safe shortcuts, presets, playback, rewind, camera/focus, force vectors,
  cutaway, plots and responsive layout. Closed Advanced controls stay out of the
  focus trap; presets restore Tune focus. No horizontal overflow observed.
- Launch repeat retains 138.88 kg / 206.64 K as the next starting inventory in the
  checked default example. Switching to Invert and back preserves RUN 02 and the
  identical shared inventory URL. Explicit refill restores 250.5 kg / 293 K.
  Focused force delivery changes with scenario focus; visibility fallback works.
- Manual Hop predicts 1.38 m/s intact, reaches the exact displayed 2.98 s endpoint,
  and stops the plumes. Fire now at about 1.59 s preserves that clock and revises
  the prediction; invalid manual input clears it. Invert's slide release reaches
  its 6.90 m/s cosmetic wreck; rewind and narrow resizing remain consistent.
- Mobile Turn continues beyond its lane edge without damage. Plan-map and ordinary
  plot-slider keyboard focus survive responsive redraw. Paths remain finite.
  Standalone HTTP preview reaches matching default Turn endpoints at 2.75 s;
  modal Tune and keyboard controls work there too. Direct file: loading was not tested.
- Paused drawCount stays fixed (observed 2 -> 2); zoom requests the next draw
  (2 -> 3). Live playback recorded about 75 rendered frames/s and roughly 1.1-1.8 ms
  CPU render work/frame in this browser session; these are local diagnostics, not
  a cross-device benchmark. Final telemetry flush is verified on live Hop and Turn.
- WebGL error is 0 and no browser console errors were observed. Sound opt-in and
  volume controls were exercised at zero master volume; lifecycle is covered by
  audio tests. This is not a subjective listening review. Model documentation
  pauses playback, fits the narrow viewport, closes with Escape and returns focus.
- Physical iOS Safari, hardware touch/pinch, actual screen-reader use, subjective
  sound mix and final user aesthetic approval remain outstanding. Reduced-motion
  behavior is retained in source/CSS but was not separately emulated in this pass.

M8 is ready for local user review. No commit, push or publication performed.

## M9 parameter workspace and local experience review

User requested the next review milestone and a rethink of Tune because changing
parameters and understanding their effects was difficult. The modal overlay is
replaced with an experiment-specific inline workspace: desktop sidebar, phone
section below the scene, with direct navigation and a replay action returning to
and focusing the vehicle. The scene stays unobstructed.

- Three prominent starting controls per experiment, scenario-specific explanations,
  guided complete presets and grouped secondary variables. Paired editable numeric
  inputs and sliders use the same display/SI conversion and keyboard increments.
  Preset names/descriptions survive remount; manual edits mark the setup custom.
- Solver-derived result cards explain the last calculation, previous result and
  numerical change. Rapid edits are labeled together; small rounded differences
  are not called unchanged. Turn departure and clear times retain distinct meanings.
  Hop no-lift/unsupported runs never claim an intact landing. Errors/pending work
  clear stale tuning results and disable replay.
- Parameter changes keep/clamp the paused time for visual comparison. Explicit replay
  starts at zero and returns to the scene. Parameter navigation pauses playback;
  recalculation and invalid input silence audio immediately. Keyboard caret movement
  in number fields is preserved. Automatic-only landing settings are hidden in other modes.
- Each experiment retains its own setup in this session. Other experiments' tank
  edits cannot refill repeated Launch inventory. Links export the current setup.
- ui.js handles nonmodal navigation; tuning.js holds guidance and summary logic.
  Both are bundled in served and isolated standalone paths. Physics is unchanged.

Local verification and remaining physical/user checks are recorded in
`impulse/docs/M9-REVIEW.md`. No commit, push or publication performed.

M9 final local evidence: 102 tests pass (about 35.2 s), build/syntax/whitespace pass,
desktop/narrow and standalone workflow checks pass, and WebGL reports error 0.
Standalone tuned Turn CSV has 2,486 finite rows. Repeated Launch inventory survives
Hop fill edits with an identical shared setup URL. Sound controls were checked at
zero volume; subjective listening remains open. Review views are saved under
`impulse/docs/m9-*-parameters.png`. Physical iOS/touch, actual assistive technology,
OS reduced-motion behavior, subjective sound and user visual approval remain
unchecked. M9 is ready for that final user/device review, not a physical-device
certification. No publication performed.


## Invert user revision — rotating platform

The user requested the earlier rotating-platform interaction. Starting angle,
final angle and rotation duration now define a smooth prescribed rotation on Play,
followed by a two-second final hold. Defaults: 0° → 180° in 4 s. Equal angles retain
stationary-deck testing. Pause/scrub/rewind use the stored solver trajectory.

Contact now includes angular acceleration, centripetal and Coriolis terms, with
Coulomb sliding and inherited COM velocity on detachment. Deck rotation continues
independently of departure pitch. Fan power respects the vehicle cap; external
rig work on the COM and friction loss are separate. Gas remains unchanged. No
free-body angular dynamics, tipping, reattachment, secondary deck collision or
structural impact model is claimed. These constraints supersede the fixed-angle
M6 behavior, while its stationary analytic regression cases remain covered.

Controls, presets, predictions, angle plots, sharing and SI CSV reflect rotation.
Default attachment survives the rotation; no fan gives detachment near 1.726 s
and impact near 2.389 s at about 8.22 m/s. Local verification is recorded below.
No commit, push or publication performed.

Rotation revision verification: all 106 regression tests pass. After the final COM
acceleration readout correction, 18 focused Invert/renderer/standalone-build checks
and the 12-test Invert suite pass. Coverage includes forward/reverse rotation,
zero-speed/acceleration endpoints, final hold, inherited departure velocity,
contact-force limits, COM mechanical work/friction balance, unchanged gas, finite
control corners/CSV and timestep convergence. Served/direct and standalone-worker
parity remain covered. Build, app/scene/tuning syntax and whitespace checks pass.

Browser automation was unavailable in this turn (transport closed), so live
playback, desktop/narrow visual review and real shader compilation were not
rechecked for this revision. Earlier visual evidence describes the prior version.
No deployment performed; physical-device and final user review remain open.


### Rotating Invert browser review — 2026-10-19

The earlier browser connection blocker is resolved. Desktop 1280x900 and narrow
390x844 review now covers live default rotation, final 180° hold, pause/resume,
rewind, timeline and keyboard plot scrubbing, reverse-angle samples, equal-angle
stationary hold, custom angles/duration, whole-rig/tracking cameras, cutaway and
forces. A 30° → 150° / 6 s shared link reloads the exact configuration and gives
42.4° at T+1.50 s. Invalid zero duration clears prediction and disables playback;
5.5 s restores it and recalculates the no-fan prediction to 8.13 m/s.

The no-suction case visibly detaches at about 1.726 s, then the deck and car pitch
separate. Live playback stops at the matching 2.389 s / 8.216 m/s cosmetic wreck.
The browser-downloaded CSV has 1,197 finite rows, independent body/platform angles,
one unchanged gas state, zero fan/friction after departure and zero final clearance.
The served standalone HTML reaches the same endpoint with no observed console
errors. WebGL reports 0; narrow layouts have no horizontal overflow or nonfinite
SVG paths. Phone Parameters/replay and input recovery are usable in emulation.

Corrected the remaining stationary-deck equation and force-chart accessible label
in Engineering details to include rotation loads. Final build, app syntax and
whitespace checks pass. Physics is unchanged in this review; the 106-test regression
result and final focused solver/renderer/worker checks from the implementation
remain the numerical evidence. Review screenshots are
`impulse/docs/invert-rotation-desktop.png` and `invert-rotation-mobile.png`.

Preview is left at the default starting angle, ready to rotate. Actual iOS Safari,
hardware touch, screen-reader use, subjective sound and final user aesthetics
remain unverified. Standalone was checked over HTTP, not by opening a file: URL.
No commit, push or publication performed.


## Physics audit before final publication review — 2026-10-19

User requested a review of the physics and assumptions before the final experience
review. Findings and an ordered improvement plan are in
`impulse/docs/PHYSICS-REVIEW.md`. No solver changes were made by this audit.

All 106 current regression tests pass. Independent probes nevertheless reproduce
an accepted unstable cold air-table state (120 K / 200 kg/m³, negative pressure
slope and a different density on inversion), silent sound-speed fallback, and
body/deck proxy overlap after default fan-off Invert detachment. These are open
correctness/validity repairs, not resolved by the earlier visual review. Default
launch tank states were not shown to enter the cold-state failure.

Further priorities are planar Invert angular/contact dynamics, traceable fan/seal
maps and load-sensitive tires, actual lateral/yaw Turn dynamics with free grass
runoff, valve/attitude uncertainty for Hop, and hardware mass/thermal/contact
severity models. Existing wreck classifications remain illustrative. Publication
still requires user approval; the physics findings should be addressed before
claiming a physically reviewed final experience.

## Physics repairs after the audit - 2026-10-19

User requested the gas validity, Invert spin/contact and vessel thermal repairs.
Implementation, equations, remaining limits and reference targets are in
`impulse/docs/PHYSICS-REPAIR.md`. The earlier audit remains a historical record.

- Replaced inconsistent property-grid interpolation with one direct analytic
  Peng-Robinson approximation. Pressure/energy/entropy/cp/cv/sound use consistent
  derivatives and inversions, with no hidden ideal-gas fallback. Conservative
  support is 140-2000 K; no phase-change or reference-EOS accuracy claim.
- Nozzle expansion uses supported isentropic states and a genuinely sonic choked
  throat. Pressure thrust and stagnation-enthalpy tank outflow remain. Exit
  pressure, temperature, velocity, Mach, choking and active-flow flag are exported;
  inactive nozzle plots show No flow. Geometry remains converging, Cd=0.9 assumed.
- Invert inherits departure spin. First secondary deck contact stops explicitly
  as DECK CONTACT LIMIT / UNRESOLVED, before proxy penetration. The no-fan rotating
  preset no longer invents a later ground impact. Rig work includes body rotation;
  full supported contact moments, tipping and collision response remain open.
- Configurable Qdot=UA*(Tsource-Tgas) acts in every experiment, including closed
  valves. Default UA=250 W/K, source=293 K; zero UA is the adiabatic limit. Heat
  is separate from electrical work. The source is imposed; no finite wall store.
  Sealed integration resolves the gas thermal time constant for tiny inventory.
- Heated landing forecasts include actual coast heating. Launch valve transitions
  retain left/right samples, held RK commands and exact endpoint inventory;
  unsupported intermediate gas/nozzle RK stages stop the run.

All **116 regression tests pass** (50.26 s), including nine focused EOS/thermal
tests. Checks cover independent thermodynamic derivatives/inverses, nozzle energy
and pressure thrust, heated mass/first-law balances, sealed heating/cooling,
nearly empty tank stability, heated landing convergence, Invert spin/work/contact
limits and worker/direct/standalone parity. Build and generated JS syntax checks
pass. Existing uncommitted work is preserved; no commit, push or publication.

Browser review at 1280x900 and 390x844 verifies thermal controls, invalid-input
clearing and recovery, shared thermal settings, the Invert model stop, closed
valve pressure/temperature recovery with fixed mass, choked nozzle readouts and
No flow masking. Heated automatic Hop with 0.2 s ascent and UA=1000 W/K reaches
the same -1.501219628 m/s touchdown in served and standalone HTTP bundles.
Invert, Hop and Turn scene checks report WebGL error 0; no standalone console
warnings/errors were observed. Phone thermal controls have no horizontal overflow.

The browser-downloaded Launch comparison CSV has 1,804 finite data rows and 30
consistent columns, with heat/nozzle metadata and shared settings. Its first-law
residual is 3.10e-6 relative for the thrust case and 2.09e-10 for sealed cases;
the latter warm from 293 to 294.098 K without changing their 252.004 kg mass.
Live repeat Launch retains that warmer inventory, and a new tab opened from its
shared link starts at 294 K / 252.0 kg rather than resetting to the fill temperature.
This confirms numerical bookkeeping, not component performance validation.

Review screenshots: `impulse/docs/physics-repair-desktop.png` and
`impulse/docs/physics-repair-mobile.png`. The local preview is left paused with
UA=1000 W/K and source=330 K to make the thermal controls easy to inspect; the
application defaults remain 250 W/K and 293 K.

Remaining thermodynamics work is reference-air benchmarking, calibrated nozzle/
feed-line/valve losses, optional divergent geometry and finite wall capacity.
The audit's fan/tire, dynamic Turn, Hop attitude/valve and hardware-mass limits
remain. Physical iOS, hardware touch, screen readers, subjective sound and final
user review are still open. The standalone check used HTTP, not a file URL.

## Lightweight thrust delivery - 2026-10-19

User prioritized visuals and requested modest effort, excluding reference
benchmarking and further Invert dynamics. Added optional smooth opening time,
isenthalpic fractional feed pressure loss and limited bell expansion to Launch
and Hop. Neutral defaults preserve legacy behavior. A new Smooth valve / bell
nozzle Hop preset provides an immediate visual example with automatic landing.
The vessel schematic now shows sampled valve travel, active feed coloring and
bell geometry; a compact live strip shows opening, feed pressure and jet speed.
Control/settings/CSV scope and approximations are documented in impulse/README.md.
No commit, push or publication. Existing unrelated work is preserved.

Delivery checks: 119/119 regression tests pass (45.01 s), including three focused
checks for valve travel, feed enthalpy, bell flow/energy and the new landing preset.
Build and app/vessel/physics syntax pass. Browser confirms 50% travel at 30 ms of
its 60 ms opening, 365.6 bara feed and 439 m/s jet at the selected sample; the
predicted landing is 1.50 m/s. Desktop live readouts and 390 px layout checked,
with no horizontal overflow. Screenshot: impulse/docs/delivery-preview.png.
No reference benchmarking performed, per user preference.


## Visual showcase pass — 20 October 2026

Completed the first vehicle/camera visual pass: analytic studio reflections for
paint and glass, darker machined wheels, softer oriented ground shadows, asphalt
and grass variation, flat Turn edge accents, Hop pad corners and tapered cold-gas
jets. Focus car now isolates the selected Launch case; overview retains comparison.
Camera transitions take the shortest orbit with smooth 800 ms endpoints. Physics
and sampled vehicle poses are unchanged. No additional reference validation work.

Build and scene syntax pass; 120/120 regression tests pass (26.36 s), including
focus isolation and transition endpoint checks. Desktop and 390 px browser checks
covered Launch playback/scrubbing, Hop jets and cutaway, Invert rotation through
180 degrees, and Turn grass runoff without wrecking. All four report WebGL error 0;
phone layout has no horizontal overflow. Physical device checks remain open.
Screenshots: impulse/docs/visual-launch-focus.png and visual-mobile.png.
No commit, push or publication; existing unrelated changes are preserved.


## Guided showcase — 20 October 2026

Added a 36-second, four-chapter portfolio tour through Launch, Hop, Invert and Turn.
The top-bar Showcase action precomputes separate example fills, then presents the
existing solver scenes with chapter captions, calculated result summaries and
camera shots. Endpoint holds keep the start and result visible. The tour has pause,
replay, direct chapter selection, a scrub timeline and Escape/Exit controls. No
recording, transmission or publication occurs. The legacy demo=1 Launch mode remains.

Exit restores the saved experiment, parameters, solver result, simulation time,
selected camera/orbit, visibility, cutaway and repeated-launch inventory, paused.
Cancelled preparation cannot install a late result. Hidden pages pause; reduced
motion starts paused and removes camera transitions. Served and standalone builds
include showcase.js. Presentation time and solver time are shown separately.

Checks: 122/122 regression tests passed (24.06 s), including deterministic chapter
boundaries, solver endpoint holds and camera selection; final camera changes also
passed the focused showcase tests. Build/standalone syntax and app syntax pass.
Desktop (1280 × 900) and phone (390 × 844) inspection covered tour layout, chapter
navigation, pause/scrub and all four WebGL scenes. A custom 1.1 grip, focus camera
and T+0.70 s restored exactly. A second launch at T+0.40 s / 50% inventory remained
unchanged after cancelling tour preparation, including after the pending worker
finished. Physical-device and reduced-motion preference emulation remain unverified.
No commit, push or publication. Existing unrelated work is preserved.

Showcase proof images: impulse/docs/showcase-desktop.png and showcase-mobile.png.


## RoadsterLAB naming — 20 October 2026

Renamed the user-facing app to RoadsterLAB at the user's request. Header wordmark,
accessible home label, title/meta description, footer, model introduction, showcase,
end card, CSV filenames and current README headings use the new name. Canonical
offline output is roadsterlab.html; impulse.html remains an identical compatibility
alias. Existing source directory, repository URL, Site identity and internal worker
and solver identifiers are preserved. Scientific uses of impulse remain unchanged.
Build, standalone alias equality, page title and app syntax checks pass; 390 px
header check shows no overflow or overlapping actions. No physics changes,
commit, push or publication.


## Interaction corrections — 20 October 2026

Addressed the user's four reported issues. Wrecked Hop and supported Invert ground
impacts now trigger one synthesized thud/crunch/metal tail, with existing sound
opt-in, master volume and limiter. Explicit pause, rewind, recomputation, mute and
backgrounding silence the tail. Normal completion preserves its decay. Paused
scrubbing and non-wreck/model-limit outcomes never trigger it.

Tuning recalculation retains result rows and substitutes -- for values. Heading,
comparison-note and clock slots keep their dimensions; the scene calculation
banner reserves its slot too. Phone feedback scrolls normally rather than covering
inputs. Sliders use their actual defined steps instead of step=any; precise numeric
entry remains available. The vessel label projects the actual transformed cutaway
cylinder midpoint in all four experiments, compensating Launch's floating origin.
It follows camera/body motion, hides offscreen and avoids duplicate focused Launch
labels and Hop altitude captions.

Verification: 124/124 full tests passed (27.69 s); final focused audio/renderer tests
pass 9/9. Build, standalone syntax, app/audio/scene syntax and whitespace checks
pass. Browser confirmed a 7.39 m/s wreck produces one impact sound event, while
scrubbing to the same touchdown produces zero. Sound was switched off after testing;
actual speaker tone/loudness was not subjectively auditioned. Desktop pending and
settled feedback height were both 281.60 px, with identical slider and scene positions.
Range grip accepted exactly 1 and declared 0.05 steps; all rendered parameter ranges
have explicit steps. Callout motion was checked in Launch separation, airborne Hop,
180-degree Invert and Turn, each reporting WebGL error 0. Phone layout checked at
390 × 844 with no horizontal overflow. No physics changes, commit, push or publication.


## Sound and color refinement — 20 October 2026

The user additionally requested a stronger wreck sound and more beautiful car/GUI
colors, then reiterated the four interaction fixes. Replaced the ringing oscillator
effect with a precomputed deterministic collision transient: low chassis impact,
several crumpling bursts, low metal resonances, high glass/debris ticks and short
room reflections. Peak is bounded and the tail fades to zero. Opt-in, one-shot
playback gating, master gain, limiter and explicit silencing remain intact.

Vehicle finishes are now pearl white, lagoon teal and crimson, with glossier paint.
Labels/plots retain lighter shades for contrast. GUI surfaces use graphite/teal,
mint selection and replay accents, coral launch actions, and coordinated borders,
inputs and scrollbars. No geometry, physical solver or simulated result changes.
125/125 tests pass (23.94 s), including waveform finiteness, bounded peak, decay,
repeatability and audio lifecycle. Source/build syntax passes. This supersedes the
initial wreck sound implementation, preserving all four interaction corrections.


Final browser checks for the combined pass: the revised buffered wreck sound fired
one event at the short-hop wreck with no browser errors; Sound was turned back off.
Phone pending/settled feedback heights were both 283.60 px and the grip slider's top
was 481.70 px in both states, with -- replaced by calculated results. Grip was exactly
1. Phone width 390 px has no horizontal overflow. The callout's caption stayed within
the scene viewport and followed the car. Screenshots: impulse/docs/interaction-mobile.png
and interaction-desktop.png. All original four fixes are complete alongside the
requested sound/color refinement. No commit, push or publication.


## Portfolio release preparation — 20 October 2026

Implemented explicit Showcase video export at landscape 1920x1080 and portrait
1080x1920, with fixed independent render surfaces, chapter captions, solver results,
physics equations, author credit and assumption disclosure. MP4 is preferred with
WebM fallback; recording is silent, targets 30 fps and takes about 36 seconds.
Cancel/background/Exit clean up recording and preserve the saved experiment.

The webpage has eight expandable technical cards and author/source/Scholar links.
The model dialog links directly to this section. The root GitHub README now documents
vehicle forces, fan/seal curves, tank mass/energy/heat, consistent Peng–Robinson EOS,
nozzle choking/expansion/pressure thrust, Hop landing, rotating contact, geometric
Turn and numerical integration/event handling, with defaults and explicit limits.
Release guide and draft notes carry the technical detail into distribution.

128/128 automated tests passed (24.91 s), including canonical video layouts, format
fallback and caption wrapping. Build/standalone parsing and app/recorder syntax pass.
Actual H.264 recordings decoded at both specified dimensions, 35.68 / 35.71 seconds,
about 25 delivered fps; this machine did not reach the 30 fps target. Sampled Hop
landscape and Invert portrait frames show readable results/captions and rendered
vehicles. Phone physics cards wrap without horizontal overflow; phone export controls
fit, and cancelling disables recording/cleans up before restoring the original Hop
setup. Browser error/warning log is empty. Author preview and technical screenshots
are in impulse/docs/. Physical iOS/touch, assistive technology and subjective sound
review remain open. No experimental validation, commit, push or publication.

node scripts/release.mjs (from impulse/) builds unique local web/source candidate
folders with the full physics README and SHA-256 manifest. Generated packages remain
ignored under dist/release. No additional hosting identity is created.


## Publication preparation — 20 October 2026

Final local suite: 128/128 passed (24.81 s); build and app/scene/recorder syntax pass.
The webpage, root GitHub README, release guide and notes include the governing
equations, reduced-order assumptions, gas EOS, tank heat exchange, nozzle delivery,
contact/trajectory limits and numerical solution. CI additionally checks recorder
and engineering module syntax.

Local Git metadata is write-protected. A connected-GitHub publication attempt was
blocked by automatic approval review at a screenshot upload, because the latest
user message was interpreted as preparation authorization rather than explicit
public-upload/publication approval. No branch update, commit publication or Pages
deployment was performed. Some unreferenced blob objects were created before the
block; no public branch or website points to them. The verified candidate remains
local, awaiting explicit approval to upload screenshots/source and update Pages.


Publication authorization: the user explicitly answered yes on 2026-10-20 to
uploading source/screenshots to the public Albert-Gil/RoadsterLAB repository and
updating GitHub Pages. The earlier automatic-review block is resolved by that
explicit authorization. Retain the full physics cards, README and release guide.

## Starbase-inspired scenery — 20 October 2026, local

Implemented a native procedural sunrise campus in scenery.js, with rocket/tower,
tanks, hangars, coastal ground/water and analytic sky/reflections. Both build paths
and the Showcase/recording Scene include it. Car framing/poses and all physics are
unchanged; the backdrop follows the Launch floating-origin transform correctly.
Bright-sky HUD plates and collision-free phone/Showcase labels were reviewed.

130/130 automated tests passed; nine focused renderer/scenery tests passed after
the final geometry and underside-camera fixes. Fourteen desktop/narrow/cutaway
browser captures returned WebGL error 0. The actual app's 390px layout, playback,
scrubbing, camera controls, repeated Launch, CSV, Hop underside inspection,
Showcase chapters/exit and served standalone were exercised. No new video was
recorded and nothing was published. See impulse/docs/SCENERY-REVIEW.md for exact
scope, screenshots and remaining physical-device/GPU/user-review limits.

### Scenery polish — 20 October 2026 local / 21 October UTC

Added linear-light material response, filmic display mapping, cool fill opposite
the warm sunrise, clearer paint/glass reflections, height-derived projected car
shadows, filtered road aggregate, concrete joints, decorative dunes and a connected
tidal channel. Static scenery is 86,979 vertices / 13 material groups; no remote
assets or runtime dependencies. Launch overview lifts as actual separation grows
while retaining manual orbit with Auto frame off. Turn follow view is lower.

Video export now carries fractional RAF timing and uses completed-frame requests
where supported, retaining an automatic-capture fallback. Tests cover cadence,
starting-frame capture, fallback track cleanup, dune clearance and frozen framing.
134/134 tests passed; 20 final wide/narrow/cutaway renders returned WebGL error 0.
Landscape/portrait H.264 files decode cleanly with monotonic timestamps; observed
rates were 26.67 / 28.62 fps, below the 30 fps target. Recording cancellation clears
the extra surface. Served standalone and actual 390px layout were checked.
Physics source is unchanged. Physical iOS and final visual review remain open;
this pass is local only. See impulse/docs/SCENERY-REVIEW.md for evidence/limits.


## Local recorded audio integration — 2026-10-20

Implemented the user-supplied 17-file ElevenLabs library across Launch, Invert, Hop
and Turn. Pure audio-mapping.js uses existing speed/force/flow/fan/contact outputs;
audio.js reuses decoded buffers and 11 persistent loops, gated transitions and
supported impact one-shots. Music persists across modes/pause; separate music/effects
volumes persist locally. Hidden pages and silent video export mute both. Preserved
all original WAVs; prepared 11.31 MB of 48 kHz/16-bit browser assets with mono effects,
loop crossfades and headroom. Standalone embeds the same recordings. Physics unchanged.

Verification: 144 tests passed; all 17 files decoded in native browser audio;
mode/lifecycle/mute checks passed. A native offline all-file overlap stress render
peaked at 0.71014. Served/standalone, desktop/390 px controls and app mode playback
checked, no observed browser errors. Real-device and subjective listening remain.

The user subsequently confirmed Creator-plan ownership and licensing rights for
the supplied recordings. RIGHTS.json now records that confirmation and the audio
check passes. Pages retains check-audio-rights.mjs; local staging carries the rights
status. See impulse/docs/AUDIO.md and impulse/share/audio-20261020/.
No publication, deployment, Git write or social post.


## Optional Parameters / playback placement / default sound — 2026-10-20

User requested a clearer simulation/results view. Parameters is now hidden on
initial load; the button opens a nonmodal side column on desktop and an inline
panel on phones. Close/Escape returns opener focus; presets preserve panel state,
opening pauses playback, and Replay closes the panel. Toggling preserves input
values and inventory. Side-panel height follows available viewport/parent space.
The main experiment button, rewind and timeline now sit directly under the scene,
before the comparison strip and velocity/acceleration/distance telemetry. Closed
wide layout uses full scene width and a compact four-column telemetry layout.

Sound defaults on. If browser autoplay blocks a suspended context, the first real
pointer/key interaction resumes it. Explicit mute persists in v3 preferences;
legacy music/effects levels migrate without the former off-by-default policy.
Wanted enable state remains separate from actual running state. No autoplay
restriction is bypassed. Physics source hash remains
1F5C4FD2C6FCAA400E7DACCB225DB62AA00FF0774C9C5DCD0425B2E2FA224762.

Verification: 147 automated tests passed, including three new default-on/mute/
legacy-migration checks; build and app/ui/audio/scene syntax checks passed. Browser
1265 px desktop, 675 px intermediate and 390 px iframe layouts inspected. Verified
panel toggle, close/Escape/focus, preset remount, edit-close-reopen, Replay close,
open-pauses, remembered mute, reload and first-interaction audio startup. All four
experiment playback/rewind paths retain the new order, with WebGL error 0 and no
observed console warnings/errors. Evidence: impulse/share/workspace-20261020/.
Physical iOS, assistive technology and subjective listening remain open. No
publication, deployment or social post.


## Prominent Parameters / cold-gas plumes — 2026-10-21

Follow-up publication revision: Corner overview has a closer default zoom. The
in-app and LinkedIn showcase examples now use a 120° Turn sweep, with close opening
framing around both live cars and a smooth pullback to the full corner/runoff.
The normal Turn sweep remains editable with its original default. Updated source,
standalone build and publication materials locally. No full regression suite or
deployment audit was run, per the user's request for a focused materials pass.

Moved Parameters from the small scene legend into a large labeled button beside
Launch/Replay, with 46 px desktop and 48 px phone targets. Enlarged the top-bar
entry. Existing nonmodal panel behavior is preserved.

Replaced the blue cone with white tapered cores, procedural turbulent clouds and
height-dependent Hop ground spread, using the user's photos as visual references.
All gas effects require actual delivered flow and thrust. Four Hop mounts and
physics are unchanged. Hop tracking leaves room for the jets/pad. Effects use the
simulation clock and clear on cutoff; plume geometry is illustrative, not CFD.

Verification: 148 full-suite tests passed; final camera refinement passed all 14
Hop/scene checks. Build/syntax checks passed. Thirteen native WebGL review renders
returned error 0, including wide/narrow, cutoff, underside and cutaway. Same-time
Hop exports were byte-identical. Actual desktop/390 px controls opened/closed with
no horizontal overflow; Launch/Hop/Invert/Turn inspected with no browser warnings
or errors observed. See impulse/docs/PLUME-REVIEW.md and share/plumes-20261021/.
Physical devices and final visual review remain open. Local only; no publication.

## M10 UX, graphics and delivery pass — 2026-10-26, local

User request: implement every recommendation from the UX/UI/graphics review, keeping the
dependency-free renderer (Three.js port declined for now) and editing the local folder in
place. Physics, solver results, CSV and worker/standalone parity are unchanged.

Stage-first layout (tabs in the top bar, compact heading, window-fitted scene, primary
action inside the first screen at 360–1440 px); one camera control inside every scene;
predict-then-reveal with solver-graded questions (`src/reveal.js`) and veiled outcomes until
the run ends, the viewer skips, or Parameters is open; progressive plots and Turn plan view;
analysis tabs with Launch small multiples; docked mini player; HUD that steps back during
playback; Cutaway/Forces close-up with restore; SI-led milestones with a km/h ⇄ mph toggle;
vessel READY state; self-hosted Inter/JetBrains Mono; one token block, 11 px type floor,
41 dead rules removed and the restyled components consolidated. Graphics: time-driven Launch
director with reduced-motion fallback, distance boards/posts, wheel blur, distance beacons,
solver-gated rubber and scrub marks, Turn gravel shoulder, bloom + vignette pass, touchdown
dust/shake/flash, Hop pad and Invert rig dressing with a θ protractor. Fixed an existing
floor/coast depth fight that made cars appear to sit on sand (without a depth bias, which
hid the Turn road and Hop pad on a real GPU), and drew the Launch floor back to the start
line. Served audio now uses Opus or
AAC copies (~0.96 / 1.44 MB instead of 11.3 MB) with per-file WAV fallback.

Verification: 154/154 tests (6 new, one Turn upload-count update for the shoulder mesh);
syntax checks; headless Chromium functional script, layout/contrast/tap-target audit at six
widths, showcase start/exit and video-export start. See impulse/docs/M10-UX-REVIEW.md and
impulse/share/ux-20261026/. Real GPUs/phones, assistive technology, Safari/Firefox audio
decoding and aesthetic sign-off remain open. Nothing committed, pushed or deployed.

## M11 live physics panel, shadows and visualization — 2026-10-27, local

Live physics panel with a Physics toggle (remembered; `overlay=0|1`): Launch force budget
(tire force with grip and motor ceilings, thrust, drag, net g), Turn friction circle for both
cars, Invert contact budget, Hop thrust/weight; current solver state only, phone one-liner.
Launch samples now record the existing `traction`, `motor` and `resist` force-model values
(trajectories identical, not in CSV). Timeline event markers (reveal-aware, click to jump);
previous-setup ghost for Launch and Hop; utilization-coloured Turn path trails; Turn Corner
framing fitted to the real road and paths along its long axis; 3D force arrows; distance
labels hidden under car labels. Real-time sun shadow map (8-tap PCF, texel-snapped) with
analytic fallback; adaptive quality (`quality=high|medium|low`). Fixes: phone status pill
overlap, 1280 px top-bar collision, narrow-scene toolbar overlap, undefined ghost materials.

Verification: 158/158 tests (4 new); functional browser script, layout audit at six widths,
screenshots in impulse/share/m11-20261027/. Real-GPU cost/look of shadows, physical phones
and aesthetic sign-off remain open. See impulse/docs/M11-VISUAL-PHYSICS.md.
