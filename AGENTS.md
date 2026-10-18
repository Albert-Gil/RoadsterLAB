# TRoadster / IMPULSE

## Purpose and priorities

Build IMPULSE, an interactive engineering portfolio project inspired by the redesigned Tesla Roadster. Prioritize a striking visual experience, intuitive interactions, and meaningful simplified physics. This is an independent exploratory simulator, not a validated Tesla digital twin.

The approved direction combines Launch, Invert, Hop, and pressure-vessel Blowdown. Launch + Blowdown is the first polished milestone. Invert and Hop reuse shared physics; finish and verify the main experience before expanding scope.

## Repository layout

- This directory is the Git repository root. The application lives in `impulse/`.
- `impulse/src/physics.ts`: pure simulation functions, SI units, configuration and results.
- `impulse/src/scene.js`: native WebGL renderer and original procedural vehicle geometry.
- `impulse/src/app.js`: UI, controls, playback, plots, exports and shareable presets.
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
node --experimental-strip-types --test tests/physics.test.ts
node --check dist/app.js
node --check dist/scene.js
```

The server uses `http://127.0.0.1:4173`. The build also emits `dist/impulse.html`, which can be opened directly in a browser without a server. Stop task-owned preview servers when finished unless the user needs one left running.

Retain the dependency-free approach unless a concrete requirement justifies changing it. The original React/Three.js proposal was replaced after dependency installation failed in the environment. Do not assume those frameworks are installed.

## Engineering rules

- Use SI units internally; convert only for display. Pressure inputs are absolute.
- Clearly separate sourced manufacturer claims, reported details, modeling assumptions and calculated outputs. All current numerical vehicle inputs are illustrative assumptions.
- Never silently tune unknown parameters to match a Tesla acceleration claim. Do not mix the 2017 concept specifications with later announcements.
- Keep physics independent of rendering and playback speed. Use deterministic runs and event interpolation for speed milestones.
- Maintain mass and energy consistency in tank discharge. Include both choked and unchoked flow and the pressure contribution to nozzle thrust.
- Respect traction, torque, available power and axle-contact limits. Fan power counts against the shared electrical power budget.
- Document model validity limits and stop or explicitly flag unsupported states rather than hiding them.
- Preserve gas mass and temperature across repeat launches. Refill must be an explicit action.
- Do not describe schematic airflow or effects as CFD results.

Current limitations: ideal-gas adiabatic blowdown, no regulator or real-gas equation of state, quasi-static rear-drive load transfer, fixed aerodynamic coefficients, no detailed suspension or tire model. Invert evaluates a prescribed pose and does not simulate falling or sliding. Hop is vertical-only with ballistic return; it has no attitude controller, landing burn or impact dynamics. Preserve these disclosures until the corresponding models actually change.

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

Report exactly what was verified. Passing numerical tests does not establish visual correctness or validation against Tesla data. A Cursor-browser pass on desktop (~766px) and 390px mobile emulation was completed 2026-10-18 (tabs, playback, cutaway, Invert sweep, Hop remount, zoom controls, rewind, WebGL getError). Physical iOS Safari and a verified public URL remain outstanding.

## Source, deployment and collaboration

- Inspect Git status before editing; preserve user changes and unrelated files.
- Keep credentials out of source, logs, shell arguments and commits. Do not overwrite or force-push history.
- Reuse the existing Site identity in `impulse/.openai/hosting.json` (`appgprj_6ad529f9afc48191b5bb6ed5f791fb24`). Source publication previously failed because the Git hosting endpoint could not resolve; do not link a live URL until republish succeeds.
- If publishing through Sites, follow its current workflow, preserving this root repository. Do not create duplicate Sites or silently replace the root Git history to satisfy a helper's checkout assumptions.
- The app's current Library HTML and source ZIP are exports. When the user requests an update to an existing Library file, rebuild and replace that same Library identity rather than creating duplicates.
- Prefer small, coherent changes. Keep engineering documentation aligned with behavior. Summarize changes, verification, and remaining limitations when handing work back.
