# M11 — Live physics panel, shadows and visualization pass (2026-10-27)

Requested by the user: fix the phone status-pill overlap, develop live physics overlays
"with a way to switch back", and improve graphics and visualization in general.
Physics trajectories, events, CSV columns and worker/standalone parity are unchanged.

## How to switch back
- **Physics** toggle in the scene toolbar (beside Cutaway and Forces). Off restores the
  M10 view: no panel and no previous-setup ghost. Remembered per browser
  (`localStorage roadsterlab.overlay`); `?overlay=0` or `?overlay=1` overrides.
- **Graphics quality:** `?quality=high|medium|low` pins it (high = shadows 2048 + bloom,
  medium = shadows 1024 without bloom, low = neither, 1× pixels). Without the parameter the
  page starts at high and steps down one level when playback averages below ~32 fps.
  `?shadows=0` and `?post=0` disable each pass individually.
- **Git:** this pass is a separate commit on `m11-visual-physics`, on top of
  `m10-ux-graphics`.

## What changed
### Live physics panel (`src/overlay.js`, display only)
Built from the current solver sample, never from future outcomes, so it is safe before reveal.
Bars use one run-wide scale per result (no frame-to-frame rescaling).
- **Launch / force budget:** delivered tire force with its two ceilings (grip limit μN and
  motor limit), cold-gas thrust, drag + rolling resistance, net acceleration and the binding
  limit. The solver now records `traction`, `motor` and `resist` on Launch samples; these are
  values `forces()` already computed (tire = min(traction, motor)), so trajectories are
  identical. They are not CSV columns.
- **Turn / friction circle:** both cars. Radius = μN (from `capacity` and the reserved drive
  force), dot = lateral force actually used, × = requested lateral force when it lies outside
  the circle; requested/available ratio per car.
- **Invert / contact budget:** friction needed along the deck against μN, normal load,
  suction, weight, utilization and held/sliding/no-contact state.
- **Hop / thrust–weight:** thrust against weight (with the weight line), T/W, altitude,
  vertical speed and valve opening.
- Hidden while the stage card shows, while docked, while recalculating and in the showcase.
  Phones show a one-line summary.

### Visualization
- **Timeline event markers** on the transport (Launch: valve open/close and each car's
  0–100 km/h or 0–60 mph; Hop, Turn, Invert: their solver events). Outcome markers appear
  once playback reaches them, or all at once after reveal; click to jump.
- **Previous-setup ghost** (Launch focused car, Hop): after a parameter change or a repeat
  launch, the previous calculation runs as a translucent car labelled "Previous setup".
  Part of the Physics aids; cleared on mode/preset changes.
- **Turn path trails** up to the current time, coloured by requested grip / capacity
  (mint < 0.85, amber < 1, coral ≥ 1); the run-off portion is fainter.
- **Turn Corner framing** fits the actual road edges, pads and both paths, turns the camera
  across the road's long axis on entry, and centres the result.
- **Force arrows** are 3D (round shaft and cone head) in every experiment.
- **Launch labels:** distance labels that would sit under a car label are hidden.

### Graphics
- **Real-time sun shadows:** an RGBA-packed depth map from the low sunrise sun around the
  camera focus (orthographic, texel-snapped), softened with 8-tap PCF. Cars, rigs, pads,
  boards and posts cast; floors, sky, glass, plumes, ghosts, distant scenery and paint-thin
  decals do not. The earlier analytic car shadows remain outside the map and as contact
  shading. The frame is recorded once and replayed after the shadow pass.
- Adaptive quality as above.
- Fixed: legacy ghost cars referenced undefined `GHOST`/`ghostColor` (would throw with
  `compare=1`).

### Layout fixes
- Phone status pill ("Recalculating…") now sits above the view tools instead of over the
  run label/car labels.
- 1100–1399 px: secondary top-bar actions are icon-only, so mode tabs no longer collide with
  "Sound on" (seen at 1280 px).
- Narrow scenes (container query ≤ 820 px, e.g. Parameters open on a laptop): icon-only view
  toggles and no drag hint, so Cutaway/Forces/Physics never overlap the zoom buttons.

## Verification (headless Chromium + SwiftShader, local build)
- `node --experimental-strip-types --test tests/*.test.*`: 158/158 (154 + 4 new: Launch
  diagnostics equal the solver limits and reproduce acceleration; friction-circle geometry;
  Invert/Hop budgets; shadow-caster filter and texel-snapped light matrix).
- Browser functional script: panel hidden under the stage card and visible mid-run; valve
  markers only before reveal, reached markers during playback, all after reveal; marker click
  jumps to its time; toggle hides and persists across reload; `overlay=0`; ghost appears after
  a parameter change and hides with Physics off; panels in all four modes without NaN;
  `quality=low` disables shadows and bloom; shadow pass active at high; WebGL error 0; 360 px
  toolbar fits; no page errors.
- Layout audit at 1440, 1280, 1100 (+Parameters), 834, 390, 360: no overflow, no text
  under 11 px, no toolbar/hint/zoom overlap; timeline markers are 24 px wide.
- Screenshots: impulse/share/m11-20261027/.

## Still open
- Real-GPU look and cost of the shadow pass (SwiftShader frames are slow; the adaptive step
  is there for phones), and physical phones.
- Aesthetic sign-off on the panel placement (it can cover a car at the bottom-left; the
  toggle switches it off) and on the long sunrise shadows.
