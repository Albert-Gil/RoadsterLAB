# IMPULSE development milestones

Status: M1/M2 complete. Real-gas EOS (tabulated dry air, 400 barg default) inserted before M3; hold M3 Launch comparison until this physics milestone is accepted. No publication until user approval.
Each milestone must pass engineering checks, interaction checks and visual review.

| Milestone | Deliverables | Acceptance |
|---|---|---|
| M1 Foundations | 1x; 600 L; (later revised to 400 barg with real-gas table); absolute solver units; legacy share links; scenario colors | Conversion, inventory, corner cases and convergence pass; browser controls reflect defaults |
| M2 Interface and identity | Unobstructed scene; telemetry strip; tuning drawer; analysis area; improved materials, lighting and shadows | Desktop/mobile readable; user reviews visual direction |
| M3 Launch comparison | Three simultaneous cars; position, velocity, acceleration plots; hover, scrub, toggles; road markers | Plots and animation agree; consistent assumptions and meaningful separation |
| M4 Blowdown and sound | Tank cutaway; pressure, temperature, mass, flow, thrust; valve markers; refined audio and volume | Depletion explains thrust; repeat/refill and audio lifecycle work |
| M5 Hop | Height/velocity-driven animation; altitude ruler; trajectory/apex; tracking camera | No altitude clamp; parameter changes change trajectory; touchdown and no-lift cases work |
| M6 Invert | Attachment, sliding, detachment, gravity-driven fall, impact and wreck | Failure follows contact/friction; finite platform; seal loss removes suction; destruction explicitly cosmetic |
| M7 Turn | Constant commanded speed and steering angle; fan/leak inputs; limited-grip bicycle model; no-fan/fan comparison; barriers | Trajectory-driven crashes; both-success/both-failure cases; overhead oblique camera and grip/trajectory plots |
| M8 Integration | Unified controls and cameras; responsive polish; performance; documentation | Numerical and browser checks; consistent units; user approves final experience |

## Decisions
- Turn angle means front-wheel steering angle. Track corner sweep is separate.
- Scenario colors: electric pearl/slate, fan cyan, thrust orange-red; keep names and line styles too.
- Hop may use disclosed constant display scaling per run; never clamp motion.
- Invert/Turn wreck effects are not structural impact simulations.
- Constant Turn speed is an idealized controller, disabled on impact.
- Live solver uses tabulated real dry air; ideal-gas formulas are no longer the live path.
- First complete showcase is M3 + M4; do not expand scope to publishing yet. M3 held until real-gas work is accepted.


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
