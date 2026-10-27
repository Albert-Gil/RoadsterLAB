# RoadsterLAB — social media package, 27 October 2026

Fresh captures of local HEAD 26f9959 (M10/M11 plus Hop/Invert playback fix).
The application commits through 26f9959 are included in remote main at 6fd0b51
(confirmed before the media commit). This task does not deploy the website;
check the public page before posting. No social posts have been sent.

## Ready-to-upload files

- RoadsterLAB-social-landscape.mp4 — 1920×1080, 30 fps, H.264/AAC, 19.67 s,
  approximately 9.3 MB. Main LinkedIn/project-page video.
- RoadsterLAB-social-vertical.mp4 — 1080×1920, 30 fps, H.264/AAC, 19.65 s,
  approximately 8.7 MB. Independently rendered vertical composition, not a crop.
- video-cover.jpg — opening three-car Launch shot, 1920×1080.
- 01-launch-plots.png — three cars, SI speed milestones, position/speed/acceleration.
- 02-hop-plots.png — ascent, coast and same-tank automatic landing burn.
- 03-blowdown-plots.png — pressure, temperature and remaining air, with cutaway.
- 04-turn-plots.png — grip budget and paths for a 120° corner.
- 05-invert-plots.png — rotating platform and contact/suction loads.
- 06-desktop-launch.png — current app, director view, live force panel and car values.
- 07-desktop-turn.png — current app, friction circle, paths and sun shadows.
- 08-phone-turn.png / 09-phone-launch.png — current responsive phone interface.

Five plot boards are 1920×1080. Desktop screenshots are 1265×932 crops;
phone screenshots are 430×884 crops from a 430×932 browser viewport.
Phone captures are responsive browser views, not photographs of a physical device.
Plots show the whole solved trace for publication; the playhead marks the current
sample. Plot readouts and scene samples use the same time. UI captures retain the
app's predict/reveal behavior.

## Suggested publication sequence

1. Lead with the landscape video and video-cover.jpg; use POST-DRAFT.md.
2. In a later image post, attach 06-desktop-launch.png, 04-turn-plots.png,
   03-blowdown-plots.png and 09-phone-launch.png, in that order.
3. Use the vertical video for a vertical feed/story/reel placement. Keep its built-in
   title and captions inside the platform's preview crop. Both versions have sound.
4. Ask for feature suggestions and bug reports. Tag only relevant contributors.

## Source and verification

The current native renderer supplies sun shadows, bloom, rigs and scenery.
Launch uses the deterministic director camera. Hop reaches 5.551 m with approximately
1.004 m/s touchdown. Turn starts close, reveals the 120° corner and includes both cars.
No result values were invented or tuned to a manufacturer performance claim.
Video instrument panels use the current overlay.js budget helpers in a publication
layout; they are not the app's HTML overlay. Presentation time differs from solver time.
The new folder contains its own studio/prepare files; older media were preserved.

Built the app and checked publication-script syntax. Inspected representative images
from Launch, Hop, Invert and Turn, including vertical framing. Confirmed both MP4s
are 30 fps H.264 with AAC audio. Audio has nonzero content and a bounded recorded
peak; no microphone/system audio was captured. No extra full regression suite was run.
No app source, solver, repository history or deployment was changed by this task.

Original browser recordings and full-page source screenshots stay in this folder
for future edits; the ZIP includes only the final media, drafts, settings and guide.
