# RoadsterLAB — portfolio release

An interactive engineering lab by **Albert Gil-Esmendia**, connecting vehicle
forces, compressed-air thermodynamics and contact limits in four visual experiments.

## Experience

- Launch compares electric drive, fan suction and finite cold-gas thrust.
- Hop predicts the complete ascent/return trajectory, with automatic or manual
  descent braking from the same remaining tank.
- Invert rotates a finite platform from a starting angle to a final angle.
- Turn shows how limited grip makes a car run wide and continue onto grass.
- Parameters start hidden, with a large labeled button beside Launch/Replay and
  another entry in the top bar. The nonmodal desktop side panel / phone inline
  panel retains practical increments, stable pending layouts and calculated comparisons.
- A 36-second Showcase exports captioned landscape or portrait video, with calculated
  results, compact physics equations and author credit. MP4/WebM support is browser-dependent.
- Refined paint, sunrise lighting and cutaway tracking. White cold-gas cores expand
  into turbulent clouds; Hop adds illustrative ground spread and improved framing.
- A procedural Starbase-inspired campus with a rocket/catch
  tower, tank farm, hangars, coastal terrain and sunrise sky. Decorative geometry
  leaves the physics unchanged and is included in served and standalone builds.
- Seventeen supplied ElevenLabs recordings provide simulation-driven motor, air,
  fan, tire and supported impact layers. Sound defaults on after browser permission;
  explicit mute and separate music/effects volumes persist. Music continues during
  pauses; hidden pages and silent export mute both. Creator-plan rights confirmed.

## Engineering

The webpage now exposes eight expandable equation/assumption cards. The GitHub
README documents governing balances, default inputs, numerical solution and model
limits in detail: consistent Peng–Robinson dry-air properties; signed vessel heat
exchange `UA(T_source − T_gas)`; stagnation-enthalpy discharge; choked/unchoked nozzle
expansion and pressure thrust; optional valve/feed/bell losses; traction and shared
fan/electrical budgets; rotating contact loads; and grip-capped corner geometry.

RK4 integration, explicit valve transitions, contact-event searches and model-limit
stops produce stored SI traces used by workers, plots, playback and CSV. Numerical
tests check software consistency and limiting cases; they do not establish physical
validation. All vehicle/component inputs remain illustrative assumptions.

## Distribution and review

Includes a dependency-free static website, offline standalone HTML, source snapshot,
physics README, release guide and SHA-256 manifest. Local video exports have been
encoded and decoded in landscape and portrait. Review physical iOS/touch,
assistive technology and subjective sound separately.

Publication uses the existing main-branch GitHub Pages workflow. A version tag is
not required. See RELEASE.md for packaging and verification.
