# M9 review record

The parameter-workspace redesign is implemented locally. Physical-device and
subjective review items below remain open; responsive browser emulation is not a
physical iOS test. Nothing was published.

## Local checks

- All 102 regression tests pass, including four new tuning-summary checks: real
  Launch fan isolation, no-lift/manual landing/Invert states, distinct Turn events,
  and rounded changes. Served/direct/standalone worker parity remains covered.
- Desktop 1280x900 and narrow 390x844: the scene is not covered by parameters;
  guidance, numeric inputs, slider keys, presets, result differences and replay
  were exercised. No horizontal overflow observed. Model/data limitations remain disclosed.
- A tire-grip change at T+1.00 s retains that time and changes the rendered cars,
  telemetry and predictions. Rapid edits clear old results and identify both values.
  Empty input marks the control invalid and disables replay. Replay returns to and
  focuses the vehicle. Parameters navigation pauses playback.
- Launch grip 1.35 and fill 400.5 barg share as those exact inputs. Switching to an
  Invert slide preset and back restores those Launch values. The Invert preset
  correctly gives a 90-degree release and about 6.90 m/s cosmetic impact.
- Manual Hop at a 0.35 s ascent / T+2.21 s ignition predicts 1.38 m/s, intact.
  Moving ignition to 2.50 s predicts 11.10 m/s, wrecked. The no-lift preset reports
  INSUFFICIENT LIFT. Both-pass Turn preset reports two successful exits at 3.91 s.
- Sampled parameter text on its actual #151f23 background has contrast 7.39:1
  (clock), 8.64:1 (hints), 8.74:1 (differences), 9.30:1 (guide) and 12.80:1 (labels).
  This samples the tuning panel, not every element or state in the application.

- Final standalone HTTP preview: 105 km/h Turn recalculates and completes at
  2.73 s, with WebGL error 0. Its downloaded CSV has 2,486 finite rows, SI speed
  105/3.6 m/s in configuration and one unchanged tank state. Direct file: loading
  was not checked; no standalone module import is needed by the built artifact.
- Repeated Launch starts RUN 02 with 138.9 kg / 207 K. Editing Hop fill to 300 barg
  and returning to Launch preserves RUN 02, the 400 barg Launch fill and the exact
  shared inventory/setup URL. Sound settings in the new panel and opt-in were
  exercised with master volume at zero; no listening claim is made.
- Final full test run: 102 passed, zero failed, about 35.2 s. Build and app/ui/
  tuning/scene/plots syntax checks pass. No browser console errors were observed.
  Whitespace check passes. Physics equations and numerical export schemas are unchanged.

## Physical and user review still required

After an approved build is available on the device:

- [ ] iPhone Safari: portrait and landscape, numeric keyboard, fractional pressure,
  ranges, parameter navigation/replay, model dialog and scroll positions.
- [ ] Hardware touch: one-finger orbit, pinch zoom, range dragging, page scrolling,
  time scrubbing and no accidental activation of nearby controls.
- [ ] VoiceOver or NVDA: experiment navigation, Parameters heading jump, labeled
  numeric/range pairs, help text, errors and result announcements. Confirm that
  continuous playback does not flood announcements and that focus stays useful.
- [ ] OS Reduce Motion: instant camera changes and settled cosmetic damage; physics
  and explicitly started playback remain consistent.
- [ ] Listening: comfortable volume, motor/gas balance, pause/end silence, parameter
  edits, backgrounding and return. Automated audio lifecycle checks are separate
  from this subjective listening check.
- [ ] Final visual approval: scene readability, useful guidance, meaningful presets
  and an easy edit -> result -> replay loop for all four experiments.

## Quick review exercises

1. Launch: load Default comparison, pause at 1 s, lower tire grip, and compare the
   same moment and all three 0-60 mph predictions. Replay the new setup.
2. Invert: load Slide, lose seal, fall. Change the fan, read the predicted outcome,
   then replay with force vectors. The angle remains fixed.
3. Hop: load Manual / timed example. Compare ignition at 2.21 s and 2.50 s. Then
   try automatic mode; its target/lead controls are under More variables.
4. Turn: load Fan makes the corner. Compare 60, 100 and 160 km/h while holding
   steering fixed. Cars leaving the lane continue onto visual grass without wrecks.


## Follow-up: optional Parameters and default-on sound (2026-10-20)

Parameters now starts collapsed, with desktop space returned to the scene and
telemetry. The existing nonmodal panel is revealed by its toggle; phone layout
reveals it inline. Escape/close restore opener focus, presets preserve panel state,
and Replay closes it. The experiment button/timeline sits directly below the scene.
Sound defaults on, subject to browser autoplay; first interaction starts a suspended
context, and explicit mute is remembered. This supersedes the earlier always-visible
workspace and opt-in default described in the historical checks above.
