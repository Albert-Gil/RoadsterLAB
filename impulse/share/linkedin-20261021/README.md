# RoadsterLAB LinkedIn materials

Publication materials requested 21 October 2026. Canonical repository:
https://github.com/Albert-Gil/RoadsterLAB. Website:
https://albert-gil.github.io/RoadsterLAB/. No social posts were sent.

## Showcase edit

The new cut is approximately 19.6 seconds, with a larger RoadsterLAB wordmark and
no “Albert Gil-Esmendia / Engineering & Simulation” line.

| Presentation clock | Scene | Purpose |
|---|---|---|
| 0–5.6 s | Launch, three cars | Compare electric drive, fan assistance and cold-gas thrust. |
| 5.6–9.3 s | Hop | 5.55 m apex, automatic descent braking, approximately 1.00 m/s touchdown. |
| 9.3–13.8 s | Invert | Show rotation and attachment through 180 degrees. |
| 13.8–16.8 s | Turn | A 120° corner; start close to both cars and pull back as their paths separate. |
| 16.8–19.6 s | End card | Live URL, experiment invitation and request for development suggestions. |

Hop and Turn run close to physical time. Invert omits most of the final stationary
hold; Launch is mildly accelerated. Presentation time and physical time remain
distinct; the visible T+ follows the actual stored solver sample. No simulation
results were changed to speed up the edit.

The publication studio uses one persistent recording renderer and precomputed
results. It does not mount a new application interface/WebGL context at every
chapter. Chapter cameras cut directly; the old endpoint holds and inter-mode
camera sweeps are removed. Within Turn, the camera starts around both live vehicle
envelopes and smoothly reveals the complete 120° corner. It includes the no-fan
runoff car throughout. The interactive Corner overview is also approximately 12%
closer. The in-app showcase uses the same 120° corner and reveal; the ordinary
Turn experiment retains its editable default sweep. These local source changes
do not alter the solver or the currently deployed website.

## Higher Hop example

400 barg / 600 L, 0.40 s ascent command, automatic landing target 1.0 m/s,
0.12 s valve rise, 4% feed pressure loss, converging nozzle. The actual solver
returns 5.551 m maximum height, 1.004 m/s touchdown and a 3.282 s flight. The
landing forecast is feasible. `HOP-SETUP.json` stores the full configuration and
forecast. The calculated landing speed is a model result, not validated hardware
performance. A smooth valve opening does not imply a suspension/contact model.

## Plot screenshots

All five PNGs are 1920 × 1080. They use the app's actual KinematicPlots controller
and the same solver traces, arranged for publication rather than showing the
parameter panel. No plots or results were invented.

1. `01-launch-plots.png`: position, velocity and acceleration for all three cars.
2. `02-hop-plots.png`: altitude, signed vertical velocity and acceleration, with
   ascent cutoff, apex, landing ignition and touchdown markers.
3. `03-blowdown-plots.png`: pressure in bara, temperature in K and remaining air
   mass in kg, plus the pressure-vessel cutaway.
4. `04-turn-plots.png`: lane deviation, requested grip/capacity and normal load
   for the revised 120° corner. `TURN-SETUP.json` stores the example settings.
5. `05-invert-plots.png`: platform angle, contact load and fan suction.

Recommended post pairing: the showcase video as the main post; Launch, Hop and
Blowdown boards as a follow-up carousel. The three-car Launch image remains the
opening visual. Use the preferred Hop / Turn headlines already included.

## Working files

`prepare.mjs` computes these four independent example setups and copies studio
files to ignored `dist/`. From impulse/: `node scripts/build.mjs`, then
`node --experimental-strip-types share/linkedin-20261021/prepare.mjs`.
Open `http://127.0.0.1:4173/publication-studio.html` after starting the local server.
`studio.html` / `studio.js` own the publication layout and recording. The source
recorder's wordmark was also enlarged and its credit line removed for future
local exports. Source, materials and canonical URL references accompany the
repository rename to RoadsterLAB.

Per the author's request, no extra local regression suite or broad browser/media
audit was run. The examples were calculated to produce the requested visuals;
the new MP4 contains H.264 video and stereo AAC audio. The
The publication video now includes background music and the existing
simulation-driven sound layers: motor/aero, fan/leakage, cold-gas pulses and
supported surface sounds. No impact is invented for the intact Hop or Turn runoff.
Music ducks during gas thrust and fades at the end card. Recording captures the
same master limiter used by the app and stops its audio resources on completion
or background cancellation. The mix uses a fresh private audio instance, so it
does not overwrite the viewer's saved volumes or mute preference.

The general recorder accepts an optional audio stream; exports without a supplied
stream retain their existing silent behavior. The publication studio supplies the
stream explicitly. Supplied ElevenLabs Creator-plan redistribution rights were
confirmed by the author. These are illustrative sounds, not Tesla recordings.
