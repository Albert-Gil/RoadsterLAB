# RoadsterLAB launch package

Author: Albert Gil-Esmendia

Live lab: https://albert-gil.github.io/TRoadster/

Source, equations and assumptions: https://github.com/Albert-Gil/TRoadster

## LinkedIn draft

Fan suction, compressed-air thrust, and a car that can hop.

I built RoadsterLAB, an interactive engineering lab that makes those ideas visible through four experiments:

- Launch: compare electric drive, fan-assisted traction and direct gas thrust.
- Hop: spend air on ascent, then use the remaining tank for automatic or manual descent braking.
- Invert: rotate a platform and watch contact loads, sliding and seal loss determine whether the car stays attached.
- Turn: keep speed and steering fixed, then see limited grip make the car run wide onto the grass.

Behind the 3D scene are mass and energy balances, a consistent Peng–Robinson dry-air approximation, tank heat exchange, choked/unchoked nozzle flow with pressure thrust, and vehicle/contact constraints. The interface exposes the parameters, force vectors, gas state and synchronized plots so you can explore the tradeoffs yourself.

The goal was to connect a clear visual experience with transparent engineering. All hardware inputs are illustrative assumptions, and the outputs are simulated results. The README explains the equations, numerical solution and model limits.

Try it: https://albert-gil.github.io/TRoadster/

Code and physics: https://github.com/Albert-Gil/TRoadster

#Engineering #Simulation #Thermofluids #VehicleDynamics

## X draft

I built RoadsterLAB: a 3D vehicle-physics lab for fan-assisted grip, compressed-air thrust, hops and a rotating platform.

Real-gas blowdown, nozzle flow and vehicle dynamics. Illustrative inputs; simulated results.

https://albert-gil.github.io/TRoadster/

## Optional technical reply

The model couples tank mass/energy balances, temperature-dependent heat input, a consistent Peng–Robinson air EOS and choked/unchoked nozzle expansion. Vehicle motion includes traction, fan power and contact limits.

Equations and assumptions: https://github.com/Albert-Gil/TRoadster

## Short portfolio description

**RoadsterLAB — interactive vehicle-physics simulation.** Developed a dependency-free browser lab connecting compressed-air thermodynamics, nozzle flow and vehicle/contact dynamics across Launch, Hop, Invert and Turn experiments. Built a procedural WebGL vehicle, experiment-specific tuning, synchronized analysis, landing prediction and video export. Documented reduced-order assumptions and numerical methods, with 128 automated verification tests. All vehicle inputs are illustrative; this is an independent engineering study.

## Suggested video alt text

A 26-second RoadsterLAB demonstration shows a red car accelerating, hopping and landing; a teal car on a platform rotating upside down; and two cars taking a bend with different grip limits. Captions show the experiment, calculated results and a governing physics equation. A closing overlay links to the interactive lab. Inputs and results are labeled as illustrative and simulated.

## Video files and edit

- `RoadsterLAB-launch-landscape.mp4`: 1920 × 1080, H.264, silent.
- `RoadsterLAB-launch-portrait.mp4`: 1080 × 1920, H.264, silent.
- Both are approximately 26.1 seconds at 30 fps constant frame rate. Source frames are duplicated as needed; playback speed and physics timing are unchanged within each excerpt.
- Sequence: Launch → Hop → Invert → Turn, with a 1.5-second final hold and the live URL shown near the end.
- Original caption bands, calculated results, equations, author credit and illustrative-model disclosure are retained.
- These are drafts for review. No social posts have been published.

## Final review

Watch the portrait clip on a phone and check the captions at normal viewing size. The edited clips are intentionally silent. For the app's optional wreck sound, a human listening check on actual speakers/headphones remains necessary; waveform/trigger tests do not establish subjective tone or loudness.

The published app and its 128-test suite were verified before this media edit. Focused audio checks passed 3/3. These checks are software verification; actual phone/headphone review remains separate.
