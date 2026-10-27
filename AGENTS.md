# RoadsterLAB

## Purpose and priorities

Build RoadsterLAB, an interactive engineering portfolio project inspired by the redesigned Tesla Roadster. Prioritize a striking visual experience, intuitive interactions, and meaningful simplified physics. This is an independent exploratory simulator, not a validated Tesla digital twin.

The approved direction combines Launch, Invert, Hop, and pressure-vessel Blowdown. Launch + Blowdown is the first polished milestone. Invert and Hop reuse shared physics; finish and verify the main experience before expanding scope.

## Repository layout

- This directory is the Git repository root. The application lives in `impulse/`.
- `impulse/src/physics.ts`: pure simulation functions, SI units, configuration and results.
- `impulse/src/scene.js`: native WebGL renderer and original procedural vehicle. The body is lofted from designed character lines (shoulder, beltline, roof rail, skirt crease) with per-panel creases; glass, pillars, gaps, vents, lights and skirts are exact projected panel cuts. `carParts()` exports the mesh for offline checks.
- `impulse/scripts/render-ref.mjs`, `section-ref.mjs`, `measure-ref.mjs`: optional offline proportion checks against a local reference STL. The runtime never loads the STL and the model is not a decimated copy of it.
- `impulse/src/app.js`: UI, controls, playback, plots, exports and shareable presets.
- `impulse/src/tuning.js`: experiment guidance and solver-derived tuning summaries/differences.
- `impulse/src/ui.js`: parameter navigation and shared keyboard behavior.
- `impulse/src/audio.js`: opt-in Web Audio sonification; required by `build.mjs` and the standalone bundle.
- `impulse/src/style.css`: responsive visual design.
- `impulse/tests/physics.test.ts`: physical invariants, limiting cases and convergence checks.
- `impulse/scripts/build.mjs`: builds browser assets and the standalone HTML.
- `impulse/scripts/serve.mjs`: local HTTP server.
- `impulse/README.md`: usage, assumptions, equations, limitations and roadmap.
- `impulse/.openai/hosting.json`: existing Site identity; preserve its project ID.

Generated `dist/` and local `.sites-runtime/` files are ignored. Edit source files, then rebuild; do not treat generated HTML as the source of truth. Do not initialize a nested Git repository inside `impulse/`.

## Development commands

Use Node.js 24 or later. The current implementation has no external dependencies. From `impulse/`:

```sh
node scripts/build.mjs
node scripts/serve.mjs
node --experimental-strip-types --test tests/*.test.*
node --check dist/app.js
node --check dist/scene.js
```

The server uses `http://127.0.0.1:4173`. The build also emits `dist/impulse.html`, which can be opened directly in a browser without a server. Stop task-owned preview servers when finished unless the user needs one left running.

Retain the dependency-free approach unless a concrete requirement justifies changing it. The original React/Three.js proposal was replaced after dependency installation failed in the environment. Do not assume those frameworks are installed.

## Engineering rules

- Use SI units internally; convert only for display. UI pressure inputs are gauge (barg); Config pressure is bar absolute and the solver uses Pa absolute. Unmarked legacy share links store absolute bar.
- Clearly separate sourced manufacturer claims, reported details, modeling assumptions and calculated outputs. All current numerical vehicle inputs are illustrative assumptions.
- Never silently tune unknown parameters to match a Tesla acceleration claim. Do not mix the 2017 concept specifications with later announcements.
- Keep physics independent of rendering and playback speed. Use deterministic runs and event interpolation for speed milestones.
- Maintain mass and energy consistency in tank discharge. Include both choked and unchoked flow and the pressure contribution to nozzle thrust.
- Respect traction, torque, available power and axle-contact limits. Fan power counts against the shared electrical power budget.
- Document model validity limits and stop or explicitly flag unsupported states rather than hiding them.
- Preserve gas mass and temperature across repeat launches. Refill must be an explicit action.
- Do not describe schematic airflow or effects as CFD results.

Current limitations: consistent direct Peng–Robinson dry-air approximation
(generated `air-table.js`; conservative single-phase 140–2000 K and 0.01–1176.6
kg/m³, OUT OF TABLE status for unsupported gas/nozzle states). Below 200 K an
explicit constant ideal-cp continuation is used. This is not the NIST reference
EOS or a phase-change model. Heat rate is UA(T_source−T_gas); imposed source
reservoir, no separate finite wall store. No pressure-vessel structural sizing or
regulator. Nozzle Cd=0.9 and pressure thrust; optional limited bell expansion,
isenthalpic fractional feed pressure loss and prescribed smooth valve opening.
Instant closure; no line transients or resolved plume/shock interaction. Quasi-static rear-drive Launch
load transfer, fixed aero and no detailed suspension/tire model. Turn remains a
steady-state grip-capped geometric surrogate with visual grass runoff. Invert has
guided supported pitch, inherited departure spin and ballistic translation; first
secondary deck contact stops as an unresolved model limit. No tipping/contact
moment solver, collision response or structural damage model. Hop remains level,
vertical-only with ideal mean-duty valves; cosmetic touchdown speed threshold.
Default fill is 400 barg / 600 L; regenerate the generated EOS API with
`node scripts/bake-air-table.mjs` after editing `scripts/air-eos-template.js`.


## Visual and interaction direction

- Keep the vehicle and experiment as the centerpiece, with compact supporting telemetry.
- Preserve the dark graphite/green identity, restrained warm-red accents, readable typography and clear force colors.
- Make cutaway, force vectors, gas state and motion respond to simulation results.
- Keep beginner controls simple; expose detailed assumptions in advanced controls and documentation.
- Support responsive layouts, keyboard operation, visible focus states and reduced-motion preferences.
- Avoid placeholder controls, invented performance results and links to unpublished deployments.

## Verification

For physics changes, run the physics tests and add focused checks for new conservation laws, boundary conditions or numerical failure modes. Check timestep sensitivity when integration or event logic changes.

For UI changes, rebuild and check browser JavaScript syntax. When browser tools are available, inspect desktop and narrow layouts and exercise tabs, sliders, playback, scrubbing, cutaway, force vectors, repeat launch and exports. Check WebGL errors and preserve controls across rerenders.

Report exactly what was verified. Passing numerical tests does not establish visual correctness or validation against Tesla data. A Cursor-browser pass was completed 2026-10-18 after the procedural panel model replaced the STL loft: desktop front/side/rear/top views, cutaway, Launch playback, scrubbing and rewind, ghosts, Hop, Invert at 0° and 180°, WebGL getError 0, and 390px emulation (the field of view widens below a 1.6 aspect ratio so the car fits). Public URL: https://albert-gil.github.io/RoadsterLAB/?demo=1. Physical iOS Safari remains outstanding. The M1/M2 redesign was pushed to GitHub Pages on 2026-10-18 at the user's request.

## Source, deployment and collaboration

- Inspect Git status before editing; preserve user changes and unrelated files.
- Keep credentials out of source, logs, shell arguments and commits. Do not overwrite or force-push history.
- Reuse the existing Site identity in `impulse/.openai/hosting.json` (`appgprj_6ad529f9afc48191b5bb6ed5f791fb24`). The verified public URL is GitHub Pages: https://albert-gil.github.io/RoadsterLAB/. Do not invent additional unpublished URLs.
- If publishing through Sites, follow its current workflow, preserving this root repository. Do not create duplicate Sites or silently replace the root Git history to satisfy a helper's checkout assumptions.
- The app's current Library HTML and source ZIP are exports. When the user requests an update to an existing Library file, rebuild and replace that same Library identity rather than creating duplicates.
- Prefer small, coherent changes. Keep engineering documentation aligned with behavior. Summarize changes, verification, and remaining limitations when handing work back.

## Active roadmap
Follow MILESTONES.md. M1/M2 have been repaired and technically reverified; M3/M4, M5/M5a-M5c, M6 and M7 Turn are implemented locally; follow the completion records in MILESTONES.md. M8 integration and the M9 parameter-workspace redesign are implemented locally; M9 local verification is recorded in MILESTONES.md. Physical-device, assistive-technology, listening and final user review remain. Do not publish before the user approves the finished experience.


## Regression gates after the real-air audit

- Tank energy removal uses stagnation enthalpy (Sample.he), including jet kinetic energy.
- Nozzle lookup/caching must be deterministic for identical inputs regardless of call order.
- Successful displayed samples and CSV exports must be finite; do not accept NaN in corner tests.
- Keep the standalone module wrappers; private table CP and physics CP must not share a scope.
- Regenerate air-table.js from its canonical EOS template using the baker. Check h=u+p/rho, cp/cv/entropy derivatives, sound speed and inverse round trips. Never reintroduce silent ideal-gas fallbacks.
- Shader uniforms must be initialized in render; CI exercises scene uniform setup without a GPU,
  with real shader compilation and visual correctness checked in the browser.
- The latest default is 400 barg / 600 L / 1x; 650 barg remains an exploration input.
- M3 now uses simulation-client.js, simulation-worker.js and plots.js. Keep worker and direct solver parity, coalesced stale-result protection, true-scale lanes and explicit stopped traces.


M3 maintenance: served workers import physics.js; build.mjs also embeds a classic Blob
worker in standalone HTML using the same module isolation. Include new modules in both
build paths. Physics and numerical CSV use SI; velocity plots use km/h and acceleration
plots offer g or m/s². Focus and visibility are display state, not changes to physics.

M4 maintenance: vessel.js reuses the configurable plots.js controller for focused
pressure / temperature / mass and flow / thrust views. Keep pressure in bara, mass
in kg and temperature in K (Celsius is a secondary readout). Plot durations follow
Launch/Hop results; state and delivery views must use their own measured card width.
Flow markers describe observed flow, not guaranteed valve commands. Preserve audio
opt-in and silence during pause/background; the volume control lives in Tune.

Hop maintenance: hop.js derives plots, apex/events and deterministic cosmetic damage
from solver samples. Four HOP_MOUNTS share the legacy two-bank total effective area:
A_total = 2 * nozzle input, A_each = A_total / 4. Landing burn is off by default,
uses the same tank, and never guarantees success. The wreck threshold is an
illustrative rule (strictly greater than), not a structural rating. Keep post-impact
visual time out of physics/CSV. Ground support only applies before lift-off.

Landing controller maintenance: blowdown-lookahead-v1 forecasts the post-ascent
tank and searches coast/full-burn timings. landingTarget (m/s) and landingLead
(seconds) are shared configuration. Forecast feasibility is distinct from the
cosmetic wreck threshold. Explicit future property limits close the valve before
unsupported discharge while supported ballistic flight may continue. Preserve
both left/right samples at valve discontinuities; sampleAt chooses the right
limit. PRE-TOUCHDOWN is the left contact sample; TOUCHDOWN closes the valve.

Manual Hop maintenance: landingBurn is 0 (off), 1 (automatic), or 2 (manual);
do not coerce shared mode values to booleans. manualBurnAt, manualBurnDuration and
manualBurnCommand define one fixed descent-ignition window; once lit it can
rebound. Fire now reschedules that window, preserves playback time and history,
and recalculates the prediction. Both modes use the same remaining tank and gas
safety limits. Pre-run prediction uses the full solver outcome and must clear
while pending/invalid; no-lift or unsupported runs must not claim an intact landing.
Keep manual settings in links/CSV, worker parity, and all rebound apexes in the
scene envelope and plots.

M6 maintenance (user rotation revision): Invert rotates from Config.invertStart
(degrees) to Config.angle (final degrees) over invertDuration seconds, with smooth
quintic start/stop and a two-second final hold. Equal angles retain the analytic
stationary-deck solver. Rotating contact includes angular/Coriolis loads and
inherits deck COM velocity on detachment. RK4 uses at most 2 ms with bracketed
contact events; verify convergence. Stored body/platform angles drive rendering,
plots and scrubbing; never animate a separate display-only sweep. Pitch follows
the deck while supported, then retains departure angular velocity. First secondary deck contact stops before
proxy penetration (1 μm tolerance) with no invented ground impact. Supported pitch
is still guided: no tipping/contact moment solver or collision response. INVERT_RIG is shared
SI geometry. Seal loss at first body overhang switches suction/power off, without
seal recovery. Keep both contact-force limits, unchanged gas mass, fan electrical work
separate from external rig COM work/friction, finite CSV and worker/standalone parity.
Rig work includes body rotational energy with assumed uniform rectangular inertia;
deck inertia and motor efficiency are not modeled. First ground
contact stops physics; unresolved windows must not invent an impact. No publication
before user approval.

M7 maintenance: Turn has exactly two independent runs, indexed 0 (no fan) and 1
(fan), with separate turnFocus; do not index its result with Launch mode 2. Keep
turn.js in served and standalone builds. Config turnSpeed is m/s; turnSteer and
turnSweep are radians. UI converts km/h and degrees; CSV and shared values are SI.
The geometric bicycle requests curvature; the combined friction circle reserves
drive force before lateral force. Fan draw and drive load share the electrical
budget. Insufficient speed-hold power/grip stops explicitly at the initial state.
Undefined demand/capacity ratios are blank in CSV with a validity flag. Gas mass remains
unchanged; heat can change temperature/pressure. No Turn cold-gas thrust, driver correction or inter-car collision.
Road radius/sweep/width are independent of steering. Painted inner/outer edges
share geometry with the body-envelope lane-departure test. Conservative advancement
finds first departure independently of output sampling. Lane exit is nonterminal:
keep the same speed/curvature and continue onto visual grass until the whole body
crosses the exit gate or min(30 s, nominal corner duration + 2 s). An earlier lane
departure stays a failed corner even if the path re-enters. No solid barriers,
Turn wreck effects or terrain dynamics; grip/fan loads remain the same in runoff.
Keep departure time/side, finite per-case endpoints and CSV/worker parity.
Coincident poses show the selected car, without invented offsets.
Default camera follows the selected car; overview, focus, plots and sharing are
display state. Keep the trajectory SVG at a readable height, including on mobile.

M8/M9 maintenance: ui.js owns nonmodal parameter navigation and choice-key handling;
include it and tuning.js in served and standalone builds. The parameter workspace
sits beside the scene at desktop widths and below it on phones. Never restore a
blocking Tune overlay. Dispose bindings before remount; restore focus after presets.
Global playback keys never consume input/select, summary, button or plot-slider
keystrokes. Horizontal arrows in numeric fields retain normal caret behavior.
Navigating to Parameters and opening model documentation pause playback.
Render paused scenes only when dirty or resized; invalidate camera/orbit/zoom changes
and finish camera/damage animations. Always flush telemetry/audio at the last playback
frame before going idle. Keep physics time independent of render frequency. Rewind
and canvas 0 reset to the selected experiment camera. Tab changes preserve the
repeated Launch inventory; refill remains explicit. Focus changes refresh every
Launch plot, including the secondary force chart. Plot event markers always remain;
captions may be omitted to avoid overlap, with full event titles/buttons retained.
Final aesthetic, physical iOS and subjective sound review remain with the user.

M9 tuning: each experiment retains its own configuration and preset selection in
this session. Shared links export the active experiment only. Other experiments'
pressure/volume edits or presets must not refill the repeated-Launch inventory.
Sliders and editable numeric values share SI conversions; keyboard increments use
the displayed units. Valid parameter edits recompute while preserving/clamping the
paused time; explicit Replay starts at zero. Presets/defaults start at zero. Pending
or invalid inputs clear tuning outcomes and disable replay; silence audio immediately.
Summaries and previous-calculation differences come from solver results. Aggregate
rapid edits in the change label; distinguish small rounded changes from no change,
and do not subtract a lane-exit time from a successful corner-exit time. No-lift,
unsupported and time-limited runs cannot invent a successful landing. Keep automatic
landing controls hidden outside automatic mode. Physical iOS/touch, screen-reader
and subjective sound checks remain open; see impulse/docs/M9-REVIEW.md.


Thermal maintenance: heatTransfer is overall UA in W/K (0–2000, default 250),
heatSourceTemp is the imposed source temperature in K (250–350, default 293).
Qdot=UA*(Tsource−Tgas), signed positive into gas, and is independent of electrical
work. d(mu)/dt=Qdot−mdot*h0 applies while valves are open or closed. Add heat to
Launch, Hop and sealed Invert/Turn histories without changing mass. Links/CSV retain
thermal settings, signed heat rates and cumulative heat; warmer repeated inventory
above 293 K is valid if EOS-supported. Zero UA is the adiabatic regression limit.
Heated landing forecasts include coast heating and five actual ignition-energy
profiles with interpolation for the search; final displayed outcomes always use
the full thermal solver. Do not reuse the adiabatic open-time warp for heated coast.
Nozzle plots mask inactive flow instead of plotting placeholder exit states; CSV
includes nozzle_active. Nozzle exit=throat for this converging surrogate. Preserve
stagnation enthalpy, exact valve left/right limits and rejection of unsupported RK
stages. Sealed thermal steps must resolve m*cv/UA even for nearly empty shared
inventory. All component inputs remain assumptions, with no hardware validation claim.

Thrust delivery maintenance: valveRise (0-0.2 s), feedLoss (0-30% of gauge
pressure head) and expansionRatio (1-1.5 exit/throat area) default to 0/0/1 for
legacy trajectories. Apply the opening ramp at each actual ignition and use it
in burn forecasts. Closing is immediate. Feed throttling preserves stagnation
enthalpy. Bell expansion is choked/isentrope-only, with explicit throat-only
separation approximation for sub-ambient exit demand and property rejection for
unsupported cold states. CSV distinguishes command and actual opening. The new
Hop delivery preset and live valve/feed/jet strip must follow solver samples.


Showcase maintenance: showcase.js maps a 36-second presentation clock to existing
solver time, with endpoint holds and deterministic chapter/camera selection. Include
it in both build paths. Precompute the four independent example fills through the
same simulation client. Never consume or overwrite the user's repeated-launch tank.
Exit restores configuration, result, time, camera/orbit and tuning feedback; leave
playback paused. Cancelled preparation must never install a late result. Background
visibility pauses the tour; reduced motion starts paused and removes camera tweens.
The root UI is inert/hidden during the tour, with external accessible chapter,
pause, timeline and exit controls. Captions/results must follow solver output;
presentation time is explicitly distinct from simulation time. No automatic recording,
sharing or publishing. Preserve the older demo=1 Launch mode.

Brand maintenance: user-facing name is RoadsterLAB (exact case). Use it in the header, title, showcase, end card, documentation and CSV filenames. The canonical standalone is roadsterlab.html; impulse.html remains a compatibility alias. Keep existing repository/folder paths, Site identity and internal result/worker identifiers stable. Scientific uses of impulse remain valid.


Interaction maintenance: parameter ranges use their declared display increments;
numeric fields may retain step=any for deliberate precise input. Busy tuning keeps
the same heading/row/difference/clock geometry and shows -- instead of old values.
Reserve calculation-banner space; phone tuning summaries scroll normally. The vessel
callout uses Scene.annotateVessel at the actual transformed cylinder midpoint,
including floating Launch origin, body rotation/crush, Hop lift and Turn yaw. Refresh
it on every rendered frame and hide offscreen; keep its caption inside the viewport.
Wreck audio is an opt-in one-shot at forward playback completion for a supported
WRECKED Hop/Invert impact. Paused scrubbing, intact landings, model limits and Turn
runoff stay silent. End-of-run motion silence preserves the impact tail; explicit
pause/rewind/recompute/mute/visibility changes stop all audio. All one-shot nodes
must be stopped/disconnected and share the master gain and limiter.

Visual/audio palette: pearl white, lagoon teal and crimson car paint; lighter matching plot/label hues, graphite/teal UI, mint selection/replay and coral primary actions. Wreck audio uses a deterministic precomputed 1.55 s transient via synthesizeWreck; create the buffer on audio opt-in, preserve bounded peak/quiet tail, and reuse one-shot cleanup/gating. Avoid sustained tonal ringing.


Portfolio release maintenance: engineering.js owns the on-page equation/assumption
cards and author credit; the root README is the consolidated physics guide. Keep
it and docs/RELEASE.md aligned with the actual solver, especially EOS domain, heat,
nozzle enthalpy and contact/runoff limits. recorder.js uses a separate native WebGL
Scene plus 2D captions at canonical 1920x1080 / 1080x1920. Draw the source into the
composition in the same task as scene.render; never capture a cleared WebGL buffer.
Recording is an explicit silent real-time tour, with MP4 capability probing and WebM
fallback, a 30 fps target and cancellation on background/Exit. Stop tracks and dispose
the extra Scene on completion/error/cancel. Preserve saved user setup/inventory.
Include recorder.js and engineering.js in both served and standalone builds.
release.mjs stages unique ignored dist/release folders, source/docs and SHA-256
manifest; it never commits, tags, uploads or publishes. See docs/RELEASE.md.


Recorded audio maintenance (2026-10-20 user-requested revision): audio.js now owns
17 supplied ElevenLabs recordings, audio-assets.js catalog and pure audio-mapping.js
perceptual mappings. The user authorized continuous music across pause/mode switches;
this supersedes earlier pause-silence guidance for music only. Effects still stop on
pause/seek/recompute/background; hidden pages and silent video export silence both.
Music/effects volumes live in Tune and persist locally; fresh documents still need a
gesture. Preserve loop phase across remounts. Actual Invert alongV/contact enables
skid/surface sliding; Turn has no resolved tire slip, so saturation gets scrub only.
Do not invent collisions for runoff or ordinary landings. Only supported WRECKED
Hop/Invert ground contacts fire minor/major recordings, with the speed split explicitly
perceptual. Build both served WAV assets and standalone embedded data URLs. Originals
and derived audio must stay local while assets/audio/RIGHTS.json remains unconfirmed;
Pages runs scripts/check-audio-rights.mjs; local staging records a rights notice. See docs/AUDIO.md.

Audio rights confirmation (2026-10-20): the user confirmed their ElevenLabs Creator
plan and full ownership/licensing rights for the supplied sounds. RIGHTS.json now
records this confirmation and the audio-specific deployment check passes.
Publication remains a separate project action; no audio update was published by
recording this confirmation.


Workspace revision (2026-10-20, explicit user request): Parameters are hidden on
initial load. The nonmodal button toggles the desktop side column; phones reveal
an inline panel below the scene. ui.js owns hidden/expanded state, close/Escape,
focus return and listener disposal. Keep panel state across preset remounts, pause
when opening, close on Replay, and preserve configuration/inventory on toggles.
Transport belongs immediately after the scene, above telemetry. Closed desktop
layout uses the full scene width. No blocking overlay or focus trap.

Sound now defaults on per user request, superseding the former opt-in default.
Attempt automatic startup only when the context is already allowed to run; otherwise
resume on the first real pointer/key gesture. Distinguish wantedEnabled intent
from actual running enabled state. v3 preferences remember explicit mute; migrate
legacy volumes without importing the old off-by-default policy. Sound toggle must
still mute while waiting for autoplay permission. Keep pause/visibility/export
lifecycle and sample-based mappings unchanged.


Plume/access revision (2026-10-21): keep the large labeled Parameters control beside
Launch/Replay and the larger top-bar target. scene.js coldGasVisual gates white
cores/clouds on actual delivered flow AND thrust. Camera-facing particle seeds and
motion use simulation time so pause/scrub is deterministic. Hop ground spread is a
height-limited artistic effect, omitted in underside inspection; cutoff clears it.
Never present visible condensation, jet size/speed or pad interaction as calculated
fluid results. Preserve four HOP_MOUNTS and unchanged solver effective area. Hop
tracking leaves jet context beneath the car without valve-edge camera jumps.
See impulse/docs/PLUME-REVIEW.md for local verification and open device checks.

Turn showcase revision (2026-10-21): Corner overview uses a closer default zoom.
Showcase examples use turnSweep=120 degrees in radians, while the normal editable
Turn default stays unchanged. Optional turn.reveal is display state: smoothly fit
both live car envelopes at the beginning, then pull back to the full road/runoff
bounds. Keep the no-fan car included; do not invent offsets at coincident poses.
Use the same reveal in the interactive tour, recorder and publication studio.

Repository rename / publication audio (2026-10-21): canonical repository is
Albert-Gil/RoadsterLAB and Pages path is /RoadsterLAB/. Keep workspace/folder paths,
Site identity and internal simulation identifiers unchanged. recorder.js accepts
an optional audioStream, clones its tracks and probes audio-capable codecs. The
LinkedIn studio supplies a private SimulationAudio master/limiter stream with music
and sample-driven effects, ending cleanup and background cancellation. Its audio
request supersedes the earlier silent-publication-video direction. General exports
without an audio stream remain silent; never capture a microphone or system audio.


M10 maintenance (2026-10-26, user-requested UX/graphics pass): reveal.js grades
predictions only from solver results; unresolved states stay ungraded. Veil outcome text
with data-spoiler until the setup's revealKey is marked (run end, scrub to end, Skip) or
Parameters is open; demo/capture/showcase never veil. Plots ghost the future only as
display state. The Launch director (camera 'cinema', default unless reduced motion) must
stay a pure function of simulation time; kick/shake/flash/dust are skipped for reduced
motion. Tire/scrub marks follow TRACTION LIMITED / GRIP LIMITED samples only. The ready
frame (t=0, paused) hides jets and shows READY / VALVE CLOSED; physics samples are
untouched. Scene.render = renderScene + optional bloom/vignette (`?post=0` disables); keep
new render state optional so CI mocks without a GPU still pass. Keep experiment floors
above the coastal plane (-0.12 m) and the distance-scaled near plane; do not add a
polygon offset to floors (its slope term hid roads/pads on real GPUs), keep road/pad layers
at least ~1 cm apart, and draw the Launch floor back past the start line. Self-hosted fonts
and reveal.js are in both build paths; served audio prefers assets/audio/compressed
(regenerate with scripts/encode-web-audio.py) and falls back to WAV; the standalone keeps
embedding WAVs. CSS: one :root token block and an 11 px type floor; add new rules to the
M10 block rather than another override layer. See impulse/docs/M10-UX-REVIEW.md.
