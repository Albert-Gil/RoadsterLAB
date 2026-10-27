# Simulation-Driven Audio System

## Status and provenance

Local implementation, 2026-10-20. All 17 supplied recordings were generated with
**ElevenLabs**. They are conceptual effects, not actual Tesla Roadster recordings
or experimentally validated acoustic predictions. Physics, gas inventory and
simulation clocks are unchanged. Subjective listening and physical iOS review are
still required.

The user confirmed their ElevenLabs **Creator** plan and full ownership/licensing
rights for the supplied sounds on 2026-10-20. `assets/audio/RIGHTS.json` records
that user confirmation. `node scripts/check-audio-rights.mjs` now passes; the
audio-specific deployment block is cleared. Publication remains a separate project
action, and this audio update has not been published.

Provider references: [publishing guidance](https://help.elevenlabs.io/hc/en-us/articles/13313564601361-Can-I-publish-the-content-I-generate-on-the-platform)
and [Music Terms](https://elevenlabs.io/music-terms). Rights status is based on the
user's confirmation for this library.

## Assets and preparation

- `assets/audio/original/`: byte-identical supplied WAVs, SHA-256 in catalog.
- `assets/audio/web/`: browser copies, no new recordings.
- `assets/audio/catalog.json`: original and processed metadata, hashes, gains,
  loop durations, edge jumps, RMS and peaks.
- `src/audio-assets.js`: generated browser catalog.
- `scripts/prepare-audio.py`: offline processing with Python and numpy; not a
  browser/runtime dependency. Rerun with the original ZIP path to import, or with
  no argument to reprocess preserved originals.

All inputs are 48 kHz, 16-bit PCM, stereo. Music is 20 s; effects range from
0.806–8 s. Retain stereo for music, aero and major wreck; downmix the other 14 to
mono. Remove DC. Loops have an equal-power cyclic overlap (500 ms music, 200 ms
effects), reducing their periods by that overlap. Unlike fading to silence, this
stitches the tail into the head with continuous material across the wrap. One-shots
retain their transients with 3 ms entry / 35 ms exit fades. Target RMS is 0.14,
with gain increase capped at 4× and peak capped at 0.8. Source clipping is not
repaired or disguised. Perceived loudness still needs listening calibration.

The 17 browser WAVs total **11,310,796 bytes** (~10.8 MiB), down from ~16.8 MiB of
original WAV data. No lossy codec round-trip or MP3-to-WAV expansion. The music
loop is now 19.5 s. The served app preloads recordings after audio activation (automatic startup when
allowed, otherwise the first interaction), then loads the library through three concurrent fetch/decode lanes. This avoids
a first-event delay on later mode changes. Each file is decoded once per page;
the 11 loop sources run once and retain phase even when their gains are zero.
Decoded PCM is about 22.6 MB at 48 kHz (more if the device resamples to a higher
context rate). No external framework or network service is required.

**Compressed delivery (2026-10-26).** `python scripts/encode-web-audio.py` (ffmpeg with
libopus and AAC) writes `assets/audio/compressed/<name>.webm` (Opus) and `.m4a` (AAC-LC)
from the processed WAVs, plus `manifest.json` with exact frame counts and SHA-256. The
17 Opus files total about 0.96 MB (AAC about 1.44 MB) instead of 11.3 MB. Loops are
encoded with a wrapped 0.25 s lead-in on both sides so the codec sees real neighbours at
the seam; `conformBuffer` keeps exactly the original frames. The served page tries Opus,
then AAC (by `canPlayType`), then the WAV, per file. Headless Chromium decoded every
Opus and AAC copy with zero sample offset and the original length; Safari, Firefox and
subjective listening remain to be checked on real devices. The WAV masters, catalog
hashes and the standalone embedding are unchanged.

The committed `.m4a` files also carry a signed Content Credentials (C2PA) box
(5,877 bytes each, placed before `moov`) that was added when these files were delivered
from the Claude session; chunk offsets were rewritten with it and the decoded PCM is
identical (ffmpeg and Chromium). `manifest.json` records the delivered bytes and hashes.
Re-running the encoder writes unstamped files and a matching manifest.

The standalone HTML embeds the same processed WAVs as data URLs and decodes only
on audio activation. Its larger size is deliberate offline support. Release staging copies
the served asset directory and records the rights status in START-HERE.txt. Replacing recordings
requires reprocessing and rebuilding both paths; do not hand-edit generated HTML.

## Mode allocation and physical inputs

Music is shared, quiet and independent of the simulation transport. All other
layers follow the **selected** car, not a sum of simultaneous comparison cars.

| Mode | Active allocation | Physical inputs and conditions |
| --- | --- | --- |
| Launch | `motor_low/mid/high`, `aero_noise`, fan start/loop/stop + `seal_leak_loop` for fan cases, thrust start/loop/stop for actual delivery, `tire_scrub_loop` at traction limitation | `v`, transmitted `tire`, `thrust`, `flow`, `limit`, selected mode, `fanModel` operating power and leakage volume flow |
| Invert | Dominant fan start/loop/stop, leakage, aero; `surface_slide_loop`, scrub and skid only with sliding deck contact; supported wreck events | Sampled `downforce`, `contact`, `v`, `alongV`, `normal`, `tire/capacity`; actual suction corrects any electrical-budget clamp |
| Hop | Dominant thrust start/loop/stop, vertical aero, supported abnormal impact | Delivered `thrust/flow`, speed magnitude `v=abs(vy)`, supported WRECKED touchdown speed and configured threshold |
| Turn | Three motor bands, aero, subtle fan start/loop/stop and leakage for selected fan case, progressive scrub | Prescribed `v`, speed-hold drive force, actual `fanForce/fanPower`, normal load, friction coefficient, capped lateral force and drive force in the combined friction circle |

Shared event inventory: `thrust_start`, `thrust_stop`, `suction_start`,
`suction_stop`, `wreck_minor`, `wreck_major`. Shared loops: `background_music`,
three motor bands, `aero_noise`, `thrust_loop`, `suction_loop`, `seal_leak_loop`,
`surface_slide_loop`, `tire_scrub_loop`, `tire_skid_loop`. Every file is loaded;
availability is not a claim that every experiment can trigger every file.

### Physical quantities versus perceptual mappings

`src/audio-mapping.js` is a pure function; `AUDIO_MIX` holds gains, smoothing and
thresholds. The app supplies solver samples/configuration and its existing
`fanModel` output; audio never calls or modifies the solver. Speed bands are
0/25/60 m/s with cosine/sine equal-power crossfades, plus a modest 0.88–1.16×
playback-rate range. Tire force gates motor operation. Aero uses a bounded
speed^1.6 mapping, not a wind-tunnel sound prediction. There is no calculated motor
RPM; speed is the stated proxy. Invert has no driven wheels; Hop has no road
drivetrain. Motor files remain available but are silent in these models.

Thrust gain uses sqrt(delivered force / 90 kN), gated by positive flow and force.
Fan gain uses sqrt(actual operating power / 150 kW); Invert is dominant, Turn
restrained. Leakage gain uses sqrt(ambient-density × leakage volume flow /
12 kg/s). The existing orifice model includes an effective base leak area;
leak=0 does not mean a hermetic seal. Loss of Invert seal/contact removes fan and
leakage. Invert/Turn electrical clamps scale flow from actual pressure using the
same sqrt(dp) orifice relation. No fan inertia is simulated; the recording's
start/stop character and crossfade are presentation only.

Invert surface interaction uses real relative deck sliding speed, contact normal
load and an intact suction seal. Tire skid uses actual `abs(alongV)` with 0.15 m/s
on / 0.07 m/s off hysteresis. It fades into scrub as the vehicle slows. This is
deck sliding, not an invented slip ratio. Invert attachment alone produces no
surface-slide recording.

Turn scrub uses `hypot(driveForce, min(lateralDemand,lateralCapacity)) / (mu*normal)`.
It rises smoothly from 65% to 98% utilization. Lateral acceleration never changes
motor pitch. The Turn solver caps curvature and does **not** solve tire slip
angle/ratio; its wider path/runoff therefore does not trigger `tire_skid_loop`,
surface sliding or collision recordings. Launch exposes a traction-limited status
rather than resolved slip: that status is the scrub proxy, smoothed in audio,
without invented wheelspin/skid. No separate traction-recovery sound exists.

Only forward completion of a supported **WRECKED** Hop touchdown or Invert ground
impact triggers a collision recording. Speed strictly above the existing cosmetic
threshold selects minor; above 1.75× that threshold selects major. This split is
an explicitly perceptual severity setting, not a new damage rating. Intact
landings, no-lift, property limits, unresolved secondary deck contact, paused
scrubbing, Launch and Turn runoff never trigger an impact. No solver was changed
to make otherwise unavailable sounds play.

## Mixing, controls and lifecycle

`src/audio.js` owns one Web Audio context, buffer catalog, persistent loop bank,
transition gates and cleaned-up one-shots. A 30 ms control clock reads interpolated
solver samples from the existing playback clock independently of scene renders;
it does not integrate physics. Paused transport avoids repeated gain updates.
Gain targets typically use a 65 ms
time constant (~195 ms to 95%); pitch uses 90 ms. Start/stop recordings fire only
on state edges, cancel the opposite transient, and crossfade with the sustained
layer. Resume may play startup for an already-active system to re-establish its
audible state; pause/seek/reset never play a fictitious shutdown event.

Effects and music have independent gain buses; a 0.35 music trim keeps the bed
below the default dominant motor/fan layers. The fixed master gain feeds a
compressor and bounded soft safety stage with output headroom. Music ducks to 28%
of its chosen level during thrust, and for 1.8 s around major impacts. The latter
release is scheduled on the audio clock even after the visual loop becomes idle.
PCM headroom and output bounding prevent digital sample clipping; perceived mix
balance, timbre and transition seams require listening, not only peak checks.

Sound now defaults to **on**. The top-bar **Sound** toggle mutes or enables it.
**Parameters → Sound settings** contains separate music/effects sliders; zero
independently mutes either bus. Automatic startup is attempted when the browser
allows it. If the context is suspended by autoplay policy, the first real pointer
or keyboard interaction resumes it; no browser policy is bypassed and no hanging
resume request is left at page load. Volumes and explicit mute choices persist in
localStorage. The v3 preference migrates legacy volumes while applying the new on
by default policy; subsequent explicit mutes remain honored. Context interruptions
can recover on the next interaction while sound is enabled. Status text reports
loading/partial failures; missing assets leave other layers usable.

Music continues across pauses, scrubbing, parameter editing and mode switches
without restarting. Effects fade on pause; explicit seek/reset/recompute/mute
cancels transients. Natural completion preserves the collision decay. Hidden
pages silence both buses and pause the experiment. On return the music resumes
at its existing loop phase; effects wait for playback. Silent video export mutes
the presentation and never captures audio. Page disposal stops/disconnects loop
and event sources and closes the context; BFCache entry only silences it.

## Verification and review

Automated tests cover real solver-to-audio mapping for all four modes, constant
Turn pitch, fan/airflow clamps, no airborne tires, actual Invert sliding with
hysteresis, transition edge counts, music continuity, default-on/autoplay policy,
remembered mute, legacy volume migration, missing assets,
loading races, interruption, visibility, export mute, one-shot cleanup, preferences,
source hashes and WAV format/headroom. The standalone build embeds all assets.

For the native browser probe, copy `tests/browser/audio-check.html` into `dist/`
after building, serve locally, open `/audio-check.html` and click **Run audio
checks**. It decodes the actual WAVs and exercises Web Audio plus an offline
all-file overlap stress render. The probe is a local verification page, not part
of the build or public app.

Manual acceptance: listen with headphones and speakers to at least two music
wraps, each loop seam, motor band boundaries, short/long thrust pulses, fan loss,
deck sliding, intact/wrecked impacts, rapid toggles, and pause/resume. Check quiet
and maximum mixes and real iOS Safari autoplay/interruption/touch. Browser/mock
checks cannot certify subjective sound quality or acoustic realism.


### Recorded verification, 2026-10-20

- Final full suite: **144 passed, 0 failed**; build parses served/standalone code,
  checks embedded recordings equal served WAVs and preserves solver/worker parity.
- Browser native AudioContext: **17/17 decoded**, 48 kHz, no unavailable assets;
  real selected-mode layers, shared loop identity, independent mute, impact gating,
  cancellation and disposal checks passed. No console errors/warnings were observed.
- Native OfflineAudioContext: all 17 files intentionally overlapped at full effects
  volume for 3 s through the output chain; measured peak **0.71014**, finite output.
  This is a stress check, not an acoustic validation or every possible mix phase.
- Served app playback/switching exercised in all four experiments; WebGL error 0
  observed. Standalone HTML loaded and decoded its embedded recordings successfully.
- Desktop and 390 px iframe layouts inspected; both sliders exercised at phone
  width. Opening audio settings releases the sticky result card so it cannot hide
  the volume controls. This is browser-width testing, not physical mobile testing.
- Review evidence: `../share/audio-20261020/` contains native verification JSON and
  desktop/phone control captures. Build/test logs remain in ignored `dist/`.
- Creator-plan ownership/licensing confirmed by the user; nothing uploaded,
  committed, deployed or posted.
  Subjective headphone/speaker listening, long music-loop listening and real iOS
  autoplay/interruption remain outstanding.


### Default-on follow-up, 2026-10-20

The user subsequently requested sound on by default. Three additional automated
checks cover blocked-autoplay first-interaction startup and remembered mute,
automatic startup when allowed plus pending-load cancellation, and legacy-volume
migration. Full suite: 147 passed. Desktop browser reload/mute/first-interaction
behavior was also exercised; this does not establish physical iOS behavior.
