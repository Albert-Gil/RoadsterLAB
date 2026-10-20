# RoadsterLAB launch media

Prepared social-launch assets for review. No social posts have been published.

| File | Format | Duration |
|---|---|---:|
| RoadsterLAB-launch-landscape.mp4 | 1920 x 1080, H.264, 30 fps, silent | 26.10 s |
| RoadsterLAB-launch-portrait.mp4 | 1080 x 1920, H.264, 30 fps, silent | 26.13 s |

The cuts show Launch, Hop, rotating Invert and Turn. They retain the calculated
results, physics captions, author credit and model disclosure, with a closing
link to https://albert-gil.github.io/TRoadster/. All vehicle inputs are illustrative
assumptions; these are simulated results, not measured Tesla performance.

POST-DRAFTS.md includes LinkedIn/X drafts, a portfolio description and video alt
text. verification.json records dimensions, duration, codec, decoding checks and
fast-start metadata. Phone-size sampled frames were reviewed; physical-device and
subjective listening checks remain separate.

## Reproduce the edit

Export the 36-second landscape and portrait Showcase clips from the app first.
The four source time windows and final hold are in edit-recipe.json. Put the
source clip and the corresponding .ffscript file in a working directory. Supply
a locally installed monospaced TrueType font as font.ttf; no font is redistributed.

Example for landscape, using FFmpeg:

```sh
ffmpeg -i roadsterlab-showcase-landscape.mp4 -filter_complex_script landscape.ffscript -map '[out]' -an -c:v libx264 -profile:v high -level:v 4.1 -crf 19 -preset medium -pix_fmt yuv420p -movflags +faststart RoadsterLAB-launch-landscape.mp4
```

Use the portrait source/filter/output names for the second format. The edit
resamples presentation frames to 30 fps; it does not recalculate the physics.
Recorded timestamps can shift by a frame between browser runs, so review cuts
and captions when using a newly recorded source.
