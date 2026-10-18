# TRoadster / IMPULSE

Interactive engineering portfolio lab inspired by the redesigned Tesla Roadster. The application lives in [`impulse/`](impulse/). This is an independent exploratory simulator, not a Tesla digital twin.

**Watch / Try:** [Live demo](https://albert-gil.github.io/TRoadster/?demo=1) · [Capture / record preset](https://albert-gil.github.io/TRoadster/?demo=1&capture=1)

Built with Node 24, zero npm dependencies, RK4 physics, and native WebGL. All vehicle numbers are illustrative assumptions — not Tesla specifications.

## Run

Requires Node.js 24 or later. No package install.

```sh
cd impulse
node scripts/build.mjs
node scripts/serve.mjs
```

Open http://127.0.0.1:4173. Standalone file: `impulse/dist/impulse.html`.

```sh
node --experimental-strip-types --test tests/physics.test.ts
```

See [impulse/README.md](impulse/README.md) for the model, assumptions, demo sequence, and limitations.
