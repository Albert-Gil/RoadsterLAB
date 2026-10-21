# RoadsterLAB release preparation

This guide covers local packaging and GitHub Pages release preparation. The
verified candidate includes the complete technical documentation. The user explicitly
approved uploading its source/screenshots, committing to the public repository and
updating GitHub Pages on 2026-10-20.

On 2026-10-21 the user approved proceeding with the finished scenery/audio,
parameter-access and plume update, GitHub Pages publication and fresh portfolio
clips. Social posting remains excluded. The release comparison preserves existing
main history and leaves the physics source unchanged. The candidate passes 148
automated checks; current visual/access evidence is in PLUME-REVIEW.md.

## What travels with the release

- Static website and self-contained `roadsterlab.html` (plus `impulse.html` alias).
- Source snapshot with build scripts, tests and documentation.
- Root [README](../../README.md): the complete physics guide, equations, default
  assumptions, numerical methods, usage and limitations. Include it in both the
  web and source folders; do not strip the technical sections for a portfolio cut.
- On-page **How the model works** cards, author credit and source link.
- Procedural Starbase-inspired scenery (`scenery.js`) in both build paths. The
  rocket, tower, buildings, shore and sunrise are original decorative geometry
  and shading, not an accurate site reconstruction or additional physics model.
- [Release notes](RELEASE-NOTES.md) and a SHA-256 artifact manifest.
- Optional landscape/portrait clips downloaded from Showcase. Keep these outside
  the source snapshot; review the recorded results and captions before posting.

## Physics that must remain explicit

| Subsystem | Governing model | Principal assumption / limit |
|---|---|---|
| Launch | `M dv/dt = F_tire + F_jet − D − F_roll`; tire force capped by rear friction, 42 kN drivetrain surrogate and available electrical power. | Quasi-static axle loads, fixed aero; no transient tire or suspension model. |
| Fan | Fan/leakage-curve intersection; `F_fan = Δp A`, `P_fan = Δp Q / η`. | Assumed fan/seal geometry; fan draw shares the electrical budget. |
| Vessel | `dm/dt = −ṁ`; `d(mu)/dt = UA(T_source − T_gas) − ṁ h₀`. | Fixed-volume, well-mixed gas; imposed reservoir, no finite wall thermal store. |
| Gas EOS | Consistent Peng–Robinson dry-air approximation; `h = u + p/ρ`, matching energy/entropy derivatives and sound speed. | Conservative 140–2000 K domain; explicit constant ideal-cp continuation below 200 K. No phase change or reference-EOS validation claim. |
| Nozzle | Isentropic enthalpy drop, sonic choking or unchoked ambient exit; `F = ṁ v_e + (p_e − p_a) A_e`. | Cd 0.9; optional prescribed valve rise, isenthalpic feed loss and bell ratio 1–1.5. Separated bell uses throat-only approximation; no shocks/CFD. |
| Hop | `dy/dt = v_y`, `M dv_y/dt = F_jet − Mg`; shared ascent/landing inventory. | Level, vertical-only car. Automatic/manual predictions use the final full trajectory. Wreck threshold is cosmetic, not structural certification. |
| Invert | Prescribed quintic rotation; `N = F_fan + M(g cosθ + qα + 2q̇ω − hω²)` and tangential friction balance. | Guided supported pitch, finite deck/seal, inherited departure spin. Secondary deck contact is a model-limit stop, not a collision solution. |
| Turn | Geometric bicycle curvature capped by `sqrt((μN)² − F_drive²)/(Mv²)`. | Constant speed/curvature. Lane departure continues onto visual grass with unchanged grip; no barriers or transient drift solver. |
| Numerics | RK4 at default/max 2 ms for integrated vehicle motion; analytic supported limits/paths, valve splits, bracketed contact events, rejected unsupported states. | Stored SI traces feed workers, plots and WebGL interpolation. Software verification is not experimental validation. |

The README expands every row with equations and constants. Display pressure is
**barg**, internal pressure absolute; Turn angles are radians internally. Rendering,
plumes, damage and conceptual sound must never be described as CFD, FEA, or measured
Tesla behavior. All current hardware/performance inputs are illustrative assumptions.

## Build and verify

From `impulse/`, using Node 24+:

```sh
node scripts/build.mjs
node --check dist/app.js
node --check dist/recorder.js
node --experimental-strip-types --test tests/*.test.*
node scripts/serve.mjs
```

Inspect desktop and narrow layouts. Exercise the four experiments, parameters,
scrubbing, cutaway label, opt-in wreck sound, retained Launch inventory and CSV.
Open the on-page model cards and confirm equations wrap without horizontal overflow.
Open `dist/roadsterlab.html` directly to check the offline worker/build path.

## Record the portfolio clips

1. Choose **Showcase → Export video**.
2. Choose **Landscape · 1920 × 1080** or **Portrait · 1080 × 1920**.
3. Leave the tab visible for the approximately 36-second tour. The clip is silent
   and includes author credit, chapter captions, solver results and a physics line.
4. Download the completed file before exiting the tour. MP4 is preferred when the
   browser supports it; WebM is the fallback. Frame rate targets 30 fps, with actual
   delivered frames dependent on the browser/GPU. No physics depends on frame rate.
5. Inspect duration, dimensions, all four chapters and text legibility. Confirm the
   final Turn frame is present. Cancel/background/Exit abort capture safely.

The recording uses a separate renderer at a fixed composition size. Normal browser
resizing does not resize the encoded frame. Exit restores the saved experiment,
configuration, simulation time and inventory. Physical-device/browser support must
be checked separately; do not promise universal MP4 recording support.

## Stage packages

```sh
node scripts/release.mjs
```

The helper rebuilds and creates a unique folder under `dist/release/`, containing
`web/`, `source/`, `START-HERE.txt` and `SHA256SUMS.txt`. It copies explicit project
folders, not `.git`, credentials, hosting identity, dependencies or earlier releases.
It does not delete prior candidates, commit, tag, push or publish. SHA-256 covers
every staged file except the manifest itself. Archive the candidate folder with
your platform's ZIP utility if needed. Keep downloaded clips as separate media
assets; if added to a candidate, regenerate a separate media checksum record.

## Current local evidence and remaining review

2026-10-20: actual H.264 MP4 recordings completed at **1920×1080** and **1080×1920**,
approximately **35.7 s**, around **25 delivered fps** on this machine. Decoded sample
frames show the vehicle, captions, results, author credit and physics line. The
30 fps setting is a target, not a guaranteed measured frame rate.

Desktop and 390 px browser emulation, generated standalone parsing, served/standalone
solver parity and the automated suite are local checks. Physical iOS/touch,
assistive-technology navigation and subjective sound review remain open. There is
no hardware/reference validation claim. Final aesthetic and publication review
remain with the author.

After approval, review the complete Git diff, commit the intended source changes,
and use the existing GitHub Pages workflow. Confirm the deployed page and actual
artifact URLs before announcing the release. No new deployment identity is needed.


## Supplied audio redistribution gate (2026-10-20)

The user confirmed Creator-plan ownership and licensing rights for the supplied
library on 2026-10-20. `assets/audio/RIGHTS.json` records the confirmation;
`node scripts/check-audio-rights.mjs` passes. Pages retains this check, and local
release staging records the rights status in START-HERE.txt. Publication remains
a separate project action. See [AUDIO.md](AUDIO.md).
