# Milestone 3 — Launch comparison

Status: implemented locally; verification record below. Ready for user visual review. M1/M2 are technically
reverified in MILESTONES.md. The current real-air default is 400 barg / 600 L / 1x;
650 barg remains available. The original 650-barg default was changed in the later
real-gas commits. Keep this decision visible rather than silently changing defaults.

## Intended experience

Three cars launch together on parallel lanes. Electric-only is pearl/slate, fan-assisted
is cyan, and thrust-assisted is orange-red. Track markings and position labels make
their separation understandable. Below the scene, three aligned plots show position,
velocity and acceleration for all three cars at the same instant. The scene remains
the centerpiece. The tuning drawer and compact telemetry strip from M2 are retained.

The existing ghost view is a temporary visualization: its clamped and scaled separation
must be replaced before describing the scene as an engineering comparison. Existing
camera/shader helpers are scaffolding, not a completed three-lane implementation.

## Implementation sequence and review gates

### M3.1 — Responsive simulation and shared result model

- Keep physics pure and independent of playback; compute all three configurations
  from identical initial mass, temperature, energy and hardware assumptions.
- Introduce one comparison result containing configuration, initial gas state, three
  runs, event times, and per-run termination status. Use a shared six-second clock.
- Move expensive run generation into a browser worker. Exact nozzle evaluation now
  takes roughly 1.6 seconds for a cold default thrust-run calculation on this host;
  doing this synchronously for every slider event is unsuitable for smooth tuning.
- Coalesce slider changes, identify requests and discard stale responses. Keep the
  previous scene visible with a clear calculating state; do not mix old plots with
  new control values. Avoid terminating physics halfway and publishing partial results.
- Cache completed comparison results by full configuration and initial gas state.
  Do not reintroduce history-dependent nozzle approximations to accelerate the UI.
- Use a regular module worker for the served app and a Blob worker built from the
  same isolated modules for standalone HTML. Keep both modes dependency-free.

Acceptance: changing controls leaves orbit/pause interactions responsive; only the
latest result is installed; numerical answers equal the direct solver. Repeated
launches use the selected run's final gas state for all comparison configurations.

### M3.2 — Three lanes, real separation and camera controls

- Use the existing laneZ/LANE_WIDTH helpers to place cars in separate lanes.
- Render each car at its actual simulated longitudinal position. A shared moving
  reference frame may subtract one origin from all positions; never clamp each car's
  gap or scale its position independently.
- Add lane labels and world-space start/distance markings in meters. Environment
  movement, wheel rotation and car labels use the same distance state as the plots.
- Connect field, side and focus camera presets to visible controls. Default to a
  high oblique field view; offer side view for longitudinal comparison and focus
  view for vehicle detail. Respect manual orbit and reduced-motion preferences.
- Use the existing fit/project helpers for consistent framing, with smooth camera
  transitions and a static option. A wide separation must remain physically honest:
  switch to a track overview with readable labels rather than compressing the gap.
- Set lane, fog and all three shadow uniforms every frame. Keep Invert/Hop's existing
  rendering behavior separate from the Launch lane scene.

Acceptance: start, midpoint and end positions match solver distances; cars fit at
390px and desktop widths; no misleading compressed gaps; all three colors/names
remain distinguishable. Aborted runs show their stop point/status and do not keep
accelerating, extend their trace or imply simulated flight after contact loss.

### M3.3 — Position, velocity and acceleration plots

- Add a reusable native SVG plot component/module with measured responsive sizing.
  No new visualization dependency is required for nine traces and simple interactions.
- Three vertically aligned panels: x(t) in meters, v(t) in km/h, and a(t) in g.
  Provide an acceleration-unit toggle if useful; internal values remain SI.
- Each panel contains all three scenarios on common axes. Share a 0–6 s x domain;
  choose a y range across all visible runs, with padding, readable ticks, zero lines,
  units and negative acceleration where it occurs. Do not clip supported values.
- Use the shared scenario color palette, line styles and names. Keep scenario colors
  separate from the force colors used in the existing force-vector legend.
- Preserve valve-start/end and termination discontinuities during downsampling;
  include the last valid sample. Shade the boost interval and label milestones
  without crowding the chart.
- Mark partial/unsupported runs explicitly. Never draw a flat continuation that
  looks like a valid six-second prediction after an early termination.

Acceptance: every plot uses the same comparison result as the cars; axes/labels are
readable on mobile; spot checks agree with solver samples; no invalid SVG paths.

### M3.4 — Synchronized inspection and controls

- Show a playback cursor in all three plots with instantaneous values for every car.
- Hover/touch inspection uses one crosshair time across all panels. Hover does not
  silently change playback time. Click/tap or drag deliberately scrubs and pauses.
- Reuse sampleAt for scene, tooltip and telemetry interpolation. Show the distinction
  between the inspecting cursor and playback cursor while playing.
- Support keyboard-accessible time inspection, reset and scenario visibility toggles.
  Hiding a trace/car changes display only; it must not rerun or modify physics.
- Treat a single selected vehicle as the telemetry/sound focus. All three cars retain
  shared time. Display selection and configuration mode as distinct concepts.
- Pause, resume, rewind, speed changes, sound, capture and camera reset must work
  without losing visibility settings or the comparison result.

Acceptance: scrub to three arbitrary times and verify that cars, values and cursors
agree; play/resume has no jumps; keyboard/touch has an equivalent path to inspection.

### M3.5 — Interpretation, exports and reproducible comparisons

- Retain acceleration milestones and add event/status annotations to explain where
  assistance changes the result. Avoid guaranteed rankings outside tested settings.
- Offer a comparison CSV with scenario and SI-unit columns, configuration and initial
  state metadata. Retain per-run exports where useful. No NaN or invented late samples.
- Share configuration, initial gas state, focus and selected camera/visibility state
  explicitly; do not overload demo=1 to mean arbitrary comparison state.
- Add a small set of named demonstration presets using disclosed assumptions, such
  as reduced grip or delayed boost. Provide a clear reset to current defaults.

Acceptance: reopening a link reproduces the comparison; export values agree with
the tooltip; an aborted case explains why its result stops.

### M3.6 — Integrated verification and visual review

- Run all regression suites, including air-table, physics, standalone bundle and
  renderer setup tests. Add focused coverage for worker parity/stale results,
  comparison sample alignment and true scene-coordinate separation.
- Inspect normal and standalone apps at 1280x900 and 390x844. Exercise tuning,
  all camera presets, orbit/zoom, play/pause/rewind, hover/scrub, visibility toggles,
  repeat/refill, links, exports, sound and reduced motion.
- Check the 400-barg default, 650-barg exploration, zero boost/ambient storage,
  low/high grip and explicit contact/property-limit cases. Stop at supported states.
- Measure interaction stalls and frame rate on a stated target device. Aim for
  smooth 60 Hz desktop animation and a usable mobile view; report measured results
  rather than treating that target as a guarantee.
- Capture one desktop overview and one mobile screenshot for user review. Preserve
  all source and concise engineering notes; publishing is a later decision.

## Scope and effort

Implement M3.1–M3.2 first for a scene review, then M3.3–M3.4 for an analysis review,
then exports and integrated verification. Budget roughly 4–6 focused development
days, with worker/standalone behavior and camera framing the largest uncertainties.

M4–M8 retain their approved order: Blowdown/sound, Hop visualization, Invert failure,
Turn comparison, and integrated polish. M3 does not add dynamic Invert destruction,
Turn physics or a new thermodynamic equation of state.


## Implementation record — 2026-10-19

- M3.1 delivered: simulateComparison and comparisonSample share one six-second clock.
  simulation-client.js keeps one running and one coalesced queued request, discards stale
  installations and caches up to 12 exact configurations. Normal pages use a module
  worker; the standalone file embeds the same physics in a Blob worker. Pending controls
  are visibly distinct from the last installed result and export/play are disabled.
- M3.2 delivered: three solid cars at true world coordinates, separate lanes, shared
  tracking origin, start/distance markings and collision-avoiding world labels. Overview,
  elevated side and selected-car cameras are connected; transitions respect reduced
  motion, manual orbit cancels them, and Auto frame can be disabled. Wide gaps require
  a track overview with smaller cars; Focus provides a close-up without distorting gaps.
- M3.3/M3.4 delivered: position, velocity and acceleration SVG panels; responsive ticks,
  units, line styles, boost shading, 0–60 markers, moving sample points, shared live and
  inspection cursors, keyboard/click/drag scrubbing, display toggles and g/m/s² switch.
  A focused car drives compact telemetry and audio. Stopped runs end their traces;
  late inspection says Stopped rather than extrapolating predictions.
- M3.5 delivered: current/default, reduced-grip and delayed-boost setups; comparison and
  focused-run CSVs; new links explicitly save camera, focus, visibility, Auto frame and
  initial tank state without using demo=1 as a comparison flag. Repeat uses the focused
  car's final inventory for all three counterfactual launches, as disclosed by its tooltip.
- Background calculations keep orbit and camera controls usable. Rendering runs on
  requestAnimationFrame while telemetry, labels and plots update at up to 25 Hz; scrub
  and control actions update immediately. Labels have fixed metrics to avoid repeated
  forced layout. The scene canvas exposes diagnostic frame-rate/render-cost attributes
  for local observation; this is not a physical-phone performance certification.

Verification: 45 tests passed in the full regression run, followed by focused additions
for the actual comparison render path and near-293-K share restoration (47 total).
Build/syntax checks pass. Browser checks cover normal and standalone workers, keyboard
scrubbing, camera/focus/visibility state sharing, rapid tuning, repeat/refill, units,
CSV download, 390px no-overflow layout, finite plot paths and non-Launch regressions.
The downloaded default comparison CSV has 1,803 supported rows, three scenario names,
full configuration and initial-state metadata, and no nonfinite values. A 650-barg /
80-L / 20-cm² case explicitly stops at OUT OF TABLE and shows no invalid SVG paths.

Physical iOS Safari, device-specific frame-rate profiling and final aesthetic approval
remain open review items. M4 is next; this work does not implement M5–M7 behaviors.
