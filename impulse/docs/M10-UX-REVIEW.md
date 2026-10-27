# M10 — UX, graphics and delivery pass (2026-10-26, local)

Requested by the user ("proceed for all of them") after a UX/UI and graphics review.
Physics, solver outputs, CSV columns and worker/standalone parity are unchanged.
Nothing was committed, pushed or deployed.

## What changed

### Layout and flow
- **Stage first.** Mode tabs moved into the top bar; the page heading is one compact
  row; the scene height follows the window. The Launch/Rotate/Fire/Run button is now
  inside the first screen at 1440×900, 1366×768, 834×1112, 390×844 and 360×740
  (it was at 1026 px on both laptop sizes and 869 px on a 844 px phone).
- **One camera control** at the top right of every scene (Launch: Director, Overview,
  Side, Focus car, Auto frame; Invert: Whole rig, Track car; Hop: Envelope, Track car,
  Thrusters; Turn: Corner, Follow car). The old per-mode toolbars above the scene are gone.
- **Predict, then reveal.** Before a setup has been played to its end, a stage card asks
  one question (Launch: thrust-assisted 0–100 km/h band; Invert: holds or comes off;
  Hop: lands intact or wrecked; Turn: which cars clear). Outcome text (result card,
  predictions, milestones, landing/rotation summaries, event times, comparison bars,
  Turn plan view) is veiled until the run reaches its end, the viewer chooses "Skip the
  guess", or Parameters (explore mode) is open. Answers come only from solver results
  (`src/reveal.js`); unresolved model states stay ungraded. Demo, capture and showcase
  never veil.
- **Progressive plots.** Kinematic, vessel and Turn traces draw up to the playhead;
  after reveal the remainder is shown as a ghost.
- **Analysis tabs** (Kinematics / Pressure vessel / Force delivery, per experiment)
  replace the long stack; Launch kinematics are three small multiples on wide screens.
  Desktop page height fell from about 5,380 px to about 2,990 px.
- **Docked mini player.** When the scene scrolls away mid-run, it docks bottom-right
  (one WebGL context, no second renderer) with "Back to the scene" and close.
- **Declutter.** Camera/zoom/cutaway/hint controls fade during playback and return on
  hover, focus or tap. The drag hint disappears after the first drag (remembered per
  browser). The scenery tag moved to the footer.
- **Cutaway/Forces** now move to the close camera when the current view is an overview,
  restore it when both are off, and show a clear checked state.
- **Units.** SI leads (0–100 km/h). A km/h ⇄ mph toggle in telemetry switches readouts,
  milestones, lane stats, tuning results and the velocity plot (remembered per browser;
  `units=` in share links). Physics and CSV remain SI.
- **Vessel panel** reads "READY / VALVE CLOSED" before playback instead of
  "VALVE OPEN / DISCHARGING"; jets are likewise hidden in the ready frame.

### Typography, tokens and targets
- Inter (variable) and JetBrains Mono are self-hosted (`assets/fonts/`, OFL-1.1) and
  embedded in the standalone page. Before, Inter was named but never loaded.
- One `:root` token block (the three earlier blocks were merged), a type scale with an
  11 px floor (about 150 declarations at 5–10 px were raised), 41 dead rules removed and
  the restyled components (top bar, tabs, heading, scene HUD) consolidated into one block.
- Tap targets: phone header icons 40–44 px, Show toggles 22 px boxes inside 40 px labels,
  CSV/links ≥ 32 px, timeline hit area 28–40 px with a visible 4 px track.

### Graphics (existing dependency-free renderer)
- **Launch director** (default unless reduced motion is set): low rear three-quarter
  start, side tracking shot, then pull-back. Shot weights are a pure function of
  simulation time, so pause/scrub/replay match. A short camera kick and field-of-view
  punch at boost onset are skipped for reduced motion. Drag/zoom still apply as offsets.
- **Trackside cues:** distance boards every 50 m with readable labels, edge posts every
  10 m, wheel-speed blur discs, colour beacons that keep distant cars findable in wide shots.
- **Ground:** rubber marks only while the solver reports TRACTION LIMITED (Launch) and
  scrub marks only while GRIP LIMITED (Turn); a gravel shoulder softens the Turn road edge.
- **Finishing pass:** quarter-resolution bloom on bright highlights plus a gentle vignette,
  added on top of the MSAA frame (`?post=0` disables it). Recorder videos use it too.
- **Events:** touchdown dust ring (bigger for a wreck), brief impact shake and a red
  viewport flash for wrecked Hop/Invert impacts (all skipped for reduced motion).
- **Rigs:** Hop pad ring, H marking, hazard edging and low deflector curbs; Invert
  A-frame legs, hazard base, a hydraulic actuator tied to the solved platform angle, and a
  protractor with a needle plus a θ label.
- **Bug fix:** experiment floors could lose a depth test against the kilometre-scale coastal
  plane, so cars sometimes appeared to sit on sand (visible in the earlier phone capture).
  The coast now sits 12 cm lower and the near plane scales with framing distance.
- **Follow-up fixes after the first check on Albert's PC (Windows, real GPU):** a polygon
  offset that had been added to the experiment floors grew with distance and viewing angle,
  so floors covered thin surfaces above them: the Turn asphalt vanished in the Corner view
  and far along Follow car, and the Hop pad markings vanished in the Envelope view. The
  offset is removed (the lower coast and near plane already prevent the sand problem) and
  the Turn shoulder sits 12 mm below the asphalt. The Launch floor was drawn only from about
  70 m behind the slowest car, which the wider cameras and distance boards exposed; it now
  always reaches back past the start line, and boards/labels start at 0 m.

### Delivery
- Served audio: Opus (about 0.96 MB) or AAC (about 1.44 MB) instead of 11.3 MB of WAV,
  with per-file WAV fallback. See `docs/AUDIO.md`. The standalone page still embeds WAVs.

## Verification (headless Chromium + SwiftShader, local build)
- `node --experimental-strip-types --test tests/*.test.*`: **154/154 pass** (148 existing,
  updated Turn upload count for the shoulder mesh, plus new reveal/units/director,
  compressed-audio and standalone-font checks). `node --check` on all dist modules.
- Functional browser script: veil at start, stage card states, HUD fade/return, dock and
  undock, reveal at end and after rewind, re-veil after a parameter change, units toggle,
  analysis tabs, vessel ready state, cutaway close-up/restore, orbit-hint dismissal,
  keyboard mode switching, Invert θ label, WebGL error 0, bloom active, Opus requests
  only, showcase start/exit, reduced-motion overview camera, no page errors.
- Layout audit at 1440, 1366, 1024, 834, 390 and 360 px (start, Parameters open, revealed):
  no horizontal overflow, no text below 11 px; remaining contrast flags are gradient
  buttons the audit cannot measure.
- Video export starts with the bloom pass and no errors (recording not completed here).
- Follow-up: the reported views were reproduced in SwiftShader before the fix (Turn Corner
  all grass, Hop pad missing) and re-shot after it (Turn Corner and Follow car, Hop Envelope,
  Launch Overview at 5.51 s with the start visible, 390 px Launch start with no sand,
  Invert rig); 154/154 tests. Real-GPU confirmation is with the user.

## Still open
- Real GPUs: frame rate with bloom on phones, and the look of bloom/vignette on a real
  display (SwiftShader frame timing is not representative).
- Physical iOS Safari/Android, VoiceOver/TalkBack, and Safari/Firefox decoding of the
  compressed audio plus subjective listening.
- Aesthetic sign-off on the director shots, beacons, pad/rig dressing and the
  predict-then-reveal copy.
