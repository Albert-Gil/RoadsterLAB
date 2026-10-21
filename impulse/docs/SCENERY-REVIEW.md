# Starbase-inspired scenery / local review, 20 October 2026

Implemented the sunrise art direction as native WebGL geometry and procedural
shading. It is an original artistic arrangement, not an accurate SpaceX site model.
The earlier AI concept images are references, not screenshots of the application.

`src/scenery.js` batches a static rocket, lattice/catch tower, cryogenic tanks,
pipe racks, hangars, test outpost, coastal marsh and water into thirteen material groups
(86,979 vertices after the polish pass). CPU geometry is cached across Scene instances; GPU buffers are
created/disposed with each Scene. The sky is generated in the fragment shader,
with sunrise/cloud lighting also used for analytic material reflections. No image
textures, remote assets, dependencies or generated AI imagery enter the runtime.

The campus remains fixed in world coordinates while Launch uses its floating
origin. The sky follows the camera. Vehicle fit still uses only solver-derived
car/rig bounds; scenery cannot change solver state or framing scale. The dedicated
Hop underside camera omits coastal ground surfaces. World labels use a stable
three-column row on phones and search for clear space on larger canvases. Scene
heading/readout plates keep text readable against the bright sky.

Both served and standalone builds include the scenery module. Showcase and its
separate recording Scene inherit the same setting. The initial pass did not record
a new video. The polish pass below checks fresh exports. Nothing was published.

## Verification

- Full automated suite: 130/130 passed, including standalone worker parity across
  the experiments and two scenery checks. After the last geometry/underside
  repairs, the nine focused scene/scenery tests passed again.
- Rebuilt final served/standalone artifacts; checked app, scene and scenery JS
  syntax. The standalone's embedded bundle is parsed by the build itself.
- Native browser captures: Launch start and 4 s separation, Turn, powered Hop and
  rotating Invert at 1120×630 and 390×420 CSS sizes; four additional desktop
  cutaway/force captures. All 14 captures returned WebGL getError 0.
- Actual app: tab changes, playback/pause, end scrubbing, camera changes, cutaway,
  forces, repeated Launch, CSV download and unobstructed Hop underside inspection.
  The 390px app iframe confirmed responsive layout and separated Launch labels.
- All four Showcase chapter controls displayed this setting. Exit restored the
  regular experiment. The self-contained roadsterlab.html loaded and calculated
  successfully when served locally (a physical file:// Safari run is not claimed).
- `physics.ts` SHA-256 matches the pre-scenery reference stored in the exploration
  manifest. No physics source was edited during this implementation.

Screenshots/metadata: `../share/scenery-20261020/implemented/`. The final Showcase
and phone screenshots include the actual interface. The QA page under ignored
`dist/` uses stored solver traces from the preceding visual package.

## Remaining review limits

The procedural artwork is intentionally lighter than the aspirational concept
images. Physical phone/GPU performance, iOS Safari, assistive technology and final
user visual review remain open. Per-capture CPU submission times are diagnostics,
not GPU frame rates. Coast/grass/water appearance does not change grip or add
terrain, collision, wind or rocket physics. No precise real-site dimensions or
optical/hardware validation is claimed. The public site has not been updated.

## Visual polish / 21 October 2026 UTC

The second pass adds linear-light surface shading, a GGX-style roughness response,
filmic display mapping, broad cool fill opposite the warm sunrise, stronger clear
paint/glass reflections and directional soft projected shadows. Shadow heights
come from the stored Hop/Invert pose. These remain artistic optical approximations.
Road aggregate is filtered by screen footprint; concrete has slab joints. Dunes
and planted grass stay outside the experiment envelope and clear of foundations;
a continuous meandering tidal channel replaces disconnected water patches.

Launch overview elevation increases smoothly with actual visible-car separation.
Auto-frame off freezes the automatic lift/origin while retaining manual orbit.
Turn's following camera is lower, with the full-corner overview still available.
The tests include finite terrain/normal and clearance checks, initialized shadow
heights, and frozen-framing/manual-orbit behavior. The full suite passed 132/132.

The existing desktop app telemetry reported 80.6 fps and 3.19 ms average render
submission at a late Showcase sample on this host. This is one observed window,
not a full-tour GPU benchmark or a physical phone result. Polished captures and
video-verification frames live in `../share/scenery-20261020/polished/`; full QA
videos stay under ignored `dist/scenery-polish-review/videos/`.

Video QA also exposed a recording cadence issue: restarting a 33.3 ms delay after
each draw loses fractional RAF time. `recordingFrameTime` carries the remainder
across frames, targets 30 fps on 60/80/120 Hz displays, and skips missed slots
without burst catch-up draws. The check covers these rates and stalled callbacks.
This changes recording scheduling only; simulation/presentation time remains
elapsed wall time and paused/visibility/cancellation behavior is unchanged.

Where supported, recording now uses `captureStream(0)` and requests a frame only
after the full composition has been drawn, including the already composed first
frame after the encoder starts. Browsers without `requestFrame` retain automatic
30 Hz capture; the abandoned initial track is stopped before fallback. Track
cleanup and both capture paths have focused tests. API behavior follows the
[captureStream](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/captureStream)
and [requestFrame](https://developer.mozilla.org/en-US/docs/Web/API/CanvasCaptureMediaStreamTrack/requestFrame)
documentation. This targets completed-frame capture, not guaranteed encoder speed.

Final polish verification: **134/134 tests passed** (29.10 s), final served/standalone
builds parse, and app/scene/scenery/recorder syntax checks pass. Twenty captures
cover wide and 390px Launch start/separation, Turn overview/follow, powered Hop,
underside/apex, rotating Invert, and cutaway/force states; every capture reports
WebGL error 0. Actual 390px app layout and served standalone playback were checked.
The new geometry has finite outward normals and remains under 100k static vertices.

Final H.264 exports decode without diagnostics and have strictly increasing frame
timestamps: landscape 1920×1080, 953 frames / 35.7393 s (**26.67 fps**); portrait
1080×1920, 1022 frames / 35.710567 s (**28.62 fps**). In these runs the encoded
frame counts match completed composition counts. The 30 fps target is not yet
reached consistently on this host. These files are real-time/VFR exports, so
decoded frame count / duration is the observed rate, not an assumed constant FPS.
Cancellation left zero recording surfaces; the regular tour remained usable.
Final video metadata is in `polished/video-verification.json`; full test recordings
stay in ignored `dist/scenery-polish-review/videos/`.

`physics.ts` is byte-identical to the pre-polish implementation. Physical iPhone,
touch/assistive technology and final user visual approval remain outstanding.
No commits, pushes, deployments or social posts were performed.
